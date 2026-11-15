import { describe, expect, it } from 'vitest';
import { construire, lireFormulaire } from '../../scripts/resultat.ts';
import { confrontationsSaisies } from './disciplines/contrat.ts';
import { calculerEchecs } from './disciplines/echecs/calcul.ts';
import type { Partie } from './disciplines/echecs/chesscom.ts';
import { calculerFlechettes, type PartieFlechettes } from './disciplines/flechettes/calcul.ts';
import { compacter } from './disciplines/flechettes/collecte.ts';
import { disciplineManuelle } from './disciplines/manuelle.ts';
import { calculer } from './moteur.ts';
import { tsParis } from './temps.ts';
import type { BilanDiscipline, Config, Confrontation } from './types.ts';

const config: Config = {
  nom: 'Le Classico',
  joueurs: [
    { cle: 'pierrot', nom: 'Pierrot', couleur: '#f00', comptes: { chesscom: 'bi3rmat', bullcast: 'pierrot' } },
    { cle: 'fabos', nom: 'Fabos', couleur: '#00f', comptes: { chesscom: 'fabosinho', bullcast: 'fabos' } },
  ],
  disciplines: ['test'],
  gages: ['Tu paies la tournée.'],
};

const MAINTENANT = tsParis('2026-11-15', 12);
let n = 0;
const duel = (jour: string, gagnant: string | null, discipline = 'test'): Confrontation => ({
  id: `d${n++}`, discipline, epreuve: `${discipline}.duel`, date: tsParis(jour, 20) + n,
  joueurs: ['pierrot', 'fabos'], gagnant, titre: 'Partie',
});
const bilan = (confrontations: Confrontation[], mesure?: Record<string, number | null>): BilanDiscipline => ({
  cle: 'test', nom: 'Test', emoji: '🧪', faits: [], confrontations,
  epreuves: [
    { cle: 'test.duel', nom: 'Face-à-face', genre: 'duel', majeure: true },
    ...(mesure ? [{
      cle: 'test.elo', nom: 'Elo', genre: 'mesure' as const, majeure: false, sens: 1 as const, valeurs: mesure,
      affichage: Object.fromEntries(Object.entries(mesure).map(([k, v]) => [k, String(v ?? '—')])),
    }] : []),
  ],
});

describe('moteur', () => {
  it('attribue les ceintures et le score général', () => {
    const inst = calculer(config, [bilan([duel('2026-11-01', 'pierrot'), duel('2026-11-02', 'pierrot'), duel('2026-11-03', 'fabos')], { pierrot: 1500, fabos: 1600 })], MAINTENANT, null);
    const d = inst.duels[0];
    expect(d.ceintures.map((c) => c.tenant)).toEqual(['pierrot', 'fabos']);
    expect(d.score).toEqual({ pierrot: 2, fabos: 1 });
    expect(d.ceintures[0].affichage).toEqual({ pierrot: '2', fabos: '1' });
    expect(d.serie).toEqual({ joueur: 'fabos', n: 1 });
  });

  it('laisse la ceinture vacante à égalité et ne la donne pas à un joueur non classé', () => {
    const d = calculer(config, [bilan([duel('2026-11-01', 'pierrot'), duel('2026-11-02', 'fabos')], { pierrot: null, fabos: null })], MAINTENANT, null).duels[0];
    expect(d.ceintures.map((c) => c.tenant)).toEqual([null, null]);
    expect(d.score).toEqual({ pierrot: 0, fabos: 0 });
    const seul = calculer(config, [bilan([], { pierrot: 1200, fabos: null })], MAINTENANT, null).duels[0];
    expect(seul.ceintures[1].tenant).toBe('pierrot');
  });

  it('compte une saison par mois : 3 points la victoire, 1 le nul', () => {
    const d = calculer(config, [bilan([
      duel('2026-10-05', 'fabos'), duel('2026-10-06', null), duel('2026-10-07', 'fabos'),
      duel('2026-11-02', 'pierrot'),
    ])], MAINTENANT, null).duels[0];
    const [novembre, octobre] = d.saisons;
    expect(novembre).toMatchObject({ mois: '2026-11', points: { pierrot: 3, fabos: 0 } });
    expect(novembre.vainqueur).toBeUndefined();
    expect(octobre).toMatchObject({ mois: '2026-10', points: { pierrot: 1, fabos: 7 }, vainqueur: 'fabos', nulles: 1 });
    expect(d.palmares).toEqual({ pierrot: 0, fabos: 1 });
    expect(d.trophees.fabos.map((t) => t.cle)).toContain('saison');
    expect(d.trophees.fabos.map((t) => t.cle)).toContain('premierSang');
  });

  it('garde la saison en cours même sans duel', () => {
    const d = calculer(config, [bilan([duel('2026-09-05', 'fabos')])], MAINTENANT, null).duels[0];
    expect(d.saisons[0]).toMatchObject({ mois: '2026-11', confrontations: 0 });
  });

  it('décerne les trophées de série et le briseur de série', () => {
    const confs = [1, 2, 3, 4, 5].map((j) => duel(`2026-11-0${j}`, 'fabos'));
    confs.push(duel('2026-11-06', 'pierrot'));
    const d = calculer(config, [bilan(confs)], MAINTENANT, null).duels[0];
    expect(d.trophees.fabos.map((t) => t.cle)).toEqual(expect.arrayContaining(['serie3', 'serie5']));
    expect(d.trophees.pierrot.map((t) => t.cle)).toContain('briseur');
  });

  it('raconte les bascules de ceinture dans le fil', () => {
    const inst = calculer(config, [bilan([duel('2026-11-01', 'pierrot'), duel('2026-11-02', 'fabos'), duel('2026-11-03', 'fabos')])], MAINTENANT, null);
    const bascules = inst.actu.filter((e) => e.type === 'bascule');
    expect(bascules).toHaveLength(2);
    expect(bascules[1].texte).toContain('partout');
    expect(bascules[0].texte).toContain('Fabos');
    expect(inst.actu[0].date).toBeGreaterThanOrEqual(inst.actu.at(-1)!.date);
  });

  it('signale un changement de ceinture « mesure » et de meneur entre deux passages, puis le conserve', () => {
    const avant = calculer(config, [bilan([], { pierrot: 1500, fabos: 1600 })], MAINTENANT - 3600, null);
    expect(avant.actu).toHaveLength(0);
    const apres = calculer(config, [bilan([], { pierrot: 1650, fabos: 1600 })], MAINTENANT, avant);
    expect(apres.actu.map((e) => e.type).sort()).toEqual(['ceinture', 'general']);
    expect(apres.duels[0].ceintures[1].depuis).toBe(MAINTENANT);
    const suivant = calculer(config, [bilan([], { pierrot: 1650, fabos: 1600 })], MAINTENANT + 3600, apres);
    expect(suivant.actu.map((e) => e.id)).toEqual(apres.actu.map((e) => e.id));
    expect(suivant.duels[0].ceintures[1].depuis).toBe(MAINTENANT);
  });

  it('fournit des munitions à celui qui mène, pas à l\'autre', () => {
    const d = calculer(config, [bilan([duel('2026-11-01', 'fabos'), duel('2026-11-02', 'fabos')], { pierrot: 1500, fabos: 1600 })], MAINTENANT, null).duels[0];
    expect(d.munitions.every((m) => m.pour === 'fabos')).toBe(true);
    expect(d.munitions[0].texte).toContain('Au général');
    expect(d.munitions.some((m) => m.texte.includes('jamais gagné'))).toBe(true);
  });

  it('calcule un duel par paire quand un troisième joueur s\'inscrit', () => {
    const trois: Config = { ...config, joueurs: [...config.joueurs, { cle: 'tito', nom: 'Tito', couleur: '#0f0', comptes: {} }] };
    const inst = calculer(trois, [bilan([duel('2026-11-01', 'fabos')])], MAINTENANT, null);
    expect(inst.duels.map((d) => `${d.a}-${d.b}`)).toEqual(['pierrot-fabos', 'pierrot-tito', 'fabos-tito']);
    expect(inst.duels[1].bilan.victoires).toEqual({ pierrot: 0, tito: 0 });
  });
});

describe('pondération', () => {
  it('fait peser une victoire selon son poids, dans la ceinture comme dans la saison', () => {
    const rapide = { ...duel('2026-11-01', 'pierrot'), poids: 3 };
    const d = calculer(config, [bilan([rapide, duel('2026-11-02', 'fabos'), duel('2026-11-03', 'fabos')])], MAINTENANT, null).duels[0];
    expect(d.ceintures[0]).toMatchObject({ tenant: 'pierrot', affichage: { pierrot: '3', fabos: '2' }, victoires: { pierrot: 1, fabos: 2 } });
    expect(d.saisons[0].points).toEqual({ pierrot: 9, fabos: 6 });
    expect(d.bilan.victoires).toEqual({ pierrot: 1, fabos: 2 });
  });
});

describe('saisies manuelles', () => {
  it('transforme les saisies en confrontations, dans l\'ordre de la journée', () => {
    const c = confrontationsSaisies([
      { date: '2026-11-10', gagnant: 'pierrot', score: { pierrot: 12, fabos: 9 } },
      { date: '2026-11-10', gagnant: null },
      { date: 'hier', gagnant: 'fabos' },
      { date: '2026-11-11', gagnant: 'inconnu' },
    ], config, 'echecs', 'echecs.battle', 'Battle');
    expect(c).toHaveLength(2);
    expect(c[0]).toMatchObject({ gagnant: 'pierrot', score: { pierrot: 12, fabos: 9 } });
    expect(c[1].date).toBeGreaterThan(c[0].date);
  });

  it('branche une discipline sans code', () => {
    const d = disciplineManuelle({ cle: 'pingpong', nom: 'Ping-pong', emoji: '🏓' });
    const b = d.calculer([{ date: '2026-11-10', gagnant: 'fabos' }], config, MAINTENANT);
    const inst = calculer(config, [b], MAINTENANT, null);
    expect(inst.duels[0].score).toEqual({ pierrot: 0, fabos: 2 });
  });

  it('valide ce qui est saisi', () => {
    const j = '2026-11-15';
    expect(construire(config, 'echecs-battle', 'Pierrot', '12-9', '', '', j)).toEqual({ date: j, gagnant: 'pierrot', score: { pierrot: 12, fabos: 9 } });
    expect(construire(config, 'echecs-battle', 'nul', '10 - 10', '2026-11-01', ' revanche ', j)).toEqual({ date: '2026-11-01', gagnant: null, score: { pierrot: 10, fabos: 10 }, note: 'revanche' });
    expect(() => construire(config, 'echecs-battle', 'fabos', '12-9', '', '', j)).toThrow(/ne correspond pas/);
    expect(() => construire(config, 'echecs-battle', 'tito', '', '', '', j)).toThrow(/Gagnant inconnu/);
    expect(() => construire(config, '../classico', 'fabos', '', '', '', j)).toThrow(/Discipline inconnue/);
    expect(() => construire(config, 'echecs-battle', 'fabos', '', '2027-01-01', '', j)).toThrow(/futur/);
  });

  it('lit un formulaire d\'issue GitHub', () => {
    const f = lireFormulaire('### Discipline\n\nechecs-battle\n\n### Gagnant\n\nfabos\n\n### Score\n\n_No response_\n');
    expect(f).toEqual({ discipline: 'echecs-battle', gagnant: 'fabos', score: '' });
  });
});

describe('échecs', () => {
  const partie = (id: string, fin: number, blancs: string, noirs: string, resultat: Partie['resultat'], coups = 30): Partie => ({
    id, fin, cadence: 'blitz', classee: true, resultat, issue: resultat === 'nulle' ? 'pat' : 'mat', coups,
    blancs: { pseudo: blancs, elo: 1000 }, noirs: { pseudo: noirs, elo: 1000 },
  });

  it('ne compte qu\'une fois une partie présente dans les deux archives', () => {
    const commune = partie('g1', 100, 'bi3rmat', 'fabosinho', 'noirs', 12);
    const b = calculerEchecs({
      sources: [
        { cle: 'pierrot', pseudo: 'bi3rmat', profil: {}, stats: { chess_blitz: { last: { rating: 1141 } }, puzzle_rush: { best: { score: 7, total_attempts: 10 } } }, parties: [commune, partie('g2', 200, 'bi3rmat', 'inconnu', 'blancs')] },
        { cle: 'fabos', pseudo: 'fabosinho', profil: {}, stats: { chess_blitz: { last: { rating: 1090 } }, puzzle_rush: { best: { score: 44, total_attempts: 47 } } }, parties: [commune] },
      ],
      battles: [{ date: '2026-11-10', gagnant: 'pierrot' }],
    }, config);
    expect(b.confrontations.map((c) => c.epreuve)).toEqual(['echecs.duel', 'echecs.battle']);
    expect(b.confrontations[0]).toMatchObject({ gagnant: 'fabos', titre: 'Blitz', poids: 2, detail: 'par mat en 12 coups' });
    expect(b.trophees![0].obtenus.fabos).toBeDefined();
    const d = calculer(config, [b], MAINTENANT, null).duels[0];
    const tenant = (cle: string) => d.ceintures.find((c) => c.epreuve === cle)!.tenant;
    expect(tenant('echecs.blitz')).toBe('pierrot');
    expect(tenant('echecs.rush')).toBe('fabos');
    expect(tenant('echecs.rapide')).toBeNull();
    expect(tenant('echecs.duel')).toBe('fabos');
    expect(tenant('echecs.battle')).toBe('pierrot');
  });
});

describe('fléchettes', () => {
  const x01 = (id: string, fin: number, gagnant: 'pierrot' | 'fabos', extra: Record<string, number> = {}): PartieFlechettes => ({
    id, fin, mode: 'x01', config: { startScore: 501, legsToWin: 2 },
    places: [
      { joueur: 'pierrot', rang: gagnant === 'pierrot' ? 0 : 1, stats: { points: 1002, darts: 60, legsWon: gagnant === 'pierrot' ? 2 : 1, ...extra } },
      { joueur: 'fabos', rang: gagnant === 'fabos' ? 0 : 1, stats: { points: 900, darts: 60, legsWon: gagnant === 'fabos' ? 2 : 1 } },
    ],
  });

  it('tire les duels, la moyenne et les trophées des parties', () => {
    const b = calculerFlechettes({
      branche: true,
      parties: [
        x01('a', 100, 'pierrot', { count180: 1, highestCheckout: 121 }),
        x01('b', 200, 'fabos'),
        // Une partie à trois ne compte pas comme duel, mais nourrit les statistiques.
        { id: 'c', fin: 300, mode: 'x01', config: { startScore: 301 }, places: [{ joueur: 'pierrot', rang: 0, stats: { points: 301, darts: 15 } }, { joueur: 'fabos', rang: 1, stats: { points: 200, darts: 15 } }, { joueur: null, rang: 2, stats: {} }] },
      ],
    }, ['pierrot', 'fabos']);
    expect(b.confrontations).toHaveLength(2);
    expect(b.confrontations[0]).toMatchObject({ gagnant: 'pierrot', titre: '501', score: { pierrot: 2, fabos: 1 }, detail: 'moyenne de 50,1' });
    const moyenne = b.epreuves.find((e) => e.cle === 'flechettes.moyenne')!;
    expect(moyenne.affichage).toEqual({ pierrot: '51,2', fabos: '44,4' });
    expect(Object.keys(b.trophees![0].obtenus)).toEqual(['pierrot']);
    expect(Object.keys(b.trophees![1].obtenus)).toEqual(['pierrot']);
    expect(b.avertissement).toBeUndefined();
  });

  it('prévient tant que Bullcast n\'est pas branché', () => {
    expect(calculerFlechettes({ parties: [], branche: false }, ['pierrot', 'fabos']).avertissement).toMatch(/pas encore branchés/);
  });

  it('dédoublonne les copies d\'une partie et reconnaît les joueurs par identifiant ou par nom', () => {
    const comptes = new Map([['pierrot', 'pierrot'], ['fabos', 'fabos']]);
    const ligne = (id: string, seat: number, nom: string, identifiant: string | null, rang: number) => ({
      id, modeId: 'cricket', config: '{"variant":"standard"}', finishedAt: 1780000000000, seat, nom, rang,
      stats: '{"marks":40,"rounds":15,"label":"x"}', identifiant, compte: null,
    });
    const parties = compacter([
      ligne('u1', 0, 'Moi', 'pierrot', 0), ligne('u1', 1, 'Le F', null, 1),
      ligne('u1:compte2', 0, 'Pierrot', null, 0), ligne('u1:compte2', 1, 'Moi', 'fabos', 1),
      ligne('u2', 0, 'Quelqu\'un', null, 0), ligne('u2', 1, 'Un autre', null, 1),
      ligne('u3', 0, 'pierrot', null, 1), ligne('u3', 1, 'FABOS', null, 0),
    ], comptes);
    expect(parties.map((p) => p.id)).toEqual(['u1', 'u3']);
    expect(parties[0]).toMatchObject({ fin: 1780000000, mode: 'cricket', config: { variant: 'standard' } });
    expect(parties[0].places.map((p) => p.joueur)).toEqual(['pierrot', 'fabos']);
    expect(parties[0].places[0].stats).toEqual({ marks: 40, rounds: 15 });
    expect(parties[1].places.map((p) => p.joueur)).toEqual(['pierrot', 'fabos']);
  });
});
