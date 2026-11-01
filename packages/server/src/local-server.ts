import {
  berriesView,
  breakthroughBerryAction,
  cultivateBerryAction,
  dismantleBerriesAction,
  elevateBerryAction,
  equipBerryAction,
  grantBerry,
  lockBerryAction,
  reforgeBerryAction,
  rebirthBerryAction,
  type BerriesPanelView,
} from './berries';
import {
  dismantleOrbsAction,
  equipOrbAction,
  grantOrb,
  levelOrbAction,
  lockOrbAction,
  orbsView,
  type OrbsPanelView,
} from './orbs';
import {
  levelPotentialAction,
  potentialView,
  resetPotentialAction,
  unlockPotentialAction,
  type PotentialView,
} from './potential';
import {
  addQuestProgress,
  addRewards,
  autoFormation as runAutoFormation,
  claimAllMail as runClaimAllMail,
  claimChest,
  claimMail as runClaimMail,
  claimQuest as runClaimQuest,
  claimableChests,
  createMail,
  CURRENCY_IDS,
  dayKey,
  emptyQuestState,
  emptyRewards,
  expireTitles,
  isCleared,
  isGymAvailable,
  isGymCleared,
  isQuestClaimable,
  isQuestOffered,
  isUnlocked,
  isZeroRewards,
  leveledUp,
  levelUpCost,
  mulberry32,
  orderStages,
  pendingIdle,
  pruneMail,
  quickCollect,
  recordGymClear,
  recordStars,
  respawnRefund,
  respawned,
  starsForRounds,
  SQUAD_MODES,
  SQUAD_SIZE,
  starredUp,
  starRange,
  STRATEGIES,
  TUTORIAL_STEPS,
  unclaimedMail,
  unmetGate,
  type AccountState,
  type CurrencyId,
  type MachineId,
  type QuestMetric,
  type Rewards,
  type StageDef,
  type Squad,
  type SquadMode,
  type StrategyId,
  type TitleSlot,
  type DungeonGrade,
  type TowerKind,
  type SkillRow,
  type WildInstance,
} from '@wildbound/engine';
import {
  fail,
  GAME,
  ok,
  type AccountSnapshot,
  type ArenaBattleResult,
  type ArenaBuyResult,
  type ArenaRankingsView,
  type ArenaView,
  type BattleView,
  type ClaimResult,
  type DungeonBattleResult,
  type EquipmentView,
  type GameServer,
  type GachaView,
  type GymBattleResult,
  type RankedBuyResult,
  type RankedMatchResult,
  type Result,
  type ServerInfo,
  type ShopView,
  type SkyPillarBattleResult,
  type SkyPillarSweepResult,
  type StageBattleResult,
  type SummonResult,
  type TowerBattleResult,
  type TrialBattleResult,
  type WorldBossBattleResult,
} from './index';
import type { DungeonCardView, TowerView, TrialCardView, WorldBossView } from './pve-view';
import { buildExploreView } from './explore-view';
import type { ExploreView } from './explore-view';
import { buildPetHomeView, type PetHomeView } from './pet-home-view';
import { buildSkyPillarView, type SkyPillarView } from './sky-pillar-view';
import {
  challengeSkyPillar as challengeSkyPillarAction,
  claimSkyPillarChest as claimSkyPillarChestAction,
  prepareSkyPillar,
  sweepSkyPillar as sweepSkyPillarAction,
} from './sky-pillar';
import {
  buyShopOfferAction,
  claimLevelAction,
  mergePetsAction,
  openPetAction,
  preparePetHome,
  refreshShopAction,
  releasePetAction,
  summonPetAction,
  unlockTileAction,
} from './pet-home';
import {
  startBattle as runStartBattle,
  stageBattle as runStageBattle,
  modeBattle as runModeBattle,
  powerOf,
} from './battle';
import { emptyLoadout } from '@wildbound/engine';
import { cardOf, firstStar, type GameConfig } from './config';
import { evolutionView } from './growth';
import { applyGrant, bestIdleRate, bestIdleStageId, stageRewards } from './economy';
import {
  challengeDungeon as challengeDungeonAction,
  settleWorldBoss,
  sweepDungeon as sweepDungeonAction,
  claimDungeonChest as claimDungeonChestAction,
  challengeTower as challengeTowerAction,
  challengeTrial as challengeTrialAction,
  challengeWorldBoss as challengeWorldBossAction,
  claimWorldBossMilestone as claimWorldBossMilestoneAction,
  sweepTower as sweepTowerAction,
} from './pve';
import {
  buildDungeonsView,
  buildTowerView,
  buildTrialsView,
  buildWorldBossView,
} from './pve-view';
import {
  buyArenaAttempts as buyArenaAttemptsAction,
  buyRankedAttempts as buyRankedAttemptsAction,
  challengeArena as challengeArenaAction,
  claimArenaAchievement as claimArenaAchievementAction,
  claimArenaChest as claimArenaChestAction,
  claimRankedGift as claimRankedGiftAction,
  claimRankedTier as claimRankedTierAction,
  refreshArena as refreshArenaAction,
  startRankedMatch as startRankedMatchAction,
  rollPvp,
  arenaTuning,
  rankedTuning,
} from './pvp';
import { buildArenaRankingsView, buildArenaView } from './pvp-view';
import { buildRankedView, type RankedView } from './pvp-ranked-view';
import { buildPvpHubView, type PvpHubView } from './pvp-hub-view';
import {
  composeWildAction,
  grantSpeciesShardsAction,
  originSkillsView,
  upgradeOriginSkillAction,
  type OriginSkillsView,
} from './shards';
import {
  equipCoreAction,
  equipRelicAction,
  levelRelicAction,
  refineRelicAction,
  settleRefineAction,
  lockRelicAction,
  dismantleRelicsAction,
  compoundResettersAction,
  starUpCoreAction,
  consumeFodder,
} from './equipment';
import { buildEquipmentView } from './equipment-view';
import { upgradePlateAction } from './plates';
import { grantTrinketItem, trinketOf, upgradeTrinketAction } from './trinkets';
import {
  buildResonanceView,
  buyResonanceSlotAction,
  clearResonanceCooldownAction,
  evolveResonanceAction,
  isResonating,
  setResonanceSlotAction,
  syncResonance,
  upgradeResonanceAction,
} from './resonance';
import { buildVipView, vipIdleCapMinutes, vipPerks } from './vip';
import { buildTokensView, grantTokenFragments, levelTokenAction } from './tokens';
import {
  ascendFashionPieceAction,
  buildFashionView,
  grantFashionShards,
  levelFashionAction,
  wearFashionPieceAction,
  type FashionView,
} from './fashion';
import type { FashionLadder, FashionSlot } from '@wildbound/content';
import {
  buildSignInView,
  claimSignInMilestoneAction,
  doubleSignInAction,
  patchSignInAction,
  signTodayAction,
  type SignInResult,
  type SignInView,
} from './signin';
import { activateTitleAction, buildTitlesView, grantTitleCards, setTitleSlotAction } from './titles';
import { applyClaimBox, applySetWish, applySummon, gachaView as buildGachaView } from './gacha';
import { applyBuy, applyRefresh, shopsView as buildShopsView } from './shops';
import {
  BACKUP_KEY,
  createInitialState,
  freshStartMail,
  parseSave,
  RETIRED_KEY,
  SAVE_KEY,
  serializeSave,
} from './save';
import type { SaveStore } from './storage';
import type { OrbColour } from '@wildbound/engine';

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
      stars: firstStar(meta),
      locked: false,
      acquiredAt: this.config.now(),
    };
    return this.commit({
      ...state,
      roster: [...state.roster, instance],
      nextInstanceSeq: state.nextInstanceSeq + 1,
      loadouts: { ...state.loadouts, [instance.id]: emptyLoadout(this.config.equipment.tuning) },
    });
  }

  // --- E4: species shards and Origin skill levels -----------------------------

  async composeWild(speciesId: string): Promise<Result<AccountSnapshot>> {
    const loaded = await this.load();
    if (!loaded.ok) return loaded;
    const next = composeWildAction(this.config, loaded.value, speciesId, this.config.now());
    return next.ok ? this.commit(next.value) : next;
  }

  async upgradeOriginSkill(wildId: string, row: SkillRow): Promise<Result<AccountSnapshot>> {
    const loaded = await this.load();
    if (!loaded.ok) return loaded;
    const next = upgradeOriginSkillAction(this.config, loaded.value, wildId, row);
    return next.ok ? this.commit(next.value) : next;
  }

  async getOriginSkills(wildId: string): Promise<Result<OriginSkillsView | null>> {
    const loaded = await this.load();
    if (!loaded.ok) return loaded;
    return ok(originSkillsView(this.config, loaded.value, wildId));
  }

  /** Debug / test support: add a species' shards (there is no in-game source until R9). */
  async grantSpeciesShards(speciesId: string, amount: number): Promise<Result<AccountSnapshot>> {
    const loaded = await this.load();
    if (!loaded.ok) return loaded;
    const next = grantSpeciesShardsAction(this.config, loaded.value, speciesId, amount);
    return next.ok ? this.commit(next.value) : next;
  }

  async grantRandomWild(): Promise<Result<AccountSnapshot>> {
    const ids = [...this.config.species.keys()].sort();
    if (ids.length === 0) return fail('not_found', 'no species available');
    const pick = ids[Math.floor(this.config.rng() * ids.length)] ?? ids[0];
    return this.grantWild(pick as string);
  }

  async grantTrinketItem(speciesId: string, amount: number): Promise<Result<AccountSnapshot>> {
    if (!trinketOf(this.config, speciesId)) return fail('not_found', `no trinket for ${speciesId}`);
    if (!Number.isFinite(amount) || amount < 0) return fail('invalid_input', 'amount must be non-negative');
    const loaded = await this.load();
    if (!loaded.ok) return loaded;
    return this.commit(grantTrinketItem(loaded.value, speciesId, Math.floor(amount)));
  }

  async grantTitleCards(titleId: string, amount: number): Promise<Result<AccountSnapshot>> {
    const title = this.config.titleById.get(titleId);
    if (!title || title.card === null) return fail('not_found', `no activation card for title "${titleId}"`);
    if (!Number.isFinite(amount) || amount < 0) return fail('invalid_input', 'amount must be non-negative');
    const loaded = await this.load();
    if (!loaded.ok) return loaded;
    return this.commit(grantTitleCards(loaded.value, titleId, Math.floor(amount)));
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
    // R7: a Pokémon sharing the crystal level cannot be levelled by hand.
    if (isResonating(state, instance.id)) return fail('resource_locked', 'Resonating Pokémon take the crystal level');
    const cap = this.levelCapFor(instance, state);
    const target = Math.min(cap, instance.level + Math.max(0, Math.floor(levels)));
    if (target <= instance.level) return fail('at_level_cap', 'already at this stage\'s level cap');
    const cost = levelUpCost(instance.level, target, this.config.progress);
    if (state.currencies.candy < cost.candy || state.currencies.gold < cost.gold) {
      return fail('insufficient_items', 'not enough candy or gold');
    }
    const next = leveledUp(instance, target - instance.level, cap);
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
    return this.commit(syncResonance(this.config, this.withQuest(grown, 'levelUp')));
  }

  async evolve(instanceId: string): Promise<Result<AccountSnapshot>> {
    const loaded = await this.load();
    if (!loaded.ok) return loaded;
    const found = this.find(loaded.value, instanceId);
    if (!found) return fail('not_found', `no Wild "${instanceId}"`);
    const { state, instance } = found;
    const meta = this.config.species.get(instance.speciesId);
    if (!meta) return fail('not_found', `unknown species "${instance.speciesId}"`);
    const view = evolutionView(state, (id) => this.config.species.get(id), instance.id);
    if (!view || !view.next) return fail('evolution_blocked', 'already at the top star');
    if (view.blocked === 'awakening') {
      return fail('evolution_blocked', `${view.next.star}★ comes from Awakening, which arrives in a later milestone`);
    }
    if (!view.ready) {
      const short = view.requirements.find((r) => r.have < r.count);
      return fail('insufficient_items', short ? `needs ${short.count} × ${short.star}★ ${short.own ? meta.name : `${short.faction ?? 'any'} Pokémon`}` : 'missing fodder');
    }
    const consumed = consumeFodder(state, view.consume);
    const next = starredUp(instance, starRange(meta.stars).max);
    const grown = this.withQuest({ ...consumed, roster: this.replace(consumed.roster, next) }, 'starUp');
    return this.commit(grown);
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
        power: this.instancePower(w, state),
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
    const parsed = parseSave(json, this.config.now(), this.config);
    if (!parsed.ok) return parsed;
    this.state = null; // a replaced account is not an action: nothing counts toward the dailies
    return this.commit(parsed.value);
  }

  async resetAccount(): Promise<Result<AccountSnapshot>> {
    await this.store.remove(BACKUP_KEY);
    this.state = null;
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
      const blockingGymId = unmetGate(state.campaign, ordered, stageId);
      const blockingGym = blockingGymId ? this.config.gymById.get(blockingGymId) : undefined;
      return fail(
        'stage_locked',
        blockingGym ? `defeat ${blockingGym.name} to open this stage` : 'clear the previous stage first',
      );
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

  async challengeGym(gymId: string, seed?: number): Promise<Result<GymBattleResult>> {
    const loaded = await this.load();
    if (!loaded.ok) return loaded;
    const state = loaded.value;
    const gym = this.config.gymById.get(gymId);
    if (!gym) return fail('not_found', `unknown gym "${gymId}"`);
    const ordered = orderStages(this.config.stages);
    if (!isGymAvailable(state.campaign, ordered, gymId)) {
      return fail('stage_locked', 'clear the previous chapter before challenging this gym');
    }
    const view = runModeBattle(this.config, state, {
      squadMode: 'campaign',
      label: 'gymGate',
      enemies: gym.enemies,
      battleId: `gym:${gymId}`,
      seed,
    });
    if (!view) return fail('not_found', 'no Wilds available to fight');

    const win = view.winner === 'attackers';
    let next = state;
    let firstClear = false;
    let rewards: Rewards = {};
    if (win) {
      firstClear = !isGymCleared(state.campaign, gymId);
      if (firstClear) {
        next = { ...next, campaign: recordGymClear(next.campaign, gymId) };
        rewards = gym.firstClear;
        next = applyGrant(this.config, next, rewards);
      }
      next = this.withQuest(next, 'winBattle');
    }
    const committed = await this.commit(next);
    if (!committed.ok) return fail(committed.error, committed.message);
    return ok({
      battle: view,
      gymId,
      win,
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
    const { quickCollectMinutes, quickCollectGems } = this.config.idle;
    // R8: the VIP level sets the idle cap and the Quick Combat (quick-collect) count, the first ones free.
    const cap = vipIdleCapMinutes(this.config, state);
    const perks = vipPerks(this.config, state);
    const quickCollectDailyLimit = perks.quickCombat;
    let next = state;
    let granted: Rewards;
    if (quick) {
      const day = dayKey(now);
      const claimsToday = state.idle.quickClaimDay === day ? state.idle.quickClaims : 0;
      if (claimsToday >= quickCollectDailyLimit) return fail('daily_limit', 'no quick-collects left today');
      const quickPrice = claimsToday < perks.quickCombatFree ? 0 : quickCollectGems;
      if (state.currencies.gems < quickPrice) return fail('insufficient_items', 'not enough gems');
      granted = quickCollect(rate, state.idle.lastClaimAt, now, cap, quickCollectMinutes);
      next = {
        ...next,
        currencies: { ...next.currencies, gems: next.currencies.gems - quickPrice },
        idle: { ...next.idle, lastClaimAt: now, quickClaimDay: day, quickClaims: claimsToday + 1 },
      };
    } else {
      granted = pendingIdle(rate, state.idle.lastClaimAt, now, cap);
      if (isZeroRewards(granted)) return fail('not_ready', 'nothing to collect yet');
      next = { ...next, idle: { ...next.idle, lastClaimAt: now } };
    }
    next = applyGrant(this.config, next, granted);
    // R9: the source dailies count a claim (Claim AFK XP) and a Quick Combat separately.
    next = this.withQuest(next, quick ? 'quickCombat' : 'claimIdle');
    return this.commitClaim(next, granted);
  }

  async claimQuest(questId: string): Promise<Result<ClaimResult>> {
    const loaded = await this.load();
    if (!loaded.ok) return loaded;
    const state = loaded.value;
    const def = this.config.quests.find((q) => q.id === questId);
    if (!def) return fail('not_found', `unknown quest "${questId}"`);
    if (!isQuestOffered(def, state.profile.level)) return fail('resource_locked', 'quest is not offered yet');
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

  async summon(machine: MachineId, count: number, seed?: number): Promise<Result<SummonResult>> {
    if (machine !== 'common' && machine !== 'premium') return fail('invalid_input', `unknown machine "${machine}"`);
    const loaded = await this.load();
    if (!loaded.ok) return loaded;
    const state = loaded.value;
    const rng = typeof seed === 'number' ? mulberry32(seed) : this.config.rng;
    const applied = applySummon(this.config, state, machine, count, this.now(state), rng);
    if (!applied.ok) return fail(applied.error, applied.message);
    // R9: the source daily counts Premium summons ({chest,2}).
    const summoned = machine === 'premium' ? this.withQuest(applied.value.state, 'premiumSummon', count) : applied.value.state;
    const committed = await this.commit(summoned);
    if (!committed.ok) return fail(committed.error, committed.message);
    return ok({
      machine,
      count,
      draws: applied.value.draws,
      cost: applied.value.cost,
      snapshot: committed.value,
    });
  }

  async claimGachaBox(machine: MachineId): Promise<Result<ClaimResult>> {
    const loaded = await this.load();
    if (!loaded.ok) return loaded;
    const applied = applyClaimBox(this.config, loaded.value, machine, this.now(loaded.value));
    if (!applied.ok) return fail(applied.error, applied.message);
    return this.commitClaim(applied.value.state, applied.value.granted);
  }

  async setWish(speciesId: string | null): Promise<Result<AccountSnapshot>> {
    const loaded = await this.load();
    if (!loaded.ok) return loaded;
    const applied = applySetWish(this.config, loaded.value, speciesId, this.now(loaded.value));
    if (!applied.ok) return fail(applied.error, applied.message);
    return this.commit(applied.value.state);
  }

  async getGacha(): Promise<Result<GachaView>> {
    const loaded = await this.load();
    if (!loaded.ok) return loaded;
    return ok(buildGachaView(this.config, loaded.value, this.now(loaded.value)));
  }

  async buyShopItem(shopId: string, itemId: string): Promise<Result<ClaimResult>> {
    const loaded = await this.load();
    if (!loaded.ok) return loaded;
    const applied = applyBuy(this.config, loaded.value, shopId, itemId, this.now(loaded.value));
    if (!applied.ok) return fail(applied.error, applied.message);
    return this.commitClaim(this.withQuest(applied.value.state, 'shopBuy'), applied.value.granted);
  }

  async refreshShop(shopId: string): Promise<Result<ClaimResult>> {
    const loaded = await this.load();
    if (!loaded.ok) return loaded;
    const applied = applyRefresh(this.config, loaded.value, shopId, this.now(loaded.value));
    if (!applied.ok) return fail(applied.error, applied.message);
    return this.commitClaim(applied.value.state, applied.value.granted);
  }

  async getShops(): Promise<Result<ShopView[]>> {
    const loaded = await this.load();
    if (!loaded.ok) return loaded;
    return ok(buildShopsView(this.config, loaded.value, this.now(loaded.value)));
  }

  // --- equipment (M7) -------------------------------------------------------

  async getEquipment(wildId: string): Promise<Result<EquipmentView>> {
    const loaded = await this.load();
    if (!loaded.ok) return loaded;
    const wild = loaded.value.roster.find((w) => w.id === wildId);
    if (!wild) return fail('not_found', `no Wild ${wildId}`);
    return ok(buildEquipmentView({ config: this.config, state: loaded.value, wild }));
  }

  async equipRelic(wildId: string, instanceId: string | null, force = false): Promise<Result<AccountSnapshot>> {
    return this.applyEquipment((state) => equipRelicAction(this.config, state, wildId, instanceId, force));
  }

  async getOrbs(wildId: string): Promise<Result<OrbsPanelView>> {
    const loaded = await this.load();
    if (!loaded.ok) return loaded;
    const view = orbsView(this.config, loaded.value, wildId);
    return view ? ok(view) : fail('not_found', `no Wild ${wildId}`);
  }

  async equipOrb(wildId: string, socket: number, orbId: string | null, force = false): Promise<Result<AccountSnapshot>> {
    return this.applyEquipment((state) => equipOrbAction(this.config, state, wildId, socket, orbId, force));
  }

  async levelOrb(orbId: string, quick = false): Promise<Result<AccountSnapshot>> {
    return this.applyEquipment((state) => levelOrbAction(this.config, state, orbId, quick));
  }

  async lockOrb(orbId: string): Promise<Result<AccountSnapshot>> {
    return this.applyEquipment((state) => lockOrbAction(state, orbId));
  }

  async dismantleOrbs(orbIds: string[]): Promise<Result<AccountSnapshot>> {
    return this.applyEquipment((state) => dismantleOrbsAction(this.config, state, orbIds));
  }

  async grantOrb(kind: string, colour: OrbColour, level = 1): Promise<Result<AccountSnapshot>> {
    return this.applyEquipment((state) => grantOrb(this.config, state, kind, colour, this.config.rng, level));
  }

  async equipCore(wildId: string, socket: number, instanceId: string | null, force = false): Promise<Result<AccountSnapshot>> {
    return this.applyEquipment((state) => equipCoreAction(this.config, state, wildId, socket, instanceId, force));
  }

  async starUpCore(instanceId: string): Promise<Result<AccountSnapshot>> {
    return this.applyEquipment((state) => starUpCoreAction(this.config, state, instanceId));
  }

  async getBerries(wildId: string): Promise<Result<BerriesPanelView>> {
    const loaded = await this.load();
    if (!loaded.ok) return loaded;
    return berriesView(this.config, loaded.value, wildId);
  }

  async equipBerry(wildId: string, slot: number, berryId: string | null): Promise<Result<AccountSnapshot>> {
    return this.applyEquipment((state) => equipBerryAction(this.config, state, wildId, slot, berryId));
  }

  async cultivateBerry(berryId: string, times = 1): Promise<Result<AccountSnapshot>> {
    return this.applyEquipment((state) => cultivateBerryAction(this.config, state, berryId, times, this.config.rng));
  }

  async breakthroughBerry(berryId: string): Promise<Result<AccountSnapshot>> {
    return this.applyEquipment((state) => breakthroughBerryAction(this.config, state, berryId, this.config.rng));
  }

  async reforgeBerry(berryId: string, line: number): Promise<Result<AccountSnapshot>> {
    return this.applyEquipment((state) => reforgeBerryAction(this.config, state, berryId, line, this.config.rng));
  }

  async elevateBerry(berryId: string): Promise<Result<AccountSnapshot>> {
    return this.applyEquipment((state) => elevateBerryAction(this.config, state, berryId));
  }

  async rebirthBerry(berryId: string): Promise<Result<AccountSnapshot>> {
    return this.applyEquipment((state) => rebirthBerryAction(this.config, state, berryId, this.config.rng));
  }

  async lockBerry(berryId: string, locked: boolean): Promise<Result<AccountSnapshot>> {
    return this.applyEquipment((state) => lockBerryAction(state, berryId, locked));
  }

  async dismantleBerries(berryIds: string[]): Promise<Result<AccountSnapshot>> {
    return this.applyEquipment((state) => dismantleBerriesAction(this.config, state, berryIds));
  }

  async grantBerry(defId: string): Promise<Result<AccountSnapshot>> {
    return this.applyEquipment((state) => grantBerry(this.config, state, defId, this.config.rng));
  }


  async levelRelic(instanceId: string): Promise<Result<AccountSnapshot>> {
    return this.applyEquipment((state) => levelRelicAction(this.config, state, instanceId));
  }

  async refineRelic(instanceId: string, slot: number, seed?: number): Promise<Result<AccountSnapshot>> {
    const rng = typeof seed === 'number' ? mulberry32(seed) : this.config.rng;
    return this.applyEquipment((state) => refineRelicAction(this.config, state, instanceId, slot, rng));
  }

  async settleRefine(instanceId: string, keep: boolean): Promise<Result<AccountSnapshot>> {
    return this.applyEquipment((state) => settleRefineAction(this.config, state, instanceId, keep));
  }

  async lockRelic(instanceId: string): Promise<Result<AccountSnapshot>> {
    return this.applyEquipment((state) => lockRelicAction(this.config, state, instanceId));
  }

  async dismantleRelics(instanceIds: string[]): Promise<Result<AccountSnapshot>> {
    return this.applyEquipment((state) => dismantleRelicsAction(this.config, state, instanceIds));
  }

  async compoundResetters(count: number): Promise<Result<AccountSnapshot>> {
    return this.applyEquipment((state) => compoundResettersAction(this.config, state, count));
  }

  async upgradePlate(wildId: string): Promise<Result<AccountSnapshot>> {
    return this.applyEquipment((state) => upgradePlateAction(this.config, state, wildId));
  }

  async upgradeTrinket(wildId: string): Promise<Result<AccountSnapshot>> {
    return this.applyEquipment((state) => upgradeTrinketAction(this.config, state, wildId));
  }

  async buyResonanceSlot(): Promise<Result<AccountSnapshot>> {
    return this.applyEquipment((state) => buyResonanceSlotAction(this.config, state));
  }

  async setResonanceSlot(slot: number, wildId: string | null): Promise<Result<AccountSnapshot>> {
    return this.applyEquipment((state) => setResonanceSlotAction(this.config, state, slot, wildId, this.now(state)));
  }

  async clearResonanceCooldown(slot: number): Promise<Result<AccountSnapshot>> {
    return this.applyEquipment((state) => clearResonanceCooldownAction(this.config, state, slot, this.now(state)));
  }

  async evolveResonance(): Promise<Result<AccountSnapshot>> {
    return this.applyEquipment((state) => evolveResonanceAction(this.config, state));
  }

  async upgradeResonance(): Promise<Result<AccountSnapshot>> {
    return this.applyEquipment((state) => upgradeResonanceAction(this.config, state));
  }

  async activateTitle(titleId: string): Promise<Result<AccountSnapshot>> {
    return this.applyEquipment((state) =>
      activateTitleAction(this.config, state, titleId, this.now(state)),
    );
  }

  async setTitleSlot(slot: TitleSlot, titleId: string | null): Promise<Result<AccountSnapshot>> {
    return this.applyEquipment((state) =>
      setTitleSlotAction(this.config, state, slot, titleId, this.now(state)),
    );
  }

  // --- R8 Mount / Back Decor / Follower / Outfits ---------------------------------

  async getFashion(): Promise<Result<FashionView>> {
    const loaded = await this.load();
    if (!loaded.ok) return loaded;
    const state = loaded.value;
    return ok(buildFashionView(this.config, state, (id) => Boolean(state.titles.owned[id])));
  }

  async levelFashion(ladder: FashionLadder, levels: number): Promise<Result<AccountSnapshot>> {
    return this.applyEquipment((state) => levelFashionAction(this.config, state, ladder, levels));
  }

  async ascendFashionPiece(slot: FashionSlot, index: number): Promise<Result<AccountSnapshot>> {
    return this.applyEquipment((state) => ascendFashionPieceAction(this.config, state, slot, index));
  }

  async wearFashionPiece(slot: FashionSlot, index: number): Promise<Result<AccountSnapshot>> {
    return this.applyEquipment((state) => wearFashionPieceAction(this.config, state, slot, index));
  }

  async grantFashionShards(slot: FashionSlot, index: number, amount: number): Promise<Result<AccountSnapshot>> {
    if (!this.config.fashion.pieces.some((p) => p.slot === slot && p.index === index && !p.free)) {
      return fail('not_found', `no ${slot} piece ${index} to grant`);
    }
    if (!Number.isFinite(amount) || amount < 0) return fail('invalid_input', 'amount must be non-negative');
    const loaded = await this.load();
    if (!loaded.ok) return loaded;
    return this.commit(grantFashionShards(loaded.value, slot, index, Math.floor(amount)));
  }

  // --- R9 Sign In --------------------------------------------------------------

  async getSignIn(): Promise<Result<SignInView>> {
    const loaded = await this.load();
    if (!loaded.ok) return loaded;
    return ok(buildSignInView(this.config, loaded.value, this.now(loaded.value)));
  }

  async signIn(): Promise<Result<ClaimResult>> {
    return this.signInStep((state, now) => signTodayAction(this.config, state, now));
  }

  async patchSignIn(day: number): Promise<Result<ClaimResult>> {
    return this.signInStep((state, now) => patchSignInAction(this.config, state, day, now));
  }

  async doubleSignIn(day: number): Promise<Result<ClaimResult>> {
    return this.signInStep((state, now) => doubleSignInAction(this.config, state, day, now));
  }

  async claimSignInMilestone(index: number): Promise<Result<ClaimResult>> {
    return this.signInStep((state, now) => claimSignInMilestoneAction(this.config, state, index, now));
  }

  private async signInStep(step: (state: AccountState, now: number) => Result<SignInResult>): Promise<Result<ClaimResult>> {
    const loaded = await this.load();
    if (!loaded.ok) return loaded;
    const done = step(loaded.value, this.now(loaded.value));
    if (!done.ok) return fail(done.error, done.message);
    return this.commitClaim(done.value.state, done.value.granted);
  }

  async levelToken(tokenId: number): Promise<Result<AccountSnapshot>> {
    return this.applyEquipment((state) => levelTokenAction(this.config, state, tokenId));
  }

  async grantTokenFragments(tokenId: number, amount: number): Promise<Result<AccountSnapshot>> {
    if (!this.config.tokens.tokens.some((t) => t.id === tokenId)) return fail('not_found', `no token ${tokenId}`);
    if (!Number.isFinite(amount) || amount < 0) return fail('invalid_input', 'amount must be non-negative');
    const loaded = await this.load();
    if (!loaded.ok) return loaded;
    return this.commit(grantTokenFragments(loaded.value, tokenId, Math.floor(amount)));
  }


  // --- R4 Potential ---------------------------------------------------------

  async getPotential(wildId: string): Promise<Result<PotentialView>> {
    const loaded = await this.load();
    if (!loaded.ok) return loaded;
    const view = potentialView(this.config, loaded.value, wildId);
    return view ? ok(view) : fail('not_found', `no Wild ${wildId}`);
  }

  async unlockPotential(wildId: string, tier: number, option: number): Promise<Result<AccountSnapshot>> {
    return this.applyEquipment((state) => unlockPotentialAction(this.config, state, wildId, tier, option));
  }

  async levelPotential(wildId: string, tier: number): Promise<Result<AccountSnapshot>> {
    return this.applyEquipment((state) => levelPotentialAction(this.config, state, wildId, tier));
  }

  async resetPotential(wildId: string): Promise<Result<AccountSnapshot>> {
    return this.applyEquipment((state) => resetPotentialAction(this.config, state, wildId, this.now(state)));
  }

  // --- M8 PvE modes --------------------------------------------------------

  async getTower(): Promise<Result<TowerView>> {
    const loaded = await this.load();
    if (!loaded.ok) return loaded;
    const state = loaded.value;
    return ok(buildTowerView(this.config, state, this.now(state)));
  }

  async challengeTower(seed?: number, kind: TowerKind = 'normal'): Promise<Result<TowerBattleResult>> {
    const loaded = await this.load();
    if (!loaded.ok) return loaded;
    const state = loaded.value;
    const outcome = challengeTowerAction(this.config, state, this.now(state), seed, kind);
    if (!outcome.ok) return fail(outcome.error, outcome.message);
    const value = outcome.value;
    let next = this.withQuest(value.state, 'towerChallenge');
    if (value.win) next = this.withQuest(next, 'winBattle');
    next = this.withTutorialAction(next, 'winStage');
    const committed = await this.commit(next);
    if (!committed.ok) return fail(committed.error, committed.message);
    return ok({
      battle: value.battle,
      floor: value.extra.floor,
      win: value.win,
      rewards: value.rewards,
      snapshot: committed.value,
    });
  }

  async sweepTower(): Promise<Result<ClaimResult>> {
    const loaded = await this.load();
    if (!loaded.ok) return loaded;
    const state = loaded.value;
    const outcome = sweepTowerAction(this.config, state, this.now(state));
    if (!outcome.ok) return fail(outcome.error, outcome.message);
    const next = this.withQuest(outcome.value.state, 'sweepStage');
    return this.commitClaim(next, outcome.value.granted);
  }

  async getTrials(): Promise<Result<TrialCardView[]>> {
    const loaded = await this.load();
    if (!loaded.ok) return loaded;
    const state = loaded.value;
    return ok(buildTrialsView(this.config, state, this.now(state)));
  }

  async challengeTrial(trialId: string, seed?: number): Promise<Result<TrialBattleResult>> {
    const loaded = await this.load();
    if (!loaded.ok) return loaded;
    const state = loaded.value;
    const outcome = challengeTrialAction(this.config, state, trialId, this.now(state), seed);
    if (!outcome.ok) return fail(outcome.error, outcome.message);
    const value = outcome.value;
    let next = value.state;
    if (value.win) next = this.withQuest(next, 'winBattle');
    const committed = await this.commit(next);
    if (!committed.ok) return fail(committed.error, committed.message);
    return ok({
      battle: value.battle,
      trialId: value.extra.trialId,
      win: value.win,
      firstToday: value.extra.firstToday,
      rewards: value.rewards,
      snapshot: committed.value,
    });
  }

  async getWorldBoss(): Promise<Result<WorldBossView>> {
    const loaded = await this.load();
    if (!loaded.ok) return loaded;
    const state = loaded.value;
    return ok(buildWorldBossView(this.config, state, this.now(state)));
  }

  async challengeWorldBoss(seed?: number): Promise<Result<WorldBossBattleResult>> {
    const loaded = await this.load();
    if (!loaded.ok) return loaded;
    const state = loaded.value;
    const outcome = challengeWorldBossAction(this.config, state, this.now(state), seed);
    if (!outcome.ok) return fail(outcome.error, outcome.message);
    const value = outcome.value;
    let next = value.state;
    next = this.withQuest(next, 'winBattle');
    const committed = await this.commit(next);
    if (!committed.ok) return fail(committed.error, committed.message);
    return ok({
      battle: value.battle,
      speciesId: value.extra.speciesId,
      name: value.extra.name,
      damage: value.extra.damage,
      bestDamage: value.extra.bestDamage,
      rank: value.extra.rank,
      ghosts: value.extra.ghosts,
      attemptsLeft: value.extra.attemptsLeft,
      snapshot: committed.value,
    });
  }

  async claimWorldBossMilestone(index: number): Promise<Result<ClaimResult>> {
    const loaded = await this.load();
    if (!loaded.ok) return loaded;
    const outcome = claimWorldBossMilestoneAction(this.config, loaded.value, index);
    if (!outcome.ok) return fail(outcome.error, outcome.message);
    return this.commitClaim(outcome.value.state, outcome.value.granted);
  }

  async getDungeons(): Promise<Result<DungeonCardView[]>> {
    const loaded = await this.load();
    if (!loaded.ok) return loaded;
    const state = loaded.value;
    return ok(buildDungeonsView(this.config, state, this.now(state)));
  }

  async challengeDungeon(dungeonId: string, difficulty: number, seed?: number): Promise<Result<DungeonBattleResult>> {
    const loaded = await this.load();
    if (!loaded.ok) return loaded;
    const state = loaded.value;
    const outcome = challengeDungeonAction(this.config, state, dungeonId, difficulty, this.now(state), seed);
    if (!outcome.ok) return fail(outcome.error, outcome.message);
    const value = outcome.value;
    // R9: the source daily counts two XP & ASC dungeon runs.
    let next = dungeonId === 'xp' ? this.withQuest(value.state, 'dailyDungeon') : value.state;
    if (value.win) next = this.withQuest(next, 'winBattle');
    const committed = await this.commit(next);
    if (!committed.ok) return fail(committed.error, committed.message);
    return ok({
      battle: value.battle,
      dungeonId: value.extra.dungeonId,
      difficulty: value.extra.difficulty,
      win: value.win,
      grade: value.extra.grade,
      kills: value.extra.kills,
      damage: value.extra.damage,
      rewards: value.rewards,
      snapshot: committed.value,
    });
  }

  async sweepDungeon(dungeonId: string, difficulty: number): Promise<Result<ClaimResult>> {
    const loaded = await this.load();
    if (!loaded.ok) return loaded;
    const done = sweepDungeonAction(this.config, loaded.value, dungeonId, difficulty, this.now(loaded.value));
    if (!done.ok) return fail(done.error, done.message);
    const next = dungeonId === 'xp' ? this.withQuest(done.value.state, 'dailyDungeon') : done.value.state;
    return this.commitClaim(next, done.value.granted);
  }

  async claimDungeonChest(difficultyId: string, grade: DungeonGrade): Promise<Result<ClaimResult>> {
    const loaded = await this.load();
    if (!loaded.ok) return loaded;
    const done = claimDungeonChestAction(this.config, loaded.value, difficultyId, grade);
    if (!done.ok) return fail(done.error, done.message);
    return this.commitClaim(done.value.state, done.value.granted);
  }

  // --- M10 PvP: Arena ------------------------------------------------------

  async getArena(): Promise<Result<ArenaView>> {
    const loaded = await this.load();
    if (!loaded.ok) return loaded;
    return ok(buildArenaView(this.config, loaded.value, this.now(loaded.value)));
  }

  async getPvpHub(): Promise<Result<PvpHubView>> {
    const loaded = await this.load();
    if (!loaded.ok) return loaded;
    return ok(buildPvpHubView(this.config, loaded.value, this.now(loaded.value)));
  }

  async getExplore(): Promise<Result<ExploreView>> {
    const loaded = await this.load();
    if (!loaded.ok) return loaded;
    return ok(buildExploreView(this.config, loaded.value, this.now(loaded.value)));
  }

  async getPetHome(): Promise<Result<PetHomeView>> {
    const loaded = await this.load();
    if (!loaded.ok) return loaded;
    const now = this.now(loaded.value);
    const prepared = preparePetHome(this.config, loaded.value, now);
    if (prepared.changed) {
      const committed = await this.commit(prepared.state);
      if (!committed.ok) return committed;
      return ok(buildPetHomeView(this.config, prepared.state, now));
    }
    return ok(buildPetHomeView(this.config, loaded.value, now));
  }

  async summonPet(tileId?: number, seed?: number): Promise<Result<AccountSnapshot>> {
    const loaded = await this.load();
    if (!loaded.ok) return loaded;
    const outcome = summonPetAction(this.config, loaded.value, this.now(loaded.value), tileId, seed);
    if (!outcome.ok) return fail(outcome.error, outcome.message);
    return this.commit(outcome.value.state);
  }

  async openPet(petId: string): Promise<Result<AccountSnapshot>> {
    const loaded = await this.load();
    if (!loaded.ok) return loaded;
    const outcome = openPetAction(this.config, loaded.value, this.now(loaded.value), petId);
    if (!outcome.ok) return fail(outcome.error, outcome.message);
    return this.commit(outcome.value);
  }

  async mergePets(sourceId: string, targetId: string): Promise<Result<AccountSnapshot>> {
    const loaded = await this.load();
    if (!loaded.ok) return loaded;
    const outcome = mergePetsAction(this.config, loaded.value, this.now(loaded.value), sourceId, targetId);
    if (!outcome.ok) return fail(outcome.error, outcome.message);
    return this.commit(this.withQuest(outcome.value, 'petHomeMerge'));
  }

  async releasePet(petId: string): Promise<Result<AccountSnapshot>> {
    const loaded = await this.load();
    if (!loaded.ok) return loaded;
    const outcome = releasePetAction(this.config, loaded.value, this.now(loaded.value), petId);
    if (!outcome.ok) return fail(outcome.error, outcome.message);
    return this.commit(outcome.value);
  }

  async unlockPetTile(tileId: number): Promise<Result<AccountSnapshot>> {
    const loaded = await this.load();
    if (!loaded.ok) return loaded;
    const outcome = unlockTileAction(this.config, loaded.value, this.now(loaded.value), tileId);
    if (!outcome.ok) return fail(outcome.error, outcome.message);
    return this.commit(outcome.value.state);
  }

  async claimPetHomeLevel(level: number): Promise<Result<ClaimResult>> {
    const loaded = await this.load();
    if (!loaded.ok) return loaded;
    const outcome = claimLevelAction(this.config, loaded.value, this.now(loaded.value), level);
    if (!outcome.ok) return fail(outcome.error, outcome.message);
    return this.commitClaim(outcome.value.state, outcome.value.reward);
  }

  async buyPetHomeShopOffer(shopId: 'home' | 'deluxe', offerId: string): Promise<Result<ClaimResult>> {
    const loaded = await this.load();
    if (!loaded.ok) return loaded;
    const outcome = buyShopOfferAction(this.config, loaded.value, this.now(loaded.value), shopId, offerId);
    if (!outcome.ok) return fail(outcome.error, outcome.message);
    return this.commitClaim(outcome.value.state, outcome.value.granted);
  }

  async refreshPetHomeShop(shopId: 'home' | 'deluxe'): Promise<Result<AccountSnapshot>> {
    const loaded = await this.load();
    if (!loaded.ok) return loaded;
    const outcome = refreshShopAction(this.config, loaded.value, this.now(loaded.value), shopId);
    if (!outcome.ok) return fail(outcome.error, outcome.message);
    return this.commit(outcome.value);
  }

  async getSkyPillar(floor?: number): Promise<Result<SkyPillarView>> {
    const loaded = await this.load();
    if (!loaded.ok) return loaded;
    const state = loaded.value;
    const now = this.now(state);
    const prepared = prepareSkyPillar(this.config, state, now);
    if (prepared.changed) {
      const committed = await this.commit(prepared.state);
      if (!committed.ok) return committed;
    }
    return ok(buildSkyPillarView(this.config, prepared.state, now, floor));
  }

  async challengeSkyPillar(
    floor: number,
    stage: number,
    seed?: number,
  ): Promise<Result<SkyPillarBattleResult>> {
    const loaded = await this.load();
    if (!loaded.ok) return loaded;
    const state = loaded.value;
    const outcome = challengeSkyPillarAction(this.config, state, this.now(state), floor, stage, seed);
    if (!outcome.ok) return fail(outcome.error, outcome.message);
    const value = outcome.value;
    let next = value.state;
    if (value.win) {
      next = this.withQuest(next, 'winBattle');
      next = this.withTutorialAction(next, 'winStage');
    }
    const committed = await this.commit(next);
    if (!committed.ok) return fail(committed.error, committed.message);
    return ok({
      battle: value.battle,
      floor: value.extra.floor,
      stage: value.extra.stage,
      win: value.win,
      stars: value.extra.stars,
      bestStars: value.extra.bestStars,
      firstClear: value.extra.firstClear,
      rewards: value.rewards,
      snapshot: committed.value,
    });
  }

  async sweepSkyPillar(): Promise<Result<SkyPillarSweepResult>> {
    const loaded = await this.load();
    if (!loaded.ok) return loaded;
    const state = loaded.value;
    const outcome = sweepSkyPillarAction(this.config, state, this.now(state));
    if (!outcome.ok) return fail(outcome.error, outcome.message);
    const next = this.withQuest(outcome.value.state, 'sweepStage');
    const committed = await this.commit(next);
    if (!committed.ok) return fail(committed.error, committed.message);
    return ok({
      floor: outcome.value.floor,
      stage: outcome.value.stage,
      granted: outcome.value.granted,
      snapshot: committed.value,
    });
  }

  async claimSkyPillarChest(floor: number, stars: number): Promise<Result<ClaimResult>> {
    const loaded = await this.load();
    if (!loaded.ok) return loaded;
    const outcome = claimSkyPillarChestAction(this.config, loaded.value, floor, stars);
    if (!outcome.ok) return fail(outcome.error, outcome.message);
    return this.commitClaim(outcome.value.state, outcome.value.reward);
  }

  async refreshArena(): Promise<Result<AccountSnapshot>> {
    const loaded = await this.load();
    if (!loaded.ok) return loaded;
    const outcome = refreshArenaAction(this.config, loaded.value, this.now(loaded.value));
    if (!outcome.ok) return fail(outcome.error, outcome.message);
    return this.commit(outcome.value);
  }

  async challengeArena(opponentIndex: number, seed?: number): Promise<Result<ArenaBattleResult>> {
    const loaded = await this.load();
    if (!loaded.ok) return loaded;
    const state = loaded.value;
    const outcome = challengeArenaAction(this.config, state, this.now(state), opponentIndex, seed);
    if (!outcome.ok) return fail(outcome.error, outcome.message);
    const value = outcome.value;
    let next = this.withQuest(value.state, 'arenaChallenge');
    if (value.win) next = this.withQuest(next, 'winBattle');
    const committed = await this.commit(next);
    if (!committed.ok) return fail(committed.error, committed.message);
    return ok({
      battle: value.battle,
      opponentIndex: value.extra.opponentIndex,
      win: value.win,
      creditsBefore: value.extra.creditsBefore,
      creditsAfter: value.extra.creditsAfter,
      place: value.extra.place,
      attemptsLeft: value.extra.attemptsLeft,
      snapshot: committed.value,
    });
  }

  async buyArenaAttempts(count: number): Promise<Result<ArenaBuyResult>> {
    const loaded = await this.load();
    if (!loaded.ok) return loaded;
    const outcome = buyArenaAttemptsAction(this.config, loaded.value, this.now(loaded.value), count);
    if (!outcome.ok) return fail(outcome.error, outcome.message);
    const committed = await this.commit(outcome.value.state);
    if (!committed.ok) return fail(committed.error, committed.message);
    const tuning = arenaTuning(this.config);
    const arena = outcome.value.state.pvp.arena;
    return ok({
      bought: outcome.value.bought,
      spent: outcome.value.spent,
      attemptsLeft: Math.max(0, tuning.freeAttemptsPerDay + arena.bought - arena.attempts),
      snapshot: committed.value,
    });
  }

  async claimArenaChest(index: number): Promise<Result<ClaimResult>> {
    const loaded = await this.load();
    if (!loaded.ok) return loaded;
    const outcome = claimArenaChestAction(this.config, loaded.value, this.now(loaded.value), index);
    if (!outcome.ok) return fail(outcome.error, outcome.message);
    return this.commitClaim(outcome.value.state, outcome.value.granted);
  }

  async claimArenaAchievement(index: number): Promise<Result<ClaimResult>> {
    const loaded = await this.load();
    if (!loaded.ok) return loaded;
    const outcome = claimArenaAchievementAction(this.config, loaded.value, this.now(loaded.value), index);
    if (!outcome.ok) return fail(outcome.error, outcome.message);
    return this.commitClaim(outcome.value.state, outcome.value.granted);
  }

  async setArenaDefence(slots: Squad, strategy: StrategyId): Promise<Result<AccountSnapshot>> {
    return this.saveSquad('arenaDefence', slots, strategy);
  }

  async getArenaRankings(): Promise<Result<ArenaRankingsView>> {
    const loaded = await this.load();
    if (!loaded.ok) return loaded;
    return ok(buildArenaRankingsView(this.config, loaded.value, this.now(loaded.value)));
  }

  // --- M10.3 PvP: Ranked ---------------------------------------------------

  async getRanked(): Promise<Result<RankedView>> {
    const loaded = await this.load();
    if (!loaded.ok) return loaded;
    return ok(buildRankedView(this.config, loaded.value, this.now(loaded.value)));
  }

  async startRankedMatch(seed?: number): Promise<Result<RankedMatchResult>> {
    const loaded = await this.load();
    if (!loaded.ok) return loaded;
    const state = loaded.value;
    const outcome = startRankedMatchAction(this.config, state, this.now(state), seed);
    if (!outcome.ok) return fail(outcome.error, outcome.message);
    const value = outcome.value;
    let next = value.state;
    if (value.won) next = this.withQuest(next, 'winBattle');
    const committed = await this.commit(next);
    if (!committed.ok) return fail(committed.error, committed.message);
    return ok({
      battles: value.battles,
      win: value.won,
      wins: value.wins,
      losses: value.losses,
      scoreBefore: value.scoreBefore,
      scoreAfter: value.scoreAfter,
      tierBefore: value.tierBefore,
      tierAfter: value.tierAfter,
      promoted: value.promoted,
      attemptsLeft: value.attemptsLeft,
      matches: value.matches,
      snapshot: committed.value,
    });
  }

  async buyRankedAttempts(count: number): Promise<Result<RankedBuyResult>> {
    const loaded = await this.load();
    if (!loaded.ok) return loaded;
    const outcome = buyRankedAttemptsAction(this.config, loaded.value, this.now(loaded.value), count);
    if (!outcome.ok) return fail(outcome.error, outcome.message);
    const committed = await this.commit(outcome.value.state);
    if (!committed.ok) return fail(committed.error, committed.message);
    const tuning = rankedTuning(this.config);
    const ranked = outcome.value.state.pvp.ranked;
    return ok({
      bought: outcome.value.bought,
      spent: outcome.value.spent,
      attemptsLeft: Math.max(0, tuning.freeAttemptsPerDay + ranked.bought - ranked.attempts),
      snapshot: committed.value,
    });
  }

  async claimRankedTier(index: number): Promise<Result<ClaimResult>> {
    const loaded = await this.load();
    if (!loaded.ok) return loaded;
    const outcome = claimRankedTierAction(this.config, loaded.value, this.now(loaded.value), index);
    if (!outcome.ok) return fail(outcome.error, outcome.message);
    return this.commitClaim(outcome.value.state, outcome.value.granted);
  }

  async claimRankedGift(index: number): Promise<Result<ClaimResult>> {
    const loaded = await this.load();
    if (!loaded.ok) return loaded;
    const outcome = claimRankedGiftAction(this.config, loaded.value, this.now(loaded.value), index);
    if (!outcome.ok) return fail(outcome.error, outcome.message);
    return this.commitClaim(outcome.value.state, outcome.value.granted);
  }

  private async applyEquipment(run: (state: AccountState) => Result<AccountState>): Promise<Result<AccountSnapshot>> {
    const loaded = await this.load();
    if (!loaded.ok) return loaded;
    const applied = run(loaded.value);
    if (!applied.ok) return fail(applied.error, applied.message);
    return this.commit(applied.value);
  }

  // --- internals -----------------------------------------------------------

  /** The effective game clock: the injected clock plus any debug fast-forward (minutes). */
  private now(state: AccountState): number {
    return this.config.now() + state.debugClockOffset * 60_000;
  }

  /** The level cap for a Wild: its star card's cap (R7: going past it is Resonance's job). */
  private levelCapFor(instance: WildInstance, _state: AccountState): number {
    const meta = this.config.species.get(instance.speciesId);
    if (!meta) return instance.level;
    return cardOf(meta, instance.stars).maxLevel;
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
      grants: { gems: this.config.campaign.chapterChestGems },
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
    const parsed = parseSave(raw, this.config.now(), this.config);
    if (parsed.ok) return this.accept(parsed.value);
    const backup = await this.store.read(BACKUP_KEY);
    if (backup !== null) {
      const recovered = parseSave(backup, this.config.now(), this.config);
      if (recovered.ok) return this.accept(recovered.value);
    }
    if (parsed.error === 'outdated_save') return this.startFresh(raw);
    return fail('corrupt_save', parsed.message);
  }

  /** Replace a save that predates MIN_SAVE_VERSION: keep it under RETIRED_KEY, start a new account. */
  private async startFresh(retired: string): Promise<Result<AccountState>> {
    await this.store.write(RETIRED_KEY, retired);
    await this.store.remove(BACKUP_KEY);
    const fresh = createInitialState(this.config);
    fresh.mail = [freshStartMail(this.config, this.config.now()), ...fresh.mail];
    // Write directly: persist() would copy the retired save into BACKUP_KEY.
    await this.store.write(SAVE_KEY, serializeSave(fresh));
    this.state = fresh;
    return ok(fresh);
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
    const pvp = rollPvp(this.config, next, this.now(next));
    if (pvp.state !== next) {
      next = pvp.state;
      changed = true;
    }
    const pruned = pruneMail(next.mail, this.now(next));
    if (pruned.length !== next.mail.length) {
      next = { ...next, mail: pruned };
      changed = true;
    }
    // R7: keep the shared Resonance levels written on the roster.
    const synced = syncResonance(this.config, next);
    if (synced !== next) {
      next = synced;
      changed = true;
    }
    const titles = expireTitles(next.titles, this.now(next));
    if (titles !== next.titles) {
      next = { ...next, titles };
      changed = true;
    }
    // R9: a closed World Boss window mails its rank reward.
    const settled = settleWorldBoss(this.config, next, this.now(next));
    if (settled !== next) {
      next = settled;
      changed = true;
    }
    return { state: next, changed };
  }

  private async persist(state: AccountState): Promise<void> {
    const current = await this.store.read(SAVE_KEY);
    if (current !== null) await this.store.write(BACKUP_KEY, current);
    await this.store.write(SAVE_KEY, serializeSave(state));
  }

  private async commit(next: AccountState): Promise<Result<AccountSnapshot>> {
    // R9: the source daily "spend 60 Diamonds" counts every net Diamond decrease of an action today.
    const before = this.state;
    const spent = before && before.quests.day === next.quests.day ? before.currencies.gems - next.currencies.gems : 0;
    const state = spent > 0 ? this.withQuest(next, 'gemsSpent', spent) : next;
    this.state = state;
    await this.persist(state);
    return ok(this.snapshot(state));
  }

  private snapshot(state: AccountState): AccountSnapshot {
    const power: Record<string, number> = {};
    for (const wild of state.roster) power[wild.id] = this.instancePower(wild, state);
    const teamPower = {} as Record<SquadMode, number>;
    for (const mode of SQUAD_MODES) {
      teamPower[mode] = state.squads[mode].reduce((sum, id) => sum + (id ? power[id] ?? 0 : 0), 0);
    }
    return {
      state,
      power,
      teamPower,
      resonance: buildResonanceView(this.config, state, this.now(state)),
      vip: buildVipView(this.config, state),
      tokens: buildTokensView(this.config, state),
      titles: buildTitlesView(this.config, state, this.now(state)),
    };
  }

  private instancePower(wild: WildInstance, state: AccountState): number {
    return powerOf(wild, this.config, state);
  }

  private find(state: AccountState, instanceId: string): { state: AccountState; instance: WildInstance } | null {
    const instance = state.roster.find((w) => w.id === instanceId);
    return instance ? { state, instance } : null;
  }

  private replace(roster: WildInstance[], next: WildInstance): WildInstance[] {
    return roster.map((w) => (w.id === next.id ? next : w));
  }
}
