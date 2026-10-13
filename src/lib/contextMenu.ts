import { CheckMenuItem, Menu, MenuItem, PredefinedMenuItem, Submenu } from "@tauri-apps/api/menu";
import { usePrefs } from "../state/prefs";
import { useNavigation } from "../state/navigation";
import { useSelection } from "../state/selection";
import { dispatchAction, type ActionId } from "./actions";
import { clipboardHasFiles, copySelection, cutSelection, pasteInto } from "./clipboard";
import { createItem } from "./fileOps";
import { countRealSelected } from "./parentRow";
import { getSelectedEntries } from "./selected";
import type { SortKey } from "./sort";

const action = (text: string, id: ActionId, enabled = true) =>
  MenuItem.new({ text, enabled, action: () => dispatchAction(id) });

const run = (text: string, work: () => void, enabled = true) =>
  MenuItem.new({ text, enabled, action: work });

const check = (text: string, checked: boolean, id: ActionId) =>
  CheckMenuItem.new({ text, checked, action: () => dispatchAction(id) });

const separator = () => PredefinedMenuItem.new({ item: "Separator" });

type MenuEntry = Awaited<
  ReturnType<typeof action | typeof check | typeof separator | typeof Submenu.new>
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

/**
 * Builds the item menu for the current selection (decisions B29). `folder` is the path of the
 * right-clicked folder when it is the only selected item: New Folder and New File then act inside
 * it. Files and multi-selections get no creation items.
 */
export async function buildItemMenu(folder: string | null = null): Promise<Menu> {
  const single = countRealSelected(useSelection.getState().selected) === 1;
  const creation = folder
    ? [
        run("New Folder", () => void createItem("folder", folder)),
        run("New File", () => void createItem("file", folder)),
        separator(),
      ]
    : [];
  const hasFiles = folder ? await clipboardHasFiles() : false;
  const clipboardItems = [
    run("Cut", () => void cutSelection()),
    run("Copy", () => void copySelection()),
    ...(folder ? [run("Paste", () => void pasteInto(folder), hasFiles)] : []),
    separator(),
  ];
  return toMenu(
    await Promise.all([
      action("Open", "file.open"),
      separator(),
      ...creation,
      ...clipboardItems,
      action("Reveal in Finder", "file.reveal"),
      action("Copy Path", "file.copyPath"),
      action("Get Info", "file.getInfo"),
      separator(),
      action("Rename…", "file.rename", single),
      action("Move to Trash", "file.trash"),
    ]),
  );
}

const SORT_ITEMS: Array<[SortKey, string, ActionId]> = [
  ["name", "Name", "view.sort.name"],
  ["modified", "Date Modified", "view.sort.modified"],
  ["size", "Size", "view.sort.size"],
  ["kind", "Kind", "view.sort.kind"],
];

/** Builds the empty-space menu: View, Show Hidden Files, Sort By, New Folder, New File. */
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
      SORT_ITEMS.map(([key, label, id]) => check(label, sort.key === key, id)),
    ),
  });
  const hasFiles = await clipboardHasFiles();
  return toMenu([
    viewMenu,
    await check("Show Hidden Files", showHidden, "view.toggleHidden"),
    sortMenu,
    await separator(),
    await run("New Folder", () => void createItem("folder")),
    await run("New File", () => void createItem("file")),
    await separator(),
    await run(
      "Paste",
      () => {
        const target = useNavigation.getState().currentPath;
        if (target !== null) void pasteInto(target);
      },
      hasFiles,
    ),
  ]);
}

/** Right-click on an item: select it if needed, then show the item menu. */
export async function showItemMenu(path: string): Promise<void> {
  if (!useSelection.getState().selected.has(path)) useSelection.getState().selectOnly(path);
  const selected = getSelectedEntries();
  const only = selected.length === 1 ? selected[0] : undefined;
  const folder = only?.isDirLike ? only.path : null;
  await popup(() => buildItemMenu(folder));
}

/** Right-click on empty space. */
export async function showBackgroundMenu(): Promise<void> {
  await popup(buildBackgroundMenu);
}
