import Link from "next/link"
import { register } from "../actions"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"

interface Props {
  searchParams: Promise<{ error?: string }>
}

export default async function RegisterPage({ searchParams }: Props) {
  const { error } = await searchParams

  return (
    <div className="flex min-h-screen items-center justify-center bg-[--muted] px-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Créer un compte</CardTitle>
          <CardDescription>Rejoignez la communauté Tomeo</CardDescription>
        </CardHeader>
        <form>
          <CardContent className="space-y-4">
            {error && (
              <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">
                {decodeURIComponent(error)}
              </p>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="vous@exemple.fr"
                required
                autoComplete="email"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Mot de passe</Label>
              <Input
                id="password"
                name="password"
                type="password"
                required
                autoComplete="new-password"
                minLength={8}
              />
              <p className="text-xs text-[--muted-foreground]">8 caractères minimum</p>
            </div>
          </CardContent>
          <CardFooter className="flex flex-col gap-3">
            <Button formAction={register} className="w-full">
              Créer mon compte
            </Button>
            <p className="text-center text-sm text-[--muted-foreground]">
              Déjà un compte ?{" "}
              <Link href="/login" className="font-medium underline underline-offset-4">
                Se connecter
              </Link>
            </p>
          </CardFooter>
        </form>
      </Card>
    </div>
  )
}
