# Custom Desktop Planner Build

This document records the behavior and release checks for the customized
Super Productivity fork. It intentionally excludes user data, local secrets,
personal images, backups, and generated build output.

## Implemented Features

### Desktop Task Widget

- Reuses the built-in Eisenhower matrix and stays synchronized with main-app
  tasks.
- Runs at normal desktop window level. Other applications cover it, while the
  Windows Show Desktop action does not leave it minimized.
- Persists position and size and enforces a usable minimum size.
- The Open action restores and maximizes the main window.
- Closing the widget disables its setting in the main app.
- Clicking a task starts it; clicking the same task again pauses it.
- DONE is the only action that completes a task. Completed rows remain visible
  in their disabled state until daily settlement removes their matrix tags.
- Countdown expiry opens an extension prompt. The user chooses the additional
  number of minutes.
- Widget background opacity and content opacity are independent.
- A widget-specific background overrides the global background. Without one,
  the widget inherits the global background.
- Appearance and background settings are replayed after renderer startup so
  they survive restart and asynchronous window creation.

### Planning And Actual Time

- The planner is a fixed Monday-to-Sunday weekly page.
- Historical weeks remain available.
- The current day has a blue highlight, and a Return to Current Week action is
  shown when browsing another week.
- The month calendar starts on Monday and clicking a date opens the containing
  week.
- Week calculations use local calendar dates, avoiding the UTC+8 Monday
  off-by-one-week bug.
- The schedule can render actual tracked work segments separately from planned
  estimates.
- Adjacent segments for the same task merge when their gap is less than five
  minutes and no other task segment occurs between them.

### Daily Settlement

- Manual settlement is available through the existing finish-day flow.
- Automatic settlement runs once per logical day boundary. With a 04:00 day
  start, the boundary is 04:00.
- Settlement removes the Urgent and Important tags from completed top-level
  tasks instead of archiving the tasks. Historical records remain available,
  while settled tasks leave the desktop matrix.

### Backgrounds And Storage

- Users can upload and reset a global application background.
- Global background settings take precedence over project and tag backgrounds.
- Users can independently upload and reset a widget background.
- Missing or unreadable images degrade to no background instead of crashing.
- Imported images are stored by opaque ID. When backups are linked to an
  external folder named `backups`, images use the sibling `bg-images` folder.
  Otherwise they use the normal app user-data folder.
- `SP_IMAGE_CACHE_DIR` remains available as an explicit deployment override.

### Backups And Window Behavior

- Users can select an external local backup folder.
- Existing backup files are migrated before the default backup directory is
  replaced by a junction or symlink.
- The settings page displays the effective physical backup folder once and
  explains the compatibility link.
- Native minimize keeps the main app in the taskbar instead of hiding it to the
  tray. Close-to-tray behavior remains separate.
- Idle dialog actions have complete Chinese translations.

## Publishing Hygiene

- Never commit user data, backups, uploaded images, screenshots, installers,
  unpacked builds, or cache directories.
- Keep machine-specific user names and secrets out of source and docs.
- Push only to the fork remote. The upstream remote is read-only for this work.
- Review `package-lock.json` and run `git diff --check` before committing.

## Verification

Automated checks:

```powershell
npm run int:test
npm run lint:ts
npm run lint:scss
npx tsc -p electron\tsconfig.electron.json --noEmit
node --test electron\image-cache.test.cjs electron\local-file-sync.test.cjs electron\backup.test.cjs electron\task-widget.test.cjs electron\window-visibility-policy.test.cjs electron\i18n-zh-custom.test.cjs electron\app-control.test.cjs electron\indicator.test.cjs
npx ng test --watch=false --no-code-coverage --source-map=false --include='src/app/features/planner/**/*.spec.ts' --include='src/app/features/daily-settlement/**/*.spec.ts' --include='src/app/pages/daily-summary/daily-summary.component.spec.ts' --include='src/app/features/tasks/store/task-electron.effects.spec.ts' --include='src/app/features/tasks/store/task-widget-panels.util.spec.ts' --include='src/app/features/schedule/map-schedule-data/append-actual-time-segments-to-schedule-days.spec.ts' --include='src/app/pages/config-page/config-page.component.spec.ts' --include='src/app/features/config/task-widget-settings.service.spec.ts'
```

Production and packaging:

```powershell
npm run buildAllElectron:noTests:prod
npx electron-builder --win portable --x64 --publish never --config.win.signAndEditExecutable=false
```

Manual smoke coverage:

- Launch the packaged app with a copied user-data profile.
- Confirm the main app and desktop widget both render.
- Confirm the planner displays exactly seven days, Monday through Sunday.
- Click a month date and verify the matching week, then return to the current
  week.
- Confirm the current day highlight.
- Confirm widget opacity settings are replayed after startup.
- Confirm Windows Show Desktop leaves the widget visible and unminimized.
- Confirm the installed executable hash matches the packaged build.
