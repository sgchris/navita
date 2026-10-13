/** Path helpers for canonical absolute POSIX paths (the only kind the app handles). */

export function parentOf(path: string): string | null {
  if (path === "/") return null;
  const index = path.lastIndexOf("/");
  return index <= 0 ? "/" : path.slice(0, index);
}

export function basename(path: string): string {
  if (path === "/") return "/";
  return path.slice(path.lastIndexOf("/") + 1);
}

/** Non-root segments: `/Users/greg` -> `["Users", "greg"]`. */
export function segments(path: string): string[] {
  return path.split("/").filter((s) => s.length > 0);
}

export function join(parent: string, name: string): string {
  return parent === "/" ? `/${name}` : `${parent}/${name}`;
}

/** Every ancestor from the root down to and including `path`. */
export function ancestorsOf(path: string): string[] {
  const result = ["/"];
  let current = "/";
  for (const segment of segments(path)) {
    current = join(current, segment);
    result.push(current);
  }
  return result;
}

export function isAncestorOrSelf(ancestor: string, path: string): boolean {
  if (ancestor === path || ancestor === "/") return true;
  return path.startsWith(`${ancestor}/`);
}
