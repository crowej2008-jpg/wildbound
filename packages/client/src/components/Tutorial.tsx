import { Link } from 'react-router-dom';
import { TUTORIAL_STEPS } from '@wildbound/engine';
import { t, type StringKey } from '../i18n';
import { useServer } from '../server/ServerProvider';

interface StepInfo {
  key: StringKey;
  to: string;
}

const STEPS: StepInfo[] = [
  { key: 'tutorial.step.level', to: '/wilds' },
  { key: 'tutorial.step.squad', to: '/squad' },
  { key: 'tutorial.step.win', to: '/campaign' },
];

/** First-session guide (M5, PROMPT §13). Skippable; auto-advances on actions. */
export default function Tutorial() {
  const { snapshot, run, busy } = useServer();
  const tutorial = snapshot?.state.tutorial;
  if (!tutorial || tutorial.done) return null;
  const step = STEPS[Math.min(tutorial.step, STEPS.length - 1)];
  if (!step) return null;

  return (
    <section className="card tutorial-card" aria-live="polite">
      <div className="page-head">
        <h2 className="section-title">
          {t('tutorial.title')} · {Math.min(tutorial.step + 1, TUTORIAL_STEPS)}/{TUTORIAL_STEPS}
        </h2>
        <button type="button" className="btn" disabled={busy} onClick={() => void run((s) => s.skipTutorial())}>
          {t('tutorial.skip')}
        </button>
      </div>
      <p>{t(step.key)}</p>
      <div className="row-actions">
        <Link className="btn btn-primary" to={step.to}>
          {t('tutorial.go')}
        </Link>
        <button type="button" className="btn" disabled={busy} onClick={() => void run((s) => s.advanceTutorial())}>
          {t('tutorial.next')}
        </button>
      </div>
    </section>
  );
}
