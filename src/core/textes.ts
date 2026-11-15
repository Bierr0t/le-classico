import type { TropheeDef } from './types.ts';

/** Trophées communs à toutes les disciplines, dans l'ordre d'affichage. */
export const TROPHEES: TropheeDef[] = [
  { cle: 'premierSang', nom: 'Le Premier sang', emoji: '🩸', condition: 'Gagner la toute première confrontation' },
  { cle: 'serie3', nom: 'Le Coup du chapeau', emoji: '🎩', condition: '3 victoires de suite, toutes disciplines confondues' },
  { cle: 'serie5', nom: 'La Manita', emoji: '🖐️', condition: '5 victoires de suite' },
  { cle: 'serie10', nom: 'Le Rouleau compresseur', emoji: '🚜', condition: '10 victoires de suite' },
  { cle: 'briseur', nom: 'Le Briseur de série', emoji: '✂️', condition: "Arrêter une série adverse de 5 victoires ou plus" },
  { cle: 'cinquante', nom: 'Le Cinquantenaire', emoji: '🗿', condition: '50 victoires en confrontation directe' },
  { cle: 'saison', nom: 'Le Champion du mois', emoji: '🏆', condition: 'Gagner une saison' },
  { cle: 'triple', nom: 'Le Triplé', emoji: '🎰', condition: 'Gagner 3 saisons de suite' },
  { cle: 'fanny', nom: 'La Fanny', emoji: '🍑', condition: "Gagner une saison sans laisser un point (3 confrontations minimum)" },
  { cle: 'holdup', nom: 'Le Hold-up', emoji: '🥷', condition: "Gagner une saison avec 3 points d'écart ou moins (5 confrontations minimum)" },
  { cle: 'couteauSuisse', nom: 'Le Couteau suisse', emoji: '🔪', condition: 'Gagner dans chaque discipline le même mois' },
  { cle: 'grandChelem', nom: 'Le Grand Chelem', emoji: '🧹', condition: 'Tenir toutes les ceintures en même temps' },
];

/**
 * Formulations. {a} est le joueur à l'honneur, {b} l'autre, {s} un score,
 * {n} un nombre, {t} ce qui s'est joué, {e} une épreuve, {g} un gage, {m} un mois.
 */
const PHRASES = {
  victoire: [
    '{a} bat {b} ({t}). {s} dans cette épreuve.',
    '{a} s\'offre {b} ({t}). Ça fait {s}.',
    '{b} tombe face à {a} ({t}). {s} au compteur.',
    '{t} : victoire de {a}. {s}, et {b} le sait.',
  ],
  nul: [
    '{a} et {b} se quittent sur un nul ({t}). Personne n\'a osé.',
    'Match nul entre {a} et {b} ({t}). Courageux.',
  ],
  bascule: [
    '{a} prend la ceinture « {e} » à {b} : {s}.',
    'Changement de propriétaire. La ceinture « {e} » passe chez {a} : {s}.',
    '{b} rend la ceinture « {e} ». {a} mène {s}.',
  ],
  premiereCeinture: [
    '{a} s\'empare de la ceinture « {e} » : {s}.',
    'La ceinture « {e} » a un premier propriétaire : {a}, {s}.',
  ],
  egalisation: [
    '{a} recolle : {s} partout sur « {e} ». La ceinture est vacante.',
    'Égalité sur « {e} », {s} partout. {b} ne tient plus rien.',
  ],
  ceinture: [
    '{a} prend la ceinture « {e} » : {s}.',
    'La ceinture « {e} » change de taille. Elle va à {a} : {s}.',
    '{b} n\'a plus la ceinture « {e} ». {a} : {s}.',
  ],
  serie: [
    '{a} enchaîne {n} victoires de suite contre {b}. Quelqu\'un intervient ?',
    '{n} de rang pour {a}. {b} cherche l\'interrupteur.',
    '{a} est injouable : {n} victoires d\'affilée.',
  ],
  general: [
    '{a} passe devant au général : {s}. {b} regarde son dos.',
    'Le Classico change de patron. {a} mène {s}.',
    '{a} reprend les commandes : {s} au général.',
  ],
  generalEgal: [
    'Égalité parfaite au général : {s}. Tout reste à faire.',
    '{s} partout au général. Personne ne peut la ramener.',
  ],
  saison: [
    '{a} remporte la saison de {m}, {s}. Gage pour {b} : {g}',
    'Saison de {m} : {a} l\'emporte {s}. {b}, c\'est pour toi : {g}',
    'Clap de fin pour {m}. {a} gagne {s}, {b} s\'exécute : {g}',
  ],
  saisonNulle: [
    'Saison de {m} partagée, {s}. Pas de gage, pas de gloire.',
  ],
  trophee: [
    '{a} décroche {n}.',
    'Nouveau trophée pour {a} : {n}.',
  ],
  accrocheVide: ['Le ring est vide. Qui ouvre le score ?'],
  accrocheEgal: [
    '{s} partout. Personne ne peut la ramener.',
    'Égalité parfaite, {s}. Il va falloir se départager.',
  ],
  accrocheMene: [
    '{a} mène {s}. {b} a du pain sur la planche.',
    '{a} est devant, {s}. {b} dit que ça ne veut rien dire.',
    '{s} pour {a}. {b} demande un recomptage.',
  ],
  accrocheEcrase: [
    '{a} mène {s}. On hésite à appeler ça un duel.',
    '{s} pour {a}. {b} a prévu de se réveiller quand ?',
  ],
  accrocheSerie: [
    '{a} reste sur {n} victoires de suite. {b} cherche la parade.',
    '{n} de rang pour {a}. Ça commence à se voir.',
  ],
} as const;

function hache(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

/** Le choix de la formulation dépend de l'identifiant : il est stable d'un calcul à l'autre. */
export function phrase(type: keyof typeof PHRASES, id: string, v: Record<string, string | number>): string {
  const liste = PHRASES[type];
  return remplir(liste[hache(id) % liste.length], v);
}

export function remplir(modele: string, v: Record<string, string | number>): string {
  return modele.replace(/\{(\w+)\}/g, (_, k) => String(v[k] ?? ''));
}

export function choisir<T>(liste: T[], graine: string): T {
  return liste[hache(graine) % liste.length];
}

const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];

/** « 2026-11 » devient « novembre 2026 ». */
export function nomMois(mois: string, avecAnnee = true): string {
  const [a, m] = mois.split('-');
  return avecAnnee ? `${MOIS[Number(m) - 1]} ${a}` : MOIS[Number(m) - 1];
}
