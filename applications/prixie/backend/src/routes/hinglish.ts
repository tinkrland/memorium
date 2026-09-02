import { Hono } from "hono";
import {
  processHinglish,
  processTranscript,
  transliterateWord,
  containsDevanagari,
  hinglishStats,
  processUtterances,
} from "../services/hinglish.ts";

const app = new Hono();

// POST /api/hinglish/process
// body: { text: "mixed english and देवनागरी text" }
// returns: { processed: "mixed english and *devanagari* text" }
app.post("/process", async (c) => {
  const body = await c.req.json();
  const text = body.text;

  if (!text) return c.json({ error: "text required" }, 400);

  return c.json({
    original: text,
    processed: processHinglish(text),
    stats: hinglishStats(text),
  });
});

// POST /api/hinglish/transcript
// body: { transcript: "full transcript with speaker labels\n..." }
// returns: { processed: "transcript with hinglish transliterated" }
app.post("/transcript", async (c) => {
  const body = await c.req.json();
  const transcript = body.transcript;

  if (!transcript) return c.json({ error: "transcript required" }, 400);

  return c.json({
    original: transcript,
    processed: processTranscript(transcript),
    stats: hinglishStats(transcript),
  });
});

// POST /api/hinglish/utterances
// body: { utterances: [{ speaker, text, start, end }] }
// returns: { utterances: [{ speaker, text, start, end, isHinglish }] }
app.post("/utterances", async (c) => {
  const body = await c.req.json();
  const utterances = body.utterances;

  if (!utterances || !Array.isArray(utterances)) {
    return c.json({ error: "utterances array required" }, 400);
  }

  return c.json({
    utterances: processUtterances(utterances),
  });
});

// POST /api/hinglish/word
// body: { word: "नमस्ते" }
// returns: { original: "नमस्ते", transliterated: "namaste" }
app.post("/word", async (c) => {
  const body = await c.req.json();
  const word = body.word;

  if (!word) return c.json({ error: "word required" }, 400);

  return c.json({
    original: word,
    transliterated: transliterateWord(word),
    has_devanagari: containsDevanagari(word),
  });
});

// GET /api/hinglish/detect?text=...
// returns: { has_hinglish: true/false, stats: {...} }
app.get("/detect", async (c) => {
  const text = c.req.query("text");
  if (!text) return c.json({ error: "text query param required" }, 400);

  return c.json(hinglishStats(text));
});

export default app;
