import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verify admin session via OTP token in header
    const authHeader = req.headers.get("x-admin-token");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify the admin token matches a valid recent session
    const { data: validSession } = await supabase
      .from("admin_otp")
      .select("id")
      .eq("email", "ayofolaposy@gmail.com")
      .eq("used", true)
      .order("created_at", { ascending: false })
      .limit(1);

    if (!validSession || validSession.length === 0) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { entries, latestYear } = await req.json();

    if (!entries || !Array.isArray(entries) || entries.length === 0) {
      return new Response(JSON.stringify({ error: "No entries provided" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Importing ${entries.length} JUFO entries...`);

    // Clear existing entries
    await supabase.from("jufo_entries").delete().neq("id", "00000000-0000-0000-0000-000000000000");

    // Insert in batches of 500
    const BATCH_SIZE = 500;
    let insertedCount = 0;

    for (let i = 0; i < entries.length; i += BATCH_SIZE) {
      const batch = entries.slice(i, i + BATCH_SIZE).map((entry: any) => ({
        name: entry.name || "",
        issn: entry.issn || "",
        level: entry.level ?? 0,
        norwegian_level: entry.norwegianLevel ?? null,
        publisher: entry.publisher || "",
        type: entry.type || "journal",
        year: entry.year ?? null,
        evaluated: entry.evaluated ?? false,
      }));

      const { error } = await supabase.from("jufo_entries").insert(batch);
      if (error) {
        console.error(`Batch insert error at ${i}:`, error.message);
        return new Response(JSON.stringify({ error: `Import failed at batch ${i}: ${error.message}` }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      insertedCount += batch.length;
    }

    // Update metadata
    const { data: existingMeta } = await supabase.from("jufo_metadata").select("id").limit(1);

    const metadataPayload = {
      latest_year: latestYear || new Date().getFullYear(),
      entry_count: insertedCount,
      updated_at: new Date().toISOString(),
      version: Date.now(),
    };

    if (existingMeta && existingMeta.length > 0) {
      await supabase.from("jufo_metadata").update(metadataPayload).eq("id", existingMeta[0].id);
    } else {
      await supabase.from("jufo_metadata").insert(metadataPayload);
    }

    console.log(`Successfully imported ${insertedCount} entries`);

    return new Response(JSON.stringify({ success: true, count: insertedCount }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Import error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
