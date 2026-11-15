import { nomMois } from '../../core/textes.ts';
import { useClassico } from '../App.tsx';
import { Avatar, BoutonEnvoyer, LigneFace } from '../composants.tsx';

export function Ring() {
  const { inst, duel, a, b, nom, teinte, ouvrir } = useClassico();
  const sa = duel.score[a.cle];
  const sb = duel.score[b.cle];
  const meneur = sa === sb ? null : sa > sb ? a.cle : b.cle;
  const total = sa + sb;
  const part = total ? Math.round((sa / total) * 100) : 50;
  const saison = duel.saisons[0];
  const dernier = inst.actu.find((e) => e.joueurs.includes(a.cle) && e.joueurs.includes(b.cle));
  const confrontations = duel.bilan.victoires[a.cle] + duel.bilan.victoires[b.cle] + duel.bilan.nulles;

  return (
    <>
      <section className="affiche" aria-label={`Score général : ${a.nom} ${sa}, ${b.nom} ${sb}`}>
        <button className="coin" style={teinte(a.cle)} onClick={() => ouvrir('joueur', a.cle)}>
          <Avatar joueur={a} taille={84} />
          <span className="coin-nom">{a.nom}</span>
          <span className="coin-sous">{meneur === a.cle ? 'tenant du titre' : 'challenger'}</span>
        </button>
        <div className="tableau" aria-hidden="true">
          <span className="tableau-pts" style={teinte(a.cle)} data-devant={meneur === a.cle || undefined}>{sa}</span>
          <span className="tableau-sep">:</span>
          <span className="tableau-pts" style={teinte(b.cle)} data-devant={meneur === b.cle || undefined}>{sb}</span>
          <span className="tableau-legende">points de ceintures</span>
        </div>
        <button className="coin" style={teinte(b.cle)} onClick={() => ouvrir('joueur', b.cle)}>
          <Avatar joueur={b} taille={84} />
          <span className="coin-nom">{b.nom}</span>
          <span className="coin-sous">{meneur === b.cle ? 'tenant du titre' : 'challenger'}</span>
        </button>
      </section>

      <div className="corde" role="img" aria-label={`Rapport de force : ${part} % pour ${a.nom}`}>
        <span className="corde-a" style={{ flexBasis: `${part}%` }} />
        <span className="corde-noeud" />
        <span className="corde-b" />
      </div>

      <div className="accroche">
        <p>{duel.accroche}</p>
        <BoutonEnvoyer texte={duel.accroche} />
      </div>

      {duel.forme.length > 0 && (
        <section className="bloc">
          <div className="bloc-tete">
            <h2>Les derniers duels</h2>
            <span>{duel.bilan.victoires[a.cle]} V · {duel.bilan.nulles} N · {duel.bilan.victoires[b.cle]} V sur {confrontations}</span>
          </div>
          <ol className="forme" aria-label="Du plus ancien au plus récent">
            {duel.forme.map((g, i) => (
              <li key={i} className="jeton" style={teinte(g)} data-nul={g === null || undefined}>
                <span className="visuellement-cache">{g ? nom(g) : 'nul'}</span>
                <span aria-hidden="true">{g ? nom(g).slice(0, 1) : '='}</span>
              </li>
            ))}
          </ol>
          {duel.serie && duel.serie.n >= 2 && (
            <p className="note">Série en cours : {duel.serie.n} victoires de suite pour <b style={teinte(duel.serie.joueur)} className="teinte">{nom(duel.serie.joueur)}</b>.</p>
          )}
        </section>
      )}

      <a className="carte carte-saison" href="#/saisons">
        <div>
          <p className="surtitre">Saison de {nomMois(saison.mois, false)}</p>
          <p className="saison-score">
            <b style={teinte(a.cle)} className="teinte">{saison.points[a.cle]}</b>
            <span> – </span>
            <b style={teinte(b.cle)} className="teinte">{saison.points[b.cle]}</b>
          </p>
        </div>
        <p className="saison-gage">{saison.gage ? <>En jeu : <i>{saison.gage}</i></> : 'Rien en jeu ce mois-ci.'}</p>
        <span className="chevron" aria-hidden="true">›</span>
      </a>

      <section className="bloc">
        <div className="bloc-tete">
          <h2>Les ceintures</h2>
          <span>majeure 2 pts · mineure 1 pt</span>
        </div>
        {inst.disciplines.map((d) => {
          const ceintures = duel.ceintures.filter((c) => c.discipline === d.cle);
          const pts = (cle: string) => ceintures.reduce((n, c) => n + (c.tenant === cle ? c.points : 0), 0);
          return (
            <button key={d.cle} className="carte discipline" onClick={() => ouvrir('discipline', d.cle)}>
              <span className="discipline-tete">
                <span className="discipline-nom"><span className="puce" aria-hidden="true">{d.emoji}</span>{d.nom}</span>
                <span className="discipline-score">
                  <b style={teinte(a.cle)} className="teinte">{pts(a.cle)}</b> – <b style={teinte(b.cle)} className="teinte">{pts(b.cle)}</b>
                </span>
              </span>
              {d.avertissement && <span className="avertissement">{d.avertissement}</span>}
              <ul className="faces">
                {ceintures.map((c) => (
                  <LigneFace key={c.epreuve} nom={c.nom} va={c.affichage[a.cle]} vb={c.affichage[b.cle]} tenant={c.tenant} points={c.points} />
                ))}
              </ul>
              <span className="discipline-pied">Historique et détails <span aria-hidden="true">›</span></span>
            </button>
          );
        })}
      </section>

      {dernier && (
        <a className="carte dernier" href="#/fil">
          <p className="surtitre">Dernière minute</p>
          <p>{dernier.texte}</p>
        </a>
      )}
    </>
  );
}
