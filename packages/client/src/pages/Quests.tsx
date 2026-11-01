import { ECONOMY, QUESTS } from '@wildbound/content';
import {
  activityPoints,
  claimableChests,
  isQuestClaimable,
  isQuestClaimed,
  isQuestOffered,
  questProgress,
  type QuestDef,
} from '@wildbound/engine';
import RewardLine from '../components/RewardLine';
import { t } from '../i18n';
import { useServer } from '../server/ServerProvider';

const THRESHOLDS = ECONOMY.activityChests.map((c) => c.points);

/** Daily quests + activity chests (M5; R9: the source's 12 dailies). */
export default function Quests() {
  const { snapshot, claim, busy } = useServer();
  const quests = snapshot?.state.quests;
  if (!snapshot || !quests) {
    return (
      <main className="main">
        <h1 className="page-title">{t('quests.title')}</h1>
      </main>
    );
  }

  const points = activityPoints(QUESTS as QuestDef[], quests);
  const chests = claimableChests(QUESTS as QuestDef[], quests, THRESHOLDS);

  return (
    <main className="main">
      <h1 className="page-title">{t('quests.title')}</h1>
      <p className="muted">{t('quests.subtitle')}</p>

      <section className="card">
        <h2 className="section-title">
          {t('quests.activity')}: {points}
        </h2>
        <ul className="quest-list">
          {QUESTS.map((q) => {
            const offered = isQuestOffered(q as QuestDef, snapshot.state.profile.level);
            const progress = Math.min(questProgress(quests, q as QuestDef), q.target);
            const claimable = isQuestClaimable(quests, q as QuestDef);
            const claimed = isQuestClaimed(quests, q as QuestDef);
            return (
              <li key={q.id} className="quest-row">
                <div className="quest-info">
                  <span className="quest-name">{q.name}</span>
                  <span className="muted">
                    {q.comingIn
                      ? t('quests.comingIn').replace('{m}', q.comingIn)
                      : offered
                        ? `${progress} / ${q.target}`
                        : t('quests.unlockAt').replace('{level}', String(q.unlockLevel ?? 1))}
                  </span>
                  <RewardLine rewards={q.rewards} />
                </div>
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={!offered || !claimable || busy}
                  onClick={() => void claim((s) => s.claimQuest(q.id))}
                >
                  {claimed ? t('quests.claimed') : claimable ? t('quests.claim') : t('quests.inProgress')}
                </button>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="card">
        <h2 className="section-title">{t('quests.chests')}</h2>
        <ul className="chest-list">
          {ECONOMY.activityChests.map((chest, i) => {
            const ready = chests.includes(i);
            const done = quests.chests.includes(i);
            return (
              <li key={i} className="chest-row">
                <div className="quest-info">
                  <span className="quest-name">
                    {chest.points} {t('quests.points')}
                  </span>
                  <RewardLine rewards={chest.rewards} />
                </div>
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={!ready || busy}
                  onClick={() => void claim((s) => s.claimActivityChest(i))}
                >
                  {done ? t('quests.claimed') : ready ? t('quests.claim') : t('quests.locked')}
                </button>
              </li>
            );
          })}
        </ul>
      </section>
    </main>
  );
}
