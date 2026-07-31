import { useEffect, useState } from 'react'
import { ArrowUpRight, Search, Store } from 'lucide-react'
import { Link, useSearchParams } from 'react-router-dom'
import { Badge } from './ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'
import { Input } from './ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table'
import { dateTime, fmt, getJson, query } from '../lib/market'

export default function ShopsPage() {
  const [params, setParams] = useSearchParams()
  const [search, setSearch] = useState(params.get('q') || '')
  const [shops, setShops] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const controller = new AbortController()
    const timer = setTimeout(async () => {
      setLoading(true); setError('')
      setParams(search.trim() ? { q: search.trim() } : {}, { replace: true })
      try {
        const data = await getJson(`/api/merchants?${query({ q: search.trim(), limit: 500 })}`, controller.signal)
        setShops(data.rows || [])
      } catch (e) {
        if (e.name !== 'AbortError') setError(e.message)
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }, 250)
    return () => { clearTimeout(timer); controller.abort() }
  }, [search, setParams])

  return (
    <div className="space-y-6">
      <header><p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-400">Historia sprzedawców</p><h1 className="mt-2 text-3xl font-semibold tracking-tight">Sklepy</h1><p className="mt-2 text-sm text-zinc-500">VID zmienia się między sesjami, dlatego historia jest połączona po właścicielu sklepu.</p></header>
      <Card className="border-zinc-800/80 bg-zinc-950/60 shadow-none">
        <CardHeader className="border-b border-zinc-800/80 p-5"><div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div><CardTitle className="text-base">Sprzedawcy</CardTitle><p className="mt-1 text-xs text-zinc-500">{shops.length} ostatnio aktywnych kont</p></div><label className="relative w-full sm:w-80"><Search className="absolute left-3 top-2.5 h-4 w-4 text-zinc-600" /><Input className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Owner albo nazwa sklepu" /></label></div></CardHeader>
        <CardContent className="p-0">
          {error && <div className="p-5 text-sm text-red-300">Nie udało się pobrać sklepów: {error}</div>}
          {loading ? <div className="p-10 text-center text-sm text-zinc-500">Ładuję historię sprzedawców…</div> : shops.length === 0 ? <div className="p-10 text-center text-sm text-zinc-500">Brak sklepów dla tego zapytania.</div> : (
            <Table><TableHeader><TableRow><TableHead>Właściciel</TableHead><TableHead>Nazwa sklepu</TableHead><TableHead>Aktualny stan</TableHead><TableHead>Wartość sklepu</TableHead><TableHead>Historia</TableHead><TableHead>Pozycja</TableHead><TableHead>Ostatnio</TableHead><TableHead /></TableRow></TableHeader>
              <TableBody>{shops.map((shop) => (
                <TableRow key={shop.id}>
                  <TableCell><div className="flex items-center gap-3"><div className="grid h-9 w-9 place-items-center rounded-lg border border-zinc-800 bg-zinc-900"><Store className="h-4 w-4 text-zinc-500" /></div><div><Link className="font-medium hover:text-emerald-400" to={`/shops/${shop.id}`}>{shop.owner_name}</Link><span className="block text-xs text-zinc-600">ID {shop.id} · VID {shop.shop_vid}</span></div></div></TableCell>
                  <TableCell className="max-w-[240px] truncate">{shop.shop_name || 'PrivateShop'}</TableCell>
                  <TableCell><Badge variant="success">{shop.item_count} pozycji</Badge></TableCell><TableCell>{fmt(shop.total_price)}</TableCell>
                  <TableCell>{shop.states} zmian<span className="block text-xs text-zinc-600">{shop.observations} obserwacji</span></TableCell>
                  <TableCell className="font-mono text-xs text-zinc-500">{Math.round(shop.x)}, {Math.round(shop.y)}</TableCell><TableCell className="text-xs text-zinc-500">{dateTime(shop.observed_at)}</TableCell>
                  <TableCell><Link className="inline-flex rounded-md p-2 text-zinc-500 hover:bg-zinc-900 hover:text-white" to={`/shops/${shop.id}`}><ArrowUpRight className="h-4 w-4" /></Link></TableCell>
                </TableRow>
              ))}</TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
