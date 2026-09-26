export function mediaUrl(url: string | undefined | null) {
  if (url && /^(https?:|data:|blob:)/.test(url)) return url
  const base = import.meta.env.BASE_URL || './'
  return `${base}placeholder.svg`
}
