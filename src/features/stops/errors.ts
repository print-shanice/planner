export function saveError(e: unknown): string {
  const code = (e as { code?: string } | null)?.code
  return code === '42501' ? "you're not on this planner" : "couldn't save, try again"
}
