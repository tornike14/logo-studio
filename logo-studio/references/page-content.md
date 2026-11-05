# Page content

The page has a fixed structure and design. You write `content.json`, and `build-page.mjs` makes the page. Do not edit the template or the built HTML. The content file holds words and file paths only, never embedded images. Paths are relative to `content.json`.

## How to write it

Write for a busy founder, in plain short sentences. Answer first, and let the evidence follow. Be specific: name the competitors, give the numbers, describe the shapes. Every line should be true only of this brand, so a sentence that could sit on another brand's page should be rewritten.

Do not use "only", "first", "best" or "unique" without the sample: "in these 40 logos" is honest, and "in the category" is a claim you cannot prove. Say what you could not check. In text, `**bold**`, `*italic*` and backticks for code work, `{count}` becomes the number of competitors shown, and `[#5B7CFA]` draws a colour chip. Nothing else is formatted.

Any image that would vanish in dark mode needs a partner: `assetDark` in `sizes`, `appearances`, and `system`, and `oursDark` in the browser scene. Otherwise, the art must carry its own background.

## Shape of the file

```json
{
  "schema": 1,
  "brand": { "name": "Name", "surface": "app|website|both|local|print", "shape": "icon|wide", "hasCurrentLogo": true },
  "page": { "title": "Name Mark", "lang": "en" },
  "theme": {
    "ground": "#F6F1EA", "surface": "#FFFFFF", "ink": "#20222B", "inkSoft": "#6B6873",
    "hair": "#E4DDD2", "accent": "#3657E0", "warm": "#FF8A7A", "wash": "#ECEFFE",
    "dark": { "ground": "#141310", "surface": "#1F1D19", "ink": "#F2EEE8", "inkSoft": "#A39E96",
              "hair": "#2E2B26", "accent": "#8EA5FF", "warm": "#FF9A8B", "wash": "#222A47" }
  },
  "assets": { "mark": { "path": "art/mark.svg", "evidence": "rendered" } },
  "sources": [{ "id": "apple", "label": "Apple Search API, fetched 2026-11-05", "url": "https://..." }],
  "sections": []
}
```

- `shape`: `icon` for a square mark, `wide` for a wordmark. Wide art is shown without rounded corners.
- `evidence`: `rendered` for art you made, `fetched` for downloaded images, `user-supplied`, or `approximated` for a preview of how a system would show it. Label approximations in the caption too.
- `theme` comes from the brand's colours. Keep the ground quiet, so the logos stand out. The check tests the contrast of both themes.
- `theme.font` is `rounded`, `sans` or `serif` for the page headings. Pick what suits the brand.
- If the icon's ground is close to `surface` in either theme, its tile vanishes on the page, so choose a surface that sets it apart.
- `theme.plate` (light and dark) is the background behind competitor logos. The default mid grey keeps black and white logos visible.

## Sections

All thirteen appear in `sections`, in any order. The page always shows them in the order below and numbers them itself. A section you cannot fill honestly keeps its `id` and gets an `omitReason`, such as `{ "id": "motion", "omitReason": "A static sign does not move" }`. `hero`, `field`, `gap`, `idea`, `sizes`, `next` and `sources` cannot be omitted. All numbered sections accept `label`, `title` and `intro`, which can be one string or a list of paragraphs.

### hero
`mark`, `markDark`, `alt`, `eyebrow`, `title`, `lede`, `verdict` (a list). The title is the idea in one line, and it should move someone. The verdict is the whole recommendation in two to four points: what to retire, what to avoid, what to use.

### field
`index` (path to `field/index.json`), optional `thin`, and `groups`. Each group has `title`, `note` and `items`. An item is a competitor's exact `name` from the index, or `{ "name": "...", "label": "Short" }`. To place the current logo among them, use `{ "asset": "current", "label": "Name today", "ours": true }`. Name the groups by what the logos draw, and make each note say what that choice costs. A group with `"control": true` is shown as a comparison group and left out of `{count}`, such as banks for a brand that must not look like a bank.

### gap
`title`, `findings`, `closest`, optional `pair`.
- `findings`: two to four of `{ "title", "text", "sources": ["id"] }` or `{ "title", "text", "opinion": true }`. Opinions show as "Our read".
- `closest`: required, one to three of `{ "name": "...", "why": "..." }`, naming the nearest look-alikes and how the proposal differs. For a brand outside the field, use `{ "asset": "...", "label": "...", "why": "..." }`.
- `pair`: `{ "items": [{ "asset" or "name", "label" }, ...], "text" }`. Use the current logo beside the competitor it clashes with. With no current logo, show the closest look-alike beside the proposal.

### idea
`title`, `paragraphs`, optional `quote`, and `principles` (at least three of `{ "title", "text" }`). Each principle must come from a fact in the brief, not general design advice.

### construction
`title`, `drawing` (asset), `alt`, `rows` of `{ "label", "value" }`. The drawing shows at about 45% of the page width, so make labels large, around 28 units on a 1200 wide drawing. Draw label text as paths using a small script that imports `lib/text.mjs`, because SVG text will not render. For a symbol: canvas, proportions, rule, optical corrections, colours. For a wordmark: font, licence, spacing, x-height, altered letters.

### sizes
`title`, `intro`, `asset`, `assetDark`, `sizes` (pixel widths, 360 at most). `extras` adds tiles such as a favicon: `[{ "asset", "size": 32, "label": "Favicon" }]`. Show what this brand needs: app icon sizes, favicon sizes, or print widths. Only claim what you have looked at.

### appearances
`title`, `intro`, `items` of `{ "asset", "title", "note" }`. Light, dark and one-colour always. Reversed for print and websites. Tinted for apps, labelled as approximated unless rendered by Apple's tools.

### context
`title`, `scenes`. Each scene has `type`, `ours`, `title`, `caption`, `others` (names from the index). Types: `phone` (`others` holds 15, `position` is optional), `browser` (`others` holds 3, `favicon` is optional), `avatars` (`others` holds 4), `sign` (`others` empty). Pick what fits. An app shows two phones when there is a current logo: today and proposed. A website shows the browser. A shop shows the sign.

### system
`title`, `intro`, `items` like appearances. Only for something real: lockups, sub-marks, or colour variations the product can use.

### motion
`title`, `text`, `svg` (asset, an SVG file), `preset`, `stage` (background colour), `button`. For an app, the best motion links the icon to the first screen.
- `reveal`: works with any SVG.
- `handoff`: needs `class="out"` on shapes that leave, `class="hero-layer"` on the one that stays, and `heroTo: { "x", "y", "scale" }`.
- `draw`: traces any stroke with `class="draw"` and `pathLength="1"`.
- `custom`: the SVG holds its own `<style>`, using `.stage.go` for the played state.
Check the played state with `shot.mjs --go`, which jumps to the end of the motion. Keep motion art's coordinates in the path data, not in `transform` attributes, so CSS motion does not shift them.

### alternatives
`title`, `items` of `{ "asset", "title", "note" }`. At least two real concepts from your rounds, each with the honest reason it lost. Never make one up after the fact.

### next
`todo` and `unverified`, both lists. Always include a trademark search in `todo`.

### sources
`notes`, a list of plain lines. Links are added automatically from the top-level `sources`.
