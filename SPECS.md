# Le Classico — Specs produit

Version 1.0 du 15 novembre 2026. Livrée en une fois.

## 1. Vision

Le Classico est le tableau de marque d'une rivalité : Pierrot contre Fabos, toutes disciplines confondues. On l'ouvre, on sait en trois secondes qui a le dessus, et on repart avec une phrase à envoyer à l'autre.

Il descend du Vestiaire (le classement d'échecs du groupe), mais change de sujet. Le Vestiaire classe un groupe dans un sport. Le Classico oppose deux personnes dans tous les sports où elles se croisent.

**Le travail du produit.** Répondre à quatre questions, dans cet ordre :

1. Qui mène, là, maintenant ?
2. Qui gagne ce mois-ci, et qu'est-ce qu'il y a en jeu ?
3. Qu'est-ce que je peux lui envoyer pour l'énerver ?
4. Qu'est-ce qu'il va me répondre ?

**Principes.**

- Un duel, un score. Tout se ramène à deux chiffres face à face.
- Chaque statistique est une munition. Si elle ne sert ni à se vanter ni à chambrer, elle n'est pas affichée.
- L'app prend parti. Elle sait qui la regarde et lui prépare ses arguments.
- Le retard se rattrape. Un score figé depuis toujours tue le jeu : les saisons remettent les compteurs à zéro chaque mois.
- Brancher un sport ne touche ni au moteur ni à l'interface.
- On chambre les résultats, jamais les personnes.

## 2. Périmètre

**Livré.**

- Score général par ceintures, toutes disciplines confondues.
- Saisons mensuelles, palmarès et gage du perdant.
- Échecs : Elo des trois cadences, face-à-face, record aux problèmes, Puzzle Rush, battle de problèmes.
- Fléchettes : face-à-face, moyenne en X01, plus gros checkout, depuis Bullcast.
- Munitions classées par force, selon le camp choisi, et les ripostes à prévoir.
- Fil d'actu, trophées, affiche partageable en image, notifications ntfy.
- Disciplines manuelles sans code (ping-pong, pétanque…) et déclaration d'un résultat depuis le téléphone.

**Non livré.**

- Comptes, paris, commentaires.
- Interface de groupe : le modèle accepte plus de deux joueurs, l'interface n'affiche qu'un duel à la fois (section 9).
- Analyse des parties ou des volées.

## 3. Le modèle de compétition

Deux compteurs coexistent. Le premier dit qui est le plus fort ; le second, qui a gagné récemment.

### 3.1 Les ceintures : le score général

Chaque discipline met en jeu des **épreuves**. Chaque épreuve a une **ceinture**, tenue par celui qui est devant.

| Genre | La ceinture va à | Exemples |
|---|---|---|
| Mesure | Celui qui a la meilleure valeur aujourd'hui | Elo rapide, Puzzle Rush, moyenne en X01 |
| Duel | Celui qui mène aux confrontations directes, sur tout l'historique | Face-à-face aux échecs, battle de problèmes |

- Une ceinture **majeure** vaut 2 points, une **mineure** 1 point. Les épreuves de duel sont majeures : battre l'autre compte plus que le dépasser.
- À égalité, la ceinture est vacante. Un joueur non classé ne tient rien.
- Le score général est la somme des points des ceintures tenues. C'est le chiffre affiché en grand.

Ce score bouge de deux façons : en gagnant un duel, ou en progressant seul (monter à l'Elo, battre un record). Les deux comptent, pour que jouer sans l'autre serve aussi.

### 3.2 Les saisons : le rythme

- Une saison dure un mois civil, heure de Paris.
- Chaque confrontation directe rapporte **3 points** au vainqueur, **1 point** chacun en cas de nul, quelle que soit la discipline.
- Une confrontation peut porter un **poids**, qui multiplie ces points. Aux échecs : rapide ×3, blitz ×2, bullet ×1. Une victoire en rapide rapporte donc 9 points de saison, en bullet 3. Les autres confrontations (fléchettes, battles) pèsent 1.
- À la fin du mois, le premier gagne la saison. Égalité : saison partagée.
- Le perdant doit un **gage**, tiré dans la liste de `classico.json`. Le tirage dépend du mois : le gage est connu dès le premier jour, il ne change pas en cours de route.
- Le **palmarès** compte les saisons gagnées.

Un mois sans duel n'a pas de vainqueur et n'apparaît pas dans l'historique.

### 3.3 Trophées

Acquis définitivement. Douze trophées communs, plus ceux de chaque discipline.

| Trophée | Condition |
|---|---|
| Le Premier sang | Gagner la toute première confrontation |
| Le Coup du chapeau, La Manita, Le Rouleau compresseur | 3, 5, 10 victoires de suite, toutes disciplines confondues |
| Le Briseur de série | Arrêter une série adverse de 5 victoires ou plus |
| Le Cinquantenaire | 50 victoires en confrontation directe |
| Le Champion du mois, Le Triplé | Gagner une saison ; en gagner 3 de suite |
| La Fanny | Gagner une saison sans laisser un point (3 confrontations minimum) |
| Le Hold-up | Gagner une saison avec 3 points d'écart ou moins (5 confrontations minimum) |
| Le Couteau suisse | Gagner dans chaque discipline le même mois |
| Le Grand Chelem | Tenir toutes les ceintures en même temps |
| Le Fossoyeur (échecs) | Mater l'autre en moins de 20 coups |
| One hundred and eighty (fléchettes) | Claquer un 180 |
| Le Gros poisson (fléchettes) | Finir sur un checkout de 100 ou plus |

## 4. Disciplines

### 4.1 Échecs

Source : API publique de chess.com. Comptes : `bi3rmat` (Pierrot), `fabosinho` (Fabos).

| Épreuve | Genre | Poids | Règle |
|---|---|---|---|
| Elo rapide, blitz, bullet | Mesure | Mineure | Elo actuel de la cadence |
| Face-à-face aux échecs | Duel | Majeure | Toutes les parties entre les deux, classées ou non. Une victoire en rapide pèse 3, en blitz 2, en bullet 1 : la ceinture va à celui qui a le plus de points, pas le plus de victoires |
| Record aux problèmes | Mesure | Mineure | Plus haut classement atteint aux problèmes |
| Puzzle Rush | Mesure | Mineure | Meilleur score |
| Battle de problèmes | Duel | Majeure | Résultats déclarés à la main |

**Limite connue.** chess.com ne publie pas les résultats des battles de problèmes, ni le classement courant aux problèmes (seulement le record). Les battles sont donc déclarées par les joueurs (section 4.3). Le jour où chess.com les expose, seul le collecteur des échecs change.

Hors ceintures, pour les munitions : record d'Elo par cadence, plus longue série de victoires, pire série de défaites, nombre de parties.

### 4.2 Fléchettes

Source : Bullcast. Comptes : `pierrot` et `fabos`.

| Épreuve | Genre | Poids | Règle |
|---|---|---|---|
| Face-à-face aux fléchettes | Duel | Majeure | Parties à deux places exactement, tenues par les deux joueurs, tous modes de jeu |
| Moyenne en X01 | Mesure | Mineure | Points par volée de trois fléchettes, sur toutes les parties X01 (30 fléchettes minimum) |
| Plus gros checkout | Mesure | Mineure | Plus haute finition en X01 |

Hors ceintures : nombre de 180, meilleur leg, marques par manche au cricket, nombre de parties. Les parties d'entraînement contre le bot et les parties signalées comme douteuses par Bullcast sont exclues.

**Accès aux données.** Bullcast n'a pas de route publique pour l'historique d'un joueur. Le collecteur lit sa base en lecture seule, avec un jeton Cloudflare limité à cet usage. Il n'en sort que le mode de jeu, la date, le rang et les statistiques de chaque place ; aucune adresse, aucun identifiant de compte, et le nom des autres joueurs n'est pas conservé. Sans jeton, la discipline s'affiche « pas encore branchée » et ne compte pour personne.

### 4.3 Résultats déclarés

Pour ce que personne ne publie à notre place. Un résultat est une ligne dans `saisies/{discipline}.json` : date, gagnant, score et note facultatifs. Trois façons de l'ajouter :

- depuis l'app : fiche de la discipline, « Déclarer un résultat », qui ouvre un formulaire GitHub prérempli ;
- en ligne de commande : `npm run resultat -- echecs-battle pierrot 12-9` ;
- en modifiant le fichier.

Seuls le propriétaire du dépôt et ses collaborateurs peuvent déclarer. Chaque déclaration laisse une trace publique : c'est le vainqueur qui déclare, et le perdant qui vérifie.

### 4.4 Brancher une nouvelle discipline

**Sans code** (résultats déclarés) : une ligne dans `manuelles` de `classico.json`, et sa clé dans `disciplines`. Elle arrive avec une ceinture majeure de face-à-face, et entre dans les saisons, le fil, les munitions et les trophées.

**Avec code** (source de données) : un objet `Discipline` avec deux fonctions.

```ts
type Discipline<Brut> = {
  cle: string; nom: string; emoji: string;
  collecter(ctx: Contexte): Promise<Brut>;                          // réseau et disque
  calculer(brut: Brut, config: Config, maintenant: number): BilanDiscipline;  // pur, testé
};
```

`calculer` renvoie un bilan : les épreuves, les confrontations, des statistiques comparées, des trophées. Le moteur fait le reste. Aucun écran ne connaît le nom d'un sport.

## 5. Architecture

Même socle que le Vestiaire : pas de serveur à maintenir.

```
 chess.com ──┐
 Bullcast ───┼──► Collecteur (GitHub Actions, toutes les 30 min)
 saisies/ ───┘       • interroge chaque discipline
                     • calcule l'instantané (moteur)
                     • compare au passage précédent, détecte ce qui a bougé
                     • envoie les notifications
                     • publie instantane.json
                              │
                              ▼
                     App web (GitHub Pages) : lit instantane.json
```

| Brique | Choix |
|---|---|
| App web | React, Vite, TypeScript, CSS natif |
| Collecteur | Script Node lancé par GitHub Actions |
| Stockage | Branche `donnees` du dépôt (parties compactées, instantané précédent) |
| Hébergement | GitHub Pages |
| Tests | Vitest sur le moteur et sur le calcul de chaque discipline |

Une discipline en panne ne fait pas tomber les autres : elle garde son bilan précédent et affiche un avertissement.

Deux familles d'événements alimentent le fil. Ceux qui se déduisent de l'historique (un duel, une ceinture de face-à-face qui bascule, une série, une fin de saison) sont recalculés à l'identique à chaque passage. Ceux qui naissent d'un changement d'état (un Elo qui passe devant l'autre, le général qui change de meneur) sont détectés par comparaison avec l'instantané précédent, puis conservés.

## 6. Écrans

Quatre onglets en bas d'écran.

### 6.1 Le ring (accueil)

```
┌──────────────────────────────┐
│ LE CLASSICO      il y a 4 min │
│ ╲ (P)            (F) ╱       │
│  ╲ PIERROT 1 : 6 FABOS       │
│   challenger   tenant du titre│
│ ──●────────────────────────  │  la corde
│ Fabos mène 6-1. On hésite à  │
│ appeler ça un duel.  Envoyer │
│ Les derniers duels  F F P F… │
│ Saison de novembre  0 – 0  › │
│ ♟ Échecs               1 – 6 │
│ 1535   Elo rapide     • 1571 │
│ 1141 • Elo blitz        1090 │
│ 7   Face-à-face ×2       • 9 │
│ 🎯 Fléchettes          0 – 0 │
├──────────────────────────────┤
│ Ring  Saisons Chambrage  Fil │
└──────────────────────────────┘
```

- Le score général, les deux joueurs, et qui est tenant du titre.
- La corde : une barre où chacun tire de son côté. Le nœud montre le rapport de force.
- L'accroche : une phrase qui résume l'état du duel, avec son bouton d'envoi.
- Les douze derniers duels, un jeton par duel, de la couleur du vainqueur.
- La saison en cours et le gage en jeu.
- Une carte par discipline : chaque ceinture sur une ligne, la valeur de chacun de part et d'autre. Un tap ouvre la fiche de la discipline (détail des ceintures, statistiques comparées, historique des duels, déclaration d'un résultat).
- Un tap sur un joueur ouvre sa fiche : ses ceintures, ses trophées, ses profils.

### 6.2 Saisons

La saison en cours (points, victoires par discipline, gage, jours restants), le palmarès, les saisons passées avec leur gage, et la règle en trois lignes.

### 6.3 Chambrage

- « Je suis Pierrot » ou « Je suis Fabos » : le choix est mémorisé sur l'appareil.
- **Tes munitions** : tout ce qui est à ton avantage, du plus fort au plus anecdotique, chacun avec « Envoyer à l'autre ».
- **Ce qu'il va te ressortir** : ses munitions à lui, pour préparer la défense.
- **L'affiche du moment** : le score, l'accroche et les ceintures en une image, pour le partage du téléphone.
- L'abonnement aux notifications.

### 6.4 Le fil

Les événements par jour, du plus récent au plus ancien. Ceux survenus depuis la dernière visite sont encadrés, et leur nombre s'affiche sur l'onglet.

## 7. Chambrage : les règles d'écriture

| Événement | Exemple |
|---|---|
| Duel | « Fabos s'offre Pierrot (Bullet). Ça fait 8-6. » |
| Ceinture de face-à-face qui bascule | « Fabos s'empare de la ceinture "Face-à-face aux échecs" : 7-6. » |
| Égalisation | « Pierrot recolle : 6 partout. La ceinture est vacante. » |
| Ceinture de mesure qui change de main | « Pierrot prend la ceinture "Elo blitz" : 1141 contre 1090. » |
| Changement de meneur au général | « Le Classico change de patron. Pierrot mène 6-5. » |
| Série | « 5 de rang pour Fabos. Pierrot cherche l'interrupteur. » |
| Fin de saison | « Pierrot remporte la saison de mai, 13-10. Gage pour Fabos : … » |
| Trophée | « Pierrot décroche Le Hold-up. » |

- Chaque type a plusieurs formulations. Le choix dépend de l'identifiant de l'événement : il est stable d'un passage à l'autre.
- La vanne suit le fait, jamais l'inverse. Le chiffre est toujours dans la phrase.
- Tutoiement, phrases courtes, pas de point d'exclamation.
- Les erreurs restent sérieuses : « La collecte a échoué : les chiffres datent du dernier passage réussi. »

**Notifications.** Duel, bascule de ceinture, changement de meneur, série de 5 et plus, fin de saison. Rien entre 23 h et 8 h, six messages par jour au maximum, puis un message de synthèse.

## 8. Design

**Parti pris : l'affiche de gala, la nuit.** Un fond presque noir, deux couleurs qui s'affrontent (une par coin, réglables dans `classico.json`), et l'or pour ce qui se gagne. Le Vestiaire était un album de vignettes, bleu et joueur ; le Classico est un face-à-face, tendu.

| Élément | Choix |
|---|---|
| Fond | Nuit `#0F0E13`, surfaces `#1A1921` |
| Texte | Papier `#F6EFE0`, secondaire `#A8A498` |
| Coin de Pierrot | `#FF5A3C` |
| Coin de Fabos | `#3D8BFF` |
| Ce qui se gagne | Or `#F2C230` |
| Titres et chiffres | Anton, en capitales |
| Texte courant | Archivo, chiffres tabulaires |

- L'audace est concentrée sur le tableau de marque : les deux diagonales de couleur et le score en très grand. Le reste est calme.
- La couleur d'un joueur ne porte jamais seule l'information : le tenant d'une ceinture est aussi marqué d'un point, et nommé pour les lecteurs d'écran.
- Conçu pour 360 px de large, colonne de 560 px au-delà. Zones tactiles de 44 px, marges de sécurité, `prefers-reduced-motion` respecté.

## 9. Ouvrir à d'autres joueurs

Le produit est un face-à-face ; la technique ne l'impose pas.

- `classico.json` accepte autant de joueurs qu'on veut. Le moteur calcule un duel par paire.
- Les ceintures, les saisons, les munitions et les trophées sont attachés à une paire.
- Avec plus d'un duel, un sélecteur apparaît dans l'en-tête.
- Ce qu'il resterait à concevoir pour un vrai mode groupe : un classement général entre les paires, et des épreuves à plus de deux (une partie de fléchettes à trois ne compte aujourd'hui pour aucun duel).

## 10. Cas limites

| Cas | Comportement |
|---|---|
| Source en panne | La discipline garde son dernier bilan, avec un avertissement |
| Bullcast pas branché | La discipline est visible, ses ceintures sont vacantes |
| Égalité sur une épreuve | Ceinture vacante |
| Joueur non classé dans une épreuve | Il ne tient pas la ceinture ; l'autre la prend s'il est classé |
| Mois sans duel | Pas de vainqueur, pas dans l'historique |
| Résultat déclaré incohérent (score contraire au gagnant, date future) | Refusé, avec l'explication dans l'issue |
| Premier passage du collecteur | L'historique est reconstitué, sans notification |
| Collecteur en retard de plus de 3 heures | Avertissement dans l'app |
