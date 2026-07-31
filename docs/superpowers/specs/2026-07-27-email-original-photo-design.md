# Email Original Photo Button — Design

## Purpose

Let the user quickly email the original uploaded photo to a hardcoded address (`varga.ferenc88@gmail.com`) directly from the site.

## Background: Why `mailto:` + Clipboard Copy

This is a static site with no backend (a deliberate constraint of the whole project). Investigated three popular client-side-friendly services for actually attaching a file to a sent email (EmailJS, Formspree, Web3Forms) — all three gate real file attachments behind a paid plan; none offer it free. A genuinely free path exists (a small serverless backend calling an email API like Resend), but that's a significant architecture change (new accounts, a deployed function, domain verification) that wasn't the right trade-off here.

Chosen approach: a `mailto:` link (opens the user's own email client, works with any email provider, zero cost, zero third-party accounts) combined with automatically copying the original photo to the clipboard first, so the user can paste it directly into the email instead of having to locate and manually attach a downloaded file.

## Scope

One new button, shown/hidden under the same conditions as the existing download/print buttons (visible once an image has been loaded and drawn to `original-canvas`). No changes to the coloring-sheet processing pipeline. No changes to how the download/print buttons work.

## Design

**Button:** "Email Original Photo", styled consistently with the existing pill-button treatment, placed alongside download/print.

**Click behavior:**
1. Convert the `original-canvas` content to a PNG `Blob` via `canvas.toBlob()`.
2. Write it to the clipboard via `navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])`.
3. On success: show a green confirmation message ("Photo copied to clipboard — paste it into the email (Ctrl+V)!") and open a `mailto:varga.ferenc88@gmail.com?subject=...&body=...` link (prefilled subject and a body reminding the recipient — actually the sender, since they're the one composing — to paste the image before sending).
4. On failure (clipboard API unavailable, permission denied, or any other error): show a red error message instead, but still open the `mailto:` link so the user's email client opens regardless — a failed clipboard copy shouldn't block them from emailing manually.

**New UI element:** a `success-message` element (green pill, matching the existing red `error-message` / yellow `status-message` visual pattern) to show the clipboard-copy confirmation.

## Testing

Same manual/visual approach as the rest of the project: upload a photo, click "Email Original Photo", confirm (in a real browser) that the clipboard now contains the image (pasteable), the green confirmation message appears, and the default email client opens with the recipient and subject prefilled.
