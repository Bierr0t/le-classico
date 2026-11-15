/**
 * Battles de problèmes. chess.com ne liste nulle part les battles d'un joueur, mais chaque battle
 * a sa page publique (chess.com/puzzles/battle/XXXX) : à partir du lien, le résultat se lit sans compte.
 * On déclare donc une battle en donnant son lien, et c'est chess.com qui dit qui a gagné.
 *
 * Ces routes ne sont pas documentées : elles peuvent changer sans prévenir. Une battle déjà lue
 * est gardée en mémoire, et la saisie à la main reste possible.
 */
import { paris } from '../../temps.ts';
import type { Contexte, Saisie } from '../contrat.ts';

const UA = 'Mozilla/5.0 (le-classico ; statistiques entre amis)';

/** « https://www.chess.com/puzzles/battle/2oXe7a5Sn » donne « 2oXe7a5Sn ». Accepte aussi le code seul. */
export function codeBattle(lien: string): string | null {
  const texte = lien.trim();
  const m = texte.match(/chess\.com\/(?:[a-z]{2}(?:-[A-Z]{2})?\/)?(?:share\/)?puzzles?\/battle\/(?:[^/?#]+\/)?([A-Za-z0-9]{6,16})(?:[/?#]|$)/);
  if (m) return m[1];
  return /^[A-Za-z0-9]{6,16}$/.test(texte) ? texte : null;
}

export const lienBattle = (code: string) => `https://www.chess.com/puzzles/battle/${code}`;

type JoueurBattle = {
  details?: { username?: string };
  puzzles?: { state?: string }[];
  result?: { verdict?: string };
};
export type BattleApi = {
  state?: string;
  startedAt?: string;
  createTimestamp?: number;
  shortUuid?: string;
  players?: Record<string, JoueurBattle>;
};

/**
 * Transforme la réponse de chess.com en saisie. Renvoie un texte d'explication quand la battle
 * ne compte pas (pas finie, ou pas entre deux joueurs du Classico).
 */
export function saisieDepuisBattle(b: BattleApi, comptes: Map<string, string>, code: string): Saisie | string {
  if (b.state !== 'completed') return `la battle ${code} n'est pas terminée (${b.state ?? 'état inconnu'})`;
  const joueurs = Object.values(b.players ?? {});
  const cles = joueurs.map((j) => comptes.get((j.details?.username ?? '').toLowerCase()));
  if (joueurs.length !== 2 || !cles[0] || !cles[1] || cles[0] === cles[1]) {
    const noms = joueurs.map((j) => j.details?.username ?? '?').join(' et ');
    return `la battle ${code} oppose ${noms} : ce n'est pas un duel du Classico`;
  }
  const gagnant = joueurs.findIndex((j) => j.result?.verdict === 'win');
  const ts = b.startedAt ? Date.parse(b.startedAt) / 1000 : b.createTimestamp;
  if (!ts || Number.isNaN(ts)) return `la battle ${code} n'a pas de date`;
  const resolus = (j: JoueurBattle) => (j.puzzles ?? []).filter((p) => p.state === 'completed').length;
  return {
    date: paris(ts).jour,
    gagnant: gagnant < 0 ? null : cles[gagnant]!,
    score: { [cles[0]]: resolus(joueurs[0]), [cles[1]]: resolus(joueurs[1]) },
    lien: lienBattle(code),
  };
}

async function lire(code: string): Promise<BattleApi> {
  const page = await fetch(lienBattle(code), { headers: { 'User-Agent': UA } });
  if (!page.ok) throw new Error(`page de la battle ${code} : HTTP ${page.status}`);
  const id = (await page.text()).match(/battleId:\s*'([0-9a-f-]{36})'/i)?.[1];
  if (!id) throw new Error(`battle ${code} introuvable sur chess.com`);
  const r = await fetch(`https://www.chess.com/callback/tactics/battles/${id}`, { headers: { 'User-Agent': UA, Accept: 'application/json' } });
  if (!r.ok) throw new Error(`battle ${code} : HTTP ${r.status}`);
  return (await r.json()) as BattleApi;
}

/**
 * Remplace chaque lien déclaré par le résultat lu sur chess.com. Les saisies à la main passent telles quelles.
 * Une battle refusée ou illisible est signalée dans le journal et ne compte pas.
 */
export async function resoudreBattles(ctx: Contexte, declarees: Saisie[]): Promise<Saisie[]> {
  const comptes = new Map<string, string>();
  for (const j of ctx.config.joueurs) if (j.comptes.chesscom) comptes.set(j.comptes.chesscom.toLowerCase(), j.cle);
  const memoire = await ctx.lire<Record<string, Saisie>>('battles.json', {});
  const resultat: Saisie[] = [];
  const vus = new Set<string>();
  for (const s of declarees) {
    if (!s.lien || s.date) { resultat.push(s); continue; }
    const code = codeBattle(s.lien);
    if (!code) { ctx.journal(`lien de battle illisible : ${s.lien}`); continue; }
    if (vus.has(code)) continue;
    vus.add(code);
    if (!memoire[code]) {
      try {
        const lue = saisieDepuisBattle(await lire(code), comptes, code);
        if (typeof lue === 'string') { ctx.journal(`battle refusée : ${lue}`); continue; }
        memoire[code] = lue;
      } catch (e) {
        ctx.journal(`battle en attente : ${(e as Error).message}`);
        continue;
      }
    }
    resultat.push(memoire[code]);
  }
  await ctx.ecrire('battles.json', memoire);
  ctx.journal(`${resultat.length} battle(s) de problèmes`);
  return resultat.sort((x, y) => (x.date < y.date ? -1 : x.date > y.date ? 1 : 0));
}
