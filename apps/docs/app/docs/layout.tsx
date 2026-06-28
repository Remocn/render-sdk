import { source } from '@/lib/source';
import { DocsLayout } from 'fumadocs-ui/layouts/notebook';
import { baseOptions } from '@/lib/layout.shared';

export default function Layout({ children }: LayoutProps<'/docs'>) {
  const base = baseOptions();
  return (
    <DocsLayout
      tree={source.getPageTree()}
      tabMode="navbar"
      sidebar={{
        collapsible: false,
        className: "sm:bg-transparent! border-r! xl:border-r-0!",
      }}
      {...base}
      nav={{ ...base.nav, mode: 'top' }}
    >
      {children}
    </DocsLayout>
  );
}
