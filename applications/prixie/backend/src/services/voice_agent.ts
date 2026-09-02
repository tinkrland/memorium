// voice agent service
// handles prixie's voice interaction: asking questions, listening to answers
// key challenges: end of turn detection, context window management, interruption handling
//
// the pacing problem: someone says "okay so basically to explain that..."
// then pauses while presenting their screen, saying "uhh" while setting up
// the voice agent must NOT barge in during this pause
//
// solution: multi-signal end of turn detection
// 1. silence threshold (how long they've been quiet)
// 2. filler word detection ("uhh", "umm" = still thinking, not done)
// 3. screen share activity (if sharing, pause is likely setup, not end of turn)
// 4. sentence completeness (did the sentence end with a period/question mark?)
// 5. speaking rate change (sudden drop after fast speech = might be done)

// ============================================================================
// end of turn detection
// ============================================================================

export interface TurnSignal {
  silenceMs: number;          // milliseconds of silence since last speech
  hasFiller: boolean;         // detected filler words ("uhh", "umm", "so", "like")
  isScreenSharing: boolean;   // is the current speaker sharing their screen
  sentenceComplete: boolean;  // did the last sentence end with terminal punctuation
  speakingRate: number;       // words per minute (recent average)
  rateDropPct: number;        // how much the rate dropped recently
  cursorActivity: boolean;    // is there mouse/cursor movement (screen sharing active)
  transcriptActivity: boolean; // is the transcript still flowing
}

export interface TurnDecision {
  shouldSpeak: boolean;
  confidence: number;          // 0-1
  reason: string;
  waitMs: number;             // how much longer to wait if not speaking
}

// thresholds (tunable)
const SILENCE_THRESHOLD_MS = 3000;      // 3 seconds of silence
const SILENCE_THRESHOLD_SCREEN_MS = 8000; // 8 seconds if screen sharing
const FILLER_COOLDOWN_MS = 5000;          // if filler heard recently, wait 5s more
const MIN_SENTENCE_LENGTH = 10;           // don't speak for very short utterances
const RATE_DROP_THRESHOLD = 0.4;          // 40%+ rate drop might indicate end

export function detectEndOfTurn(signal: TurnSignal): TurnDecision {
  // rule 1: if screen sharing and there's cursor activity, the pause is likely setup
  if (signal.isScreenSharing && signal.cursorActivity) {
    if (signal.silenceMs < SILENCE_THRESHOLD_SCREEN_MS) {
      return {
        shouldSpeak: false,
        confidence: 0.85,
        reason: "speaker is sharing screen and active (cursor movement), pause is likely setup, not end of turn",
        waitMs: SILENCE_THRESHOLD_SCREEN_MS - signal.silenceMs,
      };
    }
  }

  // rule 2: filler words mean they're still thinking
  if (signal.hasFiller && signal.silenceMs < FILLER_COOLDOWN_MS) {
    return {
      shouldSpeak: false,
      confidence: 0.75,
      reason: "filler words detected (uhh/umm), speaker is still formulating thoughts",
      waitMs: FILLER_COOLDOWN_MS - signal.silenceMs,
    };
  }

  // rule 3: sentence not complete (no terminal punctuation)
  if (!signal.sentenceComplete && signal.silenceMs < SILENCE_THRESHOLD_MS) {
    return {
      shouldSpeak: false,
      confidence: 0.7,
      reason: "sentence incomplete (no terminal punctuation), speaker likely mid-thought",
      waitMs: SILENCE_THRESHOLD_MS - signal.silenceMs,
    };
  }

  // rule 4: transcript still flowing (new words coming in)
  if (signal.transcriptActivity) {
    return {
      shouldSpeak: false,
      confidence: 0.9,
      reason: "transcript still active, speaker is still talking",
      waitMs: 2000,
    };
  }

  // rule 5: check silence against threshold
  const threshold = signal.isScreenSharing
    ? SILENCE_THRESHOLD_SCREEN_MS
    : SILENCE_THRESHOLD_MS;

  if (signal.silenceMs < threshold) {
    return {
      shouldSpeak: false,
      confidence: 0.6,
      reason: `silence (${signal.silenceMs}ms) below threshold (${threshold}ms)`,
      waitMs: threshold - signal.silenceMs,
    };
  }

  // rule 6: rate drop check - if speech rate suddenly dropped, might be wrapping up
  if (signal.rateDropPct > RATE_DROP_THRESHOLD && signal.silenceMs > SILENCE_THRESHOLD_MS / 2) {
    // they were talking fast then slowed down and went quiet - likely done
    return {
      shouldSpeak: true,
      confidence: 0.8,
      reason: `speaking rate dropped ${signal.rateDropPct * 100}% and silence exceeded threshold, speaker likely done`,
      waitMs: 0,
    };
  }

  // all signals point to end of turn
  // silence exceeded threshold, no fillers, sentence complete, no transcript activity
  const confidence = signal.isScreenSharing ? 0.65 : 0.85;
  return {
    shouldSpeak: true,
    confidence,
    reason: signal.isScreenSharing
      ? "silence exceeded screen-sharing threshold despite screen activity"
      : "all end-of-turn signals met: silence threshold, no fillers, sentence complete, no transcript activity",
    waitMs: 0,
  };
}

// ============================================================================
// context window management with mem0
// ============================================================================

export interface ConversationContext {
  meeting_id: string;
  turn_history: TurnRecord[];
  pending_questions: PendingQuestion[];
  resolved_questions: ResolvedQuestion[];
  key_facts: Record<string, string>; // facts stored in mem0
}

export interface TurnRecord {
  speaker: string;
  text: string;
  timestamp: string;
  isPrixie: boolean;
  type: "statement" | "question" | "answer" | "clarification";
}

export interface PendingQuestion {
  id: string;
  question: string;
  capture_request_id: string;
  status: "waiting" | "asked" | "answered" | "unanswered" | "clarifying";
  asked_at?: string;
  answer?: string;
  answer_confidence: number; // 0-1
  needs_clarification: boolean;
}

export interface ResolvedQuestion {
  question: string;
  answer: string;
  resolved_at: string;
  confidence: number;
}

// mem0 integration (open source memory layer)
// mem0 stores facts across conversation turns and retrieves them when needed
// this prevents the context window from filling up with full transcript history
// instead, we store compressed facts and retrieve only relevant ones

export class Mem0Context {
  private mem0ApiKey: string;
  private mem0BaseUrl: string;
  private userId: string;
  private meetingId: string;

  constructor(meetingId: string, userId: string = "prixie") {
    this.mem0ApiKey = Deno.env.get("MEM0_API_KEY") || "";
    this.mem0BaseUrl = Deno.env.get("MEM0_BASE_URL") || "https://api.mem0.ai/v1";
    this.userId = userId;
    this.meetingId = meetingId;
  }

  // store a fact from the conversation
  async remember(content: string, metadata?: Record<string, any>): Promise<void> {
    if (!this.mem0ApiKey) {
      console.warn("mem0: no api key, skipping memory storage");
      return;
    }

    try {
      await fetch(`${this.mem0BaseUrl}/memories/`, {
        method: "POST",
        headers: {
          "Authorization": `Token ${this.mem0ApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messages: [{ role: "user", content }],
          user_id: this.userId,
          metadata: {
            meeting_id: this.meetingId,
            ...metadata,
          },
        }),
      });
    } catch (err) {
      console.warn("mem0: failed to store memory:", err);
    }
  }

  // retrieve relevant facts for a question
  async recall(query: string): Promise<string[]> {
    if (!this.mem0ApiKey) return [];

    try {
      const res = await fetch(`${this.mem0BaseUrl}/memories/?user_id=${this.userId}&q=${encodeURIComponent(query)}`, {
        headers: { "Authorization": `Token ${this.mem0ApiKey}` },
      });

      if (!res.ok) return [];

      const data = await res.json();
      return (data.memories || data.results || []).map((m: any) => m.memory || m.text || "");
    } catch {
      return [];
    }
  }

  // get all memories for this meeting
  async getAllMemories(): Promise<string[]> {
    if (!this.mem0ApiKey) return [];

    try {
      const res = await fetch(`${this.mem0BaseUrl}/memories/?user_id=${this.userId}`, {
        headers: { "Authorization": `Token ${this.mem0ApiKey}` },
      });

      if (!res.ok) return [];

      const data = await res.json();
      return (data.memories || data.results || []).map((m: any) => m.memory || m.text || "");
    } catch {
      return [];
    }
  }
}

// clarification fork: when an answer is unclear, decide whether to
// ask a follow-up or accept the answer as-is
export function shouldClarify(
  answer: string,
  question: string,
  keywords: string[],
  confidence: number,
  context: ConversationContext
): { clarify: boolean; reason: string; followUp?: string } {
  // confidence already high - no need to clarify
  if (confidence >= 0.85) {
    return { clarify: false, reason: "answer confidence is high" };
  }

  // check if answer contains any of the expected keywords
  const answerLower = answer.toLowerCase();
  const hasKeyword = keywords.some(k => answerLower.includes(k.toLowerCase()));

  if (hasKeyword && confidence >= 0.6) {
    return { clarify: false, reason: "answer contains expected keywords and confidence is moderate" };
  }

  // answer is too short or vague
  if (answer.trim().length < 10) {
    return {
      clarify: true,
      reason: "answer too short, likely incomplete",
      followUp: `Could you elaborate on that? I specifically wanted to know about: ${question}`,
    };
  }

  // answer contains hedging language
  const hedging = ["maybe", "i think", "probably", "not sure", "i guess", "might be", "possibly"];
  if (hedging.some(h => answerLower.includes(h)) && confidence < 0.7) {
    return {
      clarify: true,
      reason: "answer contains hedging language with low confidence",
      followUp: `Just to confirm - when you said "${answer.substring(0, 100)}", is that the final answer?`,
    };
  }

  // already asked too many clarifications (max 2 per question)
  const clarificationCount = context.turn_history.filter(
    t => t.type === "clarification"
  ).length;

  if (clarificationCount >= 2) {
    return { clarify: false, reason: "max clarifications reached, accepting best answer" };
  }

  // default: don't clarify if confidence is moderate
  if (confidence >= 0.6) {
    return { clarify: false, reason: "moderate confidence, accepting answer" };
  }

  return {
    clarify: true,
    reason: "low confidence answer with no keyword match",
    followUp: `I didn't quite catch that. To clarify: ${question}`,
  };
}

// ============================================================================
// interruption handling
// ============================================================================

export type InterruptionReason =
  | "user_speaking"        // someone started talking while prixie was speaking
  | "question_asked"       // someone asked prixie a direct question
  | "organizer_speaking"   // the organizer started speaking (priority)
  | "timeout"              // prixie has been speaking too long
  | "silence"              // no one is talking, no need to continue
  | "answered"             // the answer was received, stop talking
  | "barge_back";          // someone is explicitly interrupting prixie

export interface InterruptionEvent {
  reason: InterruptionReason;
  speaker?: string;
  transcriptChunk?: string;
  isPrixieSpeaking: boolean;
  prixieSpeechProgress: number; // 0-1, how far through prixie's speech
  timestamp: string;
}

export function handleInterruption(event: InterruptionEvent): {
  action: "stop" | "pause" | "continue" | "yield" | "restart";
  reason: string;
} {
  // someone asked prixie a direct question - yield immediately
  if (event.reason === "question_asked") {
    return {
      action: "stop",
      reason: "direct question asked, yielding to speaker",
    };
  }

  // organizer speaking - always yield to organizer
  if (event.reason === "organizer_speaking") {
    return {
      action: "stop",
      reason: "organizer started speaking, yielding",
    };
  }

  // someone is barging back (explicitly interrupting)
  if (event.reason === "barge_back") {
    return {
      action: "stop",
      reason: "speaker is explicitly interrupting, backing off",
    };
  }

  // someone started talking while prixie is speaking
  if (event.reason === "user_speaking" && event.isPrixieSpeaking) {
    // if prixie is almost done (90%+), finish the sentence
    if (event.prixieSpeechProgress >= 0.9) {
      return {
        action: "continue",
        reason: "prixie is 90%+ through speech, finishing",
      };
    }

    // if prixie is less than 30% through, restart later
    if (event.prixieSpeechProgress < 0.3) {
      return {
        action: "restart",
        reason: "barely started speaking, will restart after they finish",
      };
    }

    // in the middle - pause and yield
    return {
      action: "pause",
      reason: "mid-speech interruption, pausing to let speaker finish",
    };
  }

  // prixie has been speaking too long (time cap)
  if (event.reason === "timeout") {
    return {
      action: "stop",
      reason: "speech timeout reached, stopping",
    };
  }

  // answer received - stop talking
  if (event.reason === "answered") {
    return {
      action: "stop",
      reason: "answer received, no need to continue speaking",
    };
  }

  // no one talking and no response needed
  if (event.reason === "silence") {
    return {
      action: "stop",
      reason: "silence detected, no need to continue",
    };
  }

  // default: continue speaking
  return {
    action: "continue",
    reason: "no interruption signal, continuing",
  };
}

// ============================================================================
// voice session state machine
// ============================================================================

export type VoiceState =
  | "idle"           // not speaking, listening
  | "listening"      // actively processing transcript
  | "waiting_turn"   // waiting for end of turn to speak
  | "speaking"       // prixie is speaking (asking a question)
  | "paused"         // paused mid-speech due to interruption
  | "clarifying"     // asking a follow-up clarification
  | "processing"     // processing an answer
  | "done";          // all questions resolved

export interface VoiceSession {
  meeting_id: string;
  state: VoiceState;
  current_question?: PendingQuestion;
  current_speech?: string;
  speech_progress: number;
  last_speech_timestamp: string;
  interruption_count: number;
  context: ConversationContext;
  mem0: Mem0Context;
}

export function createVoiceSession(meetingId: string): VoiceSession {
  return {
    meeting_id: meetingId,
    state: "idle",
    speech_progress: 0,
    last_speech_timestamp: new Date().toISOString(),
    interruption_count: 0,
    context: {
      meeting_id: meetingId,
      turn_history: [],
      pending_questions: [],
      resolved_questions: [],
      key_facts: {},
    },
    mem0: new Mem0Context(meetingId),
  };
}

// state transition logic
export function transitionVoiceState(
  session: VoiceSession,
  event: "start_listening" | "turn_ended" | "start_speaking" | "interrupted" |
         "speech_done" | "answer_received" | "clarify_needed" | "all_done"
): VoiceState {
  switch (session.state) {
    case "idle":
      if (event === "start_listening") return "listening";
      break;

    case "listening":
      if (event === "turn_ended" && session.context.pending_questions.length > 0) {
        return "waiting_turn";
      }
      if (event === "all_done") return "done";
      break;

    case "waiting_turn":
      if (event === "start_speaking") return "speaking";
      break;

    case "speaking":
      if (event === "interrupted") return "paused";
      if (event === "speech_done") return "processing";
      break;

    case "paused":
      if (event === "start_speaking") return "speaking";
      if (event === "speech_done") return "processing";
      break;

    case "processing":
      if (event === "clarify_needed") return "clarifying";
      if (event === "answer_received") return "listening";
      break;

    case "clarifying":
      if (event === "speech_done") return "processing";
      break;

    case "done":
      return "done";
  }

  return session.state;
}

// ============================================================================
// filler word detection
// ============================================================================

const FILLER_WORDS = [
  "uh", "uhh", "uhm", "umm", "um", "err", "ahh", "ah",
  "like", "you know", "so basically", "let me", "hold on",
  "wait", "one sec", "give me a", "just", "alright so",
  "okay so", "lemme", "let's see", "hmm", "hmmm",
];

export function detectFiller(transcriptChunk: string): boolean {
  const lower = transcriptChunk.toLowerCase().trim();
  // check if the chunk is ONLY a filler (not embedded in a longer sentence)
  if (lower.length < 20) {
    return FILLER_WORDS.some(filler => lower === filler || lower.startsWith(filler + " ") || lower === filler);
  }
  // check if the recent speech ends with a filler (trailing off)
  const lastWords = lower.split(" ").slice(-3).join(" ");
  return FILLER_WORDS.some(filler => lastWords.includes(filler));
}

// detect if speaker is in "setup mode" (presenting, configuring, switching slides)
export function detectSetupMode(transcriptChunk: string, isScreenSharing: boolean): boolean {
  const lower = transcriptChunk.toLowerCase();
  const setupPhrases = [
    "let me share", "let me just", "give me a second", "one moment",
    "let me pull up", "let me find", "where is", "let me switch",
    "hold on let me", "just need to", "let me open",
    "can everyone see", "is my screen visible", "let me get to",
  ];
  return isScreenSharing && setupPhrases.some(p => lower.includes(p));
}

// ============================================================================
// speech rate tracking
// ============================================================================

export class SpeechRateTracker {
  private words: Array<{ word: string; timestamp: number }> = [];
  private windowMs: number;

  constructor(windowMs = 30000) {
    this.windowMs = windowMs; // track last 30 seconds
  }

  addWord(word: string): void {
    this.words.push({ word, timestamp: Date.now() });
    // trim old words
    const cutoff = Date.now() - this.windowMs;
    this.words = this.words.filter(w => w.timestamp >= cutoff);
  }

  getRate(): number {
    if (this.words.length < 2) return 0;
    const durationMs = this.windowMs;
    const wordCount = this.words.length;
    return (wordCount / durationMs) * 60000; // words per minute
  }

  getRateDrop(): number {
    if (this.words.length < 4) return 0;

    // compare recent rate (last 5s) to overall rate
    const now = Date.now();
    const recent = this.words.filter(w => w.timestamp >= now - 5000);
    const recentRate = recent.length / 5000 * 60000;
    const overallRate = this.getRate();

    if (overallRate === 0) return 0;
    return Math.max(0, (overallRate - recentRate) / overallRate);
  }

  reset(): void {
    this.words = [];
  }
}
