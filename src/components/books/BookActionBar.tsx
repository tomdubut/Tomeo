"use client"

import AddToLibraryButton from "./AddToLibraryButton"
import AddToListButton from "@/components/lists/AddToListButton"

interface UserList {
  id: string
  title: string
  is_public: boolean
}

interface Props {
  bookId: string
  initialStatus: string | null
  initialFinishedAt: string | null
  lists: UserList[]
  initialListIds: string[]
}

export default function BookActionBar({ bookId, initialStatus, initialFinishedAt, lists, initialListIds }: Props) {
  return (
    <>
      {/* Desktop: inline below book info */}
      <div className="hidden sm:flex flex-row gap-2 pt-1">
        <AddToLibraryButton
          bookId={bookId}
          initialStatus={initialStatus as any}
          initialFinishedAt={initialFinishedAt}
        />
        <AddToListButton bookId={bookId} lists={lists} initialListIds={initialListIds} />
      </div>

      {/* Mobile: sticky bar above the bottom nav */}
      <div
        className="sm:hidden fixed left-0 right-0 z-30 px-4 pt-3 border-t border-white/10"
        style={{
          bottom: "calc(3.5rem + env(safe-area-inset-bottom))",
          background: "#1c1208",
        }}
      >
        <div className="flex gap-2 pb-3">
          <div className="flex-1">
            <AddToLibraryButton
              bookId={bookId}
              initialStatus={initialStatus as any}
              initialFinishedAt={initialFinishedAt}
            />
          </div>
          <AddToListButton bookId={bookId} lists={lists} initialListIds={initialListIds} />
        </div>
      </div>
    </>
  )
}
