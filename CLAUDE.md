# Calibre — project rules (read before changing anything)

Calibre is a gun-sound simulator and field manual by ARTIN Studios. It's a static web app (Netlify: `index.html`, `css/`, `js/`) plus a native Android wrapper in `android/` that bundles the same files.

## Version control & documentation — mandatory for every change
1. **Record every change in `CHANGELOG.md`.** Put it under `## [Unreleased]`, or under a new version section when releasing, using *Added / Changed / Fixed / Removed* headings. No change is too small.
2. **Keep `version.json` in step.** Bump `version` (semver) and `versionCode` (+1, must always increase) for every release or new Android build. The version string must have a matching `## [x.y.z]` heading in the CHANGELOG.
3. **Run `scripts/check-changelog.sh` before committing.** It must print ✓.
4. **Tag every release** `vX.Y.Z`. The *Tag releases* workflow does this on push. After a release, add its commit short hash to its CHANGELOG heading (`· \`abc1234\``) so the tag and `scripts/rollback.sh` can always find it.
5. **Never rewrite history** (no force-push, rebase or amend on pushed commits). Undo with `git revert` or `scripts/rollback.sh <tag>`, then record that in the CHANGELOG.
6. Update `README.md` / `docs/` when behaviour, structure or setup changes.
7. **Never commit secrets.** That includes `*.jks`, `android/keystore.properties`, real passwords and personal emails. Ad and product IDs are not secret.
8. See `docs/RELEASING.md` for the release and rollback procedure.

## Working on the code
- Run the web app: `npx http-server -p 8080 -s -c-1 .` → http://localhost:8080. Add `?storetest` to simulate the Android store and ads.
- Weapons: `js/data.js` (core + India) and `js/data-world.js` (world). Rendering: `js/render.js`. Audio: `js/audio.js`. Haptics, torch and particles: `js/fx.js`. Scenes: `js/scenes.js`. Store: `js/store.js`. App and UI: `js/app.js`.
- Art preview of every weapon: `dev/gallery.html`. Store graphics generator: `dev/store.html`.
- Android: `cd android && ./gradlew lintRelease bundleRelease assembleRelease` (needs `local.properties` sdk.dir and `keystore.properties` for signing). Lint must report 0 errors.
- Bump the `CACHE` name in `sw.js` when shipped web files change, so the PWA updates.
- Test visually in landscape phone size (844×390), portrait (390×844) and desktop before committing.
