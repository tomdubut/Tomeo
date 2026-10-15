"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"

// Turnstile token added to the form by <Turnstile /> (Supabase Auth CAPTCHA protection)
function captchaToken(formData: FormData): string | undefined {
  const token = formData.get("cf-turnstile-response")
  return typeof token === "string" && token ? token : undefined
}

function authErrorMessage(message: string): string {
  return /captcha/i.test(message)
    ? "La vérification anti-robot a échoué. Merci de réessayer."
    : message
}

export async function login(formData: FormData) {
  const supabase = await createClient()

  const { error } = await supabase.auth.signInWithPassword({
    email: formData.get("email") as string,
    password: formData.get("password") as string,
    options: { captchaToken: captchaToken(formData) },
  })

  if (error) {
    redirect(`/login?error=${encodeURIComponent(authErrorMessage(error.message))}`)
  }

  revalidatePath("/", "layout")
  redirect("/books")
}

export async function register(formData: FormData) {
  const supabase = await createClient()

  const { error } = await supabase.auth.signUp({
    email: formData.get("email") as string,
    password: formData.get("password") as string,
    options: { captchaToken: captchaToken(formData) },
  })

  if (error) {
    redirect(`/register?error=${encodeURIComponent(authErrorMessage(error.message))}`)
  }

  revalidatePath("/", "layout")
  redirect("/onboarding")
}

export async function forgotPassword(formData: FormData) {
  const supabase = await createClient()
  const email = formData.get("email") as string

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/callback?next=/reset-password`,
    captchaToken: captchaToken(formData),
  })

  if (error) {
    redirect(`/forgot-password?error=${encodeURIComponent(authErrorMessage(error.message))}`)
  }

  redirect("/forgot-password?sent=1")
}

export async function resetPassword(formData: FormData) {
  const supabase = await createClient()
  const password = formData.get("password") as string

  const { error } = await supabase.auth.updateUser({ password })

  if (error) {
    redirect(`/reset-password?error=${encodeURIComponent(error.message)}`)
  }

  revalidatePath("/", "layout")
  redirect("/books")
}

export async function logout() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  revalidatePath("/", "layout")
  redirect("/login")
}
