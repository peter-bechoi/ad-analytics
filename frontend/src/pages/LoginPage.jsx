import { useState } from 'react'

const ACCOUNTS = [
  { id: 'admin',  pw: 'admin1234', role: 'admin' },
  { id: 'guest1', pw: 'guest1234', role: 'guest' },
  { id: 'guest2', pw: 'guest1234', role: 'guest' },
  { id: 'guest3', pw: 'guest1234', role: 'guest' },
  { id: 'guest4', pw: 'guest1234', role: 'guest' },
  { id: 'guest5', pw: 'guest1234', role: 'guest' },
]

export default function LoginPage({ onLogin }) {
  const [id, setId]         = useState('')
  const [pw, setPw]         = useState('')
  const [error, setError]   = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    setTimeout(() => {
      const account = ACCOUNTS.find(a => a.id === id && a.pw === pw)
      if (account) {
        onLogin(account.role)
      } else {
        setError('아이디 또는 비밀번호가 올바르지 않습니다.')
        setLoading(false)
      }
    }, 300)
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* 로고 */}
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center shadow-sm">
            <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
              <path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zM8 7a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zM14 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z" />
            </svg>
          </div>
          <div>
            <p className="text-slate-900 font-bold text-base leading-tight">Ad Analytics</p>
            <p className="text-slate-400 text-xs">광고 성과 분석 대시보드</p>
          </div>
        </div>

        {/* 카드 */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm px-8 py-8 space-y-0">
          <h1 className="text-lg font-bold text-slate-900 mb-6">로그인</h1>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-600">아이디</label>
              <input
                type="text"
                value={id}
                onChange={e => setId(e.target.value)}
                placeholder="아이디 입력"
                autoComplete="username"
                autoFocus
                required
                className="w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder:text-slate-300 transition"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-600">비밀번호</label>
              <input
                type="password"
                value={pw}
                onChange={e => setPw(e.target.value)}
                placeholder="비밀번호 입력"
                autoComplete="current-password"
                required
                className="w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder:text-slate-300 transition"
              />
            </div>

            {error && (
              <p className="text-xs text-red-600 bg-red-50 border border-red-200 px-3 py-2 rounded-lg">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-semibold rounded-xl transition-colors mt-2"
            >
              {loading ? '확인 중...' : '로그인'}
            </button>
          </form>
        </div>

        {/* 쿠팡광고센터 링크 */}
        <div className="text-center mt-5">
          <a
            href="https://advertising.coupang.com/"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-blue-600 transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
            </svg>
            쿠팡광고센터 바로가기
          </a>
        </div>
      </div>
    </div>
  )
}
