from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from parser import parse_file, compute_summary, group_by_product

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
