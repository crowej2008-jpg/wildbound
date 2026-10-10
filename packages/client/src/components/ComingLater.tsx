import { t } from '../i18n';

export default function ComingLater({ title, milestone }: { title: string; milestone: string }) {
  return (
    <main className="main">
      <section className="card">
        <h1>{title}</h1>
        <p>
          <span className="badge">{t('comingLater.badge')}</span>
        </p>
        <p>{t('home.scope.note')}</p>
        <p>This screen is built in {milestone}. See docs/SCOPE.md for the full map.</p>
      </section>
    </main>
  );
}