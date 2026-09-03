# transliteration — the curated language list

the transliteration mix is not a free-for-all dropdown of every language on earth. it's a curated set: the world's most spoken languages that actually need transliteration treatment, all of them available in assemblyai's speech models, capped at 15. hinglish (hindi + english) is just the canonical example — the same mechanics apply to any mix.

## the list

each entry maps to an assemblyai language code. variant labels (eu/latam, khaleeji/msa, sk, germany, bahasa) are prixie-level choices — they shape behavior and language mix, even where assemblyai uses one base code.

| language | variant options | assemblyai code | assemblyai tier | notes |
|---|---|---|---|---|
| english | — | `en` | universal-3.5 pro | primary focus. dialects (us/uk/au) auto-detected by the model. |
| spanish | eu / latam | `es` | universal-3.5 pro | one base code — universal-3.5 pro automatically distinguishes castilian from mexican/rioplatense/colombian etc. the eu/latam choice is behavioral. |
| mandarin | — | `zh` | universal-2 (good) | |
| french | eu | `fr` | universal-3.5 pro | metropolitan; quebecois/belgian auto-detected under the same code. |
| german | germany | `de` | universal-3.5 pro | swiss german is a separate universal-2 entry (`de-CH`). |
| russian | — | `ru` | universal-3.5 pro | |
| hindi | — | `hi` | universal-2 (good) | devanagari detection via the existing hinglish service. |
| bengali | — | `bn` | universal-2 (fair) | ⚠ the weakest of the set — over 50% WER on universal-2. pair it with a stronger language at higher usage, or expect rough transcription. |
| korean | sk | `ko` | universal-2 (good) | |
| arabic | khaleeji / msa | `ar` | universal-2 (good) | ⚠ assemblyai has no dedicated khaleeji code. spoken gulf arabic is genuinely different from msa — universal-3.5 pro auto-dialects with the base code; on universal-2 it biases toward msa, so khaleeji accuracy drops. the khaleeji/msa label is behavioral and tells the agent which register to expect and reply in. |
| hebrew | — | `he` | universal-2 (good) | |
| portuguese | — | `pt` | universal-3.5 pro | brazilian vs european auto-detected. |
| urdu | — | `ur` | universal-2 (good) | close cousin of hindi — nastaʿlīq script and distinct register, worth keeping separate from hindi despite shared vocabulary. |
| indonesian | bahasa | `id` | universal-3.5 pro | |

14 languages, 16 selectable entries once variants are counted.

## model guidance

run assemblyai with the fallback chain so the curated set just works:

```json
{
  "speech_models": ["universal-3-5-pro", "universal-2"],
  "language_detection": true
}
```

universal-3.5 pro covers the high-accuracy set (english, spanish, french, german, russian, portuguese, indonesian) and falls back to universal-2's 99 languages for the rest (mandarin, hindi, bengali, korean, arabic, hebrew, urdu).

## the science/math english toggle

a sub-toggle within transliteration: **"science related / math related english words common"**.

in most transliteration mixes, technical vocabulary stays english even mid-sentence — a hindi-dominant engineer still says "sin", "cos", "tan", "log", "matrix", "derivative", "lambda". the problem is twofold:

1. **transcription confusion** — a hindi-heavy utterance containing "tan" can get transliterated as a hindi word (tan = body/complexion in hindi), mangling the transcript.
2. **response confusion** — the agent, asked to favor the non-english language, might translate or transliterate the math term itself, producing nonsense.

when the toggle is on:

- the agent treats a known technical lexicon (trig, calculus, linear algebra, units, programming keywords) as english-locked: it keeps them in english verbatim, never transliterates or translates them.
- the same lexicon is passed to assemblyai's **keyterms** parameter on the transcription request, biasing the STT toward recognizing them as english even inside non-english speech.
- transliteration sliders still apply to everything else — the lexicon is exempt, not the whole language.

when off, prixie treats english words in the mix as ordinary vocabulary, subject to priority and usage sliders like everything else.

config shape (part of `LocalizationConfig`):

```json
"transliteration": [
  { "language": "hindi", "priority": 1, "usage": 0.6 },
  { "language": "english", "priority": 2, "usage": 0.4 }
],
"keep_technical_english": true
```

## english is in the list on purpose

english is prixie's primary focus, but it participates in the mix the same way as every other language — selectable, prioritizable, slid. a "english + german, german priority 1" configuration is a denglisch-flavored call; "english + korean, english priority 1" is an english call peppered with korean. no language is structurally special; only the default is english-shaped.
