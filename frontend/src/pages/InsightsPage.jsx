import { useState, useMemo, useEffect, useCallback, useTransition, useRef } from 'react'
import {
  PieChart, Pie, Cell, Tooltip as ChartTooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from 'recharts'
import {
  getUnique, isManualCampaign,
  groupByCampaign, groupByKeyword, groupByPlacement,
  aggregateKpis, generateInsights,
  groupByNormalizedProduct,
  extractProductTokens, classifyKeyword,
} from '../utils/dataHelpers'
import { fmtNumber, fmtWon, fmtPercent } from '../utils/format'

// ─── 로딩 스피너 ──────────────────────────────────────────────────────────────

function Spinner() {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-3">
      <div className="relative w-9 h-9">
        <div className="absolute inset-0 rounded-full border-4 border-slate-100" />
        <div className="absolute inset-0 rounded-full border-4 border-blue-600 border-t-transparent animate-spin" />
      </div>
      <p className="text-xs text-slate-400">데이터 로드 중...</p>
    </div>
  )
}

// ─── 복사 토스트 ──────────────────────────────────────────────────────────────

function CopyToast({ visible }) {
  if (!visible) return null
  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-slate-800 text-white text-xs font-semibold px-4 py-2.5 rounded-full shadow-lg pointer-events-none select-none">
      복사됨!
    </div>
  )
}

// ─── 칼럼 리사이즈 헤더 ─────────────────────────────────────────────────────

function ResizableTh({ children, defaultWidth = 140, minWidth = 60, className = '', ...rest }) {
  const [width, setWidth] = useState(defaultWidth)
  const startX = useRef(null)
  const startW = useRef(null)

  const onMouseDown = (e) => {
    e.stopPropagation()
    startX.current = e.clientX
    startW.current = width
    const onMove = (ev) => setWidth(Math.max(minWidth, startW.current + ev.clientX - startX.current))
    const onUp   = () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp) }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup',   onUp)
  }

  return (
    <th style={{ width, minWidth }} className={`relative select-none ${className}`} {...rest}>
      {children}
      <div onMouseDown={onMouseDown} className="absolute right-0 top-0 h-full w-1.5 cursor-col-resize hover:bg-slate-300/60 active:bg-blue-300/60" />
    </th>
  )
}

// ─── 캠페인 선택 드롭다운 ─────────────────────────────────────────────────────

function CampaignSelector({ options, value, onChange }) {
  const [open, setOpen] = useState(false)
  const isAll = value === '전체'
  return (
    <div className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border transition-colors ${
          isAll
            ? 'bg-white border-slate-200 text-slate-600 hover:border-blue-400'
            : 'bg-blue-600 border-blue-600 text-white'
        }`}
      >
        <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
        </svg>
        <span className="max-w-[180px] truncate">{value}</span>
        <svg className="w-3.5 h-3.5 shrink-0 opacity-70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute top-full left-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl z-50 min-w-64 max-h-72 overflow-y-auto">
            {['전체', ...options].map(opt => (
              <button
                key={opt}
                onClick={() => { onChange(opt); setOpen(false) }}
                className={`w-full text-left px-4 py-2.5 text-sm transition-colors first:rounded-t-xl last:rounded-b-xl flex items-center gap-2 ${
                  value === opt ? 'bg-blue-50 text-blue-700 font-semibold' : 'text-slate-700 hover:bg-slate-50'
                }`}
              >
                <span className="flex-1 truncate">{opt}</span>
                {isManualCampaign(opt) && (
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-violet-100 text-violet-700 shrink-0">수동</span>
                )}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

// ─── ROAS 칩 ──────────────────────────────────────────────────────────────────

const ROAS_CHIP = (roas) => {
  const c = roas >= 400 ? 'bg-emerald-50 text-emerald-700'
    : roas >= 200 ? 'bg-blue-50 text-blue-700'
    : roas >= 100 ? 'bg-amber-50 text-amber-700'
    : 'bg-red-50 text-red-700'
  return <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${c}`}>{roas.toLocaleString()}%</span>
}

// ─── 직접/간접 비교 테이블 ────────────────────────────────────────────────────

const PAGE_SIZE = 15

function CompareTable({ rows, nameKey, nameLabel, showManualBadge = false, showCpc = false, paginated = false }) {
  const [sort, setSort] = useState({ key: '매출_14일', dir: 'desc' })
  const [page, setPage] = useState(0)

  const handleSort = useCallback((key) => {
    setSort(s => ({ key, dir: s.key === key && s.dir === 'desc' ? 'asc' : 'desc' }))
    setPage(0)
  }, [])

  useEffect(() => { setPage(0) }, [rows])

  const comparator = useCallback((a, b) => {
    const av = a[sort.key] ?? 0, bv = b[sort.key] ?? 0
    return sort.dir === 'desc' ? bv - av : av - bv
  }, [sort.key, sort.dir])

  const sortedAll = useMemo(() => [...rows].sort(comparator), [rows, comparator])

  const totalPages = paginated ? Math.ceil(sortedAll.length / PAGE_SIZE) : 1
  const sorted = paginated
    ? sortedAll.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)
    : sortedAll.slice(0, PAGE_SIZE)

  const th = (key, label) => (
    <th
      key={key}
      onClick={() => handleSort(key)}
      className="px-3 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide cursor-pointer hover:text-slate-800 select-none whitespace-nowrap"
    >
      {label}{sort.key === key ? (sort.dir === 'desc' ? ' ↓' : ' ↑') : ''}
    </th>
  )
  const colSpan = 8 + (showCpc ? 1 : 0)
  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200">
              <ResizableTh
                key={nameKey}
                onClick={() => handleSort(nameKey)}
                defaultWidth={160}
                className="px-3 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide cursor-pointer hover:text-slate-800 whitespace-nowrap"
              >
                {nameLabel}{sort.key === nameKey ? (sort.dir === 'desc' ? ' ↓' : ' ↑') : ''}
              </ResizableTh>
              {th('광고비',      '광고비')}
              {th('매출_1일',    '직접매출(1일)')}
              {th('매출_14일',   '간접매출(14일)')}
              {th('ROAS_1일',    'ROAS(1일)')}
              {th('ROAS_14일',   'ROAS(14일)')}
              {showCpc && th('CPC', 'CPC')}
              {th('주문수_1일',  '주문(1일)')}
              {th('주문수_14일', '주문(14일)')}
            </tr>
          </thead>
          <tbody>
            {sorted.map((r, i) => (
              <tr key={i} className="border-b border-slate-100 hover:bg-slate-50/70 transition-colors">
                <td className="px-3 py-2.5 font-medium text-slate-800">
                  <div className="flex items-center gap-1.5 max-w-[160px]">
                    <span title={r[nameKey]} className="truncate">{r[nameKey]}</span>
                    {showManualBadge && isManualCampaign(r[nameKey] ?? '') && (
                      <span className="shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded bg-violet-100 text-violet-700">수동</span>
                    )}
                  </div>
                </td>
                <td className="px-3 py-2.5 text-slate-600">{fmtWon(r.광고비)}</td>
                <td className="px-3 py-2.5 text-slate-600">{fmtWon(r.매출_1일)}</td>
                <td className="px-3 py-2.5 font-semibold text-slate-800">{fmtWon(r.매출_14일)}</td>
                <td className="px-3 py-2.5">{ROAS_CHIP(r.ROAS_1일)}</td>
                <td className="px-3 py-2.5">{ROAS_CHIP(r.ROAS_14일)}</td>
                {showCpc && <td className="px-3 py-2.5 text-slate-600">{fmtWon(r.CPC)}</td>}
                <td className="px-3 py-2.5 text-slate-600">{fmtNumber(r.주문수_1일)}</td>
                <td className="px-3 py-2.5 text-slate-600">{fmtNumber(r.주문수_14일)}</td>
              </tr>
            ))}
            {!sorted.length && (
              <tr><td colSpan={colSpan} className="px-3 py-10 text-center text-slate-400">데이터 없음</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {paginated && totalPages > 1 && (
        <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200">
          <span className="text-xs text-slate-400">
            상위 {rows.length}개 중 {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, rows.length)}번째
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage(p => p - 1)}
              disabled={page === 0}
              className="px-2.5 py-1 text-xs rounded-md border border-slate-200 text-slate-600 disabled:opacity-30 hover:bg-slate-50 transition-colors"
            >
              이전
            </button>
            <span className="text-xs text-slate-600 font-medium px-2.5">
              {page + 1} / {totalPages}
            </span>
            <button
              onClick={() => setPage(p => p + 1)}
              disabled={page >= totalPages - 1}
              className="px-2.5 py-1 text-xs rounded-md border border-slate-200 text-slate-600 disabled:opacity-30 hover:bg-slate-50 transition-colors"
            >
              다음
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── 키워드 단일 테이블 (정렬 가능 + 도달유지 뱃지) ───────────────────────────

function KeywordTable({ rows, initDir, headerText, headerCls }) {
  const [sort,       setSort]       = useState({ key: 'ROAS_14일', dir: initDir })
  const [convWindow, setConvWindow] = useState('14d')

  const is1d     = convWindow === '1d'
  const roasKey  = is1d ? 'ROAS_1일'  : 'ROAS_14일'
  const salesKey = is1d ? '매출_1일'   : '매출_14일'
  const orderKey = is1d ? '주문수_1일' : '주문수_14일'

  const KW_COLS = [
    { key: '키워드',  label: '키워드',   sortable: false },
    { key: '노출수',  label: '노출수',   sortable: true },
    { key: '광고비',  label: '광고비',   sortable: true },
    { key: salesKey, label: '전환매출', sortable: true },
    { key: roasKey,  label: 'ROAS',     sortable: true, chip: true },
    { key: 'CTR',    label: 'CTR',      sortable: true },
    { key: 'CPC',    label: 'CPC',      sortable: true },
    { key: '__cvr',  label: 'CVR',      sortable: false },
  ]

  const handleWindowChange = (win) => {
    const rk = win === '1d' ? 'ROAS_1일' : 'ROAS_14일'
    const sk = win === '1d' ? '매출_1일'  : '매출_14일'
    setConvWindow(win)
    setSort(s => {
      const map = { 'ROAS_1일': rk, 'ROAS_14일': rk, '매출_1일': sk, '매출_14일': sk }
      return map[s.key] ? { ...s, key: map[s.key] } : s
    })
  }

  // "도달 유지" 뱃지: 노출수 상위 30% AND ROAS < 200%
  const reachThreshold = useMemo(() => {
    if (!rows.length) return Infinity
    const vals = [...rows].map(k => k.노출수 ?? 0).sort((a, b) => b - a)
    return vals[Math.floor(vals.length * 0.3)] ?? 0
  }, [rows])

  const isReachable = (kw) => (kw.노출수 ?? 0) >= reachThreshold && kw.ROAS_14일 < 200

  const sorted = useMemo(() =>
    [...rows].sort((a, b) => {
      const av = a[sort.key] ?? 0, bv = b[sort.key] ?? 0
      return sort.dir === 'desc' ? bv - av : av - bv
    }).slice(0, 10),
    [rows, sort]
  )

  const renderCell = (col, kw) => {
    if (col.key === '키워드') {
      return (
        <div className="flex items-center gap-1.5">
          <span title={kw.키워드} className="font-medium text-slate-800 max-w-[100px] truncate block">{kw.키워드}</span>
          {isReachable(kw) && (
            <span className="shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded bg-sky-100 text-sky-700">도달유지</span>
          )}
        </div>
      )
    }
    if (col.key === '__cvr') {
      const cvr = kw.클릭수 > 0 ? ((kw[orderKey] ?? 0) / kw.클릭수 * 100) : 0
      return <span className="text-xs text-slate-600">{fmtPercent(cvr, 2)}</span>
    }
    if (col.chip) {
      if (kw.ROAS_14일 === 0 && kw.광고비 > 0 && !isReachable(kw)) {
        return (
          <div className="flex flex-col items-start gap-0.5">
            {ROAS_CHIP(kw[col.key])}
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-rose-100 text-rose-700">제외 추천</span>
          </div>
        )
      }
      return ROAS_CHIP(kw[col.key])
    }
    if (col.key === '노출수')   return <span className="text-xs text-slate-600">{fmtNumber(kw.노출수)}</span>
    if (col.key === 'CTR')      return <span className="text-xs text-slate-600">{fmtPercent(kw.CTR, 2)}</span>
    return <span className="text-xs text-slate-600">{fmtWon(kw[col.key])}</span>
  }

  return (
    <div className="flex-1 min-w-0">
      <div className={`text-xs font-semibold px-3 py-2 rounded-t-lg flex items-center justify-between ${headerCls}`}>
        <span>{headerText}</span>
        <select
          value={convWindow}
          onChange={e => handleWindowChange(e.target.value)}
          onClick={e => e.stopPropagation()}
          className="text-[10px] font-normal border border-slate-200/60 rounded px-1.5 py-0.5 bg-white/80 text-slate-600"
        >
          <option value="14d">14일 직간접전환</option>
          <option value="1d">1일 직접전환</option>
        </select>
      </div>
      <div className="overflow-x-auto border border-t-0 border-slate-200 rounded-b-lg">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200">
              {KW_COLS.map(col => (
                col.key === '키워드'
                  ? <ResizableTh key={col.key} defaultWidth={110} className="px-3 py-2 text-left text-xs font-semibold text-slate-500">
                      {col.label}
                    </ResizableTh>
                  : <th
                      key={col.key}
                      onClick={() => col.sortable && setSort(s => ({ key: col.key, dir: s.key === col.key && s.dir === 'desc' ? 'asc' : 'desc' }))}
                      className={`px-3 py-2 text-left text-xs font-semibold text-slate-500 select-none whitespace-nowrap ${col.sortable ? 'cursor-pointer hover:text-slate-800' : ''}`}
                    >
                      {col.label}
                      {col.sortable && sort.key === col.key ? (sort.dir === 'desc' ? ' ↓' : ' ↑') : ''}
                    </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((kw, i) => (
              <tr key={i} className="border-b border-slate-100 hover:bg-slate-50">
                {KW_COLS.map(col => (
                  <td key={col.key} className="px-3 py-2">{renderCell(col, kw)}</td>
                ))}
              </tr>
            ))}
            {!sorted.length && (
              <tr><td colSpan={KW_COLS.length} className="px-3 py-6 text-center text-slate-400">키워드 데이터 없음</td></tr>
            )}
          </tbody>
        </table>
      </div>
      {/* 하위 키워드 도달 안내 */}
      {initDir === 'asc' && (
        <p className="text-[11px] text-slate-400 px-3 pt-2 leading-relaxed">
          ℹ 노출량이 높은 키워드는 직접 전환이 낮더라도 브랜드 도달 효과로 지속 검토 가능합니다.
        </p>
      )}
    </div>
  )
}

// ─── 키워드 섹션 (도넛 + 상위/하위) ──────────────────────────────────────────

const DONUT_COLORS = [
  '#2563EB', '#7C3AED', '#059669', '#D97706', '#DC2626',
  '#0891B2', '#BE185D', '#65A30D', '#9333EA', '#EA580C',
]

// ─── 고효율 키워드 테이블 (증액 추천) ─────────────────────────────────────────

function HighEffKeywordTable({ keywords }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden flex flex-col">
      <div className="px-5 py-3.5 border-b border-slate-200 bg-emerald-50 flex items-center gap-2">
        <h3 className="text-sm font-semibold text-emerald-800">고효율 키워드</h3>
        <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">{keywords.length}개</span>
        <span className="text-xs text-emerald-600 ml-auto">ROAS 높고 광고비 적은 키워드</span>
      </div>
      <div className="overflow-x-auto flex-1">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50">
              <ResizableTh defaultWidth={120} className="px-3 py-2 text-left text-xs font-semibold text-slate-500">키워드</ResizableTh>
              <th className="px-3 py-2 text-right text-xs font-semibold text-slate-500">광고비</th>
              <th className="px-3 py-2 text-right text-xs font-semibold text-slate-500">전환매출</th>
              <th className="px-3 py-2 text-right text-xs font-semibold text-slate-500">ROAS</th>
              <th className="px-3 py-2 text-center text-xs font-semibold text-slate-500">추천</th>
            </tr>
          </thead>
          <tbody>
            {keywords.slice(0, 10).map((kw, i) => (
              <tr key={i} className="border-b border-slate-100 hover:bg-slate-50/70">
                <td className="px-3 py-2.5">
                  <span title={kw.키워드} className="font-medium text-slate-800 text-xs block truncate max-w-[110px]">{kw.키워드}</span>
                </td>
                <td className="px-3 py-2.5 text-right text-xs text-slate-500">{fmtWon(kw.광고비)}</td>
                <td className="px-3 py-2.5 text-right text-xs text-slate-700 font-medium">{fmtWon(kw.매출_14일)}</td>
                <td className="px-3 py-2.5 text-right">{ROAS_CHIP(kw.ROAS_14일)}</td>
                <td className="px-3 py-2.5 text-center">
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">증액 추천</span>
                </td>
              </tr>
            ))}
            {!keywords.length && (
              <tr><td colSpan={5} className="px-3 py-10 text-center text-slate-400 text-xs">고효율 키워드 없음</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─── 저효율 키워드 테이블 (제외 추천) ─────────────────────────────────────────

function LowEffKeywordTable({ keywords }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden flex flex-col">
      <div className="px-5 py-3.5 border-b border-slate-200 bg-rose-50 flex items-center gap-2">
        <h3 className="text-sm font-semibold text-rose-800">저효율 키워드</h3>
        <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-700">{keywords.length}개</span>
        <span className="text-xs text-rose-600 ml-auto">광고비 있으나 전환매출 0</span>
      </div>
      <div className="overflow-x-auto flex-1">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50">
              <ResizableTh defaultWidth={120} className="px-3 py-2 text-left text-xs font-semibold text-slate-500">키워드</ResizableTh>
              <th className="px-3 py-2 text-right text-xs font-semibold text-slate-500">광고비</th>
              <th className="px-3 py-2 text-right text-xs font-semibold text-slate-500">클릭수</th>
              <th className="px-3 py-2 text-right text-xs font-semibold text-slate-500">노출수</th>
              <th className="px-3 py-2 text-center text-xs font-semibold text-slate-500">추천</th>
            </tr>
          </thead>
          <tbody>
            {keywords.slice(0, 10).map((kw, i) => (
              <tr key={i} className="border-b border-slate-100 hover:bg-slate-50/70">
                <td className="px-3 py-2.5">
                  <span title={kw.키워드} className="font-medium text-slate-800 text-xs block truncate max-w-[110px]">{kw.키워드}</span>
                </td>
                <td className="px-3 py-2.5 text-right text-xs text-rose-600 font-medium">{fmtWon(kw.광고비)}</td>
                <td className="px-3 py-2.5 text-right text-xs text-slate-500">{fmtNumber(kw.클릭수)}</td>
                <td className="px-3 py-2.5 text-right text-xs text-slate-500">{fmtNumber(kw.노출수)}</td>
                <td className="px-3 py-2.5 text-center">
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-700">제외 추천</span>
                </td>
              </tr>
            ))}
            {!keywords.length && (
              <tr><td colSpan={5} className="px-3 py-10 text-center text-slate-400 text-xs">저효율 키워드 없음</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─── Brand Ads 제안 박스 ─────────────────────────────────────────────────────

function BrandAdsBox({ categoryRevenue, totalSpend }) {
  return (
    <div className="bg-gradient-to-r from-violet-50 to-blue-50 border border-violet-200 rounded-xl p-5">
      <div className="flex items-start gap-4">
        <div className="w-9 h-9 rounded-lg bg-violet-600 flex items-center justify-center shrink-0 mt-0.5">
          <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.562.562 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <h3 className="text-sm font-bold text-violet-900">Brand Ads 집행 검토</h3>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-violet-100 text-violet-700">추천</span>
          </div>
          <p className="text-xs text-slate-600 leading-relaxed mb-3">
            카테고리 키워드 전환매출{' '}
            <strong className="text-slate-800">{Math.round(categoryRevenue / 10000)}만원</strong> 달성,
            전체 광고비{' '}
            <strong className="text-slate-800">{Math.round(totalSpend / 10000)}만원</strong>{' '}
            이상 집행 중입니다. 브랜드 검색 점유율 확보를 위한 Brand Ads 집행을 검토할 시점입니다.
          </p>
          <div className="space-y-1.5">
            <p className="flex items-center gap-2 text-xs text-violet-700 font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-violet-500 shrink-0" />
              카테고리 키워드 유입 확인 → Brand Ads로 브랜드 전환 유도 검토
            </p>
            <p className="flex items-center gap-2 text-xs text-violet-700 font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-violet-500 shrink-0" />
              브랜드 검색 시 경쟁사 광고 노출 차단 효과 기대
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── 카테고리 vs 자사 키워드 도넛 ────────────────────────────────────────────

const BC_COLORS = { brand: '#7C3AED', category: '#2563EB', other: '#94A3B8' }
const BC_LABELS = { brand: '자사 키워드', category: '카테고리 키워드', other: '기타' }

function BrandCategoryDonut({ keywords, brandTags, onAddTag, onRemoveTag }) {
  const [metric,   setMetric]   = useState('revenue')
  const [showTip,  setShowTip]  = useState(false)
  const [editing,  setEditing]  = useState(false)
  const [inputVal, setInputVal] = useState('')
  const inputRef = useRef(null)

  useEffect(() => {
    if (editing) inputRef.current?.focus()
  }, [editing])

  const commitInput = () => {
    const val = inputVal.trim().replace(/,+$/, '').trim()
    if (val) onAddTag(val)
    setInputVal('')
  }

  const handleKeyDown = e => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      commitInput()
    } else if (e.key === 'Backspace' && inputVal === '' && brandTags.length > 0) {
      onRemoveTag(brandTags[brandTags.length - 1])
    }
  }

  const handleChange = e => {
    const v = e.target.value
    if (v.includes(',')) {
      const parts = v.split(',')
      parts.slice(0, -1).forEach(p => { const t = p.trim(); if (t) onAddTag(t) })
      setInputVal(parts[parts.length - 1])
    } else {
      setInputVal(v)
    }
  }

  const groups = useMemo(() => {
    const acc = {
      brand:    { 광고비: 0, 매출_14일: 0 },
      category: { 광고비: 0, 매출_14일: 0 },
      other:    { 광고비: 0, 매출_14일: 0 },
    }
    for (const k of keywords) {
      const t = acc[k.분류] ?? acc.other
      t.광고비    += k.광고비
      t.매출_14일 += k.매출_14일
    }
    return ['brand', 'category', 'other'].map(key => ({
      key,
      name:  BC_LABELS[key],
      value: metric === 'revenue' ? acc[key].매출_14일 : acc[key].광고비,
      ROAS:  acc[key].광고비 > 0 ? Math.round(acc[key].매출_14일 / acc[key].광고비 * 100) : 0,
      color: BC_COLORS[key],
    })).filter(g => g.value > 0)
  }, [keywords, metric])

  const total = groups.reduce((s, g) => s + g.value, 0)

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5">
      <div className="flex items-center gap-1.5 mb-1">
        <h4 className="text-sm font-semibold text-slate-800">카테고리 vs 자사 키워드</h4>
        <div className="relative">
          <button
            onMouseEnter={() => setShowTip(true)}
            onMouseLeave={() => setShowTip(false)}
            className="w-4 h-4 rounded-full bg-slate-100 text-slate-500 text-[10px] font-bold flex items-center justify-center hover:bg-slate-200 transition-colors"
          >
            i
          </button>
          {showTip && (
            <div className="absolute left-0 top-5 z-20 bg-slate-800 text-white text-xs rounded-lg p-3 w-64 leading-relaxed shadow-xl whitespace-normal">
              브랜드명을 직접 입력하면 자사/카테고리 키워드를 정확하게 분류합니다. 브랜드명 미입력 시 상품명 토큰으로 자동 분류합니다. (참고치)
            </div>
          )}
        </div>
        <button
          onClick={() => setEditing(v => !v)}
          title="브랜드명 편집"
          className={`w-5 h-5 flex items-center justify-center rounded transition-colors ${editing ? 'bg-violet-100 text-violet-600' : 'text-slate-400 hover:bg-slate-100 hover:text-slate-600'}`}
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125" />
          </svg>
        </button>
        <select
          value={metric}
          onChange={e => setMetric(e.target.value)}
          className="ml-auto text-xs border border-slate-200 rounded-md px-2 py-1 text-slate-600 bg-white"
        >
          <option value="revenue">전환매출 기준</option>
          <option value="spend">광고비 기준</option>
        </select>
      </div>

      {editing && (
        <div className="mb-3 p-3 bg-violet-50 rounded-lg border border-violet-200">
          <p className="text-[11px] text-violet-600 font-medium mb-2">브랜드명 입력 (Enter 또는 쉼표로 추가)</p>
          <div
            className="flex flex-wrap gap-1.5 p-2 bg-white rounded-md border border-violet-200 min-h-[36px] cursor-text"
            onClick={() => inputRef.current?.focus()}
          >
            {brandTags.map((tag, i) => (
              <span key={i} className="inline-flex items-center gap-1 bg-violet-100 text-violet-700 text-xs font-medium px-2 py-0.5 rounded-full">
                {tag}
                <button
                  onClick={e => { e.stopPropagation(); onRemoveTag(tag) }}
                  className="hover:text-violet-900 text-violet-500 leading-none"
                >&times;</button>
              </span>
            ))}
            <input
              ref={inputRef}
              value={inputVal}
              onChange={handleChange}
              onKeyDown={handleKeyDown}
              onBlur={commitInput}
              placeholder={brandTags.length === 0 ? '예: 메이제이, 알레' : ''}
              className="flex-1 min-w-[80px] text-xs outline-none bg-transparent text-slate-700 placeholder-slate-300"
            />
          </div>
        </div>
      )}

      <p className="text-xs text-slate-400 mb-4">
        {brandTags.length > 0 ? `브랜드명 ${brandTags.length}개 기준 분류` : '상품명 토큰 기반 자동 분류'}
      </p>

      {groups.length > 0 ? (
        <div className="flex flex-wrap items-center gap-4">
          <div className="w-40 h-40 shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={groups} cx="50%" cy="50%" innerRadius={44} outerRadius={68} paddingAngle={2} dataKey="value">
                  {groups.map((g, i) => <Cell key={i} fill={g.color} />)}
                </Pie>
                <ChartTooltip
                  formatter={(v, name) => [fmtWon(v), name]}
                  contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #E2E8F0' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex-1 space-y-3 min-w-0">
            {groups.map((g, i) => (
              <div key={i} className="flex items-start gap-2">
                <span className="w-2.5 h-2.5 rounded-sm shrink-0 mt-0.5" style={{ background: g.color }} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-medium text-slate-700">{g.name}</span>
                    <span className="text-xs font-semibold text-slate-600 shrink-0">{total > 0 ? Math.round(g.value / total * 100) : 0}%</span>
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[11px] text-slate-400">{fmtWon(g.value)}</span>
                    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
                      g.ROAS >= 300 ? 'bg-emerald-100 text-emerald-700'
                      : g.ROAS >= 100 ? 'bg-blue-100 text-blue-700'
                      : 'bg-red-100 text-red-700'
                    }`}>
                      ROAS {g.ROAS.toLocaleString()}%
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-center h-32 text-slate-400 text-xs">키워드 분류 데이터 없음</div>
      )}
    </div>
  )
}

// ─── 키워드 섹션 ─────────────────────────────────────────────────────────────

const LS_BRAND_KEY = 'ad_analytics_brand_tags'

function KeywordSection({ keywords, isAll, data }) {
  const displayKeywords = isAll ? keywords.slice(0, 100) : keywords

  const [brandTags, setBrandTags] = useState(() => {
    try { return JSON.parse(localStorage.getItem(LS_BRAND_KEY)) ?? [] } catch { return [] }
  })

  const addBrandTag = useCallback(tag => {
    setBrandTags(prev => {
      if (prev.includes(tag)) return prev
      const next = [...prev, tag]
      localStorage.setItem(LS_BRAND_KEY, JSON.stringify(next))
      return next
    })
  }, [])

  const removeBrandTag = useCallback(tag => {
    setBrandTags(prev => {
      const next = prev.filter(t => t !== tag)
      localStorage.setItem(LS_BRAND_KEY, JSON.stringify(next))
      return next
    })
  }, [])

  const donutData = useMemo(() => {
    const top10 = [...displayKeywords]
      .filter(k => k.키워드 !== '비검색')
      .sort((a, b) => b.매출_14일 - a.매출_14일)
      .slice(0, 10)
    const total = top10.reduce((s, k) => s + k.매출_14일, 0)
    return total > 0
      ? top10.map(k => ({ name: k.키워드, value: k.매출_14일, pct: Math.round(k.매출_14일 / total * 100) }))
      : []
  }, [displayKeywords])

  const classified = useMemo(() => {
    const productTokens = extractProductTokens(data)
    return displayKeywords
      .filter(k => k.키워드 !== '비검색')
      .map(k => ({ ...k, 분류: classifyKeyword(k.키워드, productTokens, brandTags) }))
  }, [displayKeywords, data, brandTags])

  const realKws  = useMemo(() => displayKeywords.filter(k => k.키워드 !== '비검색' && k.광고비 > 0), [displayKeywords])
  const avgSpend = realKws.length ? realKws.reduce((s, k) => s + k.광고비, 0) / realKws.length : 0

  const reachThreshold = useMemo(() => {
    if (!realKws.length) return Infinity
    const vals = [...realKws].map(k => k.노출수 ?? 0).sort((a, b) => b - a)
    return vals[Math.floor(vals.length * 0.3)] ?? 0
  }, [realKws])

  const isKwReachable = useCallback(kw => (kw.노출수 ?? 0) >= reachThreshold && kw.ROAS_14일 < 200, [reachThreshold])

  const highEff = useMemo(
    () => realKws.filter(k => k.ROAS_14일 > 300 && k.광고비 < avgSpend).sort((a, b) => b.ROAS_14일 - a.ROAS_14일),
    [realKws, avgSpend]
  )
  const lowEff = useMemo(
    () => realKws.filter(k => k.광고비 > 0 && k.매출_14일 === 0 && !isKwReachable(k)).sort((a, b) => b.광고비 - a.광고비),
    [realKws, isKwReachable]
  )

  const categoryRevenue = useMemo(
    () => classified.filter(k => k.분류 === 'category').reduce((s, k) => s + k.매출_14일, 0),
    [classified]
  )
  const totalKwSpend = useMemo(() => keywords.reduce((s, k) => s + k.광고비, 0), [keywords])
  const showBrandAds = categoryRevenue >= 500000 && totalKwSpend >= 3000000

  const byDesc = useMemo(() => [...displayKeywords].sort((a, b) => b.ROAS_14일 - a.ROAS_14일), [displayKeywords])
  const byAsc  = useMemo(() => [...displayKeywords].sort((a, b) => a.ROAS_14일 - b.ROAS_14일), [displayKeywords])

  return (
    <div className="space-y-4">
      {isAll && (
        <div className="flex items-center gap-2 px-4 py-2.5 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-700">
          <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          전체 키워드 중 상위 100개를 표시합니다. 캠페인을 선택하면 더 정확한 분석이 가능합니다.
        </div>
      )}

      {/* 도넛 차트 2개 나란히 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {donutData.length > 0 && (
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <h4 className="text-sm font-semibold text-slate-800 mb-0.5">상위 10개 키워드 매출 비중</h4>
            <p className="text-xs text-slate-400 mb-4">광고전환매출액(14일) 기준</p>
            <div className="flex flex-wrap items-center gap-4">
              <div className="w-40 h-40 shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={donutData} cx="50%" cy="50%" innerRadius={44} outerRadius={68} paddingAngle={2} dataKey="value">
                      {donutData.map((_, i) => <Cell key={i} fill={DONUT_COLORS[i % DONUT_COLORS.length]} />)}
                    </Pie>
                    <ChartTooltip
                      formatter={(v, name) => [fmtWon(v), name]}
                      contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #E2E8F0' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 min-w-0">
                {donutData.map((d, i) => (
                  <div key={i} className="flex items-center gap-2 min-w-0">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: DONUT_COLORS[i % DONUT_COLORS.length] }} />
                    <span title={d.name} className="text-xs text-slate-700 truncate">{d.name}</span>
                    <span className="text-xs font-semibold text-slate-500 shrink-0 ml-auto">{d.pct}%</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
        <BrandCategoryDonut
          keywords={classified}
          brandTags={brandTags}
          onAddTag={addBrandTag}
          onRemoveTag={removeBrandTag}
        />
      </div>

      {/* 고효율 / 저효율 테이블 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <HighEffKeywordTable keywords={highEff} />
        <LowEffKeywordTable keywords={lowEff} />
      </div>

      {/* Brand Ads 제안 */}
      {showBrandAds && <BrandAdsBox categoryRevenue={categoryRevenue} totalSpend={totalKwSpend} />}

      {/* 상위 / 하위 ROAS 비교 */}
      <div className="flex gap-4">
        <KeywordTable rows={byDesc} initDir="desc" headerText="▲ 상위 키워드 (ROAS 높은 순)" headerCls="bg-emerald-50 text-emerald-700" />
        <KeywordTable rows={byAsc}  initDir="asc"  headerText="▼ 하위 키워드 (ROAS 낮은 순)" headerCls="bg-red-50 text-red-700" />
      </div>
    </div>
  )
}

// ─── 상품별 탭 (백엔드 API 기반) ─────────────────────────────────────────────

const PRODUCT_COLS = [
  { key: '상품명',     label: '상품명',        sortable: false },
  { key: '광고비',     label: '광고비',         sortable: true },
  { key: '매출_1일',   label: '직접매출(1일)',  sortable: true },
  { key: '매출_14일',  label: '간접매출(14일)', sortable: true },
  { key: 'ROAS_1일',   label: 'ROAS(1일)',     sortable: true, chip: true },
  { key: 'ROAS_14일',  label: 'ROAS(14일)',    sortable: true, chip: true },
  { key: 'CPC',        label: 'CPC',           sortable: true },
  { key: '주문수_1일',  label: '주문(1일)',      sortable: true },
  { key: '주문수_14일', label: '주문(14일)',     sortable: true },
]

function ProductTab({ selectedCampaign, onCopy }) {
  const PAGE_LIMIT = 20
  const [result,  setResult]  = useState(null)
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState(null)
  const [page,    setPage]    = useState(1)
  const [sort,    setSort]    = useState({ key: '매출_14일', dir: 'desc' })

  useEffect(() => {
    setPage(1)
    setResult(null)
  }, [selectedCampaign, sort.key, sort.dir])

  useEffect(() => {
    if (selectedCampaign === '전체') return
    let cancelled = false
    setLoading(true)
    setError(null)
    const qs = new URLSearchParams({
      campaign: selectedCampaign,
      page:     String(page),
      limit:    String(PAGE_LIMIT),
      sort:     sort.key,
      dir:      sort.dir,
    })
    const url = `/api/products?${qs}`
    console.log('[ProductTab] 요청 URL:', url)

    fetch(url)
      .then(async r => {
        const text = await r.text()
        console.log(`[ProductTab] 응답 HTTP ${r.status} ${r.statusText}`)
        console.log('[ProductTab] 응답 본문:', text.slice(0, 800))

        if (!r.ok) {
          let detail
          try { detail = JSON.parse(text).detail } catch {}

          // 원인별 한국어 에러 메시지
          if (r.status === 404 && detail === 'Not Found') {
            throw new Error('백엔드를 재시작해 주세요 (새 엔드포인트가 아직 로드되지 않았습니다)')
          }
          if (r.status === 404) {
            throw new Error('업로드된 데이터가 없습니다. 파일을 다시 업로드해 주세요')
          }
          throw new Error(detail ?? `HTTP ${r.status} ${r.statusText}`)
        }

        return JSON.parse(text)
      })
      .then(d => {
        console.log(`[ProductTab] 데이터: total=${d.total}, items=${d.items?.length}, page=${d.page}/${d.total_pages}`)
        if (d.items?.length > 0) {
          console.log('[ProductTab] 첫 번째 상품 키:', Object.keys(d.items[0]))
          console.log('[ProductTab] 첫 번째 상품 샘플:', d.items[0])
        } else {
          console.warn('[ProductTab] items 비어있음. debug_columns:', d.debug_columns)
        }
        if (!cancelled) { setResult(d); setLoading(false) }
      })
      .catch(e => {
        console.error('[ProductTab] 에러:', e.message)
        if (!cancelled) { setError(e.message); setLoading(false) }
      })

    return () => { cancelled = true }
  }, [selectedCampaign, page, sort.key, sort.dir])

  const handleSort = (key) => {
    setSort(s => ({ key, dir: s.key === key && s.dir === 'desc' ? 'asc' : 'desc' }))
  }

  // 캠페인 미선택 시 진입 차단
  if (selectedCampaign === '전체') {
    return (
      <div className="bg-white rounded-xl border border-slate-200 flex flex-col items-center justify-center py-16 gap-3">
        <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center">
          <svg className="w-6 h-6 text-slate-400" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
          </svg>
        </div>
        <p className="text-sm font-semibold text-slate-600">캠페인을 선택하면 상품별 분석이 시작됩니다</p>
        <p className="text-xs text-slate-400">상단 캠페인 드롭다운에서 분석할 캠페인을 선택해 주세요</p>
      </div>
    )
  }

  const items      = result?.items      ?? []
  const total      = result?.total      ?? 0
  const totalPages = result?.total_pages ?? 1

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      {/* 헤더 */}
      <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-slate-800">직접(1일) vs 간접(14일) 전환 성과</h3>
          <p className="text-xs text-slate-400 mt-0.5">
            상품별 기준 · {selectedCampaign} · 총 {total.toLocaleString()}개 상품
          </p>
        </div>
        {loading && (
          <div className="w-4 h-4 rounded-full border-2 border-blue-600 border-t-transparent animate-spin shrink-0" />
        )}
      </div>

      {/* 에러 */}
      {error && (
        <div className="px-5 py-8 flex flex-col items-center gap-2 text-center bg-red-50">
          <p className="text-sm font-semibold text-red-700">{error}</p>
          {error.includes('재시작') && (
            <p className="text-xs text-red-500">터미널에서 백엔드를 재시작한 뒤 파일을 다시 업로드해 주세요</p>
          )}
          {error.includes('업로드') && (
            <p className="text-xs text-red-500">사이드바 하단 "파일 재업로드" 버튼을 눌러 주세요</p>
          )}
        </div>
      )}

      {/* 테이블 */}
      {!error && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200">
                {PRODUCT_COLS.map(col =>
                  col.key === '상품명'
                    ? <ResizableTh key={col.key} defaultWidth={200} className="px-3 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide select-none">
                        {col.label}
                      </ResizableTh>
                    : <th
                        key={col.key}
                        onClick={() => col.sortable && handleSort(col.key)}
                        className={`px-3 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide select-none whitespace-nowrap ${col.sortable ? 'cursor-pointer hover:text-slate-800' : ''}`}
                      >
                        {col.label}
                        {col.sortable && sort.key === col.key ? (sort.dir === 'desc' ? ' ↓' : ' ↑') : ''}
                      </th>
                )}
              </tr>
            </thead>
            <tbody>
              {/* 스켈레톤 로딩 */}
              {loading && !items.length
                ? Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i} className="border-b border-slate-100">
                      {PRODUCT_COLS.map(col => (
                        <td key={col.key} className="px-3 py-2.5">
                          <div className="h-3.5 bg-slate-100 rounded animate-pulse" style={{ width: col.key === '상품명' ? 160 : 64 }} />
                        </td>
                      ))}
                    </tr>
                  ))
                : items.map((r, i) => (
                    <tr key={i} className="border-b border-slate-100 hover:bg-slate-50/70 transition-colors">
                      <td className="px-3 py-2.5 font-medium text-slate-800 max-w-[200px]">
                        <span title={r.상품명} className="truncate block">{r.상품명}</span>
                        {r.옵션ID && (
                          <button
                            onClick={() => onCopy?.(String(r.옵션ID))}
                            className="text-[11px] text-slate-400 hover:text-blue-600 font-mono mt-0.5 transition-colors block truncate max-w-full"
                          >
                            #{r.옵션ID}
                          </button>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-slate-600">{fmtWon(r.광고비)}</td>
                      <td className="px-3 py-2.5 text-slate-600">{fmtWon(r.매출_1일)}</td>
                      <td className="px-3 py-2.5 font-semibold text-slate-800">{fmtWon(r.매출_14일)}</td>
                      <td className="px-3 py-2.5">{ROAS_CHIP(r.ROAS_1일  ?? 0)}</td>
                      <td className="px-3 py-2.5">{ROAS_CHIP(r.ROAS_14일 ?? 0)}</td>
                      <td className="px-3 py-2.5 text-slate-600">{fmtWon(r.CPC)}</td>
                      <td className="px-3 py-2.5 text-slate-600">{fmtNumber(r.주문수_1일)}</td>
                      <td className="px-3 py-2.5 text-slate-600">{fmtNumber(r.주문수_14일)}</td>
                    </tr>
                  ))
              }
              {!loading && !items.length && (
                <tr>
                  <td colSpan={PRODUCT_COLS.length} className="px-3 py-10 text-center text-slate-400">
                    데이터 없음
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* 페이지네이션 */}
      {!error && totalPages > 1 && (
        <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200">
          <span className="text-xs text-slate-400">
            총 {total.toLocaleString()}개 중 {((page - 1) * PAGE_LIMIT + 1).toLocaleString()}–
            {Math.min(page * PAGE_LIMIT, total).toLocaleString()}번째
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage(p => p - 1)}
              disabled={page <= 1 || loading}
              className="px-2.5 py-1 text-xs rounded-md border border-slate-200 text-slate-600 disabled:opacity-30 hover:bg-slate-50 transition-colors"
            >이전</button>
            <span className="text-xs text-slate-600 font-medium px-2.5">{page} / {totalPages}</span>
            <button
              onClick={() => setPage(p => p + 1)}
              disabled={page >= totalPages || loading}
              className="px-2.5 py-1 text-xs rounded-md border border-slate-200 text-slate-600 disabled:opacity-30 hover:bg-slate-50 transition-colors"
            >다음</button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── 정규화 상품 분석 섹션 ────────────────────────────────────────────────────

const ROAS_BAR_COLOR = r => r >= 400 ? '#10B981' : r >= 200 ? '#2563EB' : r >= 100 ? '#F59E0B' : '#EF4444'

function NormalizedProductSection({ data, onCopy }) {
  const products = useMemo(() => groupByNormalizedProduct(data), [data])
  const [expandedRows, setExpandedRows] = useState(new Set())

  const warnProducts = useMemo(
    () => products.filter(p => p.hasZeroRevenue).slice(0, 6),
    [products]
  )

  const bundleProducts = useMemo(
    () => products.filter(p => p.bundleCount > 1).slice(0, 4),
    [products]
  )

  const toggleRow = useCallback((name) => {
    setExpandedRows(prev => {
      const next = new Set(prev)
      if (next.has(name)) next.delete(name)
      else next.add(name)
      return next
    })
  }, [])

  if (!products.length) return null

  return (
    <div className="space-y-4">
      {/* 전환매출 0 경고 박스 */}
      {warnProducts.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <svg className="w-4 h-4 text-amber-600 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
            </svg>
            <span className="text-sm font-semibold text-amber-800">전환매출 0 경고 상품</span>
            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">{warnProducts.length}개</span>
          </div>
          <div className="space-y-1.5">
            {warnProducts.map((p, i) => (
              <div key={i} className="flex items-center justify-between bg-white rounded-lg px-3 py-2 border border-amber-100">
                <span className="text-xs font-medium text-slate-800 truncate max-w-[200px]">{p.상품명}</span>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-xs text-slate-500">광고비 {fmtWon(p.광고비)}</span>
                  <span className="text-xs font-bold text-rose-600">전환매출 없음</span>
                </div>
              </div>
            ))}
          </div>
          <p className="text-xs text-amber-600 mt-2.5 leading-relaxed">
            → 광고비 1만원 이상 집행 중이나 전환이 없는 상품입니다. 상품 경쟁력(가격·이미지·리뷰) 점검 또는 광고 중지 검토 필요.
          </p>
        </div>
      )}

      {/* 구성별 ROAS 비교 차트 */}
      {bundleProducts.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h3 className="text-sm font-semibold text-slate-800 mb-1">구성별 ROAS 비교</h3>
          <p className="text-xs text-slate-400 mb-5">동일 상품의 구성(1개/2개/3개/6개)별 ROAS 비교 · 14일 기준</p>
          <div className="space-y-5">
            {bundleProducts.map((p, i) => {
              const chartData = Object.entries(p.bundleRoas)
                .map(([label, roas]) => ({ label, ROAS: roas }))
                .sort((a, b) => parseInt(a.label) - parseInt(b.label))
              return (
                <div key={i}>
                  <p className="text-xs font-semibold text-slate-700 mb-2 truncate">{p.상품명}</p>
                  <div style={{ height: 72 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={chartData} layout="vertical" margin={{ top: 0, right: 56, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" horizontal={false} />
                        <XAxis type="number" tick={{ fontSize: 10, fill: '#94A3B8' }} tickFormatter={v => `${v}%`} axisLine={false} tickLine={false} />
                        <YAxis type="category" dataKey="label" tick={{ fontSize: 10, fill: '#64748B' }} axisLine={false} tickLine={false} width={30} />
                        <ChartTooltip formatter={v => [`${v.toLocaleString()}%`, 'ROAS']} contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #E2E8F0' }} />
                        <Bar dataKey="ROAS" radius={[0, 3, 3, 0]} maxBarSize={14} label={{ position: 'right', fontSize: 10, fill: '#64748B', formatter: v => `${v.toLocaleString()}%` }}>
                          {chartData.map((e, j) => <Cell key={j} fill={ROAS_BAR_COLOR(e.ROAS)} />)}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* 정규화 상품 테이블 (펼치기/접기) */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200">
          <h3 className="text-sm font-semibold text-slate-800">정규화 상품 성과</h3>
          <p className="text-xs text-slate-400 mt-0.5">수량 제거 후 상품 그룹별 집계 · ▶ 클릭 시 구성별 옵션ID 확인 · 상위 {Math.min(products.length, 15)}개</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="w-8 px-2 py-2.5" />
                <ResizableTh defaultWidth={200} className="px-3 py-2.5 text-left text-xs font-semibold text-slate-500">상품명</ResizableTh>
                <th className="px-3 py-2.5 text-right text-xs font-semibold text-slate-500">광고비</th>
                <th className="px-3 py-2.5 text-right text-xs font-semibold text-slate-500">전환매출</th>
                <th className="px-3 py-2.5 text-right text-xs font-semibold text-slate-500">ROAS</th>
                <th className="px-3 py-2.5 text-right text-xs font-semibold text-slate-500">주문수</th>
                <th className="px-3 py-2.5 text-center text-xs font-semibold text-slate-500">상태</th>
              </tr>
            </thead>
            <tbody>
              {products.slice(0, 15).map((p, i) => {
                const isExpanded = expandedRows.has(p.상품명)
                const bundleEntries = Object.entries(p.bundleDetails ?? {})
                  .sort(([a], [b]) => parseInt(a) - parseInt(b))
                return (
                  <>
                    <tr
                      key={`row-${i}`}
                      className={`border-b border-slate-100 transition-colors ${p.hasZeroRevenue ? 'bg-amber-50/30' : 'hover:bg-slate-50/70'}`}
                    >
                      {/* 펼치기 버튼 */}
                      <td className="px-2 py-2.5 text-center">
                        {bundleEntries.length > 0 && (
                          <button
                            onClick={() => toggleRow(p.상품명)}
                            className="w-5 h-5 flex items-center justify-center text-slate-400 hover:text-slate-700 transition-colors rounded"
                          >
                            <svg
                              className={`w-3 h-3 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                              fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                            </svg>
                          </button>
                        )}
                      </td>
                      <td className="px-3 py-2.5 font-medium text-slate-800 max-w-[200px]">
                        <span title={p.상품명} className="truncate block">{p.상품명}</span>
                      </td>
                      <td className="px-3 py-2.5 text-right text-xs text-slate-500">{fmtWon(p.광고비)}</td>
                      <td className="px-3 py-2.5 text-right text-xs font-semibold text-slate-800">{fmtWon(p.매출_14일)}</td>
                      <td className="px-3 py-2.5 text-right">{ROAS_CHIP(p.ROAS_14일)}</td>
                      <td className="px-3 py-2.5 text-right text-xs text-slate-500">{fmtNumber(p.주문수_14일)}</td>
                      <td className="px-3 py-2.5 text-center">
                        {p.hasZeroRevenue
                          ? <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-700">경고</span>
                          : p.ROAS_14일 >= 400
                            ? <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700">우수</span>
                            : null
                        }
                      </td>
                    </tr>

                    {/* 펼쳐진 구성별 서브테이블 */}
                    {isExpanded && bundleEntries.length > 0 && (
                      <tr key={`detail-${i}`} className="border-b border-slate-200">
                        <td colSpan={7} className="px-4 py-2.5 bg-slate-50">
                          <div className="rounded-lg border border-slate-200 overflow-hidden">
                            <table className="w-full">
                              <thead>
                                <tr className="bg-slate-100 border-b border-slate-200">
                                  <th className="px-3 py-2 text-left text-[11px] font-semibold text-slate-500">구성</th>
                                  <th className="px-3 py-2 text-left text-[11px] font-semibold text-slate-500">옵션ID</th>
                                  <th className="px-3 py-2 text-right text-[11px] font-semibold text-slate-500">광고비</th>
                                  <th className="px-3 py-2 text-right text-[11px] font-semibold text-slate-500">전환매출</th>
                                  <th className="px-3 py-2 text-right text-[11px] font-semibold text-slate-500">ROAS</th>
                                </tr>
                              </thead>
                              <tbody>
                                {bundleEntries.map(([label, detail], j) => (
                                  <tr key={j} className="border-t border-slate-100 hover:bg-white transition-colors">
                                    <td className="px-3 py-2 text-xs font-semibold text-slate-700">{label}</td>
                                    <td className="px-3 py-2">
                                      {detail.optionIds.length > 0 ? (
                                        detail.optionIds.map((id, k) => (
                                          <button
                                            key={k}
                                            onClick={() => onCopy?.(id)}
                                            className="text-[11px] font-mono text-slate-500 hover:text-blue-600 transition-colors mr-1.5"
                                          >
                                            #{id}
                                          </button>
                                        ))
                                      ) : (
                                        <span className="text-[11px] text-slate-300">-</span>
                                      )}
                                    </td>
                                    <td className="px-3 py-2 text-right text-xs text-slate-500">{fmtWon(detail.광고비)}</td>
                                    <td className="px-3 py-2 text-right text-xs font-semibold text-slate-700">{fmtWon(detail.매출_14일)}</td>
                                    <td className="px-3 py-2 text-right">{ROAS_CHIP(detail.ROAS)}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                )
              })}
              {!products.length && (
                <tr>
                  <td colSpan={7} className="px-3 py-10 text-center text-slate-400">데이터 없음</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// ─── 지면별 탭 ────────────────────────────────────────────────────────────────

function PlacementTab({ placements, campaignLabel }) {
  if (!placements.length) {
    return <p className="px-5 py-10 text-center text-slate-400 text-sm">지면 데이터 없음</p>
  }

  const totalSpend          = placements.reduce((s, p) => s + p.광고비, 0)
  const best                = [...placements].sort((a, b) => b.ROAS - a.ROAS)[0]
  const worst               = [...placements].sort((a, b) => a.ROAS - b.ROAS)[0]
  const audiencePlacement   = placements.find(p => p.지면.includes('오디언스'))
  const nonAudience         = placements.filter(p => !p.지면.includes('오디언스'))
  const minOtherRoas        = nonAudience.length ? Math.min(...nonAudience.map(p => p.ROAS)) : null
  const allLowRoas          = placements.every(p => p.ROAS <= 100)
  const isAudienceFree      = audiencePlacement && audiencePlacement.광고비 === 0 && (audiencePlacement.노출수 ?? 0) > 0
  const showAudienceOff     = audiencePlacement && !isAudienceFree && (
    audiencePlacement.ROAS <= 100 ||
    (minOtherRoas !== null && audiencePlacement.ROAS < minOtherRoas / 2)
  )

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {placements.map(p => {
          const cvr      = p.클릭수 > 0 ? (p.주문수_14일 / p.클릭수 * 100) : 0
          const share    = totalSpend > 0 ? Math.round(p.광고비 / totalSpend * 100) : 0
          const isFree   = p.지면.includes('오디언스') && p.광고비 === 0 && (p.노출수 ?? 0) > 0
          const badge    = isFree
            ? null
            : p.ROAS >= 300
            ? { txt: 'ROAS 우수', cls: 'text-emerald-700 bg-emerald-100' }
            : p.ROAS >= 150
            ? { txt: 'ROAS 양호', cls: 'text-blue-700 bg-blue-100' }
            : { txt: '개선 필요',  cls: 'text-amber-700 bg-amber-100' }
          return (
            <div key={p.지면} className="bg-white rounded-xl border border-slate-200 p-5">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <p className="text-sm font-bold text-slate-800">{p.지면}</p>
                  <p className="text-xs text-slate-400 mt-0.5">광고비 비중 {share}%</p>
                </div>
                {badge && <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${badge.cls}`}>{badge.txt}</span>}
              </div>
              <div className="space-y-2.5">
                {[
                  ['노출수',        fmtNumber(p.노출수)],
                  ['광고비',        fmtWon(p.광고비)],
                  ['전환매출(14일)', fmtWon(p.매출_14일)],
                  ['ROAS',         `${p.ROAS.toLocaleString()}%`],
                  ['CVR',          fmtPercent(cvr, 2)],
                ].map(([label, val]) => (
                  <div key={label} className="flex items-center justify-between">
                    <span className="text-xs text-slate-500">{label}</span>
                    <span className="text-xs font-semibold text-slate-800">{val}</span>
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-xl p-5 space-y-2">
        <div className="flex items-center gap-2">
          <p className="text-sm font-semibold text-slate-800">AI 지면 분석</p>
          <span className="text-xs bg-blue-100 text-blue-700 font-semibold px-2 py-0.5 rounded-full">{campaignLabel}</span>
        </div>
        <p className="text-xs text-slate-600 leading-relaxed">
          <strong>{best.지면}</strong> 지면이 ROAS {best.ROAS.toLocaleString()}%로{' '}
          {allLowRoas
            ? '가장 높은 성과이나, 100% 미만으로 손실 구간입니다.'
            : '가장 높은 성과를 기록하고 있습니다.'
          }
          {!allLowRoas && worst.지면 !== best.지면
            ? ` 반면 ${worst.지면} 지면은 ROAS ${worst.ROAS.toLocaleString()}%로 개선이 필요합니다.`
            : !allLowRoas ? ' 전체 지면이 균등한 성과를 보이고 있습니다.' : ''
          }
        </p>
        <p className="text-xs font-semibold text-blue-700">
          → {best.지면} 예산 집중 편성 검토
          {!showAudienceOff && worst.지면 !== best.지면 ? ` · ${worst.지면} 입찰 전략 재검토` : ''}
        </p>
        {isAudienceFree && (
          <p className="text-xs font-semibold text-sky-600">
            ℹ 오디언스 플러스는 첫 구매 전환 전까지 과금되지 않습니다. 현재 노출이 발생 중이므로 잠재 고객 확보 측면에서 유지를 권장합니다.
          </p>
        )}
        {showAudienceOff && (
          <p className="text-xs font-semibold text-rose-600">
            ⚠ 오디언스 플러스 지면 OFF를 적극 검토하세요 (ROAS {audiencePlacement.ROAS.toLocaleString()}%)
          </p>
        )}
      </div>
    </div>
  )
}

// ─── 이상 징후 카드 ───────────────────────────────────────────────────────────

const ANOMALY_STYLE = {
  expand:  { bg: 'bg-emerald-50', border: 'border-emerald-200', badge: 'bg-emerald-100 text-emerald-700' },
  warning: { bg: 'bg-amber-50',   border: 'border-amber-200',   badge: 'bg-amber-100 text-amber-700' },
  keyword: { bg: 'bg-rose-50',    border: 'border-rose-200',    badge: 'bg-rose-100 text-rose-700' },
  caution: { bg: 'bg-orange-50',  border: 'border-orange-200',  badge: 'bg-orange-100 text-orange-700' },
  info:    { bg: 'bg-blue-50',    border: 'border-blue-200',    badge: 'bg-blue-100 text-blue-700' },
}

function AnomalyCards({ insights }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      {insights.slice(0, 3).map((ins, i) => {
        const s = ANOMALY_STYLE[ins.type] ?? ANOMALY_STYLE.info
        return (
          <div key={i} className={`${s.bg} border ${s.border} rounded-xl p-5 space-y-3`}>
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm font-semibold text-slate-800">{ins.title}</p>
              <span className={`shrink-0 text-xs font-bold px-2 py-0.5 rounded-full ${s.badge}`}>{ins.badge}</span>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">{ins.body}</p>
            <div className="border-t border-slate-200/60 pt-3 space-y-1">
              <p className="text-xs font-semibold text-slate-700">→ {ins.action}</p>
              {ins.tooltip && (
                <p className="text-[11px] text-slate-400 italic leading-relaxed">ℹ {ins.tooltip}</p>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─── AI 플레이북 ──────────────────────────────────────────────────────────────

function PlaybookPanel({ filteredData, campaignLabel, allData }) {
  const kpis      = useMemo(() => aggregateKpis(filteredData), [filteredData])
  const allKpis   = useMemo(() => aggregateKpis(allData ?? filteredData), [allData, filteredData])
  const campaigns = useMemo(() => groupByCampaign(filteredData), [filteredData])
  const [copied, setCopied] = useState(false)

  const top    = campaigns[0]
  const bottom = campaigns[campaigns.length - 1]
  const avgCTR = allKpis.CTR
  const ctrLevel = kpis.CTR < avgCTR * 0.5 ? '낮은' : '양호한'
  const text   = [
    campaignLabel !== '전체' ? `[${campaignLabel}] 캠페인 분석 결과입니다.` : null,
    `이번 기간 총 광고비 ${fmtWon(kpis.광고비)}을 집행하여 ${fmtWon(kpis.매출_14일)}의 전환 매출을 달성했습니다.`,
    `전체 ROAS는 ${fmtPercent(kpis.ROAS, 0)}로, 광고비 1원당 ${(kpis.ROAS / 100).toFixed(2)}원의 매출을 창출했습니다.`,
    top && campaignLabel === '전체'
      ? `최고 성과 캠페인은 '${top.캠페인명}'으로 ROAS ${top.ROAS_14일.toLocaleString()}%를 기록했습니다.` : '',
    bottom && bottom !== top && campaignLabel === '전체'
      ? `'${bottom.캠페인명}' 캠페인은 ROAS ${bottom.ROAS_14일.toLocaleString()}%로 개선이 필요합니다.` : '',
    `CTR ${fmtPercent(kpis.CTR, 2)}로 전체 캠페인 평균(${fmtPercent(avgCTR, 2)}) 대비 ${ctrLevel} 수준입니다. CPC ${fmtWon(kpis.CPC)}, CVR ${fmtPercent(kpis.CVR, 2)} 기록.`,
  ].filter(Boolean).join('\n\n')

  const handleCopy = () => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold text-slate-800">AI 플레이북</h3>
          <p className="text-xs text-slate-400">고객 설명용 자동 멘트 · {campaignLabel}</p>
        </div>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
        >
          {copied ? '복사됨 ✓' : '복사'}
        </button>
      </div>
      <div className="bg-slate-50 rounded-lg p-4 space-y-3">
        {text.split('\n\n').map((para, i) => (
          <p key={i} className="text-sm text-slate-700 leading-relaxed">{para}</p>
        ))}
      </div>
    </div>
  )
}

// ─── InsightsPage ─────────────────────────────────────────────────────────────

const DIMS = [
  { id: 'campaign',  label: '캠페인별' },
  { id: 'product',   label: '상품별' },
  { id: 'keyword',   label: '키워드별' },
  { id: 'placement', label: '지면별' },
]

export default function InsightsPage({ data }) {
  const [dim, setDim]                           = useState('campaign')
  const [selectedCampaign, setSelectedCampaign] = useState('전체')
  const [isPending, startTransition]            = useTransition()
  const [showToast, setShowToast]               = useState(false)
  const toastTimer                              = useRef(null)

  const handleCopy = useCallback((text) => {
    navigator.clipboard.writeText(text).catch(() => {})
    if (toastTimer.current) clearTimeout(toastTimer.current)
    setShowToast(true)
    toastTimer.current = setTimeout(() => setShowToast(false), 1000)
  }, [])

  const campaignNames = useMemo(() => getUnique(data, '캠페인명'), [data])

  const filteredData = useMemo(() =>
    selectedCampaign === '전체'
      ? data
      : data.filter(r => r['캠페인명'] === selectedCampaign),
    [data, selectedCampaign]
  )

  // 캐시 키: data 참조 + selectedCampaign 문자열 — filteredData 객체 참조 대신 사용해
  // 부모 리렌더로 filteredData가 재생성돼도 캐시가 무효화되지 않도록 방지
  const cache = useRef({ dataRef: null, campaignKey: null, results: {} })
  const getCached = (name, fn) => {
    if (cache.current.dataRef !== data || cache.current.campaignKey !== selectedCampaign) {
      cache.current = { dataRef: data, campaignKey: selectedCampaign, results: {} }
    }
    if (!Object.prototype.hasOwnProperty.call(cache.current.results, name)) {
      cache.current.results[name] = fn(filteredData)
    }
    return cache.current.results[name]
  }

  const campaigns = useMemo(() => groupByCampaign(filteredData), [filteredData])
  const insights  = useMemo(() => generateInsights(filteredData), [filteredData])

  const handleDimChange      = (id) => startTransition(() => setDim(id))
  const handleCampaignChange = (c)  => startTransition(() => setSelectedCampaign(c))

  const getDimRows = () => {
    if (dim === 'campaign')  return campaigns
    if (dim === 'keyword')   return getCached('keyword',   groupByKeyword)
    if (dim === 'placement') return getCached('placement', groupByPlacement)
    return []
  }

  const dimRows      = getDimRows()
  const dimNameKey   = { campaign: '캠페인명', product: '상품명', keyword: '키워드' }
  const dimNameLabel = { campaign: '캠페인명', product: '상품명', keyword: '키워드' }
  const isAll        = selectedCampaign === '전체'

  return (
    <div className="px-6 py-6 space-y-6">

      {/* 헤더 + 캠페인 선택 */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900">분석 인사이트</h2>
          <p className="text-sm text-slate-500 mt-0.5">직접(1일) vs 간접(14일) 성과 비교 및 이상 징후 분석</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400 font-medium">캠페인</span>
          <CampaignSelector options={campaignNames} value={selectedCampaign} onChange={handleCampaignChange} />
        </div>
      </div>

      {/* 선택 캠페인 뱃지 */}
      {!isAll && (
        <div className="flex items-center gap-2 w-fit">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 rounded-xl">
            <span className="text-xs font-semibold text-white">{selectedCampaign}</span>
            {isManualCampaign(selectedCampaign) && (
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-violet-200 text-violet-800">수동</span>
            )}
            <button onClick={() => handleCampaignChange('전체')} className="text-blue-200 hover:text-white transition-colors ml-1">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          {isManualCampaign(selectedCampaign) && (
            <span className="text-xs text-violet-600 font-medium">수동 성과형 — 입찰가 조정 가능</span>
          )}
        </div>
      )}

      {/* 차원 탭 */}
      <div className="flex gap-1 p-1 bg-slate-100 rounded-xl w-fit">
        {DIMS.map(d => (
          <button
            key={d.id}
            onClick={() => !d.wip && handleDimChange(d.id)}
            disabled={d.wip}
            title={d.wip ? '현재 개선 작업 중입니다' : undefined}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              d.wip
                ? 'text-slate-300 cursor-not-allowed'
                : dim === d.id
                  ? 'bg-white text-slate-800 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {d.label}
            {d.wip && <span className="ml-1.5 text-[10px] font-bold text-amber-500">개선중</span>}
          </button>
        ))}
      </div>

      {/* 탭 콘텐츠 */}
      {isPending ? (
        <div className="bg-white rounded-xl border border-slate-200"><Spinner /></div>
      ) : (
        <>
          {/* 상품별: 정규화 분석 + 백엔드 API 기반 상세 */}
          {dim === 'product' && (
            <div className="space-y-4">
              <NormalizedProductSection data={filteredData} onCopy={handleCopy} />
              <ProductTab selectedCampaign={selectedCampaign} onCopy={handleCopy} />
            </div>
          )}

          {/* 캠페인별 / 키워드별: 프론트 집계 테이블 */}
          {dim !== 'placement' && dim !== 'product' && (
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-200">
                <h3 className="text-sm font-semibold text-slate-800">직접(1일) vs 간접(14일) 전환 성과</h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  {DIMS.find(d => d.id === dim)?.label} 기준{!isAll && ` · ${selectedCampaign}`}
                </p>
              </div>
              <CompareTable
                rows={dimRows}
                nameKey={dimNameKey[dim]}
                nameLabel={dimNameLabel[dim]}
                showManualBadge={dim === 'campaign'}
                showCpc={dim === 'keyword'}
              />
            </div>
          )}

          {dim === 'keyword' && (
            <KeywordSection keywords={dimRows} isAll={isAll} data={data} />
          )}

          {dim === 'placement' && (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-slate-800">
                지면별 성과{!isAll && <span className="text-slate-400 font-normal ml-2">· {selectedCampaign}</span>}
              </h3>
              <PlacementTab placements={dimRows} campaignLabel={selectedCampaign} />
            </div>
          )}
        </>
      )}

      {/* 이상 징후 카드 */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-slate-800">이상 징후 감지</h3>
          {!isAll && (
            <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">
              {selectedCampaign}
            </span>
          )}
        </div>
        <AnomalyCards insights={insights} />
      </div>

      {/* AI 플레이북 */}
      <PlaybookPanel filteredData={filteredData} campaignLabel={selectedCampaign} allData={data} />

      <CopyToast visible={showToast} />
    </div>
  )
}
