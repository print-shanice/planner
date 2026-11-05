import type { ConfigProblem as Problem } from '../../lib/config'

const TEXT: Record<Problem, [string, string]> = {
  url: ['VITE_SUPABASE_URL', "isn't the project url"],
  key: ['VITE_SUPABASE_ANON_KEY', 'is empty'],
  secret: ['VITE_SUPABASE_ANON_KEY', 'is a secret key — use the publishable key'],
}

export function ConfigProblem({ problem }: { problem: Problem }) {
  const [name, what] = TEXT[problem]
  return (
    <main className="center-screen">
      <h1 className="wordmark big">planner</h1>
      <p className="warn-line"><span className="keep-case">{name}</span> {what}</p>
    </main>
  )
}
