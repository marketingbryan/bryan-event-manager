export default function Toast({ type, message }) {
  const colors =
    type === 'success'
      ? 'bg-green-600'
      : type === 'error'
      ? 'bg-red-600'
      : type === 'info'
      ? 'bg-amber-600'
      : 'bg-gray-800';
  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 pointer-events-none">
      <div className={`${colors} text-white px-4 py-3 rounded-lg shadow-lg text-sm font-medium max-w-sm pointer-events-auto`}>
        {message}
      </div>
    </div>
  );
}
