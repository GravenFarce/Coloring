# Connect-the-Dots Generator — Design

## Purpose

Generate a classic connect-the-dots puzzle from the uploaded photo: numbered dots tracing the subject's outer silhouette, which the user connects in order by hand.

## Scope

Traces the outer silhouette only — not internal detail (facial features, clothing folds, background patterns). On-demand via a new button, not automatic.

Explicitly out of scope for this version: multiple enclosed sub-regions as separate numbered loops, a "show solution" connecting-lines overlay, adjustable dot size/line style, adjustable smoothing strength.

## Revision Note

The original version of this design reused the coloring-sheet's edge-detection output (the same Sobel-based "walls" that drive Detail Level / Dark-Area Sensitivity) as the silhouette source. **This was tested against a real photo and rejected**: at clean/default settings, the flood-fill leaked through real gaps in the outline and collapsed onto a small facial cluster instead of the full silhouette; at very aggressive settings, the result was a noisy fractal blob, not a usable outline. Both were rendered and visually confirmed to be unusable.

The design below uses a different, independently-validated technique instead: color-distance-based background classification, flood-filled from the image border. This was tested end-to-end against the same real photo (a 542×549 character illustration) and produces a clean, recognizable silhouette and a legible dot sequence. It does not reuse the coloring-sheet edge pipeline at all — it works directly from the original uploaded photo.

## Why This Is Hard (and How We Avoid the Hard Part)

A line drawing (like the coloring sheet) is a branching network of strokes and junctions — tracing it into one ordered path is a much harder problem than tracing the boundary of a single filled region. This design sidesteps that entirely: it classifies pixels as "background" or "subject" by color, then traces the boundary of the resulting filled subject region. Boundary-tracing a filled region (Moore-neighbor tracing) is a solved, well-documented problem with no branch-handling required, because a region boundary is always a single closed loop by construction.

## Algorithm Pipeline

Runs when "Generate Connect-the-Dots" is clicked, reading directly from `original-canvas` (not the coloring-sheet output):

1. **Sample background color**: average the RGB of a thin strip (5px) along the image border. Assumes the background is reasonably uniform and doesn't touch the image edges with the subject — a real assumption, not universally true, but held for the photo this was validated against.
2. **Background flood-fill by color**: BFS from every border pixel, spreading through neighboring pixels whose color distance from the sampled background average is under the (user-adjustable) **Outline Tightness** threshold. Marks the reachable region as "background." This is validated to be more robust than a plain global color threshold, because a pixel deep inside the subject that happens to be background-colored won't be misclassified unless it's actually *connected* to the border through other background-colored pixels.
3. **Silhouette extraction**: everything not reached by the flood-fill is "silhouette" (8-connected). If this forms multiple disconnected regions, keep only the largest by pixel count.
4. **Smooth the silhouette mask**: a majority-vote filter (for each pixel, look at a 13×13 window — radius 6 — and set it to whichever value, silhouette or not, is more common in that window), using a summed-area table for performance. This step was necessary: without it, the traced boundary follows pixel-level jaggedness in the mask and produces a scattered, unrecognizable dot pattern once simplified — confirmed by rendering both with and without this step.
5. **Re-extract the largest connected component** after smoothing (smoothing can occasionally split or reshape regions).
6. **Boundary trace**: Moore-neighbor boundary tracing around the smoothed silhouette, producing an ordered sequence of boundary pixel coordinates (a single closed loop).
7. **Simplification**: Douglas-Peucker polyline simplification (applied to a closed loop by splitting it at two roughly-opposite points, simplifying each half as an open polyline, then rejoining), with its epsilon parameter adjusted via iterative binary search until the simplified point count is close to the user's requested dot count.
8. **Render**: draw each simplified point as a small numbered dot (filled circle + sequence number, starting at 1) on a new canvas, white background, no connecting lines.

## UI

A new section, shown/hidden under the same lifecycle as the existing tuning controls (visible once a coloring sheet exists):

- "Outline Tightness" slider: range 40–150, step 10, default 100 (validated as producing a clean, recognizable result on the test photo). Higher = tighter/more conservative silhouette (only counts pixels clearly different from background); lower = looser (bigger, messier silhouette that may include background texture).
- "Number of Dots" slider: range 20–100, step 5, default 50. Moving either slider only updates its own live label — neither auto-regenerates (button-triggered model, matching the existing choice for this feature).
- "Generate Connect-the-Dots" button.
- On click: a new canvas appears showing the result, plus its own "Download Connect-the-Dots" button (same PNG-export pattern as the existing download button).
- The existing "Reset to Defaults" button also resets both new sliders.

## Error Handling

- If the final silhouette (after step 5, the largest component post-smoothing — what actually gets traced) is implausibly small (under ~1% of the image) or implausibly large (over ~90%), show an error instead of rendering a broken result: "Couldn't find a clean outline for this photo — try adjusting Outline Tightness." This covers both failure directions: too-loose a threshold swallowing the whole image as background, or too-tight a threshold barely finding any background at all.
- Disclosed, real limitation: this assumes a reasonably uniform, distinguishable background that doesn't touch the image edges. A photo with a complex/non-uniform background, or a subject filling the frame edge-to-edge, may not produce a clean silhouette no matter how Outline Tightness is adjusted. This was validated against one real photo with a fairly uniform dark background — results on very different photo compositions are untested.

## Testing

Same manual/visual approach as the rest of the project, plus the Node/`vm`-and-direct-script execution already used throughout this project: the full pipeline (background sampling, color-flood-fill, largest-component extraction, mask smoothing, Moore-neighbor tracing, Douglas-Peucker simplification) was implemented and validated during design against: synthetic shapes (a clean square, a square with a 1px gap correctly closed, a square with a 6px gap correctly triggering the leak-detection logic, a circle), and the real test photo end-to-end (rendered and visually confirmed to produce a recognizable, legible connect-the-dots sequence). This validation work will be transcribed directly into the implementation plan.
