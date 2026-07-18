import { useState, useEffect, useRef, useCallback } from "react";

const KANJI_POOL = [
  { kanji: "悲", meaning: "sad", readings: ["かなしい", "ひ"], level: "N3",
    vocab: [{ word: "悲しみ", reading: "かなしみ", meaning: "sadness" }, { word: "悲劇", reading: "ひげき", meaning: "tragedy" }] },
  { kanji: "笑", meaning: "laugh", readings: ["わらう", "しょう"], level: "N3",
    vocab: [{ word: "笑顔", reading: "えがお", meaning: "smiling face" }, { word: "笑い声", reading: "わらいごえ", meaning: "laughter" }] },
  { kanji: "怒", meaning: "angry", readings: ["おこる", "ど"], level: "N3",
    vocab: [{ word: "怒り", reading: "いかり", meaning: "anger" }, { word: "激怒", reading: "げきど", meaning: "rage" }] },
  { kanji: "困", meaning: "troubled", readings: ["こまる", "こん"], level: "N3",
    vocab: [{ word: "困難", reading: "こんなん", meaning: "difficulty" }, { word: "困惑", reading: "こんわく", meaning: "bewilderment" }] },
  { kanji: "覚", meaning: "awaken", readings: ["おぼえる", "かく"], level: "N3",
    vocab: [{ word: "覚悟", reading: "かくご", meaning: "resolve/readiness" }, { word: "記憶", reading: "きおく", meaning: "memory" }] },
  { kanji: "忘", meaning: "forget", readings: ["わすれる", "ぼう"], level: "N3",
    vocab: [{ word: "忘れ物", reading: "わすれもの", meaning: "forgotten item" }, { word: "忘却", reading: "ぼうきゃく", meaning: "oblivion" }] },
  { kanji: "願", meaning: "wish", readings: ["ねがう", "がん"], level: "N3",
    vocab: [{ word: "願い", reading: "ねがい", meaning: "wish/hope" }, { word: "願望", reading: "がんぼう", meaning: "desire" }] },
  { kanji: "恐", meaning: "fear", readings: ["おそれる", "きょう"], level: "N3",
    vocab: [{ word: "恐怖", reading: "きょうふ", meaning: "terror" }, { word: "恐ろしい", reading: "おそろしい", meaning: "horrifying" }] },
  { kanji: "謝", meaning: "apologize", readings: ["あやまる", "しゃ"], level: "N3",
    vocab: [{ word: "謝罪", reading: "しゃざい", meaning: "apology" }, { word: "感謝", reading: "かんしゃ", meaning: "gratitude" }] },
  { kanji: "夢", meaning: "dream", readings: ["ゆめ", "む"], level: "N3",
    vocab: [{ word: "夢中", reading: "むちゅう", meaning: "absorbed/engrossed" }, { word: "悪夢", reading: "あくむ", meaning: "nightmare" }] },
  { kanji: "命", meaning: "life/fate", readings: ["いのち", "めい"], level: "N3",
    vocab: [{ word: "命令", reading: "めいれい", meaning: "command/order" }, { word: "運命", reading: "うんめい", meaning: "destiny" }] },
  { kanji: "心", meaning: "heart", readings: ["こころ", "しん"], level: "N3",
    vocab: [{ word: "心配", reading: "しんぱい", meaning: "worry/concern" }, { word: "安心", reading: "あんしん", meaning: "relief" }] },
  { kanji: "抱", meaning: "embrace", readings: ["だく", "ほう"], level: "N3",
    vocab: [{ word: "抱擁", reading: "ほうよう", meaning: "embrace/hug" }, { word: "抱負", reading: "ほうふ", meaning: "ambition" }] },
  { kanji: "眠", meaning: "sleep", readings: ["ねむる", "みん"], level: "N3",
    vocab: [{ word: "眠気", reading: "ねむけ", meaning: "sleepiness" }, { word: "安眠", reading: "あんみん", meaning: "peaceful sleep" }] },
  { kanji: "驚", meaning: "surprised", readings: ["おどろく", "きょう"], level: "N2",
    vocab: [{ word: "驚き", reading: "おどろき", meaning: "surprise/amazement" }, { word: "驚愕", reading: "きょうがく", meaning: "astonishment" }] },
  { kanji: "疑", meaning: "doubt", readings: ["うたがう", "ぎ"], level: "N2",
    vocab: [{ word: "疑問", reading: "ぎもん", meaning: "question/doubt" }, { word: "疑惑", reading: "ぎわく", meaning: "suspicion" }] },
  { kanji: "憧", meaning: "longing", readings: ["あこがれる", "どう"], level: "N2",
    vocab: [{ word: "憧れ", reading: "あこがれ", meaning: "longing/admiration" }] },
  { kanji: "誇", meaning: "pride", readings: ["ほこる", "こ"], level: "N2",
    vocab: [{ word: "誇り", reading: "ほこり", meaning: "pride" }, { word: "誇示", reading: "こじ", meaning: "show off" }] },
  { kanji: "嘘", meaning: "lie", readings: ["うそ"], level: "N2",
    vocab: [{ word: "嘘つき", reading: "うそつき", meaning: "liar" }, { word: "方便の嘘", reading: "ほうべんのうそ", meaning: "white lie" }] },
  { kanji: "魂", meaning: "soul", readings: ["たましい", "こん"], level: "N2",
    vocab: [{ word: "魂胆", reading: "こんたん", meaning: "ulterior motive" }, { word: "霊魂", reading: "れいこん", meaning: "spirit/soul" }] },
  { kanji: "縁", meaning: "fate/bond", readings: ["えん"], level: "N2",
    vocab: [{ word: "縁起", reading: "えんぎ", meaning: "omen/luck" }, { word: "縁談", reading: "えんだん", meaning: "marriage proposal" }] },
  { kanji: "歓", meaning: "joy", readings: ["かん"], level: "N2",
    vocab: [{ word: "歓迎", reading: "かんげい", meaning: "welcome" }, { word: "歓声", reading: "かんせい", meaning: "cheer/shout of joy" }] },
  { kanji: "憂", meaning: "melancholy", readings: ["うれえる", "ゆう"], level: "N2",
    vocab: [{ word: "憂鬱", reading: "ゆううつ", meaning: "depression/gloom" }, { word: "憂慮", reading: "ゆうりょ", meaning: "anxiety/concern" }] },
  { kanji: "哀", meaning: "sorrow", readings: ["あわれ", "あい"], level: "N2",
    vocab: [{ word: "哀しみ", reading: "かなしみ", meaning: "grief" }, { word: "哀愁", reading: "あいしゅう", meaning: "pathos/sadness" }] },
  { kanji: "慕", meaning: "yearn", readings: ["したう", "ぼ"], level: "N2",
    vocab: [{ word: "慕情", reading: "ぼじょう", meaning: "longing/yearning" }, { word: "思慕", reading: "しぼ", meaning: "yearning/love" }] },
  { kanji: "揺", meaning: "sway", readings: ["ゆれる", "よう"], level: "N2",
    vocab: [{ word: "揺れ", reading: "ゆれ", meaning: "shaking/swaying" }, { word: "動揺", reading: "どうよう", meaning: "agitation/upset" }] },
  { kanji: "輝", meaning: "shine", readings: ["かがやく", "き"], level: "N2",
    vocab: [{ word: "輝き", reading: "かがやき", meaning: "radiance/brilliance" }, { word: "光輝", reading: "こうき", meaning: "glory/splendor" }] },
  { kanji: "孤", meaning: "lone", readings: ["こ"], level: "N2",
    vocab: [{ word: "孤独", reading: "こどく", meaning: "loneliness/isolation" }, { word: "孤立", reading: "こりつ", meaning: "isolation" }] },
  { kanji: "渇", meaning: "thirst", readings: ["かわく", "かつ"], level: "N2",
    vocab: [{ word: "渇望", reading: "かつぼう", meaning: "craving/longing" }, { word: "渇き", reading: "かわき", meaning: "thirst" }] },
  { kanji: "焦", meaning: "impatient", readings: ["あせる", "しょう"], level: "N2",
    vocab: [{ word: "焦り", reading: "あせり", meaning: "impatience/anxiety" }, { word: "焦点", reading: "しょうてん", meaning: "focus/focal point" }] },
];

const ALL_VOCAB = KANJI_POOL.flatMap(k => k.vocab || []);

const TIMER_SECONDS = 10;
const MAX_LIVES = 3;
const CHOICES = 4;
const FAST_WINDOW = 3000;

function shuffle(arr) { return [...arr].sort(() => Math.random() - 0.5); }
function getLevelColor(level) { return level === "N3" ? "#16a34a" : "#b45309"; }

function makeQuestion(card, pool, difficultyMode) {
  const roll = Math.random();
  const hasVocab = card.vocab && card.vocab.length > 0;
  let qType;
  if (hasVocab && roll < 0.2) qType = "vocab-reading";
  else if (hasVocab && roll < 0.4) qType = "vocab-meaning";
  else if (roll < 0.7) qType = "kanji-meaning";
  else qType = "kanji-reading";

  let prompt, correctAnswer, choices, hint;

  if (qType === "kanji-meaning") {
    prompt = card.kanji;
    correctAnswer = card.meaning;
    const wrongs = shuffle(pool.filter(k => k.meaning !== card.meaning)).slice(0, CHOICES - 1).map(k => k.meaning);
    choices = shuffle([correctAnswer, ...wrongs]);
    hint = card.readings[0];
  } else if (qType === "kanji-reading") {
    prompt = card.kanji;
    correctAnswer = card.readings[0];
    const wrongs = shuffle(pool.filter(k => k.readings[0] !== correctAnswer).map(k => k.readings[0])).slice(0, CHOICES - 1);
    choices = shuffle([correctAnswer, ...wrongs]);
    hint = card.meaning;
  } else if (qType === "vocab-reading") {
    const vocab = shuffle(card.vocab)[0];
    prompt = vocab.word;
    correctAnswer = vocab.reading;
    const wrongs = shuffle(ALL_VOCAB.filter(v => v.reading !== vocab.reading).map(v => v.reading)).slice(0, CHOICES - 1);
    choices = shuffle([correctAnswer, ...wrongs]);
    hint = vocab.meaning;
  } else {
    const vocab = shuffle(card.vocab)[0];
    prompt = vocab.word;
    correctAnswer = vocab.meaning;
    const wrongs = shuffle(ALL_VOCAB.filter(v => v.meaning !== vocab.meaning).map(v => v.meaning)).slice(0, CHOICES - 1);
    choices = shuffle([correctAnswer, ...wrongs]);
    hint = vocab.reading;
  }

  return { qType, prompt, correctAnswer, choices, hint, difficultyMode, isRetry: false };
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

export default function App() {
  const [phase, setPhase] = useState("menu");
  const [drillMode, setDrillMode] = useState(null);
  const [deck, setDeck] = useState([]);
  const [questions, setQuestions] = useState([]);
  const [index, setIndex] = useState(0);
  const [halfHearts, setHalfHearts] = useState(MAX_LIVES * 2);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [multiplier, setMultiplier] = useState(1);
  const [timeLeft, setTimeLeft] = useState(TIMER_SECONDS);
  const [fallProgress, setFallProgress] = useState(0);
  const [feedback, setFeedback] = useState(null);
  const [answered, setAnswered] = useState(false);
  const [results, setResults] = useState([]);
  const [cardStartTime, setCardStartTime] = useState(null);
  const [isRetry, setIsRetry] = useState(false);
  const timerRef = useRef(null);
  const fallRef = useRef(null);
  const halfHeartsRef = useRef(MAX_LIVES * 2);

  const startGame = useCallback((mode) => {
    const d = shuffle(KANJI_POOL);
    const qs = d.map(card => {
      const diff = mode === "easy" ? "easy" : mode === "hard" ? "hard" : Math.random() < 0.5 ? "hard" : "easy";
      return makeQuestion(card, KANJI_POOL, diff);
    });
    halfHeartsRef.current = MAX_LIVES * 2;
    setDeck(d); setQuestions(qs); setIndex(0);
    setHalfHearts(MAX_LIVES * 2); setScore(0); setStreak(0); setMultiplier(1);
    setResults([]); setIsRetry(false); setDrillMode(mode); setPhase("playing");
  }, []);

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
      setTimeLeft(t => { if (t <= 0.05) { clearInterval(timerRef.current); handleTimeout(); return 0; } return t - 0.05; });
    }, 50);
    return () => clearInterval(timerRef.current);
  }, [index, phase, answered]);

  useEffect(() => {
    if (phase !== "playing" || answered || !currentQ) return;
    const start = Date.now();
    fallRef.current = setInterval(() => setFallProgress(Math.min((Date.now() - start) / (TIMER_SECONDS * 1000), 1)), 30);
    return () => clearInterval(fallRef.current);
  }, [index, phase, answered]);

  function loseHalfHeart() { const n = halfHeartsRef.current - 1; halfHeartsRef.current = n; setHalfHearts(n); return n; }
  function gainHalfHeart() { const n = Math.min(halfHeartsRef.current + 1, MAX_LIVES * 2); halfHeartsRef.current = n; setHalfHearts(n); }

  function injectRetry(card, origQ) {
    const insertAt = Math.min(index + 1 + Math.floor(Math.random() * 2) + 1, deck.length);
    const retryQ = { ...makeQuestion(card, KANJI_POOL, origQ.difficultyMode), isRetry: true };
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
    setResults(r => [...r, { card: currentCard, q: currentQ, correct: false, timeout: true, retry: isRetry }]);
    setTimeout(() => advance(remaining), 1000);
  }

  function handleChoice(choice) {
    if (answered) return;
    clearInterval(timerRef.current); clearInterval(fallRef.current);
    setAnswered(true);
    const elapsed = Date.now() - cardStartTime;
    const isCorrect = choice === currentQ.correctAnswer;
    const isFast = elapsed < FAST_WINDOW;
    if (isCorrect) {
      const { points, newMult } = calcPoints(isFast, currentQ.difficultyMode);
      setStreak(s => s + 1); setMultiplier(newMult); setScore(s => s + points);
      if (isRetry) { gainHalfHeart(); setFeedback("recover"); } else setFeedback("correct");
      setResults(r => [...r, { card: currentCard, q: currentQ, correct: true, fast: isFast, points, retry: isRetry }]);
      setTimeout(() => advance(halfHeartsRef.current), 650);
    } else {
      const remaining = loseHalfHeart(); setStreak(0); setMultiplier(1); setFeedback("wrong");
      if (!isRetry) injectRetry(currentCard, currentQ);
      setResults(r => [...r, { card: currentCard, q: currentQ, correct: false, retry: isRetry }]);
      setTimeout(() => advance(remaining), 1000);
    }
  }

  function advance(currentHalfHearts) {
    if (currentHalfHearts <= 0 || index >= deck.length - 1) { setPhase("result"); return; }
    const nextQ = questions[index + 1];
    setIsRetry(!!(nextQ && nextQ.isRetry));
    setIndex(i => i + 1);
  }

  const cardY = Math.round(fallProgress * 60);
  const timerPct = (timeLeft / TIMER_SECONDS) * 100;
  const timerColor = timerPct > 60 ? "#16a34a" : timerPct > 30 ? "#d97706" : "#dc2626";

  // ── MENU ──────────────────────────────────────────────
  if (phase === "menu") {
    return (
      <div style={s.shell}>
        <div style={s.menuWrap}>
          <div style={s.menuKanji}>漢字</div>
          <h1 style={s.menuTitle}>Speed Drill</h1>
          <p style={s.menuSub}>N3 · N2 — kanji &amp; vocabulary</p>
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
        </div>
      </div>
    );
  }

  // ── RESULT ────────────────────────────────────────────
  if (phase === "result") {
    const firsts = results.filter(r => !r.retry);
    const correct = firsts.filter(r => r.correct).length;
    const pct = firsts.length ? Math.round(correct / firsts.length * 100) : 0;
    const hardCards = firsts.filter(r => r.q?.difficultyMode === "hard");
    const easyCards = firsts.filter(r => r.q?.difficultyMode === "easy");
    const hPct = hardCards.length ? Math.round(hardCards.filter(r => r.correct).length / hardCards.length * 100) : null;
    const ePct = easyCards.length ? Math.round(easyCards.filter(r => r.correct).length / easyCards.length * 100) : null;
    const modeInfo = DRILL_MODES.find(m => m.key === drillMode);
    const isVocabQ = q => q?.qType?.startsWith("vocab");
    const vocabResults = firsts.filter(r => isVocabQ(r.q));
    const kanjiResults = firsts.filter(r => !isVocabQ(r.q));
    const vPct = vocabResults.length ? Math.round(vocabResults.filter(r => r.correct).length / vocabResults.length * 100) : null;
    const kPct = kanjiResults.length ? Math.round(kanjiResults.filter(r => r.correct).length / kanjiResults.length * 100) : null;

    return (
      <div style={s.shell}>
        <div style={s.resultWrap}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", color: modeInfo.accent, marginBottom: 6 }}>
            {modeInfo.icon} {modeInfo.label.toUpperCase()} MODE
          </div>
          <div style={s.resultScore}>{score.toLocaleString()}</div>
          <div style={s.resultLabel}>points</div>
          <div style={s.resultStats}>
            <div style={s.statBlock}><span style={s.statNum}>{correct}/{firsts.length}</span><span style={s.statLbl}>correct</span></div>
            <div style={s.statBlock}><span style={s.statNum}>{pct}%</span><span style={s.statLbl}>accuracy</span></div>
            {kPct !== null && <div style={s.statBlock}><span style={{ ...s.statNum, color: "#4f46e5" }}>{kPct}%</span><span style={s.statLbl}>kanji</span></div>}
            {vPct !== null && <div style={s.statBlock}><span style={{ ...s.statNum, color: "#0891b2" }}>{vPct}%</span><span style={s.statLbl}>vocab</span></div>}
            {ePct !== null && <div style={s.statBlock}><span style={{ ...s.statNum, color: "#16a34a" }}>{ePct}%</span><span style={s.statLbl}>easy</span></div>}
            {hPct !== null && <div style={s.statBlock}><span style={{ ...s.statNum, color: "#dc2626" }}>{hPct}%</span><span style={s.statLbl}>hard</span></div>}
          </div>
          <div style={s.resultList}>
            {firsts.map((r, i) => {
              const hard = r.q?.difficultyMode === "hard";
              const vocab = isVocabQ(r.q);
              return (
                <div key={i} style={{ ...s.resultRow, opacity: r.correct ? 1 : 0.5 }}>
                  <span style={{ fontSize: vocab ? 14 : 20, fontFamily: "serif", minWidth: 40, textAlign: "left" }}>{r.q?.prompt}</span>
                  <span style={{ color: "#555", fontSize: 11, flex: 1, textAlign: "left" }}>{r.q?.correctAnswer}</span>
                  <span style={{ fontSize: 10, padding: "2px 5px", borderRadius: 4, background: vocab ? "#e0f2fe" : "#ede9fe", color: vocab ? "#0891b2" : "#7c3aed", fontWeight: 600, whiteSpace: "nowrap" }}>
                    {vocab ? "📖 vocab" : "漢 kanji"}
                  </span>
                  <span style={{ color: getLevelColor(r.card?.level), fontSize: 10, fontWeight: 700 }}>{r.card?.level}</span>
                  <span style={{ color: r.correct ? "#16a34a" : "#dc2626" }}>{r.correct ? "✓" : "✗"}</span>
                  {r.points && <span style={{ color: "#7c3aed", fontSize: 11, minWidth: 36 }}>+{r.points}</span>}
                </div>
              );
            })}
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <button style={{ ...s.startBtn, flex: 1, background: "#f3f4f6", color: "#333" }} onClick={() => setPhase("menu")}>← Modes</button>
            <button style={{ ...s.startBtn, flex: 2 }} onClick={() => startGame(drillMode)}>Again →</button>
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

  const cardBorder = feedback === "correct" || feedback === "recover" ? "#16a34a55" : feedback === "wrong" ? "#dc262655" : isHard ? "#fecdd3" : "#e5e7eb";
  const cardShadow = feedback === "correct" || feedback === "recover" ? "0 0 32px #16a34a22" : feedback === "wrong" ? "0 0 32px #dc262622" : "0 2px 16px #0000000f";

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
          <div style={{ ...s.levelBadge, color: getLevelColor(currentCard.level) }}>{currentCard.level}</div>
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
  modeCard: { display: "flex", alignItems: "center", justifyContent: "space-between", border: "1.5px solid", borderRadius: 14, padding: "14px 16px", cursor: "pointer", width: "100%", boxSizing: "border-box" },
  pillRow: { display: "flex", flexWrap: "wrap", gap: 6, justifyContent: "center", marginTop: 20 },
  pill: { background: "#f3f4f6", border: "1px solid #e5e7eb", borderRadius: 20, padding: "3px 10px", fontSize: 11, color: "#666" },
  startBtn: { background: "linear-gradient(135deg, #7c3aed, #4f46e5)", color: "#fff", border: "none", borderRadius: 12, padding: "14px 24px", fontSize: 15, fontWeight: 600, cursor: "pointer" },
  hud: { width: "100%", maxWidth: 400, display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  hudScore: { fontSize: 20, fontWeight: 700, fontVariantNumeric: "tabular-nums", color: "#111" },
  multBadge: { background: "#7c3aed", borderRadius: 8, color: "#fff", padding: "2px 8px", fontSize: 12, fontWeight: 700 },
  timerTrack: { width: "100%", maxWidth: 400, height: 4, background: "#f3f4f6", borderRadius: 2, marginBottom: 12, overflow: "hidden" },
  timerBar: { height: "100%", borderRadius: 2, transition: "width 0.05s linear, background 0.4s" },
  chip: { fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", border: "1px solid", borderRadius: 20, padding: "3px 10px" },
  cardWrap: { transition: "transform 0.05s linear, opacity 0.15s", marginBottom: 20 },
  card: { border: "1.5px solid", borderRadius: 20, padding: "20px 40px", textAlign: "center", minWidth: 220, transition: "box-shadow 0.15s, border-color 0.15s" },
  levelBadge: { fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", marginBottom: 6, textTransform: "uppercase" },
  kanjiGlyph: { fontFamily: "serif", lineHeight: 1.2, marginBottom: 6, color: "#111" },
  hint: { color: "#aaa", fontSize: 13, fontFamily: "serif", minHeight: 20 },
  choices: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, width: "100%", maxWidth: 400 },
  choiceBtn: { background: "#f9fafb", border: "1.5px solid #e5e7eb", borderRadius: 12, color: "#111", fontWeight: 500, padding: "12px 8px", cursor: "pointer", transition: "background 0.15s", lineHeight: 1.3 },
  progress: { marginTop: 14, color: "#bbb", fontSize: 12 },
  streak: { color: "#f97316", fontWeight: 700 },
  resultWrap: { textAlign: "center", maxWidth: 440, width: "100%" },
  resultScore: { fontSize: 56, fontWeight: 800, background: "linear-gradient(135deg, #7c3aed, #4f46e5)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", lineHeight: 1 },
  resultLabel: { color: "#aaa", fontSize: 13, marginBottom: 16 },
  resultStats: { display: "flex", justifyContent: "center", gap: 12, marginBottom: 20, flexWrap: "wrap" },
  statBlock: { display: "flex", flexDirection: "column", alignItems: "center", gap: 2 },
  statNum: { fontSize: 20, fontWeight: 700, color: "#111" },
  statLbl: { fontSize: 10, color: "#aaa", textTransform: "uppercase", letterSpacing: "0.08em" },
  resultList: { maxHeight: 300, overflowY: "auto", marginBottom: 20, display: "flex", flexDirection: "column", gap: 6 },
  resultRow: { display: "flex", alignItems: "center", gap: 8, background: "#f9fafb", border: "1px solid #f3f4f6", borderRadius: 10, padding: "8px 12px" },
};
