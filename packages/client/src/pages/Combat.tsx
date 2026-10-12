import { useEffect, useState } from 'react';
import type { BattleView } from '@wildbound/server';
import BattleReplay from '../components/BattleReplay';
import { t } from '../i18n';
import { useServer } from '../server/ServerProvider';

/** Combat demo screen (M4): replays the campaign squad against an echo squad. */
export default function Combat() {
  const { startBattle, busy } = useServer();
  const [view, setView] = useState<BattleView | null>(null);

  useEffect(() => {
    let cancelled = false;
    void startBattle('campaign').then((result) => {
      if (!cancelled && result.ok) setView(result.value);
    });
    return () => {
      cancelled = true;
    };
  }, [startBattle]);

  if (!view) {
    return (
      <main className="main">
        <h1 className="page-title">{t('combat.title')}</h1>
        <p className="muted">{busy ? t('combat.loading') : t('combat.empty')}</p>
      </main>
    );
  }

  return <BattleReplay view={view} backTo={{ to: '/squad', label: t('squad.title') }} />;
}
