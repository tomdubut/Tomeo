"use client"

import { useState, useRef } from "react"
import { setMangaVolumesRead } from "@/app/(main)/manga/actions"

interface Props {
  mangaId: string
  totalVolumes: number | null
  volumesRead: number | null
}

export default function MangaReadingProgress({ mangaId, totalVolumes, volumesRead: initial }: Props) {
  const [current, setCurrent] = useState(initial ?? 0)
  const [editing, setEditing] = useState(false)
  const [inputValue, setInputValue] = useState("")
  const inputRef = useRef<HTMLInputElement>(null)

  const percent = totalVolumes
    ? Math.min(100, Math.round((current / totalVolumes) * 100))
    : 0

  function startEdit() {
    setInputValue(current > 0 ? String(current) : "")
    setEditing(true)
    setTimeout(() => inputRef.current?.select(), 30)
  }

  async function commit(raw: string) {
    setEditing(false)
    const num = parseInt(raw)
    if (isNaN(num) || num < 0) return
    const clamped = totalVolumes ? Math.min(num, totalVolumes) : num
    setCurrent(clamped)
    await setMangaVolumesRead(mangaId, clamped)
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium text-[--muted-foreground]">Progression</span>

        <span className="text-[--muted-foreground]">
          {editing ? (
            <span className="flex items-center gap-1">
              <input
                ref={inputRef}
                type="number"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onBlur={(e) => commit(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") commit(inputValue)
                  if (e.key === "Escape") setEditing(false)
                }}
                min={0}
                max={totalVolumes ?? undefined}
                className="w-14 rounded-lg border border-[--border] bg-[--secondary] px-2 py-0.5 text-right text-sm outline-none focus:border-[--primary]"
              />
              {totalVolumes && <span>/ {totalVolumes} tomes</span>}
            </span>
          ) : (
            <button onClick={startEdit} className="tabular-nums hover:underline" title="Modifier">
              {totalVolumes
                ? current > 0
                  ? `${current} / ${totalVolumes} tomes`
                  : `— / ${totalVolumes} tomes`
                : current > 0
                  ? `Tome ${current}`
                  : "—"}
            </button>
          )}
        </span>
      </div>

      {totalVolumes && (
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-[--secondary]">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{ width: `${percent}%`, background: "var(--primary)" }}
          />
        </div>
      )}

      {current === 0 && (
        <p className="text-xs text-[--muted-foreground]">
          Tapez le numéro du tome pour suivre votre avancement.
        </p>
      )}
    </div>
  )
}
