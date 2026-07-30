# Favicon — Design

## Purpose

Add a browser-tab favicon: a colorful crayon-ball, matching the site's existing crayon color palette and playful redesign.

## Scope

Two static assets plus two `<link>` tags in `index.html`. No changes to `script.js` or the image-processing logic.

## Design

**Visual:** a circle divided into 6 equal pie-slice wedges (like a beach ball), using the same six crayon colors already defined in `style.css`'s `:root` custom properties (`#E63946` red, `#F77F00` orange, `#FFB703` yellow, `#2A9D8F` green, `#4361EE` blue, `#9D4EDD` purple), with a dark outline ring and a soft glossy white highlight in the upper-left. Approved via a rendered preview image before implementation.

**Assets:**
- `favicon.svg` — hand-authored vector version (six `<path>` wedges + a radial-gradient highlight circle + a stroked outline circle), scales crisply at any size, tiny file.
- `favicon.png` — a 180x180 raster fallback for browsers/contexts that don't support SVG favicons, generated once via a small Node script (procedural circle-wedge rendering, matching the SVG's design) and committed as a binary asset. Also reused as the `apple-touch-icon` for iOS home-screen bookmarks.

**Wiring:** in `index.html`'s `<head>`, add:
```html
<link rel="icon" href="favicon.svg" type="image/svg+xml">
<link rel="icon" href="favicon.png" type="image/png">
<link rel="apple-touch-icon" href="favicon.png">
```
Browsers that support SVG favicons use the first; others fall back to the PNG.

## Testing

Same manual/visual approach as the rest of the project: confirm the two asset files exist and are valid image files, confirm `index.html` references them correctly, and (once a browser is available) confirm the browser tab shows the colorful ball icon.
