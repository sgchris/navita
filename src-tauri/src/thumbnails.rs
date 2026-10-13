//! Image thumbnails for the file views, served to the webview through the `thumb://` scheme.
//!
//! URL: `thumb://localhost/<percent-encoded absolute path>?px=<longest side>&m=<modified ms>`.
//! Thumbnails are produced by macOS ImageIO (all common formats, camera RAW, HEIC, EXIF
//! orientation applied) and cached in memory; SVG files are served unchanged.

use std::collections::{HashMap, VecDeque};
use std::path::Path;
use std::sync::{Arc, LazyLock, Mutex};

use percent_encoding::percent_decode_str;
use tauri::http::{Response, StatusCode};

use crate::error::AppError;

/// Lowercase extensions that get a thumbnail; mirrors the image category in `lib/fileTypes.ts`.
pub const IMAGE_EXTENSIONS: [&str; 14] = [
    "png", "jpg", "jpeg", "gif", "heic", "heif", "webp", "tiff", "bmp", "svg", "raw", "cr2", "nef",
    "dng",
];

const MAX_FILE_BYTES: u64 = 256 * 1024 * 1024;
const MIN_PX: u32 = 16;
const MAX_PX: u32 = 256;
const CACHE_MAX_ENTRIES: usize = 300;
const CACHE_MAX_BYTES: usize = 64 * 1024 * 1024;

/// An encoded thumbnail ready to be sent to the webview.
#[derive(Debug, Clone)]
pub struct Thumbnail {
    pub bytes: Arc<Vec<u8>>,
    pub mime: &'static str,
}

#[derive(Debug, Clone, PartialEq, Eq, Hash)]
struct CacheKey {
    path: String,
    modified_ms: i64,
    px: u32,
}

#[derive(Default)]
struct Cache {
    entries: HashMap<CacheKey, Thumbnail>,
    order: VecDeque<CacheKey>,
    bytes: usize,
}

impl Cache {
    fn get(&self, key: &CacheKey) -> Option<Thumbnail> {
        self.entries.get(key).cloned()
    }

    fn insert(&mut self, key: CacheKey, value: Thumbnail) {
        if self.entries.contains_key(&key) {
            return;
        }
        self.bytes += value.bytes.len();
        self.order.push_back(key.clone());
        self.entries.insert(key, value);
        while self.entries.len() > CACHE_MAX_ENTRIES || self.bytes > CACHE_MAX_BYTES {
            let Some(oldest) = self.order.pop_front() else {
                break;
            };
            if let Some(removed) = self.entries.remove(&oldest) {
                self.bytes -= removed.bytes.len();
            }
        }
    }
}

static CACHE: LazyLock<Mutex<Cache>> = LazyLock::new(|| Mutex::new(Cache::default()));

fn is_image_extension(path: &Path) -> Option<String> {
    let extension = path.extension()?.to_str()?.to_ascii_lowercase();
    IMAGE_EXTENSIONS
        .contains(&extension.as_str())
        .then_some(extension)
}

fn bad_request(path: &Path, message: &str) -> AppError {
    AppError::Io {
        path: path.to_string_lossy().into_owned(),
        message: message.to_owned(),
    }
}

/// Thumbnail of the image at `path` with its longest side at most `px` (16..=256).
///
/// # Errors
/// Relative path, not an image extension, not a regular file, too large, or undecodable.
pub fn thumbnail(path: &Path, px: u32) -> Result<Thumbnail, AppError> {
    if !path.is_absolute() {
        return Err(AppError::InvalidPath {
            path: path.to_string_lossy().into_owned(),
        });
    }
    let extension =
        is_image_extension(path).ok_or_else(|| bad_request(path, "not an image extension"))?;
    let meta = std::fs::metadata(path).map_err(|e| AppError::from_io(&e, path))?;
    if !meta.is_file() {
        return Err(bad_request(path, "not a regular file"));
    }
    if meta.len() > MAX_FILE_BYTES {
        return Err(bad_request(path, "file too large"));
    }

    let px = px.clamp(MIN_PX, MAX_PX);
    let modified_ms = meta
        .modified()
        .ok()
        .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
        .and_then(|d| i64::try_from(d.as_millis()).ok())
        .unwrap_or(0);
    let key = CacheKey {
        path: path.to_string_lossy().into_owned(),
        modified_ms,
        px,
    };
    if let Ok(cache) = CACHE.lock()
        && let Some(hit) = cache.get(&key)
    {
        return Ok(hit);
    }

    let result = if extension == "svg" {
        let bytes = std::fs::read(path).map_err(|e| AppError::from_io(&e, path))?;
        Thumbnail {
            bytes: Arc::new(bytes),
            mime: "image/svg+xml",
        }
    } else {
        let bytes = imageio::png_thumbnail(path, px).map_err(|m| bad_request(path, &m))?;
        Thumbnail {
            bytes: Arc::new(bytes),
            mime: "image/png",
        }
    };
    if let Ok(mut cache) = CACHE.lock() {
        cache.insert(key, result.clone());
    }
    Ok(result)
}

/// Parses `thumb://localhost/<encoded path>?px=..&m=..` into `(path, px)`.
fn parse_uri(uri: &str) -> Option<(String, u32)> {
    let rest = uri.split_once("://")?.1;
    let after_host = rest.split_once('/')?.1;
    let (encoded_path, query) = after_host.split_once('?').unwrap_or((after_host, ""));
    let path = percent_decode_str(encoded_path)
        .decode_utf8()
        .ok()?
        .into_owned();
    let px = query
        .split('&')
        .find_map(|pair| pair.strip_prefix("px="))
        .and_then(|v| v.parse().ok())
        .unwrap_or(64);
    Some((path, px))
}

/// Builds the HTTP response for a `thumb://` request.
#[must_use]
pub fn respond(uri: &str) -> Response<Vec<u8>> {
    let empty = |status: StatusCode| {
        Response::builder()
            .status(status)
            .header("Access-Control-Allow-Origin", "*")
            .body(Vec::new())
            .unwrap_or_default()
    };
    let Some((path, px)) = parse_uri(uri) else {
        return empty(StatusCode::BAD_REQUEST);
    };
    match thumbnail(Path::new(&path), px) {
        Ok(thumb) => Response::builder()
            .status(StatusCode::OK)
            .header("Content-Type", thumb.mime)
            .header("Cache-Control", "max-age=3600")
            .header("Access-Control-Allow-Origin", "*")
            .body(thumb.bytes.as_ref().clone())
            .unwrap_or_default(),
        Err(AppError::NotFound { .. }) => empty(StatusCode::NOT_FOUND),
        Err(_) => empty(StatusCode::UNSUPPORTED_MEDIA_TYPE),
    }
}

/// ImageIO thumbnailing (spec spike T1).
mod imageio {
    use std::path::Path;

    use objc2_core_foundation::{
        CFBoolean, CFDictionary, CFMutableData, CFNumber, CFString, CFType, CFURL,
    };
    use objc2_image_io::{
        CGImageDestination, CGImageSource, kCGImageSourceCreateThumbnailFromImageIfAbsent,
        kCGImageSourceCreateThumbnailWithTransform, kCGImageSourceThumbnailMaxPixelSize,
    };

    /// PNG bytes of a thumbnail whose longest side is at most `px`, upright (EXIF transform).
    pub fn png_thumbnail(path: &Path, px: u32) -> Result<Vec<u8>, String> {
        let url = CFURL::from_file_path(path).ok_or("invalid path")?;
        // SAFETY: plain ImageIO calls with valid, retained arguments; the statics are constants.
        unsafe {
            let source = CGImageSource::with_url(&url, None).ok_or("not a readable image")?;
            if source.count() == 0 {
                return Err("no image in file".to_owned());
            }
            let max_pixel = CFNumber::new_i32(i32::try_from(px).unwrap_or(256));
            let yes = CFBoolean::new(true);
            let options = CFDictionary::<CFString, CFType>::from_slices(
                &[
                    kCGImageSourceThumbnailMaxPixelSize,
                    kCGImageSourceCreateThumbnailFromImageIfAbsent,
                    kCGImageSourceCreateThumbnailWithTransform,
                ],
                &[max_pixel.as_ref(), yes.as_ref(), yes.as_ref()],
            );
            let image = source
                .thumbnail_at_index(0, Some(options.as_opaque()))
                .ok_or("could not decode the image")?;

            let data = CFMutableData::new(None, 0).ok_or("out of memory")?;
            let destination =
                CGImageDestination::with_data(&data, &CFString::from_str("public.png"), 1, None)
                    .ok_or("no PNG encoder")?;
            destination.add_image(&image, None);
            if !destination.finalize() {
                return Err("could not encode the thumbnail".to_owned());
            }
            Ok(data.to_vec())
        }
    }
}

#[cfg(test)]
mod tests {
    use super::{IMAGE_EXTENSIONS, parse_uri, respond, thumbnail};
    use crate::error::AppError;
    use std::path::Path;
    use std::sync::Arc;

    fn decode_size(bytes: &[u8]) -> (u32, u32) {
        let image = image::load_from_memory(bytes).unwrap();
        (image.width(), image.height())
    }

    fn write_fixture(dir: &Path, name: &str, width: u32, height: u32) -> std::path::PathBuf {
        let path = dir.join(name);
        let image = image::RgbImage::from_fn(width, height, |x, y| {
            image::Rgb([(x % 256) as u8, (y % 256) as u8, 128])
        });
        image.save(&path).unwrap();
        path
    }

    #[test]
    fn keeps_the_aspect_ratio_for_png_and_jpeg() {
        let dir = tempfile::tempdir().unwrap();
        let wide = write_fixture(dir.path(), "wide.png", 200, 100);
        let tall = write_fixture(dir.path(), "tall.jpg", 100, 400);

        let wide_thumb = thumbnail(&wide, 48).unwrap();
        assert_eq!(wide_thumb.mime, "image/png");
        assert_eq!(decode_size(&wide_thumb.bytes), (48, 24));
        let tall_thumb = thumbnail(&tall, 96).unwrap();
        assert_eq!(decode_size(&tall_thumb.bytes), (24, 96));
    }

    #[test]
    fn small_images_are_not_enlarged_beyond_their_size_by_much() {
        let dir = tempfile::tempdir().unwrap();
        let tiny = write_fixture(dir.path(), "tiny.png", 20, 10);
        let (w, h) = decode_size(&thumbnail(&tiny, 64).unwrap().bytes);
        assert_eq!(w, h * 2, "aspect ratio is kept ({w}x{h})");
        assert!(w <= 64);
    }

    #[test]
    fn svg_is_served_unchanged() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("a.svg");
        let svg = b"<svg xmlns='http://www.w3.org/2000/svg' width='10' height='10'/>";
        std::fs::write(&path, svg).unwrap();
        let thumb = thumbnail(&path, 48).unwrap();
        assert_eq!(thumb.mime, "image/svg+xml");
        assert_eq!(thumb.bytes.as_slice(), svg);
    }

    #[test]
    fn rejects_bad_requests() {
        let dir = tempfile::tempdir().unwrap();
        let text = dir.path().join("note.txt");
        std::fs::write(&text, b"x").unwrap();
        assert!(matches!(thumbnail(&text, 48), Err(AppError::Io { .. })));
        assert!(matches!(
            thumbnail(Path::new("rel.png"), 48),
            Err(AppError::InvalidPath { .. })
        ));
        assert!(matches!(
            thumbnail(&dir.path().join("missing.png"), 48),
            Err(AppError::NotFound { .. })
        ));
        let fake = dir.path().join("fake.png");
        std::fs::write(&fake, b"definitely not a png").unwrap();
        assert!(thumbnail(&fake, 48).is_err());
        let folder = dir.path().join("dir.png");
        std::fs::create_dir(&folder).unwrap();
        assert!(thumbnail(&folder, 48).is_err());
    }

    #[test]
    fn repeated_requests_hit_the_cache() {
        let dir = tempfile::tempdir().unwrap();
        let path = write_fixture(dir.path(), "c.png", 64, 64);
        let first = thumbnail(&path, 32).unwrap();
        let second = thumbnail(&path, 32).unwrap();
        assert!(Arc::ptr_eq(&first.bytes, &second.bytes));
        let other_size = thumbnail(&path, 64).unwrap();
        assert!(!Arc::ptr_eq(&first.bytes, &other_size.bytes));
    }

    #[test]
    fn parses_thumb_urls() {
        let (path, px) =
            parse_uri("thumb://localhost/%2FUsers%2Fme%2Fmy%20pic%20%F0%9F%98%80.png?px=96&m=17")
                .unwrap();
        assert_eq!(path, "/Users/me/my pic 😀.png");
        assert_eq!(px, 96);
        assert_eq!(parse_uri("thumb://localhost/%2Fa.png").unwrap().1, 64);
        assert!(parse_uri("not a url").is_none());
    }

    #[test]
    fn responds_with_status_codes() {
        let dir = tempfile::tempdir().unwrap();
        let path = write_fixture(dir.path(), "r.png", 40, 40);
        let encoded = path.to_string_lossy().replace('/', "%2F");
        let ok = respond(&format!("thumb://localhost/{encoded}?px=32"));
        assert_eq!(ok.status(), 200);
        assert_eq!(ok.headers().get("Content-Type").unwrap(), "image/png");
        assert_eq!(&ok.body()[1..4], b"PNG");
        assert_eq!(
            respond("thumb://localhost/%2Fnope%2Fx.png?px=32").status(),
            404
        );
        assert_eq!(
            respond("thumb://localhost/%2Ftmp%2Fx.txt?px=32").status(),
            415
        );
        assert_eq!(respond("garbage").status(), 400);
    }

    #[test]
    fn extension_list_matches_the_frontend_image_category() {
        let mut expected = [
            "png", "jpg", "jpeg", "gif", "heic", "heif", "webp", "tiff", "bmp", "svg", "raw",
            "cr2", "nef", "dng",
        ];
        expected.sort_unstable();
        let mut actual = IMAGE_EXTENSIONS;
        actual.sort_unstable();
        assert_eq!(actual, expected);
    }
}
