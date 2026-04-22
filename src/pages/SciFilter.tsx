import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import { Filter, Search, Download, Loader2, ThumbsUp, ThumbsDown, ExternalLink, Info, LogOut } from "lucide-react";
import ChatPanel from "@/components/scifilter/ChatPanel";
import { Link } from "react-router-dom";

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

      // Save search + papers
      const { data: search, error: sErr } = await supabase.from("scifilter_searches").insert({
        user_id: user.id, query,
        year_from: yearFrom ? parseInt(yearFrom) : null,
        year_to: yearTo ? parseInt(yearTo) : null,
        domain: domain || null,
      }).select().single();
      if (sErr) throw sErr;
      setSearchId(search.id);

      if (found.length) {
        const rows = found.map(p => ({
          search_id: search.id, user_id: user.id,
          doi: p.doi, title: p.title, authors: p.authors, year: p.year,
          source: p.source, abstract: p.abstract, url: p.url, citations: p.citations,
          concepts: p.concepts, relevance: p.relevance, relevance_score: p.relevance_score,
          explanation: p.explanation,
        }));
        const { data: inserted } = await supabase.from("scifilter_papers").insert(rows).select();
        setPapers((inserted || []).map(r => ({ ...r, concepts: (r.concepts as string[]) || [] })) as Paper[]);
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
    a.href = url; a.download = `scifilter-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click(); URL.revokeObjectURL(url);
  };

  const signOut = async () => { await supabase.auth.signOut(); navigate("/auth"); };

  // Re-rank: relevant feedback boosts, not_relevant suppresses
  const ranked = [...papers].sort((a, b) => {
    const fa = a.feedback === "relevant" ? 1 : a.feedback === "not_relevant" ? -1 : 0;
    const fb = b.feedback === "relevant" ? 1 : b.feedback === "not_relevant" ? -1 : 0;
    return (fb - fa) || (b.relevance_score - a.relevance_score);
  });
  const visible = highOnly ? ranked.filter(p => p.relevance === "High") : ranked;

  return (
    <TooltipProvider>
      <div className="min-h-screen flex flex-col">
        <header className="border-b bg-card">
          <div className="container mx-auto px-4 py-3 flex items-center justify-between">
            <Link to="/" className="flex items-center gap-2">
              <Filter className="h-5 w-5 text-primary" />
              <span className="font-bold text-lg">SciFilter</span>
            </Link>
            <div className="flex items-center gap-3">
              <span className="text-sm text-muted-foreground hidden sm:inline">{user?.email}</span>
              <Button variant="ghost" size="sm" onClick={signOut}><LogOut className="h-4 w-4 mr-1" />Sign out</Button>
            </div>
          </div>
        </header>

        <div className="flex-1 grid grid-cols-1 lg:grid-cols-[1fr_380px]">
          <main className="p-4 lg:p-6 space-y-4 overflow-x-auto">
            <Card className="p-4">
              <form onSubmit={handleSearch} className="space-y-3">
                <div className="flex gap-2">
                  <div className="flex-1">
                    <Label htmlFor="q">Search scientific literature</Label>
                    <Input id="q" placeholder="e.g. graphene supercapacitors" value={query} onChange={e => setQuery(e.target.value)} required />
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

            {papers.length > 0 && (
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    <Switch id="high" checked={highOnly} onCheckedChange={setHighOnly} />
                    <Label htmlFor="high" className="text-sm">High relevance only</Label>
                  </div>
                  <span className="text-sm text-muted-foreground">{visible.length} of {papers.length}</span>
                </div>
                <Button variant="outline" size="sm" onClick={exportCSV}><Download className="h-4 w-4 mr-1" />Export CSV</Button>
              </div>
            )}

            {visible.length > 0 && (
              <Card>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[35%]">Title</TableHead>
                      <TableHead>Authors</TableHead>
                      <TableHead>Year</TableHead>
                      <TableHead>Source</TableHead>
                      <TableHead>Relevance</TableHead>
                      <TableHead className="text-right">Feedback</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {visible.map(p => (
                      <TableRow key={p.id}>
                        <TableCell>
                          <div className="font-medium leading-tight">{p.title}</div>
                          {p.abstract && <div className="text-xs text-muted-foreground line-clamp-2 mt-1">{p.abstract}</div>}
                          {p.url && <a href={p.url} target="_blank" rel="noreferrer" className="text-xs text-primary inline-flex items-center gap-1 mt-1"><ExternalLink className="h-3 w-3" />{p.doi || "Link"}</a>}
                        </TableCell>
                        <TableCell className="text-sm max-w-[180px] truncate">{p.authors}</TableCell>
                        <TableCell className="text-sm">{p.year}</TableCell>
                        <TableCell className="text-sm max-w-[160px] truncate">{p.source}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Badge variant={relevanceVariant(p.relevance)}>{p.relevance}</Badge>
                            <Tooltip>
                              <TooltipTrigger asChild><Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" /></TooltipTrigger>
                              <TooltipContent className="max-w-xs"><p className="text-xs">{p.explanation}</p></TooltipContent>
                            </Tooltip>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="inline-flex gap-1">
                            <Button size="icon" variant={p.feedback === "relevant" ? "default" : "ghost"} className="h-7 w-7" onClick={() => handleFeedback(p, "relevant")}>
                              <ThumbsUp className="h-3.5 w-3.5" />
                            </Button>
                            <Button size="icon" variant={p.feedback === "not_relevant" ? "destructive" : "ghost"} className="h-7 w-7" onClick={() => handleFeedback(p, "not_relevant")}>
                              <ThumbsDown className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Card>
            )}

            {!searching && papers.length === 0 && (
              <Card className="p-12 text-center">
                <Search className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
                <p className="text-muted-foreground">Enter a query to search Crossref + OpenAlex with AI-assisted relevance ranking.</p>
              </Card>
            )}
          </main>

          <aside className="border-l bg-card lg:h-[calc(100vh-57px)] lg:sticky lg:top-[57px]">
            <ChatPanel papers={visible} goal={query} />
          </aside>
        </div>
      </div>
    </TooltipProvider>
  );
}
