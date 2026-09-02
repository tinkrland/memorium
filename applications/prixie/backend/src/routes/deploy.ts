import { Hono } from "hono";
import { getMeetingById, updateMeeting } from "../services/supabase.ts";
import { recallService } from "../services/recall.ts";

const deployRouter = new Hono();

/**
 * POST /api/deploy/:meetingId
 * Manually deploy prixie (Recall.ai bot) to a specific meeting
 */
deployRouter.post("/:meetingId", async (c) => {
  try {
    const meetingId = c.req.param("meetingId");

    const meeting = await getMeetingById(meetingId);
    if (!meeting) {
      return c.json({ error: "meeting not found" }, 404);
    }

    if (meeting.status === "bot_in_meeting" || meeting.status === "bot_joining") {
      return c.json(
        {
          message: "prixie is already deployed or joining this meeting",
          bot_id: meeting.bot_id,
          status: meeting.status,
        },
        200
      );
    }

    const baseUrl = Deno.env.get("BASE_URL") || "https://prixie.yourdomain.com";
    const realtimeWebhook = `${baseUrl}/webhooks/recall/realtime`;
    const statusWebhook = `${baseUrl}/webhooks/recall/status`;

    // Deploy bot via Recall.ai
    const botData = await recallService.createBot(meeting, realtimeWebhook, statusWebhook);

    // Update meeting status in Supabase
    const updatedMeeting = await updateMeeting(meetingId, {
      bot_id: botData.id,
      status: "bot_joining",
    });

    return c.json({
      message: "prixie deployed to meeting successfully",
      bot_id: botData.id,
      meeting: updatedMeeting,
      recall_bot_details: botData,
    });
  } catch (err: any) {
    console.error(`prixie: deployment error for meeting ${c.req.param("meetingId")}`, err);
    return c.json({ error: err.message || "failed to deploy prixie to meeting" }, 500);
  }
});

export default deployRouter;
