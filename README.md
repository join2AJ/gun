# Arsenal — Gun Simulator & Field Guide

A web-based gun sound simulator inspired by *Gun Sounds: Gun Simulator*, with stronger UI/UX and an
educational layer. Fire 24 historic and modern weapons from WWI to today. Every shot is
**synthesised live** (no audio files) and mirrored through the phone's **vibration motor** and **camera
flashlight**. A field manual explains how each weapon works, where it was used, and what it feels like.

No build step and no dependencies: plain HTML/CSS/ES modules, ready for Netlify.

## Features

| | |
|---|---|
| **Armory** | Filter by era (WWI, WWII, Cold War, Modern), type and favorites. Search across names, wars, countries and calibres. Sort by year, name, country or recoil. |
| **Simulator** | Tap & hold the weapon or the FIRE button. Only real fire modes are offered for each gun: single, burst, auto, bolt action or pump action. |
| **Sound engine** | Web Audio layers per shot: supersonic crack, muzzle blast, body thump, low rumble and action noise, plus reverb. Choose from 5 environments (range, field, indoor, canyon, city). |
| **Haptics** | Each gun has its own vibration waveform built from its sound profile (blast, then echo decay, then action kick). Pulse-width modulation fakes vibration strength. Auto fire pulses once per round. |
| **Light** | The screen flash is centred on the muzzle. The phone's camera LED flashes with each shot (Chrome on Android). |
| **Physics FX** | Recoil and muzzle rise scaled to the real recoil rating. Shell casings eject and bounce, with smoke, sparks and side-blast dust from the Barrett muzzle brake. |
| **Details** | The M1 Garand clip makes its *PING*. Bolt and pump actions cycle after every shot. The minigun spins up and down. Belt-fed guns use belts. Shotguns load shell by shell. |
| **Shake to fire** | Shake the phone to fire, using the accelerometer. |
| **Field manual** | Overview, service history, conflicts, trivia, step-by-step mechanism walkthrough, specs and feel meters. |
| **PWA** | Installable, works offline, runs fullscreen and locks to landscape when supported. |

Keyboard: `Space` fire · `R` reload · `M` mode · `←/→` switch · `I` manual · `F` fullscreen · `Esc` back.

## Project structure

```
index.html            App shell, icon sprite and dialogs
css/app.css           Design tokens and responsive layout (desktop, landscape phone, portrait phone)
js/data.js            Weapon database: history, mechanism, specs, sound/feel profile, art spec
js/render.js          Procedural SVG renderer that builds each gun from parts (stock, receiver, mag…)
js/audio.js           Synthesised gunfire engine and environments
js/fx.js              Haptics (vibration), torch (flashlight) and canvas particles
js/app.js             Routing, armory, firing scheduler, reload/cycle logic and field manual
sw.js, manifest…      PWA offline support
dev/gallery.html      Art preview of every weapon (for tuning render specs)
```

### Adding a weapon

Add an entry to `WEAPONS` in `js/data.js`. Copy a similar weapon and adjust:

- `modes`, `rpm`, `capacity` and `ammo` (`pistol`, `rifle`, `belt`, `shell` or `bmg`) control the gameplay.
- `sound` holds `power`, `crack`, `decay`, `thump`, `bright`, `tail` and `mech`. These drive the audio and also the vibration.
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
