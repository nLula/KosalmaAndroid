export const DEFAULT_CONFIG = {
  employees: [
    { name: 'Roman',  mac: 'C3:00:00:4B:05:94' },
    { name: 'Viktor', mac: 'C3:00:00:4B:05:99' },
    { name: 'Dmitri', mac: 'C3:00:00:4B:05:96' },
    { name: 'KIA',    mac: 'C3:00:00:4B:05:9A' },
  ],
  github: {
    pat:   '',   // stored in SecureStore, never hardcoded
    owner: 'KosalmaTln',
    repo:  'Synch',
  },
  sync: {
    intervalMinutes: 15,
  },
};

export type Employee = { name: string; mac: string };
export type AppConfig = typeof DEFAULT_CONFIG;
