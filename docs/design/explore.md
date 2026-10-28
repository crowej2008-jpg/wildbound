# Explore foundation (M13.0b)

M13.0b adds the Explore hub and the eight mode shells. It is deliberately a foundation: the
cards, gates, scale, reset cadence and honest "arrives in" states ship now; each mode's actual
run, attempts and reward claims ship in its own sub-milestone (13.1-13.9).

## Modes and gates

| Mode | A/B gate | Scale | Reset | Arrives |
| --- | --- | --- | --- | --- |
| Pet Home | campaign 1-10 | 21 tiles | daily | 13.1 |
| Sky Pillar | campaign 7-1 | 1,800 stages | daily | 13.2 |
| Hoopa's Vault | server day 15 | 300 floors | daily | 13.3 |
| Rift Arena | campaign 10-10 + Lv10 | 250 floors | daily | 13.4-13.5 |
| Misty Woods | campaign 3-10 | 244 runes | daily | 13.6 |
| Faction Tower | campaign 28-10 | 3,000 floors | weekly | 13.7 |
| Island Challenge | campaign 3-10 + Lv10 | 90 levels | weekly | 13.8 |
| Ultra Wormhole | campaign 10-10 + Lv50 | 135 hires | weekly | 13.9 |

The gate values live in `packages/content/tuning/explore.json`, not in the client. The engine
evaluates them through `exploreAccess` in `packages/engine/src/explore/`.

## Server day

Gates of the form "server day 15" count from the stored `serverEpoch`; day 1 is the creation day.
`serverDay(now, epoch)` clamps to 1 for clocks before the epoch. The local debug fast-forward moves
`now`, so it can open a server-day gate without changing the epoch.

Save **v15** adds `serverEpoch`. Older saves derive it from the welcome mail's `createdAt` (the
closest account-creation record already in the save), falling back to migration time.

## Resets

`nextResetMs(reset, now)` returns the millisecond countdown:

- `daily`: the next 00:00 UTC.
- `weekly`: the next Monday 00:00 UTC.
- `permanent`: `null`.

The hub and detail page render this countdown. Actual attempt counters and reward tables are
mode-specific and are added with each playable mode; no fake attempt or claim button is shown in
13.0b.

## Screens

- `/explore`: a data-driven card per mode with name, tagline, description, scale, reset cadence,
  lock state, first unmet gate, status and planned milestone.
- `/explore/:id`: the mode's full gate checklist, feature bullets, scale, reset countdown and an
  honest "this mode is a shell in this milestone" note. There is no play button until the mode is
  playable.

Labels are client-owned English. Content owns names, taglines, descriptions, scales, gates,
features and planned milestone strings; content contains no franchise terms or copied source rows.

## Deliberate gaps

- Mode play, attempts, reward claims and per-mode progress slices: 13.1-13.9.
- Full Victory Road tasks/badges/commission: M14.
- Gods Trials and all B gates beyond Hoopa: parked.
- Paid tracks, Vault passes, Pet Home assistant and real-money SKUs: removed permanently.
