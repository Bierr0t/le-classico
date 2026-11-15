/**
 * Bullcast n'expose aucune route publique : les parties sont lues en lecture seule dans sa base D1,
 * par l'API de Cloudflare. Trois variables d'environnement sont nécessaires :
 *   CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_API_TOKEN (droit « D1 : lecture »), BULLCAST_D1_ID.
 * Sans elles, la discipline garde les parties du dernier passage réussi.
 *
 * Seul le strict nécessaire sort de la base : pas d'adresse, pas d'identifiant de compte,
 * et le nom des autres joueurs d'une partie n'est pas conservé.
 */
import type { Contexte } from '../contrat.ts';
import type { BrutFlechettes, PartieFlechettes } from './calcul.ts';

type Ligne = {
  id: string; modeId: string; config: string; finishedAt: number; seat: number;
  nom: string; rang: number; stats: string; identifiant: string | null; compte: string | null;
};

const SQL = `
select g.id, g.modeId, g.config, g.finishedAt, gp.seat, gp.name as nom, gp.rank as rang, gp.stats,
       coalesce(lie.handle, case when p.self = 1 then proprio.handle end) as identifiant,
       coalesce(lie.name, case when p.self = 1 then proprio.name end) as compte
from game g
join game_player gp on gp.gameId = g.id
left join profile p on p.id = gp.profileId
left join "user" proprio on proprio.id = p.userId
left join "user" lie on lie.id = p.linkedUserId
where g.userId in (select id from "user" where lower(handle) in (?1, ?2) or lower(name) in (?1, ?2))
  and coalesce(g.training, 0) = 0 and g.doubt is null
order by g.finishedAt, gp.seat`;

async function requete(sql: string, params: string[]): Promise<Ligne[]> {
  const { CLOUDFLARE_ACCOUNT_ID: compte, CLOUDFLARE_API_TOKEN: jeton, BULLCAST_D1_ID: base } = process.env;
  const r = await fetch(`https://api.cloudflare.com/client/v4/accounts/${compte}/d1/database/${base}/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${jeton}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ sql, params }),
  });
  const corps = (await r.json().catch(() => null)) as { success?: boolean; errors?: { message: string }[]; result?: { results: Ligne[] }[] } | null;
  if (!r.ok || !corps?.success) throw new Error(corps?.errors?.[0]?.message ?? `HTTP ${r.status}`);
  return corps.result?.[0]?.results ?? [];
}

function json<T>(texte: string, defaut: T): T {
  try { return JSON.parse(texte) as T; } catch { return defaut; }
}

/** Regroupe les lignes (une par place) en parties, et reconnaît les joueurs du Classico. */
export function compacter(lignes: Ligne[], comptes: Map<string, string>): PartieFlechettes[] {
  const parties = new Map<string, PartieFlechettes>();
  const places = new Map<string, Set<number>>();
  for (const l of lignes) {
    // Une partie est recopiée dans l'historique de chaque compte : « uuid » chez l'un, « uuid:compte » chez l'autre.
    const id = l.id.split(':')[0];
    let p = parties.get(id);
    if (!p) {
      const c = json<Record<string, unknown>>(l.config, {});
      const fin = l.finishedAt > 1e11 ? Math.floor(l.finishedAt / 1000) : l.finishedAt;
      p = {
        id, fin, mode: l.modeId, places: [],
        config: {
          ...(typeof c.startScore === 'number' ? { startScore: c.startScore } : {}),
          ...(typeof c.legsToWin === 'number' ? { legsToWin: c.legsToWin } : {}),
          ...(typeof c.variant === 'string' ? { variant: c.variant } : {}),
          ...(c.crazy === true ? { crazy: true } : {}),
        },
      };
      parties.set(id, p);
      places.set(id, new Set());
    }
    const joueur = comptes.get((l.identifiant ?? '').toLowerCase()) ?? comptes.get((l.compte ?? '').toLowerCase())
      ?? comptes.get(l.nom.toLowerCase()) ?? null;
    const deja = places.get(id)!;
    if (deja.has(l.seat)) {
      // Deuxième copie de la même partie : elle peut identifier une place que la première laissait anonyme.
      const place = p.places[[...deja].indexOf(l.seat)];
      if (!place.joueur && joueur) place.joueur = joueur;
      continue;
    }
    deja.add(l.seat);
    const stats: Record<string, number> = {};
    for (const [k, v] of Object.entries(json<Record<string, unknown>>(l.stats, {}))) if (typeof v === 'number') stats[k] = v;
    p.places.push({ joueur, rang: l.rang, stats });
  }
  // On ne garde que les parties où deux joueurs du Classico au moins sont à la cible ensemble.
  return [...parties.values()].filter((p) => new Set(p.places.map((pl) => pl.joueur).filter(Boolean)).size >= 2);
}

export async function collecterFlechettes(ctx: Contexte): Promise<BrutFlechettes> {
  const anciennes = await ctx.lire<PartieFlechettes[]>('parties.json', []);
  const comptes = new Map<string, string>();
  for (const j of ctx.config.joueurs) if (j.comptes.bullcast) comptes.set(j.comptes.bullcast.toLowerCase(), j.cle);

  const { CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_API_TOKEN, BULLCAST_D1_ID } = process.env;
  if (!CLOUDFLARE_ACCOUNT_ID || !CLOUDFLARE_API_TOKEN || !BULLCAST_D1_ID) {
    ctx.journal(`Bullcast non branché : ${anciennes.length} parties gardées du dernier passage`);
    return { parties: anciennes, branche: false };
  }
  // La requête prend deux identifiants : au-delà de deux joueurs, on interroge par paquets de deux.
  try {
    const noms = [...comptes.keys()];
    const lignes: Ligne[] = [];
    for (let i = 0; i < noms.length; i += 2) lignes.push(...await requete(SQL, [noms[i], noms[i + 1] ?? noms[i]]));
    const parties = compacter(lignes, comptes);
    await ctx.ecrire('parties.json', parties);
    ctx.journal(`Bullcast : ${parties.length} parties`);
    return { parties, branche: true };
  } catch (e) {
    ctx.journal(`Bullcast en échec : ${(e as Error).message}`);
    return { parties: anciennes, branche: true, erreur: (e as Error).message };
  }
}
