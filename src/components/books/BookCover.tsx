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
  googleBooksId?: string
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

export default function BookCover({ src, title, author, isbn, googleBooksId, className, sizes }: Props) {
  const googleFallback = googleBooksId
    ? `https://books.google.com/books/publisher/content/images/frontcover/${googleBooksId}?fife=w400-h600`
    : null
  const olFallback = isbn ? `https://covers.openlibrary.org/b/isbn/${isbn}-L.jpg` : null
  const [currentSrc, setCurrentSrc] = useState(src ?? googleFallback ?? olFallback)
  const [failed, setFailed] = useState(false)

  function handleError() {
    if (currentSrc !== googleFallback && googleFallback) {
      setCurrentSrc(googleFallback)
    } else if (currentSrc !== olFallback && olFallback) {
      setCurrentSrc(olFallback)
    } else {
      setFailed(true)
    }
  }

  function handleLoad(e: React.SyntheticEvent<HTMLImageElement>) {
    const img = e.currentTarget
    const w = img.naturalWidth
    const h = img.naturalHeight
    // Google's "image not available" placeholder at zoom=1 is 128×193, at zoom=2 is 256×386
    if ((w === 128 && h === 193) || (w === 256 && h === 386) || (w <= 1 && h <= 1)) {
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
