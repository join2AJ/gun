# Changelog

Every change to Calibre is recorded here, newest first. Versions follow
[Semantic Versioning](https://semver.org): **MAJOR** for big or breaking changes, **MINOR** for new
features, **PATCH** for fixes and small tweaks. Each released version has a git tag `vX.Y.Z` that you can
roll back to (see [docs/RELEASING.md](docs/RELEASING.md)).

`Play build` is the Android `versionCode`. It must increase with every Google Play upload.

## [Unreleased]
### Fixed
- GitHub "Android build" workflow: it had failed on every run because the `android-actions/setup-android` step crashes on current runners. It now uses the runner's preinstalled Android SDK.
- The "Tag releases" workflow pushes tags one at a time and warns instead of failing. GitHub won't let its bot create tags on commits with older workflow files (`v1.0.0` and `v1.1.0`), but those versions remain restorable through their CHANGELOG commit hashes.
### Changed
- Privacy policy and store listing now use the studio contact email artinstudios.official@gmail.com instead of a placeholder.
- Service-worker cache bumped to `calibre-v9`.
- GitHub workflows updated to `actions/checkout@v5`, `setup-java@v5` and `upload-artifact@v5`, replacing the deprecated Node 20 versions.

## [1.1.1] — 2026-10-02 · Play build 3
### Added
- Version control and documentation system:
  - `CHANGELOG.md` (this file), with every past change recorded.
  - `version.json` as the single source of the version number, used by the Android build and shown in Settings.
  - Git tags on every release.
  - `docs/RELEASING.md` with release and rollback guides.
  - `scripts/rollback.sh`.
  - `CLAUDE.md` with the rules for future sessions.
  - A GitHub check that fails when code changes without a CHANGELOG entry.
  - `scripts/tag-releases.sh` and a "Tag releases" GitHub workflow that create the restore-point tags `vX.Y.Z` automatically from this file after each push.
- The version number is shown in Settings ("Calibre v1.1.1 · build 3").

## [1.1.0] — 2026-10-02 · Play build 2 · `c4dea63`
### Added
- Monetization in the Android app:
  - Google UMP consent, then an AdMob adaptive banner (weapon list only) and rewarded videos.
  - Google Play Billing one-time products `remove_ads` (₹99), `full_arsenal` (₹149) and `pro_bundle` (₹199), with restore.
- 25 free weapons and 3 free environments. Premium items can be unlocked for 24 h by watching a video. Field manuals are always free.
- Premium badges, a lock panel on the range, an unlock dialog and a Store screen with restore and ad privacy choices.
- `?storetest` URL flag to try the store in a browser with a simulated backend.
- `app-ads.txt` template. Privacy policy and Data safety notes updated for ads and purchases.
### Fixed
- Long weapon titles and the HUD no longer overlap beside the field manual on mid-width screens.

## [1.0.0] — 2026-10-02 · Play build 1 · `06602bb`
### Added
- Native Android app (`com.artinstudios.calibre`, min SDK 26, target SDK 36). The game is bundled offline.
- `CalibreNative` bridge:
  - amplitude-controlled vibration from each gun's sound envelope;
  - instant flashlight via `CameraManager`, with no camera permission;
  - landscape lock and immersive mode;
  - Back button handling.
- Adaptive and themed launcher icons. Self-hosted fonts so the app works offline.
- Privacy policy page, Play listing texts and graphics, and a GitHub Actions workflow for signed builds.
### Fixed
- On landscape phones the filter bar no longer covers the weapon cards.

## [0.3.4] — 2026-10-02 · `f6771a7`
### Changed
- The studio name stays ARTIN Studios. Personal names removed from the README and the logo tagline.

## [0.3.3] — 2026-10-02 · `48cabbc`
### Changed
- Richer ARTIN Studios mark: a shield with a gradient "A", a gun-sight crossbar and three stars.
- New splash animation, new app icons and an `icons/artin-logo.svg` lockup.

## [0.3.2] — 2026-10-02 · `533b965`
### Fixed
- With infinite ammo, the ammo strip now drains as you fire and refills when empty.
- "Feel one shot" works even when the vibration toggle is off, and it reports when the phone blocks vibration.
### Changed
- Vibration pulses are at least 8 ms long so phone motors can feel them.
- Studio rebranded to ARTIN Studios.

## [0.3.1] — 2026-10-02 · `147a13c`
### Fixed
- Fired rounds now leave the HUD ammo strip, and it refills round by round on reload.
### Added
- RELOAD: MANUAL | AUTO switch, manual by default.
### Changed
- Studio rebranded to Korvex Studios (later replaced).

## [0.3.0] — 2026-10-02 · `ae7808d`
### Added
- 33 weapons from China, Russia, Europe, the USA, Japan, Korea and Israel (71 in total).
- Inline-SVG country flags and an Origin filter.
- Trigger-controlled burst on automatics and a "Rapid (hold)" mode on other weapons.
- Animated reloads, slide lock on empty and a suppressed VSS sound.
- "Calibre" name, wordmark and splash animation.

## [0.2.0] — 2026-10-02 · `b632afa`
### Added
- 15 weapons, including Indian service and origin guns and LMGs.
- "Used by" filters (Army, Navy, Air Force, SF, SPG, NSG, Para SF, MARCOS, Garud, Police).
- Key points: range, cartridge drawn to scale, energy, heat and environment reliability.
- 7 environments with backdrops, echo, ground surface, weather and ambience.
### Changed
- Pre-rendered per-gun sounds and casing bounces.
- Vibration derived from each gun's sound envelope.
- Per-gun muzzle flash shapes and torch patterns.
- New tactical HUD theme and a landscape-first layout.

## [0.1.0] — 2026-10-02 · `829a5e9`
### Added
- First web version ("Arsenal"): 24 weapons, synthesised sounds, vibration, flash, field guide, PWA and Netlify config.
