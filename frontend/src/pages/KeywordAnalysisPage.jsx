import { useMemo, useState, useRef } from 'react'
import {
  ResponsiveContainer, ScatterChart, Scatter,
  XAxis, YAxis, ZAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts'
import { groupByKeyword, isBrandKeyword } from '../utils/dataHelpers'
import { fmtWon, fmtNumber, fmtPercent } from '../utils/format'

// ─── 칼럼 리사이즈 헤더 ─────────────────────────────────────────────────────

function ResizableTh({ children, defaultWidth = 120, minWidth = 60, className = '', ...rest }) {
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

// ─── ROAS 칩 ─────────────────────────────────────────────────────────────────

const ROAS_CHIP = (roas) => {
  const c = roas >= 400 ? 'bg-emerald-50 text-emerald-700'
    : roas >= 200 ? 'bg-blue-50 text-blue-700'
    : roas >= 100 ? 'bg-amber-50 text-amber-700'
    : 'bg-red-50 text-red-700'
  return <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${c}`}>{roas.toLocaleString()}%</span>
}

// ─── 고효율 키워드 테이블 ──────────────────────────────────────────────────────

function HighEffTable({ keywords }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden flex flex-col">
      <div className="px-5 py-3.5 border-b border-slate-200 bg-emerald-50 flex items-center gap-2">
        <h3 className="text-sm font-semibold text-emerald-800">고효율 키워드</h3>
        <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
          {keywords.length}개
        </span>
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
              <tr>
                <td colSpan={5} className="px-3 py-10 text-center text-slate-400 text-xs">
                  고효율 키워드 없음
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─── 저효율 키워드 테이블 ──────────────────────────────────────────────────────

function LowEffTable({ keywords }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden flex flex-col">
      <div className="px-5 py-3.5 border-b border-slate-200 bg-rose-50 flex items-center gap-2">
        <h3 className="text-sm font-semibold text-rose-800">저효율 키워드</h3>
        <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-700">
          {keywords.length}개
        </span>
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
              <tr>
                <td colSpan={5} className="px-3 py-10 text-center text-slate-400 text-xs">
                  저효율 키워드 없음
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─── 버블 차트 ────────────────────────────────────────────────────────────────

function BubbleTooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  const d = payload[0]?.payload
  if (!d) return null
  return (
    <div className="bg-white border border-slate-200 rounded-lg p-3 shadow-lg text-xs space-y-1 min-w-[140px]">
      <p className="font-semibold text-slate-800 truncate">{d.키워드}</p>
      <p className="text-slate-500">광고비: <span className="text-slate-800 font-medium">{fmtWon(d.광고비)}</span></p>
      <p className="text-slate-500">ROAS: <span className="text-slate-800 font-medium">{d.ROAS_14일.toLocaleString()}%</span></p>
      <p className="text-slate-500">전환매출: <span className="text-slate-800 font-medium">{fmtWon(d.매출_14일)}</span></p>
    </div>
  )
}

function BubbleChart({ categoryKws, brandKws }) {
  const hasData = categoryKws.length > 0 || brandKws.length > 0
  if (!hasData) return null

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5">
      <h3 className="text-sm font-semibold text-slate-800 mb-1">키워드 버블차트</h3>
      <p className="text-xs text-slate-400 mb-4">X축: 광고비 · Y축: ROAS · 버블크기: 전환매출 · 파란색: 카테고리 · 보라색: 브랜드</p>
      <div style={{ height: 380 }}>
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ top: 16, right: 24, bottom: 32, left: 16 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
            <XAxis
              type="number"
              dataKey="광고비"
              name="광고비"
              tick={{ fontSize: 10, fill: '#94A3B8' }}
              axisLine={false}
              tickLine={false}
              tickFormatter={v => v >= 10000 ? `${Math.round(v / 10000)}만` : `${v}`}
              label={{ value: '광고비', position: 'insideBottom', offset: -16, fill: '#94A3B8', fontSize: 11 }}
            />
            <YAxis
              type="number"
              dataKey="ROAS_14일"
              name="ROAS"
              tick={{ fontSize: 10, fill: '#94A3B8' }}
              axisLine={false}
              tickLine={false}
              tickFormatter={v => `${v}%`}
              label={{ value: 'ROAS', angle: -90, position: 'insideLeft', offset: 12, fill: '#94A3B8', fontSize: 11 }}
            />
            <ZAxis type="number" dataKey="매출_14일" range={[30, 600]} name="전환매출" />
            <Tooltip content={<BubbleTooltip />} cursor={{ strokeDasharray: '3 3' }} />
            <Legend wrapperStyle={{ fontSize: 12, paddingTop: 12 }} />
            {categoryKws.length > 0 && (
              <Scatter name="카테고리 키워드" data={categoryKws} fill="#2563EB" fillOpacity={0.65} />
            )}
            {brandKws.length > 0 && (
              <Scatter name="브랜드 키워드" data={brandKws} fill="#7C3AED" fillOpacity={0.65} />
            )}
          </ScatterChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

// ─── Brand Ads 제안 박스 ──────────────────────────────────────────────────────

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

// ─── KeywordAnalysisPage ──────────────────────────────────────────────────────

export default function KeywordAnalysisPage({ data }) {
  const allKws = useMemo(() => groupByKeyword(data), [data])

  const realKws = useMemo(
    () => allKws.filter(k => k.키워드 !== '비검색' && k.광고비 > 0),
    [allKws]
  )

  const avgSpend = useMemo(
    () => realKws.length ? realKws.reduce((s, k) => s + k.광고비, 0) / realKws.length : 0,
    [realKws]
  )

  const totalSpend = useMemo(
    () => allKws.reduce((s, k) => s + k.광고비, 0),
    [allKws]
  )

  const highEffKws = useMemo(
    () => realKws.filter(k => k.ROAS_14일 > 300 && k.광고비 < avgSpend).sort((a, b) => b.ROAS_14일 - a.ROAS_14일),
    [realKws, avgSpend]
  )

  const lowEffKws = useMemo(
    () => realKws.filter(k => k.광고비 > 0 && k.매출_14일 === 0).sort((a, b) => b.광고비 - a.광고비),
    [realKws]
  )

  const categoryKws = useMemo(
    () => realKws.filter(k => !isBrandKeyword(k.키워드)),
    [realKws]
  )

  const brandKws = useMemo(
    () => realKws.filter(k => isBrandKeyword(k.키워드)),
    [realKws]
  )

  const categoryRevenue = useMemo(
    () => categoryKws.reduce((s, k) => s + k.매출_14일, 0),
    [categoryKws]
  )

  const showBrandAds = categoryRevenue >= 500000 && totalSpend >= 3000000

  if (!allKws.length) {
    return (
      <div className="px-6 py-6">
        <div className="bg-white rounded-xl border border-slate-200 flex items-center justify-center py-24">
          <p className="text-slate-400 text-sm">키워드 데이터가 없습니다.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="px-6 py-6 space-y-6">
      <div>
        <h2 className="text-lg font-bold text-slate-900">키워드 분석</h2>
        <p className="text-sm text-slate-500 mt-0.5">
          키워드별 효율 분석 및 입찰 전략 추천 · 총 {realKws.length.toLocaleString()}개 키워드
        </p>
      </div>

      {showBrandAds && (
        <BrandAdsBox categoryRevenue={categoryRevenue} totalSpend={totalSpend} />
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <HighEffTable keywords={highEffKws} />
        <LowEffTable keywords={lowEffKws} />
      </div>

      <BubbleChart categoryKws={categoryKws} brandKws={brandKws} />
    </div>
  )
}
