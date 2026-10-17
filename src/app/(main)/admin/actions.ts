"use server"

import { revalidatePath } from "next/cache"
import { requireAdmin } from "@/lib/admin"
import { isUuid } from "@/lib/validation"

const FEEDBACK_STATUSES = ["new", "planned", "done", "ignored"]
const REPORT_STATUSES = ["new", "fixed", "ignored"]

export async function setFeedbackStatus(id: string, status: string) {
  const { admin } = await requireAdmin()
  if (!isUuid(id) || !FEEDBACK_STATUSES.includes(status)) return { error: "Requête invalide." }
  const { error } = await admin.from("feedback").update({ status }).eq("id", id)
  if (error) return { error: error.message }
  revalidatePath("/admin", "layout")
  return {}
}

export async function setReportStatus(id: string, status: string) {
  const { admin } = await requireAdmin()
  if (!isUuid(id) || !REPORT_STATUSES.includes(status)) return { error: "Requête invalide." }
  const { error } = await admin.from("content_reports").update({ status }).eq("id", id)
  if (error) return { error: error.message }
  revalidatePath("/admin", "layout")
  return {}
}
