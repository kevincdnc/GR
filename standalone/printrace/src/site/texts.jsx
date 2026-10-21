// Textes modifiables du site Printrace.
//
// Chaque texte a une clé (« hero.titre », « etape.1.titre »…) et sa valeur par défaut
// dans le code. Les textes modifiés en mode édition sont publiés dans content/site.json
// (seulement ceux qui diffèrent du code), injecté au build dans window.PT_CONTENT.
//
//   const t = useTx();  t('hero.titre', 'Imprimez votre')   -> texte (attributs, calculs)
//   <Tx k="hero.titre" d="Imprimez votre" />                 -> texte cliquable en mode édition
//
// Brouillon (mode édition) : valeur texte = modifiée, null = retour au texte du code.

const PT_TEXT = { pub: window.PT_CONTENT || {}, draft: {}, edit: false, defs: {}, v: 0, subs: new Set() };

function ptTextNotify() { PT_TEXT.v++; PT_TEXT.subs.forEach((f) => f()); }
function ptTextSub(f) { PT_TEXT.subs.add(f); return () => PT_TEXT.subs.delete(f); }

// Valeur affichée : brouillon, sinon texte publié, sinon texte du code
function ptText(k, d) {
  PT_TEXT.defs[k] = d; // inventaire des textes (panneau « Tous les textes »)
  if (Object.prototype.hasOwnProperty.call(PT_TEXT.draft, k)) return PT_TEXT.draft[k] == null ? d : PT_TEXT.draft[k];
  return PT_TEXT.pub[k] != null ? PT_TEXT.pub[k] : d;
}
// Texte publié (sans brouillon) : sert à savoir si une modification change vraiment quelque chose
function ptTextPublished(k) {
  return PT_TEXT.pub[k] != null ? PT_TEXT.pub[k] : PT_TEXT.defs[k];
}

function useTx() {
  React.useSyncExternalStore(ptTextSub, () => PT_TEXT.v, () => 0);
  return ptText;
}

function Tx({ k, d }) {
  const t = useTx();
  const v = t(k, d);
  if (!PT_TEXT.edit) return v;
  const changed = Object.prototype.hasOwnProperty.call(PT_TEXT.draft, k);
  return <span data-tx={k} data-tx-changed={changed ? '' : undefined}>{v}</span>;
}

Object.assign(window, { PT_TEXT, ptText, ptTextPublished, ptTextNotify, useTx, Tx });
