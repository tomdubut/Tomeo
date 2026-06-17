import Link from "next/link"
import { login } from "../actions"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"

interface Props {
  searchParams: Promise<{ error?: string; message?: string }>
}

export default async function LoginPage({ searchParams }: Props) {
  const { error, message } = await searchParams

  return (
    <div className="flex min-h-screen items-center justify-center bg-[--muted] px-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Tomeo</CardTitle>
          <CardDescription>Connectez-vous à votre compte</CardDescription>
        </CardHeader>
        <form>
          <CardContent className="space-y-4">
            {message === "check_email" && (
              <p className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-700">
                Un email de confirmation vous a été envoyé. Cliquez sur le lien pour activer votre compte.
              </p>
            )}
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
                autoComplete="current-password"
              />
            </div>
          </CardContent>
          <CardFooter className="flex flex-col gap-3">
            <Button formAction={login} className="w-full">
              Se connecter
            </Button>
            <p className="text-center text-sm text-[--muted-foreground]">
              Pas encore de compte ?{" "}
              <Link href="/register" className="font-medium underline underline-offset-4">
                S&apos;inscrire
              </Link>
            </p>
          </CardFooter>
        </form>
      </Card>
    </div>
  )
}
