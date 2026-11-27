import { createFileRoute, notFound } from "@tanstack/react-router"
import { createServerFn } from "@tanstack/react-start"
import matter from "gray-matter"
import { marked } from "marked"
import { z } from "zod"

import { NavigationBar } from "~/app/_components/map/navigation-bar"
import legal from "~/content/mentions-legales.md?raw"
import privacy from "~/content/politique-de-confidentialite.md?raw"

const legalPages = {
  "mentions-legales": legal,
  "politique-de-confidentialite": privacy,
}

const getPage = createServerFn({ method: "GET" })
  .validator(z.string())
  .handler(async ({ data: slug }) => {
    const source = Object.hasOwn(legalPages, slug)
      ? legalPages[slug as keyof typeof legalPages]
      : undefined
    if (!source) return null
    const { data, content } = matter(source)
    return {
      title: typeof data.title === "string" ? data.title : undefined,
      date: typeof data.date === "string" ? data.date : undefined,
      description:
        typeof data.description === "string" ? data.description : undefined,
      html: await marked(content),
    }
  })

export const Route = createFileRoute("/$slug")({
  loader: async ({ params }) => {
    const page = await getPage({ data: params.slug })
    // TanStack Router uses a structured object to trigger the route 404.
    // eslint-disable-next-line @typescript-eslint/only-throw-error
    if (!page) throw notFound()
    return page
  },
  head: ({ loaderData }) => ({
    meta: [
      ...(loaderData?.title ? [{ title: loaderData.title }] : []),
      ...(loaderData?.description
        ? [{ name: "description", content: loaderData.description }]
        : []),
    ],
  }),
  component: LegalPage,
})

function LegalPage() {
  const { title, date, html } = Route.useLoaderData()
  return (
    <div className="container px-4 py-8">
      <NavigationBar />
      {title && <h1 className="mb-4 text-4xl font-bold">{title}</h1>}
      {date && <p className="mb-8 text-gray-600">{date}</p>}
      <article
        className="prose prose-xl"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  )
}
