import { Skeleton } from "@/components/ui/skeleton"

export default function SettingsLoading() {
  return (
    <div className="max-w-lg mx-auto space-y-8">
      <div className="space-y-1">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-4 w-48" />
      </div>
      <div className="rounded-2xl bg-[--card] p-6 space-y-6 border border-[--border]">
        <div className="flex items-center gap-4">
          <Skeleton className="h-16 w-16 rounded-full shrink-0" />
          <div className="space-y-1.5">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-4 w-24" />
          </div>
        </div>
        <Skeleton className="h-px w-full" />
        <div className="space-y-3">
          <Skeleton className="h-4 w-36" />
          <div className="flex gap-3">
            {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-8 w-8 rounded-full" />)}
          </div>
        </div>
        <Skeleton className="h-px w-full" />
        <div className="space-y-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="space-y-1.5">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-11 w-full" />
            </div>
          ))}
          <Skeleton className="h-11 w-full mt-2" />
        </div>
      </div>
    </div>
  )
}
