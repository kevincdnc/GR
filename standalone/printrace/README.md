# Printrace

Vos tracés GPX, FIT, TCX, KML, Strava ou Komoot transformés en posters prêts à imprimer — **https://printrace.app**

Ce dépôt contient uniquement le produit Printrace, extrait du dépôt [`kevincdnc/GR`](https://github.com/kevincdnc/GR) (qui garde Routdoor et le hub) :

| URL        | Page                                   | Source        |
|------------|----------------------------------------|---------------|
| `/`        | site de présentation (pré-rendu HTML)  | `index.html`  |
| `/studio/` | studio : éditeur de posters            | `studio.html` |
| `/login/`  | connexion                              | `login.html`  |

## Démarrer

Node.js 22 (`.node-version` / `.nvmrc`).

```bash
npm ci          # installation (lockfile)
npm run dev     # build + serveur sur http://localhost:5173 (reconstruit à chaque modification)
npm run build   # build de production dans dist/
```

`npm run preview:file` produit aussi `preview/*.html` : une page = un fichier autonome (tout en ligne), pratique pour un aperçu hors serveur.

## Organisation

```
index.html, studio.html, login.html   pages (scripts dans l'ordre de chargement)
printrace.config.mjs                  configuration de build (variables d'environnement)
src/
  ds/            design system (tokens.css → dist/ds.css, composants ui.jsx)
  site/          site de présentation, textes, mode édition (?edit)
  studio/        studio (app.jsx) et fichiers d'impression (print.jsx : PDF/PNG/SVG)
  printrace/     connexion, compte, bibliothèque de tracés, imports (fichiers, Strava, Komoot)
  poster-share.jsx, story-share.jsx, poster-map.jsx   moteur de rendu des posters et cartes vectorielles
  share-link.jsx tracés dans le lien (#t=…), format partagé avec Routdoor
  track-io.jsx, data.jsx, icons.jsx                    utilitaires partagés
lib/gpx.mjs      lecture GPX / FIT / TCX / KML (exposée au navigateur : window.GpxLib)
content/site.json  textes du site modifiés en mode édition
assets/          images, logos, posters d'exemple de la page de connexion
workers/strava/  relais Strava (Cloudflare Worker, optionnel)
scripts/         build.mjs, dev.mjs ; insta/ (génération ponctuelle des visuels Instagram du site)
```

Les fichiers `.jsx` sont des scripts classiques qui partagent la portée globale (héritage du prototype) : le build les compile avec Babel puis réunit les scripts de chaque page dans un seul fichier minifié (`dist/js/site.min.js`, `studio.min.js`, `login.min.js`). Les pages des sous-dossiers ont un `<base href="../">` : tous les chemins de ressources partent de la racine du site. Les émojis des posters (Apple) sont copiés depuis `emoji-datasource-apple` dans `dist/assets/emoji/`, les polices depuis `@fontsource/*` dans `dist/fonts/`.

## Configuration

Tout passe par des variables d'environnement lues au build (`printrace.config.mjs`). Aucune n'est secrète : elles finissent dans le HTML ou dans `dist/data/config.js` (`window.PRINTRACE_CONFIG`).

| Variable | Rôle | Par défaut |
|----------|------|------------|
| `PRINTRACE_SITE_URL` | URL publique : canonical, Open Graph, JSON-LD, `sitemap.xml`, `robots.txt` (`none` : omises) | `https://printrace.app/` |
| `PRINTRACE_ROUTDOOR_URL` | adresse de Routdoor (liens « créer / modifier un itinéraire ») | `https://kevincdnc.github.io/GR/routdoor/` |
| `PRINTRACE_STRAVA_API` | adresse du relais Strava (`workers/strava`) | vide : parcours guidé (export GPX puis dépôt) |
| `PRINTRACE_GOOGLE_CLIENT_ID` | identifiant client OAuth « Web » de Google | vide : session de démonstration |
| `PRINTRACE_UNSPLASH_KEY` | « Access Key » Unsplash (photos du site), visible côté client | vide : photos du dépôt |
| `PRINTRACE_CONTENT_REPO`, `PRINTRACE_CONTENT_BRANCH` | dépôt et branche où le mode édition publie `content/site.json` | `kevincdnc/printrace`, `main` |

Exemple (préproduction) : `PRINTRACE_SITE_URL=https://<projet>.pages.dev/ npm run build`.

Ne mettez jamais de secret dans ces variables ni dans le dépôt : le secret Strava reste dans le worker (`wrangler secret put`), le jeton GitHub du mode édition est saisi par l'administrateur dans son navigateur.

### Recevoir un tracé de Routdoor

Routdoor (dépôt GR) envoie ses tracés dans le lien : `https://printrace.app/studio/#t=<données>&a=<activité>&src=routdoor`. Le studio les ajoute à la bibliothèque et passe au choix du modèle. Pour que Routdoor vise ce site, son lien « Envoyer sur Printrace » doit pointer vers `https://printrace.app/studio/` (dans GR : `src/printrace-bridge.jsx`, constante `printraceBase`).

### Relais Strava (optionnel)

Voir `workers/strava/README.md`. Renseigner `ALLOWED_ORIGINS` (wrangler.toml) avec l'URL du site, puis `PRINTRACE_STRAVA_API` côté build.

## Déploiement Cloudflare Pages

1. *Workers & Pages → Create → Pages → Connect to Git* : choisir ce dépôt.
2. Réglages de build :
   - Framework preset : *None*
   - Build command : `npm run build`
   - Build output directory : `dist`
   - Variables : `NODE_VERSION=22` (le fichier `.node-version` suffit normalement). `PRINTRACE_SITE_URL` vaut `https://printrace.app/` par défaut ; pour les déploiements de prévisualisation, on peut la régler sur l'adresse `*.pages.dev` (environnement *Preview*).
3. Domaine : *Custom domains → Set up a custom domain* → `printrace.app` (et `www.printrace.app`, à rediriger vers `printrace.app` par une règle de redirection Cloudflare). Si le domaine est géré chez Cloudflare, les enregistrements DNS sont créés automatiquement ; sinon, suivre les valeurs CNAME indiquées.
4. Adresses : `/` site, `/studio/` studio, `/login/` connexion. `/studio` et `/login` mènent aux dossiers (`index.html`) ; l'accès direct et le rechargement fonctionnent sans règle de réécriture. Toute autre adresse affiche `404.html`, qui renvoie les variantes en majuscules (`/Studio`, `/Login/…`) vers la page en minuscules.
5. Une fois en ligne : ajouter `https://printrace.app` aux origines autorisées de l'identifiant Google (si utilisé) et du relais Strava, et faire pointer le bouton « Envoyer sur Printrace » de Routdoor (dépôt GR, `src/printrace-bridge.jsx`) vers `https://printrace.app/studio/`.

## Limites actuelles

- **Connexion de démonstration** : la session est gardée dans le navigateur (localStorage), sans serveur ni vérification. Ce n'est pas une authentification de production.
- **Posters du compte** : « Enregistrer » range le poster (tracés, réglages, vignette) dans le compte, réouvrable depuis la photo de profil ou l'étape 2. Ils sont gardés dans ce navigateur (`printrace_designs_v1:<e-mail>`), pas sur un serveur, et sans les photos ajoutées.
- **Pas de commande ni de paiement** : « Commander le poster » affiche seulement « La commande de tirages arrive bientôt » ; seuls les téléchargements (PDF d'impression 300 dpi avec fond perdu 3 mm, PNG 300 dpi, SVG) fonctionnent.
- **PDF en RVB** : pas de conversion CMJN (accepté par la plupart des imprimeurs en ligne).
- **Fonds de carte** : tuiles vectorielles OpenFreeMap chargées en direct (réseau requis).
- **Émojis** : dessins Apple (iOS) — images 64 px hors appareils Apple ; ces images restent la propriété d'Apple.
- **Strava** : sans relais configuré (cas actuel), import guidé : export du GPX depuis Strava puis dépôt du fichier. Le relais (`workers/strava`) n'a pas encore été branché au nouveau studio : son retour d'autorisation (`#strava=…&ss=…`) n'y est pas traité. À finir avant de renseigner `PRINTRACE_STRAVA_API`.
- **Mode édition** (`/?edit`) : publie `content/site.json` via l'API GitHub avec le jeton personnel de l'administrateur ; le site est mis à jour au déploiement suivant.
- **Posters d'exemple de la connexion** (`assets/login/`) : générés sans fond de carte, tracés approximatifs pour les cas qui n'ont pas de GPX réel.
