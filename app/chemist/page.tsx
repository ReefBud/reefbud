export const dynamic = 'force-static';
export default function Page() {
  // Return 404 to fully remove Chemist page if the route is visited.
  return <div className="p-6"><h1 className="text-2xl font-semibold">404 — Not Found</h1><p className="text-sm text-gray-600">The Chemist page has been removed.</p></div>;
}
