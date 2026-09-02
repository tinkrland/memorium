import { Hono } from "hono";
import { createClient } from "npm:@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

const app = new Hono();

app.get("/", async (c) => {
  const { count: meetingsCount, error: mErr } = await supabase
    .from("meetings")
    .select("*", { count: "exact", head: true })
    .eq("prixie_attended", true);

  const { count: capturesCount, error: cErr } = await supabase
    .from("capture_requests")
    .select("*", { count: "exact", head: true })
    .eq("status", "captured");

  const { count: transcriptsCount, error: tErr } = await supabase
    .from("transcripts")
    .select("*", { count: "exact", head: true });

  return c.json({
    meetings_attended: meetingsCount || 0,
    items_captured: capturesCount || 0,
    total_transcripts: transcriptsCount || 0,
  });
});

export default app;
