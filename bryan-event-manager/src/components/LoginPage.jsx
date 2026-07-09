import { useState } from 'react';

export default function LoginPage({ onLogin, verifying, verifyError }) {
  const [email, setEmail] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const trimmed = email.trim().toLowerCase();
    if (!trimmed || !trimmed.includes('@')) {
      setError('Enter a valid email address');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: trimmed }),
      });
      const data = await res.json();
      if (data.ok) {
        setSent(true);
      } else {
        setError(data.error || 'Access denied');
      }
    } catch (err) {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Show verifying state when App is processing a magic link token from URL
  if (verifying) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="w-full max-w-sm text-center">
          <div className="w-10 h-10 mx-auto mb-4 border-4 border-gray-200 border-t-brand rounded-full animate-spin" />
          <p className="text-sm text-gray-600">Logging you in...</p>
          {verifyError && (
            <div className="mt-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">
              {verifyError}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Event Manager</h1>
          <p className="text-sm text-gray-500 mt-2">
            {sent ? 'Check your inbox' : 'Enter your email to receive a login link'}
          </p>
        </div>

        {sent ? (
          <div className="bg-white rounded-xl border p-6 text-center space-y-4">
            <div className="w-14 h-14 mx-auto bg-brand/10 rounded-full flex items-center justify-center">
              <MailIcon />
            </div>
            <div>
              <p className="text-sm text-gray-700 font-medium">Magic link sent!</p>
              <p className="text-sm text-gray-500 mt-1">
                We sent a login link to <strong>{email}</strong>. Click the link in the email to access the app.
              </p>
            </div>
            <p className="text-xs text-gray-400">The link expires in 15 minutes.</p>
            <button
              onClick={() => { setSent(false); setError(null); }}
              className="text-sm text-brand hover:underline"
            >
              Use a different email
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="bg-white rounded-xl border p-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                required
                autoFocus
                className="w-full px-3 py-2.5 border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand/50 focus:border-brand text-sm"
              />
            </div>

            {error && (
              <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full px-4 py-2.5 bg-brand text-white text-sm font-medium rounded-lg hover:bg-brand-hover disabled:opacity-50"
            >
              {loading ? 'Sending...' : 'Send login link'}
            </button>
          </form>
        )}

        <p className="text-xs text-gray-400 text-center mt-6">
          Only authorized emails can access the app. Contact your administrator for access.
        </p>
      </div>
    </div>
  );
}

function MailIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#4f46e5" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <path d="M22 7l-10 7L2 7" />
    </svg>
  );
}
