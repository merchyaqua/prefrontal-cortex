This is an Electron React+Framer Motion app.

Always report what you're doing.
After each feature, ask the user to test it sine UX is the core of the project.
Be mindful of style changes, it should all appear lightweight .
Don't give any placeholder "how to use" text - the interface itself should guide the user.
 notice when the chat is getting quite long and remind the user to check if they've gone in a dopamine development loop.

## Quick-start context for fresh chats
1. Three windows: mainWindow (dashboard), destructorWindow (Ctrl+Shift+D), checkInWindow (Ctrl+Shift+L) — all created at startup in src/main/index.ts. Small windows use hide() not close() so they persist.
2. Check-in feature is IN PROGRESS: DB schema + IPC handlers exist (db.ts), UI in CheckIn.tsx is a placeholder stub needing 3-point state picker + tell chips.
3. The app is packaged with electron-builder (NSIS installer, Windows). Tray icon + auto-login-item are configured in src/main/index.ts. Build with `npm run dist`. Icons live in resources/.