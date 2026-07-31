# Two-Section Layout + Auto-Regenerating Dots — Design

## Purpose

Restructure the page into two clearly separated sections (Coloring Sheet, Connect the Dots), each with its own heading and its own buttons, and make the Connect-the-Dots picture generate and regenerate automatically instead of via a manual button.

## Scope

Layout/organization change plus one behavioral change (auto-regeneration). No changes to the underlying algorithms (Sobel pipeline, silhouette-tracing pipeline) — only how their outputs are triggered, cached, and grouped in the UI.

## Layout

Two `<section>` wrappers, each toggled as a single unit (`hidden` on the section itself, not on each child individually — all children of a section already always show/hide together, so this also simplifies the JS):

**`#coloring-sheet-section`** — heading "Coloring Sheet" (same gradient-underline style as the page's `<h1>`, scaled down for `<h2>`), then: the existing Original/Coloring Sheet preview panels, then the existing Detail Level / Dark-Area Sensitivity sliders (already positioned under the pictures — unchanged), then this section's own button row: Download Coloring Sheet, Print Coloring Sheet, Email Original Photo, Reset to Defaults (resets only Detail Level/Dark-Area Sensitivity).

**`#dots-section`** — heading "Connect the Dots" (same style), then: the dots canvas, then the Outline Tightness / Number of Dots sliders moved to underneath it (previously above), then this section's own button row: Download Connect-the-Dots, Reset to Defaults (resets only Outline Tightness/Number of Dots).

The shared upload flow (drop-zone, error/status/success messages) stays above both sections, since it's common to both.

## Behavior Changes

**Automatic generation**: the "Generate Connect-the-Dots" button is removed entirely. As soon as a coloring sheet is successfully generated (upload success path), the connect-the-dots picture generates automatically using the default slider values, and `#dots-section` becomes visible at the same time as `#coloring-sheet-section`.

**Auto-regeneration with caching**, mirroring the existing Detail Level/Dark-Area Sensitivity pattern:
- The expensive stages (color-flood-fill → largest-component → smoothing → boundary trace) are cached as `cachedDotsBoundary`, recomputed only when **Outline Tightness** changes — debounced ~75ms (same rationale as Dark-Area Sensitivity: this reruns real work on every `input` event, so debounce avoids hammering the CPU during a drag).
- **Number of Dots** only re-runs the cheap final step (Douglas-Peucker simplification against the already-cached boundary) — instant, no debounce, mirroring Detail Level's cheap re-threshold path.
- If Outline Tightness produces a boundary that fails the existing size sanity check, the existing error message shows and the dots canvas is left as whatever it last successfully showed (or hidden, if there was never a successful generation) — same failure semantics as before, just reached automatically instead of via a button click.

**Two independent Reset buttons**, replacing the single four-slider one: each section's Reset only touches that section's own two sliders and re-triggers that section's own regeneration.

## Testing

Same manual/visual approach as the rest of the project, plus Node execution of the refactored pure functions (the boundary-computation step is being split out of the existing `generateDotPoints` so it can be cached and reused independently of the dot-count step — this split will be re-verified with the same synthetic-shape and real-photo checks already used to validate the original algorithm).
