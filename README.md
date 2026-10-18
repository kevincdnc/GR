# Routdoor · Printrace

Deux produits, un même code et un même design system :

- **Routdoor** — créer, importer et modifier ses itinéraires (né du suivi de mon GR34, le sentier des douaniers).
  En ligne : https://kevincdnc.github.io/GR/ · statistiques : https://kevincdnc.github.io/GR/#metrics
- **Printrace** — transformer un tracé (GPX, FIT, lien Strava, ou envoyé depuis Routdoor) en poster
  vectoriel prêt à imprimer. En ligne : https://kevincdnc.github.io/GR/printrace/
- **Design system** — fondations et composants communs, documentation vivante :
  https://kevincdnc.github.io/GR/design-system/

L'interface de Routdoor vient d'un prototype Claude Design (README d'origine dans
[`docs/design-handoff.md`](docs/design-handoff.md)). Thème sombre par défaut, typographie Barlow (texte)
et Barlow Semi Condensed (chiffres, titres), servies avec le site.

## Organisation du code

| Dossier / fichier | Rôle |
|---|---|
| `index.html`, `src/*.jsx` | Routdoor (carte, itinéraires, stats, partage story / embed / lien) |
| `printrace.html`, `src/printrace/` | Printrace : navigation, bibliothèque de tracés, import (fichier, lien Strava, Routdoor) |
| `src/poster-share.jsx`, `src/poster-map.jsx` | Studio poster (modèles, carte vectorielle, export PNG / SVG), utilisé par Printrace |
| `src/ds/tokens.css`, `src/ds/ui.jsx` | Design system : jetons (couleurs, rayons, typo) et composants `Ui*` |
| `design-system.html`, `src/ds/showcase.jsx` | Documentation vivante du design system |
| `src/track-io.jsx`, `lib/gpx.mjs` | Lecture des fichiers de trace (GPX, FIT, TCX, KML/KMZ, GeoJSON, IGC) |
| `src/printrace-bridge.jsx` | « Envoyer sur Printrace » depuis Routdoor (tracés dans le lien `#t=…`) |
| `workers/strava/` | Relais Strava optionnel (import direct depuis un lien d'activité) |

Toute nouvelle page réutilise le design system : composants `Ui*` de `src/ds/ui.jsx` et
fondations de `ds.css`, plutôt que des styles écrits à la main.

## Ce qui est réel / simulé

| Fonction | État |
|---|---|
| Étapes GR34 (traces, distance, D+/D−, profil d'altitude) | **Réel**, calculé depuis `gpx/*.gpx` |
| Statistiques (bouton *Stats*) : tableau triable, km effort, durées, graphiques | **Réel** |
| Fonds de carte (*Cartes* → Plan OSM France, Topo, IGN, Routière IGN, Relief, Photos IGN, Satellite, Sombre, Hiver), surcouche *Sentiers balisés* (GR, GRP, PR — Waymarked Trails) et opacité du fond (0–100 %) | **Réel** |
| Zoom (jusqu’à 20, continu et fluide à la molette / au trackpad), géolocalisation | **Réel** |
| Import de traces GPX, FIT, TCX, KML / KMZ, GeoJSON, IGC (un ou plusieurs à la fois, un tracé par fichier) | **Réel** (analysés dans le navigateur) |
| Création / édition d'itinéraires, sections, repères, groupes, glisser-déposer | Réel, sauvegardé dans le navigateur |
| Sélection multiple (Maj+clic, Cmd/Ctrl+clic) : couleur, fusion, duplication | **Réel** |
| Recherche de lieu | Réel (Nominatim) |
| Tracé à la main : tracé automatique sur sentiers / chemins / routes (BRouter, OpenStreetMap) et altitudes réelles (Open-Meteo, MNT Copernicus) | **Réel** (services en ligne ; ligne droite si indisponibles) |
| Partage en story (menu ⋯ d'une activité ou d'un groupe, bouton *Partager* des stats) : 10 modèles 1080×1920, données affichées au choix, photo de fond, export PNG / copie / partage natif | **Réel** (rendu dans le navigateur) |
| Strava / Komoot / Garmin (Routdoor) | Simulé, comme dans le design |
| Printrace : import GPX / FIT…, bibliothèque, cases à cocher, studio poster | **Réel**, enregistré dans le navigateur |
| Printrace : lien d'activité Strava | Parcours guidé (export GPX du compte Strava puis dépôt) ; import direct avec le relais `workers/strava` une fois déployé |
| Routdoor → Printrace (« Envoyer sur Printrace ») | **Réel** (tracés transmis dans le lien) |
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
| `lib/gpx.mjs` | Lecture des traces (GPX, FIT, TCX, KML, GeoJSON, IGC) + métriques (build et import dans le navigateur) |
| `scripts/build.mjs`, `scripts/dev.mjs` | Build et serveur de dev |

Le site est publié sur GitHub Pages par `.github/workflows/deploy.yml` à chaque push.
