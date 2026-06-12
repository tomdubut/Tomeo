import { notFound, redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { updateList } from "@/app/(main)/lists/actions"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import Link from "next/link"

interface Props {
  params: Promise<{ id: string }>
}

export default async function EditListPage({ params }: Props) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const { data: list } = await supabase
    .from("lists")
    .select("id, title, description, is_public, user_id")
    .eq("id", id)
    .eq("user_id", user.id)
    .single()

  if (!list) notFound()

  async function handleUpdate(formData: FormData) {
    "use server"
    await updateList(id, formData)
  }

  return (
    <div className="max-w-lg mx-auto">
      <h1 className="text-2xl font-semibold mb-6">Modifier la liste</h1>
      <Card>
        <CardHeader>
          <CardTitle>Informations</CardTitle>
        </CardHeader>
        <form>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="title">Titre</Label>
              <Input
                id="title"
                name="title"
                defaultValue={list.title}
                required
                maxLength={100}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="description">
                Description{" "}
                <span className="text-[--muted-foreground] font-normal">(facultatif)</span>
              </Label>
              <textarea
                id="description"
                name="description"
                defaultValue={list.description ?? ""}
                maxLength={1000}
                rows={3}
                className="flex w-full rounded-md border border-[--border] bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-[--muted-foreground] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--ring] resize-none"
                placeholder="Décrivez votre liste…"
              />
            </div>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                name="is_public"
                defaultChecked={list.is_public}
                className="rounded border-[--border]"
              />
              <span>Liste publique</span>
            </label>
          </CardContent>
          <CardFooter className="flex gap-3">
            <Button formAction={handleUpdate}>Enregistrer</Button>
            <Button variant="outline" asChild>
              <Link href={`/lists/${list.id}`}>Annuler</Link>
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  )
}
