# Playful Visual Redesign — Design

## Purpose

The page currently works well but looks plain (default system styling, flat white panels, no color). Give it a playful, colorful "coloring book" personality that matches what the tool actually does, without touching any of the image-processing logic.

## Scope

Visual/CSS changes only — `style.css`, plus a couple of small `index.html` tweaks (emoji accents, no structural changes). No changes to `script.js` logic, no new dependencies, no external font requests.

## Design

**Palette — crayon-box accents, used selectively (not all colors everywhere at once):**
- Red `#E63946`, Orange `#F77F00`, Yellow `#FFB703`, Green `#2A9D8F`, Blue `#4361EE`, Purple `#9D4EDD`.
- "Original" panel header accent: Blue. "Coloring Sheet" panel header accent: Purple.
- Download button: Green. Print button: Orange.
- Error message: Red badge/pill style. Drop-zone border: a bright, single crayon color (Blue) rather than the current gray dashed border.

**Typography:** no external font request (system font stack, per approved choice). Headings become bolder and larger, with tighter/friendlier letter-spacing; the `h1` gets a colorful accent (e.g. a colored underline or a two-tone treatment on "Photo" vs "Coloring Sheet").

**Shape language:** increase border-radius across the board (drop-zone, preview panels, buttons) for a friendlier, rounder feel. Preview panels become card-like: soft `box-shadow`, rounded corners, a colored top border/header bar matching their accent color.

**Buttons:** rounded/pill-shaped, bold crayon-colored backgrounds with white text, soft shadow. `:hover` scales up slightly (`transform: scale(1.05)`) with a smooth transition; `:active` scales down slightly (`transform: scale(0.97)`) for a "press" feel.

**Drop-zone:** thicker, brighter dashed border (Blue), same hover scale treatment as buttons, slightly larger padding. Small emoji accent (e.g. 🖍️) added to the instructional text for personality — cosmetic text change only, no new DOM structure.

**Motion:** a lightweight CSS `@keyframes` fade/slide-in animation applied to `.preview-area` so it animates in the moment it's revealed (the existing JS already just toggles the `hidden` attribute — CSS animations trigger automatically once an element enters the render tree, so no JS changes are needed for this).

**Status/error messages:** small pill/badge styling instead of plain text, using their respective accent colors (red for error).

## Testing

Same manual/visual approach as the rest of the project: load the page, confirm the new styling renders correctly, upload a photo and confirm the preview area animates in and buttons/panels show their accent colors and hover effects, confirm no layout breakage on the existing functionality (drop-zone still accepts files, buttons still work, `@media print` output is unaffected since it explicitly isolates `#output-canvas` regardless of the rest of the page's styling).
