import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { DEFAULT_CONFIG, AppConfig } from '../config/defaults';

const KEYS = {
  CONFIG:       'kosalma_config',
  NOTES_CACHE:  'kosalma_notes_cache',
  NOTES_SHA:    'kosalma_notes_sha',
  LAST_SYNC:    'kosalma_last_sync',
  PAT:          'kosalma_pat',          // stored in OS Keychain / Keystore
};

// ─── PAT helpers ─────────────────────────────────────────────────────────────

async function loadPat(): Promise<string> {
  // The token lives only in the OS keystore, put there by the user in Settings.
  // Nothing is seeded from the bundle — see config/secrets.ts for why. A token
  // stored by an earlier version is still found here, so updating the app does
  // not make anyone re-enter it.
  try {
    return (await SecureStore.getItemAsync(KEYS.PAT)) ?? '';
  } catch {
    return '';
  }
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

  // Anything the user has saved wins over the defaults, so an app update never
  // overwrites their settings; defaults only fill in keys they have never set.
  const base: AppConfig = raw ? { ...DEFAULT_CONFIG, ...JSON.parse(raw) } : { ...DEFAULT_CONFIG };
  base.github = { ...DEFAULT_CONFIG.github, ...base.github, pat };

  if (!Array.isArray(base.employees)) base.employees = [];
  base.employees = [...base.employees].sort((a, b) =>
    (a.name || a.mac).localeCompare(b.name || b.mac));

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
