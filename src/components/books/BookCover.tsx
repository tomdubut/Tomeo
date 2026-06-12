import Image from "next/image"
import { BookOpen } from "lucide-react"
import { cn } from "@/lib/utils"

interface Props {
  src: string | null
  title: string
  className?: string
  sizes?: string
}

export default function BookCover({ src, title, className, sizes }: Props) {
  if (!src) {
    return (
      <div
        className={cn(
          "flex items-center justify-center bg-[--secondary] rounded-md",
          className
        )}
      >
        <BookOpen className="h-8 w-8 text-[--muted-foreground]" />
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
        unoptimized // Google Books URLs don't need Next.js optimisation
      />
    </div>
  )
}
