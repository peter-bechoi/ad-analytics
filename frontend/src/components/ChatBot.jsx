import { useState, useRef, useEffect } from 'react'
import axios from 'axios'

const api = axios.create({ baseURL: import.meta.env.VITE_API_URL ?? '/api' })

// ─── 아이콘 ───────────────────────────────────────────────────────────────────

const IconChat = () => (
  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
      d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
  </svg>
)

const IconX = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
  </svg>
)

const IconSend = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
      d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
  </svg>
)

// ─── 빠른 질문 버튼 ───────────────────────────────────────────────────────────

const QUICK_QUESTIONS = [
  'ROAS를 높이려면?',
  '예산 소진율이 낮아요',
  '비검색 효율 개선법',
  '매출최적화 학습기간이란?',
]

// ─── 메시지 버블 ─────────────────────────────────────────────────────────────

function MessageBubble({ role, content }) {
  const isUser = role === 'user'
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-3`}>
      {!isUser && (
        <div className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center mr-2 mt-0.5 shrink-0">
          <span className="text-white text-[10px] font-bold">AI</span>
        </div>
      )}
      <div
        className={`max-w-[82%] px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
          isUser
            ? 'bg-blue-600 text-white rounded-br-sm'
            : 'bg-white border border-slate-200 text-slate-700 rounded-bl-sm shadow-sm'
        }`}
      >
        {content}
      </div>
    </div>
  )
}

// ─── 로딩 버블 ───────────────────────────────────────────────────────────────

function TypingBubble() {
  return (
    <div className="flex justify-start mb-3">
      <div className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center mr-2 mt-0.5 shrink-0">
        <span className="text-white text-[10px] font-bold">AI</span>
      </div>
      <div className="bg-white border border-slate-200 rounded-2xl rounded-bl-sm px-4 py-3 shadow-sm">
        <div className="flex gap-1 items-center h-4">
          {[0, 1, 2].map(i => (
            <span
              key={i}
              className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce"
              style={{ animationDelay: `${i * 0.15}s` }}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── 메인 ChatBot ─────────────────────────────────────────────────────────────

export default function ChatBot() {
  const [open, setOpen]       = useState(false)
  const [messages, setMessages] = useState([
    { role: 'assistant', content: '안녕하세요! 쿠팡 광고 전문 AI입니다 😊\n광고 성과, 입찰 전략, 캠페인 운영 등 무엇이든 질문해주세요.' }
  ])
  const [input, setInput]     = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState(null)
  const bottomRef             = useRef(null)
  const inputRef              = useRef(null)

  // 새 메시지 생기면 스크롤 내리기
  useEffect(() => {
    if (open) bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading, open])

  // 창 열릴 때 입력창 포커스
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 100)
  }, [open])

  const sendMessage = async (text) => {
    const userText = (text ?? input).trim()
    if (!userText || loading) return

    const next = [...messages, { role: 'user', content: userText }]
    setMessages(next)
    setInput('')
    setLoading(true)
    setError(null)

    try {
      // assistant 메시지 제외한 user/assistant 쌍만 API 전송 (첫 인사 제외)
      const history = next.filter((_, i) => i > 0)
      const { data } = await api.post('/chat', { messages: history })
      setMessages(prev => [...prev, { role: 'assistant', content: data.reply }])
    } catch (err) {
      const msg = err.response?.data?.detail ?? '응답을 가져오지 못했습니다.'
      setError(typeof msg === 'string' ? msg : JSON.stringify(msg))
    } finally {
      setLoading(false)
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  return (
    <>
      {/* ── 채팅창 ───────────────────────────────────────────────────── */}
      {open && (
        <div className="fixed bottom-24 right-6 z-50 w-[360px] max-h-[560px] flex flex-col rounded-2xl shadow-2xl bg-slate-50 border border-slate-200 overflow-hidden"
          style={{ animation: 'fadeSlideUp 0.2s ease-out' }}
        >
          {/* 헤더 */}
          <div className="flex items-center justify-between px-4 py-3 bg-blue-600">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-white font-semibold text-sm">쿠팡 광고 AI</span>
              <span className="text-blue-200 text-xs">광고 전문 도우미</span>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="text-blue-200 hover:text-white transition-colors p-0.5 rounded"
            >
              <IconX />
            </button>
          </div>

          {/* 메시지 영역 */}
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-0.5 min-h-0" style={{ maxHeight: 380 }}>
            {messages.map((m, i) => (
              <MessageBubble key={i} role={m.role} content={m.content} />
            ))}
            {loading && <TypingBubble />}
            {error && (
              <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-2">
                ⚠️ {error}
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* 빠른 질문 */}
          {messages.length <= 2 && !loading && (
            <div className="px-4 pb-2 flex flex-wrap gap-1.5">
              {QUICK_QUESTIONS.map(q => (
                <button
                  key={q}
                  onClick={() => sendMessage(q)}
                  className="text-xs bg-white border border-slate-200 text-slate-600 hover:border-blue-400 hover:text-blue-600 px-2.5 py-1 rounded-full transition-colors"
                >
                  {q}
                </button>
              ))}
            </div>
          )}

          {/* 입력창 */}
          <div className="px-3 py-3 bg-white border-t border-slate-200">
            <div className="flex items-end gap-2">
              <textarea
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="메시지를 입력하세요… (Enter 전송)"
                rows={1}
                className="flex-1 resize-none text-sm border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:border-blue-400 bg-slate-50 max-h-28 leading-relaxed"
                style={{ minHeight: 38 }}
                disabled={loading}
              />
              <button
                onClick={() => sendMessage()}
                disabled={!input.trim() || loading}
                className="shrink-0 w-9 h-9 flex items-center justify-center bg-blue-600 hover:bg-blue-700 disabled:bg-slate-200 disabled:text-slate-400 text-white rounded-xl transition-colors"
              >
                <IconSend />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── FAB 버튼 ──────────────────────────────────────────────────── */}
      <button
        onClick={() => setOpen(o => !o)}
        className={`fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full shadow-xl flex items-center justify-center transition-all duration-200 ${
          open
            ? 'bg-slate-600 hover:bg-slate-700 rotate-0'
            : 'bg-blue-600 hover:bg-blue-700 hover:scale-110'
        } text-white`}
        title="AI 광고 도우미"
      >
        {open ? <IconX /> : <IconChat />}
      </button>

      {/* 애니메이션 스타일 */}
      <style>{`
        @keyframes fadeSlideUp {
          from { opacity: 0; transform: translateY(12px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
    </>
  )
}
