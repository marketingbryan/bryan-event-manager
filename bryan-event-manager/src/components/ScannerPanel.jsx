import { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';

// Extract email from decoded QR text.
// Expected format: https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=<email>
// Also supports plain emails or "mailto:<email>" URLs.
function extractEmail(text) {
  if (!text) return null;
  const trimmed = String(text).trim();
  // Try URL with `data` parameter
  try {
    const url = new URL(trimmed);
    const dataParam = url.searchParams.get('data');
    if (dataParam && dataParam.includes('@')) return decodeURIComponent(dataParam).trim().toLowerCase();
  } catch (_) {}
  // mailto:
  if (trimmed.toLowerCase().startsWith('mailto:')) {
    return trimmed.slice(7).split('?')[0].trim().toLowerCase();
  }
  // Plain email
  const emailMatch = trimmed.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
  if (emailMatch) return emailMatch[1].toLowerCase();
  return null;
}

export default function ScannerPanel({ onEmail }) {
  const scannerRef = useRef(null);
  const html5Ref = useRef(null);
  const lastScanRef = useRef({ text: null, time: 0 });
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState(null);
  const [history, setHistory] = useState([]);
  const [manualEmail, setManualEmail] = useState('');

  useEffect(() => {
    return () => {
      stopScanner();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startScanner = async () => {
    setError(null);
    try {
      const id = 'qr-reader';
      html5Ref.current = new Html5Qrcode(id);
      await html5Ref.current.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        handleDecoded,
        () => {}
      );
      setScanning(true);
    } catch (e) {
      setError(`Impossibile avviare la fotocamera: ${e.message || e}. Verifica i permessi del browser.`);
      html5Ref.current = null;
    }
  };

  const stopScanner = async () => {
    if (html5Ref.current) {
      try {
        await html5Ref.current.stop();
        await html5Ref.current.clear();
      } catch (_) {}
      html5Ref.current = null;
    }
    setScanning(false);
  };

  const handleDecoded = async (text) => {
    const now = Date.now();
    if (lastScanRef.current.text === text && now - lastScanRef.current.time < 3000) return;
    lastScanRef.current = { text, time: now };

    const email = extractEmail(text);
    if (!email) {
      addHistory({ email: null, raw: text, status: 'error', message: 'QR non valido' });
      return;
    }

    const res = await onEmail(email);
    if (res && res.ok) {
      addHistory({
        email,
        raw: text,
        status: res.alreadyCheckedIn ? 'already' : 'ok',
        name: `${res.participant.first_name} ${res.participant.last_name}`,
      });
    } else {
      addHistory({ email, raw: text, status: 'error', message: res?.error || 'Non trovato' });
    }
  };

  const addHistory = (entry) => {
    setHistory((h) => [{ ...entry, at: new Date() }, ...h].slice(0, 20));
  };

  const handleManualSubmit = async (e) => {
    e.preventDefault();
    const email = manualEmail.trim().toLowerCase();
    if (!email || !email.includes('@')) {
      setError('Inserisci un indirizzo email valido');
      return;
    }
    setError(null);
    const res = await onEmail(email);
    if (res && res.ok) {
      addHistory({
        email,
        raw: email,
        status: res.alreadyCheckedIn ? 'already' : 'ok',
        name: `${res.participant.first_name} ${res.participant.last_name}`,
      });
      setManualEmail('');
    } else {
      addHistory({ email, raw: email, status: 'error', message: res?.error || 'Non trovato' });
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="bg-white rounded-xl border p-4 sm:p-6">
        <h2 className="text-base font-semibold text-gray-900 mb-3">Scanner QR</h2>
        <p className="text-sm text-gray-500 mb-4">
          Inquadra il QR code del partecipante per fare il check-in automatico.
        </p>

        <div
          id="qr-reader"
          ref={scannerRef}
          className="w-full aspect-square bg-gray-900 rounded-lg overflow-hidden"
          style={{ maxWidth: 400 }}
        />

        <div className="mt-4 flex gap-2">
          {!scanning ? (
            <button
              onClick={startScanner}
              className="px-4 py-2 bg-brand text-white text-sm font-medium rounded-lg hover:bg-brand-hover"
            >
              Avvia scanner
            </button>
          ) : (
            <button
              onClick={stopScanner}
              className="px-4 py-2 bg-white border text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-100"
            >
              Ferma scanner
            </button>
          )}
        </div>

        {error && (
          <div className="mt-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">{error}</div>
        )}

        <form onSubmit={handleManualSubmit} className="mt-5 pt-5 border-t">
          <label className="block text-sm font-medium text-gray-700 mb-2">Check-in manuale via email</label>
          <div className="flex gap-2">
            <input
              type="email"
              value={manualEmail}
              onChange={(e) => setManualEmail(e.target.value)}
              placeholder="email@esempio.it"
              className="flex-1 px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand/50 focus:border-brand"
            />
            <button
              type="submit"
              className="px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800"
            >
              Check-in
            </button>
          </div>
        </form>
      </div>

      <div className="bg-white rounded-xl border p-4 sm:p-6">
        <h2 className="text-base font-semibold text-gray-900 mb-3">Ultime scansioni</h2>
        {history.length === 0 ? (
          <p className="text-sm text-gray-400">Nessuna scansione ancora.</p>
        ) : (
          <ul className="space-y-2">
            {history.map((h, i) => (
              <li
                key={i}
                className={`p-3 rounded-lg border text-sm ${
                  h.status === 'ok'
                    ? 'bg-green-50 border-green-200'
                    : h.status === 'already'
                    ? 'bg-amber-50 border-amber-200'
                    : 'bg-red-50 border-red-200'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-medium text-gray-900">
                      {h.name || h.email || 'QR non valido'}
                    </div>
                    <div className="text-xs text-gray-600 mt-0.5">
                      {h.status === 'ok' && 'Check-in completato'}
                      {h.status === 'already' && 'Gi\u00e0 fatto check-in'}
                      {h.status === 'error' && (h.message || 'Errore')}
                    </div>
                  </div>
                  <div className="text-xs text-gray-400 whitespace-nowrap">
                    {h.at.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
