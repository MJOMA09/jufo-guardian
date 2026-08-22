import { useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Radar, TrendingUp, Lightbulb, FileText, Handshake, Users, GaugeCircle,
  Scale, ShieldCheck, ChevronRight, UserCheck, Eye, CircleDot, Clock,
  AlertTriangle, Info, Sparkles, Play, Loader2, Square,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import { useToast } from "@/hooks/use-toast";

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/scifilter-chat`;

interface Props {
  papers: any[];
  query?: string;
  onSelect?: (id: string) => void;
}

type Maturity = "Concept" | "Design preview" | "Planned";

const MATURITY_STYLE: Record<Maturity, string> = {
  "Concept": "bg-muted text-muted-foreground border-border",
  "Design preview": "bg-primary/10 text-primary border-primary/30",
  "Planned": "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30",
};

const STOPWORDS = new Set([
  "the","and","for","with","from","that","this","were","was","are","have","has","been","into","using","used",
  "study","paper","results","result","based","between","their","which","also","than","then","when","where",
  "over","under","after","before","more","most","less","such","these","those","both","each","other","within",
  "high","low","new","novel","effect","effects","analysis","method","methods","approach","data","model","models",
]);

function tokens(text: string): string[] {
  return (text || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .filter(w => w.length > 3 && !STOPWORDS.has(w));
}

export default function AgentWorkflowPanel({ papers, query, onSelect }: Props) {
  const { toast } = useToast();
  const [oversight, setOversight] = useState(true);
  const [autonomy, setAutonomy] = useState<Record<string, boolean>>({});
  const [openTrace, setOpenTrace] = useState<string | null>(null);
  const [runningId, setRunningId] = useState<string | null>(null);
  const [outputs, setOutputs] = useState<Record<string, string>>({});
  const abortRef = useRef<AbortController | null>(null);

  const runAgent = async (agent: { id: string; name: string; purpose: string; trace: string[] }) => {
    if (runningId) return;
    if (!papers.length) {
      toast({ title: "No corpus loaded", description: "Run a search first so the agent has papers to reason over." });
      return;
    }
    setRunningId(agent.id);
    setOutputs(o => ({ ...o, [agent.id]: "" }));
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    const prompt = `Act as the "${agent.name}" agent.
Purpose: ${agent.purpose}
Follow this reasoning procedure:
${agent.trace.map((t, i) => `${i + 1}. ${t}`).join("\n")}
${query ? `Active research question: "${query}".` : ""}
Work only from the loaded paper set. Mark anything unavailable as "Not specified". Present the result as a reviewable draft for a human, never as a final decision.`;

    try {
      const resp = await fetch(CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ messages: [{ role: "user", content: prompt }], papers }),
        signal: ctrl.signal,
      });

      if (!resp.ok || !resp.body) {
        if (resp.status === 429) toast({ title: "Rate limited", description: "Try again shortly.", variant: "destructive" });
        else if (resp.status === 402) toast({ title: "Credits exhausted", description: "Add credits in Workspace → Usage.", variant: "destructive" });
        else toast({ title: "Agent unavailable", variant: "destructive" });
        return;
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      let acc = "";
      let done = false;
      while (!done) {
        const { done: d, value } = await reader.read();
        if (d) break;
        buf += decoder.decode(value, { stream: true });
        let idx: number;
        while ((idx = buf.indexOf("\n")) !== -1) {
          let line = buf.slice(0, idx);
          buf = buf.slice(idx + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (!line.startsWith("data: ")) continue;
          const json = line.slice(6).trim();
          if (json === "[DONE]") { done = true; break; }
          try {
            const parsed = JSON.parse(json);
            const c = parsed.choices?.[0]?.delta?.content;
            if (c) { acc += c; setOutputs(o => ({ ...o, [agent.id]: acc })); }
          } catch {
            buf = line + "\n" + buf;
            break;
          }
        }
      }
    } catch (e: any) {
      if (e?.name !== "AbortError") toast({ title: "Agent error", description: String(e?.message || e), variant: "destructive" });
    } finally {
      setRunningId(null);
      abortRef.current = null;
    }
  };


  const now = new Date().getFullYear();

  /* ---------- Derived organisational signals (from loaded corpus only) ---------- */

  const signals = useMemo(() => {
    const recent = papers.filter(p => Number(p.year) >= now - 2);
    const older = papers.filter(p => Number(p.year) && Number(p.year) < now - 2);

    // Emerging terms: frequency in recent window vs older window
    const count = (arr: any[]) => {
      const m = new Map<string, number>();
      arr.forEach(p => {
        new Set(tokens(`${p.title || ""} ${p.abstract || ""}`)).forEach(t => m.set(t, (m.get(t) || 0) + 1));
      });
      return m;
    };
    const cr = count(recent);
    const co = count(older);
    const emerging = [...cr.entries()]
      .filter(([, n]) => n >= 2)
      .map(([term, n]) => ({ term, recent: n, prior: co.get(term) || 0, lift: n / ((co.get(term) || 0) + 1) }))
      .sort((a, b) => b.lift - a.lift || b.recent - a.recent)
      .slice(0, 6);

    // Breakthrough candidates: recent + high citation velocity + applied language
    const applied = /(pilot|industrial|scale-?up|manufactur|deployment|prototype|commercial|demonstrat)/i;
    const breakthroughs = papers
      .map(p => {
        const age = Math.max(1, now - (Number(p.year) || now));
        const velocity = (Number(p.citations) || 0) / age;
        const appliedHit = applied.test(`${p.title || ""} ${p.abstract || ""}`);
        return { p, velocity, appliedHit, score: velocity + (appliedHit ? 4 : 0) + (Number(p.year) >= now - 1 ? 3 : 0) };
      })
      .filter(x => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 4);

    // Collaborator recommendations: author frequency across corpus
    const authorMap = new Map<string, { count: number; years: number[] }>();
    papers.forEach(p => {
      String(p.authors || "")
        .split(/[,;]/)
        .map(a => a.trim())
        .filter(a => a.length > 2)
        .slice(0, 6)
        .forEach(a => {
          const e = authorMap.get(a) || { count: 0, years: [] };
          e.count += 1;
          if (Number(p.year)) e.years.push(Number(p.year));
          authorMap.set(a, e);
        });
    });
    const collaborators = [...authorMap.entries()]
      .map(([name, e]) => ({ name, count: e.count, latest: e.years.length ? Math.max(...e.years) : null }))
      .sort((a, b) => b.count - a.count || (b.latest || 0) - (a.latest || 0))
      .slice(0, 5);

    // Bottlenecks
    const undecided = papers.filter(p => !p.user_feedback).length;
    const missingAbstract = papers.filter(p => !p.abstract).length;
    const lowConfidence = papers.filter(p => (Number(p.relevance_score) || 0) > 0 && Number(p.relevance_score) < 50).length;
    const reviewed = papers.length - undecided;
    const coverage = papers.length ? Math.round((reviewed / papers.length) * 100) : 0;

    return { recent, older, emerging, breakthroughs, collaborators, undecided, missingAbstract, lowConfidence, coverage, reviewed };
  }, [papers, now]);

  /* ---------- Agent concept definitions ---------- */

  const agents = useMemo(() => ([
    {
      id: "monitor",
      name: "Domain Monitor",
      icon: Radar,
      maturity: "Design preview" as Maturity,
      purpose: "Watches a defined scientific domain and surfaces new work matching the team's screening criteria.",
      humanRole: "You define the domain scope and approve what enters the shared queue.",
      inputs: ["Saved searches", "Team inclusion criteria", "Publication feeds"],
      output: signals.recent.length
        ? `${signals.recent.length} paper${signals.recent.length === 1 ? "" : "s"} in the loaded corpus fall inside the last two years — a monitor would keep this window continuously fresh for ${query ? `"${query}"` : "your saved queries"}.`
        : "Not specified — no papers with a recent publication year are loaded yet.",
      trace: [
        "Read the active query and saved-search scope",
        "Compare newly indexed records against team inclusion criteria",
        "Drop near-duplicates already present in the corpus",
        "Queue candidates for human screening — never auto-include",
      ],
      oversightNote: "Proposes additions only. A human reviewer confirms every entry before it counts as screened.",
    },
    {
      id: "trends",
      name: "Trend Sensor",
      icon: TrendingUp,
      maturity: "Design preview" as Maturity,
      purpose: "Detects terminology and topic shifts over time so teams notice direction changes early.",
      humanRole: "You judge whether a detected shift is scientifically meaningful or an artefact of indexing.",
      inputs: ["Corpus titles & abstracts", "Publication years", "Methodology clusters"],
      output: signals.emerging.length
        ? `Rising terms in the recent window: ${signals.emerging.slice(0, 4).map(e => `${e.term} (${e.recent} recent vs ${e.prior} prior)`).join(", ")}.`
        : "Not specified — not enough dated papers to compare recent against prior windows.",
      trace: [
        "Split the corpus into a recent and a prior time window",
        "Count distinct-document term frequency in each window",
        "Rank terms by recent-to-prior lift, ignoring generic vocabulary",
        "Present counts alongside the terms so the evidence is checkable",
      ],
      oversightNote: "Signals are statistical, not conclusions. Counts are shown so you can reject weak signals.",
    },
    {
      id: "breakthrough",
      name: "Breakthrough Scout",
      icon: Lightbulb,
      maturity: "Concept" as Maturity,
      purpose: "Flags candidate step-changes: recent work with unusual citation velocity or applied-stage language.",
      humanRole: "You verify the claim against the full text — the agent never labels anything a breakthrough on its own.",
      inputs: ["Citation counts", "Publication recency", "Applied-stage cue words"],
      output: signals.breakthroughs.length
        ? `${signals.breakthroughs.length} candidate${signals.breakthroughs.length === 1 ? "" : "s"} in the current corpus.`
        : "Not specified — no candidates in the loaded corpus.",
      list: signals.breakthroughs.map(b => ({
        id: b.p.id,
        title: b.p.title,
        meta: `${b.p.year || "n.d."} · ${Math.round(b.velocity * 10) / 10} citations/yr${b.appliedHit ? " · applied-stage language" : ""}`,
      })),
      trace: [
        "Compute citations per year since publication",
        "Detect applied-stage cue words in title and abstract",
        "Rank candidates and cap the list to keep review cheap",
        "Label output as candidate, never as confirmed finding",
      ],
      oversightNote: "Wording stays hedged: candidates for review, with the exact factors that raised them.",
    },
    {
      id: "briefing",
      name: "Briefing Composer",
      icon: FileText,
      maturity: "Design preview" as Maturity,
      purpose: "Drafts a periodic research briefing from what the team actually screened and decided.",
      humanRole: "A named reviewer edits and signs off before a briefing is shared outside the team.",
      inputs: ["Screening decisions", "Comment threads", "Cited evidence"],
      output: `${signals.reviewed}/${papers.length || 0} papers carry a human decision — a briefing would cover those and list undecided items as open.`,
      trace: [
        "Collect decisions and rationales logged since the last briefing",
        "Group findings by methodology cluster and by decision",
        "Attach citations to every claim, marking gaps as Not specified",
        "Route the draft to a human owner for sign-off",
      ],
      oversightNote: "Drafts are unpublished until a person approves them; the approver is recorded.",
    },
    {
      id: "handover",
      name: "Handover Assistant",
      icon: Handshake,
      maturity: "Design preview" as Maturity,
      purpose: "Preserves knowledge continuity when work moves between people, teams or project phases.",
      humanRole: "The outgoing owner confirms what is accurate and adds tacit context the agent cannot see.",
      inputs: ["Decision log", "Unresolved disagreements", "Open questions"],
      output: signals.undecided
        ? `${signals.undecided} undecided paper${signals.undecided === 1 ? "" : "s"} would be carried forward as explicit open items.`
        : "No undecided papers in the current corpus — a handover would report the queue as clear.",
      trace: [
        "Summarise what was reviewed and which decisions were made",
        "List unresolved disagreements and their participants",
        "Carry undecided items forward as named open questions",
        "Ask the outgoing owner to confirm or correct each section",
      ],
      oversightNote: "The agent never closes an open question; it only makes it visible to the next owner.",
    },
    {
      id: "collaborators",
      name: "Collaborator Finder",
      icon: Users,
      maturity: "Concept" as Maturity,
      purpose: "Suggests internal and external people whose published work overlaps the current problem.",
      humanRole: "You decide who to contact — suggestions are never outreach, and never a ranking of people's worth.",
      inputs: ["Author metadata", "Co-authorship patterns", "Topic overlap"],
      output: signals.collaborators.length
        ? `Most frequently occurring authors in the corpus: ${signals.collaborators.slice(0, 3).map(c => `${c.name} (${c.count})`).join(", ")}.`
        : "Not specified — author metadata is missing from the loaded papers.",
      list: signals.collaborators.map(c => ({
        id: c.name,
        title: c.name,
        meta: `${c.count} paper${c.count === 1 ? "" : "s"} in corpus · latest ${c.latest ?? "Not specified"}`,
      })),
      trace: [
        "Extract author strings from the loaded records",
        "Count appearances and note the most recent year",
        "Surface frequency only — no seniority or quality inference",
        "Leave contact decisions entirely to the team",
      ],
      oversightNote: "Frequency in one corpus is a weak proxy. Treat it as a starting point, not an assessment.",
    },
    {
      id: "bottleneck",
      name: "Workflow Analyst",
      icon: GaugeCircle,
      maturity: "Design preview" as Maturity,
      purpose: "Spots where screening work stalls: unreviewed queues, missing metadata, low-confidence clusters.",
      humanRole: "The team decides what to fix; the agent reports process facts, never evaluates individuals.",
      inputs: ["Queue state", "Metadata completeness", "Confidence distribution"],
      output: `Coverage ${signals.coverage}%. ${signals.undecided} awaiting decision, ${signals.missingAbstract} missing an abstract, ${signals.lowConfidence} below 50% relevance.`,
      trace: [
        "Measure decided vs undecided items in the shared queue",
        "Detect records where metadata blocks a confident decision",
        "Report process-level counts, aggregated not per-person",
        "Suggest a next action the team can accept or ignore",
      ],
      oversightNote: "Process metrics only. No individual productivity scoring, by design.",
    },
    {
      id: "decision",
      name: "Decision Support",
      icon: Scale,
      maturity: "Planned" as Maturity,
      purpose: "Lays out options, supporting evidence and counter-evidence for a scientific decision.",
      humanRole: "The decision, the rationale and the accountability remain with named humans.",
      inputs: ["Screened evidence", "Contradictory findings", "Applicability signals"],
      output: "Presents evidence for and against each option side by side, with confidence and gaps marked.",
      trace: [
        "Frame the decision and the candidate options",
        "Attach supporting and contradicting evidence to each option",
        "Mark confidence and explicitly name missing evidence",
        "Record the human decision and rationale in the timeline",
      ],
      oversightNote: "No recommendation is auto-applied. Every decision is attributed to a person.",
    },
  ]), [papers.length, query, signals]);

  const roadmap = [
    { phase: "Today", label: "AI-assisted screening", detail: "Search, relevance scoring, explainability, shared queues.", state: "current" },
    { phase: "Next", label: "Continuous monitoring", detail: "Domain monitors and trend sensors keep the corpus current between sessions.", state: "next" },
    { phase: "Later", label: "Briefings & handovers", detail: "Drafted from real decisions, signed off by a named human owner.", state: "later" },
    { phase: "Vision", label: "AI-mediated knowledge workflows", detail: "Agents coordinate context across projects while people keep judgement and accountability.", state: "later" },
  ];

  return (
    <TooltipProvider delayDuration={200}>
      <ScrollArea className="h-full">
        <div className="p-4 space-y-5 max-w-[1200px]">
          {/* Header / positioning */}
          <div className="rounded-lg border bg-card p-4">
            <div className="flex items-start gap-3">
              <div className="h-8 w-8 rounded bg-accent-gradient grid place-items-center shrink-0 shadow-soft">
                <Sparkles className="h-4 w-4 text-primary-foreground" />
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="text-sm font-semibold">Agentic workflow vision</h2>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed max-w-3xl">
                  A design preview of how Sifter evolves from AI-assisted screening toward AI-mediated
                  organisational knowledge workflows. Every concept below keeps a human in the decision path:
                  agents observe, draft and propose — people judge, approve and remain accountable.
                  <b className="text-foreground"> AI supports collective scientific intelligence.</b>
                </p>
              </div>
            </div>

            <Separator className="my-3" />

            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2">
                <Switch id="oversight" checked={oversight} onCheckedChange={setOversight} />
                <Label htmlFor="oversight" className="text-xs flex items-center gap-1.5">
                  <UserCheck className="h-3.5 w-3.5 text-primary" />Human approval required for every agent action
                </Label>
              </div>
              {!oversight ? (
                <Badge variant="outline" className="text-[10px] gap-1 bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/30">
                  <AlertTriangle className="h-2.5 w-2.5" />Unsupervised operation is not offered
                </Badge>
              ) : (
                <Badge variant="outline" className="text-[10px] gap-1 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30">
                  <ShieldCheck className="h-2.5 w-2.5" />Oversight on — agents propose, humans decide
                </Badge>
              )}
            </div>
            {!oversight && (
              <p className="text-[11px] text-muted-foreground mt-2 flex items-start gap-1.5">
                <Info className="h-3 w-3 mt-0.5 shrink-0" />
                By design there is no fully autonomous mode. Turning oversight off is blocked so no agent can
                make an organisational decision without a named reviewer.
              </p>
            )}
          </div>

          {/* Workflow health */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
            {[
              { label: "Corpus loaded", value: `${papers.length}`, hint: "Papers available for agent grounding" },
              { label: "Human decisions", value: `${signals.reviewed}`, hint: "Screened with an explicit judgement" },
              { label: "Awaiting review", value: `${signals.undecided}`, hint: "Would be carried forward on handover" },
              { label: "Metadata gaps", value: `${signals.missingAbstract}`, hint: "Records where agents must say Not specified" },
            ].map(s => (
              <Card key={s.label} className="p-3">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{s.label}</div>
                <div className="text-lg font-semibold mt-0.5">{s.value}</div>
                <div className="text-[10px] text-muted-foreground leading-snug mt-0.5">{s.hint}</div>
              </Card>
            ))}
          </div>

          <Card className="p-3">
            <div className="flex items-center justify-between text-xs mb-1.5">
              <span className="font-medium">Screening coverage</span>
              <span className="text-muted-foreground">{signals.coverage}% decided by a human</span>
            </div>
            <Progress value={signals.coverage} className="h-1.5" />
            <p className="text-[10px] text-muted-foreground mt-1.5">
              Agents work from this human-verified baseline. Where coverage is low, agent output is explicitly
              marked provisional rather than presented as settled knowledge.
            </p>
          </Card>

          {/* Agent concepts */}
          <div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">Future agents</div>
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-2.5">
              {agents.map(a => {
                const Icon = a.icon;
                const traceOpen = openTrace === a.id;
                return (
                  <Card key={a.id} className="p-3.5 space-y-2.5">
                    <div className="flex items-start gap-2.5">
                      <div className="h-7 w-7 rounded-md border bg-muted/40 grid place-items-center shrink-0">
                        <Icon className="h-3.5 w-3.5 text-primary" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-semibold leading-tight">{a.name}</span>
                          <Badge variant="outline" className={`text-[10px] h-4 font-normal ${MATURITY_STYLE[a.maturity]}`}>
                            {a.maturity}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground leading-relaxed mt-1">{a.purpose}</p>
                      </div>
                    </div>

                    <div className="rounded-md border border-dashed bg-muted/20 p-2.5">
                      <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
                        Grounded in your current corpus
                      </div>
                      <p className="text-xs leading-relaxed">{a.output}</p>
                      {a.list && a.list.length > 0 && (
                        <div className="mt-2 space-y-1">
                          {a.list.map(item => (
                            <button
                              key={item.id}
                              onClick={() => item.id && onSelect?.(String(item.id))}
                              className="w-full text-left rounded border bg-background px-2 py-1.5 hover:border-primary/40 transition-colors"
                            >
                              <div className="text-[11px] font-medium leading-snug line-clamp-2">{item.title}</div>
                              <div className="text-[10px] text-muted-foreground mt-0.5">{item.meta}</div>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-1">
                      {a.inputs.map(i => (
                        <Badge key={i} variant="secondary" className="text-[10px] font-normal h-4">{i}</Badge>
                      ))}
                    </div>

                    <div className="flex items-start gap-1.5 text-[11px] text-muted-foreground">
                      <Eye className="h-3 w-3 mt-0.5 shrink-0 text-primary" />
                      <span><b className="text-foreground">Your role:</b> {a.humanRole}</span>
                    </div>

                    <Collapsible open={traceOpen} onOpenChange={o => setOpenTrace(o ? a.id : null)}>
                      <CollapsibleTrigger className="flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground">
                        <ChevronRight className={`h-3 w-3 transition-transform ${traceOpen ? "rotate-90" : ""}`} />
                        <span className="uppercase tracking-wider font-semibold">How it would reason</span>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <ol className="mt-2 space-y-1 pl-1">
                          {a.trace.map((t, i) => (
                            <li key={i} className="text-[11px] text-muted-foreground flex gap-2">
                              <span className="font-mono text-primary shrink-0">{i + 1}.</span>{t}
                            </li>
                          ))}
                        </ol>
                        <div className="mt-2 rounded-md bg-primary/5 border border-primary/20 p-2 text-[11px] flex items-start gap-1.5">
                          <ShieldCheck className="h-3 w-3 mt-0.5 shrink-0 text-primary" />
                          <span>{a.oversightNote}</span>
                        </div>
                      </CollapsibleContent>
                    </Collapsible>

                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        className="h-7 text-xs"
                        disabled={!!runningId && runningId !== a.id}
                        onClick={() => (runningId === a.id ? abortRef.current?.abort() : runAgent(a))}
                      >
                        {runningId === a.id
                          ? <><Loader2 className="h-3 w-3 mr-1 animate-spin" />Running…</>
                          : <><Play className="h-3 w-3 mr-1" />Run agent</>}
                      </Button>
                      {runningId === a.id && (
                        <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => abortRef.current?.abort()}>
                          <Square className="h-3 w-3 mr-1" />Stop
                        </Button>
                      )}
                      {outputs[a.id] && runningId !== a.id && (
                        <Button size="sm" variant="ghost" className="h-7 text-[11px]" onClick={() => setOutputs(o => ({ ...o, [a.id]: "" }))}>
                          Clear draft
                        </Button>
                      )}
                    </div>

                    {outputs[a.id] !== undefined && outputs[a.id] !== "" && (
                      <div className="rounded-md border bg-background p-2.5">
                        <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1 flex items-center gap-1">
                          <UserCheck className="h-2.5 w-2.5" />Agent draft — awaiting your review
                        </div>
                        <div className="prose prose-sm dark:prose-invert max-w-none text-xs leading-relaxed [&_p]:my-1 [&_ul]:my-1 [&_h1]:text-sm [&_h2]:text-sm [&_h3]:text-xs">
                          <ReactMarkdown>{outputs[a.id]}</ReactMarkdown>
                        </div>
                      </div>
                    )}

                    <Separator />


                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Switch
                          id={`aut-${a.id}`}
                          checked={!!autonomy[a.id]}
                          onCheckedChange={v => setAutonomy(s => ({ ...s, [a.id]: v }))}
                        />
                        <Label htmlFor={`aut-${a.id}`} className="text-[11px]">
                          {autonomy[a.id] ? "Drafts proposals continuously" : "Runs on request only"}
                        </Label>
                      </div>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Badge variant="outline" className="text-[10px] h-4 gap-1 cursor-help">
                            <UserCheck className="h-2.5 w-2.5" />Review gate
                          </Badge>
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs">
                          <p className="text-xs">
                            Either setting still ends at a human review gate. Continuous mode changes when
                            drafts appear, never whether they need approval.
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    </div>
                  </Card>
                );
              })}
            </div>
          </div>

          {/* Human–AI cognition split */}
          <Card className="p-4">
            <div className="text-sm font-semibold mb-1">Human–AI collaborative cognition</div>
            <p className="text-xs text-muted-foreground mb-3">
              A deliberate division of labour. Agents extend attention and memory; people keep interpretation,
              judgement and accountability.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="rounded-md border p-3">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">Agents extend</div>
                <ul className="space-y-1 text-xs text-muted-foreground">
                  {["Continuous attention across large literatures","Recall of prior decisions and rationales","Consistent extraction and structuring","Surfacing contradictions and gaps","Drafting reusable summaries"].map(t => (
                    <li key={t} className="flex gap-2"><CircleDot className="h-3 w-3 mt-0.5 shrink-0 text-primary" />{t}</li>
                  ))}
                </ul>
              </div>
              <div className="rounded-md border p-3 bg-muted/20">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">People retain</div>
                <ul className="space-y-1 text-xs text-muted-foreground">
                  {["Scientific interpretation and framing","Inclusion, exclusion and escalation decisions","Judging relevance to organisational goals","Approving anything shared beyond the team","Accountability for outcomes"].map(t => (
                    <li key={t} className="flex gap-2"><UserCheck className="h-3 w-3 mt-0.5 shrink-0 text-primary" />{t}</li>
                  ))}
                </ul>
              </div>
            </div>
          </Card>

          {/* Roadmap */}
          <Card className="p-4">
            <div className="text-sm font-semibold mb-3">From assisted screening to mediated workflows</div>
            <div className="space-y-3">
              {roadmap.map((r, i) => (
                <div key={r.phase} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <div className={`h-2.5 w-2.5 rounded-full mt-1 ${r.state === "current" ? "bg-primary" : r.state === "next" ? "bg-primary/50" : "bg-muted-foreground/30"}`} />
                    {i < roadmap.length - 1 && <div className="w-px flex-1 bg-border mt-1" />}
                  </div>
                  <div className="pb-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium">{r.label}</span>
                      <Badge variant="outline" className="text-[10px] h-4 font-normal gap-1">
                        <Clock className="h-2.5 w-2.5" />{r.phase}
                      </Badge>
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">{r.detail}</p>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* Guardrails */}
          <Card className="p-4">
            <div className="text-sm font-semibold mb-2 flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-primary" />Design guardrails
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-xs">
              {[
                { t: "No replacement narrative", d: "Agents are framed as assistants to a research team, never as substitutes for scientists." },
                { t: "No removed oversight", d: "Every proposal ends at a named human reviewer, in every mode." },
                { t: "No black-box org decisions", d: "Inputs, reasoning steps and evidence are shown for anything that informs a decision." },
                { t: "Hedged language", d: "Candidates, signals and drafts — never verdicts stated as fact." },
                { t: "Explicit gaps", d: "Missing metadata is reported as Not specified instead of being inferred." },
                { t: "No people scoring", d: "Workflow metrics stay process-level and aggregated, never individual performance ratings." },
              ].map(g => (
                <div key={g.t} className="rounded-md border p-2.5">
                  <div className="font-medium text-[11px]">{g.t}</div>
                  <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">{g.d}</p>
                </div>
              ))}
            </div>
          </Card>

          {papers.length === 0 && (
            <div className="rounded-lg border border-dashed p-4 text-xs text-muted-foreground flex items-start gap-2">
              <Info className="h-4 w-4 text-primary shrink-0 mt-0.5" />
              Run a search to ground these agent concepts in a real corpus — each card then shows what the agent
              would actually surface from your loaded papers.
            </div>
          )}
        </div>
      </ScrollArea>
    </TooltipProvider>
  );
}
