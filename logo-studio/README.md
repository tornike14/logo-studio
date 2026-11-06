# Logo Studio

A Claude Code skill that researches real competitor logos, designs an original logo, presents it on one page, and exports the files for iOS, Android and the web.

## Install

You need Node 18 or newer. If you don't have it, the skill shows you how to get it.

**Mac or Linux.** In the folder holding `logo-studio.zip`, run these two commands:

```bash
mkdir -p ~/.claude/skills
```

```bash
unzip logo-studio.zip -d ~/.claude/skills
```

**Windows.** In PowerShell, in the folder holding `logo-studio.zip`, run these two commands:

```powershell
New-Item -ItemType Directory -Force "$env:USERPROFILE\.claude\skills"
```

```powershell
tar -xf logo-studio.zip -C "$env:USERPROFILE\.claude\skills"
```

Avoid Windows' "Extract All" menu, because it adds an extra folder level and Claude Code will not find the skill.

You should end up with `.claude/skills/logo-studio/SKILL.md`. Restart Claude Code.

## Use

Type `/logo-studio` with what you're making:

```
/logo-studio a dog walking app called PawPath
```

Or ask for a logo in your own words. It reads your project first, then asks only what it can't find.

## What you get

1. A page showing the competitors, the gap, the idea, construction, sizes, colours and the logo in context.
2. After you approve: a `logo-pack` folder with source files, app icons and the website favicon set.

## What leaves your computer

There is no telemetry and no account. A run does reach these services:

- **Web search.** Claude searches for your brand name and your category. If the name is unannounced, say so before you start.
- **Apple's Search API.** It sends app names and category terms.
- **Google Play.** It opens the public page of each app listed by package name.
- **Competitor websites.** It reads each site's `robots.txt`, home page and logo images. Requests identify themselves as `logo-studio`, and a site that refuses them is listed as not collected.
- **Google Fonts and GitHub.** It downloads a font when a wordmark uses one.

## Good to know

- Windows and Mac get the same logo, page and files. On a Mac with Xcode 26, Apple's tools also check the iOS 26 icon. Elsewhere that one file stays unchecked, and plain PNG icons are included as the safe choice.
- Uniqueness is checked only against the competitors found. Run a trademark search before you commit to a logo.
- Real competitor logos appear on the page as research. Keep it private, or remove them before publishing it.

## Licences

Logo Studio is MIT licensed: see `LICENSE`. `vendor/` holds resvg (MPL-2.0), opentype.js (MIT), tiny-inflate (MIT) and Poppins (SIL Open Font License). They keep their own licences, listed with their versions and sources in `vendor/THIRD-PARTY.md`.
