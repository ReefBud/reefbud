// app/results/page.server.example.tsx
import dynamic from 'next/dynamic';

const ResultsChartExample = dynamic(() => import('./ResultsChart.example'), { ssr: false });

async function fetchReadings(): Promise<{ id: string; measured_at: string; value: number }[]> {
  // Replace with your real fetch. These are placeholders so the page renders.
  return [
    { id: '00000000-0000-0000-0000-000000000001', measured_at: new Date().toISOString(), value: 8.2 },
    { id: '00000000-0000-0000-0000-000000000002', measured_at: new Date().toISOString(), value: 8.4 },
  ];
}

export default async function Page() {
  const initialReadings = await fetchReadings();
  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Results – demo</h1>
      <ResultsChartExample initialReadings={initialReadings} />
    </div>
  );
}
