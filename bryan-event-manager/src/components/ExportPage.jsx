export default function ExportPage({ stats, onExport, disabled }) {
  return (
    <div className="max-w-2xl">
      <div className="bg-white rounded-xl border p-6 sm:p-8">
        <h2 className="text-lg font-semibold text-gray-900 mb-2">Export CSV partecipanti</h2>
        <p className="text-sm text-gray-600 mb-6">
          Scarica un file CSV con tutti i partecipanti, stato (Check-in / No-show) e data/ora del check-in.
          Utile per report post-evento.
        </p>

        <div className="grid grid-cols-3 gap-3 mb-6">
          <MiniStat label="Totale" value={stats.total} />
          <MiniStat label="Check-in" value={stats.checked} valueClass="text-ok" />
          <MiniStat label="No-show" value={stats.missing} valueClass="text-danger" />
        </div>

        <button
          onClick={onExport}
          disabled={disabled}
          className="w-full sm:w-auto px-5 py-3 bg-brand text-white font-medium rounded-lg hover:bg-brand-hover disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Scarica CSV
        </button>

        <div className="mt-6 text-xs text-gray-500">
          <p className="font-medium mb-1">Colonne incluse:</p>
          <ul className="list-disc pl-5 space-y-0.5">
            <li>Nome</li>
            <li>Cognome</li>
            <li>Email</li>
            <li>Stato (Check-in / No-show)</li>
            <li>Data Check-in</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

function MiniStat({ label, value, valueClass = 'text-gray-900' }) {
  return (
    <div className="bg-gray-50 rounded-lg p-3 border">
      <div className="text-xs text-gray-500">{label}</div>
      <div className={`text-xl font-bold ${valueClass}`}>{value}</div>
    </div>
  );
}
