// Mode édition du site Printrace (administrateur seulement).
//
// Ouvrir le site avec « ?edit » à la fin de l'adresse. L'accès demande un jeton GitHub
// ayant le droit d'écrire dans le dépôt : sans lui, rien n'est modifiable ni publiable.
// Un clic sur un texte l'ouvre dans un petit éditeur, le site se met à jour en direct.
// « Publier » enregistre les textes modifiés dans content/site.json sur GitHub : le site
// se reconstruit et se met en ligne tout seul (GitHub Actions, 1 à 2 minutes).

const PT_EDIT_TOKEN = 'printrace_admin_token';
const PT_EDIT_DRAFT = 'printrace_text_draft';
// Dépôt, branche et fichier : printrace.config.mjs (PRINTRACE_CONTENT_REPO / _BRANCH)
const ptEditCfg = () => ({ repo: 'kevincdnc/printrace', branch: 'main', path: 'content/site.json', ...((window.PRINTRACE_CONFIG || {}).content || {}) });
const ptEditRequested = () => /[?&]edit(=|&|$)/.test(location.search) || location.hash === '#edit';
const ptStore = {
  get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
  set(k, v) { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) {} },
};

// API GitHub (contenu du dépôt)
function ptGh(path, token, opts = {}) {
  return fetch('https://api.github.com' + path, {
    ...opts,
    headers: { Accept: 'application/vnd.github+json', Authorization: 'Bearer ' + token, 'X-GitHub-Api-Version': '2022-11-28', ...(opts.body ? { 'Content-Type': 'application/json' } : {}) },
  });
}
const ptB64Encode = (str) => { const b = new TextEncoder().encode(str); let s = ''; for (let i = 0; i < b.length; i++) s += String.fromCharCode(b[i]); return btoa(s); };
const ptB64Decode = (b64) => new TextDecoder().decode(Uint8Array.from(atob(b64.replace(/\s/g, '')), (ch) => ch.charCodeAt(0)));

// Le jeton peut-il écrire dans le dépôt ?
async function ptEditVerify(token) {
  const { repo } = ptEditCfg();
  const r = await ptGh('/repos/' + repo, token);
  if (r.status === 401) throw new Error('Jeton refusé par GitHub (expiré ou mal copié).');
  if (!r.ok) throw new Error('Dépôt introuvable avec ce jeton : vérifiez qu’il donne accès à ' + repo + '.');
  const j = await r.json();
  if (!j.permissions || !j.permissions.push) throw new Error('Ce compte ne peut pas modifier ' + repo + '.');
  return true;
}

// Publication : textes déjà publiés sur GitHub + brouillon -> content/site.json
async function ptEditPublish(token, draft) {
  const { repo, branch, path } = ptEditCfg();
  const url = '/repos/' + repo + '/contents/' + path;
  for (let attempt = 0; attempt < 2; attempt++) {
    const cur = await ptGh(url + '?ref=' + encodeURIComponent(branch), token);
    let remote = {}, sha;
    if (cur.ok) { const j = await cur.json(); sha = j.sha; try { remote = JSON.parse(ptB64Decode(j.content || '')) || {}; } catch (e) { remote = {}; } }
    else if (cur.status !== 404) throw new Error('Lecture du fichier de textes impossible (' + cur.status + ').');
    const next = { ...remote };
    for (const k of Object.keys(draft)) {
      const v = draft[k];
      if (v == null || v === PT_TEXT.defs[k]) delete next[k]; else next[k] = v; // identique au code : inutile de le garder
    }
    const sorted = Object.fromEntries(Object.keys(next).sort().map((k) => [k, next[k]]));
    const n = Object.keys(draft).length;
    const r = await ptGh(url, token, { method: 'PUT', body: JSON.stringify({
      message: 'Textes du site : ' + n + ' modification' + (n > 1 ? 's' : '') + ' (mode édition)',
      content: ptB64Encode(JSON.stringify(sorted, null, 2) + '\n'), branch, ...(sha ? { sha } : {}),
    }) });
    if (r.ok) return sorted;
    if ((r.status === 409 || r.status === 422) && attempt === 0) continue; // fichier changé entre-temps : on relit et on refait
    const j = await r.json().catch(() => ({}));
    throw new Error('Publication refusée par GitHub' + (j.message ? ' : ' + j.message : '') + '.');
  }
  throw new Error('Publication impossible, réessayez.');
}

// Champ de texte qui s'agrandit avec son contenu
function PtEditArea({ value, onChange, autoFocus, onEnter }) {
  const ref = React.useRef(null);
  React.useLayoutEffect(() => { const el = ref.current; if (el) { el.style.height = 'auto'; el.style.height = el.scrollHeight + 2 + 'px'; } }, [value]);
  React.useEffect(() => { if (autoFocus && ref.current) { ref.current.focus(); ref.current.select(); } }, []);
  return (
    <textarea ref={ref} value={value} rows={1} onChange={(e) => onChange(e.target.value)}
      onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey && onEnter) { e.preventDefault(); onEnter(); } }}
      className="w-full resize-none rounded-lg bg-white/[0.06] ring-1 ring-white/15 focus:ring-[#60a5fa] outline-none px-3 py-2 text-[14px] leading-relaxed text-white" />
  );
}

function SiteEditor({ caseId, onCase, onStart }) {
  useTx(); // se redessine à chaque modification
  const [phase, setPhase] = React.useState('check'); // check | gate | on
  const [token, setToken] = React.useState('');
  const [err, setErr] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [pop, setPop] = React.useState(null); // { k, rect }
  const [panel, setPanel] = React.useState(false);
  const [q, setQ] = React.useState('');
  const [status, setStatus] = React.useState(null); // { kind: 'ok'|'err'|'busy', msg }
  const cfg = ptEditCfg();

  // Jeton déjà enregistré dans ce navigateur : vérifié sans rien demander
  React.useEffect(() => {
    const tk = ptStore.get(PT_EDIT_TOKEN);
    if (!tk) { setPhase('gate'); return; }
    ptEditVerify(tk).then(() => { setToken(tk); setPhase('on'); }).catch((e) => { setErr(e.message); setPhase('gate'); });
  }, []);

  // Entrée en mode édition : brouillon repris, textes cliquables
  React.useEffect(() => {
    if (phase !== 'on') return;
    try { PT_TEXT.draft = JSON.parse(ptStore.get(PT_EDIT_DRAFT) || '{}') || {}; } catch (e) { PT_TEXT.draft = {}; }
    // Textes du menu des cas d'usage (pas encore affichés) : visibles dans « Tous les textes »
    SITE_CASES.forEach((c) => { ptText('cas.' + c.id + '.nom', c.label); ptText('cas.' + c.id + '.exemples', c.example); ptText('cas.' + c.id + '.mot', c.word); ptText('cas.' + c.id + '.accroche', c.pitch); });
    PT_TEXT.edit = true; ptTextNotify();
    document.documentElement.classList.add('pt-editing');
    onStart && onStart();
    const inUi = (el) => el.closest && el.closest('[data-pt-editor]');
    const click = (e) => {
      if (inUi(e.target)) return;
      const el = e.target.closest && e.target.closest('[data-tx]');
      if (el) { e.preventDefault(); e.stopPropagation(); setPop({ k: el.getAttribute('data-tx'), rect: el.getBoundingClientRect() }); return; }
      // Pas de navigation pendant l'édition (les liens mèneraient hors de la page)
      const a = e.target.closest && e.target.closest('a[href]');
      if (a) { e.preventDefault(); e.stopPropagation(); }
    };
    const scroll = (e) => { if (!inUi(e.target)) setPop(null); };
    document.addEventListener('click', click, true);
    document.addEventListener('scroll', scroll, true);
    return () => {
      document.removeEventListener('click', click, true); document.removeEventListener('scroll', scroll, true);
      document.documentElement.classList.remove('pt-editing');
      PT_TEXT.edit = false; ptTextNotify();
    };
  }, [phase]);
  React.useEffect(() => {
    const k = (e) => { if (e.key === 'Escape') { setPop(null); setPanel(false); } };
    document.addEventListener('keydown', k);
    return () => document.removeEventListener('keydown', k);
  }, []);

  const saveDraft = () => ptStore.set(PT_EDIT_DRAFT, Object.keys(PT_TEXT.draft).length ? JSON.stringify(PT_TEXT.draft) : null);
  const setText = (k, v) => {
    if (v === ptTextPublished(k)) delete PT_TEXT.draft[k]; else PT_TEXT.draft[k] = v;
    saveDraft(); setStatus(null); ptTextNotify();
  };
  const resetText = (k) => {
    // Retour au texte du code : supprime aussi la version publiée s'il y en a une
    if (PT_TEXT.pub[k] != null) PT_TEXT.draft[k] = null; else delete PT_TEXT.draft[k];
    saveDraft(); ptTextNotify();
  };
  const count = Object.keys(PT_TEXT.draft).length;
  const quit = () => { location.href = location.pathname + location.hash.replace('#edit', ''); };

  const enter = async (e) => {
    e.preventDefault(); setErr(''); setBusy(true);
    const tk = token.trim();
    try { await ptEditVerify(tk); ptStore.set(PT_EDIT_TOKEN, tk); setToken(tk); setPhase('on'); }
    catch (x) { setErr(x.message); }
    setBusy(false);
  };
  const publish = async () => {
    setStatus({ kind: 'busy', msg: 'Publication…' });
    try {
      const pub = await ptEditPublish(token, PT_TEXT.draft);
      PT_TEXT.pub = pub; PT_TEXT.draft = {}; saveDraft(); ptTextNotify();
      setStatus({ kind: 'ok', msg: 'Publié. Le site en ligne se met à jour dans 1 à 2 minutes.' });
    } catch (x) { setStatus({ kind: 'err', msg: x.message }); }
  };
  const discard = () => {
    if (!count || !confirm('Annuler les ' + count + ' modification(s) non publiée(s) ?')) return;
    PT_TEXT.draft = {}; saveDraft(); ptTextNotify(); setStatus(null);
  };
  const forget = () => { ptStore.set(PT_EDIT_TOKEN, null); quit(); };

  const font = { fontFamily: 'var(--ds-font-site)', letterSpacing: 0 };
  const btn = 'h-9 px-3.5 rounded-lg text-[13px] font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed';

  if (phase === 'check') return null;

  // Accès : jeton GitHub de l'administrateur
  if (phase === 'gate') {
    return (
      <div data-pt-editor className="fixed inset-0 z-[9999] grid place-items-center bg-black/70 backdrop-blur-sm p-5" style={font}>
        <form onSubmit={enter} className="w-full max-w-[440px] rounded-2xl bg-[#151517] ring-1 ring-white/10 shadow-2xl p-6 text-left">
          <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[#60a5fa]">Mode édition</p>
          <h2 className="mt-2 text-[20px] font-semibold text-white" style={font}>Accès administrateur</h2>
          <p className="mt-2 text-[14px] leading-relaxed text-neutral-400">
            Collez votre jeton GitHub. Il doit donner accès au dépôt <span className="text-neutral-200">{cfg.repo}</span> avec la permission <span className="text-neutral-200">Contents : Read and write</span>. Il reste enregistré dans ce navigateur uniquement.
          </p>
          <a href="https://github.com/settings/personal-access-tokens/new" target="_blank" rel="noopener" className="mt-2 inline-block text-[13.5px] text-[#7fb2ff] hover:underline">Créer un jeton sur GitHub →</a>
          <input type="password" autoFocus value={token} onChange={(e) => { setToken(e.target.value); setErr(''); }} placeholder="github_pat_…" autoComplete="off" spellCheck="false"
            className="mt-4 w-full h-11 rounded-lg bg-white/[0.05] ring-1 ring-white/15 focus:ring-[#60a5fa] outline-none px-3.5 text-[14px] text-white placeholder:text-neutral-600" />
          {err && <p className="mt-2.5 text-[13px] text-red-300">{err}</p>}
          <div className="mt-5 flex justify-end gap-2">
            <button type="button" onClick={quit} className={btn + ' text-neutral-300 hover:bg-white/[0.06]'}>Quitter</button>
            <button type="submit" disabled={!token.trim() || busy} className={btn + ' bg-[#2563eb] text-white hover:bg-[#1d4ed8]'}>{busy ? 'Vérification…' : 'Entrer'}</button>
          </div>
        </form>
      </div>
    );
  }

  // Petit éditeur près du texte cliqué
  let popEl = null;
  if (pop) {
    const def = PT_TEXT.defs[pop.k] || '', val = ptText(pop.k, def);
    const W = Math.min(380, window.innerWidth - 24);
    const left = Math.max(12, Math.min(pop.rect.left, window.innerWidth - W - 12));
    const below = pop.rect.bottom + 10 + 200 < window.innerHeight;
    popEl = (
      <div data-pt-editor className="fixed z-[10000] rounded-xl bg-[#151517] ring-1 ring-white/15 shadow-[0_20px_50px_rgba(0,0,0,0.6)] p-3 text-left"
        style={{ ...font, width: W, left, ...(below ? { top: pop.rect.bottom + 10 } : { bottom: window.innerHeight - pop.rect.top + 10 }) }}>
        <div className="flex items-center justify-between gap-2 mb-2">
          <span className="text-[11px] font-mono text-neutral-500 truncate">{pop.k}</span>
          <button onClick={() => setPop(null)} className="text-neutral-500 hover:text-white text-[18px] leading-none px-1" aria-label="Fermer">×</button>
        </div>
        <PtEditArea value={val} autoFocus onChange={(v) => setText(pop.k, v)} onEnter={() => setPop(null)} />
        <div className="mt-2 flex items-center justify-between gap-2">
          {val !== def
            ? <button onClick={() => resetText(pop.k)} className="text-[12.5px] text-neutral-400 hover:text-white truncate" title={def}>Rétablir le texte d’origine</button>
            : <span className="text-[12px] text-neutral-600">Texte d’origine</span>}
          <button onClick={() => setPop(null)} className="h-8 px-3 rounded-lg bg-white text-neutral-900 text-[12.5px] font-semibold">OK</button>
        </div>
      </div>
    );
  }

  // Panneau : tous les textes (y compris ceux qu'on ne peut pas cliquer : liens, champs…)
  const keys = Object.keys(PT_TEXT.defs).sort();
  const shown = keys.filter((k) => { const s = (k + ' ' + ptText(k, PT_TEXT.defs[k])).toLowerCase(); return !q || s.includes(q.toLowerCase()); });
  const panelEl = panel && (
    <div data-pt-editor className="fixed inset-y-0 right-0 z-[9999] w-full max-w-[440px] bg-[#111113] ring-1 ring-white/10 shadow-2xl flex flex-col text-left" style={font}>
      <div className="p-4 border-b border-white/10 flex items-center gap-2">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={'Rechercher parmi ' + keys.length + ' textes'}
          className="flex-1 h-10 rounded-lg bg-white/[0.05] ring-1 ring-white/10 focus:ring-[#60a5fa] outline-none px-3 text-[14px] text-white placeholder:text-neutral-500" />
        <button onClick={() => setPanel(false)} className={btn + ' text-neutral-300 hover:bg-white/[0.06]'}>Fermer</button>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {shown.map((k) => {
          const def = PT_TEXT.defs[k], val = ptText(k, def), changed = Object.prototype.hasOwnProperty.call(PT_TEXT.draft, k);
          return (
            <div key={k}>
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <span className={`text-[11px] font-mono truncate ${changed ? 'text-amber-400' : 'text-neutral-500'}`}>{k}{changed ? ' · modifié' : ''}</span>
                {val !== def && <button onClick={() => resetText(k)} className="shrink-0 text-[11.5px] text-neutral-500 hover:text-white">Rétablir</button>}
              </div>
              <PtEditArea value={val} onChange={(v) => setText(k, v)} />
            </div>
          );
        })}
      </div>
    </div>
  );

  // Barre d'édition (bas de l'écran)
  return (
    <>
      {popEl}
      {panelEl}
      {/* Panneau ouvert (grand écran) : la barre se range à sa gauche, « Publier » reste accessible */}
      <div data-pt-editor className="fixed left-1/2 -translate-x-1/2 bottom-3 z-[9998] w-[calc(100%-24px)] max-w-[980px] rounded-2xl bg-[#151517]/95 backdrop-blur ring-1 ring-white/15 shadow-[0_20px_60px_rgba(0,0,0,0.6)] px-3 py-2.5 text-left"
        style={panel && window.innerWidth >= 900 ? { ...font, left: 12, right: 452, width: 'auto', transform: 'none' } : font}>
        <div className="flex flex-wrap items-center gap-2">
          <span className="flex items-center gap-2 pl-1 pr-2 text-[13px] font-semibold text-white whitespace-nowrap"><span className="w-2 h-2 rounded-full bg-[#60a5fa]" />Mode édition</span>
          <div className="flex gap-1 overflow-x-auto max-w-full order-last sm:order-none w-full sm:w-auto">
            {SITE_CASES.map((c) => (
              <button key={c.id} onClick={() => onCase(c.id)} className={`h-8 px-2.5 rounded-lg text-[12.5px] whitespace-nowrap transition-colors ${c.id === caseId ? 'bg-white/[0.12] text-white' : 'text-neutral-400 hover:bg-white/[0.06] hover:text-white'}`}>{ptText('cas.' + c.id + '.nom', c.label)}</button>
            ))}
          </div>
          <div className="ml-auto flex items-center gap-1.5">
            <button onClick={() => setPanel((v) => !v)} className={btn + ' whitespace-nowrap text-neutral-200 hover:bg-white/[0.06]'}><span className="sm:hidden">Textes</span><span className="hidden sm:inline">Tous les textes</span></button>
            <button onClick={discard} disabled={!count} className={btn + ' text-neutral-300 hover:bg-white/[0.06]'}>Annuler</button>
            <button onClick={publish} disabled={!count || (status && status.kind === 'busy')} className={btn + ' bg-[#2563eb] text-white hover:bg-[#1d4ed8] font-semibold'}>
              {status && status.kind === 'busy' ? 'Publication…' : 'Publier' + (count ? ' (' + count + ')' : '')}
            </button>
            <button onClick={quit} title="Quitter le mode édition" className={btn + ' text-neutral-400 hover:bg-white/[0.06] hover:text-white'}>Quitter</button>
          </div>
        </div>
        <div className="mt-1.5 flex items-center justify-between gap-3 px-1 text-[12px]">
          <span className={status ? (status.kind === 'err' ? 'text-red-300' : status.kind === 'ok' ? 'text-emerald-300' : 'text-neutral-400') : 'text-neutral-500'}>
            {status ? status.msg : count ? count + ' modification' + (count > 1 ? 's' : '') + ' non publiée' + (count > 1 ? 's' : '') + ' (gardées dans ce navigateur)' : 'Cliquez sur un texte pour le modifier.'}
          </span>
          <button onClick={forget} className="shrink-0 text-neutral-600 hover:text-neutral-300">Oublier le jeton</button>
        </div>
      </div>
    </>
  );
}

Object.assign(window, { SiteEditor, ptEditRequested });
