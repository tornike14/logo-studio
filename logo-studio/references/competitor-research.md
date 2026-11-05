# Competitor research

## Finding the competitors

1. Take any the user named, and look in the project's docs. Also search the brand's own name: other apps or companies using it are a major finding.
2. Use web search: the category, "alternatives to X", "best X apps", and local searches for a local business. Include adjacent brands that a customer would compare, not only direct rivals. For an AI product, include the main assistants, since people line those up too.
3. For an app, also use broad App Store terms with a `limit`, which finds apps you did not know about.

Minimum logos shown on the page: app 20, website 12, both 24, local business or print 8. Aim above the minimum, since a busy category often reaches 40 or more. If a category is truly thin, explain why in the field section's `thin` text. The check then accepts half the minimum.

## plan.json

```json
{
  "country": "us",
  "apps": ["Exact App Name", { "term": "broad category term", "limit": 10 }],
  "play": ["com.example.app", { "term": "broad category term", "limit": 5 }],
  "sites": ["example.com"],
  "images": [{ "name": "Local Rival", "url": "https://direct/link/to/logo.png", "replaces": "site:rival.com" }],
  "files": [{ "name": "Saved Rival", "path": "rival.png", "url": "https://where-it-came-from" }],
  "exclude": ["Wrong App"],
  "rename": { "Long Store Title For The App": "Brand" }
}
```

`country` is a two-letter store code. Use the brand's market. An app entry can also be `{ "id": 571800810 }` when web search gives you its App Store number, which avoids wrong matches.

- `images` fetches a direct link to a logo. `files` adds an image on disk. `replaces` clears the failed job it stands in for.
- `exclude` and `rename` apply on every run, so a removed logo cannot come back. Use these rather than editing `index.json`. To swap an image for an alternate, edit `file` in `index.json`.

## Running it

Run `competitors.mjs logo-work/plan.json --out logo-work/field` and repeat the identical command until `remaining` is 0. Each run works for about 90 seconds, then stops safely, and finished work is cached. Apple allows about 20 searches a minute, so the tool spaces them out. Use `--retry-failed` for a second attempt at failures.

Everything is recorded in `logo-work/field/index.json`, with each logo's source, date and quality. Each item may have `alternates`, which are other images found on the same site.

## Judging what came back

Run `sheets.mjs field --index logo-work/field/index.json --out logo-work/field.png` and open it. Automated grading can be fooled, so check each tile:

- Is it the company's logo, or an interface icon, a product photo or someone else's mark?
- `checkTheseMatches` lists searches that may have returned a different app. `siteTitles` shows what each site calls itself, which reveals a guessed address belonging to another company. `sameBrandTwice` lists brands found through more than one source. Keep the best one and exclude the rest.
- A WebP image shows as text on the sheet, though the page displays it.
- A red dot means a small image. Try the `alternates`. If those fail, screenshot the live site with `shot.mjs https://example.com --out header.png --width 1280 --height 240`, cut out the logo with `sheets.mjs crop`, add it through `files`, or ask the user.
- `note` says when a site blocked reading. That logo must be checked by hand.
- Fix a wrong entry by editing `index.json`: change `file` to an alternate, or delete the item.

Small local businesses often have no website with a logo. Try their delivery listing, or a Facebook page through `https://graph.facebook.com/PAGE-NAME/picture?type=large` in `images`. Some sites block every automated reader. Accept that, and list them on the page as not collected.

Google Play reads public pages and may break if Google changes them. If it fails, continue with the other sources and say so. Behind a company proxy, sites may fail with certificate errors: see the platform notes, or ask the user for images.

## Using the logos fairly

Real logos on the page are there as research evidence. The page is private by default. Before anyone publishes it widely, suggest replacing the competitor logos or getting advice. Never reuse a competitor's shape.
