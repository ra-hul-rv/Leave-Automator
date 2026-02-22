import HolidayCalendar from './components/HolidayCalendar';

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 py-8">
      <main className="container mx-auto px-4">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            🗓️ Indian IT Holidays Planner
          </h1>
          <p className="text-lg text-gray-600">
            Plan your perfect vacation by making the most of optional holidays and bridge leaves.
          </p>
          <p className="text-sm text-amber-600 mt-2">
            ⚠️ Always verify holiday dates against your company&apos;s official calendar before applying for leave.
          </p>
        </div>
        
        <HolidayCalendar year={2026} />
      </main>
    </div>
  );
}
