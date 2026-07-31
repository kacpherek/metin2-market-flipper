import { useEffect, useState } from 'react'
import { Package } from 'lucide-react'

export default function ItemIcon({ src, name, size = 'md' }) {
  const [failed, setFailed] = useState(false)
  useEffect(() => setFailed(false), [src])
  const shop = size === 'shop'
  const box = size === 'lg' ? 'h-16 w-16' : shop ? 'h-full w-full' : 'h-10 w-10'
  const resolvedSrc = src?.startsWith('/') ? `${import.meta.env.BASE_URL}${src.slice(1)}` : src
  return (
    <div className={`${box} grid shrink-0 place-items-center overflow-hidden ${shop ? 'bg-transparent' : 'rounded-lg border border-zinc-800 bg-zinc-900'}`}>
      {resolvedSrc && !failed ? <img src={resolvedSrc} alt="" onError={() => setFailed(true)} className="h-full w-full object-contain p-1" /> : <Package aria-hidden="true" className={`${shop ? 'h-6 w-6' : 'h-5 w-5'} text-zinc-600`} />}
      <span className="sr-only">{name}</span>
    </div>
  )
}
