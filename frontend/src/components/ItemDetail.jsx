import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, BadgePercent, BarChart3, ShieldCheck, Store, TrendingUp } from 'lucide-react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import ItemIcon from './ItemIcon'
import { Badge } from './ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table'
import { confidenceTone, dateTime, fmt, getJson, query } from '../lib/market'

const OFFERS_PER_PAGE = 50

export default function ItemDetail() {
  const { vnum } = useParams()
  const [params] = useSearchParams()
  const marketKey = params.get('market_key') || ''
  const realm = params.get('realm') || ''
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [offerPage, setOfferPage] = useState(1)

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true); setError('')
    getJson(`/api/item?${query({ vnum, market_key: marketKey, realm, offer_limit: OFFERS_PER_PAGE, offer_offset: (offerPage - 1) * OFFERS_PER_PAGE })}`, controller.signal)
      .then(setData).catch((e) => { if (e.name !== 'AbortError') setError(e.message) })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [vnum, marketKey, realm, offerPage])

  useEffect(() => setOfferPage(1), [vnum, marketKey, realm])

  const chart = useMemo(() => [...(data?.history || [])].reverse().map((row) => ({ ...row, label: row.bucket.slice(5).replace('T', ' ') })), [data])

  if (loading && !data) return <div className="p-10 text-center text-sm text-zinc-500">Ładuję historię przedmiotu…</div>
  if (error && !data) return <div className="rounded-lg border border-red-900/50 bg-red-950/20 p-5 text-sm text-red-300">Nie udało się pobrać przedmiotu: {error}</div>
  if (!data) return null

  const { item, offers, history, offer_total: offerTotal = offers.length } = data
  const median = Number(item.median_unit_price || 0)
  const p25 = Number(item.p25_price || median)
  const p75 = Number(item.p75_price || median)
  const cheapest = item.cheapest_offer || offers[0]
  const offerPageCount = Math.max(1, Math.ceil(offerTotal / OFFERS_PER_PAGE))
  const profit = cheapest ? Math.trunc(p25 * .92 - cheapest.unit_price) : 0

  return (
    <div className="space-y-6">
      <header>
        <Link to="/items" className="mb-4 inline-flex items-center gap-2 rounded-md px-2 py-1 text-sm text-zinc-500 hover:bg-zinc-900 hover:text-white"><ArrowLeft className="h-4 w-4" />Wróć do rynku</Link>
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
           <div className="flex min-w-0 items-center gap-4"><ItemIcon src={item.icon_url} name={item.name} size="lg" /><div className="min-w-0"><p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-400">VNUM {item.vnum}{item.realm_name ? ` · ${item.realm_name}` : ''}</p><h1 className="mt-1 truncate text-3xl font-semibold tracking-tight">{item.name}{item.variant_key ? ` [${item.variant_label}]` : ''}</h1><p className="mt-1 text-sm text-zinc-500">{item.listings ? `${fmt(item.listings)} próbek od ${fmt(item.merchants)} sprzedawców` : `${fmt(item.offers)} zapisanych ofert`}</p></div></div>
          {item.confidence !== undefined && <Badge variant={confidenceTone(item.confidence)} className="self-start px-3 py-1.5">Pewność wyceny {item.confidence}%</Badge>}
        </div>
      </header>

       {item.variants?.length > 1 && <section><p className="mb-2 text-xs font-medium text-zinc-500">Warianty rynku</p><div className="flex flex-wrap gap-2">{item.variants.slice(0, 80).map((variant) => <Link key={`${variant.realm_key}-${variant.market_key}`} to={`/items/${item.vnum}?${query({ market_key: variant.market_key, realm: variant.realm_key })}`} className={`rounded-md border px-3 py-2 text-xs transition-colors ${variant.market_key === (marketKey || item.market_key) && variant.realm_key === (realm || item.realm_key) ? 'border-emerald-700 bg-emerald-950/40 text-emerald-300' : 'border-zinc-800 bg-zinc-950 text-zinc-400 hover:bg-zinc-900'}`}>{variant.realm_name} · {variant.variant_label} · {fmt(variant.median_unit_price)}</Link>)}</div></section>}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <Metric label="Najtańsza oferta" value={cheapest ? fmt(cheapest.unit_price) : 'Brak'} hint={cheapest ? `${cheapest.count} szt. u ${cheapest.owner_name}` : 'Brak aktywnych ofert'} icon={Store} />
        <Metric label="Cena konserwatywna P25" value={p25 ? fmt(p25) : 'Brak'} hint="25% ofert było tańszych" icon={ShieldCheck} />
        <Metric label="Mediana rynku" value={median ? fmt(median) : 'Brak'} hint={`P75 ${fmt(p75)}`} icon={BarChart3} />
        <Metric label="Rotacja" value={`${item.liquidity_score || 0}%`} hint={item.sales_per_day ? `około ${item.sales_per_day} szt. / dzień` : 'brak sygnałów sprzedaży'} icon={TrendingUp} />
        <Metric label="Zysk / szt." value={profit > 0 ? `+${fmt(profit)}` : 'Brak okazji'} hint="po 8% podatku, sprzedaż po P25" icon={BadgePercent} positive={profit > 0} />
      </section>

      <Card className="border-zinc-800/80 bg-zinc-950/60 shadow-none">
        <CardHeader className="border-b border-zinc-800/80 p-5"><CardTitle className="text-base">Historia ceny</CardTitle><p className="mt-1 text-xs text-zinc-500">Godzinowe P25, mediana i P75 dla {marketKey ? 'wybranego wariantu' : 'wszystkich wariantów VNUM'}.</p></CardHeader>
        <CardContent className="p-5">
          {history.length === 0 ? <div className="py-20 text-center text-sm text-zinc-500">Brak historii cen.</div> : <div className="h-[340px] w-full"><ResponsiveContainer width="100%" height="100%"><AreaChart data={chart} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}><defs><linearGradient id="medianFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#34d399" stopOpacity={.28} /><stop offset="100%" stopColor="#34d399" stopOpacity={0} /></linearGradient></defs><CartesianGrid stroke="#27272a" strokeDasharray="3 3" vertical={false} /><XAxis dataKey="label" stroke="#71717a" fontSize={11} tickLine={false} axisLine={false} minTickGap={36} /><YAxis stroke="#71717a" fontSize={11} tickFormatter={(v) => new Intl.NumberFormat('pl-PL', { notation: 'compact' }).format(v)} tickLine={false} axisLine={false} width={70} /><Tooltip contentStyle={{ background: '#09090b', border: '1px solid #3f3f46', borderRadius: 8 }} formatter={(value, name) => [fmt(value), name === 'median_unit_price' ? 'Mediana' : name === 'p25_price' ? 'P25' : 'P75']} /><Area type="monotone" dataKey="p75_price" stroke="#52525b" fill="none" strokeWidth={1} /><Area type="monotone" dataKey="median_unit_price" stroke="#34d399" fill="url(#medianFill)" strokeWidth={2} /><Area type="monotone" dataKey="p25_price" stroke="#a1a1aa" fill="none" strokeWidth={1} /></AreaChart></ResponsiveContainer></div>}
        </CardContent>
      </Card>

      {(item.common_bonuses?.length > 0 || item.common_sockets?.length > 0) && <section className="grid gap-4 lg:grid-cols-2"><FactList title="Najczęstsze bonusy" rows={item.common_bonuses} /><FactList title="Najczęstsze sockety / warianty" rows={item.common_sockets} /></section>}

      <Card className="border-zinc-800/80 bg-zinc-950/60 shadow-none">
        <CardHeader className="border-b border-zinc-800/80 p-5"><CardTitle className="text-base">Aktywne oferty</CardTitle><p className="mt-1 text-xs text-zinc-500">{offerTotal} ofert z ostatniego pełnego skanu, od najtańszej.</p></CardHeader>
        <CardContent className="p-0">{offers.length === 0 ? <div className="p-10 text-center text-sm text-zinc-500">Brak aktywnych ofert dla tego wariantu.</div> : <><Table><TableHeader><TableRow><TableHead>Sprzedawca</TableHead><TableHead>Sklep</TableHead><TableHead>Ilość</TableHead><TableHead>Cena / szt.</TableHead><TableHead>Cena łącznie</TableHead><TableHead>Detale</TableHead><TableHead>Ostatnio</TableHead></TableRow></TableHeader><TableBody>{offers.map((offer) => <TableRow key={`${offer.merchant_id}-${offer.state_id}-${offer.slot}`}><TableCell><Link className="font-medium hover:text-emerald-400" to={`/shops/${offer.merchant_id}`}>{offer.owner_name}</Link></TableCell><TableCell className="max-w-[220px] truncate">{offer.shop_name}</TableCell><TableCell>{offer.count}</TableCell><TableCell className="font-medium">{fmt(offer.unit_price)}</TableCell><TableCell>{fmt(offer.price)}</TableCell><TableCell className="max-w-[320px] text-xs text-zinc-500">{offer.details || [...(offer.bonuses || []).map((b) => `${b.name} ${b.value}`), ...(offer.sockets || []).map((s) => s.name || `KD ${s.vnum}`)].join(' · ') || '—'}</TableCell><TableCell className="text-xs text-zinc-500">{dateTime(offer.observed_at)}</TableCell></TableRow>)}</TableBody></Table>{offerTotal > OFFERS_PER_PAGE && <div className="flex items-center justify-between border-t border-zinc-800/80 px-5 py-3 text-xs text-zinc-500"><span>Oferty {(offerPage - 1) * OFFERS_PER_PAGE + 1}–{Math.min(offerPage * OFFERS_PER_PAGE, offerTotal)} z {offerTotal}</span><div className="flex gap-2"><button className="rounded-md border border-zinc-800 px-3 py-1.5 disabled:opacity-30" disabled={offerPage === 1} onClick={() => setOfferPage((value) => Math.max(1, value - 1))}>Poprzednia</button><button className="rounded-md border border-zinc-800 px-3 py-1.5 disabled:opacity-30" disabled={offerPage === offerPageCount} onClick={() => setOfferPage((value) => Math.min(offerPageCount, value + 1))}>Następna</button></div></div>}</>}</CardContent>
      </Card>
    </div>
  )
}

function Metric({ label, value, hint, icon: Icon, positive }) {
  return <div className="rounded-lg border border-zinc-800/80 bg-zinc-950/60 p-5"><div className="flex items-center gap-2 text-xs text-zinc-500"><Icon className="h-4 w-4" />{label}</div><p className={`mt-3 text-2xl font-semibold tracking-tight ${positive ? 'text-emerald-400' : ''}`}>{value}</p><p className="mt-1 text-xs text-zinc-600">{hint}</p></div>
}

function FactList({ title, rows = [] }) {
  return <div className="rounded-lg border border-zinc-800/80 bg-zinc-950/60 p-5"><h2 className="text-sm font-medium">{title}</h2><div className="mt-4 flex flex-wrap gap-2">{rows.length ? rows.map((row) => <Badge key={row.name} variant="outline">{row.name} · {row.count}</Badge>) : <span className="text-xs text-zinc-600">Brak danych</span>}</div></div>
}
