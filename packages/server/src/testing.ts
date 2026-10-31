import type { LocalServer } from './local-server';

/**
 * Test support (not used by the game): set a Wild's star directly by round-tripping the save, for
 * tests that need a star gate without building the evolution fodder first.
 */
export async function setWildStars(srv: LocalServer, wildId: string, stars: number): Promise<void> {
  const exported = await srv.exportSave();
  if (!exported.ok) throw new Error(exported.message);
  const save = JSON.parse(exported.value) as { state: { roster: { id: string; stars: number }[] } };
  const wild = save.state.roster.find((w) => w.id === wildId);
  if (!wild) throw new Error(`no Wild ${wildId}`);
  wild.stars = stars;
  const imported = await srv.importSave(JSON.stringify(save));
  if (!imported.ok) throw new Error(imported.message);
}
