import { useState, useEffect } from 'react'
import Sidebar from './components/layout/Sidebar'
import UploadZone from './components/UploadZone'
import DashboardPage from './pages/DashboardPage'
import InsightsPage from './pages/InsightsPage'
import ReportPage from './pages/ReportPage'
import LoginPage from './pages/LoginPage'
import ChatBot from './components/ChatBot'
import { uploadFile, pingHealth } from './api/client'

const PING_INTERVAL_MS = 5 * 60 * 1000 // 5분

export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(() => sessionStorage.getItem('auth') === '1')
  const [view, setView]           = useState('upload') // 'upload' | 'app'
  const [activeTab, setActiveTab] = useState('dashboard')
  const [uploadData, setUploadData] = useState(null)
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState(null)

  useEffect(() => {
    pingHealth()
    const id = setInterval(pingHealth, PING_INTERVAL_MS)
    return () => clearInterval(id)
  }, [])

  const handleLogin = () => {
    sessionStorage.setItem('auth', '1')
    setIsLoggedIn(true)
  }

  const handleLogout = () => {
    sessionStorage.removeItem('auth')
    setIsLoggedIn(false)
    setView('upload')
    setUploadData(null)
    setError(null)
  }

  const handleUpload = async (file) => {
    setLoading(true)
    setError(null)
    try {
      const result = await uploadFile(file)
      setUploadData(result)
      setActiveTab('dashboard')
      setView('app')
    } catch (err) {
      const msg = err.response?.data?.detail ?? err.message ?? '업로드 중 오류가 발생했습니다.'
      setError(typeof msg === 'string' ? msg : JSON.stringify(msg))
    } finally {
      setLoading(false)
    }
  }

  const handleReset = () => {
    setView('upload')
    setUploadData(null)
    setError(null)
  }

  // ─── 로그인 화면 ─────────────────────────────────────────────────────────────
  if (!isLoggedIn) {
    return <LoginPage onLogin={handleLogin} />
  }

  // ─── 업로드 화면 ─────────────────────────────────────────────────────────────
  if (view === 'upload') {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col">
        <ChatBot />
        {/* 헤더 */}
        <header className="bg-white border-b border-slate-200 px-8 py-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center">
              <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zM8 7a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zM14 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z" />
              </svg>
            </div>
            <span className="text-base font-bold text-slate-900">Ad Analytics</span>
          </div>
        </header>

        {/* 업로드 영역 */}
        <main className="flex-1 flex items-center justify-center px-4 py-16">
          <div className="w-full max-w-xl space-y-8">
            <div className="text-center space-y-2">
              <h1 className="text-2xl font-bold text-slate-900">광고 성과 분석</h1>
              <p className="text-slate-500 text-sm">
                쿠팡 광고 리포트(CSV/XLSX)를 업로드하면<br />
                컬럼을 자동 인식하고 대시보드를 생성합니다.
              </p>
            </div>

            {error && (
              <div className="bg-red-50 text-red-700 text-sm px-4 py-3 rounded-xl border border-red-200">
                {error}
              </div>
            )}

            {loading ? (
              <div className="flex flex-col items-center gap-4 py-12">
                <div className="relative w-12 h-12">
                  <div className="absolute inset-0 rounded-full border-4 border-blue-100" />
                  <div className="absolute inset-0 rounded-full border-4 border-blue-600 border-t-transparent animate-spin" />
                </div>
                <p className="text-slate-500 text-sm">파일을 분석하는 중입니다...</p>
              </div>
            ) : (
              <UploadZone onUpload={handleUpload} isLoading={loading} />
            )}

            {/* 지원 포맷 안내 */}
            <div className="flex items-center justify-center gap-6 text-xs text-slate-400">
              {['쿠팡 검색광고', '쿠팡 쇼핑광고', 'CSV / XLSX'].map(tag => (
                <span key={tag} className="flex items-center gap-1">
                  <span className="w-1 h-1 rounded-full bg-slate-300" />
                  {tag}
                </span>
              ))}
            </div>
          </div>
        </main>
      </div>
    )
  }

  // ─── 메인 앱 (사이드바 + 컨텐츠) ─────────────────────────────────────────────
  const rows = uploadData?.data ?? []

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      <Sidebar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onReset={handleReset}
        onLogout={handleLogout}
        filename={uploadData?.filename}
        dateRange={uploadData?.date_range}
      />

      <main className="flex-1 overflow-y-auto min-w-0">
        {activeTab === 'dashboard' && (
          <DashboardPage data={rows} dateRange={uploadData?.date_range} />
        )}
        {activeTab === 'insights' && (
          <InsightsPage data={rows} />
        )}
        {activeTab === 'report' && (
          <ReportPage
            data={rows}
            dateRange={uploadData?.date_range}
            filename={uploadData?.filename}
          />
        )}
      </main>

      <ChatBot />
    </div>
  )
}
