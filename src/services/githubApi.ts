import { AppConfig } from '../config/defaults';

const BASE = 'https://api.github.com';

function headers(pat: string) {
  return {
    Authorization: `Bearer ${pat}`,
    Accept: 'application/vnd.github+json',
    'Content-Type': 'application/json',
  };
}

export type GithubFile = {
  data: Record<string, any>;
  sha: string;
};

// Fetch notes.json — returns parsed data + SHA needed for writes
export async function fetchNotes(config: AppConfig): Promise<GithubFile> {
  const { pat, owner, repo } = config.github;
  const res = await fetch(`${BASE}/repos/${owner}/${repo}/contents/notes.json`, {
    headers: headers(pat),
  });
  if (!res.ok) throw new Error(`GitHub fetch failed: ${res.status}`);
  const json = await res.json();
  const data = JSON.parse(atob(json.content.replace(/\n/g, '')));
  return { data, sha: json.sha };
}

// Write notes.json back — SHA from last fetch is required
export async function writeNotes(
  config: AppConfig,
  data: Record<string, any>,
  sha: string,
  message = 'sync from android',
): Promise<string> {
  const { pat, owner, repo } = config.github;
  const content = btoa(unescape(encodeURIComponent(JSON.stringify(data, null, 4))));
  const res = await fetch(`${BASE}/repos/${owner}/${repo}/contents/notes.json`, {
    method: 'PUT',
    headers: headers(pat),
    body: JSON.stringify({ message, content, sha }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(`GitHub write failed: ${res.status} ${err.message}`);
  }
  const json = await res.json();
  return json.content.sha;
}

// List files/ folder (or a subfolder of it) — returns files and dirs
export async function fetchFilesList(config: AppConfig, subpath = ''): Promise<Array<{ name: string; path: string; sha: string; download_url: string; size: number; type: string }>> {
  const { pat, owner, repo } = config.github;
  const dir = subpath ? `files/${subpath}` : 'files';
  const res = await fetch(`${BASE}/repos/${owner}/${repo}/contents/${dir}`, {
    headers: headers(pat),
  });
  if (!res.ok) throw new Error(`GitHub files fetch failed: ${res.status}`);
  return res.json();
}

// Upload a file to files/ (or a subfolder) — base64Content is the file content encoded in base64
export async function uploadFile(
  config: AppConfig,
  filename: string,
  base64Content: string,
  existingSha?: string,   // pass if overwriting an existing file
  subpath = '',           // subfolder inside files/, e.g. 'reports/2026'
): Promise<void> {
  const { pat, owner, repo } = config.github;
  const path = subpath ? `files/${subpath}/${filename}` : `files/${filename}`;
  const body: Record<string, any> = {
    message: `upload ${filename} from android`,
    content: base64Content,
  };
  if (existingSha) body.sha = existingSha;
  const res = await fetch(`${BASE}/repos/${owner}/${repo}/contents/${path}`, {
    method: 'PUT',
    headers: headers(pat),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`Upload failed: ${res.status} ${err.message ?? ''}`);
  }
}

// Delete a file from GitHub (requires the file's current SHA)
export async function deleteGithubFile(
  config: AppConfig,
  path: string,
  sha: string,
): Promise<void> {
  const { pat, owner, repo } = config.github;
  const res = await fetch(`${BASE}/repos/${owner}/${repo}/contents/${path}`, {
    method: 'DELETE',
    headers: headers(pat),
    body: JSON.stringify({ message: `delete ${path} from android`, sha }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`Delete failed: ${res.status} ${err.message ?? ''}`);
  }
}

// Get SHA of an existing file in files/ — returns undefined if the file doesn't exist yet
export async function getFileSha(config: AppConfig, filename: string): Promise<string | undefined> {
  const { pat, owner, repo } = config.github;
  const res = await fetch(
    `${BASE}/repos/${owner}/${repo}/contents/files/${encodeURIComponent(filename)}`,
    { headers: headers(pat) },
  );
  if (!res.ok) return undefined;
  const json = await res.json();
  return json.sha as string;
}

// Upload a file to attachments/ (image attachments shared with PC app)
export async function uploadAttachment(
  config: AppConfig,
  filename: string,
  base64Content: string,
  existingSha?: string,
): Promise<void> {
  const { pat, owner, repo } = config.github;
  const path = `attachments/${filename}`;
  const body: Record<string, any> = {
    message: `upload ${filename} from android`,
    content: base64Content,
  };
  if (existingSha) body.sha = existingSha;
  const res = await fetch(`${BASE}/repos/${owner}/${repo}/contents/${path}`, {
    method: 'PUT',
    headers: headers(pat),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`Upload failed: ${res.status} ${err.message ?? ''}`);
  }
}

// Get SHA of an existing file in attachments/
export async function getAttachmentSha(config: AppConfig, filename: string): Promise<string | undefined> {
  const { pat, owner, repo } = config.github;
  const res = await fetch(
    `${BASE}/repos/${owner}/${repo}/contents/attachments/${encodeURIComponent(filename)}`,
    { headers: headers(pat) },
  );
  if (!res.ok) return undefined;
  const json = await res.json();
  return json.sha as string;
}

// Fetch a file from files/ folder as base64 — for private repos where download_url requires auth
export async function fetchFileAsBase64(config: AppConfig, filename: string): Promise<string> {
  const { pat, owner, repo } = config.github;
  const res = await fetch(
    `${BASE}/repos/${owner}/${repo}/contents/files/${encodeURIComponent(filename)}`,
    { headers: headers(pat) },
  );
  if (!res.ok) throw new Error(`File fetch failed: ${res.status}`);
  const json = await res.json();
  return (json.content as string).replace(/\n/g, '');
}

// Fetch statistics.json — large file, so we use raw.githubusercontent.com with auth
export async function fetchStatistics(config: AppConfig): Promise<Record<string, any>> {
  const { pat, owner, repo } = config.github;

  // Resolve default branch so we can build the raw URL
  const repoRes = await fetch(`${BASE}/repos/${owner}/${repo}`, { headers: headers(pat) });
  if (!repoRes.ok) throw new Error(`Repository access failed: ${repoRes.status}`);
  const { default_branch } = await repoRes.json();

  // Raw URL requires auth for private repos
  const rawUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${default_branch}/statisticsLibrary/statistics.json`;
  const raw = await fetch(rawUrl, { headers: { Authorization: `Bearer ${pat}` } });
  if (!raw.ok) throw new Error(`Stats download failed: ${raw.status}`);
  return raw.json();
}
