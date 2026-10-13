import { create } from "zustand";
import { commands, toAppError, type AppError, type DirListing } from "../api/commands";
import type { Entry } from "../api/bindings/Entry";

export const SPINNER_DELAY_MS = 150;

export type ListingStatus = "idle" | "ready" | "error";

export type FetchResult =
  { kind: "ok"; listing: DirListing } | { kind: "error"; error: AppError } | { kind: "stale" };

interface ListingState {
  /** Entries of the committed listing (hidden ones included). */
  entries: Entry[];
  /** Canonical path of the committed listing. */
  path: string | null;
  status: ListingStatus;
  error: AppError | null;
  /** A non-silent fetch is in flight. */
  loading: boolean;
  /** The in-flight fetch took longer than SPINNER_DELAY_MS. */
  showSpinner: boolean;
  /** Fetches a listing without committing it; stale responses are reported as `stale`. */
  fetch: (path: string, options?: { silent?: boolean }) => Promise<FetchResult>;
  commit: (listing: DirListing) => void;
  setError: (error: AppError) => void;
}

let latestRequestId = 0;

export const useListing = create<ListingState>()((set) => ({
  entries: [],
  path: null,
  status: "idle",
  error: null,
  loading: false,
  showSpinner: false,

  fetch: async (path, options) => {
    const silent = options?.silent ?? false;
    const requestId = ++latestRequestId;
    let timer: ReturnType<typeof setTimeout> | undefined;
    if (!silent) {
      set({ loading: true, showSpinner: false });
      timer = setTimeout(() => {
        if (requestId === latestRequestId) set({ showSpinner: true });
      }, SPINNER_DELAY_MS);
    }
    try {
      const listing = await commands.listDir(path, requestId);
      if (listing.requestId !== latestRequestId) return { kind: "stale" };
      return { kind: "ok", listing };
    } catch (e) {
      if (requestId !== latestRequestId) return { kind: "stale" };
      return { kind: "error", error: toAppError(e) };
    } finally {
      clearTimeout(timer);
      if (!silent && requestId === latestRequestId) set({ loading: false, showSpinner: false });
    }
  },

  commit: (listing) =>
    set({ entries: listing.entries, path: listing.path, status: "ready", error: null }),

  setError: (error) => set({ entries: [], status: "error", error }),
}));
