import { useRef, useState, useCallback } from 'react';
import Tesseract from 'tesseract.js';

/**
 * Clean a single OCR line: fix common OCR artifacts.
 */
function cleanLine(line) {
  return line
    .replace(/[|]/g, 'l')         // OCR often reads l as |
    .replace(/[{}[\]]/g, '')      // stray brackets
    .replace(/\s{2,}/g, ' ')     // collapse whitespace
    .trim();
}

/**
 * Classify a line into a category with a confidence score.
 * Returns { type: 'junk'|'email'|'phone'|'url'|'address'|'name'|'role'|'company'|'unknown', score: number }
 */
function classifyLine(line, emailDomainHint) {
  // ── Email ──
  if (/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/.test(line)) {
    return { type: 'email', score: 1 };
  }

  // ── URL / website ──
  if (/^(www\.|http|https)/i.test(line) || /\.(com|org|net|it|eu|io|co)\b/i.test(line)) {
    // But not if it also looks like a company name with a domain suffix
    if (line.split(/\s+/).length <= 1) return { type: 'url', score: 1 };
  }

  // ── Phone / fax ──
  // A line is "phone" if it's mostly digits, dashes, parens, spaces, plus sign
  const digitsOnly = line.replace(/[^\d]/g, '');
  const nonDigitLetters = line.replace(/[\d\s\-+()./:,]/g, '');
  if (digitsOnly.length >= 6 && nonDigitLetters.length <= 5) {
    return { type: 'phone', score: 1 };
  }
  if (/\b(tel|phone|fax|cell|mob|whatsapp)\b[:\s]*/i.test(line)) {
    return { type: 'phone', score: 1 };
  }

  // ── Address (street, zip, city patterns) ──
  if (/\b\d{4,6}\b/.test(line) && /\b(via|viale|corso|piazza|strada|street|road|ave|blvd|suite|floor|piano)\b/i.test(line)) {
    return { type: 'address', score: 1 };
  }
  if (/\b(via|viale|corso|piazza|piazzale|strada|largo|vicolo)\s/i.test(line) && /\d/.test(line)) {
    return { type: 'address', score: 1 };
  }
  // ZIP code patterns (Italian CAP, US zip, etc.)
  if (/^\d{5}[\s,]/.test(line) || /\b\d{5}\s+[A-Z]/i.test(line)) {
    return { type: 'address', score: 0.8 };
  }

  // ── Junk: too short, too noisy ──
  if (line.length < 3) return { type: 'junk', score: 1 };
  // More than 40% non-letter characters → probably junk or a phone/code
  const letters = line.replace(/[^a-zA-ZÀ-ÿ]/g, '');
  if (letters.length < line.length * 0.5 && line.length > 3) {
    return { type: 'junk', score: 0.7 };
  }

  // ── Role / job title ──
  const roleKeywords = /\b(ceo|cto|cfo|coo|cmo|cdo|cio|cpo|vp|svp|evp|avp|president|vice\s*president|director|manager|managing|head\sof|lead|chief|founder|co[\-\s]?founder|partner|analyst|consultant|engineer|developer|designer|coordinator|specialist|advisor|associate|assistant|intern|executive|officer|responsabile|direttore|amministratore|delegato|socio|titolare|legale|rappresentante|professore|dott\.?|dr\.?|ing\.?|avv\.?|arch\.?|prof\.?|senior|junior|account|sales|marketing|finance|operations|strategy|business\sdevelopment|project|product|program|creative|art\sdirector|brand|communication|hr|human\sresources|legal|compliance|research|scientist|architect|planner|recruiter|buyer|procurement|logistics|supply\schain|quality|safety|sustainability|digital|data|software|devops|cloud|security|network|support|customer|client|service|success|growth|innovation|transformation)\b/i;
  const roleScore = (line.match(roleKeywords) || []).length;
  if (roleScore >= 1) {
    // If it's a short line with role keywords, high confidence
    const words = line.split(/\s+/);
    if (words.length <= 5) return { type: 'role', score: 0.7 + Math.min(roleScore * 0.1, 0.3) };
    // Longer line with role keyword — might be role or might be something else
    return { type: 'role', score: 0.5 };
  }

  // ── Company ──
  const companyIndicators = /\b(inc\.?|corp\.?|ltd\.?|llc|gmbh|srl|s\.r\.l\.?|spa|s\.p\.a\.?|sas|s\.a\.s\.?|sarl|snc|s\.n\.c\.?|s\.s\.?|group|gruppo|holdings|ventures|capital|labs|laboratory|studio|agency|agenzia|consulting|consultancy|solutions|technologies|technology|tech|digital|media|partners|co\.?|company|limited|enterprise|enterprises|services|international|global|systems|network|foundation|fondazione|associazione|onlus|cooperative|società)\b/i;
  const companyScore = (line.match(companyIndicators) || []).length;
  // Check if the email domain hint appears in this line
  let domainBoost = 0;
  if (emailDomainHint && emailDomainHint.length >= 3) {
    if (line.toLowerCase().includes(emailDomainHint.toLowerCase())) {
      domainBoost = 0.4;
    }
  }
  if (companyScore >= 1 || domainBoost > 0) {
    return { type: 'company', score: 0.5 + Math.min(companyScore * 0.15, 0.3) + domainBoost };
  }
  // ALL CAPS line with 1-4 words is often a company name on business cards
  const words = line.split(/\s+/);
  if (line === line.toUpperCase() && words.length >= 1 && words.length <= 4 && letters.length >= 3) {
    return { type: 'company', score: 0.5 };
  }

  // ── Name ──
  // A name is typically 2-3 words, each starting with uppercase, no numbers, no special chars
  const nameWords = line.split(/\s+/);
  const allWordsCapitalized = nameWords.every((w) => /^[A-ZÀ-Ü]/.test(w));
  const noNumbers = !/\d/.test(line);
  const noSpecial = !/[#$%^&*()+=\[\]{}<>|\\\/~`]/.test(line);
  const reasonableLength = nameWords.length >= 2 && nameWords.length <= 4;
  const shortEnough = line.length <= 40;

  if (allWordsCapitalized && noNumbers && noSpecial && reasonableLength && shortEnough) {
    return { type: 'name', score: 0.8 };
  }
  // Single capitalized word could be a first or last name alone
  if (nameWords.length === 1 && allWordsCapitalized && noNumbers && noSpecial && line.length >= 2 && line.length <= 20) {
    return { type: 'name', score: 0.3 };
  }
  // 2-3 words but not all capitalized — weaker name signal
  if (nameWords.length >= 2 && nameWords.length <= 3 && noNumbers && noSpecial && shortEnough) {
    return { type: 'name', score: 0.4 };
  }

  return { type: 'unknown', score: 0 };
}

/**
 * Extract the domain "name" from an email (e.g., "mario@acme.com" → "acme").
 */
function getDomainHint(email) {
  if (!email) return '';
  const match = email.match(/@([^.]+)\./);
  if (!match) return '';
  const domain = match[1].toLowerCase();
  // Skip generic email providers
  const generic = ['gmail', 'yahoo', 'hotmail', 'outlook', 'live', 'icloud', 'aol', 'mail', 'libero', 'virgilio', 'tiscali', 'alice', 'tin', 'fastwebnet', 'pec', 'aruba', 'protonmail', 'pm', 'proton', 'posteo', 'tutanota', 'msn', 'me'];
  if (generic.includes(domain)) return '';
  return domain;
}

/**
 * Parse raw OCR text from a business card into structured fields.
 * Uses a scoring system: each line is scored for how likely it is to be
 * a name, company, role, etc. The highest-scoring line for each category wins.
 */
function parseCardText(raw) {
  const result = { first_name: '', last_name: '', email: '', company: '', role: '' };

  // Step 1: Clean and split lines
  const lines = raw
    .split('\n')
    .map(cleanLine)
    .filter((l) => l.length > 1);

  if (lines.length === 0) return result;

  // Step 2: Extract email first (most reliable via regex)
  for (const line of lines) {
    const emailMatch = line.match(/([a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,})/);
    if (emailMatch) {
      result.email = emailMatch[1].toLowerCase();
      break;
    }
  }

  const domainHint = getDomainHint(result.email);

  // Step 3: Classify every line
  const classified = lines.map((line, index) => ({
    line,
    index,
    ...classifyLine(line, domainHint),
    // Position bonus: names tend to appear first on business cards
    positionBonus: index < 3 ? 0.1 * (3 - index) : 0,
  }));

  // Step 4: Filter out lines we've already used or that are junk/phone/url/address/email
  const skipTypes = new Set(['email', 'phone', 'url', 'address', 'junk']);
  const candidates = classified.filter((c) => !skipTypes.has(c.type));

  // Step 5: Pick best line for each field using scores
  // Name: highest 'name' score (with position bonus since name is usually first)
  const nameCandidates = candidates
    .filter((c) => c.type === 'name' || c.type === 'unknown')
    .map((c) => ({ ...c, finalScore: (c.type === 'name' ? c.score : 0.2) + c.positionBonus }))
    .sort((a, b) => b.finalScore - a.finalScore);

  const roleCandidates = candidates
    .filter((c) => c.type === 'role')
    .sort((a, b) => b.score - a.score);

  const companyCandidates = candidates
    .filter((c) => c.type === 'company')
    .sort((a, b) => b.score - a.score);

  // Assign: pick the best for each, but don't use the same line twice
  const usedLines = new Set();

  // Name first (most important to get right, appears first on card)
  if (nameCandidates.length > 0) {
    const best = nameCandidates[0];
    const parts = best.line.split(/\s+/);
    if (parts.length >= 2) {
      result.first_name = parts[0];
      result.last_name = parts.slice(1).join(' ');
    } else {
      result.first_name = parts[0] || '';
    }
    usedLines.add(best.line);
  }

  // Company
  if (companyCandidates.length > 0) {
    const best = companyCandidates.find((c) => !usedLines.has(c.line));
    if (best) {
      result.company = best.line;
      usedLines.add(best.line);
    }
  }

  // Role
  if (roleCandidates.length > 0) {
    const best = roleCandidates.find((c) => !usedLines.has(c.line));
    if (best) {
      result.role = best.line;
      usedLines.add(best.line);
    }
  }

  // Step 6: If we still have empty fields, try unused candidates as fallback
  const unused = candidates.filter((c) => !usedLines.has(c.line));
  if (!result.first_name && !result.last_name && unused.length > 0) {
    // Pick the first unused line that has at least some letters
    const fallback = unused.find((c) => c.line.replace(/[^a-zA-ZÀ-ÿ]/g, '').length >= 2);
    if (fallback) {
      const parts = fallback.line.split(/\s+/);
      result.first_name = parts[0] || '';
      result.last_name = parts.slice(1).join(' ');
      usedLines.add(fallback.line);
    }
  }
  if (!result.company && unused.length > 0) {
    const fallback = unused.find((c) => !usedLines.has(c.line) && c.type !== 'name');
    if (fallback) {
      result.company = fallback.line;
      usedLines.add(fallback.line);
    }
  }

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
