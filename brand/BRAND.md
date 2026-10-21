# Podsta brand kit

**Concept: "a pod full of photos."** The mark is a cream pea pod, tilted and bouncy, on a sunset-gradient tile. Two mint peas sit beside a camera lens, so it reads as a pod (your Solid Pod) and a camera (photos) at a glance. The tone is warm, rounded and friendly, and the type leads with lowercase.

## Palette
| Name | Hex | Role | Contrast |
|---|---|---|---|
| Plum | `#2B1B3D` | Text, wordmark, outlines | 14.9:1 on Cream (AAA) |
| Cream | `#FFF7EE` | Page background, light wordmark | — |
| Coral | `#FF6B57` | Primary brand color, buttons with **Plum** text | Plum on Coral 5.7:1 (AA). White on Coral is only 2.8:1, so avoid it for text |
| Berry | `#E8457A` | Accents, taglines, likes | 3.6:1 on Cream, so use it only for large or bold text (≥24px, or 19px bold) |
| Sunshine | `#FFC547` | Highlights, lens, badges | Plum on Sunshine 10.1:1 |
| Mint | `#3DD9A8` | Peas, success, "add" | Plum on Mint 8.8:1 |
| Icon gradient | `#FF8A4C → #FF6B57 → #E8457A` | App icon tile only | — |

## Type (open-licensed, Google Fonts, SIL OFL)
- **Fredoka** SemiBold 600 for the wordmark and headings. Headings may use 500–600.
- **Nunito** Regular 400 for body text, ExtraBold 800 for UI labels and taglines.
- The wordmark SVGs have their letters converted to paths, so they need no font. The `fonts/` folder holds the variable TTFs used to build them.

## Usage
- **Clear space:** keep at least ¼ of the mark's height clear on every side of the mark or wordmark. In the lockup, the gap between mark and type is about 12% of the mark's height. Keep it as built.
- **Minimum size:** mark 16px (favicon), wordmark 96px wide.
- **Backgrounds:** use `podsta-wordmark.svg` (Plum type) on Cream or light photos. Use `podsta-wordmark-light.svg` (Cream type) on Plum or dark photos.
- **Don'ts:** don't recolor the pod, stretch it, add shadows, or put the gradient tile on another busy gradient.

## Files
- `podsta-mark.svg`: mark on its tile.
- `podsta-mark-transparent.svg`: pod only, no tile.
- `podsta-wordmark.svg` / `-light.svg` and `.png`: mark plus type lockup.
- `podsta-wordtype.svg` / `-light.svg`: type only.
- `icon-512.png`, `icon-192.png`: rounded tile with transparent corners.
- `maskable-512.png`: full-bleed, opaque; the art fits inside the central 80% circle.
- `apple-touch-icon-180.png`: opaque, full-bleed; iOS rounds the corners.
- `favicon.svg`, `favicon.ico` (16/32/48), `favicon-32.png`.
- `podsta-share-1200x630.png` (opaque) and its source `podsta-share.html`.
- `illustrations/{first-post,no-followers,whats-a-pod,welcome}.svg` and `.png` (1200×900, transparent).
- `brand-sheet.png`: preview of the whole kit.
- `src/`: build scripts (`build_svgs.py`, `render.sh`, `brand-sheet.html`).

## manifest.json
```json
"icons": [
  { "src": "/icon-192.png", "sizes": "192x192", "type": "image/png", "purpose": "any" },
  { "src": "/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any" },
  { "src": "/maskable-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
],
"theme_color": "#FF6B57",
"background_color": "#FFF7EE"
```

## `<head>`
```html
<link rel="icon" href="/favicon.ico" sizes="48x48">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="/apple-touch-icon-180.png">
<link rel="manifest" href="/manifest.json">
<meta name="theme-color" content="#FF6B57">
<meta property="og:image" content="https://teebooted.github.io/Podsta/podsta-share-1200x630.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
```
