// Defaults baked into the app bundle.
//
// Nothing personal or secret belongs here: anything in this file ends up
// readable inside the distributed APK. Employees are discovered from the synced
// data and named by the user (services/employees.ts), and the GitHub token is
// entered once per device and kept in the OS keystore (services/storage.ts).
// Only non-sensitive setup hints live here.
export const DEFAULT_CONFIG = {
  employees: [] as Employee[],
  github: {
    pat:   '',
    owner: 'KosalmaTln',
    repo:  'Synch',
  },
  sync: {
    intervalMinutes: 15,
  },
  appearance: 'system' as 'light' | 'dark' | 'system',
};

export type Employee = { name: string; mac: string };
export type AppConfig = Omit<typeof DEFAULT_CONFIG, 'employees'> & { employees: Employee[] };
