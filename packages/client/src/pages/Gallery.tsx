import { FACTIONS, GROWTH, POWER, WILDS, type SpeciesJson } from '@wildbound/content';
import { computePower, levelCap, resolveCoreStats } from '@wildbound/engine';
import WildPortrait from '../art/WildPortrait';
import { classLabel, factionLabel, t, tierLabel } from '../i18n';

/**
 * Procedural creature gallery (M2, PROMPT §9.4): every Wild at every evolution
 * stage, plus the stats the engine resolves at that stage's level cap. Reads
 * the same validated content the CLI does; portraits are deterministic SVG.
 */
export default function Gallery() {
  return (
    <>
      <header className="hud">
        <span className="hud-title">{t('gallery.title')}</span>
        <span className="hud-tagline">{t('appName')}</span>
      </header>
      <main className="main">
        <p className="gallery-subtitle">{t('gallery.subtitle')}</p>
        {FACTIONS.map((faction) => (
          <section key={faction} className="gallery-faction">
            <h2 className={`faction-heading faction-${faction}`}>{factionLabel[faction]}</h2>
            <div className="wild-grid">
              {WILDS.filter((w) => w.faction === faction).map((species) => (
                <WildCard key={species.id} species={species} />
              ))}
            </div>
          </section>
        ))}
      </main>
    </>
  );
}

function WildCard({ species }: { species: SpeciesJson }) {
  const finalStage = species.stages.length - 1;
  const level = levelCap(finalStage, GROWTH);
  const core = resolveCoreStats(
    { base: species.base, level, stars: 1, stage: finalStage, tier: species.tier },
    GROWTH,
  );
  const power = computePower(core, {}, POWER);

  return (
    <article className="wild-card">
      <div className="wild-portraits">
        {species.stages.map((stageName, stage) => (
          <figure key={stage} className="wild-portrait-figure">
            <WildPortrait species={species} stage={stage} size={84} label={`${species.name}, ${stageName}`} />
            <figcaption>{stageName}</figcaption>
          </figure>
        ))}
      </div>
      <div className="wild-meta">
        <h3>{species.name}</h3>
        <div className="chip-list">
          <span className="chip">{classLabel[species.class]}</span>
          <span className={`chip tier-${species.tier}`}>{tierLabel[species.tier]}</span>
        </div>
        <p className="wild-description">{species.description}</p>
        <dl className="stat-list">
          <Stat label={t('gallery.stat.hp')} value={core.hp} />
          <Stat label={t('gallery.stat.pAtk')} value={core.pAtk} />
          <Stat label={t('gallery.stat.sAtk')} value={core.sAtk} />
          <Stat label={t('gallery.stat.spd')} value={core.spd} />
        </dl>
        <p className="wild-power">
          {t('gallery.power')} {power.toLocaleString()} · {t('gallery.maxLevel')} {level}
        </p>
      </div>
    </article>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="stat">
      <dt>{label}</dt>
      <dd>{value.toLocaleString()}</dd>
    </div>
  );
}
