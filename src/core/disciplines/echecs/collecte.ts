import type { Contexte } from '../contrat.ts';
import type { BrutEchecs, SourceEchecs } from './calcul.ts';
import { compacter, type Partie, type PartieApi, type ProfilApi, type StatsApi } from './chesscom.ts';

const API = 'https://api.chess.com/pub/player';
const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));

type Etat = { complets: Record<string, string[]>; etags: Record<string, string> };

/** Requêtes en série, avec reprise sur 429. Renvoie null sur 404 et 'inchange' sur 304. */
async function api<T>(chemin: string, etat?: Etat): Promise<T | null | 'inchange'> {
  const url = `${API}/${chemin}`;
  for (let essai = 0, delai = 2000; ; essai++, delai *= 2) {
    const headers: Record<string, string> = { 'User-Agent': 'le-classico (statistiques entre amis)' };
    const etag = etat?.etags[chemin];
    if (etag) headers['If-None-Match'] = etag;
    const r = await fetch(url, { headers });
    await pause(150);
    if (r.status === 304) return 'inchange';
    if (r.status === 404 || r.status === 410) return null;
    if (r.ok) {
      const e = r.headers.get('etag');
      if (etat && e) etat.etags[chemin] = e;
      return (await r.json()) as T;
    }
    if (essai >= 3) throw new Error(`${url} : HTTP ${r.status}`);
    await pause(delai);
  }
}

async function chargerParties(ctx: Contexte, dossier: string): Promise<Partie[]> {
  const fichiers = (await ctx.lister(dossier)).filter((f) => f.endsWith('.json'));
  const lots = await Promise.all(fichiers.map((f) => ctx.lire<Partie[]>(`${dossier}/${f}`, [])));
  return lots.flat();
}

async function collecterJoueur(ctx: Contexte, cle: string, pseudo: string, etat: Etat): Promise<SourceEchecs> {
  const dossier = `parties/${pseudo}`;
  const profil = (await api<ProfilApi>(pseudo)) as ProfilApi | null;
  if (!profil) {
    ctx.journal(`${pseudo} : introuvable sur chess.com`);
    return { cle, pseudo, profil: null, stats: null, parties: await chargerParties(ctx, dossier) };
  }
  const stats = (await api<StatsApi>(`${pseudo}/stats`)) as StatsApi | null;
  const archives = ((await api<{ archives: string[] }>(`${pseudo}/games/archives`)) as { archives: string[] } | null)?.archives ?? [];

  const moisCourant = new Date().toISOString().slice(0, 7);
  const complets = new Set(etat.complets[pseudo] ?? []);
  let telecharges = 0;
  for (const url of archives) {
    const [annee, mois] = url.split('/').slice(-2);
    const cleMois = `${annee}-${mois}`;
    if (complets.has(cleMois)) continue;
    const r = await api<{ games: PartieApi[] }>(`${pseudo}/games/${annee}/${mois}`, cleMois === moisCourant ? etat : undefined);
    if (r && r !== 'inchange') {
      await ctx.ecrire(`${dossier}/${cleMois}.json`, r.games.map(compacter).filter((p): p is Partie => p !== null));
      telecharges++;
    }
    if (cleMois < moisCourant) complets.add(cleMois);
  }
  etat.complets[pseudo] = [...complets].sort();
  const parties = await chargerParties(ctx, dossier);
  ctx.journal(`${pseudo} : ${parties.length} parties (${telecharges} mois téléchargés)`);
  return { cle, pseudo, profil, stats, parties };
}

export async function collecterEchecs(ctx: Contexte): Promise<BrutEchecs> {
  const etat = await ctx.lire<Etat>('etat.json', { complets: {}, etags: {} });
  const sources: SourceEchecs[] = [];
  for (const j of ctx.config.joueurs) {
    const pseudo = j.comptes.chesscom?.toLowerCase();
    if (pseudo) sources.push(await collecterJoueur(ctx, j.cle, pseudo, etat));
  }
  await ctx.ecrire('etat.json', etat);
  return { sources, battles: await ctx.saisies('echecs-battle') };
}
