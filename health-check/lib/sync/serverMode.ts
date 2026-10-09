import { createProject } from '@/lib/risk/store';
import { createServerProject, type NewProjectInput } from './serverSync';

/**
 * Szerveres mód a felületen: bejelentkezett belső felhasználónál (a
 * ServerSync komponens kapcsolja be). Ilyenkor az új projekt a szerveren
 * készül; enélkül (bemutató, előnézet, helyi fejlesztés) minden helyben marad.
 */
export const SERVER_MODE_EVENT = 'ict-hc:server-mode';
let on = false;

export function serverModeOn(): boolean {
  return on;
}

export function setServerMode(value: boolean): void {
  if (on === value) return;
  on = value;
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(SERVER_MODE_EVENT));
}

/** Új projekt: szerveres módban a szerveren (hiba esetén kivétel), különben helyben. */
export async function createAnyProject(input: NewProjectInput): Promise<void> {
  if (on) await createServerProject(input);
  else createProject(input);
}
