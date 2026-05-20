import { useState } from 'react'
import {
  ComposedChart, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import { fmtNumber, fmtWon, fmtPercent } from '../utils/format'

const METRICS = [
  { key: '광고비',      label: '광고비',    color: '#059669', fmt: v => fmtWon(v) },
  { key: '매출_14일',   label: '매출(14일)', color: '#D97706', fmt: v => fmtWon(v) },
  { key: '노출수',      label: '노출수',    color: '#7C3AED', fmt: v => fmtNumber(v) },
  { key: '클릭수',      label: '클릭수',    color: '#2563EB', fmt: v => fmtNumber(v) },
  { key: '주문수_14일', label: '주문수',    color: '#DC2626', fmt: v => fmtNumber(v) },
]

function MetricBtn({ m, side, active, onClick }) {
  const sideLabel = side === 'L' ? '좌' : '우'
  return (
    <button
      onClick={() => onClick(m.key)}
      className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border transition-all"
      style={
        active
          ? { backgroundColor: m.color, borderColor: m.color, color: '#fff' }
          : { borderColor: '#E2E8F0', color: '#64748B' }
      }
    >
      {active && <span className="text-[10px] opacity-80">[{sideLabel}]</span>}
      {m.label}
    </button>
  )
}

function CustomTooltip({ active, payload, label, left, right }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-lg px-4 py-3 text-sm space-y-1">
      <p className="text-slate-500 text-xs mb-2">{label}</p>
      {payload.map((p, i) => (
        <p key={i} className="font-semibold" style={{ color: p.stroke }}>
          {p.name}: {p.name === left?.label ? left.fmt(p.value) : right?.fmt(p.value)}
        </p>
      ))}
    </div>
  )
}

export default function TrendChart({ data }) {
  const [selected, setSelected] = useState(['광고비', '매출_14일'])

  const toggle = (key) => {
    setSelected(prev => {
      if (prev.includes(key)) return prev.length > 1 ? prev.filter(k => k !== key) : prev
      if (prev.length >= 2) return [prev[1], key]
      return [...prev, key]
    })
  }

  const available = METRICS.filter(m => data.some(r => (r[m.key] ?? 0) !== 0))
  const leftKey   = selected[0]
  const rightKey  = selected[1]
  const leftMeta  = METRICS.find(m => m.key === leftKey)
  const rightMeta = METRICS.find(m => m.key === rightKey)

  const chartData = data.map(r => ({ ...r, _d: (r.날짜 ?? '').slice(5) }))

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 h-full flex flex-col">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <h3 className="text-sm font-semibold text-slate-800">일별 트렌드</h3>
        <div className="flex flex-wrap gap-1.5">
          {available.map((m) => {
            const idx = selected.indexOf(m.key)
            return (
              <MetricBtn
                key={m.key}
                m={m}
                side={idx === 0 ? 'L' : 'R'}
                active={idx !== -1}
                onClick={toggle}
              />
            )
          })}
        </div>
      </div>

      <div className="flex-1 min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData} margin={{ top: 4, right: rightKey ? 56 : 16, left: 4, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
            <XAxis
              dataKey="_d"
              tick={{ fontSize: 11, fill: '#94A3B8' }}
              axisLine={false} tickLine={false}
            />
            <YAxis
              yAxisId="L"
              orientation="left"
              tick={{ fontSize: 10, fill: '#94A3B8' }}
              axisLine={false} tickLine={false}
              tickFormatter={v => fmtNumber(v)}
              width={62}
            />
            {rightKey && (
              <YAxis
                yAxisId="R"
                orientation="right"
                tick={{ fontSize: 10, fill: '#94A3B8' }}
                axisLine={false} tickLine={false}
                tickFormatter={v => fmtNumber(v)}
                width={62}
              />
            )}
            <Tooltip content={<CustomTooltip left={leftMeta} right={rightMeta} />} />
            <Line
              yAxisId="L"
              type="monotone"
              dataKey={leftKey}
              name={leftMeta?.label}
              stroke={leftMeta?.color ?? '#2563EB'}
              strokeWidth={2.5}
              dot={false}
              activeDot={{ r: 4, strokeWidth: 0 }}
            />
            {rightKey && (
              <Line
                yAxisId="R"
                type="monotone"
                dataKey={rightKey}
                name={rightMeta?.label}
                stroke={rightMeta?.color ?? '#059669'}
                strokeWidth={2.5}
                strokeDasharray="6 3"
                dot={false}
                activeDot={{ r: 4, strokeWidth: 0 }}
              />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
