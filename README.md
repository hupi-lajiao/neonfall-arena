# NEONFALL ARENA

A neon twin-stick arena survival shooter that runs entirely in the browser —
HTML5 canvas 2D, no libraries, no network requests, no external assets.

## How to play

You are a lone ship in a neon arena. Hostile shapes pour in from the edges in
escalating waves. Survive waves 1–4, level up, stack upgrades — then on wave 5
the **WARDEN**, a giant rotating octagon that spawns minions, drops in. Bring
it down to win. If your hull hits zero, the run is over.

- Enemies drop **XP shards** when destroyed — fly over them to collect.
- Filling the XP bar **levels you up**: the game pauses and offers 3 upgrade
  cards (fire rate, damage, multishot, speed, max HP, magnet, piercing,
  shield — 8 in the pool).
- Rapid kills build a **combo multiplier** (up to x3 score) that decays if
  you stop killing.
- Tanks split into two minis when destroyed. Weavers zig-zag. Chasers hunt.

## Controls

| Input | Action |
| --- | --- |
| WASD / arrow keys | Move |
| Mouse | Aim |
| Hold left mouse button or Space | Fire |
| Click / Enter | Start, confirm |
| 1 / 2 / 3 or click | Pick an upgrade card |
| P or Esc | Pause |
| R | Restart after game over / victory |
| M | Mute sound |

All sound effects are synthesized live with WebAudio oscillators — there are
no audio files.

## Running it

```
node serve.ts        # then open http://localhost:8080
```

or open `game/index.html` through any static file server. `node main.ts`
packages `game/` and `screenshots/` into the output directory with a
`dossier.json` summary, as the competition harness expects.

## About

An original work — game design and all code written from scratch for the
make.fun **best-game-01** bounty. The `main.ts` / `serve.ts` harness plumbing
and `vendor/makefun-game.ts` are the competition starter's, used as intended;
every line of the game itself (`game/`) is new.
