import { useEffect, useState } from 'react'
import { BarChart3, Gavel, Menu, Search, ShoppingBag, Store, X } from 'lucide-react'
import { NavLink, useNavigate } from 'react-router-dom'
import { getJson } from '../lib/market'

const links = [
  { to: '/', label: 'Okazje', icon: BarChart3 },
  { to: '/market', label: 'Dom aukcyjny', icon: Gavel },
  { to: '/items', label: 'Przedmioty', icon: ShoppingBag },
  { to: '/shops', label: 'Sklepy', icon: Store },
]

export default function Navbar() {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [online, setOnline] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    getJson('/api/health').then(() => setOnline(true)).catch(() => setOnline(false))
  }, [])

  const submit = (event) => {
    event.preventDefault()
    navigate(`/market?q=${encodeURIComponent(search.trim())}`)
    setOpen(false)
  }

  return (
    <>
      <header className="fixed inset-x-0 top-0 z-40 flex h-16 items-center border-b border-zinc-800/80 bg-zinc-950/95 px-4 backdrop-blur lg:hidden">
        <button className="rounded-md p-2 text-zinc-400 hover:bg-zinc-900 hover:text-white" onClick={() => setOpen(true)} aria-label="Otwórz menu">
          <Menu aria-hidden="true" />
        </button>
        <strong className="ml-3 tracking-tight">Metin2 Market</strong>
      </header>

      {open && <button className="fixed inset-0 z-40 bg-black/70 lg:hidden" onClick={() => setOpen(false)} aria-label="Zamknij menu" />}
      <aside className={`fixed inset-y-0 left-0 z-50 flex w-[248px] flex-col border-r border-zinc-800/80 bg-zinc-950 transition-transform lg:sticky lg:top-0 lg:z-20 lg:h-[100dvh] ${open ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
        <div className="flex h-16 items-center gap-3 border-b border-zinc-800/80 px-5">
          <div className="grid h-9 w-9 place-items-center rounded-lg bg-emerald-500 text-sm font-black text-zinc-950">EM</div>
          <div className="min-w-0">
            <div className="font-semibold tracking-tight">Metin2 Market</div>
            <div className="text-[11px] text-zinc-500">Analityka rynku CH1</div>
          </div>
          <button className="ml-auto p-1 text-zinc-500 lg:hidden" onClick={() => setOpen(false)} aria-label="Zamknij menu"><X /></button>
        </div>

        <form onSubmit={submit} className="px-3 py-4">
          <label className="relative block">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-zinc-500" aria-hidden="true" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Szukaj przedmiotu..." className="h-9 w-full rounded-md border border-zinc-800 bg-zinc-900/60 pl-9 pr-3 text-sm outline-none placeholder:text-zinc-600 focus:border-zinc-700" />
          </label>
        </form>

        <nav className="space-y-1 px-3" aria-label="Główna nawigacja">
          {links.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to} end={to === '/'} onClick={() => setOpen(false)} className={({ isActive }) => `flex h-10 items-center gap-3 rounded-md px-3 text-sm font-medium transition-colors ${isActive ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:bg-zinc-900 hover:text-zinc-100'}`}>
              <Icon className="h-4 w-4" aria-hidden="true" />{label}
            </NavLink>
          ))}
        </nav>

        <div className="mt-auto border-t border-zinc-800/80 p-4">
          <div className="flex items-center gap-2 text-xs text-zinc-500">
            <span className={`h-2 w-2 rounded-full ${online ? 'bg-emerald-400' : 'bg-red-400'}`} />
            {online ? 'API rynku aktywne' : 'API niedostępne'}
          </div>
          <p className="mt-2 text-[11px] leading-5 text-zinc-600">Wyniki uwzględniają 8% podatku. Pewność dotyczy jakości wyceny, nie gwarancji sprzedaży.</p>
        </div>
      </aside>
    </>
  )
}
