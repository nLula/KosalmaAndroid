import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { loadConfig } from './storage';
import { loadNotesCache, saveNotesCache, loadLastSync } from './storage';
import { fetchNotes, writeNotes } from './githubApi';

// PC stores timestamps as local-time ISO strings without timezone (datetime.now().isoformat()).
// The merge logic uses plain string comparison, so we must match that format exactly.
// Using toISOString() (UTC with 'Z') would produce strings like "2026-06-15T08:30Z" which
// compare as LESS THAN the PC's local "2026-06-15T11:18" when the PC is in UTC+3 — causing
// the PC to always win and overwrite phone changes.
export function localISOString(): string {
  const d   = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const ms  = String(d.getMilliseconds()).padStart(3, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T` +
         `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.${ms}000`;
}

export type NoteRecord = {
  description: string;
  tag: string;
  color: string;
  header: string;
  status: string;
  ishidden: string;
  project: string;
  lastchanged: string;
  created: string;
  work?: string;
  workColor?: string;
  createdForDate?: string;
};

export type NotesData = Record<string, NoteRecord | any>;

type NotesContextType = {
  notes: NotesData;
  sha: string | null;
  lastSync: string | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  updateNote: (id: string, record: NoteRecord) => Promise<void>;
};

const NotesContext = createContext<NotesContextType>({
  notes: {}, sha: null, lastSync: null, loading: false, error: null,
  refresh: async () => {}, updateNote: async () => {},
});

export function NotesProvider({ children }: { children: React.ReactNode }) {
  const [notes, setNotes] = useState<NotesData>({});
  const [sha, setSha] = useState<string | null>(null);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const config = await loadConfig();
      const { data, sha: newSha } = await fetchNotes(config);
      setNotes(data);
      setSha(newSha);
      await saveNotesCache(data, newSha);
      const sync = new Date().toISOString();
      setLastSync(sync);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  // On mount: load cache immediately, then fetch fresh in background
  useEffect(() => {
    (async () => {
      const { data, sha: cachedSha } = await loadNotesCache();
      const sync = await loadLastSync();
      if (data) {
        setNotes(data);
        setSha(cachedSha);
        setLastSync(sync);
        setLoading(false);
      }
      // Fetch fresh regardless
      await refresh();
    })();
  }, []);

  const updateNote = useCallback(async (id: string, record: NoteRecord) => {
    const config = await loadConfig();
    const change = { ...record, lastchanged: localISOString() };

    // Always fetch fresh from GitHub before writing so we never overwrite
    // changes the PC app made since the last phone sync.
    const fresh   = await fetchNotes(config);
    const updated = { ...fresh.data, [id]: change };

    try {
      const newSha = await writeNotes(config, updated, fresh.sha, `update note ${id} from android`);
      setNotes(updated);
      setSha(newSha);
      await saveNotesCache(updated, newSha);
    } catch (e: any) {
      // 409 means someone wrote between our fetch and our write — retry once
      if (e.message?.includes('409')) {
        const fresh2  = await fetchNotes(config);
        const merged  = { ...fresh2.data, [id]: change };
        const newSha  = await writeNotes(config, merged, fresh2.sha, `update note ${id} from android`);
        setNotes(merged);
        setSha(newSha);
        await saveNotesCache(merged, newSha);
      } else {
        throw e;
      }
    }
  }, []);

  return (
    <NotesContext.Provider value={{ notes, sha, lastSync, loading, error, refresh, updateNote }}>
      {children}
    </NotesContext.Provider>
  );
}

export function useNotes() {
  return useContext(NotesContext);
}

// Derived helpers
export function getNoteRecords(notes: NotesData): Array<{ id: string; record: NoteRecord }> {
  return Object.entries(notes)
    .filter(([id, r]) =>
      id.startsWith('Record') &&
      r.ishidden !== 'trash' &&
      typeof r.description === 'string'
    )
    .map(([id, record]) => ({ id, record: record as NoteRecord }));
}

export function getProjects(notes: NotesData): string[] {
  const projects = new Set(
    getNoteRecords(notes).map(({ record }) => record.project || '(no project)')
  );
  return Array.from(projects).sort();
}

export function getTagsForProject(notes: NotesData, project: string): string[] {
  const tags = new Set(
    getNoteRecords(notes)
      .filter(({ record }) => (record.project || '(no project)') === project)
      .map(({ record }) => record.tag)
  );
  return Array.from(tags).sort();
}

export function getHeadersForTag(notes: NotesData, project: string, tag: string): Array<{ id: string; record: NoteRecord }> {
  return getNoteRecords(notes)
    .filter(({ record }) =>
      (record.project || '(no project)') === project && record.tag === tag
    )
    .sort((a, b) => a.record.header.localeCompare(b.record.header));
}
