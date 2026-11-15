/**
 * À lancer une seule fois : crée la paire de clés des notifications push.
 *
 *   npm run cles-push
 *
 * La clé privée part directement dans les secrets du dépôt GitHub (elle n'est ni affichée ni écrite sur le disque).
 * La clé publique est écrite dans classico.json : il reste à pousser ce fichier.
 */
import { execFileSync } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as webpush from 'web-push';
import type { Config } from '../src/core/types.ts';

const chemin = join(dirname(fileURLToPath(import.meta.url)), '..', 'classico.json');
const config = JSON.parse(await readFile(chemin, 'utf8')) as Config;

if (config.push?.clePublique && !process.argv.includes('--refaire')) {
  console.error('Les clés existent déjà (push.clePublique dans classico.json).');
  console.error('Les refaire désabonne tous les téléphones : si c\'est voulu, relance avec --refaire.');
  process.exit(1);
}
if (!config.depot) {
  console.error('Il manque « depot » dans classico.json (exemple : "Bierr0t/le-classico").');
  process.exit(1);
}

const cles = webpush.generateVAPIDKeys();
execFileSync('gh', ['secret', 'set', 'VAPID_PRIVATE_KEY', '--repo', config.depot], { input: cles.privateKey, stdio: ['pipe', 'inherit', 'inherit'] });
config.push = { clePublique: cles.publicKey };
await writeFile(chemin, `${JSON.stringify(config, null, 2)}\n`);

console.log('Clé privée enregistrée dans les secrets du dépôt, clé publique écrite dans classico.json.');
console.log('Dernière étape :  git commit -am "Activer les notifications push" && git push');
