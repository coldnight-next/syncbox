# Syncbox — Claude Code Instructions

## Project Structure
Electron desktop app with 5 TypeScript sub-projects:
- `src/main/` — Electron main process (IPC, auth, tray, auto-updater)
- `src/preload/` — Preload bridge
- `src/renderer/` — React UI (pages, components, Zustand stores)
- `src/sync-engine/` — Pure Node.js sync engine (watcher, P2P, conflict resolution)
- `src/shared/` — Shared types and constants (IPC channels, sync types, config)

## Build Commands
```bash
npm run typecheck    # TypeScript check
npm run test         # Vitest (90 tests)
npm run lint         # ESLint
npm run build        # electron-vite build

# Unsigned Windows installer:
export CSC_IDENTITY_AUTO_DISCOVERY=false
npx electron-vite build && npx electron-builder --win --config electron-builder.yml
```

## Release Checklist
1. Bump version in `package.json`
2. Build installer
3. Create GitHub release with: `.exe`, `.blockmap`, `latest.yml`
4. Update `website/index.html` version references if needed

## Key Patterns
- **IPC channels**: Defined in `src/shared/constants/channels.ts`, types in `src/shared/types/ipc.ts`
- **Sync events**: Flow from SyncEngine → `onEvent` callback → `sendToRenderer` → Zustand store
- **Ignored paths**: Must be filtered at 3 levels:
  1. Chokidar function guards in `src/sync-engine/watcher.ts` (regex, not globs — globs fail on Windows)
  2. Early return in `handleLocalFileEvent()` in `src/sync-engine/index.ts`
  3. Directory skip in `scanDirectory()` and `collectManifestEntries()`
- **Write suppression**: `writeSuppressed` map in SyncEngine prevents feedback loops when writing received files
- **Vector clocks**: Always preserve actual remote clock through `PendingReceive.remoteClock` — never create fresh clocks in `handleFileDataEnd`

## Don'ts
- Don't use glob patterns for chokidar ignore on Windows — use function guards with regex
- Don't create `incrementClock(createClock(), deviceId)` — always use the actual remote clock
- Don't forget `latest.yml` in GitHub releases — auto-updater needs it
- Don't amend commits or force-push without explicit permission
