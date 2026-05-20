# Ad Analytics — 쿠팡 광고 성과 자동 분석 대시보드

CSV / XLSX 파일을 업로드하면 쿠팡 광고 성과를 자동으로 분석하고 시각화하는 웹 애플리케이션입니다.

## 주요 기능

- **대시보드**: KPI 카드(광고비·매출·ROAS·CTR·CPC), 캠페인별 ROAS 차트, 일별 트렌드 차트
- **분석 인사이트**: 캠페인/상품/키워드/지면별 직접(1일) vs 간접(14일) 성과 비교
- **이상 징후 감지**: 예산 확대 추천, 효율 저하 경고, 비효율·주의 키워드 자동 감지
- **AI 플레이북**: 고객 설명용 자동 멘트 생성 및 클립보드 복사
- **캠페인 유형 구분**: 수동 성과형(입찰가 조정) / 매출최적화 PA(제외 키워드) 별도 권장 액션
- **로그인**: 하드코딩 계정 (ID: `admin` / PW: `admin1234`)

## 기술 스택

| 영역 | 기술 |
|------|------|
| 프론트엔드 | React 18 + Vite 5 + Recharts + Tailwind CSS v3 |
| 백엔드 | Python 3.12 + FastAPI + pandas |
| 파일 파싱 | pandas (xlsx, csv), 컬럼 자동 매핑 |

## 프로젝트 구조

```
ad-analytics/
├── frontend/
│   ├── src/
│   │   ├── pages/          # DashboardPage, InsightsPage, LoginPage
│   │   ├── components/     # TrendChart, Sidebar, UploadZone ...
│   │   ├── utils/          # dataHelpers.js, format.js
│   │   └── api/            # client.js
│   ├── vercel.json         # Vercel 배포 설정
│   └── vite.config.js
├── backend/
│   ├── main.py             # FastAPI 엔트리포인트
│   ├── parser.py           # 파일 파싱 + 집계 로직
│   ├── Procfile            # Railway 실행 명령
│   ├── runtime.txt         # Python 버전
│   └── requirements.txt
├── .env.example
└── README.md
```

## 로컬 실행 방법

### 1. 백엔드 (FastAPI)

```bash
cd backend

# 가상환경 생성 및 활성화
python -m venv venv
# Windows
venv\Scripts\activate
# macOS / Linux
source venv/bin/activate

# 의존성 설치
pip install -r requirements.txt

# 서버 실행 (http://localhost:8000)
uvicorn main:app --reload
```

API 문서: http://localhost:8000/docs

### 2. 프론트엔드 (React + Vite)

```bash
cd frontend

npm install
npm run dev
# → http://localhost:5173
```

두 서버를 **별도 터미널**에서 동시에 실행하세요.

---

## 배포 방법

### 백엔드 → Railway

1. [railway.app](https://railway.app) 에서 New Project → Deploy from GitHub
2. `backend/` 디렉토리를 루트로 지정
3. 환경변수 설정:
   ```
   ALLOWED_ORIGINS=https://your-app.vercel.app
   ```
4. 배포 완료 후 Railway가 제공하는 URL을 복사

### 프론트엔드 → Vercel

1. [vercel.com](https://vercel.com) 에서 New Project → Import from GitHub
2. **Root Directory**: `frontend`
3. `frontend/vercel.json` 파일에서 Railway URL로 교체:
   ```json
   {
     "rewrites": [
       {
         "source": "/api/:path*",
         "destination": "https://your-app.railway.app/:path*"
       }
     ]
   }
   ```
4. 배포 후 Vercel URL을 Railway의 `ALLOWED_ORIGINS`에 추가

---

## 환경변수

`.env.example` 파일을 참고해 `.env`를 생성하세요.

| 변수 | 위치 | 설명 |
|------|------|------|
| `ALLOWED_ORIGINS` | 백엔드 (Railway) | CORS 허용 도메인 (쉼표 구분) |
