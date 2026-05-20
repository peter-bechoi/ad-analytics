import { useState, useRef, useCallback } from 'react'
import { formatBytes } from '../utils/format'

const ALLOWED_EXT = ['csv', 'xlsx', 'xls']

export default function UploadZone({ onUpload, isLoading }) {
  const [dragging, setDragging] = useState(false)
  const [file, setFile] = useState(null)
  const [fileError, setFileError] = useState(null)
  const inputRef = useRef(null)

  const validate = (f) => {
    const ext = f.name.split('.').pop().toLowerCase()
    if (!ALLOWED_EXT.includes(ext)) {
      setFileError(`지원하지 않는 형식입니다. (허용: ${ALLOWED_EXT.join(', ')})`)
      return false
    }
    setFileError(null)
    return true
  }

  const pick = (f) => {
    if (f && validate(f)) setFile(f)
  }

  const handleDragOver = useCallback((e) => {
    e.preventDefault()
    setDragging(true)
  }, [])

  const handleDragLeave = useCallback((e) => {
    e.preventDefault()
    setDragging(false)
  }, [])

  const handleDrop = useCallback((e) => {
    e.preventDefault()
    setDragging(false)
    pick(e.dataTransfer.files[0])
  }, [])

  const handleChange = (e) => pick(e.target.files[0])

  return (
    <div className="w-full max-w-lg mx-auto space-y-4">
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => !isLoading && inputRef.current?.click()}
        className={[
          'border-2 border-dashed rounded-2xl p-14 text-center cursor-pointer transition-all duration-150 select-none',
          dragging
            ? 'border-indigo-500 bg-indigo-50 scale-[1.01]'
            : 'border-gray-300 hover:border-indigo-400 hover:bg-gray-50',
          isLoading ? 'pointer-events-none opacity-50' : '',
        ].join(' ')}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".csv,.xlsx,.xls"
          onChange={handleChange}
          className="hidden"
        />

        <div className="flex justify-center mb-4">
          <svg className="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
          </svg>
        </div>

        <p className="text-gray-700 font-medium">
          파일을 끌어다 놓거나{' '}
          <span className="text-indigo-600 underline underline-offset-2">클릭하여 선택</span>
        </p>
        <p className="text-sm text-gray-400 mt-1">CSV, XLSX, XLS 지원</p>
      </div>

      {fileError && (
        <p className="text-sm text-red-500 text-center">{fileError}</p>
      )}

      {file && !fileError && (
        <div className="flex items-center justify-between bg-white border border-gray-200 rounded-xl px-4 py-3 shadow-sm">
          <div className="min-w-0 mr-3">
            <p className="text-sm font-medium text-gray-800 truncate">{file.name}</p>
            <p className="text-xs text-gray-400">{formatBytes(file.size)}</p>
          </div>
          <button
            onClick={() => onUpload(file)}
            disabled={isLoading}
            className="shrink-0 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white text-sm font-semibold px-5 py-2 rounded-lg transition-colors disabled:opacity-50"
          >
            {isLoading ? '분석 중...' : '분석 시작'}
          </button>
        </div>
      )}
    </div>
  )
}
