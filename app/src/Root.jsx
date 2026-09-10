import { Suspense, lazy } from 'react'

import App from './App.jsx'

// Two pages, no router. A router would be a dependency and a bundle for one
// branch. If a third page ever appears, that is the moment to add one.
const isAdmin = window.location.pathname.replace(/\/+$/, '') === '/admin'

// The admin panel is split out of the main bundle. Every visitor to the map
// used to download it and almost no visitor is an administrator. Nothing about
// the map itself is deferred, only this.
const Admin = lazy(() => import('./components/Admin.jsx'))

export default function Root() {
  if (!isAdmin) return <App />
  return (
    <Suspense fallback={<div className="app-message">Cargando el panel…</div>}>
      <Admin />
    </Suspense>
  )
}
