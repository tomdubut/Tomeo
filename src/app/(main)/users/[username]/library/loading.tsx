import { Skeleton } from "@/components/ui/skeleton"

export default function LibraryLoading() {
  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Profile header */}
      <div className="flex gap-5 items-start mb-8">
        <Skeleton className="h-24 w-24 rounded-full shrink-0" />
        <div className="flex-1 space-y-2 pt-1">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-64" />
          <div className="flex gap-4 mt-2">
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-4 w-16" />
          </div>
        </div>
      </div>

      {/* Book grid */}
      <div className="rounded-2xl bg-[--card] p-6 sm:p-8 space-y-6">
        <div className="flex gap-1 rounded-2xl bg-[--secondary] p-1 w-fit">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-8 w-20" />)}
        </div>
        <div className="grid grid-cols-3 gap-4 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="aspect-[2/3] w-full" />
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-2/3" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
