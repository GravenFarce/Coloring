# Connect-the-Dots Generator — Design

## Purpose

Generate a classic connect-the-dots puzzle from the already-generated coloring sheet: numbered dots tracing the subject's outer silhouette, which the user connects in order by hand.

## Scope

Traces the outer silhouette only — not internal detail (facial features, clothing folds, background patterns). On-demand via a new button, not automatic. Reuses the existing edge-detection pipeline and its Detail Level / Dark-Area Sensitivity tuning as input; adds one new slider (dot count) and one new algorithm stage (silhouette extraction → boundary trace → simplification → dot rendering).

Explicitly out of scope for this version: multiple enclosed sub-regions as separate numbered loops (considered and deferred — see the design spec this builds on), a "show solution" connecting-lines overlay, adjustable dot size/line style.

## Why This Is Hard (and How We Avoid the Hard Part)

The coloring sheet's edge output is a branching line drawing — many separate strokes and junctions, not one clean loop. Tracing an arbitrary branching line network into a single ordered path is a much harder problem than tracing the boundary of a single filled region. This design sidesteps that: instead of tracing the line drawing directly, it treats the line drawing as a set of "walls," flood-fills the background from the image border, and traces the boundary of whatever the flood fill couldn't reach (the silhouette). Boundary-tracing a filled region is a solved, well-documented problem (Moore-neighbor tracing) with no branch-handling required, because a region boundary is always a single closed loop by construction.

## Algorithm Pipeline

Runs when "Generate Connect-the-Dots" is clicked, using the *currently displayed* coloring sheet (i.e. whatever Detail Level / Dark-Area Sensitivity are currently set to):

1. **Wall bitmap**: threshold the cached edge-magnitude array at the current Detail Level threshold (same computation already driving the coloring sheet) → `true` where there's a black outline pixel.
2. **Dilate**: thicken wall pixels by 1 pixel (mark each wall pixel's 4-neighbors as wall too) to help close small gaps in the outline.
3. **Background flood-fill**: BFS from every non-wall border pixel, spreading through non-wall pixels only. Marks the reachable region as "background."
4. **Silhouette extraction**: everything not marked background (wall pixels + any enclosed non-wall pixels the fill couldn't reach) is "silhouette." If this forms multiple disconnected regions, keep only the largest by pixel count.
5. **Boundary trace**: Moore-neighbor boundary tracing around the silhouette region, producing an ordered sequence of boundary pixel coordinates (a single closed loop).
6. **Simplification**: Douglas-Peucker polyline simplification, with its epsilon parameter adjusted via iterative search until the simplified point count is close to the user's requested dot count.
7. **Render**: draw each simplified point as a small numbered dot (filled circle + sequence number, starting at 1) on a new canvas, white background, no connecting lines.

## UI

A new section, shown/hidden under the same lifecycle as the existing tuning controls (visible once a coloring sheet exists):

- "Number of Dots" slider: range 20–100, step 5, default 50. Moving it only updates its own live label — it does not auto-regenerate (matches the button-triggered model chosen for this feature).
- "Generate Connect-the-Dots" button.
- On click: a new canvas appears showing the result, plus its own "Download Connect-the-Dots" button (same PNG-export pattern as the existing download button).
- The existing "Reset to Defaults" button also resets the dot-count slider (no separate reset control added).

## Error Handling

- If every border pixel happens to be a wall pixel (flood fill has no seed), or the resulting background region is implausibly small (e.g. under 2% of the image — a strong sign the fill leaked through a gap and swallowed everything, or conversely never escaped a small corner), show an error message instead of rendering a broken result: "Couldn't trace a clean outline for this photo — try adjusting Detail Level or Dark-Area Sensitivity first."
- This is a real, disclosed limitation: photos whose coloring-sheet outline has large gaps around the silhouette may not trace cleanly. Adjusting the existing sliders (lower Detail Level threshold, higher Dark-Area Sensitivity) before generating can help close those gaps, since it changes the same wall bitmap this feature reads from.

## Testing

Same manual/visual approach as the rest of the project, plus the Node/`vm` execution of real pipeline functions already used throughout: verify the flood-fill/silhouette extraction on synthetic test bitmaps (a clean closed square, a square with a small gap in its outline, a square with a large gap), verify Moore-neighbor tracing produces a closed loop of the expected approximate length on a simple synthetic shape, and verify Douglas-Peucker's epsilon search converges to within a small tolerance of the requested dot count.
