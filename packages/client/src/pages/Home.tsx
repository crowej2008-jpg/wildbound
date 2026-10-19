import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { QUESTS, STAGES } from '@wildbound/content';
import {
  bestIdleStage,
  hasClaimableMail,
  isQuestClaimable,
  orderStages,
  type QuestDef,
  type StageDef,
} from '@wildbound/engine';
import Tutorial from '../components/Tutorial';
import { t } from '../i18n';
import { useServer } from '../server/ServerProvider';

const ORDERED = orderStages(STAGES as StageDef[]);

const TOWN = [
  { to: '/campaign', key: 'home.link.campaign' as const, icon: '⚔' },
  { to: '/idle', key: 'home.link.idle' as const, icon: '⏳' },
  { to: '/quests', key: 'home.link.quests' as const, icon: '☑' },
  { to: '/mail', key: 'home.link.mail' as const, icon: '✉' },
  { to: '/wilds', key: 'home.link.wilds' as const, icon: '🐾' },
  { to: '/squad', key: 'home.link.squad' as const, icon: '🛡' },
  { to: '/summon', key: 'home.link.summon' as const, icon: '🎴' },
  { to: '/shop', key: 'home.link.shop' as const, icon: '🛒' },
  { to: '/combat', key: 'home.link.combat' as const, icon: '⚔' },
  { to: '/arena', key: 'home.link.arena' as const, icon: '🏟' },
  { to: '/ranked', key: 'home.link.ranked' as const, icon: '🏅' },
  { to: '/gallery', key: 'home.link.gallery' as const, icon: '✦' },
];

/** Home town hub (M5): entry points into every screen plus the tutorial. */
export default function Home() {
  const { snapshot } = useServer();
  const state = snapshot?.state;

  const badges = useMemo(() => {
    if (!state) return {} as Record<string, number>;
    const quests = QUESTS.filter((q) => isQuestClaimable(state.quests, q as QuestDef)).length;
    const mail = state.mail.filter((m) => !m.claimed).length;
    const idle = bestIdleStage(state.campaign, ORDERED) ? 1 : 0;
    return {
      '/quests': quests,
      '/mail': mail,
      '/idle': idle,
      '/campaign': ORDERED.filter((s) => (state.campaign.stars[s.id] ?? 0) === 0)[0] ? 1 : 0,
    };
  }, [state]);

  const hasMail = state ? hasClaimableMail(state.mail) : false;

  return (
    <main className="main">
      <Tutorial />
      <section className="card">
        <h1>{t('home.welcome')}</h1>
        <p>{t('home.intro')}</p>
        <div className="town-grid">
          {TOWN.map((item) => (
            <Link key={item.to} className="town-tile" to={item.to}>
              <span className="town-icon" aria-hidden>
                {item.icon}
              </span>
              <span className="town-label">{t(item.key)}</span>
              {(badges[item.to] ?? 0) > 0 && <span className="badge">{badges[item.to]}</span>}
            </Link>
          ))}
        </div>
        {hasMail && <p className="muted">{t('home.mailHint')}</p>}
      </section>
    </main>
  );
}
