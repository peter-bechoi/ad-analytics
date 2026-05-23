// ─── 집계 & 필터 헬퍼 ────────────────────────────────────────────────────────

export const getUnique = (data, field) =>
  [...new Set(data.map(r => r[field]).filter(v => v != null))].sort()

export const isManualCampaign = (name = '') => /수동/.test(name)

export function filterData(data, filters) {
  return data.filter(r => {
    if (filters.campaigns?.length && !filters.campaigns.includes(r['캠페인명'])) return false
    if (filters.products?.length && !filters.products.includes(r['광고집행 상품명'])) return false
    if (filters.placements?.length && !filters.placements.includes(r['광고 노출 지면'])) return false
    if (filters.dateStart && r['날짜'] && r['날짜'] < filters.dateStart) return false
    if (filters.dateEnd && r['날짜'] && r['날짜'] > filters.dateEnd) return false
    return true
  })
}

export function aggregateKpis(rows) {
  let imp = 0, clk = 0, cost = 0, ord1 = 0, ord14 = 0, rev1 = 0, rev14 = 0
  for (const r of rows) {
    imp   += r['노출수'] ?? 0
    clk   += r['클릭수'] ?? 0
    cost  += r['광고비'] ?? 0
    ord1  += r['총 주문수(1일)'] ?? 0
    ord14 += r['총 주문수(14일)'] ?? 0
    rev1  += r['총 전환매출액(1일)'] ?? 0
    rev14 += r['총 전환매출액(14일)'] ?? 0
  }
  return {
    노출수: imp, 클릭수: clk, 광고비: cost,
    주문수_1일: ord1, 주문수_14일: ord14,
    매출_1일: rev1, 매출_14일: rev14,
    CTR:  imp  > 0 ? clk  / imp  * 100 : 0,
    CPC:  clk  > 0 ? cost / clk        : 0,
    ROAS: cost > 0 ? rev14 / cost * 100 : 0,
    CVR:  clk  > 0 ? ord14 / clk  * 100 : 0,
  }
}

export function splitByPeriod(data, days) {
  const dates = [...new Set(data.map(r => r['날짜']).filter(Boolean))].sort()
  if (dates.length < days + 1) return null
  const current  = new Set(dates.slice(-days))
  const previous = new Set(dates.slice(-days * 2, -days))
  if (!previous.size) return null
  return {
    current:  aggregateKpis(data.filter(r => current.has(r['날짜']))),
    previous: aggregateKpis(data.filter(r => previous.has(r['날짜']))),
  }
}

export const pctChange = (curr, prev) =>
  prev == null || prev === 0 ? null : ((curr - prev) / Math.abs(prev)) * 100

// ─── 그룹 집계 ───────────────────────────────────────────────────────────────

export function groupByDate(data) {
  const m = {}
  for (const r of data) {
    const d = r['날짜']; if (!d) continue
    if (!m[d]) m[d] = { 날짜: d, 노출수: 0, 클릭수: 0, 광고비: 0, 매출_14일: 0, 주문수_14일: 0 }
    m[d].노출수    += r['노출수'] ?? 0
    m[d].클릭수    += r['클릭수'] ?? 0
    m[d].광고비    += r['광고비'] ?? 0
    m[d].매출_14일 += r['총 전환매출액(14일)'] ?? 0
    m[d].주문수_14일 += r['총 주문수(14일)'] ?? 0
  }
  return Object.values(m).sort((a, b) => a.날짜.localeCompare(b.날짜))
}

export function groupByCampaign(data) {
  const m = {}
  for (const r of data) {
    const k = r['캠페인명'] ?? '(미지정)'
    if (!m[k]) m[k] = { 캠페인명: k, 광고비: 0, 매출_1일: 0, 매출_14일: 0, 클릭수: 0, 주문수_1일: 0, 주문수_14일: 0, 노출수: 0 }
    m[k].광고비     += r['광고비'] ?? 0
    m[k].매출_1일   += r['총 전환매출액(1일)'] ?? 0
    m[k].매출_14일  += r['총 전환매출액(14일)'] ?? 0
    m[k].클릭수     += r['클릭수'] ?? 0
    m[k].주문수_1일 += r['총 주문수(1일)'] ?? 0
    m[k].주문수_14일 += r['총 주문수(14일)'] ?? 0
    m[k].노출수     += r['노출수'] ?? 0
  }
  return Object.values(m).map(c => ({
    ...c,
    ROAS_1일:  c.광고비 > 0 ? Math.round(c.매출_1일  / c.광고비 * 100) : 0,
    ROAS_14일: c.광고비 > 0 ? Math.round(c.매출_14일 / c.광고비 * 100) : 0,
    CTR: c.노출수 > 0 ? (c.클릭수 / c.노출수 * 100) : 0,
    CPC: c.클릭수 > 0 ? Math.round(c.광고비 / c.클릭수) : 0,
    CVR: c.클릭수 > 0 ? (c.주문수_14일 / c.클릭수 * 100) : 0,
  })).sort((a, b) => b.ROAS_14일 - a.ROAS_14일)
}

export function groupByProduct(data) {
  const m = {}
  for (const r of data) {
    const k = r['광고집행 상품명'] ?? '(미지정)'
    if (!m[k]) m[k] = { 상품명: k, 캠페인명: r['캠페인명'] ?? '', 광고비: 0, 매출_1일: 0, 매출_14일: 0, 주문수_1일: 0, 주문수_14일: 0, 클릭수: 0 }
    m[k].광고비     += r['광고비'] ?? 0
    m[k].매출_1일   += r['총 전환매출액(1일)'] ?? 0
    m[k].매출_14일  += r['총 전환매출액(14일)'] ?? 0
    m[k].주문수_1일 += r['총 주문수(1일)'] ?? 0
    m[k].주문수_14일 += r['총 주문수(14일)'] ?? 0
    m[k].클릭수     += r['클릭수'] ?? 0
  }
  return Object.values(m).map(p => ({
    ...p,
    ROAS_14일: p.광고비 > 0 ? Math.round(p.매출_14일 / p.광고비 * 100) : 0,
    CVR: p.클릭수 > 0 ? (p.주문수_14일 / p.클릭수 * 100) : 0,
    CPC: p.클릭수 > 0 ? Math.round(p.광고비 / p.클릭수) : 0,
  })).sort((a, b) => b.매출_14일 - a.매출_14일)
}

export function groupByKeyword(data) {
  const m = {}
  for (const r of data) {
    const raw = r['키워드']
    const k = (!raw || raw === '-') ? '비검색' : raw
    if (!m[k]) m[k] = { 키워드: k, 캠페인명: r['캠페인명'] ?? '', 광고비: 0, 매출_1일: 0, 매출_14일: 0, 클릭수: 0, 노출수: 0, 주문수_1일: 0, 주문수_14일: 0 }
    m[k].광고비     += r['광고비'] ?? 0
    m[k].매출_1일   += r['총 전환매출액(1일)'] ?? 0
    m[k].매출_14일  += r['총 전환매출액(14일)'] ?? 0
    m[k].클릭수     += r['클릭수'] ?? 0
    m[k].노출수     += r['노출수'] ?? 0
    m[k].주문수_1일 += r['총 주문수(1일)'] ?? 0
    m[k].주문수_14일 += r['총 주문수(14일)'] ?? 0
  }
  return Object.values(m).map(kw => ({
    ...kw,
    ROAS_1일:  kw.광고비 > 0 ? Math.round(kw.매출_1일  / kw.광고비 * 100) : 0,
    ROAS_14일: kw.광고비 > 0 ? Math.round(kw.매출_14일 / kw.광고비 * 100) : 0,
    CTR: kw.노출수 > 0 ? (kw.클릭수 / kw.노출수 * 100) : 0,
    CPC: kw.클릭수 > 0 ? Math.round(kw.광고비 / kw.클릭수) : 0,
  })).sort((a, b) => b.ROAS_14일 - a.ROAS_14일)
}

export function groupByPlacement(data) {
  const m = {}
  for (const r of data) {
    const k = r['광고 노출 지면'] ?? '(미지정)'
    if (!m[k]) m[k] = { 지면: k, 광고비: 0, 매출_14일: 0, 클릭수: 0, 주문수_14일: 0, 노출수: 0 }
    m[k].광고비     += r['광고비'] ?? 0
    m[k].매출_14일  += r['총 전환매출액(14일)'] ?? 0
    m[k].클릭수     += r['클릭수'] ?? 0
    m[k].주문수_14일 += r['총 주문수(14일)'] ?? 0
    m[k].노출수     += r['노출수'] ?? 0
  }
  return Object.values(m).map(p => ({
    ...p,
    ROAS: p.광고비 > 0 ? Math.round(p.매출_14일 / p.광고비 * 100) : 0,
    CTR:  p.노출수 > 0 ? (p.클릭수 / p.노출수 * 100) : 0,
  })).sort((a, b) => b.광고비 - a.광고비)
}

// ─── AI 인사이트 (규칙 기반) ──────────────────────────────────────────────────

export function generateInsights(data) {
  const campaigns  = groupByCampaign(data)
  const keywords   = groupByKeyword(data)
  const totalSpend = campaigns.reduce((s, c) => s + c.광고비, 0)
  const avgRoas    = campaigns.length ? campaigns.reduce((s, c) => s + c.ROAS_14일, 0) / campaigns.length : 0
  const insights   = []

  // ── 예산 확대 추천 ────────────────────────────────────────────────────────
  const highEff = campaigns.filter(c => c.ROAS_14일 > 400 && c.광고비 < totalSpend * 0.25)
  if (highEff.length) {
    const top = highEff[0]
    insights.push({
      type: 'expand', title: '예산 확대 추천', badge: 'ROAS 우수',
      body: `'${top.캠페인명}' 캠페인 ROAS ${top.ROAS_14일.toLocaleString()}%로 고효율이나, 전체 광고비의 ${Math.round(top.광고비 / totalSpend * 100)}%만 집행 중입니다.`,
      action: '일 예산 1.5~2배 증액 검토',
    })
  }

  // ── 효율 저하 경고 ────────────────────────────────────────────────────────
  const lowEff = campaigns.filter(c => c.ROAS_14일 < Math.min(150, avgRoas * 0.5) && c.광고비 > totalSpend * 0.05)
  if (lowEff.length) {
    const worst = [...lowEff].sort((a, b) => a.ROAS_14일 - b.ROAS_14일)[0]
    insights.push({
      type: 'warning', title: '효율 저하 감지', badge: '개선 필요',
      body: `'${worst.캠페인명}' ROAS ${worst.ROAS_14일}% — 전체 평균(${Math.round(avgRoas)}%) 대비 ${Math.round((avgRoas - worst.ROAS_14일) / avgRoas * 100)}% 낮습니다. 광고비 비중 ${Math.round(worst.광고비 / totalSpend * 100)}%.`,
      action: isManualCampaign(worst.캠페인명)
        ? '비효율 키워드 일시 중지 또는 입찰가 하향 검토'
        : '목표수익률 상향 조정 또는 비효율 상품 제외 검토',
    })
  }

  // ── 비검색 효율 저하 ──────────────────────────────────────────────────────
  const nsKw = keywords.find(k => k.키워드 === '비검색')
  if (nsKw && nsKw.ROAS_14일 < 150 && nsKw.광고비 > 0) {
    insights.push({
      type: 'warning', title: '비검색 효율 저하', badge: '비검색',
      body: `비검색(논서치) 지면 ROAS ${nsKw.ROAS_14일.toLocaleString()}%로 기준치 이하입니다. 광고비 ${Math.round(nsKw.광고비).toLocaleString()}원 집행 중.`,
      action: isManualCampaign(nsKw.캠페인명)
        ? '비검색 지면 입찰가를 키워드 입찰가보다 낮게 조정 권장'
        : '캠페인 내 상품 경쟁력 점검 권장 (가격·이미지·리뷰 개선)',
    })
  }

  // ── 비효율 키워드 (광고비 비중 ≥ 5% + ROAS < 100%) ─────────────────────
  const totalKwSpend = keywords.reduce((s, k) => s + k.광고비, 0)
  const badKws = totalKwSpend > 0
    ? keywords.filter(k => (k.광고비 / totalKwSpend) >= 0.05 && k.ROAS_14일 < 100)
    : []
  if (badKws.length) {
    const top = badKws[0]
    const share = Math.round(top.광고비 / totalKwSpend * 100)
    const manual = isManualCampaign(top.캠페인명)
    insights.push({
      type: 'keyword', title: '비효율 키워드 발견', badge: `${badKws.length}개 비효율`,
      body: `'${top.키워드}' 키워드 광고비 비중 ${share}%(${Math.round(top.광고비).toLocaleString()}원), ROAS ${top.ROAS_14일}%로 손실 구간입니다.${badKws.length > 1 ? ` 외 ${badKws.length - 1}개 동일 기준.` : ''}`,
      action: manual
        ? '해당 키워드 일시 중지 또는 입찰가 하향 검토'
        : '제외 키워드 설정 권장',
      tooltip: manual ? null : '쿠팡 PA 광고는 입찰가 조정 불가. 제외 키워드 설정으로 노출 차단 가능',
    })
  }

  // ── 주의 키워드 (광고비 비중 ≥ 5% + ROAS 100~200%) ─────────────────────
  const warnKws = totalKwSpend > 0
    ? keywords.filter(k => (k.광고비 / totalKwSpend) >= 0.05 && k.ROAS_14일 >= 100 && k.ROAS_14일 < 200)
    : []
  if (warnKws.length) {
    const top = warnKws[0]
    const share = Math.round(top.광고비 / totalKwSpend * 100)
    const manual = isManualCampaign(top.캠페인명)
    insights.push({
      type: 'caution', title: '키워드 효율 주의', badge: `${warnKws.length}개 주의`,
      body: `'${top.키워드}' 광고비 비중 ${share}%, ROAS ${top.ROAS_14일}%로 기준치(200%) 미달.${warnKws.length > 1 ? ` 외 ${warnKws.length - 1}개 동일 기준.` : ''}`,
      action: manual
        ? '입찰가 최적화 또는 일시 중지 검토'
        : '제외 키워드 설정 또는 목표수익률 상향 검토',
    })
  }

  // ── 고효율 키워드 (수동 캠페인 전용) ─────────────────────────────────────
  const manualHighKws = totalKwSpend > 0
    ? keywords.filter(k =>
        isManualCampaign(k.캠페인명) &&
        (k.광고비 / totalKwSpend) >= 0.03 &&
        k.ROAS_14일 > 400
      )
    : []
  if (manualHighKws.length) {
    const top = manualHighKws[0]
    insights.push({
      type: 'expand', title: '고효율 키워드 발견', badge: '입찰 확대 [수동]',
      body: `[수동] '${top.키워드}' 키워드 ROAS ${top.ROAS_14일.toLocaleString()}%로 고효율 구간. 광고비 비중 ${Math.round(top.광고비 / totalKwSpend * 100)}%.`,
      action: '입찰가 상향으로 노출 점유율 확대 검토',
    })
  }

  // ── 스마트 캠페인 예산 증액 ──────────────────────────────────────────────────
  const smartHighRoas = campaigns.filter(c => c.캠페인명.includes('스마트') && c.ROAS_14일 > 300)
  if (smartHighRoas.length) {
    const top = [...smartHighRoas].sort((a, b) => b.ROAS_14일 - a.ROAS_14일)[0]
    insights.push({
      type: 'expand', title: '스마트캠페인 예산 증액 추천', badge: '스마트 고효율',
      body: `'${top.캠페인명}' 스마트 캠페인 ROAS ${top.ROAS_14일.toLocaleString()}%로 고효율 구간입니다. 광고비 ${Math.round(top.광고비).toLocaleString()}원 집행 중.`,
      action: '일 예산 1.5배 이상 증액으로 노출 확대 검토',
    })
  }

  // ── 비검색 ROAS > 검색 평균 ROAS → 비검색 입찰가 상향 ────────────────────
  const searchKws = keywords.filter(k => k.키워드 !== '비검색' && k.광고비 > 0)
  const avgSearchRoas = searchKws.length
    ? Math.round(searchKws.reduce((s, k) => s + k.ROAS_14일, 0) / searchKws.length)
    : 0
  const nsKwCompare = keywords.find(k => k.키워드 === '비검색')
  if (nsKwCompare && nsKwCompare.ROAS_14일 > 0 && avgSearchRoas > 0 && nsKwCompare.ROAS_14일 > avgSearchRoas) {
    insights.push({
      type: 'expand', title: '비검색 입찰가 상향 검토', badge: '비검색 우수',
      body: `비검색 ROAS ${nsKwCompare.ROAS_14일.toLocaleString()}%가 검색 키워드 평균 ROAS ${avgSearchRoas.toLocaleString()}%보다 ${(nsKwCompare.ROAS_14일 - avgSearchRoas).toLocaleString()}%p 높습니다.`,
      action: '비검색 지면 입찰가 상향으로 논서치 노출 점유율 확대 검토',
    })
  }

  // ── 예산 소진율 낮음 → 메인 키워드 입찰가 상향 ──────────────────────────
  const lowCtrHighRoasKws = totalKwSpend > 0
    ? keywords.filter(k =>
        k.키워드 !== '비검색' &&
        isManualCampaign(k.캠페인명) &&
        k.ROAS_14일 > 200 &&
        k.CTR < 0.8 &&
        k.광고비 > 0
      )
    : []
  if (lowCtrHighRoasKws.length) {
    const top = [...lowCtrHighRoasKws].sort((a, b) => b.ROAS_14일 - a.ROAS_14일)[0]
    insights.push({
      type: 'expand', title: '메인 키워드 입찰가 상향 검토', badge: '예산 여력',
      body: `[수동] '${top.키워드}' ROAS ${top.ROAS_14일.toLocaleString()}%로 효율 양호하나, CTR ${top.CTR.toFixed(2)}%로 노출이 부족합니다. 예산 소진 여력이 있습니다.`,
      action: '입찰가 10~20% 상향으로 노출 점유율 및 클릭 수 확대 검토',
    })
  }

  if (!insights.length) {
    insights.push({
      type: 'info', title: '전반적 성과 양호', badge: '정상',
      body: `${campaigns.length}개 캠페인 분석 완료. 평균 ROAS ${Math.round(avgRoas).toLocaleString()}%. 이상 징후 없이 안정적인 성과를 기록하고 있습니다.`,
      action: '현재 전략 유지 및 상위 캠페인 예산 점진적 확대 검토',
    })
  }
  return insights
}

// ─── 브랜드 키워드 판별 (레거시, 하위 호환 유지) ─────────────────────────────

const BRAND_KW_LIST = ['메이제이', 'mayjay', 'may jay', '덴티프레쉬', '덴티파워']

export const isBrandKeyword = (kw = '') => {
  const lower = kw.toLowerCase()
  return BRAND_KW_LIST.some(b => lower.includes(b.toLowerCase()))
}

// ─── 상품명 기반 키워드 자동 분류 ────────────────────────────────────────────

const UNIT_TOKENS = new Set([
  '개', '정', 'mg', 'g', 'ml', 'l', '회분', '포', '세트', '팩',
  '박스', '캡슐', '알', '봉', '매', '장', '입', '병', '통', '회', '개입',
])

export function extractProductTokens(data) {
  const tokens = new Set()
  for (const r of data) {
    const name = r['광고집행 상품명'] ?? ''
    for (let word of name.split(/[\s,/\\()\[\]\-_|]+/)) {
      word = word.trim()
      if (word.length < 2) continue
      if (/^\d+$/.test(word)) continue
      if (/^\d+[가-힣a-zA-Z]+$/.test(word)) continue
      if (UNIT_TOKENS.has(word.toLowerCase())) continue
      tokens.add(word.toLowerCase())
    }
  }
  return tokens
}

export function classifyKeyword(keyword, productTokens, brandNames = []) {
  if (!keyword || keyword === '비검색') return 'other'
  const lower = keyword.toLowerCase()
  if (brandNames.length > 0) {
    return brandNames.some(b => b && lower.includes(b.toLowerCase().trim())) ? 'brand' : 'category'
  }
  for (const token of productTokens) {
    if (lower.includes(token)) return 'brand'
  }
  return 'category'
}

// ─── 상품명 정규화 ───────────────────────────────────────────────────────────

export function normalizeProductName(raw = '') {
  if (!raw) return '(미지정)'
  const parts = raw.split(',').map(p => p.trim()).filter(Boolean)
  const seen = new Set(); const unique = []
  for (const p of parts) { if (!seen.has(p)) { seen.add(p); unique.push(p) } }
  const filtered = unique.filter(p => !/^\d+개$/.test(p))
  return (filtered.length ? filtered : unique).join(' ').trim() || raw
}

export function extractBundleCount(raw = '') {
  for (const p of raw.split(',').map(s => s.trim())) {
    const m = p.match(/^(\d+)개$/)
    if (m) return parseInt(m[1], 10)
  }
  return 1
}

export function groupByNormalizedProduct(data) {
  const m = {}
  for (const r of data) {
    const raw = r['광고집행 상품명'] ?? '(미지정)'
    const norm = normalizeProductName(raw)
    const bundle = extractBundleCount(raw)
    const optId = r['광고집행 옵션ID'] ? String(r['광고집행 옵션ID']).trim() : null
    if (!m[norm]) m[norm] = {
      상품명: norm, 광고비: 0, 매출_1일: 0, 매출_14일: 0,
      주문수_1일: 0, 주문수_14일: 0, 클릭수: 0, bundles: {},
    }
    const g = m[norm]
    g.광고비      += r['광고비'] ?? 0
    g.매출_1일    += r['총 전환매출액(1일)'] ?? 0
    g.매출_14일   += r['총 전환매출액(14일)'] ?? 0
    g.주문수_1일  += r['총 주문수(1일)'] ?? 0
    g.주문수_14일 += r['총 주문수(14일)'] ?? 0
    g.클릭수      += r['클릭수'] ?? 0
    if (!g.bundles[bundle]) g.bundles[bundle] = { 광고비: 0, 매출_14일: 0, optionIds: new Set() }
    g.bundles[bundle].광고비    += r['광고비'] ?? 0
    g.bundles[bundle].매출_14일 += r['총 전환매출액(14일)'] ?? 0
    if (optId && optId !== 'nan') g.bundles[bundle].optionIds.add(optId)
  }
  return Object.values(m).map(p => {
    const bundleCount = Object.keys(p.bundles).length
    const bundleRoas = {}
    const bundleDetails = {}
    for (const [cnt, b] of Object.entries(p.bundles)) {
      const label = `${cnt}개`
      const roas = b.광고비 > 0 ? Math.round(b.매출_14일 / b.광고비 * 100) : 0
      bundleRoas[label] = roas
      bundleDetails[label] = {
        ROAS: roas,
        광고비: b.광고비,
        매출_14일: b.매출_14일,
        optionIds: [...b.optionIds],
      }
    }
    const { bundles: _b, ...rest } = p
    return {
      ...rest,
      ROAS_14일: p.광고비 > 0 ? Math.round(p.매출_14일 / p.광고비 * 100) : 0,
      CPC: p.클릭수 > 0 ? Math.round(p.광고비 / p.클릭수) : 0,
      CVR: p.클릭수 > 0 ? (p.주문수_14일 / p.클릭수 * 100) : 0,
      bundleRoas,
      bundleDetails,
      bundleCount,
      hasZeroRevenue: p.매출_14일 === 0 && p.광고비 >= 10000,
    }
  }).sort((a, b) => b.매출_14일 - a.매출_14일)
}
