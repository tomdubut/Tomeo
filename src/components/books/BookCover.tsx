import Image from "next/image"
import { cn } from "@/lib/utils"
import { getBookColor } from "@/lib/utils/profileColor"

interface Props {
  src: string | null
  title: string
  author?: string
  className?: string
  sizes?: string
}

export default function BookCover({ src, title, author, className, sizes }: Props) {
  if (!src) {
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

  return (
    <div className={cn("relative overflow-hidden rounded-md", className)}>
      <Image
        src={src}
        alt={`Couverture de ${title}`}
        fill
        className="object-cover"
        sizes={sizes ?? "(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 16vw"}
        unoptimized
      />
    </div>
  )
}
