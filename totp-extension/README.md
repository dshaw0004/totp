# gauth-vault (browser extension)

Self-hosted authenticator. Scans QR codes directly on the page, stores
secrets encrypted with a master password, generates TOTP/HOTP codes on
demand. No cloud, no sync, no telemetry.

## Install (dev/unpacked)
**Chrome / Edge:** `chrome://extensions` -> enable Developer mode -> "Load unpacked" -> select this folder.
**Firefox:** `about:debugging#/runtime/this-firefox` -> "Load Temporary Add-on" -> select `manifest.json`.
(Firefox temporary add-ons are removed on browser restart; for permanent use it needs signing via AMO.)

## First run
1. Click the extension icon.
2. Set a master password. This derives an AES-256-GCM key (PBKDF2, 250k
   iterations) that encrypts everything before it touches disk.
3. Password is cached in `chrome.storage.session` (memory-only, cleared when
   the browser closes) so you're not retyping it on every popup open within
   a session. Click the lock icon to lock manually.

## Adding an account

**Auto-scan (primary path)**
- Click **+ Add new**.
- The extension screenshots the currently visible tab and runs `jsQR`
  (vendored, no network calls) over it.
- If a QR is found: parses it, shows a confirm screen, saves on confirm.

**Select region (fallback)**
- If auto-scan finds nothing (QR below the fold, too small, low contrast),
  click **Select region on page…**.
- Draws a full-page overlay; drag a box around the QR code.
- The popup closes during this (browser popups close on focus loss — that's
  a platform limitation, not a bug). Screenshot + crop + decode happens in
  the background script; you get a notification, then reopen the extension
  to confirm and save.

**Manual entry**
- Click **Manual entry** for the "type in the secret key by hand" case
  (what a site's "can't scan? enter manually" option gives you).

## What it handles
- Google Authenticator's bulk export format (`otpauth-migration://...`,
  protobuf-based — decoded here with a small hand-rolled parser, no
  `protobuf` dependency)
- Standard single-account `otpauth://totp/...` and `otpauth://hotp/...` URIs
  (what most sites' individual QR codes actually encode)
- Manually typed base32 secrets

## Storage & security model
- `chrome.storage.local` holds only: a random salt, an encrypted verifier
  blob, and the encrypted account vault (AES-GCM ciphertext). No plaintext
  secrets ever get written to disk.
- The derived key is cached in `chrome.storage.session` for the session
  only — not synced, not persisted across browser restarts.
- Forgetting your master password means the vault is unrecoverable by
  design — there's no backdoor, no password reset.
- This is a personal-use scaffold, not an audited security product. If you
  want this for anything beyond your own low-stakes accounts, get someone
  to review the crypto before relying on it.

## Known limitations
- Can't capture QR codes displayed outside the browser (another app, a
  phone screen, a printed page) — would require `getDisplayMedia()` screen
  share with a persistent OS-level sharing indicator on every scan, which
  is bad UX for something you'll do repeatedly. Out of scope per your call.
- No export/backup flow yet — if you clear extension storage, the vault is
  gone. Worth adding before relying on this daily.
- Icons are placeholder art, swap `icons/*.png` for real ones whenever.

## File map
- `manifest.json` — MV3 manifest
- `background.js` — service worker: tab capture, crop, jsQR decode, messaging
- `content/overlay.js` + `overlay.css` — the region-selection overlay
- `popup/` — the extension's UI (setup / unlock / list / add flows)
- `src/protolite.js` — protobuf wire-format reader (no deps)
- `src/migrate.js` — otpauth-migration & otpauth URI parsing
- `src/otp.js` — TOTP/HOTP via WebCrypto HMAC (tested against RFC 4226 vectors)
- `src/crypto.js` — PBKDF2 + AES-GCM vault encryption
- `src/storage.js` — vault read/write/lock/unlock logic
- `lib/jsQR.esm.js` — vendored jsQR (npm jsqr@1.4.0), wrapped for ESM import
