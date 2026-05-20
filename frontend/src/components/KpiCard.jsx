const THEME = {
  blue:    { bg: 'bg-blue-50',    text: 'text-blue-700',    label: 'text-blue-500' },
  indigo:  { bg: 'bg-indigo-50',  text: 'text-indigo-700',  label: 'text-indigo-500' },
  violet:  { bg: 'bg-violet-50',  text: 'text-violet-700',  label: 'text-violet-500' },
  sky:     { bg: 'bg-sky-50',     text: 'text-sky-700',     label: 'text-sky-500' },
  emerald: { bg: 'bg-emerald-50', text: 'text-emerald-700', label: 'text-emerald-500' },
  teal:    { bg: 'bg-teal-50',    text: 'text-teal-700',    label: 'text-teal-500' },
  amber:   { bg: 'bg-amber-50',   text: 'text-amber-700',   label: 'text-amber-500' },
  rose:    { bg: 'bg-rose-50',    text: 'text-rose-700',    label: 'text-rose-500' },
}

function TrendBadge({ pct, invert }) {
  if (pct == null) return null
  const good    = invert ? pct < 0 : pct > 0
  const neutral = Math.abs(pct) < 0.1
  if (neutral) return <span className="text-xs text-slate-400">±0%</span>
  return (
    <span className={`inline-flex items-center gap-0.5 text-xs font-semibold ${good ? 'text-emerald-600' : 'text-red-500'}`}>
      {good ? '▲' : '▼'} {Math.abs(pct).toFixed(1)}%
    </span>
  )
}

export default function KpiCard({ label, value, color = 'blue', trend, invertTrend }) {
  const t = THEME[color] ?? THEME.blue
  return (
    <div className={`${t.bg} rounded-xl p-4 flex flex-col gap-1.5`}>
      <div className="flex items-start justify-between">
        <span className={`text-xs font-semibold uppercase tracking-wide ${t.label}`}>{label}</span>
        {trend != null && <TrendBadge pct={trend} invert={invertTrend} />}
      </div>
      <span className={`text-2xl font-bold leading-tight ${t.text}`}>{value}</span>
      {trend != null && (
        <span className="text-xs text-slate-400">직전 기간 대비</span>
      )}
    </div>
  )
}
