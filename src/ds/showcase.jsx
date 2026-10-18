// Documentation vivante du design system : chaque exemple utilise le vrai
// composant de src/ds/ui.jsx (ce qui est montré ici est ce qui est livré).

const { useState: useDsState } = React;

const DS_NAV = [
  { group: 'Fondations', items: [['principes', 'Principes'], ['couleurs', 'Couleurs'], ['typographie', 'Typographie'], ['formes', 'Rayons & tailles'], ['marques', 'Marques']] },
  { group: 'Composants', items: [['boutons', 'Boutons'], ['controles', 'Contrôles'], ['champs', 'Champs'], ['choix', 'Puces & couleurs'], ['structure', 'Sections & cartes'], ['parcours', 'Étapes'], ['import', 'Import'], ['retours', 'États & retours']] },
];

function DsBlock({ id, title, intro, children }) {
  return (
    <section id={id} className="scroll-mt-8 py-12 border-b border-white/[0.06] last:border-b-0">
      <h2 className="text-[24px] font-semibold tracking-tight text-white">{title}</h2>
      {intro && <p className="mt-1.5 text-[13.5px] text-neutral-400 leading-relaxed max-w-[640px]">{intro}</p>}
      <div className="mt-6 flex flex-col gap-5">{children}</div>
    </section>
  );
}
// Exemple : rendu sur un panneau de l'app + extrait de code
function DsDemo({ title, note, code, children, pad = 'p-6', stage }) {
  const [showCode, setShowCode] = useDsState(false);
  return (
    <div className="rounded-2xl ring-1 ring-white/[0.08] overflow-hidden flex flex-col">
      <div className="flex items-center justify-between gap-3 px-4 h-11 border-b border-white/[0.06] bg-white/[0.02]">
        <div className="min-w-0">
          <span className="text-[12.5px] font-semibold text-neutral-100">{title}</span>
          {note && <span className="ml-2 text-[11.5px] text-neutral-500">{note}</span>}
        </div>
        {code && <UiButton size="xs" variant="ghost" icon="Code" onClick={() => setShowCode((v) => !v)}>{showCode ? 'Masquer' : 'Code'}</UiButton>}
      </div>
      <div className={`flex-1 ${pad}`} style={{ background: stage ? 'radial-gradient(ellipse at 50% 40%, #3a3a3e 0%, #2a2a2d 55%, #1f1f22 100%)' : '#111112' }}>{children}</div>
      {showCode && <pre className="m-0 px-4 py-3 text-[11.5px] leading-relaxed text-neutral-300 bg-black/40 border-t border-white/[0.06] overflow-x-auto sb-scroll"><code>{code.trim()}</code></pre>}
    </div>
  );
}
function DsSwatchCard({ t }) {
  const isLine = /line|fill/.test(t.name);
  return (
    <div className="rounded-xl ring-1 ring-white/[0.08] overflow-hidden bg-[#111112]">
      <div className="h-16 relative" style={{ background: isLine ? '#0a0a0a' : t.value }}>
        {isLine && <div className="absolute inset-3 rounded-lg" style={{ background: /fill/.test(t.name) ? t.value : 'transparent', border: /line/.test(t.name) ? `1px solid ${t.value}` : 'none' }} />}
      </div>
      <div className="px-3 py-2.5">
        <div className="text-[12.5px] font-semibold text-white">{t.name}</div>
        <div className="text-[11px] text-neutral-500 tabular-nums truncate" style={{ fontVariantLigatures: 'none', fontFeatureSettings: '"liga" 0, "calt" 0' }}>{t.css} · {t.value}</div>
        <div className="text-[11px] text-neutral-400 mt-0.5">{t.use}</div>
      </div>
    </div>
  );
}

function DesignSystemPage() {
  const [sw, setSw] = useDsState(true);
  const [rows, setRows] = useDsState({ villes: true, carte: true, gps: false });
  const [chip, setChip] = useDsState('epure');
  const [seg, setSeg] = useDsState('poster');
  const [col, setCol] = useDsState('#ffffff');
  const [bg, setBg] = useDsState('#0f1d33');
  const [step, setStep] = useDsState(2);
  const [op, setOp] = useDsState(40);
  const [checks, setChecks] = useDsState({ a: true, b: true, c: false });
  const [modal, setModal] = useDsState(false);
  const [toast, showToast] = useUiToast();

  return (
    <div className="h-full overflow-y-auto sb-scroll bg-neutral-950 text-white">
      <div className="max-w-[1180px] mx-auto px-6 flex gap-12">
        {/* Navigation */}
        <nav className="hidden lg:block w-[200px] shrink-0 sticky top-0 self-start py-10 max-h-screen overflow-y-auto sb-scroll">
          <div className="flex items-center gap-2 text-white mb-1"><UiPrintraceLogo height={16} /></div>
          <div className="mb-8 flex items-center gap-1.5 text-neutral-500 text-[11px]">& <UiRoutdoorLogo height={10} className="text-neutral-400" /></div>
          {DS_NAV.map((g) => (
            <div key={g.group} className="mb-6">
              <UiEyebrow className="mb-2">{g.group}</UiEyebrow>
              {g.items.map(([id, label]) => (
                <a key={id} href={'#' + id} className="block py-1 text-[13px] text-neutral-400 hover:text-white">{label}</a>
              ))}
            </div>
          ))}
        </nav>

        <main className="flex-1 min-w-0 pb-24">
          <header className="pt-12 pb-10 border-b border-white/[0.06]">
            <UiBadge tone="info">v1 · octobre 2026</UiBadge>
            <h1 className="mt-4 text-[44px] leading-[1.05] font-semibold tracking-tight">Design system</h1>
            <p className="mt-3 text-[15px] text-neutral-400 leading-relaxed max-w-[620px]">
              Les fondations et composants communs à <span className="text-white">Printrace</span> et <span className="text-white">Routdoor</span>,
              extraits du studio d'impression. Chaque exemple de cette page utilise le composant livré
              (<code className="text-neutral-300">src/ds/ui.jsx</code>) et les jetons de <code className="text-neutral-300">src/ds/tokens.css</code>.
            </p>
          </header>

          <DsBlock id="principes" title="Principes">
            <div className="grid sm:grid-cols-2 gap-3">
              {[
                ['Le visuel d’abord', 'Interface sombre et neutre : le poster, la carte ou la story restent la seule source de couleur à l’écran.'],
                ['Une action principale', 'Un seul bouton blanc par écran (Importer, Imprimez votre tracé…). Le reste est secondaire ou discret.'],
                ['Prêt sans réglage', 'Chaque option a un défaut recommandé (point vert), placé en premier. On peut tout changer, rien n’y oblige.'],
                ['Couleur = sens', 'Bleu pour un état (interrupteur, case, lien), vert pour recommandé, ambre pour une valeur modifiée, rouge pour supprimer.'],
              ].map(([t, d]) => (
                <UiCard key={t} className="p-4">
                  <div className="text-[14px] font-semibold">{t}</div>
                  <p className="mt-1 text-[12.5px] text-neutral-400 leading-relaxed">{d}</p>
                </UiCard>
              ))}
            </div>
          </DsBlock>

          <DsBlock id="couleurs" title="Couleurs" intro="Surfaces translucides posées sur un fond quasi noir : les niveaux se lisent par la transparence plutôt que par des gris opaques.">
            <UiEyebrow>Surfaces & lignes</UiEyebrow>
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-3">{UI_TOKENS.surfaces.map((t) => <DsSwatchCard key={t.name} t={t} />)}</div>
            <UiEyebrow className="mt-2">Texte</UiEyebrow>
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-3">{UI_TOKENS.text.map((t) => <DsSwatchCard key={t.name} t={t} />)}</div>
            <UiEyebrow className="mt-2">Fonctionnelles</UiEyebrow>
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-3">{UI_TOKENS.functional.map((t) => <DsSwatchCard key={t.name} t={t} />)}</div>
          </DsBlock>

          <DsBlock id="typographie" title="Typographie" intro="Barlow pour le texte, Barlow Semi Condensed pour les chiffres (tabulaires) et les titres, Unbounded pour les logotypes. Playfair Display et IM Fell English sont réservées aux posters.">
            <UiCard className="divide-y divide-white/[0.06]">
              {UI_TOKENS.type.map((t) => (
                <div key={t.name} className="flex items-baseline gap-6 px-5 py-4">
                  <div className="w-24 shrink-0 text-[11.5px] text-neutral-500">{t.name}</div>
                  <div className={`flex-1 min-w-0 truncate ${t.cls}`}>{t.sample}</div>
                  <div className="hidden md:block w-56 shrink-0 text-right text-[11px] text-neutral-500">{t.spec}</div>
                </div>
              ))}
            </UiCard>
          </DsBlock>

          <DsBlock id="formes" title="Rayons & tailles" intro="Plus un élément est grand, plus son rayon l'est. Les hauteurs suivent une grille fixe pour aligner boutons, champs et lignes.">
            <div className="grid sm:grid-cols-2 gap-5">
              <UiCard className="p-5">
                <UiEyebrow className="mb-4">Rayons</UiEyebrow>
                <div className="flex flex-wrap gap-4">
                  {UI_TOKENS.radius.map((r) => (
                    <div key={r.name} className="text-center">
                      <div className="w-14 h-14 bg-white/[0.08] ring-1 ring-white/20" style={{ borderRadius: r.value }} />
                      <div className="mt-1.5 text-[11.5px] font-semibold">{r.name}</div>
                      <div className="text-[10.5px] text-neutral-500 tabular-nums">{r.value} px</div>
                    </div>
                  ))}
                </div>
              </UiCard>
              <UiCard className="p-5">
                <UiEyebrow className="mb-4">Hauteurs</UiEyebrow>
                <div className="flex items-end gap-2.5">
                  {UI_TOKENS.sizes.map((s) => (
                    <div key={s.name} className="flex-1 text-center">
                      <div className="rounded-md bg-white/[0.08] ring-1 ring-white/15 grid place-items-center text-[10.5px] tabular-nums text-neutral-300" style={{ height: s.h }}>{s.h}</div>
                      <div className="mt-1.5 text-[11px] font-semibold">{s.name}</div>
                    </div>
                  ))}
                </div>
                <UiHint className="mt-3">xs 28 · sm 32 · md 36 · champ 40 · ligne 44 · action principale 48</UiHint>
              </UiCard>
            </div>
          </DsBlock>

          <DsBlock id="marques" title="Marques" intro="Deux produits, une même famille : Routdoor pour créer et modifier des itinéraires, Printrace pour les imprimer.">
            <div className="grid sm:grid-cols-2 gap-3">
              <DsDemo title="Printrace" note="UiPrintraceLogo" code={`<UiPrintraceLogo height={28} />`} pad="p-10">
                <div className="text-white"><UiPrintraceLogo height={34} /></div>
              </DsDemo>
              <DsDemo title="Routdoor" note="UiRoutdoorLogo" code={`<UiRoutdoorLogo height={28} />`} pad="p-10">
                <UiRoutdoorLogo height={34} />
              </DsDemo>
            </div>
          </DsBlock>

          <DsBlock id="boutons" title="Boutons">
            <DsDemo title="Variantes" note="UiButton" code={`
<UiButton variant="primary" icon="Upload">Importer un tracé</UiButton>
<UiButton>Secondaire</UiButton>
<UiButton variant="ghost">Discret</UiButton>
<UiButton variant="accent">Copier</UiButton>
<UiButton variant="strava">Importer</UiButton>
<UiButton variant="danger" icon="Trash">Supprimer</UiButton>`}>
              <div className="flex flex-wrap items-center gap-2.5">
                <UiButton variant="primary" icon="Upload">Importer un tracé</UiButton>
                <UiButton icon="Folder">Secondaire</UiButton>
                <UiButton variant="ghost" icon="ChevronLeft">Discret</UiButton>
                <UiButton variant="accent">Copier</UiButton>
                <UiButton variant="strava">Importer</UiButton>
                <UiButton variant="danger" icon="Trash">Supprimer</UiButton>
              </div>
            </DsDemo>
            <DsDemo title="Tailles & états" code={`
<UiButton size="xs">xs</UiButton>  <UiButton size="sm">sm</UiButton>  <UiButton size="md">md</UiButton>
<UiButton variant="primary" size="lg" iconRight="ChevronRight" block>Imprimez votre tracé</UiButton>
<UiButton loading>Chargement</UiButton>  <UiButton disabled>Désactivé</UiButton>
<UiIconButton icon="X" label="Fermer" />`}>
              <div className="flex flex-wrap items-center gap-2.5">
                <UiButton size="xs">xs · 28</UiButton>
                <UiButton size="sm">sm · 32</UiButton>
                <UiButton size="md">md · 36</UiButton>
                <UiButton loading>Chargement</UiButton>
                <UiButton disabled>Désactivé</UiButton>
                <UiIconButton icon="X" label="Fermer" />
                <UiIconButton icon="Trash" label="Supprimer" size="sm" variant="secondary" />
              </div>
              <div className="mt-4 max-w-[340px]"><UiButton variant="primary" size="lg" iconRight="ChevronRight" block>Imprimez votre tracé</UiButton></div>
            </DsDemo>
          </DsBlock>

          <DsBlock id="controles" title="Contrôles" intro="Les interrupteurs et cases sont des visuels : la ligne entière porte le clic, plus facile à viser.">
            <div className="grid md:grid-cols-2 gap-5">
              <DsDemo title="Lignes à interrupteur" note="UiToggleRow" code={`
<UiToggleRow label="Nom des villes" on={on} onToggle={() => setOn(!on)} />`}>
                <div className="max-w-[320px] -mx-2">
                  <UiToggleRow label="Nom des villes" on={rows.villes} onToggle={() => setRows((r) => ({ ...r, villes: !r.villes }))} />
                  <UiToggleRow label="Carte derrière le tracé" on={rows.carte} onToggle={() => setRows((r) => ({ ...r, carte: !r.carte }))} />
                  <UiToggleRow label="Coordonnées GPS" hint="Sous le logo, en haut à gauche" on={rows.gps} onToggle={() => setRows((r) => ({ ...r, gps: !r.gps }))} />
                </div>
              </DsDemo>
              <DsDemo title="Interrupteur, case, curseur" note="UiSwitch · UiCheckbox · UiSlider" code={`
<UiSwitch on={on} />
<UiCheckbox checked={checked} />
<UiSlider label="Opacité" value={40} min={15} max={100} step={5} unit="%" onChange={set} />`}>
                <div className="flex items-center gap-6">
                  <button onClick={() => setSw((v) => !v)} aria-label="Basculer"><UiSwitch on={sw} /></button>
                  {['a', 'b', 'c'].map((k) => (
                    <button key={k} onClick={() => setChecks((c) => ({ ...c, [k]: !c[k] }))} className="flex items-center gap-2 text-[12.5px] text-neutral-200">
                      <UiCheckbox checked={checks[k]} /> Tracé {k.toUpperCase()}
                    </button>
                  ))}
                </div>
                <div className="mt-5 max-w-[340px]"><UiSlider label="Opacité" value={op} min={15} max={100} step={5} unit="%" onChange={setOp} /></div>
              </DsDemo>
            </div>
          </DsBlock>

          <DsBlock id="champs" title="Champs">
            <div className="grid md:grid-cols-2 gap-5">
              <DsDemo title="Texte" note="UiInput · UiLabel · UiHint" code={`
<UiLabel>Titre</UiLabel>
<UiInput placeholder="Titre du poster" />
<UiHint>80 caractères maximum.</UiHint>`}>
                <UiLabel>Titre</UiLabel>
                <UiInput defaultValue="GR34 · Sentier des douaniers" />
                <UiHint className="mt-1.5">80 caractères maximum.</UiHint>
              </DsDemo>
              <DsDemo title="Avec icône et action" code={`
<UiInput icon="Link" placeholder="https://www.strava.com/activities/…"
  action={<UiButton size="sm" variant="strava">Importer</UiButton>} />`}>
                <UiInput icon="Link" placeholder="https://www.strava.com/activities/…" action={<UiButton size="sm" variant="strava">Importer</UiButton>} />
                <UiInput icon="Search" placeholder="Rechercher un tracé" className="mt-3" invalid />
                <p className="mt-1.5 text-[11.5px] text-red-300">État invalide : contour rouge + message sous le champ.</p>
              </DsDemo>
            </div>
          </DsBlock>

          <DsBlock id="choix" title="Puces & couleurs" intro="Le choix recommandé porte un point vert et passe en tête de liste.">
            <DsDemo title="Puces de choix" note="UiChip · UiSegmented" code={`
<UiChip active={v === 'epure'} rec onClick={…}>Épurée</UiChip>
<UiChip sub="29,7 × 42 cm" active>A3</UiChip>
<UiSegmented value={mode} onChange={setMode} options={[{ id: 'poster', label: 'Poster', icon: 'Poster' }, …]} />`}>
              <div className="grid grid-cols-3 gap-1.5 max-w-[360px]">
                {[['epure', 'Épurée', true], ['routes', 'Routes'], ['nature', 'Nature']].map(([id, l, r]) => (
                  <UiChip key={id} active={chip === id} rec={r} onClick={() => setChip(id)}>{l}</UiChip>
                ))}
              </div>
              <div className="grid grid-cols-3 gap-1.5 max-w-[360px] mt-3">
                <UiChip sub="21 × 29,7 cm">A4</UiChip><UiChip sub="29,7 × 42 cm" active>A3</UiChip><UiChip sub="42 × 59,4 cm">A2</UiChip>
              </div>
              <div className="mt-5"><UiSegmented value={seg} onChange={setSeg} options={[{ id: 'poster', label: 'Poster', icon: 'Poster' }, { id: 'story', label: 'Story', icon: 'Story' }, { id: 'embed', label: 'Embed', icon: 'Code' }]} /></div>
            </DsDemo>
            <DsDemo title="Pastilles de couleur" note="UiSwatch" code={`
<UiSwatch color="#ffffff" rec active={c === '#ffffff'} onClick={…} />
<UiSwatch shape="square" size={32} color="#0f1d33" rec />`}>
              <div className="flex flex-wrap items-center gap-1.5">
                {[['#ffffff', true], ['#facc15', true], ['#fc5200'], ['#3b82f6'], ['#22c55e'], ['#ec4899']].map(([c, r]) => (
                  <UiSwatch key={c} color={c} rec={r} active={col === c} onClick={() => setCol(c)} title={c} />
                ))}
              </div>
              <div className="flex flex-wrap items-center gap-2 mt-4">
                {[['#0f1d33', true], ['#103c6b'], ['#141414'], ['#1e2a33'], ['#15362b'], ['#3a1420']].map(([c, r]) => (
                  <UiSwatch key={c} shape="square" size={32} color={c} rec={r} active={bg === c} onClick={() => setBg(c)} title={c} />
                ))}
              </div>
              <UiHint rec className="mt-3">Recommandé pour l'impression</UiHint>
            </DsDemo>
          </DsBlock>

          <DsBlock id="structure" title="Sections & cartes">
            <div className="grid md:grid-cols-2 gap-5">
              <DsDemo title="Section d'inspecteur" note="UiSection" pad="p-0" code={`
<UiSection title="Carte" aside={<span>…</span>}>…</UiSection>`}>
                <div className="max-w-[340px] bg-white/[0.015]">
                  <UiSection title="Couleur du tracé"><div className="flex gap-1.5">{['#ffffff', '#facc15', '#fc5200'].map((c) => <UiSwatch key={c} color={c} active={c === '#ffffff'} />)}</div></UiSection>
                  <UiSection title="Infos affichées" aside={<span className="text-[11px] text-neutral-500">5</span>} defaultOpen={false}>…</UiSection>
                </div>
              </DsDemo>
              <DsDemo title="Cartes, badges, chiffres" note="UiCard · UiBadge · UiStat" code={`
<UiCard interactive active={on} className="p-3.5">…</UiCard>
<UiBadge tone="success">Recommandé</UiBadge>
<UiStat label="Distance" value="179,1" unit="km" />`}>
                <div className="flex flex-col gap-2">
                  <UiCard active className="p-3.5 flex items-center gap-3"><I.Download size={15} /><span className="flex-1 text-[13px] font-semibold">Fichier numérique HD</span><span className="text-[14px] font-semibold tabular-nums">3,99 €</span></UiCard>
                  <UiCard interactive className="p-3.5 flex items-center gap-3"><I.Poster size={15} /><span className="flex-1 text-[13px] font-semibold">Tirage encadré</span><UiBadge>Bientôt</UiBadge></UiCard>
                </div>
                <div className="mt-4 flex flex-wrap gap-1.5">
                  <UiBadge>Neutre</UiBadge><UiBadge tone="info">Info</UiBadge><UiBadge tone="success">Recommandé</UiBadge><UiBadge tone="warning">Modifié</UiBadge><UiBadge tone="danger">Erreur</UiBadge><UiBadge tone="solid">Nouveau</UiBadge>
                </div>
                <div className="mt-4 grid grid-cols-3 gap-4"><UiStat label="Distance" value="179,1" unit="km" /><UiStat label="Dénivelé +" value="1 313" unit="m" /><UiStat label="Durée" value="46 h 16" /></div>
              </DsDemo>
            </div>
          </DsBlock>

          <DsBlock id="parcours" title="Étapes" intro="Les longs réglages sont découpés en étapes courtes ; chaque étape reste accessible à tout moment.">
            <DsDemo title="Stepper" note="UiStepper" code={`<UiStepper steps={['Contenu', 'Carte', 'Cadre']} step={step} onStep={setStep} />`}>
              <div className="max-w-[340px]"><UiStepper steps={['Contenu', 'Carte', 'Cadre']} step={step} onStep={setStep} /></div>
            </DsDemo>
          </DsBlock>

          <DsBlock id="import" title="Import">
            <div className="grid md:grid-cols-2 gap-5">
              <DsDemo title="Zone de dépôt" note="UiDropzone" code={`
<UiDropzone accept={TRACK_ACCEPT} onFiles={importFiles} formats="GPX · FIT · TCX · KML / KMZ · GeoJSON · IGC" />`}>
                <UiDropzone accept=".gpx,.fit" onFiles={(fs) => showToast(`${fs.length} fichier(s) déposé(s)`)} formats="GPX · FIT · TCX · KML / KMZ · GeoJSON · IGC" />
              </DsDemo>
              <DsDemo title="Sources" note="UiSourceRow" code={`
<UiSourceRow logo="assets/strava.svg" label="Strava" sub="…" action={<UiBadge>Bientôt</UiBadge>} />`}>
                <div className="flex flex-col gap-1.5">
                  <UiSourceRow logo={(window.__resources || {}).stravaLogo || 'assets/strava.svg'} label="Strava" sub="Colle le lien d'une activité" action={<UiButton size="sm" variant="strava">Importer</UiButton>} />
                  <UiSourceRow logo={(window.__resources || {}).komootLogoGray || 'assets/komoot-gray.svg'} label="Komoot" sub="Export GPX ou FIT" action={<UiBadge>Bientôt</UiBadge>} />
                  <UiSourceRow logo={(window.__resources || {}).garminLogoGray || 'assets/garmin-gray.svg'} label="Garmin Connect" onClick={() => showToast('Connexion Garmin : bientôt')} />
                </div>
              </DsDemo>
            </div>
          </DsBlock>

          <DsBlock id="retours" title="États & retours">
            <div className="grid md:grid-cols-2 gap-5">
              <DsDemo title="État vide" note="UiEmptyState" stage pad="p-10" code={`
<UiEmptyState icon="Poster" title="Imprime ton aventure" body="…">
  <UiButton variant="primary">Importer un tracé</UiButton>
</UiEmptyState>`}>
                <UiEmptyState icon="Poster" title="Imprime ton aventure" body="Importe ton tracé et transforme-le en poster prêt à encadrer.">
                  <UiButton variant="primary" icon="Upload" className="mt-6">Importer un tracé</UiButton>
                </UiEmptyState>
              </DsDemo>
              <DsDemo title="Modale & toast" note="UiModal · useUiToast" code={`
const [toast, showToast] = useUiToast();
<UiModal open={open} onClose={close} title="…" footer={…}>…</UiModal>`}>
                <div className="flex flex-wrap gap-2.5">
                  <UiButton onClick={() => setModal(true)}>Ouvrir une modale</UiButton>
                  <UiButton onClick={() => showToast('Version enregistrée')}>Afficher un toast</UiButton>
                </div>
                <div className="mt-5 flex items-center gap-3 text-[12.5px] text-neutral-400"><UiSpinner /> Chargement (UiSpinner)</div>
              </DsDemo>
            </div>
          </DsBlock>
        </main>
      </div>
      <UiModal open={modal} onClose={() => setModal(false)} title="Supprimer « Nevez → Concarneau » ?" sub="Le tracé est retiré de ta bibliothèque. Les posters déjà téléchargés ne changent pas."
        footer={<><UiButton variant="ghost" onClick={() => setModal(false)}>Annuler</UiButton><UiButton variant="danger" icon="Trash" onClick={() => { setModal(false); showToast('Tracé supprimé'); }}>Supprimer</UiButton></>}>
        <UiCard className="p-3 flex items-center gap-3"><UiCheckbox checked /><span className="w-2.5 h-2.5 rounded-full bg-rose-500" /><span className="text-[13px]">Nevez → Concarneau</span><span className="ml-auto text-[11px] text-neutral-500 tabular-nums">42,2 km</span></UiCard>
      </UiModal>
      {toast}
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<DesignSystemPage />);
