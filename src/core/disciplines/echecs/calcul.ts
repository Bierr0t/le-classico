import type { BilanDiscipline, Config, Confrontation, Epreuve, Fait, TropheeObtenu } from '../../types.ts';
import { confrontationsSaisies, type Saisie } from '../contrat.ts';
import { CADENCES, CLE_STATS, NOM_CADENCE, NOM_ISSUE, type Partie, type ProfilApi, type StatsApi } from './chesscom.ts';

export type SourceEchecs = {
  /** Clé du joueur dans le Classico. */
  cle: string;
  /** Pseudo chess.com, en minuscules. */
  pseudo: string;
  profil: ProfilApi | null;
  stats: StatsApi | null;
  parties: Partie[];
};

export type BrutEchecs = { sources: SourceEchecs[]; battles: Saisie[] };

const MAT_EXPRESS = 20;

/** Plus longues séries de victoires et de défaites d'un joueur, sur ses parties classées. */
function seriesDe(pseudo: string, parties: Partie[]): { victoires: number; defaites: number } {
  let v = 0, d = 0, maxV = 0, maxD = 0;
  for (const p of parties) {
    if (!p.classee) continue;
    const blancs = p.blancs.pseudo === pseudo;
    const res = p.resultat === 'nulle' ? 'N' : (p.resultat === 'blancs') === blancs ? 'V' : 'D';
    v = res === 'V' ? v + 1 : 0;
    d = res === 'D' ? d + 1 : 0;
    if (v > maxV) maxV = v;
    if (d > maxD) maxD = d;
  }
  return { victoires: maxV, defaites: maxD };
}

const nombre = (n: number | null | undefined) => (n == null ? '—' : String(n));

export function calculerEchecs(brut: BrutEchecs, config: Config): BilanDiscipline {
  const sources = brut.sources;
  const cleDe = new Map(sources.map((s) => [s.pseudo, s.cle]));
  const mesure = (lire: (s: SourceEchecs) => number | null | undefined) => {
    const valeurs: Record<string, number | null> = {};
    const affichage: Record<string, string> = {};
    for (const s of sources) {
      valeurs[s.cle] = lire(s) ?? null;
      affichage[s.cle] = nombre(valeurs[s.cle]);
    }
    return { valeurs, affichage };
  };

  const epreuves: Epreuve[] = [
    ...CADENCES.map((cad): Epreuve => ({
      cle: `echecs.${cad}`, nom: `Elo ${NOM_CADENCE[cad].toLowerCase()}`, genre: 'mesure', majeure: false, sens: 1,
      ...mesure((s) => s.stats?.[CLE_STATS[cad]]?.last?.rating),
      pique: `Elo ${NOM_CADENCE[cad].toLowerCase()} : {a} {va}, {b} {vb}. {e} points d'écart, ça se voit sur l'échiquier.`,
    })),
    { cle: 'echecs.duel', nom: 'Face-à-face aux échecs', genre: 'duel', majeure: true },
    {
      cle: 'echecs.problemes', nom: 'Record aux problèmes', genre: 'mesure', majeure: false, sens: 1,
      ...mesure((s) => s.stats?.tactics?.highest?.rating),
      pique: 'Record aux problèmes : {a} {va}, {b} {vb}. {e} points, c\'est mince, mais c\'est devant.',
    },
    {
      cle: 'echecs.rush', nom: 'Puzzle Rush', genre: 'mesure', majeure: false, sens: 1,
      ...mesure((s) => s.stats?.puzzle_rush?.best?.score),
      pique: 'Puzzle Rush : {a} {va}, {b} {vb}. Ce n\'est pas le même sport.',
    },
    { cle: 'echecs.battle', nom: 'Battle de problèmes', genre: 'duel', majeure: true },
  ];

  // Une partie entre deux joueurs figure dans les archives de chacun : on dédoublonne par identifiant.
  const vues = new Set<string>();
  const confrontations: Confrontation[] = [];
  const express: Record<string, TropheeObtenu> = {};
  const toutes = sources.flatMap((s) => s.parties).sort((x, y) => x.fin - y.fin);
  for (const p of toutes) {
    const blancs = cleDe.get(p.blancs.pseudo);
    const noirs = cleDe.get(p.noirs.pseudo);
    if (!blancs || !noirs || blancs === noirs || vues.has(p.id)) continue;
    vues.add(p.id);
    const gagnant = p.resultat === 'nulle' ? null : p.resultat === 'blancs' ? blancs : noirs;
    const coups = p.coups ? ` en ${p.coups} coups` : '';
    confrontations.push({
      id: p.id, discipline: 'echecs', epreuve: 'echecs.duel', date: p.fin, joueurs: [blancs, noirs], gagnant,
      titre: NOM_CADENCE[p.cadence],
      detail: gagnant ? `${NOM_ISSUE[p.issue]}${coups}` : NOM_ISSUE[p.issue],
      lien: p.id,
    });
    if (gagnant && p.issue === 'mat' && p.coups && p.coups < MAT_EXPRESS && !express[gagnant]) {
      express[gagnant] = { cle: 'echecs.express', date: p.fin, lien: p.id };
    }
  }
  confrontations.push(...confrontationsSaisies(brut.battles, config, 'echecs', 'echecs.battle', 'Battle de problèmes'));

  const series = new Map(sources.map((s) => [s.cle, seriesDe(s.pseudo, [...s.parties].sort((x, y) => x.fin - y.fin))]));
  const faits: Fait[] = [
    ...CADENCES.map((cad): Fait => ({
      cle: `echecs.record.${cad}`, nom: `Record en ${NOM_CADENCE[cad].toLowerCase()}`, sens: 1,
      ...mesure((s) => s.stats?.[CLE_STATS[cad]]?.best?.rating),
      pique: `Record en ${NOM_CADENCE[cad].toLowerCase()} : {a} est monté à {va}, {b} n'a jamais dépassé {vb}.`,
    })),
    {
      cle: 'echecs.serieV', nom: 'Plus longue série de victoires', sens: 1,
      ...mesure((s) => series.get(s.cle)?.victoires || null),
      pique: 'Plus longue série de victoires aux échecs : {va} pour {a}, {vb} pour {b}.',
    },
    {
      cle: 'echecs.serieD', nom: 'Pire série de défaites', sens: -1, honte: true,
      ...mesure((s) => series.get(s.cle)?.defaites || null),
      pique: 'Pire série de défaites aux échecs : {vb} de rang pour {b}. {a} n\'a jamais fait pire que {va}.',
    },
    {
      cle: 'echecs.volume', nom: 'Parties jouées', sens: 1,
      ...mesure((s) => s.parties.length || null),
      pique: '{a} a joué {va} parties, {b} {vb}. L\'un des deux travaille.',
    },
  ];

  const avatars: Record<string, string> = {};
  const profils: Record<string, string> = {};
  const introuvables: string[] = [];
  for (const s of sources) {
    if (s.profil?.avatar) avatars[s.cle] = s.profil.avatar;
    profils[s.cle] = `https://www.chess.com/member/${s.pseudo}`;
    if (!s.profil) introuvables.push(s.pseudo);
  }

  return {
    cle: 'echecs', nom: 'Échecs', emoji: '♟️',
    source: { nom: 'chess.com', lien: 'https://www.chess.com' },
    ...(introuvables.length ? { avertissement: `Compte introuvable sur chess.com : ${introuvables.join(', ')}.` } : {}),
    epreuves, confrontations, faits, avatars, profils,
    saisies: [{ fichier: 'echecs-battle', nom: 'Battle de problèmes' }],
    trophees: [{
      def: { cle: 'echecs.express', nom: 'Le Fossoyeur', emoji: '⚰️', condition: `Mater l'autre en moins de ${MAT_EXPRESS} coups` },
      obtenus: express,
    }],
  };
}
