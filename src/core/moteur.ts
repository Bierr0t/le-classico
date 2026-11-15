/**
 * Le moteur : transforme les bilans des disciplines en un instantané du Classico.
 * Il ne connaît aucun sport. Il raisonne par paire de joueurs : le produit est pensé
 * pour un face-à-face, mais rien n'empêche d'inscrire un troisième joueur.
 */
import { JOUR, paris, tsParis } from './temps.ts';
import { TROPHEES, choisir, nomMois, phrase, remplir } from './textes.ts';
import type {
  BilanDiscipline, Ceinture, Config, Confrontation, Duel, Evenement, Instantane, Joueur,
  Munition, Saison, TropheeDef, TropheeObtenu,
} from './types.ts';

export const POINTS = { victoire: 3, nul: 1, majeure: 2, mineure: 1 } as const;
const PALIERS_SERIE = [3, 5, 7, 10, 15, 20];
const MAX_ACTU = 150;

const moisDe = (ts: number) => paris(ts).jour.slice(0, 7);
const moisSuivant = (mois: string) => {
  const [a, m] = mois.split('-').map(Number);
  return m === 12 ? `${a + 1}-01` : `${a}-${String(m + 1).padStart(2, '0')}`;
};

type Noms = (cle: string) => string;

/** Tenant d'une épreuve « mesure » : la meilleure valeur. Un joueur non classé ne tient rien. */
function meilleur(a: string, b: string, valeurs: Record<string, number | null>, sens: 1 | -1): string | null {
  const va = valeurs[a] ?? null;
  const vb = valeurs[b] ?? null;
  if (va === null && vb === null) return null;
  if (vb === null) return a;
  if (va === null) return b;
  if (va === vb) return null;
  return (va - vb) * sens > 0 ? a : b;
}

function ceinturesDe(
  a: string, b: string, bilans: BilanDiscipline[], confs: Confrontation[],
  precedent: Duel | undefined, maintenant: number,
): Ceinture[] {
  const liste: Ceinture[] = [];
  for (const d of bilans) {
    for (const e of d.epreuves) {
      const base = { epreuve: e.cle, discipline: d.cle, nom: e.nom, genre: e.genre, points: e.majeure ? POINTS.majeure : POINTS.mineure };
      if (e.genre === 'mesure') {
        const tenant = meilleur(a, b, e.valeurs ?? {}, e.sens ?? 1);
        const avant = precedent?.ceintures.find((c) => c.epreuve === e.cle);
        const depuis = tenant === null ? undefined : avant ? (avant.tenant === tenant ? avant.depuis : maintenant) : undefined;
        liste.push({ ...base, tenant, depuis, affichage: { [a]: e.affichage?.[a] ?? '—', [b]: e.affichage?.[b] ?? '—' } });
      } else {
        // v : points pondérés, ce sont eux qui désignent le tenant. n : victoires brutes.
        const v = { [a]: 0, [b]: 0 };
        const n = { [a]: 0, [b]: 0 };
        let nulles = 0;
        let tenant: string | null = null;
        let depuis: number | undefined;
        let pondere = false;
        for (const c of confs) {
          if (c.epreuve !== e.cle) continue;
          if ((c.poids ?? 1) !== 1) pondere = true;
          if (c.gagnant) { v[c.gagnant] += c.poids ?? 1; n[c.gagnant]++; } else nulles++;
          const meneur = v[a] === v[b] ? null : v[a] > v[b] ? a : b;
          if (meneur !== tenant) { tenant = meneur; depuis = meneur ? c.date : undefined; }
        }
        liste.push({
          ...base, tenant, depuis, affichage: { [a]: String(v[a]), [b]: String(v[b]) }, nulles,
          ...(pondere ? { victoires: n } : {}), ...(e.regle ? { regle: e.regle } : {}),
        });
      }
    }
  }
  return liste;
}

function saisonsDe(a: string, b: string, confs: Confrontation[], gages: string[], maintenant: number): Saison[] {
  const courant = moisDe(maintenant);
  const parMois = new Map<string, Confrontation[]>();
  for (const c of confs) {
    const m = moisDe(c.date);
    if (!parMois.has(m)) parMois.set(m, []);
    parMois.get(m)!.push(c);
  }
  if (!parMois.has(courant)) parMois.set(courant, []);
  const saisons: Saison[] = [];
  for (const [mois, liste] of parMois) {
    const s: Saison = {
      mois, points: { [a]: 0, [b]: 0 }, victoires: { [a]: 0, [b]: 0 }, nulles: 0,
      confrontations: liste.length, parDiscipline: {},
      gage: gages.length ? choisir(gages, `gage:${a}:${b}:${mois}`) : '',
    };
    for (const c of liste) {
      const d = (s.parDiscipline[c.discipline] ??= { [a]: 0, [b]: 0 });
      const poids = c.poids ?? 1;
      if (c.gagnant) {
        s.points[c.gagnant] += POINTS.victoire * poids;
        s.victoires[c.gagnant]++;
        d[c.gagnant]++;
      } else {
        s.points[a] += POINTS.nul * poids;
        s.points[b] += POINTS.nul * poids;
        s.nulles++;
      }
    }
    if (mois < courant) s.vainqueur = s.points[a] === s.points[b] ? null : s.points[a] > s.points[b] ? a : b;
    saisons.push(s);
  }
  return saisons.sort((x, y) => (x.mois < y.mois ? 1 : -1));
}

/** Séries de victoires, toutes disciplines confondues. Un nul remet à zéro. */
function* series(confs: Confrontation[]): Generator<{ c: Confrontation; joueur: string | null; n: number; cassee: { joueur: string; n: number } | null }> {
  let joueur: string | null = null;
  let n = 0;
  for (const c of confs) {
    const cassee: { joueur: string; n: number } | null = joueur && c.gagnant !== joueur ? { joueur, n } : null;
    if (c.gagnant === null) { joueur = null; n = 0; }
    else if (c.gagnant === joueur) n++;
    else { joueur = c.gagnant; n = 1; }
    yield { c, joueur, n, cassee };
  }
}

function tropheesDe(
  a: string, b: string, confs: Confrontation[], saisons: Saison[], ceintures: Ceinture[],
  bilans: BilanDiscipline[], precedent: Duel | undefined, maintenant: number,
): Record<string, TropheeObtenu[]> {
  const obtenus: Record<string, Map<string, TropheeObtenu>> = { [a]: new Map(), [b]: new Map() };
  const donner = (joueur: string, cle: string, date: number, lien?: string) => {
    if (!obtenus[joueur].has(cle)) obtenus[joueur].set(cle, { cle, date, ...(lien ? { lien } : {}) });
  };

  const premiere = confs.find((c) => c.gagnant);
  if (premiere?.gagnant) donner(premiere.gagnant, 'premierSang', premiere.date, premiere.lien);

  const victoires = { [a]: 0, [b]: 0 };
  for (const { c, joueur, n, cassee } of series(confs)) {
    if (c.gagnant) {
      victoires[c.gagnant]++;
      if (victoires[c.gagnant] === 50) donner(c.gagnant, 'cinquante', c.date, c.lien);
      if (cassee && cassee.n >= 5) donner(c.gagnant, 'briseur', c.date, c.lien);
    }
    if (joueur) for (const palier of [3, 5, 10]) if (n === palier) donner(joueur, `serie${palier}`, c.date, c.lien);
  }

  const disciplinesJouees = new Set(confs.map((c) => c.discipline));
  let suite: { joueur: string | null; n: number } = { joueur: null, n: 0 };
  for (const s of [...saisons].reverse()) {
    const fin = tsParis(`${moisSuivant(s.mois)}-01`, 0);
    // Le couteau suisse se gagne en cours de mois : pas besoin d'attendre la clôture.
    if (disciplinesJouees.size >= 2) {
      for (const j of [a, b]) {
        if ([...disciplinesJouees].every((d) => (s.parDiscipline[d]?.[j] ?? 0) > 0)) donner(j, 'couteauSuisse', Math.min(fin, maintenant));
      }
    }
    if (s.vainqueur === undefined || s.confrontations === 0) continue;
    if (s.vainqueur === null) { suite = { joueur: null, n: 0 }; continue; }
    const perdant = s.vainqueur === a ? b : a;
    donner(s.vainqueur, 'saison', fin);
    suite = suite.joueur === s.vainqueur ? { joueur: s.vainqueur, n: suite.n + 1 } : { joueur: s.vainqueur, n: 1 };
    if (suite.n === 3) donner(s.vainqueur, 'triple', fin);
    if (s.points[perdant] === 0 && s.confrontations >= 3) donner(s.vainqueur, 'fanny', fin);
    if (s.points[s.vainqueur] - s.points[perdant] <= 3 && s.confrontations >= 5) donner(s.vainqueur, 'holdup', fin);
  }

  const tenants = new Set(ceintures.map((c) => c.tenant));
  if (ceintures.length >= 2 && tenants.size === 1) {
    const [seul] = tenants;
    if (seul) donner(seul, 'grandChelem', maintenant);
  }

  for (const d of bilans) {
    for (const t of d.trophees ?? []) {
      for (const j of [a, b]) if (t.obtenus[j]) donner(j, t.def.cle, t.obtenus[j].date, t.obtenus[j].lien);
    }
  }

  // Un trophée est acquis pour de bon : ceux qui dépendent de l'état du moment sont repris du passage précédent.
  const resultat: Record<string, TropheeObtenu[]> = {};
  for (const j of [a, b]) {
    for (const t of precedent?.trophees[j] ?? []) {
      const actuel = obtenus[j].get(t.cle);
      if (!actuel || t.date < actuel.date) obtenus[j].set(t.cle, t);
    }
    resultat[j] = [...obtenus[j].values()].sort((x, y) => x.date - y.date);
  }
  return resultat;
}

function munitionsDe(
  a: string, b: string, nom: Noms, bilans: BilanDiscipline[], confs: Confrontation[],
  ceintures: Ceinture[], score: Record<string, number>, saisons: Saison[], palmares: Record<string, number>,
  serie: Duel['serie'], maintenant: number,
): Munition[] {
  const liste: Munition[] = [];
  const ajouter = (pour: string, id: string, texte: string, force: number, discipline?: string) =>
    liste.push({ id: `${pour}:${id}`, pour, texte, force, ...(discipline ? { discipline } : {}) });
  const epreuves = new Map(bilans.flatMap((d) => d.epreuves.map((e) => [e.cle, e] as const)));
  const nomDiscipline = new Map(bilans.map((d) => [d.cle, d.nom.toLowerCase()]));

  for (const [p, o] of [[a, b], [b, a]]) {
    const P = nom(p);
    const O = nom(o);

    if (score[p] > score[o]) {
      ajouter(p, 'general', `Au général, ${P} mène ${score[p]}-${score[o]}. Le reste, c'est de la littérature.`, 100);
    }

    for (const c of ceintures) {
      if (c.tenant !== p) continue;
      const e = epreuves.get(c.epreuve);
      if (c.genre === 'duel') {
        const vp = Number(c.affichage[p]);
        const vo = Number(c.affichage[o]);
        const texte = vo === 0
          ? `${c.nom} : ${P} ${vp}, ${O} 0. Zéro. Le chiffre rond.`
          : `${c.nom} : ${P} mène ${vp}-${vo}. Les chiffres ne mentent pas.`;
        ajouter(p, `ceinture:${c.epreuve}`, texte, 70 + Math.min(20, (vp - vo) * 2), c.discipline);
      } else {
        const vp = e?.valeurs?.[p] ?? null;
        const vo = e?.valeurs?.[o] ?? null;
        const v = { a: P, b: O, va: c.affichage[p], vb: c.affichage[o], e: vp !== null && vo !== null ? Math.abs(vp - vo) : '' };
        const texte = vo === null
          ? `${c.nom} : ${P} ${c.affichage[p]}. ${O} n'est même pas classé.`
          : remplir(e?.pique ?? '{e2} : {a} {va}, {b} {vb}.', { ...v, e2: c.nom });
        ajouter(p, `ceinture:${c.epreuve}`, texte, 60, c.discipline);
      }
    }

    if (serie?.joueur === p && serie.n >= 2) {
      ajouter(p, 'serie', `${P} reste sur ${serie.n} victoires de suite. ${O} cherche encore la parade.`, 75 + Math.min(20, serie.n));
    }

    const derniere = confs.at(-1);
    if (derniere?.gagnant === p) {
      ajouter(p, 'derniere', `Le dernier duel en date ? ${derniere.titre}, ${nomDiscipline.get(derniere.discipline) ?? ''}. Victoire de ${P}.`, 50, derniere.discipline);
    }

    const victoiresP = confs.filter((c) => c.gagnant === p);
    const derniereO = confs.findLast((c) => c.gagnant === o);
    if (victoiresP.length && !derniereO) {
      ajouter(p, 'jamais', `${O} n'a encore jamais gagné un duel. Jamais.`, 95);
    } else if (derniereO && victoiresP.some((c) => c.date > derniereO.date)) {
      const jours = Math.floor((maintenant - derniereO.date) / JOUR);
      if (jours >= 14) ajouter(p, 'disette', `${O} n'a plus gagné un duel depuis ${jours} jours.`, 55 + Math.min(30, jours / 4));
    }

    if (palmares[p] > palmares[o]) {
      const s = (n: number) => `${n} saison${n > 1 ? 's' : ''}`;
      ajouter(p, 'palmares', `Au palmarès : ${s(palmares[p])} pour ${P}, ${palmares[o] === 0 ? 'aucune' : palmares[o]} pour ${O}.`, 80);
    }
    const courante = saisons[0];
    if (courante && courante.points[p] > courante.points[o]) {
      const gage = courante.gage ? ` Le gage approche pour ${O} : ${courante.gage}` : '';
      ajouter(p, 'saison', `Ce mois-ci, ${P} mène ${courante.points[p]}-${courante.points[o]}.${gage}`, 65);
    }
    const precedente = saisons.find((s) => s.vainqueur === p);
    if (precedente && precedente === saisons.find((s) => s.vainqueur !== undefined && s.confrontations > 0) && precedente.gage) {
      ajouter(p, 'gage', `${O} doit toujours son gage de ${nomMois(precedente.mois, false)} : ${precedente.gage}`, 68);
    }

    for (const d of bilans) {
      for (const f of d.faits) {
        if (meilleur(p, o, f.valeurs, f.sens) !== p || f.valeurs[o] == null) continue;
        const v = { a: P, b: O, va: f.affichage[p], vb: f.affichage[o], e: Math.abs((f.valeurs[p] ?? 0) - (f.valeurs[o] ?? 0)) };
        ajouter(p, `fait:${f.cle}`, remplir(f.pique ?? `${f.nom} : {a} {va}, {b} {vb}.`, v), f.honte ? 45 : 35, d.cle);
      }
    }
  }
  return liste.sort((x, y) => y.force - x.force);
}

function accrocheDe(a: string, b: string, nom: Noms, score: Record<string, number>, serie: Duel['serie'], confs: number, graine: string): string {
  if (!confs && !score[a] && !score[b]) return phrase('accrocheVide', graine, {});
  if (serie && serie.n >= 3) {
    return phrase('accrocheSerie', graine, { a: nom(serie.joueur), b: nom(serie.joueur === a ? b : a), n: serie.n });
  }
  if (score[a] === score[b]) return phrase('accrocheEgal', graine, { s: score[a] });
  const [p, o] = score[a] > score[b] ? [a, b] : [b, a];
  const type = score[p] >= 2 * Math.max(1, score[o]) && score[p] - score[o] >= 3 ? 'accrocheEcrase' : 'accrocheMene';
  return phrase(type, graine, { a: nom(p), b: nom(o), s: `${score[p]}-${score[o]}` });
}

/** Événements qui se déduisent de l'historique : recalculés à l'identique à chaque passage. */
function evenementsHistoire(
  a: string, b: string, nom: Noms, bilans: BilanDiscipline[], confs: Confrontation[],
  saisons: Saison[], trophees: Record<string, TropheeObtenu[]>, defs: TropheeDef[],
): Evenement[] {
  const actu: Evenement[] = [];
  const epreuves = new Map(bilans.flatMap((d) => d.epreuves.map((e) => [e.cle, e] as const)));
  const compteurs = new Map<string, { v: Record<string, number>; meneur: string | null; joues: number }>();
  const autre = (j: string) => (j === a ? b : a);

  for (const { c, joueur, n } of series(confs)) {
    const cpt = compteurs.get(c.epreuve) ?? { v: { [a]: 0, [b]: 0 }, meneur: null, joues: 0 };
    compteurs.set(c.epreuve, cpt);
    if (c.gagnant) { cpt.v[c.gagnant] += c.poids ?? 1; cpt.joues++; }
    const base = { date: c.date, discipline: c.discipline, joueurs: [a, b], lien: c.lien };

    if (c.gagnant) {
      const p = c.gagnant;
      const o = autre(p);
      actu.push({
        ...base, id: `c:${c.id}`, type: 'confrontation', notif: true,
        texte: phrase('victoire', c.id, { a: nom(p), b: nom(o), t: c.titre, s: `${cpt.v[p]}-${cpt.v[o]}` }),
      });
      const meneur = cpt.v[a] === cpt.v[b] ? null : cpt.v[a] > cpt.v[b] ? a : b;
      const e = epreuves.get(c.epreuve)?.nom ?? c.titre;
      if (meneur !== cpt.meneur && cpt.joues > 1) {
        const type = meneur === null ? 'egalisation' : cpt.meneur === null ? 'premiereCeinture' : 'bascule';
        actu.push({
          ...base, id: `b:${c.id}`, type: 'bascule', date: c.date + 1, notif: true,
          texte: phrase(type, c.id, { a: nom(p), b: nom(o), e, s: meneur === null ? cpt.v[p] : `${cpt.v[p]}-${cpt.v[o]}` }),
        });
      }
      cpt.meneur = meneur;
      if (joueur === p && PALIERS_SERIE.includes(n)) {
        actu.push({
          ...base, id: `r:${c.id}`, type: 'serie', date: c.date + 2, discipline: undefined, notif: n >= 5,
          texte: phrase('serie', c.id, { a: nom(p), b: nom(o), n }),
        });
      }
    } else {
      actu.push({
        ...base, id: `c:${c.id}`, type: 'confrontation', notif: true,
        texte: phrase('nul', c.id, { a: nom(a), b: nom(b), t: c.titre }),
      });
    }
  }

  for (const s of saisons) {
    if (s.vainqueur === undefined || s.confrontations === 0) continue;
    const id = `s:${a}:${b}:${s.mois}`;
    const date = tsParis(`${moisSuivant(s.mois)}-01`, 8);
    const m = nomMois(s.mois);
    if (s.vainqueur === null) {
      actu.push({ id, type: 'saison', date, joueurs: [a, b], notif: true, texte: phrase('saisonNulle', id, { m, s: `${s.points[a]}-${s.points[b]}` }) });
    } else {
      const p = s.vainqueur;
      const o = autre(p);
      actu.push({
        id, type: 'saison', date, joueurs: [a, b], notif: true,
        texte: phrase('saison', id, { a: nom(p), b: nom(o), m, s: `${s.points[p]}-${s.points[o]}`, g: s.gage || 'la honte suffira.' }),
      });
    }
  }

  const nomTrophee = new Map(defs.map((d) => [d.cle, `${d.emoji} ${d.nom}`]));
  for (const j of [a, b]) {
    for (const t of trophees[j]) {
      const id = `t:${j}:${autre(j)}:${t.cle}`;
      actu.push({ id, type: 'trophee', date: t.date + 3, joueurs: [j], lien: t.lien, notif: false, texte: phrase('trophee', id, { a: nom(j), n: nomTrophee.get(t.cle) ?? t.cle }) });
    }
  }
  return actu;
}

/** Événements qui naissent d'un changement entre deux passages : ils sont conservés d'un instantané à l'autre. */
function evenementsBascule(duel: Duel, avant: Duel, nom: Noms, maintenant: number): Evenement[] {
  const { a, b } = duel;
  const actu: Evenement[] = [];
  for (const c of duel.ceintures) {
    if (c.genre !== 'mesure' || !c.tenant) continue;
    const ancienne = avant.ceintures.find((x) => x.epreuve === c.epreuve);
    if (!ancienne || ancienne.tenant === c.tenant) continue;
    const o = c.tenant === a ? b : a;
    const id = `x:m:${c.epreuve}:${maintenant}`;
    actu.push({
      id, type: 'ceinture', date: maintenant, discipline: c.discipline, joueurs: [a, b], notif: true,
      texte: phrase('ceinture', id, { a: nom(c.tenant), b: nom(o), e: c.nom, s: `${c.affichage[c.tenant]} contre ${c.affichage[o]}` }),
    });
  }
  const meneur = (d: Duel) => (d.score[a] === d.score[b] ? null : d.score[a] > d.score[b] ? a : b);
  const m = meneur(duel);
  if (m !== meneur(avant)) {
    const id = `x:g:${a}:${b}:${maintenant}`;
    const texte = m === null
      ? phrase('generalEgal', id, { s: duel.score[a] })
      : phrase('general', id, { a: nom(m), b: nom(m === a ? b : a), s: `${duel.score[m]}-${duel.score[m === a ? b : a]}` });
    actu.push({ id, type: 'general', date: maintenant + 1, joueurs: [a, b], notif: true, texte });
  }
  return actu;
}

export function calculer(config: Config, bilans: BilanDiscipline[], maintenant: number, precedent: Instantane | null): Instantane {
  const noms = new Map(config.joueurs.map((j) => [j.cle, j.nom]));
  const nom: Noms = (cle) => noms.get(cle) ?? cle;
  const defs: TropheeDef[] = [...TROPHEES, ...bilans.flatMap((d) => (d.trophees ?? []).map((t) => t.def))];

  const joueurs: Joueur[] = config.joueurs.map((j) => ({
    ...j,
    avatar: bilans.map((d) => d.avatars?.[j.cle]).find(Boolean),
    profils: bilans.filter((d) => d.profils?.[j.cle]).map((d) => ({ nom: d.source?.nom ?? d.nom, lien: d.profils![j.cle] })),
  }));

  const duels: Duel[] = [];
  let actu: Evenement[] = (precedent?.actu ?? []).filter((e) => e.id.startsWith('x:'));

  for (let i = 0; i < config.joueurs.length; i++) {
    for (let k = i + 1; k < config.joueurs.length; k++) {
      const a = config.joueurs[i].cle;
      const b = config.joueurs[k].cle;
      const confs = bilans
        .flatMap((d) => d.confrontations)
        .filter((c) => c.joueurs.length === 2 && c.joueurs.includes(a) && c.joueurs.includes(b))
        .sort((x, y) => x.date - y.date || (x.id < y.id ? -1 : 1));
      const avant = precedent?.duels.find((d) => d.a === a && d.b === b);

      const ceintures = ceinturesDe(a, b, bilans, confs, avant, maintenant);
      const score = { [a]: 0, [b]: 0 };
      for (const c of ceintures) if (c.tenant) score[c.tenant] += c.points;

      const bilan = { victoires: { [a]: 0, [b]: 0 }, nulles: 0 };
      for (const c of confs) { if (c.gagnant) bilan.victoires[c.gagnant]++; else bilan.nulles++; }

      const saisons = saisonsDe(a, b, confs, config.gages, maintenant);
      const palmares = { [a]: 0, [b]: 0 };
      for (const s of saisons) if (s.vainqueur && s.confrontations) palmares[s.vainqueur]++;

      let serie: Duel['serie'] = null;
      for (const s of series(confs)) serie = s.joueur ? { joueur: s.joueur, n: s.n } : null;

      const trophees = tropheesDe(a, b, confs, saisons, ceintures, bilans, avant, maintenant);
      const duel: Duel = {
        a, b, ceintures, score, bilan, saisons, palmares, serie,
        forme: confs.slice(-12).map((c) => c.gagnant),
        munitions: munitionsDe(a, b, nom, bilans, confs, ceintures, score, saisons, palmares, serie, maintenant),
        trophees,
        accroche: accrocheDe(a, b, nom, score, serie, confs.length, `${a}:${b}:${paris(maintenant).jour}`),
      };
      duels.push(duel);

      actu.push(...evenementsHistoire(a, b, nom, bilans, confs, saisons, trophees, defs));
      if (avant) actu.push(...evenementsBascule(duel, avant, nom, maintenant));
    }
  }

  const vus = new Set<string>();
  actu = actu
    .filter((e) => (vus.has(e.id) ? false : (vus.add(e.id), true)))
    .sort((x, y) => y.date - x.date)
    .slice(0, MAX_ACTU);

  return {
    genereLe: maintenant, nom: config.nom, url: config.url, depot: config.depot, ntfy: config.ntfy,
    joueurs, disciplines: bilans, duels, actu, trophees: defs,
  };
}
