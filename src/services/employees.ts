/**
 * Who shows up on the Hours screen.
 *
 * No employee is bundled with the app — names and MAC addresses are personal
 * data and would be readable inside the distributed APK. Instead the beacon
 * MACs are discovered from the synced working-hours data, and the user puts a
 * name to each one in Settings. Those names are saved on the device, so this
 * is a one-off per phone and survives app updates.
 */

import { Employee } from '../config/defaults';

/** "AA:BB:CC:DD:EE:FF" -> "DD:EE:FF" — enough to tell tags apart on screen. */
export function shortMac(mac: string): string {
  const parts = mac.split(':');
  return parts.length > 3 ? parts.slice(-3).join(':') : mac;
}

/**
 * Merge the employees the user has named with any MACs seen in the synced data.
 *
 * Saved names always win. A MAC that has hours but no name yet is included and
 * labelled by its tail, so a freshly installed app still shows everyone's hours
 * immediately instead of an empty table.
 */
export function resolveEmployees(configured: Employee[], notes: any): Employee[] {
  const named = Array.isArray(configured) ? configured : [];
  const byMac = new Map<string, Employee>();

  named.forEach(e => {
    if (e && e.mac) byMac.set(e.mac, { mac: e.mac, name: e.name || shortMac(e.mac) });
  });

  const hours = (notes && notes.workingHours) || {};
  Object.keys(hours).forEach(mac => {
    if (mac === 'lastchanged') return;
    if (!byMac.has(mac)) byMac.set(mac, { mac, name: shortMac(mac) });
  });

  return [...byMac.values()].sort((a, b) => a.name.localeCompare(b.name));
}

/** True when this entry is still showing a MAC rather than a real name. */
export function isUnnamed(employee: Employee): boolean {
  return !employee.name || employee.name === shortMac(employee.mac);
}
