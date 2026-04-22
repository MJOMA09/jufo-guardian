// AI assistant for SciFilter — chat over current paper set
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { messages, papers } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const context = (papers || []).slice(0, 30).map((p: any, i: number) =>
      `[${i + 1}] Title: ${p.title}\n   Authors: ${p.authors || "Not specified"}\n   Year: ${p.year || "Not specified"}\n   Source: ${p.source || "Not specified"}\n   DOI: ${p.doi || "Not specified"}\n   Heuristic relevance: ${p.relevance || "Not specified"}\n   Abstract: ${(p.abstract || "Not specified").slice(0, 800)}`
    ).join("\n\n");

    const systemPrompt = `You are SciFilter, an AI assistant supporting R&D professionals in analysing scientific literature.

STRICT RULES:
- Use ONLY the provided paper data (title, abstract, metadata) shown below. Do NOT invent missing information.
- If information is missing, say exactly: "Not specified".
- Be concise, structured, and decision-oriented.
- Focus on relevance, applicability, and clarity.
- Always explain WHY something is relevant.
- Always use bullet points.
- Compare papers when useful.
- Cite papers inline as [1], [2], etc., matching the numbering below.
- Use markdown formatting.

ANALYSIS FRAMEWORK (apply when the user provides a goal or asks for analysis):
- **Relevance**: rate each paper High / Medium / Low against the user's goal, with a one-line reason.
- **Key insights**: bullet the concrete contributions (methods, data, results) — only what's present in the abstract/metadata.
- **Useful findings**: highlight findings the R&D professional can act on.
- **Prioritise**: name the top 1–3 papers to read first and why.

CURRENT PAPER SET:
${context || "No papers provided."}`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [{ role: "system", content: systemPrompt }, ...messages],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded, please retry shortly." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Add credits in Workspace → Usage." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "AI gateway error" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("scifilter-chat error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
