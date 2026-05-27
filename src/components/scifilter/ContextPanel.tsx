import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, ExternalLink, Sparkles, Users, GitBranch, AlertTriangle, FileText, TrendingUp } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { Paper } from "@/types/scifilter";

interface Props {
  focusedPaper: Paper | null;
  allPapers: Paper[];
}

export default function ContextPanel({ focusedPaper, allPapers }: Props) {
  const { toast } = useToast();
  const [contradictions, setContradictions] = useState("");
  const [analysing, setAnalysing] = useState(false);

  const connected = useMemo(() => {
    if (!focusedPaper) return [];
    const set = new Set((focusedPaper.concepts || []).map(c => c.toLowerCase()));
    return allPapers
      .filter(p => p.id !== focusedPaper.id)
      .map(p => ({ p, overlap: (p.concepts || []).filter(c => set.has(c.toLowerCase())).length }))
      .filter(x => x.overlap > 0)
      .sort((a, b) => b.overlap - a.overlap)
      .slice(0, 6);
  }, [focusedPaper, allPapers]);

  const emerging = useMemo(() => {
    const counts = new Map<string, number>();
    allPapers.forEach(p => (p.concepts || []).forEach(c => counts.set(c, (counts.get(c) ?? 0) + 1)));
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
  }, [allPapers]);

  const patentSearch = focusedPaper
    ? `https://patents.google.com/?q=${encodeURIComponent(focusedPaper.title)}`
    : null;

  const analyseContradictions = async () => {
    if (!focusedPaper || allPapers.length < 2) return;
    setAnalysing(true); setContradictions("");
    try {
      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/scifilter-chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}` },
        body: JSON.stringify({
          messages: [{
            role: "user",
            content: `Identify any contradictory findings between the focus paper and the others. For each, cite the papers and state the contradiction in one bullet. If none are evident, say so. Use only the provided data.\n\nFOCUS: ${focusedPaper.title}\nSummary: ${focusedPaper.summary || focusedPaper.abstract}`,
          }],
          papers: allPapers.slice(0, 10),
        }),
      });
      if (!resp.ok || !resp.body) throw new Error("Request failed");
      const reader = resp.body.getReader(); const dec = new TextDecoder();
      let buf = ""; let acc = "";
      while (true) {
        const { done, value } = await reader.read(); if (done) break;
        buf += dec.decode(value, { stream: true });
        let idx;
        while ((idx = buf.indexOf("\n")) !== -1) {
          let line = buf.slice(0, idx); buf = buf.slice(idx + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (!line.startsWith("data: ")) continue;
          const j = line.slice(6).trim();
          if (j === "[DONE]") { setAnalysing(false); return; }
          try { const c = JSON.parse(j).choices?.[0]?.delta?.content; if (c) { acc += c; setContradictions(acc); } } catch {}
        }
      }
    } catch (e: any) {
      toast({ title: "Analysis failed", description: e.message, variant: "destructive" });
    } finally { setAnalysing(false); }
  };

  if (!focusedPaper) {
    return (
      <div className="p-6 text-center text-sm text-muted-foreground">
        <FileText className="h-8 w-8 mx-auto mb-2 opacity-40" />
        Select a paper to see its context: related authors, connected work, citation signals, contradictions, and emerging topics.
      </div>
    );
  }

  return (
    <ScrollArea className="h-full">
      <div className="p-4 space-y-5">
        <div>
          <h4 className="text-xs uppercase tracking-wide text-muted-foreground font-medium mb-1">Focus paper</h4>
          <p className="text-sm font-medium leading-tight">{focusedPaper.title}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{focusedPaper.year} · {focusedPaper.citations} citations</p>
        </div>

        <Section icon={<Users className="h-3.5 w-3.5" />} title="Related authors">
          <div className="flex flex-wrap gap-1">
            {(focusedPaper.related_authors || []).slice(0, 10).map(a => (
              <Badge key={a.name} variant="outline" className="text-[10px] font-normal">{a.name}</Badge>
            ))}
            {(!focusedPaper.related_authors || focusedPaper.related_authors.length === 0) && (
              <span className="text-xs text-muted-foreground">Not specified</span>
            )}
          </div>
        </Section>

        <Section icon={<GitBranch className="h-3.5 w-3.5" />} title="Connected papers">
          {connected.length === 0 && <p className="text-xs text-muted-foreground">No overlap detected.</p>}
          <div className="space-y-1.5">
            {connected.map(({ p, overlap }) => (
              <div key={p.id} className="text-xs border-l-2 border-primary/30 pl-2">
                <p className="font-medium leading-tight line-clamp-2">{p.title}</p>
                <p className="text-muted-foreground mt-0.5">{p.year} · {overlap} shared concept{overlap > 1 ? "s" : ""}</p>
              </div>
            ))}
          </div>
        </Section>

        <Section icon={<svg className="h-3.5 w-3.5" />} title="Citation signal">
          <CitationBars papers={[focusedPaper, ...connected.map(c => c.p)]} />
        </Section>

        <Section icon={<AlertTriangle className="h-3.5 w-3.5" />} title="Contradictory findings">
          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={analyseContradictions} disabled={analysing || allPapers.length < 2}>
            {analysing ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Sparkles className="h-3 w-3 mr-1" />}
            Analyse contradictions
          </Button>
          {contradictions && (
            <pre className="mt-2 text-xs whitespace-pre-wrap font-sans bg-muted/40 p-2 rounded">{contradictions}</pre>
          )}
        </Section>

        <Section icon={<FileText className="h-3.5 w-3.5" />} title="Related patents">
          {patentSearch && (
            <a href={patentSearch} target="_blank" rel="noreferrer"
              className="text-xs text-primary inline-flex items-center gap-1 hover:underline">
              <ExternalLink className="h-3 w-3" />Search Google Patents for this title
            </a>
          )}
        </Section>

        <Section icon={<TrendingUp className="h-3.5 w-3.5" />} title="Emerging topics in this result set">
          <div className="flex flex-wrap gap-1">
            {emerging.map(([c, n]) => (
              <Badge key={c} variant="secondary" className="text-[10px]">{c} <span className="ml-1 opacity-60">×{n}</span></Badge>
            ))}
          </div>
        </Section>
      </div>
    </ScrollArea>
  );
}

const Section = ({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) => (
  <div>
    <div className="flex items-center gap-1.5 text-xs font-medium mb-2">{icon}{title}</div>
    {children}
  </div>
);

const CitationBars = ({ papers }: { papers: Paper[] }) => {
  const max = Math.max(1, ...papers.map(p => p.citations || 0));
  return (
    <div className="space-y-1">
      {papers.slice(0, 6).map(p => (
        <div key={p.id} className="grid grid-cols-[1fr_40px] gap-2 items-center">
          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
            <div className="h-full bg-primary/70" style={{ width: `${((p.citations || 0) / max) * 100}%` }} />
          </div>
          <span className="text-[10px] text-muted-foreground tabular-nums">{p.citations || 0}</span>
        </div>
      ))}
    </div>
  );
};
