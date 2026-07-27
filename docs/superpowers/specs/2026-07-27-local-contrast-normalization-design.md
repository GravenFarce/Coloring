# Local Contrast Normalization — Design

## Purpose

Fix a real defect found via user testing: dark/low-key regions of a photo
(shadows, black clothing, dark patterned backgrounds) produce little or no
outline in the generated coloring sheet, while bright/high-contrast regions
produce good outlines. Verified root cause: `thresholdAndInvert` compares
raw Sobel gradient magnitude against one fixed constant (60). A subtle
edge in a dark region (e.g. luminance 30 vs 45, delta 15) produces gradient
magnitude ~40 — below threshold, discarded — while a bright high-contrast
edge (e.g. luminance 230 vs 20, delta 210) produces magnitude ~560 — easily
detected. The same "amount of edge" is structurally penalized when it
occurs in a dark region, because the threshold operates on absolute
luminance differences rather than differences relative to local contrast.

## Scope

Add a local contrast normalization pass to the existing processing
pipeline so gradient-based edge detection is equally sensitive across the
image's brightness range. No changes to the surrounding UI, upload flow,
or download flow.

Out of scope: adjustable sliders for window size/threshold (still a fixed
default, consistent with the rest of this project); replacing Sobel
entirely; batch/multi-image handling.

## Design

**Updated pipeline:**
```
grayscale -> box blur (existing) -> local contrast normalization (new)
  -> Sobel magnitude (existing) -> threshold + invert (existing, re-tuned constant)
```

Blur runs before normalization so normalization isn't amplifying raw
pixel/JPEG noise into fake detail.

**Normalization formula**, per pixel:
```
normalized = clamp(
  (gray[p] - localMean) / max(localStdDev, NOISE_FLOOR) * TARGET_STD + TARGET_MEAN,
  0, 255
)
```
- `localMean` / `localStdDev`: computed over a 15x15 window centered on
  the pixel (clamped at image edges).
- `TARGET_STD` = 64, `TARGET_MEAN` = 128 — the output is re-centered
  around mid-gray with a fixed target spread, so a low-variance dark
  region and a high-variance bright region end up on the same effective
  contrast scale.
- `NOISE_FLOOR` = 8 — a minimum local standard deviation used in the
  division, so a genuinely flat region (stddev near 0, e.g. a plain
  background) doesn't get its residual quantization noise blown up into
  fake detected edges.

**Performance — summed-area table (integral image):** a naive 15x15
window lookup per pixel would cost ~225 operations x ~2.56M pixels
(1600x1600 image) for each of mean and variance — too slow for a
synchronous browser pass. Instead, build two prefix-sum arrays over the
whole (blurred) grayscale image — one for pixel values, one for pixel
values squared — in a single O(width*height) pass. Local sum and
sum-of-squares for any window then come from 4 array lookups
(inclusion-exclusion on the prefix sums), giving O(1) per-pixel local
mean/variance regardless of window size. Total added cost is the same
order of magnitude as the existing blur/Sobel passes, not a
window-size-multiplied cost.

**Threshold re-tuning:** after normalization, gradient magnitude is
computed from contrast-normalized values rather than raw luminance, so
the meaningful threshold value shifts. The new default threshold will be
determined empirically against the same three reference cases used to
diagnose this bug (dark background pattern, dark clothing fold,
high-contrast face/hood edge), confirming all three now produce gradient
magnitudes clearly on the "edge" side of the new threshold, without the
high-contrast case producing so much amplified noise elsewhere that busy
photos become unreadable.

## Testing

Same manual/visual approach as the rest of the project, plus a repeat of
the diagnostic script used to find this bug: run the real pipeline
functions (via Node + a minimal `ImageData` polyfill, as used throughout
this project) against synthetic step-edge images at the three reference
deltas (15, 20, 210), confirming all three now clear the re-tuned
threshold. Then re-run the actual example photo that surfaced this bug
(if available) and visually confirm the dark background pattern and dark
clothing folds now produce outline detail.

## Future Ideas (not in this version)

- Adjustable window size / target contrast via UI sliders.
- Per-region adaptive threshold instead of a single global constant even
  after normalization (this design assumes normalization plus one fixed
  threshold is sufficient; if artifacts remain, a follow-up could revisit
  this).
