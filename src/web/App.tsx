import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import type { Duel, Instantane, Joueur } from '../core/types.ts';
import { charger, ilYA, memoire } from './donnees.ts';
import { Ring } from './ecrans/Ring.tsx';
import { Saisons } from './ecrans/Saisons.tsx';
import { Chambrage } from './ecrans/Chambrage.tsx';
import { Fil } from './ecrans/Fil.tsx';
import { FicheDiscipline, FicheJoueur } from './ecrans/Fiches.tsx';

type Onglet = 'ring' | 'saisons' | 'chambrage' | 'fil';
const ONGLETS: { cle: Onglet; nom: string; icone: string }[] = [
  { cle: 'ring', nom: 'Le ring', icone: 'M4 7h16v10H4zM4 11h16M4 14h16M7 7V4M17 7V4M7 20v-3M17 20v-3' },
  { cle: 'saisons', nom: 'Saisons', icone: 'M5 5h14v15H5zM5 9h14M9 3v4M15 3v4M9 13h2M13 13h2M9 16h2' },
  { cle: 'chambrage', nom: 'Chambrage', icone: 'M4 5h16v11H10l-5 4v-4H4zM8 9h8M8 12h5' },
  { cle: 'fil', nom: 'Le fil', icone: 'M5 6h14M5 12h14M5 18h9' },
];

type Contexte = {
  inst: Instantane;
  duel: Duel;
  /** Les deux joueurs du duel affiché : a à gauche, b à droite. */
  a: Joueur;
  b: Joueur;
  maintenant: number;
  /** Le camp choisi sur cet appareil, ou null. */
  camp: string | null;
  choisirCamp: (cle: string) => void;
  /** Horodatage de la visite précédente sur cet appareil (0 à la première). */
  visitePrecedente: number;
  joueur: (cle: string) => Joueur;
  nom: (cle: string) => string;
  autre: (cle: string) => string;
  /** Style à poser sur un élément pour qu'il prenne la couleur d'un joueur. */
  teinte: (cle: string | null | undefined) => CSSProperties | undefined;
  ouvrir: (...feuille: string[]) => void;
  annoncer: (message: string) => void;
};
const Ctx = createContext<Contexte | null>(null);
export const useClassico = () => useContext(Ctx)!;

function lireRoute(): { onglet: Onglet; feuille: string[] } {
  const [, onglet, ...feuille] = location.hash.replace(/^#/, '').split('/').map(decodeURIComponent);
  return { onglet: ONGLETS.some((o) => o.cle === onglet) ? (onglet as Onglet) : 'ring', feuille: feuille.filter(Boolean) };
}

export function App() {
  const [inst, setInst] = useState<Instantane | null>(null);
  const [erreur, setErreur] = useState(false);
  const [route, setRoute] = useState(lireRoute);
  const [maintenant, setMaintenant] = useState(() => Math.floor(Date.now() / 1000));
  const [toast, setToast] = useState<string | null>(null);
  const [camp, setCamp] = useState<string | null>(() => memoire.lire<string | null>('camp', null));
  const [indexDuel, setIndexDuel] = useState(() => memoire.lire<number>('duel', 0));
  const [visitePrecedente] = useState(() => memoire.lire<number>('visite', 0));

  useEffect(() => { charger().then(setInst, () => setErreur(true)); }, []);

  useEffect(() => {
    const suivre = () => setRoute(lireRoute());
    window.addEventListener('hashchange', suivre);
    const horloge = setInterval(() => setMaintenant(Math.floor(Date.now() / 1000)), 30000);
    return () => { window.removeEventListener('hashchange', suivre); clearInterval(horloge); };
  }, []);

  // La visite est enregistrée après quelques secondes : le temps de montrer ce qui a changé.
  useEffect(() => {
    if (!inst) return;
    const t = setTimeout(() => memoire.ecrire('visite', Math.floor(Date.now() / 1000)), 4000);
    return () => clearTimeout(t);
  }, [inst]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2500);
    return () => clearTimeout(t);
  }, [toast]);

  const ouvrir = useCallback((...feuille: string[]) => {
    location.hash = `/${lireRoute().onglet}/${feuille.map(encodeURIComponent).join('/')}`;
  }, []);
  const fermer = useCallback(() => {
    if (history.length > 1 && lireRoute().feuille.length) history.back();
    else location.hash = `/${lireRoute().onglet}`;
  }, []);
  const choisirCamp = useCallback((cle: string) => { setCamp(cle); memoire.ecrire('camp', cle); }, []);

  const ctx = useMemo<Contexte | null>(() => {
    if (!inst || !inst.duels.length) return null;
    const duel = inst.duels[Math.min(indexDuel, inst.duels.length - 1)];
    const index = new Map(inst.joueurs.map((j) => [j.cle, j]));
    const joueur = (cle: string) => index.get(cle) ?? { cle, nom: cle, couleur: '#888888', comptes: {}, profils: [] };
    return {
      inst, duel, a: joueur(duel.a), b: joueur(duel.b), maintenant,
      camp: camp === duel.a || camp === duel.b ? camp : null,
      choisirCamp, visitePrecedente, joueur,
      nom: (cle) => joueur(cle).nom,
      autre: (cle) => (cle === duel.a ? duel.b : duel.a),
      teinte: (cle) => (cle ? ({ '--j': joueur(cle).couleur } as CSSProperties) : undefined),
      ouvrir,
      annoncer: setToast,
    };
  }, [inst, indexDuel, maintenant, camp, choisirCamp, visitePrecedente, ouvrir]);

  if (erreur || (inst && !ctx)) {
    return (
      <main className="plein">
        <h1 className="marque">Le Classico</h1>
        <p>Les données ne sont pas encore là. Le collecteur n'a peut-être pas tourné.</p>
        <button className="bouton" onClick={() => location.reload()}>Réessayer</button>
      </main>
    );
  }
  if (!ctx || !inst) return <main className="plein"><h1 className="marque">Le Classico</h1><p>Les deux camps s'échauffent…</p></main>;

  const vieux = maintenant - inst.genereLe > 3 * 3600;
  const nouveautes = visitePrecedente ? inst.actu.filter((e) => e.date > visitePrecedente && e.joueurs.includes(ctx.duel.a) && e.joueurs.includes(ctx.duel.b)).length : 0;
  const [feuille, cible] = route.feuille;
  const couleurs = { '--ja': ctx.a.couleur, '--jb': ctx.b.couleur } as CSSProperties;

  return (
    <Ctx.Provider value={ctx}>
      <div className="app" style={couleurs}>
        <header className="tete">
          <h1 className="marque">{inst.nom}</h1>
          {inst.duels.length > 1 && (
            <select
              className="choix-duel" aria-label="Duel affiché" value={inst.duels.indexOf(ctx.duel)}
              onChange={(e) => { setIndexDuel(Number(e.target.value)); memoire.ecrire('duel', Number(e.target.value)); }}
            >
              {inst.duels.map((d, i) => <option key={`${d.a}:${d.b}`} value={i}>{ctx.nom(d.a)} – {ctx.nom(d.b)}</option>)}
            </select>
          )}
          <span className="fraicheur">mis à jour {ilYA(inst.genereLe, maintenant)}</span>
        </header>
        {vieux && <p className="alerte">Le collecteur est en retard : les chiffres datent de {ilYA(inst.genereLe, maintenant).replace('il y a ', '')}.</p>}

        <main className="ecran" key={route.onglet}>
          {route.onglet === 'ring' && <Ring />}
          {route.onglet === 'saisons' && <Saisons />}
          {route.onglet === 'chambrage' && <Chambrage />}
          {route.onglet === 'fil' && <Fil />}
        </main>

        <nav className="onglets" aria-label="Sections">
          {ONGLETS.map((o) => (
            <a key={o.cle} href={`#/${o.cle}`} className="onglet" aria-current={o.cle === route.onglet ? 'page' : undefined}>
              <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true"><path d={o.icone} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round" /></svg>
              {o.nom}
              {o.cle === 'fil' && nouveautes > 0 && route.onglet !== 'fil' && <span className="pastille" aria-label={`${nouveautes} nouveautés`}>{nouveautes}</span>}
            </a>
          ))}
        </nav>

        {feuille === 'discipline' && cible && <FicheDiscipline cle={cible} onFermer={fermer} />}
        {feuille === 'joueur' && cible && <FicheJoueur cle={cible} onFermer={fermer} />}

        <div className="toast" role="status" data-visible={toast ? '' : undefined}>{toast}</div>
      </div>
    </Ctx.Provider>
  );
}
