/**
 * Enregistre un résultat saisi à la main dans saisies/{fichier}.json.
 *
 *   npm run resultat -- echecs-battle pierrot 12-9
 *   npm run resultat -- echecs-battle nul 10-10 2026-11-14 "revanche demandée"
 *   npm run resultat -- --issue      lit le formulaire GitHub dans la variable ISSUE_BODY
 *
 * Le score se lit dans l'ordre des joueurs de classico.json.
 */
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Saisie } from '../src/core/disciplines/contrat.ts';
import { paris } from '../src/core/temps.ts';
import type { Config } from '../src/core/types.ts';

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..');

/** Les fichiers de saisie autorisés : la battle de problèmes et les disciplines manuelles. */
export function fichiersPermis(config: Config): string[] {
  return ['echecs-battle', ...(config.manuelles ?? []).map((m) => m.cle)];
}

/** Valide une saisie. Lève une erreur lisible : elle est renvoyée telle quelle à celui qui a saisi. */
export function construire(
  config: Config, fichier: string, gagnant: string, score: string | undefined, date: string | undefined,
  note: string | undefined, aujourdhui: string,
): Saisie {
  const [a, b] = config.joueurs.map((j) => j.cle);
  if (!fichiersPermis(config).includes(fichier)) {
    throw new Error(`Discipline inconnue : « ${fichier} ». Possibles : ${fichiersPermis(config).join(', ')}.`);
  }
  const g = gagnant.trim().toLowerCase();
  const cle = g === 'nul' ? null : config.joueurs.find((j) => j.cle === g || j.nom.toLowerCase() === g)?.cle;
  if (cle === undefined) throw new Error(`Gagnant inconnu : « ${gagnant} ». Attendu : ${a}, ${b} ou nul.`);

  const saisie: Saisie = { date: date?.trim() || aujourdhui, gagnant: cle };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(saisie.date) || Number.isNaN(Date.parse(saisie.date))) {
    throw new Error(`Date illisible : « ${saisie.date} ». Format attendu : AAAA-MM-JJ.`);
  }
  if (saisie.date > aujourdhui) throw new Error(`La date ${saisie.date} est dans le futur.`);

  if (score?.trim()) {
    const m = score.trim().match(/^(\d{1,4})\s*[-–:]\s*(\d{1,4})$/);
    if (!m) throw new Error(`Score illisible : « ${score} ». Format attendu : 12-9.`);
    const [sa, sb] = [Number(m[1]), Number(m[2])];
    const attendu = sa === sb ? null : sa > sb ? a : b;
    if (attendu !== cle && !(sa === sb && cle !== null)) {
      throw new Error(`Le score ${sa}-${sb} (${a}-${b}) ne correspond pas au gagnant annoncé.`);
    }
    saisie.score = { [a]: sa, [b]: sb };
  }
  const n = note?.trim().replace(/\s+/g, ' ').slice(0, 140);
  if (n) saisie.note = n;
  return saisie;
}

/** Lit un formulaire d'issue GitHub : des blocs « ### Titre » suivis de la réponse. */
export function lireFormulaire(corps: string): Record<string, string> {
  const champs: Record<string, string> = {};
  for (const bloc of corps.split(/^### /m).slice(1)) {
    const [titre, ...reste] = bloc.split('\n');
    const valeur = reste.join('\n').trim();
    champs[titre.trim().toLowerCase()] = valeur === '_No response_' ? '' : valeur;
  }
  return champs;
}

async function main() {
  const config = JSON.parse(await readFile(join(RACINE, 'classico.json'), 'utf8')) as Config;
  const aujourdhui = paris(Date.now() / 1000).jour;
  let fichier: string, saisie: Saisie;
  if (process.argv.includes('--issue')) {
    const f = lireFormulaire(process.env.ISSUE_BODY ?? '');
    fichier = (f['discipline'] ?? '').trim();
    saisie = construire(config, fichier, f['gagnant'] ?? '', f['score'], f['date'], f['note'], aujourdhui);
  } else {
    const [f, gagnant, score, date, note] = process.argv.slice(2);
    if (!f || !gagnant) throw new Error('Usage : npm run resultat -- <discipline> <gagnant|nul> [score] [AAAA-MM-JJ] [note]');
    fichier = f;
    saisie = construire(config, f, gagnant, score, date, note, aujourdhui);
  }
  const chemin = join(RACINE, 'saisies', `${fichier}.json`);
  let liste: Saisie[] = [];
  try { liste = JSON.parse(await readFile(chemin, 'utf8')); } catch { /* premier résultat de la discipline */ }
  liste.push(saisie);
  liste.sort((x, y) => (x.date < y.date ? -1 : x.date > y.date ? 1 : 0));
  await writeFile(chemin, `[\n${liste.map((s) => `  ${JSON.stringify(s)}`).join(',\n')}\n]\n`);
  const qui = saisie.gagnant ? `victoire de ${saisie.gagnant}` : 'match nul';
  const score = saisie.score ? ` (${Object.values(saisie.score).join('-')})` : '';
  console.log(`Enregistré dans saisies/${fichier}.json : ${qui}${score}, le ${saisie.date}.`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((e) => { console.error((e as Error).message); process.exit(1); });
}
