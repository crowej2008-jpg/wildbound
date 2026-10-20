import { useCallback, useEffect, useState } from 'react';
import type { EquipmentView } from '@wildbound/server';
import { useServer } from '../../server/ServerProvider';

/**
 * Loads the server-built equipment view for one Wild. Actions update the shared
 * snapshot through `run`; this hook refetches the view so Power and the stat
 * sheet stay in step with the save.
 */
export function useEquipment(wildId: string) {
  const { call } = useServer();
  const [view, setView] = useState<EquipmentView | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    const result = await call((server) => server.getEquipment(wildId));
    if (result.ok) {
      setView(result.value);
      setError(null);
      return true;
    }
    setError(result.message);
    return false;
  }, [call, wildId]);

  useEffect(() => {
    setView(null);
    void reload();
  }, [reload]);

  return { view, error, reload };
}
