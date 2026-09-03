import { Hono } from "hono";
import {
  createMeeting,
  listMeetings,
  getMeetingById,
  updateMeeting,
  deleteMeeting,
  getCaptureRequestsByMeeting,
  getTranscriptByMeetingId,
} from "../services/supabase.ts";
import { MeetingStatus } from "../types.ts";

const meetingsRouter = new Hono();

/**
 * POST /api/meetings
 * Create a new meeting for prixie to attend or monitor
 */
meetingsRouter.post("/", async (c) => {
  try {
    const body = await c.req.json();

    if (!body.title || !body.join_url || !body.start_time) {
      return c.json(
        { error: "missing required fields: title, join_url, and start_time are required" },
        400
      );
    }

    const meeting = await createMeeting({
      title: body.title,
      platform: body.platform,
      join_url: body.join_url,
      start_time: body.start_time,
      end_time: body.end_time,
      instruction: body.instruction,
      join_delay_minutes: body.join_delay_minutes !== undefined ? Number(body.join_delay_minutes) : 2,
      attendance_method: body.attendance_method || "none",
      attendance_form_url: body.attendance_form_url,
      zoom_user_email: body.zoom_user_email,
      voice_override: body.voice_override,
      localization: body.localization,
    });

    return c.json(
      {
        message: "meeting scheduled for prixie",
        meeting,
      },
      201
    );
  } catch (err: any) {
    console.error("prixie: error creating meeting", err);
    return c.json({ error: err.message || "failed to create meeting" }, 500);
  }
});

/**
 * GET /api/meetings
 * List all meetings with optional status filter
 */
meetingsRouter.get("/", async (c) => {
  try {
    const statusParam = c.req.query("status") as MeetingStatus | undefined;
    const meetings = await listMeetings(statusParam);

    return c.json({
      message: "meetings retrieved",
      count: meetings.length,
      meetings,
    });
  } catch (err: any) {
    console.error("prixie: error listing meetings", err);
    return c.json({ error: err.message || "failed to list meetings" }, 500);
  }
});

/**
 * GET /api/meetings/:id
 * Get details for a specific meeting, including capture requests and transcript
 */
meetingsRouter.get("/:id", async (c) => {
  try {
    const id = c.req.param("id");
    const meeting = await getMeetingById(id);

    if (!meeting) {
      return c.json({ error: "meeting not found" }, 404);
    }

    const captureRequests = await getCaptureRequestsByMeeting(id);
    const transcript = await getTranscriptByMeetingId(id);

    return c.json({
      meeting,
      capture_requests: captureRequests,
      transcript: transcript || null,
    });
  } catch (err: any) {
    console.error(`prixie: error getting meeting ${c.req.param("id")}`, err);
    return c.json({ error: err.message || "failed to retrieve meeting" }, 500);
  }
});

/**
 * PATCH /api/meetings/:id or PUT /api/meetings/:id
 * Update meeting configuration
 */
const handleUpdate = async (c: any) => {
  try {
    const id = c.req.param("id");
    const body = await c.req.json();

    const existing = await getMeetingById(id);
    if (!existing) {
      return c.json({ error: "meeting not found" }, 404);
    }

    const updated = await updateMeeting(id, body);
    return c.json({
      message: "meeting updated",
      meeting: updated,
    });
  } catch (err: any) {
    console.error(`prixie: error updating meeting ${c.req.param("id")}`, err);
    return c.json({ error: err.message || "failed to update meeting" }, 500);
  }
};

meetingsRouter.patch("/:id", handleUpdate);
meetingsRouter.put("/:id", handleUpdate);

/**
 * DELETE /api/meetings/:id
 * Delete a meeting
 */
meetingsRouter.delete("/:id", async (c) => {
  try {
    const id = c.req.param("id");
    const existing = await getMeetingById(id);

    if (!existing) {
      return c.json({ error: "meeting not found" }, 404);
    }

    const success = await deleteMeeting(id);
    if (!success) {
      return c.json({ error: "failed to delete meeting" }, 500);
    }

    return c.json({ message: "meeting deleted successfully" });
  } catch (err: any) {
    console.error(`prixie: error deleting meeting ${c.req.param("id")}`, err);
    return c.json({ error: err.message || "failed to delete meeting" }, 500);
  }
});

export default meetingsRouter;
