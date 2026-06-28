import { DocsLayout } from "fumadocs-ui/layouts/notebook";
import { baseOptions } from "@/lib/layout.shared";
import { source } from "@/lib/source";

export default function Layout({ children }: LayoutProps<"/docs">) {
  const base = baseOptions();
  return (
    <DocsLayout
      sidebar={{
        collapsible: false,
        className: "sm:bg-transparent! border-r! xl:border-r-0!",
      }}
      tabMode="navbar"
      tree={source.getPageTree()}
      {...base}
      nav={{ ...base.nav, mode: "top" }}
    >
      {children}
    </DocsLayout>
  );
}
