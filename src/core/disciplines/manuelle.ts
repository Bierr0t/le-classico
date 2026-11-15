/** Discipline sans code : tout vient de saisies/{cle}.json. Ping-pong, pétanque, FIFA, ce qu'on veut. */
import type { DisciplineManuelle } from '../types.ts';
import { confrontationsSaisies, type Discipline, type Saisie } from './contrat.ts';

export function disciplineManuelle(def: DisciplineManuelle): Discipline<Saisie[]> {
  const epreuve = `${def.cle}.duel`;
  return {
    cle: def.cle,
    nom: def.nom,
    emoji: def.emoji,
    collecter: (ctx) => ctx.saisies(def.cle),
    calculer: (saisies, config) => ({
      cle: def.cle, nom: def.nom, emoji: def.emoji, saisie: true,
      saisies: [{ fichier: def.cle, nom: def.nom }],
      epreuves: [{ cle: epreuve, nom: def.epreuve ?? `Face-à-face ${def.nom.toLowerCase()}`, genre: 'duel', majeure: true }],
      confrontations: confrontationsSaisies(saisies, config, def.cle, epreuve, def.nom),
      faits: [],
    }),
  };
}
