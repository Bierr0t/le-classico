/**
 * Modèle du Classico. Rien ici ne connaît un sport en particulier :
 * une discipline (échecs, fléchettes, ping-pong…) se branche en produisant un BilanDiscipline.
 */

export type JoueurConfig = {
  cle: string;
  nom: string;
  couleur: string;
  /** Identifiant du joueur dans chaque service : { chesscom: 'bi3rmat', bullcast: 'pierrot' }. */
  comptes: Record<string, string>;
};

/** Discipline sans code : les résultats sont saisis à la main dans saisies/{cle}.json. */
export type DisciplineManuelle = { cle: string; nom: string; emoji: string; epreuve?: string };

export type Config = {
  nom: string;
  joueurs: JoueurConfig[];
  /** Disciplines actives, dans l'ordre d'affichage. */
  disciplines: string[];
  manuelles?: DisciplineManuelle[];
  gages: string[];
  ntfy?: string;
  /** Clé publique des notifications push, créée par « npm run cles-push ». */
  push?: { clePublique: string };
  url?: string;
  depot?: string;
};

/**
 * Une épreuve met une ceinture en jeu.
 * - « mesure » : une valeur par joueur, la meilleure tient la ceinture (Elo, record…).
 * - « duel » : la ceinture va à celui qui mène aux confrontations directes de l'épreuve.
 */
export type Epreuve = {
  cle: string;
  nom: string;
  genre: 'mesure' | 'duel';
  /** Une ceinture majeure vaut 2 points au général, une mineure 1. */
  majeure: boolean;
  /** Mesure seulement. null : joueur non classé. */
  valeurs?: Record<string, number | null>;
  affichage?: Record<string, string>;
  /** 1 : le plus grand gagne. -1 : le plus petit gagne. */
  sens?: 1 | -1;
  /** Duel seulement : la règle de pondération, en une phrase, quand toutes les victoires ne se valent pas. */
  regle?: string;
  /** Pique prête à l'emploi. {a} tenant, {b} l'autre, {va} {vb} leurs valeurs, {e} l'écart. */
  pique?: string;
};

/** Une confrontation directe : une partie d'échecs, un match de fléchettes, une battle. */
export type Confrontation = {
  id: string;
  discipline: string;
  epreuve: string;
  date: number;
  joueurs: string[];
  /** null : match nul. */
  gagnant: string | null;
  /** Ce que pèse cette confrontation dans sa ceinture et dans la saison. 1 par défaut. */
  poids?: number;
  /** Ce qui s'est joué : « Bullet », « 501 », « Battle de problèmes ». */
  titre: string;
  /** Score par joueur quand il y en a un (legs, problèmes résolus). */
  score?: Record<string, number>;
  detail?: string;
  lien?: string;
};

/** Statistique comparable entre joueurs, hors ceintures : alimente la fiche et les munitions. */
export type Fait = {
  cle: string;
  nom: string;
  valeurs: Record<string, number | null>;
  affichage: Record<string, string>;
  sens: 1 | -1;
  /** Vrai pour les statistiques dont personne ne se vante (pire série, plus grosse chute). */
  honte?: boolean;
  pique?: string;
};

export type TropheeDef = { cle: string; nom: string; emoji: string; condition: string };
export type TropheeObtenu = { cle: string; date: number; lien?: string };

export type BilanDiscipline = {
  cle: string;
  nom: string;
  emoji: string;
  source?: { nom: string; lien: string };
  /** Affiché quand la collecte est partielle ou en échec. */
  avertissement?: string;
  /** Vrai si les confrontations viennent de saisies/{cle}.json. */
  saisie?: boolean;
  /** Épreuves dont les résultats se déclarent à la main : l'interface propose le formulaire. */
  saisies?: { fichier: string; nom: string }[];
  epreuves: Epreuve[];
  confrontations: Confrontation[];
  faits: Fait[];
  avatars?: Record<string, string>;
  /** Lien vers le profil de chaque joueur dans le service. */
  profils?: Record<string, string>;
  trophees?: { def: TropheeDef; obtenus: Record<string, TropheeObtenu> }[];
};

/* --- Calculé par le moteur ------------------------------------------------ */

export type Joueur = JoueurConfig & { avatar?: string; profils: { nom: string; lien: string }[] };

export type Ceinture = {
  epreuve: string;
  discipline: string;
  nom: string;
  genre: 'mesure' | 'duel';
  points: number;
  tenant: string | null;
  /** Horodatage de la prise de ceinture, quand il est connu. */
  depuis?: number;
  /** Ce que chacun affiche en face de la ceinture. */
  affichage: Record<string, string>;
  nulles?: number;
  /** Duel : nombre de victoires de chacun, quand il diffère des points affichés (épreuve pondérée). */
  victoires?: Record<string, number>;
  regle?: string;
};

export type Saison = {
  /** AAAA-MM. */
  mois: string;
  points: Record<string, number>;
  victoires: Record<string, number>;
  nulles: number;
  confrontations: number;
  parDiscipline: Record<string, Record<string, number>>;
  /** Absent tant que le mois court. null : saison partagée. */
  vainqueur?: string | null;
  gage: string;
};

export type Munition = { id: string; pour: string; texte: string; force: number; discipline?: string };

export type Duel = {
  a: string;
  b: string;
  ceintures: Ceinture[];
  score: Record<string, number>;
  bilan: { victoires: Record<string, number>; nulles: number };
  saisons: Saison[];
  palmares: Record<string, number>;
  /** Série en cours, toutes disciplines confondues. */
  serie: { joueur: string; n: number } | null;
  /** Gagnants des 12 dernières confrontations, la plus récente en dernier. null : nul. */
  forme: (string | null)[];
  munitions: Munition[];
  trophees: Record<string, TropheeObtenu[]>;
  /** La phrase d'accroche du moment. */
  accroche: string;
};

export type TypeEvenement =
  | 'confrontation' | 'bascule' | 'serie' | 'ceinture' | 'general' | 'saison' | 'trophee';

export type Evenement = {
  id: string;
  type: TypeEvenement;
  date: number;
  discipline?: string;
  joueurs: string[];
  texte: string;
  lien?: string;
  notif: boolean;
};

export type Instantane = {
  genereLe: number;
  nom: string;
  url?: string;
  depot?: string;
  ntfy?: string;
  /** Présent quand les notifications push sont configurées. sujet : la boîte aux lettres des abonnements. */
  push?: { clePublique: string; sujet: string };
  joueurs: Joueur[];
  disciplines: BilanDiscipline[];
  duels: Duel[];
  actu: Evenement[];
  trophees: TropheeDef[];
};
