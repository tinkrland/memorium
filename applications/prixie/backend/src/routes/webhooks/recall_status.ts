import { Hono } from "hono";
import {
  getMeetingByBotId,
  updateMeeting,
  createTranscript,
  createAttendanceMessage,
  getPendingCaptureRequestsByMeeting,
  updateCaptureRequest,
} from "../../services/supabase.ts";
import { recallService } from "../../services/recall.ts";

const recallStatusWebhook = new Hono();

/**
 * POST /webhooks/recall/status
 * Receives bot status change webhooks from Recall.ai
 */
recallStatusWebhook.post("/", async (c) => {
  try {
    const payload = await c.req.json();
    const eventType = payload.event;
    const botData = payload.data || {};
    const botId = botData.bot_id || payload.bot_id;

    console.log(`prixie: status webhook event "${eventType}" for bot ${botId || "unknown"}`);

    if (!botId) {
      return c.json({ status: "acknowledged", note: "missing bot_id" });
    }

    const meeting = await getMeetingByBotId(botId);
    if (!meeting) {
      console.warn(`prixie: no meeting found associated with bot_id ${botId}`);
      return c.json({ status: "acknowledged", note: "meeting not found" });
    }

    switch (eventType) {
      case "bot.joining_call":
      case "bot.in_waiting_room": {
        await updateMeeting(meeting.id, { status: "bot_joining" });
        break;
      }

      case "bot.in_call": {
        await updateMeeting(meeting.id, {
          status: "bot_in_meeting",
          prixie_attended: true,
        });

        // Trigger attendance chat message if configured and not sent yet
        if (
          meeting.attendance_method === "chat_message" &&
          !meeting.attendance_messages_sent
        ) {
          try {
            const messageText = meeting.attendance_form_url
              ? `hi! i am prixie, attending on behalf of my user. please sign attendance here: ${meeting.attendance_form_url}`
              : `hi! i am prixie, attending this meeting as a proxy agent for my user.`;

            await recallService.sendChatMessage(botId, messageText);
            await createAttendanceMessage({
              meeting_id: meeting.id,
              message_text: messageText,
              trigger: "on_join",
              sent_status: "sent",
              sent_at: new Date().toISOString(),
            });
            await updateMeeting(meeting.id, { attendance_messages_sent: true });
          } catch (err: any) {
            console.error(`prixie: failed to send attendance chat message in meeting ${meeting.id}`, err);
          }
        }
        break;
      }

      case "bot.call_ended": {
        await updateMeeting(meeting.id, { status: "completed" });
        break;
      }

      case "bot.recording_done": {
        await updateMeeting(meeting.id, { status: "completed" });

        // Retrieve full transcript from Recall
        try {
          const fullTranscriptText = await recallService.getBotTranscript(botId);

          if (fullTranscriptText && fullTranscriptText.trim().length > 0) {
            const summaryText = `meeting completed. prixie recorded a transcript of ${fullTranscriptText.split("\n").length} segments.`;

            // Simple action items extraction fallback
            const actionItems: string[] = [];
            const lines = fullTranscriptText.split("\n");
            for (const line of lines) {
              const lower = line.toLowerCase();
              if (
                lower.includes("action item") ||
                lower.includes("will do") ||
                lower.includes("follow up") ||
                lower.includes("assigned to")
              ) {
                actionItems.push(line.trim());
              }
            }

            await createTranscript({
              meeting_id: meeting.id,
              full_transcript: fullTranscriptText,
              summary: summaryText,
              action_items: actionItems,
            });

            // Mark remaining pending capture requests as not_found
            const remainingPending = await getPendingCaptureRequestsByMeeting(meeting.id);
            for (const pendingReq of remainingPending) {
              await updateCaptureRequest(pendingReq.id, { status: "not_found" });
            }

            console.log(`prixie: transcript successfully processed for meeting ${meeting.id}`);
          }
        } catch (err: any) {
          console.error(`prixie: failed to process transcript for completed bot ${botId}`, err);
        }
        break;
      }

      case "bot.fatal": {
        const errorMessage = botData.status?.message || "bot encountered a fatal error joining meeting";
        console.error(`prixie: bot ${botId} fatal error: ${errorMessage}`);
        await updateMeeting(meeting.id, { status: "failed" });
        break;
      }

      default:
        console.log(`prixie: unhandled status event "${eventType}"`);
        break;
    }

    return c.json({ status: "success", event: eventType });
  } catch (err: any) {
    console.error("prixie: error in status webhook handler", err);
    return c.json({ error: err.message || "status webhook handling failed" }, 500);
  }
});

export default recallStatusWebhook;
