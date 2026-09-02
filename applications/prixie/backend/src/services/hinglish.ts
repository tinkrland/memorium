// hinglish transliteration service
// converts devanagari (hindi script) to latin script phonetically
// applies schwa deletion (hindi drops inherent 'a' at word boundaries)
// wraps hinglish portions in italics, keeps english as-is
// goal: someone who already understands hinglish can read it without switching scripts

// ============================================================================
// devanagari to latin phonetic mapping
// ============================================================================

const VOWELS: Record<string, string> = {
  "अ": "a", "आ": "aa", "इ": "i", "ई": "ii", "उ": "u", "ऊ": "uu",
  "ऋ": "ri", "ॠ": "rii", "ए": "e", "ऐ": "ai", "ओ": "o", "औ": "au",
  "ऍ": "e", "ऎ": "e", "ऑ": "o", "ऒ": "o",
};

const MATRAS: Record<string, string> = {
  "ा": "aa", "ि": "i", "ी": "ii", "ु": "u", "ू": "uu",
  "ृ": "ri", "ॄ": "rii", "े": "e", "ै": "ai", "ो": "o", "ौ": "au",
  "ॅ": "e", "ॉ": "o", "ॆ": "e", "ॊ": "o",
};

const CONSONANTS: Record<string, string> = {
  "क": "k", "ख": "kh", "ग": "g", "घ": "gh", "ङ": "ng",
  "च": "ch", "छ": "chh", "ज": "j", "झ": "jh", "ञ": "n",
  "ट": "t", "ठ": "th", "ड": "d", "ढ": "dh", "ण": "n",
  "त": "t", "थ": "th", "द": "d", "ध": "dh", "न": "n",
  "प": "p", "फ": "ph", "ब": "b", "भ": "bh", "म": "m",
  "य": "y", "र": "r", "ल": "l", "व": "v", "श": "sh",
  "ष": "sh", "स": "s", "ह": "h",
};

const CONJUNCTS: Record<string, string> = {
  "क्ष": "ksh", "त्र": "tra", "ज्ञ": "gya", "श्र": "shr",
  "द्य": "dya", "त्त": "tt", "न्द": "nd", "न्त": "nt",
  "ङ्क": "nk", "ङ्ग": "ng", "स्त": "st", "स्न": "sn",
  "स्थ": "sth", "स्प": "sp", "स्क": "sk", "स्म": "sm",
  "स्त्र": "stra", "ह्म": "hm", "ह्य": "hy", "ह्न": "hn",
  "र्क": "rk", "र्त": "rt", "र्म": "rm", "र्य": "ry",
  "र्व": "rv", "म्र": "mra", "ग्र": "gra", "प्र": "pra",
  "ब्र": "bra", "फ्र": "phra", "क्र": "kra", "द्र": "dra",
  "ध्र": "dhra", "न्न": "nn", "द्ध": "ddh", "हृ": "hri",
};

const OTHERS: Record<string, string> = {
  "ं": "n",   // anusvara (nasal)
  "ः": "h",   // visarga
  "ँ": "n",   // chandrabindu (nasal)
  "्": "",    // halant/virama (suppresses inherent vowel)
  "।": ".",   // danda (full stop)
  "॥": "..",  // double danda
  "ऽ": "",    // avagraha
  "ॐ": "om",
};

const DIGITS: Record<string, string> = {
  "०": "0", "१": "1", "२": "2", "३": "3", "४": "4",
  "५": "5", "६": "6", "७": "7", "८": "8", "९": "9",
};

// ============================================================================
// helpers
// ============================================================================

export function isDevanagari(char: string): boolean {
  const code = char.codePointAt(0);
  return code !== undefined && code >= 0x0900 && code <= 0x097F;
}

function isMatra(char: string): boolean { return !!MATRAS[char]; }
function isConsonant(char: string): boolean { return !!CONSONANTS[char]; }
function isHalant(char: string): boolean { return char === "्"; }
function isAnusvara(char: string): boolean { return char === "ं" || char === "ँ"; }
function isIndependentVowel(char: string): boolean { return !!VOWELS[char]; }

// ============================================================================
// core transliteration with schwa deletion
// ============================================================================

export function containsDevanagari(text: string): boolean {
  for (const char of text) {
    if (isDevanagari(char)) return true;
  }
  return false;
}

// transliterate a devanagari word to latin script
// applies schwa deletion: inherent 'a' is dropped at word boundaries
export function transliterateWord(word: string): string {
  let result = "";
  const chars = Array.from(word);
  let i = 0;

  while (i < chars.length) {
    const char = chars[i];

    // try conjunct first (two chars)
    if (i + 1 < chars.length) {
      const pair = chars[i] + chars[i + 1];
      if (CONJUNCTS[pair]) {
        result += CONJUNCTS[pair];
        i += 2;
        continue;
      }
    }

    // independent vowel
    if (VOWELS[char]) {
      result += VOWELS[char];
      i++;
      continue;
    }

    // consonant (has inherent 'a' unless modified)
    if (CONSONANTS[char]) {
      result += CONSONANTS[char];
      i++;

      const isLast = i >= chars.length;
      if (isLast) {
        // schwa deletion: no inherent 'a' at end of word
        continue;
      }

      const next = chars[i];

      if (MATRAS[next]) {
        // matra replaces inherent vowel
        result += MATRAS[next];
        i++;
      } else if (isHalant(next)) {
        // halant suppresses inherent vowel
        i++;
      } else if (isAnusvara(next)) {
        // anusvara: nasal marker
        const afterNasal = chars[i + 1];
        if (afterNasal && (isConsonant(afterNasal) || isIndependentVowel(afterNasal))) {
          // not end - keep inherent 'a' + nasal
          result += "a" + OTHERS[next];
        } else {
          // near end - just nasal, no inherent 'a'
          result += OTHERS[next];
        }
        i++;
      } else if (isConsonant(next) || isIndependentVowel(next) || isDevanagari(next)) {
        // next is another devanagari char - inherent 'a' stays
        result += "a";
      } else {
        // non-devanagari follows - schwa deletion
        continue;
      }
      continue;
    }

    // standalone matra
    if (MATRAS[char]) { result += MATRAS[char]; i++; continue; }

    // other characters
    if (OTHERS[char] !== undefined) { result += OTHERS[char]; i++; continue; }

    // digits
    if (DIGITS[char]) { result += DIGITS[char]; i++; continue; }

    // passthrough
    result += char;
    i++;
  }

  return result;
}

// ============================================================================
// text segmentation and full pipeline
// ============================================================================

interface TextSegment {
  text: string;
  isHinglish: boolean;
}

// split text into english vs devanagari segments
export function segmentText(text: string): TextSegment[] {
  const segments: TextSegment[] = [];
  let currentText = "";
  let currentIsHinglish = false;
  let hasDevanagari = false;

  for (const char of text) {
    const charIsDeva = isDevanagari(char);

    if (charIsDeva !== currentIsHinglish && currentText.length > 0) {
      if (currentIsHinglish && hasDevanagari) {
        segments.push({ text: currentText, isHinglish: true });
      } else if (currentText.trim().length > 0) {
        segments.push({ text: currentText, isHinglish: false });
      }
      currentText = "";
      hasDevanagari = false;
    }

    currentIsHinglish = charIsDeva;
    if (charIsDeva) hasDevanagari = true;
    currentText += char;
  }

  if (currentText.length > 0) {
    if (currentIsHinglish && hasDevanagari) {
      segments.push({ text: currentText, isHinglish: true });
    } else if (currentText.trim().length > 0) {
      segments.push({ text: currentText, isHinglish: false });
    }
  }

  return segments;
}

// full pipeline: transliterate devanagari to latin, wrap in italics
export function processHinglish(text: string): string {
  const segments = segmentText(text);
  let result = "";

  for (const seg of segments) {
    if (seg.isHinglish) {
      const transliterated = transliterateWord(seg.text);
      result += `*${transliterated}*`;
    } else {
      result += seg.text;
    }
  }

  return result;
}

// process a full transcript line by line (preserves speaker labels)
export function processTranscript(transcript: string): string {
  const lines = transcript.split("\n");
  return lines.map(line =>
    containsDevanagari(line) ? processHinglish(line) : line
  ).join("\n");
}

// process utterances (for structured transcript data)
export function processUtterances(utterances: Array<{
  speaker: string;
  text: string;
  start: number;
  end: number;
}>): Array<{
  speaker: string;
  text: string;
  start: number;
  end: number;
  isHinglish: boolean;
}> {
  return utterances.map(u => {
    const hasHinglish = containsDevanagari(u.text);
    return {
      ...u,
      text: hasHinglish ? processHinglish(u.text) : u.text,
      isHinglish: hasHinglish,
    };
  });
}

// detect hinglish content
export function hasHinglishContent(transcript: string): boolean {
  return containsDevanagari(transcript);
}

// statistics
export function hinglishStats(transcript: string): {
  total_chars: number;
  hinglish_chars: number;
  english_chars: number;
  hinglish_percentage: number;
  has_hinglish: boolean;
} {
  let total = 0;
  let hinglish = 0;

  for (const char of transcript) {
    if (char.trim().length === 0) continue;
    total++;
    if (isDevanagari(char)) hinglish++;
  }

  return {
    total_chars: total,
    hinglish_chars: hinglish,
    english_chars: total - hinglish,
    hinglish_percentage: total > 0 ? Math.round((hinglish / total) * 100) : 0,
    has_hinglish: hinglish > 0,
  };
}
