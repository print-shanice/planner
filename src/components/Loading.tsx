// totoro: the one way the planner says a screen or section is still coming
export function Loading({ label = 'loading', size = 'page', className = '' }: { label?: string; size?: 'page' | 'small'; className?: string }) {
  return (
    <div className={`totoro ${size} ${className}`} role="status" aria-label={label}>
      <img src={`${import.meta.env.BASE_URL}loading.gif`} alt="" />
    </div>
  )
}
