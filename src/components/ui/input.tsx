import * as React from "react"
import { cn } from "@/lib/utils"

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-11 w-full rounded-xl border border-[--border] bg-[--card] px-4 py-2 text-base sm:text-sm font-medium transition-colors placeholder:text-[--muted-foreground] placeholder:font-normal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--ring] disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        style={{ fontSize: "16px", ...((props as any).style ?? {}) }}
        ref={ref}
        {...props}
      />
    )
  }
)
Input.displayName = "Input"

export { Input }
