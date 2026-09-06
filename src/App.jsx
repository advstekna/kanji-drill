import { useState, useEffect, useRef, useCallback } from "react";
import { fetchSessionCards, recordReview, fetchDistractorPool } from "./db";

const TIMER_SECONDS = 10;
const MAX_LIVES = 3;
const CHOICES = 4;
const FAST_WINDOW = 3000;

function shuffle(arr) { return [...arr].sort(() => Math.random() - 0.5); }
function getLevelColor(level) { return level === "N3" ? "#16a34a" : "#b45309"; }
function cleanReading(r) { return r ? r.replace(/\./g, '').replace(/-/g, '') : '' }

function makeQuestion(card, allCards, difficultyMode, pool = { kanji: [], vocab: [] }) {
  const isVocabCard = card.type === 'vocab'
  let qType

  if (isVocabCard) {
    qType = Math.random() < 0.5 ? 'vocab-reading' : 'vocab-meaning'
  } else {
    const roll = Math.random()
    const hasVocab = card.vocab && card.vocab.length > 0
    if (hasVocab && roll < 0.2) qType = 'vocab-reading'
    else if (hasVocab && roll < 0.4) qType = 'vocab-meaning'
    else if (roll < 0.7) qType = 'kanji-meaning'
    else qType = 'kanji-reading'
  }

  let prompt, correctAnswer, choices, hint

  if (qType === 'kanji-meaning') {
    prompt = card.kanji
    correctAnswer = card.meaning
    const wrongs = shuffle(
      [...pool.kanji, ...allCards.filter(c => c.type === 'kanji')]
        .filter(c => c.meaning !== card.meaning)
        .map(c => c.meaning)
        .filter((v, i, a) => v && a.indexOf(v) === i)
    ).slice(0, CHOICES - 1)
    choices = shuffle([correctAnswer, ...wrongs])
    hint = cleanReading(card.kun_readings?.[0] || card.on_readings?.[0] || '')

  } else if (qType === 'kanji-reading') {
    prompt = card.kanji
    const reading = cleanReading(card.kun_readings?.[0] || card.on_readings?.[0] || '')
    correctAnswer = reading
    const wrongs = shuffle(
      [...pool.kanji, ...allCards.filter(c => c.type === 'kanji')]
        .map(c => cleanReading(c.kun_readings?.[0] || c.on_readings?.[0] || ''))
        .filter(r => r && r !== correctAnswer)
        .filter((v, i, a) => a.indexOf(v) === i)
    ).slice(0, CHOICES - 1)
    choices = shuffle([correctAnswer, ...wrongs])
    hint = card.meaning

  } else if (qType === 'vocab-reading') {
    const vocabItem = isVocabCard ? card : shuffle(card.vocab)[0]
    prompt = vocabItem.word
    correctAnswer = vocabItem.reading
    const wrongs = shuffle(
      pool.vocab
        .filter(v => v.reading !== correctAnswer)
        .map(v => v.reading)
        .filter((v, i, a) => v && a.indexOf(v) === i)
    ).slice(0, CHOICES - 1)
    choices = shuffle([correctAnswer, ...wrongs])
    hint = vocabItem.meaning

  } else {
    const vocabItem = isVocabCard ? card : shuffle(card.vocab)[0]
    prompt = vocabItem.word
    correctAnswer = vocabItem.meaning
    const wrongs = shuffle(
      pool.vocab
        .filter(v => v.meaning !== correctAnswer)
        .map(v => v.meaning)
        .filter((v, i, a) => v && a.indexOf(v) === i)
    ).slice(0, CHOICES - 1)
    choices = shuffle([correctAnswer, ...wrongs])
    hint = vocabItem.reading
  }

  return { qType, prompt, correctAnswer, choices, hint, difficultyMode, isRetry: false }
}

function Hearts({ halfHearts }) {
  return (
    <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
      {Array.from({ length: MAX_LIVES }).map((_, i) => {
        const full = halfHearts >= (i + 1) * 2;
        const half = !full && halfHearts >= i * 2 + 1;
        return (
          <span key={i} style={{ fontSize: 20, lineHeight: 1, position: "relative", display: "inline-block", width: 22 }}>
            <span style={{ color: "#ddd" }}>♡</span>
            {(full || half) && (
              <span style={{ position: "absolute", left: 0, top: 0, color: "#ef4444", clipPath: full ? "none" : "inset(0 50% 0 0)" }}>♥</span>
            )}
          </span>
        );
      })}
    </div>
  );
}

const DRILL_MODES = [
  { key: "easy",  label: "Easy",  jp: "やさしい",  desc: "Hint shown on every card",                       icon: "🌸", accent: "#16a34a", bg: "#f0fdf4", border: "#bbf7d0" },
  { key: "mixed", label: "Mixed", jp: "まぜこぜ",  desc: "Some hints hidden — hard cards earn 2× points", icon: "🎲", accent: "#7c3aed", bg: "#f5f3ff", border: "#ddd6fe" },
  { key: "hard",  label: "Hard",  jp: "むずかしい", desc: "No hints — every card earns 2× points",         icon: "🔥", accent: "#dc2626", bg: "#fff1f2", border: "#fecdd3" },
];

export default function App({ session, focusedDrill, clearFocusedDrill }) {
  const userId = session.user.id

  const [phase, setPhase] = useState("menu");
  const [drillMode, setDrillMode] = useState(null);
  const [deck, setDeck] = useState([]);
  const [questions, setQuestions] = useState([]);
  const [index, setIndex] = useState(0);
  const [halfHearts, setHalfHearts] = useState(MAX_LIVES * 2);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const [multiplier, setMultiplier] = useState(1);
  const [timeLeft, setTimeLeft] = useState(TIMER_SECONDS);
  const [fallProgress, setFallProgress] = useState(0);
  const [feedback, setFeedback] = useState(null);
  const [answered, setAnswered] = useState(false);
  const [results, setResults] = useState([]);
  const [cardStartTime, setCardStartTime] = useState(null);
  const [isRetry, setIsRetry] = useState(false);
  const [loadError, setLoadError] = useState(null);
  const [selectedLevels, setSelectedLevels] = useState(['N3', 'N2']);
  const [distractorPool, setDistractorPool] = useState({ kanji: [], vocab: [] });
  const timerRef = useRef(null);
  const fallRef = useRef(null);
  const halfHeartsRef = useRef(MAX_LIVES * 2);

  useEffect(() => {
    if (focusedDrill && phase === 'menu') {
      startGame('mixed', focusedDrill)
    }
  }, [focusedDrill])

  function toggleLevel(level) {
    setSelectedLevels(prev => {
      if (prev.includes(level)) {
        if (prev.length === 1) return prev
        return prev.filter(l => l !== level)
      }
      return [...prev, level]
    })
  }

  const startGame = useCallback(async (mode, drillConfig = null) => {
    setPhase("loading");
    setLoadError(null);
    setDrillMode(mode);
    try {
      const cardIds = drillConfig?.cardIds || null
      const levels = drillConfig ? [drillConfig.level] : selectedLevels

      const [cards, pool] = await Promise.all([
        fetchSessionCards(userId, levels, cardIds),
        fetchDistractorPool(levels),
      ])

      if (clearFocusedDrill) clearFocusedDrill()

      if (!cards || cards.length === 0) {
        setLoadError("No cards found. Please check your database.");
        setPhase("menu");
        return;
      }

      setDistractorPool(pool)

      const qs = cards.map(card => {
        const diff = mode === "easy" ? "easy" : mode === "hard" ? "hard" : Math.random() < 0.5 ? "hard" : "easy";
        return makeQuestion(card, cards, diff, pool);
      });

      halfHeartsRef.current = MAX_LIVES * 2;
      setDeck(cards); setQuestions(qs); setIndex(0);
      setHalfHearts(MAX_LIVES * 2); setScore(0); setStreak(0); setBestStreak(0); setMultiplier(1);
      setResults([]); setIsRetry(false); setPhase("playing");
    } catch (err) {
      console.error(err);
      setLoadError("Failed to load cards. Please try again.");
      setPhase("menu");
    }
  }, [userId, selectedLevels]);

  const currentCard = deck[index];
  const currentQ = questions[index];

  useEffect(() => {
    if (phase !== "playing" || !currentQ) return;
    setTimeLeft(TIMER_SECONDS); setFallProgress(0);
    setFeedback(null); setAnswered(false); setCardStartTime(Date.now());
  }, [index, phase, currentQ]);

  useEffect(() => {
    if (phase !== "playing" || answered || !currentQ) return;
    timerRef.current = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 0.05) { clearInterval(timerRef.current); handleTimeout(); return 0; }
        return t - 0.05;
      });
    }, 50);
    return () => clearInterval(timerRef.current);
  }, [index, phase, answered]);

  useEffect(() => {
    if (phase !== "playing" || answered || !currentQ) return;
    const start = Date.now();
    fallRef.current = setInterval(() => {
      setFallProgress(Math.min((Date.now() - start) / (TIMER_SECONDS * 1000), 1));
    }, 30);
    return () => clearInterval(fallRef.current);
  }, [index, phase, answered]);

  function loseHalfHeart() { const n = halfHeartsRef.current - 1; halfHeartsRef.current = n; setHalfHearts(n); return n; }
  function gainHalfHeart() { const n = Math.min(halfHeartsRef.current + 1, MAX_LIVES * 2); halfHeartsRef.current = n; setHalfHearts(n); }

  function injectRetry(card, origQ) {
    const insertAt = Math.min(index + 1 + Math.floor(Math.random() * 2) + 1, deck.length);
    const retryQ = { ...makeQuestion(card, deck, origQ.difficultyMode, distractorPool), isRetry: true };
    setDeck(prev => { const n = [...prev]; n.splice(insertAt, 0, card); return n; });
    setQuestions(prev => { const n = [...prev]; n.splice(insertAt, 0, retryQ); return n; });
  }

  function calcPoints(isFast, difficultyMode) {
    const base = difficultyMode === "hard" ? 200 : 100;
    const newMult = isFast ? Math.min(multiplier + 0.5, 4) : multiplier;
    return { points: Math.round(base * newMult * (isFast ? 1.5 : 1)), newMult };
  }

  function handleTimeout() {
    clearInterval(timerRef.current); clearInterval(fallRef.current);
    setAnswered(true); setFeedback("wrong");
    const remaining = loseHalfHeart(); setStreak(0); setMultiplier(1);
    if (!isRetry) injectRetry(currentCard, currentQ);
    recordReview(userId, currentCard, false, TIMER_SECONDS * 1000, drillMode, currentQ.qType);
    setResults(r => [...r, { card: currentCard, q: currentQ, correct: false, timeout: true, retry: isRetry }]);
    setTimeout(() => advance(remaining), 1500);
  }

  function handleChoice(choice) {
    if (answered) return;
    clearInterval(timerRef.current); clearInterval(fallRef.current);
    setAnswered(true);
    const elapsed = Date.now() - cardStartTime;
    const isCorrect = choice === currentQ.correctAnswer;
    const isFast = elapsed < FAST_WINDOW;
    if (!isRetry) recordReview(userId, currentCard, isCorrect, elapsed, drillMode, currentQ.qType);
    if (isCorrect) {
      const { points, newMult } = calcPoints(isFast, currentQ.difficultyMode);
      const newStreak = streak + 1;
      setStreak(newStreak);
      setBestStreak(prev => Math.max(prev, newStreak));
      setMultiplier(newMult); setScore(s => s + points);
      if (isRetry) { gainHalfHeart(); setFeedback("recover"); } else setFeedback("correct");
      setResults(r => [...r, { card: currentCard, q: currentQ, correct: true, fast: isFast, points, retry: isRetry }]);
      setTimeout(() => advance(halfHeartsRef.current), 1200);
    } else {
      const remaining = loseHalfHeart(); setStreak(0); setMultiplier(1); setFeedback("wrong");
      if (!isRetry) injectRetry(currentCard, currentQ);
      setResults(r => [...r, { card: currentCard, q: currentQ, correct: false, retry: isRetry }]);
      setTimeout(() => advance(remaining), 1500);
    }
  }

  function advance(currentHalfHearts) {
    if (currentHalfHearts <= 0 || index >= deck.length - 1) { setPhase("result"); return; }
    const nextQ = questions[index + 1];
    setIsRetry(!!(nextQ && nextQ.isRetry));
    setIndex(i => i + 1);
  }

  async function handleSignOut() {
    const { supabase } = await import('./supabase')
    await supabase.auth.signOut()
  }

  const cardY = Math.round(fallProgress * 60);
  const timerPct = (timeLeft / TIMER_SECONDS) * 100;
  const timerColor = timerPct > 60 ? "#16a34a" : timerPct > 30 ? "#d97706" : "#dc2626";

  // ── LOADING ───────────────────────────────────────────
  if (phase === "loading") {
    return (
      <div style={{ ...s.shell, gap: 16 }}>
        <div style={{ fontSize: 48, fontFamily: "serif" }}>漢字</div>
        <div style={{ color: "#888", fontSize: 14 }}>Loading cards...</div>
      </div>
    );
  }

  // ── MENU ──────────────────────────────────────────────
  if (phase === "menu") {
    return (
      <div style={s.shell}>
        <div style={s.menuWrap}>
          <div style={s.menuKanji}>漢字</div>
          <h1 style={s.menuTitle}>Speed Drill</h1>
          <p style={s.menuSub}>kanji &amp; vocabulary</p>
          {loadError && <div style={s.errorBox}>{loadError}</div>}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginBottom: 20 }}>
            {['N3', 'N2'].map(level => {
              const active = selectedLevels.includes(level)
              const color = getLevelColor(level)
              return (
                <button key={level} onClick={() => toggleLevel(level)} style={{
                  padding: '6px 20px', borderRadius: 20, border: '1.5px solid',
                  fontWeight: 700, fontSize: 14, cursor: 'pointer',
                  background: active ? color : '#fff',
                  borderColor: color, color: active ? '#fff' : color,
                }}>{level}</button>
              )
            })}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12, width: "100%" }}>
            {DRILL_MODES.map(m => (
              <button key={m.key} onClick={() => startGame(m.key)}
                style={{ ...s.modeCard, background: m.bg, borderColor: m.border }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <span style={{ fontSize: 28 }}>{m.icon}</span>
                  <div style={{ textAlign: "left" }}>
                    <div style={{ fontWeight: 700, fontSize: 16, color: m.accent }}>
                      {m.label} <span style={{ fontFamily: "serif", fontWeight: 400, fontSize: 13, color: "#888" }}>{m.jp}</span>
                    </div>
                    <div style={{ fontSize: 12, color: "#666", marginTop: 2 }}>{m.desc}</div>
                  </div>
                </div>
                <span style={{ color: m.accent, fontSize: 18 }}>→</span>
              </button>
            ))}
          </div>
          <div style={s.pillRow}>
            <span style={s.pill}>⏱ 10 sec</span>
            <span style={s.pill}>❤️ 3 lives</span>
            <span style={s.pill}>🔁 Wrong = retry</span>
            <span style={s.pill}>📖 Vocab included</span>
          </div>
          <button onClick={handleSignOut} style={s.signOutBtn}>Sign out</button>
        </div>
      </div>
    );
  }

  // ── RESULT ────────────────────────────────────────────
  if (phase === "result") {
    const firsts = results.filter(r => !r.retry);
    const correct = firsts.filter(r => r.correct).length;
    const pct = firsts.length ? Math.round(correct / firsts.length * 100) : 0;
    const modeInfo = DRILL_MODES.find(m => m.key === drillMode);

    return (
      <div style={{ ...s.shell, justifyContent: 'flex-start', paddingTop: 20 }}>
        <div style={s.resultWrap}>
          <div style={{ textAlign: 'center', marginBottom: 12 }}>
            <div style={{ ...s.chip, color: modeInfo.accent, borderColor: modeInfo.border, marginBottom: 8, display: 'inline-block' }}>
              {modeInfo.icon} {modeInfo.label.toUpperCase()} MODE
            </div>
            <div style={s.resultScore}>{score.toLocaleString()}</div>
            <div style={s.resultLabel}>points</div>
            <div style={s.resultStats}>
              <div style={s.statBlock}><span style={s.statNum}>{correct}/{firsts.length}</span><span style={s.statLbl}>correct</span></div>
              <div style={s.statBlock}><span style={s.statNum}>{pct}%</span><span style={s.statLbl}>accuracy</span></div>
              <div style={s.statBlock}><span style={s.statNum}>{bestStreak}</span><span style={s.statLbl}>best streak</span></div>
            </div>
          </div>

          {/* Sticky action buttons */}
          <div style={s.resultActions}>
            <button style={{ ...s.startBtn, flex: 1, background: "#f3f4f6", color: "#333" }} onClick={() => setPhase("menu")}>← Menu</button>
            <button style={{ ...s.startBtn, flex: 2 }} onClick={() => startGame(drillMode)}>Again →</button>
          </div>

          {/* Per-card results */}
          <div style={s.resultList}>
            {firsts.map((r, i) => {
              const isVocab = r.q?.qType?.startsWith('vocab')
              const isCorrect = r.correct
              const card = r.card
              const progress = card?.progress
              const totalReviews = (progress?.total_reviews || 0) + 1
              const totalCorrect = (progress?.total_correct || 0) + (isCorrect ? 1 : 0)
              const totalWrong = totalReviews - totalCorrect
              const accuracy = Math.round(totalCorrect / totalReviews * 100)
              const kunReadings = card?.kun_readings?.map(cleanReading).filter(Boolean) || []
              const onReadings = card?.on_readings?.map(cleanReading).filter(Boolean) || []
              const vocabReading = isVocab ? (r.q?.hint || card?.reading || '') : ''
              const meaning = card?.meaning || ''
              const prompt = r.q?.prompt || ''
              const correctAnswer = r.q?.correctAnswer || ''

              return (
                <div key={i} style={{
                  ...s.resultCard,
                  borderColor: isCorrect ? '#86efac' : '#fca5a5',
                  background: isCorrect ? '#f0fdf4' : '#fff1f2',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ fontSize: isVocab ? 24 : 48, fontFamily: 'serif', lineHeight: 1, color: '#111' }}>
                        {prompt}
                      </div>
                      <div>
                        <div style={{ fontSize: 11, fontWeight: 700, color: getLevelColor(card?.level), textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                          {card?.level}
                        </div>
                        <div style={{ fontSize: 10, color: '#aaa', marginTop: 2 }}>
                          {isVocab ? '📖 vocab' : '漢 kanji'}
                        </div>
                      </div>
                    </div>
                    <div style={{
                      fontSize: 16, fontWeight: 700, padding: '4px 12px', borderRadius: 20,
                      background: isCorrect ? '#dcfce7' : '#fee2e2',
                      color: isCorrect ? '#166534' : '#dc2626',
                    }}>
                      {isCorrect ? '✓' : '✗'}
                    </div>
                  </div>

                  {isVocab ? (
                    <div style={s.resultCardRow}>
                      <div style={s.resultCardBlock}>
                        <div style={s.resultCardLbl}>Reading</div>
                        <div style={s.resultCardVal}>{vocabReading || '—'}</div>
                      </div>
                      <div style={s.resultCardBlock}>
                        <div style={s.resultCardLbl}>Meaning</div>
                        <div style={s.resultCardVal}>{meaning || '—'}</div>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div style={s.resultCardRow}>
                        <div style={s.resultCardBlock}>
                          <div style={s.resultCardLbl}>Kunyomi</div>
                          <div style={s.resultCardVal}>{kunReadings.slice(0, 2).join('、') || '—'}</div>
                        </div>
                        <div style={s.resultCardBlock}>
                          <div style={s.resultCardLbl}>Onyomi</div>
                          <div style={s.resultCardVal}>{onReadings.slice(0, 2).join('、') || '—'}</div>
                        </div>
                      </div>
                      <div style={{ ...s.resultCardBlock, marginBottom: 8 }}>
                        <div style={s.resultCardLbl}>Meaning</div>
                        <div style={s.resultCardVal}>{meaning || '—'}</div>
                      </div>
                    </>
                  )}

                  {!isCorrect && (
                    <div style={s.correctAnswerRow}>
                      <span style={{ ...s.resultCardLbl, color: '#166534' }}>Correct answer: </span>
                      <span style={{ fontFamily: 'serif', color: '#166534', fontWeight: 600, fontSize: 14 }}>{correctAnswer}</span>
                    </div>
                  )}

                  <div style={s.resultStatsRow}>
                    <div style={s.resultStatCell}>
                      <span style={s.resultStatNum}>{totalReviews}</span>
                      <span style={s.resultStatLbl}>seen</span>
                    </div>
                    <div style={s.resultStatCell}>
                      <span style={{ ...s.resultStatNum, color: '#16a34a' }}>{totalCorrect}</span>
                      <span style={s.resultStatLbl}>correct</span>
                    </div>
                    <div style={s.resultStatCell}>
                      <span style={{ ...s.resultStatNum, color: '#dc2626' }}>{totalWrong}</span>
                      <span style={s.resultStatLbl}>wrong</span>
                    </div>
                    <div style={s.resultStatCell}>
                      <span style={s.resultStatNum}>{accuracy}%</span>
                      <span style={s.resultStatLbl}>accuracy</span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    );
  }

  if (!currentCard || !currentQ) return null;

  const isHard = currentQ.difficultyMode === "hard";
  const isVocabQ = currentQ.qType?.startsWith("vocab");
  const isReadingQ = currentQ.qType === "kanji-reading" || currentQ.qType === "vocab-reading";
  const qLabel = isReadingQ ? "読み — Reading" : "意味 — Meaning";
  const qLabelColor = isReadingQ ? "#7c3aed" : "#4f46e5";

  const cardBorder = feedback === "correct" || feedback === "recover" ? "#16a34a55"
    : feedback === "wrong" ? "#dc262655"
    : isHard ? "#fecdd3" : "#e5e7eb";
  const cardShadow = feedback === "correct" || feedback === "recover" ? "0 0 32px #16a34a22"
    : feedback === "wrong" ? "0 0 32px #dc262622"
    : "0 2px 16px #0000000f";

  // ── PLAYING ───────────────────────────────────────────
  return (
    <div style={s.shell}>
      <div style={s.hud}>
        <Hearts halfHearts={halfHearts} />
        <div style={s.hudScore}>{score.toLocaleString()}</div>
        <div>{multiplier > 1 && <span style={s.multBadge}>×{multiplier.toFixed(1)}</span>}</div>
      </div>
      <div style={s.timerTrack}>
        <div style={{ ...s.timerBar, width: `${timerPct}%`, background: timerColor }} />
      </div>
      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 14, flexWrap: "wrap", justifyContent: "center" }}>
        {isVocabQ && <div style={{ ...s.chip, color: "#0891b2", borderColor: "#bae6fd", background: "#e0f2fe" }}>📖 Vocab</div>}
        <div style={{ ...s.chip, color: qLabelColor, borderColor: qLabelColor + "33" }}>{qLabel}</div>
        {isHard && <div style={{ ...s.chip, color: "#dc2626", borderColor: "#fecdd3", background: "#fff1f2" }}>🔥 ×2</div>}
        {isRetry && <div style={{ ...s.chip, color: "#d97706", borderColor: "#fde68a", background: "#fffbeb" }}>🔁 Retry</div>}
      </div>
      <div style={{ ...s.cardWrap, transform: `translateY(${cardY}px)`, opacity: feedback === "wrong" ? 0.5 : 1 }}>
        <div style={{ ...s.card, borderColor: cardBorder, boxShadow: cardShadow, background: isHard ? "#fffafa" : "#fff" }}>
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 6, marginBottom: 6 }}>
            <div style={{ ...s.levelBadge, color: getLevelColor(currentCard.level) }}>{currentCard.level}</div>
            {currentCard.progress
              ? <div style={{ fontSize: 10, fontWeight: 700, color: '#0891b2', background: '#e0f2fe', borderRadius: 20, padding: '2px 8px' }}>SEEN</div>
              : <div style={{ fontSize: 10, fontWeight: 700, color: '#aaa', background: '#f3f4f6', borderRadius: 20, padding: '2px 8px' }}>NEW</div>
            }
          </div>
          <div style={{ ...s.kanjiGlyph, fontSize: isVocabQ ? 32 : 84 }}>{currentQ.prompt}</div>
          {isHard && !answered
            ? <div style={{ ...s.hint, color: "#ddd", letterSpacing: "0.2em" }}>• • •</div>
            : <div style={s.hint}>{currentQ.hint}</div>
          }
          {feedback === "recover" && <div style={{ fontSize: 11, color: "#d97706", marginTop: 6, fontWeight: 600 }}>+½ heart recovered</div>}
        </div>
      </div>
      <div style={s.choices}>
        {currentQ.choices.map((c, i) => {
          let bg = "#f9fafb", borderColor = "#e5e7eb", color = "#111";
          if (answered) {
            if (c === currentQ.correctAnswer) { bg = "#dcfce7"; borderColor = "#16a34a"; color = "#166534"; }
            else if (feedback === "wrong") { bg = "#fee2e2"; borderColor = "#dc2626aa"; color = "#991b1b"; }
          }
          return (
            <button key={i}
              style={{ ...s.choiceBtn, background: bg, borderColor, color, fontFamily: isReadingQ ? "serif" : "inherit", fontSize: isReadingQ ? 17 : 13 }}
              onClick={() => handleChoice(c)} disabled={answered}>
              {c}
            </button>
          );
        })}
      </div>
      <div style={s.progress}>
        {index + 1} / {deck.length}
        {streak > 1 && <span style={s.streak}> 🔥 {streak}</span>}
      </div>
    </div>
  );
}

const s = {
  shell: { minHeight: "100vh", background: "#fff", color: "#111", fontFamily: "'Inter', system-ui, sans-serif", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "16px", boxSizing: "border-box" },
  menuWrap: { textAlign: "center", maxWidth: 380, width: "100%" },
  menuKanji: { fontSize: 64, fontFamily: "serif", lineHeight: 1, background: "linear-gradient(135deg, #7c3aed, #4f46e5)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", marginBottom: 6 },
  menuTitle: { fontSize: 26, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", margin: "0 0 4px", color: "#111" },
  menuSub: { color: "#888", fontSize: 13, marginBottom: 20 },
  errorBox: { background: "#fff1f2", border: "1px solid #fecdd3", borderRadius: 8, padding: "8px 12px", fontSize: 13, color: "#dc2626", marginBottom: 16 },
  modeCard: { display: "flex", alignItems: "center", justifyContent: "space-between", border: "1.5px solid", borderRadius: 14, padding: "14px 16px", cursor: "pointer", width: "100%", boxSizing: "border-box" },
  pillRow: { display: "flex", flexWrap: "wrap", gap: 6, justifyContent: "center", marginTop: 20 },
  pill: { background: "#f3f4f6", border: "1px solid #e5e7eb", borderRadius: 20, padding: "3px 10px", fontSize: 11, color: "#666" },
  startBtn: { background: "linear-gradient(135deg, #7c3aed, #4f46e5)", color: "#fff", border: "none", borderRadius: 12, padding: "14px 24px", fontSize: 15, fontWeight: 600, cursor: "pointer" },
  signOutBtn: { marginTop: 24, background: "none", border: "none", color: "#bbb", fontSize: 12, cursor: "pointer", textDecoration: "underline" },
  hud: { width: "100%", maxWidth: 400, display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  hudScore: { fontSize: 20, fontWeight: 700, fontVariantNumeric: "tabular-nums", color: "#111" },
  multBadge: { background: "#7c3aed", borderRadius: 8, color: "#fff", padding: "2px 8px", fontSize: 12, fontWeight: 700 },
  timerTrack: { width: "100%", maxWidth: 400, height: 4, background: "#f3f4f6", borderRadius: 2, marginBottom: 12, overflow: "hidden" },
  timerBar: { height: "100%", borderRadius: 2, transition: "width 0.05s linear, background 0.4s" },
  chip: { fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", border: "1px solid", borderRadius: 20, padding: "3px 10px" },
  cardWrap: { transition: "transform 0.05s linear, opacity 0.15s", marginBottom: 20 },
  card: { border: "1.5px solid", borderRadius: 20, padding: "20px 40px", textAlign: "center", minWidth: 220, transition: "box-shadow 0.15s, border-color 0.15s" },
  levelBadge: { fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase" },
  kanjiGlyph: { fontFamily: "serif", lineHeight: 1.2, marginBottom: 6, color: "#111" },
  hint: { color: "#aaa", fontSize: 13, fontFamily: "serif", minHeight: 20 },
  choices: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, width: "100%", maxWidth: 400 },
  choiceBtn: { background: "#f9fafb", border: "1.5px solid #e5e7eb", borderRadius: 12, color: "#111", fontWeight: 500, padding: "12px 8px", cursor: "pointer", transition: "background 0.15s", lineHeight: 1.3 },
  progress: { marginTop: 14, color: "#bbb", fontSize: 12 },
  streak: { color: "#f97316", fontWeight: 700 },
  resultWrap: { width: "100%", maxWidth: 440 },
  resultScore: { fontSize: 52, fontWeight: 800, background: "linear-gradient(135deg, #7c3aed, #4f46e5)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", lineHeight: 1 },
  resultLabel: { color: "#aaa", fontSize: 13, marginBottom: 12 },
  resultStats: { display: "flex", justifyContent: "center", gap: 16, marginBottom: 16 },
  statBlock: { display: "flex", flexDirection: "column", alignItems: "center", gap: 2 },
  statNum: { fontSize: 20, fontWeight: 700, color: "#111" },
  statLbl: { fontSize: 10, color: "#aaa", textTransform: "uppercase", letterSpacing: "0.08em" },
  resultActions: { display: "flex", gap: 10, marginBottom: 16, position: "sticky", top: 0, background: "#fff", paddingTop: 4, paddingBottom: 8, zIndex: 10 },
  resultList: { display: "flex", flexDirection: "column", gap: 12, paddingBottom: 20 },
  resultCard: { border: "1.5px solid", borderRadius: 16, padding: "14px", textAlign: "left" },
  resultCardRow: { display: "flex", gap: 8, marginBottom: 8 },
  resultCardBlock: { flex: 1, background: "#fff", borderRadius: 10, padding: "8px 10px" },
  resultCardLbl: { fontSize: 10, color: "#aaa", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 3 },
  resultCardVal: { fontSize: 14, fontFamily: "serif", color: "#111" },
  correctAnswerRow: { background: "#dcfce7", borderRadius: 8, padding: "6px 10px", marginBottom: 8, fontSize: 13 },
  resultStatsRow: { display: "flex", gap: 6 },
  resultStatCell: { flex: 1, background: "#fff", borderRadius: 10, padding: "8px 6px", textAlign: "center" },
  resultStatNum: { display: "block", fontSize: 15, fontWeight: 700, color: "#111" },
  resultStatLbl: { display: "block", fontSize: 9, color: "#aaa", textTransform: "uppercase", letterSpacing: "0.06em", marginTop: 2 },
};
