import { useEffect, useState } from 'react';
import { useClassico } from '../App.tsx';
import { partagerAffiche } from '../affiche.ts';
import { Avatar, BoutonEnvoyer } from '../composants.tsx';
import { activer, desactiver, etatNotifs, type EtatNotifs } from '../notifications.ts';

function Notifications() {
  const { inst, annoncer } = useClassico();
  const [etat, setEtat] = useState<EtatNotifs | null>(null);
  const [occupe, setOccupe] = useState(false);
  useEffect(() => { etatNotifs(inst).then(setEtat); }, [inst]);

  const basculer = async (action: typeof activer) => {
    setOccupe(true);
    try {
      const suite = await action(inst);
      setEtat(suite);
      if (suite === 'actives') annoncer('C\'est activé. Un message de bienvenue arrive d\'ici une demi-heure.');
      if (suite === 'refusees') annoncer('Refusé. Ça se rattrape dans les réglages du téléphone.');
    } catch {
      annoncer('L\'activation n\'a pas marché. Réessaie dans un instant.');
    }
    setOccupe(false);
  };

  if (!etat || (etat === 'indisponible' && !inst.ntfy)) return null;
  const ntfy = inst.ntfy && (
    <a className="lien" href={`https://ntfy.sh/${inst.ntfy}`} target="_blank" rel="noreferrer">
      {etat === 'indisponible' || etat === 'incompatible' ? 'S\'abonner avec l\'app ntfy' : 'Autre moyen : l\'app ntfy'}
    </a>
  );

  return (
    <section className="carte notifs">
      <div>
        <h2>Être prévenu quand ça bouge</h2>
        <p>Chaque duel, chaque ceinture qui change de main, chaque fin de saison. Rien entre 23 h et 8 h.</p>
      </div>
      {etat === 'installer' && (
        <ol className="etapes">
          <li>Dans Safari, touche le bouton Partager.</li>
          <li>Choisis « Sur l'écran d'accueil ».</li>
          <li>Ouvre Le Classico depuis son icône, reviens ici et active les notifications.</li>
        </ol>
      )}
      {etat === 'inactives' && <button className="bouton" onClick={() => basculer(activer)} disabled={occupe}>{occupe ? 'Activation…' : 'Activer les notifications'}</button>}
      {etat === 'actives' && (
        <div className="notifs-actives">
          <p><b>Activées sur cet appareil.</b></p>
          <button className="lien" onClick={() => basculer(desactiver)} disabled={occupe}>Désactiver</button>
        </div>
      )}
      {etat === 'refusees' && <p className="avertissement">Les notifications sont refusées pour cette app. Pour les rétablir : Réglages du téléphone, Notifications, Classico.</p>}
      {etat === 'incompatible' && <p className="note">Ce navigateur ne sait pas recevoir de notifications d'une app web.</p>}
      {ntfy}
    </section>
  );
}

export function Chambrage() {
  const { inst, duel, a, b, camp, choisirCamp, nom, autre, teinte, annoncer, joueur } = useClassico();
  const [occupe, setOccupe] = useState(false);

  const choix = (
    <div className="camps" role="group" aria-label="Ton camp">
      {[a, b].map((j) => (
        <button key={j.cle} className="camp" style={teinte(j.cle)} aria-pressed={camp === j.cle} onClick={() => choisirCamp(j.cle)}>
          <Avatar joueur={j} taille={44} />
          <span>Je suis {j.nom}</span>
        </button>
      ))}
    </div>
  );

  if (!camp) {
    return (
      <section className="carte entree-camp">
        <h2 className="titre-ecran">Choisis ton camp</h2>
        <p>L'app te prépare tes munitions, et te prévient de ce que l'autre va te ressortir.</p>
        {choix}
      </section>
    );
  }

  const rival = autre(camp);
  const miennes = duel.munitions.filter((m) => m.pour === camp);
  const siennes = duel.munitions.filter((m) => m.pour === rival);

  const affiche = async () => {
    setOccupe(true);
    const r = await partagerAffiche(inst, duel, joueur(duel.a), joueur(duel.b));
    setOccupe(false);
    if (r === 'telecharge') annoncer('Affiche enregistrée.');
    if (r === 'echec') annoncer('L\'affiche n\'a pas pu être créée.');
  };

  return (
    <>
      {choix}

      <section className="bloc">
        <div className="bloc-tete"><h2>Tes munitions</h2><span>{miennes.length} en stock</span></div>
        {miennes.length === 0
          ? <p className="vide">Rien à dire pour l'instant. Il va falloir gagner quelque chose.</p>
          : (
            <ul className="liste">
              {miennes.map((m, i) => (
                <li key={m.id} className="carte munition" style={teinte(camp)} data-forte={i === 0 || undefined}>
                  <p>{m.texte}</p>
                  <BoutonEnvoyer texte={m.texte} libelle={`Envoyer à ${nom(rival)}`} />
                </li>
              ))}
            </ul>
          )}
      </section>

      <section className="bloc">
        <div className="bloc-tete"><h2>Ce que {nom(rival)} va te ressortir</h2><span>prépare ta défense</span></div>
        {siennes.length === 0
          ? <p className="vide">{nom(rival)} n'a rien. Profite.</p>
          : (
            <ul className="liste liste-serree">
              {siennes.map((m) => <li key={m.id} className="riposte" style={teinte(rival)}>{m.texte}</li>)}
            </ul>
          )}
      </section>

      <section className="carte bloc-affiche">
        <div>
          <h2>L'affiche du moment</h2>
          <p>Le score, les ceintures et la phrase qui fâche, en une image à envoyer.</p>
        </div>
        <button className="bouton" onClick={affiche} disabled={occupe}>{occupe ? 'Impression…' : 'Partager l\'affiche'}</button>
      </section>

      <Notifications />
    </>
  );
}
