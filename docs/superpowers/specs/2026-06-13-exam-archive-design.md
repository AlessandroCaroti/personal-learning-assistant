# Exam Archive Design

## Context

The app stores each exam as a single `Esame` record in IndexedDB, with three fixed study file slots under `files`: `riassunto`, `quiz`, and `flashcard`. File bytes are embedded directly in the stored record and already participate in the existing sync/export flow through `storageService`.

This design adds a lightweight archive for extra exam-related documents without changing the current fixed-purpose study file model and without introducing a new IndexedDB store.

## Goals

- Let users attach additional files to an exam as a simple archive.
- Accept any uploaded file type.
- Show archive access in two places: a dashboard preview and a dedicated archive page.
- Preview supported file types inline.
- Allow export/download for every attachment.
- Keep the first version compatible with the existing `Esame` persistence and sync model.

## Non-Goals

- No archive categories, labels, notes, tags, or search.
- No new IndexedDB object store for attachments.
- No reordering, pinning, or manual grouping of archive files.
- No changes to quiz, flashcard, or summary import validation rules.
- No guaranteed native Android export/share flow in this cycle beyond the existing web-style fallback where supported.

## Data Model

Keep the current `files` object unchanged and add a new attachment collection to `Esame`.

Proposed shape:

- `Esame.files.riassunto`
- `Esame.files.quiz`
- `Esame.files.flashcard`
- `Esame.attachments: ExamAttachment[]`

Add a new first-class attachment type:

- `ExamAttachment`
  - `id: string`
  - `name: string`
  - `type: string`
  - `data: ArrayBuffer`
  - `createdAt: string`

Rationale:

- The existing `files` slots remain structured study inputs with dedicated flows.
- Archive entries become generic exam documents with stable ids for rendering, deletion, and navigation.
- `createdAt` provides a deterministic default sort order and a clean path for future metadata.

Backward compatibility rules:

- Existing exams that do not have `attachments` must be treated as `[]`.
- Any code reading `Esame` must tolerate the field being absent until the record is re-saved.

## Persistence And Sync

Attachments remain embedded in the parent `Esame` record.

Storage flow:

1. Pick a file through `fileService`.
2. Create an `ExamAttachment` object with generated `id`, original `name`, detected `type`, raw `data`, and `createdAt`.
3. Append it to `esame.attachments`.
4. Persist the updated exam with `saveEsame()`.

Delete flow:

1. Load the exam.
2. Remove the selected attachment from `attachments`.
3. Save the updated exam with `saveEsame()`.

Because attachments live inside the `esami` record:

- no new DB version is required for this feature;
- no new store-specific delete cascade is required;
- sync/export serialization for `esami` must be updated to include the attachments array, encoding and decoding attachment `data` the same way file records are already handled.

## Routes And Navigation

Add a dedicated archive route:

- `/esame/:examId/archivio`

The exam dashboard remains the primary landing page and should gain a new `Archivio` section card. That card should:

- show the archive status as `Nessun file` or `<count> file`;
- include an `Aggiungi file` action;
- show a short preview list of the most recent attachments, capped to a small number such as three items;
- include an `Apri archivio` action to navigate to the full archive page.

The dedicated archive page should:

- list all attachments for the current exam;
- show filename and uploaded date for each item;
- expose actions for open, export/download, and delete as appropriate;
- include an `Aggiungi file` action;
- navigate back to the exam dashboard with the same pattern used by existing exam sub-pages.

## Viewer Behavior

The archive accepts any file type, but inline preview is limited to supported formats:

- `.pdf`
- `.docx`
- `.html`
- `.txt`
- `.md`
- images

Introduce a generic exam file viewer path for archive items:

- `/esame/:examId/file/:fileId`

Supported rendering rules:

- PDF: create an object URL from a `Blob` and render it in an iframe.
- DOCX: convert to HTML with `mammoth`, then render the result.
- HTML: render in an iframe with the same base-tag normalization used by the summary flow.
- TXT and MD: decode with `TextDecoder` and render as readable text content.
- Images: create an object URL and render in an image container.

Unsupported rendering rules:

- Do not attempt inline preview.
- Show export/download only.

The existing summary page may remain route-specific, but viewer logic should be shared through utilities or a generic viewer component where practical to avoid duplicating format detection and object URL cleanup.

## Export And Native Fallback

Every attachment should expose an export/download action.

Web behavior:

- Create a `Blob` from the stored `data`.
- Trigger a browser download using an object URL and the original filename.

Native Android behavior for the first cycle:

- Files are still stored and listed normally.
- Preview is available for supported formats when the in-app viewer can render them.
- Export/share is not guaranteed to be fully native in this cycle.
- The UI copy should avoid implying a platform-complete share/save implementation that does not yet exist.

## Error Handling

- If the exam id is missing or the exam does not exist, navigate back using the same guard pattern as existing pages.
- If file picking is cancelled, do not show an error state.
- If a viewer route references an attachment id that no longer exists, redirect back to the archive page or show a clear not-found message.
- If file decoding or preview conversion fails, show an error message and keep the export/download action available when possible.
- Unsupported files should never surface as preview errors; they should go straight to the export-only behavior.

## Testing Plan

Add or update tests for the data model and storage behavior:

- exams without `attachments` still load correctly;
- saving an exam with attachments persists and reloads them;
- deleting an attachment updates the stored exam correctly;
- sync/export logic preserves attachments through encode/decode.

Add dashboard tests:

- archive section renders the empty state correctly;
- archive section renders count and preview items when attachments exist;
- archive navigation and add-file actions are available.

Add archive page tests:

- full attachment list renders correctly;
- add-file flow appends a new attachment;
- delete removes the attachment;
- supported files show `Apri`;
- unsupported files omit `Apri` and retain export/download.

Add viewer tests:

- format detection routes PDF, DOCX, HTML, TXT, MD, and images to the correct renderer;
- unsupported files show the fallback state;
- missing attachment ids are handled cleanly.

Test constraints remain the same as the rest of the project:

- mock `@capacitor/core`;
- use `fake-indexeddb/auto` for storage-related tests;
- run `npm run test -- --run` after implementation changes.

## Implementation Boundaries

This feature should be implemented without adding a new IndexedDB store or bumping the database version solely for archive support.

If implementation reveals that embedded attachments make `Esame` records too large or too awkward for sync behavior, stop and revise the design rather than silently switching to a separate attachment store.

The archive is intentionally a simple attachment list in this cycle. Metadata, search, tagging, grouping, and richer native export/share behavior belong to later iterations.

## Open Decisions Resolved

- Archive files are generic attachments, not new fixed file slots.
- Any file type can be uploaded.
- Only `.pdf`, `.docx`, `.html`, `.txt`, `.md`, and images get inline preview.
- The archive appears both on the dashboard and on a dedicated page.
- Unsupported files should still offer export/download.
- Native Android export/share may remain partial in the first version.
