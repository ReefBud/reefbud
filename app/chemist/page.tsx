import { notFound } from 'next/navigation';

export const dynamic = 'force-static';

/** Chemist tab removed. */
export default function Page() {
  notFound();
}
