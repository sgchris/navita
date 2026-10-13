import type { AppError } from "../api/bindings/AppError";
import type { Place } from "../api/bindings/Place";
import type { TreeNode } from "../api/bindings/TreeNode";
import { isAncestorOrSelf } from "./paths";
import { createNameComparator } from "./sort";

export type SectionId = "favorites" | "locations" | "folders";

/** What the tree store knows about a folder's children. */
export type ChildState = TreeNode[] | "loading" | AppError;

export type SidebarRow =
  | { type: "header"; section: SectionId; label: string; collapsed: boolean }
  | { type: "place"; section: "favorites" | "locations"; place: Place }
  | {
      type: "node";
      path: string;
      name: string;
      depth: number;
      expanded: boolean;
      /** Show a disclosure arrow (decisions B14). */
      hasArrow: boolean;
      isRoot: boolean;
    }
  | { type: "message"; path: string; depth: number; text: string };

export interface FlattenInput {
  places: readonly Place[];
  /** Display name of `/` (the startup volume). */
  rootName: string;
  collapsedSections: readonly SectionId[];
  expanded: ReadonlySet<string>;
  children: Readonly<Record<string, ChildState>>;
  showHidden: boolean;
  currentPath: string | null;
  locale?: string;
}

const FAVORITE_KINDS = new Set<Place["kind"]>([
  "home",
  "desktop",
  "documents",
  "downloads",
  "applications",
]);

export const TREE_ERROR_TEXT = "Can’t open folder";

/**
 * Flattens Favorites, Locations and the Folders tree into one list of uniform rows (decisions
 * B12, B14). Hidden nodes are shown iff `showHidden` or they are an ancestor-or-self of the
 * current folder.
 */
export function flattenSidebar(input: FlattenInput): SidebarRow[] {
  const { places, rootName, collapsedSections, expanded, children, showHidden, currentPath } =
    input;
  const compare = createNameComparator<TreeNode>(input.locale);
  const rows: SidebarRow[] = [];
  const collapsed = (section: SectionId) => collapsedSections.includes(section);

  rows.push({
    type: "header",
    section: "favorites",
    label: "Favorites",
    collapsed: collapsed("favorites"),
  });
  if (!collapsed("favorites")) {
    for (const place of places.filter((p) => FAVORITE_KINDS.has(p.kind))) {
      rows.push({ type: "place", section: "favorites", place });
    }
  }

  rows.push({
    type: "header",
    section: "locations",
    label: "Locations",
    collapsed: collapsed("locations"),
  });
  if (!collapsed("locations")) {
    for (const place of places.filter((p) => !FAVORITE_KINDS.has(p.kind))) {
      rows.push({ type: "place", section: "locations", place });
    }
  }

  rows.push({
    type: "header",
    section: "folders",
    label: "Folders",
    collapsed: collapsed("folders"),
  });
  if (collapsed("folders")) return rows;

  const isVisible = (node: TreeNode): boolean =>
    showHidden ||
    !node.isHidden ||
    (currentPath !== null && isAncestorOrSelf(node.path, currentPath));

  const walk = (path: string, depth: number): void => {
    const state = children[path];
    if (!expanded.has(path) || state === undefined || state === "loading") return;
    if (!Array.isArray(state)) {
      rows.push({ type: "message", path, depth, text: TREE_ERROR_TEXT });
      return;
    }
    for (const node of [...state].filter(isVisible).sort(compare)) {
      rows.push({
        type: "node",
        path: node.path,
        name: node.name,
        depth,
        expanded: expanded.has(node.path),
        hasArrow: showHidden ? node.hasChildren : node.hasVisibleChildren,
        isRoot: false,
      });
      walk(node.path, depth + 1);
    }
  };

  rows.push({
    type: "node",
    path: "/",
    name: rootName,
    depth: 0,
    expanded: expanded.has("/"),
    hasArrow: true,
    isRoot: true,
  });
  walk("/", 1);
  return rows;
}

/** Index of the node row for `path`, or -1. */
export function indexOfNode(rows: readonly SidebarRow[], path: string): number {
  return rows.findIndex((r) => r.type === "node" && r.path === path);
}

/** Stable identity of a row (used for the sidebar keyboard focus). */
export function rowKey(row: SidebarRow): string {
  switch (row.type) {
    case "header":
      return `header:${row.section}`;
    case "place":
      return `place:${row.place.path}`;
    case "node":
      return `node:${row.path}`;
    case "message":
      return `message:${row.path}`;
  }
}
