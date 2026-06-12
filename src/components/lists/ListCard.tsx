import Link from "next/link"
import Image from "next/image"
import { BookOpen, Lock } from "lucide-react"

interface ListCardProps {
  list: {
    id: string
    title: string
    description: string | null
    is_public: boolean
    book_count?: number
    covers?: (string | null)[]
    owner?: { username: string; display_name: string | null }
  }
  showOwner?: boolean
}

export default function ListCard({ list, showOwner = false }: ListCardProps) {
  const covers = (list.covers ?? []).filter(Boolean).slice(0, 4)

  return (
    <Link href={`/lists/${list.id}`} className="group block">
      {/* Cover mosaic */}
      <div className="aspect-[3/2] rounded-2xl overflow-hidden bg-[--secondary] mb-3 relative" style={{ boxShadow: "var(--shadow-sm)" }}>
        {covers.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <BookOpen className="h-10 w-10 text-[--muted-foreground]" />
          </div>
        ) : covers.length < 4 ? (
          <Image
            src={covers[0]!}
            alt={list.title}
            fill
            className="object-cover group-hover:opacity-90 transition-opacity"
            unoptimized
            sizes="(max-width: 640px) 50vw, 33vw"
          />
        ) : (
          <div className="grid grid-cols-2 grid-rows-2 h-full">
            {covers.map((src, i) => (
              <div key={i} className="relative overflow-hidden">
                <Image
                  src={src!}
                  alt=""
                  fill
                  className="object-cover group-hover:opacity-90 transition-opacity"
                  unoptimized
                  sizes="25vw"
                />
              </div>
            ))}
          </div>
        )}
        {!list.is_public && (
          <div className="absolute top-2 right-2 rounded-full bg-black/60 p-1">
            <Lock className="h-3 w-3 text-white" />
          </div>
        )}
      </div>

      <p className="font-bold text-sm line-clamp-1 group-hover:underline">{list.title}</p>

      <div className="flex items-center gap-1.5 mt-0.5 text-xs text-[--muted-foreground]">
        {showOwner && list.owner && (
          <>
            <span>{list.owner.display_name ?? list.owner.username}</span>
            <span>·</span>
          </>
        )}
        <span>{list.book_count ?? 0} livre{(list.book_count ?? 0) !== 1 ? "s" : ""}</span>
      </div>

      {list.description && (
        <p className="text-xs text-[--muted-foreground] mt-1 line-clamp-2">{list.description}</p>
      )}
    </Link>
  )
}
