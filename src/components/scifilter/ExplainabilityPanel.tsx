import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Sparkles, ChevronRight, ShieldCheck, ShieldAlert, AlertTriangle, Quote,
  Scale, Link2, FlaskConical, Gauge, Info, ExternalLink, Eye, CircleHelp,
} from "lucide-react";

export type ExplainPaper = {
  id?: string;
  doi: string | null;
  title: string;
  authors: string;
  year: number | null;
  source: string;
  abstract: string;
  url: string;
  citations: number;
  concepts: string[];
  relevance: "High" | "Medium" | "Low";
  relevance_score: number;
  explanation: string;
  feedback?: "relevant" | "not_relevant" | null;
};

/* ---------- deterministic, inspectable scoring factors ---------- */

const tokens = (s: string) =>
  (s || "").toLowerCase().match(/[a-z][a-z0-9-]{2,}/g)?.filter(t => !STOP.has(t)) ?? [];
const STOP = new Set(["the", "and", "for", "with", "from", "that", "this", "are", "was", "were", "using", "based", "into", "how", "why", "但"]);

type Factor = {
  key: string;
  label: string;
  weight: number;      // 0..1 share of the score
  value: number;       // 0..1 normalised evidence
  detail: string;      // plain-language justification
  evidence?: string;   // verbatim source snippet
};

function buildFactors(p: ExplainPaper, query: string): Factor[] {
  const q = tokens(query);
  const title = (p.title || "").toLowerCase();
  const abs = (p.abstract || "").toLowerCase();
  const conceptText = (p.concepts || []).join(" ").toLowerCase();

  const titleHits = q.filter(t => title.includes(t));
  const absHits = q.filter(t => abs.includes(t));
  const conceptHits = q.filter(t => conceptText.includes(t));

  const year = p.year ?? 0;
  const recency = year ? Math.max(0, Math.min(1, (year - 2010) / 15)) : 0;
  const cites = p.citations || 0;
  const citeNorm = Math.max(0, Math.min(1, Math.log10(cites + 1) / 3));

  const appliedTerms = ["industrial", "scale", "manufactur", "pilot", "deploy", "prototype", "demonstrat"];
  const appliedHits = appliedTerms.filter(t => abs.includes(t) || title.includes(t));

  const sentence = (needle: string) =>
    (p.abstract || "").split(/(?<=[.!?])\s+/).find(s => s.toLowerCase().includes(needle));

  return [
    {
      key: "title",
      label: "Title term match",
      weight: 0.3,
      value: q.length ? titleHits.length / q.length : 0,
      detail: q.length
        ? titleHits.length
          ? `Matches ${titleHits.length}/${q.length} query terms in the title: ${titleHits.join(", ")}.`
          : "No query terms appear in the title — match relies on abstract and concepts."
        : "No query recorded for this result set.",
      evidence: p.title || undefined,
    },
    {
      key: "abstract",
      label: "Abstract term match",
      weight: 0.25,
      value: q.length ? Math.min(1, absHits.length / Math.max(1, q.length)) : 0,
      detail: absHits.length
        ? `Abstract contains ${absHits.length} query term(s): ${absHits.join(", ")}.`
        : "Query terms not found verbatim in the abstract.",
      evidence: absHits.length ? sentence(absHits[0]) : undefined,
    },
    {
      key: "concepts",
      label: "Indexed concept overlap",
      weight: 0.15,
      value: q.length ? Math.min(1, conceptHits.length / Math.max(1, q.length)) : (p.concepts?.length ? 0.4 : 0),
      detail: conceptHits.length
        ? `Source-indexed concepts overlap on: ${conceptHits.join(", ")}.`
        : p.concepts?.length
          ? `Indexed under ${p.concepts.slice(0, 4).join(", ")} — related but not a direct term overlap.`
          : "Not specified — no indexed concepts returned for this record.",
      evidence: p.concepts?.length ? p.concepts.slice(0, 6).join(" · ") : undefined,
    },
    {
      key: "applied",
      label: "Applied / industrial signals",
      weight: 0.15,
      value: Math.min(1, appliedHits.length / 3),
      detail: appliedHits.length
        ? `Language indicating applied work: ${appliedHits.join(", ")}.`
        : "No applied or scale-up language detected — likely fundamental research.",
      evidence: appliedHits.length ? sentence(appliedHits[0]) : undefined,
    },
    {
      key: "recency",
      label: "Recency",
      weight: 0.08,
      value: recency,
      detail: year ? `Published ${year}.` : "Publication year not specified.",
    },
    {
      key: "citations",
      label: "Citation uptake",
      weight: 0.07,
      value: citeNorm,
      detail: cites ? `${cites.toLocaleString()} citations recorded by the source index.` : "No citation count reported (may be recent or unindexed).",
    },
  ];
}

const gradientFor = (v: number) =>
  v >= 0.75 ? "bg-emerald-500" : v >= 0.45 ? "bg-amber-500" : "bg-rose-500";
const textFor = (v: number) =>
  v >= 0.75 ? "text-emerald-600 dark:text-emerald-400" : v >= 0.45 ? "text-amber-600 dark:text-amber-400" : "text-rose-600 dark:text-rose-400";

const CONTRA = [
  { a: /\bimprove|enhance|increase|higher|superior\b/i, b: /\bdegrad|decrease|reduce|lower|inferior\b/i, label: "opposite directional effect" },
  { a: /\bstable|durab|no significant\b/i, b: /\bunstable|fail|significant loss\b/i, label: "conflicting stability findings" },
  { a: /\bfeasib|viable|scalable\b/i, b: /\bnot feasible|limitation|bottleneck|not scalable\b/i, label: "disputed feasibility" },
];

function findContradictions(p: ExplainPaper, all: ExplainPaper[]) {
  const shared = (o: ExplainPaper) => {
    const s = new Set((p.concepts || []).map(c => c.toLowerCase()));
    return (o.concepts || []).filter(c => s.has(c.toLowerCase()));
  };
  const mine = `${p.title} ${p.abstract}`;
  return all
    .filter(o => o.id !== p.id)
    .map(o => {
      const overlap = shared(o);
      if (overlap.length < 2) return null;
      const theirs = `${o.title} ${o.abstract}`;
      const rule = CONTRA.find(r => (r.a.test(mine) && r.b.test(theirs)) || (r.b.test(mine) && r.a.test(theirs)));
      return rule ? { paper: o, reason: rule.label, overlap } : null;
    })
    .filter(Boolean)
    .slice(0, 3) as { paper: ExplainPaper; reason: string; overlap: string[] }[];
}

interface Props {
  paper: ExplainPaper;
  papers: ExplainPaper[];
  query: string;
  onFeedback?: (p: ExplainPaper, f: "relevant" | "not_relevant") => void;
}

export default function ExplainabilityPanel({ paper, papers, query, onFeedback }: Props) {
  const factors = useMemo(() => buildFactors(paper, query), [paper, query]);
  const [openReasoning, setOpenReasoning] = useState(true);
  const [openFactors, setOpenFactors] = useState(true);

  const modelScore = Math.max(0, Math.min(1, paper.relevance_score || 0));
  const derived = useMemo(
    () => factors.reduce((s, f) => s + f.weight * f.value, 0),
    [factors]
  );
  const divergence = Math.abs(modelScore - derived);
  const evidenceCount = factors.filter(f => f.value > 0.2).length;
  const contradictions = useMemo(() => findContradictions(paper, papers), [paper, papers]);

  const missing: string[] = [];
  if (!paper.abstract) missing.push("abstract text");
  if (!paper.doi) missing.push("DOI");
  if (!paper.year) missing.push("publication year");
  if (!paper.concepts?.length) missing.push("indexed concepts");

  const reviewReasons = [
    ...(divergence > 0.25 ? ["AI score diverges from the transparent factor breakdown"] : []),
    ...(evidenceCount <= 2 ? ["Few independent factors support this ranking"] : []),
    ...(missing.length ? [`Incomplete source metadata (${missing.join(", ")})`] : []),
    ...(contradictions.length ? ["Contradictory evidence detected in this corpus"] : []),
    ...(modelScore >= 0.45 && modelScore < 0.7 ? ["Borderline relevance score"] : []),
  ];
  const needsReview = reviewReasons.length > 0;

  const confidence = modelScore >= 0.75 && !needsReview ? "High" : modelScore >= 0.45 ? "Medium" : "Low";

  return (
    <TooltipProvider delayDuration={200}>
      <div className="space-y-4">
        {/* Trust header */}
        <Card className="p-0 overflow-hidden">
          <div className="px-4 py-3 flex items-center gap-2 border-b bg-muted/30">
            <ShieldCheck className="h-4 w-4 text-primary" />
            <span className="text-[11px] font-semibold uppercase tracking-wider">Explainability &amp; trust</span>
            <Badge variant="outline" className={`ml-auto text-[10px] ${textFor(modelScore)}`}>
              {confidence} confidence
            </Badge>
            <Tooltip>
              <TooltipTrigger asChild><CircleHelp className="h-3.5 w-3.5 text-muted-foreground" /></TooltipTrigger>
              <TooltipContent className="max-w-xs">
                <p className="text-xs">Confidence combines the AI relevance score with how much verifiable evidence supports it. It is an aid to your judgement, not a verdict.</p>
              </TooltipContent>
            </Tooltip>
          </div>

          <div className="px-4 py-3 space-y-3">
            {/* Confidence gradient */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                <span>Relevance score (AI)</span>
                <span className={`font-mono ${textFor(modelScore)}`}>{(modelScore * 100).toFixed(0)}%</span>
              </div>
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <div className={`h-full ${gradientFor(modelScore)} transition-all`} style={{ width: `${modelScore * 100}%` }} />
              </div>
              <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                <span>Transparent factor total (recomputed here)</span>
                <span className="font-mono">{(derived * 100).toFixed(0)}%</span>
              </div>
              <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                <div className="h-full bg-primary/60" style={{ width: `${derived * 100}%` }} />
              </div>
              {divergence > 0.25 && (
                <p className="text-[11px] text-amber-600 dark:text-amber-400 flex items-start gap-1">
                  <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />
                  The AI score and the open factor breakdown disagree by {(divergence * 100).toFixed(0)} points — read the evidence before accepting the ranking.
                </p>
              )}
            </div>

            <Separator />

            {/* Why selected */}
            <div>
              <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                <Sparkles className="h-3 w-3 text-primary" />Why this paper was selected
              </div>
              <p className="text-sm text-foreground/90">{paper.explanation || "Not specified"}</p>
            </div>
          </div>
        </Card>

        {/* Human review indicator */}
        <Card className={`p-3 ${needsReview ? "border-amber-500/40 bg-amber-500/5" : "border-emerald-500/40 bg-emerald-500/5"}`}>
          <div className="flex items-start gap-2">
            {needsReview ? <ShieldAlert className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
                         : <ShieldCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400 mt-0.5 shrink-0" />}
            <div className="min-w-0">
              <div className="text-sm font-medium">
                {needsReview ? "Human review recommended" : "Evidence is consistent — still verify before citing"}
              </div>
              <ul className="mt-1 space-y-0.5 text-[11px] text-muted-foreground list-disc pl-4">
                {(needsReview ? reviewReasons : ["All factors align and source metadata is complete."]).map(r => <li key={r}>{r}</li>)}
              </ul>
            </div>
          </div>
        </Card>

        {/* Relevance scoring explanation */}
        <Card className="p-0 overflow-hidden">
          <Collapsible open={openFactors} onOpenChange={setOpenFactors}>
            <CollapsibleTrigger className="w-full px-4 py-2.5 flex items-center gap-2 hover:bg-accent/30 transition-colors">
              <ChevronRight className={`h-3.5 w-3.5 transition-transform ${openFactors ? "rotate-90" : ""}`} />
              <Scale className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-[11px] font-semibold uppercase tracking-wider">How the score was built</span>
              <Badge variant="secondary" className="ml-auto text-[10px]">{factors.length} factors</Badge>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="px-4 pb-3 space-y-3">
                {factors.map(f => (
                  <div key={f.key} className="space-y-1">
                    <div className="flex items-center gap-2 text-xs">
                      <span className="font-medium">{f.label}</span>
                      <span className="text-[10px] text-muted-foreground">weight {(f.weight * 100).toFixed(0)}%</span>
                      <span className={`ml-auto font-mono text-[11px] ${textFor(f.value)}`}>{(f.value * 100).toFixed(0)}%</span>
                    </div>
                    <Progress value={f.value * 100} className="h-1" />
                    <p className="text-[11px] text-muted-foreground">{f.detail}</p>
                    {f.evidence && (
                      <p className="text-[11px] italic text-foreground/70 border-l-2 border-primary/40 pl-2 flex gap-1">
                        <Quote className="h-2.5 w-2.5 mt-0.5 shrink-0 text-primary/60" />
                        <span className="line-clamp-3">{f.evidence}</span>
                      </p>
                    )}
                  </div>
                ))}
                <p className="text-[10px] text-muted-foreground pt-1 border-t border-dashed">
                  Factors are computed locally from the returned record so you can audit them. They approximate — not replace — the model's own ranking.
                </p>
              </div>
            </CollapsibleContent>
          </Collapsible>
        </Card>

        {/* Contradictory evidence alerts */}
        {contradictions.length > 0 && (
          <Card className="p-3 border-rose-500/40 bg-rose-500/5 space-y-2">
            <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-rose-600 dark:text-rose-400">
              <AlertTriangle className="h-3.5 w-3.5" />Contradictory evidence in this corpus
            </div>
            {contradictions.map(c => (
              <div key={c.paper.id} className="text-xs space-y-0.5">
                <div className="font-medium leading-snug line-clamp-2">{c.paper.title}</div>
                <div className="text-[11px] text-muted-foreground">
                  {c.reason} · shared topics: {c.overlap.slice(0, 3).join(", ")}
                </div>
              </div>
            ))}
            <p className="text-[10px] text-muted-foreground">
              Flagged by language patterns, not by reading full texts. Confirm both sources before drawing a conclusion.
            </p>
          </Card>
        )}

        {/* Methodology reasoning + source transparency */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Card className="p-3 space-y-1.5">
            <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              <FlaskConical className="h-3.5 w-3.5" />Methodology reasoning
            </div>
            <MethodReasoning paper={paper} />
          </Card>

          <Card className="p-3 space-y-1.5">
            <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              <Link2 className="h-3.5 w-3.5" />Source transparency
            </div>
            <dl className="text-[11px] space-y-1">
              <Row k="Venue" v={paper.source || "Not specified"} />
              <Row k="Year" v={paper.year ? String(paper.year) : "Not specified"} />
              <Row k="Citations" v={paper.citations ? paper.citations.toLocaleString() : "Not reported"} />
              <Row k="DOI" v={paper.doi || "Not specified"} />
              <Row k="Retrieved via" v="Open metadata index (OpenAlex / Crossref)" />
              <Row k="Abstract" v={paper.abstract ? "Provided by source" : "Not specified"} />
            </dl>
            {paper.url ? (
              <a href={paper.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline">
                <ExternalLink className="h-3 w-3" />Open primary source
              </a>
            ) : (
              <span className="text-[11px] text-muted-foreground">No source link available — verify manually.</span>
            )}
          </Card>
        </div>

        {/* Expandable AI reasoning trace */}
        <Card className="p-0 overflow-hidden">
          <Collapsible open={openReasoning} onOpenChange={setOpenReasoning}>
            <CollapsibleTrigger className="w-full px-4 py-2.5 flex items-center gap-2 hover:bg-accent/30 transition-colors">
              <ChevronRight className={`h-3.5 w-3.5 transition-transform ${openReasoning ? "rotate-90" : ""}`} />
              <Gauge className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-[11px] font-semibold uppercase tracking-wider">Reasoning trace</span>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="px-4 pb-3 text-[11px] text-muted-foreground space-y-1.5">
                <Step n={1} text={`Query terms extracted: ${tokens(query).join(", ") || "Not specified"}.`} />
                <Step n={2} text={`Record matched on ${evidenceCount} of ${factors.length} factors; strongest is "${[...factors].sort((a, b) => b.value * b.weight - a.value * a.weight)[0].label}".`} />
                <Step n={3} text={`Methodology inferred from abstract language only — full text was not read.`} />
                <Step n={4} text={missing.length ? `Metadata gaps: ${missing.join(", ")}. Affected claims are marked "Not specified".` : "Source metadata complete."} />
                <Step n={5} text={needsReview ? "Outcome: flagged for human review." : "Outcome: no conflicts detected; your verification still required."} />
              </div>
            </CollapsibleContent>
          </Collapsible>
        </Card>

        {/* Side-by-side human verification */}
        <Card className="p-0 overflow-hidden">
          <div className="px-4 py-2.5 border-b bg-muted/30 flex items-center gap-2">
            <Eye className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-[11px] font-semibold uppercase tracking-wider">Side-by-side verification</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x">
            <div className="p-3 space-y-1.5">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                <Sparkles className="h-3 w-3 text-primary" />AI assessment
              </div>
              <div className="text-sm font-medium">{paper.relevance} relevance · {(modelScore * 100).toFixed(0)}%</div>
              <p className="text-[11px] text-muted-foreground line-clamp-4">{paper.explanation || "Not specified"}</p>
            </div>
            <div className="p-3 space-y-2">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                <Info className="h-3 w-3" />Your judgement
              </div>
              {paper.feedback ? (
                <div className="text-sm font-medium">
                  Marked {paper.feedback === "relevant" ? "relevant" : "not relevant"} by you
                </div>
              ) : (
                <p className="text-[11px] text-muted-foreground">Not recorded yet — the AI ranking stands unverified.</p>
              )}
              <div className="flex gap-2">
                <Button size="sm" variant={paper.feedback === "relevant" ? "default" : "outline"} className="h-7 text-xs"
                        onClick={() => onFeedback?.(paper, "relevant")}>Agree</Button>
                <Button size="sm" variant={paper.feedback === "not_relevant" ? "destructive" : "outline"} className="h-7 text-xs"
                        onClick={() => onFeedback?.(paper, "not_relevant")}>Disagree</Button>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </TooltipProvider>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex gap-2">
      <dt className="text-muted-foreground shrink-0 w-24">{k}</dt>
      <dd className="min-w-0 truncate">{v}</dd>
    </div>
  );
}

function Step({ n, text }: { n: number; text: string }) {
  return (
    <div className="flex gap-2">
      <span className="font-mono text-[10px] text-primary shrink-0">{n}.</span>
      <span>{text}</span>
    </div>
  );
}

function MethodReasoning({ paper }: { paper: ExplainPaper }) {
  const t = `${paper.title} ${paper.abstract}`.toLowerCase();
  const rules: { label: string; cues: string[] }[] = [
    { label: "Systematic review", cues: ["review", "meta-analysis", "survey"] },
    { label: "Simulation / modelling", cues: ["simulat", "finite element", "monte carlo", "model"] },
    { label: "Experimental study", cues: ["experiment", "fabricat", "synthes", "measur"] },
    { label: "Data-driven / ML", cues: ["dataset", "machine learning", "neural", "transformer"] },
    { label: "Theoretical analysis", cues: ["theor", "analytic"] },
  ];
  const hit = rules.map(r => ({ ...r, found: r.cues.filter(c => t.includes(c)) })).filter(r => r.found.length);
  const primary = hit[0];
  return (
    <div className="space-y-1">
      <div className="text-sm font-medium">{primary ? primary.label : "Not specified"}</div>
      <p className="text-[11px] text-muted-foreground">
        {primary
          ? `Inferred from cue words in the title/abstract: ${primary.found.join(", ")}.`
          : "The abstract contains no recognisable methodology cues, so no inference is made."}
      </p>
      {hit.length > 1 && (
        <p className="text-[11px] text-amber-600 dark:text-amber-400">
          Ambiguous: cues also point to {hit.slice(1).map(h => h.label).join(", ")}. Check the full text.
        </p>
      )}
    </div>
  );
}
