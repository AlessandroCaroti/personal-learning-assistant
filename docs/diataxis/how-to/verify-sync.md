# How-to: Verify Sync Across Installations

Use this guide when Google Drive Sync is configured and you need to smoke test that data moves between installations.

## Before you start

- Configure Google Drive Sync first.
- Use the same Google account in every installation being tested.
- Keep the Home page visible when you need to check sync status.

## Browser-to-browser sync

1. Start the dev server:

   ```bash
   npm run dev
   ```

2. Open the app in two separate browser profiles.
3. Sign in to the same Google account in both profiles.
4. In profile A, create an exam.
5. Import a quiz, flashcard, or summary file for that exam.
6. Wait for profile A to show `Sincronizzato`.
7. In profile B, choose `Sincronizza ora`.
8. Confirm the exam appears in profile B with the imported file available.

## Study stats sync

1. In profile A, complete a quiz for a synced exam.
2. Wait for profile A to show `Sincronizzato`.
3. In profile B, choose `Sincronizza ora`.
4. Open the same exam in profile B.
5. Confirm the quiz result appears in the result history.
6. Confirm question stats are reflected in review or progress views that use those stats.

## Conflict smoke test

1. Sync the same exam to two browser profiles.
2. Disconnect profile A from the network.
3. Delete the exam in profile A.
4. In profile B, rename the same exam or update one of its imported files.
5. Wait for profile B to show `Sincronizzato`.
6. Reconnect profile A.
7. In profile A, choose `Sincronizza ora`.
8. Confirm the app shows a conflict state instead of silently deleting or resurrecting the exam.

## What should not sync

Confirm that these remain local to each installation:

- Paused sessions
- Theme
- Current exam selection
- Active route state
- Active quiz or flashcard session state

## Related reference

- [Configure Google Drive Sync](./configure-google-drive-sync.md)
- [Integration reference](../reference/integrations.md)
