// Site web de Printrace — hero.
// « Imprimez votre [trek] » : le mot change selon le cas d'usage (trek, marathon,
// road trip, moto trip), l'import GPX / FIT ou le lien Strava mène au studio
// avec le tracé, et un vrai poster d'exemple (même moteur que le studio)
// montre le résultat. Composants : design system (src/ds/ui.jsx).

const { useState: useSiteState, useEffect: useSiteEffect, useRef: useSiteRef, useMemo: useSiteMemo } = React;

// Preuve sociale affichée dans la navigation.
// ⚠ Valeurs d'exemple : à remplacer par les vrais chiffres (avis, posters vendus).
// Durée d'affichage de chaque cas d'usage en lecture automatique
const SITE_ROTATE_MS = 7000;

const SITE_PROOF = { rating: '4,9' };

// ---------------------------------------------------------------- tracés d'exemple
// Tracé d'exemple : points de passage réels, détail naturel ajouté par
// subdivision (déterministe), altitude interpolée.
function siteRng(seed) { let s = seed; return () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; }; }
function siteTrace(way, { seed = 7, rough = 0.22, depth = 6 } = {}) {
  const rnd = siteRng(seed);
  let pts = way.map((w) => [w[0], w[1], w[2] || 0]);
  for (let d = 0; d < depth; d++) {
    const out = [pts[0]];
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1], b = pts[i];
      const dl = b[0] - a[0], dn = b[1] - a[1], len = Math.hypot(dl, dn);
      const k = (rnd() - 0.5) * rough * Math.pow(0.62, d);
      out.push([(a[0] + b[0]) / 2 - dn * k, (a[1] + b[1]) / 2 + dl * k, (a[2] + b[2]) / 2 + (rnd() - 0.5) * 120 * Math.pow(0.6, d) * (len > 0 ? 1 : 0)], b);
    }
    pts = out;
  }
  return pts.map((p) => [+p[0].toFixed(5), +p[1].toFixed(5), Math.max(0, Math.round(p[2]))]);
}

// Tour de Ouessant : vrai tracé GPX (Visorando), simplifié à ~8 m près — [lat, lon, altitude]
const SITE_OUESSANT = [[48.46874,-5.05945,30],[48.46876,-5.05967,30],[48.46831,-5.0594,29],[48.46688,-5.05933,41],[48.46652,-5.0591,42],[48.46626,-5.05703,41],[48.46581,-5.05604,37],[48.4653,-5.05566,36],[48.46486,-5.05503,31],[48.46479,-5.05379,32],[48.46509,-5.05344,30],[48.46501,-5.0532,32],[48.46511,-5.0524,30],[48.46504,-5.05109,33],[48.46372,-5.05023,37],[48.46343,-5.04961,35],[48.46196,-5.04855,31],[48.46181,-5.04804,30],[48.46177,-5.04774,30],[48.46216,-5.04669,30],[48.46254,-5.04584,28],[48.46319,-5.04495,27],[48.46382,-5.04337,23],[48.46325,-5.04197,24],[48.46319,-5.04106,25],[48.46347,-5.03758,28],[48.46333,-5.03631,26],[48.46293,-5.03511,25],[48.4627,-5.03499,24],[48.46104,-5.03551,22],[48.46068,-5.03599,20],[48.46048,-5.03669,20],[48.45954,-5.03748,22],[48.45914,-5.03833,25],[48.45903,-5.0392,26],[48.4591,-5.03982,29],[48.45925,-5.0401,31],[48.45851,-5.04124,26],[48.45819,-5.04292,28],[48.45907,-5.04521,27],[48.45907,-5.046,25],[48.45922,-5.04678,26],[48.45915,-5.04756,26],[48.45979,-5.04845,22],[48.45972,-5.04903,18],[48.45929,-5.05009,18],[48.45939,-5.05092,18],[48.45902,-5.05124,7],[48.4591,-5.05193,9],[48.4595,-5.05299,12],[48.45896,-5.05229,19],[48.45881,-5.05164,18],[48.45853,-5.05128,18],[48.45755,-5.05151,21],[48.45721,-5.05135,20],[48.4571,-5.05198,21],[48.45655,-5.05224,20],[48.45625,-5.05272,21],[48.45623,-5.05326,20],[48.45647,-5.05404,21],[48.45645,-5.05438,22],[48.45551,-5.05481,19],[48.4551,-5.05563,9],[48.45469,-5.05523,17],[48.45403,-5.05544,21],[48.45332,-5.05648,24],[48.4533,-5.05772,23],[48.4527,-5.05912,25],[48.45168,-5.05972,25],[48.45069,-5.05883,19],[48.45033,-5.05938,23],[48.45034,-5.05972,26],[48.44994,-5.06063,26],[48.45004,-5.06117,25],[48.44986,-5.0624,25],[48.45072,-5.06313,19],[48.45116,-5.06403,20],[48.45111,-5.06455,23],[48.45038,-5.06677,25],[48.45142,-5.06715,29],[48.45223,-5.06784,27],[48.45286,-5.06801,23],[48.45321,-5.06869,25],[48.45291,-5.06955,24],[48.45287,-5.07001,24],[48.45198,-5.07094,23],[48.45176,-5.07176,24],[48.45175,-5.0727,23],[48.45118,-5.07352,22],[48.45018,-5.07427,24],[48.44978,-5.076,22],[48.44978,-5.07731,23],[48.44989,-5.0776,23],[48.45095,-5.07857,21],[48.45127,-5.07853,16],[48.45151,-5.07995,21],[48.45127,-5.08133,18],[48.45104,-5.08155,19],[48.4503,-5.08149,20],[48.44913,-5.08233,19],[48.44888,-5.08272,19],[48.44863,-5.08355,18],[48.44783,-5.08408,23],[48.44659,-5.08722,26],[48.44556,-5.08737,30],[48.44485,-5.08799,27],[48.44463,-5.0886,29],[48.44374,-5.08846,25],[48.44347,-5.08849,26],[48.44268,-5.08909,30],[48.44179,-5.08875,32],[48.44136,-5.08905,33],[48.44106,-5.08987,31],[48.44091,-5.09087,31],[48.44091,-5.0929,36],[48.44163,-5.09457,28],[48.44166,-5.09549,29],[48.44015,-5.098,31],[48.43985,-5.09908,31],[48.43985,-5.09992,32],[48.43918,-5.10097,25],[48.4391,-5.10143,28],[48.43851,-5.10198,29],[48.43826,-5.10184,29],[48.43782,-5.10206,26],[48.43728,-5.10274,23],[48.43728,-5.10325,23],[48.4376,-5.10451,24],[48.43757,-5.10505,23],[48.43694,-5.10584,23],[48.43689,-5.1065,26],[48.43704,-5.1088,22],[48.43694,-5.11003,22],[48.43632,-5.11111,20],[48.43631,-5.11154,18],[48.4372,-5.11256,11],[48.4375,-5.11409,8],[48.43786,-5.11495,7],[48.43854,-5.11592,9],[48.43884,-5.11602,10],[48.43886,-5.11512,10],[48.43852,-5.11328,8],[48.43845,-5.11225,8],[48.43884,-5.11017,12],[48.43969,-5.10869,10],[48.44002,-5.10833,10],[48.44033,-5.10831,9],[48.44125,-5.10863,11],[48.44165,-5.10893,12],[48.44206,-5.11017,8],[48.44239,-5.11064,9],[48.44339,-5.10868,12],[48.44361,-5.10802,15],[48.44371,-5.10722,10],[48.44437,-5.10605,12],[48.44466,-5.10487,13],[48.44443,-5.1043,12],[48.44414,-5.10402,15],[48.44406,-5.10347,13],[48.44382,-5.10322,11],[48.44412,-5.10204,13],[48.44499,-5.10169,10],[48.44529,-5.10125,11],[48.44514,-5.10075,11],[48.44472,-5.10028,7],[48.44451,-5.09956,15],[48.44466,-5.09881,16],[48.44532,-5.09784,11],[48.44664,-5.09818,18],[48.44734,-5.09749,13],[48.44804,-5.09583,11],[48.44805,-5.09496,10],[48.44791,-5.09454,11],[48.4496,-5.0924,14],[48.45014,-5.09158,10],[48.4501,-5.09148,10],[48.45093,-5.09237,14],[48.45204,-5.0922,7],[48.45295,-5.09316,16],[48.45293,-5.0937,14],[48.45314,-5.09414,16],[48.45339,-5.09539,13],[48.45434,-5.09497,16],[48.45579,-5.09555,8],[48.45631,-5.09493,6],[48.45643,-5.09497,6],[48.45655,-5.09554,7],[48.45751,-5.09665,21],[48.4572,-5.09709,18],[48.45714,-5.09805,22],[48.45587,-5.10278,14],[48.45553,-5.10557,19],[48.45483,-5.10751,20],[48.45437,-5.11176,21],[48.45418,-5.11229,20],[48.45409,-5.11325,19],[48.45353,-5.11564,26],[48.4534,-5.11668,28],[48.4533,-5.1194,24],[48.45346,-5.12074,19],[48.45295,-5.12272,22],[48.45291,-5.12349,18],[48.45276,-5.12385,19],[48.45249,-5.12374,18],[48.45204,-5.12431,19],[48.4513,-5.12556,18],[48.45057,-5.12828,17],[48.45051,-5.12921,19],[48.45026,-5.13041,21],[48.44987,-5.13136,18],[48.44967,-5.13225,17],[48.44978,-5.13405,18],[48.45038,-5.13672,9],[48.45027,-5.1372,9],[48.44945,-5.13851,13],[48.44928,-5.13945,13],[48.45022,-5.13919,9],[48.4514,-5.13955,10],[48.45163,-5.13916,10],[48.45159,-5.13783,5],[48.45175,-5.13691,6],[48.452,-5.1363,8],[48.45285,-5.13566,12],[48.45342,-5.13584,11],[48.45372,-5.13443,12],[48.45535,-5.1314,21],[48.45697,-5.13136,15],[48.45774,-5.13103,14],[48.45842,-5.12977,17],[48.4589,-5.12992,21],[48.45921,-5.12981,23],[48.45973,-5.12917,23],[48.4601,-5.12691,14],[48.46004,-5.12612,12],[48.45971,-5.12591,13],[48.46052,-5.12538,10],[48.46075,-5.12301,24],[48.46186,-5.12085,10],[48.46184,-5.12059,9],[48.46195,-5.12049,11],[48.46213,-5.11971,19],[48.46241,-5.11939,20],[48.46338,-5.11705,19],[48.46358,-5.11626,19],[48.46367,-5.11471,11],[48.46397,-5.11412,15],[48.46459,-5.1136,15],[48.46466,-5.11081,18],[48.46517,-5.10921,19],[48.46506,-5.10866,17],[48.46453,-5.10769,12],[48.46586,-5.10642,17],[48.46604,-5.10597,14],[48.46635,-5.10569,14],[48.46701,-5.10615,13],[48.46741,-5.10694,13],[48.46797,-5.10765,12],[48.46821,-5.10837,13],[48.46838,-5.10854,13],[48.46932,-5.1074,11],[48.46969,-5.10723,9],[48.46988,-5.10664,9],[48.47049,-5.10611,7],[48.4705,-5.10595,7],[48.47049,-5.10611,7],[48.47075,-5.10613,6],[48.47094,-5.10587,8],[48.47097,-5.10631,9],[48.47147,-5.10672,15],[48.47163,-5.10665,16],[48.47205,-5.10491,17],[48.47226,-5.10284,15],[48.47216,-5.10254,15],[48.47264,-5.10015,12],[48.47276,-5.09905,11],[48.47268,-5.09871,10],[48.47304,-5.09796,11],[48.47312,-5.09738,11],[48.47277,-5.09472,8],[48.47332,-5.09453,11],[48.47356,-5.09421,11],[48.47432,-5.09435,12],[48.47487,-5.09379,13],[48.47562,-5.09215,11],[48.47541,-5.09184,11],[48.47425,-5.09231,14],[48.47395,-5.09223,15],[48.47406,-5.09191,13],[48.47393,-5.09118,15],[48.47357,-5.09077,16],[48.47331,-5.09112,14],[48.47321,-5.09107,13],[48.47301,-5.08986,16],[48.47245,-5.08878,10],[48.47233,-5.088,18],[48.4726,-5.0874,20],[48.4727,-5.08675,21],[48.47265,-5.08562,19],[48.47212,-5.08426,20],[48.47187,-5.08271,23],[48.47176,-5.08193,25],[48.47198,-5.08071,22],[48.47272,-5.07906,24],[48.47386,-5.07586,25],[48.47424,-5.07517,20],[48.4752,-5.07427,23],[48.47629,-5.07369,24],[48.4766,-5.07259,17],[48.4781,-5.07105,29],[48.47846,-5.07001,28],[48.47818,-5.06923,26],[48.47835,-5.06853,28],[48.47951,-5.06903,24],[48.48096,-5.07133,25],[48.48124,-5.0715,25],[48.48126,-5.07012,24],[48.48151,-5.06974,22],[48.48175,-5.0688,24],[48.48181,-5.06811,25],[48.48164,-5.06707,29],[48.48144,-5.06668,28],[48.48113,-5.06645,28],[48.47945,-5.06643,31],[48.47876,-5.06445,34],[48.47774,-5.06289,43],[48.47641,-5.06186,47],[48.47459,-5.05977,53],[48.47467,-5.05962,53],[48.47432,-5.05793,58],[48.47425,-5.05682,61],[48.47407,-5.05693,61],[48.47437,-5.05575,62],[48.47523,-5.0535,59],[48.47572,-5.05265,61],[48.47563,-5.05253,60],[48.47519,-5.05255,59],[48.47495,-5.05284,57],[48.47472,-5.05337,57],[48.47419,-5.05391,58],[48.47366,-5.05502,60],[48.47306,-5.05565,60],[48.47183,-5.05758,51],[48.47158,-5.05821,49],[48.47102,-5.05833,40],[48.47062,-5.05786,35],[48.47048,-5.05812,35],[48.47057,-5.05836,36],[48.46919,-5.05881,31],[48.46875,-5.05947,30]];

// Cas d'usage : mot du titre (et sa couleur), activité du studio, poster d'exemple, photos.
// Photos : vraies photos du trip dans assets/site/<cas>-1.webp et -2.webp, à renseigner dans photos[].src (portrait,
// ~800 × 1000 px) ; tant qu'elles manquent, une illustration prend leur place.
const SITE_CASES = [
  {
    id: 'roadtrip', heroBg: 0, accent: '#facc15', word: 'road trip', label: 'Road trip', example: 'Route 66, Pacific Coast Highway, Islande…', icon: 'Route', activity: 'roadtrip',
    pitch: 'Toutes les étapes de votre road trip, réunies sur un seul poster.',
    poster: {
      // Route 66, de Chicago à Santa Monica, avec le détour par le Grand Canyon
      // (Flagstaff → Grand Canyon Village → Williams) ; chiffres arrondis du parcours
      tpl: 'blueprint', color: '#facc15', bg: '#141414', mapStyle: 'epure', mapOpacity: 55, title: 'Route 66 🇺🇸', subtitle: 'Chicago → Santa Monica · Grand Canyon',
      metrics: ['distance', 'stages', 'duration'], values: { distance: '4 100 km', stages: '14', duration: '60 h' }, photos: 3,
      route: { name: 'Route 66', seed: 3, rough: 0.1, depth: 5, way: [
        [41.8781, -87.6298, 180], [39.7817, -89.6501, 180], [38.6270, -90.1994, 140], [37.2090, -93.2923, 400], [37.0842, -94.5133, 300],
        [36.1540, -95.9928, 220], [35.4676, -97.5164, 370], [35.2220, -101.8313, 1100], [35.1717, -103.7250, 1250], [34.9387, -104.6825, 1400],
        [35.0844, -106.6504, 1520], [35.5281, -108.7426, 1980], [34.9022, -110.1582, 1550], [35.1983, -111.6513, 2100], [36.0544, -112.1401, 2100],
        [35.2495, -112.1910, 2060], [35.3256, -112.8774, 1600], [35.1894, -114.0530, 1020], [34.8480, -114.6141, 150], [34.8958, -117.0173, 690],
        [34.1083, -117.2898, 330], [34.0101, -118.4965, 30]] },
    },
    unsplash: ['route 66 desert road', 'grand canyon horseshoe bend', 'canyon road trip'],
    photos: [
      { src: ptRes('siteRoad1', 'assets/site/roadtrip-1.webp'), caption: 'Arches' },
      { src: ptRes('siteRoad2', 'assets/site/roadtrip-2.webp'), caption: 'Horseshoe Bend' },
      { src: ptRes('siteRoad3', 'assets/site/roadtrip-3.webp'), caption: 'Utah' },
    ],
  },
  {
    id: 'marathon', heroBg: 0, accent: '#fb7a3c', word: 'marathon', label: 'Marathon & course', example: 'Paris, Berlin, New York, votre premier semi…', icon: 'Run', activity: 'running',
    pitch: 'Votre course mythique et votre temps, en poster prêt à encadrer.',
    poster: {
      tpl: 'nuit', border: 'marge', marginColor: '#222222', typeScale: 0.68, labels: false, color: '#fc5200', mapStyle: 'routes', mapOpacity: 100, title: 'Marathon de Paris', subtitle: '42,195 km · 6 avril 2026',
      metrics: ['distance', 'duration', 'pace'], values: { distance: '42,2 km', duration: '3 h 42', pace: "5'15\"/km" },
      route: { name: 'Marathon de Paris', seed: 5, rough: 0.12, depth: 5, way: [[48.8738, 2.2950], [48.8656, 2.3212], [48.8606, 2.3376], [48.8566, 2.3522], [48.8530, 2.3690], [48.8443, 2.3920], [48.8390, 2.4100], [48.8335, 2.4330], [48.8290, 2.4440], [48.8225, 2.4320], [48.8300, 2.4050], [48.8410, 2.3790], [48.8505, 2.3570], [48.8580, 2.3360], [48.8610, 2.3150], [48.8580, 2.2945], [48.8510, 2.2780], [48.8460, 2.2560], [48.8575, 2.2470], [48.8680, 2.2550], [48.8715, 2.2760]] },
    },
    unsplash: ['marathon runners city', 'marathon finish line'],
    // Photo de fond seulement (le poster du marathon n'affiche pas de photos)
    photos: [{ src: ptRes('siteMarathon1', 'assets/site/marathon-1.webp'), caption: 'Coureurs' }, { src: null, caption: 'Km 30, le mur' }],
  },
  {
    id: 'trek', heroBg: 1, accent: '#60a5fa', word: 'trek', label: 'Trek & randonnée', example: 'GR34, GR20, Tour du Mont-Blanc…', icon: 'Footprints', activity: 'hiking',
    pitch: 'Votre trek de plusieurs jours, en poster prêt à encadrer.',
    poster: {
      // GR34 dans le Finistère (Locquirec → Le Pouldu) : vrai tracé (src/site/gr34-trace.jsx).
      // Distance et dénivelé calculés sur le GPX ; durée de marche estimée (méthode DIN 33466)
      tpl: 'blueprint', color: 'auto', bg: '#0f1d33', mapStyle: 'epure', mapOpacity: 40, title: 'GR34 ⚪️🔴', subtitle: 'Locquirec → Le Pouldu · Finistère',
      metrics: ['distance', 'ascent', 'duration', 'start'], values: { distance: '925 km', ascent: '11 400 m', duration: '260 h' }, photos: 2,
      route: { name: 'GR34', depth: 0, way: SITE_GR34 },
    },
    unsplash: ['brittany coast hiking', 'finistere coastal path'],
    photos: [{ src: ptRes('siteTrek1', 'assets/site/trek-1.webp'), caption: 'Balisage' }, { src: ptRes('siteTrek2', 'assets/site/trek-2.webp'), caption: 'En chemin' }],
  },
  {
    id: 'moto', heroBg: 0, accent: '#f87171', word: 'moto trip', label: 'Moto trip', example: 'Route des Grandes Alpes, cols pyrénéens…', icon: 'Moto', activity: 'moto',
    pitch: 'Chaque col et chaque virage de votre virée, au mur.',
    poster: {
      tpl: 'nuit', color: '#ffffff', mapStyle: 'routes', mapOpacity: 100, title: 'Route des Grandes Alpes', subtitle: 'Thonon → Menton · 16 cols',
      metrics: ['distance', 'altMax', 'duration'], values: { distance: '720 km', altMax: '2 802 m', duration: '14 h' },
      route: { name: 'Route des Grandes Alpes', seed: 9, rough: 0.2, way: [[46.37, 6.48, 380], [46.20, 6.55, 900], [45.99, 6.47, 1613], [45.87, 6.47, 1486], [45.69, 6.69, 1967], [45.55, 6.88, 800], [45.42, 7.03, 2764], [45.24, 6.68, 1100], [45.06, 6.41, 2642], [44.89, 6.64, 1300], [44.82, 6.73, 2360], [44.62, 6.75, 1100], [44.39, 6.65, 1132], [44.32, 6.81, 2802], [44.10, 7.10, 900], [43.90, 7.35, 500], [43.77, 7.50, 10]] },
    },
    unsplash: ['motorcycle mountain pass', 'alps hairpin road'],
    photos: [{ src: ptRes('siteMoto1', 'assets/site/moto-1.webp'), caption: 'Point de vue' }, { src: null, caption: 'Lacets du Galibier' }],
  },
  {
    id: 'gpx', heroBg: 0, accent: '#2dd4bf', word: 'GPX', label: 'N’importe quel tracé', example: 'Un tour d’île, une sortie vélo, une balade…', icon: 'Route', activity: 'hiking',
    pitch: 'N’importe quel fichier GPX devient un poster prêt à encadrer.',
    poster: {
      // Modèle « Photo » : la photo du phare de la Jument (Ouessant) sert de fond à la carte, voile renforcé (écume claire)
      tpl: 'photo', bgPhoto: true, photoShade: 1, color: '#ffffff', mapStyle: 'epure', mapOpacity: 60, title: 'Ouessant', subtitle: 'Le tour de l’île · Finistère',
      photos: 1, metrics: ['distance', 'ascent', 'duration'], values: { distance: '31,5 km', ascent: '385 m', duration: '10 h 40' },
      // Vrai tracé (GPX Visorando du tour de l'île), simplifié : pas de tracé généré
      route: { name: 'Tour de Ouessant', depth: 0, way: SITE_OUESSANT },
    },
    unsplash: ['ouessant lighthouse', 'brittany island coast'],
    photos: [{ src: ptRes('siteGpx1', 'assets/site/gpx-1.webp'), caption: 'Phare de la Jument' }],
  },
];

// Données de rendu du poster d'exemple (même forme que dataFor du studio)
// Tracés du poster d'exemple : une partie par étape quand le cas en a (GR20), sinon un seul tracé dessiné
function siteRoutesOf(c) {
  const base = { color: '#ffffff', durationReal: false, activity: c.activity, date: '' };
  if (c.poster.stages) {
    return c.poster.stages.map(([from, to, way], i) => ({
      ...base, id: 'demo_' + c.id + '_' + i, name: from + ' → ' + to, coords: siteTrace(way, { ...c.poster.route, seed: c.poster.route.seed + i }),
      distance: 0, ascent: 0, descent: 0, durationMin: 0, altMax: null,
    }));
  }
  const r = c.poster.route;
  return [{ ...base, id: 'demo_' + c.id, name: r.name, coords: siteTrace(r.way, r), distance: 0, ascent: 0, descent: 0, durationMin: 0, altMax: null }];
}
// Styles proposés à l'étape 2 : celui du cas d'usage, puis Plan, Nuit, Éditorial (3 au total)
function siteStyles(c) {
  return [...new Set([c.poster.tpl, 'blueprint', 'nuit', 'relief'])].slice(0, 3)
    .map((id) => POSTER_TEMPLATES.find((t) => t.id === id)).filter(Boolean);
}
// Réglages du poster pour le style choisi : ceux du cas d'usage, ou les réglages recommandés du modèle
function sitePosterOf(c, tplId) {
  const p = c.poster;
  if (!tplId || tplId === p.tpl) return p;
  const t = POSTER_TEMPLATES.find((x) => x.id === tplId), r = (t && t.rec) || {};
  return { ...p, tpl: tplId, color: (r.colors || ['#ffffff'])[0], mapStyle: r.mapStyle || p.mapStyle, mapOpacity: r.mapOpacity != null ? r.mapOpacity : p.mapOpacity,
    bg: r.bg || null, border: 'none', marginColor: null, typeScale: null, photoShade: null, bgPhoto: false, photos: p.photos || (p.bgPhoto ? 1 : 0) };
}
// Infos affichées : interrupteurs « infos », « nombre d'étapes », « durée »
function siteMetrics(p, o = {}) {
  if (o.info === false) return [];
  let keys = p.metrics.slice();
  const toggle = (k, on, at) => { const has = keys.includes(k); if (on === false && has) keys = keys.filter((x) => x !== k); if (on === true && !has) keys.splice(Math.min(at, keys.length), 0, k); };
  toggle('stages', o.stages, 3); toggle('duration', o.duration, 2);
  return keys;
}
// Tracés importés par le visiteur -> tracés du poster (affichés à la place de l'exemple)
const siteItemLabel = (x) => (x.st.to ? x.st.from + ' → ' + x.st.to : x.st.from) || x.name.replace(/\.[^.]+$/, '');
function siteUserRoutes(items, c) {
  return items.map((x) => ({
    id: 'user_' + x.id, name: siteItemLabel(x), color: '#ffffff', activity: c.activity, date: x.st.gpxDate ? x.st.gpxDate.slice(0, 10) : '',
    coords: x.st.coords, distance: x.st.distanceKm || 0, ascent: x.st.elevationGain || 0, descent: x.st.elevationLoss || 0,
    durationMin: x.st.gpxMovingMin || 0, durationReal: !!x.st.gpxMovingMin, altMax: x.st.altMax || null,
  }));
}
// Titre et sous-titre par défaut : ceux de l'exemple, ou tirés des tracés importés
function siteDefaultTitle(c, items) {
  if (!items || !items.length) return c.poster.title;
  return items.length > 1 ? 'Mon ' + c.word : siteItemLabel(items[0]);
}
function siteUserSubtitle(items) {
  const a = items[0].st, b = items[items.length - 1].st;
  if (items.length > 1 && a.from && b.to) return a.from + ' → ' + b.to;
  return a.gpxDate ? ptDate(a.gpxDate) : '';
}
// o : personnalisation (nom du trip, couleur du tracé, photos) ; o.items : tracés du visiteur
function sitePosterData(c, routes, photos = [], o = {}) {
  const p = sitePosterOf(c, o.tpl), act = poActivity(c.activity);
  const user = !!(o.items && o.items.length);
  if ((o.photos === false || user) && !p.bgPhoto) photos = [];
  const agg = poAggregate(routes, act);
  const stats = poStats(agg, siteMetrics(p, o), { activity: act.label, start: routes[0].coords[0] })
    .map((st) => (!user && p.values[st.key] ? { ...st, value: p.values[st.key], unit: '' } : st));
  return {
    routes, agg, color: o.color || p.color, coords: true, activityLabel: act.label, title: (o.title || '').trim() || siteDefaultTitle(c, o.items), subtitle: user ? siteUserSubtitle(o.items) || act.label : p.subtitle, stats,
    photoSlot: false, photos: p.bgPhoto ? photos.slice(1) : photos, bgPhoto: p.bgPhoto && photos[0] ? photos[0].img : null, showMap: true, mapStyle: p.mapStyle, mapOpacity: p.mapOpacity / 100, mapLabels: (o.labels != null ? o.labels : p.labels) !== false,
    bg: (p.tpl === 'blueprint' && o.bg) || p.bg || null, preview: false, typeScale: p.typeScale, marginColor: p.marginColor, photoShade: p.photoShade,
  };
}

// Photos des cas d'usage, par ordre de priorité :
//  1. vraies photos du trip dans assets/site/<cas>-N.webp
//  2. photos Unsplash (clé d'accès gratuite : PRINTRACE_CONFIG.unsplashKey),
//     chargées par le navigateur et créditées comme le demande Unsplash
//  3. illustration dessinée
const siteImgCache = {};
function siteLoadImg(src) {
  if (!src) return Promise.resolve(null);
  if (!siteImgCache[src]) siteImgCache[src] = new Promise((res) => {
    const im = new Image();
    if (/^https?:/.test(src)) im.crossOrigin = 'anonymous'; // Unsplash autorise le dessin sur canvas
    im.onload = () => res(im); im.onerror = () => res(null); im.src = src;
  });
  return siteImgCache[src];
}
const SITE_UTM = '?utm_source=printrace&utm_medium=referral';
async function siteUnsplash(query) {
  const key = (window.PRINTRACE_CONFIG || {}).unsplashKey;
  if (!key || !query) return null;
  const ck = 'pt_unsplash_' + query;
  try { const hit = sessionStorage.getItem(ck); if (hit) return JSON.parse(hit); } catch (e) {}
  try {
    const r = await fetch(`https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&orientation=portrait&per_page=1&content_filter=high&client_id=${key}`);
    if (!r.ok) return null;
    const p = ((await r.json()).results || [])[0];
    if (!p) return null;
    const out = { src: p.urls.raw + '&w=720&h=900&fit=crop&q=80', credit: p.user.name, link: p.user.links.html + SITE_UTM };
    try { sessionStorage.setItem(ck, JSON.stringify(out)); } catch (e) {}
    return out;
  } catch (e) { return null; }
}
// Photo à afficher pour un cas d'usage : { src, credit?, link? } ou null (illustration)
async function siteResolvePhoto(c, i) {
  const local = (c.photos[i] || {}).src;
  if (local && (await siteLoadImg(local))) return { src: local };
  const u = await siteUnsplash((c.unsplash || [])[i]);
  if (u && (await siteLoadImg(u.src))) return u;
  return null;
}
function siteSceneImg(kind, alt) {
  const host = document.createElement('div');
  const root = ReactDOM.createRoot(host);
  ReactDOM.flushSync(() => root.render(<SiteScene kind={kind} alt={alt} />));
  const svg = host.innerHTML.replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" width="600" height="720" ');
  root.unmount();
  return siteLoadImg('data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg));
}
async function sitePosterPhotos(c, resolved = []) {
  const out = [];
  for (let i = 0; i < (c.poster.photos || 0); i++) {
    const r = resolved[i];
    const img = (r && (await siteLoadImg(r.src))) || (await siteSceneImg(c.id, i === 1));
    if (img) out.push({ img, url: img.src });
  }
  return out;
}

// ---------------------------------------------------------------- visuels
// Avatars illustrés (pas de vraies personnes) pour la preuve sociale
function SiteAvatar({ i }) {
  const tones = [['#f5d0b5', '#3b2a20', '#2563eb'], ['#e8b893', '#141414', '#059669'], ['#c68a62', '#2b1d14', '#f59e0b'], ['#f1c9a5', '#8a5a2b', '#db2777'], ['#a8714d', '#111111', '#7c3aed']][i % 5];
  const hair = [
    'M6 13c0-6 4-9 10-9s10 3 10 9c-2-3-5-4-10-4s-8 1-10 4z',
    'M6 14c0-7 5-10 10-10 6 0 10 4 10 10-1-2-3-4-5-4-3 2-9 2-15 4z',
    'M7 12c1-5 4-8 9-8s8 3 9 8c-3-2-6-3-9-3s-6 1-9 3z',
    'M5 16c0-8 5-12 11-12s11 4 11 12c0 3-1 6-2 8-1-5-3-10-9-10s-8 5-9 10c-1-2-2-5-2-8z',
    'M8 10c2-4 5-6 8-6 4 0 7 2 8 6-3-1-5-1-8-1s-5 0-8 1z',
  ][i % 5];
  return (
    <svg viewBox="0 0 32 32" className="w-8 h-8 rounded-full ring-2 ring-[#0a0a0a] bg-neutral-800 shrink-0" aria-hidden="true">
      <rect width="32" height="32" fill={tones[2]} opacity="0.35" />
      <path d="M4 32c1-7 6-10 12-10s11 3 12 10z" fill={tones[2]} />
      <circle cx="16" cy="15" r="7.5" fill={tones[0]} />
      <path d={hair} fill={tones[1]} />
    </svg>
  );
}
// Note discrète façon avis en ligne : avatars, « 4,9 ★ (2 400+ avis) »
function SiteProof() {
  return (
    <div className="inline-flex items-center gap-2.5 h-10 rounded-full bg-white/[0.04] ring-1 ring-white/[0.09] pl-1.5 pr-3.5"
      aria-label={`Noté ${SITE_PROOF.rating} sur 5 par nos clients`}>
      <div className="flex -space-x-2 [&_svg]:w-7 [&_svg]:h-7 [&_svg]:ring-[#141414]">{[0, 1, 2].map((i) => <SiteAvatar key={i} i={i} />)}</div>
      <div className="flex items-center gap-1.5 text-[13.5px] leading-none">
        <svg viewBox="0 0 20 20" className="w-[15px] h-[15px] text-amber-400 -mt-px" fill="currentColor" aria-hidden="true"><path d="M10 1.6l2.6 5.3 5.8.8-4.2 4.1 1 5.8L10 14.9l-5.2 2.7 1-5.8L1.6 7.7l5.8-.8z" /></svg>
        <span className="font-semibold text-white">{SITE_PROOF.rating}</span>
      </div>
    </div>
  );
}

// Connexion (en-tête, tout à droite) : entrée du produit ; « Mon espace » une fois connecté
function SiteAccountButton() {
  const [user, setUser] = useSiteState(null);
  useSiteEffect(() => { setUser(ptAuthUser()); }, []);
  if (user) {
    return (
      <a href={siteStudioUrl()} className="inline-flex items-center gap-2 h-10 rounded-full bg-white/[0.06] ring-1 ring-white/10 pl-1.5 pr-3.5 text-[13.5px] font-medium text-white hover:bg-white/[0.1] transition-colors">
        <PtAvatar user={user} size={28} />
        <Tx k="nav.espace" d="Mon espace" />
      </a>
    );
  }
  return (
    <a href={ptLoginUrl()} className="inline-flex items-center h-10 rounded-full bg-white px-4 whitespace-nowrap text-[13.5px] font-semibold text-neutral-900 hover:bg-neutral-200 transition-colors"><Tx k="nav.connexion" d="Se connecter" /></a>
  );
}

// Photo d'ambiance illustrée (remplaçable par une vraie photo : photos[].src)
function SiteScene({ kind, alt }) {
  const id = kind + (alt ? '2' : '');
  const S = {
    trek: alt
      ? { sky: ['#fbd6a5', '#f59e7a'], sun: '#fff4dc', far: '#b77a87', mid: '#7f4f6b', near: '#3a2a43', accent: '#9fd3e6' }
      : { sky: ['#9cc9e8', '#e8f1f6'], sun: '#fffbe9', far: '#8aa7bf', mid: '#4f6f86', near: '#26394a', accent: '#ffffff' },
    marathon: alt
      ? { sky: ['#1b2440', '#43375f'], sun: '#ffe9b0', far: '#2f3557', mid: '#1f2440', near: '#121628', accent: '#fc5200' }
      : { sky: ['#ffd9a8', '#f6a07a'], sun: '#fff1d6', far: '#c98d7e', mid: '#8a5b5c', near: '#3d2b33', accent: '#fc5200' },
    roadtrip: alt
      ? { sky: ['#f7c48a', '#e67b5c'], sun: '#fff0cf', far: '#c46b4f', mid: '#8c4434', near: '#3b2220', accent: '#facc15' }
      : { sky: ['#ffcf9e', '#ff8f70'], sun: '#fff3d9', far: '#5d87a8', mid: '#2f5d7c', near: '#1d3245', accent: '#facc15' },
    gpx: alt
      ? { sky: ['#f6c38f', '#e98a6a'], sun: '#fff1d6', far: '#5b6f86', mid: '#34465a', near: '#1b2531', accent: '#e11d2e' }
      : { sky: ['#8fb8d8', '#dfeaf1'], sun: '#fffbe9', far: '#5f8aa8', mid: '#3d6680', near: '#24323d', accent: '#e11d2e' },
    moto: alt
      ? { sky: ['#a7c6df', '#e9eef2'], sun: '#ffffff', far: '#9db0c0', mid: '#5f7383', near: '#2c3a45', accent: '#ffffff' }
      : { sky: ['#f9b98c', '#fbe2c0'], sun: '#fff6e5', far: '#b08a8f', mid: '#6d5463', near: '#2e2633', accent: '#ffffff' },
  }[kind];
  return (
    <svg viewBox="0 0 300 360" className="block w-full h-full" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <defs>
        <linearGradient id={'sky' + id} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={S.sky[0]} /><stop offset="1" stopColor={S.sky[1]} /></linearGradient>
      </defs>
      <rect width="300" height="360" fill={`url(#sky${id})`} />
      <circle cx={alt ? 210 : 90} cy={alt ? 120 : 92} r={alt ? 36 : 26} fill={S.sun} opacity="0.95" />
      {kind === 'trek' && (<>
        <path d="M0 230 L60 150 L110 205 L170 110 L230 190 L300 140 L300 360 L0 360z" fill={S.far} />
        <path d="M170 110 L185 128 L172 126 L160 136z" fill="#fff" opacity="0.85" />
        <path d="M0 270 L70 210 L130 250 L200 190 L300 250 L300 360 L0 360z" fill={S.mid} />
        {alt && <rect x="0" y="282" width="300" height="34" fill={S.accent} opacity="0.55" />}
        <path d="M0 315 L80 280 L160 305 L240 270 L300 290 L300 360 L0 360z" fill={S.near} />
        <path d="M60 360 C90 330 70 318 110 300 C140 287 128 268 165 252 C190 241 186 225 205 214" stroke="#fff" strokeWidth="2.4" strokeDasharray="1 7" strokeLinecap="round" fill="none" opacity="0.9" />
        <g transform="translate(150 262)" fill={S.near}><circle cx="0" cy="-17" r="3.4" /><path d="M-3 -13 h6 l1 10 h-2 l-1 9 h-2 l-1-9 h-2z" /><path d="M3 -12 l4 3 -1 9" stroke={S.near} strokeWidth="1.5" fill="none" /></g>
      </>)}
      {kind === 'marathon' && (<>
        <path d="M0 220 h30 v-30 h20 v20 h25 v-45 h18 v55 h30 v-25 h22 v35 h40 v-60 h20 v60 h35 v-20 h30 v-15 h30 v215 h-300z" fill={S.far} />
        <path d="M205 230 L218 120 L222 85 L226 120 L239 230 M211 190 h22 M214 160 h16" stroke={S.mid} strokeWidth="4" fill="none" />
        <path d="M0 250 h300 v110 h-300z" fill={S.mid} />
        <path d="M120 250 L180 250 L300 360 L0 360z" fill={S.near} />
        <path d="M150 256 v12 M150 280 v16 M150 308 v20 M150 340 v20" stroke="#fff" strokeWidth="3" opacity="0.7" />
        <path d="M70 360 V200 M230 360 V200" stroke={S.near} strokeWidth="7" />
        <rect x="64" y="196" width="172" height="26" rx="3" fill={S.accent} />
        <text x="150" y="214" textAnchor="middle" fontFamily="Inter, sans-serif" fontWeight="800" fontSize="14" fill="#fff" letterSpacing="3">FINISH</text>
      </>)}
      {kind === 'roadtrip' && (<>
        {alt ? (<>
          <path d="M0 230 h40 v-40 h50 v40 h60 l20 -30 h40 l15 30 h75 v130 h-300z" fill={S.far} />
          <path d="M0 250 h300 v110 h-300z" fill={S.mid} />
          <path d="M135 250 L165 250 L280 360 L20 360z" fill={S.near} />
          <path d="M150 258 v10 M150 282 v16 M150 312 v22" stroke={S.accent} strokeWidth="3" />
        </>) : (<>
          <path d="M0 210 h300 v150 h-300z" fill={S.far} />
          <path d="M0 200 L60 170 L120 190 L170 150 L300 200 L300 360 L150 360 C130 320 90 290 0 270z" fill={S.mid} />
          <path d="M300 230 C230 240 200 262 170 290 C150 310 140 330 136 360" stroke="#e8e2d9" strokeWidth="10" fill="none" />
          <path d="M300 230 C230 240 200 262 170 290 C150 310 140 330 136 360" stroke={S.accent} strokeWidth="1.6" strokeDasharray="6 7" fill="none" />
          <path d="M150 360 C170 330 200 300 300 280 L300 360z" fill={S.near} />
          <path d="M0 260 h40 M10 275 h60 M0 292 h30" stroke="#fff" strokeOpacity="0.35" strokeWidth="2" />
        </>)}
      </>)}
      {kind === 'gpx' && (<>
        {/* Ouessant : mer, côte rocheuse et phare du Créac'h (rayé noir et blanc) */}
        <path d="M0 236 h300 v124 h-300z" fill={S.far} />
        <path d="M0 252 h300 M0 270 h300 M0 292 h300" stroke="#fff" strokeOpacity="0.18" strokeWidth="1.5" strokeDasharray="14 10" />
        <path d="M120 236 L150 214 L196 206 L240 216 L300 212 L300 360 L90 360 C110 320 96 280 120 236z" fill={S.mid} />
        <path d="M150 360 C170 320 200 296 300 286 L300 360z" fill={S.near} />
        <g transform="translate(214 120)">
          <path d="M-9 0 h18 l6 92 h-30z" fill="#f4f4f4" />
          {[14, 40, 66].map((y) => <path key={y} d={`M${-9 - y * 0.065} ${y} h${18 + y * 0.13} l${1.6} 13 h${-21.2 - y * 0.13}z`} fill="#1c1c1c" />)}
          <rect x="-11" y="-14" width="22" height="14" rx="2" fill="#1c1c1c" />
          <rect x="-7" y="-11" width="14" height="8" fill={S.sun} />
          <path d="M-11 -14 L0 -24 L11 -14z" fill={S.accent} />
        </g>
        <path d="M30 360 C60 320 100 330 120 300 C140 270 170 262 214 212" stroke="#fff" strokeWidth="2.4" strokeDasharray="1 7" strokeLinecap="round" fill="none" opacity="0.9" />
      </>)}
      {kind === 'moto' && (<>
        <path d="M0 210 L80 120 L140 170 L210 90 L300 170 L300 360 L0 360z" fill={S.far} />
        <path d="M210 90 L228 110 L214 108 L200 118z" fill="#fff" opacity="0.9" />
        <path d="M0 260 L90 190 L170 240 L300 200 L300 360 L0 360z" fill={S.mid} />
        <path d="M40 360 C40 330 250 335 250 312 C250 290 60 300 60 278 C60 258 230 268 230 248 C230 232 110 236 110 222" stroke="#e5e7eb" strokeWidth="7" fill="none" strokeLinecap="round" />
        <path d="M40 360 C40 330 250 335 250 312 C250 290 60 300 60 278 C60 258 230 268 230 248 C230 232 110 236 110 222" stroke={S.near} strokeWidth="1" strokeDasharray="4 6" fill="none" />
        {alt && <ellipse cx="80" cy="330" rx="60" ry="10" fill="#9fd3e6" opacity="0.5" />}
        <g transform="translate(170 318)" fill={S.near}><circle cx="-9" cy="6" r="5" /><circle cx="11" cy="6" r="5" /><path d="M-9 6 L0 -4 h9 l4 6 h-6z" /><circle cx="2" cy="-10" r="3.2" /></g>
      </>)}
    </svg>
  );
}
// Photo posée en décor (cadre type tirage photo, légèrement tournée)
function SitePhoto({ c, i, photo, className = '', rotate = 0, style }) {
  const ph = { ...(c.photos[i] || {}), src: '', ...(photo || {}) };
  const [broken, setBroken] = useSiteState(false);
  useSiteEffect(() => setBroken(false), [ph.src]); // nouvelle photo à chaque cas d'usage
  // Photo seule, contour fin et discret (pas de légende) ; crédit Unsplash si besoin
  return (
    <figure className={`absolute pointer-events-none select-none rounded-[14px] p-[5px] bg-white/[0.07] ring-1 ring-white/[0.08] backdrop-blur-sm shadow-[0_30px_60px_-20px_rgba(0,0,0,0.85)] ${className}`} style={{ ...style, transform: `rotate(${rotate}deg)` }}>
      <div key={c.id} className="relative w-full h-full rounded-[10px] overflow-hidden ds-fade-up bg-neutral-800">
        {ph.src && !broken ? <img src={ph.src} loading="lazy" decoding="async" alt={ph.caption || ''} className="w-full h-full object-cover" onError={() => setBroken(true)} /> : <SiteScene kind={c.id} alt={i === 1} />}
        {ph.credit && (
          <figcaption className="pointer-events-auto absolute inset-x-0 bottom-0 px-2 pb-1.5 pt-5 text-[9px] text-white/80 bg-gradient-to-t from-black/60 to-transparent" style={{ fontFamily: 'var(--ds-font-site)' }}>
            Photo <a href={ph.link} target="_blank" rel="noopener" className="underline">{ph.credit}</a> · <a href={'https://unsplash.com/' + SITE_UTM} target="_blank" rel="noopener" className="underline">Unsplash</a>
          </figcaption>
        )}
      </div>
    </figure>
  );
}

// Poster d'exemple rendu par le moteur du studio, dans un cadre noir
// finish : { border: 'none' | 'fine' (liseré) | 'marge', frame: bool } — choisi à l'étape 3
function SitePoster({ c, photos, custom = {}, items = [], finish = {}, compact, children }) {
  const t = useTx();
  const ref = useSiteRef(null);
  const drawn = useSiteRef(null); // cas d'usage déjà dessiné sur le canvas
  const [ready, setReady] = useSiteState(false);
  const user = items.length > 0;
  const routes = useSiteMemo(() => (user ? siteUserRoutes(items, c) : siteRoutesOf(c)), [c.id, items]);
  const fmt = POSTER_FORMATS[1]; // A3
  const border = finish.border || sitePosterOf(c, custom.tpl).border || 'none';
  const frame = siteFrameOf(finish), framed = frame.id !== 'none';
  useSiteEffect(() => {
    let live = true;
    const same = drawn.current === c.id; // simple retouche : on garde l'image affichée, sans spinner
    if (!same) setReady(false);
    if (!photos) return; // photos du cas d'usage encore en cours de résolution
    (async () => {
      if (same) await new Promise((r) => setTimeout(r, 140)); // saisie du nom : un rendu quand on s'arrête de taper
      await storyFontsReady({ vintage: false }); // modèles du site : pas d'italique « ancienne carte »
      const cv = ref.current; if (!cv || !live) return;
      const tpl = POSTER_TEMPLATES.find((t) => t.id === sitePosterOf(c, custom.tpl).tpl) || POSTER_TEMPLATES[0];
      const w = 900, h = Math.round(w * fmt.mm[1] / fmt.mm[0]);
      const ph = await sitePosterPhotos(c, photos);
      if (!live) return;
      // Rendu hors écran puis copie : pas de clignotement pendant les retouches
      const off = document.createElement('canvas'); off.width = w; off.height = h;
      await renderPoster(off, tpl, sitePosterData(c, routes, ph, { ...custom, items }), fmt, border, w / PO_W);
      if (!live) return;
      cv.width = w; cv.height = h; cv.getContext('2d').drawImage(off, 0, 0);
      drawn.current = c.id;
      setReady(true);
    })();
    return () => { live = false; };
  }, [c.id, routes, border, photos && photos.map((p) => (p ? p.src : '')).join('|'), custom.photos, custom.title, custom.color, custom.tpl, custom.info, custom.stages, custom.duration, custom.labels, custom.bg]);
  // Nom du modèle affiché sous le poster (Plan, Nuit, Éditorial…)
  const tplName = (POSTER_TEMPLATES.find((x) => x.id === sitePosterOf(c, custom.tpl).tpl) || {}).name || '';
  return (
    <div className="relative mx-auto w-full">
      {/* Éclairage : halo doux et large derrière le poster (plusieurs paliers pour un fondu sans marches) */}
      <div className="pointer-events-none absolute -inset-x-[90%] -top-[45%] -bottom-[40%] -z-10" style={{ background: 'radial-gradient(closest-side, rgba(255,255,255,0.2) 0%, rgba(255,255,255,0.15) 20%, rgba(255,255,255,0.095) 40%, rgba(255,255,255,0.045) 62%, rgba(255,255,255,0.015) 82%, rgba(255,255,255,0) 100%)' }} />
      {children}
      {/* Cadre (bois noir, verre) ou poster seul */}
      <div className={`relative z-10 transition-[padding,box-shadow] duration-500 ${framed ? 'p-[3.2%] shadow-[0_60px_120px_-30px_rgba(0,0,0,0.95),0_20px_40px_-20px_rgba(0,0,0,0.8),0_0_0_1px_rgba(255,255,255,0.08),inset_0_0_0_1px_rgba(0,0,0,0.25)]' : 'p-0 shadow-[0_40px_90px_-30px_rgba(0,0,0,0.9)]'}`} style={{ aspectRatio: `${fmt.mm[0]} / ${fmt.mm[1]}`, background: frame.bg || 'transparent' }}>
        <canvas ref={ref} className={`block w-full h-full transition-opacity duration-500 ${ready ? 'opacity-100' : 'opacity-0'}`} style={{ boxShadow: framed ? 'inset 0 2px 6px rgba(0,0,0,0.35)' : 'none' }} />
        {!ready && <div className={`absolute ${framed ? 'inset-[3.2%]' : 'inset-0'} grid place-items-center bg-neutral-900`}><UiSpinner size={20} className="text-neutral-500" /></div>}
        {/* Spot de galerie : lumière qui tombe du haut sur le cadre et la vitre */}
        <div className={`pointer-events-none absolute inset-x-0 top-0 h-px transition-opacity duration-500 ${framed ? '' : 'opacity-0'}`} style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.35) 50%, transparent)' }} />
        <div className="pointer-events-none absolute inset-0" style={{ background: 'radial-gradient(60% 35% at 50% 0%, rgba(255,255,255,0.08), transparent 70%)' }} />
        {/* Reflet léger sur le verre, en diagonale (sous verre seulement) */}
        <div className={`pointer-events-none absolute inset-[3.2%] transition-opacity duration-500 ${framed ? '' : 'opacity-0'}`} style={{ background: 'linear-gradient(125deg, rgba(255,255,255,0.09) 0%, rgba(255,255,255,0.02) 28%, transparent 45%)' }} />
      </div>
      <div className="pointer-events-none mx-auto -mt-2 h-6 w-[86%] rounded-[50%] bg-black/50 blur-xl" />
      <div className={`relative z-10 mt-3 flex justify-center ${compact ? 'hidden' : ''}`}>
        {/* Fiche du poster : exemple ou poster de l'utilisateur, puis modèle, format et cadre */}
        <span className="inline-flex items-stretch max-w-full rounded-full bg-[#121212]/80 backdrop-blur ring-1 ring-white/[0.09] shadow-[0_10px_30px_-12px_rgba(0,0,0,0.8)] p-1 text-[12px] leading-none">
          <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 h-7 font-semibold ${user ? 'bg-emerald-400/15 text-emerald-300' : 'bg-white/[0.08] text-neutral-200'}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${user ? 'bg-emerald-400' : 'bg-neutral-400'}`} />
            {user ? t('poster.votre', 'Votre poster') : t('poster.exemple', 'Exemple')}
          </span>
          {[
            [t('poster.modele', 'Modèle'), tplName],
            [t('poster.format', 'Format'), 'A3'],
            [t('finition.cadre', 'Cadre'), t('finition.cadre.' + frame.id, frame.label), frame],
          ].map(([k, v, f]) => (
            <span key={k} className="inline-flex items-center gap-1.5 px-2.5 h-7 border-l border-white/[0.07] first-of-type:border-0 whitespace-nowrap">
              <span className="text-neutral-500">{k}</span>
              {f && <span className={`w-2.5 h-2.5 rounded-[3px] ${f.id === 'none' ? 'border border-dashed border-white/40' : 'ring-1 ring-white/20'}`} style={{ background: f.swatch }} />}
              <span className="font-medium text-neutral-100">{v}</span>
            </span>
          ))}
        </span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- personnalisation
// Trois réglages volontairement simples sur le poster d'exemple : ils ne peuvent
// pas casser la mise en page (nom limité, couleurs choisies, photos on/off).
const SITE_TRACE_COLORS = [
  { hex: '#ffffff', name: 'Blanc' }, { hex: '#fc5200', name: 'Orange' }, { hex: '#facc15', name: 'Jaune' },
  { hex: '#34d399', name: 'Vert' }, { hex: '#60a5fa', name: 'Bleu' }, { hex: '#f472b6', name: 'Rose' },
];
const SITE_TITLE_MAX = 24;
// Fonds du style « Plan » : tous foncés, pour garder le tracé et les textes lisibles
const SITE_PLAN_BGS = [
  { hex: '#121212', name: 'Noir' }, { hex: '#0f1d33', name: 'Bleu marine' },
  { hex: '#0f2a26', name: 'Vert forêt' }, { hex: '#2a1424', name: 'Aubergine' },
];
function SiteCustomize({ c, value, onChange, items = [] }) {
  const t = useTx();
  const set = (k, v) => onChange({ ...value, [k]: v });
  const p = sitePosterOf(c, value.tpl);
  const defColor = p.color === 'auto' ? '#ffffff' : p.color;
  const color = value.color || defColor;
  const canPhotos = (p.photos || 0) > 0 && !p.bgPhoto && !items.length;
  const photosOn = value.photos !== false;
  const touched = Object.values(value).some((v) => v != null && v !== '');
  const row = 'mt-2.5 w-full h-6 flex items-center justify-between gap-3 text-left group disabled:opacity-40 disabled:cursor-not-allowed';
  const lbl = 'text-[13px] text-neutral-400 group-enabled:group-hover:text-neutral-200 transition-colors';
  const sw = (k, on, label, disabled, hint) => (
    <button role="switch" aria-checked={!disabled && on} disabled={disabled} title={hint} onClick={() => set(k, !on)} className={row}>
      <span className={lbl}>{label}</span><UiSwitch on={!disabled && on} />
    </button>
  );
  return (
    <div className="rounded-2xl bg-[#0e0e0e]/70 backdrop-blur-md ring-1 ring-white/[0.07] px-4 pt-3.5 pb-4">
      <div className="flex items-center justify-between h-6">
        <span className="text-[12px] font-semibold uppercase tracking-[0.12em] text-neutral-500"><Tx k="reglages.titre" d="Réglages" /></span>
        {touched && <button onClick={() => onChange({})} className="text-[12.5px] text-neutral-400 hover:text-white transition-colors"><Tx k="reglages.reinitialiser" d="Réinitialiser" /></button>}
      </div>
      <label className="block mt-2.5">
        <span className="sr-only">{t('reglages.nom', 'Nom du trip')}</span>
        <span className="relative block">
          <input value={value.title || ''} maxLength={SITE_TITLE_MAX} placeholder={siteDefaultTitle(c, items)} onChange={(e) => set('title', e.target.value)}
            className="w-full h-10 rounded-lg bg-white/[0.05] ring-1 ring-white/10 focus:ring-white/30 outline-none pl-3.5 pr-12 text-[14px] text-white placeholder:text-neutral-500 transition-shadow" />
          <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-[11.5px] tabular-nums text-neutral-600">{(value.title || '').length}/{SITE_TITLE_MAX}</span>
        </span>
      </label>
      {/* Style du poster */}
      <div className="mt-2 grid grid-cols-3 gap-1.5 rounded-lg bg-white/[0.04] ring-1 ring-white/10 p-1" role="radiogroup" aria-label="Style du poster">
        {siteStyles(c).map((t) => {
          const on = p.tpl === t.id;
          return (
            <button key={t.id} role="radio" aria-checked={on} onClick={() => onChange({ ...value, tpl: t.id === c.poster.tpl ? null : t.id, color: null, bg: null })}
              className={`h-8 rounded-md text-[12.5px] font-medium transition-colors ${on ? 'bg-white text-neutral-900' : 'text-neutral-300 hover:bg-white/[0.06] hover:text-white'}`}>{t.name}</button>
          );
        })}
      </div>
      <div className="mt-3 min-h-6 flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <span className="text-[13px] text-neutral-400 whitespace-nowrap"><Tx k="reglages.couleur" d="Couleur du tracé" /></span>
        <div className="flex items-center gap-1.5" role="radiogroup" aria-label="Couleur du tracé">
          {SITE_TRACE_COLORS.map((x) => (
            <button key={x.hex} role="radio" aria-checked={color === x.hex} title={x.name} aria-label={x.name}
              onClick={() => set('color', x.hex === defColor ? null : x.hex)}
              className={`w-5 h-5 rounded-full transition-transform hover:scale-110 ${color === x.hex ? 'ring-2 ring-white ring-offset-2 ring-offset-[#121212]' : 'ring-1 ring-white/20'}`}
              style={{ background: x.hex }} />
          ))}
        </div>
      </div>
      {p.tpl === 'blueprint' && (
        <div className="mt-3 min-h-6 flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
          <span className="text-[13px] text-neutral-400 whitespace-nowrap"><Tx k="reglages.fond" d="Fond" /></span>
          <div className="flex items-center gap-1.5" role="radiogroup" aria-label="Fond du poster">
            {SITE_PLAN_BGS.map((x) => {
              const on = (value.bg || p.bg || '#0f1d33') === x.hex;
              return (
                <button key={x.hex} role="radio" aria-checked={on} title={x.name} aria-label={x.name}
                  onClick={() => set('bg', x.hex === (p.bg || '#0f1d33') ? null : x.hex)}
                  className={`w-5 h-5 rounded-md transition-transform hover:scale-110 ${on ? 'ring-2 ring-white ring-offset-2 ring-offset-[#121212]' : 'ring-1 ring-white/25'}`}
                  style={{ background: x.hex }} />
              );
            })}
          </div>
        </div>
      )}
      {sw('photos', photosOn, <Tx k="reglages.photos" d="Ajoutez des photos" />, !canPhotos, canPhotos ? undefined : items.length ? t('reglages.photos.studio', 'Vos photos s’ajoutent dans le studio') : t('reglages.photos.style', 'Ce style n’affiche pas de photos'))}
      {sw('labels', (value.labels != null ? value.labels : p.labels) !== false, <Tx k="reglages.villes" d="Afficher les villes" />)}
      {sw('info', value.info !== false, <Tx k="reglages.infos" d="Afficher les infos" />)}
    </div>
  );
}

// ---------------------------------------------------------------- finition (étape 3)
const SITE_BORDERS = [{ id: 'none', label: 'Aucune' }, { id: 'fine', label: 'Liseré' }, { id: 'marge', label: 'Marge' }];
// Cadres : matière de la baguette autour du poster (aperçu)
const SITE_FRAMES = [
  { id: 'none', label: 'Sans', swatch: 'transparent' },
  { id: 'black', label: 'Noir', swatch: '#151515', bg: '#151515' },
  { id: 'silver', label: 'Argent', swatch: 'linear-gradient(135deg,#eceef1,#9ea4ab 45%,#e3e6e9 70%,#8c9299)', bg: 'linear-gradient(135deg,#e6e8eb 0%,#a4aab1 35%,#dfe2e6 60%,#8f959c 100%)' },
  { id: 'wood', label: 'Bois clair', swatch: 'linear-gradient(135deg,#e2c79f,#c39a68 50%,#d8b88a)', bg: 'repeating-linear-gradient(100deg,rgba(120,80,40,0.10) 0 2px,transparent 2px 7px),linear-gradient(135deg,#e0c49a 0%,#c79f6d 40%,#dcbd90 70%,#bb8f5c 100%)' },
];
const siteFrameOf = (finish) => SITE_FRAMES.find((f) => f.id === (finish.frame === false ? 'none' : finish.frame || 'black')) || SITE_FRAMES[1];
function SiteFinish({ c, tplId, value, onChange, onOpen, opening, ready }) {
  const border = value.border || sitePosterOf(c, tplId).border || 'none';
  const frame = siteFrameOf(value);
  const lbl = 'text-[13px] text-neutral-400';
  return (
    <div>
      <div className="rounded-2xl bg-[#0e0e0e]/70 ring-1 ring-white/[0.07] px-4 pt-3.5 pb-4">
        <span className="text-[12px] font-semibold uppercase tracking-[0.12em] text-neutral-500"><Tx k="finition.titre" d="Finition" /></span>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
          <span className={lbl}><Tx k="finition.bordure" d="Bordure" /></span>
          <div className="inline-flex rounded-lg bg-white/[0.04] ring-1 ring-white/10 p-0.5" role="radiogroup" aria-label="Bordure">
            {SITE_BORDERS.map((x) => (
              <button key={x.id} role="radio" aria-checked={border === x.id} onClick={() => onChange({ ...value, border: x.id })}
                className={`h-7 px-2.5 rounded-md text-[12.5px] font-medium transition-colors ${border === x.id ? 'bg-white text-neutral-900' : 'text-neutral-400 hover:text-white'}`}><Tx k={'finition.bordure.' + x.id} d={x.label} /></button>
            ))}
          </div>
        </div>
        <div className="mt-3.5">
          <span className={lbl}><Tx k="finition.cadre" d="Cadre" /></span>
          <div className="mt-2 grid grid-cols-2 sm:grid-cols-4 gap-1.5" role="radiogroup" aria-label="Cadre">
            {SITE_FRAMES.map((f) => {
              const on = frame.id === f.id;
              return (
                <button key={f.id} role="radio" aria-checked={on} onClick={() => onChange({ ...value, frame: f.id })}
                  className={`flex flex-col items-center gap-1.5 rounded-lg py-2 ring-1 transition-colors ${on ? 'bg-white/[0.07] ring-white/35' : 'ring-white/[0.08] hover:bg-white/[0.04]'}`}>
                  <span className={`w-6 h-6 rounded-[5px] ${f.id === 'none' ? 'ring-1 ring-dashed ring-white/30 border border-dashed border-white/30' : 'ring-1 ring-black/40'}`} style={{ background: f.swatch }} />
                  <span className={`text-[11.5px] ${on ? 'text-white' : 'text-neutral-500'}`}><Tx k={'finition.cadre.' + f.id} d={f.label} /></span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
      {/* Passage vers le vrai produit : l'app Printrace (connexion puis studio) */}
      <button onClick={onOpen} disabled={!!opening}
        className="group relative mt-4 w-full overflow-hidden rounded-2xl pl-5 pr-3.5 py-4 flex items-center gap-4 text-left text-white ring-1 ring-inset ring-white/15 shadow-[0_22px_50px_-20px_rgba(37,99,235,0.85),inset_0_1px_0_rgba(255,255,255,0.22)] hover:-translate-y-px hover:shadow-[0_26px_60px_-18px_rgba(37,99,235,1),inset_0_1px_0_rgba(255,255,255,0.28)] active:translate-y-0 transition-[transform,box-shadow] duration-200 disabled:opacity-70"
        style={{ background: 'linear-gradient(180deg, #3b82f6 0%, #2563eb 100%)' }}>
        {/* Reflet qui balaie le bouton au survol */}
        <span aria-hidden="true" className="pointer-events-none absolute inset-y-0 -left-1/3 w-1/3 -skew-x-12 bg-gradient-to-r from-transparent via-white/25 to-transparent -translate-x-full group-hover:translate-x-[450%] transition-transform duration-700 ease-out" />
        <span className="relative flex-1 min-w-0">
          <span className="block text-[16px] font-semibold leading-tight"><Tx k="finition.cta" d="Créer mon poster sur Printrace" /></span>
          <span className="block mt-1 text-[12.5px] text-blue-100/80 leading-snug">{ready ? <Tx k="finition.cta.importe" d="Vos tracés et réglages vous suivent dans l’app." /> : <Tx k="finition.cta.sous" d="Fichier HD ou poster livré, dans l’app." />}</span>
        </span>
        <span className="relative w-10 h-10 shrink-0 rounded-full bg-white text-blue-600 grid place-items-center shadow-[0_4px_12px_rgba(15,23,42,0.25)] transition-transform group-hover:translate-x-0.5">
          {opening ? <UiSpinner size={16} /> : <I.ChevronRight size={18} />}
        </span>
      </button>
    </div>
  );
}

// ---------------------------------------------------------------- titre dynamique
function SiteUseCasePicker({ value, onChange, onInteract, auto }) {
  const [open, setOpen] = useSiteState(false);
  const ref = useSiteRef(null);
  const c = SITE_CASES.find((x) => x.id === value);
  useSiteEffect(() => {
    if (!open) return;
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const k = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', h); document.addEventListener('keydown', k);
    return () => { document.removeEventListener('mousedown', h); document.removeEventListener('keydown', k); };
  }, [open]);
  return (
    <span ref={ref} className="relative inline-block">
      <button onClick={() => { setOpen((v) => !v); onInteract(); }} aria-haspopup="listbox" aria-expanded={open}
        className="group relative inline-flex items-baseline gap-[0.12em] text-white">
        {/* Fond du survol : déborde du mot (marges égales) sans changer la hauteur de ligne */}
        <span aria-hidden="true" className="absolute -left-[0.2em] -right-[0.16em] -top-[0.08em] -bottom-[0.22em] rounded-[0.2em] transition-colors group-hover:bg-white/[0.045]" />
        <span key={value} className="ds-fade-up relative inline-block italic pr-[0.06em]" style={{ color: c.accent }}>
          <Tx k={'cas.' + c.id + '.mot'} d={c.word} />
          {/* Trait discret en pointillés ; en lecture auto, il se remplit jusqu'au mot suivant */}
          {/* Fine barre de progression : rail discret, remplissage dans la couleur du mot */}
          <span aria-hidden="true" className="site-bar absolute left-[0.04em] right-[0.04em] -bottom-[0.08em] overflow-hidden" style={{ background: c.accent + '17' }}>
            {auto
              ? <span key={value} className="site-bar-fill block h-full" style={{ background: c.accent + '99', animationDuration: `${SITE_ROTATE_MS}ms` }} />
              : <span className="block h-full w-full" style={{ background: c.accent + '66' }} />}
          </span>
        </span>
        <span className="relative text-neutral-500 group-hover:text-white transition-colors self-center" style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }}>
          <svg viewBox="0 0 24 24" className="w-[0.32em] h-[0.32em]" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9l6 6 6-6" /></svg>
        </span>
      </button>
      {open && (
        <div role="listbox" className="absolute left-1/2 -translate-x-1/2 top-full mt-3 z-40 w-[340px] max-w-[88vw] rounded-2xl bg-[#141415] ring-1 ring-white/10 shadow-[0_24px_60px_rgba(0,0,0,0.6)] p-1.5 text-left animate-menu" style={{ fontFamily: 'var(--ds-font-site)', fontSize: 14, letterSpacing: 0, lineHeight: 1.3 }}>
          {SITE_CASES.map((x) => {
            const on = x.id === value, Ico = I[x.icon] || I.Route;
            return (
              <button key={x.id} role="option" aria-selected={on} onClick={() => { onChange(x.id); setOpen(false); }}
                className={`w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors ${on ? 'bg-white/[0.08]' : 'hover:bg-white/[0.05]'}`}>
                <span className="w-9 h-9 shrink-0 rounded-lg grid place-items-center transition-colors"
                  style={on ? { background: 'rgba(255,255,255,0.12)', color: '#fff' } : { background: 'rgba(255,255,255,0.05)', color: '#a3a3a3' }}><Ico size={17} /></span>
                <span className="flex-1 min-w-0">
                  <span className="block text-[14px] font-semibold text-white"><Tx k={'cas.' + x.id + '.nom'} d={x.label} /></span>
                  <span className="block text-[12px] text-neutral-500 truncate"><Tx k={'cas.' + x.id + '.exemples'} d={x.example} /></span>
                </span>
                {on && <span className="text-neutral-300"><I.Check size={15} /></span>}
              </button>
            );
          })}
        </div>
      )}
    </span>
  );
}

// ---------------------------------------------------------------- import
// Adresse du studio (même site) ; les tracés partent dans le lien (#t=…), via la connexion
function siteStudioUrl() {
  return (window.RoutdoorLink ? window.RoutdoorLink.siteRoot() : './') + 'studio/';
}
// o : réglages du site repris dans le studio (nom du trip, couleur du tracé)
async function siteOpenStudio(stages, c, source, o = {}) {
  const parts = stages.map(({ st, name }) => ({
    name: (st.to ? st.from + ' → ' + st.to : st.from) || name.replace(/\.[^.]+$/, ''),
    color: o.color || '', distance: st.distanceKm, ascent: st.elevationGain, descent: st.elevationLoss,
    durationMin: st.gpxMovingMin || 0, date: st.gpxDate ? st.gpxDate.slice(0, 10) : '', coords: st.coords,
  }));
  const code = await window.RoutdoorLink.encodeShare({ title: (o.title || '').trim() || (parts.length > 1 ? 'Mon ' + c.word : ''), parts }, 6000);
  // Entrée du produit : la page de connexion, qui ouvre ensuite le studio avec ces tracés
  const url = ptLoginUrl('#t=' + code + '&a=' + c.activity + '&src=site' + (source && source !== 'file' ? '&from=' + source : ''));
  // Page affichée dans un cadre (aperçu intégré) : le studio s'ouvre dans un nouvel onglet
  let sameSite = true; try { sameSite = window.self === window.top; } catch (e) { sameSite = false; }
  if (sameSite) location.href = url; else window.open(url, '_blank', 'noopener');
}

// Lien Komoot (tour enregistré ou planifié) -> { kind, id }
function siteParseKomoot(input) {
  const v = String(input || '').trim();
  if (!v) return null;
  const m = v.match(/komoot\.[a-z.]+\/(?:[a-z]{2}(?:-[a-z]{2})?\/)?tour\/(\d+)/i);
  if (m) return { kind: 'tour', id: m[1] };
  if (/^\d{5,}$/.test(v)) return { kind: 'tour', id: v };
  return { kind: 'invalid' };
}
// Sources par lien : sans relais serveur, parcours guidé (télécharger le GPX puis le déposer)
const SITE_LINK_SOURCES = [
  { id: 'strava', name: 'Strava', color: '#fc4c02', logo: ['stravaLogo', 'assets/strava.svg'], placeholder: 'Collez une activité Strava',
    parse: ptParseStrava, exportUrl: ptStravaExportUrl, label: (r) => 'Activité Strava n° ' + r.id,
    invalid: "Ce lien n'est pas une activité Strava.", short: "Lien raccourci : ouvrez-le puis copiez l'adresse complète (strava.com/activities/…)." },
  { id: 'komoot', name: 'Komoot', color: '#5f9f19', logo: ['komootDark', 'assets/komoot-dark.svg'], placeholder: 'Collez un tour Komoot',
    parse: siteParseKomoot, exportUrl: (r) => `https://www.komoot.com/tour/${r.id}/download`, label: (r) => 'Tour Komoot n° ' + r.id,
    invalid: "Ce lien n'est pas un tour Komoot (komoot.com/tour/…)." },
];

function SiteImport({ c, items, setItems, onNext, opening }) {
  const t = useTx();
  const fileRef = useSiteRef(null);
  const [busy, setBusy] = useSiteState(false);
  const [over, setOver] = useSiteState(false);
  const [error, setError] = useSiteState({ src: '', msg: '' }); // erreur affichée sous son champ
  const [links, setLinks] = useSiteState({ strava: '', komoot: '' });
  const [guided, setGuided] = useSiteState({}); // lien valide en attente du fichier, par source
  const [linkBusy, setLinkBusy] = useSiteState('');
  // L'étape suivante s'affiche sous la liste du dernier import
  const [lastSource, setLastSource] = useSiteState('file');
  const pickSource = useSiteRef('file'); // provenance du prochain fichier choisi
  // Colonne étroite (écrans 1024-1279 px) : textes d'aide raccourcis, jamais coupés
  const [narrow, setNarrow] = useSiteState(false);
  useSiteEffect(() => {
    const mq = window.matchMedia('(max-width: 639px), (min-width: 1024px) and (max-width: 1279px)');
    const on = () => setNarrow(mq.matches);
    on(); mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);

  const importFiles = async (list, source = 'file') => {
    setError({ src: '', msg: '' });
    const files = [...(list || [])].filter(isTrackFile);
    if (!files.length) { setError({ src: source, msg: 'Formats acceptés : GPX, FIT, TCX, KML, GeoJSON, IGC.' }); return false; }
    setBusy(true);
    const res = await Promise.all(files.map((f) => readTrackFile(f).then((st) => ({ st, name: f.name })).catch(() => null)));
    const ok = res.filter((r) => r && r.st && r.st.coords && r.st.coords.length > 1);
    setBusy(false);
    if (!ok.length) { setError({ src: source, msg: 'Impossible de lire ce fichier.' }); return false; }
    setLastSource(source);
    if (ok.length < files.length) setError({ src: source, msg: `${files.length - ok.length} fichier(s) illisible(s) ignoré(s).` });
    setItems((prev) => {
      const same = (a, b) => a.name === b.name && Math.abs((a.st.distanceKm || 0) - (b.st.distanceKm || 0)) < 0.01;
      const fresh = ok.filter((r) => !prev.some((q) => same(q, r))).map((r, i) => ({ ...r, id: Date.now() + '_' + i, source }));
      return [...prev, ...fresh];
    });
    return true;
  };
  const removeItem = (id) => setItems((l) => l.filter((x) => x.id !== id));
  const pick = (source = 'file') => { pickSource.current = source; if (fileRef.current) fileRef.current.click(); };
  const submitLink = async (src) => {
    setError({ src: '', msg: '' });
    const r = src.parse(links[src.id]);
    if (!r || r.kind === 'invalid') { setError({ src: src.id, msg: src.invalid }); return; }
    if (r.kind === 'short') { setError({ src: src.id, msg: src.short }); return; }
    if (src.id === 'strava' && ptStravaApi()) { // relais Strava configuré : import direct
      setLinkBusy('strava');
      try { const f = await ptFetchStravaGpx(r); if (f) await importFiles([f], 'strava'); }
      catch (e) { setError({ src: 'strava', msg: e.message || 'Import Strava impossible.' }); }
      setLinkBusy('');
      return;
    }
    setGuided((g) => ({ ...g, [src.id]: r }));
  };
  const total = items.reduce((a, x) => a + (x.st.distanceKm || 0), 0);
  const bySource = (id) => items.filter((x) => (x.source || 'file') === id);
  const ctaUnder = bySource(lastSource).length ? lastSource : (['file', 'strava', 'komoot'].find((k) => bySource(k).length) || 'file');
  const next = (where) => items.length > 0 && ctaUnder === where && (
    <UiButton variant="primary" size="lg" block iconRight="ChevronRight" loading={opening} onClick={onNext} className="mt-3 ds-fade-up">
      <Tx k="import.cta" d="Personnaliser ma carte" />{items.length > 1 ? ` · ${items.length} tracés, ${ptKm(total)}` : ''}
    </UiButton>
  );
  const errorFor = (id) => error.msg && error.src === id && <p className="mt-2 text-[13px] text-red-300">{error.msg}</p>;
  const srcIcon = (id) => {
    const src = SITE_LINK_SOURCES.find((x) => x.id === id);
    return src ? <img src={ptRes(src.logo[0], src.logo[1])} alt="" width="18" height="18" className="rounded-[4px]" /> : <I.Route size={15} />;
  };
  // Tracés ajoutés, affichés sous le champ d'où ils viennent
  const list = (id) => {
    const xs = bySource(id);
    return xs.length > 0 && (
      <ul className="mt-2 rounded-2xl bg-white/[0.03] ring-1 ring-white/[0.08] divide-y divide-white/[0.06] overflow-hidden ds-fade-up">
        {xs.map((x) => (
          <li key={x.id} className="flex items-center gap-3 pl-3.5 pr-2 h-14">
            <span className="w-8 h-8 shrink-0 rounded-lg grid place-items-center bg-white/[0.06] text-neutral-300">{srcIcon(id)}</span>
            <span className="flex-1 min-w-0">
              <span className="block text-[13.5px] font-medium text-white truncate">{siteItemLabel(x)}</span>
              <span className="block text-[11.5px] text-neutral-500 tabular-nums">{ptKm(x.st.distanceKm || 0)} · {ptM(x.st.elevationGain)} D+</span>
            </span>
            <UiIconButton icon="X" label={'Retirer ' + siteItemLabel(x)} size="sm" onClick={() => removeItem(x.id)} />
          </li>
        ))}
      </ul>
    );
  };

  return (
    <div className="w-full">
      <input ref={fileRef} type="file" multiple accept={TRACK_ACCEPT} className="hidden" onChange={(e) => {
        const src = pickSource.current; pickSource.current = 'file';
        importFiles(e.target.files, src).then((ok) => { if (ok && src !== 'file') { setGuided((g) => ({ ...g, [src]: null })); setLinks((l) => ({ ...l, [src]: '' })); } });
        e.target.value = '';
      }} />
      <div className="flex flex-col gap-3">
        {/* Fichiers GPX, FIT… */}
        <div>
          <button onClick={() => pick()}
            onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)}
            onDrop={(e) => { e.preventDefault(); setOver(false); importFiles(e.dataTransfer.files); }}
            className={`group w-full min-h-[64px] py-3 sm:py-0 sm:h-[84px] rounded-[18px] sm:rounded-[20px] border-[1.5px] border-dashed flex items-center gap-3 sm:gap-4 px-3.5 sm:px-4 text-left transition-all ${over ? 'border-white bg-white/[0.08] scale-[1.01]' : 'border-white/25 bg-white/[0.03] hover:border-white/50 hover:bg-white/[0.05]'}`}>
            <span className={`w-10 h-10 sm:w-12 sm:h-12 shrink-0 rounded-[10px] grid place-items-center ring-1 transition-colors ${over ? 'bg-white text-neutral-900 ring-white' : 'bg-white/[0.07] text-white ring-white/10 group-hover:bg-white group-hover:text-neutral-900'}`}>
              {busy ? <UiSpinner size={18} /> : <I.Upload size={19} />}
            </span>
            <span className="flex-1 min-w-0">
              <span className="block text-[14px] sm:text-[15px] font-semibold text-white leading-snug sm:whitespace-nowrap">{busy ? t('import.lecture', 'Lecture…') : over ? <Tx k="import.deposez" d="Déposez vos tracés" /> : bySource('file').length ? <Tx k="import.ajouter" d="Ajoutez d’autres tracés" /> : <Tx k="import.titre" d="Importez votre tracé" />}</span>
              <span className="block text-[12px] sm:text-[12.5px] text-neutral-500 mt-1.5 leading-tight sm:leading-none tracking-[0.03em] sm:whitespace-nowrap"><Tx k="import.formats" d="GPX · FIT · TCX · KML" /></span>
            </span>
            {!busy && <span className="shrink-0 w-[88px] h-10 rounded-lg hidden sm:grid lg:hidden xl:grid place-items-center text-[13px] font-semibold text-neutral-100 bg-white/[0.08] group-hover:bg-white/[0.14] transition-colors"><Tx k="import.parcourir" d="Parcourir" /></span>}
          </button>
          {errorFor('file')}
          {list('file')}
          {next('file')}
        </div>
        {/* Liens Strava et Komoot : même gabarit, tout le bloc est la zone de clic du champ */}
        {SITE_LINK_SOURCES.map((src) => {
          const g = guided[src.id], bad = error.src === src.id && error.msg && links[src.id];
          return (
            <div key={src.id} style={{ '--src': src.color }}>
              <label className={`h-[64px] sm:h-[84px] flex items-center gap-2 sm:gap-3 pl-3 sm:pl-5 pr-2.5 sm:pr-4 rounded-[18px] sm:rounded-[20px] cursor-text bg-white/[0.03] ring-1 transition-colors hover:bg-white/[0.05] focus-within:bg-white/[0.05] ${bad ? 'ring-red-400/60' : 'ring-white/[0.14] hover:ring-white/25 focus-within:ring-2 focus-within:ring-[color:var(--src)] focus-within:hover:ring-[color:var(--src)]'}`}>
                <img src={ptRes(src.logo[0], src.logo[1])} alt="" width="26" height="26" className="w-7 h-7 sm:w-[30px] sm:h-[30px] rounded-[7px] shrink-0" />
                <input value={links[src.id]} onChange={(e) => { const v = e.target.value; setLinks((l) => ({ ...l, [src.id]: v })); setError({ src: '', msg: '' }); setGuided((x) => ({ ...x, [src.id]: null })); }}
                  onKeyDown={(e) => { if (e.key === 'Enter') submitLink(src); }}
                  placeholder={narrow ? 'Lien ' + src.name : t('import.' + src.id + '.champ', src.placeholder)} aria-label={'Lien ' + src.name} inputMode="url"
                  style={{ outline: 'none', caretColor: src.color }} className="flex-1 min-w-0 h-full bg-transparent text-[14px] text-white placeholder:text-neutral-500" />
                <button onClick={(e) => { e.preventDefault(); submitLink(src); }} disabled={linkBusy === src.id}
                  aria-label={t('import.' + src.id + '.bouton', 'Importer')}
                  className="w-10 sm:w-[88px] h-10 shrink-0 rounded-lg grid place-items-center text-[13px] font-semibold text-white transition-[filter] hover:brightness-110 disabled:opacity-70" style={{ background: src.color }}>
                  {/* Écran étroit : flèche seule */}
                  {linkBusy === src.id ? <UiSpinner size={16} /> : <><span className="hidden sm:inline"><Tx k={'import.' + src.id + '.bouton'} d="Importer" /></span><span className="grid sm:hidden"><I.ChevronRight size={18} /></span></>}
                </button>
              </label>
              {errorFor(src.id)}
              {g && (
                <div className="mt-2 text-left rounded-2xl ring-1 p-4 ds-fade-up" style={{ background: src.color + '12', boxShadow: `inset 0 0 0 1px ${src.color}40` }}>
                  <div className="flex items-start gap-3">
                    <img src={ptRes(src.logo[0], src.logo[1])} alt="" width="28" height="28" className="rounded-md shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-[14px] font-semibold text-white">{src.label(g)}</div>
                      <p className="text-[13px] text-neutral-300 mt-0.5 leading-snug">{t('import.guide', 'Téléchargez le GPX depuis votre compte {source}, puis déposez-le ici : il s’ajoute à vos tracés.').replace('{source}', src.name)}</p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <a href={src.exportUrl(g)} target="_blank" rel="noopener" className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg text-[13px] font-semibold text-white hover:brightness-110" style={{ background: src.color }}><I.Download size={15} /> <Tx k="import.guide.telecharger" d="Télécharger le GPX" /></a>
                        <UiButton icon="Upload" onClick={() => pick(src.id)}><Tx k="import.guide.deposer" d="Déposer le fichier" /></UiButton>
                      </div>
                    </div>
                    <UiIconButton icon="X" label="Fermer" size="sm" onClick={() => setGuided((x) => ({ ...x, [src.id]: null }))} />
                  </div>
                </div>
              )}
              {list(src.id)}
              {next(src.id)}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Grain très fin (bruit SVG) : adoucit les dégradés sur écran Retina
const SITE_GRAIN = `url("data:image/svg+xml;utf8,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160"><filter id="n"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" stitchTiles="stitch"/></filter><rect width="100%" height="100%" filter="url(#n)"/></svg>')}")`;

// ---------------------------------------------------------------- étapes
// Le hero se lit en 3 étapes au fil du scroll : le poster reste à l'écran (à droite),
// l'étape au centre de l'écran est mise en avant, les autres s'estompent.
const SITE_FLOW = [
  { id: 'import', title: 'Importez votre tracé', text: 'Fichier GPX, activité Strava ou tour Komoot : votre tracé s’affiche aussitôt sur le poster.' },
  { id: 'custom', title: 'Personnalisez votre poster', text: 'Choisissez le style, la couleur du tracé, vos photos et les infos affichées.' },
  { id: 'print', title: 'Imprimez-le', text: 'Choisissez la bordure et le cadre, puis finalisez votre poster dans l’app Printrace.' },
];
// En-tête d'étape : bulle numérotée (comme le stepper de droite), nom de l'étape, puis description
// Grand chiffre en Mont italique, discret (dégradé gris anthracite), puis nom de l'étape
// en Mont italique, puis description
function SiteStepHead({ i, accent, snap }) {
  const st = SITE_FLOW[i];
  return (
    <div data-step-head style={snap ? { scrollSnapAlign: 'start', scrollSnapStop: 'always', scrollMarginTop: SITE_POSTER_TOP } : undefined}>
      {/* Mobile : numéro à côté du titre (plus compact) ; grand écran : numéro au-dessus */}
      <div className="flex items-baseline gap-3 lg:block">
      <span aria-hidden="true" data-step-num className="shrink-0 block font-display italic font-extrabold leading-[0.9] tracking-[-0.04em] text-[30px] lg:text-[46px] tabular-nums select-none"
        style={{ fontFamily: 'var(--ds-font-display)', backgroundImage: 'linear-gradient(180deg, #353535 0%, #1b1b1b 100%)', WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent', paddingRight: '0.08em', willChange: snap ? 'opacity' : undefined }}>
        0{i + 1}
      </span>
      <h2 className="lg:mt-3 font-display italic font-bold tracking-[-0.02em] leading-[1.15] text-[22px] lg:text-[24px] text-white"><span className="sr-only">Étape {i + 1} : </span><Tx k={'etape.' + (i + 1) + '.titre'} d={st.title} /></h2>
      </div>
      <p className="mt-2.5 lg:mt-3.5 text-[14px] lg:text-[15px] leading-[1.6] lg:leading-[1.7] text-neutral-400 max-w-[400px]"><Tx k={'etape.' + (i + 1) + '.texte'} d={st.text} /></p>
    </div>
  );
}

// Repère des étapes (à droite du poster) : simple consultation, cliquable pour y aller
function SiteStepRail({ step, onGo }) {
  return (
    <nav aria-label="Étapes" className="pl-8 xl:pl-12">
      <ol className="flex flex-col gap-4">
        {SITE_FLOW.map((st, i) => {
          const on = i === step;
          return (
            <li key={st.id}>
              <button onClick={() => onGo(i)} aria-current={on ? 'step' : undefined} className="group flex items-center gap-3 text-left">
                <span className={`w-8 h-8 shrink-0 rounded-full grid place-items-center text-[12.5px] font-semibold tabular-nums transition-colors duration-300 ${on ? 'bg-white/[0.12] text-neutral-100 ring-1 ring-white/25' : 'bg-white/[0.04] text-neutral-500 ring-1 ring-white/15 group-hover:text-neutral-200 group-hover:ring-white/30'}`}>{i + 1}</span>
                <span className={`text-[14px] whitespace-nowrap transition-colors duration-300 ${on ? 'text-neutral-200 font-medium' : 'text-neutral-500 group-hover:text-neutral-300'}`}><Tx k={'etape.' + (i + 1) + '.titre'} d={st.title} /></span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

// ---------------------------------------------------------------- page
// Poster (grand écran) : largeur selon la hauteur d'écran, centré verticalement quand il est collé
// largeur bornée par la hauteur d'écran et par la place des colonnes de côté (≈ 380 px chacune)
const SITE_POSTER_W = 'max(340px, min(480px, calc((100vh - 120px) / 1.48), calc(100vw - 880px)))';
const SITE_POSTER_H = `calc(${SITE_POSTER_W} * 1.414 + 48px)`; // cadre A3 + étiquette
const SITE_POSTER_TOP = `max(20px, calc((100vh - ${SITE_POSTER_H}) / 2))`;
// Mobile : étapes sur 60 % de la largeur, poster collé à droite (centré en hauteur), rogné par le bord
const SITE_M_COL = '60vw';
const SITE_M_GAP = '6vw';
const SITE_M_POSTER_W = 'min(72vw, calc((100svh - 120px) / 1.414))';
const SITE_M_POSTER_TOP = `calc((100svh - ${SITE_M_POSTER_W} * 1.414) / 2)`;
// ---------------------------------------------------------------- posts Instagram
// Banderole de posts : posters Printrace mis en scène chez soi (images générées par
// scripts/insta/, comptes fictifs). Défilement continu, en pause au survol.
const SITE_POSTS = [
  { id: 'siteInsta1', user: 'camille.roadtrip', place: 'Lyon', likes: 1284, text: 'Pacific Coast Highway au-dessus du canapé. 6 étapes, 750 km de souvenirs', tags: '#roadtrip #printrace' },
  { id: 'siteInsta2', user: 'thomas.court', place: 'Paris', likes: 862, text: 'Premier marathon, 3 h 42. La médaille a trouvé sa place', tags: '#marathondeparis #printrace' },
  { id: 'siteInsta3', user: 'julie.en.montagne', place: 'Annecy', likes: 2107, text: '16 jours sur le GR20, au-dessus du lit pour ne jamais oublier', tags: '#gr20 #trek' },
  { id: 'siteInsta4', user: 'max.bikerlife', place: 'Grenoble', likes: 1530, text: 'Route des Grandes Alpes, 16 cols. Le garage a enfin sa déco', tags: '#moto #grandesalpes' },
  { id: 'siteInsta5', user: 'lea.bretagne', place: 'Brest', likes: 974, text: 'Le tour de Ouessant, avec la Jument en fond. Mon GPX préféré', tags: '#ouessant #gpx' },
  { id: 'siteInsta6', user: 'antoine.rando', place: 'Bordeaux', likes: 618, text: 'Version éditoriale pour le bureau, avec mes deux photos du GR20', tags: '#gr20 #printrace' },
  { id: 'siteInsta7', user: 'sarah.voyage', place: 'Nantes', likes: 1419, text: 'Déballage ! Le poster est arrivé, cadre noyer', tags: '#unboxing #roadtrip' },
  { id: 'siteInsta8', user: 'hugo.runs', place: 'Lille', likes: 733, text: 'Marathon de Paris, au café du quartier', tags: '#running #printrace' },
  { id: 'siteInsta9', user: 'nico.twinroads', place: 'Chambéry', likes: 1198, text: 'Les Grandes Alpes, cadre chêne, au-dessus du fauteuil', tags: '#motortrip #printrace' },
].map((x, i) => ({ ...x, src: ptRes(x.id, 'assets/site/insta/post-' + (i + 1) + '.webp') }));

function SiteInstaIcon({ d, size = 22, fill }) {
  return <svg viewBox="0 0 24 24" width={size} height={size} fill={fill || 'none'} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{d}</svg>;
}
const SITE_IG = {
  heart: <path d="M12 20s-7.5-4.6-9.2-9.3C1.7 7.5 3.8 4.5 7 4.5c2 0 3.4 1.1 5 3 1.6-1.9 3-3 5-3 3.2 0 5.3 3 4.2 6.2C19.5 15.4 12 20 12 20z" />,
  comment: <path d="M20.5 11.5a8.5 8.5 0 0 1-12.6 7.4L3.5 20l1.2-4.2A8.5 8.5 0 1 1 20.5 11.5z" />,
  send: <><path d="M21.5 3 10 14.5" /><path d="M21.5 3 14.5 21l-4.5-6.5L3 10z" /></>,
  save: <path d="M18.5 21 12 16.5 5.5 21V4.5a1.5 1.5 0 0 1 1.5-1.5h10a1.5 1.5 0 0 1 1.5 1.5z" />,
  logo: <><rect x="3" y="3" width="18" height="18" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.3" cy="6.7" r="0.6" fill="currentColor" /></>,
};

function SiteInstaPost({ post, i }) {
  const t = useTx(), k = 'insta.post' + (i + 1) + '.';
  return (
    <figure className="w-[272px] sm:w-[300px] shrink-0 rounded-2xl bg-[#121213] ring-1 ring-white/[0.07] overflow-hidden text-left">
      <figcaption className="flex items-center gap-2.5 px-3 h-12">
        <span className="rounded-full p-[2px]" style={{ background: 'linear-gradient(45deg,#f9ce34,#ee2a7b,#6228d7)' }}><span className="block rounded-full ring-2 ring-[#121213]"><SiteAvatar i={i} /></span></span>
        <span className="min-w-0 leading-tight">
          <span className="block text-[13px] font-semibold text-white truncate"><Tx k={k + 'pseudo'} d={post.user} /></span>
          <span className="block text-[11px] text-neutral-500 truncate"><Tx k={k + 'lieu'} d={post.place} /></span>
        </span>
        <span className="ml-auto text-neutral-500 text-[18px] leading-none tracking-widest" aria-hidden="true">···</span>
      </figcaption>
      <img src={post.src} alt={'Poster Printrace : ' + t(k + 'texte', post.text)} loading="lazy" decoding="async" width="640" height="800" className="block w-full aspect-[4/5] object-cover bg-neutral-900" />
      <div className="px-3 pt-2.5 pb-3.5">
        <div className="flex items-center gap-3.5 text-neutral-200">
          <span className="text-[#ff3b5c]"><SiteInstaIcon d={SITE_IG.heart} fill="currentColor" /></span>
          <SiteInstaIcon d={SITE_IG.comment} /><SiteInstaIcon d={SITE_IG.send} />
          <span className="ml-auto"><SiteInstaIcon d={SITE_IG.save} /></span>
        </div>
        <p className="mt-2 text-[12.5px] font-semibold text-white">{String(post.likes).replace(/\B(?=(\d{3})+(?!\d))/g, '\u202f')} J’aime</p>
        <p className="mt-1 text-[12.5px] leading-snug text-neutral-300 line-clamp-2"><span className="font-semibold text-white">{t(k + 'pseudo', post.user)}</span> <Tx k={k + 'texte'} d={post.text} /> <span className="text-[#7fa8ff]"><Tx k={k + 'tags'} d={post.tags} /></span></p>
      </div>
    </figure>
  );
}

function SiteInstaWall({ snap }) {
  const t = useTx();
  // Deux fois la liste à la suite : la boucle reprend sans saut à mi-parcours
  const row = SITE_POSTS.concat(SITE_POSTS);
  return (
    <section aria-label="Les posters Printrace sur Instagram" className="relative py-20 lg:py-28 border-t border-white/[0.06]" style={snap ? { scrollSnapAlign: 'start' } : undefined}>
      <div className="max-w-[1240px] mx-auto px-5 sm:px-8 text-center">
        <h2 className="font-display italic font-bold tracking-[-0.02em] text-[clamp(28px,3.2vw,42px)] leading-tight"><Tx k="insta.titre" d="Vos aventures, au mur" /></h2>
        <p className="mt-4 text-[16px] leading-relaxed text-neutral-400 max-w-[520px] mx-auto"><Tx k="insta.texte" d="Du canapé au garage, ils ont imprimé leur tracé. Partagez le vôtre avec" /> <span className="text-white font-medium"><Tx k="insta.hashtag" d="#printrace" /></span>.</p>
      </div>
      <div className="site-marquee relative mt-12 overflow-hidden" style={{ maskImage: 'linear-gradient(90deg, transparent, #000 8%, #000 92%, transparent)', WebkitMaskImage: 'linear-gradient(90deg, transparent, #000 8%, #000 92%, transparent)' }}>
        <div className="site-marquee-track flex w-max gap-5">
          {row.map((post, i) => <div key={i} aria-hidden={i >= SITE_POSTS.length ? 'true' : undefined}><SiteInstaPost post={post} i={i % SITE_POSTS.length} /></div>)}
        </div>
      </div>
      <div className="mt-10 flex justify-center">
        <a href={t('lien.instagram', 'https://www.instagram.com/')} target="_blank" rel="noopener" className="inline-flex items-center gap-2 h-11 px-5 rounded-full bg-white/[0.06] ring-1 ring-white/10 text-[14px] font-medium text-neutral-200 hover:bg-white/[0.1] hover:text-white transition-colors">
          <SiteInstaIcon d={SITE_IG.logo} size={18} /> <Tx k="insta.suivre" d="Suivre @printrace" />
        </a>
      </div>
    </section>
  );
}

// Pied de page : petit logo, liens utiles
function SiteFooter({ snap }) {
  const t = useTx();
  // Routdoor est hébergé à part (PRINTRACE_CONFIG.routdoorUrl)
  const routdoor = window.RoutdoorLink ? window.RoutdoorLink.routdoorBase() : '';
  // [clé, texte par défaut, liens [clé, texte, adresse]]
  const cols = [
    ['pied.produit', 'Produit', [['pied.creer', 'Créer mon poster', ptLoginUrl()], ['pied.connexion', 'Se connecter', ptLoginUrl()], ...(routdoor ? [['pied.routdoor', 'Routdoor, l’app de tracés', routdoor]] : [])]],
    ['pied.suivre', 'Suivre', [['pied.instagram', 'Instagram', t('lien.instagram', 'https://www.instagram.com/')]]],
  ];
  return (
    <footer className="relative border-t border-white/[0.06]" style={snap ? { scrollSnapAlign: 'end' } : undefined}>
      <div className="max-w-[1240px] mx-auto px-5 sm:px-8 py-14 grid gap-10 sm:grid-cols-[2fr_repeat(2,minmax(0,1fr))]">
        <div>
          <a href="./" aria-label="Printrace" className="inline-block text-white opacity-90 hover:opacity-100"><UiPrintraceLogo height={20} /></a>
          <p className="mt-3 text-[13.5px] leading-relaxed text-neutral-500 max-w-[260px]"><Tx k="pied.texte" d="Vos tracés GPX, Strava et Komoot, imprimés en posters prêts à encadrer." /></p>
        </div>
        {cols.map(([ck, cd, links]) => (
          <nav key={ck} aria-label={t(ck, cd)}>
            <p className="text-[11.5px] font-semibold uppercase tracking-[0.14em] text-neutral-500"><Tx k={ck} d={cd} /></p>
            <ul className="mt-3.5 space-y-2.5">
              {links.map(([lk, ld, h]) => <li key={lk}><a href={h} {...(/^https?:/.test(h) ? { target: '_blank', rel: 'noopener' } : {})} className="text-[14px] text-neutral-400 hover:text-white transition-colors"><Tx k={lk} d={ld} /></a></li>)}
            </ul>
          </nav>
        ))}
      </div>
      <div className="max-w-[1240px] mx-auto px-5 sm:px-8 py-6 border-t border-white/[0.06] flex flex-wrap items-center justify-between gap-3 text-[12.5px] text-neutral-600">
        <span>© {new Date().getFullYear()} <Tx k="pied.copyright" d="Printrace" /></span>
        {/* Fait en Bretagne : drapeau breton (Gwenn-ha-du) */}
        <span className="inline-flex items-center gap-1.5 text-neutral-500">
          <Tx k="pied.made" d="Made with 🤍 in" />
          <img src={ptRes('siteFlagBzh', 'assets/site/drapeau-breton.webp')} alt="Bretagne" title="Bretagne" width="22" height="16" loading="lazy" className="w-[22px] h-auto" />
        </span>
        <span><Tx k="pied.credit" d="Fonds de carte © contributeurs OpenStreetMap" /></span>
      </div>
    </footer>
  );
}

function PrintraceSite() {
  const [caseId, setCaseId] = useSiteState(SITE_CASES[0].id);
  const [auto, setAuto] = useSiteState(true); // défilement des cas d'usage tant qu'on n'a pas choisi
  const c = SITE_CASES.find((x) => x.id === caseId);
  const stop = () => setAuto(false);
  // Mode édition des textes (administrateur) : « ?edit » dans l'adresse
  const [editing, setEditing] = useSiteState(false);
  useSiteEffect(() => { setEditing(ptEditRequested()); }, []);
  const [customs, setCustoms] = useSiteState({}); // personnalisation par cas d'usage
  const custom = customs[caseId] || {};
  // Photos du cas d'usage (fichiers locaux, Unsplash ou illustration)
  const [photoSet, setPhotoSet] = useSiteState({});
  useSiteEffect(() => {
    if (photoSet[caseId]) return;
    let live = true;
    Promise.all(c.photos.map((_, i) => siteResolvePhoto(c, i))).then((ps) => { if (live) setPhotoSet((m) => ({ ...m, [caseId]: ps })); });
    return () => { live = false; };
  }, [caseId]);
  const photos = photoSet[caseId] || [];
  useSiteEffect(() => {
    let live = true;
    const t = setTimeout(async () => {
      for (const x of SITE_CASES) {
        if (!live) return;
        const ps = await Promise.all(x.photos.map((_, i) => siteResolvePhoto(x, i)));
        await Promise.all(ps.filter(Boolean).map((ph) => siteLoadImg(ph.src).then((im) => im && im.decode && im.decode().catch(() => {}))));
        if (live) setPhotoSet((m) => (m[x.id] ? m : { ...m, [x.id]: ps }));
      }
    }, 1200);
    return () => { live = false; clearTimeout(t); };
  }, []);
  // Tracés importés (affichés sur le poster), finition choisie à l'étape 3
  const [items, setItems] = useSiteState([]);
  const [finish, setFinish] = useSiteState({});
  const [opening, setOpening] = useSiteState('');
  useSiteEffect(() => { if (items.length) stop(); }, [items.length]);

  // Étape active : celle qui passe au milieu de l'écran (grand écran)
  const scroller = useSiteRef(null);
  const stepRefs = [useSiteRef(null), useSiteRef(null), useSiteRef(null)];
  const [step, setStep] = useSiteState(0);
  const [desktop, setDesktop] = useSiteState(false);
  useSiteEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)');
    const on = () => setDesktop(mq.matches);
    on(); mq.addEventListener('change', on);
    const sc = scroller.current;
    let raf = 0;
    const update = () => {
      raf = 0;
      if (jumpTo.current != null) return; // saut vers une étape en cours : pas de clignotement
      const mid = sc.getBoundingClientRect().top + sc.clientHeight / 2;
      let best = 0, dist = Infinity;
      stepRefs.forEach((r, i) => {
        const el = r.current; if (!el) return;
        const b = el.getBoundingClientRect(), d = mid < b.top ? b.top - mid : mid > b.bottom ? mid - b.bottom : 0;
        if (d < dist) { dist = d; best = i; }
      });
      setStep(best);
    };
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(update); };
    sc.addEventListener('scroll', onScroll, { passive: true }); update();
    return () => { mq.removeEventListener('change', on); sc.removeEventListener('scroll', onScroll); cancelAnimationFrame(raf); };
  }, []);
  // Le défilement des cas d'usage se met seulement en pause pendant l'étape 2 (réglages)
  const paused = desktop && step === 1;
  useSiteEffect(() => {
    if (!auto || paused) return;
    const t = setTimeout(() => setCaseId((id) => SITE_CASES[(SITE_CASES.findIndex((x) => x.id === id) + 1) % SITE_CASES.length].id), SITE_ROTATE_MS);
    return () => clearTimeout(t);
  }, [caseId, auto, paused]);
  // Aller à une étape : la progression passe tout de suite sur la cible, puis suit le scroll
  const jumpTo = useSiteRef(null), jumpT = useSiteRef(0);
  // Arrêt d'une étape : position de scroll où son en-tête s'aligne sur le haut du cadre (poster collé)
  const posterRef = useSiteRef(null), railRef = useSiteRef(null);
  const snapFor = (i) => {
    const sc = scroller.current, el = stepRefs[i].current, po = posterRef.current;
    if (!sc || !el || !po) return null;
    const head = el.querySelector('[data-step-head]') || el;
    const stuckTop = sc.getBoundingClientRect().top + (parseFloat(getComputedStyle(po).top) || 0);
    return Math.round(sc.scrollTop + head.getBoundingClientRect().top - stuckTop);
  };
  // Chiffres d'étape (grand écran) : apparition progressive au scroll, pleine seulement
  // quand l'en-tête de l'étape atteint le haut du cadre
  useSiteEffect(() => {
    const sc = scroller.current;
    const nums = () => [...sc.querySelectorAll('[data-step-num]')];
    if (!desktop || !sc) { if (sc) nums().forEach((n) => { n.style.opacity = ''; }); return; }
    let raf = 0;
    let railOn = null;
    const paint = () => {
      raf = 0;
      const po = posterRef.current; if (!po) return;
      // 1) lectures seulement (aucune écriture avant) : pas de recalcul de mise en page forcé
      const y = sc.scrollTop, top = sc.getBoundingClientRect().top + (parseFloat(getComputedStyle(po).top) || 0);
      const s0 = snapFor(0), s2 = snapFor(2), ph = sc.querySelector('[data-hero-photo]');
      const ns = nums(), tops = ns.map((n) => n.getBoundingClientRect().top);
      // 2) écritures
      // Stepper de droite : visible à partir de l'arrêt de l'étape 1 (avec 12 px de marge)
      const rail = railRef.current;
      if (rail && s0 != null) {
        const on = y >= s0 - 12;
        if (on !== railOn) { railOn = on; rail.classList.toggle('opacity-0', !on); rail.classList.toggle('pointer-events-none', !on); rail.classList.toggle('translate-x-2', !on); }
      }
      // Photo de fond : s'estompe progressivement de l'étape 1 (20 %) à l'étape 3 (5 %)
      if (ph && s0 != null && s2 != null && s2 > s0) {
        const k = Math.max(0, Math.min(1, (y - s0) / (s2 - s0)));
        ph.style.opacity = (0.2 - 0.15 * k).toFixed(3);
      }
      ns.forEach((n, i) => {
        const d = Math.abs(tops[i] - top);
        const t = Math.max(0, Math.min(1, 1 - (d - 160) / 460)); // 1 dès 160 px du cadre
        n.style.opacity = (t * t).toFixed(3);
      });
    };
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(paint); };
    sc.addEventListener('scroll', onScroll, { passive: true }); window.addEventListener('resize', onScroll);
    paint();
    return () => { sc.removeEventListener('scroll', onScroll); window.removeEventListener('resize', onScroll); cancelAnimationFrame(raf); };
  }, [desktop]);
  const goTo = (i) => {
    const el = stepRefs[i].current, sc = scroller.current; if (!el || !sc) return;
    setStep(i); jumpTo.current = i; clearTimeout(jumpT.current);
    const r = el.getBoundingClientRect(), snap = desktop ? snapFor(i) : null;
    const top = snap != null ? snap : sc.scrollTop + r.top - sc.getBoundingClientRect().top - Math.max(0, (sc.clientHeight - r.height) / 2);
    sc.scrollTo({ top, behavior: 'smooth' });
    const release = () => { clearTimeout(jumpT.current); jumpT.current = setTimeout(() => { jumpTo.current = null; sc.removeEventListener('scroll', release); }, 160); };
    sc.addEventListener('scroll', release, { passive: true }); release();
  };
  const open = async (kind) => {
    setOpening(kind);
    const src = items.every((x) => x.source === items[0].source) ? items[0].source : undefined;
    try { await siteOpenStudio(items, c, src, { title: custom.title, color: custom.color }); } catch (e) { /* le studio reste joignable */ }
    setOpening('');
  };
  // Mise en avant : étape active nette, les autres estompées (cliquables pour y aller)
  const dim = (i) => (desktop && step !== i ? 'lg:opacity-30 lg:hover:opacity-55 lg:cursor-pointer lg:scale-[0.98]' : 'opacity-100');
  // Chaque étape occupe un écran ; son contenu est centré à hauteur du poster
  const stepBox = 'relative flex flex-col justify-center py-10 lg:min-h-screen lg:py-12 origin-left lg:will-change-[opacity,transform] transition-[opacity,transform] duration-500 ease-out';
  // Mobile : chaque étape remplit l'écran (colonne de gauche), le scroll s'arrête sur chacune
  const mStep = desktop ? undefined : { minHeight: '100svh', scrollSnapAlign: 'start', scrollSnapStop: 'always' };
  // Mobile : poster rogné à droite ; un appui dessus fait glisser la page pour le voir en entier,
  // un appui sur les étapes la ramène
  const [peek, setPeek] = useSiteState(false);
  useSiteEffect(() => { setPeek(false); }, [step, desktop]);
  // Mobile, arrivée sur la page : poster centré sous le titre ; au scroll, il glisse à droite
  // en rétrécissant un peu, et l'étape 1 apparaît à sa gauche, centrée sur le cadre.
  // --m (sur la section) : 1 = poster centré, 0 = poster à droite ; réglé au scroll
  const sectionRef = useSiteRef(null), mIntro = useSiteRef(1);
  useSiteEffect(() => {
    const sc = scroller.current, sec = sectionRef.current;
    if (desktop || !sc || !sec) return;
    let raf = 0;
    const upd = () => {
      raf = 0;
      // Le poster monte d'abord avec la page jusqu'à être collé, entier, au centre de l'écran
      // (arrêt du scroll) ; l'animation ne démarre qu'ensuite, jusqu'à l'arrêt de l'étape 1
      const po = posterRef.current, s0El = stepRefs[0].current;
      if (!po || !s0El) return;
      const y = sc.scrollTop, scTop = sc.getBoundingClientRect().top;
      const hold = sec.offsetTop - (parseFloat(getComputedStyle(po).top) || 0);
      const end = y + s0El.getBoundingClientRect().top - scTop;
      const t = Math.max(0, Math.min(1, (y - hold) / Math.max(1, end - hold)));
      const m = 1 - t * t * (3 - 2 * t); // départ et arrivée en douceur
      mIntro.current = m;
      sec.style.setProperty('--m', m.toFixed(3));
    };
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(upd); };
    sc.addEventListener('scroll', onScroll, { passive: true }); window.addEventListener('resize', onScroll); upd();
    return () => { sc.removeEventListener('scroll', onScroll); window.removeEventListener('resize', onScroll); cancelAnimationFrame(raf); };
  }, [desktop]);
  const stepProps = (i) => ({
    ref: stepRefs[i], 'data-step': i, style: mStep,
    onClickCapture: desktop && step !== i ? (e) => { e.preventDefault(); e.stopPropagation(); goTo(i); }
      : !desktop && peek ? (e) => { e.preventDefault(); e.stopPropagation(); setPeek(false); } : undefined,
  });

  // Grand écran : défilement par sections (scroll-snap natif) — le haut de page, puis chaque
  // étape, dont le chiffre se cale sur le haut du cadre ; une section à la fois
  return (
    <div ref={scroller} className="h-full overflow-y-auto sb-scroll font-site bg-[#0a0a0a] text-white" style={{ scrollSnapType: 'y mandatory' }}>
     <div className="relative isolate min-h-full overflow-x-clip">
      {/* Fond : grille fine qui s'estompe vers le bas et les bords + grain léger contre le banding */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-[560px] -z-10" style={{
        backgroundImage: 'linear-gradient(to right, rgba(255,255,255,0.05) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.05) 1px, transparent 1px)',
        backgroundSize: '32px 32px', backgroundPosition: 'center top',
        // Grille bien visible en haut de page, qui s'estompe sous le titre et disparaît ensuite
        maskImage: 'linear-gradient(to bottom, #000 0, rgba(0,0,0,0.75) 160px, rgba(0,0,0,0.3) 340px, transparent 480px), radial-gradient(75% 100% at 50% 0%, #000 40%, transparent 100%)',
        WebkitMaskImage: 'linear-gradient(to bottom, #000 0, rgba(0,0,0,0.75) 160px, rgba(0,0,0,0.3) 340px, transparent 480px), radial-gradient(75% 100% at 50% 0%, #000 40%, transparent 100%)',
        maskComposite: 'intersect', WebkitMaskComposite: 'source-in' }} />
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-[560px] -z-10 opacity-[0.025]" style={{ backgroundImage: SITE_GRAIN }} />
      <nav className="relative z-20 max-w-[1240px] mx-auto px-5 sm:px-8 h-20 flex items-center justify-between" style={{ scrollSnapAlign: 'start' }}>
        {/* Logo plus petit sur mobile */}
        <a href="./" aria-label="Printrace" className="text-white"><UiPrintraceLogo height={21} className="sm:hidden" /><UiPrintraceLogo height={29} className="hidden sm:inline-block" /></a>
        <div className="flex items-center gap-3">
          <SiteProof />
          <SiteAccountButton />
        </div>
      </nav>

      {/* Titre et description, centrés en haut */}
      <header className="relative z-10 max-w-[1240px] mx-auto px-5 sm:px-8 pt-10 lg:pt-12 pb-10 lg:pb-14 text-center">
        {/* Deux lignes fixes : la hauteur ne bouge pas quand le mot change */}
        <h1 className="font-display font-extrabold tracking-[-0.035em] leading-[1.08] text-[clamp(34px,4.4vw,62px)]">
          <span className="block text-white/90"><Tx k="hero.titre" d="Imprimez votre" /></span>
          <span className="block" onMouseEnter={stop}><SiteUseCasePicker value={caseId} auto={auto} onChange={(id) => { setCaseId(id); stop(); }} onInteract={stop} /></span>
        </h1>
        <p key={c.id} className="ds-fade-up mt-5 text-[17px] sm:text-[18px] leading-relaxed text-neutral-400 max-w-[560px] mx-auto"><Tx k={'cas.' + c.id + '.accroche'} d={c.pitch} /></p>
      </header>

      {/* Étapes à gauche (elles défilent), poster centré sur la page et progression à droite (ils restent à l'écran) */}
      {/* Mobile : étapes sur 60 % de la largeur à gauche, poster collé à droite (rogné par le bord de l'écran) */}
      <section ref={sectionRef} aria-label="Créer votre poster" className="relative max-w-[1440px] mx-auto px-5 sm:px-8 pb-24 lg:pb-0 grid grid-cols-[minmax(0,1fr)] lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] gap-x-8 xl:gap-x-12 gap-y-0"
        style={desktop ? undefined : { '--m': 1, gridTemplateColumns: `calc(${SITE_M_COL} - 20px) ${SITE_M_POSTER_W}`, columnGap: SITE_M_GAP, paddingLeft: 20, paddingRight: 0,
          transform: peek ? `translateX(calc(-1 * (${SITE_M_POSTER_W} + ${SITE_M_COL} + ${SITE_M_GAP} - 100vw + 16px)))` : 'none', transition: 'transform .45s cubic-bezier(.2,.8,.2,1)' }}>
        <div className="min-w-0 lg:w-full lg:max-w-[360px] lg:ml-auto"
          style={desktop ? undefined : { paddingTop: '50svh', opacity: 'max(0, calc(1 - var(--m) * 1.6))', transform: 'translateX(calc(var(--m) * -24px))' }}>
          {/* Arrêt du scroll : poster entier, collé au centre, avant qu'il ne parte à droite
              (repère placé là où le poster atteint sa position collée) */}
          {!desktop && <div aria-hidden="true" className="absolute left-0 w-px h-px pointer-events-none" style={{ top: `calc(-1 * ${SITE_M_POSTER_TOP})`, scrollSnapAlign: 'start' }} />}
          <div {...stepProps(0)} className={`${stepBox} lg:!py-0 lg:!pt-24 ${dim(0)}`} style={desktop ? { minHeight: SITE_POSTER_H } : mStep}>
            <SiteStepHead i={0} accent={c.accent} snap={desktop} />
            <div className="mt-5 lg:mt-9"><SiteImport c={c} items={items} setItems={setItems} opening={opening === 'custom'} onNext={() => open('custom')} /></div>
          </div>
          <div {...stepProps(1)} className={`${stepBox} ${dim(1)}`}>
            <SiteStepHead i={1} accent={c.accent} snap={desktop} />
            <div className="mt-5 lg:mt-9"><SiteCustomize c={c} items={items} value={custom} onChange={(v) => { stop(); setCustoms((m) => ({ ...m, [caseId]: v })); }} /></div>
            {/* Le site n'est qu'un aperçu : la personnalisation complète se fait dans l'app */}
            <a href={ptLoginUrl()} className="group mt-4 flex items-start gap-3 rounded-xl px-1 py-1 text-[13px] leading-relaxed text-neutral-500 hover:text-neutral-300 transition-colors">
              <I.Info size={15} className="mt-[3px] shrink-0 text-neutral-600 group-hover:text-neutral-400" />
              <span><Tx k="apercu.texte" d="Ceci n’est qu’un aperçu : modèles, typographies, formats… bien plus d’options sur" /> <span className="font-medium text-neutral-300 group-hover:text-white underline decoration-white/20 underline-offset-[3px] group-hover:decoration-white/60"><Tx k="apercu.lien" d="printrace.app" /></span> <span aria-hidden="true" className="inline-block transition-transform group-hover:translate-x-0.5">→</span></span>
            </a>
          </div>
          <div {...stepProps(2)} className={`${stepBox} lg:mb-[40vh] ${dim(2)}`}>
            <SiteStepHead i={2} accent={c.accent} snap={desktop} />
            <div className="mt-5 lg:mt-9"><SiteFinish c={c} tplId={custom.tpl} value={finish} onChange={setFinish} ready={items.length > 0} opening={opening === 'order'} onOpen={() => (items.length ? open('order') : (location.href = ptLoginUrl()))} /></div>
          </div>
        </div>

        {/* Poster : collé au centre de l'écran pendant que les étapes défilent */}
        <div ref={posterRef} className="sticky self-start col-start-2 row-start-1"
          style={{ top: desktop ? SITE_POSTER_TOP : SITE_M_POSTER_TOP, willChange: 'transform', transform: 'translateZ(0)' }}>
          <div className={`relative mx-auto lg:max-w-none ${desktop ? '' : 'cursor-pointer'}`}
            style={desktop ? { width: SITE_POSTER_W } : { width: SITE_M_POSTER_W, transformOrigin: 'top center', willChange: 'transform',
              // Arrivée : centré sur l'écran et un peu plus grand ; --m passe à 0 au scroll
              transform: `translateX(calc((-16vw - ${SITE_M_POSTER_W} / 2) * var(--m))) scale(calc(1 + 0.14 * var(--m)))` }}
            onClick={desktop ? undefined : () => { if (mIntro.current < 0.1) setPeek((v) => !v); }}>
            {/* Mobile : pastille qui indique qu'on peut faire glisser vers le poster (et revenir) */}
            {!desktop && (
              <span aria-hidden="true" className="absolute -left-4 top-1/2 -translate-y-1/2 z-30 w-8 h-8 rounded-full grid place-items-center bg-[#1a1a1a]/90 ring-1 ring-white/20 text-white shadow-lg backdrop-blur transition-transform duration-300" style={{ transform: `translateY(-50%) rotate(${peek ? 180 : 0}deg)`, opacity: 'max(0, calc(1 - var(--m) * 3))' }}>
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 6-6 6 6 6" /></svg>
              </span>
            )}
            {/* Photo du trip fondue dans le fond, décalée à droite du cadre */}
            {/* Une couche par cas d'usage : la photo du cas affiché apparaît en fondu, l'ancienne
                disparaît en fondu. L'ensemble devient plus discret au fil des étapes 2 et 3
                (opacité du conteneur réglée au scroll). */}
            <div aria-hidden="true" data-hero-photo className="pointer-events-none absolute left-[5%] -right-[92%] -top-[22%] -bottom-[16%] opacity-[0.2]" style={{ willChange: 'opacity',
              maskImage: 'radial-gradient(closest-side, #000 15%, rgba(0,0,0,0.45) 50%, rgba(0,0,0,0.12) 75%, transparent 92%)', WebkitMaskImage: 'radial-gradient(closest-side, #000 15%, rgba(0,0,0,0.45) 50%, rgba(0,0,0,0.12) 75%, transparent 92%)' }}>
              {SITE_CASES.map((x) => {
                const ph = x.heroBg != null && (photoSet[x.id] || [])[x.heroBg];
                return ph && (
                  <img key={x.id} src={ph.src} alt="" decoding="async" fetchpriority="low"
                    className={`absolute inset-0 w-full h-full object-cover saturate-[0.8] transition-opacity duration-700 ease-out ${x.id === caseId ? 'opacity-100' : 'opacity-0'}`} style={{ willChange: 'opacity' }} />
                );
              })}
            </div>
            <SitePoster c={c} photos={photoSet[caseId] || null} custom={custom} items={items} finish={finish} compact={!desktop} />
          </div>
        </div>

        {/* Progression : à droite, à mi-hauteur du poster ; n'apparaît qu'une fois l'étape 1 calée sur le cadre */}
        <div ref={railRef} className="hidden lg:flex lg:col-start-3 lg:row-start-1 lg:self-start lg:sticky items-center relative z-10 opacity-0 pointer-events-none translate-x-2 transition-[opacity,transform] duration-500 ease-out" style={{ top: SITE_POSTER_TOP, height: SITE_POSTER_H }}>
          <SiteStepRail step={step} onGo={goTo} />
        </div>
      </section>

      <SiteInstaWall snap />
      <SiteFooter snap />
     </div>
     {editing && <SiteEditor caseId={caseId} onCase={(id) => { setCaseId(id); stop(); }} onStart={stop} />}
    </div>
  );
}

// Page pré-rendue au build (HTML déjà là) : React s'y raccroche sans tout redessiner
const siteRootEl = document.getElementById('root');
if (siteRootEl.firstElementChild) ReactDOM.hydrateRoot(siteRootEl, <PrintraceSite />);
else ReactDOM.createRoot(siteRootEl).render(<PrintraceSite />);
