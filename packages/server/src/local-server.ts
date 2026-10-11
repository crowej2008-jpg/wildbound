import {
  autoFormation as runAutoFormation,
  canEvolve,
  computePower,
  CURRENCY_IDS,
  evolveCheck,
  evolved,
  levelCapOf,
  leveledUp,
  levelUpCost,
  resolveCoreStats,
  respawnRefund,
  respawned,
  SQUAD_MODES,
  SQUAD_SIZE,
  starUpCost,
  starredUp,
  STRATEGIES,
  type AccountState,
  type CurrencyId,
  type Squad,
  type SquadMode,
  type StrategyId,
  type WildInstance,
} from '@wildbound/engine';
import {
  fail,
  GAME,
  ok,
  type AccountSnapshot,
  type GameServer,
  type Result,
  type ServerInfo,
} from './index';
import type { GameConfig } from './config';
import { BACKUP_KEY, createInitialState, parseSave, SAVE_KEY, serializeSave } from './save';
import type { SaveStore } from './storage';

/**
 * In-browser GameServer (PROMPT §10). Owns the authoritative account state,
 * applies engine rules, and autosaves through an injected `SaveStore`.
 */
export class LocalServer implements GameServer {
  private state: AccountState | null = null;

  constructor(
    private readonly store: SaveStore,
    private readonly config: GameConfig,
  ) {}

  async ping(): Promise<Result<ServerInfo>> {
    return ok({ game: GAME, protocol: 1 });
  }

  async loadAccount(): Promise<Result<AccountSnapshot>> {
    const loaded = await this.load();
    if (!loaded.ok) return loaded;
    return ok(this.snapshot(loaded.value));
  }

  async grantWild(speciesId: string): Promise<Result<AccountSnapshot>> {
    const loaded = await this.load();
    if (!loaded.ok) return loaded;
    const state = loaded.value;
    const meta = this.config.species.get(speciesId);
    if (!meta) return fail('not_found', `unknown species "${speciesId}"`);
    const instance: WildInstance = {
      id: `w${state.nextInstanceSeq}`,
      speciesId,
      level: 1,
      stars: 1,
      evolutionStage: 0,
      locked: false,
      acquiredAt: this.config.now(),
    };
    return this.commit({
      ...state,
      roster: [...state.roster, instance],
      nextInstanceSeq: state.nextInstanceSeq + 1,
    });
  }

  async grantRandomWild(): Promise<Result<AccountSnapshot>> {
    const ids = [...this.config.species.keys()].sort();
    if (ids.length === 0) return fail('not_found', 'no species available');
    const pick = ids[Math.floor(this.config.rng() * ids.length)] ?? ids[0];
    return this.grantWild(pick as string);
  }

  async grantCurrency(currency: string, amount?: number): Promise<Result<AccountSnapshot>> {
    if (!(CURRENCY_IDS as readonly string[]).includes(currency)) {
      return fail('invalid_input', `unknown currency "${currency}"`);
    }
    const id = currency as CurrencyId;
    const add = amount === undefined ? this.config.debugGrant[id] ?? 0 : amount;
    if (!Number.isFinite(add) || add < 0) return fail('invalid_input', 'amount must be non-negative');
    const loaded = await this.load();
    if (!loaded.ok) return loaded;
    const state = loaded.value;
    return this.commit({
      ...state,
      currencies: { ...state.currencies, [id]: state.currencies[id] + Math.floor(add) },
    });
  }

  async levelUp(instanceId: string, levels: number): Promise<Result<AccountSnapshot>> {
    const loaded = await this.load();
    if (!loaded.ok) return loaded;
    const found = this.find(loaded.value, instanceId);
    if (!found) return fail('not_found', `no Wild "${instanceId}"`);
    const { state, instance } = found;
    const target = Math.min(levelCapOf(instance, this.config.progress), instance.level + Math.max(0, Math.floor(levels)));
    if (target <= instance.level) return fail('at_level_cap', 'already at this stage\'s level cap');
    const cost = levelUpCost(instance.level, target, this.config.progress);
    if (state.currencies.candy < cost.candy || state.currencies.gold < cost.gold) {
      return fail('insufficient_items', 'not enough candy or gold');
    }
    const next = leveledUp(instance, target - instance.level, this.config.progress);
    return this.commit({
      ...state,
      roster: this.replace(state.roster, next),
      currencies: {
        ...state.currencies,
        candy: state.currencies.candy - cost.candy,
        gold: state.currencies.gold - cost.gold,
      },
    });
  }

  async starUp(instanceId: string, stars: number): Promise<Result<AccountSnapshot>> {
    const loaded = await this.load();
    if (!loaded.ok) return loaded;
    const found = this.find(loaded.value, instanceId);
    if (!found) return fail('not_found', `no Wild "${instanceId}"`);
    const { state, instance } = found;
    const target = Math.min(this.config.progress.maxStars, instance.stars + Math.max(0, Math.floor(stars)));
    if (target <= instance.stars) return fail('at_level_cap', 'already at max stars');
    let shards = 0;
    let gold = 0;
    for (let s = instance.stars; s < target; s++) {
      const step = starUpCost(s, this.config.progress);
      shards += step.shards;
      gold += step.gold;
    }
    if (state.currencies.shard < shards || state.currencies.gold < gold) {
      return fail('insufficient_items', 'not enough shards or gold');
    }
    const next = starredUp(instance, target - instance.stars, this.config.progress);
    return this.commit({
      ...state,
      roster: this.replace(state.roster, next),
      currencies: { ...state.currencies, shard: state.currencies.shard - shards, gold: state.currencies.gold - gold },
    });
  }

  async evolve(instanceId: string): Promise<Result<AccountSnapshot>> {
    const loaded = await this.load();
    if (!loaded.ok) return loaded;
    const found = this.find(loaded.value, instanceId);
    if (!found) return fail('not_found', `no Wild "${instanceId}"`);
    const { state, instance } = found;
    const meta = this.config.species.get(instance.speciesId);
    if (!meta) return fail('not_found', `unknown species "${instance.speciesId}"`);
    const check = evolveCheck(instance, meta.stages.length, this.config.progress);
    if ('reason' in check) return fail('evolution_blocked', 'already at final form');
    if (!canEvolve(instance, meta.stages.length, this.config.progress)) {
      return fail('evolution_blocked', `needs level ${check.minLevel} and ${check.minStars} stars`);
    }
    if (state.currencies.candy < check.candy || state.currencies.gold < check.gold || state.currencies.stone < check.stones) {
      return fail('insufficient_items', 'not enough candy, gold or stones');
    }
    const next = evolved(instance, meta.stages.length, this.config.progress);
    return this.commit({
      ...state,
      roster: this.replace(state.roster, next),
      currencies: {
        ...state.currencies,
        candy: state.currencies.candy - check.candy,
        gold: state.currencies.gold - check.gold,
        stone: state.currencies.stone - check.stones,
      },
    });
  }

  async respawn(instanceId: string): Promise<Result<AccountSnapshot>> {
    const loaded = await this.load();
    if (!loaded.ok) return loaded;
    const found = this.find(loaded.value, instanceId);
    if (!found) return fail('not_found', `no Wild "${instanceId}"`);
    const { state, instance } = found;
    if (instance.locked) return fail('resource_locked', 'unlock this Wild first');
    if (SQUAD_MODES.some((mode) => state.squads[mode].includes(instance.id))) {
      return fail('resource_locked', 'remove this Wild from your squads first');
    }
    const cost = this.config.progress.respawn.gemCost;
    if (state.currencies.gems < cost) return fail('insufficient_items', 'not enough gems');
    const refund = respawnRefund(instance, this.config.progress);
    return this.commit({
      ...state,
      roster: this.replace(state.roster, respawned(instance)),
      currencies: {
        ...state.currencies,
        gems: state.currencies.gems - cost,
        candy: state.currencies.candy + refund.candy,
        gold: state.currencies.gold + refund.gold,
      },
    });
  }

  async toggleLock(instanceId: string): Promise<Result<AccountSnapshot>> {
    const loaded = await this.load();
    if (!loaded.ok) return loaded;
    const found = this.find(loaded.value, instanceId);
    if (!found) return fail('not_found', `no Wild "${instanceId}"`);
    const { state, instance } = found;
    return this.commit({ ...state, roster: this.replace(state.roster, { ...instance, locked: !instance.locked }) });
  }

  async saveSquad(mode: SquadMode, slots: Squad, strategy: StrategyId): Promise<Result<AccountSnapshot>> {
    if (!SQUAD_MODES.includes(mode)) return fail('invalid_input', `unknown squad mode "${mode}"`);
    if (!STRATEGIES.includes(strategy)) return fail('invalid_input', `unknown strategy "${strategy}"`);
    const loaded = await this.load();
    if (!loaded.ok) return loaded;
    const state = loaded.value;
    if (slots.length !== SQUAD_SIZE) return fail('invalid_squad', `a squad has ${SQUAD_SIZE} slots`);
    const ids = slots.filter((id): id is string => typeof id === 'string');
    if (new Set(ids).size !== ids.length) return fail('invalid_squad', 'duplicate Wild in squad');
    const byId = new Map(state.roster.map((w) => [w.id, w]));
    const species = new Set<string>();
    for (const id of ids) {
      const wild = byId.get(id);
      if (!wild) return fail('invalid_squad', `unknown Wild "${id}"`);
      if (species.has(wild.speciesId)) return fail('invalid_squad', 'only one Wild per species');
      species.add(wild.speciesId);
    }
    return this.commit({
      ...state,
      squads: { ...state.squads, [mode]: [...slots] },
      strategies: { ...state.strategies, [mode]: strategy },
    });
  }

  async autoFormation(mode: SquadMode): Promise<Result<AccountSnapshot>> {
    if (!SQUAD_MODES.includes(mode)) return fail('invalid_input', `unknown squad mode "${mode}"`);
    const loaded = await this.load();
    if (!loaded.ok) return loaded;
    const state = loaded.value;
    const candidates = state.roster.map((w) => {
      const meta = this.config.species.get(w.speciesId);
      return {
        id: w.id,
        speciesId: w.speciesId,
        className: meta?.className ?? 'striker',
        power: this.instancePower(w),
        stars: w.stars,
        level: w.level,
      };
    });
    const squad = runAutoFormation(candidates, state.squads[mode]);
    return this.commit({ ...state, squads: { ...state.squads, [mode]: squad } });
  }

  async setStrategy(mode: SquadMode, strategy: StrategyId): Promise<Result<AccountSnapshot>> {
    if (!SQUAD_MODES.includes(mode)) return fail('invalid_input', `unknown squad mode "${mode}"`);
    if (!STRATEGIES.includes(strategy)) return fail('invalid_input', `unknown strategy "${strategy}"`);
    const loaded = await this.load();
    if (!loaded.ok) return loaded;
    const state = loaded.value;
    return this.commit({ ...state, strategies: { ...state.strategies, [mode]: strategy } });
  }

  async exportSave(): Promise<Result<string>> {
    const loaded = await this.load();
    if (!loaded.ok) return loaded;
    return ok(serializeSave(loaded.value));
  }

  async importSave(json: string): Promise<Result<AccountSnapshot>> {
    const parsed = parseSave(json);
    if (!parsed.ok) return parsed;
    return this.commit(parsed.value);
  }

  async resetAccount(): Promise<Result<AccountSnapshot>> {
    await this.store.remove(BACKUP_KEY);
    return this.commit(createInitialState(this.config));
  }

  // --- internals -----------------------------------------------------------

  private async load(): Promise<Result<AccountState>> {
    if (this.state) return ok(this.state);
    const raw = await this.store.read(SAVE_KEY);
    if (raw === null) {
      const fresh = createInitialState(this.config);
      await this.persist(fresh);
      this.state = fresh;
      return ok(fresh);
    }
    const parsed = parseSave(raw);
    if (parsed.ok) {
      this.state = parsed.value;
      return parsed;
    }
    const backup = await this.store.read(BACKUP_KEY);
    if (backup !== null) {
      const recovered = parseSave(backup);
      if (recovered.ok) {
        await this.persist(recovered.value);
        this.state = recovered.value;
        return recovered;
      }
    }
    return fail('corrupt_save', parsed.message);
  }

  private async persist(state: AccountState): Promise<void> {
    const current = await this.store.read(SAVE_KEY);
    if (current !== null) await this.store.write(BACKUP_KEY, current);
    await this.store.write(SAVE_KEY, serializeSave(state));
  }

  private async commit(state: AccountState): Promise<Result<AccountSnapshot>> {
    this.state = state;
    await this.persist(state);
    return ok(this.snapshot(state));
  }

  private snapshot(state: AccountState): AccountSnapshot {
    const power: Record<string, number> = {};
    for (const wild of state.roster) power[wild.id] = this.instancePower(wild);
    const teamPower = {} as Record<SquadMode, number>;
    for (const mode of SQUAD_MODES) {
      teamPower[mode] = state.squads[mode].reduce((sum, id) => sum + (id ? power[id] ?? 0 : 0), 0);
    }
    return { state, power, teamPower };
  }

  private instancePower(wild: WildInstance): number {
    const meta = this.config.species.get(wild.speciesId);
    if (!meta) return 0;
    const core = resolveCoreStats(
      { base: meta.base, level: wild.level, stars: wild.stars, tier: meta.tier, stage: wild.evolutionStage },
      this.config.growth,
    );
    return computePower(core, {}, this.config.power);
  }

  private find(state: AccountState, instanceId: string): { state: AccountState; instance: WildInstance } | null {
    const instance = state.roster.find((w) => w.id === instanceId);
    return instance ? { state, instance } : null;
  }

  private replace(roster: WildInstance[], next: WildInstance): WildInstance[] {
    return roster.map((w) => (w.id === next.id ? next : w));
  }
}
