import { useCallback, useEffect, useState } from 'react';
import type { Rewards } from '@wildbound/engine';
import type { SignInView } from '@wildbound/server';
import RewardLine from '../components/RewardLine';
import { t } from '../i18n';
import { useServer } from '../server/ServerProvider';

/** R9: the source's Sign In — a 31-day calendar with VIP doubles, missed-day patches and signed-day bonuses. */
export default function SignIn() {
  const { call, claim, snapshot, busy } = useServer();
  const [view, setView] = useState<SignInView | null>(null);
  const [granted, setGranted] = useState<Rewards | null>(null);

  const refresh = useCallback(async () => {
    const result = await call((s) => s.getSignIn());
    if (result.ok) setView(result.value);
  }, [call]);

  useEffect(() => {
    void refresh();
  }, [refresh, snapshot?.state.signIn]);

  const act = async (step: Parameters<typeof claim>[0]) => {
    setGranted(null);
    const result = await claim(step);
    if (result.ok) setGranted(result.value.granted);
  };

  return (
    <main className="main">
      <h1 className="page-title">{t('signin.title')}</h1>
      <p className="muted">{t('signin.subtitle')}</p>
      {view && (
        <>
          <section className="card">
            <h2 className="section-title">
              {t('signin.day')} {view.today} · {t('signin.signed')}: {view.signedCount}
            </h2>
            {granted && <RewardLine rewards={granted} />}
            <ul className="quest-list">
              {view.days.map((d) => (
                <li key={d.day} className="quest-row" data-sign-day={d.day}>
                  <div className="quest-info">
                    <span className="quest-name">
                      {t('signin.day')} {d.day}
                      {d.vipDouble !== null ? ` · ${t('signin.vipDouble').replace('{vip}', String(d.vipDouble))}` : ''}
                    </span>
                    <RewardLine rewards={d.rewards} />
                  </div>
                  {d.status === 'today' && (
                    <button type="button" className="btn btn-primary" disabled={busy} onClick={() => void act((s) => s.signIn())}>
                      {t('signin.sign')}
                    </button>
                  )}
                  {d.canPatch && (
                    <button type="button" className="btn" disabled={busy} onClick={() => void act((s) => s.patchSignIn(d.day))}>
                      {t('signin.patch').replace('{gems}', String(view.patchGems))}
                    </button>
                  )}
                  {d.canDouble && (
                    <button type="button" className="btn" disabled={busy} onClick={() => void act((s) => s.doubleSignIn(d.day))}>
                      {t('signin.double')}
                    </button>
                  )}
                  {d.status === 'signed' && !d.canDouble && <span className="muted">{t('signin.done')}</span>}
                </li>
              ))}
            </ul>
          </section>
          <section className="card">
            <h2 className="section-title">{t('signin.bonuses')}</h2>
            <ul className="chest-list">
              {view.milestones.map((m) => (
                <li key={m.index} className="chest-row">
                  <div className="quest-info">
                    <span className="quest-name">{t('signin.bonusDays').replace('{days}', String(m.days))}</span>
                    <RewardLine rewards={m.rewards} />
                  </div>
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={!m.ready || busy}
                    onClick={() => void act((s) => s.claimSignInMilestone(m.index))}
                  >
                    {m.claimed ? t('quests.claimed') : m.ready ? t('quests.claim') : t('quests.locked')}
                  </button>
                </li>
              ))}
            </ul>
          </section>
        </>
      )}
    </main>
  );
}
