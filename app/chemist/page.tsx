export const dynamic = 'force-static';

export default function Page() {
  // Hard 404 to fully remove Chemist tab functionality
  return <div className="p-6"><h1 className="text-2xl font-semibold">404</h1><p className="text-sm text-gray-600">This page no longer exists.</p></div>;
}
