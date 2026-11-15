# Le Classico

Pierrot contre Fabos, toutes disciplines confondues : le score général, les ceintures, les saisons, les gages et de quoi chambrer.

En ligne : https://bierr0t.github.io/le-classico/

Les specs complètes sont dans [SPECS.md](SPECS.md). Le projet reprend le socle du [Vestiaire](https://github.com/Bierr0t/le-vestiaire).

## Comment ça marche

- `scripts/collecte.ts` interroge chaque discipline, calcule `instantane.json` et envoie les notifications ntfy.
- GitHub Actions le lance toutes les 30 minutes, sauvegarde les données sur la branche `donnees` et publie l'app sur GitHub Pages.
- L'app (`src/web`) affiche l'instantané.
- Les règles vivent dans `src/core` et sont testées : `moteur.ts` pour ce qui est commun, un dossier par discipline dans `src/core/disciplines`.

## En local

```sh
npm install
npm run collecte -- --muet   # télécharge les parties, sans notifier (une à deux minutes la première fois)
npm run dev                  # l'app sur http://localhost:5173
npm test
```

## Déclarer une battle de problèmes

chess.com ne publie pas les résultats des battles. On les déclare :

- depuis l'app : Le ring, Échecs, « Déclarer un résultat » (il faut un compte GitHub invité sur le dépôt) ;
- ou en ligne de commande, puis `git push` :

```sh
npm run resultat -- echecs-battle pierrot 12-9
npm run resultat -- echecs-battle nul 10-10 2026-11-14 "revanche demandée"
```

Le score se lit dans l'ordre des joueurs de `classico.json`.

## Brancher Bullcast

Bullcast n'a pas de route publique pour l'historique d'un joueur. Le collecteur lit donc sa base D1 en lecture seule. Trois secrets à poser une fois sur le dépôt :

```sh
gh secret set CLOUDFLARE_ACCOUNT_ID   # l'identifiant du compte Cloudflare
gh secret set CLOUDFLARE_API_TOKEN    # un jeton créé pour l'occasion, avec le seul droit « D1 : lecture »
gh secret set BULLCAST_D1_ID          # l'identifiant de la base (database_id dans le wrangler.jsonc de Bullcast)
```

Tant qu'ils manquent, les fléchettes s'affichent « pas encore branchées » et leurs ceintures restent vacantes. En local, les mêmes variables d'environnement font la même chose.

Les joueurs sont reconnus par leur identifiant Bullcast (`comptes.bullcast` dans `classico.json`), ou à défaut par leur nom de joueur dans la partie.

## Ajouter une discipline

**Sans code**, pour un sport dont on déclare les résultats à la main. Dans `classico.json` :

```json
"disciplines": ["echecs", "flechettes", "pingpong"],
"manuelles": [{ "cle": "pingpong", "nom": "Ping-pong", "emoji": "🏓" }]
```

Puis `npm run resultat -- pingpong fabos 11-8`.

**Avec code**, pour un sport qui a une source de données :

1. Écrire `src/core/disciplines/<sport>/calcul.ts` (pur, testé) et `collecte.ts` (réseau). Le contrat est dans `src/core/disciplines/contrat.ts`.
2. L'enregistrer dans `src/core/disciplines/index.ts`.
3. Ajouter sa clé à `disciplines` dans `classico.json`.

Le score, les saisons, le fil, les munitions, les trophées et l'interface suivent sans autre changement.

## Ajouter un joueur

Ajouter une entrée à `joueurs` dans `classico.json`. Le moteur calcule un duel par paire, et un sélecteur de duel apparaît dans l'en-tête. L'app reste pensée pour un face-à-face : voir la section 9 des specs.

## Notifications

Le sujet ntfy est dans `classico.json`. Chacun s'y abonne depuis l'onglet Chambrage. Rien n'est envoyé entre 23 h et 8 h, ni plus de six messages par jour.
