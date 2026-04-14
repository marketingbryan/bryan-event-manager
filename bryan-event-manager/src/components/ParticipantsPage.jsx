import { useMemo, useRef, useState } from 'react';
import Papa from 'papaparse';

export default function ParticipantsPage({ participants, loading, onCheckin, onUpload, onReset, hasData }) {
  const [filter, setFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [busy, setBusy] = useState(null); // email currently being processed
  const [uploadError, setUploadError] = useState(null);
  const fileRef = useRef(null);

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    return participants.filter((p) => {
      if (statusFilter === 'checked' && !p.checked_in) return false;
      if (statusFilter === 'noshow' && p.checked_in) return false;
      if (!q) return true;
      return (
        (p.first_name || '').toLowerCase().includes(q) ||
        (p.last_name || '').toLowerCase().includes(q) ||
        (p.email || '').toLowerCase().includes(q)
      );
    });
  }, [participants, filter, statusFilter]);

  const handleFile = (e) => {
    setUploadError(null);
    const file = e.target.files?.[0];
    if (!file) return;

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h) => h.trim().toLowerCase(),
      complete: (results) => {
        const rows = results.data
          .map((r) => ({
            first_name: r.nome || r.first_name || r.firstname || r.name || '',
            last_name: r.cognome || r.last_name || r.lastname || r.surname || '',
            email: r.email || r.mail || r['e-mail'] || '',
          }))
          .filter((r) => r.email);
        if (rows.length === 0) {
          setUploadError('Nessuna riga valida trovata. Colonne attese: nome, cognome, email.');
          return;
        }
        onUpload(rows);
        if (fileRef.current) fileRef.current.value = '';
      },
      error: (err) => setUploadError(`Errore lettura CSV: ${err.message}`),
    });
  };

  const handleAction = async (email, action) => {
    setBusy(email);
    try {
      await onCheckin(email, action);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl border p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
          <div>
            <h2 className="text-base font-semibold text-gray-900">Carica partecipanti</h2>
            <p className="text-sm text-gray-500">CSV con colonne: <code className="text-xs bg-gray-100 px-1 rounded">nome</code>, <code className="text-xs bg-gray-100 px-1 rounded">cognome</code>, <code className="text-xs bg-gray-100 px-1 rounded">email</code></p>
          </div>
          <div className="flex gap-2">
            <label className="px-4 py-2 bg-brand text-white text-sm font-medium rounded-lg hover:bg-brand-hover cursor-pointer">
              Scegli CSV
              <input ref={fileRef} type="file" accept=".csv,text/csv" onChange={handleFile} className="hidden" />
            </label>
            {hasData && (
              <button
                onClick={onReset}
                className="px-4 py-2 bg-white border border-red-300 text-red-600 text-sm font-medium rounded-lg hover:bg-red-50"
              >
                Azzera lista
              </button>
            )}
          </div>
        </div>
        {uploadError && (
          <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">{uploadError}</div>
        )}
      </div>

      <div className="bg-white rounded-xl border">
        <div className="p-4 border-b flex flex-col sm:flex-row gap-3">
          <input
            type="text"
            placeholder="Cerca nome, cognome o email..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="flex-1 px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand/50 focus:border-brand"
          />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 border rounded-lg bg-white"
          >
            <option value="all">Tutti ({participants.length})</option>
            <option value="checked">Check-in ({participants.filter((p) => p.checked_in).length})</option>
            <option value="noshow">No-show ({participants.filter((p) => !p.checked_in).length})</option>
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600 text-left">
              <tr>
                <th className="px-4 py-3 font-medium">Nome</th>
                <th className="px-4 py-3 font-medium">Cognome</th>
                <th className="px-4 py-3 font-medium hidden md:table-cell">Email</th>
                <th className="px-4 py-3 font-medium">Stato</th>
                <th className="px-4 py-3 font-medium text-right">Azione</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {loading ? (
                <tr><td colSpan={5} className="px-4 py-10 text-center text-gray-400">Caricamento...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={5} className="px-4 py-10 text-center text-gray-400">
                  {participants.length === 0 ? 'Nessun partecipante. Carica un CSV per iniziare.' : 'Nessun risultato per questa ricerca.'}
                </td></tr>
              ) : (
                filtered.map((p) => (
                  <tr key={p.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">{p.first_name}</td>
                    <td className="px-4 py-3 text-gray-900">{p.last_name}</td>
                    <td className="px-4 py-3 text-gray-600 hidden md:table-cell">{p.email}</td>
                    <td className="px-4 py-3">
                      {p.checked_in ? (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          Check-in
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                          No-show
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {p.checked_in ? (
                        <button
                          disabled={busy === p.email}
                          onClick={() => handleAction(p.email, 'check-out')}
                          className="text-sm px-3 py-1.5 border border-gray-300 rounded-lg hover:bg-gray-100 disabled:opacity-50"
                        >
                          Annulla
                        </button>
                      ) : (
                        <button
                          disabled={busy === p.email}
                          onClick={() => handleAction(p.email, 'check-in')}
                          className="text-sm px-3 py-1.5 bg-brand text-white rounded-lg hover:bg-brand-hover disabled:opacity-50"
                        >
                          Check-in
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
