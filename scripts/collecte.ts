/**
 * Collecteur : interroge chaque discipline, recalcule l'instantané et envoie les notifications ntfy.
 * Lancé toutes les 30 minutes par GitHub Actions.
 *
 *   npm run collecte            collecte + calcul + notifications
 *   npm run collecte -- --muet  sans notifications
 */
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Contexte, Saisie } from '../src/core/disciplines/contrat.ts';
import { disciplinesActives } from '../src/core/disciplines/index.ts';
import { calculer } from '../src/core/moteur.ts';
import { paris } from '../src/core/temps.ts';
import { preparerPush, type Push } from './push.ts';
import type { BilanDiscipline, Config, Evenement, Instantane } from '../src/core/types.ts';

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..');
const DONNEES = join(RACINE, 'donnees');
const MUET = process.argv.includes('--muet');
const MAX_NOTIFS_JOUR = 6;

type Etat = { notifies: string[]; envois: { jour: string; n: number; synthese: boolean }; initialise: boolean; pushDepuis?: string };

async function lireJson<T>(chemin: string, defaut: T): Promise<T> {
  try { return JSON.parse(await readFile(chemin, 'utf8')); } catch { return defaut; }
}
async function ecrireJson(chemin: string, v: unknown) {
  await mkdir(dirname(chemin), { recursive: true });
  await writeFile(chemin, JSON.stringify(v));
}

function contexte(config: Config, cle: string): Contexte {
  const dossier = join(DONNEES, cle);
  return {
    config,
    lire: (chemin, defaut) => lireJson(join(dossier, chemin), defaut),
    ecrire: (chemin, valeur) => ecrireJson(join(dossier, chemin), valeur),
    lister: async (sous) => { try { return await readdir(join(dossier, sous)); } catch { return []; } },
    saisies: (nom) => lireJson<Saisie[]>(join(RACINE, 'saisies', `${nom}.json`), []),
    journal: (message) => console.log(`  [${cle}] ${message}`),
  };
}

async function ntfy(sujet: string, titre: string, message: string, lien: string) {
  const headers: Record<string, string> = { Title: titre };
  if (lien) headers.Click = lien;
  const r = await fetch(`https://ntfy.sh/${sujet}`, { method: 'POST', body: message, headers });
  if (!r.ok) throw new Error(`ntfy : HTTP ${r.status}`);
}

async function notifier(actu: Evenement[], etat: Etat, config: Config, push: Push | null) {
  // Deux canaux : le sujet ntfy, et le push de l'app installée.
  const diffuser = async (texte: string, id?: string) => {
    if (config.ntfy) await ntfy(config.ntfy, config.nom, texte, config.url ?? '');
    await push?.envoyer(texte, id);
  };
  const deja = new Set(etat.notifies);
  const candidats = actu.filter((e) => e.notif && !deja.has(e.id)).reverse();
  const { jour, heure } = paris(Date.now() / 1000);
  if (etat.envois.jour !== jour) etat.envois = { jour, n: 0, synthese: false };

  // Premier passage ou événement ancien : on marque sans envoyer, pour ne pas rejouer tout l'historique.
  const frais = Date.now() / 1000 - 2 * 86400;
  const aEnvoyer: Evenement[] = [];
  for (const e of candidats) {
    if (!etat.initialise || e.date < frais) deja.add(e.id);
    else aEnvoyer.push(e);
  }
  const silence = heure >= 23 || heure < 8;
  if (aEnvoyer.length && (config.ntfy || push) && !MUET && !silence) {
    for (const e of aEnvoyer) {
      if (etat.envois.n < MAX_NOTIFS_JOUR) {
        await diffuser(e.texte, e.id);
        etat.envois.n++;
      } else if (!etat.envois.synthese) {
        await diffuser('Ça bouge encore. La suite est dans le fil.', 'synthese');
        etat.envois.synthese = true;
      }
      deja.add(e.id);
    }
    console.log(`  ${aEnvoyer.length} événement(s) notifié(s)`);
  } else if (aEnvoyer.length) {
    console.log(`  ${aEnvoyer.length} événement(s) en attente (${silence ? 'plage de silence' : MUET ? 'mode muet' : 'pas de sujet ntfy'})`);
    if (MUET) for (const e of aEnvoyer) deja.add(e.id);
  }
  etat.notifies = [...deja].slice(-2000);
  etat.initialise = true;
}

async function main() {
  const config = JSON.parse(await readFile(join(RACINE, 'classico.json'), 'utf8')) as Config;
  const cheminEtat = join(DONNEES, 'etat.json');
  const etat = await lireJson<Etat>(cheminEtat, { notifies: [], envois: { jour: '', n: 0, synthese: false }, initialise: false });
  const precedent = await lireJson<Instantane | null>(join(DONNEES, 'instantane.json'), null);
  const maintenant = Math.floor(Date.now() / 1000);

  const disciplines = disciplinesActives(config);
  console.log(`${config.nom} : ${config.joueurs.map((j) => j.nom).join(' contre ')}, ${disciplines.length} discipline(s)`);

  // Une discipline en panne ne fait pas tomber les autres : elle garde son bilan précédent, avec un avertissement.
  const bilans: BilanDiscipline[] = [];
  for (const d of disciplines) {
    try {
      bilans.push(d.calculer(await d.collecter(contexte(config, d.cle)), config, maintenant));
    } catch (e) {
      console.error(`  [${d.cle}] en échec : ${(e as Error).message}`);
      const ancien = precedent?.disciplines.find((x) => x.cle === d.cle);
      bilans.push({
        ...(ancien ?? { cle: d.cle, nom: d.nom, emoji: d.emoji, epreuves: [], confrontations: [], faits: [] }),
        avertissement: `La collecte a échoué : les chiffres datent du dernier passage réussi. (${(e as Error).message})`,
      });
    }
  }

  const instantane = calculer(config, bilans, maintenant, precedent);
  const push = await preparerPush(config, join(DONNEES, 'abonnements.chiffre'), etat, MUET);
  await notifier(instantane.actu, etat, config, push);
  await push?.ranger();

  await ecrireJson(cheminEtat, etat);
  await ecrireJson(join(DONNEES, 'instantane.json'), instantane);
  await ecrireJson(join(RACINE, 'public', 'instantane.json'), instantane);
  for (const d of instantane.duels) {
    console.log(`  ${d.a} ${d.score[d.a]} - ${d.score[d.b]} ${d.b} · ${d.accroche}`);
  }
  console.log(`Instantané écrit : ${Math.round(JSON.stringify(instantane).length / 1024)} Ko, ${instantane.actu.length} événements`);
}

main().catch((e) => { console.error(e); process.exit(1); });
