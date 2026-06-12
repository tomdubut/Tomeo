import { redirect } from "next/navigation"

interface Props {
  params: Promise<{ username: string }>
}

export default async function UserProfilePage({ params }: Props) {
  const { username } = await params
  redirect(`/users/${username}/library`)
}
