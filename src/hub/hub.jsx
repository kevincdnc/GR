// Hub — page d'accueil du site : une tuile par service (Routdoor, studio
// Printrace, site Printrace) et les ressources communes. Design system.

const { useEffect: useHubEffect } = React;

// Hors du site (aperçu), les tuiles mènent aux services en ligne
const HUB_LOCAL = /github\.io$|^localhost$|^127\.0\.0\.1$/.test(location.hostname);
const HUB_ROOT = HUB_LOCAL ? '' : 'https://kevincdnc.github.io/GR/';
const hubLink = (path) => (HUB_LOCAL ? { href: path } : { href: HUB_ROOT + path, target: '_blank', rel: 'noopener' });

// Services : chemin relatif à la racine du site
const HUB_SERVICES = [
  {
    id: 'routdoor', key: '1', path: 'routdoor/', name: 'Routdoor', kind: 'Application',
    desc: 'Créer, importer et modifier tes itinéraires. Carte, statistiques, partage.',
    logo: <UiRoutdoorLogo height={22} />, accent: '#3b82f6',
  },
  {
    id: 'studio', key: '2', path: 'printrace/studio/', name: 'Printrace', kind: 'Produit · studio',
    desc: 'Importer un tracé et composer son poster : modèles, carte vectorielle, export HD.',
    logo: <span className="text-white"><UiPrintraceLogo height={22} /></span>, accent: '#fc5200',
  },
  {
    id: 'site', key: '3', path: 'printrace/', name: 'Printrace', kind: 'Site web',
    desc: 'La page d’accueil publique : « Imprimez votre trek », import GPX ou Strava.',
    logo: <span className="text-white"><UiPrintraceLogo height={22} /></span>, accent: '#34d399',
  },
];
const HUB_RESOURCES = [
  { path: 'design-system/', icon: 'Layers', name: 'Design system', desc: 'Fondations et composants communs' },
  { href: 'https://github.com/kevincdnc/GR', icon: 'Code', name: 'Code source', desc: 'kevincdnc/GR sur GitHub' },
];

// Aperçus dessinés de chaque service (miniatures schématiques)
function HubPreview({ id }) {
  if (id === 'routdoor') return (
    <svg viewBox="0 0 400 220" className="w-full h-full" aria-hidden="true">
      <rect width="400" height="220" fill="#151517" />
      <path d="M0 60 C60 50 90 90 150 70 S260 30 400 55 M0 150 C80 140 120 170 200 150 S320 120 400 140" stroke="#232327" strokeWidth="10" fill="none" />
      <path d="M0 110 H400 M130 0 V220 M290 0 V220" stroke="#1d1d21" strokeWidth="2" />
      <rect x="14" y="14" width="96" height="192" rx="10" fill="#0d0d0f" stroke="#ffffff14" />
      <rect x="24" y="28" width="52" height="7" rx="3.5" fill="#ffffffcc" />
      {['#f43f5e', '#0ea5e9', '#f59e0b', '#10b981'].map((c, i) => (
        <g key={c}><circle cx="30" cy={58 + i * 26} r="3.5" fill={c} /><rect x="40" y={54 + i * 26} width={54 - i * 6} height="5" rx="2.5" fill="#ffffff55" /><rect x="40" y={63 + i * 26} width="30" height="4" rx="2" fill="#ffffff22" /></g>
      ))}
      <path d="M140 170 C160 150 175 160 190 140 S215 120 230 128 S258 150 275 120 S300 80 320 92 S352 70 372 52" stroke="#10b981" strokeWidth="3.5" fill="none" strokeLinecap="round" />
      <path d="M140 170 C150 182 170 176 182 188" stroke="#f43f5e" strokeWidth="3.5" fill="none" strokeLinecap="round" />
      <circle cx="372" cy="52" r="5" fill="#151517" stroke="#fff" strokeWidth="2.5" />
      <rect x="250" y="176" width="136" height="32" rx="9" fill="#0d0d0f" stroke="#ffffff14" />
      <rect x="262" y="187" width="40" height="5" rx="2.5" fill="#ffffff44" /><rect x="320" y="185" width="52" height="9" rx="3" fill="#ffffffaa" />
    </svg>
  );
  if (id === 'studio') return (
    <svg viewBox="0 0 400 220" className="w-full h-full" aria-hidden="true">
      <rect width="400" height="220" fill="#151517" />
      <rect x="0" y="0" width="74" height="220" fill="#0d0d0f" />
      {[0, 1, 2].map((i) => <rect key={i} x="12" y={20 + i * 26} width="50" height="16" rx="4" fill={i === 0 ? '#ffffff' : '#ffffff18'} />)}
      <rect x="320" y="0" width="80" height="220" fill="#111113" />
      {[0, 1, 2, 3, 4].map((i) => <g key={i}><rect x="330" y={22 + i * 22} width="34" height="5" rx="2.5" fill="#ffffff44" /><rect x="374" y={20 + i * 22} width="16" height="9" rx="4.5" fill={i < 3 ? '#3b82f6' : '#404040'} /></g>)}
      <rect x="152" y="18" width="128" height="182" fill="#151515" />
      <rect x="157" y="23" width="118" height="172" fill="#0f1d33" />
      <rect x="162" y="28" width="108" height="162" fill="none" stroke="#ffffffaa" strokeWidth="1" />
      <path d="M178 66 C190 80 186 96 202 104 S220 128 236 132 S250 150 258 152" stroke="#fff" strokeWidth="2.2" fill="none" />
      <circle cx="178" cy="66" r="3" fill="#0f1d33" stroke="#fff" strokeWidth="1.4" /><circle cx="258" cy="152" r="3" fill="#0f1d33" stroke="#fff" strokeWidth="1.4" />
      <rect x="216" y="160" width="50" height="26" fill="#0f1d33" stroke="#ffffffaa" strokeWidth="0.8" />
      <rect x="221" y="165" width="28" height="4" rx="1" fill="#fff" />
    </svg>
  );
  return (
    <svg viewBox="0 0 400 220" className="w-full h-full" aria-hidden="true">
      <defs><linearGradient id="hubSiteBg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#0a0a0a" /><stop offset="1" stopColor="#2e2e33" /></linearGradient></defs>
      <rect width="400" height="220" fill="url(#hubSiteBg)" />
      <rect x="22" y="16" width="44" height="7" rx="3.5" fill="#ffffffcc" />
      {[0, 1, 2].map((i) => <circle key={i} cx={322 + i * 9} cy="20" r="5" fill={['#2563eb', '#059669', '#f59e0b'][i]} stroke="#0a0a0a" strokeWidth="1.5" />)}
      <rect x="350" y="16" width="30" height="5" rx="2.5" fill="#fcd34d" />
      <text x="200" y="66" textAnchor="middle" fontFamily="Montserrat, Inter, sans-serif" fontWeight="800" fontSize="26" fill="#ffffffe6" letterSpacing="-1">Imprimez votre</text>
      <text x="200" y="98" textAnchor="middle" fontFamily="Montserrat, Inter, sans-serif" fontWeight="800" fontSize="30" fill="#34d399" letterSpacing="-1">trek</text>
      <rect x="170" y="104" width="60" height="2" rx="1" fill="#34d39955" />
      <rect x="112" y="118" width="80" height="16" rx="6" fill="none" stroke="#ffffff55" strokeDasharray="3 3" />
      <rect x="198" y="118" width="90" height="16" rx="6" fill="#ffffff12" /><rect x="262" y="121" width="22" height="10" rx="4" fill="#fc4c02" />
      <rect x="172" y="146" width="56" height="74" fill="#151515" /><rect x="175" y="149" width="50" height="71" fill="#0f1d33" />
      <path d="M186 160 C192 170 188 182 198 188 S208 200 214 206" stroke="#fff" strokeWidth="1.6" fill="none" />
      <rect x="22" y="70" width="48" height="60" rx="3" fill="#f4f1ea" transform="rotate(-7 46 100)" /><rect x="26" y="74" width="40" height="44" fill="#8aa7bf" transform="rotate(-7 46 100)" />
      <rect x="332" y="116" width="46" height="58" rx="3" fill="#f4f1ea" transform="rotate(6 355 145)" /><rect x="336" y="120" width="38" height="42" fill="#c98d7e" transform="rotate(6 355 145)" />
    </svg>
  );
}

function HubTile({ s }) {
  return (
    <a {...hubLink(s.path)} className="group relative flex flex-col rounded-2xl bg-white/[0.03] ring-1 ring-white/[0.08] overflow-hidden transition-all hover:ring-white/25 hover:bg-white/[0.05] hover:-translate-y-0.5 focus-visible:ring-white/40">
      <div className="relative aspect-[400/220] overflow-hidden border-b border-white/[0.06]">
        <div className="absolute inset-0 transition-transform duration-500 group-hover:scale-[1.03]"><HubPreview id={s.id} /></div>
        <span className="absolute top-3 left-3"><UiBadge tone="solid">{s.kind}</UiBadge></span>
      </div>
      <div className="flex-1 flex flex-col p-5">
        <div className="flex items-center justify-between gap-3 h-7">
          {s.logo}
          <kbd className="hidden md:inline-grid place-items-center w-6 h-6 rounded-md bg-white/[0.06] ring-1 ring-white/10 text-[11px] text-neutral-400 tabular-nums" title={`Raccourci : touche ${s.key}`}>{s.key}</kbd>
        </div>
        <p className="mt-3 text-[13.5px] text-neutral-400 leading-relaxed">{s.desc}</p>
        <div className="mt-auto pt-5 flex items-center justify-between gap-3">
          <span className="text-[12px] text-neutral-500 font-mono truncate">/{s.path}</span>
          <span className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-white">
            Ouvrir <span className="transition-transform group-hover:translate-x-0.5"><I.ChevronRight size={16} /></span>
          </span>
        </div>
      </div>
      <span className="absolute inset-x-0 top-0 h-[2px] opacity-0 group-hover:opacity-100 transition-opacity" style={{ background: s.accent }} />
    </a>
  );
}

function Hub() {
  // Raccourcis clavier 1, 2, 3
  useHubEffect(() => {
    const k = (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey || /input|textarea/i.test((e.target && e.target.tagName) || '')) return;
      const s = HUB_SERVICES.find((x) => x.key === e.key);
      if (s) { const l = hubLink(s.path); if (l.target) window.open(l.href, '_blank', 'noopener'); else location.href = l.href; }
    };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, []);

  return (
    <div className="h-full overflow-y-auto sb-scroll bg-[#0a0a0a] text-white">
      <div className="max-w-[1180px] mx-auto px-5 sm:px-8 py-10 sm:py-16">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <UiEyebrow>Hub</UiEyebrow>
            <h1 className="mt-2 text-[34px] sm:text-[40px] font-semibold tracking-tight leading-none">Tous mes services</h1>
            <p className="mt-3 text-[14px] text-neutral-400">Routdoor pour tracer, Printrace pour imprimer.</p>
          </div>
          <span className="hidden md:inline-flex items-center gap-2 text-[12px] text-neutral-500">
            Raccourcis <kbd className="px-1.5 rounded bg-white/[0.06] ring-1 ring-white/10 text-neutral-300">1</kbd>
            <kbd className="px-1.5 rounded bg-white/[0.06] ring-1 ring-white/10 text-neutral-300">2</kbd>
            <kbd className="px-1.5 rounded bg-white/[0.06] ring-1 ring-white/10 text-neutral-300">3</kbd>
          </span>
        </header>

        <section className="mt-10 grid gap-4 sm:gap-5 md:grid-cols-3">
          {HUB_SERVICES.map((s) => <HubTile key={s.id} s={s} />)}
        </section>

        <section className="mt-10">
          <UiEyebrow className="mb-3">Ressources</UiEyebrow>
          <div className="grid gap-2.5 sm:grid-cols-2">
            {HUB_RESOURCES.map((r) => {
              const Ico = I[r.icon] || I.Link;
              return (
                <a key={r.name} {...(r.href ? { href: r.href, target: '_blank', rel: 'noopener' } : hubLink(r.path))}
                  className="group flex items-center gap-3 rounded-xl px-4 py-3 bg-white/[0.03] ring-1 ring-white/[0.07] hover:bg-white/[0.06] transition-colors">
                  <span className="w-9 h-9 rounded-lg grid place-items-center bg-white/[0.06] text-neutral-200"><Ico size={17} /></span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-[13.5px] font-semibold">{r.name}</span>
                    <span className="block text-[12px] text-neutral-500 truncate">{r.desc}</span>
                  </span>
                  <span className="text-neutral-500 group-hover:text-white transition-colors">{r.href ? <I.ExternalLink size={15} /> : <I.ChevronRight size={16} />}</span>
                </a>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}

// Page pré-rendue au build : React se raccroche au HTML déjà affiché
const hubRootEl = document.getElementById('root');
if (hubRootEl.firstElementChild) ReactDOM.hydrateRoot(hubRootEl, <Hub />);
else ReactDOM.createRoot(hubRootEl).render(<Hub />);
