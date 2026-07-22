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
