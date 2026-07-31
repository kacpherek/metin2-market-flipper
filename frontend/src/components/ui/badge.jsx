import React from "react"
import { cn } from "../../lib/utils"

export function Badge({ className, variant = "default", ...props }) {
  const baseStyles = "inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
  
  const variants = {
    default: "border-transparent bg-zinc-50 text-zinc-900 shadow hover:bg-zinc-50/80",
    secondary: "border-transparent bg-zinc-800 text-zinc-200 hover:bg-zinc-800/80",
    outline: "border-zinc-800 text-zinc-300",
    destructive: "border-transparent bg-red-950/40 text-red-400 border border-red-900/30",
    success: "border-transparent bg-emerald-950/40 text-emerald-400 border border-emerald-900/30",
    warning: "border-transparent bg-yellow-950/40 text-yellow-400 border border-yellow-900/30",
  }

  return (
    <div className={cn(baseStyles, variants[variant], className)} {...props} />
  )
}
