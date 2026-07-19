import { useState } from 'react'
import { supabase } from './supabase'

export default function Auth() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  async function signInWithGoogle() {
    setLoading(true)
    setError(null)
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin
      }
    })
    if (error) setError(error.message)
    setLoading(false)
  }

  return (
    <div style={s.shell}>
      <div style={s.card}>
        <div style={s.kanji}>漢字</div>
        <h1 style={s.title}>Speed Drill</h1>
        <p style={s.sub}>N3 · N2 — kanji &amp; vocabulary</p>

        {error && <div style={s.error}>{error}</div>}

        <button style={s.btn} onClick={signInWithGoogle} disabled={loading}>
          {loading ? 'Redirecting...' : (
            <span style={{ display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'center' }}>
              <svg width="18" height="18" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Continue with Google
            </span>
          )}
        </button>
      </div>
    </div>
  )
}

const s = {
  shell: {
    minHeight: '100vh', background: '#fff', display: 'flex',
    alignItems: 'center', justifyContent: 'center', padding: 16,
    fontFamily: "'Inter', system-ui, sans-serif",
  },
  card: {
    textAlign: 'center', maxWidth: 340, width: '100%',
    padding: '40px 32px', borderRadius: 20,
    border: '1.5px solid #e5e7eb', boxShadow: '0 4px 24px #0000000a',
  },
  kanji: {
    fontSize: 64, fontFamily: 'serif', lineHeight: 1,
    background: 'linear-gradient(135deg, #7c3aed, #4f46e5)',
    WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
    marginBottom: 8,
  },
  title: { fontSize: 24, fontWeight: 700, margin: '0 0 4px', color: '#111', letterSpacing: '0.06em', textTransform: 'uppercase' },
  sub: { color: '#888', fontSize: 13, marginBottom: 32 },
  btn: {
    width: '100%', padding: '12px 20px', borderRadius: 12,
    border: '1.5px solid #e5e7eb', background: '#fff',
    fontSize: 15, fontWeight: 600, cursor: 'pointer', color: '#111',
    boxShadow: '0 1px 4px #0000000a',
  },
  error: {
    background: '#fff1f2', border: '1px solid #fecdd3',
    borderRadius: 8, padding: '8px 12px', fontSize: 13,
    color: '#dc2626', marginBottom: 16,
  },
}