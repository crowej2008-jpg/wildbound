/* eslint-disable no-undef */
/**
 * M15: write packages/content/tuning/account3.json — Account systems III from the source dumps:
 * trainer treasures (treasures_cfg trainer_treasure_*), the Z Ring wristband and its five Pure Crystals
 * (boosts_cfg wristband_*), the 18 Different Dimension fusion skins (pokemon_data_cfg hero_fusion_*), the Golden Egg
 * (relic_growth_cfg new_egg_*) and the Awakening (awaken_*). Attribute ids: 1201 / 501 / 401 flat HP, 1202 / 502 / 402
 * flat P.ATK, 1204 / 504 / 404 flat S.ATK; 406 / 506 HP %, 407 / 507 P.ATK %, 409 / 509 S.ATK % (hundredths of a
 * percent). Not in the dumps: treasure level stats and costs (trainer_treasure_lev was not copied) — stand-ins.
 *
 *   node scripts/import-account3.mjs   (WILDBOUND_SOURCE as for the other importers)
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { repoRoot, sourceRoot } from './source/source.mjs';

const load = (d, f) => JSON.parse(readFileSync(join(sourceRoot, d, f), 'utf8'));
const tr = load('2026-10-03', 'treasures_cfg.json');
const bo = load('2026-10-03', 'boosts_cfg.json');
const pd = load('2026-10-03', 'pokemon_data_cfg.json');
const eg = load('2026-10-02', 'relic_growth_cfg.json');
const rows = (o) => Object.values(o);
const speciesBySource = new Map();
for (const file of ['water', 'fire', 'grass', 'light', 'dark', 'summon-pool']) {
  for (const s of JSON.parse(readFileSync(join(repoRoot, 'packages/content/species', `${file}.json`), 'utf8'))) speciesBySource.set(s.sourceId, s);
}
const FLAT = { 1201: 'hp', 501: 'hp', 401: 'hp', 1202: 'pAtk', 502: 'pAtk', 402: 'pAtk', 1204: 'sAtk', 504: 'sAtk', 404: 'sAtk' };
const PCT = { 406: 'hpPct', 506: 'hpPct', 407: 'pAtkPct', 507: 'pAtkPct', 409: 'sAtkPct', 509: 'sAtkPct' };
function lines(attr) {
  const out = [];
  for (const [id, v] of attr ?? []) {
    if (FLAT[id]) out.push({ kind: 'core', field: FLAT[id], value: v });
    else if (PCT[id]) out.push({ kind: 'percent', field: PCT[id], value: v / 10000 });
  }
  return out.filter((l) => l.value !== 0);
}
const FACTION = { 1: 'water', 2: 'fire', 3: 'grass', 4: 'light', 5: 'dark' };

// Treasures.
const named = new Map(tr._treasures.map((t) => [t.type, t]));
const treasures = rows(tr.trainer_treasure_basic_json)
  .sort((a, b) => a.type - b.type)
  .map((b) => {
    const t = b.type;
    const n = named.get(t);
    const skills = rows(tr.trainer_treasure_skill_up_json[String(t)])
      .sort((a, c) => a.skill_lev - c.skill_lev)
      .map((s, i) => ({ level: s.skill_lev, treasureLevel: s.lev, accessory: s.debris, refine: s.refine, text: n?.levels?.[i]?.text ?? '' }));
    const accessory = rows(tr.trainer_treasure_debris_up_json[String(t)])
      .filter((d) => d.debris > 0)
      .sort((a, c) => a.debris - c.debris)
      .map((d) => ({ level: d.debris, cost: d.debris_cost.reduce((s, [, k]) => s + k, 0) }));
    const stars = rows(tr.trainer_treasure_quality_json[String(t)])
      .sort((a, c) => a.quality - c.quality)
      .map((q) => ({ star: q.quality, cost: q.quality_cost?.[0]?.[1] ?? 0, lines: lines(q.quality_attr) }));
    const refine = rows(tr.trainer_treasure_refine_json[String(t)])
      .sort((a, c) => a.refine_lev - c.refine_lev)
      .map((r) => ({ level: r.refine_lev, treasureLevel: r.refine_lev_need, cost: r.refine_need }));
    return { type: t, name: n?.name ?? b.name, gym: b.open_cond, gymName: n?.gym ?? '', summary: n?.summary ?? '', skills, accessory, stars, refine };
  });
const resonance = rows(tr.trainer_treasure_resonance_json['5']).sort((a, b) => a.share_lev - b.share_lev).map((r) => ({ level: r.share_lev, skillLevel: r.skill_lev_need, lines: lines(r.attr) }));

// Wristband (Z Ring) and Pure Crystals.
const wristband = rows(bo.wristband_lev_json).sort((a, b) => a.level - b.level).map((l) => ({ level: l.level, cost: l.cost[0][1], lines: lines(l.attr) }));
const crystalCaps = rows(bo.wristband_open_json).sort((a, b) => a.lev_max - b.lev_max).map((o) => ({ wristband: o.z_lev, maxLevel: o.lev_max }));
const crystals = Object.entries(bo.wristband_crystal_json).map(([race, levels]) => ({
  faction: FACTION[race],
  levels: rows(levels).sort((a, b) => a.level - b.level).map((l) => ({ level: l.level, cost: l.cost[0][1], lines: lines(l.attr) })),
}));

// Fusion skins.
const text = (s) => pd._text?.[s] ?? s;
const fusion = rows(pd.hero_fusion_id_json)
  .sort((a, b) => a.fusion_id - b.fusion_id)
  .map((f) => {
    const levels = rows(pd.hero_fusion_lev_json[String(f.fusion_id)]).sort((a, b) => a.lev - b.lev);
    return {
      id: f.fusion_id,
      name: text(f.name),
      species: speciesBySource.get(f.hero_id)?.id ?? null,
      perk: text(levels[1]?.desc ?? levels[0].desc ?? ''),
      levels: levels.map((l) => ({ level: l.lev, cost: l.cost?.[0]?.[1] ?? 0, perkValue: l.privilege_val, lines: lines(l.attr) })),
    };
  });

// Golden Egg.
const itemMap = { 10143: 'pokemonShard5', 10144: 'pokemonShard5', 10145: 'pokemonShard5', 10103: 'pokemonShard5', 10006: 'ticketPremium', 2: 'gems', 1: 'gold' };
const jackpot = rows(eg.new_egg_jackpot_json).sort((a, b) => a.index - b.index).map((r) => {
  if (r.card_conf) {
    const sp = speciesBySource.get(Math.floor(r.card_conf / 10_000));
    return { weight: r.weight, species: sp?.id ?? null, shards: r.prize_conf };
  }
  const [id, n] = r.item_conf[0];
  return { weight: r.weight, rewards: itemMap[id] ? { [itemMap[id]]: n } : {}, ...(itemMap[id] ? {} : { notCopied: [`${id} ×${n}`] }) };
}).filter((r) => r.species !== null);
const eggShop = rows(eg.new_egg_shop_json).sort((a, b) => a.index - b.index).map((r) => {
  const [id, n] = r.item[0];
  const sp = speciesBySource.get(id - 40000 + 100);
  return { id: r.index, price: r.cost[0][1], limit: r.quota, species: sp?.id ?? null, shards: n };
}).filter((r) => r.species);
const eb = eg.new_egg_basic_json;

// Awakening.
const awaken = { need: pd.awaken_basic_json.need_progress, tasks: rows(pd.awaken_task_json).map((t) => ({ id: t.id, event: t.event, value: t.value, progress: t.progress, desc: t.desc })) };

const tuning = {
  _note: 'Generated by scripts/import-account3.mjs from the source dumps (treasures, wristband, fusion, golden egg, awakening). Do not edit.',
  treasures: { list: treasures, resonance, factionSlots: rows(tr.trainer_treasure_camp_json).map((c) => ({ unlocked: c.open_num, perFaction: c.race_num })), levelCost: { base: 10, perLevel: 5 }, maxLevel: 200 },
  wristband: { levels: wristband, crystalCaps, crystals },
  fusion,
  egg: { freePerDay: eb.free_cost, pointsPerSmash: eb.points, jackpot, shop: eggShop },
  awaken: { ...awaken, serverDay: 60, at18: 12 },
};
writeFileSync(join(repoRoot, 'packages/content/tuning/account3.json'), `${JSON.stringify(tuning, null, 1)}\n`);
console.log(`account3.json: ${treasures.length} treasures, ${wristband.length} Z Ring levels, ${crystals.length} crystals, ${fusion.length} skins, ${jackpot.length} egg rows, ${eggShop.length} egg shop rows`);
