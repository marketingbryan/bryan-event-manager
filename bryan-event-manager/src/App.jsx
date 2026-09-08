import { useEffect, useMemo, useState, useCallback } from 'react';
import Papa from 'papaparse';
import Sidebar from './components/Sidebar.jsx';
import Dashboard from './components/Dashboard.jsx';
import ParticipantsPage from './components/ParticipantsPage.jsx';
import ScannerPanel from './components/ScannerPanel.jsx';
import ExportPage from './components/ExportPage.jsx';
import Toast from './components/Toast.jsx';
import LoginPage from './components/LoginPage.jsx';
import AdminPage from './components/AdminPage.jsx';

const PAGE_TITLES = {
  dashboard: 'Event Dashboard',
  participants: 'Participants',
  scanner: 'QR Scanner',
  export: 'Export',
  admin: 'Admin',
};

export default function App() {
  /* ─── Auth state ─── */
  const [sessionToken, setSessionToken] = useState(() => localStorage.getItem('sessionToken'));
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem('user')); } catch { return null; }
  });
  const [verifying, setVerifying] = useState(false);
  const [verifyError, setVerifyError] = useState(null);

  /* ─── App state ─── */
  const [page, setPage] = useState('dashboard');
  const [participants, setParticipants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  /* ─── authFetch: wrapper that adds Bearer token to every request ─── */
  const authFetch = useCallback(async (url, opts = {}) => {
    const headers = { ...(opts.headers || {}) };
    if (sessionToken) {
      headers['Authorization'] = `Bearer ${sessionToken}`;
    }
    const res = await fetch(url, { ...opts, headers });
    // If the server says 401, the session is expired / invalid
    if (res.status === 401) {
      setSessionToken(null);
      setUser(null);
      localStorage.removeItem('sessionToken');
      localStorage.removeItem('user');
    }
    return res;
  }, [sessionToken]);

  /* ─── Login / Logout ─── */
  const handleLogin = useCallback((token, userData) => {
    setSessionToken(token);
    setUser(userData);
    localStorage.setItem('sessionToken', token);
    localStorage.setItem('user', JSON.stringify(userData));
  }, []);

  const handleLogout = useCallback(async () => {
    try {
      await authFetch('/api/auth/logout', { method: 'POST' });
    } catch (_) {}
    setSessionToken(null);
    setUser(null);
    localStorage.removeItem('sessionToken');
    localStorage.removeItem('user');
    setPage('dashboard');
    setParticipants([]);
  }, [authFetch]);

  /* ─── Handle magic link token from URL + validate existing session ─── */
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const magicToken = params.get('magic');

    if (magicToken) {
      // Remove token from URL without reload
      window.history.replaceState({}, '', window.location.pathname);
      setVerifying(true);
      (async () => {
        try {
          const res = await fetch('/api/auth/verify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token: magicToken }),
          });
          const data = await res.json();
          if (data.ok) {
            handleLogin(data.sessionToken, data.user);
          } else {
            setVerifyError(data.error || 'Invalid or expired link');
          }
        } catch (_) {
          setVerifyError('Network error');
        } finally {
          setVerifying(false);
        }
      })();
      return;
    }

    if (!sessionToken) { setLoading(false); return; }
    (async () => {
      try {
        const res = await fetch('/api/auth/me', {
          headers: { 'Authorization': `Bearer ${sessionToken}` },
        });
        const data = await res.json();
        if (data.ok) {
          setUser(data.user);
          localStorage.setItem('user', JSON.stringify(data.user));
        } else {
          setSessionToken(null);
          setUser(null);
          localStorage.removeItem('sessionToken');
          localStorage.removeItem('user');
        }
      } catch (_) {}
    })();
  }, []); // run once on mount

  /* ─── Toast helper ─── */
  const showToast = useCallback((type, message) => {
    setToast({ type, message, id: Date.now() });
    setTimeout(() => setToast(null), 3500);
  }, []);

  /* ─── Data fetching (uses authFetch) ─── */
  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await authFetch('/api/participants');
      if (res.status === 401) return;
      const data = await res.json();
      setParticipants(data.participants || []);
    } catch (e) {
      showToast('error', 'Failed to load participants');
    } finally {
      setLoading(false);
    }
  }, [authFetch, showToast]);

  useEffect(() => {
    if (sessionToken) refresh();
    else setLoading(false);
  }, [sessionToken, refresh]);

  /* ─── Stats ─── */
  const stats = useMemo(() => {
    const total = participants.length;
    const attended = participants.filter((p) => p.checked_in).length; // checked in (including checked out)
    const present = participants.filter((p) => p.checked_in && !p.checked_out).length; // currently present
    const left = participants.filter((p) => p.checked_in && p.checked_out).length; // checked out
    const missing = total - attended;
    const pct = total === 0 ? 0 : Math.round((attended / total) * 100);
    return { total, attended, present, left, missing, pct };
  }, [participants]);

  /* ─── Handlers ─── */
  const handleUpload = async (rows) => {
    const res = await authFetch('/api/participants', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ participants: rows }),
    });
    if (res.status === 401) return;
    const data = await res.json();
    if (data.error) {
      showToast('error', data.error);
    } else {
      showToast(
        'success',
        `Uploaded ${data.inserted} participant${data.inserted !== 1 ? 's' : ''}${data.skipped ? ` (${data.skipped} duplicate${data.skipped !== 1 ? 's' : ''})` : ''}`
      );
      await refresh();
      setPage('participants');
    }
  };

  const handleReset = async () => {
    if (!confirm('Are you sure you want to delete all participants? This action cannot be undone.')) return;
    const res = await authFetch('/api/participants', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ confirm: true }),
    });
    if (res.status === 401) return;
    const data = await res.json();
    if (data.ok) {
      showToast('success', 'Participant list cleared');
      await refresh();
    } else {
      showToast('error', data.error || 'Error');
    }
  };

  const handleCheckin = async (email, action, extra = {}) => {
    const res = await authFetch('/api/checkin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, action, ...extra }),
    });
    if (res.status === 401) return;
    const data = await res.json();
    if (data.ok) {
      const name = `${data.participant.first_name} ${data.participant.last_name}`;
      if (data.alreadyCheckedIn) {
        showToast('info', `${name} is already checked in`);
      } else if (action === 'undo') {
        showToast('info', `Check-in undone for ${name}`);
      } else if (action === 'check-out') {
        showToast('success', `${name} checked out`);
      } else {
        const label = data.created ? 'Added & checked in' : 'Checked in';
        showToast('success', `${label}: ${name}`);
      }
      await refresh();
      return data;
    } else {
      showToast('error', data.error || 'Participant not found');
      return data;
    }
  };

  const handleUpdateRsvp = async (email, rsvp) => {
    const res = await authFetch('/api/update-rsvp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, rsvp }),
    });
    if (res.status === 401) return;
    const data = await res.json();
    if (data.ok) {
      showToast('success', `${data.participant.first_name} ${data.participant.last_name} → ${rsvp}`);
      await refresh();
    } else {
      showToast('error', data.error || 'Failed to update RSVP');
    }
  };

  const handleExport = () => {
    const data = participants.map((p) => ({
      'First Name': p.first_name,
      'Last Name': p.last_name,
      Email: p.email,
      Phone: p.phone || '',
      Company: p.company || '',
      Role: p.role || '',
      RSVP: p.rsvp || 'Invited',
      Status: p.checked_in ? (p.checked_out ? 'Checked out' : 'Checked in') : 'No-show',
      'Check-in Time': p.checked_in_at ? new Date(p.checked_in_at).toLocaleString('en-GB') : '',
      'Check-out Time': p.checked_out_at ? new Date(p.checked_out_at).toLocaleString('en-GB') : '',
    }));
    const csv = Papa.unparse(data);
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const today = new Date().toISOString().slice(0, 10);
    link.href = url;
    link.download = `bryan-event-export-${today}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showToast('success', 'Export completed');
  };

  /* ─── Not logged in → show login ─── */
  if (!sessionToken || !user) {
    return <LoginPage onLogin={handleLogin} verifying={verifying} verifyError={verifyError} />;
  }

  /* ─── Logged in → full app ─── */
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
        user={user}
        onLogout={handleLogout}
      />

      <div className="flex-1 flex flex-col min-w-0 lg:ml-64">
        <header className="bg-white border-b sticky top-0 z-20">
          <div className="px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <button
                className="lg:hidden p-2 -ml-2 text-gray-600"
                onClick={() => setSidebarOpen(true)}
                aria-label="Open menu"
              >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" />
                </svg>
              </button>
              <h1 className="text-lg sm:text-xl font-semibold text-gray-900">{PAGE_TITLES[page] || 'Event Manager'}</h1>
            </div>
            {page !== 'scanner' && page !== 'admin' && (
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
              onUpdateRsvp={handleUpdateRsvp}
              hasData={stats.total > 0}
              authFetch={authFetch}
            />
          )}
          {page === 'scanner' && (
            <ScannerPanel
              onCheckin={(email, extra) => handleCheckin(email, 'check-in', extra)}
              authFetch={authFetch}
            />
          )}
          {page === 'export' && (
            <ExportPage stats={stats} onExport={handleExport} disabled={participants.length === 0} />
          )}
          {page === 'admin' && user.role === 'superadmin' && (
            <AdminPage authFetch={authFetch} currentUser={user} />
          )}
        </main>
      </div>

      {toast && <Toast type={toast.type} message={toast.message} />}
    </div>
  );
}
