# Production specs

## pack.json

Paths are relative to `pack.json`. SVGs should be square, 1024 by 1024 viewBox, except wordmarks.

```json
{
  "brand": "Name",
  "shortName": "Name",
  "out": "logo-pack",
  "surfaces": ["app", "website"],
  "figure": "figure.svg",
  "figureDark": "figure-dark.svg",
  "figureMono": "figure-mono.svg",
  "wordmark": "wordmark.svg",
  "wordmarkDark": "wordmark-dark.svg",
  "faviconSvg": "favicon.svg",
  "ground": "#F6F1EA",
  "groundDark": "#141310",
  "androidScale": 0.92,
  "iosLayers": [
    { "name": "base", "svg": "layers/base.svg", "glass": false, "fill": "#5B7CFA", "fillDark": "#2B3B86", "fillTinted": "#3A3A3C" },
    { "name": "accent", "svg": "layers/accent.svg", "glass": true, "front": true, "fillTinted": "#FFFFFF" }
  ]
}
```

Required: `brand`, `figure`, `ground`. Everything else improves the result.

- `figure` is the mark on a transparent background, sized to fill its square as it should sit on the icon.
- `figureMono` is white art. Opacity can separate its parts. Without it, a flat silhouette is used.
- `faviconSvg` is a simplified mark for 16 px, when the full mark is too detailed.
- `iosLayers` splits the mark for Liquid Glass, back to front. `front: true` puts a layer in its own group, so it catches light separately. Each layer is a full 1024 by 1024 SVG holding one part. Without layers, the figure is one layer.
- `fillTinted` matters: tinted and clear icons are made from brightness, so the most important part must be the brightest. Check this in the renders.

A wide logo with no icon still needs a square `figure`, such as an initial or a symbol taken from the wordmark, for favicons and avatars.

Text in a logo must be outlined. Run `wordmark.mjs --text "Name" --font google:poppins/Poppins-SemiBold.ttf --out wordmark.svg --color "#111111"`. Fonts from Google Fonts' `ofl` folder are free for logos under the Open Font License. For a paid or custom font, pass a local file only if the user holds the licence.

Arabic, Hebrew, Devanagari and other connected scripts need shaping that this tool does not do. Look at the result closely, and tell the user if it is wrong.

## What gets made

- `source/`: mark, dark mark, figure, wordmark, horizontal and stacked lockups.
- `app/ios/`: opaque 1024 PNGs (light, dark, tinted) and `AppIcon.icon` for iOS 26.
- `app/android/`: adaptive foreground, background and monochrome layers. The figure is scaled to stay in the 66% safe circle.
- `web/`: `favicon.ico` (16, 32, 48), `favicon.svg`, `apple-touch-icon.png` (180), `icon-192.png`, `icon-512.png`, `icon-512-maskable.png`, `og-image.png` (1200 by 630), `site.webmanifest`, `head-snippet.html`.

## Using the files

- **Expo:** in `app.json`, `ios.icon` takes `./path/AppIcon.icon` or `{ "light", "dark", "tinted" }` PNG paths. The PNGs are the safe option when the `.icon` has not been checked.
- **Native iOS:** add `AppIcon.icon` to the Xcode project, or the PNGs to the asset catalog.
- **Android:** use the three layers as an adaptive icon.
- **Web:** put `web/` files at the site root and paste `head-snippet.html` into the page head.

App Store icons must be opaque and square, and the store applies the corners itself. `export-pack.mjs` already handles this.
