import { useCallback, useEffect, useState } from 'react';
import type { Rewards } from '@wildbound/engine';
import type { DungeonBattleResult, DungeonCardView } from '@wildbound/server';
import BattleReplay from '../components/BattleReplay';
import RewardLine from '../components/RewardLine';
import { t } from '../i18n';
import { useServer } from '../server/ServerProvider';

/** Daily dungeons (R9, from the source): Gold, Vanity, XP & ASC and Shard; ten difficulties, two runs a day. */
export default function Dungeons() {
  const { call, claim, snapshot, busy } = useServer();
  const [cards, setCards] = useState<DungeonCardView[]>([]);
  const [picked, setPicked] = useState<Record<string, number>>({});
  const [battle, setBattle] = useState<DungeonBattleResult | null>(null);
  const [granted, setGranted] = useState<Rewards | null>(null);

  const refresh = useCallback(async () => {
    const result = await call((s) => s.getDungeons());
    if (result.ok) setCards(result.value);
  }, [call]);

  useEffect(() => {
    void refresh();
  }, [refresh, snapshot?.state.pve.dungeons]);

  const indexFor = (card: DungeonCardView) => {
    if (picked[card.id] !== undefined) return picked[card.id]!;
    const open = card.difficulties.filter((d) => d.open);
    return open.length > 0 ? open[open.length - 1]!.index : 0;
  };

  if (battle) {
    const card = cards.find((c) => c.id === battle.dungeonId);
    return (
      <BattleReplay
        view={battle.battle}
        attackerLabel={t('combat.team.attackers')}
        defenderLabel={card?.name ?? t('pve.dungeons')}
        resultExtra={
          <section className={`card result-rewards ${battle.grade || battle.win ? 'result-win' : 'result-lose'}`}>
            <div className="result-banner">
              <strong>{battle.grade ? t('dungeon.grade').replace('{grade}', battle.grade) : battle.win ? t('dungeon.victory') : t('dungeon.defeat')}</strong>
            </div>
            <p className="muted">
              {card?.id === 'vanity'
                ? t('dungeon.damage').replace('{n}', battle.damage.toLocaleString())
                : t('dungeon.kills').replace('{n}', String(battle.kills))}
            </p>
            <RewardLine rewards={battle.rewards} />
            <button type="button" className="btn btn-primary" onClick={() => setBattle(null)}>
              {t('dungeon.back')}
            </button>
          </section>
        }
      />
    );
  }

  return (
    <main className="main">
      <h1 className="page-title">{t('pve.dungeons')}</h1>
      <p className="muted">{t('pve.dungeons.desc')}</p>
      {granted && <RewardLine rewards={granted} />}
      {cards.map((card) => {
        const diff = card.difficulties[indexFor(card)]!;
        return (
          <section key={card.id} className="card" data-dungeon={card.id}>
            <div className="gear-head">
              <h2 className="section-title">{card.name}</h2>
              <span className="chip">{t('dungeon.runs').replace('{n}', String(card.runsLeft)).replace('{max}', String(card.runs))}</span>
            </div>
            <p className="muted">{card.desc}</p>
            <select
              aria-label={`${card.name} ${t('dungeon.difficulty')}`}
              value={diff.index}
              onChange={(e) => setPicked({ ...picked, [card.id]: Number(e.target.value) })}
            >
              {card.difficulties.map((d) => (
                <option key={d.id} value={d.index}>
                  {d.name} · {d.open ? (d.best ? d.best : '—') : t('dungeon.level').replace('{level}', String(d.level))}
                </option>
              ))}
            </select>
            <p className="muted">{t('dungeon.sweepPays')}</p>
            <RewardLine rewards={diff.sweep} />
            <ul className="chest-list">
              {diff.grades.map((g) => (
                <li key={g.grade} className="chest-row">
                  <div className="quest-info">
                    <span className="quest-name">
                      {g.grade} · {g.goal}
                    </span>
                    <RewardLine rewards={g.chest} />
                  </div>
                  <button
                    type="button"
                    className="btn"
                    disabled={busy || !g.chestReady}
                    onClick={async () => {
                      const r = await claim((s) => s.claimDungeonChest(diff.id, g.grade));
                      if (r.ok) setGranted(r.value.granted);
                    }}
                  >
                    {g.chestDrawn ? t('quests.claimed') : t('dungeon.chest')}
                  </button>
                </li>
              ))}
            </ul>
            <div className="row-actions">
              <button
                type="button"
                className="btn btn-primary"
                disabled={busy || !diff.open || card.runsLeft === 0}
                onClick={async () => {
                  const r = await call((s) => s.challengeDungeon(card.id, diff.index), (v) => v.snapshot);
                  if (r.ok) setBattle(r.value);
                }}
              >
                {t('dungeon.enter')}
              </button>
              <button
                type="button"
                className="btn"
                disabled={busy || !diff.best || card.runsLeft === 0}
                onClick={async () => {
                  const r = await claim((s) => s.sweepDungeon(card.id, diff.index));
                  if (r.ok) setGranted(r.value.granted);
                }}
              >
                {t('dungeon.sweep')}
              </button>
            </div>
          </section>
        );
      })}
    </main>
  );
}
