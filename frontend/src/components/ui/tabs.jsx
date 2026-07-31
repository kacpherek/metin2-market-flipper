import React from "react"
import { cn } from "../../lib/utils"

export const Tabs = ({ className, ...props }) => (
  <div className={cn("space-y-4", className)} {...props} />
)

export const TabsList = React.forwardRef(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "inline-flex h-9 items-center justify-center rounded-lg bg-zinc-900 p-1 text-zinc-400",
      className
    )}
    {...props}
  />
))
TabsList.displayName = "TabsList"

export const TabsTrigger = React.forwardRef(({ className, active, ...props }, ref) => (
  <button
    ref={ref}
    className={cn(
      "inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1 text-sm font-medium transition-all focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50 cursor-pointer",
      active
        ? "bg-zinc-950 text-zinc-50 shadow-sm"
        : "hover:bg-zinc-850 hover:text-zinc-200",
      className
    )}
    {...props}
  />
))
TabsTrigger.displayName = "TabsTrigger"

export const TabsContent = React.forwardRef(({ className, active, ...props }, ref) => {
  if (!active) return null
  return (
    <div
      ref={ref}
      className={cn(
        "mt-2 focus-visible:outline-none",
        className
      )}
      {...props}
    />
  )
})
TabsContent.displayName = "TabsContent"
