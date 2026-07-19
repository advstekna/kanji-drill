import { useState, useEffect } from 'react'
import { supabase } from './supabase'
import App from './App'
import Auth from './Auth'
import Progress from './Progress'
import Stats from './Stats'
import Nav from './Nav'

export default function Root() {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('drill')

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })

    return () => subscription.unsubscribe()
  }, [])

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'serif', fontSize: 48 }}>
      漢字
    </div>
  )

  if (!session) return <Auth />

  return (
    <div style={{ paddingBottom: 64 }}>
      {tab === 'drill'    && <App session={session} />}
      {tab === 'progress' && <Progress session={session} />}
      {tab === 'stats'    && <Stats session={session} />}
      <Nav tab={tab} setTab={setTab} />
    </div>
  )
}
