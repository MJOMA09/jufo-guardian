import { useEffect, useMemo, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import { Filter, Search, Download, Loader2, LogOut, GitCompare, MessageSquare, Sparkles } from "lucide-react";
import ChatPanel from "@/components/scifilter/ChatPanel";
import PaperCard from "@/components/scifilter/PaperCard";
import CompareDialog from "@/components/scifilter/CompareDialog";
import CollectionsBar from "@/components/scifilter/CollectionsBar";
import AnnotationsDialog from "@/components/scifilter/AnnotationsDialog";
import ContextPanel from "@/components/scifilter/ContextPanel";
import type { Paper, Collection, Feedback } from "@/types/scifilter";

export default function SciFilter() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [user, setUser] = useState<User | null>(null);

  const [query, setQuery] = useState("");
  const [yearFrom, setYearFrom] = useState("");
  const [yearTo, setYearTo] = useState("");
  const [domain, setDomain] = useState("");
  const [searching, setSearching] = useState(false);
  const [papers, setPapers] = useState<Paper[]>([]);
  const [searchId, setSearchId] = useState<string | null>(null);
  const [highOnly, setHighOnly] = useState(false);

  const [collections, setCollections] = useState<Collection[]>([]);
  const [activeCollection, setActiveCollection] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [compareOpen, setCompareOpen] = useState(false);
  const [annotationsPaper, setAnnotationsPaper] = useState<Paper | null>(null);
  const [saveTarget, setSaveTarget] = useState<Paper | null>(null);
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const [rightTab, setRightTab] = useState("context");

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

  useEffect(() => {
    if (!user) return;
    supabase.from("scifilter_collections").select("*").order("created_at", { ascending: false })
      .then(({ data }) => setCollections((data || []) as any));
  }, [user]);

  // Load papers when an existing collection is selected
  useEffect(() => {
    if (!user || !activeCollection) return;
    supabase.from("scifilter_papers").select("*").eq("collection_id", activeCollection)
      .then(({ data }) => setPapers((data || []).map(normalise) as Paper[]));
  }, [user, activeCollection]);

  const normalise = (r: any): Paper => ({
    ...r,
    concepts: (r.concepts as string[]) || [],
    related_authors: (r.related_authors as any) || [],
    reason_breakdown: (r.reason_breakdown as any) || {},
  });

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim() || !user) return;
    setSearching(true); setPapers([]); setSelectedIds(new Set()); setFocusedId(null);
    setActiveCollection(null);
    try {
      const { data, error } = await supabase.functions.invoke("scifilter-search", {
        body: { query, yearFrom: yearFrom ? +yearFrom : undefined, yearTo: yearTo ? +yearTo : undefined, domain: domain || undefined },
      });
      if (error) throw error;
      const found: Paper[] = data.papers || [];
      const { data: search, error: sErr } = await supabase.from("scifilter_searches").insert({
        user_id: user.id, query,
        year_from: yearFrom ? +yearFrom : null, year_to: yearTo ? +yearTo : null, domain: domain || null,
      }).select().single();
      if (sErr) throw sErr;
      setSearchId(search.id);
      if (found.length) {
        const rows = found.map(p => ({
          search_id: search.id, user_id: user.id,
          doi: p.doi, title: p.title, authors: p.authors, year: p.year,
          source: p.source, abstract: p.abstract, url: p.url, citations: p.citations,
          concepts: p.concepts, relevance: p.relevance, relevance_score: p.relevance_score,
          explanation: p.explanation, summary: p.summary, methodology: p.methodology,
          confidence: p.confidence, applicability: p.applicability,
          related_authors: p.related_authors || [], reason_breakdown: p.reason_breakdown || {},
        }));
        const { data: inserted } = await supabase.from("scifilter_papers").insert(rows).select();
        setPapers((inserted || []).map(normalise) as Paper[]);
      }
      toast({ title: "Search complete", description: `Found ${found.length} papers.` });
    } catch (e: any) {
      toast({ title: "Search failed", description: e.message, variant: "destructive" });
    } finally { setSearching(false); }
  };

  const handleFeedback = async (paper: Paper, value: Feedback) => {
    if (!paper.id) return;
    const newVal = paper.feedback === value ? null : value;
    setPapers(ps => ps.map(p => p.id === paper.id ? { ...p, feedback: newVal } : p));
    await supabase.from("scifilter_papers").update({ feedback: newVal }).eq("id", paper.id);
  };

  const createCollection = async (name: string, description: string, isShared: boolean) => {
    if (!user) return;
    const { data, error } = await supabase.from("scifilter_collections")
      .insert({ user_id: user.id, name, description, is_shared: isShared }).select().single();
    if (error) { toast({ title: "Failed", description: error.message, variant: "destructive" }); return; }
    setCollections(c => [data as any, ...c]);
    toast({ title: "Collection created" });
  };

  const saveToCollection = async (paper: Paper, collectionId: string) => {
    if (!paper.id) return;
    await supabase.from("scifilter_papers").update({ collection_id: collectionId }).eq("id", paper.id);
    setPapers(ps => ps.map(p => p.id === paper.id ? { ...p, collection_id: collectionId } : p));
    toast({ title: "Saved to collection" });
    setSaveTarget(null);
  };

  const toggleSelect = (id: string) => setSelectedIds(s => {
    const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n;
  });

  const exportCSV = () => {
    const visible = filteredRanked;
    if (!visible.length) return;
    const esc = (v: any) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const headers = ["Title", "Authors", "Year", "Source", "DOI", "Relevance", "Confidence", "Applicability", "Feedback", "Explanation"];
    const rows = visible.map(p => [p.title, p.authors, p.year, p.source, p.doi, p.relevance,
      `${Math.round((p.confidence ?? 0) * 100)}%`, p.applicability, p.feedback ?? "", p.explanation].map(esc).join(","));
    const csv = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `scifilter-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click(); URL.revokeObjectURL(url);
  };

  const signOut = async () => { await supabase.auth.signOut(); navigate("/auth"); };

  const ranked = useMemo(() => [...papers].sort((a, b) => {
    const w = (p: Paper) => p.feedback === "relevant" ? 2 : p.feedback === "maybe_relevant" ? 0.5 : p.feedback === "not_relevant" ? -3 : 0;
    return (w(b) - w(a)) || (b.relevance_score - a.relevance_score);
  }), [papers]);

  const filteredRanked = useMemo(() => highOnly ? ranked.filter(p => p.relevance === "High") : ranked, [ranked, highOnly]);

  const selectedPapers = useMemo(() => papers.filter(p => p.id && selectedIds.has(p.id)), [papers, selectedIds]);
  const focusedPaper = useMemo(() => papers.find(p => p.id === focusedId) ?? null, [papers, focusedId]);

  return (
    <TooltipProvider>
      <div className="min-h-screen flex flex-col bg-background">
        <header className="border-b bg-card sticky top-0 z-30">
          <div className="container mx-auto px-4 py-3 flex items-center justify-between">
            <Link to="/" className="flex items-center gap-2">
              <Filter className="h-5 w-5 text-primary" />
              <span className="font-bold text-lg">SciFilter</span>
              <span className="text-xs text-muted-foreground hidden sm:inline">· AI screening workflow</span>
            </Link>
            <div className="flex items-center gap-3">
              <span className="text-sm text-muted-foreground hidden sm:inline">{user?.email}</span>
              <Button variant="ghost" size="sm" onClick={signOut}><LogOut className="h-4 w-4 mr-1" />Sign out</Button>
            </div>
          </div>
        </header>

        <div className="flex-1 grid grid-cols-1 lg:grid-cols-[1fr_420px]">
          <main className="p-4 lg:p-6 space-y-4 overflow-x-hidden">
            <Card className="p-4">
              <form onSubmit={handleSearch} className="space-y-3">
                <div className="flex gap-2">
                  <div className="flex-1">
                    <Label htmlFor="q">Search scientific literature</Label>
                    <Input id="q" placeholder="e.g. solid-state battery cathodes" value={query} onChange={e => setQuery(e.target.value)} required />
                  </div>
                  <div className="flex items-end">
                    <Button type="submit" disabled={searching}>
                      {searching ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Search className="h-4 w-4 mr-2" />}
                      Search
                    </Button>
                  </div>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <div><Label className="text-xs">Year from</Label><Input type="number" placeholder="2020" value={yearFrom} onChange={e => setYearFrom(e.target.value)} /></div>
                  <div><Label className="text-xs">Year to</Label><Input type="number" placeholder="2025" value={yearTo} onChange={e => setYearTo(e.target.value)} /></div>
                  <div className="col-span-2"><Label className="text-xs">Domain (optional)</Label><Input placeholder="e.g. materials science" value={domain} onChange={e => setDomain(e.target.value)} /></div>
                </div>
              </form>
            </Card>

            <CollectionsBar
              collections={collections}
              activeId={activeCollection}
              onSelect={setActiveCollection}
              onCreate={createCollection}
            />

            {papers.length > 0 && (
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3 flex-wrap">
                  <div className="flex items-center gap-2">
                    <Switch id="high" checked={highOnly} onCheckedChange={setHighOnly} />
                    <Label htmlFor="high" className="text-sm">High relevance only</Label>
                  </div>
                  <span className="text-sm text-muted-foreground">{filteredRanked.length} of {papers.length}</span>
                  {selectedIds.size > 0 && (
                    <span className="text-sm text-primary font-medium">{selectedIds.size} selected</span>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" disabled={selectedPapers.length < 2 || selectedPapers.length > 4} onClick={() => setCompareOpen(true)}>
                    <GitCompare className="h-4 w-4 mr-1" />Compare ({selectedPapers.length})
                  </Button>
                  <Button variant="outline" size="sm" onClick={exportCSV}><Download className="h-4 w-4 mr-1" />Export CSV</Button>
                </div>
              </div>
            )}

            {filteredRanked.length > 0 && (
              <div className="grid gap-3">
                {filteredRanked.map(p => (
                  <PaperCard
                    key={p.id}
                    paper={p}
                    selected={!!p.id && selectedIds.has(p.id)}
                    onToggleSelect={() => p.id && toggleSelect(p.id)}
                    onFeedback={(v) => handleFeedback(p, v)}
                    onOpenAnnotations={() => setAnnotationsPaper(p)}
                    onAddToCollection={() => setSaveTarget(p)}
                    onFocus={() => { setFocusedId(p.id ?? null); setRightTab("context"); }}
                    isFocused={focusedId === p.id}
                  />
                ))}
              </div>
            )}

            {!searching && papers.length === 0 && (
              <Card className="p-12 text-center">
                <Search className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
                <p className="text-muted-foreground">Run a search to start your AI-assisted screening workflow.</p>
              </Card>
            )}
          </main>

          <aside className="border-l bg-card lg:h-[calc(100vh-57px)] lg:sticky lg:top-[57px] flex flex-col">
            <Tabs value={rightTab} onValueChange={setRightTab} className="flex flex-col h-full">
              <TabsList className="grid grid-cols-2 m-2">
                <TabsTrigger value="context" className="text-xs"><Sparkles className="h-3 w-3 mr-1" />Context</TabsTrigger>
                <TabsTrigger value="chat" className="text-xs"><MessageSquare className="h-3 w-3 mr-1" />Assistant</TabsTrigger>
              </TabsList>
              <TabsContent value="context" className="flex-1 overflow-hidden m-0">
                <ContextPanel focusedPaper={focusedPaper} allPapers={papers} />
              </TabsContent>
              <TabsContent value="chat" className="flex-1 overflow-hidden m-0">
                <ChatPanel papers={filteredRanked} />
              </TabsContent>
            </Tabs>
          </aside>
        </div>

        <CompareDialog open={compareOpen} onOpenChange={setCompareOpen} papers={selectedPapers} />
        <AnnotationsDialog
          paper={annotationsPaper}
          userId={user?.id || ""}
          open={!!annotationsPaper}
          onOpenChange={(v) => !v && setAnnotationsPaper(null)}
        />

        <Dialog open={!!saveTarget} onOpenChange={(v) => !v && setSaveTarget(null)}>
          <DialogContent>
            <DialogHeader><DialogTitle>Save to collection</DialogTitle></DialogHeader>
            <div className="space-y-2">
              {collections.length === 0 && (
                <p className="text-sm text-muted-foreground">Create a collection first from the bar above.</p>
              )}
              {collections.map(c => (
                <Button key={c.id} variant="outline" className="w-full justify-start" onClick={() => saveTarget && saveToCollection(saveTarget, c.id)}>
                  {c.name}{c.is_shared && <span className="ml-2 text-xs text-muted-foreground">· shared</span>}
                </Button>
              ))}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  );
}
