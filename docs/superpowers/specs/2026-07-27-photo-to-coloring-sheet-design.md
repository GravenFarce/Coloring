# Photo → Coloring Sheet — Design

## Purpose

A single-page web tool that converts an uploaded photo into a printable
black-and-white coloring-book style outline. Runs entirely in the browser
and is hosted for free on GitHub Pages.

## Scope

- One image in, one coloring sheet out (no batch upload).
- Auto-processes immediately on upload with fixed default settings (no
  sliders/manual tuning in this version).
- Output style: clean black outline on white background.

Explicitly out of scope for this version: batch processing, adjustable
sliders/presets, accounts, server-side processing, non-PNG export formats.

## Architecture

Static site, no build step, no backend:

```
index.html
style.css
script.js
```

Deployed straight to GitHub Pages from the repository's default branch
(via the repo's Pages settings, serving from `/` or `/docs`). No npm,
no bundler, no server-side code. All processing happens client-side via
the HTML5 Canvas API — no network calls after the page loads, so there
are no API-failure or offline states to handle.

## Components & Data Flow

1. **Upload widget** — file input (click-to-browse) plus a drag-and-drop
   zone. Accepts JPEG/PNG/WebP.
2. **Downscale step** — if the image's longest edge exceeds ~1600px,
   scale it down before processing (keeps processing fast and output
   size reasonable for printing).
3. **Processing engine** (in `script.js`), run on an off-screen canvas:
   - Convert to grayscale.
   - Apply a slight Gaussian blur to reduce noise.
   - Run Sobel edge-magnitude detection.
   - Threshold the result to pure black/white.
   - Invert so lines are black on a white background.
4. **Preview panel** — shows original and converted result side-by-side.
5. **Download button** — exports the output canvas as a PNG
   (`canvas.toDataURL`), named after the original file
   (e.g. `photo.jpg` → `photo-coloring-sheet.png`).

Flow: upload → auto-run pipeline → preview → download. Single page,
no navigation, no reload.

## Error Handling & Edge Cases

- **Non-image file uploaded**: validated client-side by MIME type; show
  an inline message ("Please upload an image file") rather than
  crashing.
- **Large images**: downscaled per above before processing.
- **Processing latency**: a "Processing..." indicator is shown while
  the pipeline runs so the page doesn't appear frozen.

## Testing

No backend logic to unit test. Verification is manual/visual in a
browser:

- Upload a high-contrast simple photo, a busy/detailed photo, and a
  photo with a plain background — confirm each produces a usable
  coloring sheet.
- Test drag-and-drop upload path.
- Test rejection of a non-image file.
- Test that the download button produces a valid, correctly named PNG.

## Future Ideas (not in this version)

- Adjustable sliders for edge sensitivity / line thickness.
- Batch upload with zip download.
- Swap in OpenCV.js (WASM) for higher-quality Canny edge detection on
  complex photos, if the vanilla Sobel pipeline proves insufficient.
