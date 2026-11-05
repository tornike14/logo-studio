# Mac notes

Nothing extra is needed beyond Node. Install it with `brew install node` or the installer from nodejs.org.

With Xcode 26 installed, this Mac gets a bonus: `verify-ios.mjs` checks the `AppIcon.icon` with Apple's own tools and renders the six iOS appearances (default, dark, two tinted, two clear). In gate 6, run `export-pack.mjs pack.json --ios-preview`, which writes only `AppIcon.icon`, then `verify-ios.mjs`, and use the renders on the page with evidence `rendered`, in place of approximations. Open each one and check that the most important part stays visible in the tinted and clear versions.

Screenshots use Chrome, Edge, Brave or Chromium, whichever is installed.
