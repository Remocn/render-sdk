import type { DocData } from "fumadocs-mdx/runtime/types";
import {
  DocsBody,
  DocsDescription,
  DocsPage,
  DocsTitle,
  MarkdownCopyButton,
  ViewOptionsPopover,
} from "fumadocs-ui/layouts/notebook/page";
import { createRelativeLink } from "fumadocs-ui/mdx";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getMDXComponents } from "@/components/mdx";
import { gitConfig } from "@/lib/shared";
import { getPageImage, getPageMarkdownUrl, source } from "@/lib/source";

export default async function Page(props: PageProps<"/docs/[[...slug]]">) {
  const params = await props.params;
  const page = source.getPage(params.slug);

  if (!page) {
    if (!params.slug || params.slug.length === 0) {
      redirect("/docs/general");
    }
    notFound();
  }

  const data = page.data as typeof page.data & DocData & { full?: boolean };
  const MDX = data.body;
  const markdownUrl = getPageMarkdownUrl(page).url;

  return (
    <DocsPage full={data.full} toc={data.toc}>
      <DocsTitle>{data.title}</DocsTitle>
      <DocsDescription className="mb-0">{data.description}</DocsDescription>
      <div className="flex flex-row items-center gap-2 border-b pb-6">
        <MarkdownCopyButton markdownUrl={markdownUrl} />
        <ViewOptionsPopover
          githubUrl={`https://github.com/${gitConfig.user}/${gitConfig.repo}/blob/${gitConfig.branch}/apps/docs/content/docs/${page.path}`}
          markdownUrl={markdownUrl}
        />
      </div>
      <DocsBody>
        <MDX
          components={getMDXComponents({
            a: createRelativeLink(source, page),
          })}
        />
      </DocsBody>
    </DocsPage>
  );
}

export async function generateStaticParams() {
  return source.generateParams();
}

export async function generateMetadata(
  props: PageProps<"/docs/[[...slug]]">
): Promise<Metadata> {
  const params = await props.params;
  const page = source.getPage(params.slug);
  if (!page) {
    // `/docs` (empty slug) redirects at request time; give it neutral metadata
    // instead of a 404 so the redirect in the page component can run.
    if (!params.slug || params.slug.length === 0) {
      return {};
    }
    notFound();
  }

  return {
    title: page.data.title,
    description: page.data.description,
    openGraph: {
      images: getPageImage(page).url,
    },
  };
}
