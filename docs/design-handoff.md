# Handoff : Mountaya — Map Studio

## Overview
Mountaya est une web app de création, d'import et de partage d'itinéraires outdoor (trail, rando, course, vélo, ski). L'utilisateur organise ses itinéraires en groupes, les trace sur une carte en plusieurs sections, ajoute des points d'intérêt (POI), consulte le profil d'élévation, superpose des couches météo/neige/avalanche et partage via lien public ou iframe.

## À propos des fichiers
Les fichiers de ce bundle sont des **références de design créées en HTML** — des prototypes qui montrent l'apparence et le comportement attendus, **pas du code de production**. La tâche est de **recréer ces designs dans l'environnement du codebase cible** (React/Next.js, Vue, etc.) avec ses patterns et librairies. Si aucun codebase n'existe, choisir le framework le plus adapté (recommandation : React + Vite + TypeScript + Tailwind + MapLibre/Leaflet).

Pour lancer le prototype : servir le dossier en statique (`npx serve .`) et ouvrir `index.html`. JSX transpilé dans le navigateur via Babel standalone ; composants partagés exposés sur `window`.

## Fidelity
**High-fidelity.** Couleurs, typo, espacements et interactions sont finaux. Reproduire pixel-perfect.

## Écrans / Vues

### 1. Layout principal
- Sidebar gauche fixe **340px**, carte plein écran à droite.
- Panneaux flottants sur la carte (contrôles, filtre POI, cartes avancées, graph d'élévation en bas).

### 2. Sidebar (`src/sidebar.jsx`)
- Header : logo Mountaya, tag plan (Free/Pro — clic = toggle thème dans le proto), bouton paramètres.
- Recherche de lieu (Nominatim, `src/place-search.jsx`).
- CTA primaires : « Créer un itinéraire » (classe `.btn-cta-primary` : overlay sombre 10 % au hover, sheen gauche→droite 0,9 s, scale 0.985 à l'active) et « Importer ».
- Liste de **groupes en accordéon** → itinéraires → sections. Drag & drop pour réorganiser.
- Toggles de visibilité tri-state (groupe / itinéraire / section / POI).
- Double-clic = renommage inline. Menu `⋯` : modifier, déplacer, supprimer.
- Stats en Geist Mono (km, D+, durée).
- État vide : `assets/empty-state.svg`.

### 3. Création / édition d'itinéraire (`src/create.jsx`)
- Choix d'activité (icônes style iOS Workout) — **verrouillé après le 1er point posé**.
- Clic carte = ajout de point ; waypoints `.draft-waypoint` (12px, bord 2,5px accent, premier point rempli).
- Multi-sections, chacune aller simple ou aller-retour.
- Repères personnalisés + POI rattachés (magnétisés au tracé), détachables.
- Profil d'élévation live pendant le tracé.
- Champs : nom, groupe, couleur (12 pastilles), confidentialité.

### 4. Import (`src/import.jsx`)
- Upload GPX + intégrations Strava / Komoot / Garmin (logos couleur et gris dans `assets/`).
- Modale listant ~30 parcours par provider, recherche + tri.

### 5. Carte (`src/map.jsx`)
- Leaflet + tuiles CartoDB/OSM. Zoom Leaflet natif masqué (contrôles custom).
- Fonds : topo / hiver / satellite. Surcouches : température, visibilité, humidité, vent, pente/exposition, occupation du sol, ombrage, chute de neige, hauteur de neige, avalanche (vignettes `assets/maps/*.png`).
- Slider historique/prévisions (`.cartes-range`, thumb 16px blanc bord 3px `#3b82f6`).
- Géolocalisation live avec halo pulsé (`mountayaPulse`), popup, recentrage.
- Graph d'élévation (Canvas) segmenté par section ; POI au survol (icône + nom).

### 6. Filtre POI (`src/poi-filter.jsx`)
8 catégories (parking, eau, refuge, etc.). Limité en Free.

### 7. Partage (`src/share.jsx`)
- Lien public.
- Embed iframe personnalisable : couleur (12 pastilles), toggle métriques, watermark, thème clair/sombre, aperçu live + code copiable.

### 8. Paramètres (`src/settings.jsx`)
Profil, préférences (langue, unités distance/température/pente), statut plateforme, liens docs/Slack.

### 9. Onboarding
2 coachmarks (géolocalisation → créer/importer), uniquement en Free, skippable, repositionnés dynamiquement sur la cible. Anneau `.onboard-ring` (pulse 1,6 s), nudge horizontal 5px. Skip persistant en localStorage.

## Interactions & animations
- Menus : `menuIn` 140 ms ease-out (translateY -4px, scale .98 → 1).
- Tooltips : `tipIn` 120 ms ; tooltips fixed : fondu simple.
- Toasts : `toastIn` 250 ms (translateY 12px).
- POI brouillon : halo `poiPulse`.
- Transitions générales 150–250 ms.
- Focus visible : outline 2px `rgba(14,165,233,.6)`, offset 2px.

## State management (cf. `src/app.jsx`)
- `groups[]` → `routes[]` → `sections[]` (coords, type aller/AR), `pois[]`, activité, nom, couleur, confidentialité.
- Visibilité par niveau (tri-state dérivé).
- Mode : consultation / création / édition ; renommage inline.
- Géoloc (active, position, popup).
- Couches carte (fond, surcouches, instant temporel).
- Onboarding (étape, skip).
- Partage (options embed).
- Thème (clair/sombre), plan (Free/Pro).
- Persistance localStorage dans le proto → à remplacer par backend + auth.

### Plans
- **Free** : 1 tracé, filtre POI limité, onboarding.
- **Pro** (9,99 €/mois) : illimité, cartes avancées. Badge `assets/pro-coin.png`.

## Design tokens
- **Primaire** : `#3b82f6` (Tailwind blue-500).
- **Neutres** : palette Tailwind (texte `#0f172a`, slate/neutral pour bordures et fonds). Dark : fonds `#020617`, texte secondaire `#94a3b8`.
- **Accents itinéraires** : 12 couleurs Tailwind (voir `src/data.jsx`).
- **Typo** : Inter 400/500/600/700 (features `cv11, ss01, ss03`) ; Geist Mono 400/500 pour les chiffres.
- **Radius** : 6px (contrôles), 8px, 12px (cartes/panneaux), full (pastilles).
- **Ombres** : douces, type Tailwind `shadow-sm` / `shadow-lg`.
- **Scrollbar** sidebar : 10px, thumb `rgba(100,116,139,.25)` → `.45` au hover.

## Assets
- `assets/logo-mountaya.svg`, `assets/boussole.svg` — marque.
- `assets/strava*.svg`, `komoot*.svg`, `garmin*.svg` — logos providers (couleur + gris).
- `assets/pro-coin.png` — badge Pro.
- `assets/empty-state*.svg` — illustrations état vide.
- `assets/maps/*.png` — vignettes de fonds et surcouches.
- Icônes : SVG inline dans `src/icons.jsx` (~80, style Untitled UI + activités).
- APIs externes : tuiles CartoDB/OSM, Nominatim (géocodage). Météo/neige/avalanche sont simulées → brancher une vraie source.

## Fichiers
- `index.html` — point d'entrée, CSS global, config Tailwind, ordre de chargement.
- `src/app.jsx` — racine, état global, handlers.
- `src/sidebar.jsx` — groupes/itinéraires/sections, menus.
- `src/create.jsx` — tracé, sections, repères.
- `src/import.jsx` — GPX + providers.
- `src/map.jsx` — Leaflet, couches, contrôles, élévation.
- `src/place-search.jsx` — recherche de lieu.
- `src/poi-filter.jsx` — filtre POI.
- `src/share.jsx` — lien + embed.
- `src/settings.jsx` — paramètres.
- `src/icons.jsx` — icônes.
- `src/data.jsx` — helpers (distance, durée, couleurs, données mock).
- `tweaks-panel.jsx` — panneau de réglages du prototype (non destiné à la prod).
