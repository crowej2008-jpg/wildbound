import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { Account3View } from '@wildbound/server';
import { t } from '../i18n';
import { useServer } from '../server/ServerProvider';

/** M15 Account systems III: trainer treasures, Z Ring + Pure Crystals, fusion skins, Golden Egg, Awakening. */

type Tab = 'treasures' | 'zring' | 'fusion' | 'egg' | 'awaken';
const FACTIONS = ['water', 'fire', 'grass', 'light', 'dark'] as const;

export default function AccountSystems() {
  const { call, busy } = useServer();
  const [view, setView] = useState<Account3View | null>(null);
  const [tab, setTab] = useState<Tab>('treasures');
  const [status, setStatus] = useState<string | null>(null);
  const refresh = useCallback(async () => {
    const res = await call((s) => s.getAccount3());
    if (res.ok) setView(res.value);
  }, [call]);
  useEffect(() => {
    void refresh();
  }, [refresh]);
  const act = async (p: Promise<{ ok: boolean }>, msg?: string) => {
    const r = await p;
    if (r.ok && msg) setStatus(msg);
    await refresh();
  };
  if (!view) return <p className="muted">…</p>;
  const c = view.currencies;

  return (
    <div className="page account-systems">
      <Link className="text-link" to="/trainer">
        {t('a3.back')}
      </Link>
      <h1 className="page-title">{t('a3.title')}</h1>
      <p className="muted" data-testid="a3-currencies">
        {Object.entries(c)
          .map(([k, v]) => `${t(`currency.${k}` as 'currency.gold')}: ${v}`)
          .join(' · ')}
      </p>
      <div className="chip-row">
        {(['treasures', 'zring', 'fusion', 'egg', 'awaken'] as Tab[]).map((k) => (
          <button key={k} type="button" className={`btn ${tab === k ? 'btn-primary' : ''}`} data-testid={`a3-tab-${k}`} onClick={() => setTab(k)}>
            {t(`a3.tab.${k}` as 'a3.tab.treasures')}
          </button>
        ))}
      </div>

      {tab === 'treasures' && (
        <section className="card">
          <p className="muted">
            {t('a3.resonance')} {view.resonance} / 5
          </p>
          <ul className="plain-list" data-testid="a3-treasures">
            {view.treasures.map((x) => (
              <li key={x.type}>
                <strong>{x.name}</strong>{' '}
                {!x.unlocked ? (
                  <span className="muted">— {t('a3.unlockAt').replace('{gym}', x.gymName)}</span>
                ) : (
                  <>
                    Lv {x.level} · {t('a3.accessory')} {x.accessory} · {t('a3.refine')} {x.refine} · {x.star}★ · {t('a3.skill')} {x.skillLevel}
                    <p className="muted">{x.skillText}</p>
                    {(['level', 'accessory', 'refine', 'star'] as const).map((a) =>
                      x.costs[a] !== null ? (
                        <button key={a} type="button" className="btn" disabled={busy} onClick={() => void act(call((s) => s.upgradeTreasure(x.type, a), (v) => v))}>
                          {t(`a3.up.${a}` as 'a3.up.level')} ({x.costs[a]})
                        </button>
                      ) : null,
                    )}{' '}
                    <select aria-label={t('a3.faction')} value={x.faction ?? ''} onChange={(e) => void act(call((s) => s.setTreasureFaction(x.type, e.target.value), (v) => v))}>
                      <option value="">{t('a3.faction')}</option>
                      {FACTIONS.map((f) => (
                        <option key={f} value={f}>
                          {f}
                        </option>
                      ))}
                    </select>
                  </>
                )}
              </li>
            ))}
          </ul>
          <p className="muted">{t('a3.skillsNote')}</p>
        </section>
      )}

      {tab === 'zring' && (
        <section className="card">
          <p>
            {t('a3.zring')} Lv {view.wristband.level}{' '}
            {view.wristband.next !== null ? (
              <button type="button" className="btn btn-primary" disabled={busy || c.wristbandEssence! < view.wristband.next} onClick={() => void act(call((s) => s.levelWristband(), (v) => v))}>
                {t('a3.levelUp')} ({view.wristband.next})
              </button>
            ) : null}
          </p>
          <ul className="plain-list">
            {view.crystals.map((x) => (
              <li key={x.faction}>
                {t('a3.crystal')} ({x.faction}) Lv {x.level} / {x.cap}{' '}
                {x.next !== null ? (
                  <button type="button" className="btn" disabled={busy || x.level >= x.cap || c.crystalEssence! < x.next} onClick={() => void act(call((s) => s.levelCrystal(x.faction), (v) => v))}>
                    {t('a3.levelUp')} ({x.next})
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      )}

      {tab === 'fusion' && (
        <section className="card">
          <ul className="plain-list">
            {view.fusion.map((f) => (
              <li key={f.id}>
                {f.name} Lv {f.level} — {f.perk.replace('%s%%', `${f.perkValue}%`)} · {t('a3.shards')} {f.shards}{' '}
                {f.next !== null ? (
                  <button type="button" className="btn" disabled={busy || f.shards < f.next} onClick={() => void act(call((s) => s.levelFusion(f.id), (v) => v))}>
                    {t('a3.levelUp')} ({f.next})
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
          <p className="muted">{t('a3.fusionNote')}</p>
        </section>
      )}

      {tab === 'egg' && (
        <section className="card">
          <p data-testid="a3-egg">
            {t('a3.eggPoints')} {view.egg.points} · {t('a3.freeSmash')} {view.egg.freeLeft}
          </p>
          {[1, 10, 30].map((n) => (
            <button
              key={n}
              type="button"
              className="btn btn-primary"
              disabled={busy || (n === 1 ? view.egg.freeLeft < 1 && view.egg.vouchers < 1 : view.egg.vouchers < n)}
              onClick={() => void act(call((s) => s.smashEggs(n as 1 | 10 | 30), (v) => v.snapshot), t('a3.smashed'))}
            >
              {t('a3.smash')} ×{n}
            </button>
          ))}
          <ul className="plain-list">
            {view.egg.shop.map((r) => (
              <li key={r.id}>
                {r.name} ×{r.shards} — {r.price} · {r.left}{' '}
                <button type="button" className="btn" disabled={busy || r.left < 1 || view.egg.points < r.price} onClick={() => void act(call((s) => s.buyEggShop(r.id), (v) => v))}>
                  {t('joint.buy')}
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {tab === 'awaken' && (
        <section className="card">
          {!view.awaken.open ? (
            <p className="muted" data-testid="a3-awaken-locked">
              {t('a3.awakenLocked')}
            </p>
          ) : (
            <>
              <p>
                {t('a3.progress')} {view.awaken.progress} / {view.awaken.need}
              </p>
              <ul className="plain-list">
                {view.awaken.candidates.map((w) => (
                  <li key={w.id}>
                    {w.name}{' '}
                    <button type="button" className={`btn ${view.awaken.wildId === w.id ? 'btn-primary' : ''}`} disabled={busy} onClick={() => void act(call((s) => s.chooseAwakening(w.id), (v) => v))}>
                      {view.awaken.wildId === w.id ? t('a3.training') : t('a3.train')}
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
      )}
      {status && (
        <p className="status-box" data-testid="a3-status">
          {status}
        </p>
      )}
    </div>
  );
}
