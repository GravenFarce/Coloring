# Print Connect-the-Dots Button — Design

## Purpose

Add a print button for the Connect-the-Dots picture, mirroring the existing "Print Coloring Sheet" button.

## Scope

One new button in the Connect-the-Dots section's button row. No changes to the existing Print Coloring Sheet button's behavior.

## Design

The existing print mechanism uses `window.print()` plus a `@media print` rule that isolates `#output-canvas`. Since `@media print` is pure CSS with no direct knowledge of "which button was clicked," this adds a toggled class on `<body>` to switch which canvas gets isolated:

- `printDotsButton` click handler: adds class `printing-dots` to `<body>`, then calls `window.print()`.
- `@media print` gains a `body.printing-dots` variant: hides `#output-canvas`, isolates `#dots-canvas` instead (same position/sizing treatment).
- A `window.addEventListener('afterprint', ...)` handler removes the `printing-dots` class once the print dialog closes (printed or cancelled), so it doesn't linger and affect a later "Print Coloring Sheet" click.
- The existing `printButton` (Print Coloring Sheet) is unchanged — it never adds the class, so the default (no-class) `@media print` rule continues to isolate `#output-canvas` for it.

## Testing

Same manual/visual approach as the rest of the project: click Print Connect-the-Dots and confirm (via print preview) only the dots picture shows; click Print Coloring Sheet afterward and confirm it still correctly isolates the coloring sheet, not leftover dots-printing state.
