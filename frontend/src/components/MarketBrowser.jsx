import { useEffect, useMemo, useState } from 'react'
import { ArrowUpRight, Search } from 'lucide-react'
import { Link, useSearchParams } from 'react-router-dom'
import ItemIcon from './ItemIcon'
import { Badge } from './ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'
import { Input } from './ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table'
import { confidenceTone, dateTime, fmt, getJson, prefetchJson, query } from '../lib/market'

const PAGE_SIZE = 50

export default function MarketBrowser() {
  const [params, setParams] = useSearchParams()
  const [search, setSearch] = useState(params.get('q') || '')
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [minListings, setMinListings] = useState(20)
  const [minConfidence, setMinConfidence] = useState(40)
  const [sort, setSort] = useState('listings')
  const [realm, setRealm] = useState('')
  const [page, setPage] = useState(1)

  useEffect(() => {
    const controller = new AbortController()
    const timer = setTimeout(async () => {
      setLoading(true)
      setError('')
      setParams(search.trim() ? { q: search.trim() } : {}, { replace: true })
      try {
        const data = await getJson(`/api/stats?${query({ q: search.trim(), limit: 1000 })}`, controller.signal)
        setRows(data.rows || [])
      } catch (e) {
        if (e.name !== 'AbortError') setError(e.message)
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }, 250)
    return () => { clearTimeout(timer); controller.abort() }
  }, [search, setParams])

  const visible = useMemo(() => {
    const filtered = rows.filter((row) => row.listings >= minListings && row.confidence >= minConfidence && (!realm || row.realm_key === realm))
    const sorters = {
      listings: (a, b) => b.listings - a.listings,
      liquidity: (a, b) => b.liquidity_score - a.liquidity_score || b.sales_per_day - a.sales_per_day,
      confidence: (a, b) => b.confidence - a.confidence,
      price: (a, b) => b.median_unit_price - a.median_unit_price,
      latest: (a, b) => String(b.last_seen).localeCompare(String(a.last_seen)),
    }
    return filtered.sort(sorters[sort])
  }, [rows, minListings, minConfidence, sort, realm])
  const pageCount = Math.max(1, Math.ceil(visible.length / PAGE_SIZE))
  const pagedRows = visible.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  useEffect(() => setPage(1), [search, minListings, minConfidence, sort, realm])

  const realms = useMemo(() => [...new Map(rows.map((row) => [row.realm_key, row.realm_name])).entries()], [rows])
  const itemHref = (row) => `/items/${row.vnum}?${query({ market_key: row.market_key, realm: row.realm_key })}`
  const warmItem = (row) => prefetchJson(`/api/item?${query({ vnum: row.vnum, market_key: row.market_key, realm: row.realm_key, offer_limit: 50, offer_offset: 0 })}`)

  return (
    <div className="space-y-6">
      <header><p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-400">Baza cen</p><h1 className="mt-2 text-3xl font-semibold tracking-tight">Przedmioty</h1><p className="mt-2 text-sm text-zinc-500">Wyszukaj VNUM, nazwę albo konkretny wariant. Statystyki nie mieszają różnych bonusów i socketów.</p></header>

      <Card className="border-zinc-800/80 bg-zinc-950/60 shadow-none">
        <CardHeader className="border-b border-zinc-800/80 p-5">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <div><CardTitle className="text-base">Katalog rynku</CardTitle><p className="mt-1 text-xs text-zinc-500">{visible.length} wyników z {rows.length} znalezionych wariantów</p></div>
             <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
              <label className="relative sm:col-span-2 lg:w-72"><Search className="absolute left-3 top-2.5 h-4 w-4 text-zinc-600" /><Input className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="np. FMS, Aura, 50300" autoFocus /></label>
               <label className="text-xs text-zinc-500"><span className="sr-only">Minimalna liczba ofert</span><Input type="number" min="1" value={minListings} onChange={(e) => setMinListings(Math.max(1, Number(e.target.value) || 1))} placeholder="Min. ofert" /></label>
               <select className="h-9 rounded-md border border-zinc-800 bg-zinc-950 px-3 text-sm text-zinc-200 outline-none" value={realm} onChange={(e) => setRealm(e.target.value)} aria-label="Królestwo"><option value="">Wszystkie królestwa</option>{realms.map(([key, name]) => <option key={key} value={key}>{name}</option>)}</select>
              <select className="h-9 rounded-md border border-zinc-800 bg-zinc-950 px-3 text-sm text-zinc-200 outline-none" value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Sortowanie"><option value="listings">Najwięcej danych</option><option value="liquidity">Najszybsza rotacja</option><option value="confidence">Największa pewność</option><option value="price">Najwyższa cena</option><option value="latest">Najnowsze</option></select>
            </div>
          </div>
          <label className="mt-3 flex max-w-sm items-center gap-3 text-xs text-zinc-500">Pewność min. {minConfidence}%<input className="accent-emerald-500" type="range" min="0" max="100" step="5" value={minConfidence} onChange={(e) => setMinConfidence(Number(e.target.value))} /></label>
        </CardHeader>
        <CardContent className="p-0">
          {error && <div className="p-5 text-sm text-red-300">Nie udało się pobrać rynku: {error}</div>}
          {loading ? <div className="p-10 text-center text-sm text-zinc-500">Przeliczam historię cen…</div> : visible.length === 0 ? <div className="p-10 text-center text-sm text-zinc-500">Brak przedmiotów spełniających filtry.</div> : (
             <Table><TableHeader><TableRow><TableHead>Przedmiot</TableHead><TableHead>Królestwo</TableHead><TableHead>Próbki</TableHead><TableHead>Sprzedawcy</TableHead><TableHead>P25</TableHead><TableHead>Mediana</TableHead><TableHead>Rozrzut P25–P75</TableHead><TableHead>Rotacja</TableHead><TableHead>Pewność ceny</TableHead><TableHead>Ostatnio</TableHead><TableHead /></TableRow></TableHeader>
              <TableBody>{pagedRows.map((row) => (
                 <TableRow key={`${row.realm_key}-${row.market_key}`}>
                   <TableCell><div className="flex min-w-[230px] items-center gap-3"><ItemIcon src={row.icon_url} name={row.name} /><div className="min-w-0"><Link className="block truncate font-medium hover:text-emerald-400" to={itemHref(row)} onMouseEnter={() => warmItem(row)} onFocus={() => warmItem(row)}>{row.name}{row.variant_key ? ` [${row.variant_label}]` : ''}</Link><span className="text-xs text-zinc-600">VNUM {row.vnum}</span></div></div></TableCell>
                   <TableCell><Badge variant="outline">{row.realm_name}</Badge></TableCell>
                  <TableCell>{fmt(row.listings)}</TableCell><TableCell>{fmt(row.merchants)}</TableCell>
                  <TableCell>{fmt(row.p25_price)}</TableCell><TableCell className="font-medium">{fmt(row.median_unit_price)}</TableCell><TableCell>{fmt(row.p25_price)} – {fmt(row.p75_price)}</TableCell>
                  <TableCell><Badge variant={confidenceTone(row.liquidity_score)}>{row.liquidity_score}%</Badge><span className="mt-1 block text-[11px] text-zinc-600">{row.sales_per_day ? `${row.sales_per_day} / dzień` : 'brak sygnałów'}</span></TableCell>
                  <TableCell><Badge variant={confidenceTone(row.confidence)}>{row.confidence}%</Badge></TableCell><TableCell className="text-xs text-zinc-500">{dateTime(row.last_seen)}</TableCell>
                  <TableCell><Link className="inline-flex rounded-md p-2 text-zinc-500 hover:bg-zinc-900 hover:text-white" to={itemHref(row)} onMouseEnter={() => warmItem(row)} onFocus={() => warmItem(row)}><ArrowUpRight className="h-4 w-4" /></Link></TableCell>
                </TableRow>
              ))}</TableBody>
            </Table>
          )}
          {!loading && visible.length > PAGE_SIZE && <div className="flex items-center justify-between border-t border-zinc-800/80 px-5 py-3 text-xs text-zinc-500"><span>Strona {page} z {pageCount}</span><div className="flex gap-2"><button className="rounded-md border border-zinc-800 px-3 py-1.5 disabled:opacity-30" disabled={page === 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>Poprzednia</button><button className="rounded-md border border-zinc-800 px-3 py-1.5 disabled:opacity-30" disabled={page === pageCount} onClick={() => setPage((value) => Math.min(pageCount, value + 1))}>Następna</button></div></div>}
        </CardContent>
      </Card>
    </div>
  )
}
