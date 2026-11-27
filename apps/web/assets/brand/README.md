# Brand assets

`logo-loader-master.png` is the source artwork as supplied (2172 × 724, transparent).
It lives outside `public/` on purpose: it must not be deployed or downloaded.

Derived, served files live in `public/brand/`:

| File | Size | Use |
|---|---|---|
| `logo-loader.webp` | 1080 × 360, ~75 KB | `BrandLoader` (splash, app bootstrap) |

Regenerate with `sharp` from the repo root:

```js
sharp("apps/web/assets/brand/logo-loader-master.png")
  .resize({ width: 1080 })
  .webp({ quality: 82, effort: 6, alphaQuality: 90 })
  .toFile("apps/web/public/brand/logo-loader.webp");
```

`next/image` re-encodes this source per request (AVIF/WebP, ~15 KB at 640 px),
so the WebP is the canonical asset rather than a per-device set.

The logo reads **1kDaily** with the current tagline, **Save Daily, Build Capacity**.
Do not reuse the retired tagline.
