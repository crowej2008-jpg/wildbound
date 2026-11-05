import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { FactionTowerClimbResult, FactionTowerTowerView, FactionTowerView } from '@wildbound/server';
import BattleReplay from '../components/BattleReplay';
import RewardLine from '../components/RewardLine';
import { formatDuration, t } from '../i18n';
import { useServer } from '../server/ServerProvider';

/** Faction Tower (M13.7): three type-locked towers on their weekdays, 20 floors a day, sweeps. */

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
type TowerKey = 'factionTower.water' | 'factionTower.fire' | 'factionTower.grass';

function blockText(tower: FactionTowerTowerView): string | null {
  if (tower.block === 'closed') return t('factionTower.closed');
  if (tower.block === 'daily_limit') return t('factionTower.doneToday');
  if (tower.block === 'top') return t('factionTower.top');
  return null;
}

export default function FactionTower() {
  const { call, busy } = useServer();
  const [view, setView] = useState<FactionTowerView | null>(null);
  const [climb, setClimb] = useState<FactionTowerClimbResult | null>(null);
  const [shown, setShown] = useState(0);
  const [status, setStatus] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const res = await call((s) => s.getFactionTower());
    if (res.ok) setView(res.value);
  }, [call]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const climbTower = async (faction: string) => {
    setStatus(null);
    const res = await call((s) => s.climbFactionTower(faction), (v) => v.snapshot);
    if (res.ok) {
      setClimb(res.value);
      setShown(0);
    }
  };

  const sweep = async (faction: string) => {
    setStatus(null);
    const res = await call((s) => s.sweepFactionTower(faction), (v) => v.snapshot);
    if (res.ok) setStatus(t('factionTower.swept'));
    await refresh();
  };

  if (climb && climb.fights[shown]) {
    const fight = climb.fights[shown]!;
    const last = shown === climb.fights.length - 1;
    return (
      <BattleReplay
        view={fight.battle}
        attackerLabel={`${t('combat.team.attackers')} · ${t('factionTower.team')} ${fight.team}`}
        defenderLabel={`${t(`factionTower.${climb.faction}` as TowerKey)} · ${t('factionTower.floor')} ${climb.floor}`}
        resultExtra={
          <section className={`card result-rewards ${fight.win ? 'result-win' : 'result-lose'}`}>
            {!last ? (
              <button type="button" className="btn btn-primary" onClick={() => setShown(shown + 1)}>
                {t('factionTower.nextFight')}
              </button>
            ) : (
              <>
                <div className="result-banner">
                  <strong data-testid="faction-outcome">{climb.win ? t('factionTower.won') : t('factionTower.lost')}</strong>
                </div>
                {climb.win ? <RewardLine rewards={climb.rewards} /> : null}
                {climb.pokemon.length > 0 ? (
                  <p>
                    {t('factionTower.evolveBox')} {climb.pokemon.join(', ')}
                  </p>
                ) : null}
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => {
                    setClimb(null);
                    void refresh();
                  }}
                >
                  {t('factionTower.back')}
                </button>
              </>
            )}
          </section>
        }
      />
    );
  }

  if (!view) return <p className="muted">…</p>;

  return (
    <div className="page faction-tower">
      <Link className="text-link" to="/explore">
        {t('hoopa.backToExplore')}
      </Link>
      <h1 className="page-title">{t('factionTower.title')}</h1>

      {!view.unlocked ? (
        <section className="card">
          <p data-testid="faction-locked">{t('factionTower.locked')}</p>
        </section>
      ) : (
        <>
          <section className="card">
            <p data-testid="faction-summary">
              {t('factionTower.today')} {DAYS[view.weekday]} · {t('factionTower.resets')} {formatDuration(view.resetsInMs)}
            </p>
            <p className="muted">
              {t('factionTower.rules')
                .replace('{n}', String(view.minOfType))
                .replace('{floors}', String(view.floorsPerDay))
                .replace('{two}', String(view.twoTeamFrom))}
            </p>
            <p className="muted">
              {t('currency.factionCoin')}: {view.factionCoin.toLocaleString()} · {t('currency.starShard')}: {view.starShard.toLocaleString()} ·{' '}
              {t('currency.gems')}: {view.gems.toLocaleString()}
            </p>
            <p className="muted" data-testid="faction-sweeps">
              {view.sweepPrice === null
                ? t('factionTower.noSweeps')
                : view.sweepPrice === 0
                  ? t('factionTower.freeSweeps').replace('{n}', String(view.freeSweepsLeft))
                  : t('factionTower.buySweep').replace('{n}', String(view.sweepPrice))}
            </p>
            <p>
              <Link className="text-link" to="/squad?mode=factionTower">
                {t('factionTower.editTeam')} 1
              </Link>{' '}
              ·{' '}
              <Link className="text-link" to="/squad?mode=factionTower2">
                {t('factionTower.editTeam')} 2
              </Link>{' '}
              · <Link className="text-link" to="/shop">{t('factionTower.shop')}</Link>
            </p>
          </section>

          {view.towers.map((tower) => {
            const why = blockText(tower);
            return (
              <section key={tower.faction} className={`card faction-tower-card faction-${tower.faction}`} data-tower={tower.faction}>
                <h2 className="section-title">
                  {t(`factionTower.${tower.faction}` as TowerKey)} — {t('factionTower.floor')} {tower.floor.toLocaleString()} / {view.floors.toLocaleString()}
                </h2>
                <p className="muted">
                  {t('factionTower.opens')} {tower.openDays.map((d) => DAYS[d]).join(', ')} · {t('factionTower.todayCount')} {tower.climbedToday} / {view.floorsPerDay}
                </p>
                {tower.block !== 'top' && (
                  <>
                    <p>
                      {t('factionTower.next')} {tower.nextFloor} {tower.teams === 2 ? `(${t('factionTower.twoTeams')})` : ''}:
                    </p>
                    <RewardLine rewards={tower.nextPay} />
                    {Object.keys(tower.nextBonus).length > 0 ? (
                      <p className="muted">
                        {t('factionTower.bonus')} <RewardLine rewards={tower.nextBonus} />
                      </p>
                    ) : null}
                    {tower.nextMilestone ? (
                      <p className="muted">
                        {t('factionTower.milestone')} {tower.nextMilestone.floor}
                        {tower.nextMilestone.evolveBox > 0 ? ` · ${t('factionTower.evolveBoxes').replace('{n}', String(tower.nextMilestone.evolveBox))}` : ''}
                      </p>
                    ) : null}
                  </>
                )}
                <p className={tower.team1.valid ? 'muted' : 'warn'}>
                  {t('factionTower.team')} 1 ({tower.team1.ofType} {t(`factionTower.${tower.faction}` as TowerKey)}): {tower.team1.names.join(', ') || '—'}
                </p>
                {tower.team2 ? (
                  <p className={tower.team2.valid ? 'muted' : 'warn'}>
                    {t('factionTower.team')} 2 ({tower.team2.ofType}): {tower.team2.names.join(', ') || '—'}
                  </p>
                ) : null}
                {why ? <p className="muted">{why}</p> : null}
                <button
                  type="button"
                  className="btn btn-primary"
                  data-testid={`faction-climb-${tower.faction}`}
                  disabled={busy || tower.block !== null}
                  onClick={() => void climbTower(tower.faction)}
                >
                  {t('factionTower.climb')}
                </button>{' '}
                <button
                  type="button"
                  className="btn"
                  disabled={busy || !tower.open || tower.floor === 0 || view.sweepPrice === null || view.gems < (view.sweepPrice ?? 0)}
                  onClick={() => void sweep(tower.faction)}
                >
                  {t('factionTower.sweep')}
                </button>
              </section>
            );
          })}
        </>
      )}

      {status && (
        <p className="status-box" data-testid="faction-status">
          {status}
        </p>
      )}
    </div>
  );
}
