const TAG_PATTERN =
  /\b(?:2160p|1080p|720p|576p|480p|360p|4k|uhd|hdr10\+?|hdr|sdr|10bit|8bit|x264|x265|h\.?264|h\.?265|hevc|av1|xvid|divx|web-?dl|webrip|bluray|blu-ray|bdrip|brrip|dvdrip|hdtv|hdrip|hdcam|remux|proper|repack|extended|unrated|theatrical|directors?.cut|amzn|nf|dsnp|hmax|atvp|yts|rarbg|ettv|eztv|galaxyrg|tgx|ddp\d(?:\.\d)?|dd5\.1|dts(?:-hd)?|truehd|atmos|aac\d?(?:\.\d)?|ac3|eac3|6ch|2ch|multi|subs|internal)\b/gi

function parseTitleYear(filename) {
  const baseName = String(filename || '').split(/[/\\]/).pop() || String(filename || '')
  let name = baseName.replace(/\.[a-z0-9]{2,4}$/i, '')
  name = name.replace(/[._]+/g, ' ')
  name = name.replace(/\[[^\]]*]/g, ' ')
  const yearMatch = name.match(/\b((?:19|20)\d{2})\b/)
  const year = yearMatch ? Number(yearMatch[1]) : null
  if (yearMatch) {
    name = `${name.slice(0, yearMatch.index)} ${name.slice(yearMatch.index + yearMatch[0].length)}`
  }
  name = name.replace(/\([^)]*\)/g, ' ')
  name = name.replace(TAG_PATTERN, ' ')
  name = name.replace(/\s*-\s*[A-Za-z0-9]+$/g, ' ')
  name = name.replace(/\s{2,}/g, ' ').trim()
  return {
    title: name || baseName,
    year,
  }
}

function tagsFor(genres, runtimeMinutes) {
  const names = (genres || []).map((genre) => String(genre.name || genre).toLowerCase())
  const tags = []
  if (names.includes('animation')) tags.push('animation')
  else tags.push('live-action')
  if (names.some((name) => name.includes('short')) || (runtimeMinutes > 0 && runtimeMinutes <= 20)) {
    tags.push('short')
  }
  return tags
}

async function lookupMovie(title, year, apiKey) {
  if (!apiKey || !title) return null
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 8000)
  try {
    const search = new URL('https://api.themoviedb.org/3/search/movie')
    search.searchParams.set('api_key', apiKey)
    search.searchParams.set('query', title)
    search.searchParams.set('include_adult', 'false')
    if (year) search.searchParams.set('year', String(year))

    const response = await fetch(search, { signal: controller.signal })
    if (!response.ok) return null
    const body = await response.json()
    const hit = body.results?.[0]
    if (!hit) return null

    let overview = hit.overview || ''
    let genre = ''
    let director = ''
    let tags = ['live-action']
    let runtimeMinutes = 0

    try {
      const detailUrl = new URL(`https://api.themoviedb.org/3/movie/${hit.id}`)
      detailUrl.searchParams.set('api_key', apiKey)
      detailUrl.searchParams.set('append_to_response', 'credits')
      const detailResponse = await fetch(detailUrl, { signal: controller.signal })
      if (detailResponse.ok) {
        const detail = await detailResponse.json()
        overview = detail.overview || overview
        genre = detail.genres?.[0]?.name || ''
        director = detail.credits?.crew?.find((person) => person.job === 'Director')?.name || ''
        runtimeMinutes = Number(detail.runtime) || 0
        tags = tagsFor(detail.genres, runtimeMinutes)
      }
    } catch {
      // Poster and title from search are enough when details fail.
    }

    const releaseYear = hit.release_date ? Number(String(hit.release_date).slice(0, 4)) : year
    return {
      title: hit.title || title,
      year: Number.isFinite(releaseYear) ? releaseYear : year,
      posterUrl: hit.poster_path ? `https://image.tmdb.org/t/p/w780${hit.poster_path}` : '',
      tmdbId: hit.id,
      overview,
      genre,
      director,
      tags,
      runtimeMinutes,
    }
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

module.exports = {
  parseTitleYear,
  lookupMovie,
}
