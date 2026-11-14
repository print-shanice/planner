import { Component, type ErrorInfo, type ReactNode } from 'react'
import { persister } from '../lib/offline'

// if a screen breaks, say so instead of leaving a blank page. what broke shows only while developing:
// the live site keeps it to the console, so the page never lays out the app's insides.
// "reload from the server" drops only the copy of your trips kept for offline use; drafts and unsaved items stay
type State = { error: Error | null }

export class Crashed extends Component<{ children: ReactNode }, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('planner crashed', error, info.componentStack)
  }

  render() {
    const { error } = this.state
    if (!error) return this.props.children
    return (
      <main className="center-screen crashed" role="alert">
        <h1 className="wordmark big">planner</h1>
        <div className="crashed-body">
          <p>something on this page broke, so it couldn't open.</p>
          {import.meta.env.DEV && <pre className="crashed-error keep-case">{error.message || String(error)}{'\n\n'}{(error.stack ?? '').split('\n').slice(1, 7).map((l) => l.trim()).join('\n')}</pre>}
          <div className="row">
            <button type="button" className="btn primary" onClick={() => location.reload()}>try again</button>
            <button type="button" className="btn" onClick={() => { void Promise.resolve(persister.removeClient()).finally(() => location.reload()) }}>reload from the server</button>
          </div>
        </div>
      </main>
    )
  }
}
