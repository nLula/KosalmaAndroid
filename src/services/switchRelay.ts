/**
 * Switch commands and shared state, relayed through the Git repo.
 *
 * The relay boards live on the office LAN, so the phone can never reach them
 * directly — it is never the dispatcher. Every press is written into
 * switch_commands.json in the shared repo; the workshop PC (the app set to the
 * "Kosalma" relation) polls that file, performs the move, and writes the result
 * and the resulting position back.
 *
 *     phone  --enqueue-->  switch_commands.json  --poll-->  workshop PC
 *       ^                                                        |
 *       +------------  state / result written back  <------------+
 *
 * File format is shared with switch_relay.py in the Kosalma monitor — keep the
 * two in step.
 */

import { AppConfig } from '../config/defaults';

const BASE = 'https://api.github.com';
const COMMAND_PATH = 'switch_commands.json';
const PUT_RETRIES = 4;

export type SwitchCommand = {
  id: string;
  switch: string;
  action?: string;
  label?: string;
  requestedBy?: string;
  requestedAt?: string;
  status: 'pending' | 'done' | 'failed' | 'expired';
  message?: string;
  finishedAt?: string;
};

export type SwitchStateEntry = { position: string; at?: string; by?: string };
export type SwitchState = Record<string, SwitchStateEntry>;

type Doc = { commands: SwitchCommand[]; state: SwitchState };

function headers(pat: string) {
  return {
    Authorization: `Bearer ${pat}`,
    Accept: 'application/vnd.github+json',
    'Content-Type': 'application/json',
  };
}

function url(config: AppConfig) {
  const { owner, repo } = config.github;
  return `${BASE}/repos/${owner}/${repo}/contents/${COMMAND_PATH}`;
}

function decode(b64: string): string {
  // GitHub returns base64 with newlines; decodeURIComponent/escape restores UTF-8
  return decodeURIComponent(escape(atob(b64.replace(/\n/g, ''))));
}

function encode(text: string): string {
  return btoa(unescape(encodeURIComponent(text)));
}

function uid(): string {
  // No crypto.randomUUID in this runtime — good enough for a command id
  let out = '';
  for (let i = 0; i < 32; i++) out += Math.floor(Math.random() * 16).toString(16);
  return out;
}

async function read(config: AppConfig): Promise<{ doc: Doc; sha: string | null }> {
  const res = await fetch(url(config), { headers: headers(config.github.pat) });
  if (res.status === 404) return { doc: { commands: [], state: {} }, sha: null };
  if (!res.ok) throw new Error(`Could not read switch commands: ${res.status}`);
  const json = await res.json();
  let parsed: any = {};
  try {
    parsed = JSON.parse(decode(json.content) || '{}');
  } catch {
    parsed = {};
  }
  return {
    doc: {
      commands: Array.isArray(parsed.commands) ? parsed.commands : [],
      state: parsed.state && typeof parsed.state === 'object' ? parsed.state : {},
    },
    sha: json.sha,
  };
}

/**
 * Read-modify-write the shared file, retrying if another app wrote first.
 * GitHub takes the blob sha as an optimistic lock, so a concurrent write is
 * rejected rather than silently overwriting someone else's command.
 */
async function update(
  config: AppConfig,
  mutate: (doc: Doc) => Doc | null,
  message: string,
): Promise<void> {
  let lastError: any = null;
  for (let attempt = 0; attempt < PUT_RETRIES; attempt++) {
    const { doc, sha } = await read(config);
    const next = mutate(doc);
    if (!next) return;   // nothing to do

    const body: Record<string, any> = {
      message,
      content: encode(JSON.stringify(
        { commands: next.commands, state: next.state, lastchanged: new Date().toISOString() },
        null, 2,
      )),
    };
    if (sha) body.sha = sha;

    const res = await fetch(url(config), {
      method: 'PUT',
      headers: headers(config.github.pat),
      body: JSON.stringify(body),
    });
    if (res.ok) return;
    if (res.status !== 409 && res.status !== 422) {
      const err = await res.json().catch(() => ({}));
      throw new Error(`Write failed: ${res.status} ${err.message ?? ''}`);
    }
    lastError = res.status;                       // someone else won — re-read
    await new Promise(r => setTimeout(r, 400 * (attempt + 1)));
  }
  throw new Error(`Could not write switch commands after ${PUT_RETRIES} tries (${lastError})`);
}

/** Queue a press for the workshop PC. Returns the command id to follow. */
export async function enqueueSwitch(
  config: AppConfig,
  switchId: string,
  label: string,
  action: string,
): Promise<string> {
  const id = uid();
  const entry: SwitchCommand = {
    id,
    switch: switchId,
    action,
    label,
    requestedBy: 'Android',
    requestedAt: new Date().toISOString(),
    status: 'pending',
  };
  await update(config, doc => ({ ...doc, commands: [...doc.commands, entry] }),
               `queue switch ${switchId} ${action}`.trim());
  return id;
}

/** How a queued command turned out, or null if it is no longer in the file. */
export async function getSwitchCommand(
  config: AppConfig,
  commandId: string,
): Promise<SwitchCommand | null> {
  const { doc } = await read(config);
  return doc.commands.find(c => c.id === commandId) ?? null;
}

/** Handle positions as last published by whichever app performed the move. */
export async function fetchSwitchState(config: AppConfig): Promise<SwitchState> {
  const { doc } = await read(config);
  return doc.state;
}
