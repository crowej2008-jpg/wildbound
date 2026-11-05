import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { BattleView, JointTeamView } from '@wildbound/server';
import BattleReplay from '../components/BattleReplay';
import RewardLine from '../components/RewardLine';
import { t } from '../i18n';
import { useServer } from '../server/ServerProvider';

/** Joint Team (M14.4): squad battles vs CPU squads, milestones, shop, squad skills, and the Wild Area (Dynamax). */

type Tab = 'battles' | 'wild' | 'shop' | 'skills';

export default function JointTeam() {
  const { call, busy } = useServer();
  const [view, setView] = useState<JointTeamView | null>(null);
  const [tab, setTab] = useState<Tab>('battles');
  const [rate, setRate] = useState(1);
  const [fight, setFight] = useState<{ battle: BattleView; text: string } | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const res = await call((s) => s.getJointTeam());
    if (res.ok) setView(res.value);
  }, [call]);
  useEffect(() => {
    void refresh();
  }, [refresh]);

  const done = async (ok: boolean, msg?: string) => {
    if (ok && msg) setStatus(msg);
    await refresh();
  };

  if (fight) {
    return (
      <BattleReplay
        view={fight.battle}
        attackerLabel={t('combat.team.attackers')}
        defenderLabel={t('joint.title')}
        resultExtra={
          <section className="card result-rewards">
            <strong data-testid="joint-outcome">{fight.text}</strong>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                setFight(null);
                void refresh();
              }}
            >
              {t('joint.back')}
            </button>
          </section>
        }
      />
    );
  }
  if (!view) return <p className="muted">…</p>;
  const b = view.battles;
  const w = view.wild;

  return (
    <div className="page joint-team">
      <Link className="text-link" to="/combat">
        {t('pve.title')}
      </Link>
      <h1 className="page-title">{t('joint.title')}</h1>
      {!view.unlocked ? (
        <section className="card">
          <p data-testid="joint-locked">{t('joint.locked')}</p>
        </section>
      ) : (
        <>
          <div className="chip-row">
            {(['battles', 'wild', 'shop', 'skills'] as Tab[]).map((k) => (
              <button key={k} type="button" className={`btn ${tab === k ? 'btn-primary' : ''}`} data-testid={`joint-tab-${k}`} onClick={() => setTab(k)}>
                {t(`joint.tab.${k}` as 'joint.tab.battles')}
              </button>
            ))}
            <Link className="text-link" to="/squad?mode=jointTeam">
              {t('joint.editTeam')}
            </Link>
          </div>

          {tab === 'battles' && (
            <section className="card">
              <p data-testid="joint-summary">
                {t('joint.points')} {b.points} · {t('joint.squadPoints')} {b.squadPoints} · {t('joint.rank')} #{b.rank} · {t('joint.left')} {b.battlesLeft} (+{b.tickets})
              </p>
              {!view.battleDay ? <p className="muted">{t('joint.monday')}</p> : null}
              <ul className="plain-list">
                {b.opponents.map((o) => (
                  <li key={o.index}>
                    {t('joint.rival')} {o.index + 1} — ×{o.strength.toFixed(2)}{' '}
                    <button
                      type="button"
                      className="btn btn-primary"
                      data-testid={`joint-challenge-${o.index}`}
                      disabled={busy || !view.battleDay || (b.battlesLeft < 1 && b.tickets < 1)}
                      onClick={async () => {
                        const r = await call((s) => s.challengeJointSquad(o.index), (v) => v.snapshot);
                        if (r.ok) setFight({ battle: r.value.battle, text: `${r.value.win ? t('joint.won') : t('joint.lost')} +${r.value.points}` });
                      }}
                    >
                      {t('joint.challenge')}
                    </button>
                  </li>
                ))}
              </ul>
              <button type="button" className="btn" disabled={busy || b.refreshesLeft < 1} onClick={async () => done((await call((s) => s.refreshJointOpponents(), (v) => v)).ok)}>
                {t('joint.refresh')} ({b.refreshesLeft})
              </button>
              {b.lastRank !== null ? (
                <button type="button" className="btn btn-primary" onClick={async () => done((await call((s) => s.claimJointSeason(), (v) => v.snapshot)).ok, t('joint.claimed'))}>
                  {t('joint.season')} #{b.lastRank}
                </button>
              ) : null}
              <h2 className="section-title">{t('joint.personal')}</h2>
              <ul className="plain-list">
                {b.personal.map((r) => (
                  <li key={r.at}>
                    {r.at} — <RewardLine rewards={r.rewards} />{' '}
                    <button type="button" className="btn" disabled={busy || r.claimed || !r.ready} onClick={async () => done((await call((s) => s.claimJointMilestone('p', r.at), (v) => v.snapshot)).ok, t('joint.claimed'))}>
                      {r.claimed ? '✓' : t('joint.claim')}
                    </button>
                  </li>
                ))}
              </ul>
              <h2 className="section-title">{t('joint.squadRewards')}</h2>
              <ul className="plain-list">
                {b.squad.map((r) => (
                  <li key={r.at}>
                    {r.at} — <RewardLine rewards={r.rewards} />{' '}
                    <button type="button" className="btn" disabled={busy || r.claimed || !r.ready} onClick={async () => done((await call((s) => s.claimJointMilestone('s', r.at), (v) => v.snapshot)).ok, t('joint.claimed'))}>
                      {r.claimed ? '✓' : t('joint.claim')}
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {tab === 'wild' && (
            <section className="card">
              <p data-testid="wild-summary">
                {w.zoneName} · {t('joint.energy')} {w.energy} / {w.energyMax} · {t('joint.wildPoints')} {w.points} · {t('joint.badges')} {w.badges}
              </p>
              {!w.open ? <p className="muted">{t('joint.wildClosed')}</p> : null}
              {w.fragments.length > 0 ? <p className="muted">{w.fragments.map((f) => `${f.name} ×${f.count}`).join(' · ')}</p> : null}
              <p>
                {w.rates.map((r) => (
                  <button key={r} type="button" className={`btn ${rate === r ? 'btn-primary' : ''}`} onClick={() => setRate(r)}>
                    ×{r}
                  </button>
                ))}
              </p>
              {w.guess ? (
                <p>
                  {t('joint.guess').replace('{ball}', w.guess)}{' '}
                  <button type="button" className="btn" onClick={async () => { const r = await call((s) => s.guessWild(true), (v) => v.snapshot); await done(r.ok, r.ok ? (r.value.right ? t('joint.right') : t('joint.wrong')) : undefined); }}>
                    {t('joint.yes')}
                  </button>{' '}
                  <button type="button" className="btn" onClick={async () => { const r = await call((s) => s.guessWild(false), (v) => v.snapshot); await done(r.ok, r.ok ? (r.value.right ? t('joint.right') : t('joint.wrong')) : undefined); }}>
                    {t('joint.no')}
                  </button>
                </p>
              ) : (
                <button
                  type="button"
                  className="btn btn-primary"
                  data-testid="wild-explore"
                  disabled={busy || !w.open}
                  onClick={async () => {
                    const r = await call((s) => s.exploreWild(rate), (v) => v.snapshot);
                    if (!r.ok) return;
                    const text = `${t(`joint.event.${r.value.event}` as 'joint.event.chest')} +${r.value.points}${r.value.fragment ? ` · ${r.value.fragment}` : ''}`;
                    if (r.value.battle) setFight({ battle: r.value.battle, text: `${r.value.win ? t('joint.won') : t('joint.lost')} — ${text}` });
                    else await done(true, text);
                  }}
                >
                  {t('joint.explore')}
                </button>
              )}{' '}
              <button type="button" className="btn" disabled={busy || w.zone >= 3 || w.teleporters < 1} onClick={async () => done((await call((s) => s.teleportWild(), (v) => v)).ok)}>
                {t('joint.teleport')} ({w.teleporters})
              </button>{' '}
              <button type="button" className="btn" disabled={busy || w.cans < 1} onClick={async () => done((await call((s) => s.useWildEnergyCan(), (v) => v)).ok)}>
                {t('joint.can')} ({w.cans})
              </button>
              {w.lastRank !== null ? (
                <button type="button" className="btn btn-primary" onClick={async () => done((await call((s) => s.claimWildSeason(), (v) => v.snapshot)).ok, t('joint.claimed'))}>
                  {t('joint.season')} #{w.lastRank}
                </button>
              ) : null}
            </section>
          )}

          {tab === 'shop' && (
            <section className="card">
              <p className="muted">
                {t('currency.squadCoin')}: {view.coins}
              </p>
              <ul className="plain-list">
                {view.shop
                  .filter((r) => Object.keys(r.rewards).length > 0)
                  .map((r) => (
                    <li key={r.id}>
                      <RewardLine rewards={r.rewards} /> — {r.price} · {r.left}{' '}
                      <button type="button" className="btn" disabled={busy || r.locked || r.left < 1 || view.coins < r.price} onClick={async () => done((await call((s) => s.buyJointShop(r.id), (v) => v.snapshot)).ok, t('joint.bought'))}>
                        {r.locked ? t('joint.shelfLocked') : t('joint.buy')}
                      </button>
                    </li>
                  ))}
              </ul>
            </section>
          )}

          {tab === 'skills' && (
            <section className="card">
              <p className="muted">
                {t('currency.coreSkillStone')}: {view.stones}
              </p>
              <ul className="plain-list">
                {view.skills.map((k) => (
                  <li key={k.field}>
                    {k.field} Lv {k.level}{' '}
                    <button type="button" className="btn" disabled={busy || k.level >= k.maxLevel || view.stones < k.cost} onClick={async () => done((await call((s) => s.levelSquadSkill(k.field), (v) => v)).ok)}>
                      {t('joint.levelUp')} ({k.cost})
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
      {status && (
        <p className="status-box" data-testid="joint-status">
          {status}
        </p>
      )}
    </div>
  );
}
