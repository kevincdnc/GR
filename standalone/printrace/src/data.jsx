// Données et utilitaires partagés (repris de Routdoor) : couleurs de tracés,
// estimation de durée, détection mobile.

// Tailwind palette references (sky/rose/emerald/amber/violet/teal/orange/pink/indigo)
const ROUTE_COLORS = {
  rose:    { name: 'Rose',       hex: '#f43f5e' },
  orange:  { name: 'Orange',     hex: '#f97316' },
  amber:   { name: 'Ambre',      hex: '#f59e0b' },
  lime:    { name: 'Lime',       hex: '#84cc16' },
  emerald: { name: 'Émeraude',   hex: '#10b981' },
  teal:    { name: 'Sarcelle',   hex: '#14b8a6' },
  sky:     { name: 'Ciel',       hex: '#0ea5e9' },
  blue:    { name: 'Bleu',       hex: '#3b82f6' },
  indigo:  { name: 'Indigo',     hex: '#6366f1' },
  violet:  { name: 'Violet',     hex: '#8b5cf6' },
  pink:    { name: 'Rose pâle',  hex: '#ec4899' },
  fuchsia: { name: 'Fuchsia',    hex: '#d946ef' },
};

// Ordre des couleurs attribuées aux tracés importés (nom historique, partagé avec Routdoor)
const GR34_SECTION_COLORS = ['rose', 'sky', 'amber', 'emerald', 'violet', 'orange', 'teal', 'pink', 'indigo', 'lime', 'blue', 'fuchsia'];

// Estimated moving time, based on an average pace per activity plus a climbing
// penalty (Naismith-style: ~+1 min per 10 m of ascent). Returns minutes.
const ACTIVITY_SPEED = {
  running: 9.5, trail: 7.5, hiking: 4.2, walking: 4.5,
  roadBike: 22, cycling: 22, gravel: 16, mtb: 12, moto: 55,
  skiTouring: 4, skiNordic: 10, snowshoe: 3.5,
  default: 6,
};
function estimateDurationMin(distanceKm, ascentM, activity) {
  const speed = ACTIVITY_SPEED[activity] || ACTIVITY_SPEED.default;
  const flatMin = (distanceKm / speed) * 60;
  const climbMin = (ascentM || 0) / 10;
  return Math.max(0, Math.round(flatMin + climbMin));
}

// Mobile : écran étroit (< 768 px). La version bureau reste inchangée au-delà.
const MOBILE_QUERY = '(max-width: 767px)';
function isMobileNow() {
  try { return window.matchMedia(MOBILE_QUERY).matches; } catch (e) { return false; }
}
function useIsMobile() {
  const [m, setM] = React.useState(isMobileNow);
  React.useEffect(() => {
    let mq;
    try { mq = window.matchMedia(MOBILE_QUERY); } catch (e) { return; }
    const on = () => setM(mq.matches);
    if (mq.addEventListener) mq.addEventListener('change', on); else mq.addListener(on);
    return () => { if (mq.removeEventListener) mq.removeEventListener('change', on); else mq.removeListener(on); };
  }, []);
  return m;
}

Object.assign(window, { ROUTE_COLORS, GR34_SECTION_COLORS, estimateDurationMin, isMobileNow, useIsMobile });
