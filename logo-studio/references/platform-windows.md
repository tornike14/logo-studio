# Windows notes

Everything works here, in PowerShell or Git Bash. Keep to these habits:

- Run one command per tool call. Windows PowerShell 5.1 has no `&&`.
- Quote every path. Keep non-English text in JSON files, since the console can garble it.
- If Node was just installed and `node` is not found, call `"C:\Program Files\nodejs\node.exe"` until a new terminal is opened.
- Do not write text files with PowerShell's `>`, which produces UTF-16. Use the file writing tool.
- Screenshots use Edge, which comes with Windows, or Chrome. If neither exists, the page cannot be checked, so say so. Set `LOGO_STUDIO_BROWSER` to a browser's path if it is installed somewhere unusual.
- A company proxy can cause certificate errors such as `SELF_SIGNED_CERT_IN_CHAIN`. Node 22.15 or newer can trust Windows certificates: set `NODE_OPTIONS=--use-system-ca`. Otherwise, ask the user for logo images and use `files` in the plan.

Xcode does not exist here, so Apple's tools cannot check `AppIcon.icon`. The file is built the same way as on a Mac, but it is unverified, and the page and the final report must say so. The opaque PNGs in `app/ios/` are the safe choice. iOS appearance images on the page are approximations with evidence `approximated`, and the page labels them. Everything else is identical to a Mac.
