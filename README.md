# GPXmap

App perso pour suivre mon GR34 (sentier des douaniers). L'interface vient d'un prototype Claude Design
(README d'origine dans [`docs/design-handoff.md`](docs/design-handoff.md)), renommé GPXmap et simplifié.
Les données démo du prototype sont remplacées par mes vraies étapes. Thème sombre par défaut, navigation
et éléments flottants en verre dépoli au-dessus de la carte plein écran ; typographie
Barlow (texte) et Barlow Semi Condensed (chiffres, titres), servies avec le site.

En ligne : https://kevincdnc.github.io/GR/ · statistiques : https://kevincdnc.github.io/GR/#metrics

## Ce qui est réel / simulé

| Fonction | État |
|---|---|
| Étapes GR34 (traces, distance, D+/D−, profil d'altitude) | **Réel**, calculé depuis `gpx/*.gpx` |
| Statistiques (bouton *Stats*) : tableau triable, km effort, durées, graphiques | **Réel** |
| Fonds de carte (*Cartes* → Plan OSM France, Topo, IGN, Routière IGN, Relief, Photos IGN, Satellite, Sombre, Hiver), surcouche *Sentiers balisés* (GR, GRP, PR — Waymarked Trails) et opacité du fond (0–100 %) | **Réel** |
| Zoom (jusqu’à 20, continu et fluide à la molette / au trackpad), géolocalisation | **Réel** |
| Import de fichiers GPX (un ou plusieurs à la fois, un tracé par fichier) | **Réel** (analysés dans le navigateur) |
| Création / édition d'itinéraires, sections, repères, groupes, glisser-déposer | Réel, sauvegardé dans le navigateur |
| Recherche de lieu | Réel (Nominatim) |
| Altitudes d'un tracé dessiné à la main | Simulé (pas de service d'altitude) |
| Partage en story (menu ⋯ d'une activité ou d'un groupe, bouton *Partager* des stats) : 10 modèles 1080×1920, données affichées au choix, photo de fond, export PNG / copie / partage natif | **Réel** (rendu dans le navigateur) |
| Strava / Komoot / Garmin | Simulé, comme dans le design |
| Panneau « Réglages design » (mode sombre, accent, densité) | Visible seulement dans l'éditeur Claude Design |

## Ajouter une étape

Déposer le `.gpx` dans [`gpx/`](gpx/). Au prochain build, l'étape s'ajoute au groupe GR34, comme un itinéraire à part (le numéro
est lu dans le nom de la trace `#6` ou du fichier `GR34_6_…`). Les dates et durées réelles se saisissent dans
*Stats* ; le bouton **Exporter etapes.json** donne le fichier à mettre dans `gpx/etapes.json` pour les garder.

Calculs : distance haversine sur la trace complète ; altitudes rééchantillonnées tous les 10 m et lissées sur
±20 m, D+/D− avec hystérésis de 1 m ; km effort = km + D+/100 ; durée estimée = formule du design (4,2 km/h +
1 min par 10 m de D+), remplacée par les horaires du GPX ou la durée saisie quand elles existent.

## Développement

```bash
npm install
npm run dev            # http://localhost:5173, reconstruit à chaque modification (recharger la page)
npm run build          # site statique dans dist/
npm run preview:file   # tout en un seul fichier : preview/gr34.html
```

Le prototype chargeait ses `.jsx` avec Babel dans le navigateur. `scripts/build.mjs` fait la même
transformation à la compilation (presets `react` + `env`, un `<script>` classique par fichier, même ordre que
`index.html`), compile Tailwind 3.4 et sert React / Leaflet depuis `node_modules` : le comportement reste celui
du design, sans dépendre de CDN.

| Fichier | Rôle |
|---|---|
| `index.html`, `src/*.jsx`, `tweaks-panel.jsx`, `assets/` | Interface issue du prototype (modifiée là où elle est branchée sur les vraies données) |
| `src/metrics.jsx` | Vue Statistiques GR34 |
| `src/story-share.jsx` | Partage en story : modèles, aperçu en direct, export PNG |
| `lib/gpx.mjs` | Parseur GPX + métriques (build et import dans le navigateur) |
| `scripts/build.mjs`, `scripts/dev.mjs` | Build et serveur de dev |

Le site est publié sur GitHub Pages par `.github/workflows/deploy.yml` à chaque push.
