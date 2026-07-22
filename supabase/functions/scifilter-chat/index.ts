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

    const systemPrompt = `You are Sifter Research Assistant — a domain-aware scientific workflow agent for R&D professionals. You augment scientific reasoning; you do not replace it.

STRICT GROUNDING RULES:
- Use ONLY the provided paper data (title, abstract, metadata) shown below. Do NOT invent information, authors, results, or numbers.
- If information is missing or unclear, say exactly: "Not specified".
- Be transparent about uncertainty. Prefer "the abstract suggests…" over confident claims when evidence is thin.
- Never produce black-box conclusions. Every non-trivial claim must reference a paper as [n].
- Reduce cognitive overload: be concise, structured, decision-oriented. No conversational fluff.

REQUIRED RESPONSE STRUCTURE (every answer):
1. Start with a short "Reasoning trace:" section (2–5 bullets) explaining how you interpreted the request and which papers you considered.
2. Then the main answer under a clear heading (e.g. "Analysis", "Screening", "Synthesis", "Prioritisation", "Handover", "Contradictions", "Clusters", "Methodology", "Applicability"). Use bullet points and markdown. Cite papers inline as [n] matching the numbering below.
3. End with a single line: "Confidence: High|Medium|Low — <one-sentence reason grounded in evidence coverage>".

CAPABILITIES you can perform (pick the right one, or several if the user requests):
- Semantic scientific search over the loaded corpus
- Title/abstract screening (Include / Exclude / Unclear with reasons)
- Methodology extraction (study type, data, techniques, evaluation)
- Industrial applicability & TRL band estimation (1–9) with justification
- Contradiction detection across papers ([n] vs [m] with the disagreement)
- Related author discovery and collaboration patterns
- Paper clustering into thematic groups
- Workflow summarisation (coverage, gaps, next steps)
- Engineering handover writeups

TONE: collaborative, transparent, assistive, trustworthy, scientifically grounded. Avoid overconfidence.

CURRENT PAPER SET (numbered for citation):
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
