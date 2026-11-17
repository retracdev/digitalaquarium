# Digital Aquarium

A cozy 3D aquarium simulation — part of the **retrac.space** collection.

Hatch fish, grow plants, decorate, and keep everyone fed. The tank keeps living while you're away: fish get hungry, water gets murky, eggs incubate and plants grow in real time. Come back every day to take care of things.

## Running it

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # unit tests (Vitest + jsdom)
npm run build      # typecheck + production build into dist/
```

Everything (fish, plants, decor, water, caustics) is generated in code with [three.js](https://threejs.org). There are no model or texture assets besides the retrac.space logo.

## How the tank works

| | |
|---|---|
| **Hunger** | Fish get hungrier every hour (0 = full, 100 = starving). A full fish starves after roughly 12 hours. |
| **Health** | Starving fish lose health; at 0 they pass away and go to the Memorial. A neglected tank loses fish after about a day. Dirty water hurts health too. |
| **Overfeeding** | Feeding fish that aren't hungry clouds the water. |
| **Water** | Gets dirtier with more fish. Plants, air stones and better filters slow it down. Clean it from the dock. |
| **Shells** | Grown, happy fish (and mature plants) slowly make shells. Collect them — the pile is capped, so check in regularly. |
| **Levels** | XP from feeding hungry fish, cleaning, hatching, collecting, growing plants and installing upgrades. Each level pays shells and unlocks new species, plants, decor, upgrades and themes (30 levels). |
| **Hour-long waits** | Eggs incubate 1–12 h, plants grow 1–6 h, fry grow up over hours, upgrades install over 1–8 h, treasure chests refill every 4 h. |
| **Daily streak** | Visiting on consecutive days pays a growing bonus. |
| **Day & night** | Lighting follows your local clock (or force it in Tank → Care). Glowing creatures shine at night. |

13 species (Neon Tetra → Void Angler), 8 plants, 10 decorations, 4 tank sizes, 4 filters, 2 auto-feeders, 4 backdrop themes (including a space-themed *retrac Nebula*), 17 milestones and a Mystery Egg that can roll species above your level.

### Controls

Drag to orbit, scroll to zoom, double-click to reset the camera. Click a fish to inspect, rename, follow or rehome it; click plants/decor to move or remove them; click a glowing chest to loot it.

Shortcuts: **F** feed · **C** clean · **G** collect · **H** hatchery · **S** shop · **T** tank · **J** journal · **P** photo · **Esc** close.

## Save slots

Five independent tanks, saved to **cookies** in this browser (compressed with lz-string and chunked across cookies to stay under the ~4 KB per-cookie limit). Switch tanks from the tank-name dropdown in the top-left, or open *Manage all tanks*. Saves happen every 15 s, after every action, on slot switch and when the tab is hidden.

Storage is behind a `SaveBackend` interface (`src/storage/saves.ts`), so a cloud backend can slot in later.

## The secret keeper console (testing)

Press <kbd>`</kbd> in the app (or call `aquarium('…')` from devtools) and type `help`.

| Command | |
|---|---|
| `skip [all\|eggs\|plants\|upgrades\|chests\|fish]` | Finish waiting timers instantly |
| `warp 2h` / `warp 1d` | Jump the clock forward — the full simulation runs, so fish get hungry (or die) |
| `shells 500`, `xp 200`, `level 10` | Economy & progression |
| `spawn goldfish 3`, `spawn list`, `egg mystery` | Add creatures |
| `starve`, `heal`, `water 20` | Force states for testing |
| `time`, `resettime`, `status` | Inspect the clock and tank |

## Project layout

```
src/core/      pure simulation: catalog, state, sim, actions, leveling, console (unit tested)
src/storage/   chunked cookie store + save-slot backend
src/app/       controller: ticking, autosave, slot switching
src/render/    three.js scene, tank, procedural fish/plants/decor, effects, swimming
src/ui/        HUD, dock, panels, title/slot screen, console
tests/         Vitest suites
```

## Ideas for later

- **Accounts & cloud saves** — a `CloudSaveBackend`, with cookies as an offline cache and conflict merge by `updatedAt`.
- **Live with friends** — visit a friend's tank in real time, drop food in each other's tanks, leave a "fed your fish" note, gift eggs.
- **Shared reef** — a co-op tank several friends maintain together, with a combined streak.
- **Breeding & genetics** — two happy adults of a species occasionally lay an egg; colour variants and rare morphs.
- **Seasonal events** — limited-time species and decor (bioluminescent bloom week, a holiday sunken ship).
- **Fish personalities** — shy/curious/greedy traits that change behaviour and moods.
- **Ambient sound** — bubbles, filter hum, a soft night soundtrack.
- **Push/email reminders** when fish are getting hungry (opt-in, account users).
- **Trading / Reef Sanctuary** — rehomed fish appear in a public sanctuary others can adopt from.
