/**
 * Save persistence (PROMPT §10). A tiny async key/value store; the server owns
 * serialization, the store just moves strings. `MemoryStore` powers unit tests
 * and `IndexedDbStore` powers the browser.
 */
export interface SaveStore {
  read(key: string): Promise<string | null>;
  write(key: string, value: string): Promise<void>;
  remove(key: string): Promise<void>;
}

export class MemoryStore implements SaveStore {
  private readonly map = new Map<string, string>();

  async read(key: string): Promise<string | null> {
    return this.map.get(key) ?? null;
  }

  async write(key: string, value: string): Promise<void> {
    this.map.set(key, value);
  }

  async remove(key: string): Promise<void> {
    this.map.delete(key);
  }

  /** Test helper: force a write without going through the server. */
  raw(): Map<string, string> {
    return this.map;
  }
}

const DB_NAME = 'wildbound';
const STORE_NAME = 'kv';

function request<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('indexeddb request failed'));
  });
}

/** Browser-backed store. Construct only where `indexedDB` exists. */
export class IndexedDbStore implements SaveStore {
  private db: Promise<IDBDatabase>;

  constructor(dbName = DB_NAME) {
    this.db = new Promise((resolve, reject) => {
      const open = indexedDB.open(dbName, 1);
      open.onupgradeneeded = () => {
        const db = open.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME);
      };
      open.onsuccess = () => resolve(open.result);
      open.onerror = () => reject(open.error ?? new Error('indexeddb open failed'));
    });
  }

  private async tx(mode: IDBTransactionMode): Promise<IDBObjectStore> {
    const db = await this.db;
    return db.transaction(STORE_NAME, mode).objectStore(STORE_NAME);
  }

  async read(key: string): Promise<string | null> {
    const store = await this.tx('readonly');
    const value = await request<string | undefined>(store.get(key));
    return value ?? null;
  }

  async write(key: string, value: string): Promise<void> {
    const store = await this.tx('readwrite');
    await request(store.put(value, key));
  }

  async remove(key: string): Promise<void> {
    const store = await this.tx('readwrite');
    await request(store.delete(key));
  }
}
