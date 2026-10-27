import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { SquadMode } from '@wildbound/engine';
import {
  buildConfig,
  IndexedDbStore,
  LocalServer,
  type AccountSnapshot,
  type BattleView,
  type ClaimResult,
  type GameServer,
  type GachaView,
  type GymBattleResult,
  type Result,
  type ShopView,
  type StageBattleResult,
  type SummonResult,
} from '@wildbound/server';
import type { MachineId } from '@wildbound/engine';

/**
 * One LocalServer per app (PROMPT §10/§11). Screens call only the GameServer
 * interface through this context; they never touch IndexedDB or the engine.
 */
interface ServerContextValue {
  snapshot: AccountSnapshot | null;
  error: string | null;
  busy: boolean;
  run: (action: (server: GameServer) => Promise<Result<AccountSnapshot>>) => Promise<boolean>;
  /**
   * Run any GameServer action with busy/error bookkeeping (M8). When `pick` is
   * given and the call succeeds, the returned snapshot updates the shared state.
   */
  call: <T>(
    action: (server: GameServer) => Promise<Result<T>>,
    pick?: (value: T) => AccountSnapshot,
  ) => Promise<Result<T>>;
  startBattle: (mode: SquadMode, seed?: number) => Promise<Result<BattleView>>;
  challengeStage: (stageId: string, seed?: number) => Promise<Result<StageBattleResult>>;
  challengeGym: (gymId: string, seed?: number) => Promise<Result<GymBattleResult>>;
  claim: (action: (server: GameServer) => Promise<Result<ClaimResult>>) => Promise<Result<ClaimResult>>;
  summon: (machine: MachineId, count: number, seed?: number) => Promise<Result<SummonResult>>;
  getGacha: () => Promise<Result<GachaView>>;
  getShops: () => Promise<Result<ShopView[]>>;
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

  const call = useCallback<ServerContextValue['call']>(
    async (action, pick) => {
      setBusy(true);
      try {
        const result = await action(server);
        if (result.ok) {
          if (pick) setSnapshot(pick(result.value));
          setError(null);
        } else {
          setError(result.message);
        }
        return result;
      } finally {
        setBusy(false);
      }
    },
    [server],
  );

  const exportSave = useCallback(async () => {
    const result = await server.exportSave();
    return result.ok ? result.value : null;
  }, [server]);

  const importSave = useCallback(
    async (json: string) => run((s) => s.importSave(json)),
    [run],
  );

  const startBattle = useCallback<ServerContextValue['startBattle']>(
    async (mode, seed) => {
      setBusy(true);
      try {
        const result = await server.startBattle(mode, seed);
        setError(result.ok ? null : result.message);
        return result;
      } finally {
        setBusy(false);
      }
    },
    [server],
  );

  const challengeStage = useCallback<ServerContextValue['challengeStage']>(
    async (stageId, seed) => {
      setBusy(true);
      try {
        const result = await server.challengeStage(stageId, seed);
        if (result.ok) {
          setSnapshot(result.value.snapshot);
          setError(null);
        } else {
          setError(result.message);
        }
        return result;
      } finally {
        setBusy(false);
      }
    },
    [server],
  );

  const challengeGym = useCallback<ServerContextValue['challengeGym']>(
    async (gymId, seed) => {
      setBusy(true);
      try {
        const result = await server.challengeGym(gymId, seed);
        if (result.ok) {
          setSnapshot(result.value.snapshot);
          setError(null);
        } else {
          setError(result.message);
        }
        return result;
      } finally {
        setBusy(false);
      }
    },
    [server],
  );

  const claim = useCallback<ServerContextValue['claim']>(
    async (action) => {
      setBusy(true);
      try {
        const result = await action(server);
        if (result.ok) {
          setSnapshot(result.value.snapshot);
          setError(null);
        } else {
          setError(result.message);
        }
        return result;
      } finally {
        setBusy(false);
      }
    },
    [server],
  );

  const reset = useCallback(async () => {
    await run((s) => s.resetAccount());
  }, [run]);

  const summon = useCallback<ServerContextValue['summon']>(
    async (machine, count, seed) => {
      setBusy(true);
      try {
        const result = await server.summon(machine, count, seed);
        if (result.ok) {
          setSnapshot(result.value.snapshot);
          setError(null);
        } else {
          setError(result.message);
        }
        return result;
      } finally {
        setBusy(false);
      }
    },
    [server],
  );

  const getGacha = useCallback<ServerContextValue['getGacha']>(() => server.getGacha(), [server]);
  const getShops = useCallback<ServerContextValue['getShops']>(() => server.getShops(), [server]);

  const value = useMemo<ServerContextValue>(
    () => ({
      snapshot,
      error,
      busy,
      run,
      call,
      startBattle,
      challengeStage,
      challengeGym,
      claim,
      summon,
      getGacha,
      getShops,
      exportSave,
      importSave,
      reset,
    }),
    [
      snapshot,
      error,
      busy,
      run,
      call,
      startBattle,
      challengeStage,
      challengeGym,
      claim,
      summon,
      getGacha,
      getShops,
      exportSave,
      importSave,
      reset,
    ],
  );

  return <ServerContext.Provider value={value}>{children}</ServerContext.Provider>;
}

export function useServer(): ServerContextValue {
  const ctx = useContext(ServerContext);
  if (!ctx) throw new Error('useServer must be used inside <ServerProvider>');
  return ctx;
}
