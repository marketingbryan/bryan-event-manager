import { useRef, useState, useCallback } from 'react';
import Tesseract from 'tesseract.js';

/**
 * Parse raw OCR text from a business card into structured fields.
 */
function parseCardText(raw) {
  const lines = raw
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 1);

  const result = { first_name: '', last_name: '', email: '', company: '', role: '' };

  // 1. Extract email
  for (const line of lines) {
    const emailMatch = line.match(/([a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,})/);
    if (emailMatch) {
      result.email = emailMatch[1].toLowerCase();
      break;
    }
  }

  // 2. Extract phone (just to skip it — not a field we need)
  const phonePattern = /[\+]?[\d\s\-().]{7,}/;

  // 3. Classify remaining lines
  const roleKeywords = /\b(ceo|cto|cfo|coo|cmo|vp|president|director|manager|head|lead|chief|founder|partner|analyst|consultant|engineer|developer|designer|coordinator|specialist|advisor|associate|assistant|intern|executive|officer)\b/i;
  const companyIndicators = /\b(inc|corp|ltd|llc|gmbh|srl|spa|sas|sarl|group|holdings|ventures|capital|labs|studio|agency|consulting|solutions|technologies|tech|digital|media|partners|co\.|company)\b/i;

  const candidateLines = lines.filter((l) => {
    // Skip lines that are just email, phone, URL, or very short
    if (l.includes('@')) return false;
    if (/^(www\.|http|https)/.test(l)) return false;
    if (phonePattern.test(l) && l.replace(/[\d\s\-+().]/g, '').length < 3) return false;
    if (l.length < 2) return false;
    return true;
  });

  let nameLine = null;
  let roleLine = null;
  let companyLine = null;

  for (const line of candidateLines) {
    if (!companyLine && companyIndicators.test(line)) {
      companyLine = line;
    } else if (!roleLine && roleKeywords.test(line)) {
      roleLine = line;
    } else if (!nameLine && /^[A-ZÀ-Ü]/.test(line) && line.split(/\s+/).length <= 4) {
      // Likely a name: starts with capital, 1-4 words
      nameLine = line;
    }
  }

  // If no name found yet, use first candidate line
  if (!nameLine && candidateLines.length > 0) {
    nameLine = candidateLines[0];
  }
  // If no company found and there are remaining lines, try the ones not used
  if (!companyLine) {
    const remaining = candidateLines.filter((l) => l !== nameLine && l !== roleLine);
    if (remaining.length > 0) companyLine = remaining[0];
  }
  if (!roleLine) {
    const remaining = candidateLines.filter((l) => l !== nameLine && l !== companyLine);
    if (remaining.length > 0) roleLine = remaining[0];
  }

  // Parse name
  if (nameLine) {
    const parts = nameLine.split(/\s+/);
    if (parts.length >= 2) {
      result.first_name = parts[0];
      result.last_name = parts.slice(1).join(' ');
    } else {
      result.first_name = parts[0] || '';
    }
  }

  if (companyLine) result.company = companyLine;
  if (roleLine) result.role = roleLine;

  return result;
}

export default function BusinessCardScanner({ onResult, onClose }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const [phase, setPhase] = useState('idle'); // idle | camera | processing | done
  const [progress, setProgress] = useState(0);
  const [rawText, setRawText] = useState('');
  const [parsed, setParsed] = useState(null);
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

  const captureAndProcess = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0);
    stopCamera();
    setPhase('processing');

    try {
      const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
      const { data } = await Tesseract.recognize(dataUrl, 'eng+ita', {
        logger: (m) => {
          if (m.status === 'recognizing text') {
            setProgress(Math.round(m.progress * 100));
          }
        },
      });
      setRawText(data.text);
      const result = parseCardText(data.text);
      setParsed(result);
      setPhase('done');
    } catch (e) {
      setError(`OCR failed: ${e.message}`);
      setPhase('idle');
    }
  }, [stopCamera]);

  const handleFileUpload = useCallback(async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setPhase('processing');
    try {
      const { data } = await Tesseract.recognize(file, 'eng+ita', {
        logger: (m) => {
          if (m.status === 'recognizing text') {
            setProgress(Math.round(m.progress * 100));
          }
        },
      });
      setRawText(data.text);
      const result = parseCardText(data.text);
      setParsed(result);
      setPhase('done');
    } catch (e) {
      setError(`OCR failed: ${e.message}`);
      setPhase('idle');
    }
  }, []);

  const handleConfirm = () => {
    if (parsed) {
      onResult(parsed);
    }
  };

  const handleCancel = () => {
    stopCamera();
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="p-4 border-b flex items-center justify-between">
          <h3 className="font-semibold text-gray-900">Scan Business Card</h3>
          <button onClick={handleCancel} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
        </div>

        <div className="p-4 space-y-4">
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

          {phase === 'processing' && (
            <div className="py-8 text-center">
              <div className="w-12 h-12 mx-auto mb-4 border-4 border-gray-200 border-t-brand rounded-full animate-spin" />
              <p className="text-sm text-gray-600">Reading text from image...</p>
              <p className="text-xs text-gray-400 mt-1">{progress}%</p>
            </div>
          )}

          {phase === 'done' && parsed && (
            <>
              <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-800">
                Text extracted successfully. Review the fields below and click "Use these details".
              </div>

              <div className="space-y-2">
                <PreviewField label="First Name" value={parsed.first_name} onChange={(v) => setParsed((p) => ({ ...p, first_name: v }))} />
                <PreviewField label="Last Name" value={parsed.last_name} onChange={(v) => setParsed((p) => ({ ...p, last_name: v }))} />
                <PreviewField label="Email" value={parsed.email} onChange={(v) => setParsed((p) => ({ ...p, email: v }))} />
                <PreviewField label="Company" value={parsed.company} onChange={(v) => setParsed((p) => ({ ...p, company: v }))} />
                <PreviewField label="Role" value={parsed.role} onChange={(v) => setParsed((p) => ({ ...p, role: v }))} />
              </div>

              <details className="text-xs">
                <summary className="text-gray-400 cursor-pointer">Show raw OCR text</summary>
                <pre className="mt-2 p-2 bg-gray-50 rounded text-gray-600 whitespace-pre-wrap">{rawText}</pre>
              </details>

              <div className="flex gap-3">
                <button
                  onClick={handleConfirm}
                  className="flex-1 px-4 py-2 bg-brand text-white text-sm font-medium rounded-lg hover:bg-brand-hover"
                >
                  Use these details
                </button>
                <button
                  onClick={() => { setPhase('idle'); setParsed(null); setRawText(''); }}
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

function PreviewField({ label, value, onChange }) {
  return (
    <div className="flex items-center gap-2">
      <label className="w-24 text-xs font-medium text-gray-500 shrink-0">{label}</label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="flex-1 px-2 py-1.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand/50 focus:border-brand"
      />
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
