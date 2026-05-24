import type { CleanupOptions, Note } from '@/types/transcription';
import type { PlaybackInstrumentId } from '@/lib/music/partition-instruments';

const DB_NAME = 'sampleme';
const DB_VERSION = 1;
const STORE = 'session';
const KEY = 'current';

export interface CachedTrack {
  id: string;
  name: string;
  // Optional — manual tracks have no recorded audio, just MIDI notes.
  blob?: Blob;
  peaks: number[];
  duration: number;
  muted: boolean;
  // Hides this track's notes from the partition without affecting playback.
  hidden?: boolean;
  notes: Note[];
  rawNotes: Note[];
  instrument: PlaybackInstrumentId;
  color: string;
}

export type CachedSession = {
  tracks?: CachedTrack[];
  audio?: Blob; // Legacy single audio compatibility
  rawNotes?: Note[]; // Legacy
  cleanedNotes?: Note[]; // Legacy
  options: CleanupOptions;
  createdAt: number;
};

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) {
        req.result.createObjectStore(STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx<T>(
  mode: IDBTransactionMode,
  fn: (s: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await openDb();
  return new Promise<T>((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const req = fn(t.objectStore(STORE));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    t.oncomplete = () => db.close();
  });
}

export const sessionCache = {
  save: (s: CachedSession) => tx('readwrite', (store) => store.put(s, KEY)),
  load: () => tx<CachedSession | undefined>('readonly', (store) => store.get(KEY)),
  clear: () => tx('readwrite', (store) => store.delete(KEY)),
};
