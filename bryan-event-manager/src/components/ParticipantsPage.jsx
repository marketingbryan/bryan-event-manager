import { useMemo, useRef, useState } from 'react';
import Papa from 'papaparse';
import BusinessCardScanner from './BusinessCardScanner.jsx';

export default function ParticipantsPage({ participants, loading, onCheckin, onUpload, onReset, onUpdateRsvp, hasData }) {
  const [filter, setFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [busy, setBusy] = useState(null);
  const [uploadError, setUploadError] = useState(null);
  const [showManualForm, setShowManualForm] = useState(false);
  const [showCardScanner, setShowCardScanner] = useState(false);
  const [manualForm, setManualForm] = useState({ first_name: '', last_name: '', email: '', company: '', role: '', rsvp: 'Invited' });
  const [manualError, setManualError] = useState(null);
  const [manualSaving, setManualSaving] = useState(false);
  const [csvRsvp, setCsvRsvp] = useState('Invited');
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
        (p.email || '').toLowerCase().includes(q) ||
        (p.company || '').toLowerCase().includes(q) ||
        (p.role || '').toLowerCase().includes(q)
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
          .map((r) => {
            const rowRsvp = r.rsvp || r.stato || '';
            return {
              first_name: r.nome || r.first_name || r.firstname || r.name || '',
              last_name: r.cognome || r.last_name || r.lastname || r.surname || '',
              email: r.email || r.mail || r['e-mail'] || '',
              company: r.company || r.azienda || r.organization || r.org || '',
              role: r.role || r.ruolo || r.title || r.job_title || '',
              rsvp: rowRsvp || csvRsvp, // Use per-row if present, else the dropdown value
            };
          })
          .filter((r) => r.email);
        if (rows.length === 0) {
          setUploadError('No valid rows found. Expected columns: first_name, last_name, email (+ optional: company, role, rsvp).');
          return;
        }
        onUpload(rows);
        if (fileRef.current) fileRef.current.value = '';
      },
      error: (err) => setUploadError(`CSV read error: ${err.message}`),
    });
  };

  const handleManualAdd = async (e) => {
    e.preventDefault();
    setManualError(null);
    const { first_name, last_name, email } = manualForm;
    if (!first_name.trim() && !last_name.trim()) {
      setManualError('Enter at least a first or last name');
      return;
    }
    if (!email.trim() || !email.includes('@')) {
      setManualError('Enter a valid email address');
      return;
    }
    setManualSaving(true);
    try {
      await onUpload([{
        first_name: first_name.trim(),
        last_name: last_name.trim(),
        email: email.trim(),
        company: manualForm.company.trim(),
        role: manualForm.role.trim(),
        rsvp: manualForm.rsvp,
      }]);
      setManualForm({ first_name: '', last_name: '', email: '', company: '', role: '', rsvp: 'Invited' });
      setShowManualForm(false);
    } catch (err) {
      setManualError('Failed to save');
    } finally {
      setManualSaving(false);
    }
  };

  const handleCardResult = (data) => {
    setManualForm((f) => ({
      ...f,
      first_name: data.first_name || f.first_name,
      last_name: data.last_name || f.last_name,
      email: data.email || f.email,
      company: data.company || f.company,
      role: data.role || f.role,
    }));
    setShowCardScanner(false);
    setShowManualForm(true);
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
            <h2 className="text-base font-semibold text-gray-900">Upload Participants</h2>
            <p className="text-sm text-gray-500">CSV with columns: <code className="text-xs bg-gray-100 px-1 rounded">first_name</code>, <code className="text-xs bg-gray-100 px-1 rounded">last_name</code>, <code className="text-xs bg-gray-100 px-1 rounded">email</code>, <code className="text-xs bg-gray-100 px-1 rounded">company</code>, <code className="text-xs bg-gray-100 px-1 rounded">role</code></p>
          </div>
          <div className="flex gap-2 flex-wrap items-center">
            <select
              value={csvRsvp}
              onChange={(e) => setCsvRsvp(e.target.value)}
              className="px-3 py-2 border rounded-lg bg-white text-sm"
              title="Default RSVP status for CSV rows without an rsvp column"
            >
              <option value="Invited">Import as: Invited</option>
              <option value="Registered">Import as: Registered</option>
            </select>
            <label className="px-4 py-2 bg-brand text-white text-sm font-medium rounded-lg hover:bg-brand-hover cursor-pointer">
              Choose CSV
              <input ref={fileRef} type="file" accept=".csv,text/csv" onChange={handleFile} className="hidden" />
            </label>
            <button
              onClick={() => { setShowManualForm((v) => !v); setManualError(null); }}
              className="px-4 py-2 bg-white border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50"
            >
              {showManualForm ? 'Close' : '+ Add Manually'}
            </button>
            <button
              onClick={() => setShowCardScanner(true)}
              className="px-4 py-2 bg-white border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50"
              title="Scan a business card to pre-fill details"
            >
              Scan Card
            </button>
            {hasData && (
              <button
                onClick={onReset}
                className="px-4 py-2 bg-white border border-red-300 text-red-600 text-sm font-medium rounded-lg hover:bg-red-50"
              >
                Clear All
              </button>
            )}
          </div>
        </div>

        {showManualForm && (
          <form onSubmit={handleManualAdd} className="border-t pt-4 mt-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">First Name</label>
                <input
                  type="text"
                  value={manualForm.first_name}
                  onChange={(e) => setManualForm((f) => ({ ...f, first_name: e.target.value }))}
                  placeholder="Mario"
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand/50 focus:border-brand text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Last Name</label>
                <input
                  type="text"
                  value={manualForm.last_name}
                  onChange={(e) => setManualForm((f) => ({ ...f, last_name: e.target.value }))}
                  placeholder="Rossi"
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand/50 focus:border-brand text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Email</label>
                <input
                  type="email"
                  value={manualForm.email}
                  onChange={(e) => setManualForm((f) => ({ ...f, email: e.target.value }))}
                  placeholder="mario.rossi@example.com"
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand/50 focus:border-brand text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Company</label>
                <input
                  type="text"
                  value={manualForm.company}
                  onChange={(e) => setManualForm((f) => ({ ...f, company: e.target.value }))}
                  placeholder="Acme Inc."
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand/50 focus:border-brand text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Role</label>
                <input
                  type="text"
                  value={manualForm.role}
                  onChange={(e) => setManualForm((f) => ({ ...f, role: e.target.value }))}
                  placeholder="Marketing Manager"
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand/50 focus:border-brand text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">RSVP</label>
                <select
                  value={manualForm.rsvp}
                  onChange={(e) => setManualForm((f) => ({ ...f, rsvp: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-brand/50 focus:border-brand text-sm"
                >
                  <option value="Invited">Invited</option>
                  <option value="Registered">Registered</option>
                </select>
              </div>
            </div>
            <div className="mt-3 flex items-center gap-3">
              <button
                type="submit"
                disabled={manualSaving}
                className="px-4 py-2 bg-brand text-white text-sm font-medium rounded-lg hover:bg-brand-hover disabled:opacity-50"
              >
                {manualSaving ? 'Saving...' : 'Add Participant'}
              </button>
              {manualError && <span className="text-sm text-red-600">{manualError}</span>}
            </div>
          </form>
        )}

        {uploadError && (
          <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3 mt-4">{uploadError}</div>
        )}
      </div>

      <div className="bg-white rounded-xl border">
        <div className="p-4 border-b flex flex-col sm:flex-row gap-3">
          <input
            type="text"
            placeholder="Search name, email, company, role..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="flex-1 px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand/50 focus:border-brand"
          />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 border rounded-lg bg-white"
          >
            <option value="all">All ({participants.length})</option>
            <option value="checked">Checked in ({participants.filter((p) => p.checked_in).length})</option>
            <option value="noshow">No-show ({participants.filter((p) => !p.checked_in).length})</option>
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600 text-left">
              <tr>
                <th className="px-4 py-3 font-medium">First Name</th>
                <th className="px-4 py-3 font-medium">Last Name</th>
                <th className="px-4 py-3 font-medium hidden lg:table-cell">Email</th>
                <th className="px-4 py-3 font-medium hidden md:table-cell">Company</th>
                <th className="px-4 py-3 font-medium hidden md:table-cell">Role</th>
                <th className="px-4 py-3 font-medium hidden md:table-cell">RSVP</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {loading ? (
                <tr><td colSpan={8} className="px-4 py-10 text-center text-gray-400">Loading...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={8} className="px-4 py-10 text-center text-gray-400">
                  {participants.length === 0 ? 'No participants yet. Upload a CSV to get started.' : 'No results for this search.'}
                </td></tr>
              ) : (
                filtered.map((p) => (
                  <tr key={p.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">{p.first_name}</td>
                    <td className="px-4 py-3 text-gray-900">{p.last_name}</td>
                    <td className="px-4 py-3 text-gray-600 hidden lg:table-cell">{p.email}</td>
                    <td className="px-4 py-3 text-gray-600 hidden md:table-cell">{p.company || '—'}</td>
                    <td className="px-4 py-3 text-gray-600 hidden md:table-cell">{p.role || '—'}</td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <button
                        onClick={() => onUpdateRsvp(p.email, p.rsvp === 'Registered' ? 'Invited' : 'Registered')}
                        title={`Click to change to ${p.rsvp === 'Registered' ? 'Invited' : 'Registered'}`}
                        className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium cursor-pointer transition-colors ${
                          p.rsvp === 'Registered'
                            ? 'bg-blue-100 text-blue-800 hover:bg-blue-200'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                      >
                        {p.rsvp || 'Invited'}
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      {p.checked_in ? (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          Checked in
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
                          Undo
                        </button>
                      ) : (
                        <button
                          disabled={busy === p.email}
                          onClick={() => handleAction(p.email, 'check-in')}
                          className="text-sm px-3 py-1.5 bg-brand text-white rounded-lg hover:bg-brand-hover disabled:opacity-50"
                        >
                          Check in
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

      {showCardScanner && (
        <BusinessCardScanner
          onResult={handleCardResult}
          onClose={() => setShowCardScanner(false)}
        />
      )}
    </div>
  );
}
