import { create } from "zustand";
import { commands, toAppError } from "../api/commands";
import { ancestorsOf } from "../lib/paths";
import type { ChildState } from "../lib/treeFlatten";

interface TreeState {
  expanded: ReadonlySet<string>;
  children: Readonly<Record<string, ChildState>>;
  /** Expands `path` and resolves once its children were loaded (or failed to). */
  expand: (path: string) => Promise<void>;
  collapse: (path: string) => void;
  toggle: (path: string) => Promise<void>;
  /** Expands every ancestor of `path` (not `path` itself). */
  revealPath: (path: string) => Promise<void>;
  /** Reloads the children of `path` if they are known, without a loading state. */
  reload: (path: string) => Promise<void>;
  /** Launch expansion (decisions B14). */
  init: (options: {
    homePath: string;
    currentPath: string | null;
    saved: readonly string[];
  }) => Promise<void>;
}

export const useTree = create<TreeState>()((set, get) => {
  const setChildren = (path: string, state: ChildState) =>
    set((s) => ({ children: { ...s.children, [path]: state } }));

  const load = async (path: string, silent: boolean): Promise<void> => {
    if (!silent) setChildren(path, "loading");
    try {
      setChildren(path, await commands.listSubdirs(path));
    } catch (e) {
      setChildren(path, toAppError(e));
    }
  };

  return {
    expanded: new Set(),
    children: {},

    expand: async (path) => {
      set((s) => ({ expanded: new Set(s.expanded).add(path) }));
      const known = get().children[path];
      if (known === "loading") return;
      // Loaded folders refresh in the background; unknown or failed ones load (again).
      await load(path, Array.isArray(known));
    },

    collapse: (path) =>
      set((s) => {
        const expanded = new Set(s.expanded);
        expanded.delete(path);
        return { expanded };
      }),

    toggle: async (path) => {
      if (get().expanded.has(path)) get().collapse(path);
      else await get().expand(path);
    },

    revealPath: async (path) => {
      const ancestors = ancestorsOf(path).slice(0, -1);
      await Promise.all(
        ancestors.map((a) => (get().expanded.has(a) ? Promise.resolve() : get().expand(a))),
      );
    },

    reload: async (path) => {
      if (get().children[path] === undefined) return;
      await load(path, true);
    },

    init: async ({ homePath, currentPath, saved }) => {
      const required = new Set<string>(["/", ...ancestorsOf(homePath)]);
      if (currentPath !== null)
        for (const a of ancestorsOf(currentPath).slice(0, -1)) required.add(a);
      const optional = saved.filter((p) => !required.has(p));

      await Promise.all([...required].map((p) => get().expand(p)));
      await Promise.all(
        optional.map(async (p) => {
          await get().expand(p);
          // saved folders that no longer load are dropped
          if (!Array.isArray(get().children[p])) get().collapse(p);
        }),
      );
    },
  };
});
