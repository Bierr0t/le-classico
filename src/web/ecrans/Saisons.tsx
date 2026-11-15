import { POINTS } from '../../core/moteur.ts';
import { nomMois } from '../../core/textes.ts';
import { useClassico } from '../App.tsx';
import { BoutonEnvoyer } from '../composants.tsx';

function joursRestants(mois: string, maintenant: number): number {
  const [annee, m] = mois.split('-').map(Number);
  const fin = Date.UTC(annee, m, 1) / 1000;
  return Math.max(1, Math.ceil((fin - maintenant) / 86400));
}

export function Saisons() {
  const { inst, duel, a, b, nom, autre, teinte, maintenant } = useClassico();
  const [courante, ...passees] = duel.saisons;
  const jouees = passees.filter((s) => s.confrontations > 0);
  const pa = courante.points[a.cle];
  const pb = courante.points[b.cle];
  const meneur = pa === pb ? null : pa > pb ? a.cle : b.cle;
  const restants = joursRestants(courante.mois, maintenant);
  const resume = meneur
    ? `Saison de ${nomMois(courante.mois, false)} : ${nom(meneur)} mène ${Math.max(pa, pb)}-${Math.min(pa, pb)}. Plus que ${restants} jour${restants > 1 ? 's' : ''} pour ${nom(autre(meneur))}.`
    : `Saison de ${nomMois(courante.mois, false)} : ${pa} partout. Plus que ${restants} jour${restants > 1 ? 's' : ''} pour faire la différence.`;

  return (
    <>
      <section className="carte saison-courante">
        <p className="surtitre">Saison en cours · {nomMois(courante.mois)}</p>
        <div className="duo">
          <div className="duo-cote" style={teinte(a.cle)}>
            <span className="duo-pts">{pa}</span>
            <span className="duo-nom">{a.nom}</span>
          </div>
          <span className="duo-sep">pts</span>
          <div className="duo-cote" style={teinte(b.cle)}>
            <span className="duo-pts">{pb}</span>
            <span className="duo-nom">{b.nom}</span>
          </div>
        </div>
        {courante.confrontations === 0
          ? <p className="note">Aucun duel ce mois-ci. Le premier qui gagne prend la tête.</p>
          : (
            <ul className="detail-saison">
              {inst.disciplines.filter((d) => courante.parDiscipline[d.cle]).map((d) => (
                <li key={d.cle}>
                  <b style={teinte(a.cle)} className="teinte">{courante.parDiscipline[d.cle][a.cle]}</b>
                  <span><span aria-hidden="true">{d.emoji}</span> victoires, {d.nom.toLowerCase()}</span>
                  <b style={teinte(b.cle)} className="teinte">{courante.parDiscipline[d.cle][b.cle]}</b>
                </li>
              ))}
            </ul>
          )}
        {courante.gage && (
          <div className="gage">
            <p className="surtitre">Le gage du perdant</p>
            <p>{courante.gage}</p>
          </div>
        )}
        <div className="ligne-pied">
          <span>Fin dans {restants} jour{restants > 1 ? 's' : ''}</span>
          <BoutonEnvoyer texte={resume} />
        </div>
      </section>

      <section className="bloc">
        <div className="bloc-tete"><h2>Palmarès</h2><span>saisons gagnées</span></div>
        <div className="carte palmares">
          <div style={teinte(a.cle)}><span className="palmares-n">{duel.palmares[a.cle]}</span><span>{a.nom}</span></div>
          <span className="palmares-coupe" aria-hidden="true">🏆</span>
          <div style={teinte(b.cle)}><span className="palmares-n">{duel.palmares[b.cle]}</span><span>{b.nom}</span></div>
        </div>
      </section>

      <section className="bloc">
        <div className="bloc-tete"><h2>Saisons passées</h2></div>
        {jouees.length === 0
          ? <p className="vide">Pas encore de saison terminée. L'histoire commence maintenant.</p>
          : (
            <ul className="liste">
              {jouees.map((s) => (
                <li key={s.mois} className="carte saison-passee">
                  <div className="saison-ligne">
                    <span className="saison-mois">{nomMois(s.mois)}</span>
                    <span className="saison-res">
                      <b style={teinte(a.cle)} className="teinte">{s.points[a.cle]}</b> – <b style={teinte(b.cle)} className="teinte">{s.points[b.cle]}</b>
                    </span>
                  </div>
                  {s.vainqueur
                    ? <p className="note"><b style={teinte(s.vainqueur)} className="teinte">{nom(s.vainqueur)}</b> l'emporte. {s.gage && <>Gage pour {nom(autre(s.vainqueur))} : <i>{s.gage}</i></>}</p>
                    : <p className="note">Saison partagée. Pas de gage, pas de gloire.</p>}
                </li>
              ))}
            </ul>
          )}
      </section>

      <section className="regle">
        <h2>La règle</h2>
        <p>Une saison dure un mois. Chaque duel direct compte, quelle que soit la discipline : {POINTS.victoire} points la victoire, {POINTS.nul} point le nul. Le premier du mois terminé gagne la saison, le second s'acquitte du gage.</p>
        {duel.ceintures.filter((c) => c.regle).map((c) => <p key={c.epreuve}>{c.regle} La saison suit la même échelle.</p>)}
      </section>
    </>
  );
}
