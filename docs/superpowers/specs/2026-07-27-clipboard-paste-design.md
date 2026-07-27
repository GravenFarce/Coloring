# Clipboard Paste Support — Design

## Purpose

Let a user paste an image directly from the clipboard (Ctrl+V) instead of
only being able to drag-and-drop or click-to-browse. Small addition on top
of the existing Photo → Coloring Sheet app.

## Scope

- Pasting an image anywhere on the page runs it through the same
  upload/validation/processing/preview flow as drag-and-drop and
  click-to-browse.
- Pasting non-image content (e.g. text) is a silent no-op — no error
  shown, since it isn't a failed image upload attempt.
- If the clipboard holds multiple items, use the first image item found.

Out of scope: nothing else changes — no new UI beyond a copy tweak.

## Design

- Add a `paste` event listener on `document` (works regardless of what
  element has focus).
- In the handler, iterate `event.clipboardData.items`; find the first
  item whose `type` starts with `image/`; call `.getAsFile()` on it to
  get a `File`.
- If a file was found, call the existing `handleFile(file)` — reusing
  all validation, downscaling, processing, and preview logic unchanged.
- If no image item is found, do nothing (no error, no state change).
- Update the drop-zone's instructional text in `index.html` from
  "Drag & drop a photo here, or click to choose a file" to mention
  paste, e.g. "Drag & drop, click to choose, or paste (Ctrl+V) a photo".

## Testing

Same as the rest of the app: manual/visual verification in a browser —
copy an image to the clipboard and paste it on the page, confirm it
processes like an upload; paste plain text and confirm nothing happens.
