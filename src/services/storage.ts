import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { DEFAULT_CONFIG, AppConfig } from '../config/defaults';
import { PAT as BUNDLED_PAT } from '../config/secrets';

const KEYS = {
  CONFIG:       'kosalma_config',
  NOTES_CACHE:  'kosalma_notes_cache',
  NOTES_SHA:    'kosalma_notes_sha',
  LAST_SYNC:    'kosalma_last_sync',
  PAT:          'kosalma_pat',          // stored in OS Keychain / Keystore
};

// ─── PAT helpers ─────────────────────────────────────────────────────────────

async function loadPat(): Promise<string> {
  try {
    const stored = await SecureStore.getItemAsync(KEYS.PAT);
    if (stored) return stored;
    // First launch: seed SecureStore from the bundled secrets file (gitignored)
    if (BUNDLED_PAT) await SecureStore.setItemAsync(KEYS.PAT, BUNDLED_PAT);
    return BUNDLED_PAT;
  } catch { return BUNDLED_PAT; }
}

async function savePat(pat: string): Promise<void> {
  await SecureStore.setItemAsync(KEYS.PAT, pat);
}

// ─── config ──────────────────────────────────────────────────────────────────

export async function loadConfig(): Promise<AppConfig> {
  const [raw, pat] = await Promise.all([
    AsyncStorage.getItem(KEYS.CONFIG),
    loadPat(),
  ]);

  const base: AppConfig = raw ? { ...DEFAULT_CONFIG, ...JSON.parse(raw) } : { ...DEFAULT_CONFIG };
  base.github = { ...base.github, pat };

  // Preserve DEFAULT_CONFIG employee order (by MAC)
  if (Array.isArray(base.employees)) {
    const macOrder = DEFAULT_CONFIG.employees.map(e => e.mac);
    base.employees = [...base.employees].sort((a, b) => {
      const ia = macOrder.indexOf(a.mac);
      const ib = macOrder.indexOf(b.mac);
      return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
    });
  }

  return base;
}

export async function saveConfig(config: AppConfig): Promise<void> {
  // PAT goes to SecureStore; everything else to AsyncStorage
  const { pat, ...githubRest } = config.github;
  const sanitised = { ...config, github: { ...githubRest, pat: '' } };

  await Promise.all([
    AsyncStorage.setItem(KEYS.CONFIG, JSON.stringify(sanitised)),
    savePat(pat),
  ]);
}

// ─── notes cache ─────────────────────────────────────────────────────────────

export async function loadNotesCache(): Promise<{ data: Record<string, any> | null; sha: string | null }> {
  const [data, sha] = await Promise.all([
    AsyncStorage.getItem(KEYS.NOTES_CACHE),
    AsyncStorage.getItem(KEYS.NOTES_SHA),
  ]);
  return { data: data ? JSON.parse(data) : null, sha };
}

export async function saveNotesCache(data: Record<string, any>, sha: string): Promise<void> {
  await Promise.all([
    AsyncStorage.setItem(KEYS.NOTES_CACHE, JSON.stringify(data)),
    AsyncStorage.setItem(KEYS.NOTES_SHA, sha),
    AsyncStorage.setItem(KEYS.LAST_SYNC, new Date().toISOString()),
  ]);
}

export async function loadLastSync(): Promise<string | null> {
  return AsyncStorage.getItem(KEYS.LAST_SYNC);
}
