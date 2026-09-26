import { Aperture, Download, Settings } from 'lucide-react'
import { cn } from '@/lib/utils'
import { type LibraryFilter, libraryNav } from './library-nav'

type SidebarProps = {
  filter: LibraryFilter
  onFilterChange: (filter: LibraryFilter) => void
  watchlistCount: number
  downloadCount: number
  onOpenSettings: () => void
}

export function Sidebar({
  filter,
  onFilterChange,
  watchlistCount,
  downloadCount,
  onOpenSettings,
}: SidebarProps) {
  return (
    <aside className="glass sticky top-3 m-3 hidden h-[calc(100dvh-1.5rem)] w-64 shrink-0 flex-col gap-8 rounded-3xl p-4 lg:flex">
      <div className="flex items-center gap-2.5 px-2 pt-1">
        <span className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
          <Aperture className="size-5" aria-hidden="true" />
        </span>
        <span className="text-lg font-semibold tracking-tight">Lumen</span>
      </div>

      <nav aria-label="Library" className="flex flex-col gap-1">
        <p className="px-3 pb-2 font-mono text-xs uppercase tracking-widest text-muted-foreground">
          Browse
        </p>
        {libraryNav.map((item) => {
          const isActive = filter === item.id
          const Icon = item.icon
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onFilterChange(item.id)}
              aria-current={isActive ? 'page' : undefined}
              className={cn(
                'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors focus-visible:outline-2',
                isActive
                  ? 'bg-glass-strong text-foreground shadow-[inset_0_1px_0_0_var(--glass-highlight)]'
                  : 'text-muted-foreground hover:bg-glass hover:text-foreground',
              )}
            >
              <Icon
                className={cn('size-4', isActive && 'text-primary')}
                aria-hidden="true"
              />
              <span className="flex-1 text-left">{item.label}</span>
              {item.id === 'watchlist' && watchlistCount > 0 && (
                <span className="rounded-full bg-glass-strong px-2 py-0.5 font-mono text-xs text-foreground">
                  {watchlistCount}
                </span>
              )}
            </button>
          )
        })}
      </nav>

      <div className="flex flex-col gap-1">
        <p className="px-3 pb-2 font-mono text-xs uppercase tracking-widest text-muted-foreground">
          Library
        </p>
        <div className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-muted-foreground">
          <Download className="size-4" aria-hidden="true" />
          <span className="flex-1">Downloads</span>
          <span className="font-mono text-xs text-foreground">{downloadCount}</span>
        </div>
      </div>

      <div className="mt-auto flex flex-col gap-2">
        <div className="flex items-center gap-3 rounded-2xl bg-glass px-3 py-2.5 text-sm text-muted-foreground">
          <Aperture className="size-4 text-primary" aria-hidden="true" />
          <span className="flex-1">
            <span className="font-medium text-foreground">Local only</span>
            <span className="block text-xs">Everything stays on this machine</span>
          </span>
        </div>
        <button
          type="button"
          onClick={onOpenSettings}
          className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-muted-foreground transition-colors hover:bg-glass hover:text-foreground focus-visible:outline-2"
        >
          <Settings className="size-4" aria-hidden="true" />
          <span className="flex-1 text-left">Settings</span>
        </button>
      </div>
    </aside>
  )
}
