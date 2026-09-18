import { notFound } from "next/navigation";
import { getMDXComponents } from "@/components/mdx-components";
import { DocsBody, DocsPage } from "fumadocs-ui/page";
import { source } from "@/lib/source";

export const revalidate = false;

export function generateStaticParams() {
  return source.getPages().map((page) => ({ slug: page.slugs }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug?: string[] }>;
}) {
  const { slug } = await params;
  const page = source.getPage(slug);
  if (!page) return;

  return {
    title: `${page.data.title} — Cossie Docs`,
    description: page.data.description,
    openGraph: {
      title: `${page.data.title} — Cossie Docs`,
      description: page.data.description,
      type: "article",
    },
  };
}

export default async function Page({
  params,
}: {
  params: Promise<{ slug?: string[] }>;
}) {
  const { slug } = await params;
  const page = source.getPage(slug);
  if (!page) notFound();

  const MDX = page.data.body;

  return (
    <DocsPage toc={page.data.toc} tableOfContent={{ enabled: page.data.toc.length > 2 }}>
      <DocsBody>
        <MDX components={getMDXComponents()} />
      </DocsBody>
    </DocsPage>
  );
}
