import { Hono } from "hono";
import {
  getMeetingByBotId,
  getPendingCaptureRequestsByMeeting,
  updateCaptureRequest,
} from "../../services/supabase.ts";

const recallRealtimeWebhook = new Hono();

/**
 * POST /webhooks/recall/realtime
 * Receives real-time transcript segments & chat messages from Recall.ai during live meetings
 */
recallRealtimeWebhook.post("/", async (c) => {
  try {
    const payload = await c.req.json();
    const eventType = payload.event;
    const eventData = payload.data || {};
    const botId = eventData.bot_id || payload.bot_id;

    console.log(`prixie: realtime webhook received event "${eventType}" for bot ${botId || "unknown"}`);

    if (!botId) {
      return c.json({ status: "acknowledged", note: "no bot_id in event" });
    }

    const meeting = await getMeetingByBotId(botId);
    if (!meeting) {
      console.warn(`prixie: no meeting found for bot_id ${botId}`);
      return c.json({ status: "acknowledged", note: "meeting not found" });
    }

    const pendingCaptures = await getPendingCaptureRequestsByMeeting(meeting.id);
    if (pendingCaptures.length === 0) {
      return c.json({ status: "acknowledged", note: "no pending capture requests" });
    }

    // 1. Process Transcript Events
    if (eventType === "transcript.data" || eventType === "transcript.partial_data") {
      const segment = eventData.transcript_data || eventData.data || eventData;
      const speaker = segment.participant?.name || "speaker";
      const words = segment.words || [];
      const spokenText = words.map((w: any) => w.text).join(" ").trim();

      if (spokenText) {
        const lowerText = spokenText.toLowerCase();

        for (const req of pendingCaptures) {
          let matched = false;

          // Check keywords
          if (req.keywords && req.keywords.length > 0) {
            for (const kw of req.keywords) {
              if (kw && lowerText.includes(kw.toLowerCase())) {
                matched = true;
                break;
              }
            }
          }

          // Check question if type is 'ask'
          if (!matched && req.type === "ask" && req.question) {
            const questionWords = req.question.toLowerCase().split(/\s+/).filter((w) => w.length > 3);
            const matches = questionWords.filter((qw) => lowerText.includes(kw));
            if (matches.length >= Math.min(2, questionWords.length)) {
              matched = true;
            }
          }

          if (matched) {
            console.log(`prixie: keyword matched for capture request "${req.title}" in meeting ${meeting.id}`);
            const captureSnippet = `${speaker}: ${spokenText}`;

            await updateCaptureRequest(req.id, {
              status: req.type === "ask" ? "answered" : "captured",
              captured_content: req.captured_content
                ? `${req.captured_content}\n${captureSnippet}`
                : captureSnippet,
              answer: req.type === "ask" ? spokenText : req.answer,
            });
          }
        }
      }
    }

    // 2. Process Chat Message Events
    if (eventType === "participant_events.chat_message") {
      const chatData = eventData.data || eventData;
      const chatParticipant = chatData.participant?.name || "participant";
      const chatText = chatData.data?.text || chatData.text || "";

      if (chatText) {
        console.log(`prixie: chat message from ${chatParticipant}: "${chatText}"`);

        // Extract links in chat
        const urlRegex = /(https?:\/\/[^\s"'<>]+)/gi;
        const links = chatText.match(urlRegex) || [];

        for (const req of pendingCaptures) {
          if (!req.check_chat) continue;

          let matched = links.length > 0;
          if (!matched && req.keywords) {
            const lowerChat = chatText.toLowerCase();
            matched = req.keywords.some((kw) => kw && lowerChat.includes(kw.toLowerCase()));
          }

          if (matched) {
            const existingLinks = req.captured_chat_links || [];
            const newLinks = Array.from(new Set([...existingLinks, ...links]));

            const chatSnippet = `[chat] ${chatParticipant}: ${chatText}`;

            await updateCaptureRequest(req.id, {
              status: "captured",
              captured_chat_links: newLinks,
              captured_content: req.captured_content
                ? `${req.captured_content}\n${chatSnippet}`
                : chatSnippet,
            });
          }
        }
      }
    }

    return c.json({ status: "success", event: eventType });
  } catch (err: any) {
    console.error("prixie: error processing realtime recall webhook", err);
    return c.json({ error: err.message || "webhook processing failed" }, 500);
  }
});

export default recallRealtimeWebhook;
