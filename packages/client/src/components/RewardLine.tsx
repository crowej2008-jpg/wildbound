import { CURRENCY_REWARD_KEYS, type Rewards } from '@wildbound/engine';
import { currencyLabel, t } from '../i18n';

/** Render a reward bundle as compact chips (M5/M6). */
export default function RewardLine({ rewards }: { rewards: Rewards }) {
  const parts = CURRENCY_REWARD_KEYS.filter((k) => (rewards[k] ?? 0) > 0).map((k) => (
    <span key={k} className="chip reward-chip">
      +{rewards[k]?.toLocaleString()} {currencyLabel[k]}
    </span>
  ));
  if ((rewards.xp ?? 0) > 0) {
    parts.push(
      <span key="xp" className="chip reward-chip">
        +{rewards.xp?.toLocaleString()} {t('reward.xp')}
      </span>,
    );
  }
  if (parts.length === 0) return <span className="muted">{t('reward.none')}</span>;
  return <span className="reward-line">{parts}</span>;
}
