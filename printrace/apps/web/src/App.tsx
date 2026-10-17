import type { Activity } from '@printrace/core'
import { createSpec, type PosterSpec } from '@printrace/poster'
import { useEffect, useState } from 'react'
import { DEMO } from './lib/demo.ts'
import { sampleActivity } from './lib/importTrack.ts'
import { Editor } from './editor/Editor.tsx'
import { Landing } from './landing/Landing.tsx'
import { loadDraft, saveDraft } from './lib/persist.ts'
import { OrderPage } from './order/OrderPage.tsx'

export function App() {
  const orderId = window.location.pathname.match(/^\/commande\/([\w-]+)/)?.[1]
  if (orderId) return <OrderPage id={orderId} />
  return <Studio />
}

function Studio() {
  const [draft, setDraft] = useState(loadDraft)

  useEffect(() => {
    const t = setTimeout(() => saveDraft(draft), 400)
    return () => clearTimeout(t)
  }, [draft])

  // la démo s'ouvre directement sur l'éditeur, avec la trace d'exemple
  useEffect(() => {
    if (DEMO && !draft) sampleActivity().then(open)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const open = (activity: Activity) => setDraft({ activity, spec: createSpec(activity, draft?.spec.template) })

  if (!draft) return <Landing onActivity={open} />
  return (
    <Editor
      activity={draft.activity}
      spec={draft.spec}
      onSpec={(spec: PosterSpec) => setDraft({ ...draft, spec })}
      onReset={() => setDraft(null)}
    />
  )
}
