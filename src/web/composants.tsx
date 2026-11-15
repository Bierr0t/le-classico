import { useEffect, useRef, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import type { Joueur } from '../core/types.ts';
import { useClassico } from './App.tsx';
import { partager } from './donnees.ts';

export function Avatar({ joueur, taille = 72 }: { joueur: Joueur; taille?: number }) {
  const [casse, setCasse] = useState(false);
  const style = { '--j': joueur.couleur, '--t': `${taille}px` } as CSSProperties;
  return (
    <span className="avatar" style={style} aria-hidden="true">
      {joueur.avatar && !casse
        ? <img src={joueur.avatar} alt="" width={taille} height={taille} loading="lazy" onError={() => setCasse(true)} />
        : <span className="avatar-initiale">{joueur.nom.slice(0, 1)}</span>}
    </span>
  );
}

/** Feuille qui monte du bas de l'écran. Se ferme avec Échap, le bouton ou un tap sur le fond. */
export function Feuille({ titre, surtitre, onFermer, children }: { titre: string; surtitre?: string; onFermer: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const precedent = document.activeElement as HTMLElement | null;
    ref.current?.focus();
    const touche = (e: KeyboardEvent) => { if (e.key === 'Escape') onFermer(); };
    document.addEventListener('keydown', touche);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', touche);
      document.body.style.overflow = '';
      precedent?.focus?.();
    };
  }, [onFermer]);
  return (
    <div className="voile" onClick={(e) => { if (e.target === e.currentTarget) onFermer(); }}>
      <div className="feuille" role="dialog" aria-modal="true" aria-label={titre} tabIndex={-1} ref={ref}>
        <div className="feuille-tete">
          <div>
            {surtitre && <p className="surtitre">{surtitre}</p>}
            <h2 className="titre-feuille">{titre}</h2>
          </div>
          <button className="fermer" onClick={onFermer} aria-label="Fermer">
            <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" /></svg>
          </button>
        </div>
        <div className="feuille-corps">{children}</div>
      </div>
    </div>
  );
}

export function BoutonEnvoyer({ texte, libelle = 'Envoyer' }: { texte: string; libelle?: string }) {
  const { annoncer } = useClassico();
  return (
    <button
      className="envoyer"
      onClick={async () => {
        const r = await partager(texte);
        if (r === 'copie') annoncer('Copié. Il n\'y a plus qu\'à coller.');
        if (r === 'echec') annoncer('Le partage n\'a pas marché.');
      }}
    >
      <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M4 12l16-8-6 16-3-6z" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" /></svg>
      {libelle}
    </button>
  );
}

/** Une ligne du « tale of the tape » : la valeur de chacun de part et d'autre du libellé. */
export function LigneFace({ nom, va, vb, tenant, points, note }: {
  nom: string; va: string; vb: string; tenant: string | null; points?: number; note?: string;
}) {
  const { a, b, nom: nomDe } = useClassico();
  const qui = tenant ? `${nomDe(tenant)} devant` : 'personne devant';
  return (
    <li className="face" data-tenant={tenant === a.cle ? 'a' : tenant === b.cle ? 'b' : undefined}>
      <span className="face-v face-a">{va}</span>
      <span className="face-nom">
        {nom}
        {points === 2 && <span className="majeure" title="Ceinture majeure : 2 points">×2</span>}
        <span className="visuellement-cache">, {qui}</span>
        {note && <small>{note}</small>}
      </span>
      <span className="face-v face-b">{vb}</span>
    </li>
  );
}
