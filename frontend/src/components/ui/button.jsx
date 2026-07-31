import React from "react"
import { cn } from "../../lib/utils"

export const Button = React.forwardRef(({ className, variant = "default", size = "default", ...props }, ref) => {
  const baseStyles = "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 cursor-pointer"
  
  const variants = {
    default: "bg-white text-zinc-950 shadow-sm hover:bg-zinc-200",
    destructive: "bg-red-500 text-white shadow-sm hover:bg-red-600",
    outline: "border border-zinc-800 bg-transparent text-zinc-200 shadow-sm hover:bg-zinc-900 hover:text-white",
    secondary: "bg-zinc-800 text-zinc-200 shadow-sm hover:bg-zinc-700 hover:text-white",
    ghost: "text-zinc-400 hover:bg-zinc-900 hover:text-zinc-100",
    link: "text-white underline-offset-4 hover:underline",
  }

  const sizes = {
    default: "h-9 px-4 py-2",
    sm: "h-8 rounded-md px-3 text-xs",
    lg: "h-10 rounded-md px-8",
    icon: "h-9 w-9",
  }

  return (
    <button
      className={cn(baseStyles, variants[variant], sizes[size], className)}
      ref={ref}
      {...props}
    />
  )
})
Button.displayName = "Button"
