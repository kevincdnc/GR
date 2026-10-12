import { useEffect, useState } from 'react'
import { useStageMeta } from './data'
import { fmt0, fmt1 } from './lib/format'
import { MapView } from './components/MapView'
import { MetricsView } from './components/MetricsView'

type Tab = 'map' | 'metrics'

function tabFromHash(): Tab {
  return location.hash.replace(/^#\/?/, '') === 'metrics' ? 'metrics' : 'map'
}

export function App() {
  const [tab, setTab] = useState<Tab>(tabFromHash)
  const { stages, update, pace, setPace, exportJson } = useStageMeta()

  useEffect(() => {
    const on = () => setTab(tabFromHash())
    window.addEventListener('hashchange', on)
    return () => window.removeEventListener('hashchange', on)
  }, [])

  const km = stages.reduce((a, s) => a + s.distanceKm, 0)
  const gain = stages.reduce((a, s) => a + s.elevationGain, 0)

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="brand__mark" aria-hidden="true" />
          <div>
            <h1>
              GR34<span className="brand__long"> · Sentier des douaniers</span>
            </h1>
            <p className="brand__sub">
              {stages.length} étape{stages.length > 1 ? 's' : ''} · {fmt1(km)} km · {fmt0(gain)} m D+
            </p>
          </div>
        </div>
        <nav className="tabs" role="tablist">
          <a href="#map" role="tab" aria-selected={tab === 'map'} className={tab === 'map' ? 'is-active' : ''}>
            Carte
          </a>
          <a href="#metrics" role="tab" aria-selected={tab === 'metrics'} className={tab === 'metrics' ? 'is-active' : ''}>
            Metrics
          </a>
        </nav>
      </header>
      <main className={`content content--${tab}`}>
        {tab === 'map' ? (
          <MapView stages={stages} />
        ) : (
          <MetricsView stages={stages} pace={pace} setPace={setPace} update={update} exportJson={exportJson} />
        )}
      </main>
    </div>
  )
}
