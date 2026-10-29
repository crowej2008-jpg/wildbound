import { describe, expect, it } from 'vitest';
import { buildConfig, type GameConfig } from './config';
import { LocalServer } from './local-server';
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
import { buildPetHomeView } from './pet-home-view';
import { createInitialState, SAVE_KEY, serializeSave } from './save';
import { MemoryStore } from './storage';

const START = Date.UTC(2026, 9, 28, 12);
const DAY = 86_400_000;

function account(): { config: GameConfig; state: ReturnType<typeof createInitialState> } {
  const config = buildConfig();
  config.now = () => START;
  const state = createInitialState(config);
  state.campaign.stars['c1-10'] = 3;
  return { config, state };
}

function local(config: GameConfig): LocalServer {
  return new LocalServer(new MemoryStore(), config);
}

describe('Pet Home server rules', () => {
  it('summons free balls, opens them for XP, merges equal levels and releases', () => {
    const { config, state } = account();
    const first = summonPetAction(config, state, START, 0, 1);
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    expect(first.value.free).toBe(true);
    expect(first.value.cost).toBe(0);
    expect(first.value.state.petHome.freeSummonsUsed).toBe(1);
    expect(first.value.state.petHome.pets[0]?.opened).toBe(false);

    const opened = openPetAction(config, first.value.state, START, first.value.petId);
    expect(opened.ok).toBe(true);
    if (!opened.ok) return;
    expect(opened.value.petHome.xp).toBe(10);
    expect(opened.value.petHome.album).toHaveLength(1);

    const second = summonPetAction(config, opened.value, START, 1, 2);
    if (!second.ok) return;
    const secondOpen = openPetAction(config, second.value.state, START, second.value.petId);
    if (!secondOpen.ok) return;
    const merged = mergePetsAction(
      config,
      secondOpen.value,
      START,
      first.value.petId,
      second.value.petId,
    );
    expect(merged.ok).toBe(true);
    if (!merged.ok) return;
    expect(merged.value.petHome.pets).toHaveLength(1);
    expect(merged.value.petHome.pets[0]?.level).toBe(2);
    expect(merged.value.petHome.xp).toBe(30);

    const released = releasePetAction(config, merged.value, START, second.value.petId);
    expect(released.ok).toBe(true);
    if (!released.ok) return;
    expect(released.value.petHome.pets).toHaveLength(0);
  });

  it('charges gems after the free summons and resets the counters next day', () => {
    const { config, state } = account();
    const rich = { ...state, currencies: { ...state.currencies, gems: 1_000 } };
    const spent = {
      ...rich,
      petHome: { ...rich.petHome, freeSummonsUsed: config.petHome.home.freeSummonsPerDay },
    };
    const paid = summonPetAction(config, spent, START, 0, 3);
    expect(paid.ok).toBe(true);
    if (!paid.ok) return;
    expect(paid.value.free).toBe(false);
    expect(paid.value.cost).toBe(config.petHome.home.summonCosts[0]!.gems);
    expect(paid.value.state.currencies.gems).toBe(1_000 - paid.value.cost);
    expect(paid.value.state.petHome.paidSummonsUsed).toBe(1);

    const nextDay = preparePetHome(config, paid.value.state, START + DAY);
    expect(nextDay.state.petHome.freeSummonsUsed).toBe(0);
    expect(nextDay.state.petHome.paidSummonsUsed).toBe(0);
  });

  it('unlocks a revealed padlock for gems and rejects it early', () => {
    const { config, state } = account();
    const early = unlockTileAction(config, state, START, 6);
    expect(early.ok).toBe(false);

    const leveled = {
      ...state,
      currencies: { ...state.currencies, gems: 500 },
      petHome: { ...state.petHome, xp: config.petHome.levels[2]!.xp },
    };
    const unlocked = unlockTileAction(config, leveled, START, 6);
    expect(unlocked.ok).toBe(true);
    if (!unlocked.ok) return;
    expect(unlocked.value.cost).toBe(config.petHome.levels[2]!.unlockGems);
    expect(unlocked.value.state.currencies.gems).toBe(500 - unlocked.value.cost);
    expect(unlocked.value.state.petHome.unlockedTiles).toContain(6);

    const again = unlockTileAction(config, unlocked.value.state, START, 6);
    expect(again.ok).toBe(false);
  });

  it('claims each Home-level reward once', () => {
    const { config, state } = account();
    const leveled = { ...state, petHome: { ...state.petHome, xp: config.petHome.levels[1]!.xp } };
    const claimed = claimLevelAction(config, leveled, START, 1);
    expect(claimed.ok).toBe(true);
    if (!claimed.ok) return;
    expect(claimed.value.reward).toEqual(config.petHome.levels[1]!.reward);
    expect(claimed.value.state.currencies.gems).toBe(
      state.currencies.gems + (config.petHome.levels[1]!.reward.gems ?? 0),
    );
    expect(claimLevelAction(config, claimed.value.state, START, 1).ok).toBe(false);
    expect(claimLevelAction(config, state, START, 2).ok).toBe(false);
  });

  it('shows nine offers and moves them on a paid refresh', () => {
    const { config, state } = account();
    const rich = {
      ...state,
      currencies: { ...state.currencies, gems: 1_000, homeCoin: 20_000 },
      petHome: { ...state.petHome, xp: config.petHome.levels[1]!.xp },
    };
    const view = buildPetHomeView(config, rich, START);
    const home = view.shops.find((shop) => shop.id === 'home')!;
    expect(home.offers).toHaveLength(9);
    expect(home.unlocked).toBe(true);
    const first = home.offers[0]!;
    const bought = buyShopOfferAction(config, rich, START, 'home', first.id);
    expect(bought.ok).toBe(true);
    if (!bought.ok) return;
    expect(bought.value.granted).toEqual(first.grants);
    expect(bought.value.state.currencies.homeCoin).toBe(20_000 - first.price);
    expect(
      buyShopOfferAction(config, bought.value.state, START, 'home', first.id).ok,
    ).toBe(false);

    const refreshed = refreshShopAction(config, bought.value.state, START, 'home');
    expect(refreshed.ok).toBe(true);
    if (!refreshed.ok) return;
    expect(refreshed.value.currencies.gems).toBe(1_000 - 40);
    expect(refreshed.value.petHome.shopRefreshes).toBe(1);
    expect(refreshed.value.petHome.shopBought).toEqual([]);
  });

  it('settles passive Home Coins through the LocalServer view', async () => {
    const config = buildConfig();
    let clock = START;
    config.now = () => clock;
    const srv = local(config);
    const { state } = account();
    const imported = await srv.importSave(serializeSave(state));
    expect(imported.ok).toBe(true);
    if (!imported.ok) return;

    const summoned = await srv.summonPet(0, 7);
    expect(summoned.ok).toBe(true);
    if (!summoned.ok) return;
    const petId = summoned.value.state.petHome.pets[0]!.id;
    const opened = await srv.openPet(petId);
    expect(opened.ok).toBe(true);
    if (!opened.ok) return;
    expect(opened.value.state.petHome.pets[0]?.opened).toBe(true);

    const before = await srv.getPetHome();
    expect(before.ok).toBe(true);
    if (!before.ok) return;
    expect(before.value.incomePerMinute).toBeGreaterThan(0);

    clock += 5 * 60_000;
    const after = await srv.getPetHome();
    expect(after.ok).toBe(true);
    if (!after.ok) return;
    expect(after.value.homeCoin).toBe(before.value.homeCoin + before.value.incomePerMinute * 5);
  });

  it('blocks every Pet Home action until campaign 1-10 is cleared', async () => {
    const config = buildConfig();
    config.now = () => START;
    const srv = local(config);
    const loaded = await srv.loadAccount();
    expect(loaded.ok).toBe(true);
    if (!loaded.ok) return;

    const view = await srv.getPetHome();
    expect(view.ok).toBe(true);
    if (!view.ok) return;
    expect(view.value.unlocked).toBe(false);
    expect(view.value.tiles.filter((tile) => tile.active)).toHaveLength(6);
    expect(view.value.shops[1]?.unlocked).toBe(false);

    const summoned = await srv.summonPet(0, 1);
    expect(summoned.ok).toBe(false);
    if (!summoned.ok) expect(summoned.error).toBe('resource_locked');
  });

  it('persists the Pet Home slice and loads it again', async () => {
    const config = buildConfig();
    config.now = () => START;
    const store = new MemoryStore();
    const first = new LocalServer(store, config);
    const { state } = account();
    const imported = await first.importSave(serializeSave(state));
    expect(imported.ok).toBe(true);
    if (!imported.ok) return;
    expect((await first.summonPet(0, 4)).ok).toBe(true);

    const reloaded = new LocalServer(store, config);
    const loaded = await reloaded.loadAccount();
    expect(loaded.ok).toBe(true);
    if (!loaded.ok) return;
    expect(loaded.value.state.petHome.pets).toHaveLength(1);
    expect(await store.read(SAVE_KEY)).toContain('petHome');
  });
});
