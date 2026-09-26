import type { Film } from '@/lib/films'
import { mediaUrl } from '@/lib/assets'

export function AmbientBackdrop({ film }: { film: Film }) {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-background"
    >
      <img
        key={film.id}
        src={mediaUrl(film.poster)}
        alt=""
        className="absolute inset-0 size-full scale-125 object-cover opacity-70 blur-3xl saturate-150 duration-1000 animate-in fade-in"
      />
      <div className="absolute inset-0 bg-background/50" />
      <div className="absolute inset-0 bg-linear-to-b from-transparent via-background/40 to-background" />
    </div>
  )
}
