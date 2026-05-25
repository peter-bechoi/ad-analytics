import os
from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List
from parser import parse_file, compute_summary, group_by_product

try:
    from anthropic import Anthropic as _Anthropic
    _anthropic_client = _Anthropic(api_key=os.environ.get("ANTHROPIC_API_KEY", ""))
except Exception:
    _anthropic_client = None

_CHAT_SYSTEM = """당신은 쿠팡 광고 전문 도우미입니다. 아래 지식을 바탕으로 광고주와 광고 대행사 담당자의 질문에 답변해주세요.

[쿠팡 광고 유형]
- AI스마트광고: 전체 상품 자동 선택, 키워드/입찰가 자동 최적화, 예산+목표수익률만 입력
- 매출최적화: 상품 직접 선택, 키워드/입찰가 자동, 예산+상품+목표수익률 입력. 7~14일 학습기간 필요, 이 기간 광고 끄지 말 것
- 수동성과형: 상품/키워드/입찰가 모두 수동. 캠페인-그룹-상품-키워드 구조. 검색/비검색 입찰가 별도 설정 가능. 스마트타겟팅과 수동키워드 동시 운영 가능. 수동키워드 입찰가가 스마트타겟팅보다 우선 적용
- 검색기반 브랜드광고: 키워드 검색결과 최상단/중단 배너 노출. CPM 과금(1000회 노출당 최소 5000원). 차순위 입찰가 과금 방식. 신규고객 87% 비중. 상품광고와 동시운영시 ROAS 15% 향상
- 오디언스플러스(외부채널): 첫 구매 전환 전까지 과금 안됨. 노출만 발생해도 광고비 0원 정상

[핵심 지표]
- ROAS = 광고전환매출 / 광고비 × 100
- 전환기준: 광고클릭 후 14일 이내 구매 (직접+간접전환)
- CPC: 클릭당 과금
- CTR: 클릭수/노출수×100
- CVR: 주문수/클릭수×100

[운영 팁]
- 예산 소진율 낮으면: 메인 키워드 입찰가 상향 검토
- 브랜드사는 비검색 영역 효과가 좋을 가능성 높음 → 비검색 입찰가를 검색보다 높게 설정
- 저성과 키워드: 입찰가 낮추고 제외 키워드 등록
- 매출최적화 학습기간(7~14일) 중 광고 끄지 말 것
- 카테고리 키워드에서 전환이 많이 발생하면 브랜드광고로 검색 상단 선점 검토

모르는 내용은 모른다고 솔직하게 답하고, 답변은 항상 한국어로 간결하게 해주세요."""


class _ChatMessage(BaseModel):
    role: str
    content: str


class _ChatRequest(BaseModel):
    messages: List[_ChatMessage]

app = FastAPI(title="광고 성과 분석 API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 마지막 업로드 데이터를 메모리에 보관 (단일 서버 용도)
_store: dict = {"last": None}

ALLOWED_EXTENSIONS = {"csv", "xlsx", "xls"}


@app.get("/")
def root():
    return {"message": "광고 성과 분석 API", "docs": "/docs"}


@app.get("/health")
def health():
    return {"status": "ok", "has_data": _store["last"] is not None}


@app.post("/upload")
async def upload_file(file: UploadFile = File(...)):
    """
    CSV 또는 XLSX 파일을 업로드하면 파싱 결과를 반환한다.

    - 컬럼 자동 인식 및 유사 매핑
    - 파싱된 데이터를 메모리에 저장 (GET /summary 에서 사용)
    """
    filename = file.filename or ""
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""

    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"지원하지 않는 파일 형식입니다. 허용: {', '.join(ALLOWED_EXTENSIONS)}",
        )

    content = await file.read()

    try:
        result = parse_file(content, filename)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"파싱 오류: {str(e)}")

    _store["last"] = result

    # data 필드는 용량이 크므로 응답에 포함하되, 미리보기(50행)도 함께 반환
    return {
        "filename": result["filename"],
        "row_count": result["row_count"],
        "date_range": result["date_range"],
        "column_map": result["column_map"],
        "unmapped_columns": result["unmapped_columns"],
        "columns": result["columns"],
        "preview": result["data"][:50],   # 첫 50행 미리보기
        "data": result["data"],
    }


@app.get("/products")
def get_products(
    campaign: str = "전체",
    page: int = 1,
    limit: int = 20,
    sort: str = "매출_14일",
    dir: str = "desc",
):
    """
    상품별 집계 결과를 페이지네이션해서 반환한다.
    campaign='전체'이면 전체 캠페인 합산.
    """
    if _store["last"] is None:
        raise HTTPException(status_code=404, detail="업로드된 데이터가 없습니다.")

    limit = max(1, min(limit, 100))   # 최대 100개 제한

    try:
        result = group_by_product(
            records=_store["last"]["data"],
            campaign=campaign,
            page=page,
            limit=limit,
            sort_col=sort,
            sort_dir=dir,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"상품 집계 오류: {str(e)}")

    return result


@app.get("/debug/store")
def debug_store():
    """저장된 데이터의 컬럼·캠페인 목록을 반환한다 (개발용)."""
    if _store["last"] is None:
        return {"status": "no_data", "message": "파일을 업로드해 주세요"}
    data = _store["last"]["data"]
    if not data:
        return {"status": "empty"}
    first = data[0]
    campaigns = sorted({str(r.get("캠페인명", "")).strip() for r in data if r.get("캠페인명")})
    return {
        "status": "ok",
        "row_count": len(data),
        "columns": list(first.keys()),
        "has_product_col": "광고집행 상품명" in first,
        "campaign_count": len(campaigns),
        "campaigns": campaigns[:20],
    }


@app.post("/chat")
def chat(req: _ChatRequest):
    """
    Anthropic Claude를 사용한 쿠팡 광고 전문 챗봇 엔드포인트.
    현재 업로드된 데이터 요약을 컨텍스트로 자동 주입한다.
    """
    if _anthropic_client is None:
        raise HTTPException(status_code=503, detail="AI 서비스를 사용할 수 없습니다. ANTHROPIC_API_KEY를 확인해주세요.")

    # 업로드된 데이터가 있으면 요약을 시스템 프롬프트에 주입
    system = _CHAT_SYSTEM
    if _store["last"] is not None:
        try:
            summary = compute_summary(_store["last"])
            totals = summary.get("totals", {})
            derived = summary.get("derived", {})
            dr = summary.get("date_range") or {}
            by_camp = summary.get("by_campaign") or []

            lines = ["\n\n[현재 업로드된 광고 데이터 요약]"]
            if dr:
                lines.append(f"- 분석 기간: {dr.get('start', '')} ~ {dr.get('end', '')}")
            lines.append(f"- 총 광고비: {int(totals.get('총_광고비', 0)):,}원")
            lines.append(f"- 전환매출(14일): {int(totals.get('총_전환매출액_14일', 0)):,}원")
            lines.append(f"- ROAS(14일): {derived.get('ROAS_14일', 0)}%")
            lines.append(f"- CTR: {derived.get('CTR', 0)}%")
            lines.append(f"- CPC: {int(derived.get('CPC', 0)):,}원")
            lines.append(f"- 총 클릭수: {int(totals.get('총_클릭수', 0)):,}회")
            lines.append(f"- 총 주문수(14일): {int(totals.get('총_주문수_14일', 0)):,}건")
            if by_camp:
                lines.append(f"- 캠페인 수: {len(by_camp)}개")
                top3 = sorted(by_camp, key=lambda c: c.get("광고비", 0), reverse=True)[:3]
                for c in top3:
                    cost = int(c.get("광고비", 0))
                    rev = int(c.get("총 전환매출액(14일)", 0))
                    roas = round(rev / cost * 100) if cost > 0 else 0
                    lines.append(f"  • {c.get('캠페인명', '')}: 광고비 {cost:,}원, ROAS {roas}%")
            system += "\n".join(lines)
        except Exception:
            pass  # 요약 실패해도 기본 시스템 프롬프트로 응답

    messages = [{"role": m.role, "content": m.content} for m in req.messages]

    try:
        resp = _anthropic_client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=1024,
            system=system,
            messages=messages,
        )
        return {"reply": resp.content[0].text}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI 응답 오류: {str(e)}")


@app.get("/summary")
def get_summary():
    """
    마지막으로 업로드된 데이터의 KPI 요약을 반환한다.

    - 총합: 노출수, 클릭수, 광고비, 주문수, 전환매출액
    - 파생: CTR, CPC, ROAS(1일/14일)
    - 캠페인별 집계
    - 일별 트렌드
    """
    if _store["last"] is None:
        raise HTTPException(status_code=404, detail="업로드된 데이터가 없습니다. POST /upload 를 먼저 호출하세요.")

    try:
        summary = compute_summary(_store["last"])
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"요약 계산 오류: {str(e)}")

    return summary
