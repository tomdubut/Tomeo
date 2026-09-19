// TODO: HTTP endpoint for importing a book from Google Books by ID.
// The importBook server action (books/actions.ts) handles this today — this route
// is a placeholder for a future public/webhook-facing import endpoint.
export async function POST() {
  return new Response("Not implemented", { status: 501 })
}
