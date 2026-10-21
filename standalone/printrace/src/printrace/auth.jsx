// Printrace — compte utilisateur (version simplifiée, côté navigateur).
//
// La page de connexion (login/) est l'entrée du produit : le site y envoie
// le visiteur avec ses tracés, puis la connexion ouvre le studio.
//
// Ce n'est PAS une authentification de production : la session est gardée dans le
// navigateur (localStorage), sans serveur ni vérification :
//  - Google : Google Identity Services, si PRINTRACE_CONFIG.googleClientId est renseigné
//    (identifiant OAuth « Web » créé sur console.cloud.google.com, origine autorisée :
//    l'adresse du site). Sans identifiant, le bouton ouvre une session de démonstration.
//  - E-mail : session locale (le lien de connexion par e-mail viendra avec le serveur).
// Le vrai système de comptes (serveur, vérification du jeton Google) se branchera ici,
// sans toucher aux pages : ptAuthUser / ptAuthSignIn / ptAuthSignOut restent les mêmes.

const PT_AUTH_KEY = 'printrace_session_v1';

function ptAuthUser() {
  try {
    const u = JSON.parse(localStorage.getItem(PT_AUTH_KEY) || 'null');
    return u && u.email ? u : null;
  } catch (e) { return null; }
}
function ptAuthSave(u) {
  try { localStorage.setItem(PT_AUTH_KEY, JSON.stringify(u)); } catch (e) {}
  return u;
}
function ptAuthSignOut() {
  try { localStorage.removeItem(PT_AUTH_KEY); } catch (e) {}
  try { if (window.google && google.accounts && google.accounts.id) google.accounts.id.disableAutoSelect(); } catch (e) {}
}
const ptAuthGoogleId = () => ((window.PRINTRACE_CONFIG || {}).googleClientId || '').trim();

// Jeton d'identité Google (JWT) -> profil ; la signature sera vérifiée côté serveur
function ptJwtProfile(token) {
  try {
    const b = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const p = JSON.parse(decodeURIComponent(escape(atob(b + '==='.slice((b.length + 3) % 4)))));
    return { email: p.email, name: p.name || p.given_name || '', picture: p.picture || '' };
  } catch (e) { return null; }
}

// Charge Google Identity Services une seule fois
let ptGisLoading = null;
function ptLoadGis() {
  if (window.google && google.accounts && google.accounts.id) return Promise.resolve(true);
  if (!ptGisLoading) ptGisLoading = new Promise((res) => {
    const s = document.createElement('script');
    s.src = 'https://accounts.google.com/gsi/client'; s.async = true;
    s.onload = () => res(true); s.onerror = () => res(false);
    document.head.appendChild(s);
  });
  return ptGisLoading;
}

// Connexion Google : affiche le sélecteur de compte Google (ou session de démonstration)
async function ptAuthGoogle() {
  const id = ptAuthGoogleId();
  if (!id) return ptAuthSave({ email: 'demo@printrace.app', name: 'Compte de démonstration', provider: 'demo', at: Date.now() });
  const ok = await ptLoadGis();
  if (!ok) throw new Error('Google ne répond pas. Réessayez ou utilisez votre e-mail.');
  return new Promise((resolve, reject) => {
    google.accounts.id.initialize({
      client_id: id, ux_mode: 'popup', auto_select: false, cancel_on_tap_outside: true,
      callback: (r) => {
        const p = r && r.credential && ptJwtProfile(r.credential);
        if (!p || !p.email) { reject(new Error('Connexion Google impossible.')); return; }
        resolve(ptAuthSave({ ...p, provider: 'google', token: r.credential, at: Date.now() }));
      },
    });
    google.accounts.id.prompt((n) => {
      if (n.isNotDisplayed && n.isNotDisplayed()) reject(new Error('Google n’a pas pu afficher la connexion (cookies tiers bloqués ?).'));
      else if (n.isSkippedMoment && n.isSkippedMoment()) reject(new Error('Connexion Google annulée.'));
    });
  });
}

// Connexion par e-mail (simplifiée) : la session est créée tout de suite
function ptAuthEmail(email) {
  const e = String(email || '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) throw new Error('Adresse e-mail invalide.');
  return ptAuthSave({ email: e, name: e.split('@')[0], provider: 'email', at: Date.now() });
}

// Adresse de la page de connexion ; `hash` transmet les tracés (#t=…) jusqu'au studio
function ptLoginUrl(hash) {
  const root = window.RoutdoorLink ? window.RoutdoorLink.siteRoot() : './';
  return root + 'login/' + (hash ? (hash[0] === '#' ? hash : '#' + hash) : '');
}

Object.assign(window, { PT_AUTH_KEY, ptAuthUser, ptAuthSignOut, ptAuthGoogle, ptAuthEmail, ptAuthGoogleId, ptLoginUrl });
