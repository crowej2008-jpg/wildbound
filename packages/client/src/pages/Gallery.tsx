import { FACTIONS, POWER, WILDS, type SpeciesJson } from '@wildbound/content';
import { computePower, formNames, resolveCoreStats } from '@wildbound/engine';
import WildPortrait from '../art/WildPortrait';
import { classLabel, factionLabel, t, tierLabel } from '../i18n';

/**
 * Procedural creature gallery (M2, PROMPT §9.4): every species' forms along its star ladder, plus the
 * stats the engine resolves for its top star at that star's level cap (R1: the source's star cards).
 * Portraits are deterministic SVG.
 */
export default function Gallery() {
  return (
    <>
      <main className="main">
        <h1 className="page-title">{t('gallery.title')}</h1>
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
  const top = species.stars[species.stars.length - 1]!;
  const level = top.maxLevel;
  const core = resolveCoreStats(top, level);
  const power = computePower(core, {}, POWER);
  const forms = formNames(species.stars);

  return (
    <article className="wild-card">
      <div className="wild-portraits">
        {forms.map((stageName, stage) => (
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
          {t('gallery.power')} {power.toLocaleString()} · {top.star}★ · {t('gallery.maxLevel')} {level}
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
