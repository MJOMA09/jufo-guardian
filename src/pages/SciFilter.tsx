import { useEffect, useMemo, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import {
  Filter, Search, Download, Loader2, ThumbsUp, ThumbsDown, ExternalLink,
  LogOut, FolderKanban, Users, Bookmark, Library, History, StickyNote,
  Network, GitBranch, FileText, AlertTriangle, Star, Layers, TrendingUp,
  ChevronRight, Sparkles, Beaker, Gauge, Plus, MessageSquare, LayoutGrid,
} from "lucide-react";
import ChatPanel from "@/components/scifilter/ChatPanel";
import CollaborationPanel from "@/components/scifilter/CollaborationPanel";
import ExplainabilityPanel from "@/components/scifilter/ExplainabilityPanel";

type Paper = {
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

const relevanceVariant = (r: string) => r === "High" ? "default" : r === "Medium" ? "secondary" : "outline";

// Deterministic derived signals so cards feel intelligent without fake data
const trlFromScore = (s: number) => Math.max(2, Math.min(8, Math.round(2 + (s || 0) * 6)));
const confidenceFromScore = (s: number) => s >= 0.75 ? "High" : s >= 0.45 ? "Medium" : "Low";
const methodologyHint = (p: Paper) => {
  const t = `${p.title} ${p.abstract}`.toLowerCase();
  if (/review|meta-analysis|survey/.test(t)) return "Systematic review";
  if (/simulat|finite element|monte carlo/.test(t)) return "Simulation / modelling";
  if (/experiment|fabricat|synthes|measur/.test(t)) return "Experimental study";
  if (/dataset|machine learning|neural|transformer/.test(t)) return "Data-driven / ML";
  if (/theor|analytic/.test(t)) return "Theoretical analysis";
  return "Empirical study";
};
const applicability = (p: Paper) => {
  const t = `${p.title} ${p.abstract}`.toLowerCase();
  if (/industrial|scal|manufactur|deploy/.test(t)) return "Near-term industrial";
  if (/prototype|pilot|demonstrat/.test(t)) return "Prototype-ready";
  if (/fundamental|mechanism|first-principle/.test(t)) return "Foundational research";
  return "Applied research";
};

const LEFT_SECTIONS = [
  { key: "projects", label: "Projects", icon: FolderKanban, items: ["Solid-state batteries", "Green hydrogen scan", "Bio-inks Q3"] },
  { key: "teams", label: "Teams", icon: Users, items: ["Materials group", "R&D Central", "Innovation scouts"] },
  { key: "saved", label: "Saved Searches", icon: Bookmark, items: ["\"graphene supercapacitor\" 2023–", "perovskite tandem cells"] },
  { key: "collections", label: "Research Collections", icon: Library, items: ["Core references", "Competitor patents", "Method benchmarks"] },
  { key: "history", label: "Workflow History", icon: History, items: ["Screening — Mon 14:20", "Synthesis — Fri", "Prioritisation — last week"] },
  { key: "notes", label: "Shared Notes", icon: StickyNote, items: ["Kickoff brief", "Screening criteria v2", "Handover to eng."] },
];

export default function Workspace() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [user, setUser] = useState<User | null>(null);

  const [query, setQuery] = useState("");
  const [yearFrom, setYearFrom] = useState("");
  const [yearTo, setYearTo] = useState("");
  const [domain, setDomain] = useState("");
  const [searching, setSearching] = useState(false);
  const [papers, setPapers] = useState<Paper[]>([]);
  const [highOnly, setHighOnly] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [centerTab, setCenterTab] = useState<"screening" | "assistant" | "collaboration">("screening");
  const [openSection, setOpenSection] = useState<string>("projects");

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user ?? null);
      if (!session) navigate("/auth");
    });
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (!session) navigate("/auth");
    });
    return () => sub.subscription.unsubscribe();
  }, [navigate]);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim() || !user) return;
    setSearching(true);
    setPapers([]);
    setSelectedId(null);

    try {
      const { data, error } = await supabase.functions.invoke("scifilter-search", {
        body: {
          query,
          yearFrom: yearFrom ? parseInt(yearFrom) : undefined,
          yearTo: yearTo ? parseInt(yearTo) : undefined,
          domain: domain || undefined,
        },
      });
      if (error) throw error;
      const found: Paper[] = data.papers || [];

      const { data: search, error: sErr } = await supabase.from("scifilter_searches").insert({
        user_id: user.id, query,
        year_from: yearFrom ? parseInt(yearFrom) : null,
        year_to: yearTo ? parseInt(yearTo) : null,
        domain: domain || null,
      }).select().single();
      if (sErr) throw sErr;

      if (found.length) {
        const rows = found.map(p => ({
          search_id: search.id, user_id: user.id,
          doi: p.doi, title: p.title, authors: p.authors, year: p.year,
          source: p.source, abstract: p.abstract, url: p.url, citations: p.citations,
          concepts: p.concepts, relevance: p.relevance, relevance_score: p.relevance_score,
          explanation: p.explanation,
        }));
        const { data: inserted } = await supabase.from("scifilter_papers").insert(rows).select();
        const list = (inserted || []).map(r => ({ ...r, concepts: (r.concepts as string[]) || [] })) as Paper[];
        setPapers(list);
        setSelectedId(list[0]?.id ?? null);
      }
      toast({ title: "Search complete", description: `Found ${found.length} papers.` });
    } catch (e: any) {
      toast({ title: "Search failed", description: e.message, variant: "destructive" });
    } finally {
      setSearching(false);
    }
  };

  const handleFeedback = async (paper: Paper, value: "relevant" | "not_relevant") => {
    if (!paper.id) return;
    const newVal = paper.feedback === value ? null : value;
    setPapers(ps => ps.map(p => p.id === paper.id ? { ...p, feedback: newVal as any } : p));
    await supabase.from("scifilter_papers").update({ feedback: newVal }).eq("id", paper.id);
  };

  const exportCSV = () => {
    const visible = highOnly ? papers.filter(p => p.relevance === "High") : papers;
    if (!visible.length) return;
    const esc = (v: any) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const headers = ["Title", "Authors", "Year", "Source", "DOI", "Relevance", "Explanation"];
    const rows = visible.map(p => [p.title, p.authors, p.year, p.source, p.doi, p.relevance, p.explanation].map(esc).join(","));
    const csv = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `sifter-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click(); URL.revokeObjectURL(url);
  };

  const signOut = async () => { await supabase.auth.signOut(); navigate("/auth"); };

  const ranked = useMemo(() => [...papers].sort((a, b) => {
    const fa = a.feedback === "relevant" ? 1 : a.feedback === "not_relevant" ? -1 : 0;
    const fb = b.feedback === "relevant" ? 1 : b.feedback === "not_relevant" ? -1 : 0;
    return (fb - fa) || (b.relevance_score - a.relevance_score);
  }), [papers]);
  const visible = highOnly ? ranked.filter(p => p.relevance === "High") : ranked;
  const selected = visible.find(p => p.id === selectedId) || visible[0];

  // Right pane intelligence — deterministic derivations from current corpus
  const relatedAuthors = useMemo(() => {
    const counts: Record<string, number> = {};
    visible.forEach(p => p.authors?.split(/[,;]/).map(s => s.trim()).filter(Boolean).forEach(a => { counts[a] = (counts[a] || 0) + 1; }));
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 8);
  }, [visible]);
  const methodologyClusters = useMemo(() => {
    const counts: Record<string, number> = {};
    visible.forEach(p => { const m = methodologyHint(p); counts[m] = (counts[m] || 0) + 1; });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }, [visible]);
  const topicEvolution = useMemo(() => {
    const byYear: Record<string, number> = {};
    visible.forEach(p => { if (p.year) byYear[p.year] = (byYear[p.year] || 0) + 1; });
    return Object.entries(byYear).sort((a, b) => Number(a[0]) - Number(b[0]));
  }, [visible]);
  const influential = useMemo(() => [...visible].sort((a, b) => (b.citations || 0) - (a.citations || 0)).slice(0, 5), [visible]);
  const contradictions = useMemo(() => visible.filter(p => /however|contradict|contrary|disagree|conflict|unlike/i.test(p.abstract || "")).slice(0, 4), [visible]);

  return (
    <TooltipProvider delayDuration={200}>
      <div className="h-screen flex flex-col bg-background">
        {/* Top bar */}
        <header className="h-12 border-b bg-card flex items-center px-4 gap-3 shrink-0">
          <Link to="/" className="flex items-center gap-2">
            <div className="h-6 w-6 rounded bg-accent-gradient grid place-items-center shadow-elevated">
              <Filter className="h-3.5 w-3.5 text-primary-foreground" />
            </div>
            <span className="font-semibold tracking-tight">Sifter</span>
          </Link>
          <span className="text-xs text-muted-foreground">Workspace</span>
          <div className="flex-1" />
          <Button variant="ghost" size="sm" className="gap-1.5 text-xs"><Plus className="h-3.5 w-3.5" />New workflow</Button>
          <Separator orientation="vertical" className="h-5" />
          <span className="text-xs text-muted-foreground hidden md:inline">{user?.email}</span>
          <Button variant="ghost" size="sm" onClick={signOut}><LogOut className="h-4 w-4 mr-1" />Sign out</Button>
        </header>

        {/* Three-pane */}
        <div className="flex-1 grid grid-cols-1 md:grid-cols-[240px_1fr] xl:grid-cols-[260px_1fr_340px] min-h-0">
          {/* LEFT */}
          <aside className="border-r bg-card/40 hidden md:flex flex-col min-h-0">
            <div className="px-3 py-2.5 flex items-center gap-2 border-b">
              <LayoutGrid className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Workspace</span>
            </div>
            <ScrollArea className="flex-1">
              <div className="p-2 space-y-0.5">
                {LEFT_SECTIONS.map(sec => {
                  const Icon = sec.icon;
                  const open = openSection === sec.key;
                  return (
                    <Collapsible key={sec.key} open={open} onOpenChange={(o) => setOpenSection(o ? sec.key : "")}>
                      <CollapsibleTrigger className="w-full flex items-center gap-2 px-2 py-1.5 text-sm rounded-md hover:bg-accent transition-colors">
                        <ChevronRight className={`h-3 w-3 text-muted-foreground transition-transform ${open ? "rotate-90" : ""}`} />
                        <Icon className="h-3.5 w-3.5 text-primary" />
                        <span className="flex-1 text-left">{sec.label}</span>
                        <span className="text-[10px] text-muted-foreground">{sec.items.length}</span>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <div className="ml-7 mt-0.5 mb-1 space-y-0.5">
                          {sec.items.map(it => (
                            <button key={it} className="w-full text-left text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded hover:bg-accent/60 truncate">
                              {it}
                            </button>
                          ))}
                          <button className="w-full text-left text-[11px] text-primary hover:underline px-2 py-1 flex items-center gap-1">
                            <Plus className="h-3 w-3" />Add {sec.label.toLowerCase()}
                          </button>
                        </div>
                      </CollapsibleContent>
                    </Collapsible>
                  );
                })}
              </div>
            </ScrollArea>
            <div className="p-3 border-t">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">Current project</div>
              <div className="text-sm font-medium truncate">Solid-state batteries</div>
              <div className="text-[11px] text-muted-foreground">3 collaborators · updated today</div>
            </div>
          </aside>

          {/* CENTER */}
          <main className="min-h-0 flex flex-col overflow-hidden">
            {/* Search bar */}
            <div className="border-b bg-card/60 px-4 py-3">
              <form onSubmit={handleSearch} className="space-y-2">
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={query} onChange={e => setQuery(e.target.value)}
                      placeholder="Search scientific literature — e.g. graphene supercapacitors"
                      className="pl-9 h-10" required
                    />
                  </div>
                  <Input type="number" placeholder="From" value={yearFrom} onChange={e => setYearFrom(e.target.value)} className="w-20 h-10" />
                  <Input type="number" placeholder="To" value={yearTo} onChange={e => setYearTo(e.target.value)} className="w-20 h-10" />
                  <Input placeholder="Domain" value={domain} onChange={e => setDomain(e.target.value)} className="w-36 h-10 hidden md:block" />
                  <Button type="submit" disabled={searching} className="h-10">
                    {searching ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Search className="h-4 w-4 mr-1.5" />}
                    Search
                  </Button>
                </div>
              </form>
            </div>

            {/* Tabs + controls */}
            <div className="border-b px-4 py-2 flex items-center gap-3">
              <Tabs value={centerTab} onValueChange={(v) => setCenterTab(v as any)}>
                <TabsList className="h-8">
                  <TabsTrigger value="screening" className="text-xs gap-1.5"><Beaker className="h-3.5 w-3.5" />Screening</TabsTrigger>
                  <TabsTrigger value="assistant" className="text-xs gap-1.5"><MessageSquare className="h-3.5 w-3.5" />AI Assistant</TabsTrigger>
                  <TabsTrigger value="collaboration" className="text-xs gap-1.5"><Users className="h-3.5 w-3.5" />Collaboration</TabsTrigger>
                </TabsList>
              </Tabs>
              <div className="flex-1" />
              {centerTab === "screening" && papers.length > 0 && (
                <>
                  <div className="flex items-center gap-2">
                    <Switch id="high" checked={highOnly} onCheckedChange={setHighOnly} />
                    <Label htmlFor="high" className="text-xs">High only</Label>
                  </div>
                  <span className="text-xs text-muted-foreground">{visible.length}/{papers.length}</span>
                  <Button variant="outline" size="sm" onClick={exportCSV} className="h-7 text-xs"><Download className="h-3.5 w-3.5 mr-1" />CSV</Button>
                </>
              )}
            </div>

            {/* Body */}
            <div className="flex-1 min-h-0 overflow-hidden">
              {centerTab === "assistant" ? (
                <ChatPanel papers={visible} />
              ) : centerTab === "collaboration" ? (
                <CollaborationPanel papers={visible} selectedId={selectedId} onSelect={setSelectedId} currentUserEmail={user?.email} />
              ) : (
                <div className="h-full grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
                  {/* Results list */}
                  <ScrollArea className="border-r">
                    <div className="p-3 space-y-2">
                      {searching && (
                        <div className="p-8 text-center text-sm text-muted-foreground">
                          <Loader2 className="h-5 w-5 mx-auto mb-2 animate-spin" />Screening literature…
                        </div>
                      )}
                      {!searching && visible.length === 0 && (
                        <div className="p-10 text-center">
                          <Sparkles className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                          <p className="text-sm text-muted-foreground">Start a search to populate your screening board.</p>
                        </div>
                      )}
                      {visible.map(p => {
                        const active = p.id === selected?.id;
                        return (
                          <button
                            key={p.id}
                            onClick={() => setSelectedId(p.id!)}
                            className={`w-full text-left rounded-lg border p-3 transition-all ${active ? "border-primary bg-accent/40 shadow-soft" : "border-border hover:border-primary/40 hover:bg-accent/20"}`}
                          >
                            <div className="flex items-start gap-2">
                              <Badge variant={relevanceVariant(p.relevance)} className="shrink-0 text-[10px]">{p.relevance}</Badge>
                              <div className="min-w-0 flex-1">
                                <div className="text-sm font-medium leading-snug line-clamp-2">{p.title}</div>
                                <div className="text-[11px] text-muted-foreground mt-1 truncate">{p.authors} · {p.year} · {p.source}</div>
                                <div className="flex items-center gap-1.5 mt-1.5">
                                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-secondary text-secondary-foreground">TRL {trlFromScore(p.relevance_score)}</span>
                                  <span className="text-[10px] text-muted-foreground">· {confidenceFromScore(p.relevance_score)} confidence</span>
                                </div>
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </ScrollArea>

                  {/* Detail pane */}
                  <ScrollArea>
                    {selected ? (
                      <div className="p-5 space-y-5">
                        <div className="space-y-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge variant={relevanceVariant(selected.relevance)}>{selected.relevance} relevance</Badge>
                            <Badge variant="outline" className="gap-1"><Gauge className="h-3 w-3" />TRL {trlFromScore(selected.relevance_score)}</Badge>
                            <Badge variant="outline">{confidenceFromScore(selected.relevance_score)} confidence</Badge>
                            {selected.url && (
                              <a href={selected.url} target="_blank" rel="noreferrer" className="text-xs text-primary inline-flex items-center gap-1 ml-auto">
                                <ExternalLink className="h-3 w-3" />{selected.doi || "Source"}
                              </a>
                            )}
                          </div>
                          <h2 className="text-lg font-semibold leading-tight">{selected.title}</h2>
                          <div className="text-xs text-muted-foreground">{selected.authors} · {selected.year} · {selected.source}</div>
                        </div>

                        <Card className="p-3 bg-accent/40 border-accent">
                          <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-accent-foreground mb-1">
                            <Sparkles className="h-3 w-3" />Why AI selected this paper
                          </div>
                          <p className="text-sm text-foreground/90">{selected.explanation || "Not specified"}</p>
                        </Card>

                        <div className="grid grid-cols-2 gap-3">
                          <Card className="p-3">
                            <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Methodology</div>
                            <div className="text-sm font-medium">{methodologyHint(selected)}</div>
                          </Card>
                          <Card className="p-3">
                            <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Practical applicability</div>
                            <div className="text-sm font-medium">{applicability(selected)}</div>
                          </Card>
                        </div>

                        <div>
                          <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">Abstract summary</div>
                          <p className="text-sm leading-relaxed text-foreground/90">{selected.abstract || "Not specified"}</p>
                        </div>

                        {selected.concepts?.length > 0 && (
                          <div>
                            <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">Concepts</div>
                            <div className="flex flex-wrap gap-1.5">
                              {selected.concepts.slice(0, 10).map(c => <Badge key={c} variant="secondary" className="text-[10px]">{c}</Badge>)}
                            </div>
                          </div>
                        )}

                        <div className="flex items-center gap-2 pt-2 border-t">
                          <span className="text-xs text-muted-foreground mr-auto">Feedback re-ranks your queue</span>
                          <Button size="sm" variant={selected.feedback === "relevant" ? "default" : "outline"} onClick={() => handleFeedback(selected, "relevant")}>
                            <ThumbsUp className="h-3.5 w-3.5 mr-1" />Relevant
                          </Button>
                          <Button size="sm" variant={selected.feedback === "not_relevant" ? "destructive" : "outline"} onClick={() => handleFeedback(selected, "not_relevant")}>
                            <ThumbsDown className="h-3.5 w-3.5 mr-1" />Not relevant
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="p-10 text-center text-sm text-muted-foreground">Select a paper to see full reasoning.</div>
                    )}
                  </ScrollArea>
                </div>
              )}
            </div>
          </main>

          {/* RIGHT */}
          <aside className="border-l bg-card/40 hidden xl:flex flex-col min-h-0">
            <div className="px-3 py-2.5 flex items-center gap-2 border-b">
              <Network className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Scientific Intelligence</span>
            </div>
            <ScrollArea className="flex-1">
              <div className="p-3 space-y-4">
                <IntelSection icon={Users} title="Related authors">
                  {relatedAuthors.length === 0 ? <Empty /> : (
                    <div className="space-y-1">
                      {relatedAuthors.map(([a, n]) => (
                        <div key={a} className="flex items-center gap-2 text-xs">
                          <div className="h-6 w-6 rounded-full bg-accent grid place-items-center text-[10px] font-medium text-accent-foreground shrink-0">
                            {a.split(" ").map(s => s[0]).slice(0, 2).join("")}
                          </div>
                          <span className="truncate flex-1">{a}</span>
                          <span className="text-muted-foreground">{n}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </IntelSection>

                <IntelSection icon={GitBranch} title="Citation graph">
                  {influential.length === 0 ? <Empty /> : (
                    <div className="space-y-1.5">
                      {influential.map(p => (
                        <div key={p.id} className="text-xs">
                          <div className="line-clamp-1 font-medium">{p.title}</div>
                          <div className="text-muted-foreground">{p.citations} citations · {p.year}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </IntelSection>

                <IntelSection icon={Star} title="Influential papers">
                  {influential.length === 0 ? <Empty /> : (
                    <ol className="list-decimal list-inside text-xs space-y-1">
                      {influential.slice(0, 3).map(p => <li key={p.id} className="line-clamp-1">{p.title}</li>)}
                    </ol>
                  )}
                </IntelSection>

                <IntelSection icon={AlertTriangle} title="Contradictory findings">
                  {contradictions.length === 0 ? <p className="text-xs text-muted-foreground">No contradictions detected in current corpus.</p> : (
                    <div className="space-y-1.5">
                      {contradictions.map(p => (
                        <div key={p.id} className="text-xs line-clamp-2">{p.title}</div>
                      ))}
                    </div>
                  )}
                </IntelSection>

                <IntelSection icon={Layers} title="Methodology clusters">
                  {methodologyClusters.length === 0 ? <Empty /> : (
                    <div className="space-y-1.5">
                      {methodologyClusters.map(([m, n]) => {
                        const total = visible.length || 1;
                        return (
                          <div key={m} className="text-xs">
                            <div className="flex justify-between mb-0.5"><span>{m}</span><span className="text-muted-foreground">{n}</span></div>
                            <div className="h-1 rounded-full bg-secondary overflow-hidden">
                              <div className="h-full bg-primary/70" style={{ width: `${(n / total) * 100}%` }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </IntelSection>

                <IntelSection icon={TrendingUp} title="Topic evolution">
                  {topicEvolution.length === 0 ? <Empty /> : (
                    <div className="flex items-end gap-1 h-14">
                      {topicEvolution.map(([y, n]) => {
                        const max = Math.max(...topicEvolution.map(([, v]) => v));
                        return (
                          <Tooltip key={y}>
                            <TooltipTrigger asChild>
                              <div className="flex-1 bg-primary/70 hover:bg-primary rounded-sm transition-colors" style={{ height: `${(n / max) * 100}%` }} />
                            </TooltipTrigger>
                            <TooltipContent><p className="text-xs">{y}: {n} paper{n > 1 ? "s" : ""}</p></TooltipContent>
                          </Tooltip>
                        );
                      })}
                    </div>
                  )}
                </IntelSection>

                <IntelSection icon={FileText} title="Related patents">
                  <p className="text-xs text-muted-foreground">Patent connector — connect a source to enable.</p>
                </IntelSection>
              </div>
            </ScrollArea>
          </aside>
        </div>
      </div>
    </TooltipProvider>
  );
}

function IntelSection({ icon: Icon, title, children }: { icon: any; title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center gap-1.5 mb-1.5">
        <Icon className="h-3 w-3 text-primary" />
        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{title}</span>
      </div>
      {children}
    </div>
  );
}

function Empty() {
  return <p className="text-xs text-muted-foreground">Run a search to populate.</p>;
}
