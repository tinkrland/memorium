import { Hono } from "hono";
import {
  detectEndOfTurn,
  shouldClarify,
  handleInterruption,
  createVoiceSession,
  transitionVoiceState,
  detectFiller,
  detectSetupMode,
  SpeechRateTracker,
  type TurnSignal,
  type InterruptionEvent,
  type VoiceSession,
} from "../services/voice_agent.ts";

const app = new Hono();

// in-memory voice sessions (in production, use redis or database)
const sessions = new Map<string, VoiceSession>();

// POST /api/voice/session
// create a new voice session for a meeting
app.post("/session", async (c) => {
  const body = await c.req.json();
  const meetingId = body.meeting_id;

  if (!meetingId) return c.json({ error: "meeting_id required" }, 400);

  const session = createVoiceSession(meetingId);

  // load pending questions from capture requests
  if (body.questions && Array.isArray(body.questions)) {
    session.context.pending_questions = body.questions.map((q: any, i: number) => ({
      id: `q_${meetingId}_${i}`,
      question: q.question,
      capture_request_id: q.capture_request_id || "",
      status: "waiting",
      answer_confidence: 0,
      needs_clarification: false,
    }));
  }

  sessions.set(meetingId, session);
  return c.json({ session_id: meetingId, state: session.state, pending: session.context.pending_questions.length });
});

// POST /api/voice/end-of-turn
// body: { meeting_id, silence_ms, has_filler, is_screen_sharing, sentence_complete, speaking_rate, rate_drop_pct, cursor_activity, transcript_activity }
// returns: should prixie speak now?
app.post("/end-of-turn", async (c) => {
  const body = await c.req.json();
  const meetingId = body.meeting_id;

  const session = sessions.get(meetingId);
  if (!session) return c.json({ error: "no voice session found" }, 404);

  const signal: TurnSignal = {
    silenceMs: body.silence_ms || 0,
    hasFiller: body.has_filler || false,
    isScreenSharing: body.is_screen_sharing || false,
    sentenceComplete: body.sentence_complete ?? true,
    speakingRate: body.speaking_rate || 0,
    rateDropPct: body.rate_drop_pct || 0,
    cursorActivity: body.cursor_activity || false,
    transcriptActivity: body.transcript_activity ?? true,
  };

  const decision = detectEndOfTurn(signal);

  if (decision.shouldSpeak && session.state === "listening") {
    const nextQ = session.context.pending_questions.find(q => q.status === "waiting");
    if (nextQ) {
      session.state = transitionVoiceState(session, "turn_ended");
      session.state = transitionVoiceState(session, "start_speaking");
      session.current_question = nextQ;
      nextQ.status = "asked";
      nextQ.asked_at = new Date().toISOString();

      return c.json({
        ...decision,
        action: "speak",
        question: nextQ.question,
        question_id: nextQ.id,
      });
    }
  }

  return c.json({ ...decision, action: "wait" });
});

// POST /api/voice/interrupt
// body: { meeting_id, reason, speaker, transcript_chunk, is_prixie_speaking, prixie_speech_progress }
// handles interruption during prixie's speech
app.post("/interrupt", async (c) => {
  const body = await c.req.json();
  const meetingId = body.meeting_id;

  const session = sessions.get(meetingId);
  if (!session) return c.json({ error: "no voice session found" }, 404);

  const event: InterruptionEvent = {
    reason: body.reason || "user_speaking",
    speaker: body.speaker,
    transcriptChunk: body.transcript_chunk,
    isPrixieSpeaking: body.is_prixie_speaking || false,
    prixieSpeechProgress: body.prixie_speech_progress || 0,
    timestamp: new Date().toISOString(),
  };

  const result = handleInterruption(event);

  if (result.action === "stop" || result.action === "pause") {
    session.state = transitionVoiceState(session, "interrupted");
    session.interruption_count++;
  }

  return c.json(result);
});

// POST /api/voice/answer
// body: { meeting_id, question_id, answer, confidence }
// processes an answer and decides whether to clarify
app.post("/answer", async (c) => {
  const body = await c.req.json();
  const meetingId = body.meeting_id;

  const session = sessions.get(meetingId);
  if (!session) return c.json({ error: "no voice session found" }, 404);

  const question = session.context.pending_questions.find(q => q.id === body.question_id);
  if (!question) return c.json({ error: "question not found" }, 404);

  question.answer = body.answer;
  question.answer_confidence = body.confidence || 0.5;

  session.state = transitionVoiceState(session, "speech_done");

  // check if clarification is needed
  const clarifyResult = shouldClarify(
    body.answer,
    question.question,
    body.keywords || [],
    body.confidence || 0.5,
    session.context
  );

  if (clarifyResult.clarify && clarifyResult.followUp) {
    question.status = "clarifying";
    question.needs_clarification = true;
    session.state = transitionVoiceState(session, "clarify_needed");

    return c.json({
      action: "clarify",
      follow_up: clarifyResult.followUp,
      reason: clarifyResult.reason,
    });
  }

  // answer accepted
  question.status = "answered";
  session.state = transitionVoiceState(session, "answer_received");
  session.context.resolved_questions.push({
    question: question.question,
    answer: question.answer,
    resolved_at: new Date().toISOString(),
    confidence: question.answer_confidence,
  });

  // store in mem0
  await session.mem0.remember(
    `Q: ${question.question} A: ${question.answer}`,
    { type: "qa", confidence: question.answer_confidence }
  );

  // check if all questions resolved
  const remaining = session.context.pending_questions.filter(q => q.status === "waiting");
  if (remaining.length === 0) {
    session.state = transitionVoiceState(session, "all_done");
  } else {
    session.state = "listening";
  }

  return c.json({
    action: "accepted",
    answer: question.answer,
    confidence: question.answer_confidence,
    remaining_questions: remaining.length,
    state: session.state,
  });
});

// POST /api/voice/speech-progress
// body: { meeting_id, progress: 0.5 }
// updates prixie's speech progress (for interruption handling)
app.post("/speech-progress", async (c) => {
  const body = await c.req.json();
  const meetingId = body.meeting_id;

  const session = sessions.get(meetingId);
  if (!session) return c.json({ error: "no voice session found" }, 404);

  session.speech_progress = body.progress || 0;

  if (body.progress >= 1.0) {
    session.state = transitionVoiceState(session, "speech_done");
  }

  return c.json({ progress: session.speech_progress, state: session.state });
});

// GET /api/voice/session/:meetingId
app.get("/session/:meetingId", async (c) => {
  const meetingId = c.req.param("meetingId");
  const session = sessions.get(meetingId);

  if (!session) return c.json({ error: "no session found" }, 404);

  return c.json({
    state: session.state,
    pending: session.context.pending_questions.length,
    resolved: session.context.resolved_questions.length,
    interruptions: session.interruption_count,
    current_question: session.current_question,
  });
});

// POST /api/voice/analyze-chunk
// body: { chunk: "uhh let me just...", is_screen_sharing: true }
// analyzes a transcript chunk for filler words and setup mode
app.post("/analyze-chunk", async (c) => {
  const body = await c.req.json();

  return c.json({
    has_filler: detectFiller(body.chunk || ""),
    in_setup_mode: detectSetupMode(body.chunk || "", body.is_screen_sharing || false),
  });
});

export default app;
