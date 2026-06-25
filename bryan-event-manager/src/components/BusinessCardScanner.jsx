import { useRef, useState, useCallback } from 'react';

// Field definitions
const FIELDS = [
  { key: 'first_name', label: 'First Name', color: 'bg-rose-100 text-rose-700 border-rose-300', ring: 'ring-rose-400' },
  { key: 'last_name', label: 'Last Name', color: 'bg-amber-100 text-amber-700 border-amber-300', ring: 'ring-amber-400' },
  { key: 'email', label: 'Email', color: 'bg-sky-100 text-sky-700 border-sky-300', ring: 'ring-sky-400' },
  { key: 'company', label: 'Company', color: 'bg-emerald-100 text-emerald-700 border-emerald-300', ring: 'ring-emerald-400' },
  { key: 'role', label: 'Role', color: 'bg-violet-100 text-violet-700 border-violet-300', ring: 'ring-violet-400' },
];

/**
 * Convert a file or canvas to a base64 data URL.
 */
function canvasToDataUrl(canvas) {
  return canvas.toDataURL('image/jpeg', 0.85);
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function BusinessCardScanner({ onResult, onClose }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const [phase, setPhase] = useState('idle'); // idle | camera | processing | done
  const [photoUrl, setPhotoUrl] = useState(null);
  const [fields, setFields] = useState({ first_name: '', last_name: '', email: '', company: '', role: '' });
  const [error, setError] = useState(null);

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

  const analyzeImage = useCallback(async (dataUrl) => {
    setPhase('processing');
    setError(null);
    try {
      const res = await fetch('/api/scan-card', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: dataUrl }),
      });
      const data = await res.json();
      if (data.ok && data.fields) {
        setFields(data.fields);
        setPhase('done');
      } else {
        setError(data.error || 'Failed to analyze image');
        setPhase('done');
      }
    } catch (e) {
      setError(`Network error: ${e.message}`);
      setPhase('done');
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

    const dataUrl = canvasToDataUrl(canvas);
    setPhotoUrl(dataUrl);
    await analyzeImage(dataUrl);
  }, [stopCamera, analyzeImage]);

  const handleFileUpload = useCallback(async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    try {
      const dataUrl = await fileToDataUrl(file);
      setPhotoUrl(dataUrl);
      await analyzeImage(dataUrl);
    } catch (err) {
      setError('Could not read file');
    }
  }, [analyzeImage]);

  const handleConfirm = () => {
    onResult(fields);
  };

  const handleCancel = () => {
    stopCamera();
    onClose();
  };

  const handleReset = () => {
    setPhase('idle');
    setPhotoUrl(null);
    setFields({ first_name: '', last_name: '', email: '', company: '', role: '' });
    setError(null);
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="p-4 border-b flex items-center justify-between">
          <h3 className="font-semibold text-gray-900">Scan Business Card</h3>
          <button onClick={handleCancel} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
        </div>

        <div className="p-4 space-y-4">
          {/* ── IDLE ── */}
          {phase === 'idle' && (
            <>
              <p className="text-sm text-gray-600">
                Take a photo of a business card or upload an image to automatically extract contact details.
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

          {/* ── CAMERA ── */}
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

          {/* ── PROCESSING ── */}
          {phase === 'processing' && (
            <div className="py-8 text-center">
              {photoUrl && (
                <div className="rounded-lg overflow-hidden border bg-gray-100 mb-4">
                  <img src={photoUrl} alt="Business card" className="w-full object-contain max-h-40" />
                </div>
              )}
              <div className="w-10 h-10 mx-auto mb-3 border-4 border-gray-200 border-t-brand rounded-full animate-spin" />
              <p className="text-sm text-gray-600">Analyzing business card...</p>
              <p className="text-xs text-gray-400 mt-1">AI is reading the card</p>
            </div>
          )}

          {/* ── DONE ── */}
          {phase === 'done' && (
            <>
              {/* Photo preview */}
              {photoUrl && (
                <div className="rounded-lg overflow-hidden border bg-gray-100">
                  <img src={photoUrl} alt="Business card" className="w-full object-contain max-h-44" />
                </div>
              )}

              {error && (
                <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">{error}</div>
              )}

              {!error && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-800">
                  Details extracted. Review and edit if needed, then click "Use these details".
                </div>
              )}

              {/* Editable fields */}
              <div className="space-y-2">
                {FIELDS.map((f) => (
                  <div key={f.key} className="flex items-center gap-2">
                    <span className={`w-24 shrink-0 text-xs font-medium px-2 py-1.5 rounded border text-center ${f.color}`}>
                      {f.label}
                    </span>
                    <input
                      type="text"
                      value={fields[f.key]}
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

              {/* Actions */}
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

          {phase === 'idle' && error && (
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
