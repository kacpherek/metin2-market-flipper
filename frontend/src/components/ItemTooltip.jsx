import { createPortal } from 'react-dom'
import { fmt } from '../lib/market'

const liveSockets = (item) => (item?.sockets || []).filter((socket) =>
  socket.kind === 'skill' || socket.kind === 'metin' || (Number(socket.vnum) >= 28000 && Number(socket.vnum) < 29000))

function bonusText(bonus) {
  if (bonus.raw) return bonus.raw
  const value = Number(bonus.value || 0)
  const name = bonus.name || bonus.type || 'Bonus'
  const flat = /(^|\s)(max hp|max pe|max sp|sil|siła|int|zr|zręcz|wit|wartość ataku|wartosc ataku)(\s|$)/i.test(name) || [1, 2, 3, 4, 5, 6, 53, 54].includes(Number(bonus.type))
  return `${name}${value ? ` ${value > 0 ? '+' : ''}${value}${flat ? '' : '%'}` : ''}`
}

export default function ItemTooltip({ item, point }) {
  if (!item || !point || typeof document === 'undefined') return null
  const bonuses = item.bonuses || []
  const sockets = liveSockets(item)
  const fallback = !bonuses.length && !sockets.length
    ? String(item.details || '').split('|').map((line) => line.trim()).filter(Boolean)
    : []
  const left = Math.max(12, Math.min(point.x + 18, window.innerWidth - 350))
  const top = Math.max(12, Math.min(point.y + 18, window.innerHeight - 430))

  return createPortal(
    <div role="tooltip" style={{ left, top }} className="pointer-events-none fixed z-[1000] w-[330px] rounded-sm border border-[#716149] bg-[linear-gradient(180deg,rgba(20,17,13,.98),rgba(7,6,5,.98))] px-4 py-3 text-center shadow-[0_16px_45px_rgba(0,0,0,.75),inset_0_0_0_1px_rgba(195,165,111,.14)]">
      <p className="text-sm font-semibold leading-5 text-[#e6c36a]">{item.display_name || item.name}</p>
      {item.refine_level > 0 && <p className="mt-0.5 text-[11px] text-[#ad9470]">Poziom ulepszenia +{item.refine_level}</p>}

      {sockets.some((socket) => socket.kind === 'skill') && <div className="mt-3 border-t border-[#493f31] pt-2">
        {sockets.filter((socket) => socket.kind === 'skill').map((socket, index) => <p key={`skill-${index}`} className="text-sm leading-5 text-[#f0d37b]">Umiejętność: {socket.name}</p>)}
      </div>}

      {sockets.some((socket) => socket.kind !== 'skill') && <div className="mt-3 border-t border-[#493f31] pt-2">
        {sockets.filter((socket) => socket.kind !== 'skill').map((socket, index) => <p key={`stone-${index}`} className="text-sm leading-5 text-[#85d993]">KD {Number(socket.slot ?? index) + 1}: {socket.name || `Kamień VNUM ${socket.vnum}`}</p>)}
      </div>}

      {bonuses.length > 0 && <div className="mt-3 border-t border-[#493f31] pt-2">
        {bonuses.map((bonus, index) => <p key={`bonus-${index}`} className="text-sm leading-5 text-[#e97777]">{bonusText(bonus)}</p>)}
      </div>}

      {fallback.length > 0 && <div className="mt-3 border-t border-[#493f31] pt-2">
        {fallback.map((line, index) => <p key={`detail-${index}`} className="text-sm leading-5 text-[#e97777]">{line}</p>)}
      </div>}

      <div className="mt-3 border-t border-[#493f31] pt-2 text-xs text-[#b9a889]">
        <p>{item.count > 1 ? `${fmt(item.count)} szt. · ${fmt(item.unit_price)} Yang / szt.` : '1 sztuka'}</p>
        <p className="mt-1 font-semibold text-[#f2d68e]">Cena: {fmt(item.price)} Yang</p>
      </div>
    </div>,
    document.body,
  )
}
