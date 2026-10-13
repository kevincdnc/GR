// Partage par lien (« envoyer à un ami ») et carte intégrable (iframe).
// Le codage du tracé et le rendu de la carte sont dans share-link.jsx.

const { useState: useEmState, useEffect: useEmEffect, useMemo: useEmMemo, useRef: useEmRef } = React;

function sharePayload(title, routes) {
  return {
    title: title || '',
    parts: routes.map((r) => ({
      name: r.name, color: r.color, distance: r.distance, ascent: r.ascent, descent: r.descent,
      durationMin: r.durationMin, date: r.date, coords: r.coords,
    })),
  };
}

// Code du lien, recalculé (asynchrone) quand les tracés ou le titre changent
function useShareCode(title, routes) {
  const [code, setCode] = useEmState(null);
  useEmEffect(() => {
    let alive = true;
    setCode(null);
    const t = setTimeout(() => {
      window.RoutdoorLink.encodeShare(sharePayload(title, routes))
        .then((c) => { if (alive) setCode(c); })
        .catch(() => { if (alive) setCode(''); });
    }, 150);
    return () => { alive = false; clearTimeout(t); };
  }, [title, routes]);
  return code;
}

async function copyText(text) {
  try { await navigator.clipboard.writeText(text); return true; } catch (e) {}
  try {
    const ta = document.createElement('textarea'); ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select(); const ok = document.execCommand('copy'); ta.remove(); return ok;
  } catch (e) { return false; }
}

// ---------------------------------------------------------------- bouton « lien »
function ShareLinkButton({ title, routes, dark, onToast, compact }) {
  const [open, setOpen] = useEmState(false);
  const code = useShareCode(title, routes);
  const url = code ? window.RoutdoorLink.shareUrl(code) : '';
  const ref = useEmRef(null);
  useEmEffect(() => {
    if (!open) return;
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open]);
  const doCopy = async () => {
    if (!url) return;
    const ok = await copyText(url);
    onToast && onToast(ok ? 'Lien copié — envoie-le à ton ami' : 'Copie impossible');
  };
  const doNative = async () => {
    try { await navigator.share({ title: title || 'Tracé Routdoor', text: `${title || 'Un tracé'} sur Routdoor`, url }); }
    catch (e) { if (e && e.name !== 'AbortError') doCopy(); }
  };
  const canNative = typeof navigator !== 'undefined' && !!navigator.share;
  const kb = url ? Math.max(1, Math.round(url.length / 1024)) : 0;
  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen((v) => !v)}
        className={`h-9 flex items-center gap-2 rounded-lg px-3 text-[12.5px] font-semibold transition-colors ${open ? 'bg-blue-500 text-white' : (dark ? 'bg-white/[0.08] hover:bg-white/[0.14]' : 'bg-neutral-100 hover:bg-neutral-200')}`}>
        <I.Link size={15} /> {compact ? 'Lien' : 'Envoyer le lien'}
      </button>
      {open && (
        <div className={`absolute right-0 top-full mt-2 w-[340px] max-w-[calc(100vw-24px)] z-20 rounded-xl p-3.5 shadow-2xl animate-menu ${dark ? 'bg-neutral-900 ring-1 ring-white/10' : 'bg-white ring-1 ring-neutral-200'}`}>
          <div className="text-[13px] font-semibold">Partager le tracé avec un ami</div>
          <p className={`text-[11.5px] mt-1 leading-snug ${dark ? 'text-neutral-400' : 'text-neutral-500'}`}>
            Le tracé est contenu dans le lien : ton ami l'ouvre sur la carte et peut l'ajouter à ses tracés, sans compte.
          </p>
          <div className={`mt-3 flex items-center gap-1.5 rounded-lg border pl-2.5 pr-1 h-10 ${dark ? 'border-neutral-700 bg-neutral-900/70' : 'border-neutral-200 bg-white'}`}>
            <input readOnly value={url || 'Préparation du lien…'} onFocus={(e) => e.target.select()}
              className={`flex-1 min-w-0 bg-transparent outline-none text-[12px] font-mono truncate ${dark ? 'text-neutral-300' : 'text-neutral-700'}`} />
            <button onClick={doCopy} disabled={!url}
              className="h-8 px-3 rounded-md text-[12px] font-semibold text-white bg-blue-500 hover:bg-blue-600 disabled:opacity-50">Copier</button>
          </div>
          <div className="mt-2 flex items-center justify-between gap-2">
            <span className={`text-[10.5px] ${dark ? 'text-neutral-500' : 'text-neutral-400'}`}>
              {routes.length} tracé{routes.length > 1 ? 's' : ''}{kb ? ` · lien de ${kb} Ko` : ''}
            </span>
            <div className="flex gap-1.5">
              {url && <a href={url} target="_blank" rel="noopener" className={`h-8 px-2.5 grid place-items-center rounded-md text-[12px] font-medium ${dark ? 'bg-white/[0.08] hover:bg-white/[0.14]' : 'bg-neutral-100 hover:bg-neutral-200'}`}>Ouvrir</a>}
              {canNative && <button onClick={doNative} disabled={!url} className={`h-8 px-2.5 flex items-center gap-1.5 rounded-md text-[12px] font-medium disabled:opacity-50 ${dark ? 'bg-white/[0.08] hover:bg-white/[0.14]' : 'bg-neutral-100 hover:bg-neutral-200'}`}><I.Share size={13} /> Envoyer</button>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- mode embed
const EMBED_SIZES = [
  { id: 'full', name: '100 %', w: null },
  { id: '800', name: '800 px', w: 800 },
  { id: '600', name: '600 px', w: 600 },
];

function EmbedPane({ allRoutes, routes, included, setIncluded, title, setTitle, initialTitle, dark, isMobile, onToast }) {
  const RL = window.RoutdoorLink;
  const [opts, setOpts] = useEmState(() => ({ ...RL.EMBED_DEFAULTS, color: allRoutes.length > 1 ? 'routes' : '#fc5200' }));
  const [sizeId, setSizeId] = useEmState('full');
  const [height, setHeight] = useEmState(480);
  const shownTitle = title.trim() || initialTitle || '';
  const code = useShareCode(shownTitle, routes);
  const size = EMBED_SIZES.find((s) => s.id === sizeId) || EMBED_SIZES[0];
  const set = (k, v) => setOpts((o) => ({ ...o, [k]: v }));

  const src = code ? RL.embedUrl(code, opts) : '';
  const snippet = src
    ? `<iframe src="${src}" width="${size.w ? size.w : '100%'}" height="${height}" style="border:0;border-radius:12px;max-width:100%" loading="lazy" allowfullscreen title="${(shownTitle || 'Itinéraire').replace(/"/g, '&quot;')} · Routdoor"></iframe>`
    : '';

  // Aperçu : même rendu que la page embed.html, monté directement
  const box = useEmRef(null);
  useEmEffect(() => {
    if (!box.current || !routes.length) return;
    const inst = RL.mountEmbed(box.current, sharePayload(shownTitle, routes), { ...opts, href: code ? RL.shareUrl(code) : '#' });
    return () => inst.destroy();
  }, [routes, shownTitle, opts, code]);

  const label = dark ? 'text-neutral-400' : 'text-neutral-500';
  const sectionTitle = `text-[10.5px] font-semibold uppercase tracking-wider mb-2 ${label}`;
  const sep = dark ? 'border-white/10' : 'border-neutral-200';
  const chip = (on) => `rounded-md px-2.5 h-8 text-[12px] font-medium transition-colors ${on ? 'bg-blue-500 text-white' : (dark ? 'bg-white/[0.06] hover:bg-white/[0.12]' : 'bg-neutral-100 hover:bg-neutral-200')}`;
  const inputCls = `w-full h-9 rounded-md border px-2.5 text-[12.5px] outline-none ${dark ? 'border-neutral-700 bg-neutral-900/70 focus:border-neutral-500' : 'border-neutral-200 bg-white focus:border-neutral-400'}`;

  return (
    <div className={`flex-1 min-h-0 flex ${isMobile ? 'flex-col overflow-y-auto sb-scroll' : ''}`}>
      {/* Aperçu + code */}
      <div className={`min-w-0 flex flex-col gap-4 ${isMobile ? 'p-3' : 'flex-1 p-6 overflow-y-auto sb-scroll'}`}>
        <div className={`rounded-xl p-4 flex-1 min-h-0 flex flex-col ${dark ? 'bg-black/30 ring-1 ring-white/[0.06]' : 'bg-neutral-100'}`}>
          <div className={`flex items-center gap-2 mb-3 text-[11px] ${label}`}>
            <span className="flex gap-1"><span className="w-2.5 h-2.5 rounded-full bg-neutral-600"></span><span className="w-2.5 h-2.5 rounded-full bg-neutral-600"></span><span className="w-2.5 h-2.5 rounded-full bg-neutral-600"></span></span>
            <span className="ml-1">Aperçu sur ton site</span>
          </div>
          <div className="flex-1 min-h-0 grid place-items-center overflow-auto sb-scroll">
            <div ref={box} className="rounded-xl overflow-hidden shadow-xl max-w-full"
              style={{ width: size.w ? size.w : '100%', height: isMobile ? Math.min(height, 420) : height }}></div>
          </div>
        </div>
        <div>
          <div className="flex items-center justify-between mb-2">
            <div className={sectionTitle + ' !mb-0'}>Code d'intégration</div>
            {src && <a href={src} target="_blank" rel="noopener" className="text-[11.5px] font-medium text-blue-400 hover:underline">Ouvrir la carte seule ↗</a>}
          </div>
          <div className={`relative rounded-lg border ${dark ? 'border-neutral-700 bg-neutral-950/70' : 'border-neutral-200 bg-white'}`}>
            <pre className={`p-3 pr-24 text-[11px] leading-relaxed font-mono whitespace-pre-wrap break-all max-h-[92px] overflow-y-auto sb-scroll ${dark ? 'text-neutral-300' : 'text-neutral-700'}`}>{snippet || 'Préparation…'}</pre>
            <button onClick={async () => { const ok = await copyText(snippet); onToast && onToast(ok ? 'Code copié — colle-le dans ta page' : 'Copie impossible'); }} disabled={!snippet}
              className="absolute top-2 right-2 h-8 px-3 rounded-md text-[12px] font-semibold text-white bg-blue-500 hover:bg-blue-600 disabled:opacity-50 flex items-center gap-1.5">
              <I.Copy size={13} /> Copier
            </button>
          </div>
          <p className={`mt-1.5 text-[11px] ${label}`}>Fonctionne sur WordPress, Notion, Webflow, Wix… Le tracé est inclus dans l'adresse : rien à héberger.</p>
        </div>
      </div>

      {/* Options */}
      <div className={isMobile ? `flex flex-col border-t ${sep}` : `w-[300px] shrink-0 flex flex-col border-l ${sep}`}>
        <div className={isMobile ? 'p-4 flex flex-col gap-5' : 'flex-1 overflow-y-auto sb-scroll p-4 flex flex-col gap-5'}>
          <div>
            <div className={sectionTitle}>Fond de carte</div>
            <div className="grid grid-cols-3 gap-1.5">
              {Object.entries(RL.EMBED_LAYERS).map(([k, l]) => <button key={k} onClick={() => set('base', k)} className={chip(opts.base === k)}>{l.name}</button>)}
            </div>
          </div>
          <div>
            <div className={sectionTitle}>Thème</div>
            <div className="grid grid-cols-2 gap-1.5">
              <button onClick={() => set('theme', 'light')} className={chip(opts.theme === 'light')}>Clair</button>
              <button onClick={() => set('theme', 'dark')} className={chip(opts.theme === 'dark')}>Sombre</button>
            </div>
          </div>
          <div>
            <div className={sectionTitle}>Taille</div>
            <div className="grid grid-cols-3 gap-1.5">
              {EMBED_SIZES.map((s) => <button key={s.id} onClick={() => setSizeId(s.id)} className={chip(s.id === sizeId)}>{s.name}</button>)}
            </div>
            <div className="mt-3 flex items-center gap-3">
              <span className={`text-[12px] ${label}`}>Hauteur</span>
              <input type="range" min={300} max={800} step={10} value={height} onChange={(e) => setHeight(Number(e.target.value))} className="flex-1 accent-blue-500" />
              <span className="text-[12px] tabular-nums w-12 text-right">{height} px</span>
            </div>
          </div>
          <div>
            <div className={sectionTitle}>Affichage</div>
            <div className="flex flex-col gap-0.5 -mx-1">
              <ShareFieldRow dark={dark} label="Titre" on={opts.title} onToggle={() => set('title', !opts.title)} />
              {opts.title && <div className="px-1 pb-1"><input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={initialTitle || 'Titre'} maxLength={80} className={inputCls} /></div>}
              <ShareFieldRow dark={dark} label="Statistiques" on={opts.stats} onToggle={() => set('stats', !opts.stats)} />
              <ShareFieldRow dark={dark} label="Profil altimétrique" on={opts.profile} onToggle={() => set('profile', !opts.profile)} />
              <ShareFieldRow dark={dark} label="Lien « Voir sur Routdoor »" on={opts.link} onToggle={() => set('link', !opts.link)} />
            </div>
          </div>
          <div>
            <div className={sectionTitle}>Couleur du tracé</div>
            <div className="flex flex-wrap gap-2">
              {SHARE_COLORS.map((c) => (
                <button key={c.value} title={c.label} onClick={() => set('color', c.value)}
                  className={`w-8 h-8 rounded-full transition-transform hover:scale-105 ${opts.color === c.value ? 'ring-2 ring-blue-500 ring-offset-2 ring-offset-neutral-900' : 'ring-1 ring-white/15'}`}
                  style={{ background: c.value === 'routes' ? 'conic-gradient(#ef4444,#f59e0b,#22c55e,#3b82f6,#a855f7,#ef4444)' : c.value }} />
              ))}
            </div>
          </div>
          <ShareRoutesPicker allRoutes={allRoutes} included={included} setIncluded={setIncluded} dark={dark} sectionTitle={sectionTitle} label={label} />
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- réception d'un lien
// Carte flottante quand l'app est ouverte avec « #t=… »
function SharedRouteBanner({ shared, dark, onSave, onClose }) {
  const parts = shared.parts;
  const sum = (k) => parts.reduce((a, p) => a + (p[k] || 0), 0);
  const isMobile = useIsMobile();
  return (
    <div className={`fixed z-[1200] animate-menu ${isMobile ? 'left-3 right-3' : 'left-1/2 -translate-x-1/2 w-[420px]'}`}
      style={{ bottom: isMobile ? 'calc(env(safe-area-inset-bottom, 0px) + 16px)' : 28 }}>
      <div className={`glass-strong rounded-xl shadow-2xl p-4 ${dark ? 'text-white ring-1 ring-white/10' : 'text-neutral-900 ring-1 ring-neutral-200'}`}>
        <div className="flex items-start gap-3">
          <span className="w-9 h-9 shrink-0 grid place-items-center rounded-lg bg-blue-500/15 text-blue-400"><I.Link size={17} /></span>
          <div className="min-w-0 flex-1">
            <div className={`text-[10.5px] font-semibold uppercase tracking-wider ${dark ? 'text-neutral-400' : 'text-neutral-500'}`}>Tracé partagé avec toi</div>
            <div className="text-[15px] font-semibold truncate mt-0.5">{shared.title || (parts[0] && parts[0].name) || 'Itinéraire'}</div>
            <div className={`text-[12px] mt-0.5 tabular-nums ${dark ? 'text-neutral-400' : 'text-neutral-500'}`}>
              {parts.length > 1 ? `${parts.length} étapes · ` : ''}{stNum(sum('distance'))} km · {stNum(sum('ascent'), 0)} m D+
            </div>
          </div>
          <button onClick={onClose} aria-label="Fermer" className={`w-7 h-7 grid place-items-center rounded-md ${dark ? 'text-neutral-400 hover:bg-white/10 hover:text-white' : 'text-neutral-500 hover:bg-neutral-100'}`}><I.X size={15} /></button>
        </div>
        <div className="mt-3.5 flex gap-2">
          <button onClick={onSave} className="flex-1 h-9 rounded-lg text-[13px] font-semibold text-white bg-blue-500 hover:bg-blue-600 flex items-center justify-center gap-2">
            <I.Plus size={15} /> Ajouter à mes tracés
          </button>
          <button onClick={onClose} className={`h-9 px-3.5 rounded-lg text-[13px] font-medium ${dark ? 'bg-white/10 hover:bg-white/15' : 'bg-neutral-100 hover:bg-neutral-200'}`}>Ignorer</button>
        </div>
      </div>
    </div>
  );
}

// Couleur hexadécimale -> clé ROUTE_COLORS la plus proche
function routeColorKey(hex) {
  const h = String(hex || '').replace('#', '');
  if (h.length !== 6) return 'blue';
  const rgb = (x) => [0, 2, 4].map((i) => parseInt(x.slice(i, i + 2), 16));
  const [r, g, b] = rgb(h);
  let best = 'blue', bd = Infinity;
  Object.entries(ROUTE_COLORS).forEach(([k, v]) => {
    const [r2, g2, b2] = rgb(v.hex.replace('#', ''));
    const dd = (r - r2) ** 2 + (g - g2) ** 2 + (b - b2) ** 2;
    if (dd < bd) { bd = dd; best = k; }
  });
  return best;
}

Object.assign(window, { ShareLinkButton, EmbedPane, SharedRouteBanner, routeColorKey, sharePayload });
