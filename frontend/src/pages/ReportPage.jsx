import { useState, useMemo } from 'react'
import { aggregateKpis, groupByCampaign } from '../utils/dataHelpers'
import { fmtNumber, fmtWon, fmtPercent } from '../utils/format'

// ─── 리포트 텍스트 생성 ───────────────────────────────────────────────────────

function buildReport({ clientName, period, reportType, tone, kpis, campaigns }) {
  const top    = campaigns[0]
  const bottom = campaigns[campaigns.length - 1]
  const roas   = kpis.ROAS.toFixed(0)
  const spend  = fmtWon(kpis.광고비)
  const rev    = fmtWon(kpis.매출_14일)

  const INTRO = {
    'ROAS중심':    `${clientName}의 ${period} 광고 성과를 분석한 결과, 총 광고비 ${spend} 집행 대비 ROAS ${roas}%를 달성했습니다. 이는 광고비 1원당 ${(kpis.ROAS / 100).toFixed(2)}원의 매출을 창출한 결과입니다.`,
    '매출성장':    `${clientName}의 ${period} 광고 운영을 통해 총 ${rev}의 전환 매출을 달성했습니다. 집행 광고비 ${spend} 대비 효율적인 성과를 기록하였습니다.`,
    '예산증액':    `${clientName}의 ${period} 광고 성과 분석 결과, 현재 예산 대비 높은 성과 여력이 확인되었습니다. ROAS ${roas}%의 안정적 효율 하에 추가 예산 투입 시 매출 확대가 기대됩니다.`,
    '캠페인최적화': `${clientName}의 ${period} 캠페인별 성과를 심층 분석했습니다. 총 ${campaigns.length}개 캠페인 운영 중 효율 편차가 확인되어, 집중 관리 전략이 필요합니다.`,
  }[reportType]

  const TONE_BODY = {
    '효율성+성장성': [
      `▌ 핵심 KPI`,
      `• 총 노출수: ${fmtNumber(kpis.노출수)}회 / 클릭수: ${fmtNumber(kpis.클릭수)}회 / CTR: ${fmtPercent(kpis.CTR, 2)}`,
      `• 총 주문수(14일): ${fmtNumber(kpis.주문수_14일)}건 / CVR: ${fmtPercent(kpis.CVR, 2)}`,
      `• CPC: ${fmtWon(kpis.CPC)} / ROAS: ${roas}%`,
      ``,
      `▌ 캠페인 성과`,
      top    ? `• 최고 효율: '${top.캠페인명}' — ROAS ${top.ROAS_14일.toLocaleString()}% · 전환매출 ${fmtWon(top.매출_14일)}` : '',
      bottom && bottom !== top ? `• 개선 대상: '${bottom.캠페인명}' — ROAS ${bottom.ROAS_14일.toLocaleString()}% · 광고비 ${fmtWon(bottom.광고비)}` : '',
    ].filter(Boolean).join('\n'),

    '놓친기회': [
      `▌ 놓친 기회 분석`,
      top ? `• '${top.캠페인명}' 캠페인은 ROAS ${top.ROAS_14일.toLocaleString()}%의 높은 효율을 보임에도 예산이 부족하여 잠재 매출을 실현하지 못했습니다.` : '',
      `• 현재 CTR ${fmtPercent(kpis.CTR, 2)} 수준에서 노출수를 20% 확대 시 추가 클릭 ${fmtNumber(Math.round(kpis.노출수 * 0.2 * kpis.CTR / 100))}회, 예상 추가 매출 ${fmtWon(Math.round(kpis.노출수 * 0.2 * kpis.CTR / 100 * kpis.CPC * (kpis.ROAS / 100)))} 창출 가능.`,
      `• CVR ${fmtPercent(kpis.CVR, 2)} 기준, 랜딩 페이지 개선만으로도 전환 수익 10~15% 향상이 가능합니다.`,
    ].filter(Boolean).join('\n'),

    '공격적 확대': [
      `▌ 확대 전략 권고`,
      `• ROAS ${roas}% 달성 중 — 현재 예산 대비 2배 증액 시 예상 매출 ${fmtWon(kpis.매출_14일 * 1.8)} 달성 가능(ROAS 유지 가정).`,
      top ? `• '${top.캠페인명}' 우선 증액: 현재 대비 +50% 예산 배분 즉시 권장.` : '',
      `• 고효율 지면·키워드 집중 노출로 시장점유율 선점 가능 시점.`,
      `• 경쟁사 대비 CPC ${fmtWon(kpis.CPC)} 수준은 입찰 여력이 충분함을 시사합니다.`,
    ].filter(Boolean).join('\n'),
  }[tone]

  const ACTIONS = {
    'ROAS중심':    ['상위 ROAS 캠페인 예산 점진적 확대', '하위 ROAS 캠페인 키워드 최적화 진행', 'CPC 상위 키워드 입찰가 재검토'],
    '매출성장':    ['전환율 높은 상품·키워드 집중 투자', '유사 타겟 오디언스 확장 테스트', '소재 다변화로 CTR 개선'],
    '예산증액':    ['월 예산 20~30% 단계적 증액 협의', '고효율 캠페인 우선 증액', '예산 증액 후 2주 이내 성과 모니터링'],
    '캠페인최적화': ['하위 캠페인 pause 후 예산 재배분', '상위 5개 키워드 집중 관리', '광고 소재 A/B 테스트 진행'],
  }[reportType]

  return {
    title: `[${clientName}] 광고 성과 리포트 (${period})`,
    intro: INTRO,
    body: TONE_BODY,
    actions: ACTIONS,
  }
}

// ─── ReportPage ───────────────────────────────────────────────────────────────

const REPORT_TYPES = ['ROAS중심', '매출성장', '예산증액', '캠페인최적화']
const TONES        = ['효율성+성장성', '놓친기회', '공격적 확대']

export default function ReportPage({ data, dateRange, filename }) {
  const [clientName, setClientName] = useState('')
  const [reportType, setReportType] = useState('ROAS중심')
  const [tone, setTone]             = useState('효율성+성장성')
  const [generated, setGenerated]   = useState(null)
  const [copied, setCopied]         = useState(false)

  const kpis      = useMemo(() => aggregateKpis(data), [data])
  const campaigns = useMemo(() => groupByCampaign(data), [data])

  const period = dateRange
    ? `${dateRange.start} ~ ${dateRange.end}`
    : filename ?? '전체 기간'

  const handleGenerate = () => {
    const report = buildReport({
      clientName: clientName || '광고주',
      period, reportType, tone, kpis, campaigns,
    })
    setGenerated(report)
  }

  const fullText = generated
    ? [generated.title, '', generated.intro, '', generated.body, '', '▌ 권장 액션', ...generated.actions.map((a, i) => `${i + 1}. ${a}`)].join('\n')
    : ''

  const handleCopy = () => {
    navigator.clipboard.writeText(fullText)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handlePdf = () => {
    const win = window.open('', '_blank')
    win.document.write(`
      <html><head><title>${generated?.title ?? '리포트'}</title>
      <style>body{font-family:sans-serif;padding:40px;max-width:800px;margin:0 auto;line-height:1.8;color:#1e293b}
      h1{font-size:20px;border-bottom:2px solid #2563EB;padding-bottom:10px}
      pre{white-space:pre-wrap;font-family:inherit;font-size:14px}
      .action{background:#eff6ff;padding:12px 16px;border-radius:8px;margin:4px 0}
      @media print{body{padding:20px}}</style></head>
      <body>
        <h1>${generated?.title ?? ''}</h1>
        <pre>${generated?.intro ?? ''}\n\n${generated?.body ?? ''}</pre>
        <h2 style="font-size:15px;margin-top:24px">권장 액션</h2>
        ${(generated?.actions ?? []).map((a, i) => `<div class="action">${i + 1}. ${a}</div>`).join('')}
      </body></html>
    `)
    win.document.close()
    setTimeout(() => win.print(), 400)
  }

  return (
    <div className="px-6 py-6">
      <div className="mb-6">
        <h2 className="text-lg font-bold text-slate-900">리포트 생성</h2>
        <p className="text-sm text-slate-500 mt-0.5">분석 데이터를 기반으로 고객사 제출용 리포트를 자동 생성합니다.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* ─ 설정 패널 ─ */}
        <div className="space-y-5">
          <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-5">
            <h3 className="text-sm font-semibold text-slate-800">기본 정보</h3>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">고객사명</label>
              <input
                value={clientName}
                onChange={e => setClientName(e.target.value)}
                placeholder="예: (주)나이키코리아"
                className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">분석 기간</label>
              <div className="px-3 py-2.5 bg-slate-50 text-sm text-slate-700 rounded-lg border border-slate-200">{period}</div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
            <h3 className="text-sm font-semibold text-slate-800">리포트 유형</h3>
            <div className="grid grid-cols-2 gap-2">
              {REPORT_TYPES.map(t => (
                <button
                  key={t}
                  onClick={() => setReportType(t)}
                  className={`px-3 py-2.5 text-sm rounded-lg border transition-colors text-left ${
                    reportType === t
                      ? 'border-blue-600 bg-blue-50 text-blue-700 font-semibold'
                      : 'border-slate-200 text-slate-600 hover:border-slate-300'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
            <h3 className="text-sm font-semibold text-slate-800">강조 어조</h3>
            <div className="space-y-2">
              {TONES.map(t => (
                <label key={t} className="flex items-center gap-3 p-3 rounded-lg border border-slate-200 cursor-pointer hover:bg-slate-50 transition-colors">
                  <input type="radio" name="tone" value={t} checked={tone === t} onChange={() => setTone(t)} className="accent-blue-600" />
                  <span className="text-sm text-slate-700">{t}</span>
                </label>
              ))}
            </div>
          </div>

          <button
            onClick={handleGenerate}
            className="w-full py-3 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-semibold rounded-xl transition-colors text-sm"
          >
            리포트 생성
          </button>
        </div>

        {/* ─ 미리보기 패널 ─ */}
        <div className="space-y-4">
          {!generated ? (
            <div className="bg-white rounded-xl border border-slate-200 flex items-center justify-center h-64 text-slate-400 text-sm">
              왼쪽에서 설정 후 생성 버튼을 누르세요
            </div>
          ) : (
            <>
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200">
                  <div>
                    <p className="text-sm font-semibold text-slate-800">{generated.title}</p>
                    <p className="text-xs text-slate-400 mt-0.5">{reportType} · {tone}</p>
                  </div>
                  <button
                    onClick={handleCopy}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
                  >
                    {copied ? '복사됨 ✓' : '텍스트 복사'}
                  </button>
                </div>
                <div className="p-5 space-y-4">
                  <p className="text-sm text-slate-700 leading-relaxed">{generated.intro}</p>
                  <pre className="text-xs text-slate-600 leading-relaxed whitespace-pre-wrap font-sans bg-slate-50 rounded-lg p-4">{generated.body}</pre>
                </div>
              </div>

              {/* 권장 액션 */}
              <div className="bg-white rounded-xl border border-slate-200 p-5">
                <h3 className="text-sm font-semibold text-slate-800 mb-3">권장 액션 리스트</h3>
                <div className="space-y-2">
                  {generated.actions.map((action, i) => (
                    <div key={i} className="flex items-start gap-3 p-3 bg-blue-50 rounded-lg">
                      <span className="shrink-0 w-5 h-5 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center">{i + 1}</span>
                      <p className="text-sm text-slate-700">{action}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* 다운로드 */}
              <div className="flex gap-3">
                <button
                  onClick={handlePdf}
                  className="flex-1 flex items-center justify-center gap-2 py-3 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-xl transition-colors text-sm"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  PDF 다운로드
                </button>
                <button
                  onClick={() => alert('PPT 다운로드 기능은 준비 중입니다.')}
                  className="flex-1 flex items-center justify-center gap-2 py-3 bg-slate-700 hover:bg-slate-800 text-white font-semibold rounded-xl transition-colors text-sm"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.375 19.5h17.25m-17.25 0a1.125 1.125 0 01-1.125-1.125M3.375 19.5h1.5C5.496 19.5 6 18.996 6 18.375m-3.75 0V5.625m0 12.75v-1.5c0-.621.504-1.125 1.125-1.125m18.375 2.625V5.625m0 12.75c0 .621-.504 1.125-1.125 1.125m1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125m0 3.75h-1.5A1.125 1.125 0 0118 18.375M20.625 4.5H3.375m17.25 0c.621 0 1.125.504 1.125 1.125M20.625 4.5h-1.5C18.504 4.5 18 5.004 18 5.625m3.75 0v1.5c0 .621-.504 1.125-1.125 1.125M3.375 4.5c-.621 0-1.125.504-1.125 1.125M3.375 4.5h1.5C5.496 4.5 6 5.004 6 5.625m-3.75 0v1.5c0 .621.504 1.125 1.125 1.125m0 0h1.5m-1.5 0c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125m1.5-3.75C6 8.496 6.504 9 7.125 9m-1.5 0c0 .621.504 1.125 1.125 1.125h1.5" />
                  </svg>
                  PPT 다운로드
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
