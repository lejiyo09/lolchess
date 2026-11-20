# TFT Tournament Lab · Set 19

A local-first, offline-capable browser practice tool for TFT Set 19 (Prismatic Tour).

## Run

1. Extract the ZIP (if downloaded as an archive).
2. Open `index.html` in Chrome, Edge, Firefox, or Safari.
3. No install, login, server, or API key is needed.

## Included

- Set 19 champion database (94 pre-release reveal entries), cost/trait filters, unlockable marker
- Interactive 7×4 board builder, unit stars, item slots, trait counts, bench, save/load compositions
- Round/economy practice model, level/XP, shop roll, purchase/sell, event log
- Opponent board scouting and counter-positioning notes
- Eight decision-practice questions with feedback
- Scrim result tracker, event point table, export/import backups
- Dataset JSON import/export to replace champion/trait data when the live patch changes
- Browser-local persistence via localStorage

## Important data caveats

- Champion/trait snapshot is based on the Set 19 reveal surfaced on 2026-11-15 and is not guaranteed to match the final PBE/live build.
- Trait thresholds included here are a planning aid and should be verified against the live 19.2 set data before tournament play.
- The augment library is a small sample, not all 330 revealed augments.
- Economy income, XP, and shop odds are simplified practice models, not a complete reproduction of Riot's game server.
- TFT Tournament Lab is an unofficial fan-made practice tool and is not endorsed by Riot Games.

## Sources used for the initial data snapshot

- Riot Games, TFT patch schedule: https://support.riotgames.com/en-us/tft/events/patch-schedule-teamfight-tactics
- Riot Games, Set 19 teaser: https://teamfighttactics.leagueoflegends.com/en-us/news/dev/new-client-set-19-tease-and-compensation-rewards/
- TFT Ninja, Set 19 reveal data (derived from Riot Dev Drop): https://tft.ninja/sets/19
- Champion/trait preview: https://tft.ninja/sets/19/units and https://tft.ninja/sets/19/traits

The folder also includes `tft-set19-dataset.json`, which can be imported from the app's **Data & Settings** tab and edited as the PBE/live set changes.
