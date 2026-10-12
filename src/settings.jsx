// Settings — split into two surfaces:
//   <SettingsPanel>  — left sidebar: header + tab navigation
//   <SettingsContent> — main area: full-bleed content for the active tab,
//                       takes the place of the map (no map while in settings).

const { useState: useSettingsState } = React;
const SettingsTooltip = window.Tooltip;

const SETTINGS_TABS = [
  { id: 'account',      label: 'Compte',         icon: 'User' },
  { id: 'org',          label: 'Organisation',   icon: 'Building' },
  { id: 'subscription', label: 'Abonnement',     icon: 'CreditCard' },
  { id: 'api',          label: 'Clés API',       icon: 'Key' },
  { id: 'security',     label: 'Sécurité',       icon: 'Shield' },
];

function SettingsPanel({ onClose, dark, accent, tab, onTabChange }) {
  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 pt-5 pb-3 flex items-center justify-between">
        <div className="flex items-center gap-2.5 min-w-0">
          <button
            onClick={onClose}
            className={`-ml-1.5 p-1.5 rounded-md transition-colors ${dark ? 'text-neutral-400 hover:text-white hover:bg-neutral-800' : 'text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100'}`}
            title="Fermer"
          >
            <I.ChevronLeft size={18} />
          </button>
          <div className="min-w-0">
            <div className={`font-semibold text-[15px] tracking-tight ${dark ? 'text-white' : 'text-neutral-900'}`}>Paramètres</div>
            <div className={`text-[11px] ${dark ? 'text-neutral-500' : 'text-neutral-500'}`}>Compte · Organisation · API</div>
          </div>
        </div>
        <button
          onClick={onClose}
          className={`p-1.5 rounded-md transition-colors ${dark ? 'text-neutral-500 hover:text-neutral-200 hover:bg-neutral-800' : 'text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100'}`}
        >
          <I.X size={16} />
        </button>
      </div>

      {/* Tab nav */}
      <div className="px-2 pb-2 flex-1 overflow-y-auto sb-scroll">
        {SETTINGS_TABS.map((t) => {
          const Icon = I[t.icon] || I.Settings;
          const sel = tab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => onTabChange(t.id)}
              className={`group w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md text-left text-[13px] transition-colors mb-0.5 ${sel ? (dark ? 'bg-neutral-800 text-white' : 'bg-neutral-100 text-neutral-900') : (dark ? 'text-neutral-300 hover:bg-neutral-800/60' : 'text-neutral-700 hover:bg-neutral-100/60')}`}
            >
              <span
                className="w-6 h-6 rounded grid place-items-center shrink-0"
                style={{
                  background: sel ? accent + '22' : (dark ? '#171717' : '#f5f5f5'),
                  color: sel ? accent : (dark ? '#a3a3a3' : '#737373'),
                }}
              >
                <Icon size={13} />
              </span>
              <span className={`flex-1 ${sel ? 'font-medium' : ''}`}>{t.label}</span>
              {sel && <I.ChevronRight size={13} className={dark ? 'text-neutral-500' : 'text-neutral-400'} />}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function SettingsContent({ tab, dark, accent }) {
  const current = SETTINGS_TABS.find((t) => t.id === tab) || SETTINGS_TABS[0];
  return (
    <div className="flex flex-col h-full glass-backdrop">
      {/* Top bar — tab title */}
      <div className={`px-8 pt-7 pb-5 border-b ${dark ? 'border-neutral-800' : 'border-neutral-200/70'}`}>
        <div className={`text-[11px] font-semibold uppercase tracking-wider ${dark ? 'text-neutral-500' : 'text-neutral-500'}`}>Paramètres</div>
        <h1 className={`mt-0.5 text-[22px] font-semibold tracking-tight ${dark ? 'text-white' : 'text-neutral-900'}`}>{current.label}</h1>
      </div>

      {/* Scrollable content area, max width for readability */}
      <div className="flex-1 overflow-y-auto sb-scroll">
        <div className="max-w-2xl mx-auto px-8 py-8">
          {tab === 'account' && <AccountTab dark={dark} accent={accent} />}
          {tab === 'org' && <OrgTab dark={dark} accent={accent} />}
          {tab === 'subscription' && <SubscriptionTab dark={dark} accent={accent} />}
          {tab === 'api' && <ApiTab dark={dark} accent={accent} />}
          {tab === 'security' && <SecurityTab dark={dark} accent={accent} />}
        </div>
      </div>
    </div>
  );
}

function SectionTitle({ children, dark, sub }) {
  return (
    <div className="mb-3">
      <h3 className={`text-[12px] font-semibold uppercase tracking-wider ${dark ? 'text-neutral-500' : 'text-neutral-500'}`}>{children}</h3>
      {sub && <p className={`text-[11.5px] mt-1 ${dark ? 'text-neutral-400' : 'text-neutral-500'}`}>{sub}</p>}
    </div>
  );
}

function Row({ label, value, dark, sub }) {
  return (
    <div className={`flex items-start justify-between gap-3 py-2.5 border-b last:border-b-0 ${dark ? 'border-neutral-800' : 'border-neutral-200/70'}`}>
      <div className="min-w-0">
        <div className={`text-[12.5px] font-medium ${dark ? 'text-neutral-200' : 'text-neutral-800'}`}>{label}</div>
        {sub && <div className={`text-[11px] mt-0.5 ${dark ? 'text-neutral-500' : 'text-neutral-500'}`}>{sub}</div>}
      </div>
      <div className={`text-[12.5px] ${dark ? 'text-neutral-400' : 'text-neutral-600'}`}>{value}</div>
    </div>
  );
}

function PanelCard({ children, dark }) {
  return (
    <div className={`rounded-md border ${dark ? 'bg-neutral-900/40 border-neutral-800' : 'bg-white border-neutral-200/80'} px-3 py-2 mb-4`}>
      {children}
    </div>
  );
}

function AccountTab({ dark, accent }) {
  const [language, setLanguage] = useSettingsState('fr');
  const [units, setUnits] = useSettingsState('metric');
  const [dateFormat, setDateFormat] = useSettingsState('dmy');

  return (
    <>
      <SectionTitle dark={dark}>Profil</SectionTitle>
      <PanelCard dark={dark}>
        <div className="flex items-center gap-3 py-1.5">
          <div className={`w-10 h-10 rounded-full grid place-items-center text-[13px] font-semibold ${dark ? 'bg-neutral-800 text-neutral-200' : 'bg-neutral-200 text-neutral-700'}`}>VR</div>
          <div className="flex-1 min-w-0">
            <div className={`text-[13px] font-medium ${dark ? 'text-white' : 'text-neutral-900'}`}>Vincent R.</div>
            <div className={`text-[11.5px] ${dark ? 'text-neutral-500' : 'text-neutral-500'}`}>vous@exemple.fr</div>
          </div>
          <button className={`text-[11.5px] font-medium px-2 py-1 rounded transition-colors ${dark ? 'text-neutral-300 hover:bg-neutral-800' : 'text-neutral-700 hover:bg-neutral-100'}`}>Modifier</button>
        </div>
      </PanelCard>

      <SectionTitle dark={dark}>Préférences</SectionTitle>
      <PanelCard dark={dark}>
        <PrefRow dark={dark} label="Langue">
          <PrefDropdown
            dark={dark}
            accent={accent}
            value={language}
            onChange={setLanguage}
            options={LANGUAGE_OPTIONS}
          />
        </PrefRow>
        <PrefRow dark={dark} label="Unités">
          <PrefDropdown
            dark={dark}
            accent={accent}
            value={units}
            onChange={setUnits}
            options={UNIT_OPTIONS}
          />
        </PrefRow>
        <PrefRow dark={dark} label="Format de date">
          <PrefDropdown
            dark={dark}
            accent={accent}
            value={dateFormat}
            onChange={setDateFormat}
            options={DATE_FORMAT_OPTIONS}
          />
        </PrefRow>
      </PanelCard>

      <button className={`w-full text-[12.5px] font-medium rounded-md px-3 py-2 transition-colors ${dark ? 'text-rose-400 hover:bg-rose-500/10' : 'text-rose-600 hover:bg-rose-50'}`}>
        Se déconnecter
      </button>
    </>);

}

const LANGUAGE_OPTIONS = [
  { value: 'fr', label: 'Français',  flag: '🇫🇷' },
  { value: 'en', label: 'English',   flag: '🇬🇧' },
  { value: 'es', label: 'Español',   flag: '🇪🇸' },
  { value: 'de', label: 'Deutsch',   flag: '🇩🇪' },
  { value: 'it', label: 'Italiano',  flag: '🇮🇹' },
  { value: 'pt', label: 'Português', flag: '🇵🇹' },
];

const UNIT_OPTIONS = [
  { value: 'metric',   label: 'Kilomètres · mètres' },
  { value: 'imperial', label: 'Miles · pieds' },
];

const DATE_FORMAT_OPTIONS = [
  { value: 'dmy',  label: 'DD/MM/YYYY' },
  { value: 'mdy',  label: 'MM/DD/YYYY' },
  { value: 'ymd',  label: 'YYYY-MM-DD' },
  { value: 'long', label: '14 mai 2026' },
];

function PrefRow({ label, children, dark }) {
  return (
    <div className={`flex items-center justify-between gap-3 py-2 border-b last:border-b-0 ${dark ? 'border-neutral-800' : 'border-neutral-200/70'}`}>
      <div className={`text-[12.5px] font-medium shrink-0 ${dark ? 'text-neutral-200' : 'text-neutral-800'}`}>{label}</div>
      <div className="min-w-0 flex-1 flex justify-end">{children}</div>
    </div>
  );
}

function PrefDropdown({ value, onChange, options, dark, accent }) {
  const [open, setOpen] = useSettingsState(false);
  const ref = React.useRef(null);

  React.useEffect(() => {
    if (!open) return;
    const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const cur = options.find((o) => o.value === value) || options[0];

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className={`group flex items-center gap-1.5 rounded-md px-2 py-1 text-[12.5px] transition-colors ${dark ? 'text-neutral-300 hover:bg-neutral-800' : 'text-neutral-700 hover:bg-neutral-100'} ${open ? (dark ? 'bg-neutral-800' : 'bg-neutral-100') : ''}`}
      >
        {cur.flag && <span className="text-[14px] leading-none">{cur.flag}</span>}
        <span>{cur.label}</span>
        <I.ChevronDown size={12} className={`transition-transform ${open ? 'rotate-180' : ''} ${dark ? 'text-neutral-500' : 'text-neutral-400'}`} />
      </button>
      {open && (
        <div
          role="listbox"
          className={`absolute right-0 top-full mt-1 z-30 min-w-[180px] rounded-md shadow-2xl overflow-hidden animate-menu ${dark ? 'bg-neutral-900 border border-neutral-800' : 'bg-white border border-neutral-200'}`}
        >
          {options.map((o) => {
            const sel = o.value === value;
            return (
              <button
                key={o.value}
                role="option"
                aria-selected={sel}
                onClick={() => { onChange(o.value); setOpen(false); }}
                className={`w-full flex items-center gap-2 px-2.5 py-1.5 text-left text-[12.5px] transition-colors ${sel ? (dark ? 'bg-neutral-800/80' : 'bg-neutral-50') : (dark ? 'hover:bg-neutral-800' : 'hover:bg-neutral-50')}`}
              >
                {o.flag && <span className="text-[14px] leading-none">{o.flag}</span>}
                <span className={`flex-1 ${sel ? 'font-medium' : ''} ${dark ? 'text-neutral-100' : 'text-neutral-800'}`}>{o.label}</span>
                {sel && <I.Check size={12} style={{ color: accent }} strokeWidth="2.6" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function OrgTab({ dark, accent }) {
  return (
    <>
      <SectionTitle dark={dark}>Organisation active</SectionTitle>
      <PanelCard dark={dark}>
        <div className="flex items-center gap-3 py-1.5">
          <div
            className="w-10 h-10 rounded-md grid place-items-center"
            style={{ background: accent + '22', color: accent }}
          >
            <I.Building size={18} />
          </div>
          <div className="flex-1 min-w-0">
            <div className={`text-[13px] font-medium ${dark ? 'text-white' : 'text-neutral-900'}`}>Test – Kévin</div>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span
                className="text-[9.5px] font-semibold uppercase tracking-wider px-1.5 py-px rounded"
                style={{ background: accent + '22', color: accent }}
              >Admin</span>
              <span className={`text-[11px] ${dark ? 'text-neutral-500' : 'text-neutral-500'}`}>2 membres</span>
            </div>
          </div>
        </div>
      </PanelCard>

      <SectionTitle dark={dark}>Membres</SectionTitle>
      <PanelCard dark={dark}>
        <MemberRow dark={dark} name="ami@exemple.fr" role="Owner" />
        <MemberRow dark={dark} name="kevin.cdnc@gmail.com" role="Admin" />
      </PanelCard>

      <button
        className={`btn-cta-primary w-full flex items-center justify-center gap-1.5 text-[12.5px] font-medium rounded-md px-3 py-2 transition-colors text-white`}
        style={{ background: accent }}
      >
        <I.Plus size={13} strokeWidth="2.4" /> Inviter un membre
      </button>
    </>
  );
}

function MemberRow({ dark, name, role }) {
  return (
    <div className={`flex items-center justify-between py-2 border-b last:border-b-0 ${dark ? 'border-neutral-800' : 'border-neutral-200/70'}`}>
      <div className="flex items-center gap-2 min-w-0">
        <div className={`w-6 h-6 rounded-full grid place-items-center text-[10px] font-semibold shrink-0 ${dark ? 'bg-neutral-800 text-neutral-300' : 'bg-neutral-200 text-neutral-600'}`}>
          {name[0].toUpperCase()}
        </div>
        <span className={`text-[12.5px] truncate ${dark ? 'text-neutral-200' : 'text-neutral-800'}`}>{name}</span>
      </div>
      <div className="flex items-center gap-1.5">
        <span className={`text-[10px] font-semibold uppercase tracking-wider px-1.5 py-px rounded ${dark ? 'bg-emerald-500/15 text-emerald-400' : 'bg-emerald-100 text-emerald-700'}`}>Actif</span>
        <span className={`text-[11.5px] ${dark ? 'text-neutral-400' : 'text-neutral-500'}`}>{role}</span>
      </div>
    </div>
  );
}

function SubscriptionTab({ dark, accent }) {
  return (
    <>
      <div className={`rounded-md p-3 mb-4 ${dark ? 'bg-emerald-500/10 border border-emerald-500/30' : 'bg-emerald-50 border border-emerald-200'}`}>
        <div className="flex items-center gap-2">
          <I.Check size={14} stroke={dark ? '#34d399' : '#059669'} strokeWidth="2.5" />
          <span className={`text-[12.5px] font-semibold ${dark ? 'text-emerald-400' : 'text-emerald-800'}`}>Pro inclus avec l'organisation</span>
        </div>
        <p className={`text-[11.5px] mt-1.5 leading-relaxed ${dark ? 'text-emerald-300/80' : 'text-emerald-700/90'}`}>
          Vous bénéficiez de Pro automatiquement via votre organisation active.
        </p>
      </div>

      <SectionTitle dark={dark}>Plan actuel</SectionTitle>
      <PanelCard dark={dark}>
        <div className="flex items-center justify-between py-1">
          <div>
            <div className={`text-[10px] font-semibold uppercase tracking-wider ${dark ? 'text-neutral-500' : 'text-neutral-500'}`}>Enterprise</div>
            <div className={`text-[15px] font-semibold mt-0.5 ${dark ? 'text-white' : 'text-neutral-900'}`}>Tailored</div>
          </div>
          <span
            className="text-[9.5px] font-semibold uppercase tracking-wider px-1.5 py-px rounded"
            style={{ background: accent + '22', color: accent }}
          >Current</span>
        </div>
      </PanelCard>

      <SectionTitle dark={dark}>Changer de plan</SectionTitle>
      <PlanCard dark={dark} accent={accent} name="Free" price="0€" desc="Un seul itinéraire" />
      <PlanCard dark={dark} accent={accent} name="Pro" price="9,99€/mois" desc="Itinéraires illimités" highlight coin />
    </>
  );
}

function PlanCard({ dark, accent, name, price, desc, highlight, coin }) {
  return (
    <div className={`rounded-md border px-3 py-2.5 mb-2 ${highlight ? '' : (dark ? 'bg-neutral-900/40 border-neutral-800' : 'bg-white border-neutral-200/80')}`}
      style={highlight ? { borderColor: accent, background: accent + '0d' } : undefined}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          {coin && (
            <img
              src={(window.__resources && window.__resources.proCoin) || "assets/pro-coin.png"}
              alt=""
              width="28"
              height="28"
              draggable="false"
              className="shrink-0"
              style={{ filter: 'drop-shadow(0 2px 5px rgba(37,99,235,0.35))' }}
            />
          )}
          <div>
            <div className={`text-[13px] font-medium ${dark ? 'text-white' : 'text-neutral-900'}`}>{name}</div>
            <div className={`text-[11px] mt-0.5 ${dark ? 'text-neutral-400' : 'text-neutral-500'}`}>{desc}</div>
          </div>
        </div>
        <div className={`text-[12.5px] tabular-nums font-semibold ${dark ? 'text-neutral-200' : 'text-neutral-800'}`}>{price}</div>
      </div>
    </div>
  );
}

function ApiTab({ dark, accent }) {
  return (
    <>
      <SectionTitle dark={dark} sub="Utilisez ces clés pour interroger l'API Trek Studio depuis votre backend.">Clés API</SectionTitle>
      <PanelCard dark={dark}>
        <KeyRow dark={dark} label="Publishable key" value="pk_live_abf3…2c9d" />
        <KeyRow dark={dark} label="Secret key" value="sk_live_•••••••••••" />
      </PanelCard>
      <button
        className={`btn-cta-primary w-full flex items-center justify-center gap-1.5 text-[12.5px] font-medium rounded-md px-3 py-2 transition-colors text-white`}
        style={{ background: accent }}
      >
        <I.Plus size={13} strokeWidth="2.4" /> Créer une nouvelle clé
      </button>
    </>
  );
}

function KeyRow({ dark, label, value }) {
  return (
    <div className={`flex items-center justify-between py-2 border-b last:border-b-0 ${dark ? 'border-neutral-800' : 'border-neutral-200/70'}`}>
      <div className="min-w-0 flex-1">
        <div className={`text-[12px] font-medium ${dark ? 'text-neutral-200' : 'text-neutral-800'}`}>{label}</div>
        <div className={`text-[11px] tabular-nums mt-0.5 truncate ${dark ? 'text-neutral-500' : 'text-neutral-500'}`}>{value}</div>
      </div>
      <button className={`text-[11.5px] font-medium px-2 py-1 rounded transition-colors ${dark ? 'text-neutral-300 hover:bg-neutral-800' : 'text-neutral-700 hover:bg-neutral-100'}`}>Copier</button>
    </div>
  );
}

function SecurityTab({ dark, accent }) {
  return (
    <>
      <SectionTitle dark={dark}>Authentification</SectionTitle>
      <PanelCard dark={dark}>
        <Row dark={dark} label="Mot de passe" value="Modifier" sub="Mis à jour il y a 3 mois" />
        <Row dark={dark} label="Authentification à 2 facteurs" value="Activer" sub="Recommandé" />
      </PanelCard>

      <SectionTitle dark={dark}>Sessions actives</SectionTitle>
      <PanelCard dark={dark}>
        <Row dark={dark} label="Mac · Safari" value="Active" sub="Paris · maintenant" />
        <Row dark={dark} label="iPhone · iOS" value="Il y a 2j" sub="Lyon · 19/04" />
      </PanelCard>
    </>
  );
}

window.SettingsPanel = SettingsPanel;
window.SettingsContent = SettingsContent;
