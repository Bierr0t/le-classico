import { useMemo, useState } from 'react';
import { paris } from '../../core/temps.ts';
import type { Evenement } from '../../core/types.ts';
import { useClassico } from '../App.tsx';
import { BoutonEnvoyer } from '../composants.tsx';
import { jourLong } from '../donnees.ts';

const PAS = 30;

export function Fil() {
  const { inst, duel, visitePrecedente } = useClassico();
  const [limite, setLimite] = useState(PAS);
  const tous = useMemo(
    () => inst.actu.filter((e) => e.joueurs.every((j) => j === duel.a || j === duel.b)),
    [inst, duel],
  );
  const jours = useMemo(() => {
    const groupes: { jour: string; ts: number; liste: Evenement[] }[] = [];
    for (const e of tous.slice(0, limite)) {
      const jour = paris(e.date).jour;
      const dernier = groupes.at(-1);
      if (dernier?.jour === jour) dernier.liste.push(e);
      else groupes.push({ jour, ts: e.date, liste: [e] });
    }
    return groupes;
  }, [tous, limite]);
  const emoji = new Map(inst.disciplines.map((d) => [d.cle, d.emoji]));
  const PICTO: Record<string, string> = { saison: '🏆', trophee: '🏅', serie: '🔥', general: '👑', ceinture: '🥋', bascule: '🥋' };

  if (!tous.length) return <p className="vide">Rien à signaler. Le premier duel ouvrira le fil.</p>;

  return (
    <>
      <h2 className="titre-ecran">Le fil</h2>
      {jours.map((g) => (
        <section key={g.jour} className="bloc">
          <div className="bloc-tete"><h3>{jourLong(g.ts)}</h3></div>
          <ul className="liste liste-serree">
            {g.liste.map((e) => (
              <li key={e.id} className="carte evenement" data-neuf={(visitePrecedente > 0 && e.date > visitePrecedente) || undefined}>
                <span className="evenement-picto" aria-hidden="true">{PICTO[e.type] ?? emoji.get(e.discipline ?? '') ?? '•'}</span>
                <div>
                  <p>{e.texte}</p>
                  <div className="evenement-actions">
                    {e.lien && <a className="lien" href={e.lien} target="_blank" rel="noreferrer">Voir la partie</a>}
                    <BoutonEnvoyer texte={e.texte} />
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ))}
      {tous.length > limite && <button className="bouton bouton-discret" onClick={() => setLimite(limite + PAS)}>Voir la suite</button>}
    </>
  );
}
