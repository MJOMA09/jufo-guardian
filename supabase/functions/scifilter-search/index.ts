// Search Crossref + OpenAlex and AI-score relevance
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Paper {
  doi: string | null;
  title: string;
  authors: string;
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
  return (data.results || []).map((w: any): Paper => ({
    doi: w.doi ? w.doi.replace("https://doi.org/", "") : null,
    title: w.title || "Untitled",
    authors: (w.authorships || []).slice(0, 5).map((a: any) => a.author?.display_name).filter(Boolean).join(", "),
    year: w.publication_year || null,
    source: w.primary_location?.source?.display_name || w.host_venue?.display_name || "Unknown",
    abstract: reconstructAbstract(w.abstract_inverted_index),
    url: w.doi || w.id || "",
    citations: w.cited_by_count || 0,
    concepts: (w.concepts || []).slice(0, 5).map((c: any) => c.display_name),
  }));
}

function heuristicScore(p: Paper, query: string, domain?: string): { score: number; reasons: string[] } {
  const q = query.toLowerCase();
  const keywords = q.split(/\s+/).filter(w => w.length > 2);
  const text = `${p.title} ${p.abstract}`.toLowerCase();
  const matches = keywords.filter(k => text.includes(k)).length;
  const keywordScore = keywords.length ? matches / keywords.length : 0;
  const currentYear = new Date().getFullYear();
  const recency = p.year ? Math.max(0, 1 - (currentYear - p.year) / 15) : 0;
  const domainMatch = domain ? p.concepts.some(c => c.toLowerCase().includes(domain.toLowerCase())) ? 1 : 0 : 0.5;
  const citationBoost = Math.min(1, Math.log10(p.citations + 1) / 3);
  const score = keywordScore * 0.5 + recency * 0.2 + domainMatch * 0.2 + citationBoost * 0.1;
  const reasons: string[] = [];
  if (matches > 0) reasons.push(`${matches}/${keywords.length} keywords matched`);
  if (p.year && p.year >= currentYear - 3) reasons.push("recent (≤3 yrs)");
  else if (p.year && p.year >= currentYear - 7) reasons.push("moderately recent");
  if (domain && domainMatch === 1) reasons.push(`domain match: ${domain}`);
  if (p.citations > 50) reasons.push(`${p.citations} citations`);
  return { score, reasons };
}

async function aiRelevance(papers: Paper[], query: string): Promise<Map<string, { score: number; reason: string }>> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  const result = new Map<string, { score: number; reason: string }>();
  if (!LOVABLE_API_KEY) return result;

  const slim = papers.slice(0, 25).map((p, i) => ({
    i,
    title: p.title,
    abstract: (p.abstract || "").slice(0, 400),
    year: p.year,
  }));

  try {
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: "You score paper relevance to a research query. Return concise scores." },
          { role: "user", content: `Query: "${query}"\n\nPapers:\n${JSON.stringify(slim)}\n\nFor each paper, score 0-100 and give a one-sentence reason.` },
        ],
        tools: [{
          type: "function",
          function: {
            name: "score_papers",
            description: "Score relevance of each paper",
            parameters: {
              type: "object",
              properties: {
                scores: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      i: { type: "number" },
                      score: { type: "number" },
                      reason: { type: "string" },
                    },
                    required: ["i", "score", "reason"],
                  },
                },
              },
              required: ["scores"],
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "score_papers" } },
      }),
    });

    if (!res.ok) return result;
    const data = await res.json();
    const args = data.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
    if (!args) return result;
    const parsed = JSON.parse(args);
    for (const s of parsed.scores || []) {
      const p = papers[s.i];
      if (p) result.set(p.title, { score: s.score / 100, reason: s.reason });
    }
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
    const aiScores = await aiRelevance(papers, query);

    const enriched = papers.map(p => {
      const heur = heuristicScore(p, query, domain);
      const ai = aiScores.get(p.title);
      const finalScore = ai ? (ai.score * 0.7 + heur.score * 0.3) : heur.score;
      const relevance = finalScore >= 0.65 ? "High" : finalScore >= 0.4 ? "Medium" : "Low";
      const explanation = ai
        ? `${ai.reason} ${heur.reasons.length ? "Signals: " + heur.reasons.join("; ") + "." : ""}`
        : heur.reasons.length ? heur.reasons.join("; ") : "Limited signal match.";
      return { ...p, relevance, relevance_score: finalScore, explanation };
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
