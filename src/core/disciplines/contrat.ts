/**
 * Le contrat d'une discipline. Pour brancher un sport :
 *   1. écrire un objet Discipline (collecter + calculer) ;
 *   2. l'enregistrer dans disciplines/index.ts ;
 *   3. ajouter sa clé à « disciplines » dans classico.json.
 * Le moteur, les saisons, le fil d'actu, les munitions et l'interface suivent sans autre changement.
 *
 * Un sport sans source de données n'a même pas besoin de code : voir « manuelles » dans classico.json.
 */
import { tsParis } from '../temps.ts';
import type { BilanDiscipline, Config, Confrontation } from '../types.ts';

export type Contexte = {
  config: Config;
  /** Lit et écrit dans le stockage de la discipline, conservé d'un passage à l'autre. */
  lire<T>(chemin: string, defaut: T): Promise<T>;
  ecrire(chemin: string, valeur: unknown): Promise<void>;
  lister(dossier: string): Promise<string[]>;
  /** Résultats saisis à la main dans saisies/{nom}.json. */
  saisies(nom: string): Promise<Saisie[]>;
  journal(message: string): void;
};

export type Discipline<Brut = unknown> = {
  cle: string;
  nom: string;
  emoji: string;
  /** Va chercher les données. Seul endroit où le réseau et le disque sont permis. */
  collecter(ctx: Contexte): Promise<Brut>;
  /** Pur : mêmes données, même bilan. C'est ici que vivent les règles et c'est ce qui est testé. */
  calculer(brut: Brut, config: Config, maintenant: number): BilanDiscipline;
};

/** Une ligne de saisies/{nom}.json. */
export type Saisie = {
  /** AAAA-MM-JJ. */
  date: string;
  /** Clé du gagnant, ou null pour un nul. */
  gagnant: string | null;
  /** Par défaut, les deux premiers joueurs de classico.json. */
  joueurs?: string[];
  score?: Record<string, number>;
  note?: string;
};

export function confrontationsSaisies(
  saisies: Saisie[], config: Config, discipline: string, epreuve: string, titre: string,
): Confrontation[] {
  const connus = new Set(config.joueurs.map((j) => j.cle));
  const parJour = new Map<string, number>();
  const liste: Confrontation[] = [];
  for (const s of saisies) {
    const joueurs = s.joueurs ?? config.joueurs.slice(0, 2).map((j) => j.cle);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s.date) || joueurs.length !== 2 || !joueurs.every((j) => connus.has(j))) continue;
    if (s.gagnant !== null && !joueurs.includes(s.gagnant)) continue;
    const rang = parJour.get(s.date) ?? 0;
    parJour.set(s.date, rang + 1);
    const score = s.score && joueurs.every((j) => typeof s.score![j] === 'number') ? s.score : undefined;
    liste.push({
      id: `${epreuve}:${s.date}:${rang}`,
      discipline, epreuve, titre, joueurs,
      // Midi, heure de Paris, plus le rang : l'ordre de saisie d'une même journée est respecté.
      date: tsParis(s.date, 12) + rang * 60,
      gagnant: s.gagnant,
      ...(score ? { score } : {}),
      ...(s.note ? { detail: s.note } : {}),
    });
  }
  return liste;
}
