import { useState } from 'react';
import { CURRENCY_IDS } from '@wildbound/engine';
import { WILDS } from '@wildbound/content';
import { currencyLabel, t } from '../i18n';
import { useServer } from '../server/ServerProvider';

/** More tab (M3): debug tools to grant content and manage saves. */
export default function More() {
  const { snapshot, run, busy, exportSave, importSave, reset } = useServer();
  const [speciesId, setSpeciesId] = useState(WILDS[0]?.id ?? '');
  const [importText, setImportText] = useState('');
  const [status, setStatus] = useState<string | null>(null);

  const onExport = async () => {
    const json = await exportSave();
    if (json === null) {
      setStatus(t('common.cancel'));
      return;
    }
    try {
      await navigator.clipboard.writeText(json);
      setStatus(t('more.debug.exported'));
    } catch {
      setStatus(json);
    }
  };

  const onImport = async () => {
    const ok = await importSave(importText);
    if (ok) setImportText('');
  };

  const onReset = async () => {
    if (window.confirm(t('more.debug.resetConfirm'))) await reset();
  };

  return (
    <main className="main">
      <h1 className="page-title">{t('more.title')}</h1>
      <p className="muted">{t('more.subtitle')}</p>

      <section className="card">
        <h2 className="section-title">{t('more.debug.grantCurrency')}</h2>
        <div className="filter-row">
          {CURRENCY_IDS.map((id) => (
            <button
              key={id}
              type="button"
              className="chip"
              disabled={busy}
              onClick={() => void run((s) => s.grantCurrency(id))}
            >
              + {currencyLabel[id]}
            </button>
          ))}
        </div>
      </section>

      <section className="card">
        <h2 className="section-title">{t('more.debug.grantWild')}</h2>
        <div className="row-actions">
          <select className="select" value={speciesId} onChange={(e) => setSpeciesId(e.target.value)}>
            {WILDS.map((wild) => (
              <option key={wild.id} value={wild.id}>
                {wild.name}
              </option>
            ))}
          </select>
          <button type="button" className="btn btn-primary" disabled={busy} onClick={() => void run((s) => s.grantWild(speciesId))}>
            {t('more.debug.grantWild')}
          </button>
          <button type="button" className="btn" disabled={busy} onClick={() => void run((s) => s.grantRandomWild())}>
            {t('more.debug.grantRandom')}
          </button>
        </div>
        {snapshot && <p className="muted">{t('wilds.title')}: {snapshot.state.roster.length}</p>}
      </section>

      <section className="card">
        <h2 className="section-title">{t('more.debug.clock')}</h2>
        <p className="muted">{t('more.debug.clockNote')}</p>
        <div className="filter-row">
          {[60, 720, 1440].map((minutes) => (
            <button
              key={minutes}
              type="button"
              className="chip"
              disabled={busy}
              onClick={() => void run((s) => s.debugAdvanceClock(minutes))}
            >
              +{minutes / 60}h
            </button>
          ))}
        </div>
        {snapshot && (
          <p className="muted">
            {t('more.debug.clockOffset')}: {snapshot.state.debugClockOffset} {t('idle.minutes')} ·{' '}
            {new Date(Date.now() + snapshot.state.debugClockOffset * 60_000).toISOString().slice(0, 10)}
          </p>
        )}
      </section>

      <section className="card">
        <h2 className="section-title">{t('more.debug.saves')}</h2>
        <div className="row-actions">
          <button type="button" className="btn" onClick={() => void onExport()}>
            {t('more.debug.export')}
          </button>
          <button type="button" className="btn btn-danger" onClick={() => void onReset()}>
            {t('more.debug.reset')}
          </button>
        </div>
        <label className="field-label" htmlFor="import-save">
          {t('more.debug.importPrompt')}
        </label>
        <textarea
          id="import-save"
          className="textarea"
          rows={4}
          value={importText}
          onChange={(e) => setImportText(e.target.value)}
        />
        <button type="button" className="btn" disabled={busy || importText.trim() === ''} onClick={() => void onImport()}>
          {t('more.debug.import')}
        </button>
        {status && <pre className="status-box">{status}</pre>}
      </section>
    </main>
  );
}
