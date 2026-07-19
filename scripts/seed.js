// scripts/seed.js
// Pulls KANJIDIC2 (kanji) and JMdict (vocab) data and seeds Supabase
// Run with: node scripts/seed.js

import { createClient } from '@supabase/supabase-js';
import fetch from 'node-fetch';
import { parseStringPromise } from 'xml2js';
import { createWriteStream, existsSync, createReadStream } from 'fs';
import { createGunzip } from 'zlib';
import { pipeline } from 'stream/promises';
import { readFile } from 'fs/promises';
import * as dotenv from 'dotenv';
import sax from 'sax';

dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const JLPT_MAP = { '3': 'N2', '2': 'N3' };

// ── Download and decompress a gzipped file ───────────────────────────────
async function downloadGz(url, destPath) {
  if (existsSync(destPath)) {
    console.log(`  ↩ Already downloaded: ${destPath}`);
    return;
  }
  console.log(`  ⬇ Downloading ${url}...`);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to download ${url}: ${res.statusText}`);
  await pipeline(res.body, createGunzip(), createWriteStream(destPath));
  console.log(`  ✓ Saved to ${destPath}`);
}

// ── Parse KANJIDIC2 (small enough for xml2js) ────────────────────────────
async function extractKanji() {
  const KANJIDIC_URL = 'http://www.edrdg.org/kanjidic/kanjidic2.xml.gz';
  const KANJIDIC_PATH = './scripts/kanjidic2.xml';
  await downloadGz(KANJIDIC_URL, KANJIDIC_PATH);

  console.log('  📖 Parsing KANJIDIC2...');
  const xml = await readFile(KANJIDIC_PATH, 'utf8');
  const parsed = await parseStringPromise(xml, { explicitArray: true });
  const characters = parsed.kanjidic2.character;
  const results = [];

  for (const char of characters) {
    const miscArr = char.misc?.[0];
    const jlptArr = miscArr?.jlpt;
    if (!jlptArr?.[0]) continue;
    const jlptLevel = JLPT_MAP[jlptArr[0]];
    if (!jlptLevel) continue;

    const character = char.literal?.[0];
    if (!character) continue;

    const meanings = [];
    const rmGroupArr = char.reading_meaning?.[0]?.rmgroup;
    if (rmGroupArr) {
      for (const rmg of rmGroupArr) {
        for (const m of rmg.meaning || []) {
          if (typeof m === 'string') meanings.push(m);
          else if (m._ && !m.$?.m_lang) meanings.push(m._);
        }
      }
    }
    if (meanings.length === 0) continue;

    const kunReadings = [], onReadings = [];
    if (rmGroupArr) {
      for (const rmg of rmGroupArr) {
        for (const r of rmg.reading || []) {
          if (typeof r === 'object' && r.$) {
            if (r.$.r_type === 'ja_kun') kunReadings.push(r._);
            if (r.$.r_type === 'ja_on') onReadings.push(r._);
          }
        }
      }
    }

    results.push({ character, meaning: meanings[0], level: jlptLevel, kun_readings: kunReadings, on_readings: onReadings });
  }

  console.log(`  ✓ Found ${results.length} kanji (N2/N3)`);
  return results;
}

// ── Stream-parse JMdict (too large for xml2js) ───────────────────────────
function extractVocabStreaming(kanjiSet, xmlPath) {
  return new Promise((resolve, reject) => {
    console.log('  📖 Streaming JMdict...');
    const kanjiSetSet = new Set(kanjiSet);
    const vocabByKanji = {};
    const MAX_PER_KANJI = 3;

    const parser = sax.createStream(false, { lowercase: true, trim: true });

    // Current entry state
    let inEntry = false;
    let currentTag = null;
    let currentEntry = { keb: [], reb: [], priorities: [], senses: [] };
    let currentSenseGlosses = [];
    let inSense = false;
    let entryCount = 0;

    parser.on('opentag', (node) => {
      currentTag = node.name;
      if (node.name === 'entry') {
        inEntry = true;
        currentEntry = { keb: [], reb: [], priorities: [], senses: [] };
      }
      if (node.name === 'sense') { inSense = true; currentSenseGlosses = []; }
    });

    parser.on('text', (text) => {
      if (!inEntry || !text.trim()) return;
      if (currentTag === 'keb') currentEntry.keb.push(text.trim());
      if (currentTag === 'reb') currentEntry.reb.push(text.trim());
      if (currentTag === 'ke_pri' || currentTag === 're_pri') currentEntry.priorities.push(text.trim());
      if (currentTag === 'gloss' && inSense) currentSenseGlosses.push(text.trim());
    });

    parser.on('closetag', (name) => {
      if (name === 'sense') {
        if (currentSenseGlosses.length > 0) currentEntry.senses.push(currentSenseGlosses);
        inSense = false;
        currentSenseGlosses = [];
      }

      if (name === 'entry') {
        entryCount++;
        if (entryCount % 10000 === 0) process.stdout.write(`  ⏳ Processed ${entryCount} entries\r`);

        const word = currentEntry.keb[0];
        const reading = currentEntry.reb[0];
        if (!word || !reading) { inEntry = false; return; }

        // Only common words
        const isCommon = currentEntry.priorities.some(p =>
          ['news1','news2','ichi1','ichi2','spec1','spec2'].includes(p)
        );
        if (!isCommon) { inEntry = false; return; }

        // First English gloss
        const meaning = currentEntry.senses?.[0]?.[0];
        if (!meaning) { inEntry = false; return; }

        // Check which kanji in our set this word uses
        for (const kanji of word) {
          if (kanjiSetSet.has(kanji) && word !== kanji) {
            if (!vocabByKanji[kanji]) vocabByKanji[kanji] = [];
            if (vocabByKanji[kanji].length < MAX_PER_KANJI) {
              // avoid duplicate words
              if (!vocabByKanji[kanji].find(v => v.word === word)) {
                vocabByKanji[kanji].push({ word, reading, meaning });
              }
            }
          }
        }

        inEntry = false;
      }
      currentTag = null;
    });

    parser.on('error', (err) => {
      // JMdict has some entity errors — skip and continue
      parser._parser.error = null;
      parser._parser.resume();
    });

    parser.on('end', () => {
      const total = Object.values(vocabByKanji).reduce((s, v) => s + v.length, 0);
      console.log(`\n  ✓ Found vocab for ${Object.keys(vocabByKanji).length} kanji (${total} entries)`);
      resolve(vocabByKanji);
    });

    // File is served as plain XML despite .gz extension — read directly
    createReadStream(xmlPath).pipe(parser);
  });
}

// ── Insert kanji ─────────────────────────────────────────────────────────
async function seedKanji(kanjiList) {
  console.log('\n📥 Inserting kanji...');
  const BATCH = 50;
  let inserted = 0;
  for (let i = 0; i < kanjiList.length; i += BATCH) {
    const batch = kanjiList.slice(i, i + BATCH);
    const { error } = await supabase.from('kanji').upsert(batch, { onConflict: 'character' });
    if (error) console.error(`  ❌ Batch ${i}:`, error.message);
    else { inserted += batch.length; process.stdout.write(`  ✓ ${inserted}/${kanjiList.length}\r`); }
  }
  console.log(`\n  ✅ Kanji done`);
}

// ── Insert vocab ──────────────────────────────────────────────────────────
async function seedVocab(vocabByKanji) {
  console.log('\n📥 Inserting vocab...');
  const { data: kanjiRows, error } = await supabase.from('kanji').select('id, character');
  if (error) { console.error('❌', error.message); return; }

  const kanjiIdMap = {};
  for (const row of kanjiRows) kanjiIdMap[row.character] = row.id;

  // Deduplicate by word — same word can appear under multiple kanji
  const seenWords = new Set();
  const vocabRows = [];
  for (const [character, vocabList] of Object.entries(vocabByKanji)) {
    const kanjiId = kanjiIdMap[character];
    if (!kanjiId) continue;
    for (const v of vocabList) {
      if (!seenWords.has(v.word)) {
        seenWords.add(v.word);
        vocabRows.push({ kanji_id: kanjiId, ...v });
      }
    }
  }

  const BATCH = 100;
  let inserted = 0;
  for (let i = 0; i < vocabRows.length; i += BATCH) {
    const batch = vocabRows.slice(i, i + BATCH);
    const { error } = await supabase.from('vocab').upsert(batch, { onConflict: 'word' });
    if (error) console.error(`  ❌ Batch ${i}:`, error.message);
    else { inserted += batch.length; process.stdout.write(`  ✓ ${inserted}/${vocabRows.length}\r`); }
  }
  console.log(`\n  ✅ Vocab done`);
}

// ── Main ──────────────────────────────────────────────────────────────────
async function main() {
  console.log('🌱 Starting seed...\n');

  console.log('Step 1: Extract kanji from KANJIDIC2');
  const kanjiList = await extractKanji();

  console.log('\nStep 2: Stream vocab from JMdict');
  const JMDICT_URL = 'http://ftp.edrdg.org/pub/Nihongo/JMdict_e.gz';
  const JMDICT_PATH = './scripts/JMdict_e.xml';
  await downloadGz(JMDICT_URL, JMDICT_PATH);
  const kanjiSet = kanjiList.map(k => k.character);
  const vocabByKanji = await extractVocabStreaming(kanjiSet, JMDICT_PATH);

  console.log('\nStep 3: Seed kanji');
  await seedKanji(kanjiList);

  console.log('\nStep 4: Seed vocab');
  await seedVocab(vocabByKanji);

  // Summary
  const { data: kanjiCount } = await supabase.from('kanji').select('level');
  const { data: vocabCount } = await supabase.from('vocab').select('id');
  const n2 = kanjiCount?.filter(k => k.level === 'N2').length || 0;
  const n3 = kanjiCount?.filter(k => k.level === 'N3').length || 0;
  console.log(`\n🎉 Done!\n📊 N3: ${n3} kanji | N2: ${n2} kanji | Vocab: ${vocabCount?.length || 0}`);
}

main().catch(console.error);