# Relais Strava de Printrace

Printrace est un site statique : pour importer une activité directement depuis
son lien Strava, il passe par ce petit relais (Cloudflare Worker) qui utilise
l'API officielle de Strava avec l'autorisation de l'utilisateur.

Sans relais configuré, Printrace propose un parcours guidé : bouton
« Télécharger le GPX » (export depuis le compte Strava), puis dépôt du fichier.

## Déployer

1. Créer une application sur https://www.strava.com/settings/api
   - *Authorization Callback Domain* : le domaine du worker (ex. `printrace-strava.<compte>.workers.dev`).
2. Créer le stockage des sessions :
   `npx wrangler kv namespace create SESSIONS` puis reporter l'`id` dans `wrangler.toml`.
3. Renseigner `STRAVA_CLIENT_ID` et `ALLOWED_ORIGINS` dans `wrangler.toml`, puis le secret :
   `npx wrangler secret put STRAVA_CLIENT_SECRET`
4. `npx wrangler deploy`
5. Côté site, renseigner l'adresse du worker dans la variable de build
   `PRINTRACE_STRAVA_API` (Cloudflare Pages → Settings → Environment variables, ou
   `PRINTRACE_STRAVA_API=… npm run build` en local) : elle est injectée dans
   `window.PRINTRACE_CONFIG.stravaApi` (voir `printrace.config.mjs`).

## Fonctionnement

- Printrace appelle `GET /activities/:id/gpx` avec l'en-tête `Authorization: Bearer <session>`.
- Sans session (ou session expirée) : réponse 401, Printrace redirige vers `/auth`,
  Strava demande l'autorisation, puis `/callback` renvoie sur Printrace avec la
  session dans le fragment d'URL (`#…&ss=…`) et l'import reprend tout seul.
- Les jetons Strava restent côté relais (KV, 60 jours) ; le navigateur ne garde
  qu'un identifiant de session opaque.
- Strava ne donne les points GPS que des activités visibles par le compte
  connecté (les siennes, ou celles d'amis selon leur confidentialité).
