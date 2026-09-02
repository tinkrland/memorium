import { Hono } from "hono";
import {
  createCaptureRequest,
  getCaptureRequestById,
  getCaptureRequestsByMeeting,
  listCaptureRequests,
  updateCaptureRequest,
  deleteCaptureRequest,
  getMeetingById,
} from "../services/supabase.ts";

const captureRouter = new Hono();

/**
 * POST /api/capture or POST /api/meetings/:meetingId/capture
 * Create a new capture request (watch keywords, record chat links, ask questions)
 */
captureRouter.post("/", async (c) => {
  try {
    const body = await c.req.json();

    const meetingId = body.meeting_id || body.meetingId;
    if (!meetingId) {
      return c.json({ error: "meeting_id is required" }, 400);
    }

    if (!body.title || !body.type) {
      return c.json({ error: "missing required fields: title and type ('capture' or 'ask') are required" }, 400);
    }

    const meeting = await getMeetingById(meetingId);
    if (!meeting) {
      return c.json({ error: "associated meeting not found" }, 404);
    }

    const capture = await createCaptureRequest({
      meeting_id: meetingId,
      title: body.title,
      type: body.type,
      keywords: Array.isArray(body.keywords) ? body.keywords : body.keywords ? [body.keywords] : [],
      notes: body.notes,
      question: body.question,
      screenshot_enabled: body.screenshot_enabled ?? false,
      check_chat: body.check_chat ?? true,
    });

    return c.json(
      {
        message: "capture request added for prixie",
        capture,
      },
      201
    );
  } catch (err: any) {
    console.error("prixie: error creating capture request", err);
    return c.json({ error: err.message || "failed to create capture request" }, 500);
  }
});

/**
 * GET /api/capture
 * List capture requests (optional query param meeting_id)
 */
captureRouter.get("/", async (c) => {
  try {
    const meetingId = c.req.query("meeting_id") || c.req.query("meetingId");

    let items;
    if (meetingId) {
      items = await getCaptureRequestsByMeeting(meetingId);
    } else {
      items = await listCaptureRequests();
    }

    return c.json({
      message: "capture requests retrieved",
      count: items.length,
      capture_requests: items,
    });
  } catch (err: any) {
    console.error("prixie: error listing capture requests", err);
    return c.json({ error: err.message || "failed to list capture requests" }, 500);
  }
});

/**
 * GET /api/capture/:id
 * Get specific capture request details
 */
captureRouter.get("/:id", async (c) => {
  try {
    const id = c.req.param("id");
    const item = await getCaptureRequestById(id);

    if (!item) {
      return c.json({ error: "capture request not found" }, 404);
    }

    return c.json({ capture_request: item });
  } catch (err: any) {
    console.error(`prixie: error getting capture request ${c.req.param("id")}`, err);
    return c.json({ error: err.message || "failed to retrieve capture request" }, 500);
  }
});

/**
 * PATCH /api/capture/:id
 * Update capture request
 */
captureRouter.patch("/:id", async (c) => {
  try {
    const id = c.req.param("id");
    const body = await c.req.json();

    const existing = await getCaptureRequestById(id);
    if (!existing) {
      return c.json({ error: "capture request not found" }, 404);
    }

    const updated = await updateCaptureRequest(id, body);
    return c.json({
      message: "capture request updated",
      capture_request: updated,
    });
  } catch (err: any) {
    console.error(`prixie: error updating capture request ${c.req.param("id")}`, err);
    return c.json({ error: err.message || "failed to update capture request" }, 500);
  }
});

/**
 * DELETE /api/capture/:id
 * Delete capture request
 */
captureRouter.delete("/:id", async (c) => {
  try {
    const id = c.req.param("id");
    const existing = await getCaptureRequestById(id);

    if (!existing) {
      return c.json({ error: "capture request not found" }, 404);
    }

    const success = await deleteCaptureRequest(id);
    if (!success) {
      return c.json({ error: "failed to delete capture request" }, 500);
    }

    return c.json({ message: "capture request deleted" });
  } catch (err: any) {
    console.error(`prixie: error deleting capture request ${c.req.param("id")}`, err);
    return c.json({ error: err.message || "failed to delete capture request" }, 500);
  }
});

export default captureRouter;
