// Share page — replaces the map area when sharing an itinerary.
// Two side-by-side cards: share link (free, with copy button) and
// embed iframe (Pro only, locked with upsell).

const { useState: useShareState, useRef: useShareRef } = React;

function SharePanel({ itinerary, dark, accent, plan, onClose }) {
  const [copied, setCopied] = useShareState(false);
  const inputRef = useShareRef(null);
  // Embed customization (Pro)
  const [embedColorKey, setEmbedColorKey] = useShareState(itinerary && itinerary.color ? itinerary.color : 'blue');
  const [showMetrics, setShowMetrics] = useShareState(true);
  const [hideWatermark, setHideWatermark] = useShareState(false);
  const [embedDark, setEmbedDark] = useShareState(false);

  if (!itinerary) return null;

  const shareUrl = `${location.origin}${location.pathname.replace(/[^/]*$/, '')}#r/${(itinerary.id || 'i').replace('i_', '')}-${(itinerary.name || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 30).replace(/-+$/, '')}`;
  const embedCode = `<iframe src="${shareUrl}/embed" width="100%" height="540" frameborder="0" loading="lazy" allowfullscreen></iframe>`;
  const color = (ROUTE_COLORS[itinerary.color] && ROUTE_COLORS[itinerary.color].hex) || '#3b82f6';
  const embedColor = (ROUTE_COLORS[embedColorKey] && ROUTE_COLORS[embedColorKey].hex) || '#3b82f6';

  const copy = () => {
    try {
      if (navigator.clipboard) {
        navigator.clipboard.writeText(shareUrl);
      } else if (inputRef.current) {
        inputRef.current.select();
        document.execCommand('copy');
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch (e) {}
  };

  return (
    <div className="absolute inset-0 z-[700] flex flex-col" style={{ background: 'rgba(10,12,18,0.6)', backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)' }}>
      {/* Top bar */}
      <div className="px-8 pt-7 pb-5 border-b border-white/15 flex items-start justify-between gap-4">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-wider text-white/55">Partage</div>
          <h1 className="mt-0.5 text-[22px] font-semibold tracking-tight text-white">
            Partager « {itinerary.name} »
          </h1>
          <p className="mt-1 text-[12.5px] text-white/65">
            Choisissez comment partager votre itinéraire avec d'autres.
          </p>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded-md transition-colors text-white/60 hover:text-white hover:bg-white/15"
          title="Fermer"
        >
          <I.X size={18} />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto sb-scroll">
        <div className="mx-auto px-8 py-8 flex flex-col gap-6" style={{ maxWidth: 920 }}>

          {/* Section 1 — Share link (compact, top) */}
          <ShareCard dark={dark}>
            <ShareCardHeader
              dark={dark}
              icon={<I.Link size={14} />}
              title="Partager un lien"
              subtitle="Envoyez le tracé à un ami — consultation seule, sans édition."
              accent={accent}
            />
            <div className="px-5 pb-5">
              <div className="flex items-stretch gap-3">
                {/* Tiny map thumbnail, no metrics */}
                <div className="w-28 shrink-0">
                  <SharePreview itinerary={itinerary} dark={dark} color={color} compact />
                </div>
                {/* Link input + copy + helper */}
                <div className="flex-1 min-w-0 flex flex-col justify-center">
                  <div className={`flex items-stretch rounded-md border overflow-hidden ${dark ? 'border-neutral-800 bg-neutral-900' : 'border-neutral-200 bg-neutral-50'}`}>
                    <input
                      ref={inputRef}
                      readOnly
                      value={shareUrl}
                      onFocus={(e) => e.target.select()}
                      className={`flex-1 min-w-0 bg-transparent outline-none text-[12.5px] px-3 py-2.5 ${dark ? 'text-neutral-200' : 'text-neutral-800'}`}
                    />
                    <button
                      onClick={copy}
                      className={`btn-cta-primary px-3.5 py-2.5 text-[12.5px] font-medium text-white flex items-center gap-1.5 whitespace-nowrap`}
                      style={{ background: copied ? '#10b981' : accent }}
                    >
                      {copied ? <I.Check size={13} stroke="white" strokeWidth="2.6" /> : <I.Link size={13} />}
                      {copied ? 'Copié !' : 'Copier le lien'}
                    </button>
                  </div>
                  <p className={`mt-2 text-[11px] ${dark ? 'text-neutral-500' : 'text-neutral-500'}`}>
                    Le lien reste actif tant que l'itinéraire existe.
                  </p>
                </div>
              </div>
            </div>
          </ShareCard>

          {/* Section 2 — Embed on a site (big, bottom) */}
          <ShareCard dark={dark}>
            <ShareCardHeader
              dark={dark}
              icon={<I.Embed size={14} />}
              title="Intégrer sur un site"
              subtitle="Affichez la carte interactive sur votre site ou blog — prête à personnaliser."
              accent={accent}
              badge={plan === 'pro' ? null : 'Pro'}
            />
            <div className="px-5 pb-5">
              {plan === 'pro' ? (
                <>
                  <div className="flex gap-4">
                    {/* Customization controls (left) */}
                    <div className="w-52 shrink-0 flex flex-col gap-5">
                      <div>
                        <div className={`text-[11px] font-semibold uppercase tracking-wider mb-2.5 ${dark ? 'text-neutral-500' : 'text-neutral-500'}`}>Couleur du tracé</div>
                        <div className="flex flex-wrap gap-2">
                          {Object.entries(ROUTE_COLORS).slice(0, 12).map(([key, c]) => (
                            <button
                              key={key}
                              onClick={() => setEmbedColorKey(key)}
                              className="w-6 h-6 rounded-full grid place-items-center transition-transform hover:scale-110"
                              style={{ background: c.hex, outline: embedColorKey === key ? `2px solid ${c.hex}` : 'none', outlineOffset: 2 }}
                              title={c.name}
                            >
                              {embedColorKey === key && <I.Check size={12} stroke="white" strokeWidth="3" />}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div>
                        <div className={`text-[11px] font-semibold uppercase tracking-wider mb-1.5 ${dark ? 'text-neutral-500' : 'text-neutral-500'}`}>Options</div>
                        <div className="flex flex-col gap-1">
                          <ShareToggleRow dark={dark} label="Afficher les stats" checked={showMetrics} onToggle={() => setShowMetrics((v) => !v)} />
                          <ShareToggleRow dark={dark} label="Masquer le watermark" checked={hideWatermark} onToggle={() => setHideWatermark((v) => !v)} />
                        </div>
                        <div className={`text-[11px] font-semibold uppercase tracking-wider mt-4 mb-2 ${dark ? 'text-neutral-500' : 'text-neutral-500'}`}>Apparence</div>
                        <div className={`flex p-0.5 rounded-lg ${dark ? 'bg-neutral-800' : 'bg-neutral-100'}`}>
                          <button
                            onClick={() => setEmbedDark(false)}
                            className={`flex-1 flex items-center justify-center gap-1.5 rounded-md py-1.5 text-[12px] font-medium transition-all ${!embedDark ? (dark ? 'bg-neutral-950 text-white shadow-sm' : 'bg-white text-neutral-900 shadow-sm') : (dark ? 'text-neutral-400' : 'text-neutral-500')}`}
                          >
                            <I.Sun size={13} /> Clair
                          </button>
                          <button
                            onClick={() => setEmbedDark(true)}
                            className={`flex-1 flex items-center justify-center gap-1.5 rounded-md py-1.5 text-[12px] font-medium transition-all ${embedDark ? (dark ? 'bg-neutral-950 text-white shadow-sm' : 'bg-white text-neutral-900 shadow-sm') : (dark ? 'text-neutral-400' : 'text-neutral-500')}`}
                          >
                            <I.Moon size={13} /> Sombre
                          </button>
                        </div>
                      </div>
                    </div>
                    {/* Live embed preview (right) */}
                    <div className="flex-1 min-w-0">
                      <SharePreview itinerary={itinerary} dark={embedDark} color={embedColor} controls metrics={showMetrics} watermark={!hideWatermark} edge />
                    </div>
                  </div>
                  <div className="mt-4">
                    <div className={`text-[11px] font-semibold uppercase tracking-wider mb-1.5 ${dark ? 'text-neutral-500' : 'text-neutral-500'}`}>Code d'intégration</div>
                    <div className={`rounded-md overflow-hidden border ${dark ? 'border-neutral-800' : 'border-neutral-200'}`}>
                      <pre
                        className={`text-[11.5px] leading-relaxed font-mono px-3.5 py-3 overflow-x-auto ${dark ? 'bg-neutral-900 text-neutral-300' : 'bg-neutral-50 text-neutral-800'}`}
                        style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}
                      >{embedCode}</pre>
                    </div>
                    <button
                      className={`btn-cta-primary mt-3 w-full px-3.5 py-2.5 text-[12.5px] font-medium text-white flex items-center justify-center gap-1.5 whitespace-nowrap`}
                      style={{ background: accent }}
                    >
                      <I.Download size={13} /> Copier le code embed
                    </button>
                  </div>
                </>
              ) : (
                /* Non-pro: same full layout as Pro, progressively blurred, Pro card on top */
                <div className="relative">
                  <div className="pointer-events-none select-none" style={{ opacity: 0.85 }}>
                    <div className="flex gap-4">
                      {/* Customization controls (left) */}
                      <div className="w-52 shrink-0 flex flex-col gap-5">
                        <div>
                          <div className={`text-[11px] font-semibold uppercase tracking-wider mb-2.5 ${dark ? 'text-neutral-500' : 'text-neutral-500'}`}>Couleur du tracé</div>
                          <div className="flex flex-wrap gap-2">
                            {Object.entries(ROUTE_COLORS).slice(0, 12).map(([key, c]) => (
                              <span key={key} className="w-6 h-6 rounded-full grid place-items-center" style={{ background: c.hex, outline: key === color ? `2px solid ${c.hex}` : 'none', outlineOffset: 2 }}></span>
                            ))}
                          </div>
                        </div>
                        <div>
                          <div className={`text-[11px] font-semibold uppercase tracking-wider mb-1.5 ${dark ? 'text-neutral-500' : 'text-neutral-500'}`}>Options</div>
                          <div className="flex flex-col gap-1">
                            <ShareToggleRow dark={dark} label="Afficher les stats" checked={true} onToggle={() => {}} />
                            <ShareToggleRow dark={dark} label="Masquer le watermark" checked={false} onToggle={() => {}} />
                          </div>
                        </div>
                      </div>
                      {/* Preview (right) */}
                      <div className="flex-1 min-w-0">
                        <SharePreview itinerary={itinerary} dark={dark} color={color} controls edge metrics watermark />
                      </div>
                    </div>
                    <div className="mt-4">
                      <div className={`text-[11px] font-semibold uppercase tracking-wider mb-1.5 ${dark ? 'text-neutral-500' : 'text-neutral-500'}`}>Code d'intégration</div>
                      <div className={`rounded-md overflow-hidden border ${dark ? 'border-neutral-800' : 'border-neutral-200'}`}>
                        <pre
                          className={`text-[11.5px] leading-relaxed font-mono px-3.5 py-3 ${dark ? 'bg-neutral-900 text-neutral-300' : 'bg-neutral-50 text-neutral-800'}`}
                          style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}
                        >{embedCode}</pre>
                      </div>
                    </div>
                  </div>

                  {/* Progressive blur veil — sharp at top, blurred toward the bottom */}
                  <div
                    className="absolute inset-0 pointer-events-none"
                    style={{
                      backdropFilter: 'blur(6px)',
                      WebkitBackdropFilter: 'blur(6px)',
                      WebkitMaskImage: 'linear-gradient(to bottom, transparent 0%, rgba(0,0,0,0.15) 28%, rgba(0,0,0,0.6) 55%, #000 80%)',
                      maskImage: 'linear-gradient(to bottom, transparent 0%, rgba(0,0,0,0.15) 28%, rgba(0,0,0,0.6) 55%, #000 80%)',
                    }}
                  ></div>

                  {/* Pro upsell — centered overlay over the blurred embed editor */}
                  <div className="absolute inset-0 flex items-center justify-center p-3">
                    <div
                      className="relative w-full max-w-[580px] rounded-2xl px-9 py-8 overflow-hidden shadow-2xl"
                      style={{ background: 'linear-gradient(135deg, #1e3a8a 0%, #2563eb 55%, #3b82f6 100%)' }}
                    >
                      <div className="absolute -top-14 -right-10 w-52 h-52 rounded-full" style={{ background: 'radial-gradient(circle, rgba(255,255,255,0.16), transparent 70%)' }}></div>
                      <div className="absolute -bottom-16 -left-10 w-56 h-56 rounded-full" style={{ background: 'radial-gradient(circle, rgba(255,255,255,0.10), transparent 70%)' }}></div>

                      <div className="relative flex items-center gap-6">
                        <img
                          src={(window.__resources && window.__resources.proCoin) || "assets/pro-coin.png"}
                          alt=""
                          width="96"
                          height="96"
                          draggable="false"
                          className="shrink-0 hidden sm:block"
                          style={{ filter: 'drop-shadow(0 8px 18px rgba(0,0,0,0.35))' }}
                        />
                        <div className="flex-1 min-w-0">
                          <span className="inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider mb-2.5" style={{ background: 'rgba(255,255,255,0.18)', color: '#fff' }}>
                            GR planner Pro
                          </span>
                          <h3 className="text-[19px] font-bold tracking-tight text-white leading-snug">
                            Libérez toute la puissance de GR planner
                          </h3>
                          <p className="text-[12.5px] mt-2.5 mb-1 leading-relaxed" style={{ color: 'rgba(255,255,255,0.85)' }}>
                            Restez fidèle à votre marque et débloquez tout GR planner :
                          </p>
                          <ul className="mt-2 space-y-1.5">
                            {['Itinéraires illimités', 'Customisation des cartes', 'Cartes météo & avalanche avancées', 'Export illimité'].map((feat) => (
                              <li key={feat} className="flex items-center gap-2 text-[12.5px] font-medium text-white">
                                <span className="grid place-items-center rounded-full shrink-0" style={{ width: 16, height: 16, background: 'rgba(255,255,255,0.22)' }}>
                                  <I.Check size={11} stroke="#fff" strokeWidth="3" />
                                </span>
                                {feat}
                              </li>
                            ))}
                          </ul>
                          <div className="flex items-center gap-3 mt-4">
                            <button
                              className="rounded-lg px-5 py-2.5 text-[12.5px] font-bold whitespace-nowrap transition-transform hover:scale-[1.03] active:scale-95"
                              style={{ background: '#fff', color: '#1e40af' }}
                            >
                              Passer en Pro — 7 j gratuits
                            </button>
                            <span className="text-[10.5px] whitespace-nowrap" style={{ color: 'rgba(255,255,255,0.7)' }}>Sans engagement</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </ShareCard>

        </div>
      </div>
    </div>
  );
}

function ShareCard({ children, dark, highlight }) {
  return (
    <div
      className={`rounded-xl border overflow-hidden ${dark ? 'bg-neutral-900/40 border-neutral-800' : 'bg-white border-neutral-200/80'}`}
    >
      {children}
    </div>
  );
}

function ShareCardHeader({ icon, title, subtitle, dark, accent, badge }) {
  return (
    <div className="px-5 pt-5 pb-4 flex items-start gap-3">
      <span
        className="w-9 h-9 rounded-md grid place-items-center shrink-0"
        style={{ background: accent + '22', color: accent }}
      >
        {icon}
      </span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <h3 className={`text-[14px] font-semibold tracking-tight ${dark ? 'text-white' : 'text-neutral-900'}`}>{title}</h3>
          {badge && (
            <span
              className="text-[9.5px] font-semibold uppercase tracking-wider px-1.5 py-px rounded"
              style={{ background: accent + '22', color: accent }}
            >{badge}</span>
          )}
        </div>
        <p className={`mt-0.5 text-[12px] leading-snug ${dark ? 'text-neutral-400' : 'text-neutral-500'}`}>{subtitle}</p>
      </div>
    </div>
  );
}

// Stylized read-only preview: faux topo SVG card with the route + stats row,
// mirrors what the recipient would see when opening the public link.
function SharePreview({ itinerary, dark, color, compact, controls, short, metrics = true, watermark = false, edge }) {
  const stats = itineraryStats ? itineraryStats(itinerary) : { distance: itinerary.distance || 0, ascent: itinerary.ascent || 0 };
  // Generate a coarse pseudo-elevation for the preview row
  // Itinéraire à sections (ex. GR34) : on assemble les traces des sections
  const sectionCoords = (itinerary.sections || []).flatMap((sec) => sec.coords || []);
  const coords = (itinerary.coords && itinerary.coords.length)
    ? itinerary.coords
    : sectionCoords.length >= 2
      ? sectionCoords
      : (typeof samplePathToLatLng === 'function' && itinerary.path ? samplePathToLatLng(itinerary.path, 40) : null);
  const rawElev = (coords && coords.length >= 2 && typeof computeElevationStats === 'function')
    ? computeElevationStats(coords)
    : { minAlt: 60, maxAlt: 78, ascent: 32, descent: 22, slopeMin: -2, slopeMax: 2, profile: [] };
  const elev = stats.ascent ? { ...rawElev, ascent: Math.round(stats.ascent) } : rawElev;

  // Build a simple inline route path from coords or fallback
  const routeD = coordsToPreviewPath(coords);

  // Compact variant: tiny map only, no stats / chart (used for the link share)
  if (compact) {
    return (
      <div className={`rounded-md overflow-hidden border h-full ${dark ? 'border-neutral-800' : 'border-neutral-200'}`}>
        <div className="relative w-full h-full overflow-hidden" style={{ minHeight: 72, background: dark ? '#1c1c1c' : '#f1ede4' }}>
          <svg viewBox="0 0 320 200" width="100%" height="100%" preserveAspectRatio="xMidYMid slice">
            <rect x="-120" y="-80" width="560" height="360" fill={dark ? '#1c1c1c' : '#f1ede4'} />
            <path d="M0 200 L 0 165 C 50 160, 120 175, 200 170 L 320 178 L 320 200 Z" fill={dark ? '#0c2839' : '#cfe4ec'} />
            <path d={routeD} fill="none" stroke="#fff" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" />
            <path d={routeD} fill="none" stroke={color} strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      </div>
    );
  }

  return (
    <div className={`rounded-md overflow-hidden border ${dark ? 'border-neutral-800' : 'border-neutral-200'}`}>
      {/* Map preview */}
      <div className="relative w-full overflow-hidden" style={{ aspectRatio: short ? '16/8' : '16/9', background: dark ? '#1c1c1c' : '#f1ede4' }}>
        <svg viewBox="0 0 320 200" width="100%" height="100%" preserveAspectRatio="xMidYMid slice" style={edge ? undefined : { transform: 'scale(0.78)', transformOrigin: 'center' }}>
          {/* Faux land + roads */}
          <rect x="-120" y="-80" width="560" height="360" fill={dark ? '#1c1c1c' : '#f1ede4'} />
          <g stroke={dark ? 'rgba(255,255,255,0.05)' : 'rgba(60,40,20,0.08)'} strokeWidth="1" fill="none">
            <path d="M0 70 C 80 60, 180 70, 320 60" />
            <path d="M0 100 C 100 90, 180 105, 320 95" />
            <path d="M0 130 C 80 120, 200 130, 320 125" />
          </g>
          <g stroke={dark ? 'rgba(255,255,255,0.08)' : 'rgba(120,90,50,0.18)'} strokeWidth="1.5" fill="none">
            <path d="M0 150 C 80 130, 200 145, 320 130" />
            <path d="M120 0 L 130 200" />
          </g>
          {/* Water */}
          <path d="M0 200 L 0 165 C 50 160, 120 175, 200 170 L 320 178 L 320 200 Z" fill={dark ? '#0c2839' : '#cfe4ec'} />
          {/* Route */}
          <path d={routeD} fill="none" stroke="#fff" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
          <path d={routeD} fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          {/* Endpoints */}
          <PreviewEndpoint d={routeD} type="start" color={color} />
          <PreviewEndpoint d={routeD} type="end" color={color} />
        </svg>
        {/* Fake map controls overlaid (embed preview) */}
        {controls && (
          <div className="absolute right-2.5 top-2.5 flex flex-col gap-1.5">
            <div className={`flex flex-col rounded-md overflow-hidden shadow ${dark ? 'bg-neutral-900/90' : 'bg-white/95'}`}>
              <span className={`w-7 h-7 grid place-items-center ${dark ? 'text-neutral-300' : 'text-neutral-700'}`}><I.Plus size={14} /></span>
              <span className={`w-7 h-7 grid place-items-center border-t ${dark ? 'border-neutral-700 text-neutral-300' : 'border-neutral-200 text-neutral-700'}`}><I.Minus size={14} /></span>
            </div>
            <span className={`w-7 h-7 grid place-items-center rounded-md shadow ${dark ? 'bg-neutral-900/90 text-neutral-300' : 'bg-white/95 text-neutral-700'}`}><I.Stack size={14} /></span>
          </div>
        )}
        {/* GR planner watermark — top-left. Icon only by default, name on hover. */}
        {watermark && (
          <div className="group/wm absolute left-2.5 top-2.5 flex items-center rounded-md px-1.5 py-1 transition-all" style={{ background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(2px)' }}>
            <img src={(window.__resources && window.__resources.logoGr) || "assets/logo-gr.svg"} alt="" width="16" height="16" draggable="false" style={{ display: 'block' }} />
            <span className="text-[10px] font-semibold tracking-tight max-w-0 overflow-hidden whitespace-nowrap opacity-0 transition-all duration-200 group-hover/wm:max-w-[80px] group-hover/wm:opacity-100 group-hover/wm:ml-1.5" style={{ color: '#fff' }}>GR planner</span>
          </div>
        )}
      </div>
      {/* Stats row */}
      {metrics && (
      <div className={`flex items-center justify-between gap-4 px-3.5 py-2.5 ${dark ? 'bg-neutral-900' : 'bg-white'}`}>
        <div className="flex items-center gap-2 min-w-0">
          <span
            className="w-6 h-6 rounded grid place-items-center shrink-0"
            style={{ background: color + '22', color: color }}
          >
            <I.Route size={11} />
          </span>
          <span className={`text-[12px] font-medium truncate ${dark ? 'text-neutral-200' : 'text-neutral-800'}`}>{itinerary.name}</span>
        </div>
        <div className="flex items-center gap-4 shrink-0">
          <PreviewStat dark={dark} icon={<I.Distance size={10} />} label="Distance" value={(stats.distance || 0).toFixed(2) + ' km'} />
          <PreviewStat dark={dark} icon={<I.Mountains size={10} />} label="Altitude" value={`${elev.minAlt} m – ${elev.maxAlt} m`} />
          <PreviewStat dark={dark} icon={<I.TrendingUp size={10} />} label="Ascent" value={`${elev.ascent} m`} />
        </div>
      </div>
      )}
      {/* Mini elevation chart */}
      {!short && metrics && elev.profile && elev.profile.length >= 2 && (
        <div className={`px-3.5 pb-3 pt-2 ${dark ? 'bg-neutral-900 border-t border-neutral-800' : 'bg-white border-t border-neutral-100'}`}>
          <SharePreviewChart profile={elev.profile} minAlt={elev.minAlt} maxAlt={elev.maxAlt} color={color} dark={dark} />
        </div>
      )}
    </div>
  );
}

function ShareToggleRow({ dark, label, checked, onToggle }) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <span className={`text-[12px] ${dark ? 'text-neutral-200' : 'text-neutral-800'}`}>{label}</span>
      <button
        onClick={onToggle}
        aria-pressed={checked}
        style={{
          position: 'relative', width: 28, height: 16, borderRadius: 999, flexShrink: 0,
          background: checked ? '#3b82f6' : (dark ? '#404040' : '#d4d4d4'),
          transition: 'background-color .15s',
        }}
      >
        <span style={{
          position: 'absolute', top: 2, left: checked ? 14 : 2,
          width: 12, height: 12, borderRadius: '50%', background: '#fff',
          boxShadow: '0 1px 2px rgba(0,0,0,0.2)', transition: 'left .15s',
        }}></span>
      </button>
    </div>
  );
}

function PreviewStat({ dark, icon, label, value }) {
  return (
    <div className="flex flex-col leading-tight">
      <span className={`text-[8.5px] font-medium uppercase tracking-wider ${dark ? 'text-neutral-500' : 'text-neutral-500'}`}>{label}</span>
      <span className={`text-[11.5px] font-semibold tabular-nums mt-px ${dark ? 'text-white' : 'text-neutral-900'}`}>{value}</span>
    </div>
  );
}

function SharePreviewChart({ profile, minAlt, maxAlt, color, dark }) {
  if (!profile || profile.length < 2) return null;
  const W = 600, H = 40;
  const range = Math.max(maxAlt - minAlt, 1);
  const toX = (i) => (i / (profile.length - 1)) * W;
  const toY = (alt) => (1 - (alt - minAlt) / range) * H;
  const line = profile.map((v, i) => (i === 0 ? 'M' : 'L') + toX(i).toFixed(1) + ' ' + toY(v).toFixed(1)).join(' ');
  const area = line + ' L ' + W + ' ' + H + ' L 0 ' + H + ' Z';
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="36" preserveAspectRatio="none" style={{ display: 'block' }}>
      <defs>
        <linearGradient id={`sp-fill-${dark ? 'd' : 'l'}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={color} stopOpacity="0.22" />
          <stop offset="1" stopColor={color} stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#sp-fill-${dark ? 'd' : 'l'})`} />
      <path d={line} fill="none" stroke={color} strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// Decorative start/end markers for the preview map
function PreviewEndpoint({ d, type, color }) {
  // We can't easily measure a path here; just place markers at fixed positions
  // relative to the route placeholder when coords aren't available.
  const pos = type === 'start' ? { cx: 60, cy: 130 } : { cx: 260, cy: 80 };
  if (type === 'start') {
    return (
      <g>
        <circle cx={pos.cx} cy={pos.cy} r="6" fill="#fff" stroke={color} strokeWidth="2.2" />
        <circle cx={pos.cx} cy={pos.cy} r="2.4" fill={color} />
      </g>
    );
  }
  return (
    <g>
      <circle cx={pos.cx} cy={pos.cy} r="6" fill={color} stroke="#fff" strokeWidth="2.2" />
      <path d={`M${pos.cx - 3} ${pos.cy} L${pos.cx - 1} ${pos.cy + 2} L${pos.cx + 3} ${pos.cy - 2}`} stroke="#fff" strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </g>
  );
}

// Build a coarse SVG path inside a 320x200 viewBox from a list of [lat,lng]
function coordsToPreviewPath(coords) {
  if (!coords || coords.length < 2) {
    // Default decorative path
    return 'M60 130 C 100 110, 140 95, 180 100 S 240 80, 260 80';
  }
  let minLat = Infinity, maxLat = -Infinity, minLng = Infinity, maxLng = -Infinity;
  for (const [la, ln] of coords) {
    if (la < minLat) minLat = la;
    if (la > maxLat) maxLat = la;
    if (ln < minLng) minLng = ln;
    if (ln > maxLng) maxLng = ln;
  }
  const W = 320, H = 200, PAD = 28;
  const sx = (W - 2 * PAD) / Math.max(maxLng - minLng, 1e-9);
  const sy = (H - 2 * PAD) / Math.max(maxLat - minLat, 1e-9);
  const s = Math.min(sx, sy);
  const offX = PAD + ((W - 2 * PAD) - (maxLng - minLng) * s) / 2;
  const offY = PAD + ((H - 2 * PAD) - (maxLat - minLat) * s) / 2;
  return coords.map(([la, ln], i) => {
    const x = offX + (ln - minLng) * s;
    const y = offY + (maxLat - la) * s;
    return (i === 0 ? 'M' : 'L') + x.toFixed(1) + ' ' + y.toFixed(1);
  }).join(' ');
}

window.SharePanel = SharePanel;
