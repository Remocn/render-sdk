import { redirect } from 'next/navigation';

// No marketing landing page — the root goes straight to the documentation.
// `/docs` itself has no index page (every page lives under a tab folder), so we
// land on the first tab's page.
export default function RootPage() {
  redirect('/docs/general');
}
