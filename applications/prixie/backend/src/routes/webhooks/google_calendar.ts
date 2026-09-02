import { Hono } from "hono";
import { calendarService } from "../../services/calendar.ts";

const googleCalendarWebhook = new Hono();

/**
 * GET /webhooks/google-calendar
 * Handle initial verification or GET calls from Google Calendar
 */
googleCalendarWebhook.get("/", async (c) => {
  console.log("prixie: received google calendar webhooks ping (GET)");

  // Trigger background calendar sync
  calendarService.syncGoogleCalendar().catch((err) => {
    console.error("prixie: background google calendar sync error:", err);
  });

  return c.json({
    message: "prixie listening for google calendar updates",
    status: "ok",
  });
});

/**
 * POST /webhooks/google-calendar
 * Handle push notifications from Google Calendar (empty body, signals event changes)
 */
googleCalendarWebhook.post("/", async (c) => {
  console.log("prixie: received google calendar push notification (POST)");

  // Trigger re-fetch of calendar events
  calendarService.syncGoogleCalendar().catch((err) => {
    console.error("prixie: background google calendar push sync error:", err);
  });

  return c.json({
    message: "google calendar push notification processed",
    status: "ok",
  });
});

export default googleCalendarWebhook;
