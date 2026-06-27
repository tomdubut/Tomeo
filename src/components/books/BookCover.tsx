"use client"

import Image from "next/image"
import { useState } from "react"
import { cn } from "@/lib/utils"
import { getBookColor } from "@/lib/utils/profileColor"

interface Props {
  src: string | null
  title: string
  author?: string
  isbn?: string
  className?: string
  sizes?: string
}

function ColoredPlaceholder({ title, author, className }: Pick<Props, "title" | "author" | "className">) {
  const bg = getBookColor(title)
  return (
    <div
      className={cn("relative overflow-hidden rounded-md flex flex-col items-center justify-center gap-1 p-[8%] text-center [container-type:inline-size]", className)}
      style={{ background: bg }}
    >
      <p className="text-white font-bold leading-tight line-clamp-4" style={{ fontSize: "clamp(0.5rem, 14cqi, 1rem)" }}>
        {title}
      </p>
      {author && (
        <p className="text-white/70 font-semibold leading-tight line-clamp-2" style={{ fontSize: "clamp(0.4rem, 10cqi, 0.75rem)" }}>
          {author}
        </p>
      )}
    </div>
  )
}

export default function BookCover({ src, title, author, isbn, className, sizes }: Props) {
  const olFallback = isbn ? `https://covers.openlibrary.org/b/isbn/${isbn}-L.jpg` : null
  const [currentSrc, setCurrentSrc] = useState(src)
  const [failed, setFailed] = useState(false)

  function handleError() {
    if (currentSrc !== olFallback && olFallback) {
      setCurrentSrc(olFallback)
    } else {
      setFailed(true)
    }
  }

  function handleLoad(e: React.SyntheticEvent<HTMLImageElement>) {
    const img = e.currentTarget
    // Google's "image not available" placeholder is exactly 1×1 or very narrow
    // Real book covers are always wider than 50px
    if (img.naturalWidth > 0 && img.naturalWidth < 50) {
      handleError()
    }
  }

  if (!currentSrc || failed) {
    return <ColoredPlaceholder title={title} author={author} className={className} />
  }

  return (
    <div className={cn("relative overflow-hidden rounded-md", className)}>
      <Image
        src={currentSrc}
        alt={`Couverture de ${title}`}
        fill
        className="object-cover"
        sizes={sizes ?? "(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 16vw"}
        unoptimized
        onError={handleError}
        onLoad={handleLoad}
      />
    </div>
  )
}
