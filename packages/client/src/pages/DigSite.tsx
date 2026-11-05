import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { DigSiteView } from '@wildbound/server';
import { formatDuration, t } from '../i18n';
import { useServer } from '../server/ServerProvider';

/** Dig Site (M13.9): dig soul hearts, fossils and treasures out of rock walls; cure fossils; fill the museum. */

type Tool = 'pick' | 'hammer';

const FIELD_NAME: Record<string, string> = {
  crit: 'Crit Chance',
  critRes: 'Crit Resistance',
  critPower: 'Crit Intensity',
  block: 'Block',
  blockPower: 'Block Intensity',
  guardBreak: 'Guard Break',
  dmgBoost: 'DMG Boost',
  dmgRdct: 'DMG Reduction',
  controlBoost: 'Control Boost',
  controlRes: 'Control Resistance',
  pvpBoost: 'PvP DMG Boost',
  pvpRdct: 'PvP DMG Reduction',
};

const CATEGORIES = ['finds', 'berries', 'heldItems', 'orbs', 'soulHearts'] as const;
type Hall = (typeof CATEGORIES)[number];

const pctText = (v: number) => `${Math.round(v * 1000) / 10}%`;

function groupBonus(g: { hp: number; atk: number; hpPct: number; atkPct: number; lines: { field: string; value: number }[] }): string {
  return [
    `HP +${g.hp.toLocaleString()}`,
    `ATK +${g.atk.toLocaleString()}`,
    `HP +${pctText(g.hpPct)}`,
    `ATK +${pctText(g.atkPct)}`,
    ...g.lines.map((l) => `${FIELD_NAME[l.field] ?? l.field} +${pctText(l.value)}`),
  ].join(' · ');
}
type Tab = 'wall' | 'lab' | 'museum';

const KIND_COLOR: Record<string, string> = {
  soulHeart: '#d0546b',
  exp: '#7b6cd9',
  fossil: '#b08a52',
  treasure: '#3fa7a1',
};

function rockColor(depth: number): string {
  // Lighter rock as it wears away.
  const shades = ['#e9e1d3', '#cdbb9f', '#b49e7f', '#9a8264', '#80684c', '#674f37', '#4f3a26'];
  return shades[Math.min(depth, shades.length - 1)]!;
}

export default function DigSite() {
  const { call, busy } = useServer();
  const [view, setView] = useState<DigSiteView | null>(null);
  const [tool, setTool] = useState<Tool>('pick');
  const [tab, setTab] = useState<Tab>('wall');
  const [status, setStatus] = useState<string | null>(null);
  const [hall, setHall] = useState<Hall>('finds');
  const [picked, setPicked] = useState<Record<string, string>>({});

  const refresh = useCallback(async () => {
    const res = await call((s) => s.getDigSite());
    if (res.ok) setView(res.value);
  }, [call]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const report = (finds: { name: string }[], collapsed: boolean) => {
    if (finds.length === 0 && !collapsed) return;
    const got = finds.length > 0 ? `${t('dig.found')} ${finds.map((f) => f.name).join(', ')}` : t('dig.foundNothing');
    setStatus(collapsed ? `${t('dig.collapsed')} ${got}` : got);
  };

  const start = async () => {
    setStatus(null);
    const res = await call((s) => s.startDigWall(), (v) => v.snapshot);
    if (res.ok) report(res.value.finds, false);
    await refresh();
  };

  const hit = async (x: number, y: number) => {
    const res = await call((s) => s.strikeDigWall(tool, x, y), (v) => v.snapshot);
    if (!res.ok) return;
    const next = await call((s) => s.getDigSite());
    if (next.ok) {
      setView(next.value);
      if (next.value.wall?.over) report(res.value.finds, next.value.wall.collapsed);
    }
  };

  const leave = async () => {
    const res = await call((s) => s.leaveDigWall(), (v) => v.snapshot);
    if (res.ok) report(res.value.finds, false);
    await refresh();
  };

  const done = async (ok: boolean, message: string) => {
    if (ok) setStatus(message);
    await refresh();
  };
  const collect = async () => done((await call((s) => s.collectCured(), (v) => v)).ok, t('dig.collected'));
  const cure = async (id: string) => done((await call((s) => s.cureFossil(id), (v) => v)).ok, t('dig.curing'));
  const display = async (id: string, instanceId?: string) => done((await call((s) => s.displayMuseumPiece(id, instanceId), (v) => v)).ok, t('dig.displayed'));
  const donate = async () => done((await call((s) => s.donateSpares(), (v) => v)).ok, t('dig.donated'));

  if (!view) return <p className="muted">…</p>;
  const wall = view.wall;

  return (
    <div className="page dig-site">
      <Link className="text-link" to="/explore">
        {t('hoopa.backToExplore')}
      </Link>
      <h1 className="page-title">{t('dig.title')}</h1>

      {!view.unlocked ? (
        <section className="card">
          <p data-testid="dig-locked">{t('dig.locked')}</p>
        </section>
      ) : (
        <>
          <section className="card">
            <p className="muted">
              {t('currency.gold')}: {view.gold.toLocaleString()} · {t('currency.soulHeartExp')}: {view.soulHeartExp.toLocaleString()} ·{' '}
              {t('dig.museumCount')} {view.museum.shown} / {view.museum.total}
            </p>
            <div className="chip-row">
              {(['wall', 'lab', 'museum'] as Tab[]).map((k) => (
                <button key={k} type="button" className={`btn ${tab === k ? 'btn-primary' : ''}`} onClick={() => setTab(k)} data-testid={`dig-tab-${k}`}>
                  {t(`dig.tab.${k}` as 'dig.tab.wall')}
                </button>
              ))}
            </div>
          </section>

          {tab === 'wall' && (
            <section className="card dig-wall-card">
              {!wall || wall.over ? (
                <p>
                  <button type="button" className="btn btn-primary" data-testid="dig-new-wall" disabled={busy} onClick={() => void start()}>
                    {t('dig.newWall')}
                  </button>
                </p>
              ) : (
                <>
                  <p>
                    {t('dig.tool')}{' '}
                    {(['pick', 'hammer'] as Tool[]).map((k) => (
                      <button key={k} type="button" className={`btn ${tool === k ? 'btn-primary' : ''}`} data-testid={`dig-tool-${k}`} onClick={() => setTool(k)}>
                        {t(`dig.${k}` as 'dig.pick')}
                      </button>
                    ))}{' '}
                    <button type="button" className="btn" disabled={busy} onClick={() => void leave()}>
                      {t('dig.leave')}
                    </button>
                  </p>
                  <p className="muted">{t('dig.toolHelp')}</p>
                </>
              )}
              {wall && (
                <>
                  <div className="dig-stability" data-testid="dig-stability" aria-label={t('dig.stability')}>
                    <span className="muted">
                      {t('dig.stability')} {wall.shake} / {wall.stability} · {t('dig.freed')} {wall.free} / {wall.buried}
                    </span>
                    <div style={{ height: 8, background: 'var(--surface-2, #ddd)', borderRadius: 4, overflow: 'hidden' }}>
                      <div style={{ width: `${(100 * wall.shake) / wall.stability}%`, height: '100%', background: wall.shake / wall.stability > 0.75 ? '#c0392b' : '#d68910' }} />
                    </div>
                  </div>
                  <div
                    className="dig-grid"
                    data-testid="dig-grid"
                    style={{ display: 'grid', gridTemplateColumns: `repeat(${view.width}, 1fr)`, gap: 2, marginTop: 8, maxWidth: 520 }}
                  >
                    {wall.cells.map((c, i) => {
                      const x = i % view.width;
                      const y = Math.floor(i / view.width);
                      const bg = c.bedrock ? '#2c2c34' : c.item ? KIND_COLOR[c.item.kind] : c.depth === 0 ? '#f4efe6' : rockColor(c.depth);
                      return (
                        <button
                          key={i}
                          type="button"
                          className="dig-cell"
                          data-depth={c.depth}
                          title={c.item ? c.item.name : c.bedrock ? t('dig.bedrock') : `${c.depth}`}
                          disabled={busy || wall.over}
                          onClick={() => void hit(x, y)}
                          style={{ aspectRatio: '1', border: 'none', borderRadius: 3, padding: 0, background: bg, opacity: c.item && !c.item.free && wall.over ? 0.4 : 1, cursor: 'pointer' }}
                        />
                      );
                    })}
                  </div>
                  <p className="muted">{t('dig.legend')}</p>
                </>
              )}
            </section>
          )}

          {tab === 'lab' && (
            <section className="card dig-lab">
              <h2 className="section-title">{t('dig.lab')}</h2>
              <ul className="plain-list">
                {view.lab.map((s, i) => (
                  <li key={i}>
                    {t('dig.slot')} {i + 1}:{' '}
                    {s ? (s.readyInMs === 0 ? `${s.name} — ${t('dig.ready')}` : `${s.name} — ${formatDuration(s.readyInMs)}`) : <span className="muted">{t('dig.empty')}</span>}
                  </li>
                ))}
              </ul>
              <button
                type="button"
                className="btn btn-primary"
                disabled={busy || !view.lab.some((s) => s && s.readyInMs === 0)}
                onClick={() => void collect()}
              >
                {t('dig.collect')}
              </button>
              <h3 className="section-title">{t('dig.rawFossils')}</h3>
              <ul className="plain-list">
                {view.fossils.filter((f) => f.have > 0).length === 0 ? <li className="muted">{t('dig.noFossils')}</li> : null}
                {view.fossils
                  .filter((f) => f.have > 0)
                  .map((f) => (
                    <li key={f.id}>
                      {f.name} ×{f.have} — {f.hours}h · {f.gold.toLocaleString()} {t('currency.gold')}{' '}
                      <button
                        type="button"
                        className="btn"
                        disabled={busy || view.gold < f.gold || !view.lab.some((s) => s === null)}
                        onClick={() => void cure(f.id)}
                      >
                        {t('dig.cure')}
                      </button>
                    </li>
                  ))}
              </ul>
            </section>
          )}

          {tab === 'museum' && (
            <section className="card dig-museum">
              <h2 className="section-title">{t('dig.museum')}</h2>
              <p className="muted">{t('dig.museumHelp')}</p>
              <div className="chip-row">
                {CATEGORIES.map((c) => (
                  <button key={c} type="button" className={`btn ${hall === c ? 'btn-primary' : ''}`} data-testid={`dig-hall-${c}`} onClick={() => setHall(c)}>
                    {t(`dig.hall.${c}` as 'dig.hall.finds')}
                  </button>
                ))}
              </div>
              {view.museum.groups
                .filter((g) => g.category === hall)
                .map((g) => (
                  <div key={g.id} className="dig-group" data-group={g.id}>
                    <h3 className="section-title">
                      {g.complete ? '✓ ' : ''}
                      {g.name} ({g.filled} / {g.pieces.length})
                    </h3>
                    <p className={g.complete ? '' : 'muted'}>
                      {t('dig.groupBonus')} {groupBonus(g)}
                    </p>
                    <ul className="plain-list">
                      {g.pieces.map((p) => (
                        <li key={p.id} data-piece={p.id}>
                          {p.shown ? '✓ ' : ''}
                          {p.name} — HP +{p.hp.toLocaleString()} · ATK +{p.atk.toLocaleString()}
                          {!p.shown && (p.kind === 'fossil' || p.kind === 'treasure') && p.stored > 0 ? (
                            <>
                              {' '}
                              <button type="button" className="btn btn-primary" disabled={busy} onClick={() => void display(p.id)}>
                                {t('dig.display')}
                              </button>
                            </>
                          ) : null}
                          {!p.shown && p.candidates.length > 0 ? (
                            <>
                              {' '}
                              <select
                                aria-label={`${t('dig.choose')} ${p.name}`}
                                value={picked[p.id] ?? p.candidates[0]!.id}
                                onChange={(e) => setPicked({ ...picked, [p.id]: e.target.value })}
                              >
                                {p.candidates.map((c) => (
                                  <option key={c.id} value={c.id}>
                                    {c.label}
                                  </option>
                                ))}
                              </select>{' '}
                              <button
                                type="button"
                                className="btn btn-primary"
                                disabled={busy}
                                onClick={() => void display(p.id, picked[p.id] ?? p.candidates[0]!.id)}
                              >
                                {t('dig.donateOne')}
                              </button>
                            </>
                          ) : null}
                          {!p.shown && p.stored === 0 && p.candidates.length === 0 ? <span className="muted"> — {t('dig.missing')}</span> : null}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              {hall === 'finds' ? (
                <button type="button" className="btn" disabled={busy || view.spares === 0} onClick={() => void donate()}>
                  {t('dig.donate').replace('{n}', String(view.spares))}
                </button>
              ) : null}
            </section>
          )}
        </>
      )}

      {status && (
        <p className="status-box" data-testid="dig-status">
          {status}
        </p>
      )}
    </div>
  );
}
