import { projectOrigin } from './config'

// the page's content security policy, written into the built index.html (github pages can't send headers).
// if something ever gets script into the page, the browser still refuses to run it or send data anywhere
// the planner doesn't already talk to. google maps' part follows google's own list for the maps javascript api
const GOOGLE_SCRIPTS = ['https://*.googleapis.com', 'https://*.gstatic.com', 'https://*.google.com', 'https://*.ggpht.com', 'https://*.googleusercontent.com']
const GOOGLE_DATA = ['https://*.googleapis.com', 'https://*.gstatic.com', 'https://*.google.com']

// every service the app fetches from (lib/photon, walk, rates, weather, dayWeather, wiki, openverse, holidays)
const SERVICES = [
  'https://photon.komoot.io', 'https://routing.openstreetmap.de', 'https://api.frankfurter.dev',
  'https://api.open-meteo.com', 'https://archive-api.open-meteo.com', 'https://en.wikipedia.org',
  'https://api.openverse.org', 'https://date.nager.at',
]

export function contentSecurityPolicy(supabaseUrl: string | undefined): string {
  let supabase: string[] = []
  try {
    if (supabaseUrl) {
      const origin = projectOrigin(supabaseUrl)
      supabase = [origin, origin.replace(/^https:/, 'wss:')]
    }
  } catch { /* not a url: the build's own check says so */ }
  const rules: Record<string, string[]> = {
    'default-src': ["'self'"],
    // google's vector map compiles webassembly: 'wasm-unsafe-eval' allows that and nothing else (no eval)
    'script-src': ["'self'", "'wasm-unsafe-eval'", 'blob:', ...GOOGLE_SCRIPTS],
    'style-src': ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
    // pictures come from many sites (link icons, wikipedia, flickr, google), and a picture can't run anything
    'img-src': ["'self'", 'data:', 'blob:', 'https:'],
    'font-src': ["'self'", 'data:', 'https://fonts.gstatic.com'],
    'connect-src': ["'self'", ...supabase, ...GOOGLE_DATA, ...SERVICES, 'data:', 'blob:'],
    'worker-src': ["'self'", 'blob:'],
    // a ticket shows in a frame from the device's own copy; google maps uses frames of its own
    'frame-src': ["'self'", 'blob:', 'https://*.google.com'],
    'manifest-src': ["'self'"],
    'object-src': ["'none'"],
    'base-uri': ["'self'"],
    'form-action': ["'self'"],
  }
  return Object.entries(rules).map(([k, v]) => `${k} ${v.join(' ')}`).join('; ')
}

// a vite plugin: the policy goes right after the charset (which must stay in the page's first 1024 bytes),
// before any script or style it governs
export function cspPlugin(supabaseUrl: string | undefined) {
  return {
    name: 'planner-csp',
    apply: 'build' as const,
    transformIndexHtml: (html: string) => {
      const tag = `<meta http-equiv="Content-Security-Policy" content="${contentSecurityPolicy(supabaseUrl)}" />`
      if (!/<meta charset[^>]*>/i.test(html)) throw new Error('index.html needs a <meta charset> for the policy to follow')
      return html.replace(/(<meta charset[^>]*>)/i, `$1\n    ${tag}`)
    },
  }
}
