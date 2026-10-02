# CALIBRE — Gun Simulator & Field Manual

*A Korvex Studios title.* **Korvex Studios** is the umbrella studio brand for this and future games. Its mark is a shield holding a chevron "K". It appears in the start-up animation and the app icon.

A web-based gun sound simulator inspired by *Gun Sounds: Gun Simulator*, with stronger UI/UX and an
educational layer. Fire 24 historic and modern weapons from WWI to today. Every shot is
**synthesised live** (no audio files) and mirrored through the phone's **vibration motor** and **camera
flashlight**. A field manual explains how each weapon works, where it was used, and what it feels like.

No build step and no dependencies: plain HTML/CSS/ES modules, ready for Netlify.

## Features

| | |
|---|---|
| **71 weapons** | WWI to today from India, USA, Russia/USSR, China, Europe (UK, Germany, Belgium, France, Italy, Austria, Czech Rep., Switzerland), Israel, Japan and South Korea. Indian service & origin includes: INSAS rifle & LMG, AK-203, Pistol Auto 9mm 1A, Ishapore 2A1, Vidhwansak, ASMI, Bren, plus Tavor, Negev NG7, SIG716i, F2000, P90, Galil Sniper, M249, PKM and more. |
| **Flags & origin** | Every weapon shows its country flag(s), drawn as inline SVG so they look the same on every device. Filter by origin: India, USA, Russia/USSR, China, Europe, Israel, Japan & Korea. |
| **Filters** | Era, type (pistol, SMG, rifle, sniper/AMR, LMG, MG/GPMG, shotgun), **used by** (Army, Navy, Air Force, Special Forces, SPG, NSG, Para SF, MARCOS, Garud, Police/CAPF), Indian service & origin, favorites, search, sort by year/range/power/fire rate/recoil. |
| **Key points** | Effective range vs max bullet travel, rounds per load, bullet size **drawn to scale**, bullet weight, muzzle energy & velocity, accuracy, rate of fire, heat behaviour, and reliability in desert / snow / jungle / mud / high altitude. Live "Intel" panel while shooting. |
| **Sound** | Each gun's shot is pre-rendered (Web Audio, OfflineAudioContext) from layers: muzzle impulse, supersonic N-wave crack, blast, body boom, brake blast and an action sound per operating system (AK carrier slam, AR buffer "sproing", HK roller clack, pistol slide…). |
| **Casings** | Spent cases bounce and ring when they land, pitched by case length; concrete rings, sand and snow just thud; steel cases sound duller; shotgun hulls clunk. |
| **Vibration** | Built from each gun's *actual* sound envelope + a recoil kick — every weapon feels different. Shown as a waveform in the Feel tab. |
| **Flash** | Per-weapon muzzle flash shape (birdcage flower, brake side-blast, shotgun fireball, MG cone, compensator jets), colour, size and duration; matching flashlight (torch) pattern. |
| **Environments** | Firing range, desert, Himalayan snow, jungle, urban, night, indoor — each changes backdrop, echo, ground surface, weather particles, ambient sound and shows the gun's reliability there. |
| **Fire modes** | Real modes plus a trigger-controlled burst on every automatic weapon (marked *) and a hold-to-repeat **Rapid** mode on semi-auto, bolt and pump guns. |
| **Reload** | MANUAL / AUTO switch on the HUD (manual by default). Each fired round pops out of the ammo strip, and the strip refills round by round on reload. Animated: the empty magazine drops and tumbles to the ground with a landing sound, a fresh one slides in and the bolt or slide is racked. Clips are pressed in from the top, shells go into the tube one by one and belts are swapped. Pistol slides lock back when empty. |
| **Splash** | The Korvex mark draws in (~0.5 s), then KORVEX STUDIOS and the CALIBRE wordmark appear. `SPLASH_MS` in `js/app.js` sets the total time. |
| **Heat** | Barrel heat builds with sustained fire and cools over time; a hot barrel smokes. |
| **Landscape-first** | Designed for a sideways phone; prompts to rotate in portrait (with a portrait fallback). Fullscreen + landscape lock. |
| **PWA** | Installable, offline, wake lock. |

Keyboard: `Space` fire · `R` reload · `M` mode · `←/→` switch · `E` environment · `I` manual · `F` fullscreen · `Esc` back.

## Project structure

```
index.html            App shell, icon sprite and dialogs
css/app.css           Design tokens and responsive layout (desktop, landscape phone, portrait phone)
js/data.js            Weapon database (core + Indian), cartridges, users, key-point stats
js/data-world.js      China / Russia / Europe / USA / Asia weapons, built from art templates
js/flags.js           Inline-SVG country flags and origin regions
js/render.js          Procedural SVG renderer that builds each gun from parts (stock, receiver, mag…)
js/audio.js           Synthesised gunfire engine and environments
js/fx.js              Haptics (from sound envelope), torch patterns, particles, weather
js/scenes.js          Environment backdrops (SVG) + acoustics/ground/weather settings
js/app.js             Routing, armory, firing scheduler, reload/cycle logic and field manual
sw.js, manifest…      PWA offline support
dev/gallery.html      Art preview of every weapon (for tuning render specs)
```

### Adding a weapon

Add an entry to `WEAPONS` in `js/data.js`. Copy a similar weapon and adjust:

- `modes`, `rpm`, `capacity` and `ammo` (`pistol`, `rifle`, `belt`, `shell` or `bmg`) control the gameplay.
- `sound` holds `power`, `crack`, `decay`, `thump`, `bright`, `tail`, `mech` (slide, gas, ak, ar, roller, garand, heavy, bolt…) and `steel`. These drive the audio and therefore the vibration.
- Key points: `mv`, `eff`, `max`, `bulletG`, `moa`, `heat`, `heatNote`, `env` [desert, snow, jungle, mud, altitude], `users`, `cart` (see `CARTS`).
- `art` is the parts spec for the SVG renderer. Open `/dev/gallery.html` to preview it.

## Run locally

```bash
npx http-server -p 8080   # or: python3 -m http.server 8080
# open http://localhost:8080
```

Vibration and the flashlight only work on a real phone, and the flashlight needs **HTTPS**. Test them on
the Netlify deploy or through a tunnel.

## Deploy on Netlify

1. Push this repo to GitHub. In Netlify, choose **Add new site → Import from Git** and pick the repo.
2. Leave the build command empty and set the publish directory to `.`. `netlify.toml` already sets this.
3. Deploy. `netlify.toml` also sends a `Permissions-Policy` header that allows the camera (flashlight)
   and the accelerometer (shake to fire).

Alternatively, drag the folder onto <https://app.netlify.com/drop>.

## Platform support

| Feature | Android Chrome | iOS Safari | Desktop |
|---|---|---|---|
| Sound | ✅ | ✅ (ringer switch must be on) | ✅ |
| Vibration | ✅ | ❌ (Apple blocks the Vibration API) | ❌ |
| Flashlight | ✅ (HTTPS + camera permission) | ❌ | ❌ |
| Shake to fire | ✅ | ✅ (asks permission) | — |

## Roadmap to Android app

- **TWA (Trusted Web Activity)**: wrap the Netlify PWA with [Bubblewrap](https://github.com/GoogleChromeLabs/bubblewrap)
  and publish it to the Play Store. This is the quickest route, and vibration and the flashlight keep working.
- **Capacitor**: for native features such as stronger haptics (`VibrationEffect` amplitude control), a
  reliable torch plugin and AdMob or in-app purchases ("remove ads").
- Optional: drop in licensed gunfire recordings per weapon to replace or layer with the synthesiser.

## Disclaimer

For entertainment and education. Sounds are synthesised approximations, and specs are typical published
values that vary by variant. Contains flashing lights; a *Reduce flashing* option is in Settings.
