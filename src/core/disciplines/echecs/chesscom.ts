/** Lecture de l'API publique de chess.com. Repris du Vestiaire. */

export type Cadence = 'rapide' | 'blitz' | 'bullet';
export const CADENCES: Cadence[] = ['rapide', 'blitz', 'bullet'];
export const NOM_CADENCE: Record<Cadence, string> = { rapide: 'Rapide', blitz: 'Blitz', bullet: 'Bullet' };
/** Ce que pèse une partie dans le face-à-face : plus la cadence est longue, plus la victoire compte. */
export const POIDS_CADENCE: Record<Cadence, number> = { rapide: 3, blitz: 2, bullet: 1 };
export const CLE_STATS = { rapide: 'chess_rapid', blitz: 'chess_blitz', bullet: 'chess_bullet' } as const;

export type Issue =
  | 'mat' | 'abandon' | 'temps' | 'pat' | 'repetition' | 'accord'
  | 'materiel' | '50coups' | 'deconnexion';

export const NOM_ISSUE: Record<Issue, string> = {
  mat: 'par mat',
  abandon: 'par abandon',
  temps: 'au temps',
  pat: 'pat',
  repetition: 'répétition',
  accord: 'nulle par accord',
  materiel: 'matériel insuffisant',
  '50coups': 'règle des 50 coups',
  deconnexion: 'par déconnexion',
};

/** Partie compactée, telle que stockée par le collecteur. Les pseudos sont en minuscules. */
export type Partie = {
  id: string;
  fin: number;
  cadence: Cadence;
  classee: boolean;
  blancs: { pseudo: string; elo: number };
  noirs: { pseudo: string; elo: number };
  resultat: 'blancs' | 'noirs' | 'nulle';
  issue: Issue;
  coups?: number;
};

type Classement = { rating: number; date?: number };
export type StatsApi = Partial<Record<'chess_rapid' | 'chess_blitz' | 'chess_bullet', {
  last?: Classement;
  best?: Classement;
  record?: { win: number; loss: number; draw: number };
}>> & {
  tactics?: { highest?: Classement; lowest?: Classement };
  puzzle_rush?: { best?: { score: number; total_attempts: number } };
};

export type ProfilApi = { avatar?: string; joined?: number; status?: string; url?: string };

const CADENCE: Record<string, Cadence> = { rapid: 'rapide', blitz: 'blitz', bullet: 'bullet' };
const ISSUE: Record<string, Issue> = {
  checkmated: 'mat',
  resigned: 'abandon',
  timeout: 'temps',
  abandoned: 'deconnexion',
  stalemate: 'pat',
  repetition: 'repetition',
  agreed: 'accord',
  insufficient: 'materiel',
  timevsinsufficient: 'materiel',
  '50move': '50coups',
};

type Cote = { username: string; rating: number; result: string };
export type PartieApi = {
  url: string;
  end_time: number;
  time_class: string;
  rules: string;
  rated: boolean;
  white: Cote;
  black: Cote;
  pgn?: string;
};

/** Nombre de coups joués par les blancs, lu dans le PGN. */
export function compterCoups(pgn: string | undefined): number | undefined {
  if (!pgn) return undefined;
  const debut = pgn.indexOf('\n\n');
  const corps = pgn.slice(debut < 0 ? 0 : debut).replace(/\{[^}]*\}/g, '');
  let dernier: number | undefined;
  for (const m of corps.matchAll(/(\d+)\.(?!\.)/g)) dernier = Number(m[1]);
  return dernier;
}

/** Renvoie null pour les parties hors périmètre (variantes, parties quotidiennes). */
export function compacter(g: PartieApi): Partie | null {
  const cadence = CADENCE[g.time_class];
  if (!cadence || g.rules !== 'chess' || !g.white || !g.black) return null;
  const resultat = g.white.result === 'win' ? 'blancs' : g.black.result === 'win' ? 'noirs' : 'nulle';
  const code = resultat === 'blancs' ? g.black.result : g.white.result;
  return {
    id: g.url,
    fin: g.end_time,
    cadence,
    classee: g.rated,
    blancs: { pseudo: g.white.username.toLowerCase(), elo: g.white.rating },
    noirs: { pseudo: g.black.username.toLowerCase(), elo: g.black.rating },
    resultat,
    issue: ISSUE[code] ?? 'abandon',
    coups: compterCoups(g.pgn),
  };
}
