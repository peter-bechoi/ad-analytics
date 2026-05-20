export const fmtNumber = (n) => {
  if (n == null || isNaN(n)) return '-'
  return Math.round(n).toLocaleString('ko-KR')
}

export const fmtWon = (n) => {
  if (n == null || isNaN(n)) return '-'
  return `₩${Math.round(n).toLocaleString('ko-KR')}`
}

export const fmtPercent = (n, digits = 1) => {
  if (n == null || isNaN(n)) return '-'
  return `${Number(n).toFixed(digits)}%`
}

export const formatBytes = (bytes) => {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}
