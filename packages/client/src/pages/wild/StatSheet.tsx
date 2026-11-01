import type { EquipmentView } from '@wildbound/server';
import { t, tKey } from '../../i18n';

const CORE_ROWS = [
  ['hp', 'wild.stats.hp'],
  ['pAtk', 'wild.stats.pAtk'],
  ['sAtk', 'wild.stats.sAtk'],
  ['pDef', 'wild.stats.pDef'],
  ['sDef', 'wild.stats.sDef'],
  ['spd', 'wild.stats.spd'],
] as const;

const PERCENT_LABELS: Record<string, string> = {
  hpPct: 'stat.hpPct',
  pAtkPct: 'stat.pAtkPct',
  sAtkPct: 'stat.sAtkPct',
  dmgBoost: 'stat.dmgBoost',
  dmgRdct: 'stat.dmgRdct',
  pvpBoost: 'stat.pvpBoost',
  pvpRdct: 'stat.pvpRdct',
  ultBoost: 'stat.ultBoost',
  ultRed: 'stat.ultRed',
  skillBoost: 'stat.skillBoost',
  skillRed: 'stat.skillRed',
  crit: 'stat.crit',
  critRes: 'stat.critRes',
  critPower: 'stat.critPower',
  block: 'stat.block',
  blockPower: 'stat.blockPower',
  guardBreak: 'stat.guardBreak',
  controlBoost: 'stat.controlBoost',
  controlRes: 'stat.controlRes',
  healBoost: 'stat.healBoost',
  receiveHealBoost: 'stat.receiveHealBoost',
  counterBoost: 'stat.counterBoost',
};

const LAYER_ROWS = [
  ['relic', 'wild.tab.heldItems'],
  ['plates', 'wild.gear.plates'],
  ['trinkets', 'wild.gear.trinkets'],
  ['resonance', 'trainer.resonance'],
  ['titles', 'trainer.titles'],
  ['runes', 'wild.tab.orbs'],
  ['charms', 'wild.tab.berries'],
  ['cores', 'wild.tab.soulHearts'],
] as const;

function num(value: number | undefined): string {
  return Math.round(value ?? 0).toLocaleString();
}

export default function StatSheet({ view }: { view: EquipmentView }) {
  const percentRows = Object.entries(view.percent).filter(([, value]) => Math.abs(value ?? 0) > 0.0001);
  const gained = Math.round(view.power.equipped - view.power.base);

  return (
    <section className="card">
      <div className="page-head">
        <h2 className="section-title">{t('wild.stats.title')}</h2>
        <span className="wild-power-lg">
          {t('wild.stats.power')} <strong>{view.power.equipped.toLocaleString()}</strong>
          {gained > 0 && <span className="muted"> (+{gained.toLocaleString()})</span>}
        </span>
      </div>

      <div className="stat-grid">
        {CORE_ROWS.map(([field, key]) => (
          <div key={field} className="stat-row">
            <span className="muted">{t(key)}</span>
            <strong>{num(view.sheetEquipped[field])}</strong>
          </div>
        ))}
      </div>

      {(percentRows.length > 0 || (view.soul.spiritAtk ?? 0) > 0 || (view.soul.spiritDef ?? 0) > 0) && (
        <div className="stat-grid">
          {percentRows.map(([field, value]) => (
            <div key={field} className="stat-row">
              <span className="muted">{PERCENT_LABELS[field] ? tKey(PERCENT_LABELS[field]!) : field}</span>
              <strong>{((value ?? 0) * 100).toFixed(1)}%</strong>
            </div>
          ))}
          {(view.soul.spiritAtk ?? 0) > 0 && (
            <div className="stat-row">
              <span className="muted">{t('wild.stats.soulAtk')}</span>
              <strong>{num(view.soul.spiritAtk)}</strong>
            </div>
          )}
          {(view.soul.spiritDef ?? 0) > 0 && (
            <div className="stat-row">
              <span className="muted">{t('wild.stats.soulDef')}</span>
              <strong>{num(view.soul.spiritDef)}</strong>
            </div>
          )}
        </div>
      )}

      <p className="muted">{t('gear.layerPower')}</p>
      <div className="chip-list">
        {LAYER_ROWS.map(([key, label]) => (
          <span key={key} className="chip">
            {t(label)} +{Math.round(view.power.layers[key]).toLocaleString()}
          </span>
        ))}
      </div>
    </section>
  );
}
