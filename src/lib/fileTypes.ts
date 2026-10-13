import type { Entry } from "../api/bindings/Entry";

export type Category =
  | "folder"
  | "application"
  | "image"
  | "video"
  | "audio"
  | "pdf"
  | "text"
  | "code"
  | "archive"
  | "disk"
  | "document"
  | "spreadsheet"
  | "presentation"
  | "package"
  | "unknown";

export interface FileTypeInfo {
  category: Category;
  kindLabel: string;
}

type TypeEntry = Pick<Entry, "kind" | "extension" | "isBrokenLink" | "isDirLike">;

const CATEGORY_EXTENSIONS: Record<Exclude<Category, "folder" | "package" | "unknown">, string[]> = {
  application: ["app"],
  image: [
    "png",
    "jpg",
    "jpeg",
    "gif",
    "heic",
    "heif",
    "webp",
    "tiff",
    "bmp",
    "svg",
    "raw",
    "cr2",
    "nef",
    "dng",
  ],
  video: ["mp4", "mov", "m4v", "mkv", "avi", "webm"],
  audio: ["mp3", "m4a", "aac", "wav", "flac", "aiff", "ogg"],
  pdf: ["pdf"],
  text: ["txt", "md", "rtf", "log", "csv", "tsv"],
  code: [
    "rs",
    "ts",
    "tsx",
    "js",
    "jsx",
    "json",
    "toml",
    "yaml",
    "yml",
    "py",
    "go",
    "rb",
    "swift",
    "c",
    "h",
    "cpp",
    "java",
    "kt",
    "sh",
    "zsh",
    "html",
    "css",
    "xml",
    "sql",
  ],
  archive: ["zip", "tar", "gz", "tgz", "bz2", "xz", "7z", "rar"],
  disk: ["dmg", "iso", "img", "sparsebundle"],
  document: ["doc", "docx", "pages", "odt"],
  spreadsheet: ["xls", "xlsx", "numbers", "ods"],
  presentation: ["ppt", "pptx", "key", "odp"],
};

const EXTENSION_CATEGORY: ReadonlyMap<string, Category> = new Map(
  Object.entries(CATEGORY_EXTENSIONS).flatMap(([category, extensions]) =>
    extensions.map((ext) => [ext, category as Category] as const),
  ),
);

/** Per-extension kind labels; categories with one literal label are listed in CATEGORY_LABEL. */
const EXTENSION_LABEL: Record<string, string> = {
  png: "PNG image",
  jpg: "JPEG image",
  jpeg: "JPEG image",
  gif: "GIF image",
  heic: "HEIC image",
  heif: "HEIF image",
  webp: "WebP image",
  tiff: "TIFF image",
  bmp: "BMP image",
  svg: "SVG image",
  raw: "RAW image",
  cr2: "Canon RAW image",
  nef: "Nikon RAW image",
  dng: "DNG image",
  mp4: "MPEG-4 movie",
  mov: "QuickTime movie",
  m4v: "MPEG-4 movie",
  mkv: "Matroska video",
  avi: "AVI movie",
  webm: "WebM video",
  mp3: "MP3 audio",
  m4a: "MPEG-4 audio",
  aac: "AAC audio",
  wav: "WAV audio",
  flac: "FLAC audio",
  aiff: "AIFF audio",
  ogg: "Ogg audio",
  txt: "Plain text",
  md: "Markdown",
  rtf: "Rich Text document",
  log: "Log file",
  csv: "CSV document",
  tsv: "TSV document",
  rs: "Rust source",
  ts: "TypeScript source",
  tsx: "TSX source",
  js: "JavaScript source",
  jsx: "JSX source",
  json: "JSON file",
  toml: "TOML file",
  yaml: "YAML file",
  yml: "YAML file",
  py: "Python source",
  go: "Go source",
  rb: "Ruby source",
  swift: "Swift source",
  c: "C source",
  h: "C header",
  cpp: "C++ source",
  java: "Java source",
  kt: "Kotlin source",
  sh: "Shell script",
  zsh: "Zsh script",
  html: "HTML document",
  css: "CSS stylesheet",
  xml: "XML document",
  sql: "SQL file",
  zip: "ZIP archive",
  tar: "TAR archive",
  gz: "GZIP archive",
  tgz: "TGZ archive",
  bz2: "BZip2 archive",
  xz: "XZ archive",
  "7z": "7-Zip archive",
  rar: "RAR archive",
};

const CATEGORY_LABEL: Partial<Record<Category, string>> = {
  application: "Application",
  pdf: "PDF document",
  disk: "Disk image",
  document: "Document",
  spreadsheet: "Spreadsheet",
  presentation: "Presentation",
};

/**
 * Resolves category, icon category and Kind label (decisions B24):
 * broken alias, then folders (extension ignored), then extension category, then package, then unknown.
 */
export function fileTypeOf(entry: TypeEntry): FileTypeInfo {
  if (entry.isBrokenLink) return { category: "unknown", kindLabel: "Broken alias" };
  if (entry.isDirLike) return { category: "folder", kindLabel: "Folder" };

  const ext = entry.extension;
  const category = ext ? EXTENSION_CATEGORY.get(ext) : undefined;
  if (ext && category) {
    return {
      category,
      kindLabel: EXTENSION_LABEL[ext] ?? CATEGORY_LABEL[category] ?? `${ext.toUpperCase()} file`,
    };
  }
  if (entry.kind === "package") {
    return { category: "package", kindLabel: ext ? `${ext.toUpperCase()} package` : "Package" };
  }
  return { category: "unknown", kindLabel: ext ? `${ext.toUpperCase()} file` : "Document" };
}

export function kindLabelOf(entry: TypeEntry): string {
  return fileTypeOf(entry).kindLabel;
}
