/** Le registre des disciplines. Brancher un sport, c'est ajouter une entrée ici. */
import type { Config } from '../types.ts';
import type { Discipline } from './contrat.ts';
import { calculerEchecs, type BrutEchecs } from './echecs/calcul.ts';
import { collecterEchecs } from './echecs/collecte.ts';
import { calculerFlechettes, type BrutFlechettes } from './flechettes/calcul.ts';
import { collecterFlechettes } from './flechettes/collecte.ts';
import { disciplineManuelle } from './manuelle.ts';

const echecs: Discipline<BrutEchecs> = {
  cle: 'echecs', nom: 'Échecs', emoji: '♟️',
  collecter: collecterEchecs,
  calculer: (brut, config) => calculerEchecs(brut, config),
};

const flechettes: Discipline<BrutFlechettes> = {
  cle: 'flechettes', nom: 'Fléchettes', emoji: '🎯',
  collecter: collecterFlechettes,
  calculer: (brut, config) => calculerFlechettes(brut, config.joueurs.map((j) => j.cle)),
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const REGISTRE: Discipline<any>[] = [echecs, flechettes];

/** Les disciplines actives, dans l'ordre de classico.json. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function disciplinesActives(config: Config): Discipline<any>[] {
  const toutes = [...REGISTRE, ...(config.manuelles ?? []).map(disciplineManuelle)];
  return config.disciplines.map((cle) => {
    const d = toutes.find((x) => x.cle === cle);
    if (!d) throw new Error(`Discipline inconnue dans classico.json : « ${cle} ». Connues : ${toutes.map((x) => x.cle).join(', ')}.`);
    return d;
  });
}
