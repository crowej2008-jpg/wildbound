import type { AccountSnapshot, EquipmentView, GameServer, Result } from '@wildbound/server';
import type { WildClass } from '@wildbound/engine';

/** Shared props for the five gear panels on the Wild screen. */
export interface GearPanelProps {
  wildId: string;
  view: EquipmentView;
  className: WildClass;
  busy: boolean;
  run: (action: (server: GameServer) => Promise<Result<AccountSnapshot>>) => Promise<boolean>;
  reload: () => Promise<boolean>;
}
