# Print Coloring Sheet Button — Design

## Purpose

Let the user print the generated coloring sheet directly from the browser, without first downloading the PNG file.

## Scope

- A "Print Coloring Sheet" button next to the existing "Download Coloring Sheet" button, shown/hidden under the same conditions (hidden until a coloring sheet has been generated).
- Clicking it opens the browser's native print dialog via `window.print()`.
- The printed output shows only the coloring sheet (output canvas) — no page heading, no buttons, no original-photo preview panel.

Out of scope: print-specific options (paper size selection, margins UI) — rely on the browser's native print dialog for those, same as any other website.

## Design

- Add a `print-button` button element next to `download-button` in `index.html`, hidden by default (same `hidden` attribute pattern as the download button), with the same text style.
- In `script.js`, show/hide `printButton` alongside `downloadButton` in `handleFile` (wherever `downloadButton.hidden` is toggled, `printButton.hidden` is toggled the same way).
- Add a click handler: `printButton.addEventListener('click', () => window.print());`.
- Add a `@media print` block to `style.css` that hides every element on the page except the output canvas, using the standard "isolate one element for printing" CSS technique:
  ```css
  @media print {
    body * { visibility: hidden; }
    #output-canvas, #output-canvas * { visibility: visible; }
    #output-canvas {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
    }
  }
  ```

## Testing

Same manual/visual approach as the rest of the project: generate a coloring sheet, click Print, and confirm (via the browser's print preview) that only the coloring sheet appears on the page, scaled to fill it, with no heading/buttons/original-preview visible.
