import { describe, expect, it } from 'vitest';
import { initReplay, replayTo } from '@wildbound/engine';
import { buildConfig } from './config';
import { LocalServer } from './local-server';
import { MemoryStore } from './storage';
import { slotToPosition } from './battle';

function server(config = buildConfig()): LocalServer {
  return new LocalServer(new MemoryStore(), config);
}

describe('startBattle', () => {
  it('maps squad slots onto field positions', () => {
    expect([0, 1, 2].map(slotToPosition)).toEqual([4, 5, 6]);
    expect([3, 4, 5].map(slotToPosition)).toEqual([1, 2, 3]);
  });

  it('builds a 12-unit battle with a complete log', async () => {
    const srv = server();
    await srv.loadAccount();
    const res = await srv.startBattle('campaign', 1234);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    const view = res.value;
    expect(view.units).toHaveLength(12);
    expect(view.units.filter((u) => u.side === 'attackers')).toHaveLength(6);
    expect(view.units.filter((u) => u.side === 'defenders')).toHaveLength(6);
    expect(view.events[0]?.type).toBe('roundStart');
    expect(view.events[view.events.length - 1]?.type).toBe('result');
    expect(view.winner === 'attackers' || view.winner === 'defenders').toBe(true);
    expect(view.units.every((u) => u.name.length > 0 && u.speciesId.length > 0)).toBe(true);
    expect(view.units.every((u) => u.hp === u.maxHp && u.alive && u.rage > 0)).toBe(true);
  });

  it('replays identically for the same seed', async () => {
    const srv = server();
    await srv.loadAccount();
    const a = await srv.startBattle('campaign', 777);
    const b = await srv.startBattle('campaign', 777);
    expect(a.ok && b.ok).toBe(true);
    if (!a.ok || !b.ok) return;
    expect(JSON.stringify(a.value)).toBe(JSON.stringify(b.value));
  });

  it('folds the log to the same winner and wipes the losing side', async () => {
    const srv = server();
    await srv.loadAccount();
    const res = await srv.startBattle('campaign', 4242);
    if (!res.ok) return;
    const view = res.value;
    const final = replayTo(view.units, view.events, view.events.length);
    expect(final.winner).toBe(view.winner);
    const losing = view.winner === 'attackers' ? 'defenders' : 'attackers';
    expect(final.units.filter((u) => u.side === losing).every((u) => !u.alive)).toBe(true);
    expect(final.units.some((u) => u.side === view.winner && u.alive)).toBe(true);
    // The seed state we start from is untouched by folding.
    expect(initReplay(view.units).winner).toBeNull();
  });

  it('fails cleanly when there is nothing to field', async () => {
    const srv = server({ ...buildConfig(), startingRoster: [] });
    await srv.loadAccount();
    const res = await srv.startBattle('campaign');
    expect(res.ok).toBe(false);
  });
});
