import { useCallback, useEffect, useState } from 'react';

export default function AdminPage({ authFetch }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newEmail, setNewEmail] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await authFetch('/api/admin/list');
      const data = await res.json();
      if (data.ok) {
        setUsers(data.users);
      }
    } catch (e) {
      setError('Failed to load users');
    } finally {
      setLoading(false);
    }
  }, [authFetch]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const handleAdd = async (e) => {
    e.preventDefault();
    const email = newEmail.trim().toLowerCase();
    if (!email || !email.includes('@')) {
      setError('Enter a valid email');
      return;
    }
    setError(null);
    setSuccess(null);
    setSaving(true);
    try {
      const res = await authFetch('/api/admin/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (data.ok) {
        setSuccess(`${email} added successfully`);
        setNewEmail('');
        await loadUsers();
      } else {
        setError(data.error || 'Failed to add user');
      }
    } catch (e) {
      setError('Network error');
    } finally {
      setSaving(false);
      setTimeout(() => setSuccess(null), 3000);
    }
  };

  const handleRemove = async (email) => {
    if (!confirm(`Remove access for ${email}?`)) return;
    setError(null);
    try {
      const res = await authFetch('/api/admin/remove', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (data.ok) {
        setSuccess(`${email} removed`);
        await loadUsers();
      } else {
        setError(data.error || 'Failed to remove user');
      }
    } catch (e) {
      setError('Network error');
    } finally {
      setTimeout(() => setSuccess(null), 3000);
    }
  };

  const superadmins = users.filter((u) => u.role === 'superadmin');
  const admins = users.filter((u) => u.role === 'admin' && u.active);
  const inactive = users.filter((u) => u.role === 'admin' && !u.active);

  return (
    <div className="space-y-6">
      {/* Add admin form */}
      <div className="bg-white rounded-xl border p-4 sm:p-6">
        <h2 className="text-base font-semibold text-gray-900 mb-1">Add Admin</h2>
        <p className="text-sm text-gray-500 mb-4">Grant access to a new user (e.g., event hostess).</p>
        <form onSubmit={handleAdd} className="flex gap-3">
          <input
            type="email"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            placeholder="hostess@email.com"
            required
            className="flex-1 px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand/50 focus:border-brand text-sm"
          />
          <button
            type="submit"
            disabled={saving}
            className="px-4 py-2 bg-brand text-white text-sm font-medium rounded-lg hover:bg-brand-hover disabled:opacity-50 whitespace-nowrap"
          >
            {saving ? 'Adding...' : 'Add'}
          </button>
        </form>

        {error && (
          <div className="mt-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">{error}</div>
        )}
        {success && (
          <div className="mt-3 text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg p-3">{success}</div>
        )}
      </div>

      {/* Users list */}
      <div className="bg-white rounded-xl border">
        <div className="p-4 border-b">
          <h2 className="text-base font-semibold text-gray-900">Users</h2>
        </div>

        {loading ? (
          <div className="p-8 text-center text-gray-400">Loading...</div>
        ) : (
          <div className="divide-y">
            {/* Superadmins */}
            {superadmins.map((u) => (
              <div key={u.id} className="px-4 py-3 flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium text-gray-900">{u.email}</div>
                  <div className="text-xs text-gray-400">Added by {u.created_by || 'system'}</div>
                </div>
                <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                  Superadmin
                </span>
              </div>
            ))}

            {/* Active admins */}
            {admins.map((u) => (
              <div key={u.id} className="px-4 py-3 flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium text-gray-900">{u.email}</div>
                  <div className="text-xs text-gray-400">
                    Added by {u.created_by || '—'} · {new Date(u.created_at).toLocaleDateString('en-GB')}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                    Admin
                  </span>
                  <button
                    onClick={() => handleRemove(u.email)}
                    className="text-sm px-3 py-1.5 border border-red-300 text-red-600 rounded-lg hover:bg-red-50"
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}

            {admins.length === 0 && (
              <div className="px-4 py-6 text-center text-sm text-gray-400">
                No admins yet. Add an email above to grant access.
              </div>
            )}

            {/* Inactive admins (collapsed) */}
            {inactive.length > 0 && (
              <details className="px-4 py-3">
                <summary className="text-xs text-gray-400 cursor-pointer">
                  {inactive.length} removed user{inactive.length !== 1 ? 's' : ''}
                </summary>
                <div className="mt-2 space-y-2">
                  {inactive.map((u) => (
                    <div key={u.id} className="text-sm text-gray-400 line-through">{u.email}</div>
                  ))}
                </div>
              </details>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
