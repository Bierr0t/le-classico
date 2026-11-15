import { useState } from 'react';
import { useClassico } from '../App.tsx';
import { Avatar, Feuille, LigneFace } from '../composants.tsx';
import { dateCourte, dateLongue } from '../donnees.ts';

const PAS = 20;

export function FicheDiscipline({ cle, onFermer }: { cle: string; onFermer: () => void }) {
  const { inst, duel, a, b, nom, teinte } = useClassico();
  const [limite, setLimite] = useState(PAS);
  const d = inst.disciplines.find((x) => x.cle === cle);
  if (!d) return <Feuille titre="Discipline inconnue" onFermer={onFermer}><p className="vide">Cette discipline n'existe pas (ou plus).</p></Feuille>;

  const ceintures = duel.ceintures.filter((c) => c.discipline === cle);
  const confrontations = d.confrontations
    .filter((c) => c.joueurs.includes(a.cle) && c.joueurs.includes(b.cle))
    .sort((x, y) => y.date - x.date);
  const faits = d.faits.filter((f) => f.valeurs[a.cle] != null || f.valeurs[b.cle] != null);
  const devant = (f: (typeof faits)[number]) => {
    const va = f.valeurs[a.cle];
    const vb = f.valeurs[b.cle];
    if (va == null || vb == null || va === vb) return va == null && vb == null ? null : va == null ? b.cle : vb == null ? a.cle : null;
    return (va - vb) * f.sens > 0 ? a.cle : b.cle;
  };

  return (
    <Feuille titre={d.nom} surtitre={d.source ? `Source : ${d.source.nom}` : 'Résultats saisis à la main'} onFermer={onFermer}>
      {d.avertissement && <p className="avertissement">{d.avertissement}</p>}

      <div className="entete-face" aria-hidden="true">
        <span style={teinte(a.cle)} className="teinte">{a.nom}</span>
        <span style={teinte(b.cle)} className="teinte">{b.nom}</span>
      </div>

      <section>
        <h3 className="sous-titre">Les ceintures</h3>
        <ul className="faces">
          {ceintures.map((c) => (
            <LigneFace
              key={c.epreuve} nom={c.nom} va={c.affichage[a.cle]} vb={c.affichage[b.cle]} tenant={c.tenant} points={c.points}
              note={[
                c.tenant
                  ? `${nom(c.tenant)}${c.depuis ? ` depuis le ${dateCourte(c.depuis)}` : ''}`
                  : c.genre === 'duel' && Number(c.affichage[a.cle]) + Number(c.affichage[b.cle]) === 0 ? 'jamais disputée' : 'vacante',
                c.victoires && `${c.victoires[a.cle]} victoires à ${c.victoires[b.cle]}`,
                c.nulles && `${c.nulles} nul${c.nulles > 1 ? 's' : ''}`,
              ].filter(Boolean).join(' · ')}
            />
          ))}
        </ul>
        {ceintures.filter((c) => c.regle).map((c) => <p key={c.epreuve} className="note regle-epreuve">{c.regle}</p>)}
      </section>

      {d.saisies && inst.depot && (
        <section className="saisie">
          {d.saisies.map((s) => (
            <a key={s.fichier} className="bouton" target="_blank" rel="noreferrer"
              href={`https://github.com/${inst.depot}/issues/new?template=resultat.yml&discipline=${encodeURIComponent(s.fichier)}&title=${encodeURIComponent(`Résultat : ${s.nom}`)}`}>
              Déclarer un résultat · {s.nom}
            </a>
          ))}
          <p className="note">Ces résultats ne sont publiés nulle part : c'est le vainqueur qui déclare, et le perdant qui vérifie.</p>
        </section>
      )}

      {faits.length > 0 && (
        <section>
          <h3 className="sous-titre">Le reste du dossier</h3>
          <ul className="faces faces-sobres">
            {faits.map((f) => <LigneFace key={f.cle} nom={f.nom} va={f.affichage[a.cle]} vb={f.affichage[b.cle]} tenant={devant(f)} />)}
          </ul>
        </section>
      )}

      <section>
        <h3 className="sous-titre">Les duels ({confrontations.length})</h3>
        {confrontations.length === 0
          ? <p className="vide">Jamais affrontés ici. Il serait temps.</p>
          : (
            <ul className="duels">
              {confrontations.slice(0, limite).map((c) => {
                const score = c.score ? ` ${c.score[c.gagnant ?? a.cle]}-${c.score[c.gagnant === a.cle || !c.gagnant ? b.cle : a.cle]}` : '';
                const contenu = (
                  <>
                    <span className="duel-date">{dateCourte(c.date)}</span>
                    <span className="duel-quoi">
                      <b style={teinte(c.gagnant)} className={c.gagnant ? 'teinte' : undefined}>{c.gagnant ? nom(c.gagnant) : 'Nul'}</b>
                      {score} · {c.titre}{(c.poids ?? 1) > 1 && <span className="poids">×{c.poids}</span>}
                      {c.detail && <small>{c.detail}</small>}
                    </span>
                    {c.lien && <span className="chevron" aria-hidden="true">›</span>}
                  </>
                );
                return (
                  <li key={c.id}>
                    {c.lien
                      ? <a className="duel" href={c.lien} target="_blank" rel="noreferrer">{contenu}</a>
                      : <div className="duel">{contenu}</div>}
                  </li>
                );
              })}
            </ul>
          )}
        {confrontations.length > limite && <button className="bouton bouton-discret" onClick={() => setLimite(limite + PAS)}>Voir la suite</button>}
      </section>
    </Feuille>
  );
}

export function FicheJoueur({ cle, onFermer }: { cle: string; onFermer: () => void }) {
  const { inst, duel, joueur, nom, autre, teinte } = useClassico();
  const j = joueur(cle);
  const rival = autre(cle);
  const obtenus = new Map((duel.trophees[cle] ?? []).map((t) => [t.cle, t]));
  const ceintures = duel.ceintures.filter((c) => c.tenant === cle);
  const victoires = duel.bilan.victoires[cle] ?? 0;
  const total = victoires + (duel.bilan.victoires[rival] ?? 0) + duel.bilan.nulles;

  return (
    <Feuille titre={j.nom} surtitre={`Face à ${nom(rival)}`} onFermer={onFermer}>
      <div className="identite" style={teinte(cle)}>
        <Avatar joueur={j} taille={96} />
        <dl className="chiffres">
          <div><dt>points</dt><dd>{duel.score[cle]}</dd></div>
          <div><dt>saisons</dt><dd>{duel.palmares[cle]}</dd></div>
          <div><dt>victoires</dt><dd>{victoires}<small>/{total}</small></dd></div>
        </dl>
      </div>

      <section>
        <h3 className="sous-titre">Ceintures en sa possession ({ceintures.length}/{duel.ceintures.length})</h3>
        {ceintures.length === 0
          ? <p className="vide">Aucune. Les mains dans les poches.</p>
          : (
            <ul className="etiquettes">
              {ceintures.map((c) => <li key={c.epreuve} style={teinte(cle)} className="etiquette">{c.nom}{c.points === 2 && ' ×2'}</li>)}
            </ul>
          )}
      </section>

      <section>
        <h3 className="sous-titre">Trophées ({obtenus.size}/{inst.trophees.length})</h3>
        <ul className="trophees">
          {inst.trophees.map((t) => {
            const o = obtenus.get(t.cle);
            return (
              <li key={t.cle} className="trophee" data-obtenu={o ? '' : undefined}>
                <span className="trophee-emoji" aria-hidden="true">{o ? t.emoji : '🔒'}</span>
                <span>
                  <b>{t.nom}</b>
                  <small>{t.condition}{o && ` · le ${dateLongue(o.date)}`}</small>
                </span>
              </li>
            );
          })}
        </ul>
      </section>

      {j.profils.length > 0 && (
        <section className="profils">
          {j.profils.map((p) => <a key={p.lien} className="lien" href={p.lien} target="_blank" rel="noreferrer">Profil {p.nom}</a>)}
        </section>
      )}
    </Feuille>
  );
}
