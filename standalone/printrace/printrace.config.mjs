// Configuration de build de Printrace.
//
// Toutes les valeurs se règlent par variables d'environnement (en local : `PRINTRACE_SITE_URL=… npm run build` ;
// sur Cloudflare Pages : Settings → Environment variables). Rien de secret ici : ces valeurs
// finissent dans le code client (data/config.js) ou dans le HTML.
//
// - siteUrl : URL publique de production, avec la barre finale (ex. https://<domaine>/).
//   Sert aux URL canoniques, Open Graph, données structurées, sitemap.xml et robots.txt.
//   Vide : ces URL absolues sont omises (aucun domaine n'est supposé).
// - routdoorUrl : adresse de Routdoor (app de tracés, hébergée à part) pour les liens
//   « créer / modifier un itinéraire ». Routdoor envoie ses tracés vers <siteUrl>studio/#t=…
// - stravaApi : adresse du relais Strava (workers/strava). Vide : parcours guidé (export GPX).
// - googleClientId : identifiant client OAuth « Web » (public par nature). Vide : session de démonstration.
// - unsplashKey : « Access Key » Unsplash pour les illustrations du site (visible côté client). Vide : photos du dépôt.
// - content : fichier des textes du site modifiés en mode édition (`?edit`), publié via l'API GitHub
//   avec le jeton personnel de l'administrateur (saisi dans le navigateur, jamais stocké dans le dépôt).

const env = process.env
const slash = (u) => (u && !u.endsWith('/') ? u + '/' : u || '')

export default {
  siteUrl: slash((env.PRINTRACE_SITE_URL || '').trim()),
  routdoorUrl: slash((env.PRINTRACE_ROUTDOOR_URL || 'https://kevincdnc.github.io/GR/routdoor/').trim()),
  stravaApi: (env.PRINTRACE_STRAVA_API || '').trim(),
  googleClientId: (env.PRINTRACE_GOOGLE_CLIENT_ID || '').trim(),
  unsplashKey: (env.PRINTRACE_UNSPLASH_KEY || '').trim(),
  content: {
    repo: (env.PRINTRACE_CONTENT_REPO || 'kevincdnc/printrace').trim(),
    branch: (env.PRINTRACE_CONTENT_BRANCH || 'main').trim(),
    path: 'content/site.json',
  },
}
