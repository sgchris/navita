# Navita

Read `NAVITA_SPEC.md` and `docs/DECISIONS.md` before changing anything. Where they differ, `docs/DECISIONS.md` wins.

Commands: `npm run check` (all gates), `npm run tauri dev`, `npm test`, `npm run test:rust`.

Rules: no `fs` plugin (all filesystem access in Rust commands); TS strict, no `any`; Rust no `unwrap()` outside tests; IPC only via `src/api/commands.ts`; unresolved questions go to the user, not into guesses.
