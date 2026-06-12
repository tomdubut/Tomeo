import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { createList } from "@/app/(main)/lists/actions"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"

export default async function NewListPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  return (
    <div className="max-w-lg mx-auto">
      <h1 className="text-2xl font-semibold mb-6">Créer une liste</h1>
      <Card>
        <CardHeader>
          <CardTitle>Nouvelle liste</CardTitle>
          <CardDescription>
            Organisez vos livres en collections thématiques et partagez-les.
          </CardDescription>
        </CardHeader>
        <form>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="title">Titre</Label>
              <Input
                id="title"
                name="title"
                placeholder="Ex : Mes romans préférés de 2024"
                required
                maxLength={100}
                autoFocus
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
                defaultChecked={true}
                className="rounded border-[--border]"
              />
              <span>Liste publique</span>
            </label>
          </CardContent>
          <CardFooter>
            <Button formAction={createList}>Créer la liste</Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  )
}
