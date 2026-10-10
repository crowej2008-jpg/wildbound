import { describe, expect, it } from 'vitest';
import { fail, GAME, ok } from './index';
import type { GameServer, ServerInfo } from './index';

describe('GameServer boundary', () => {
  it('ping resolves ok with the server info protocol', async () => {
    const server: GameServer = {
      async ping() {
        const info: ServerInfo = { game: GAME, protocol: 1 };
        return ok(info);
      },
    };
    const res = await server.ping();
    if (!res.ok) throw new Error('expected ok');
    expect(res.value).toEqual({ game: 'wildbound', protocol: 1 });
  });

  it('fail results carry a typed error code and message', () => {
    const res = fail<never>('not_implemented', 'landing in M1');
    expect(res.ok).toBe(false);
    if (res.ok) throw new Error('expected failure');
    expect(res.error).toBe('not_implemented');
    expect(res.message).toMatch(/M1/);
  });
});