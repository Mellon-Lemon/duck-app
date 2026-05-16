# Daan de Boze Eend: Muntenrace

Een vrolijke, mobile-first HTML5 endless runner waarin Daan munten pakt, combo's bouwt en obstakels ontwijkt.

## Lokaal starten

Open `index.html` direct in een moderne browser. Er is geen build-stap, server, npm-install of externe dependency nodig.

Optioneel kun je de map openen met VS Code Live Server, maar dat is niet vereist.

## Controls

- Mobiel: tik op het scherm om te springen.
- Desktop: `Spatie` of `Pijl omhoog` om te springen.
- `P` of `Escape`: pauzeren en verder spelen.
- `R`: opnieuw starten na game over.
- Korte tik = lagere sprong, langer vasthouden = hogere sprong.

## Features

- Canvas gameplay met responsive scaling en devicePixelRatio-clamp.
- Startscherm, countdown, playing, pauze en game-over states.
- Obstakels: krat, cactus, plas en steen.
- Muntenpatronen met combo multiplier tot x5.
- Powerups: magnet, shield, heart en feather/double jump.
- Web Audio API sounds voor springen, munten, hit, powerups en countdown.
- LocalStorage voor highscore, beste munten, mute-status, achievements en skin.
- Achievements: Eerste Munt, Muntenmagneet, Boze Overlever, Combo Kwaker en Nieuwe Legende.
- Mobile UX met touch-action none, safe-area padding en grote knoppen.
- Originele SVG-assets in `assets/`, zonder externe of copyrighted assets.

## Projectstructuur

```text
/
  index.html
  style.css
  game.js
  README.md
  assets/
    player-duck.svg
    player-duck-angry.svg
    player-duck-hit.svg
    coin.svg
    coin-sparkle.svg
    crate.svg
    cactus.svg
    puddle.svg
    rock.svg
    cloud-1.svg
    cloud-2.svg
    cloud-3.svg
    bg-hills.svg
    bg-bushes.svg
    bg-sun.svg
    bg-moon.svg
    magnet.svg
    shield.svg
    heart.svg
    feather.svg
    icon-sound.svg
    icon-muted.svg
    icon-pause.svg
    icon-play.svg
```

## Netlify deploy

- Sleep de volledige projectmap naar Netlify Drop, of koppel de repo in Netlify.
- Build command: leeg laten.
- Publish directory: `/` oftewel de projectroot.
- Alle paden zijn relatief, dus de game werkt als statische site.

## Uitbreidingsideeën

- Extra obstakeltypes met unieke patronen.
- Dagelijkse challenges met vaste seed.
- Meer skins of vrijspeelbare petten.
- Simpele leaderboard-export via handmatige scorecodes.
