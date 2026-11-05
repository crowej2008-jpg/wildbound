import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { BattleView, ParkView } from '@wildbound/server';
import BattleReplay from '../components/BattleReplay';
import { t } from '../i18n';
import { useServer } from '../server/ServerProvider';

/** Pokémon Park: explore the 19-grid park, fight wild Pokémon, hatch eggs and hit the mythical boss. */
export default function PokemonPark() {
  const { call, busy } = useServer();
  const [view, setView] = useState<ParkView | null>(null);
  const [fight, setFight] = useState<{ battle: BattleView; text: string } | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const refresh = useCallback(async () => {
    const r = await call((s) => s.getPark());
    if (r.ok) setView(r.value);
  }, [call]);
  useEffect(() => {
    void refresh();
  }, [refresh]);

  if (fight)
    return (
      <BattleReplay
        view={fight.battle}
        attackerLabel={t('combat.team.attackers')}
        defenderLabel={t('park.title')}
        resultExtra={
          <section className="card result-rewards">
            <strong data-testid="park-outcome">{fight.text}</strong>
            <button type="button" className="btn btn-primary" onClick={() => { setFight(null); void refresh(); }}>
              {t('joint.back')}
            </button>
          </section>
        }
      />
    );
  if (!view) return <p className="muted">…</p>;
  if (!view.joined)
    return (
      <div className="page park">
        <h1 className="page-title">{t('park.title')}</h1>
        <p className="muted" data-testid="park-locked">{t('gw.needGuild')}</p>
        <Link className="btn" to="/guild">{t('home.link.guild')}</Link>
      </div>
    );
  const tap = async (index: number) => {
    const r = view.grid === null ? await call((s) => s.enterPark(index), (v) => v) : await call((s) => s.movePark(index), (v) => v);
    if (r.ok) setStatus(null);
    await refresh();
  };
  const explore = async () => {
    const r = await call((s) => s.explorePark(), (v) => v.snapshot);
    if (r.ok) setStatus(r.value.found === 'egg' ? t('park.foundEgg') : t('park.foundWild'));
    await refresh();
  };
  const fightWild = async () => {
    const r = await call((s) => s.fightWild(), (v) => v.snapshot);
    if (r.ok) setFight({ battle: r.value.battle, text: r.value.win ? t('park.won') : t('park.lost') });
    else await refresh();
  };
  const boss = async () => {
    const r = await call((s) => s.attackParkBoss(), (v) => v.snapshot);
    if (r.ok) setFight({ battle: r.value.battle, text: (r.value.lastHit ? t('park.lastHit') : '') + t('gw.dealt').replace('{n}', r.value.damage.toLocaleString()).replace('{k}', r.value.lastHit ? '1' : '0') });
    else await refresh();
  };
  const simple = async (p: Promise<{ ok: boolean }>, msg: string) => {
    const r = await p;
    if (r.ok) setStatus(msg);
    await refresh();
  };
  return (
    <div className="page park">
      <Link className="text-link" to="/guild">{t('home.link.guild')}</Link>
      <h1 className="page-title">{t('park.title')}</h1>
      <p className="muted" data-testid="park-summary">
        {view.open ? t('park.open') : t('park.closed')} · {t('relic.stamina')} {view.stamina} / {view.staminaMax} · {t('park.score')} {view.score}
        {view.rank ? ` (#${view.rank})` : ''} · {t('park.team')} {view.team}
      </p>
      {view.fainted.length > 0 && <p className="muted">{t('park.fainted')}: {view.fainted.join(', ')}</p>}
      <Link className="text-link" to="/squad?mode=park">{t('park.setTeam')}</Link>
      <section className="card" data-testid="park-map">
        <p className="muted">{view.grid === null ? t('park.pickGrid') : t('park.moveHint')}</p>
        <div className="chip-row">
          {view.grids.map((g) => (
            <button
              key={g.index}
              type="button"
              className={`btn park-grid ${g.here ? 'btn-primary' : ''}`}
              disabled={busy || !view.open || g.collapsed || g.here || !g.reachable || !!view.pending}
              title={`${g.name} · ${'★'.repeat(g.quality)}${g.collapsed ? ' · collapsed' : ''}`}
              onClick={() => void tap(g.index)}
            >
              {g.name}
              {'★'.repeat(g.quality)}
            </button>
          ))}
        </div>
      </section>
      {view.grid !== null && (
        <section className="card">
          {view.pending ? (
            <>
              <p>{t('park.wildHere').replace('{q}', '★'.repeat(view.pending.quality))}</p>
              <button type="button" className="btn btn-primary" disabled={busy} onClick={() => void fightWild()}>
                {t('park.fight')}
              </button>{' '}
              <button type="button" className="btn" disabled={busy} onClick={() => void simple(call((s) => s.skipWild(), (v) => v), t('park.skipped'))}>
                {t('park.skip')}
              </button>
            </>
          ) : (
            <button type="button" className="btn btn-primary" disabled={busy || view.stamina < 1} onClick={() => void explore()}>
              {t('relic.explore')}
            </button>
          )}
        </section>
      )}
      <section className="card">
        <h2>{t('park.eggs')}</h2>
        <p data-testid="park-bag">
          {view.bag.length} / {view.bagSize} · {view.bag.map((e) => (e.hatchIn > 0 ? `${e.hatchIn} min` : '✓')).join(' · ')}
        </p>
        <button type="button" className="btn" disabled={busy || !view.bag.some((e) => e.hatchIn === 0)} onClick={() => void simple(call((s) => s.hatchEggs(), (v) => v.snapshot), t('park.hatched'))}>
          {t('park.hatch')}
        </button>
      </section>
      <section className="card">
        <h2>{t('park.boss')}</h2>
        {view.boss.out ? (
          <>
            <p>
              HP {view.boss.hp.toLocaleString()} / {view.boss.maxHp.toLocaleString()} · {view.boss.endsIn} min · {t('park.attacks')} {view.boss.attacks}
            </p>
            <button type="button" className="btn btn-primary" disabled={busy} onClick={() => void boss()}>
              {t('gw.challenge')}
            </button>
          </>
        ) : (
          <p className="muted">{t('park.bossTimes').replace('{t}', view.boss.next)}</p>
        )}
        {view.boss.claimable && (
          <button type="button" className="btn" disabled={busy} onClick={() => void simple(call((s) => s.claimParkBoss(), (v) => v.snapshot), t('events.claimed'))}>
            {t('park.claimBoss')}
          </button>
        )}
      </section>
      {view.lastWeek && !view.lastWeek.claimed && (
        <button type="button" className="btn btn-primary" disabled={busy} onClick={() => void simple(call((s) => s.claimParkSeason(), (v) => v.snapshot), t('events.claimed'))}>
          {t('park.claimSeason').replace('{r}', String(view.lastWeek.rank))}
        </button>
      )}
      {status && <p className="status-box" data-testid="park-status">{status}</p>}
    </div>
  );
}
