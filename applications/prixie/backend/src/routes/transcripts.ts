import { Hono } from "hono";
import { getTranscriptByMeetingId, getMeetingById } from "../services/supabase.ts";
import { recallService } from "../services/recall.ts";

const transcriptsRouter = new Hono();

/**
 * GET /api/transcripts/:meetingId
 * Get transcript, summary, and action items for a given meeting
 */
transcriptsRouter.get("/:meetingId", async (c) => {
  try {
    const meetingId = c.req.param("meetingId");

    const meeting = await getMeetingById(meetingId);
    if (!meeting) {
      return c.json({ error: "meeting not found" }, 404);
    }

    let transcript = await getTranscriptByMeetingId(meetingId);

    // If not in database yet but bot_id exists, attempt direct fetch from Recall
    if (!transcript && meeting.bot_id) {
      try {
        const rawText = await recallService.getBotTranscript(meeting.bot_id);
        if (rawText && rawText !== "no transcript recorded") {
          return c.json({
            message: "transcript fetched directly from recall.ai",
            meeting_id: meetingId,
            bot_id: meeting.bot_id,
            transcript: {
              meeting_id: meetingId,
              full_transcript: rawText,
              summary: "processing summary...",
              action_items: [],
              captured_items: {},
            },
          });
        }
      } catch (err: any) {
        console.warn(`prixie: live recall transcript fetch failed for bot ${meeting.bot_id}`, err);
      }
    }

    if (!transcript) {
      return c.json(
        {
          message: "no transcript recorded yet for this meeting",
          meeting_id: meetingId,
          meeting_status: meeting.status,
          transcript: null,
        },
        404
      );
    }

    return c.json({
      message: "transcript retrieved",
      meeting_id: meetingId,
      transcript,
    });
  } catch (err: any) {
    console.error(`prixie: error fetching transcript for meeting ${c.req.param("meetingId")}`, err);
    return c.json({ error: err.message || "failed to retrieve transcript" }, 500);
  }
});

export default transcriptsRouter;
