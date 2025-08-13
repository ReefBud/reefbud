import { redirect } from 'next/navigation';

export const dynamic = 'force-static';

/**
 * Chemist tab has been removed. Redirect to Products.
 */
export default function Page() {
  redirect('/products');
}
