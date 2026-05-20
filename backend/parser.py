"""
광고 성과 파일 파서.
xlsx / csv 파일을 읽어 정규화된 컬럼으로 매핑하고 KPI 요약을 계산한다.
"""

import io
import re
import pandas as pd
from difflib import SequenceMatcher
from typing import Optional

# 정규 컬럼명 → 인식할 별칭 목록 (한국어·영문·변형 포함)
CANONICAL_COLUMNS: dict[str, list[str]] = {
    "날짜":               ["날짜", "date", "일자", "기간", "일", "날 짜"],
    "캠페인명":           ["캠페인명", "캠페인", "campaign", "campaign_name", "캠페인 명"],
    "광고그룹":           ["광고그룹", "광고그룹명", "adgroup", "ad_group", "광고 그룹"],
    "광고집행 상품명":    ["광고집행 상품명", "광고 집행 상품명", "상품명", "광고상품명", "집행상품", "product"],
    "키워드":             ["키워드", "keyword", "검색어", "검색 키워드", "kw"],
    "노출수":             ["노출수", "노출", "impression", "impressions", "imp"],
    "클릭수":             ["클릭수", "클릭", "click", "clicks"],
    "광고비":             ["광고비", "비용", "cost", "광고비용", "지출", "소진금액", "광고 비용"],
    "총 주문수(1일)":     ["총 주문수(1일)", "주문수(1일)", "전환수(1일)", "1일주문수", "주문(1일)", "orders_1d"],
    "총 주문수(14일)":    ["총 주문수(14일)", "주문수(14일)", "전환수(14일)", "14일주문수", "주문(14일)", "orders_14d"],
    "총 전환매출액(1일)": ["총 전환매출액(1일)", "전환매출(1일)", "매출(1일)", "1일매출", "매출액(1일)", "revenue_1d"],
    "총 전환매출액(14일)":["총 전환매출액(14일)", "전환매출(14일)", "매출(14일)", "14일매출", "매출액(14일)", "revenue_14d"],
    "총광고수익률(1일)":  ["총광고수익률(1일)", "총 광고수익률(1일)", "광고수익률(1일)", "roas(1일)", "1일roas", "roas_1d"],
    "총광고수익률(14일)": ["총광고수익률(14일)", "총 광고수익률(14일)", "광고수익률(14일)", "roas(14일)", "14일roas", "roas_14d"],
    "광고 노출 지면":     ["광고 노출 지면", "노출지면", "지면", "placement", "광고지면", "노출 지면"],
}

NUMERIC_COLS = {
    "노출수", "클릭수", "광고비",
    "총 주문수(1일)", "총 주문수(14일)",
    "총 전환매출액(1일)", "총 전환매출액(14일)",
    "총광고수익률(1일)", "총광고수익률(14일)",
}


# ─── 내부 헬퍼 ────────────────────────────────────────────────────────────────

def _normalize(text: str) -> str:
    """공백·괄호·특수문자 제거 + 소문자 변환 (유사 비교용)."""
    return re.sub(r"[\s()\-_·•]", "", str(text)).lower()


def _similarity(a: str, b: str) -> float:
    return SequenceMatcher(None, a, b).ratio()


def _find_canonical(raw_col: str) -> Optional[str]:
    """
    원본 컬럼명을 정규 컬럼명으로 매핑한다.
    1단계: 정규화 후 완전 일치
    2단계: SequenceMatcher 유사도 ≥ 0.75
    """
    norm = _normalize(raw_col)

    # 1단계 – 정규화 완전 일치
    for canonical, aliases in CANONICAL_COLUMNS.items():
        if any(norm == _normalize(a) for a in aliases):
            return canonical

    # 2단계 – 접두어 일치 (예: '광고비(VAT포함)' → startswith '광고비')
    # 접두어가 짧을수록 오탐 위험이 높으므로 최소 3글자 이상만 허용
    for canonical, aliases in CANONICAL_COLUMNS.items():
        for alias in aliases:
            norm_alias = _normalize(alias)
            if len(norm_alias) >= 3 and norm.startswith(norm_alias):
                return canonical

    # 3단계 – 유사도 매핑
    best_score, best_canonical = 0.0, None
    for canonical, aliases in CANONICAL_COLUMNS.items():
        for alias in aliases:
            score = _similarity(norm, _normalize(alias))
            if score > best_score:
                best_score, best_canonical = score, canonical

    return best_canonical if best_score >= 0.75 else None


def _clean_numeric(series: pd.Series) -> pd.Series:
    """쉼표·통화기호·%·공백을 제거하고 float으로 변환한다."""
    if series.dtype == object:
        series = (
            series.astype(str)
            .str.replace(",", "", regex=False)
            .str.replace("%", "", regex=False)
            .str.replace("₩", "", regex=False)
            .str.replace("원", "", regex=False)
            .str.strip()
            .replace("-", "0")   # 단독 대시는 0으로
        )
    return pd.to_numeric(series, errors="coerce").fillna(0)


def _detect_header_row(df_raw: pd.DataFrame) -> int:
    """실제 헤더가 위치한 행 인덱스를 반환한다 (메타행 건너뜀)."""
    all_aliases: set[str] = set()
    for aliases in CANONICAL_COLUMNS.values():
        all_aliases.update(_normalize(a) for a in aliases)

    for i in range(min(15, len(df_raw))):
        row = df_raw.iloc[i]
        hits = sum(1 for cell in row if _normalize(str(cell)) in all_aliases)
        if hits >= 2:
            return i
    return 0


# ─── 공개 API ─────────────────────────────────────────────────────────────────

def map_columns(df: pd.DataFrame) -> tuple[pd.DataFrame, dict[str, str], list[str]]:
    """
    DataFrame 컬럼을 정규 컬럼명으로 매핑한다.
    반환: (매핑된_df, {원본→정규} 매핑표, 미매핑 컬럼 목록)
    """
    col_map: dict[str, str] = {}
    unmapped: list[str] = []

    for col in df.columns:
        canonical = _find_canonical(str(col))
        if canonical and canonical not in col_map.values():
            col_map[str(col)] = canonical
        else:
            unmapped.append(str(col))

    df = df.rename(columns=col_map)

    # 정규 컬럼만 유지
    present = [c for c in CANONICAL_COLUMNS if c in df.columns]
    df = df[present].copy()

    # 수치형 정리
    for col in present:
        if col in NUMERIC_COLS:
            df[col] = _clean_numeric(df[col])

    return df, col_map, unmapped


def parse_file(file_bytes: bytes, filename: str) -> dict:
    """
    xlsx 또는 csv 바이트를 받아 파싱 결과 dict를 반환한다.
    반환 키: filename, row_count, date_range, column_map,
              unmapped_columns, columns, data
    """
    ext = filename.rsplit(".", 1)[-1].lower()

    if ext == "csv":
        for enc in ("utf-8-sig", "euc-kr", "cp949"):
            try:
                df_raw = pd.read_csv(io.BytesIO(file_bytes), encoding=enc, header=None, dtype=str)
                break
            except (UnicodeDecodeError, Exception):
                continue
        else:
            raise ValueError("CSV 인코딩을 인식할 수 없습니다 (utf-8, euc-kr, cp949 시도 실패).")
    elif ext in ("xlsx", "xls"):
        df_raw = pd.read_excel(io.BytesIO(file_bytes), header=None, dtype=str)
    else:
        raise ValueError(f"지원하지 않는 파일 형식: .{ext}  (xlsx, xls, csv만 허용)")

    # 실제 헤더 행 감지
    header_idx = _detect_header_row(df_raw)
    df_raw.columns = df_raw.iloc[header_idx].astype(str)
    df = df_raw.iloc[header_idx + 1:].reset_index(drop=True)
    df = df.dropna(how="all")

    df, col_map, unmapped = map_columns(df)

    # 날짜 정규화
    if "날짜" in df.columns:
        df["날짜"] = pd.to_datetime(df["날짜"], errors="coerce").dt.strftime("%Y-%m-%d")

    # NaN → None (JSON 직렬화 가능하게)
    records = df.where(pd.notna(df), None).to_dict(orient="records")

    date_range = None
    if "날짜" in df.columns:
        dates = df["날짜"].dropna()
        if not dates.empty:
            date_range = {"start": str(dates.min()), "end": str(dates.max())}

    return {
        "filename": filename,
        "row_count": len(records),
        "date_range": date_range,
        "column_map": col_map,
        "unmapped_columns": unmapped,
        "columns": list(df.columns),
        "data": records,
    }


def group_by_product(
    records: list,
    campaign: str = "전체",
    page: int = 1,
    limit: int = 20,
    sort_col: str = "매출_14일",
    sort_dir: str = "desc",
) -> dict:
    """
    광고집행 상품명 기준으로 집계하고 페이지네이션된 결과를 반환한다.
    campaign='전체'이면 전체 데이터를 집계한다.
    """
    if not records:
        return {"items": [], "total": 0, "page": page, "total_pages": 0}

    df = pd.DataFrame(records)

    for col in NUMERIC_COLS:
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors="coerce").fillna(0)

    # 캠페인 필터: 양쪽 strip으로 공백 불일치 방지
    if campaign.strip() not in ("전체", "") and "캠페인명" in df.columns:
        df = df[df["캠페인명"].astype(str).str.strip() == campaign.strip()]

    # 상품명 컬럼 탐색: 정규 컬럼명 → 대체 후보 순으로 확인
    PRODUCT_COL_CANDIDATES = ["광고집행 상품명", "광고집행상품명", "상품명", "집행상품명", "product"]
    product_col = next((c for c in PRODUCT_COL_CANDIDATES if c in df.columns), None)

    if product_col is None or df.empty:
        return {"items": [], "total": 0, "page": page, "total_pages": 0,
                "debug_columns": list(df.columns)}

    agg_map = {
        c: "sum"
        for c in ["광고비", "총 전환매출액(1일)", "총 전환매출액(14일)",
                  "총 주문수(1일)", "총 주문수(14일)", "클릭수"]
        if c in df.columns
    }
    grp = (
        df.groupby(product_col, dropna=False)
        .agg(agg_map)
        .reset_index()
        .rename(columns={
            product_col:           "상품명",
            "총 전환매출액(1일)":   "매출_1일",
            "총 전환매출액(14일)":  "매출_14일",
            "총 주문수(1일)":       "주문수_1일",
            "총 주문수(14일)":      "주문수_14일",
        })
    )

    def safe_roas(row, rev_col):
        cost = row.get("광고비", 0) or 0
        rev  = row.get(rev_col, 0) or 0
        return round(rev / cost * 100) if cost > 0 else 0

    if "매출_1일" in grp.columns:
        grp["ROAS_1일"]  = grp.apply(lambda r: safe_roas(r, "매출_1일"),  axis=1)
    if "매출_14일" in grp.columns:
        grp["ROAS_14일"] = grp.apply(lambda r: safe_roas(r, "매출_14일"), axis=1)
    if "클릭수" in grp.columns and "광고비" in grp.columns:
        grp["CPC"] = grp.apply(
            lambda r: round(r["광고비"] / r["클릭수"]) if (r.get("클릭수") or 0) > 0 else 0,
            axis=1,
        )

    VALID_SORT = {"매출_14일", "매출_1일", "광고비", "ROAS_14일", "ROAS_1일",
                  "주문수_14일", "주문수_1일", "CPC"}
    if sort_col not in VALID_SORT or sort_col not in grp.columns:
        sort_col = "매출_14일" if "매출_14일" in grp.columns else grp.columns[1]

    grp = grp.sort_values(sort_col, ascending=(sort_dir == "asc"), na_position="last")

    total       = len(grp)
    total_pages = max(1, (total + limit - 1) // limit)
    page        = max(1, min(page, total_pages))
    offset      = (page - 1) * limit

    page_df = grp.iloc[offset : offset + limit].copy()
    page_df = page_df.where(pd.notna(page_df), None)

    return {
        "items":       page_df.to_dict(orient="records"),
        "total":       total,
        "page":        page,
        "total_pages": total_pages,
    }


def compute_summary(parse_result: dict) -> dict:
    """
    parse_file() 결과로부터 KPI 요약을 계산한다.
    반환 키: totals, derived, by_campaign, daily_trend, date_range, row_count
    """
    records = parse_result.get("data", [])
    if not records:
        return {"error": "분석할 데이터가 없습니다."}

    df = pd.DataFrame(records)

    # 수치 컬럼 재변환 (JSON에서 불러온 경우 string일 수 있음)
    for col in NUMERIC_COLS:
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors="coerce").fillna(0)

    # ── 총합 KPI ─────────────────────────────────────────────────────────────
    kpi_keys = {
        "총_노출수":         "노출수",
        "총_클릭수":         "클릭수",
        "총_광고비":         "광고비",
        "총_주문수_1일":     "총 주문수(1일)",
        "총_주문수_14일":    "총 주문수(14일)",
        "총_전환매출액_1일": "총 전환매출액(1일)",
        "총_전환매출액_14일":"총 전환매출액(14일)",
    }
    totals: dict = {}
    for key, col in kpi_keys.items():
        if col in df.columns:
            totals[key] = round(float(df[col].sum()), 2)

    # ── 파생 지표 ─────────────────────────────────────────────────────────────
    derived: dict = {}
    imp = totals.get("총_노출수", 0)
    clk = totals.get("총_클릭수", 0)
    cost = totals.get("총_광고비", 0)
    rev1 = totals.get("총_전환매출액_1일", 0)
    rev14 = totals.get("총_전환매출액_14일", 0)

    if imp > 0:
        derived["CTR"] = round(clk / imp * 100, 2)
    if clk > 0:
        derived["CPC"] = round(cost / clk, 0)
    if cost > 0:
        derived["ROAS_1일"] = round(rev1 / cost * 100, 1)
        derived["ROAS_14일"] = round(rev14 / cost * 100, 1)

    # ── 캠페인별 집계 ─────────────────────────────────────────────────────────
    by_campaign = None
    if "캠페인명" in df.columns:
        num_cols = [c for c in df.columns if c in NUMERIC_COLS]
        grp = (
            df.groupby("캠페인명", dropna=False)[num_cols]
            .sum()
            .reset_index()
        )
        grp = grp.where(pd.notna(grp), None)
        by_campaign = grp.to_dict(orient="records")

    # ── 일별 트렌드 ───────────────────────────────────────────────────────────
    daily_trend = None
    if "날짜" in df.columns:
        num_cols = [c for c in df.columns if c in NUMERIC_COLS]
        daily = (
            df.groupby("날짜", dropna=False)[num_cols]
            .sum()
            .reset_index()
            .sort_values("날짜")
        )
        daily = daily.where(pd.notna(daily), None)
        daily_trend = daily.to_dict(orient="records")

    return {
        "date_range": parse_result.get("date_range"),
        "row_count": parse_result.get("row_count"),
        "totals": totals,
        "derived": derived,
        "by_campaign": by_campaign,
        "daily_trend": daily_trend,
    }
