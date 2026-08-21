import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import ReactMarkdown from "react-markdown";
import {
  Users, MessageSquare, ClipboardList, Handshake, GitCompare, Clock,
  Share2, Loader2, Send, CheckCircle2, CircleDashed, AlertTriangle,
  Sparkles, ChevronRight, Library, StickyNote, ShieldCheck, ArrowRight, Trash2,
} from "lucide-react";

interface Props {
  papers: any[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  currentUserEmail?: string | null;
}

type Comment = { id: string; paperId: string | null; author: string; body: string; at: string; resolved: boolean; mine: boolean };
type Decision = { id: string; paperId: string | null; label: string; decision: "Include" | "Exclude" | "Escalate"; author: string; at: string; rationale: string; mine: boolean };

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/scifilter-chat`;


const TEAM = [
  { name: "Materials group", members: ["A. Laine", "M. Okonjo", "You"], focus: "Solid-state electrolytes" },
  { name: "R&D Central", members: ["S. Reddy", "You"], focus: "Portfolio scanning" },
  { name: "Innovation scouts", members: ["J. Bauer", "L. Ferreira"], focus: "Patent landscape" },
];

const REVIEWERS = ["A. Laine", "M. Okonjo", "S. Reddy", "You"];

// Deterministic pseudo-assignment so the collaboration board reflects the real corpus
const hash = (s: string) => [...s].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);
const reviewerFor = (key: string) => REVIEWERS[hash(key) % REVIEWERS.length];

const decisionBadge = (d: string) =>
  d === "Include" ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30"
  : d === "Exclude" ? "bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30"
  : "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30";

export default function CollaborationPanel({ papers, selectedId, onSelect, currentUserEmail }: Props) {
  const { toast } = useToast();
  const me = currentUserEmail?.split("@")[0] || "You";

  const [tab, setTab] = useState("queue");
  const [userId, setUserId] = useState<string | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentDraft, setCommentDraft] = useState("");
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [rationale, setRationale] = useState("");
  const [saving, setSaving] = useState(false);
  const [aiKind, setAiKind] = useState<"meeting" | "handover" | "insight" | null>(null);
  const [aiOut, setAiOut] = useState("");
  const [aiBusy, setAiBusy] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const selected = papers.find(p => p.id === selectedId) || null;
  const paperIds = useMemo(() => papers.map(p => p.id).filter(Boolean) as string[], [papers]);
  const paperIdKey = paperIds.join(",");

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
  }, []);

  // Load persisted team activity for the loaded corpus
  const loadActivity = async () => {
    if (paperIds.length === 0) { setComments([]); setDecisions([]); return; }
    const [c, a] = await Promise.all([
      supabase.from("scifilter_comments").select("*").in("paper_id", paperIds).order("created_at", { ascending: false }),
      supabase.from("scifilter_annotations").select("*").in("paper_id", paperIds).eq("kind", "decision").order("updated_at", { ascending: false }),
    ]);
    const titleFor = (id: string) => papers.find(p => p.id === id)?.title ?? "Paper";
    setComments((c.data || []).map((r: any) => ({
      id: r.id, paperId: r.paper_id, author: r.author_label || (r.user_id === userId ? me : "Teammate"),
      body: r.content, at: r.created_at, resolved: !!r.resolved, mine: r.user_id === userId,
    })));
    setDecisions((a.data || []).map((r: any) => {
      let parsed: any = {};
      try { parsed = JSON.parse(r.content); } catch { parsed = { decision: "Include", rationale: r.content }; }
      return {
        id: r.id, paperId: r.paper_id, label: parsed.label || titleFor(r.paper_id),
        decision: (parsed.decision || "Include") as Decision["decision"],
        author: parsed.author || (r.user_id === userId ? me : "Teammate"),
        at: r.updated_at || r.created_at, rationale: parsed.rationale || "", mine: r.user_id === userId,
      };
    }));
  };

  useEffect(() => { loadActivity(); }, [paperIdKey, userId]);

  // Realtime — team activity appears without a refresh
  useEffect(() => {
    if (paperIds.length === 0) return;
    const channel = supabase
      .channel("sifter-collab")
      .on("postgres_changes", { event: "*", schema: "public", table: "scifilter_comments" }, () => loadActivity())
      .on("postgres_changes", { event: "*", schema: "public", table: "scifilter_annotations" }, () => loadActivity())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [paperIdKey, userId]);


  // Shared screening queue — real papers, review state layered on top
  const queue = useMemo(() => papers.map((p, i) => {
    const key = String(p.id ?? p.doi ?? p.title ?? i);
    const decided = decisions.find(d => d.paperId === p.id);
    const reviewer = reviewerFor(key);
    const state = decided ? decided.decision : p.feedback === "relevant" ? "Include" : p.feedback === "not_relevant" ? "Exclude" : null;
    return { paper: p, index: i + 1, reviewer, state, threads: comments.filter(c => c.paperId === p.id).length };
  }), [papers, decisions, comments]);

  const reviewedCount = queue.filter(q => q.state).length;
  const coverage = papers.length ? Math.round((reviewedCount / papers.length) * 100) : 0;

  const perReviewer = useMemo(() => REVIEWERS.map(r => {
    const assigned = queue.filter(q => q.reviewer === r);
    const done = assigned.filter(q => q.state).length;
    return { reviewer: r, assigned: assigned.length, done };
  }), [queue]);

  // Unresolved scientific disagreements: contested papers (open comment threads or escalations)
  const disagreements = useMemo(() => {
    const open = comments.filter(c => !c.resolved && c.paperId);
    const escalated = decisions.filter(d => d.decision === "Escalate");
    const byPaper = new Map<string, { title: string; reasons: string[] }>();
    for (const c of open) {
      const p = papers.find(x => x.id === c.paperId);
      if (!p) continue;
      const e = byPaper.get(c.paperId!) || { title: p.title, reasons: [] };
      e.reasons.push(`${c.author}: ${c.body}`);
      byPaper.set(c.paperId!, e);
    }
    for (const d of escalated) {
      const p = papers.find(x => x.id === d.paperId);
      if (!p) continue;
      const e = byPaper.get(d.paperId!) || { title: p.title, reasons: [] };
      e.reasons.push(`Escalated by ${d.author}: ${d.rationale || "no rationale recorded"}`);
      byPaper.set(d.paperId!, e);
    }
    return [...byPaper.entries()].map(([id, v]) => ({ id, ...v }));
  }, [comments, decisions, papers]);

  // Knowledge timeline — decisions, comments and corpus events in chronological order
  const timeline = useMemo(() => {
    const events: { at: string; kind: string; text: string }[] = [
      ...(papers.length ? [{ at: new Date().toISOString(), kind: "Corpus", text: `${papers.length} papers loaded into the shared screening queue` }] : []),
      ...comments.map(c => ({ at: c.at, kind: "Comment", text: `${c.author} commented${c.paperId ? ` on “${papers.find(p => p.id === c.paperId)?.title?.slice(0, 60) ?? "a paper"}…”` : " on the project"}` })),
      ...decisions.map(d => ({ at: d.at, kind: "Decision", text: `${d.author} marked ${d.decision} — ${d.label.slice(0, 60)}…` })),
    ];
    return events.sort((a, b) => +new Date(b.at) - +new Date(a.at));
  }, [comments, decisions, papers]);

  const addComment = async () => {
    const body = commentDraft.trim();
    if (!body || !userId) return;
    if (!selected?.id) {
      toast({ title: "Select a paper", description: "Comments are threaded on a paper — pick one from the shared queue first." });
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("scifilter_comments").insert({
      paper_id: selected.id, user_id: userId, content: body, author_label: me,
    } as any);
    setSaving(false);
    if (error) return toast({ title: "Comment not saved", description: error.message, variant: "destructive" });
    setCommentDraft("");
    loadActivity();
  };

  const toggleResolved = async (c: Comment) => {
    const { error } = await supabase.from("scifilter_comments").update({ resolved: !c.resolved } as any).eq("id", c.id);
    if (error) return toast({ title: "Could not update", description: error.message, variant: "destructive" });
    loadActivity();
  };

  const deleteComment = async (c: Comment) => {
    const { error } = await supabase.from("scifilter_comments").delete().eq("id", c.id);
    if (error) return toast({ title: "Could not delete", description: error.message, variant: "destructive" });
    loadActivity();
  };

  const record = async (decision: Decision["decision"]) => {
    if (!selected?.id || !userId) {
      toast({ title: "Select a paper", description: "Pick a paper from the shared queue to record a decision against it." });
      return;
    }
    const payload = JSON.stringify({ decision, rationale: rationale.trim(), label: selected.title, author: me });
    const existing = decisions.find(d => d.paperId === selected.id && d.mine);
    setSaving(true);
    const { error } = existing
      ? await supabase.from("scifilter_annotations").update({ content: payload }).eq("id", existing.id)
      : await supabase.from("scifilter_annotations").insert({
          paper_id: selected.id, user_id: userId, kind: "decision", content: payload, is_shared: true,
        });
    setSaving(false);
    if (error) return toast({ title: "Decision not saved", description: error.message, variant: "destructive" });
    setRationale("");
    loadActivity();
    toast({ title: `Decision recorded: ${decision}`, description: "Saved and shared with the team workspace." });
  };


  const runAi = async (kind: "meeting" | "handover" | "insight") => {
    if (papers.length === 0) {
      toast({ title: "No papers loaded", description: "Run a search first — team summaries are grounded in the shared corpus.", variant: "destructive" });
      return;
    }
    const decisionLog = decisions.length
      ? decisions.map(d => `- ${d.decision} — ${d.label} (by ${d.author})${d.rationale ? ` — rationale: ${d.rationale}` : ""}`).join("\n")
      : "No decisions recorded yet.";
    const commentLog = comments.length
      ? comments.map(c => `- ${c.author}${c.resolved ? " (resolved)" : " (open)"}: ${c.body}`).join("\n")
      : "No comments recorded yet.";

    const prompts: Record<typeof kind, string> = {
      meeting: `Write an AI-generated team meeting summary for this screening session. Cover: corpus scope, what the team reviewed, decisions made and by whom, open disagreements, and clear action items with owners. Use the team activity below alongside the paper set.\n\nDECISION LOG:\n${decisionLog}\n\nCOMMENT THREADS:\n${commentLog}`,
      handover: `Write a research handover summary so another researcher can continue this work without losing context. Cover: goal, what was screened, included/excluded with reasons, unresolved scientific disagreements, knowledge gaps, and the next three concrete steps.\n\nDECISION LOG:\n${decisionLog}\n\nCOMMENT THREADS:\n${commentLog}`,
      insight: `Write a cross-team insight brief that another R&D team could reuse. Cover: transferable findings, methods worth reusing, risks or contradictions to be aware of, and which team should see this and why. Avoid duplicating work already decided.\n\nDECISION LOG:\n${decisionLog}\n\nCOMMENT THREADS:\n${commentLog}`,
    };

    setAiKind(kind);
    setAiOut("");
    setAiBusy(true);
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;

    try {
      const res = await fetch(CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ messages: [{ role: "user", content: prompts[kind] }], papers }),
        signal: ac.signal,
      });
      if (res.status === 429) throw new Error("Rate limit reached — please retry shortly.");
      if (res.status === 402) throw new Error("AI credits exhausted. Add credits in Workspace → Usage.");
      if (!res.ok || !res.body) throw new Error("Could not generate the summary.");

      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      let out = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() || "";
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const payload = line.slice(6).trim();
          if (payload === "[DONE]") continue;
          try {
            const delta = JSON.parse(payload)?.choices?.[0]?.delta?.content;
            if (delta) { out += delta; setAiOut(out); }
          } catch { /* partial chunk */ }
        }
      }
    } catch (e: any) {
      if (e?.name !== "AbortError") toast({ title: "Summary failed", description: e.message, variant: "destructive" });
    } finally {
      setAiBusy(false);
    }
  };

  return (
    <TooltipProvider>
      <div className="h-full flex flex-col min-h-0">
        {/* Team workspace header */}
        <div className="border-b px-4 py-3 bg-card/60">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium">Materials group</span>
              <Badge variant="secondary" className="text-[10px]">Team workspace</Badge>
            </div>
            <Separator orientation="vertical" className="h-4" />
            <div className="flex -space-x-1.5">
              {TEAM[0].members.map(m => (
                <Tooltip key={m}>
                  <TooltipTrigger asChild>
                    <span className="h-6 w-6 rounded-full bg-primary/10 border border-primary/20 text-[10px] flex items-center justify-center">
                      {m.split(" ").map(x => x[0]).join("").slice(0, 2)}
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>{m}</TooltipContent>
                </Tooltip>
              ))}
            </div>
            <span className="text-xs text-muted-foreground">Shared queue coverage {coverage}% · {reviewedCount}/{papers.length || 0} reviewed</span>
            <div className="flex-1" />
            <span className="text-[11px] text-muted-foreground hidden lg:block">Scientific collaboration infrastructure</span>
          </div>
          <div className="mt-2 h-1.5 rounded-full bg-muted overflow-hidden">
            <div className="h-full bg-primary/70 transition-all" style={{ width: `${coverage}%` }} />
          </div>
        </div>

        <Tabs value={tab} onValueChange={setTab} className="flex-1 min-h-0 flex flex-col">
          <div className="border-b px-4 py-2">
            <TabsList className="h-8 flex-wrap">
              <TabsTrigger value="queue" className="text-xs gap-1.5"><ClipboardList className="h-3.5 w-3.5" />Shared queue</TabsTrigger>
              <TabsTrigger value="threads" className="text-xs gap-1.5"><MessageSquare className="h-3.5 w-3.5" />Comments</TabsTrigger>
              <TabsTrigger value="decisions" className="text-xs gap-1.5"><ShieldCheck className="h-3.5 w-3.5" />Decisions</TabsTrigger>
              <TabsTrigger value="flow" className="text-xs gap-1.5"><GitCompare className="h-3.5 w-3.5" />Workflow map</TabsTrigger>
              <TabsTrigger value="timeline" className="text-xs gap-1.5"><Clock className="h-3.5 w-3.5" />Timeline</TabsTrigger>
              <TabsTrigger value="handover" className="text-xs gap-1.5"><Handshake className="h-3.5 w-3.5" />Handover &amp; AI</TabsTrigger>
            </TabsList>
          </div>

          {/* SHARED SCREENING QUEUE */}
          <TabsContent value="queue" className="flex-1 min-h-0 m-0">
            <ScrollArea className="h-full">
              <div className="p-3 space-y-2">
                {papers.length === 0 && (
                  <div className="p-10 text-center">
                    <Library className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                    <p className="text-sm text-muted-foreground">Run a search to create a shared screening queue for your team.</p>
                  </div>
                )}
                {queue.map(q => (
                  <Card
                    key={q.paper.id ?? q.index}
                    onClick={() => q.paper.id && onSelect(q.paper.id)}
                    className={`p-3 cursor-pointer transition-colors ${q.paper.id === selectedId ? "border-primary/50 bg-primary/5" : "hover:bg-muted/40"}`}
                  >
                    <div className="flex items-start gap-3">
                      <span className="text-[10px] text-muted-foreground mt-0.5 w-5">[{q.index}]</span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium leading-snug line-clamp-2">{q.paper.title}</p>
                        <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                          <span>{q.paper.year || "Year not specified"}</span>
                          <span>·</span>
                          <span>Assigned to {q.reviewer}</span>
                          {q.threads > 0 && (<><span>·</span><span className="inline-flex items-center gap-1"><MessageSquare className="h-3 w-3" />{q.threads}</span></>)}
                        </div>
                      </div>
                      {q.state ? (
                        <Badge variant="outline" className={`text-[10px] shrink-0 ${decisionBadge(q.state)}`}>{q.state}</Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px] shrink-0 gap-1"><CircleDashed className="h-3 w-3" />Awaiting review</Badge>
                      )}
                    </div>
                  </Card>
                ))}
              </div>
            </ScrollArea>
          </TabsContent>

          {/* COLLABORATIVE COMMENTING */}
          <TabsContent value="threads" className="flex-1 min-h-0 m-0 flex flex-col">
            <div className="px-4 py-2 border-b text-xs text-muted-foreground">
              {selected ? <>Commenting on <span className="text-foreground font-medium">{selected.title.slice(0, 80)}</span></> : "Commenting on the project (select a paper to scope a thread)"}
            </div>
            <ScrollArea className="flex-1">
              <div className="p-3 space-y-2">
                {comments.length === 0 && (
                  <div className="p-10 text-center">
                    <MessageSquare className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                    <p className="text-sm text-muted-foreground">No comments yet. Threads keep screening rationale with the evidence instead of in inboxes.</p>
                  </div>
                )}
                {comments.map(c => {
                  const paper = papers.find(p => p.id === c.paperId);
                  return (
                    <Card key={c.id} className="p-3">
                      <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                        <span className="h-5 w-5 rounded-full bg-primary/10 border border-primary/20 text-[9px] flex items-center justify-center">
                          {c.author.slice(0, 2).toUpperCase()}
                        </span>
                        <span className="text-foreground font-medium">{c.author}</span>
                        <span>{new Date(c.at).toLocaleString()}</span>
                        {c.resolved && <Badge variant="outline" className="text-[10px] gap-1"><CheckCircle2 className="h-3 w-3" />Resolved</Badge>}
                      </div>
                      {paper && <p className="mt-1.5 text-[11px] text-muted-foreground line-clamp-1">on “{paper.title}”</p>}
                      <p className="mt-1.5 text-sm whitespace-pre-wrap">{c.body}</p>
                      <div className="mt-2 flex gap-2">
                        <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => toggleResolved(c)}>
                          {c.resolved ? "Reopen" : "Mark resolved"}
                        </Button>
                        {c.mine && (
                          <Button variant="ghost" size="sm" className="h-6 text-xs text-destructive gap-1" onClick={() => deleteComment(c)}>
                            <Trash2 className="h-3 w-3" />Delete
                          </Button>
                        )}
                      </div>
                    </Card>
                  );
                })}
              </div>
            </ScrollArea>
            <div className="border-t p-3 flex gap-2">
              <Textarea value={commentDraft} onChange={e => setCommentDraft(e.target.value)} rows={2}
                placeholder="Add a comment, a screening rationale, or a question for the team…" className="resize-none text-sm" />
              <Button onClick={addComment} disabled={!commentDraft.trim() || saving} className="self-end">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            </div>

          </TabsContent>

          {/* DECISION TRACKING */}
          <TabsContent value="decisions" className="flex-1 min-h-0 m-0 flex flex-col">
            <div className="border-b p-3 space-y-2">
              <div className="text-xs text-muted-foreground">
                {selected ? <>Record a decision for <span className="text-foreground font-medium">{selected.title.slice(0, 70)}</span></> : "Select a paper in the shared queue to record a decision."}
              </div>
              <Input value={rationale} onChange={e => setRationale(e.target.value)} placeholder="Rationale (kept with the decision for auditability)" className="h-9 text-sm" />
              <div className="flex gap-2">
                <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => record("Include")}>Include</Button>
                <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => record("Exclude")}>Exclude</Button>
                <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => record("Escalate")}>Escalate — disagreement</Button>
              </div>
            </div>
            <ScrollArea className="flex-1">
              <div className="p-3 space-y-2">
                {decisions.length === 0 && (
                  <div className="p-10 text-center">
                    <ShieldCheck className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                    <p className="text-sm text-muted-foreground">Every decision is logged with owner, time and rationale, so no reasoning is lost between projects.</p>
                  </div>
                )}
                {decisions.map(d => (
                  <Card key={d.id} className="p-3">
                    <div className="flex items-start gap-2">
                      <Badge variant="outline" className={`text-[10px] shrink-0 ${decisionBadge(d.decision)}`}>{d.decision}</Badge>
                      <div className="min-w-0">
                        <p className="text-sm font-medium leading-snug line-clamp-2">{d.label}</p>
                        <p className="text-[11px] text-muted-foreground mt-1">{d.author} · {new Date(d.at).toLocaleString()}</p>
                        <p className="text-sm mt-1.5">{d.rationale || <span className="text-muted-foreground">Rationale: Not specified</span>}</p>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </ScrollArea>
          </TabsContent>

          {/* WORKFLOW VISUALISATION */}
          <TabsContent value="flow" className="flex-1 min-h-0 m-0">
            <ScrollArea className="h-full">
              <div className="p-4 space-y-4">
                {/* Who reviewed what */}
                <Card className="p-4">
                  <h3 className="text-sm font-medium flex items-center gap-2"><Users className="h-4 w-4 text-primary" />Who reviewed what</h3>
                  <div className="mt-3 space-y-2.5">
                    {perReviewer.map(r => (
                      <div key={r.reviewer}>
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className="font-medium">{r.reviewer}</span>
                          <span className="text-muted-foreground">{r.done}/{r.assigned} reviewed</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                          <div className="h-full bg-primary/60" style={{ width: `${r.assigned ? (r.done / r.assigned) * 100 : 0}%` }} />
                        </div>
                      </div>
                    ))}
                    {papers.length === 0 && <p className="text-xs text-muted-foreground">No corpus loaded — assignments appear once a search populates the queue.</p>}
                  </div>
                </Card>

                {/* Where decisions were made */}
                <Card className="p-4">
                  <h3 className="text-sm font-medium flex items-center gap-2"><GitCompare className="h-4 w-4 text-primary" />Where decisions were made</h3>
                  <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                    {["Search", "Shared queue", "Screening", "Discussion", "Decision", "Handover"].map((stage, i, arr) => {
                      const counts: Record<string, number> = {
                        Search: papers.length ? 1 : 0,
                        "Shared queue": papers.length,
                        Screening: reviewedCount,
                        Discussion: comments.length,
                        Decision: decisions.length,
                        Handover: aiOut ? 1 : 0,
                      };
                      const n = counts[stage] ?? 0;
                      return (
                        <div key={stage} className="flex items-center gap-2">
                          <div className={`px-2.5 py-1.5 rounded-md border text-[11px] ${n ? "bg-primary/10 border-primary/30" : "bg-muted/40 text-muted-foreground"}`}>
                            {stage} <span className="ml-1 opacity-70">{n}</span>
                          </div>
                          {i < arr.length - 1 && <ArrowRight className="h-3 w-3 text-muted-foreground" />}
                        </div>
                      );
                    })}
                  </div>
                </Card>

                {/* Unresolved disagreements */}
                <Card className="p-4">
                  <h3 className="text-sm font-medium flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-amber-600" />Unresolved scientific disagreements</h3>
                  <div className="mt-3 space-y-2">
                    {disagreements.length === 0 && <p className="text-xs text-muted-foreground">None open. Escalations and unresolved comment threads surface here.</p>}
                    {disagreements.map(d => (
                      <Collapsible key={d.id}>
                        <CollapsibleTrigger className="w-full flex items-center gap-2 text-left text-xs py-1.5 group">
                          <ChevronRight className="h-3.5 w-3.5 transition-transform group-data-[state=open]:rotate-90" />
                          <span className="line-clamp-1 flex-1">{d.title}</span>
                          <Badge variant="outline" className="text-[10px]">{d.reasons.length} open</Badge>
                        </CollapsibleTrigger>
                        <CollapsibleContent className="pl-6 pb-2 space-y-1">
                          {d.reasons.map((r, i) => <p key={i} className="text-xs text-muted-foreground">{r}</p>)}
                        </CollapsibleContent>
                      </Collapsible>
                    ))}
                  </div>
                </Card>

                {/* AI recommendations */}
                <Card className="p-4">
                  <h3 className="text-sm font-medium flex items-center gap-2"><Sparkles className="h-4 w-4 text-primary" />AI-supported recommendations</h3>
                  <ul className="mt-3 space-y-1.5 text-xs text-muted-foreground list-disc pl-5">
                    {papers.length === 0 && <li>Run a search to let the assistant recommend a screening split across the team.</li>}
                    {papers.length > 0 && coverage < 100 && <li>{papers.length - reviewedCount} papers are still awaiting review — reassign from over-loaded reviewers to balance the queue.</li>}
                    {disagreements.length > 0 && <li>{disagreements.length} unresolved disagreement{disagreements.length > 1 ? "s" : ""} — resolve before the handover so decisions are not re-litigated.</li>}
                    {decisions.length > 0 && <li>Generate a meeting summary so the {decisions.length} recorded decision{decisions.length > 1 ? "s" : ""} reach the wider team.</li>}
                    {papers.length > 0 && comments.length === 0 && <li>No discussion captured yet — comment on borderline papers to avoid duplicated screening effort.</li>}
                    <li>Share a cross-team insight brief to stop parallel teams repeating this scan.</li>
                  </ul>
                </Card>
              </div>
            </ScrollArea>
          </TabsContent>

          {/* KNOWLEDGE TIMELINE */}
          <TabsContent value="timeline" className="flex-1 min-h-0 m-0">
            <ScrollArea className="h-full">
              <div className="p-4">
                <h3 className="text-sm font-medium flex items-center gap-2 mb-3"><Clock className="h-4 w-4 text-primary" />Knowledge timeline — continuity across projects</h3>
                {timeline.length === 0 && <p className="text-xs text-muted-foreground">Activity appears here as the team searches, comments and decides.</p>}
                <div className="relative pl-4 border-l space-y-4">
                  {timeline.map((e, i) => (
                    <div key={i} className="relative">
                      <span className="absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full bg-primary/70 border-2 border-background" />
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="text-[10px]">{e.kind}</Badge>
                        <span className="text-[11px] text-muted-foreground">{new Date(e.at).toLocaleString()}</span>
                      </div>
                      <p className="text-sm mt-1">{e.text}</p>
                    </div>
                  ))}
                </div>
              </div>
            </ScrollArea>
          </TabsContent>

          {/* AI SUMMARIES / HANDOVER / CROSS-TEAM SHARING */}
          <TabsContent value="handover" className="flex-1 min-h-0 m-0 flex flex-col">
            <div className="border-b p-3 flex flex-wrap gap-2">
              <Button size="sm" variant={aiKind === "meeting" ? "default" : "outline"} className="h-8 text-xs gap-1.5" onClick={() => runAi("meeting")} disabled={aiBusy}>
                <ClipboardList className="h-3.5 w-3.5" />Meeting summary
              </Button>
              <Button size="sm" variant={aiKind === "handover" ? "default" : "outline"} className="h-8 text-xs gap-1.5" onClick={() => runAi("handover")} disabled={aiBusy}>
                <Handshake className="h-3.5 w-3.5" />Research handover
              </Button>
              <Button size="sm" variant={aiKind === "insight" ? "default" : "outline"} className="h-8 text-xs gap-1.5" onClick={() => runAi("insight")} disabled={aiBusy}>
                <Share2 className="h-3.5 w-3.5" />Cross-team insight brief
              </Button>
              <div className="flex-1" />
              {aiOut && !aiBusy && (
                <Button size="sm" variant="ghost" className="h-8 text-xs gap-1.5"
                  onClick={() => { navigator.clipboard.writeText(aiOut); toast({ title: "Copied", description: "Summary copied — paste it into your shared notes." }); }}>
                  <StickyNote className="h-3.5 w-3.5" />Copy to shared notes
                </Button>
              )}
            </div>
            <ScrollArea className="flex-1">
              <div className="p-4">
                {!aiOut && !aiBusy && (
                  <div className="p-10 text-center">
                    <Handshake className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                    <p className="text-sm text-muted-foreground max-w-md mx-auto">
                      Generate a team summary grounded in the shared corpus, decision log and open threads — so context survives handovers instead of leaving with a person.
                    </p>
                  </div>
                )}
                {aiBusy && !aiOut && <div className="p-8 text-center text-sm text-muted-foreground"><Loader2 className="h-5 w-5 mx-auto mb-2 animate-spin" />Drafting from the team record…</div>}
                {aiOut && (
                  <div className="prose prose-sm dark:prose-invert max-w-none">
                    <ReactMarkdown>{aiOut}</ReactMarkdown>
                  </div>
                )}
              </div>
            </ScrollArea>
            <div className="border-t px-4 py-2 text-[11px] text-muted-foreground">
              Shared with: {TEAM.map(t => t.name).join(" · ")} — AI augments scientific reasoning and organisational collaboration.
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </TooltipProvider>
  );
}
