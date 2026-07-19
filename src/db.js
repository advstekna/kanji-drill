// src/db.js
// All database logic — card fetching, review writing, SM-2 algorithm
// Imported by App.jsx

import { supabase } from './supabase'

const SESSION_SIZE = 15 // cards per drill session

// ── SM-2 Algorithm ────────────────────────────────────────────────────────
// Updates ease factor and interval based on answer quality
// quality: 0 = wrong, 1 = correct slow, 2 = correct fast
function sm2(easeFactor, intervalDays, quality) {
  if (quality === 0) {
    // Wrong — reset interval, keep ease factor
    return { easeFactor: Math.max(1.3, easeFactor - 0.2), intervalDays: 1 }
  }
  // Correct — increase interval
  const newEase = Math.max(1.3, easeFactor + (0.1 - (2 - quality) * (0.08 + (2 - quality) * 0.02)))
  const newInterval = intervalDays === 1 ? 3
    : intervalDays === 3 ? 7
    : Math.round(intervalDays * newEase)
  return { easeFactor: newEase, intervalDays: newInterval }
}

// ── Fetch 15 cards for a session ─────────────────────────────────────────
// Priority order:
// 1. Cards due for review (next_review <= now), weakest ease first
// 2. Cards never seen before
// Mixes kanji and vocab
export async function fetchSessionCards(userId, levels = ['N3', 'N2']) {
  const now = new Date().toISOString()

  // Step 1: Get due cards from card_progress
  let dueQuery = supabase
    .from('card_progress')
    .select('card_id, card_type, ease_factor, interval_days, total_correct, total_reviews')
    .eq('user_id', userId)
    .lte('next_review', now)
    .order('ease_factor', { ascending: true }) // weakest first
    .limit(SESSION_SIZE)

  if (levels?.length) dueQuery = dueQuery.in('level', levels)


  const { data: dueCards, error: dueError } = await dueQuery
  if (dueError) { console.error('Error fetching due cards:', dueError); return [] }

  // Step 2: If not enough due cards, fill with unseen kanji
  const needed = SESSION_SIZE - (dueCards?.length || 0)
  let unseenKanji = []

  if (needed > 0) {
    // Get IDs of kanji already seen
    const { data: seenProgress } = await supabase
      .from('card_progress')
      .select('card_id')
      .eq('user_id', userId)
      .eq('card_type', 'kanji')

    const seenIds = seenProgress?.map(p => p.card_id) || []

    let kanjiQuery = supabase
      .from('kanji')
      .select('id, character, meaning, level, kun_readings, on_readings')
      .limit(needed * 2) // fetch extra so we can filter

    if (levels?.length) kanjiQuery = kanjiQuery.in('level', levels)
    if (seenIds.length > 0) kanjiQuery = kanjiQuery.not('id', 'in', `(${seenIds.join(',')})`)

    const { data: kanjiData } = await kanjiQuery
    unseenKanji = (kanjiData || []).slice(0, needed)
  }

  // Step 3: Hydrate due cards with full kanji/vocab data
  const hydratedDue = await hydrateDueCards(dueCards || [])

  // Step 4: Format unseen kanji into the same shape
  const formattedUnseen = await formatUnseenKanji(unseenKanji)

  // Combine and shuffle
  const allCards = shuffle([...hydratedDue, ...formattedUnseen])
  return allCards.slice(0, SESSION_SIZE)
}

// Fetch full data for cards that have progress rows
async function hydrateDueCards(dueCards) {
  if (dueCards.length === 0) return []

  const kanjiIds = dueCards.filter(c => c.card_type === 'kanji').map(c => c.card_id)
  const vocabIds = dueCards.filter(c => c.card_type === 'vocab').map(c => c.card_id)

  const results = []

  if (kanjiIds.length > 0) {
    const { data } = await supabase
      .from('kanji')
      .select('id, character, meaning, level, kun_readings, on_readings')
      .in('id', kanjiIds)

    for (const k of data || []) {
      const progress = dueCards.find(c => c.card_id === k.id)
      results.push(formatKanjiCard(k, progress))
    }
  }

  if (vocabIds.length > 0) {
    const { data } = await supabase
      .from('vocab')
      .select('id, word, reading, meaning, kanji:kanji_id(id, character, level)')
      .in('id', vocabIds)

    for (const v of data || []) {
      const progress = dueCards.find(c => c.card_id === v.id)
      results.push(formatVocabCard(v, progress))
    }
  }

  return results
}

// Format unseen kanji — also fetch their vocab
async function formatUnseenKanji(kanjiList) {
  if (kanjiList.length === 0) return []

  const kanjiIds = kanjiList.map(k => k.id)
  const { data: vocabData } = await supabase
    .from('vocab')
    .select('id, word, reading, meaning, kanji_id')
    .in('kanji_id', kanjiIds)

  const vocabByKanji = {}
  for (const v of vocabData || []) {
    if (!vocabByKanji[v.kanji_id]) vocabByKanji[v.kanji_id] = []
    vocabByKanji[v.kanji_id].push(v)
  }

  return kanjiList.map(k => formatKanjiCard(k, null, vocabByKanji[k.id] || []))
}

// Shape a kanji row into the card format the game expects
function formatKanjiCard(k, progress = null, vocab = []) {
  return {
    id: k.id,
    type: 'kanji',
    kanji: k.character,
    meaning: k.meaning,
    level: k.level,
    readings: [...(k.kun_readings || []), ...(k.on_readings || [])],
    kun_readings: k.kun_readings || [],
    on_readings: k.on_readings || [],
    vocab,
    progress,
  }
}

// Shape a vocab row into the card format the game expects
function formatVocabCard(v, progress = null) {
  return {
    id: v.id,
    type: 'vocab',
    word: v.word,
    reading: v.reading,
    meaning: v.meaning,
    level: v.kanji?.level || 'N3',
    kanji: v.kanji,
    progress,
  }
}

// ── Write a review after each answer ─────────────────────────────────────
export async function recordReview(userId, card, correct, responseTimeMs, difficultyMode, questionType) {
  const level = card.level || card.kanji?.level || 'N3'

  // 1. Insert review row
  await supabase.from('reviews').insert({
    user_id: userId,
    card_id: card.id,
    card_type: card.type,
    level,
    correct,
    response_time_ms: responseTimeMs,
    difficulty_mode: difficultyMode,
    question_type: questionType,
  })

  // 2. Fetch existing progress for this card
  const { data: existing } = await supabase
    .from('card_progress')
    .select('*')
    .eq('user_id', userId)
    .eq('card_id', card.id)
    .eq('card_type', card.type)
    .single()

  // 3. Calculate quality score for SM-2
  const quality = !correct ? 0 : responseTimeMs < 3000 ? 2 : 1

  // 4. Run SM-2
  const currentEase = existing?.ease_factor || 2.5
  const currentInterval = existing?.interval_days || 1
  const { easeFactor, intervalDays } = sm2(currentEase, currentInterval, quality)

  // 5. Calculate next review date
  const nextReview = new Date()
  nextReview.setDate(nextReview.getDate() + intervalDays)

  // 6. Upsert card_progress
  await supabase.from('card_progress').upsert({
    user_id: userId,
    card_id: card.id,
    card_type: card.type,
    level,
    ease_factor: easeFactor,
    interval_days: intervalDays,
    next_review: nextReview.toISOString(),
    total_reviews: (existing?.total_reviews || 0) + 1,
    total_correct: (existing?.total_correct || 0) + (correct ? 1 : 0),
    last_reviewed: new Date().toISOString(),
  }, { onConflict: 'user_id,card_id,card_type' })
}

// ── Progress summary for the stats screen ─────────────────────────────────
export async function fetchProgressSummary(userId) {
  // Total kanji and vocab counts per level
  const { data: kanjiCounts } = await supabase
    .from('kanji')
    .select('level')

  const { data: vocabCounts } = await supabase
    .from('vocab')
    .select('id, kanji:kanji_id(level)')

  // User's progress rows
  const { data: progress } = await supabase
    .from('card_progress')
    .select('card_id, card_type, level, interval_days')
    .eq('user_id', userId)

  const levels = ['N3', 'N2']
  const types = ['kanji', 'vocab']
  const summary = {}

  for (const level of levels) {
    summary[level] = {}
    for (const type of types) {
      const totalCount = type === 'kanji'
        ? kanjiCounts?.filter(k => k.level === level).length || 0
        : vocabCounts?.filter(v => v.kanji?.level === level).length || 0

      const seen = progress?.filter(p => p.level === level && p.card_type === type) || []
      const learnt = seen.filter(p => p.interval_days >= 7).length
      const seenNotLearnt = seen.length - learnt
      const notSeen = totalCount - seen.length

      summary[level][type] = { total: totalCount, learnt, seenNotLearnt, notSeen }
    }
  }

  return summary
}

function shuffle(arr) { return [...arr].sort(() => Math.random() - 0.5) }