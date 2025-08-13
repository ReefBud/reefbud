import { notFound } from 'next/navigation';

export const dynamic = 'force-static';

/** Chemist tab is removed. */
export default function Page() {
  notFound();
}
