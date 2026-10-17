import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const badgeVariants = cva("inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-bold leading-none", {
  variants: {
    variant: {
      neutral: "bg-secondary text-muted-foreground",
      read: "bg-status-read text-status-read-foreground",
      reading: "bg-status-reading text-status-reading-foreground",
      want: "bg-status-want text-status-want-foreground",
    },
  },
  defaultVariants: { variant: "neutral" },
})

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />
}

const READING_STATUS = {
  read: { label: "Lu", variant: "read" },
  currently_reading: { label: "En cours", variant: "reading" },
  want_to_read: { label: "À lire", variant: "want" },
} as const

/** Badge for a reading status ("read", "currently_reading", "want_to_read"); nothing for others. */
export function ReadingStatusBadge({ status, className }: { status: string; className?: string }) {
  const s = READING_STATUS[status as keyof typeof READING_STATUS]
  if (!s) return null
  return <Badge variant={s.variant} className={className}>{s.label}</Badge>
}
