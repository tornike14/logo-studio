---
name: logo-studio
description: Designs an original logo for an app, website, product or business, backed by research into the real logos of its competitors. It delivers one page showing the competitor field, the gap, the idea, construction, sizes, colours, appearances and the logo in context, then a full file pack for iOS, Android and the web once approved. Use this whenever someone wants a logo, app icon, brand mark, favicon set or a redesign of an existing logo, even if they only say "make my icon better", "I need branding for this", "what should our logo look like" or name a product and ask for a mark. Works on Windows, Mac and Linux.
compatibility: Requires Node 18 or newer. No other installs. Works on Windows, macOS and Linux.
metadata:
  version: "1.0.0"
---

# Logo Studio

You are designing a logo the way a great industrial designer designs an object: start from what the person does, reduce to one idea, and care about the smallest detail. The result is one page that shows the evidence and the thinking, followed by files that are ready to ship.

## Rules that hold for the whole run

- **Eight gates, in order.** Never skip one, and never show a logo before gate 7. After each gate, update `logo-work/state.json`. If context was lost, read that file and continue from the recorded gate.
- **Real competitors only.** Look at their actual logos with the bundled tools. Never describe a competitor's logo from memory.
- **Draw with parametric scripts.** Write a small script that generates each SVG from numbers. Never type complex path data by hand. Wordmarks come from `wordmark.mjs`.
- **Look at everything.** After every render, open the PNG and judge it. Numbers passing does not mean the picture is right. A check that says "good" has been wrong before.
- **Never copy.** Competitor logos are evidence for avoiding look-alikes, and no shape is borrowed from them.
- **Claim only what was checked.** Never write "only", "first" or "unique" without saying the sample. Evidence and opinion stay visibly separate. Show the closest look-alikes. Uniqueness is never promised, and a trademark search is always recommended.
- **Stop at the page.** Export files only after the user approves a direction. Never replace a project's files without asking.
- **One command per tool call.** Do not chain commands with `&&`. Put non-English text in files, not in command arguments. Quote every path.

Run scripts like this: `node "${CLAUDE_SKILL_DIR}/scripts/doctor.mjs"`. Every script lives in that folder. Long or non-English input goes in a JSON file.

## Gate 0: Computer check

1. Run `node -v` as a plain command. If it fails, Node is missing, so tell the user and offer to install it. Windows: `winget install OpenJS.NodeJS.LTS`. Mac: `brew install node`, or the installer from nodejs.org. After installing, a new terminal may be needed. On Windows, call `"C:\Program Files\nodejs\node.exe"` directly if `node` is still not found. Version 18 or newer is required.
2. Run `doctor.mjs` and read the file it names in `platformNotes`. It gives the differences for this computer.
3. Create `logo-work/` in the current project and `logo-work/state.json` with `{ "brand": "", "gate": 1, "rounds": [] }`.

## Gate 1: Brief

Great logos come from specific facts, so gather them before anything else. First read what already exists: the README, product docs, the design tokens, the current logo, the website. In a code project, this usually answers most questions.

You need: what it is; who it is for; **the moment or action at the heart of it** (what the person actually does); where the logo will live (app, website, or both by default; print or storefront if relevant); assets the brand already owns (colours, characters, shapes, a current logo, the meaning of the name); competitors they already know; anything they refuse.

Ask at most three questions, and only what you cannot find. If the brief is one thin line and nothing else exists, you must ask: thin context produces generic logos. Save the facts in `state.json` under `brief`.

## Gate 2: The field

Read `references/competitor-research.md`, then build `logo-work/plan.json`, run `competitors.mjs`, and repeat the same command until it reports `remaining: 0`. Run `sheets.mjs field`, then open the image and look.

Remove wrong picks, such as an interface icon, or a logo from a different company. A red dot means a weak image: use an alternate, or a screenshot, or keep it and say so. Aim for the minimum in that guide. If the category is thin, say so on the page instead of padding it.

## Gate 3: Analysis

Sort the logos by **what each one draws**, into three to seven groups named in plain words. Then answer in writing: what does everyone do, what does that cost them, what does nobody draw, and which three logos sit closest to where we might land? Check the user's current logo against the field: a clash with a competitor is often the most valuable finding.

Mark each finding as sourced or as opinion. Before saying nobody does something, look through the whole sheet for counterexamples.

## Gate 4: The idea

Read `references/design-principles.md`. Start from what the person does, not from what the category looks like. Write at least three different ideas as one sentence each, before drawing anything. Each must rest on a fact from the brief, and each must avoid the crowded groups from gate 3. Save them in `state.json`. A style is not an idea.

## Gate 5: Drawing, in rounds

Draw at least five concepts from at least three ideas, each from a parametric script, as 1024 by 1024 SVGs. Run `sheets.mjs sizes` for all of them and look at the board.

Read `references/critique-checklist.md` and do at least three rounds. Each round names what is wrong and changes it. Your first version is never the answer: expect to find a knot, a muddy effect, or a mark that dies at small size. Log every round in `state.json` under `rounds`: what was tried, what was wrong, what changed. Rejected concepts stay on disk, because the page shows them.

Prefer flat, precise art. Effects that blur at small size are usually hiding a weak shape.

## Gate 6: Finished art

For the chosen mark, produce: light, dark and single-colour versions; a transparent figure; a wordmark if the name is part of the logo; a construction drawing with real measurements; the system if the brand truly has one, such as sub-marks, lockups or colour variations; a motion idea if it adds something. Also pick page colours from the brand.

## Gate 7: The page

Read `references/page-content.md` and write `logo-work/content.json`. The page structure is fixed, and you only supply content. Then run:

1. `build-page.mjs logo-work/content.json --out logo-work/page.html`
2. `check-page.mjs logo-work/content.json --page logo-work/page.html`, and fix every problem it lists.
3. `shot.mjs` at `--width 1280` and `--width 400`, each with `--scheme light` and `--scheme dark`, using `--height 2600`, then open the images and look. If no browser exists, say the page could not be checked.

Publish `logo-work/page.artifact.html` with the Artifact tool if this session has one. Either way, give the user the local `page.html` path. Then stop. Recommend one direction, say what was not verified, and ask for approval.

## Gate 8: Export, only after approval

Read `references/production-specs.md`, write `logo-work/pack.json`, and run `export-pack.mjs`. Open the main results and look at them. On a Mac with Xcode, run `verify-ios.mjs`. If the project uses these files, ask before replacing anything. Report what was made, and what remains unverified.
