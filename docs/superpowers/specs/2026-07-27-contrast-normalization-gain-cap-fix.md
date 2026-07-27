# Contrast Normalization Gain Cap — Correction

## Purpose

The previous fix (local contrast normalization, `docs/superpowers/specs/2026-07-27-local-contrast-normalization-design.md`, shipped as commit 068fad5) fixed the original missing-dark-detail bug but introduced a regression: real photos/illustrations produced widespread speckle noise across the whole image, including in flat colored regions (e.g. solid black clothing, plain backgrounds).

## Root Cause of the Regression

Diagnosed against a real user-supplied image (542x549 illustration), not just synthetic test data:

- The previous design used a fixed **noise floor** (minimum local stddev of 8) as the divisor in the normalization formula, with a **target stddev of 64** — meaning any region with real local stddev at or below 8 was *always* amplified by at least 64/8 = **8x**.
- Measuring the real image's actual local standard deviation (15x15 windows) in "flat-looking" regions showed values ranging from ~1.3 up to ~28, with the bulk of the image (roughly 70% of pixels) in the 2-8 std range — i.e. real illustrations have inherent subtle shading/antialiasing/rendering variation in this same low range that the noise floor was meant to protect against.
- Dividing by a floor of 8 amplified this ubiquitous subtle real-image variation by 8x uniformly across the whole image, turning imperceptible shading/texture into visible high-contrast noise once thresholded — reproduced and confirmed by rendering the actual pipeline output against the real image and visually inspecting an intermediate "normalized grayscale" stage, which showed fine graininess everywhere, not just at intended edges.

## Fix

Replace the fixed noise-floor divisor with an explicit **maximum gain cap**: instead of flooring the divisor at a fixed stddev value, compute the minimum divisor as `targetStd / maxGain`, which directly limits how much any region's contrast can be amplified, regardless of how low its local stddev is. This is the same principle as the "contrast limiting" in CLAHE (Contrast-Limited Adaptive Histogram Equalization) — cap the amplification slope, not just the divisor floor.

```
minStdForGain = targetStd / maxGain
effectiveStd = max(localStdDev, minStdForGain)
normalized = clamp((gray - localMean) / effectiveStd * targetStd + targetMean, 0, 255)
```

## Parameters (re-tuned against real image data)

- `windowRadius` = 7 (unchanged, 15x15 window)
- `targetMean` = 128 (unchanged)
- `targetStd` = 64 (unchanged)
- `maxGain` = **3** (replaces the previous fixed `noiseFloor` = 8 parameter)
- Default threshold = **210** (replaces the previous 150)

These were chosen empirically: swept gain values 3-8 and thresholds against both (a) the original synthetic reference edges used to diagnose the first bug, and (b) the real image's actual background noise, rendering full output images at each combination and visually inspecting them. Gain=3 with threshold=210 was the cleanest result that still visibly recovers more clothing-fold and background-pattern detail than the pre-fix baseline (threshold=60, no normalization), confirmed by direct visual comparison against that baseline on the same real image.

## Known Limitation (disclosed, not silently accepted)

**This is a materially larger limitation than it might first appear — both of the original bug's real-world diagnostic cases remain undetected, not just an idealized extreme.** Measured against the actual committed code:

| Reference case | Raw gradient magnitude at gain=3 | Clears threshold 210? |
|---|---|---|
| Dark background pattern (delta=15) | 96 | No |
| Dark clothing fold (delta=20) | 124 | No |
| High-contrast edge (delta=210) | 296 | Yes |

The practical breakeven point is around delta≈32-33 — noticeably higher than either of the two low-contrast scenarios that motivated the original fix. In other words: **this correction eliminates the noise regression, but in doing so it returns both of the originally-reported dark-detail cases to essentially their pre-fix (undetected) state.** Only the high-contrast case — which was never actually broken — remains reliably fixed, plus any real edge with contrast above the ~32-33 breakeven.

Investigation showed this is not a tunable oversight: this real image's own inherent background rendering noise occupies an overlapping raw-contrast range with both of these diagnostic cases, so no (gain, threshold) combination usable with this pure local-stddev-based technique can separate "faint real edge" from "faint rendering texture" for this class of image. The chosen parameters were a deliberate trade-off, confirmed by direct visual comparison, favoring a clean and visually-correct result over recovering these specific faint cases — but that trade-off should be understood as "the original bug is largely still present, just without the noise side-effect," not as "the original bug is fixed except for an extreme edge case."

Future ideas if more sensitivity is needed later: a directional/coherence-based signal (real edges have consistent gradient direction across a neighborhood; noise does not) to distinguish faint structured edges from texture noise, rather than local variance alone.

## Testing

Verified via:
1. Direct visual inspection of the real pipeline's output against a user-supplied real illustration (decoded via a temporary Node PNG reader, run through the actual committed pipeline functions via `vm`), comparing the pre-fix baseline, the broken uncapped-gain fix, and several gain/threshold candidates.
2. Re-running the original synthetic reference cases (dark background pattern delta=15, dark clothing fold delta=20, high-contrast delta=210, noisy-flat-region false-positive check) against the new gain-capped formula — see the table above. Both low-contrast cases fail to clear the new threshold; only the high-contrast case and stronger real edges reliably pass.
3. Independent re-verification (separate review pass) reproduced these exact numbers from the real committed code and confirmed the rendered real-image output is visually clean, with no widespread speckle noise (7.35% black-pixel density vs. 24.95% for the broken config on the same image).
