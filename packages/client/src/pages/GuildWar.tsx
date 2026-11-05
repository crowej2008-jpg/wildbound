import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { BattleView, GuildWarView } from '@wildbound/server';
import BattleReplay from '../components/BattleReplay';
import { t } from '../i18n';
import { useServer } from '../server/ServerProvider';

/** M17 Guild War: five guild bosses a week, attempts from daily activity. */
export default function GuildWar() {
  const { call, busy } = useServer();
  const [view, setView] = useState<GuildWarView | null>(null);
  const [fight, setFight] = useState<{ battle: BattleView; text: string } | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const refresh = useCallback(async () => {
    const r = await call((s) => s.getGuildWar());
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
        defenderLabel={t('gw.title')}
        resultExtra={
          <section className="card result-rewards">
            <strong data-testid="gw-outcome">{fight.text}</strong>
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
      <div className="page guild-war">
        <h1 className="page-title">{t('gw.title')}</h1>
        <p className="muted" data-testid="gw-locked">{t('gw.needGuild')}</p>
        <Link className="btn" to="/guild">{t('home.link.guild')}</Link>
      </div>
    );
  const left = view.attempts.earned - view.attempts.used;
  const challenge = async (boss: number) => {
    const r = await call((s) => s.challengeGuildBoss(boss), (v) => v.snapshot);
    if (r.ok) setFight({ battle: r.value.battle, text: t('gw.dealt').replace('{n}', r.value.damage.toLocaleString()).replace('{k}', String(r.value.kills)) });
    else await refresh();
  };
  return (
    <div className="page guild-war">
      <Link className="text-link" to="/guild">{t('home.link.guild')}</Link>
      <h1 className="page-title">{t('gw.title')}</h1>
      <p className="muted" data-testid="gw-summary">
        {view.endless ? t('gw.endless') : `${t('gw.difficulty')} ${view.difficulty} / 15`} · {t('gw.attempts')} {left} ({view.attempts.used} / {view.attempts.earned}) · {t('gw.damage')} {view.damage.toLocaleString()}
      </p>
      <p className="muted">{t('gw.activityHint').replace('{list}', view.activityNeeded.join(' / '))}</p>
      <Link className="text-link" to="/squad?mode=guildWar">{t('gw.team')}</Link>
      <ul className="plain-list" data-testid="gw-bosses">
        {view.bosses.map((b) => (
          <li key={b.index} className="card">
            <strong>{b.name}</strong> — {t('gw.round')} {b.round} / 5 · HP {b.hp.toLocaleString()} / {b.maxHp.toLocaleString()}{' '}
            <button type="button" className="btn btn-primary" disabled={busy || left < 1} onClick={() => void challenge(b.index)}>
              {t('gw.challenge')}
            </button>
          </li>
        ))}
      </ul>
      <p className="muted">
        {t('gw.ranks')}: {t('gw.rankDaily')} #{view.ranks.daily || '—'} · {t('gw.rankSeason')} #{view.ranks.season || '—'} · {t('gw.rankGuild')} #{view.ranks.guild}
      </p>
      {view.canClaimDaily && (
        <button type="button" className="btn" disabled={busy} onClick={() => void call((s) => s.claimGuildWarDaily(), (v) => v.snapshot).then((r) => { if (r.ok) setStatus(t('events.claimed')); void refresh(); })}>
          {t('gw.claimDaily')}
        </button>
      )}
      {view.canClaimSeason && (
        <button type="button" className="btn" disabled={busy} onClick={() => void call((s) => s.claimGuildWarSeason(), (v) => v.snapshot).then((r) => { if (r.ok) setStatus(t('events.claimed')); void refresh(); })}>
          {t('gw.claimSeason')}
        </button>
      )}
      {status && <p className="status-box">{status}</p>}
    </div>
  );
}
