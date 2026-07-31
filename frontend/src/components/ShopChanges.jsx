import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, Clock3, MapPin, Store } from 'lucide-react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import ItemIcon from './ItemIcon'
import ItemTooltip from './ItemTooltip'
import { Badge } from './ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'
import { dateTime, fmt, getJson, query } from '../lib/market'

const SHOP_SLOT_COUNT = 81

export default function ShopChanges() {
  const { merchantId } = useParams()
  const [params, setParams] = useSearchParams()
  const selectedState = Number(params.get('state') || 0)
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedSlot, setSelectedSlot] = useState(null)

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true); setError('')
    getJson(`/api/merchant?${query({ merchant_id: merchantId, state_id: selectedState, limit: 100 })}`, controller.signal)
      .then(setData).catch((e) => { if (e.name !== 'AbortError') setError(e.message) })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [merchantId, selectedState])

  const states = useMemo(() => {
    const seen = new Set()
    return (data?.timeline || []).filter((row) => !seen.has(row.state_id) && seen.add(row.state_id))
  }, [data])

  if (loading && !data) return <div className="p-10 text-center text-sm text-zinc-500">Ładuję historię sklepu…</div>
  if (error && !data) return <div className="rounded-lg border border-red-900/50 bg-red-950/20 p-5 text-sm text-red-300">Nie udało się otworzyć sklepu: {error}</div>
  if (!data) return null

  const { merchant, selected_state: state, items } = data
  const selectedItem = items.find((item) => item.slot === selectedSlot) || items[0]
  return (
    <div className="space-y-6">
      <header>
        <Link to="/shops" className="mb-4 -ml-2 inline-flex items-center gap-2 rounded-md px-2 py-1 text-sm text-zinc-500 hover:bg-zinc-900 hover:text-white"><ArrowLeft className="h-4 w-4" />Wróć do sklepów</Link>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-400">Profil sprzedawcy</p><h1 className="mt-2 text-3xl font-semibold tracking-tight">{merchant.owner_name}</h1><p className="mt-2 text-sm text-zinc-500">Historia jest append-only: każdy skan pozostaje dostępny, nawet gdy zawartość się nie zmienia.</p></div>
          <div className="flex gap-2"><Badge variant="outline">{data.timeline.length} obserwacji</Badge><Badge variant="success">{states.length} unikalnych stanów</Badge></div>
        </div>
      </header>

      <section className="grid gap-4 xl:grid-cols-[320px_minmax(0,1fr)]">
        <Card className="border-zinc-800/80 bg-zinc-950/60 shadow-none xl:sticky xl:top-8 xl:self-start">
          <CardHeader className="border-b border-zinc-800/80 p-5"><CardTitle className="text-base">Oś czasu</CardTitle><p className="text-xs text-zinc-500">Kliknij stan, aby zobaczyć jego oferty.</p></CardHeader>
          <CardContent className="max-h-[70vh] space-y-2 overflow-y-auto p-3">
            {states.map((snapshot, index) => {
              const active = state?.id === snapshot.state_id
              return <button key={snapshot.state_id} onClick={() => setParams({ state: snapshot.state_id })} className={`w-full rounded-lg border p-3 text-left transition-colors ${active ? 'border-emerald-800 bg-emerald-950/30' : 'border-zinc-800/70 bg-zinc-950 hover:bg-zinc-900'}`}>
                <div className="flex items-center justify-between gap-2"><span className="text-xs font-medium text-zinc-300">{dateTime(snapshot.observed_at)}</span>{index === 0 && <Badge variant="success">Najnowszy</Badge>}</div>
                <p className="mt-2 truncate text-sm">{snapshot.shop_name}</p><p className="mt-1 text-xs text-zinc-600">{snapshot.item_count} pozycji · {fmt(snapshot.total_price)}</p>
              </button>
            })}
          </CardContent>
        </Card>

        <div className="min-w-0 space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <Info icon={Store} label="Nazwa sklepu" value={state?.shop_name || 'PrivateShop'} />
            <Info icon={Clock3} label="Okres stanu" value={`${dateTime(state?.first_seen)} – ${dateTime(state?.last_seen)}`} />
            <Info icon={MapPin} label="Pozycja" value={state ? `${Math.round(state.x)}, ${Math.round(state.y)}` : 'Brak'} />
          </div>
          <Card className="border-zinc-800/80 bg-zinc-950/60 shadow-none">
            <CardHeader className="border-b border-zinc-800/80 p-5"><CardTitle className="text-base">Oferty w tym stanie</CardTitle><p className="mt-1 text-xs text-zinc-500">{items.length} pozycji · wartość {fmt(state?.total_price)}</p></CardHeader>
            <CardContent className="p-5">
              {items.length === 0 ? <div className="p-10 text-center text-sm text-zinc-500">Ten stan nie ma zapisanych ofert.</div> : <ShopGrid items={items} selectedItem={selectedItem} onSelect={setSelectedSlot} />}
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  )
}

function ShopGrid({ items, selectedItem, onSelect }) {
  const bySlot = useMemo(() => new Map(items.map((item) => [Number(item.slot), item])), [items])
  const [hover, setHover] = useState(null)
  const visibleSockets = (selectedItem?.sockets || []).filter((socket) => socket.kind === 'skill' || socket.kind === 'metin' || (Number(socket.vnum) >= 28000 && Number(socket.vnum) < 29000))
  const details = [...(selectedItem?.bonuses || []).map((bonus) => bonus.raw || `${bonus.name} ${Number(bonus.value) > 0 ? '+' : ''}${bonus.value || ''}`.trim()), ...visibleSockets.map((socket) => socket.kind === 'skill' ? `Umiejętność: ${socket.name}` : `KD ${Number(socket.slot || 0) + 1}: ${socket.name || `Kamień VNUM ${socket.vnum}`}`)].join(' · ') || selectedItem?.details
  const showTooltip = (item, event) => setHover({ item, point: { x: event.clientX, y: event.clientY } })
  return (
    <div className="grid gap-5 2xl:grid-cols-[minmax(430px,620px)_minmax(260px,1fr)]">
      <div className="overflow-x-auto">
        <div className="mx-auto grid aspect-square min-w-[430px] max-w-[620px] grid-cols-9 grid-rows-9 overflow-hidden rounded-md border-4 border-[#514536] bg-[#17130f] p-1 shadow-[inset_0_0_0_1px_#8f7b5e,0_18px_40px_rgba(0,0,0,.32)]">
          {Array.from({ length: SHOP_SLOT_COUNT }, (_, slot) => <div key={`cell-${slot}`} aria-label={`Pole slotu ${slot}`} className="border border-[#40382e] bg-[radial-gradient(circle_at_45%_35%,#29231c,#17130f_72%)] shadow-[inset_0_0_5px_rgba(0,0,0,.75)]" />)}
          {Array.from(bySlot.entries(), ([slot, item]) => {
            const active = selectedItem?.slot === item.slot
            const row = Math.floor(slot / 9)
            const rowSpan = Math.min(Math.max(1, Number(item.icon_rows) || 1), 9 - row)
            const position = { gridColumnStart: (slot % 9) + 1, gridRowStart: row + 1, gridRowEnd: `span ${rowSpan}` }
            const name = item.display_name || item.name
            return (
              <button key={`${slot}-${item.market_key}`} style={position} type="button" onClick={() => onSelect(slot)} onMouseEnter={(event) => { onSelect(slot); showTooltip(item, event) }} onMouseMove={(event) => showTooltip(item, event)} onMouseLeave={() => setHover(null)} onFocus={(event) => { onSelect(slot); const rect = event.currentTarget.getBoundingClientRect(); setHover({ item, point: { x: rect.right, y: rect.top } }) }} onBlur={() => setHover(null)} className={`group relative min-h-0 border bg-[radial-gradient(circle_at_45%_35%,#30291f,#17130f_72%)] p-0.5 shadow-[inset_0_0_5px_rgba(0,0,0,.75)] outline-none transition ${active ? 'z-20 border-amber-300 ring-2 ring-amber-300/70' : 'z-10 border-[#514536] hover:z-20 hover:border-amber-200/70 focus-visible:z-20 focus-visible:border-amber-300 focus-visible:ring-2 focus-visible:ring-amber-300/70'}`} aria-label={`Slot ${slot}: ${name}`}>
                <ItemIcon src={item.icon_url} name={name} size="shop" />
                {item.count > 1 && <span className="absolute bottom-0.5 right-1 rounded-sm bg-black/75 px-1 text-[10px] font-semibold leading-4 text-white shadow">{item.count}</span>}
              </button>
            )
          })}
        </div>
        <ItemTooltip item={hover?.item} point={hover?.point} />
        <p className="mt-2 text-center text-[11px] text-zinc-600">Układ 9 × 9 zachowuje dokładne pozycje slotów zapisane przez skaner.</p>
      </div>

      {selectedItem && <div className="self-start rounded-lg border border-zinc-800 bg-zinc-950/80 p-4">
        <div className="flex items-start gap-4"><ItemIcon src={selectedItem.icon_url} name={selectedItem.display_name || selectedItem.name} size="lg" /><div className="min-w-0"><p className="text-xs text-zinc-600">Slot {selectedItem.slot} · VNUM {selectedItem.vnum}</p><Link className="mt-1 block font-semibold leading-snug hover:text-emerald-400" to={`/items/${selectedItem.vnum}?market_key=${encodeURIComponent(selectedItem.market_key)}`}>{selectedItem.display_name || selectedItem.name}</Link><Badge variant="outline" className="mt-2">{selectedItem.variant_label}</Badge></div></div>
        <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-zinc-800 pt-4 text-sm"><div><dt className="text-xs text-zinc-600">Ilość</dt><dd className="mt-1 font-medium">{selectedItem.count}</dd></div><div><dt className="text-xs text-zinc-600">Cena / szt.</dt><dd className="mt-1 font-medium">{fmt(selectedItem.unit_price)}</dd></div><div className="col-span-2"><dt className="text-xs text-zinc-600">Cena łącznie</dt><dd className="mt-1 font-semibold text-emerald-400">{fmt(selectedItem.price)}</dd></div></dl>
        <div className="mt-4 border-t border-zinc-800 pt-4"><p className="text-xs font-medium text-zinc-500">Bonusy i kamienie</p><p className="mt-2 text-sm leading-6 text-zinc-300">{details || 'Brak dodatkowych właściwości.'}</p></div>
        <Link to={`/items/${selectedItem.vnum}?market_key=${encodeURIComponent(selectedItem.market_key)}`} className="mt-4 inline-flex w-full items-center justify-center rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm font-medium hover:bg-zinc-800">Otwórz analizę przedmiotu</Link>
      </div>}
    </div>
  )
}

function Info({ icon: Icon, label, value }) {
  return <div className="rounded-lg border border-zinc-800/80 bg-zinc-950/60 p-4"><div className="flex items-center gap-2 text-xs text-zinc-500"><Icon className="h-4 w-4" />{label}</div><p className="mt-2 truncate text-sm font-medium">{value}</p></div>
}
