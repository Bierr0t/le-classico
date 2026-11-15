import type { Instantane } from '../core/types.ts';

export async function charger(): Promise<Instantane> {
  const r = await fetch(`./instantane.json?t=${Math.floor(Date.now() / 60000)}`);
  if (!r.ok) throw new Error(`instantane.json : HTTP ${r.status}`);
  return r.json();
}

/** Mémoire locale de l'appareil. Peut être indisponible (navigation privée) : tout est optionnel. */
export const memoire = {
  lire<T>(cle: string, defaut: T): T {
    try {
      const v = localStorage.getItem(`classico.${cle}`);
      return v === null ? defaut : (JSON.parse(v) as T);
    } catch { return defaut; }
  },
  ecrire(cle: string, v: unknown) {
    try { localStorage.setItem(`classico.${cle}`, JSON.stringify(v)); } catch { /* tant pis */ }
  },
};

const fmtCourt = new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit' });
const fmtLong = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
const fmtJour = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

export const dateCourte = (ts: number) => fmtCourt.format(ts * 1000);
export const dateLongue = (ts: number) => fmtLong.format(ts * 1000);
export const jourLong = (ts: number) => fmtJour.format(ts * 1000);

export function ilYA(ts: number, maintenant: number): string {
  const s = Math.max(0, maintenant - ts);
  if (s < 90) return "à l'instant";
  if (s < 3600) return `il y a ${Math.round(s / 60)} min`;
  if (s < 86400) return `il y a ${Math.round(s / 3600)} h`;
  return `il y a ${Math.round(s / 86400)} j`;
}

export async function partager(texte: string, url = location.href.split('#')[0]): Promise<'partage' | 'copie' | 'echec'> {
  try {
    if (navigator.share) {
      await navigator.share({ text: texte, url });
      return 'partage';
    }
    await navigator.clipboard.writeText(`${texte} ${url}`);
    return 'copie';
  } catch (e) {
    return (e as Error).name === 'AbortError' ? 'partage' : 'echec';
  }
}
