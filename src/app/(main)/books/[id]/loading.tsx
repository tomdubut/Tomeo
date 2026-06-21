import { Skeleton } from "@/components/ui/skeleton"

export default function BookDetailLoading() {
  return (
    <div className="max-w-3xl mx-auto space-y-10 pb-28 sm:pb-0">
      <Skeleton className="h-5 w-16" />

      {/* Header */}
      <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-start sm:gap-8">
        <Skeleton className="w-36 sm:w-48 shrink-0" style={{ aspectRatio: "2/3" }} />
        <div className="flex-1 w-full space-y-3">
          <Skeleton className="h-8 w-3/4" />
          <Skeleton className="h-5 w-1/2" />
          <div className="flex gap-2 flex-wrap justify-center sm:justify-start">
            {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-7 w-20" />)}
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-10 flex-1 sm:w-40 sm:flex-none" />
            <Skeleton className="h-10 w-36" />
          </div>
        </div>
      </div>

      {/* Description */}
      <div className="space-y-2">
        <Skeleton className="h-5 w-24" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
      </div>

      {/* Reviews */}
      <div className="space-y-4">
        <Skeleton className="h-6 w-24" />
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="rounded-2xl bg-[--card] p-5 space-y-3">
            <div className="flex items-center gap-3">
              <Skeleton className="h-9 w-9 rounded-full" />
              <div className="space-y-1.5 flex-1">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-20" />
              </div>
            </div>
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
          </div>
        ))}
      </div>
    </div>
  )
}
