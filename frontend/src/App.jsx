import { lazy, Suspense, useEffect } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useParams } from 'react-router-dom'
import Navbar from './components/Navbar'
import FlipperDashboard from './components/FlipperDashboard'

const routeLoaders = {
  auction: () => import('./components/AuctionHouse'),
  market: () => import('./components/MarketBrowser'),
  item: () => import('./components/ItemDetail'),
  shops: () => import('./components/ShopsPage'),
  shop: () => import('./components/ShopChanges'),
}

const AuctionHouse = lazy(routeLoaders.auction)
const MarketBrowser = lazy(routeLoaders.market)
const ItemDetail = lazy(routeLoaders.item)
const ShopsPage = lazy(routeLoaders.shops)
const ShopChanges = lazy(routeLoaders.shop)

function LegacyItemRedirect() {
  const { vnum } = useParams()
  return <Navigate to={`/items/${vnum}`} replace />
}

export default function App() {
  useEffect(() => {
    const preload = () => Object.values(routeLoaders).forEach((load) => load())
    if ('requestIdleCallback' in window) {
      const id = window.requestIdleCallback(preload, { timeout: 1000 })
      return () => window.cancelIdleCallback(id)
    }
    const id = window.setTimeout(preload, 0)
    return () => window.clearTimeout(id)
  }, [])

  return (
    <BrowserRouter basename={import.meta.env.BASE_URL.replace(/\/$/, '')}>
      <div className="min-h-[100dvh] bg-[#09090b] text-zinc-100 lg:grid lg:grid-cols-[248px_minmax(0,1fr)]">
        <Navbar />
        <main className="min-w-0 px-4 pb-12 pt-20 sm:px-6 lg:px-8 lg:pt-8">
          <div className="mx-auto w-full max-w-[1600px]">
            <Suspense fallback={<div className="p-10 text-center text-sm text-zinc-500">Ładuję widok…</div>}>
              <Routes>
                <Route path="/" element={<FlipperDashboard />} />
                <Route path="/market" element={<AuctionHouse />} />
                <Route path="/items" element={<MarketBrowser />} />
                <Route path="/items/:vnum" element={<ItemDetail />} />
                <Route path="/item/:vnum" element={<LegacyItemRedirect />} />
                <Route path="/shops" element={<ShopsPage />} />
                <Route path="/shops/:merchantId" element={<ShopChanges />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </Suspense>
          </div>
        </main>
      </div>
    </BrowserRouter>
  )
}
