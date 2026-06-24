import { useRef, useState, useCallback } from 'react';
import Tesseract from 'tesseract.js';

/**
 * Extract usable text lines from raw OCR output.
 */
function extractLines(raw) {
  return raw
    .split('\n')
    .map((l) => l.replace(/\s{2,}/g, ' ').trim())
    .filter((l) => {
      if (l.length < 2) return false;
      // Keep lines that have at least some real letters/digits
      const useful = l.replace(/[^a-zA-ZÀ-ÿ@0-9]/g, '');
      return useful.length >= 2;
    });
}

/**
 * Auto-detect email from a list of OCR lines.
 */
function findEmail(lines) {
  for (const line of lines) {
    const m = line.match(/([a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,})/);
    if (m) return m[1].toLowerCase();
  }
  return '';
}

// Field definitions for the interactive picker
const FIELDS = [
  { key: 'first_name', label: 'First Name', color: 'bg-rose-100 text-rose-700 border-rose-300', ring: 'ring-rose-400' },
  { key: 'last_name', label: 'Last Name', color: 'bg-amber-100 text-amber-700 border-amber-300', ring: 'ring-amber-400' },
  { key: 'email', label: 'Email', color: 'bg-sky-100 text-sky-700 border-sky-300', ring: 'ring-sky-400' },
  { key: 'company', label: 'Company', color: 'bg-emerald-100 text-emerald-700 border-emerald-300', ring: 'ring-emerald-400' },
  { key: 'role', label: 'Role', color: 'bg-violet-100 text-violet-700 border-violet-300', ring: 'ring-violet-400' },
];

export default function BusinessCardScanner({ onResult, onClose }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const [phase, setPhase] = useState('idle'); // idle | camera | processing | done
  const [progress, setProgress] = useState(0);
  const [photoUrl, setPhotoUrl] = useState(null); // data URL of the captured/uploaded photo
  const [ocrLines, setOcrLines] = useState([]);
  const [fields, setFields] = useState({ first_name: '', last_name: '', email: '', company: '', role: '' });
  const [activeField, setActiveField] = useState('first_name');
  const [error, setError] = useState(null);
  const [showOcrLines, setShowOcrLines] = useState(false);

  const startCamera = useCallback(async () => {
    setError(null);
    setPhase('camera');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
    } catch (e) {
      setError(`Unable to access camera: ${e.message}. Please check browser permissions.`);
      setPhase('idle');
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  }, []);

  const runOCR = useCallback(async (imageSource) => {
    setPhase('processing');
    setProgress(0);
    try {
      const { data } = await Tesseract.recognize(imageSource, 'eng+ita', {
        logger: (m) => {
          if (m.status === 'recognizing text') {
            setProgress(Math.round(m.progress * 100));
          }
        },
      });
      const lines = extractLines(data.text);
      setOcrLines(lines);

      // Auto-fill email if found
      const email = findEmail(lines);
      setFields({ first_name: '', last_name: '', email, company: '', role: '' });
      setActiveField('first_name');
      setPhase('done');
    } catch (e) {
      setError(`OCR failed: ${e.message}`);
      setPhase('idle');
    }
  }, []);

  const captureAndProcess = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0);
    stopCamera();

    // Save original photo for display (no preprocessing — send raw to Tesseract)
    const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
    setPhotoUrl(dataUrl);
    await runOCR(dataUrl);
  }, [stopCamera, runOCR]);

  const handleFileUpload = useCallback(async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);

    // Show the uploaded image and send it straight to Tesseract
    const url = URL.createObjectURL(file);
    setPhotoUrl(url);
    await runOCR(file);
  }, [runOCR]);

  const handleLineTap = (line) => {
    if (!activeField) return;
    // If tapping a line while "first_name" is active and the line has 2+ words, auto-split
    if (activeField === 'first_name') {
      const parts = line.split(/\s+/);
      if (parts.length >= 2) {
        setFields((f) => ({ ...f, first_name: parts[0], last_name: parts.slice(1).join(' ') }));
        // Advance to next empty field after last_name
        const nextEmpty = ['email', 'company', 'role'].find((k) => !fields[k] && !(k === 'email' && findEmail(ocrLines)));
        setActiveField(nextEmpty || 'company');
        return;
      }
    }
    setFields((f) => ({ ...f, [activeField]: line }));
    // Auto-advance to next empty field
    const order = ['first_name', 'last_name', 'email', 'company', 'role'];
    const currentIdx = order.indexOf(activeField);
    for (let i = currentIdx + 1; i < order.length; i++) {
      if (!fields[order[i]]) {
        setActiveField(order[i]);
        return;
      }
    }
  };

  const handleConfirm = () => {
    onResult(fields);
  };

  const handleCancel = () => {
    stopCamera();
    onClose();
  };

  const handleReset = () => {
    setPhase('idle');
    setOcrLines([]);
    setPhotoUrl(null);
    setFields({ first_name: '', last_name: '', email: '', company: '', role: '' });
    setShowOcrLines(false);
  };

  const activeFieldDef = FIELDS.find((f) => f.key === activeField);

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="p-4 border-b flex items-center justify-between">
          <h3 className="font-semibold text-gray-900">Scan Business Card</h3>
          <button onClick={handleCancel} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
        </div>

        <div className="p-4 space-y-4">
          {/* ── IDLE: choose capture method ── */}
          {phase === 'idle' && (
            <>
              <p className="text-sm text-gray-600">
                Take a photo of a business card or upload an image to extract contact details.
              </p>
              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  onClick={startCamera}
                  className="flex-1 px-4 py-3 bg-brand text-white text-sm font-medium rounded-lg hover:bg-brand-hover flex items-center justify-center gap-2"
                >
                  <CameraIcon /> Use Camera
                </button>
                <label className="flex-1 px-4 py-3 bg-white border text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 cursor-pointer flex items-center justify-center gap-2">
                  <PhotoIcon /> Upload Image
                  <input type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />
                </label>
              </div>
            </>
          )}

          {/* ── CAMERA: live viewfinder ── */}
          {phase === 'camera' && (
            <>
              <div className="relative bg-black rounded-lg overflow-hidden">
                <video ref={videoRef} className="w-full" autoPlay playsInline muted />
                <div className="absolute inset-0 border-2 border-white/30 rounded-lg pointer-events-none" />
              </div>
              <button
                onClick={captureAndProcess}
                className="w-full px-4 py-3 bg-brand text-white text-sm font-medium rounded-lg hover:bg-brand-hover"
              >
                Capture Photo
              </button>
            </>
          )}

          {/* ── PROCESSING: spinner ── */}
          {phase === 'processing' && (
            <div className="py-8 text-center">
              <div className="w-12 h-12 mx-auto mb-4 border-4 border-gray-200 border-t-brand rounded-full animate-spin" />
              <p className="text-sm text-gray-600">Reading text from image...</p>
              <p className="text-xs text-gray-400 mt-1">{progress}%</p>
            </div>
          )}

          {/* ── DONE: photo + fields ── */}
          {phase === 'done' && (
            <>
              {/* Photo preview — the user reads from this */}
              {photoUrl && (
                <div className="rounded-lg overflow-hidden border bg-gray-100">
                  <img src={photoUrl} alt="Business card" className="w-full object-contain max-h-48" />
                </div>
              )}

              <p className="text-xs text-gray-500">
                Read the card above and fill in the fields below. You can type directly or tap a detected text line to fill a field.
              </p>

              {/* ── Editable fields ── */}
              <div className="space-y-2">
                {FIELDS.map((f) => (
                  <div key={f.key} className="flex items-center gap-2">
                    <button
                      onClick={() => setActiveField(f.key)}
                      className={`w-24 shrink-0 text-xs font-medium px-2 py-1.5 rounded border text-center transition-all ${
                        activeField === f.key
                          ? f.color + ' ring-2 ring-offset-1 ' + f.ring
                          : 'bg-gray-50 text-gray-500 border-gray-200'
                      }`}
                    >
                      {f.label}
                    </button>
                    <input
                      type="text"
                      value={fields[f.key]}
                      onFocus={() => setActiveField(f.key)}
                      onChange={(e) => setFields((prev) => ({ ...prev, [f.key]: e.target.value }))}
                      placeholder={f.label}
                      className="flex-1 px-2 py-1.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand/50 focus:border-brand"
                    />
                    {fields[f.key] && (
                      <button
                        onClick={() => setFields((prev) => ({ ...prev, [f.key]: '' }))}
                        className="text-gray-300 hover:text-gray-500 text-lg leading-none px-1"
                        title="Clear"
                      >&times;</button>
                    )}
                  </div>
                ))}
              </div>

              {/* ── OCR text lines (collapsible) ── */}
              {ocrLines.length > 0 && (
                <div>
                  <button
                    onClick={() => setShowOcrLines((v) => !v)}
                    className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1"
                  >
                    <span>{showOcrLines ? '▾' : '▸'}</span>
                    {showOcrLines ? 'Hide' : 'Show'} detected text ({ocrLines.length} lines)
                    {' — '}tap to fill{' '}
                    <span className={`inline px-1 py-0.5 rounded text-xs font-medium ${activeFieldDef?.color || ''}`}>
                      {activeFieldDef?.label || ''}
                    </span>
                  </button>
                  {showOcrLines && (
                    <div className="mt-2 space-y-1 max-h-36 overflow-y-auto">
                      {ocrLines.map((line, i) => (
                        <button
                          key={i}
                          onClick={() => handleLineTap(line)}
                          className="w-full text-left px-3 py-1.5 rounded border border-gray-200 text-sm text-gray-700
                            hover:bg-gray-50 hover:border-gray-400 active:bg-gray-100 transition-colors"
                        >
                          {line}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* ── Actions ── */}
              <div className="flex gap-3 pt-1">
                <button
                  onClick={handleConfirm}
                  className="flex-1 px-4 py-2 bg-brand text-white text-sm font-medium rounded-lg hover:bg-brand-hover"
                >
                  Use these details
                </button>
                <button
                  onClick={handleReset}
                  className="px-4 py-2 bg-white border text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50"
                >
                  Retry
                </button>
              </div>
            </>
          )}

          {error && (
            <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">{error}</div>
          )}
        </div>

        <canvas ref={canvasRef} className="hidden" />
      </div>
    </div>
  );
}

function CameraIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
      <circle cx="12" cy="13" r="4" />
    </svg>
  );
}

function PhotoIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <polyline points="21 15 16 10 5 21" />
    </svg>
  );
}
