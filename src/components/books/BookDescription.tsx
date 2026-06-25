"use client"

import { useState } from "react"

const COLLAPSE_THRESHOLD = 400 // characters before truncating

interface Props {
  description: string
}

export default function BookDescription({ description }: Props) {
  const clean = description.replace(/<[^>]*>/g, "").trim()
  const needsCollapse = clean.length > COLLAPSE_THRESHOLD
  const [expanded, setExpanded] = useState(false)

  const text = needsCollapse && !expanded ? clean.slice(0, COLLAPSE_THRESHOLD).trimEnd() + "…" : clean

  return (
    <div>
      <h2 className="text-lg font-semibold mb-2">Résumé</h2>
      <p className="text-sm leading-relaxed whitespace-pre-wrap">{text}</p>
      {needsCollapse && (
        <button
          onClick={() => setExpanded((v) => !v)}
          className="mt-2 text-sm font-semibold hover:underline"
          style={{ color: "var(--primary)" }}
        >
          {expanded ? "Lire moins" : "Lire la suite"}
        </button>
      )}
    </div>
  )
}
