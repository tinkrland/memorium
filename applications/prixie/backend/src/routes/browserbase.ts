import { Hono } from "hono";
import { createClient } from "npm:@supabase/supabase-js@2";
import { joinMeeting, stopSession, getSessionStatus, takeScreenshot } from "../services/browserbase.ts";
import { transcribeBrowserbaseSession, searchForKeywords } from "../services/browserbase_transcript.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

const app = new Hono();

// platforms that need browserbase instead of recall.ai
const BROWSERBASE_PLATFORMS = ["discord", "bluejeans", "ringcentral", "custom"];

function needsBrowserbase(platform: string): boolean {
  return BROWSERBASE_PLATFORMS.includes(platform);
}

// POST /api/browserbase/deploy/:meetingId
// deploys a browserbase session to join a meeting
app.post("/deploy/:meetingId", async (c) => {
  const meetingId = c.req.param("meetingId");

  const { data: meeting, error: mErr } = await supabase
    .from("meetings")
    .select("*")
    .eq("id", meetingId)
    .single();

  if (mErr || !meeting) {
    return c.json({ error: "meeting not found" }, 404);
  }

  if (!needsBrowserbase(meeting.platform)) {
    return c.json({ error: `platform ${meeting.platform} does not need browserbase. use recall.ai instead.` }, 400);
  }

  // get profile display name
  let profileName = "prixie";
  if (meeting.profile_id) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("display_name")
      .eq("id", meeting.profile_id)
      .single();
    if (profile?.display_name) profileName = profile.display_name;
  }

  // join the meeting
  const result = await joinMeeting(meeting.platform, meeting.join_url, profileName);

  // update meeting status
  if (result.status === "joined") {
    await supabase
      .from("meetings")
      .update({
        status: "bot_in_meeting",
        bot_id: result.session_id,
        prixie_attended: true,
      })
      .eq("id", meetingId);
  } else {
    await supabase
      .from("meetings")
      .update({ status: "failed" })
      .eq("id", meetingId);
  }

  return c.json(result);
});

// GET /api/browserbase/status/:sessionId
app.get("/status/:sessionId", async (c) => {
  const sessionId = c.req.param("sessionId");
  const status = await getSessionStatus(sessionId);
  return c.json(status);
});

// POST /api/browserbase/screenshot/:sessionId
app.post("/screenshot/:sessionId", async (c) => {
  const sessionId = c.req.param("sessionId");
  const screenshot = await takeScreenshot(sessionId);
  return c.json({ screenshot_id: screenshot });
});

// POST /api/browserbase/stop/:sessionId
app.post("/stop/:sessionId", async (c) => {
  const sessionId = c.req.param("sessionId");
  await stopSession(sessionId);
  return c.json({ status: "stopped" });
});

// POST /api/browserbase/transcribe/:meetingId
// retrieves the recording, transcribes with assembly.ai, searches for keywords
app.post("/transcribe/:meetingId", async (c) => {
  const meetingId = c.req.param("meetingId");

  const { data: meeting, error: mErr } = await supabase
    .from("meetings")
    .select("*")
    .eq("id", meetingId)
    .single();

  if (mErr || !meeting) {
    return c.json({ error: "meeting not found" }, 404);
  }

  if (!meeting.bot_id) {
    return c.json({ error: "no browserbase session found for this meeting" }, 400);
  }

  const sessionId = meeting.bot_id;

  try {
    const transcript = await transcribeBrowserbaseSession(sessionId);

    // search for keywords from capture requests
    const { data: captureRequests } = await supabase
      .from("capture_requests")
      .select("*")
      .eq("meeting_id", meetingId)
      .eq("status", "pending");

    const allMatches: any[] = [];

    if (captureRequests && captureRequests.length > 0) {
      for (const cr of captureRequests) {
        const keywords = cr.keywords || [];
        if (keywords.length === 0) continue;

        const matches = searchForKeywords(transcript, keywords);
        if (matches.length > 0) {
          allMatches.push({ capture_request_id: cr.id, title: cr.title, matches });

          // update capture request
          await supabase
            .from("capture_requests")
            .update({
              status: "captured",
              captured_content: matches.map(m => `[${m.speaker || "unknown"}] ${m.text}`).join("\n"),
            })
            .eq("id", cr.id);
        }
      }
    }

    // store transcript
    const { data: transcriptRecord } = await supabase
      .from("transcripts")
      .insert({
        meeting_id: meetingId,
        full_transcript: transcript.text,
        summary: transcript.summary,
      })
      .select()
      .single();

    // update meeting status
    await supabase
      .from("meetings")
      .update({ status: "completed" })
      .eq("id", meetingId);

    // stop the browserbase session
    await stopSession(sessionId);

    return c.json({
      transcript_id: transcriptRecord?.id,
      matches: allMatches,
      status: "completed",
    });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

export default app;
