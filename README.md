# GR34 Tracker

Petite app perso pour visualiser les étapes de mon GR34 (sentier des douaniers).

- **Carte** : toutes les traces GPX sur fond IGN Plan, IGN photos aériennes, OpenTopoMap, OSM, CyclOSM ou satellite.
  Zoom jusqu'au niveau 21 (pas de 0,25), échelle, coordonnées du curseur, géolocalisation, plein écran.
  Clique sur une étape pour zoomer dessus et afficher son profil altimétrique (survol synchronisé carte ↔ profil).
- **Metrics** : totaux, tableau triable (distance, D+, D−, km effort, durée, vitesse, allure effort, D+/km, alt. max)
  et graphiques (distance vs km effort, cumuls, D+, durée).

## Ajouter une étape

Dépose le fichier `.gpx` dans le dossier [`gpx/`](gpx/). C'est tout : les métriques sont calculées au build
(et à chaud en dev). Le numéro d'étape est lu dans le nom de la trace (`#6`) ou dans le nom de fichier (`GR34_6_…`).

## Dates et durées réelles

Les traces Strava « itinéraire » n'ont pas d'horodatage : la durée est alors **estimée** avec l'allure réglable
dans l'onglet Metrics (4 km effort/h par défaut). Tu peux saisir ta date et ta durée réelle (`7h30`, `7:30`, `450`)
directement dans le tableau — c'est gardé dans ton navigateur. Pour les rendre permanentes / visibles partout,
clique sur **Exporter etapes.json** et remplace [`gpx/etapes.json`](gpx/etapes.json) :

```json
{
  "1": { "date": "2026-08-09", "duree": "9h45" },
  "2": { "date": "2026-08-10", "duree": "7h10", "notes": "Pluie l'après-midi" }
}
```

Priorité de la durée : saisie > horodatages GPX (temps en mouvement) > estimation.

## Calculs

- **Distance** : somme haversine sur la trace complète.
- **D+ / D−** : altitudes rééchantillonnées tous les 10 m, lissées sur ±20 m, puis hystérésis de 1 m
  (le bruit GPS/MNT multiplie sinon le D+ par 3 à 10 sur une trace côtière).
- **Km effort** = km + D+/100.

## Lancer en local

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # site statique dans dist/
```

## Mise en ligne

Le site est 100 % statique (`dist/`). Le workflow `.github/workflows/deploy.yml` le publie sur GitHub Pages
à chaque push sur `main` (activer *Settings → Pages → Source : GitHub Actions*). Ça marche aussi tel quel
sur Netlify / Vercel / Cloudflare Pages (commande `npm run build`, dossier `dist`).
