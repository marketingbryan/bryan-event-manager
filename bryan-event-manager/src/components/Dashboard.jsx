import { useMemo } from 'react';

export default function Dashboard({ stats, participants, loading }) {
  const trend = useMemo(() => buildTrend(participants), [participants]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Participants" value={stats.total} />
        <StatCard label="Checked In" value={stats.checked} valueClass="text-ok" />
        <StatCard label="Missing" value={stats.missing} valueClass="text-danger" />
        <StatCard label="% Attendance" value={`${stats.pct}%`} valueClass="text-brand" />
      </div>

      <div className="bg-white rounded-xl border p-4 sm:p-6">
        <h2 className="text-base font-semibold text-gray-900 mb-4">Check-in Trend</h2>
        {loading ? (
          <div className="h-64 flex items-center justify-center text-gray-400">Loading...</div>
        ) : trend.points.length === 0 ? (
          <div className="h-64 flex items-center justify-center text-gray-400 text-sm">
            No check-ins recorded yet
          </div>
        ) : (
          <TrendChart points={trend.points} total={stats.total} />
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value, valueClass = 'text-gray-900' }) {
  return (
    <div className="bg-white rounded-xl border p-5">
      <div className="text-sm text-gray-500 mb-2">{label}</div>
      <div className={`text-3xl font-bold ${valueClass}`}>{value}</div>
    </div>
  );
}

function buildTrend(participants) {
  const checkins = participants
    .filter((p) => p.checked_in && p.checked_in_at)
    .map((p) => new Date(p.checked_in_at))
    .sort((a, b) => a - b);

  if (checkins.length === 0) return { points: [] };

  const buckets = new Map();
  for (const d of checkins) {
    const key = new Date(d);
    key.setMinutes(Math.floor(key.getMinutes() / 5) * 5, 0, 0);
    const k = key.toISOString();
    buckets.set(k, (buckets.get(k) || 0) + 1);
  }

  const sorted = [...buckets.entries()].sort(([a], [b]) => a.localeCompare(b));
  let cumulative = 0;
  const points = sorted.map(([t, count]) => {
    cumulative += count;
    return { t: new Date(t), count: cumulative };
  });

  return { points };
}

function TrendChart({ points, total }) {
  const W = 800;
  const H = 240;
  const padL = 40;
  const padR = 20;
  const padT = 20;
  const padB = 30;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;

  const minT = points[0].t.getTime();
  const maxT = points[points.length - 1].t.getTime();
  const tSpan = Math.max(1, maxT - minT);
  const maxY = Math.max(total || 0, points[points.length - 1].count);

  const xFor = (t) => padL + ((t.getTime() - minT) / tSpan) * innerW;
  const yFor = (c) => padT + innerH - (c / Math.max(1, maxY)) * innerH;

  const path = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${xFor(p.t).toFixed(1)} ${yFor(p.count).toFixed(1)}`)
    .join(' ');

  const areaPath = `${path} L ${xFor(points[points.length - 1].t).toFixed(1)} ${padT + innerH} L ${xFor(points[0].t).toFixed(1)} ${padT + innerH} Z`;

  const yTicks = 4;
  const tickValues = Array.from({ length: yTicks + 1 }, (_, i) => Math.round((maxY / yTicks) * i));

  return (
    <div className="w-full overflow-x-auto">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-64" preserveAspectRatio="none">
        {tickValues.map((v) => (
          <g key={v}>
            <line
              x1={padL}
              x2={W - padR}
              y1={yFor(v)}
              y2={yFor(v)}
              stroke="#e5e7eb"
              strokeDasharray="3,3"
            />
            <text x={padL - 6} y={yFor(v) + 4} textAnchor="end" fontSize="10" fill="#6b7280">
              {v}
            </text>
          </g>
        ))}
        <path d={areaPath} fill="#4f46e5" fillOpacity="0.1" />
        <path d={path} fill="none" stroke="#4f46e5" strokeWidth="2" />
        {points.map((p, i) => (
          <circle key={i} cx={xFor(p.t)} cy={yFor(p.count)} r="3" fill="#4f46e5" />
        ))}
        <text x={padL} y={H - 8} fontSize="10" fill="#6b7280">
          {points[0].t.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
        </text>
        <text x={W - padR} y={H - 8} textAnchor="end" fontSize="10" fill="#6b7280">
          {points[points.length - 1].t.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
        </text>
      </svg>
    </div>
  );
}
