import { useState, useEffect } from 'react'
import { supabase } from './supabase'
import { fetchProgressSummary } from './db'

export default function Stats({ session }) {
  const userId = session.user.id
  const [summary, setSummary] = useState(null)
  const [weakCards, setWeakCards] = useState([])
  const [recentSessions, setRecentSessions] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeSection, setActiveSection] = useState('overview')

  useEffect(() => {
    loadAll()
  }, [])

  async function loadAll() {
    setLoading(true)
    await Promise.all([loadSummary(), loadWeakCards(), loadRecentSessions()])
    setLoading(false)
  }

  async function loadSummary() {
    const data = await fetchProgressSummary(userId)
    setSummary(data)
  }

  async function loadWeakCards() {
    // Cards with most reviews but lowest accuracy
    const { data } = await supabase
      .from('card_progress')
      .select('card_id, card_type, level, total_reviews, total_correct, ease_factor, interval_days')
      .eq('user_id', userId)
      .gte('total_reviews', 2)
      .order('ease_factor', { ascending: true })
      .limit(10)

    if (!data || data.length === 0) { setWeakCards([]); return }

    // Hydrate with kanji/vocab data
    const kanjiIds = data.filter(c => c.card_type === 'kanji').map(c => c.card_id)
    const vocabIds = data.filter(c => c.card_type === 'vocab').map(c => c.card_id)

    const [kanjiRes, vocabRes] = await Promise.all([
      kanjiIds.length > 0
        ? supabase.from('kanji').select('id, character, meaning, level').in('id', kanjiIds)
        : { data: [] },
      vocabIds.length > 0
        ? supabase.from('vocab').select('id, word, reading, meaning').in('id', vocabIds)
        : { data: [] },
    ])

    const kanjiMap = {}
    for (const k of kanjiRes.data || []) kanjiMap[k.id] = k
    const vocabMap = {}
    for (const v of vocabRes.data || []) vocabMap[v.id] = v

    const hydrated = data.map(c => ({
      ...c,
      accuracy: Math.round((c.total_correct / c.total_reviews) * 100),
      cardData: c.card_type === 'kanji' ? kanjiMap[c.card_id] : vocabMap[c.card_id],
    })).filter(c => c.cardData)

    setWeakCards(hydrated.slice(0, 5))
  }

  async function loadRecentSessions() {
    // Group reviews by day to approximate sessions
    const { data } = await supabase
      .from('reviews')
      .select('correct, difficulty_mode, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(200)

    if (!data) return

    // Group by date
    const byDate = {}
    for (const r of data) {
      const date = r.created_at.split('T')[0]
      if (!byDate[date]) byDate[date] = { date, total: 0, correct: 0, modes: new Set() }
      byDate[date].total++
      if (r.correct) byDate[date].correct++
      if (r.difficulty_mode) byDate[date].modes.add(r.difficulty_mode)
    }

    const sessions = Object.values(byDate)
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 10)
      .map(s => ({
        ...s,
        accuracy: Math.round((s.correct / s.total) * 100),
        mode: [...s.modes].join(', '),
      }))

    setRecentSessions(sessions)
  }

  function getLevelColor(level) { return level === 'N3' ? '#16a34a' : '#b45309' }

  function formatDate(dateStr) {
    const date = new Date(dateStr)
    const today = new Date()
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)
    if (dateStr === today.toISOString().split('T')[0]) return 'Today'
    if (dateStr === yesterday.toISOString().split('T')[0]) return 'Yesterday'
    return date.toLocaleDateString('en', { month: 'short', day: 'numeric' })
  }

  const sections = [
    { key: 'overview', label: 'Overview' },
    { key: 'weak',     label: 'Weak Cards' },
    { key: 'history',  label: 'History' },
  ]

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#bbb', fontFamily: 'sans-serif' }}>
      Loading stats...
    </div>
  )

  return (
    <div style={s.shell}>
      {/* Header */}
      <div style={s.header}>
        <h2 style={s.title}>Stats</h2>
      </div>

      {/* Section tabs */}
      <div style={s.sectionTabs}>
        {sections.map(sec => (
          <button key={sec.key} onClick={() => setActiveSection(sec.key)}
            style={{ ...s.sectionTab, ...(activeSection === sec.key ? s.sectionTabActive : {}) }}>
            {sec.label}
          </button>
        ))}
      </div>

      {/* ── OVERVIEW ── */}
      {activeSection === 'overview' && summary && (
        <div style={s.content}>
          {['N3', 'N2'].map(level => {
            const k = summary[level]?.kanji || { total: 0, learnt: 0, seenNotLearnt: 0, notSeen: 0 }
            const v = summary[level]?.vocab  || { total: 0, learnt: 0, seenNotLearnt: 0, notSeen: 0 }
            const kPct = k.total ? Math.round(k.learnt / k.total * 100) : 0
            const vPct = v.total ? Math.round(v.learnt / v.total * 100) : 0

            return (
              <div key={level} style={s.levelCard}>
                <div style={s.levelHeader}>
                  <span style={{ ...s.levelBadge, color: getLevelColor(level), borderColor: getLevelColor(level) + '44' }}>{level}</span>
                </div>

                {/* Kanji */}
                <div style={s.typeLabel}>漢 Kanji</div>
                <div style={s.progressTrack}>
                  <div style={{ ...s.progressFill, width: `${kPct}%`, background: getLevelColor(level) }} />
                </div>
                <div style={s.statRow}>
                  <span style={s.statItem}><span style={{ ...s.dot, background: getLevelColor(level) }} />{k.learnt} learnt</span>
                  <span style={s.statItem}><span style={{ ...s.dot, background: '#fde68a' }} />{k.seenNotLearnt} learning</span>
                  <span style={s.statItem}><span style={{ ...s.dot, background: '#e5e7eb' }} />{k.notSeen} unseen</span>
                  <span style={{ fontSize: 11, color: '#aaa' }}>{kPct}%</span>
                </div>

                {/* Vocab */}
                <div style={{ ...s.typeLabel, marginTop: 14 }}>📖 Vocab</div>
                <div style={s.progressTrack}>
                  <div style={{ ...s.progressFill, width: `${vPct}%`, background: '#0891b2' }} />
                </div>
                <div style={s.statRow}>
                  <span style={s.statItem}><span style={{ ...s.dot, background: '#0891b2' }} />{v.learnt} learnt</span>
                  <span style={s.statItem}><span style={{ ...s.dot, background: '#fde68a' }} />{v.seenNotLearnt} learning</span>
                  <span style={s.statItem}><span style={{ ...s.dot, background: '#e5e7eb' }} />{v.notSeen} unseen</span>
                  <span style={{ fontSize: 11, color: '#aaa' }}>{vPct}%</span>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ── WEAK CARDS ── */}
      {activeSection === 'weak' && (
        <div style={s.content}>
          <p style={s.sectionDesc}>Your 5 most struggled cards based on ease factor.</p>
          {weakCards.length === 0 ? (
            <div style={s.empty}>No weak cards yet — keep drilling!</div>
          ) : (
            weakCards.map((c, i) => (
              <div key={i} style={s.weakCard}>
                <div style={s.weakLeft}>
                  <div style={s.weakPrompt}>
                    {c.card_type === 'kanji' ? c.cardData.character : c.cardData.word}
                  </div>
                  <div style={s.weakAnswer}>
                    {c.card_type === 'kanji' ? c.cardData.meaning : c.cardData.reading}
                  </div>
                  {c.card_type === 'vocab' && (
                    <div style={s.weakMeaning}>{c.cardData.meaning}</div>
                  )}
                </div>
                <div style={s.weakRight}>
                  <div style={{ ...s.accuracyBadge, background: c.accuracy < 50 ? '#fee2e2' : '#fef9c3', color: c.accuracy < 50 ? '#dc2626' : '#92400e' }}>
                    {c.accuracy}%
                  </div>
                  <div style={s.reviewCount}>{c.total_reviews} reviews</div>
                  <div style={{ ...s.levelTag, color: getLevelColor(c.level) }}>{c.level}</div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* ── HISTORY ── */}
      {activeSection === 'history' && (
        <div style={s.content}>
          <p style={s.sectionDesc}>Your last 10 study days.</p>
          {recentSessions.length === 0 ? (
            <div style={s.empty}>No sessions yet — start drilling!</div>
          ) : (
            recentSessions.map((session, i) => (
              <div key={i} style={s.sessionRow}>
                <div style={s.sessionDate}>{formatDate(session.date)}</div>
                <div style={s.sessionMid}>
                  <div style={s.sessionCards}>{session.total} cards</div>
                  {session.mode && <div style={s.sessionMode}>{session.mode}</div>}
                </div>
                <div style={{
                  ...s.sessionAccuracy,
                  color: session.accuracy >= 70 ? '#16a34a' : session.accuracy >= 50 ? '#d97706' : '#dc2626'
                }}>
                  {session.accuracy}%
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}

const s = {
  shell: {
    minHeight: '100vh', background: '#fff',
    fontFamily: "'Inter', system-ui, sans-serif",
    paddingBottom: 80,
  },
  header: {
    padding: '16px 16px 8px',
    borderBottom: '1px solid #f3f4f6',
  },
  title: { fontSize: 18, fontWeight: 700, margin: 0, color: '#111' },
  sectionTabs: {
    display: 'flex', borderBottom: '1px solid #f3f4f6',
  },
  sectionTab: {
    flex: 1, padding: '10px 0', fontSize: 13, fontWeight: 600,
    background: 'none', border: 'none', cursor: 'pointer',
    color: '#aaa', borderBottom: '2px solid transparent',
  },
  sectionTabActive: {
    color: '#7c3aed', borderBottom: '2px solid #7c3aed',
  },
  content: { padding: '16px' },
  sectionDesc: { fontSize: 12, color: '#aaa', marginTop: 0, marginBottom: 16 },
  empty: { color: '#bbb', textAlign: 'center', padding: '40px 0', fontSize: 14 },

  // Overview
  levelCard: {
    background: '#f9fafb', borderRadius: 14,
    padding: '16px', marginBottom: 12,
    border: '1px solid #f3f4f6',
  },
  levelHeader: { marginBottom: 12 },
  levelBadge: {
    fontSize: 12, fontWeight: 700, border: '1.5px solid',
    borderRadius: 20, padding: '2px 10px',
  },
  typeLabel: { fontSize: 11, fontWeight: 700, color: '#888', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 },
  progressTrack: { height: 6, background: '#e5e7eb', borderRadius: 3, overflow: 'hidden', marginBottom: 6 },
  progressFill: { height: '100%', borderRadius: 3, transition: 'width 0.4s' },
  statRow: { display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' },
  statItem: { display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#666' },
  dot: { width: 8, height: 8, borderRadius: '50%', display: 'inline-block' },

  // Weak cards
  weakCard: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '12px', background: '#f9fafb', borderRadius: 12,
    border: '1px solid #f3f4f6', marginBottom: 10,
  },
  weakLeft: { flex: 1 },
  weakPrompt: { fontSize: 24, fontFamily: 'serif', color: '#111', lineHeight: 1, marginBottom: 4 },
  weakAnswer: { fontSize: 13, color: '#555', fontFamily: 'serif' },
  weakMeaning: { fontSize: 11, color: '#aaa', marginTop: 2 },
  weakRight: { display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 },
  accuracyBadge: { fontSize: 14, fontWeight: 700, padding: '3px 10px', borderRadius: 20 },
  reviewCount: { fontSize: 11, color: '#aaa' },
  levelTag: { fontSize: 11, fontWeight: 700 },

  // History
  sessionRow: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '12px', background: '#f9fafb', borderRadius: 12,
    border: '1px solid #f3f4f6', marginBottom: 8,
  },
  sessionDate: { fontSize: 14, fontWeight: 600, color: '#111', minWidth: 80 },
  sessionMid: { flex: 1, paddingLeft: 12 },
  sessionCards: { fontSize: 13, color: '#555' },
  sessionMode: { fontSize: 11, color: '#aaa', marginTop: 2, textTransform: 'capitalize' },
  sessionAccuracy: { fontSize: 18, fontWeight: 700, minWidth: 48, textAlign: 'right' },
}
