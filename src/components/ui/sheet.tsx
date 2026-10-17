"use client"

import * as Dialog from "@radix-ui/react-dialog"
import { X } from "lucide-react"
import { cn } from "@/lib/utils"

/** Panel that slides up from the bottom on phones and opens as a centred dialog on larger screens. */
export function Sheet({
  open,
  onOpenChange,
  title,
  children,
  footer,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  children: React.ReactNode
  footer?: React.ReactNode
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-foreground/40" />
        <Dialog.Content
          className={cn(
            "fixed z-50 flex max-h-[85dvh] flex-col bg-card text-card-foreground shadow-lg focus:outline-none",
            "inset-x-0 bottom-0 rounded-t-2xl pb-[env(safe-area-inset-bottom)]",
            "sm:inset-x-auto sm:bottom-auto sm:left-1/2 sm:top-1/2 sm:w-full sm:max-w-md sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl"
          )}
        >
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <Dialog.Title className="text-base font-bold">{title}</Dialog.Title>
            <Dialog.Close className="rounded-lg p-1 text-muted-foreground hover:bg-secondary hover:text-foreground" aria-label="Fermer">
              <X className="h-5 w-5" />
            </Dialog.Close>
          </div>
          <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
          {footer && <div className="border-t border-border px-5 py-3">{footer}</div>}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
