import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  buildConfig,
  IndexedDbStore,
  LocalServer,
  type AccountSnapshot,
  type GameServer,
  type Result,
} from '@wildbound/server';

/**
 * One LocalServer per app (PROMPT §10/§11). Screens call only the GameServer
 * interface through this context; they never touch IndexedDB or the engine.
 */
interface ServerContextValue {
  snapshot: AccountSnapshot | null;
  error: string | null;
  busy: boolean;
  run: (action: (server: GameServer) => Promise<Result<AccountSnapshot>>) => Promise<boolean>;
  exportSave: () => Promise<string | null>;
  importSave: (json: string) => Promise<boolean>;
  reset: () => Promise<void>;
}

const ServerContext = createContext<ServerContextValue | null>(null);

function createServer(): GameServer {
  return new LocalServer(new IndexedDbStore(), buildConfig());
}

export function ServerProvider({ children }: { children: ReactNode }) {
  const [server] = useState(createServer);
  const [snapshot, setSnapshot] = useState<AccountSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const apply = useCallback((result: Result<AccountSnapshot>): boolean => {
    if (result.ok) {
      setSnapshot(result.value);
      setError(null);
      return true;
    }
    setError(result.message);
    return false;
  }, []);

  const run = useCallback<ServerContextValue['run']>(
    async (action) => {
      setBusy(true);
      try {
        return apply(await action(server));
      } finally {
        setBusy(false);
      }
    },
    [server, apply],
  );

  useEffect(() => {
    void run((s) => s.loadAccount());
  }, [run]);

  const exportSave = useCallback(async () => {
    const result = await server.exportSave();
    return result.ok ? result.value : null;
  }, [server]);

  const importSave = useCallback(
    async (json: string) => run((s) => s.importSave(json)),
    [run],
  );

  const reset = useCallback(async () => {
    await run((s) => s.resetAccount());
  }, [run]);

  const value = useMemo<ServerContextValue>(
    () => ({ snapshot, error, busy, run, exportSave, importSave, reset }),
    [snapshot, error, busy, run, exportSave, importSave, reset],
  );

  return <ServerContext.Provider value={value}>{children}</ServerContext.Provider>;
}

export function useServer(): ServerContextValue {
  const ctx = useContext(ServerContext);
  if (!ctx) throw new Error('useServer must be used inside <ServerProvider>');
  return ctx;
}
