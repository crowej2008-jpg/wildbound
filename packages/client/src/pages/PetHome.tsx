import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import type {
  AccountSnapshot,
  ClaimResult,
  GameServer,
  PetHomePetView,
  PetHomeShopView,
  PetHomeTileView,
  PetHomeView,
  Result,
} from '@wildbound/server';
import WildPortrait from '../art/WildPortrait';
import RewardLine from '../components/RewardLine';
import { formatDuration, t } from '../i18n';
import { useServer } from '../server/ServerProvider';
import { species } from '../wilds';

/** Pet Home (M13.1): a 5x5 merge board, Home levels, rewards and two shops. */

type Tab = 'board' | 'shops' | 'album';

function tileLabel(tile: PetHomeTileView, pet: PetHomePetView | null): string {
  if (pet) {
    return pet.opened ? `${pet.name ?? t('petHome.wild')} ${t('petHome.levelShort')} ${pet.level}` : t('petHome.ball');
  }
  if (!tile.revealed) return t('petHome.unrevealed');
  if (tile.locked && !tile.active) return `${t('petHome.tileLocked')} (${tile.unlockGems} ${t('currency.gems')})`;
  return t('petHome.emptyTile');
}

function Tile({
  tile,
  selected,
  disabled,
  onPick,
}: {
  tile: PetHomeTileView;
  selected: boolean;
  disabled: boolean;
  onPick: () => void;
}) {
  const pet = tile.pet;
  const wild = pet?.speciesId ? species(pet.speciesId) : undefined;
  const classes = [
    'pet-home-tile',
    tile.active ? 'is-active' : '',
    tile.locked && !tile.active ? 'is-locked' : '',
    !tile.revealed ? 'is-hidden' : '',
    pet ? 'has-pet' : '',
    selected ? 'is-selected' : '',
  ]
    .filter(Boolean)
    .join(' ');
  return (
    <button
      type="button"
      className={classes}
      disabled={disabled}
      aria-label={tileLabel(tile, pet)}
      aria-pressed={selected}
      onClick={onPick}
    >
      {wild && pet?.opened ? (
        <WildPortrait species={wild} stage={0} size={46} label={tileLabel(tile, pet)} />
      ) : (
        <span className="pet-home-tile-mark" aria-hidden>
          {pet ? '◈' : tile.locked && !tile.active ? '▣' : !tile.revealed ? '?' : '+'}
        </span>
      )}
      {pet ? (
        <span className="pet-home-tile-level">
          {pet.opened ? `${t('petHome.levelShort')} ${pet.level}` : t('petHome.ball')}
        </span>
      ) : tile.locked && !tile.active && tile.revealed ? (
        <span className="pet-home-tile-level">{tile.unlockGems} {t('currency.gems')}</span>
      ) : null}
    </button>
  );
}

function ShopCard({
  shop,
  busy,
  onBuy,
  onRefresh,
}: {
  shop: PetHomeShopView;
  busy: boolean;
  onBuy: (offerId: string) => void;
  onRefresh: () => void;
}) {
  return (
    <section className="card pet-home-shop">
      <div className="shop-head">
        <h3 className="section-title">{shop.name}</h3>
        <span className="chip">
          {shop.balance.toLocaleString()} {t(shop.currency === 'homeCoin' ? 'currency.homeCoin' : 'currency.orbEssence')}
        </span>
      </div>
      {!shop.unlocked ? (
        <p className="muted">
          {t('petHome.shopUnlock')} {t('petHome.levelShort')} {shop.unlockLevel}.
        </p>
      ) : (
        <>
          <div className="shop-refresh">
            <span className="muted">
              {t('petHome.refreshesLeft')}: <strong>{shop.refreshesLeft}</strong>
              {' · '}
              {t('petHome.nextReset')} {formatDuration(shop.nextResetMs)}
            </span>
            {shop.refreshCost !== null ? (
              <span className="shop-refresh-cost">
                {t('petHome.refreshCost')}: {shop.refreshCost} {t('currency.gems')}
              </span>
            ) : (
              <span className="muted">{t('petHome.noRefreshes')}</span>
            )}
            <button
              type="button"
              className="btn"
              disabled={busy || shop.refreshesLeft <= 0 || shop.refreshCost === null}
              onClick={onRefresh}
            >
              {t('petHome.refresh')}
            </button>
          </div>
          <ul className="shop-list">
            {shop.offers.map((offer) => (
              <li key={offer.id} className="shop-item">
                <div className="shop-item-info">
                  <span className="shop-item-name">{offer.name}</span>
                  <span className="muted">{offer.description}</span>
                  <RewardLine rewards={offer.grants} />
                  <span className="muted">
                    {offer.price.toLocaleString()}{' '}
                    {t(shop.currency === 'homeCoin' ? 'currency.homeCoin' : 'currency.orbEssence')}
                  </span>
                </div>
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={busy || offer.bought || !offer.affordable}
                  onClick={() => onBuy(offer.id)}
                >
                  {offer.bought
                    ? t('petHome.bought')
                    : !offer.affordable
                      ? t('petHome.notAffordable')
                      : t('petHome.buy')}
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

export default function PetHome() {
  const { call, claim, busy } = useServer();
  const [view, setView] = useState<PetHomeView | null>(null);
  const [tab, setTab] = useState<Tab>('board');
  const [selectedTileId, setSelectedTileId] = useState<number | null>(null);
  const [selectedPetId, setSelectedPetId] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const result = await call((s) => s.getPetHome());
    if (result.ok) setView(result.value);
  }, [call]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const selectedTile = view?.tiles.find((tile) => tile.id === selectedTileId) ?? null;
  const selectedPet = view?.pets.find((pet) => pet.id === selectedPetId) ?? null;
  const mergeCandidates = useMemo(
    () =>
      view && selectedPet?.opened
        ? view.pets.filter(
            (pet) => pet.opened && pet.level === selectedPet.level && pet.id !== selectedPet.id,
          )
        : [],
    [selectedPet, view],
  );

  const run = async (
    action: (server: GameServer) => Promise<Result<AccountSnapshot>>,
    message: string,
  ) => {
    setStatus(null);
    const result = await call(action, (snapshot) => snapshot);
    if (result.ok) {
      setStatus(message);
      setSelectedPetId(null);
      setSelectedTileId(null);
      await refresh();
    }
  };

  const runClaim = async (
    action: (server: GameServer) => Promise<Result<ClaimResult>>,
    message: string,
  ) => {
    setStatus(null);
    const result = await claim(action);
    if (result.ok) {
      setStatus(message);
      await refresh();
    }
  };

  const doSummon = () =>
    void run((s) => s.summonPet(), t('petHome.summoned'));

  const doOpen = (petId: string) =>
    void run((s) => s.openPet(petId), t('petHome.opened'));

  const doMerge = (sourceId: string, targetId: string) =>
    void run((s) => s.mergePets(sourceId, targetId), t('petHome.merged'));

  const doRelease = (petId: string) =>
    void run((s) => s.releasePet(petId), t('petHome.released'));

  const doUnlock = (tileId: number) =>
    void run((s) => s.unlockPetTile(tileId), t('petHome.unlocked'));

  const doClaimLevel = (level: number) =>
    void runClaim((s) => s.claimPetHomeLevel(level), t('petHome.claimedReward'));

  const doBuy = (shopId: 'home' | 'deluxe', offerId: string) =>
    void runClaim((s) => s.buyPetHomeShopOffer(shopId, offerId), t('petHome.bought'));

  const doRefreshShop = (shopId: 'home' | 'deluxe') =>
    void run((s) => s.refreshPetHomeShop(shopId), t('petHome.refreshed'));

  if (!view) {
    return (
      <main className="main">
        <h1 className="page-title">{t('petHome.title')}</h1>
        <p className="muted">{t('petHome.loading')}</p>
      </main>
    );
  }

  const cells = Array.from({ length: 25 }, (_, index) => {
    const row = Math.floor(index / 5);
    const col = index % 5;
    return view.tiles.find((tile) => tile.row === row && tile.col === col) ?? null;
  });

  const freeTile = view.tiles.find((tile) => tile.active && !tile.pet) ?? null;
  const canSummon = view.unlocked && view.freeTiles > 0 && !busy;
  const summonLabel =
    view.freeSummonsLeft > 0
      ? `${t('petHome.summon')} (${view.freeSummonsLeft} ${t('petHome.freeLeft')})`
      : `${t('petHome.summon')} (${view.nextSummonCost} ${t('currency.gems')})`;

  return (
    <main className="main">
      <p>
        <Link className="text-link" to="/explore">
          {t('explore.back')}
        </Link>
      </p>
      <div className="explore-detail-head">
        <span className="explore-sigil explore-sigil-lg" aria-hidden>
          PH
        </span>
        <div>
          <h1 className="page-title">{t('petHome.title')}</h1>
          <p className="muted">{t('petHome.tagline')}</p>
        </div>
      </div>
      <div className="explore-facts">
        <span className="chip">{t('petHome.level')} {view.homeLevel}</span>
        <span className="chip">{t('petHome.mergeCap')} {view.mergeCap}</span>
        <span className={`chip ${view.unlocked ? 'chip-on' : ''}`}>
          {view.unlocked ? t('explore.unlocked') : t('explore.locked')}
        </span>
        <span className="chip explore-status live">{t('explore.status.live')}</span>
        <span className="chip">
          {t('petHome.nextReset')} {formatDuration(view.nextResetMs)}
        </span>
      </div>

      {!view.unlocked ? (
        <section className="card pet-home-gate">
          <h2 className="section-title">{t('petHome.lockedTitle')}</h2>
          <p className="muted">{t('petHome.lockedNote')}</p>
          <ul className="plain-list">
            {view.gates.map((gate, index) => (
              <li key={`${gate.gate.kind}-${index}`} className="milestone-row">
                <span>
                  {gate.gate.kind === 'campaign'
                    ? `${t('explore.requirement.campaign')} ${gate.gate.chapter}-${gate.gate.stage}`
                    : gate.gate.kind === 'level'
                      ? `${t('explore.requirement.level')} ${gate.gate.level}`
                      : `${t('explore.requirement.serverDay')} ${gate.gate.day}`}
                </span>
                <span className={`chip ${gate.met ? 'chip-on' : ''}`}>
                  {gate.met ? t('explore.met') : t('explore.unmet')}
                </span>
              </li>
            ))}
          </ul>
          <Link className="btn" to="/campaign">
            {t('petHome.goCampaign')}
          </Link>
        </section>
      ) : (
        <>
          <section className="card">
            <div className="pet-home-summary">
              <div>
                <span className="muted">{t('petHome.level')}</span>
                <strong>{view.homeLevel}</strong>
              </div>
              <div>
                <span className="muted">{t('petHome.income')}</span>
                <strong>
                  {view.incomePerMinute.toLocaleString()} {t('currency.homeCoin')}/{t('petHome.perMinute')}
                </strong>
              </div>
              <div>
                <span className="muted">{t('currency.homeCoin')}</span>
                <strong>{view.homeCoin.toLocaleString()}</strong>
              </div>
            </div>
            <div className="pet-home-xp">
              <div className="pet-home-xp-head">
                <span className="muted">
                  {t('petHome.xp')} {view.homeXp.toLocaleString()}
                  {view.xpForNext !== null
                    ? ` / ${(view.homeXp + (view.xpForNext - view.xpIntoLevel)).toLocaleString()}`
                    : ''}
                </span>
                <span className="muted">
                  {view.xpForNext !== null
                    ? `${t('petHome.nextLevel')} ${view.homeLevel + 1}`
                    : t('petHome.maxLevel')}
                </span>
              </div>
              <span className="progress">
                <span className="progress-fill pet-home-xp-fill" style={{ width: `${view.progress * 100}%` }} />
              </span>
            </div>
            <p className="muted">
              {t('petHome.settlementNote')} {view.settlementMinutes} {t('petHome.minutes')} ·{' '}
              {t('petHome.offlineNote')} {view.offlineHours}h
            </p>
            <div className="pet-home-summon-row">
              <button type="button" className="btn btn-primary" disabled={!canSummon} onClick={doSummon}>
                {summonLabel}
              </button>
              <span className="muted">
                {view.freeTiles > 0
                  ? `${t('petHome.freeTiles')}: ${view.freeTiles}`
                  : t('petHome.boardFull')}
              </span>
            </div>
            {status && <p className="pet-home-status">{status}</p>}
          </section>

          <div className="tabs" role="tablist">
            {(['board', 'shops', 'album'] as Tab[]).map((id) => (
              <button
                key={id}
                type="button"
                className={`tab ${tab === id ? 'tab-active' : ''}`}
                role="tab"
                aria-selected={tab === id}
                onClick={() => setTab(id)}
              >
                {t(id === 'board' ? 'petHome.tab.board' : id === 'shops' ? 'petHome.tab.shops' : 'petHome.tab.album')}
              </button>
            ))}
          </div>

          {tab === 'board' ? (
            <>
              <section className="card pet-home-board-card">
                <div className="pet-home-board" role="grid" aria-label={t('petHome.board')}>
                  {cells.map((tile, index) =>
                    tile ? (
                      <Tile
                        key={tile.id}
                        tile={tile}
                        selected={selectedTileId === tile.id}
                        disabled={busy || (!tile.active && !tile.locked) || (!tile.revealed && !tile.locked)}
                        onPick={() => {
                          setSelectedTileId(tile.id);
                          setSelectedPetId(tile.pet?.id ?? null);
                        }}
                      />
                    ) : (
                      <span key={`hole-${index}`} className="pet-home-hole" aria-hidden />
                    ),
                  )}
                </div>
                <p className="muted pet-home-board-note">
                  {t('petHome.boardNote')}
                </p>
              </section>

              <section className="card pet-home-actions">
                <h2 className="section-title">{t('petHome.actions')}</h2>
                {selectedPet ? (
                  <>
                    <p>
                      <strong>
                        {selectedPet.opened
                          ? `${selectedPet.name ?? t('petHome.wild')} · ${t('petHome.levelShort')} ${selectedPet.level}`
                          : t('petHome.ball')}
                      </strong>
                    </p>
                    <div className="row-actions">
                      {!selectedPet.opened ? (
                        <button
                          type="button"
                          className="btn btn-primary"
                          disabled={busy}
                          onClick={() => void doOpen(selectedPet.id)}
                        >
                          {t('petHome.open')}
                        </button>
                      ) : null}
                      <button
                        type="button"
                        className="btn btn-danger"
                        disabled={busy}
                        onClick={() => void doRelease(selectedPet.id)}
                      >
                        {t('petHome.release')}
                      </button>
                    </div>
                    {selectedPet.opened && mergeCandidates.length > 0 ? (
                      <div className="pet-home-merge-list">
                        <p className="muted">{t('petHome.mergeHint')}</p>
                        {mergeCandidates.map((pet) => (
                          <button
                            key={pet.id}
                            type="button"
                            className="btn"
                            disabled={busy}
                            onClick={() => void doMerge(pet.id, selectedPet.id)}
                          >
                            {t('petHome.mergeWith')} {pet.name ?? t('petHome.wild')} · {t('petHome.levelShort')} {pet.level}
                          </button>
                        ))}
                      </div>
                    ) : selectedPet.opened ? (
                      <p className="muted">{t('petHome.noMerge')}</p>
                    ) : (
                      <p className="muted">{t('petHome.ballHint')}</p>
                    )}
                  </>
                ) : selectedTile ? (
                  <>
                    <p className="muted">
                      {t('petHome.tile')} {selectedTile.row + 1}-{selectedTile.col + 1}
                    </p>
                    {selectedTile.locked && !selectedTile.active && selectedTile.revealed ? (
                      <>
                        <p>{t('petHome.unlockHint')}</p>
                        <button
                          type="button"
                          className="btn btn-primary"
                          disabled={busy}
                          onClick={() => void doUnlock(selectedTile.id)}
                        >
                          {t('petHome.unlockTile')} ({selectedTile.unlockGems} {t('currency.gems')})
                        </button>
                      </>
                    ) : selectedTile.active ? (
                      <>
                        <p>{t('petHome.emptyHint')}</p>
                        <button
                          type="button"
                          className="btn btn-primary"
                          disabled={!canSummon}
                          onClick={() => void run((s) => s.summonPet(selectedTile.id), t('petHome.summoned'))}
                        >
                          {t('petHome.summonHere')}
                        </button>
                      </>
                    ) : (
                      <p className="muted">{t('petHome.unrevealedHint')}</p>
                    )}
                  </>
                ) : (
                  <p className="muted">
                    {t('petHome.selectHint')} {freeTile ? t('petHome.freeTileHint') : ''}
                  </p>
                )}
              </section>

              <section className="card">
                <h2 className="section-title">{t('petHome.levelRewards')}</h2>
                <ul className="plain-list">
                  {view.levelRewards.map((reward) => (
                    <li key={reward.level} className="milestone-row">
                      <span>
                        {t('petHome.levelShort')} {reward.level}
                      </span>
                      <span className="pet-home-reward-line">
                        <RewardLine rewards={reward.reward} />
                      </span>
                      <button
                        type="button"
                        className={`btn ${reward.claimable ? 'btn-primary' : ''}`}
                        disabled={busy || !reward.claimable}
                        onClick={() => void doClaimLevel(reward.level)}
                      >
                        {reward.claimed
                          ? t('petHome.claimed')
                          : reward.claimable
                            ? t('petHome.claim')
                            : t('petHome.lockedLevel')}
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            </>
          ) : null}

          {tab === 'shops' ? (
            <section className="pet-home-shops">
              {view.shops.map((shop) => (
                <ShopCard
                  key={shop.id}
                  shop={shop}
                  busy={busy}
                  onBuy={(offerId) => void doBuy(shop.id, offerId)}
                  onRefresh={() => void doRefreshShop(shop.id)}
                />
              ))}
            </section>
          ) : null}

          {tab === 'album' ? (
            <section className="card">
              <h2 className="section-title">{t('petHome.album')}</h2>
              <p className="muted">{view.albumNote}</p>
              <p className="muted">
                {view.album.filter((entry) => entry.seen).length} / {view.album.length}
              </p>
              <div className="pet-home-album">
                {view.album.map((entry) => {
                  const wild = entry.seen ? species(entry.id) : undefined;
                  return (
                    <div
                      key={entry.id}
                      className={`pet-home-album-entry ${entry.seen ? 'is-seen' : 'is-unseen'}`}
                    >
                      {wild ? (
                        <WildPortrait species={wild} stage={0} size={44} label={entry.name} />
                      ) : (
                        <span className="pet-home-album-lock" aria-hidden>
                          ?
                        </span>
                      )}
                      <span>{entry.seen ? entry.name : t('petHome.unknown')}</span>
                    </div>
                  );
                })}
              </div>
              <details className="pet-home-help">
                <summary>{t('petHome.help')}</summary>
                <p className="muted">{t('petHome.helpText')}</p>
              </details>
            </section>
          ) : null}
        </>
      )}
    </main>
  );
}
