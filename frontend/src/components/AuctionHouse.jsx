import { useEffect, useMemo, useState } from 'react'
import { ArrowDown, ArrowUp, ArrowUpRight, Filter, Plus, RotateCcw, Search, SlidersHorizontal, Trash2 } from 'lucide-react'
import { Link, useSearchParams } from 'react-router-dom'
import ItemIcon from './ItemIcon'
import ItemTooltip from './ItemTooltip'
import { Badge } from './ui/badge'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table'
import { dateTime, fmt, getJson, query } from '../lib/market'

const PAGE_SIZE = 50

function parseStat(value, index) {
  const [key = '', min = '', max = ''] = String(value || '').split('|')
  return { id: `${index}-${key}`, key, min, max }
}

function statValue(stat) {
  return `${stat.key}|${stat.min}|${stat.max}`
}

function buildQuery({ search, category, realm, priceMin, priceMax, sort, statMode, stats, page }) {
  const params = new URLSearchParams()
  if (search.trim()) params.set('q', search.trim())
  if (category) params.set('category', category)
  if (realm) params.set('realm', realm)
  if (priceMin) params.set('price_min', priceMin)
  if (priceMax) params.set('price_max', priceMax)
  if (sort !== 'price_asc') params.set('sort', sort)
  if (statMode !== 'all') params.set('stat_mode', statMode)
  stats.filter((stat) => stat.key).forEach((stat) => params.append('stat', statValue(stat)))
  params.set('limit', PAGE_SIZE)
  params.set('offset', (page - 1) * PAGE_SIZE)
  return params
}

function bonusValueText(bonus) {
  const value = Number(bonus.value || 0)
  return `${bonus.name || `Bonus #${bonus.type}`}${value ? ` ${value > 0 ? '+' : ''}${value}` : ''}`
}

export default function AuctionHouse() {
  const [urlParams, setUrlParams] = useSearchParams()
  const [search, setSearch] = useState(urlParams.get('q') || '')
  const [category, setCategory] = useState(urlParams.get('category') || '')
  const [realm, setRealm] = useState(urlParams.get('realm') || '')
  const [priceMin, setPriceMin] = useState(urlParams.get('price_min') || '')
  const [priceMax, setPriceMax] = useState(urlParams.get('price_max') || '')
  const [sort, setSort] = useState(urlParams.get('sort') || 'price_asc')
  const [statMode, setStatMode] = useState(urlParams.get('stat_mode') || 'all')
  const [stats, setStats] = useState(urlParams.getAll('stat').map(parseStat))
  const [facets, setFacets] = useState({ categories: [], bonuses: [], realms: [], active_offers: 0 })
  const [result, setResult] = useState({ rows: [], total: 0 })
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [hover, setHover] = useState(null)

  useEffect(() => {
    const controller = new AbortController()
    getJson('/api/market-filters', controller.signal).then(setFacets).catch((e) => {
      if (e.name !== 'AbortError') setError(e.message)
    })
    return () => controller.abort()
  }, [])

  const filterSignature = JSON.stringify({ search, category, realm, priceMin, priceMax, sort, statMode, stats: stats.map(statValue) })
  useEffect(() => setPage(1), [filterSignature])

  useEffect(() => {
    const controller = new AbortController()
    const timer = window.setTimeout(async () => {
      const params = buildQuery({ search, category, realm, priceMin, priceMax, sort, statMode, stats, page })
      setUrlParams(params, { replace: true })
      setRefreshing(true)
      setError('')
      try {
        setResult(await getJson(`/api/market-search?${params}`, controller.signal))
      } catch (e) {
        if (e.name !== 'AbortError') setError(e.message)
      } finally {
        if (!controller.signal.aborted) setLoading(false)
        if (!controller.signal.aborted) setRefreshing(false)
      }
    }, 90)
    return () => { window.clearTimeout(timer); controller.abort() }
  }, [search, category, realm, priceMin, priceMax, sort, statMode, stats, page, setUrlParams])

  const bonusByKey = useMemo(() => new Map(facets.bonuses.map((bonus) => [bonus.key, bonus])), [facets.bonuses])
  const pageCount = Math.max(1, Math.ceil(result.total / PAGE_SIZE))
  const activeFilters = [
    category && facets.categories.find((value) => value.key === category)?.label,
    realm && facets.realms.find((value) => value.key === realm)?.label,
    priceMin && `Cena od ${fmt(priceMin)}`,
    priceMax && `Cena do ${fmt(priceMax)}`,
    ...stats.filter((stat) => stat.key).map((stat) => bonusByKey.get(stat.key)?.label || stat.key),
  ].filter(Boolean)

  const addStat = () => setStats((current) => [...current, { id: `${Date.now()}-${current.length}`, key: '', min: '', max: '' }])
  const updateStat = (id, patch) => setStats((current) => current.map((stat) => stat.id === id ? { ...stat, ...patch } : stat))
  const removeStat = (id) => setStats((current) => current.filter((stat) => stat.id !== id))
  const reset = () => {
    setSearch(''); setCategory(''); setRealm(''); setPriceMin(''); setPriceMax('')
    setSort('price_asc'); setStatMode('all'); setStats([]); setPage(1)
  }
  const togglePriceSort = () => setSort((value) => value === 'price_asc' ? 'price_desc' : 'price_asc')
  const showTooltip = (item, event) => setHover({ item, point: { x: event.clientX, y: event.clientY } })

  return (
    <div className="space-y-5">
      <ItemTooltip item={hover?.item} point={hover?.point} />
      <header className="flex flex-col gap-3 border-b border-zinc-800/80 pb-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#c9a86a]">Aktualne oferty</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">Dom aukcyjny</h1>
          <p className="mt-2 max-w-2xl text-sm text-zinc-500">Filtruj konkretne wystawione przedmioty po kategorii, cenie i dowolnej kombinacji bonusów.</p>
        </div>
        <div className="flex items-center gap-2 text-xs text-zinc-500"><span className="h-2 w-2 rounded-full bg-emerald-400" />{fmt(facets.active_offers)} ofert w aktualnym skanie</div>
      </header>

      <section className="overflow-hidden border border-[#4a4031] bg-[#0e0d0b] shadow-[inset_0_1px_0_rgba(214,182,111,.08)]">
        <div className="grid border-b border-[#3d352a] lg:grid-cols-[minmax(300px,1fr)_230px_220px]">
          <label className="relative border-b border-[#3d352a] lg:border-b-0 lg:border-r">
            <Search className="pointer-events-none absolute left-4 top-3.5 h-4 w-4 text-[#8b7858]" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Szukaj przedmiotu, VNUM albo wariantu..." className="h-11 w-full bg-[#171715] pl-11 pr-4 text-sm text-zinc-100 outline-none placeholder:text-zinc-600 focus:bg-[#1b1a17]" autoFocus />
          </label>
          <select value={realm} onChange={(e) => setRealm(e.target.value)} className="h-11 border-b border-[#3d352a] bg-[#171715] px-4 text-xs font-semibold uppercase tracking-wider text-zinc-300 outline-none lg:border-b-0 lg:border-r" aria-label="Królestwo">
            <option value="">Wszystkie królestwa</option>
            {facets.realms.map((value) => <option key={value.key} value={value.key}>{value.label} ({value.count})</option>)}
          </select>
          <select value={sort} onChange={(e) => setSort(e.target.value)} className="h-11 bg-[#171715] px-4 text-xs font-semibold uppercase tracking-wider text-zinc-300 outline-none" aria-label="Sortowanie">
            <option value="price_asc">Najniższa cena</option><option value="price_desc">Najwyższa cena</option><option value="bonus_desc">Najwyższy bonus</option><option value="latest">Najnowsze</option><option value="name">Nazwa A–Z</option>
          </select>
        </div>

        <div className="grid lg:grid-cols-2">
          <div className="border-b border-[#3d352a] p-4 lg:border-b-0 lg:border-r">
            <div className="mb-3 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.16em] text-[#c9a86a]"><Filter className="h-3.5 w-3.5" />Typ przedmiotu</div>
            <div className="grid gap-2 sm:grid-cols-3">
              <label className="sm:col-span-3"><span className="mb-1 block text-[11px] text-zinc-600">Kategoria</span><select value={category} onChange={(e) => setCategory(e.target.value)} className="h-9 w-full border border-[#3d352a] bg-[#171715] px-3 text-sm text-zinc-200 outline-none focus:border-[#8b7858]"><option value="">Dowolna kategoria</option>{facets.categories.map((value) => <option key={value.key} value={value.key}>{value.label} ({value.count})</option>)}</select></label>
              <label><span className="mb-1 block text-[11px] text-zinc-600">Cena / szt. od</span><Input type="number" min="0" value={priceMin} onChange={(e) => setPriceMin(e.target.value)} placeholder="0" /></label>
              <label><span className="mb-1 block text-[11px] text-zinc-600">Cena / szt. do</span><Input type="number" min="0" value={priceMax} onChange={(e) => setPriceMax(e.target.value)} placeholder="bez limitu" /></label>
              <div className="flex items-end"><Button variant="ghost" className="w-full text-zinc-500" onClick={reset}><RotateCcw />Wyczyść</Button></div>
            </div>
          </div>

          <div className="p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.16em] text-[#c9a86a]"><SlidersHorizontal className="h-3.5 w-3.5" />Bonusy</div>
              {stats.length > 1 && <select value={statMode} onChange={(e) => setStatMode(e.target.value)} className="h-7 border border-[#3d352a] bg-[#171715] px-2 text-[11px] text-zinc-400"><option value="all">Wszystkie warunki (AND)</option><option value="any">Dowolny warunek (OR)</option></select>}
            </div>
            <div className="space-y-2">
              {stats.map((stat) => <div key={stat.id} className="grid grid-cols-[minmax(0,1fr)_80px_80px_34px] gap-2">
                <select value={stat.key} onChange={(e) => updateStat(stat.id, { key: e.target.value })} className="h-9 min-w-0 border border-[#3d352a] bg-[#171715] px-3 text-sm text-zinc-200 outline-none focus:border-[#8b7858]" aria-label="Bonus"><option value="">Wybierz bonus...</option>{facets.bonuses.map((bonus) => <option key={bonus.key} value={bonus.key}>{bonus.label} ({bonus.count})</option>)}</select>
                <Input type="number" value={stat.min} onChange={(e) => updateStat(stat.id, { min: e.target.value })} placeholder="Min" aria-label="Minimalna wartość bonusu" />
                <Input type="number" value={stat.max} onChange={(e) => updateStat(stat.id, { max: e.target.value })} placeholder="Max" aria-label="Maksymalna wartość bonusu" />
                <Button variant="ghost" size="icon" onClick={() => removeStat(stat.id)} aria-label="Usuń bonus"><Trash2 /></Button>
              </div>)}
              <button onClick={addStat} className="flex h-9 w-full items-center justify-center gap-2 border border-dashed border-[#4a4031] bg-[#151411] text-xs font-semibold uppercase tracking-wider text-[#b89b66] transition-colors hover:border-[#806d4c] hover:bg-[#1b1915] active:translate-y-px"><Plus className="h-4 w-4" />Dodaj filtr bonusu</button>
            </div>
          </div>
        </div>
      </section>

      <div className="flex min-h-8 flex-wrap items-center gap-2">
        <span className="text-xs text-zinc-600">{fmt(result.total)} pasujących ofert</span>
        {activeFilters.map((label, index) => <Badge key={`${label}-${index}`} variant="outline">{label}</Badge>)}
      </div>

      <section className="overflow-hidden rounded-lg border border-zinc-800/80 bg-zinc-950/50">
        {error && <div className="border-b border-red-950 bg-red-950/30 p-4 text-sm text-red-300">Nie udało się przeszukać rynku: {error}</div>}
        {loading ? <div className="space-y-px p-1">{Array.from({ length: 8 }, (_, index) => <div key={index} className="h-14 animate-pulse bg-zinc-900/60" />)}</div> : result.rows.length === 0 ? <div className="grid min-h-56 place-items-center p-8 text-center"><div><Search className="mx-auto h-7 w-7 text-zinc-700" /><p className="mt-3 text-sm font-medium text-zinc-300">Brak pasujących ofert</p><p className="mt-1 text-xs text-zinc-600">Usuń jeden warunek albo poszerz zakres wartości bonusu.</p></div></div> : <div className="relative">{refreshing && <div className="absolute inset-x-0 top-0 z-10 h-0.5 animate-pulse bg-emerald-400" />}<Table>
          <TableHeader><TableRow><TableHead>Przedmiot</TableHead><TableHead>Bonusy</TableHead><TableHead><button className="inline-flex items-center gap-1 hover:text-white" onClick={togglePriceSort}>Cena / szt.{sort === 'price_desc' ? <ArrowDown className="h-3 w-3" /> : <ArrowUp className="h-3 w-3" />}</button></TableHead><TableHead>Ilość</TableHead><TableHead>Sklep</TableHead><TableHead>Królestwo</TableHead><TableHead>Aktualność</TableHead><TableHead /></TableRow></TableHeader>
          <TableBody>{result.rows.map((row, index) => {
            const href = `/items/${row.vnum}?${query({ market_key: row.market_key, realm: row.realm_key })}`
            return <TableRow key={`${row.state_id}-${row.slot}-${row.vnum}-${index}`}>
              <TableCell><div className="flex min-w-[250px] items-center gap-3" onMouseEnter={(event) => showTooltip(row, event)} onMouseMove={(event) => showTooltip(row, event)} onMouseLeave={() => setHover(null)}><ItemIcon src={row.icon_url} name={row.display_name || row.name} /><div className="min-w-0"><Link to={href} className="block truncate font-medium hover:text-[#d6b66f]">{row.display_name || row.name}</Link><span className="text-[11px] text-zinc-600">{row.category_label} · VNUM {row.vnum}</span></div></div></TableCell>
              <TableCell><div className="min-w-[260px] space-y-0.5">{row.bonuses?.length ? row.bonuses.map((bonus, bonusIndex) => <p key={bonusIndex} className="text-xs text-[#db7b72]">{bonusValueText(bonus)}</p>) : <span className="text-xs text-zinc-700">Brak bonusów</span>}</div></TableCell>
              <TableCell className="font-mono font-semibold text-[#e1c17b]">{fmt(row.unit_price)}</TableCell><TableCell>{fmt(row.count)}</TableCell>
              <TableCell><div className="max-w-[180px]"><Link to={`/shops/${row.merchant_id}`} className="block truncate text-sm hover:text-emerald-400">{row.owner_name || '---'}</Link><span className="block truncate text-[11px] text-zinc-600">{row.shop_name || 'PrivateShop'}</span></div></TableCell>
              <TableCell><Badge variant="outline">{row.realm_name}</Badge></TableCell><TableCell className="text-xs text-zinc-500">{dateTime(row.observed_at)}</TableCell>
              <TableCell><Link to={href} className="inline-flex rounded-md p-2 text-zinc-500 hover:bg-zinc-900 hover:text-white" aria-label={`Otwórz ${row.display_name || row.name}`}><ArrowUpRight className="h-4 w-4" /></Link></TableCell>
            </TableRow>
          })}</TableBody>
        </Table></div>}
        {!loading && result.total > PAGE_SIZE && <div className="flex items-center justify-between border-t border-zinc-800/80 px-5 py-3 text-xs text-zinc-500"><span>Strona {page} z {pageCount}</span><div className="flex gap-2"><Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>Poprzednia</Button><Button variant="outline" size="sm" disabled={page >= pageCount} onClick={() => setPage((value) => Math.min(pageCount, value + 1))}>Następna</Button></div></div>}
      </section>
    </div>
  )
}
