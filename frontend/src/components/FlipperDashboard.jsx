import { useEffect, useMemo, useState } from 'react'
import { ArrowUpRight, BadgePercent, ChevronDown, Clock3, RefreshCw, Search, ShieldCheck, Store, TrendingUp, WalletCards } from 'lucide-react'
import { Link } from 'react-router-dom'
import ItemIcon from './ItemIcon'
import { Badge } from './ui/badge'
import { Button } from './ui/button'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'
import { Input } from './ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table'
import { compact, confidenceTone, dateTime, fmt, getJson, query } from '../lib/market'

const initialFilters = { q: '', realm: '', minProfit: 0, minMargin: 20, minConfidence: 55, minListings: 20, minSales: 1, maxBuy: 0, sort: 'score' }
const selectClass = 'h-9 rounded-md border border-zinc-800 bg-zinc-950 px-3 text-sm text-zinc-200 outline-none focus:border-zinc-700'
const itemHref = (deal, realm = deal.realm_key) => `/items/${deal.vnum}?${query({ market_key: deal.market_key, realm })}`

function Metric({ label, value, hint, icon: Icon }) {
  return (
    <Card className="border-zinc-800/80 bg-zinc-950/70 shadow-none">
      <CardContent className="flex items-start justify-between p-5">
        <div><p className="text-xs font-medium text-zinc-500">{label}</p><p className="mt-2 text-2xl font-semibold tracking-tight">{value}</p><p className="mt-1 text-xs text-zinc-600">{hint}</p></div>
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-2.5"><Icon className="h-4 w-4 text-zinc-400" /></div>
      </CardContent>
    </Card>
  )
}

function SortHead({ children, sortKey, activeSort, onSort, className = '' }) {
  const active = activeSort === sortKey
  return (
    <TableHead className={className} aria-sort={active ? 'descending' : 'none'}>
      <button type="button" onClick={() => onSort(sortKey)} className={`inline-flex items-center gap-1 rounded-sm py-1 text-left transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/70 ${active ? 'text-emerald-400' : ''}`} title="Sortuj malejąco">
        {children}<ChevronDown className={`h-3.5 w-3.5 ${active ? 'opacity-100' : 'opacity-30'}`} />
      </button>
    </TableHead>
  )
}

export default function FlipperDashboard() {
  const [filters, setFilters] = useState(initialFilters)
  const [summary, setSummary] = useState(null)
  const [deals, setDeals] = useState([])
  const [crossDeals, setCrossDeals] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    const suffix = refreshKey ? '?fresh=1' : ''
    getJson(`/api/dashboard-summary${suffix}`, controller.signal).then(setSummary).catch((e) => setError(e.message))
    return () => controller.abort()
  }, [refreshKey])

  useEffect(() => {
    const controller = new AbortController()
    const timer = setTimeout(async () => {
      setLoading(true)
      setError('')
      try {
        const params = query({ ...filters, limit: 100 })
        const [local, cross] = await Promise.all([
          getJson(`/api/flipper?${params}`, controller.signal),
          getJson(`/api/flipper-cross?${params}`, controller.signal),
        ])
        setDeals(local.rows || [])
        setCrossDeals(cross.rows || [])
      } catch (e) {
        if (e.name !== 'AbortError') setError(e.message)
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }, 250)
    return () => { clearTimeout(timer); controller.abort() }
  }, [filters, refreshKey])

  const best = deals[0]
  const capital = useMemo(() => deals.slice(0, 10).reduce((sum, row) => sum + Number(row.price || 0), 0), [deals])
  const change = (key, value) => setFilters((current) => ({ ...current, [key]: value }))

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-400">Metin2 · rynek graczy</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">Okazje rynkowe</h1>
           <p className="mt-2 max-w-2xl text-sm text-zinc-500">Ceny i zwykłe flipy są liczone osobno dla każdego królestwa. Drugi ranking pokazuje bezpieczne okazje kupna taniej w jednym i sprzedaży drożej w drugim.</p>
           <div className="mt-3 flex flex-wrap gap-2">{summary?.realms?.map((realm) => <Badge key={realm.key} variant="outline">{realm.name}: {compact(realm.active_listings)} ofert</Badge>)}</div>
        </div>
        <Button variant="outline" onClick={() => setRefreshKey((v) => v + 1)}><RefreshCw />Odśwież dane</Button>
      </header>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <Metric label="Aktywne sklepy" value={compact(summary?.active_merchants)} hint="w ostatnim pełnym skanie" icon={Store} />
        <Metric label="Aktywne oferty" value={compact(summary?.active_listings)} hint={`${compact(summary?.active_market_keys)} wariantów`} icon={WalletCards} />
         <Metric label="Znalezione okazje" value={deals.length + crossDeals.length} hint={`${deals.length} lokalnych · ${crossDeals.length} między królestwami`} icon={BadgePercent} />
        <Metric label="Est. sprzedaż" value={compact(summary?.estimated_sales_30d)} hint={`${compact(summary?.sale_signals_30d)} sygnałów / 30 dni`} icon={TrendingUp} />
        <Metric label="Ostatni skan" value={summary ? dateTime(summary.as_of).split(',')[1]?.trim() || 'Dzisiaj' : '—'} hint={summary ? dateTime(summary.as_of) : 'Ładowanie'} icon={Clock3} />
      </section>

      {best && !loading && (
        <section className="grid overflow-hidden rounded-xl border border-emerald-900/60 bg-[linear-gradient(120deg,rgba(6,78,59,.28),rgba(9,9,11,.95)_60%)] lg:grid-cols-[1fr_auto]">
          <div className="flex min-w-0 items-center gap-4 p-5 sm:p-6">
            <ItemIcon src={best.icon_url} name={best.display_name} size="lg" />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2"><Badge variant="success">Najlepszy wynik {best.opportunity_score}/100</Badge><Badge variant="outline">Pewność ceny {best.confidence}%</Badge><Badge variant="outline">Rotacja {best.liquidity_score}%</Badge></div>
              <h2 className="mt-3 truncate text-xl font-semibold">{best.display_name}</h2>
             <p className="mt-1 text-sm text-zinc-400">{best.realm_name} · kup za {fmt(best.price)} · konserwatywna wycena {fmt(best.reference_price)} / szt.</p>
            </div>
          </div>
          <div className="flex items-center justify-between gap-8 border-t border-emerald-900/40 px-6 py-5 lg:border-l lg:border-t-0">
            <div><p className="text-xs text-zinc-500">Potencjalny zysk</p><p className="mt-1 text-2xl font-semibold text-emerald-400">+{fmt(best.total_profit)}</p></div>
             <Link to={itemHref(best)} className="rounded-md border border-emerald-800 bg-emerald-950/60 p-2.5 text-emerald-300 hover:bg-emerald-900/60" aria-label={`Otwórz ${best.display_name}`}><ArrowUpRight /></Link>
          </div>
        </section>
      )}

      <Card className="border-zinc-800/80 bg-zinc-950/60 shadow-none">
        <CardHeader className="border-b border-zinc-800/80 p-5">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
             <div><CardTitle className="text-base">Flipy w obrębie królestwa</CardTitle><p className="mt-1 text-xs text-zinc-500">Każda wycena P25 korzysta wyłącznie z cen tego samego królestwa. Top 10 wymaga około {fmt(capital)} kapitału.</p></div>
             <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
               <label className="relative sm:col-span-2 xl:w-64"><Search className="absolute left-3 top-2.5 h-4 w-4 text-zinc-600" /><Input className="pl-9" value={filters.q} onChange={(e) => change('q', e.target.value)} placeholder="Nazwa lub VNUM" /></label>
               <select className={selectClass} value={filters.realm} onChange={(e) => change('realm', e.target.value)} aria-label="Królestwo"><option value="">Wszystkie królestwa</option>{summary?.realms?.map((realm) => <option key={realm.key} value={realm.key}>{realm.name}</option>)}</select>
               <select className={selectClass} value={filters.sort} onChange={(e) => change('sort', e.target.value)} aria-label="Sortowanie"><option value="score">Najłatwiejsze</option><option value="liquidity">Najszybsza rotacja</option><option value="profit">Największy zysk</option><option value="profit_item">Zysk na sztuce</option><option value="confidence">Największa pewność ceny</option><option value="margin">Największa marża</option></select>
              <Button variant="ghost" onClick={() => setFilters(initialFilters)}>Wyczyść filtry</Button>
            </div>
          </div>
          <div className="mt-4 grid gap-3 border-t border-zinc-800/60 pt-4 sm:grid-cols-2 lg:grid-cols-6">
            <Filter label="Min. zysk / szt." value={filters.minProfit} onChange={(v) => change('minProfit', v)} />
            <Filter label="Min. marża %" value={filters.minMargin} onChange={(v) => change('minMargin', v)} />
            <Filter label="Min. pewność %" value={filters.minConfidence} onChange={(v) => change('minConfidence', v)} />
            <Filter label="Min. próbek" value={filters.minListings} onChange={(v) => change('minListings', v)} />
            <Filter label="Min. est. sprzedaż" value={filters.minSales} onChange={(v) => change('minSales', v)} />
            <Filter label="Maks. kapitał" value={filters.maxBuy} onChange={(v) => change('maxBuy', v)} />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {error && <div className="border-b border-red-900/40 bg-red-950/30 px-5 py-3 text-sm text-red-300">Nie udało się pobrać danych: {error}</div>}
          {loading ? <div className="p-10 text-center text-sm text-zinc-500">Analizuję aktualny rynek…</div> : deals.length === 0 ? <div className="p-10 text-center text-sm text-zinc-500">Brak okazji dla tych filtrów. Obniż pewność lub minimalną marżę.</div> : (
            <Table>
               <TableHeader><TableRow><TableHead className="w-14">#</TableHead><TableHead>Przedmiot</TableHead><TableHead>Królestwo</TableHead><TableHead>Kupno</TableHead><TableHead>Wycena P25</TableHead><SortHead sortKey="profit_item" activeSort={filters.sort} onSort={(key) => change('sort', key)}>Zysk / szt.</SortHead><SortHead sortKey="profit" activeSort={filters.sort} onSort={(key) => change('sort', key)}>Zysk łącznie</SortHead><SortHead sortKey="liquidity" activeSort={filters.sort} onSort={(key) => change('sort', key)}>Rotacja</SortHead><SortHead sortKey="confidence" activeSort={filters.sort} onSort={(key) => change('sort', key)}>Pewność ceny</SortHead><TableHead>Sklep</TableHead><TableHead /></TableRow></TableHeader>
              <TableBody>{deals.map((deal, index) => (
                 <TableRow key={`${deal.realm_key}-${deal.market_key}-${deal.merchant_id}-${deal.slot}`}>
                  <TableCell className="font-mono text-xs text-zinc-600">{String(index + 1).padStart(2, '0')}</TableCell>
                   <TableCell><div className="flex min-w-[240px] items-center gap-3"><ItemIcon src={deal.icon_url} name={deal.display_name} /><div className="min-w-0"><Link className="block truncate font-medium hover:text-emerald-400" to={itemHref(deal)}>{deal.display_name}</Link><span className="block text-xs text-zinc-600">{deal.count} szt. · VNUM {deal.vnum}</span>{deal.bonuses?.length > 0 && <span className="block max-w-[300px] truncate text-[11px] text-amber-200/70">{deal.bonuses.slice(0, 2).map((bonus) => `${bonus.name} ${Number(bonus.value) > 0 ? '+' : ''}${bonus.value}`).join(' · ')}</span>}</div></div></TableCell>
                   <TableCell><Badge variant="outline">{deal.realm_name}</Badge></TableCell>
                  <TableCell><strong>{fmt(deal.price)}</strong><span className="block text-xs text-zinc-600">{fmt(deal.current_price)} / szt.</span></TableCell>
                  <TableCell>{fmt(deal.reference_price)}<span className="block text-xs text-zinc-600">mediana {fmt(deal.median_price)}</span></TableCell>
                  <TableCell className="text-emerald-400">+{fmt(deal.profit_per_item)}</TableCell>
                  <TableCell><strong className="text-emerald-400">+{fmt(deal.total_profit)}</strong><span className="block text-xs text-emerald-700">{deal.margin_pct}% ROI</span></TableCell>
                  <TableCell><Badge variant={confidenceTone(deal.liquidity_score)}>{deal.liquidity_score}%</Badge><span className="mt-1 block text-[11px] text-zinc-600">{deal.sales_per_day > 0 ? `${deal.sales_per_day} szt./dzień` : 'brak sygnałów'}</span></TableCell>
                  <TableCell><Badge variant={confidenceTone(deal.confidence)}>{deal.confidence}%</Badge><span className="mt-1 block text-[11px] text-zinc-600">{deal.merchants} sprzedawców</span></TableCell>
                  <TableCell><Link to={`/shops/${deal.merchant_id}`} className="block max-w-[170px] truncate text-sm hover:text-emerald-400">{deal.owner_name}</Link><span className="block max-w-[170px] truncate text-xs text-zinc-600">{deal.shop_name}</span></TableCell>
                   <TableCell><Link to={itemHref(deal)} className="inline-flex rounded-md p-2 text-zinc-500 hover:bg-zinc-900 hover:text-white"><ArrowUpRight className="h-4 w-4" /></Link></TableCell>
                </TableRow>
              ))}</TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card className="border-amber-900/40 bg-zinc-950/60 shadow-none">
        <CardHeader className="border-b border-zinc-800/80 p-5">
          <CardTitle className="text-base">Flipy między królestwami</CardTitle>
          <p className="mt-1 text-xs text-zinc-500">Kupno bierze najtańszą aktywną ofertę w jednym królestwie, a sprzedaż konserwatywne P25 drugiego. Zysk uwzględnia 8% podatku i dokładny wariant, bonusy oraz sockety.</p>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? <div className="p-10 text-center text-sm text-zinc-500">Porównuję królestwa…</div> : crossDeals.length === 0 ? <div className="p-10 text-center text-sm text-zinc-500">Brak pewnych okazji między królestwami dla tych filtrów.</div> : (
            <Table>
              <TableHeader><TableRow><TableHead className="w-14">#</TableHead><TableHead>Przedmiot</TableHead><TableHead>Kup w</TableHead><TableHead>Sprzedaj w</TableHead><TableHead>Kupno</TableHead><TableHead>Bezpieczna sprzedaż P25</TableHead><TableHead>Zysk / szt.</TableHead><TableHead>Zysk łącznie</TableHead><TableHead>Pewność trasy</TableHead><TableHead>Sklep źródłowy</TableHead><TableHead /></TableRow></TableHeader>
              <TableBody>{crossDeals.map((deal, index) => (
                <TableRow key={`${deal.buy_realm_key}-${deal.sell_realm_key}-${deal.market_key}-${deal.merchant_id}-${deal.slot}`}>
                  <TableCell className="font-mono text-xs text-zinc-600">{String(index + 1).padStart(2, '0')}</TableCell>
                  <TableCell><div className="flex min-w-[240px] items-center gap-3"><ItemIcon src={deal.icon_url} name={deal.display_name} /><div className="min-w-0"><Link className="block truncate font-medium hover:text-amber-300" to={itemHref(deal, deal.sell_realm_key)}>{deal.display_name}</Link><span className="block text-xs text-zinc-600">{deal.count} szt. · VNUM {deal.vnum}</span></div></div></TableCell>
                  <TableCell><Badge variant="outline">{deal.buy_realm}</Badge></TableCell>
                  <TableCell><Badge variant="warning">{deal.sell_realm}</Badge></TableCell>
                  <TableCell><strong>{fmt(deal.price)}</strong><span className="block text-xs text-zinc-600">{fmt(deal.current_price)} / szt.</span></TableCell>
                  <TableCell>{fmt(deal.reference_price)}<span className="block text-xs text-zinc-600">mediana {fmt(deal.median_price)}</span></TableCell>
                  <TableCell className="text-emerald-400">+{fmt(deal.profit_per_item)}</TableCell>
                  <TableCell><strong className="text-emerald-400">+{fmt(deal.total_profit)}</strong><span className="block text-xs text-emerald-700">{deal.margin_pct}% ROI</span></TableCell>
                  <TableCell><Badge variant={confidenceTone(deal.confidence)}>{deal.confidence}%</Badge><span className="mt-1 block text-[11px] text-zinc-600">rotacja celu {deal.liquidity_score}% · dane {deal.data_age_minutes} min</span></TableCell>
                  <TableCell><Link to={`/shops/${deal.merchant_id}`} className="block max-w-[170px] truncate text-sm hover:text-amber-300">{deal.owner_name}</Link><span className="block max-w-[170px] truncate text-xs text-zinc-600">{deal.shop_name}</span></TableCell>
                  <TableCell><Link to={itemHref(deal, deal.sell_realm_key)} className="inline-flex rounded-md p-2 text-zinc-500 hover:bg-zinc-900 hover:text-white"><ArrowUpRight className="h-4 w-4" /></Link></TableCell>
                </TableRow>
              ))}</TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <div className="flex items-start gap-3 rounded-lg border border-zinc-800/70 bg-zinc-950/40 p-4 text-xs leading-5 text-zinc-500"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-zinc-400" /><p>Pewność ceny mierzy próbki, sprzedawców i rozrzut. Rotacja jest osobnym, konserwatywnym sygnałem: spadek liczby identycznych sztuk ma pełną wagę, a zniknięcie oferty częściową. Usunięcie lub przepakowanie sklepu może wyglądać jak sprzedaż.</p></div>
    </div>
  )
}

function Filter({ label, value, onChange }) {
  return <label className="text-xs text-zinc-500"><span className="mb-1.5 block">{label}</span><Input type="number" min="0" value={value || ''} onChange={(e) => onChange(Math.max(0, Number(e.target.value) || 0))} placeholder="0" /></label>
}
