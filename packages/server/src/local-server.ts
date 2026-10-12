import {
  addQuestProgress,
  addRewards,
  autoFormation as runAutoFormation,
  canEvolve,
  claimAllMail as runClaimAllMail,
  claimChest,
  claimMail as runClaimMail,
  claimQuest as runClaimQuest,
  claimableChests,
  computePower,
  createMail,
  CURRENCY_IDS,
  dayKey,
  emptyQuestState,
  emptyRewards,
  evolveCheck,
  evolved,
  isCleared,
  isQuestClaimable,
  isUnlocked,
  isZeroRewards,
  levelCapOf,
  leveledUp,
  levelUpCost,
  orderStages,
  pendingIdle,
  pruneMail,
  quickCollect,
  recordStars,
  resolveCoreStats,
  respawnRefund,
  respawned,
  starsForRounds,
  SQUAD_MODES,
  SQUAD_SIZE,
  starUpCost,
  starredUp,
  STRATEGIES,
  TUTORIAL_STEPS,
  unclaimedMail,
  type AccountState,
  type CurrencyId,
  type QuestMetric,
  type Rewards,
  type StageDef,
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
  type BattleView,
  type ClaimResult,
  type GameServer,
  type Result,
  type ServerInfo,
  type StageBattleResult,
} from './index';
import { startBattle as runStartBattle, stageBattle as runStageBattle } from './battle';
import type { GameConfig } from './config';
import { applyGrant, bestIdleRate, bestIdleStageId, stageRewards } from './economy';
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
    const grown = this.withTutorialAction(
      {
        ...state,
        roster: this.replace(state.roster, next),
        currencies: {
          ...state.currencies,
          candy: state.currencies.candy - cost.candy,
          gold: state.currencies.gold - cost.gold,
        },
      },
      'levelUp',
    );
    return this.commit(grown);
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
    return this.commit(
      this.withTutorialAction(
        {
          ...state,
          squads: { ...state.squads, [mode]: [...slots] },
          strategies: { ...state.strategies, [mode]: strategy },
        },
        'setSquad',
      ),
    );
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
    return this.commit(
      this.withTutorialAction({ ...state, squads: { ...state.squads, [mode]: squad } }, 'setSquad'),
    );
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

  async startBattle(mode: SquadMode, seed?: number): Promise<Result<BattleView>> {
    if (!SQUAD_MODES.includes(mode)) return fail('invalid_input', `unknown squad mode "${mode}"`);
    const loaded = await this.load();
    if (!loaded.ok) return loaded;
    const view = runStartBattle(this.config, loaded.value, mode, seed);
    if (!view) return fail('not_found', 'no Wilds available to fight');
    return ok(view);
  }

  async challengeStage(stageId: string, seed?: number): Promise<Result<StageBattleResult>> {
    const loaded = await this.load();
    if (!loaded.ok) return loaded;
    const state = loaded.value;
    const stage = this.config.stageById.get(stageId);
    if (!stage) return fail('not_found', `unknown stage "${stageId}"`);
    const ordered = orderStages(this.config.stages);
    if (!isUnlocked(state.campaign, ordered, stageId)) {
      return fail('stage_locked', 'clear the previous stage first');
    }
    const view = runStageBattle(this.config, state, stage.enemies, stageId, seed);
    if (!view) return fail('not_found', 'no Wilds available to fight');

    const win = view.winner === 'attackers';
    let next = state;
    let stars = 0;
    let firstClear = false;
    let rewards: Rewards = {};
    if (win) {
      firstClear = !isCleared(state.campaign, stageId);
      stars = starsForRounds(view.rounds, stage.starRounds);
      next = { ...next, campaign: recordStars(next.campaign, stageId, stars) };
      rewards = stageRewards(stage, firstClear);
      next = applyGrant(this.config, next, rewards);
      next = this.withQuest(next, 'winBattle');
      next = this.withTutorialAction(next, 'winStage');
      next = this.withChapterMail(next, stage);
    }
    next = { ...next, idle: { ...next.idle, bestStageId: bestIdleStageId(this.config, next) } };
    const committed = await this.commit(next);
    if (!committed.ok) return fail(committed.error, committed.message);
    return ok({
      battle: view,
      stageId,
      win,
      stars,
      firstClear,
      rewards,
      snapshot: committed.value,
    });
  }

  async sweepStage(stageId: string): Promise<Result<ClaimResult>> {
    const loaded = await this.load();
    if (!loaded.ok) return loaded;
    const state = loaded.value;
    const stage = this.config.stageById.get(stageId);
    if (!stage) return fail('not_found', `unknown stage "${stageId}"`);
    if (!isCleared(state.campaign, stageId)) return fail('stage_locked', 'clear this stage before sweeping it');
    const granted = stage.repeat;
    let next = applyGrant(this.config, state, granted);
    next = this.withQuest(next, 'sweepStage');
    return this.commitClaim(next, granted);
  }

  async claimIdle(quick?: boolean): Promise<Result<ClaimResult>> {
    const loaded = await this.load();
    if (!loaded.ok) return loaded;
    const state = loaded.value;
    const rate = bestIdleRate(this.config, state);
    if (isZeroRewards(rate)) return fail('not_found', 'clear a stage to begin earning idle income');
    const now = this.now(state);
    const { capMinutes, quickCollectMinutes, quickCollectGems, quickCollectDailyLimit } = this.config.idle;
    let next = state;
    let granted: Rewards;
    if (quick) {
      const day = dayKey(now);
      const claimsToday = state.idle.quickClaimDay === day ? state.idle.quickClaims : 0;
      if (claimsToday >= quickCollectDailyLimit) return fail('daily_limit', 'no quick-collects left today');
      if (state.currencies.gems < quickCollectGems) return fail('insufficient_items', 'not enough gems');
      granted = quickCollect(rate, state.idle.lastClaimAt, now, capMinutes, quickCollectMinutes);
      next = {
        ...next,
        currencies: { ...next.currencies, gems: next.currencies.gems - quickCollectGems },
        idle: { ...next.idle, lastClaimAt: now, quickClaimDay: day, quickClaims: claimsToday + 1 },
      };
    } else {
      granted = pendingIdle(rate, state.idle.lastClaimAt, now, capMinutes);
      if (isZeroRewards(granted)) return fail('not_ready', 'nothing to collect yet');
      next = { ...next, idle: { ...next.idle, lastClaimAt: now } };
    }
    next = applyGrant(this.config, next, granted);
    next = this.withQuest(next, 'claimIdle');
    return this.commitClaim(next, granted);
  }

  async claimQuest(questId: string): Promise<Result<ClaimResult>> {
    const loaded = await this.load();
    if (!loaded.ok) return loaded;
    const state = loaded.value;
    const def = this.config.quests.find((q) => q.id === questId);
    if (!def) return fail('not_found', `unknown quest "${questId}"`);
    if (!isQuestClaimable(state.quests, def)) return fail('not_ready', 'quest is not ready to claim');
    let next = { ...state, quests: runClaimQuest(state.quests, questId) };
    next = applyGrant(this.config, next, def.rewards);
    next = this.withQuest(next, 'claimQuest');
    return this.commitClaim(next, def.rewards);
  }

  async claimActivityChest(index: number): Promise<Result<ClaimResult>> {
    const loaded = await this.load();
    if (!loaded.ok) return loaded;
    const state = loaded.value;
    const chests = this.config.economy.activityChests;
    if (!Number.isInteger(index) || index < 0 || index >= chests.length) {
      return fail('invalid_input', `no activity chest at index ${index}`);
    }
    const thresholds = chests.map((c) => c.points);
    if (!claimableChests(this.config.quests, state.quests, thresholds).includes(index)) {
      return fail('not_ready', 'not enough activity points yet');
    }
    const chest = chests[index];
    if (!chest) return fail('invalid_input', `no activity chest at index ${index}`);
    let next = { ...state, quests: claimChest(state.quests, index) };
    next = applyGrant(this.config, next, chest.rewards);
    return this.commitClaim(next, chest.rewards);
  }

  async claimMail(id: string): Promise<Result<ClaimResult>> {
    const loaded = await this.load();
    if (!loaded.ok) return loaded;
    const state = loaded.value;
    const item = state.mail.find((m) => m.id === id);
    if (!item) return fail('not_found', `no mail "${id}"`);
    if (item.claimed) return fail('not_ready', 'already claimed');
    let next = { ...state, mail: runClaimMail(state.mail, id) };
    next = applyGrant(this.config, next, item.grants);
    return this.commitClaim(next, item.grants);
  }

  async claimAllMail(): Promise<Result<ClaimResult>> {
    const loaded = await this.load();
    if (!loaded.ok) return loaded;
    const state = loaded.value;
    const pending = unclaimedMail(state.mail);
    if (pending.length === 0) return fail('not_ready', 'no mail to claim');
    const granted = pending.reduce((acc, m) => addRewards(acc, m.grants), emptyRewards());
    let next = { ...state, mail: runClaimAllMail(state.mail) };
    next = applyGrant(this.config, next, granted);
    return this.commitClaim(next, granted);
  }

  async advanceTutorial(): Promise<Result<AccountSnapshot>> {
    const loaded = await this.load();
    if (!loaded.ok) return loaded;
    const state = loaded.value;
    if (state.tutorial.done) return this.commit(state);
    const step = Math.min(state.tutorial.step + 1, TUTORIAL_STEPS);
    return this.commit({ ...state, tutorial: { step, done: step >= TUTORIAL_STEPS } });
  }

  async skipTutorial(): Promise<Result<AccountSnapshot>> {
    const loaded = await this.load();
    if (!loaded.ok) return loaded;
    return this.commit({ ...loaded.value, tutorial: { step: TUTORIAL_STEPS, done: true } });
  }

  async debugAdvanceClock(minutes: number): Promise<Result<AccountSnapshot>> {
    const delta = Math.floor(minutes);
    if (!Number.isFinite(delta) || delta < 0) return fail('invalid_input', 'minutes must be non-negative');
    const loaded = await this.load();
    if (!loaded.ok) return loaded;
    return this.commit({ ...loaded.value, debugClockOffset: loaded.value.debugClockOffset + delta });
  }

  // --- internals -----------------------------------------------------------

  /** The effective game clock: the injected clock plus any debug fast-forward (minutes). */
  private now(state: AccountState): number {
    return this.config.now() + state.debugClockOffset * 60_000;
  }

  /** Bump a daily-quest counter (progress is keyed by metric, shared by quests). */
  private withQuest(state: AccountState, metric: QuestMetric, amount = 1): AccountState {
    return { ...state, quests: addQuestProgress(state.quests, metric, amount) };
  }

  /** Advance the tutorial past the step a completed action satisfies. */
  private withTutorialAction(state: AccountState, action: 'levelUp' | 'setSquad' | 'winStage'): AccountState {
    if (state.tutorial.done) return state;
    const step = state.tutorial.step;
    if (action === 'levelUp' && step === 0) return { ...state, tutorial: { step: 1, done: false } };
    if (action === 'setSquad' && step === 1) return { ...state, tutorial: { step: 2, done: false } };
    if (action === 'winStage' && step <= 2) return { ...state, tutorial: { step: TUTORIAL_STEPS, done: true } };
    return state;
  }

  /** Send a one-off chapter-complete letter the first time a chapter is cleared. */
  private withChapterMail(state: AccountState, stage: StageDef): AccountState {
    const chapterStages = this.config.stages.filter((s) => s.chapter === stage.chapter);
    const isLast = stage.index === Math.max(...chapterStages.map((s) => s.index));
    if (!isLast) return state;
    const id = `mail_chapter_${stage.chapter}`;
    if (state.mail.some((m) => m.id === id)) return state;
    const now = this.now(state);
    const letter = createMail({
      id,
      subjectKey: 'mail.chapter.subject',
      bodyKey: 'mail.chapter.body',
      grants: { gems: 100 + stage.chapter * 50 },
      createdAt: now,
      ttlMs: Math.round(this.config.economy.mailTtlHours * 3_600_000),
    });
    return { ...state, mail: [...state.mail, letter] };
  }

  private async commitClaim(state: AccountState, granted: Rewards): Promise<Result<ClaimResult>> {
    const committed = await this.commit(state);
    if (!committed.ok) return fail(committed.error, committed.message);
    return ok({ granted, snapshot: committed.value });
  }

  private async load(): Promise<Result<AccountState>> {
    if (this.state) return this.accept(this.state);
    const raw = await this.store.read(SAVE_KEY);
    if (raw === null) {
      const fresh = createInitialState(this.config);
      await this.persist(fresh);
      this.state = fresh;
      return ok(fresh);
    }
    const parsed = parseSave(raw, this.config.now());
    if (parsed.ok) return this.accept(parsed.value);
    const backup = await this.store.read(BACKUP_KEY);
    if (backup !== null) {
      const recovered = parseSave(backup, this.config.now());
      if (recovered.ok) return this.accept(recovered.value);
    }
    return fail('corrupt_save', parsed.message);
  }

  /** Normalize a loaded state (daily reset, mail prune) and cache/persist it. */
  private async accept(state: AccountState): Promise<Result<AccountState>> {
    const { state: next, changed } = this.normalize(state);
    this.state = next;
    if (changed) await this.persist(next);
    return ok(next);
  }

  /** Apply the 00:00 UTC daily reset and drop expired mail. */
  private normalize(state: AccountState): { state: AccountState; changed: boolean } {
    const day = dayKey(this.now(state));
    let next = state;
    let changed = false;
    if (state.quests.day !== day) {
      next = {
        ...next,
        quests: emptyQuestState(day),
        idle: { ...next.idle, quickClaimDay: day, quickClaims: 0 },
      };
      changed = true;
    }
    const pruned = pruneMail(next.mail, this.now(next));
    if (pruned.length !== next.mail.length) {
      next = { ...next, mail: pruned };
      changed = true;
    }
    return { state: next, changed };
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
