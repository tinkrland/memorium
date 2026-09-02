import { Hono } from "hono";
import { createClient } from "npm:@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

const app = new Hono();

// list profiles
app.get("/", async (c) => {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .order("created_at", { ascending: true });
  if (error) return c.json({ error: error.message }, 500);
  return c.json(data || []);
});

// get single profile
app.get("/:id", async (c) => {
  const id = c.req.param("id");
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", id)
    .single();
  if (error) return c.json({ error: error.message }, 500);
  return c.json(data);
});

// create profile
app.post("/", async (c) => {
  const body = await c.req.json();
  const { data, error } = await supabase
    .from("profiles")
    .insert({
      name: body.name,
      display_name: body.display_name || body.name,
      email: body.email,
      context: body.context,
      shared_memory: body.shared_memory ?? true,
      is_default: false,
    })
    .select()
    .single();
  if (error) return c.json({ error: error.message }, 500);
  return c.json(data);
});

// update profile
app.patch("/:id", async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json();
  const { data, error } = await supabase
    .from("profiles")
    .update(body)
    .eq("id", id)
    .select()
    .single();
  if (error) return c.json({ error: error.message }, 500);
  return c.json(data);
});

// delete profile
app.delete("/:id", async (c) => {
  const id = c.req.param("id");
  const { error } = await supabase
    .from("profiles")
    .delete()
    .eq("id", id);
  if (error) return c.json({ error: error.message }, 500);
  return c.json({ status: "deleted" });
});

export default app;
