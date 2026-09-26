import { cn } from '@/lib/utils'
import { type LibraryFilter, libraryNav } from './library-nav'

type MobileNavProps = {
  filter: LibraryFilter
  onFilterChange: (filter: LibraryFilter) => void
}

export function MobileNav({ filter, onFilterChange }: MobileNavProps) {
  return (
    <nav
      aria-label="Library"
      className="glass fixed inset-x-3 bottom-3 z-20 flex items-center justify-between rounded-2xl p-1.5 lg:hidden"
    >
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
              'flex flex-1 flex-col items-center gap-1 rounded-xl py-2 text-xs transition-colors',
              isActive
                ? 'bg-glass-strong text-foreground'
                : 'text-muted-foreground',
            )}
          >
            <Icon
              className={cn('size-5', isActive && 'text-primary')}
              aria-hidden="true"
            />
            {item.label === 'Live action' ? 'Live' : item.label}
          </button>
        )
      })}
    </nav>
  )
}
