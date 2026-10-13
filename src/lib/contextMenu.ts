import { CheckMenuItem, Menu, MenuItem, PredefinedMenuItem, Submenu } from "@tauri-apps/api/menu";
import { usePrefs } from "../state/prefs";
import { useSelection } from "../state/selection";
import { dispatchAction, type ActionId } from "./actions";
import type { SortKey } from "./sort";

const item = (text: string, action: ActionId, enabled = true) =>
  MenuItem.new({ text, enabled, action: () => dispatchAction(action) });

const check = (text: string, checked: boolean, action: ActionId) =>
  CheckMenuItem.new({ text, checked, action: () => dispatchAction(action) });

const separator = () => PredefinedMenuItem.new({ item: "Separator" });

type MenuEntry = Awaited<
  ReturnType<typeof item | typeof check | typeof separator | typeof Submenu.new>
>;

const toMenu = (items: MenuEntry[]) => Menu.new({ items });

let current: Menu | null = null;

async function popup(build: () => Promise<Menu>): Promise<void> {
  try {
    const menu = await build();
    const previous = current;
    current = menu;
    await menu.popup();
    void previous?.close();
  } catch (error) {
    console.error("context menu failed", error);
  }
}

/** Builds the item menu for the current selection (decisions B29). */
export async function buildItemMenu(): Promise<Menu> {
  const single = useSelection.getState().selected.size === 1;
  return toMenu(
    await Promise.all([
      item("Open", "file.open"),
      separator(),
      item("Reveal in Finder", "file.reveal"),
      item("Copy Path", "file.copyPath"),
      item("Get Info", "file.getInfo"),
      separator(),
      item("Rename…", "file.rename", single),
      item("Move to Trash", "file.trash"),
    ]),
  );
}

const SORT_ITEMS: Array<[SortKey, string, ActionId]> = [
  ["name", "Name", "view.sort.name"],
  ["modified", "Date Modified", "view.sort.modified"],
  ["size", "Size", "view.sort.size"],
  ["kind", "Kind", "view.sort.kind"],
];

/** Builds the empty-space menu: View, Show Hidden Files, Sort By. */
export async function buildBackgroundMenu(): Promise<Menu> {
  const { viewMode, showHidden, sort } = usePrefs.getState();
  const viewMenu = await Submenu.new({
    text: "View",
    items: await Promise.all([
      check("as Icons", viewMode === "icons", "view.icons"),
      check("as List", viewMode === "list", "view.list"),
    ]),
  });
  const sortMenu = await Submenu.new({
    text: "Sort By",
    items: await Promise.all(
      SORT_ITEMS.map(([key, label, action]) => check(label, sort.key === key, action)),
    ),
  });
  return toMenu([
    viewMenu,
    await check("Show Hidden Files", showHidden, "view.toggleHidden"),
    sortMenu,
  ]);
}

/** Right-click on an item: select it if needed, then show the item menu. */
export async function showItemMenu(path: string): Promise<void> {
  if (!useSelection.getState().selected.has(path)) useSelection.getState().selectOnly(path);
  await popup(buildItemMenu);
}

/** Right-click on empty space. */
export async function showBackgroundMenu(): Promise<void> {
  await popup(buildBackgroundMenu);
}
