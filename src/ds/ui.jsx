// ==========================================================================
// Design system Routdoor · Printrace — composants React
// --------------------------------------------------------------------------
// Extraits de l'interface construite pour le studio (poster, story, embed) :
// mêmes rayons, mêmes surfaces translucides sur fond sombre, mêmes tailles.
// Fondations (polices, couleurs, rayons…) : src/ds/tokens.css.
// Documentation vivante : design-system.html (src/ds/showcase.jsx).
//
// Règles :
//  - thème sombre « studio » : fond neutral-950, surfaces blanches translucides
//  - une seule action principale (blanche) par écran, le reste en secondaire
//  - bleu = état (interrupteur, case, lien) ; vert = recommandé ; ambre = modifié
//  - libellés de section en petites capitales espacées, aides en 11 px gris
// ==========================================================================

const { useState: useUiState, useRef: useUiRef, useEffect: useUiEffect } = React;

const uiCx = (...a) => a.filter(Boolean).join(' ');

// Valeurs exposées à la documentation (miroir de tokens.css)
const UI_TOKENS = {
  surfaces: [
    { name: 'canvas', css: '--ds-canvas', value: '#0a0a0a', use: "Fond d'application" },
    { name: 'panel', css: '--ds-panel', value: '#111112', use: 'Panneaux latéraux' },
    { name: 'raised', css: '--ds-raised', value: '#171717', use: 'Menus, popovers' },
    { name: 'stage', css: '--ds-stage', value: '#2a2a2d', use: 'Scène derrière un visuel' },
    { name: 'fill-1', css: '--ds-fill-1', value: 'rgba(255,255,255,0.03)', use: 'Ligne, carte au repos' },
    { name: 'fill-2', css: '--ds-fill-2', value: 'rgba(255,255,255,0.06)', use: 'Bouton secondaire, champ' },
    { name: 'fill-3', css: '--ds-fill-3', value: 'rgba(255,255,255,0.10)', use: 'Survol' },
    { name: 'line-1', css: '--ds-line-1', value: 'rgba(255,255,255,0.06)', use: 'Séparateurs' },
    { name: 'line-2', css: '--ds-line-2', value: 'rgba(255,255,255,0.10)', use: 'Contours' },
    { name: 'line-3', css: '--ds-line-3', value: 'rgba(255,255,255,0.20)', use: 'Pointillés, contour actif' },
  ],
  text: [
    { name: 'text', css: '--ds-text', value: '#ffffff', use: 'Titres, valeurs' },
    { name: 'text-2', css: '--ds-text-2', value: '#d4d4d4', use: 'Texte courant' },
    { name: 'text-3', css: '--ds-text-3', value: '#a3a3a3', use: 'Libellés de section' },
    { name: 'text-4', css: '--ds-text-4', value: '#737373', use: 'Aides, méta' },
    { name: 'text-5', css: '--ds-text-5', value: '#525252', use: 'Désactivé' },
  ],
  functional: [
    { name: 'accent', css: '--ds-accent', value: '#3b82f6', use: 'Interrupteur, case, lien' },
    { name: 'success', css: '--ds-success', value: '#34d399', use: 'Recommandé' },
    { name: 'warning', css: '--ds-warning', value: '#fcd34d', use: 'Valeur modifiée' },
    { name: 'danger', css: '--ds-danger', value: '#f87171', use: 'Suppression' },
    { name: 'strava', css: '--ds-strava', value: '#fc4c02', use: 'Marque Strava' },
  ],
  radius: [
    { name: 'xs', value: 4, use: 'Pastilles de case' },
    { name: 'sm', value: 6, use: 'Vignettes, petits boutons' },
    { name: 'md', value: 8, use: 'Boutons, champs, puces' },
    { name: 'lg', value: 12, use: 'Cartes, listes, onglets' },
    { name: 'xl', value: 16, use: 'Zones de dépôt' },
    { name: '2xl', value: 24, use: 'Grandes zones, héros' },
  ],
  type: [
    { name: 'Display', cls: 'text-[28px] font-semibold tracking-tight', sample: 'Imprime ton aventure', spec: '28 · semibold · condensé' },
    { name: 'Titre', cls: 'text-[18px] font-semibold tracking-tight', sample: 'Imprimez votre tracé', spec: '18 · semibold' },
    { name: 'Corps', cls: 'text-[13px] text-neutral-200', sample: 'Glisse ton fichier GPX ou colle un lien Strava.', spec: '13 · regular' },
    { name: 'Libellé', cls: 'text-[12.5px] font-medium text-neutral-200', sample: 'Style de carte', spec: '12,5 · medium' },
    { name: 'Section', cls: 'text-[11px] font-semibold uppercase tracking-[0.08em] text-neutral-400', sample: 'Infos affichées', spec: '11 · semibold · capitales +8 %' },
    { name: 'Aide', cls: 'text-[11px] text-neutral-500', sample: 'Teintes sombres uniquement pour un rendu net.', spec: '11 · regular · text-4' },
    { name: 'Chiffre', cls: 'text-[22px] tabular-nums font-semibold', sample: '179,1 km · 1 313 m', spec: 'Barlow Semi Condensed · tabulaire' },
    { name: 'Site · titre', cls: 'font-display font-extrabold text-[40px] leading-none tracking-[-0.035em]', sample: 'Imprimez votre trek', spec: 'Mont (logo) · Montserrat en secours · 800' },
    { name: 'Site · texte', cls: 'font-site text-[16px] text-neutral-300', sample: 'Ton trek en poster vectoriel, prêt à encadrer.', spec: 'Inter · 400 / 600' },
  ],
  sizes: [
    { name: 'xs', h: 28, use: 'Puces, actions de ligne' },
    { name: 'sm', h: 32, use: 'Onglets, boutons compacts' },
    { name: 'md', h: 36, use: 'Boutons, puces de choix' },
    { name: 'field', h: 40, use: 'Champs de saisie' },
    { name: 'row', h: 44, use: 'Lignes de liste' },
    { name: 'lg', h: 48, use: 'Action principale' },
  ],
};

// ---------------------------------------------------------------- marques
const PRINTRACE_LOGO_SVG = '<svg width="1236" height="335" viewBox="0 0 1236 335" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M112.422 81.6821C145.713 81.6821 167.992 105.242 167.992 135.972C167.992 177.714 133.933 210.237 90.6545 210.237H61.7168L51.4733 260.942H3.84129L39.6933 81.6821H112.422ZM90.9106 170.032C107.812 170.032 119.336 155.947 119.336 139.814C119.336 128.802 112.934 121.888 100.898 121.888H79.3867L69.6554 170.032H90.9106ZM268.294 122.144H281.611L273.16 164.398H255.234C238.076 164.398 229.625 171.312 225.528 188.214L210.931 260.942H165.091L192.749 122.656H223.223L227.064 136.997C238.844 126.497 252.161 122.144 268.294 122.144ZM303.358 105.498L311.297 66.0609H357.392L349.453 105.498H303.358ZM272.628 260.942L300.285 122.656H346.124L318.467 260.942H272.628ZM459.526 118.302C486.416 118.302 502.293 136.485 502.293 163.63C502.293 175.154 500.5 181.044 484.623 260.942H438.784C453.893 185.141 455.173 181.044 455.173 175.666C455.173 164.91 449.795 159.276 439.808 159.276C424.699 159.276 413.943 169.52 409.846 186.934L394.993 260.942H349.153L376.811 122.656H408.821L412.407 136.741C424.699 125.217 441.344 118.302 459.526 118.302ZM623.862 161.325H588.522C580.583 200.25 580.071 203.835 580.071 206.396C580.071 215.103 585.449 219.713 595.436 219.713H612.338L604.143 260.942H578.278C549.597 260.942 532.695 244.809 532.695 219.2C532.695 211.518 533.976 206.396 542.939 161.325H516.818L519.122 150.569L594.412 82.4504H603.887L595.692 122.656H631.544L623.862 161.325ZM730.45 122.144H743.766L735.315 164.398H717.389C700.231 164.398 691.781 171.312 687.683 188.214L673.086 260.942H627.247L654.904 122.656H685.378L689.22 136.997C701 126.497 714.316 122.144 730.45 122.144ZM872.587 122.656H907.415L879.758 260.942H847.235L844.93 250.443C831.87 259.918 815.992 265.552 799.347 265.552C764.263 265.552 738.398 240.968 738.398 203.579C738.398 154.411 777.067 118.302 821.882 118.302C838.784 118.302 853.637 124.705 864.137 136.228L872.587 122.656ZM811.127 224.066C831.614 224.066 849.027 205.884 849.027 185.141C849.027 169.776 838.528 159.532 822.394 159.532C802.164 159.532 785.006 177.458 785.006 198.713C785.006 214.079 795.249 224.066 811.127 224.066ZM979.729 265.552C941.316 265.552 915.708 238.151 915.708 202.811C915.708 154.667 954.121 118.302 1003.29 118.302C1041.45 118.302 1066.29 144.935 1066.03 178.739H1020.96C1018.4 166.703 1009.44 159.788 996.887 159.788C976.912 159.788 961.547 179.251 961.803 199.482C962.059 214.591 971.791 223.81 985.619 223.81C998.424 223.81 1009.95 216.383 1016.86 203.323H1061.93C1049.64 243.016 1018.14 265.552 979.729 265.552ZM1226.08 179.251C1226.33 187.958 1224.8 195.128 1222.75 203.067H1119.29C1119.29 219.456 1128.25 227.907 1144.64 227.907C1156.17 227.907 1166.15 222.786 1172.3 214.079H1218.91C1204.57 246.602 1174.09 265.552 1138.5 265.552C1101.36 265.552 1076.01 237.895 1076.01 202.811C1076.01 155.179 1111.86 118.302 1162.06 118.302C1200.73 118.302 1226.08 144.679 1226.08 179.251ZM1157.45 154.923C1142.34 154.923 1131.33 164.142 1124.92 176.69H1183.06C1181.26 162.349 1172.3 154.923 1157.45 154.923Z" fill="white" fill-opacity="0.98"/><path d="M502.983 101.001C502.983 101.001 617 -35.0894 628.983 26.4988C640.967 88.087 673.482 20.8826 703.482 98.1606" stroke-width="21" stroke="white" stroke-opacity="0.6"/></svg>';
// Logotype Printrace, à la couleur du texte (currentColor)
function UiPrintraceLogo({ height = 22, className = '', title = 'Printrace' }) {
  const svg = PRINTRACE_LOGO_SVG.replace(/fill="white"/g, 'fill="currentColor"').replace(/stroke="white"/g, 'stroke="currentColor"')
    .replace(/width="1236" height="335"/, `width="${(height * 1236) / 335}" height="${height}"`);
  return <span role="img" aria-label={title} className={uiCx('inline-block select-none leading-none', className)} style={{ height }} dangerouslySetInnerHTML={{ __html: svg }} />;
}
// Logotype Routdoor (blanc en thème sombre ; les anneaux du tracé sont évidés)
function UiRoutdoorLogo({ dark = true, height = 22, className = '' }) {
  const hole = dark ? '#000' : '#fff';
  return (
    <svg viewBox="0 0 1237 284" height={height} width={height * 1237 / 284} fill="none" xmlns="http://www.w3.org/2000/svg"
      role="img" aria-label="Routdoor" className={uiCx('block select-none', dark ? 'text-white' : 'text-neutral-900', className)}>
      <path d="M1223.27 49.4297H1236.59L1228.14 91.6839H1210.21C1193.05 91.6839 1184.6 98.5982 1180.51 115.5L1165.91 188.228H1120.07L1147.73 49.9419H1178.2L1182.04 64.2827C1193.82 53.7832 1207.14 49.4297 1223.27 49.4297Z" fill="currentColor" />
      <path d="M1024.47 192.835C986.314 192.835 957.633 166.971 957.633 129.582C957.633 81.6941 996.558 45.5859 1044.96 45.5859C1083.11 45.5859 1111.8 71.1946 1111.8 108.583C1111.8 156.471 1072.87 192.835 1024.47 192.835ZM1028.82 151.093C1049.82 151.093 1065.96 132.911 1065.96 111.912C1065.96 97.0592 1056.23 87.0719 1040.86 87.0719C1019.61 87.0719 1003.73 105.254 1003.73 126.509C1003.73 141.362 1013.46 151.093 1028.82 151.093Z" fill="currentColor" />
      <path d="M857.159 192.835C819.002 192.835 790.32 166.971 790.32 129.582C790.32 81.6941 829.245 45.5859 877.646 45.5859C915.803 45.5859 944.484 71.1946 944.484 108.583C944.484 156.471 905.559 192.835 857.159 192.835ZM861.512 151.093C882.511 151.093 898.645 132.911 898.645 111.912C898.645 97.0592 888.913 87.0719 873.548 87.0719C852.293 87.0719 836.416 105.254 836.416 126.509C836.416 141.362 846.147 151.093 861.512 151.093Z" fill="currentColor" />
      <path d="M747.136 0H792.463L754.819 188.223H723.576L719.991 176.699C706.674 186.687 690.797 192.577 674.408 192.577C639.324 192.577 615.508 166.456 615.508 131.372C615.508 83.7401 652.896 45.8394 700.272 45.8394C714.101 45.8394 726.137 50.1929 735.612 57.8755L747.136 0ZM662.372 124.97C662.372 140.847 673.127 151.603 689.517 151.603C709.235 151.603 726.137 134.445 726.137 113.446C726.137 97.5688 715.637 86.5571 698.992 86.5571C679.273 86.5571 662.372 103.971 662.372 124.97Z" fill="currentColor" />
      <path d="M608.513 88.6089H573.173C565.234 127.534 564.722 131.119 564.722 133.68C564.722 142.387 570.1 146.997 580.087 146.997H596.989L588.794 188.226H562.929C534.248 188.226 517.346 172.093 517.346 146.484C517.346 138.802 518.627 133.68 527.59 88.6089H501.469L503.774 77.8533L579.063 9.73438H588.538L580.343 49.9399H616.195L608.513 88.6089Z" fill="currentColor" />
      <path d="M401.653 192.834C366.057 192.834 343.266 171.066 343.266 140.08C343.266 129.58 345.058 123.178 360.167 49.9375H406.007C391.666 121.898 389.617 129.58 389.617 135.214C389.617 145.97 396.019 151.091 407.543 151.091C420.86 151.091 431.359 140.08 434.432 124.715L449.285 49.9375H495.125L478.735 132.141C471.309 170.554 442.115 192.834 401.653 192.834Z" fill="currentColor" />
      <path d="M238.956 192.835C200.799 192.835 172.117 166.971 172.117 129.582C172.117 81.6941 211.042 45.5859 259.443 45.5859C297.599 45.5859 326.281 71.1946 326.281 108.583C326.281 156.471 287.356 192.835 238.956 192.835ZM243.309 151.093C264.308 151.093 280.442 132.911 280.442 111.912C280.442 97.0592 270.71 87.0719 255.345 87.0719C234.09 87.0719 218.213 105.254 218.213 126.509C218.213 141.362 227.944 151.093 243.309 151.093Z" fill="currentColor" />
      <path d="M166.712 61.7225C166.712 89.6359 150.579 112.171 126.763 123.695L149.81 188.229H99.3614L80.1549 132.402H58.8998L47.632 188.229H0L35.8521 8.96875H110.629C144.176 8.96875 166.712 30.9922 166.712 61.7225ZM75.2893 50.4547L66.8385 92.7089H90.3984C107.3 92.7089 117.8 80.4168 117.8 66.332C117.8 56.6008 111.397 50.4547 98.8492 50.4547H75.2893Z" fill="currentColor" />
      <path d="M848.466 238.656C848.469 238.661 848.473 238.667 848.478 238.673C848.487 238.686 848.499 238.702 848.513 238.721C848.541 238.759 848.579 238.811 848.626 238.874C848.721 239.001 848.854 239.178 849.024 239.4C849.363 239.845 849.85 240.473 850.476 241.254C851.726 242.814 853.537 244.993 855.838 247.542C860.419 252.617 867.039 259.272 875.124 265.446C890.885 277.484 914.574 289.403 939.936 279.759C947.726 276.796 954.576 272.726 960.908 268.579C967.595 264.2 972.921 260.299 979.434 256.279C991.617 248.76 1005.1 242.758 1024.79 242.758L1024.79 224.758C1000.75 224.758 984 232.308 969.98 240.962C963.391 245.029 956.623 249.869 951.047 253.521C945.116 257.404 939.533 260.654 933.538 262.934C917.178 269.155 900.362 262.072 886.05 251.141C879.098 245.831 873.288 240.011 869.199 235.48C867.165 233.227 865.581 231.321 864.521 229.997C863.991 229.336 863.594 228.822 863.337 228.485C863.209 228.317 863.115 228.193 863.059 228.117C863.031 228.08 863.012 228.054 863.002 228.041C862.998 228.035 862.995 228.031 862.994 228.03L862.995 228.032L862.997 228.035C862.989 228.044 862.738 228.23 855.729 233.342C848.457 238.645 848.459 238.648 848.461 238.65C848.462 238.652 848.464 238.654 848.466 238.656Z" fill="currentColor" />
      <path d="M855.942 249.985C864.108 249.985 870.727 243.365 870.727 235.2C870.727 227.034 864.108 220.414 855.942 220.414C847.776 220.414 841.156 227.034 841.156 235.2C841.156 243.365 847.776 249.985 855.942 249.985Z" fill={hole} />
      <path d="M855.941 243.985C851.089 243.985 847.156 240.051 847.156 235.199C847.156 230.347 851.09 226.414 855.941 226.414C860.793 226.414 864.727 230.347 864.728 235.199C864.728 240.051 860.794 243.985 855.941 243.985ZM855.941 255.985C867.421 255.985 876.728 246.679 876.728 235.199C876.727 223.72 867.421 214.414 855.941 214.414C844.462 214.414 835.156 223.72 835.156 235.199C835.156 246.679 844.462 255.985 855.941 255.985Z" fill="currentColor" />
      <path d="M1022.81 243.798C1030.97 243.798 1037.59 237.178 1037.59 229.012C1037.59 220.846 1030.97 214.227 1022.81 214.227C1014.64 214.227 1008.02 220.846 1008.02 229.012C1008.02 237.178 1014.64 243.798 1022.81 243.798Z" fill={hole} />
      <path d="M1022.81 237.798C1017.96 237.798 1014.02 233.864 1014.02 229.012C1014.02 224.16 1017.96 220.227 1022.81 220.227C1027.66 220.227 1031.59 224.16 1031.59 229.012C1031.59 233.864 1027.66 237.798 1022.81 237.798ZM1022.81 249.798C1034.29 249.798 1043.59 240.491 1043.59 229.012C1043.59 217.532 1034.29 208.227 1022.81 208.227C1011.33 208.227 1002.02 217.532 1002.02 229.012C1002.02 240.491 1011.33 249.798 1022.81 249.798Z" fill="currentColor" />
    </svg>
  );
}

// ---------------------------------------------------------------- actions
const UI_BTN_VARIANTS = {
  primary: 'bg-white text-neutral-900 hover:bg-neutral-200 font-semibold',
  secondary: 'bg-white/[0.06] text-neutral-100 hover:bg-white/[0.1] font-medium',
  ghost: 'text-neutral-300 hover:text-white hover:bg-white/[0.07] font-medium',
  accent: 'bg-blue-500 text-white hover:bg-blue-600 font-semibold',
  danger: 'bg-red-500/10 text-red-300 hover:bg-red-500/20 font-medium',
  strava: 'bg-[#fc4c02] text-white hover:brightness-110 font-semibold',
};
const UI_BTN_SIZES = {
  xs: 'h-7 px-2.5 gap-1 text-[11.5px] rounded-md',
  sm: 'h-8 px-3 gap-1.5 text-[12.5px] rounded-lg',
  md: 'h-9 px-3.5 gap-1.5 text-[12.5px] rounded-lg',
  lg: 'h-12 px-5 gap-2 text-[14px] rounded-xl',
};
const UI_ICON_SIZE = { xs: 12, sm: 14, md: 15, lg: 17 };
// Bouton : une seule action « primary » par écran
function UiButton({ variant = 'secondary', size = 'md', icon, iconRight, block, loading, className = '', children, ...rest }) {
  const Ico = typeof icon === 'string' ? I[icon] : null, IcoR = typeof iconRight === 'string' ? I[iconRight] : null;
  const s = UI_ICON_SIZE[size];
  return (
    <button {...rest} disabled={rest.disabled || loading}
      className={uiCx('inline-flex items-center justify-center whitespace-nowrap transition-colors disabled:opacity-50 disabled:pointer-events-none', UI_BTN_VARIANTS[variant], UI_BTN_SIZES[size], block && 'w-full', className)}>
      {loading ? <UiSpinner size={s} /> : Ico ? <Ico size={s} /> : icon}
      {children}
      {IcoR ? <IcoR size={s} /> : iconRight}
    </button>
  );
}
// Bouton icône seule (toujours avec un libellé accessible)
function UiIconButton({ icon, label, size = 'md', variant = 'ghost', active, className = '', ...rest }) {
  const Ico = typeof icon === 'string' ? I[icon] : null;
  const dim = { xs: 'w-7 h-7 rounded-md', sm: 'w-8 h-8 rounded-lg', md: 'w-9 h-9 rounded-lg', lg: 'w-11 h-11 rounded-xl' }[size];
  return (
    <button {...rest} aria-label={label} title={rest.title || label}
      className={uiCx('inline-grid place-items-center shrink-0 transition-colors disabled:opacity-40', active ? 'bg-white text-neutral-900' : UI_BTN_VARIANTS[variant], dim, className)}>
      {Ico ? <Ico size={UI_ICON_SIZE[size]} /> : icon}
    </button>
  );
}

// ---------------------------------------------------------------- contrôles
// Interrupteur (visuel seul : le parent porte le clic et l'aria)
function UiSwitch({ on }) {
  return (
    <span className="shrink-0 relative block rounded-full transition-colors" style={{ width: 28, height: 16, background: on ? 'var(--ds-accent, #3b82f6)' : '#404040' }}>
      <span className="absolute top-[2px] w-3 h-3 rounded-full bg-white transition-all" style={{ left: on ? 14 : 2 }}></span>
    </span>
  );
}
// Case à cocher (visuel seul)
function UiCheckbox({ checked, color }) {
  return (
    <span className={uiCx('w-4 h-4 shrink-0 rounded grid place-items-center border transition-colors', checked ? 'border-transparent' : 'border-neutral-600 bg-transparent')}
      style={checked ? { background: color || 'var(--ds-accent, #3b82f6)' } : undefined}>
      {checked && <I.Check size={11} stroke="white" strokeWidth="3" />}
    </span>
  );
}
// Ligne « libellé + interrupteur », cliquable sur toute la largeur
function UiToggleRow({ label, hint, on, onToggle, disabled }) {
  return (
    <button onClick={onToggle} disabled={disabled} role="switch" aria-checked={!!on}
      className="w-full flex items-center justify-between gap-3 rounded-md px-2 py-1.5 text-left text-[12.5px] text-neutral-100 transition-colors hover:bg-white/[0.025] disabled:opacity-40">
      <span className="min-w-0">
        <span className="block">{label}</span>
        {hint && <span className="block text-[11px] text-neutral-500 leading-snug mt-0.5">{hint}</span>}
      </span>
      <UiSwitch on={!!on} />
    </button>
  );
}
// Puce de choix (style, bordure, format…) ; `rec` ajoute le point vert
const uiChipCls = (on) => `rounded-lg px-2.5 h-9 text-[12.5px] font-medium transition-all ${on ? 'bg-white text-neutral-900 shadow-sm' : 'bg-white/[0.05] text-neutral-300 hover:bg-white/[0.1] hover:text-white'}`;
function UiChip({ active, rec, sub, className = '', children, ...rest }) {
  return (
    <button {...rest} className={uiCx(uiChipCls(active), sub ? 'h-auto py-2 flex flex-col items-center leading-tight' : 'inline-flex items-center justify-center gap-1.5', className)}>
      {sub ? (<><span className="inline-flex items-center gap-1.5">{children}{rec && <UiRecDot />}</span><span className="text-[10px] opacity-60 mt-0.5">{sub}</span></>) : (<>{children}{rec && <UiRecDot />}</>)}
    </button>
  );
}
// Onglets segmentés (Poster · Story · Embed)
function UiSegmented({ options, value, onChange, size = 'md', block }) {
  return (
    <div className={uiCx('p-1 rounded-xl bg-white/[0.06] ring-1 ring-white/[0.06]', block ? 'flex' : 'inline-flex')}>
      {options.map((o) => {
        const on = o.id === value, Ico = o.icon && I[o.icon];
        return (
          <button key={o.id} onClick={() => onChange(o.id)} aria-pressed={on}
            className={uiCx('flex items-center justify-center gap-1.5 rounded-lg font-semibold transition-all', size === 'sm' ? 'h-7 px-3 text-[12px]' : 'h-8 px-4 text-[13px]', block && 'flex-1',
              on ? 'bg-white text-neutral-900 shadow' : 'text-neutral-400 hover:text-white')}>
            {Ico && <Ico size={size === 'sm' ? 13 : 15} />} {o.label}
          </button>
        );
      })}
    </div>
  );
}
// Pastille de couleur (rond pour un tracé, carré pour un fond)
function UiSwatch({ color, active, rec, shape = 'round', size = 28, title, onClick }) {
  return (
    <span className="relative inline-block">
      <button title={title} onClick={onClick} aria-pressed={!!active}
        className={uiCx('block transition-transform hover:scale-110', shape === 'round' ? 'rounded-full' : 'rounded-lg', active ? 'ring-2 ring-white ring-offset-2 ring-offset-neutral-950' : 'ring-1 ring-white/15')}
        style={{ width: size, height: size, background: color }} />
      {rec && <UiRecDot floating />}
    </span>
  );
}
// « Recommandé » : un simple point vert, jamais un badge premium
function UiRecDot({ floating, className = '' }) {
  if (floating) return <span className={uiCx('pointer-events-none absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-400 ring-2 ring-neutral-950', className)} />;
  return <span className={uiCx('inline-block shrink-0 w-1.5 h-1.5 rounded-full bg-emerald-400', className)} />;
}
// Curseur avec valeur
function UiSlider({ label, value, min = 0, max = 100, step = 1, unit = '', onChange }) {
  return (
    <div className="flex items-center gap-3">
      {label && <span className="text-[12.5px] font-medium text-neutral-200 w-16 shrink-0">{label}</span>}
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className="flex-1 accent-white" />
      <span className="text-[12px] tabular-nums text-neutral-400 w-10 text-right">{value}{unit && ' ' + unit}</span>
    </div>
  );
}

// ---------------------------------------------------------------- champs
// Champ texte sombre ; `icon` à gauche, `action` (bouton) à droite
const uiInputCls = 'w-full h-10 rounded-lg border border-white/10 bg-white/[0.04] px-3 text-[13px] text-white outline-none placeholder:text-neutral-500 focus:border-white/30 focus:bg-white/[0.06] transition-colors';
const UiInput = React.forwardRef(function UiInput({ icon, action, invalid, className = '', ...rest }, ref) {
  const Ico = typeof icon === 'string' ? I[icon] : null;
  if (!icon && !action) return <input ref={ref} {...rest} className={uiCx(uiInputCls, invalid && 'border-red-400/60', className)} />;
  return (
    <div className={uiCx('flex items-center gap-2 h-10 rounded-lg border bg-white/[0.04] pl-3 transition-colors focus-within:border-white/30 focus-within:bg-white/[0.06]', action ? 'pr-1' : 'pr-3', invalid ? 'border-red-400/60' : 'border-white/10', className)}>
      {Ico ? <span className="text-neutral-500 shrink-0"><Ico size={15} /></span> : icon}
      <input ref={ref} {...rest} className="flex-1 min-w-0 bg-transparent outline-none text-[13px] text-white placeholder:text-neutral-500" />
      {action}
    </div>
  );
});
// Libellé de champ ou de groupe
function UiLabel({ children, aside, className = '' }) {
  return (
    <div className={uiCx('flex items-center justify-between gap-2 mb-2', className)}>
      <span className="text-[12.5px] font-medium text-neutral-200">{children}</span>
      {aside}
    </div>
  );
}
// Texte d'aide ; `rec` le préfixe du point vert
function UiHint({ children, rec, className = '' }) {
  return <p className={uiCx('text-[11px] text-neutral-500 leading-snug', rec && 'flex items-center gap-1.5', className)}>{rec && <UiRecDot />}{children}</p>;
}

// ---------------------------------------------------------------- structure
// Section repliable d'un inspecteur : titre en petites capitales + contenu
function UiSection({ title, aside, children, defaultOpen = true, collapsible = true }) {
  const [open, setOpen] = useUiState(defaultOpen);
  const shown = !collapsible || open;
  return (
    <div className="border-b border-white/[0.06] last:border-b-0">
      <button onClick={() => collapsible && setOpen((v) => !v)} aria-expanded={shown}
        className={uiCx('w-full flex items-center justify-between px-5 py-3.5 text-left group', !collapsible && 'cursor-default')}>
        <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-neutral-400 group-hover:text-neutral-200 transition-colors">{title}</span>
        <span className="flex items-center gap-2">
          {aside}
          {collapsible && <span className="text-neutral-500 transition-transform" style={{ transform: open ? 'none' : 'rotate(-90deg)' }}><I.ChevronDown size={14} /></span>}
        </span>
      </button>
      {shown && <div className="px-5 pb-5 -mt-0.5">{children}</div>}
    </div>
  );
}
// Titre de groupe (petites capitales) sans repli
function UiEyebrow({ children, aside, className = '' }) {
  return (
    <div className={uiCx('flex items-center justify-between gap-2', className)}>
      <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-neutral-400">{children}</span>
      {aside}
    </div>
  );
}
// Carte : surface translucide arrondie ; `interactive` ajoute survol, `active` le contour blanc
function UiCard({ interactive, active, as = 'div', className = '', children, ...rest }) {
  const Tag = as;
  return (
    <Tag {...rest} className={uiCx('rounded-xl transition-all', active ? 'bg-white/[0.08] ring-2 ring-white' : 'bg-white/[0.03] ring-1 ring-white/[0.08]',
      interactive && !active && 'hover:ring-white/25 hover:bg-white/[0.05] cursor-pointer', className)}>
      {children}
    </Tag>
  );
}
// Badge d'état
function UiBadge({ tone = 'neutral', children, className = '' }) {
  const tones = {
    neutral: 'bg-white/[0.08] text-neutral-300', info: 'bg-blue-500/15 text-blue-300', success: 'bg-emerald-400/15 text-emerald-300',
    warning: 'bg-amber-300/15 text-amber-200', danger: 'bg-red-500/15 text-red-300', solid: 'bg-white text-neutral-900',
  };
  return <span className={uiCx('inline-flex items-center gap-1 h-5 px-1.5 rounded-md text-[10.5px] font-semibold tabular-nums whitespace-nowrap', tones[tone], className)}>{children}</span>;
}
// Séparateur
function UiDivider({ vertical, className = '' }) {
  return vertical ? <span className={uiCx('w-px self-stretch bg-white/10', className)} /> : <div className={uiCx('h-px bg-white/[0.07]', className)} />;
}
// Chargement
function UiSpinner({ size = 16, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={uiCx('ds-spin shrink-0', className)} fill="none">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.2" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}
// Chiffre clé : libellé + valeur tabulaire
function UiStat({ label, value, unit, className = '' }) {
  return (
    <div className={uiCx('min-w-0', className)}>
      <div className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-neutral-500">{label}</div>
      <div className="mt-0.5 text-[18px] font-semibold tabular-nums text-white leading-none">{value}{unit && <span className="text-[12px] text-neutral-400 font-medium ml-0.5">{unit}</span>}</div>
    </div>
  );
}

// ---------------------------------------------------------------- parcours
// Étapes numérotées (1 Contenu · 2 Carte · 3 Cadre) ; chaque étape reste cliquable
function UiStepper({ steps, step, onStep, className = '' }) {
  return (
    <div className={uiCx('flex items-center gap-1', className)}>
      {steps.map((name, i) => {
        const n = i + 1, on = n === step, done = n < step;
        return (
          <React.Fragment key={n}>
            {i > 0 && <span className={uiCx('flex-1 h-px', n <= step ? 'bg-white/30' : 'bg-white/10')} />}
            <button onClick={() => onStep && onStep(n)} aria-current={on ? 'step' : undefined}
              className={uiCx('flex items-center gap-1.5 h-8 px-1.5 rounded-lg text-[12px] font-medium transition-colors', on ? 'text-white' : done ? 'text-neutral-300 hover:text-white' : 'text-neutral-500 hover:text-neutral-300')}>
              <span className={uiCx('w-5 h-5 rounded-full grid place-items-center text-[10.5px] font-semibold tabular-nums', on ? 'bg-white text-neutral-900' : done ? 'bg-white/15 text-white' : 'ring-1 ring-white/20')}>
                {done ? <I.Check size={11} /> : n}
              </span>
              {name}
            </button>
          </React.Fragment>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------- import
// Zone de dépôt de fichiers (clic = sélecteur, glisser-déposer)
function UiDropzone({ onFiles, accept, multiple = true, title = 'Glisse tes fichiers ici', action = 'parcours tes fichiers', formats, busy, size = 'md', className = '' }) {
  const ref = useUiRef(null);
  const [over, setOver] = useUiState(false);
  const pad = size === 'lg' ? 'px-6 py-12' : size === 'sm' ? 'px-4 py-5' : 'px-6 py-9';
  return (
    <div className={className}>
      <input ref={ref} type="file" accept={accept} multiple={multiple} className="hidden" onChange={(e) => { onFiles && onFiles(e.target.files); e.target.value = ''; }} />
      <button type="button" onClick={() => ref.current && ref.current.click()}
        onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)}
        onDrop={(e) => { e.preventDefault(); e.stopPropagation(); setOver(false); if (e.dataTransfer.files.length) onFiles && onFiles(e.dataTransfer.files); }}
        className={uiCx('w-full rounded-2xl border-2 border-dashed transition-all text-center', pad,
          over ? 'border-blue-400 bg-blue-500/[0.06] scale-[1.01]' : 'border-white/[0.14] bg-white/[0.02] hover:border-white/30 hover:bg-white/[0.03]')}>
        <span className={uiCx('mx-auto grid place-items-center rounded-xl text-blue-400 bg-blue-500/15', size === 'sm' ? 'w-9 h-9 mb-2' : 'w-12 h-12 mb-3')}>
          {busy ? <UiSpinner size={size === 'sm' ? 16 : 20} /> : <I.Upload size={size === 'sm' ? 17 : 22} />}
        </span>
        <span className={uiCx('block font-semibold text-white', size === 'sm' ? 'text-[13px]' : 'text-[14.5px]')}>{busy ? 'Lecture du fichier…' : title}</span>
        {!busy && <span className="block text-[12px] mt-1 text-neutral-400">ou <span className="text-blue-400 font-medium">{action}</span></span>}
        {formats && !busy && (
          <span className="mt-3.5 inline-flex items-center gap-1.5 text-[10.5px] tabular-nums px-2 py-1 rounded-md bg-white/[0.06] text-neutral-400">
            <I.FileGpx size={11} /> {formats}
          </span>
        )}
      </button>
    </div>
  );
}
// Ligne de source externe (Strava, Komoot, Garmin…)
function UiSourceRow({ logo, label, sub, action, onClick, active }) {
  return (
    <div className={uiCx('flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors', active ? 'bg-white/[0.06] ring-1 ring-white/20' : 'bg-white/[0.03] ring-1 ring-white/[0.07]')}>
      {typeof logo === 'string' ? <img src={logo} alt="" width="30" height="30" draggable="false" className="rounded-md shrink-0" /> : logo}
      <span className="flex-1 min-w-0">
        <span className="block text-[13px] font-medium text-white">{label}</span>
        {sub && <span className="block text-[11px] text-neutral-500 truncate">{sub}</span>}
      </span>
      {action || (onClick && <UiButton size="sm" icon="Link" onClick={onClick}>Connecter</UiButton>)}
    </div>
  );
}
// État vide : icône, titre, texte, actions
function UiEmptyState({ icon = 'Route', title, body, children, className = '' }) {
  const Ico = typeof icon === 'string' ? I[icon] : null;
  return (
    <div className={uiCx('text-center', className)}>
      <div className="mx-auto w-14 h-14 rounded-2xl grid place-items-center bg-white/[0.06] ring-1 ring-white/10 mb-5 text-white">{Ico ? <Ico size={26} /> : icon}</div>
      {title && <h1 className="text-[28px] font-semibold tracking-tight text-white">{title}</h1>}
      {body && <p className="mt-2 text-[14px] text-neutral-400 leading-relaxed max-w-[460px] mx-auto">{body}</p>}
      {children}
    </div>
  );
}

// ---------------------------------------------------------------- superpositions
// Fenêtre modale sombre (Échap et clic sur le voile pour fermer)
function UiModal({ open, onClose, title, sub, width = 440, children, footer }) {
  useUiEffect(() => {
    if (!open) return;
    const k = (e) => { if (e.key === 'Escape') onClose && onClose(); };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[4000] grid place-items-center p-4 bg-black/60 backdrop-blur-sm" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose && onClose(); }}>
      <div role="dialog" aria-modal="true" className="w-full rounded-2xl bg-neutral-900 ring-1 ring-white/10 shadow-2xl animate-menu text-white" style={{ maxWidth: width }}>
        <div className="flex items-start gap-3 px-5 pt-5">
          <div className="flex-1 min-w-0">
            <div className="text-[16px] font-semibold tracking-tight">{title}</div>
            {sub && <div className="text-[12.5px] text-neutral-400 mt-0.5 leading-snug">{sub}</div>}
          </div>
          <UiIconButton icon="X" label="Fermer" size="sm" onClick={onClose} />
        </div>
        <div className="px-5 py-4">{children}</div>
        {footer && <div className="px-5 pb-5 flex items-center justify-end gap-2">{footer}</div>}
      </div>
    </div>
  );
}
// Toast : message éphémère en bas d'écran
function useUiToast(ms = 2600) {
  const [msg, setMsg] = useUiState(null);
  const t = useUiRef(null);
  const show = (m) => { setMsg(m); clearTimeout(t.current); t.current = setTimeout(() => setMsg(null), ms); };
  const node = msg ? (
    <div className="fixed left-1/2 bottom-6 z-[5000] -translate-x-1/2 animate-in">
      <div className="flex items-center gap-2 rounded-xl bg-white text-neutral-900 px-4 h-11 text-[13px] font-medium shadow-2xl"><I.Check size={15} /> {msg}</div>
    </div>
  ) : null;
  return [node, show];
}

Object.assign(window, {
  uiCx, UI_TOKENS, PRINTRACE_LOGO_SVG, UiPrintraceLogo, UiRoutdoorLogo,
  UiButton, UiIconButton, UiSwitch, UiCheckbox, UiToggleRow, UiChip, uiChipCls, UiSegmented, UiSwatch, UiRecDot, UiSlider,
  UiInput, uiInputCls, UiLabel, UiHint, UiSection, UiEyebrow, UiCard, UiBadge, UiDivider, UiSpinner, UiStat,
  UiStepper, UiDropzone, UiSourceRow, UiEmptyState, UiModal, useUiToast,
});
