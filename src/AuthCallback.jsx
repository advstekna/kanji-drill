import { useEffect } from 'react'
import { supabase } from './supabase'

export default function AuthCallback() {
  useEffect(() => {
    supabase.auth.getSession()
    window.location.href = '/'
  }, [])

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'serif', fontSize: 48 }}>
      漢字
    </div>
  )
}