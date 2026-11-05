import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { GuildView } from '@wildbound/server';
import { t } from '../i18n';
import { useServer } from '../server/ServerProvider';

/** M16 Guild: a solo guild of CPU members — donations, red packets and the guild beast. */
export default function Guild() {
  const { call, busy } = useServer();
  const [view, setView] = useState<GuildView | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const refresh = useCallback(async () => {
    const r = await call((s) => s.getGuild());
    if (r.ok) setView(r.value);
  }, [call]);
  useEffect(() => {
    void refresh();
  }, [refresh]);
  const act = async (p: Promise<{ ok: boolean }>, msg: string) => {
    const r = await p;
    if (r.ok) setStatus(msg);
    await refresh();
  };
  if (!view) return <p className="muted">…</p>;
  if (!view.joined)
    return (
      <div className="page guild">
        <h1 className="page-title">{t('guild.title')}</h1>
        <p className="muted">{t('guild.joinDesc')}</p>
        <button type="button" className="btn btn-primary" disabled={busy} onClick={() => void act(call((s) => s.joinGuild(), (v) => v), t('guild.joined'))}>
          {t('guild.join')}
        </button>
      </div>
    );
  const d = view.donations;
  return (
    <div className="page guild">
      <h1 className="page-title">
        {view.name} · Lv {view.level}
      </h1>
      <p className="muted" data-testid="guild-summary">
        {t('guild.exp')} {view.exp}
        {view.nextExp !== null ? ` / ${view.nextExp}` : ''} · {t('guild.members')} {view.members} · {t('guild.fund')} {view.fund} · {t('currency.guildCoin')} {view.guildCoin}
      </p>
      <section className="card">
        <h2>{t('guild.donate')}</h2>
        <p className="muted" data-testid="guild-donations">
          {t('guild.donationsLeft')} {view.donationsLeft}
        </p>
        <button type="button" className="btn btn-primary" disabled={busy || view.donationsLeft < 1} onClick={() => void act(call((s) => s.donateGuild('normal'), (v) => v.snapshot), t('guild.thanks'))}>
          {t('guild.donateGold')} ({d.normal.costGold} → {d.normal.guildCoin})
        </button>{' '}
        <button type="button" className="btn" disabled={busy || view.donationsLeft < 1} onClick={() => void act(call((s) => s.donateGuild('gems'), (v) => v.snapshot), t('guild.thanks'))}>
          {t('guild.donateGems')} ({d.gems.costGems} → {d.gems.guildCoin})
        </button>
      </section>
      <section className="card">
        <h2>{t('guild.packets')}</h2>
        <ul className="plain-list">
          {view.packets.map((p) => (
            <li key={p.id}>
              {t('guild.packetAt').replace('{lv}', String(p.trainerLevel))} — {p.gems} {t('currency.gems')}{' '}
              <button type="button" className="btn" disabled={busy || p.opened || !p.ready} onClick={() => void act(call((s) => s.claimGuildPacket(p.id), (v) => v.snapshot), t('guild.opened'))}>
                {p.opened ? t('guild.openedShort') : t('guild.open')}
              </button>
            </li>
          ))}
        </ul>
      </section>
      <section className="card">
        <h2>{t('guild.beast')}</h2>
        <p data-testid="guild-beast">
          Lv {view.beast.level} · {view.beast.star}★ · {t('guild.exp')} {view.beast.exp}
          {view.beast.nextExp !== null ? ` / ${view.beast.nextExp}` : ''}
        </p>
        <p className="muted">{view.beast.lines.map((l) => (l.kind === 'percent' ? `${l.field} +${Math.round(l.value * 1000) / 10}%` : `${l.field} +${l.value}`)).join(' · ')}</p>
        {view.foods.map((f) => (
          <button key={f.currency} type="button" className="btn" disabled={busy || f.have < 1} onClick={() => void act(call((s) => s.feedGuildBeast(f.currency, f.have >= 10 ? 10 : 1), (v) => v.snapshot), t('guild.fed'))}>
            {t(`currency.${f.currency}` as 'currency.gold')} ({f.have}) +{f.exp} EXP
          </button>
        ))}
      </section>
      <p className="chip-row">
        <Link className="btn" to="/guild-war">{t('gw.title')}</Link>
        <Link className="btn" to="/relic-battlefield">{t('relic.title')}</Link>
      </p>
      {status && (
        <p className="status-box" data-testid="guild-status">
          {status}
        </p>
      )}
    </div>
  );
}
