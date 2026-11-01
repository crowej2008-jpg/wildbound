/**
 * E6 tier list: random-team plug-in test over the Supreme / Mythic / Origin pool.
 *
 * Each battle draws two random teams of 6 distinct species from the pool, all at the same
 * star/level/skill levels and no gear, placed Guardians -> Strikers -> SKILL into slots 0..5
 * (slots 0-2 are the front row). A species' score is the win rate of the teams it was on,
 * plus its damage share, healing/shield share, survival and ult count.
 *
 * Usage: tsx scripts/balance/tier.ts <stage: early|mid|max> <battles> [out.json]
 */
import { writeFileSync } from 'node:fs';
import { runBattle, mulberry32, type WildInstance } from '@wildbound/engine';
import { buildConfig, buildWildTeam } from '@wildbound/server';

const STAGES = {
  early: { star: 5, level: 100, skill: 1 },
  mid: { star: 10, level: 300, skill: 2 },
  max: { star: 23, level: 340, skill: 3 },
} as const;

const stageName = (process.argv[2] ?? 'mid') as keyof typeof STAGES;
const BATTLES = Number(process.argv[3] ?? 2000);
const OUT = process.argv[4];
const stage = STAGES[stageName];
const config = buildConfig();

const pool = [...config.species.values()].filter((s) => ['supreme', 'mythic', 'origin'].includes(s.tier));
const ORDER = { guardian: 0, striker: 1, adept: 2 } as const;
const rng = mulberry32(0xe6 + stageName.length * 1000);

function pick(n: number): typeof pool {
  const copy = [...pool];
  const out: typeof pool = [];
  while (out.length < n) out.push(copy.splice(Math.floor(rng() * copy.length), 1)[0]!);
  return out.sort((a, b) => ORDER[a.className] - ORDER[b.className]);
}

function wilds(team: typeof pool, side: string): WildInstance[] {
  return team.map((s, i) => ({
    id: `${side}${i}`,
    speciesId: s.id,
    level: stage.level,
    stars: stage.star,
    xp: 0,
    ...(s.tier === 'origin' ? { skillLevels: { ult: stage.skill, basic: stage.skill, passive: stage.skill, talent4: stage.skill } } : {}),
  }) as unknown as WildInstance);
}

interface Acc { games: number; wins: number; dmgShare: number; supShare: number; survived: number; ults: number; rounds: number }
const acc = new Map<string, Acc>();
const get = (id: string) => acc.get(id) ?? (acc.set(id, { games: 0, wins: 0, dmgShare: 0, supShare: 0, survived: 0, ults: 0, rounds: 0 }), acc.get(id)!);

const t0 = Date.now();
for (let b = 0; b < BATTLES; b += 1) {
  const a = pick(6);
  const d = pick(6);
  const HPMUL = Number(process.env.HPMUL ?? 1);
  const tank = (t: ReturnType<typeof buildWildTeam>) => (t.specs.forEach((s) => { s.sheet = { ...s.sheet, hp: s.sheet.hp * HPMUL }; }), t);
  const A = tank(buildWildTeam(wilds(a, "a"), "attackers", config));
  if (process.env.DIALGA === 'friend') for (const t of [A]) for (const sp of t.specs) if (sp.name === 'Dialga') {
    const k: any = sp.kit;
    sp.kit = { ...k, talents: { ...k.talents, triggers: k.talents.triggers.map((tr: any) => tr.on === 'afterUlt' && tr.effects?.[0]?.fill
      ? { ...tr, effects: [{ op: 'rage', target: { side: 'ally', rule: 'self' }, fill: true }, { op: 'rage', target: { side: 'ally', rule: 'random', n: 2, excludeSelf: true }, fill: true }] }
      : tr) } };
  }
  const D = tank(buildWildTeam(wilds(d, "d"), "defenders", config));
  if (process.env.DIALGA === 'friend') for (const sp of D.specs) if (sp.name === 'Dialga') {
    const k: any = sp.kit;
    sp.kit = { ...k, talents: { ...k.talents, triggers: k.talents.triggers.map((tr: any) => tr.on === 'afterUlt' && tr.effects?.[0]?.fill
      ? { ...tr, effects: [{ op: 'rage', target: { side: 'ally', rule: 'self' }, fill: true }, { op: 'rage', target: { side: 'ally', rule: 'random', n: 2, excludeSelf: true }, fill: true }] }
      : tr) } };
  }
  // swap sides every other battle so first-mover advantage cancels out
  const flip = b % 2 === 1;
  const res = runBattle({
    attackers: (flip ? D : A).specs.map((s) => ({ ...s, side: 'attackers' as const })),
    defenders: (flip ? A : D).specs.map((s) => ({ ...s, side: 'defenders' as const })),
    seed: 1000 + b,
    mode: 'pve',
    settings: {},
    battleId: `tier:${b}`,
  });
  const ults = new Map<string, number>();
  for (const e of res.events) if (e.type === 'action' && e.skill === 'ult') ults.set(e.unit, (ults.get(e.unit) ?? 0) + 1);
  for (const [team, sideOf] of [[a, flip ? 'defenders' : 'attackers'], [d, flip ? 'attackers' : 'defenders']] as const) {
    const units = res.units.filter((u) => u.side === sideOf);
    const totDmg = units.reduce((s, u) => s + u.damageDealt, 0) || 1;
    const totSup = units.reduce((s, u) => s + u.healingDone, 0) || 1;
    units.forEach((u) => {
      const i = Number(u.id.split("-").pop());
      const sp = team[i]!;
      const r = get(sp.id);
      r.games += 1;
      if (res.winner === sideOf) r.wins += 1;
      r.dmgShare += u.damageDealt / totDmg;
      r.supShare += u.healingDone / totSup;
      if (u.alive) r.survived += 1;
      r.ults += ults.get(u.key) ?? 0;
      r.rounds += res.rounds;
    });
  }
}

const rows = pool.map((s) => {
  const r = get(s.id);
  const g = r.games || 1;
  return {
    id: s.id, name: s.name, tier: s.tier, cls: s.className,
    games: r.games, win: r.wins / g, dmg: r.dmgShare / g, sup: r.supShare / g,
    surv: r.survived / g, ultsPerFight: r.ults / g, rounds: r.rounds / g,
  };
}).sort((x, y) => y.win - x.win);

if (OUT) writeFileSync(OUT, JSON.stringify({ stage: stageName, battles: BATTLES, rows }, null, 1));
console.log(`${stageName}: ${BATTLES} battles in ${((Date.now() - t0) / 1000).toFixed(0)}s`);
for (const r of rows) {
  console.log(`${r.win.toFixed(3)} ${r.tier.padEnd(7)} ${r.cls.padEnd(8)} ${r.id.padEnd(22)} dmg ${(r.dmg * 100).toFixed(0).padStart(3)}% sup ${(r.sup * 100).toFixed(0).padStart(3)}% surv ${(r.surv * 100).toFixed(0).padStart(3)}% ults ${r.ultsPerFight.toFixed(1)} n=${r.games}`);
}
