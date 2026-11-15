import type { BilanDiscipline, Confrontation, Epreuve, Fait, TropheeObtenu } from '../../types.ts';

/** Une place dans une partie Bullcast. joueur : clé du Classico, ou null pour un invité. */
export type PlaceFlechettes = { joueur: string | null; rang: number; stats: Record<string, number> };

/** Partie compactée, telle que stockée par le collecteur. */
export type PartieFlechettes = {
  id: string;
  /** Horodatage de fin, en secondes. */
  fin: number;
  mode: string;
  config: { startScore?: number; legsToWin?: number; variant?: string; crazy?: boolean };
  places: PlaceFlechettes[];
};

export type BrutFlechettes = { parties: PartieFlechettes[]; branche: boolean; erreur?: string };

const NOM_MODE: Record<string, string> = {
  cricket: 'Cricket', clock: 'Tour de l\'horloge', killer: 'Killer', golf: 'Golf', hammer: 'Hammer',
  shanghai: 'Shanghai', halveit: 'Halve-it', baseball: 'Baseball', doubles: 'Doubles', checkout121: '121',
};

export function titreDe(p: PartieFlechettes): string {
  if (p.mode === 'x01') return String(p.config.startScore ?? 501);
  if (p.mode === 'cricket') return p.config.variant === 'cutthroat' ? 'Cut-throat' : p.config.crazy ? 'Crazy cricket' : 'Cricket';
  return NOM_MODE[p.mode] ?? p.mode;
}

type Cumul = {
  points: number; darts: number; c180: number; checkout: number; meilleurLeg: number;
  marques: number; manches: number; parties: number;
  hammer: number | null; halveit: number | null;
};

const virgule = (n: number, d = 1) => n.toFixed(d).replace('.', ',');

export function calculerFlechettes(brut: BrutFlechettes, joueurs: string[]): BilanDiscipline {
  const cumul = new Map<string, Cumul>(joueurs.map((j) => [j, {
    points: 0, darts: 0, c180: 0, checkout: 0, meilleurLeg: 0, marques: 0, manches: 0, parties: 0, hammer: null, halveit: null,
  }]));
  const confrontations: Confrontation[] = [];
  const t180: Record<string, TropheeObtenu> = {};
  const tGros: Record<string, TropheeObtenu> = {};

  for (const p of [...brut.parties].sort((x, y) => x.fin - y.fin)) {
    const assis = p.places.filter((pl) => pl.joueur && cumul.has(pl.joueur));
    // Seules comptent les parties où deux joueurs du Classico au moins étaient à la cible ensemble :
    // une moyenne faite contre d'autres, ou seul, ne dit rien de la rivalité.
    if (new Set(assis.map((pl) => pl.joueur)).size < 2) continue;
    for (const pl of assis) {
      const c = cumul.get(pl.joueur!)!;
      const s = pl.stats;
      c.parties++;
      if (p.mode === 'x01') {
        c.points += s.points ?? 0;
        c.darts += s.darts ?? 0;
        c.c180 += s.count180 ?? 0;
        c.checkout = Math.max(c.checkout, s.highestCheckout ?? 0);
        if (s.bestLeg && (!c.meilleurLeg || s.bestLeg < c.meilleurLeg)) c.meilleurLeg = s.bestLeg;
        if ((s.count180 ?? 0) > 0 && !t180[pl.joueur!]) t180[pl.joueur!] = { cle: 'flechettes.180', date: p.fin };
        if ((s.highestCheckout ?? 0) >= 100 && !tGros[pl.joueur!]) tGros[pl.joueur!] = { cle: 'flechettes.gros', date: p.fin };
      } else if (p.mode === 'cricket') {
        c.marques += s.marks ?? 0;
        c.manches += s.rounds ?? 0;
      } else if (p.mode === 'hammer' && typeof s.points === 'number') {
        c.hammer = Math.max(c.hammer ?? -Infinity, s.points);
      } else if (p.mode === 'halveit' && typeof s.points === 'number') {
        c.halveit = Math.max(c.halveit ?? -Infinity, s.points);
      }
    }

    // Une confrontation : deux joueurs du Classico à la cible, seuls ou avec d'autres.
    // À trois ou plus, celui des deux qui finit devant l'autre l'emporte.
    if (assis.length !== 2 || assis[0].joueur === assis[1].joueur) continue;
    const [x, y] = assis;
    const autres = p.places.length - 2;
    const gagnant = x.rang === y.rang ? null : x.rang < y.rang ? x.joueur! : y.joueur!;
    const legs = p.mode === 'x01' && (p.config.legsToWin ?? 1) > 1;
    const moyenne = (pl: PlaceFlechettes) => (pl.stats.darts ? (pl.stats.points ?? 0) / pl.stats.darts * 3 : null);
    const mg = gagnant && p.mode === 'x01' ? moyenne(gagnant === x.joueur ? x : y) : null;
    confrontations.push({
      id: `flechettes:${p.id}`, discipline: 'flechettes', epreuve: 'flechettes.duel', date: p.fin,
      joueurs: [x.joueur!, y.joueur!], gagnant, titre: titreDe(p),
      ...(legs ? { score: { [x.joueur!]: x.stats.legsWon ?? 0, [y.joueur!]: y.stats.legsWon ?? 0 } } : {}),
      ...(mg ? { detail: `moyenne de ${virgule(mg)}` } : autres > 0 ? { detail: `partie à ${p.places.length}` } : {}),
    });
  }

  const mesure = (lire: (c: Cumul) => number | null, format: (n: number) => string = String) => {
    const valeurs: Record<string, number | null> = {};
    const affichage: Record<string, string> = {};
    for (const j of joueurs) {
      const v = lire(cumul.get(j)!);
      valeurs[j] = v;
      affichage[j] = v === null ? '—' : format(v);
    }
    return { valeurs, affichage };
  };

  // Une ceinture mineure par jeu réellement pratiqué ensemble : pas de ceinture sans valeur.
  const mineures: Epreuve[] = [
    {
      cle: 'flechettes.moyenne', nom: 'Moyenne en X01', genre: 'mesure', majeure: false, sens: 1,
      // Arrondie au dixième : c'est la valeur affichée qui départage, pas une décimale invisible.
      ...mesure((c) => (c.darts >= 30 ? Math.round(c.points / c.darts * 30) / 10 : null), (n) => virgule(n)),
      pique: 'Moyenne aux fléchettes : {a} {va}, {b} {vb}. L\'un vise, l\'autre lance.',
    },
    {
      cle: 'flechettes.checkout', nom: 'Plus gros checkout', genre: 'mesure', majeure: false, sens: 1,
      ...mesure((c) => c.checkout || null),
      pique: 'Plus gros checkout : {va} pour {a}, {vb} pour {b}.',
    },
    {
      cle: 'flechettes.mpr', nom: 'Marques par manche au cricket', genre: 'mesure', majeure: false, sens: 1,
      ...mesure((c) => (c.manches >= 5 ? Math.round(c.marques / c.manches * 100) / 100 : null), (n) => virgule(n, 2)),
      pique: 'Au cricket, {a} tourne à {va} marques par manche, {b} à {vb}.',
    },
    {
      cle: 'flechettes.hammer', nom: 'Record au Hammer', genre: 'mesure', majeure: false, sens: 1,
      ...mesure((c) => c.hammer),
      pique: 'Record au Hammer : {va} pour {a}, {vb} pour {b}.',
    },
    {
      cle: 'flechettes.halveit', nom: 'Record au Halve-it', genre: 'mesure', majeure: false, sens: 1,
      ...mesure((c) => c.halveit),
      pique: 'Record au Halve-it : {va} pour {a}, {vb} pour {b}.',
    },
  ];
  const epreuves: Epreuve[] = [
    { cle: 'flechettes.duel', nom: 'Face-à-face aux fléchettes', genre: 'duel', majeure: true },
    ...mineures.filter((e) => Object.values(e.valeurs ?? {}).some((v) => v !== null)),
  ];

  const faits: Fait[] = [
    {
      cle: 'flechettes.180', nom: 'Nombre de 180', sens: 1,
      ...mesure((c) => (c.parties ? c.c180 : null)),
      pique: 'Au compteur des 180 : {a} {va}, {b} {vb}.',
    },
    {
      cle: 'flechettes.leg', nom: 'Meilleur leg (fléchettes)', sens: -1,
      ...mesure((c) => c.meilleurLeg || null),
      pique: 'Meilleur leg : {va} fléchettes pour {a}, {vb} pour {b}.',
    },
    {
      cle: 'flechettes.volume', nom: 'Parties jouées', sens: 1,
      ...mesure((c) => c.parties || null),
    },
  ];

  return {
    cle: 'flechettes', nom: 'Fléchettes', emoji: '🎯',
    source: { nom: 'Bullcast', lien: 'https://bullcast.app' },
    ...(brut.erreur
      ? { avertissement: `Bullcast n'a pas répondu : les résultats datent du dernier passage réussi. (${brut.erreur})` }
      : !brut.branche && !brut.parties.length
        ? { avertissement: 'Les résultats Bullcast ne sont pas encore branchés. Voir le README, section « Brancher Bullcast ».' }
        : {}),
    epreuves, confrontations, faits,
    trophees: [
      { def: { cle: 'flechettes.180', nom: 'One hundred and eighty', emoji: '🎯', condition: 'Claquer un 180' }, obtenus: t180 },
      { def: { cle: 'flechettes.gros', nom: 'Le Gros poisson', emoji: '🐟', condition: 'Finir sur un checkout de 100 ou plus' }, obtenus: tGros },
    ],
  };
}
