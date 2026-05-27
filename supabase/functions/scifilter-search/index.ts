// Search Crossref + OpenAlex and AI-score relevance with explainability
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Paper {
  doi: string | null;
  title: string;
  authors: string;
  related_authors: { name: string; works?: number }[];
  year: number | null;
  source: string;
  abstract: string;
  url: string;
  citations: number;
  concepts: string[];
}

function reconstructAbstract(inv: Record<string, number[]> | null): string {
  if (!inv) return "";
  const words: string[] = [];
  for (const [word, positions] of Object.entries(inv)) {
    for (const p of positions) words[p] = word;
  }
  return words.filter(Boolean).join(" ");
}

async function fetchOpenAlex(query: string, yearFrom?: number, yearTo?: number, domain?: string): Promise<Paper[]> {
  const params = new URLSearchParams({
    search: query,
    per_page: "25",
    "mailto": "scifilter@example.com",
  });
  const filters: string[] = [];
  if (yearFrom) filters.push(`from_publication_date:${yearFrom}-01-01`);
  if (yearTo) filters.push(`to_publication_date:${yearTo}-12-31`);
  if (domain) filters.push(`concepts.display_name.search:${domain}`);
  if (filters.length) params.set("filter", filters.join(","));

  const res = await fetch(`https://api.openalex.org/works?${params}`);
  if (!res.ok) return [];
  const data = await res.json();
  return (data.results || []).map((w: any): Paper => {
    const ships = w.authorships || [];
    const authorsList = ships.slice(0, 8).map((a: any) => a.author?.display_name).filter(Boolean);
    return {
      doi: w.doi ? w.doi.replace("https://doi.org/", "") : null,
      title: w.title || "Untitled",
      authors: authorsList.slice(0, 5).join(", "),
      related_authors: authorsList.map((n: string) => ({ name: n })),
      year: w.publication_year || null,
      source: w.primary_location?.source?.display_name || w.host_venue?.display_name || "Unknown",
      abstract: reconstructAbstract(w.abstract_inverted_index),
      url: w.doi || w.id || "",
      citations: w.cited_by_count || 0,
      concepts: (w.concepts || []).slice(0, 6).map((c: any) => c.display_name),
    };
  });
}

function heuristicBreakdown(p: Paper, query: string, domain?: string) {
  const q = query.toLowerCase();
  const keywords = q.split(/\s+/).filter(w => w.length > 2);
  const text = `${p.title} ${p.abstract}`.toLowerCase();
  const matches = keywords.filter(k => text.includes(k)).length;
  const semantic = keywords.length ? matches / keywords.length : 0;
  const currentYear = new Date().getFullYear();
  const recency = p.year ? Math.max(0, 1 - (currentYear - p.year) / 15) : 0;
  const topic = domain
    ? (p.concepts.some(c => c.toLowerCase().includes(domain.toLowerCase())) ? 1 : 0.3)
    : 0.5;
  const citation = Math.min(1, Math.log10(p.citations + 1) / 3);
  const score = semantic * 0.5 + recency * 0.15 + topic * 0.2 + citation * 0.15;
  return { semantic, recency, topic, citation, score, matches, keywordCount: keywords.length };
}

async function aiAnalyze(papers: Paper[], query: string): Promise<Map<number, any>> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  const result = new Map<number, any>();
  if (!LOVABLE_API_KEY) return result;

  const slim = papers.slice(0, 25).map((p, i) => ({
    i, title: p.title, abstract: (p.abstract || "").slice(0, 600), year: p.year, concepts: p.concepts,
  }));

  try {
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: "You are an R&D screening assistant. Analyse scientific papers transparently. Be concise and grounded in provided data — do not invent facts." },
          { role: "user", content: `Research query: "${query}"\n\nFor each paper, produce a screening analysis.\n\nPapers:\n${JSON.stringify(slim)}` },
        ],
        tools: [{
          type: "function",
          function: {
            name: "analyse_papers",
            description: "Per-paper screening analysis",
            parameters: {
              type: "object",
              properties: {
                analyses: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      i: { type: "number" },
                      score: { type: "number", description: "0-100 relevance to query" },
                      confidence: { type: "number", description: "0-100 AI confidence in this judgement" },
                      summary: { type: "string", description: "1-2 sentence plain-language abstract summary" },
                      methodology: { type: "string", description: "1 sentence on the methodology used; 'Not specified' if unclear" },
                      why_selected: { type: "string", description: "1 sentence: why this paper is relevant to the query" },
                      applicability: { type: "string", enum: ["High", "Medium", "Low", "Unknown"], description: "Practical R&D applicability" },
                      methodology_match: { type: "number", description: "0-1 similarity of methodology to typical work on this query" },
                    },
                    required: ["i", "score", "confidence", "summary", "methodology", "why_selected", "applicability", "methodology_match"],
                  },
                },
              },
              required: ["analyses"],
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "analyse_papers" } },
      }),
    });

    if (!res.ok) {
      console.error("AI status", res.status);
      return result;
    }
    const data = await res.json();
    const args = data.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
    if (!args) return result;
    const parsed = JSON.parse(args);
    for (const a of parsed.analyses || []) result.set(a.i, a);
  } catch (e) {
    console.error("AI scoring error:", e);
  }
  return result;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { query, yearFrom, yearTo, domain } = await req.json();
    if (!query || typeof query !== "string") {
      return new Response(JSON.stringify({ error: "query required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const papers = await fetchOpenAlex(query, yearFrom, yearTo, domain);
    const aiMap = await aiAnalyze(papers, query);

    const enriched = papers.map((p, i) => {
      const h = heuristicBreakdown(p, query, domain);
      const ai = aiMap.get(i);
      const aiScore = ai ? ai.score / 100 : null;
      const finalScore = aiScore !== null ? aiScore * 0.7 + h.score * 0.3 : h.score;
      const relevance = finalScore >= 0.65 ? "High" : finalScore >= 0.4 ? "Medium" : "Low";

      const reason_breakdown = {
        semantic: Number(h.semantic.toFixed(2)),
        methodology: ai ? Number(ai.methodology_match.toFixed(2)) : 0.5,
        topic: Number(h.topic.toFixed(2)),
        author: 0.5, // placeholder until we have author-graph data
        citation: Number(h.citation.toFixed(2)),
        keyword_matches: `${h.matches}/${h.keywordCount}`,
      };

      const explanation = ai?.why_selected
        ? `${ai.why_selected}${h.matches ? ` (${h.matches}/${h.keywordCount} keywords matched)` : ""}.`
        : (h.matches ? `${h.matches}/${h.keywordCount} keywords matched` : "Limited signal match.");

      return {
        ...p,
        relevance,
        relevance_score: finalScore,
        confidence: ai ? ai.confidence / 100 : 0.4,
        summary: ai?.summary ?? (p.abstract ? p.abstract.slice(0, 220) + "…" : "Not specified"),
        methodology: ai?.methodology ?? "Not specified",
        applicability: ai?.applicability ?? "Unknown",
        explanation,
        reason_breakdown,
      };
    }).sort((a, b) => b.relevance_score - a.relevance_score);

    return new Response(JSON.stringify({ papers: enriched }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("scifilter-search error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
