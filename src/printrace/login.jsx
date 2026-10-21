// Printrace — page de connexion : l'entrée du produit.
// Le site y envoie le visiteur (bouton « Se connecter », ou « Personnaliser ma carte »
// avec ses tracés dans le lien #t=…). Une fois connecté, il arrive dans le studio
// avec ces mêmes tracés. Déjà connecté : redirection immédiate.

const { useState: useLoginState, useEffect: useLoginEffect } = React;

function ptStudioUrl() {
  const root = window.RoutdoorLink ? window.RoutdoorLink.siteRoot() : '../../';
  return root + 'printrace/studio/' + location.hash;
}

function GoogleMark() {
  return (
    <svg viewBox="0 0 48 48" width="18" height="18" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}

function PrintraceLogin() {
  const [email, setEmail] = useLoginState('');
  const [busy, setBusy] = useLoginState('');
  const [error, setError] = useLoginState('');
  const hasTracks = /(^|[#&])t=/.test(location.hash);
  const go = () => { location.href = ptStudioUrl(); };
  useLoginEffect(() => { if (ptAuthUser()) go(); }, []);
  const google = async () => {
    setError(''); setBusy('google');
    try { await ptAuthGoogle(); go(); } catch (e) { setError(e.message || 'Connexion impossible.'); setBusy(''); }
  };
  const byEmail = (e) => {
    e.preventDefault(); setError('');
    try { setBusy('email'); ptAuthEmail(email); go(); } catch (err) { setError(err.message); setBusy(''); }
  };
  const site = window.RoutdoorLink ? window.RoutdoorLink.siteRoot() + 'printrace/' : '../';

  return (
    <div className="min-h-full font-site bg-[#0a0a0a] text-white flex flex-col">
      <div aria-hidden="true" className="pointer-events-none fixed inset-0" style={{ background: 'radial-gradient(60% 50% at 50% 30%, rgba(255,255,255,0.06), transparent 70%)' }} />
      <nav className="relative max-w-[1240px] w-full mx-auto px-5 sm:px-8 h-20 flex items-center">
        <a href={site} aria-label="Printrace" className="text-white"><UiPrintraceLogo height={29} /></a>
      </nav>
      <main className="relative flex-1 grid place-items-center px-5 pb-20">
        <div className="w-full max-w-[400px]">
          <h1 className="font-display font-bold italic tracking-[-0.02em] text-[30px] leading-tight text-center">Bienvenue sur Printrace</h1>
          <p className="mt-3 text-center text-[15px] leading-relaxed text-neutral-400">
            {hasTracks ? 'Connectez-vous pour personnaliser votre poster : vos tracés vous attendent dans le studio.' : 'Connectez-vous pour créer et retrouver vos posters.'}
          </p>

          <div className="mt-8 rounded-2xl bg-white/[0.03] ring-1 ring-white/[0.08] p-5">
            <button onClick={google} disabled={!!busy}
              className="w-full h-12 rounded-xl bg-white text-neutral-900 text-[15px] font-semibold flex items-center justify-center gap-3 hover:bg-neutral-100 transition-colors disabled:opacity-60">
              {busy === 'google' ? <UiSpinner size={18} /> : <GoogleMark />} Continuer avec Google
            </button>
            <div className="my-5 flex items-center gap-3 text-[11.5px] font-semibold uppercase tracking-[0.14em] text-neutral-600">
              <span className="h-px flex-1 bg-white/10" />ou<span className="h-px flex-1 bg-white/10" />
            </div>
            <form onSubmit={byEmail} className="flex flex-col gap-2.5">
              <label className="sr-only" htmlFor="pt-email">Adresse e-mail</label>
              <input id="pt-email" type="email" autoComplete="email" value={email} onChange={(e) => { setEmail(e.target.value); setError(''); }}
                placeholder="vous@exemple.com" required
                className="h-12 rounded-xl bg-white/[0.05] ring-1 ring-white/10 focus:ring-white/30 outline-none px-4 text-[15px] text-white placeholder:text-neutral-500" />
              <UiButton type="submit" size="lg" block loading={busy === 'email'} className="h-12 rounded-xl">Continuer avec l’e-mail</UiButton>
            </form>
            {error && <p className="mt-3 text-[13px] text-red-300">{error}</p>}
          </div>

          {/* Pour l'instant : on peut passer la connexion pour tester le produit */}
          <button onClick={go} className="mt-4 w-full h-11 rounded-xl text-[13.5px] font-medium text-neutral-300 hover:text-white hover:bg-white/[0.05] ring-1 ring-white/10 transition-colors">
            Passer et tester le studio →
          </button>

          <p className="mt-5 text-center text-[12.5px] leading-relaxed text-neutral-500">
            En continuant, vous acceptez les conditions d’utilisation de Printrace.
            {!ptAuthGoogleId() && <><br /><span className="text-neutral-600">Aperçu : la connexion ouvre une session de démonstration.</span></>}
          </p>
        </div>
      </main>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<PrintraceLogin />);
