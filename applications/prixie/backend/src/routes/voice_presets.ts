import { Hono } from "hono";
import { createClient } from "npm:@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

const app = new Hono();

// list voice presets
app.get("/", async (c) => {
  const { data, error } = await supabase
    .from("voice_presets")
    .select("*")
    .order("is_builtin", { ascending: false })
    .order("name", { ascending: true });
  if (error) return c.json({ error: error.message }, 500);
  return c.json(data || []);
});

// get single preset
app.get("/:id", async (c) => {
  const id = c.req.param("id");
  const { data, error } = await supabase
    .from("voice_presets")
    .select("*")
    .eq("id", id)
    .single();
  if (error) return c.json({ error: error.message }, 500);
  return c.json(data);
});

// create custom preset (user-created)
app.post("/", async (c) => {
  const body = await c.req.json();
  const { data, error } = await supabase
    .from("voice_presets")
    .insert({
      name: body.name,
      description: body.description,
      fist_score: body.fist_score ?? 0.7,
      fist_timing_variation: body.fist_timing_variation ?? 0.35,
      fist_rhythm_stability: body.fist_rhythm_stability ?? 0.72,
      fist_pause_pattern: body.fist_pause_pattern || "deliberate",
      fist_startup_pattern: body.fist_startup_pattern || "brief_pause",
      fist_turn_entry_pattern: body.fist_turn_entry_pattern || "beat",
      cadence_wpm: body.cadence_wpm ?? 140,
      prosody: body.prosody ?? 0.4,
      seriousness: body.seriousness ?? 0.7,
      professionalism: body.professionalism ?? 0.5,
      vocabulary: body.vocabulary ?? 0.5,
      tone: body.tone || "neutral",
      is_builtin: false,
    })
    .select()
    .single();
  if (error) return c.json({ error: error.message }, 500);
  return c.json(data);
});

// update custom preset (only if not builtin)
app.patch("/:id", async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json();

  // check if builtin
  const { data: existing } = await supabase
    .from("voice_presets")
    .select("is_builtin")
    .eq("id", id)
    .single();
  if (existing?.is_builtin) return c.json({ error: "cannot modify builtin preset" }, 403);

  const { data, error } = await supabase
    .from("voice_presets")
    .update(body)
    .eq("id", id)
    .select()
    .single();
  if (error) return c.json({ error: error.message }, 500);
  return c.json(data);
});

// delete custom preset (only if not builtin)
app.delete("/:id", async (c) => {
  const id = c.req.param("id");

  const { data: existing } = await supabase
    .from("voice_presets")
    .select("is_builtin")
    .eq("id", id)
    .single();
  if (existing?.is_builtin) return c.json({ error: "cannot delete builtin preset" }, 403);

  const { error } = await supabase
    .from("voice_presets")
    .delete()
    .eq("id", id);
  if (error) return c.json({ error: error.message }, 500);
  return c.json({ status: "deleted" });
});

export default app;
