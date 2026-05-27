import { useState, useMemo } from 'react'
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell } from 'recharts'
import KpiCard from '../components/KpiCard'
import TrendChart from '../components/TrendChart'
import {
  filterData, aggregateKpis, splitByPeriod, pctChange,
  groupByDate, groupByCampaign, groupByPlacement, groupByProduct,
  getUnique, generateInsights, getSalesCol,
} from '../utils/dataHelpers'
import { fmtNumber, fmtWon, fmtPercent } from '../utils/format'

// ─── MultiSelect 드롭다운 ─────────────────────────────────────────────────────

function MultiSelect({ label, options, value, onChange }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-white border border-slate-200 rounded-lg hover:border-blue-400 transition-colors whitespace-nowrap"
      >
        <span className="text-slate-600">{value.length ? `${label} (${value.length})` : label}</span>
        <svg className="w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute top-full left-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl z-50 min-w-52 max-h-60 overflow-y-auto">
            <label className="flex items-center gap-2 px-3 py-2 hover:bg-slate-50 cursor-pointer border-b border-slate-100">
              <input type="checkbox" checked={!value.length} onChange={() => onChange([])} className="accent-blue-600" />
              <span className="text-sm font-medium text-slate-600">전체</span>
            </label>
            {options.map(opt => (
              <label key={opt} className="flex items-center gap-2 px-3 py-2 hover:bg-slate-50 cursor-pointer">
                <input
                  type="checkbox"
                  className="accent-blue-600"
                  checked={value.includes(opt)}
                  onChange={e => onChange(e.target.checked ? [...value, opt] : value.filter(v => v !== opt))}
                />
                <span className="text-sm text-slate-700 truncate">{opt}</span>
              </label>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

// ─── FilterBar ────────────────────────────────────────────────────────────────

function FilterBar({ data, filters, onChange, dateRange }) {
  const campaigns  = useMemo(() => getUnique(data, '캠페인명'), [data])
  const products   = useMemo(() => getUnique(data, '광고집행 상품명'), [data])
  const placements = useMemo(() => getUnique(data, '광고 노출 지면'), [data])
  const hasDateFilter = filters.dateStart || filters.dateEnd
  return (
    <div className="flex flex-wrap items-center gap-2 px-6 py-3 bg-white border-b border-slate-200 sticky top-0 z-30">
      <MultiSelect label="캠페인"   options={campaigns}  value={filters.campaigns}  onChange={v => onChange({ ...filters, campaigns: v })} />
      <MultiSelect label="상품"     options={products}   value={filters.products}   onChange={v => onChange({ ...filters, products: v })} />
      <MultiSelect label="노출 지면" options={placements} value={filters.placements} onChange={v => onChange({ ...filters, placements: v })} />
      <div className="h-5 w-px bg-slate-200 mx-1 hidden sm:block" />
      <span className="text-xs text-slate-400">기간:</span>
      <input
        type="date"
        value={filters.dateStart ?? dateRange?.start ?? ''}
        min={dateRange?.start}
        max={dateRange?.end}
        onChange={e => onChange({ ...filters, dateStart: e.target.value || null })}
        className="px-2 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:border-blue-400"
      />
      <span className="text-xs text-slate-300">~</span>
      <input
        type="date"
        value={filters.dateEnd ?? dateRange?.end ?? ''}
        min={dateRange?.start}
        max={dateRange?.end}
        onChange={e => onChange({ ...filters, dateEnd: e.target.value || null })}
        className="px-2 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:border-blue-400"
      />
      {hasDateFilter && (
        <button
          onClick={() => onChange({ ...filters, dateStart: null, dateEnd: null })}
          className="text-xs text-slate-400 hover:text-slate-700 transition-colors"
        >
          초기화
        </button>
      )}
      <div className="h-5 w-px bg-slate-200 mx-1 hidden sm:block" />
      <span className="text-xs text-slate-400">비교기간:</span>
      {[['none','없음'], ['7d','직전 7일'], ['14d','직전 14일']].map(([mode, lbl]) => (
        <button
          key={mode}
          onClick={() => onChange({ ...filters, compareMode: mode })}
          className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
            filters.compareMode === mode ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          {lbl}
        </button>
      ))}
    </div>
  )
}

// ─── 캠페인별 ROAS 가로 막대 차트 ─────────────────────────────────────────────

const roasColor = r => r >= 400 ? '#10B981' : r >= 200 ? '#2563EB' : r >= 100 ? '#F59E0B' : '#EF4444'

function CampaignRoasChart({ campaigns }) {
  const [sortDir, setSortDir] = useState('desc')
  const data = useMemo(() => {
    const top8 = [...campaigns].slice(0, 8)
    return sortDir === 'asc' ? [...top8].reverse() : top8
  }, [campaigns, sortDir])
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 h-full flex flex-col">
      <div className="flex items-center justify-between mb-1">
        <h3 className="text-sm font-semibold text-slate-800">캠페인별 ROAS</h3>
        <button
          onClick={() => setSortDir(d => d === 'desc' ? 'asc' : 'desc')}
          className="text-xs text-slate-400 hover:text-slate-600 transition-colors"
        >
          {sortDir === 'desc' ? '↓ 내림차순' : '↑ 오름차순'}
        </button>
      </div>
      <p className="text-xs text-slate-400 mb-4">14일 기준 · 상위 8개</p>
      <div className="flex-1 min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart layout="vertical" data={data} margin={{ top: 4, right: 44, left: 0, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" horizontal={false} />
            <XAxis type="number" tick={{ fontSize: 10, fill: '#94A3B8' }} axisLine={false} tickLine={false} tickFormatter={v => `${v.toLocaleString()}%`} />
            <YAxis type="category" dataKey="캠페인명" tick={{ fontSize: 10, fill: '#64748B' }} width={118} axisLine={false} tickLine={false}
              tickFormatter={v => v.length > 14 ? v.slice(0, 14) + '…' : v}
            />
            <Tooltip formatter={v => [`${v.toLocaleString()}%`, 'ROAS']} cursor={{ fill: '#F8FAFC' }} />
            <Bar dataKey="ROAS_14일" radius={[0, 4, 4, 0]} maxBarSize={18} label={{ position: 'right', fontSize: 10, fill: '#64748B', formatter: v => `${v.toLocaleString()}%` }}>
              {data.map((e, i) => <Cell key={i} fill={roasColor(e.ROAS_14일)} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

// ─── 지면별 성과 카드 ──────────────────────────────────────────────────────────

function PlacementCards({ placements }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5">
      <h3 className="text-sm font-semibold text-slate-800 mb-1">지면별 성과</h3>
      <p className="text-xs text-slate-400 mb-4">ROAS 기준</p>
      <div className="space-y-3">
        {placements.map(p => {
          const badge = p.ROAS >= 300 ? { txt: 'ROAS 우수', cls: 'text-emerald-700 bg-emerald-50' }
            : p.ROAS >= 150 ? { txt: 'ROAS 양호', cls: 'text-blue-700 bg-blue-50' }
            : { txt: '개선 필요', cls: 'text-amber-700 bg-amber-50' }
          return (
            <div key={p.지면} className="flex items-center justify-between py-2.5 border-b border-slate-100 last:border-0">
              <div>
                <p className="text-sm font-medium text-slate-700">{p.지면}</p>
                <p className="text-xs text-slate-400">광고비 {fmtWon(p.광고비)}</p>
              </div>
              <div className="text-right">
                <p className="text-base font-bold text-slate-800">{p.ROAS.toLocaleString()}%</p>
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${badge.cls}`}>{badge.txt}</span>
              </div>
            </div>
          )
        })}
        {!placements.length && <p className="text-sm text-slate-400 text-center py-6">데이터 없음</p>}
      </div>
    </div>
  )
}

// ─── 데이터 테이블 ────────────────────────────────────────────────────────────

function DataTable({ columns, data, maxRows = 8 }) {
  const [sortKey, setSortKey] = useState(columns.find(c => c.defaultSort)?.key ?? columns[1]?.key)
  const [sortDir, setSortDir] = useState('desc')

  const rows = useMemo(() => {
    return [...data].sort((a, b) => {
      const av = a[sortKey] ?? 0, bv = b[sortKey] ?? 0
      const d = sortDir === 'desc' ? 1 : -1
      return typeof av === 'number' ? (bv - av) * d : String(av).localeCompare(String(bv)) * -d
    }).slice(0, maxRows)
  }, [data, sortKey, sortDir])

  const handleSort = key => {
    if (key === sortKey) setSortDir(d => d === 'desc' ? 'asc' : 'desc')
    else { setSortKey(key); setSortDir('desc') }
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200">
            {columns.map(col => (
              <th
                key={col.key}
                onClick={() => handleSort(col.key)}
                className="px-3 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide cursor-pointer hover:text-slate-800 select-none whitespace-nowrap"
              >
                {col.label}{sortKey === col.key ? (sortDir === 'desc' ? ' ↓' : ' ↑') : ''}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-b border-slate-100 hover:bg-slate-50/70 transition-colors">
              {columns.map(col => (
                <td key={col.key} className={`px-3 py-2.5 ${col.className ?? ''}`}>
                  {col.render ? col.render(row[col.key], row) : (row[col.key] ?? '-')}
                </td>
              ))}
            </tr>
          ))}
          {!rows.length && (
            <tr><td colSpan={columns.length} className="px-3 py-10 text-center text-slate-400 text-sm">데이터 없음</td></tr>
          )}
        </tbody>
      </table>
    </div>
  )
}

const ROAS_CHIP = roas => {
  const c = roas >= 400 ? 'bg-emerald-50 text-emerald-700' : roas >= 200 ? 'bg-blue-50 text-blue-700' : roas >= 100 ? 'bg-amber-50 text-amber-700' : 'bg-red-50 text-red-700'
  return <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${c}`}>{roas.toLocaleString()}%</span>
}

// ─── AI 인사이트 패널 ──────────────────────────────────────────────────────────

const INSIGHT_STYLE = {
  expand:  { bg: 'bg-emerald-50', border: 'border-emerald-200', icon: '💡', badgeCls: 'bg-emerald-100 text-emerald-700' },
  warning: { bg: 'bg-amber-50',   border: 'border-amber-200',   icon: '⚠️', badgeCls: 'bg-amber-100 text-amber-700' },
  keyword: { bg: 'bg-rose-50',    border: 'border-rose-200',    icon: '🔍', badgeCls: 'bg-rose-100 text-rose-700' },
  caution: { bg: 'bg-orange-50',  border: 'border-orange-200',  icon: '⚡', badgeCls: 'bg-orange-100 text-orange-700' },
  info:    { bg: 'bg-blue-50',    border: 'border-blue-200',    icon: 'ℹ️', badgeCls: 'bg-blue-100 text-blue-700' },
}

function AiInsightPanel({ insights }) {
  const [open, setOpen] = useState(true)
  return (
    <div className="border-t border-slate-200 bg-white">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-6 py-3 hover:bg-slate-50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-slate-700">AI 인사이트</span>
          <span className="text-xs text-slate-400">규칙 기반 자동 분석</span>
          <span className="text-xs bg-blue-100 text-blue-700 font-semibold px-2 py-0.5 rounded-full">{insights.length}</span>
        </div>
        <svg className={`w-4 h-4 text-slate-400 transition-transform ${open ? '' : 'rotate-180'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 px-6 pb-6">
          {insights.map((ins, i) => {
            const s = INSIGHT_STYLE[ins.type] ?? INSIGHT_STYLE.info
            return (
              <div key={i} className={`${s.bg} border ${s.border} rounded-xl p-4 space-y-2`}>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-slate-800">{ins.icon} {ins.title}</span>
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${s.badgeCls}`}>{ins.badge}</span>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">{ins.body}</p>
                <p className="text-xs font-semibold text-slate-700">→ {ins.action}</p>
                {ins.tooltip && (
                  <p className="text-[11px] text-slate-400 italic leading-relaxed">ℹ {ins.tooltip}</p>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── 메인 DashboardPage ───────────────────────────────────────────────────────

export default function DashboardPage({ data, dateRange, convConfig = { period: '14d', convType: 'total' } }) {
  const [filters, setFilters] = useState({ campaigns: [], products: [], placements: [], compareMode: 'none', dateStart: null, dateEnd: null })
  const [tableTab, setTableTab] = useState('product')

  const filtered = useMemo(() => filterData(data, filters), [data, filters])

  const kpis = useMemo(() => aggregateKpis(filtered, convConfig), [filtered, convConfig])
  const comparison = useMemo(
    () => filters.compareMode === 'none' ? null : splitByPeriod(filtered, filters.compareMode === '7d' ? 7 : 14, convConfig),
    [filtered, filters.compareMode, convConfig]
  )
  const cmp = (key) => comparison ? pctChange(kpis[key], comparison.previous[key]) : null

  const dailyData    = useMemo(() => groupByDate(filtered, convConfig.convType), [filtered, convConfig.convType])
  const campaigns    = useMemo(() => groupByCampaign(filtered, convConfig.convType), [filtered, convConfig.convType])
  const placements   = useMemo(() => groupByPlacement(filtered), [filtered])
  const products     = useMemo(() => groupByProduct(filtered, convConfig.convType), [filtered, convConfig.convType])
  const insights     = useMemo(() => generateInsights(filtered, convConfig.convType), [filtered, convConfig.convType])

  const periodLabel = convConfig.period === '1d' ? '1일' : '14일'
  const convLabel   = convConfig.convType === 'direct' ? '직접전환' : '총전환'

  const KPI_CARDS = [
    { label: '총 광고비',                            value: fmtWon(kpis.광고비),        key: '광고비',        color: 'blue',    invertTrend: true },
    { label: `전환매출 (${periodLabel}·${convLabel})`, value: fmtWon(kpis.매출_14일),   key: '매출_14일',     color: 'indigo' },
    { label: 'ROAS',                                 value: fmtPercent(kpis.ROAS, 0),   key: 'ROAS',          color: 'violet' },
    { label: '클릭수',                               value: fmtNumber(kpis.클릭수),     key: '클릭수',        color: 'sky' },
    { label: `주문수 (${periodLabel})`,              value: fmtNumber(kpis.주문수_14일), key: '주문수_14일',   color: 'emerald' },
    { label: 'CTR',                                  value: fmtPercent(kpis.CTR, 2),    key: 'CTR',           color: 'teal' },
    { label: 'CPC',                                  value: fmtWon(kpis.CPC),           key: 'CPC',           color: 'amber', invertTrend: true },
    { label: 'CVR',                                  value: fmtPercent(kpis.CVR, 2),    key: 'CVR',           color: 'rose' },
  ]

  const productCols = [
    { key: '상품명',    label: '상품명',  className: 'font-medium text-slate-800 max-w-[140px] truncate' },
    { key: '캠페인명',  label: '캠페인',  className: 'text-slate-500 text-xs max-w-[120px] truncate' },
    { key: '매출_14일', label: '전환매출', render: v => fmtWon(v), defaultSort: true },
    { key: 'ROAS_14일', label: 'ROAS',    render: v => ROAS_CHIP(v) },
    { key: '주문수_14일', label: '주문수', render: v => fmtNumber(v) },
    { key: 'CVR',       label: 'CVR',     render: v => fmtPercent(v, 2) },
  ]

  const avgCTR = campaigns.length ? campaigns.reduce((s, c) => s + (c.CTR ?? 0), 0) / campaigns.length : 0
  const avgCVR = campaigns.length ? campaigns.reduce((s, c) => s + (c.CVR ?? 0), 0) / campaigns.length : 0

  const campaignCols = [
    { key: '캠페인명',  label: '캠페인명', className: 'font-medium text-slate-800 max-w-[160px] truncate' },
    { key: '광고비',    label: '광고비',   render: v => fmtWon(v) },
    { key: '매출_14일', label: '전환매출', render: v => fmtWon(v), defaultSort: true },
    { key: 'ROAS_14일', label: 'ROAS',    render: v => ROAS_CHIP(v) },
    { key: '클릭수',    label: '클릭수',   render: v => fmtNumber(v) },
    { key: 'CTR',       label: 'CTR',     render: v => (
      <span className="flex items-center gap-1 justify-end">
        {fmtPercent(v, 2)}
        {avgCTR > 0 && v < avgCTR * 0.5 && (
          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700">개선 필요</span>
        )}
      </span>
    )},
    { key: 'CVR',       label: 'CVR',     render: v => (
      <span className="flex items-center gap-1 justify-end">
        {fmtPercent(v, 2)}
        {avgCVR > 0 && v < avgCVR * 0.5 && (
          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700">개선 필요</span>
        )}
      </span>
    )},
  ]

  return (
    <div className="flex flex-col h-full">
      <FilterBar data={data} filters={filters} onChange={setFilters} dateRange={dateRange} />

      <div className="flex-1 overflow-y-auto">
        <div className="px-6 py-5 space-y-5">

          {/* KPI 카드 8개 */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {KPI_CARDS.map(card => (
              <KpiCard
                key={card.label}
                label={card.label}
                value={card.value}
                color={card.color}
                trend={cmp(card.key)}
                invertTrend={card.invertTrend}
              />
            ))}
          </div>

          {/* 트렌드 차트 + 캠페인 ROAS */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4" style={{ height: 320 }}>
            <div className="lg:col-span-2 h-full">
              {dailyData.length > 1
                ? <TrendChart data={dailyData} />
                : <div className="bg-white rounded-xl border border-slate-200 flex items-center justify-center h-full text-slate-400 text-sm">2일 이상 데이터가 필요합니다</div>
              }
            </div>
            <div className="h-full">
              <CampaignRoasChart campaigns={campaigns} />
            </div>
          </div>

          {/* 지면별 + 테이블 */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <PlacementCards placements={placements} />

            <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 overflow-hidden">
              {/* 탭 */}
              <div className="flex border-b border-slate-200">
                {[['product','상위 상품'], ['campaign','상위 캠페인']].map(([id, lbl]) => (
                  <button
                    key={id}
                    onClick={() => setTableTab(id)}
                    className={`px-5 py-3 text-sm font-medium transition-colors border-b-2 -mb-px ${
                      tableTab === id ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    {lbl}
                  </button>
                ))}
              </div>
              <div className="p-1">
                {tableTab === 'product'
                  ? <DataTable columns={productCols} data={products} />
                  : <DataTable columns={campaignCols} data={campaigns} />
                }
              </div>
            </div>
          </div>

        </div>

        {/* AI 인사이트 (하단) */}
        <AiInsightPanel insights={insights} />
      </div>
    </div>
  )
}
