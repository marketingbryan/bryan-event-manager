import { useEffect, useMemo, useState, useCallback } from 'react';
import Papa from 'papaparse';
import Sidebar from './components/Sidebar.jsx';
import Dashboard from './components/Dashboard.jsx';
import ParticipantsPage from './components/ParticipantsPage.jsx';
import ScannerPanel from './components/ScannerPanel.jsx';
import ExportPage from './components/ExportPage.jsx';
import Toast from './components/Toast.jsx';

const API = {
  list: () => fetch('/api/participants').then((r) => r.json()),
  upload: (participants) =>
    fetch('/api/participants', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ participants }),
    }).then((r) => r.json()),
  reset: () =>
    fetch('/api/participants', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ confirm: true }),
    }).then((r) => r.json()),
  checkin: (email, action) =>
    fetch('/api/checkin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, action }),
    }).then((r) => r.json()),
};

const PAGE_TITLES = {
  dashboard: 'Dashboard evento',
  participants: 'Partecipanti',
  scanner: 'Scanner QR',
  export: 'Export',
};

export default function App() {
  const [page, setPage] = useState('dashboard');
  const [participants, setParticipants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const showToast = useCallback((type, message) => {
    setToast({ type, message, id: Date.now() });
    setTimeout(() => setToast(null), 3500);
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const data = await API.list();
      setParticipants(data.participants || []);
    } catch (e) {
      showToast('error', 'Errore nel caricamento partecipanti');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const stats = useMemo(() => {
    const total = participants.length;
    const checked = participants.filter((p) => p.checked_in).length;
    const missing = total - checked;
    const pct = total === 0 ? 0 : Math.round((checked / total) * 100);
    return { total, checked, missing, pct };
  }, [participants]);

  const handleUpload = async (rows) => {
    const res = await API.upload(rows);
    if (res.error) {
      showToast('error', res.error);
    } else {
      showToast(
        'success',
        `Caricati ${res.inserted} partecipanti${res.skipped ? ` (${res.skipped} duplicati)` : ''}`
      );
      await refresh();
      setPage('participants');
    }
  };

  const handleReset = async () => {
    if (!confirm('Sei sicuro di voler cancellare tutti i partecipanti? Questa azione non \u00e8 reversibile.')) return;
    const res = await API.reset();
    if (res.ok) {
      showToast('success', 'Lista partecipanti azzerata');
      await refresh();
    } else {
      showToast('error', res.error || 'Errore');
    }
  };

  const handleCheckin = async (email, action) => {
    const res = await API.checkin(email, action);
    if (res.ok) {
      if (res.alreadyCheckedIn) {
        showToast('info', `${res.participant.first_name} ${res.participant.last_name} ha gi\u00e0 fatto check-in`);
      } else if (action === 'check-out') {
        showToast('info', `Check-in annullato per ${res.participant.first_name} ${res.participant.last_name}`);
      } else {
        showToast('success', `Check-in: ${res.participant.first_name} ${res.participant.last_name}`);
      }
      await refresh();
      return res;
    } else {
      showToast('error', res.error || 'Partecipante non trovato');
      return res;
    }
  };

  const handleExport = () => {
    const data = participants.map((p) => ({
      Nome: p.first_name,
      Cognome: p.last_name,
      Email: p.email,
      Stato: p.checked_in ? 'Check-in' : 'No-show',
      DataCheckin: p.checked_in_at ? new Date(p.checked_in_at).toLocaleString('it-IT') : '',
    }));
    const csv = Papa.unparse(data);
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const today = new Date().toISOString().slice(0, 10);
    link.href = url;
    link.download = `bryan-event-export-${today}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showToast('success', 'Export completato');
  };

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <Sidebar
        current={page}
        onNavigate={(p) => {
          setPage(p);
          setSidebarOpen(false);
        }}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      <div className="flex-1 flex flex-col min-w-0 lg:ml-64">
        <header className="bg-white border-b sticky top-0 z-20">
          <div className="px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <button
                className="lg:hidden p-2 -ml-2 text-gray-600"
                onClick={() => setSidebarOpen(true)}
                aria-label="Apri menu"
              >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" />
                </svg>
              </button>
              <h1 className="text-lg sm:text-xl font-semibold text-gray-900">{PAGE_TITLES[page]}</h1>
            </div>
            {page !== 'scanner' && (
              <button
                onClick={handleExport}
                disabled={participants.length === 0}
                className="px-4 py-2 bg-brand text-white text-sm font-medium rounded-lg hover:bg-brand-hover disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Export CSV
              </button>
            )}
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6 lg:p-8">
          {page === 'dashboard' && (
            <Dashboard stats={stats} participants={participants} loading={loading} />
          )}
          {page === 'participants' && (
            <ParticipantsPage
              participants={participants}
              loading={loading}
              onCheckin={handleCheckin}
              onUpload={handleUpload}
              onReset={handleReset}
              hasData={stats.total > 0}
            />
          )}
          {page === 'scanner' && (
            <ScannerPanel onEmail={(email) => handleCheckin(email, 'check-in')} />
          )}
          {page === 'export' && (
            <ExportPage stats={stats} onExport={handleExport} disabled={participants.length === 0} />
          )}
        </main>
      </div>

      {toast && <Toast type={toast.type} message={toast.message} />}
    </div>
  );
}
