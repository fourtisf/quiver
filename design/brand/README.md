# Hoodpool brand assets

| File | Use |
|---|---|
| `hoodpool-avatar-1024.png` | X/Twitter profile photo (with wordmark) |
| `hoodpool-avatar-mark-1024.png` | Profile photo, mark only — cleaner at small sizes |
| `hoodpool-banner-x-1500x500.png` | X header banner (exact X size) |
| `hoodpool-banner-x-3000x1000.png` | Same banner @2x, sharper after X compression |

Sources: `avatar.html`, `banner-x.html` — rendered headless at exact pixel
sizes. Their `@font-face` paths point at local `@fontsource/*` npm files
(bricolage-grotesque 800, albert-sans 400/600, ibm-plex-mono 500); install
those and fix the paths, or swap the `@font-face` block for the Google Fonts
`<link>` used by `site/index.html`, then screenshot at 512×512 (DPR 2) and
1500×500 (DPR 1/2).

## v2 — premium set (2026-07-22)

| File | Use |
|---|---|
| `hoodpool-banner-x-premium-3000x1000.png` | X header, premium (hero coin + ETH/USDG satellites, Hoodpool-only copy) — upload this |
| `hoodpool-banner-x-premium-1500x500.png` | Same at exact X size |
| `hoodpool-og-1200x630.png` | og:image / twitter:card for hoodpool.fun (wired in site/index.html) |
| `hoodpool-token-512.png` | $HPL token icon, transparent PNG — for explorers/token lists when the token exists |

All also served from the website at `hoodpool.fun/brand/…` (site/brand/).
Note: $HPL does not exist yet (out of scope v1) — the coin renders the brand
mark without a ticker on purpose, so the banner doesn't promise a token.
