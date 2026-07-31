# Detail Tuning Sliders — Design

## Purpose

Let the user fine-tune a generated coloring sheet by trial and error instead of being stuck with one fixed default. Directly addresses the known trade-off documented in `docs/superpowers/specs/2026-07-27-contrast-normalization-gain-cap-fix.md`: the fixed defaults (threshold 210, gain 3) clean up noise but can under-recover faint dark detail on some photos. Now the user can push either dial per-image.

## Scope

Two sliders (Detail Level, Dark-Area Sensitivity) plus a Reset button, live-updating the already-generated coloring sheet without re-uploading the photo. No changes to the upload/validation/download/print/email flows.

## Parameters Exposed

- **Detail Level** → the edge-detection `threshold` (currently a fixed 210). Range 100–300, step 10, default 210. Lower = more lines/detail (and more noise risk); higher = cleaner/simpler.
- **Dark-Area Sensitivity** → the contrast-normalization `maxGain` (currently a fixed 3). Range 1–6, step 0.5, default 3. Higher = more aggressive boosting of faint dark-region detail (and more noise risk in that region).

## Architecture

The current `processImageData(imageData, threshold)` function runs grayscale → blur → normalize → Sobel → threshold as one monolithic pass every time. That's fine for a single one-shot conversion, but wasteful for live slider tuning — most of that work doesn't depend on either slider.

This design retires `processImageData` as the main call site (the underlying pure functions it wraps — `toGrayscale`, `boxBlur3x3`, `localContrastNormalize`, `sobelMagnitude`, `thresholdAndInvert`, `toImageData` — are unchanged and reused directly) in favor of direct orchestration with caching:

- On a successful upload, compute `grayscale` then `blurred` once and cache both (module-level variables), since neither depends on either slider.
- From `blurred`, compute `normalized` → `magnitude` using the current Dark-Area Sensitivity value, and cache `magnitude`.
- From `magnitude`, compute `thresholdAndInvert` → render, using the current Detail Level value.

**Detail Level slider moved:** re-run only the last step (`thresholdAndInvert` + render) against the cached `magnitude` — cheap, runs on every `input` event, feels instant.

**Dark-Area Sensitivity slider moved:** the cached `magnitude` is now stale (it depended on the old gain), so `normalized` → `magnitude` → `thresholdAndInvert` → render must all re-run. This is heavier, so it's debounced: a ~75ms timer is (re)started on each `input` event, and only fires the recompute once dragging pauses. `blurred` itself is untouched (still cached), so grayscale/blur are never redone after the initial upload.

**Reset button:** sets both sliders back to their defaults (210 / 3), updates the visible value labels, and triggers the heavier recompute path (since gain resets too).

**New upload:** both sliders (and their labels) are reset to defaults before the pipeline runs, so a new photo always starts from the known-good defaults rather than inheriting the previous photo's tuning.

## UI

A new `#tuning-controls` section, shown/hidden under the same lifecycle as the existing download/print/email buttons (visible once a coloring sheet exists), placed between the preview area and the button row:

- "Detail Level: `<value>`" label + range slider
- "Dark-Area Sensitivity: `<value>`" label + range slider
- "Reset to Defaults" button

## Error Handling

- Slider `input` handlers no-op if no image has been processed yet (defensive check against the cached-blur variable being unset) — unreachable in practice since the controls are hidden until an image exists, but guards against any future path that might expose them early.
- The debounce timer for the Dark-Area Sensitivity slider is cleared and replaced on every `input` event, so rapid dragging never queues up multiple overlapping recomputes.

## Testing

Same manual/visual approach as the rest of the project, plus the Node/`vm`-based execution of the real pipeline functions already used throughout this project: verify moving the Detail Level slider changes only the threshold step's output (same `magnitude` array, different cutoff), and verify moving the Dark-Area Sensitivity slider actually changes the cached `magnitude` array's values (confirming the recompute path runs). Manual verification once a browser is available: drag each slider, confirm the coloring sheet updates (instantly for Detail Level, shortly after releasing for Dark-Area Sensitivity), confirm Reset restores both sliders and regenerates, confirm uploading a second photo resets both sliders to defaults.
