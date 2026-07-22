import { useState, useRef, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Send, Loader2, Beaker, ClipboardList, Cog, Factory, GitCompare, Users,
  Layers, ScrollText, Handshake, ChevronRight, FileText, ShieldCheck,
  ExternalLink, Sparkles, Info, StopCircle, Eraser,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import { useToast } from "@/hooks/use-toast";

type Msg = { role: "user" | "assistant"; content: string; intent?: string };

interface Props { papers: any[]; }

const CAPABILITIES = [
  { id: "search",       label: "Semantic search",        icon: Beaker,      prompt: "Perform a semantic scan of this corpus and identify the papers most conceptually aligned with the user goal. Explain each match." },
  { id: "screen",       label: "Title/abstract screen",  icon: ClipboardList, prompt: "Screen the current papers by title and abstract. For each, decide Include / Exclude / Unclear with a one-line reason grounded in the abstract." },
  { id: "methods",      label: "Extract methodology",    icon: Cog,         prompt: "Extract the methodology from each paper: study type, data, techniques, and evaluation. Say 'Not specified' where the abstract does not support it." },
  { id: "industrial",   label: "Industrial applicability", icon: Factory,   prompt: "Estimate industrial applicability and approximate TRL band (1–9) for each paper. Justify from the abstract only, and flag low-confidence cases." },
  { id: "contradict",   label: "Contradiction check",    icon: GitCompare,  prompt: "Detect contradictory or disagreeing findings across the current papers. Cite the specific pairs [n] vs [m] and quote the disagreement." },
  { id: "authors",      label: "Related authors",        icon: Users,       prompt: "Identify the most influential authors in the current set and any collaboration patterns visible from the metadata." },
  { id: "cluster",      label: "Cluster papers",         icon: Layers,      prompt: "Cluster these papers into 3–5 thematic groups. Name each cluster, list its papers by [n], and describe what unites them." },
  { id: "summary",      label: "Workflow summary",       icon: ScrollText,  prompt: "Produce a workflow summary of what has been screened so far: coverage, key themes, gaps, and recommended next steps." },
  { id: "handover",     label: "Engineering handover",   icon: Handshake,   prompt: "Write an engineering handover: what was reviewed, key actionable findings, open questions, and recommended follow-up experiments or reads." },
];

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/scifilter-chat`;

// Parse [1], [2, 3] citations from assistant text
function extractCitations(text: string): number[] {
  const set = new Set<number>();
  const re = /\[(\d+(?:\s*,\s*\d+)*)\]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    m[1].split(",").map(s => parseInt(s.trim(), 10)).forEach(n => !isNaN(n) && set.add(n));
  }
  return [...set].sort((a, b) => a - b);
}

// Confidence heuristic: explicit "Confidence: X" line, else infer from hedging
function inferConfidence(text: string): { level: "High" | "Medium" | "Low"; reason?: string } {
  const explicit = text.match(/confidence\s*[:\-]\s*(high|medium|low)([^\n]*)/i);
  if (explicit) return { level: explicit[1][0].toUpperCase() + explicit[1].slice(1).toLowerCase() as any, reason: explicit[2]?.trim().replace(/^[—\-–:]\s*/, "") || undefined };
  const hedges = (text.match(/\b(not specified|unclear|uncertain|insufficient|cannot determine|limited)\b/gi) || []).length;
  if (hedges >= 3) return { level: "Low" };
  if (hedges >= 1) return { level: "Medium" };
  return { level: "High" };
}

// Try to split off a leading "Reasoning" trace block if the model produced one
function splitReasoning(text: string): { reasoning?: string; body: string } {
  const m = text.match(/^\s*(?:###?\s*)?(?:reasoning trace|reasoning)\s*[:\n]([\s\S]*?)(?:\n\s*(?:###?\s*)?(?:answer|response|analysis|findings|screening|synthesis|prioritisation|prioritization|handover|summary|conclusion)\b[:\n]|\n\n)([\s\S]*)$/i);
  if (m) return { reasoning: m[1].trim(), body: m[2].trim() };
  return { body: text };
}

const confidenceStyle = (l: string) =>
  l === "High" ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30"
  : l === "Medium" ? "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30"
  : "bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30";

export default function ChatPanel({ papers }: Props) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [memory, setMemory] = useState<string[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const send = async (text: string, intent?: string) => {
    if (!text.trim() || streaming) return;
    if (papers.length === 0) {
      toast({ title: "No papers loaded", description: "Run a search first — the assistant grounds every answer in your current corpus.", variant: "destructive" });
      return;
    }
    const userMsg: Msg = { role: "user", content: text, intent };
    const next = [...messages, userMsg];
    setMessages(next);
    setInput("");
    setStreaming(true);
    if (intent) setMemory(m => [intent, ...m.filter(i => i !== intent)].slice(0, 6));

    const ctrl = new AbortController();
    abortRef.current = ctrl;

    try {
      const resp = await fetch(CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ messages: next, papers }),
        signal: ctrl.signal,
      });

      if (!resp.ok || !resp.body) {
        if (resp.status === 429) toast({ title: "Rate limited", description: "Try again shortly.", variant: "destructive" });
        else if (resp.status === 402) toast({ title: "Credits exhausted", description: "Add credits in Workspace → Usage.", variant: "destructive" });
        else toast({ title: "Assistant unavailable", variant: "destructive" });
        setStreaming(false);
        return;
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      let acc = "";
      let done = false;
      setMessages(m => [...m, { role: "assistant", content: "" }]);

      while (!done) {
        const { done: d, value } = await reader.read();
        if (d) break;
        buf += decoder.decode(value, { stream: true });
        let idx;
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
            if (c) {
              acc += c;
              setMessages(m => m.map((msg, i) => i === m.length - 1 ? { ...msg, content: acc } : msg));
            }
          } catch {
            buf = line + "\n" + buf;
            break;
          }
        }
      }
    } catch (e: any) {
      if (e?.name !== "AbortError") toast({ title: "Assistant error", description: String(e?.message || e), variant: "destructive" });
    } finally {
      setStreaming(false);
      abortRef.current = null;
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  };

  const stop = () => { abortRef.current?.abort(); };
  const clear = () => { setMessages([]); setMemory([]); };

  const lastAssistant = useMemo(() => [...messages].reverse().find(m => m.role === "assistant"), [messages]);
  const activeCitations = useMemo(() => lastAssistant ? extractCitations(lastAssistant.content) : [], [lastAssistant]);

  return (
    <TooltipProvider delayDuration={200}>
      <div className="flex h-full min-h-0">
        {/* Main conversation */}
        <div className="flex flex-col min-w-0 flex-1 border-r">
          {/* Identity + memory */}
          <div className="px-4 py-2.5 border-b bg-card/50 flex items-center gap-2">
            <div className="h-6 w-6 rounded bg-accent-gradient grid place-items-center shadow-soft">
              <Sparkles className="h-3.5 w-3.5 text-primary-foreground" />
            </div>
            <div className="min-w-0">
              <div className="text-sm font-semibold leading-tight">Research Assistant</div>
              <div className="text-[10px] text-muted-foreground leading-tight flex items-center gap-1">
                <ShieldCheck className="h-2.5 w-2.5" />
                Grounded in {papers.length} paper{papers.length === 1 ? "" : "s"} · shows reasoning &amp; evidence
              </div>
            </div>
            <div className="flex-1" />
            {messages.length > 0 && (
              <Button variant="ghost" size="sm" onClick={clear} className="h-7 text-xs gap-1">
                <Eraser className="h-3 w-3" />Reset
              </Button>
            )}
          </div>

          {memory.length > 0 && (
            <div className="px-4 py-1.5 border-b bg-muted/30 flex items-center gap-2 overflow-x-auto">
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground shrink-0">Workflow memory</span>
              {memory.map(m => {
                const cap = CAPABILITIES.find(c => c.id === m);
                if (!cap) return null;
                const Icon = cap.icon;
                return (
                  <Badge key={m} variant="secondary" className="text-[10px] gap-1 shrink-0 font-normal">
                    <Icon className="h-2.5 w-2.5" />{cap.label}
                  </Badge>
                );
              })}
            </div>
          )}

          {/* Conversation */}
          <ScrollArea className="flex-1" ref={scrollRef as any}>
            <div className="p-4 space-y-4">
              {messages.length === 0 && (
                <div className="space-y-4">
                  <div className="rounded-lg border border-dashed p-4 bg-muted/20">
                    <div className="flex items-start gap-2">
                      <Info className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                      <div className="text-xs text-muted-foreground leading-relaxed">
                        I augment your scientific reasoning — I <b>do not replace it</b>. Every claim I make is
                        grounded in the papers loaded in your workspace, cited by [number], and paired with a
                        confidence indicator. Expand any answer to see the reasoning trace.
                      </div>
                    </div>
                  </div>

                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">Capabilities</div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                      {CAPABILITIES.map(c => {
                        const Icon = c.icon;
                        return (
                          <button
                            key={c.id}
                            onClick={() => send(c.prompt, c.id)}
                            className="text-left rounded-md border px-2.5 py-2 hover:border-primary/50 hover:bg-accent/40 transition-colors flex items-center gap-2 group"
                          >
                            <Icon className="h-3.5 w-3.5 text-primary shrink-0" />
                            <span className="text-xs font-medium truncate">{c.label}</span>
                            <ChevronRight className="h-3 w-3 text-muted-foreground ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">Example prompts</div>
                    <div className="space-y-1.5">
                      {[
                        "Find industrially relevant papers on hydrogen degradation.",
                        "Which of these papers are closest to TRL 6?",
                        "Find contradictory findings across the current set.",
                        "Summarise this for engineering handover.",
                        "Identify other influential work from these authors.",
                      ].map(ex => (
                        <button key={ex} onClick={() => send(ex)} className="w-full text-left text-xs text-muted-foreground hover:text-foreground px-2.5 py-1.5 rounded border border-transparent hover:border-border hover:bg-accent/30 transition-colors">
                          "{ex}"
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {messages.map((m, i) => {
                if (m.role === "user") {
                  return (
                    <div key={i} className="flex flex-col items-end">
                      <div className="text-[10px] text-muted-foreground mb-1">You</div>
                      <div className="max-w-[85%] rounded-lg bg-primary text-primary-foreground px-3 py-2 text-sm whitespace-pre-wrap">
                        {m.content}
                      </div>
                    </div>
                  );
                }
                return (
                  <AssistantMessage
                    key={i}
                    content={m.content}
                    papers={papers}
                    streaming={streaming && i === messages.length - 1}
                  />
                );
              })}
            </div>
          </ScrollArea>

          {/* Composer */}
          <form
            className="border-t p-3 space-y-2 bg-card/50"
            onSubmit={e => { e.preventDefault(); send(input); }}
          >
            <div className="relative">
              <Textarea
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input); } }}
                placeholder="Ask about your papers — I'll cite [n] and show reasoning..."
                disabled={streaming}
                rows={2}
                className="resize-none pr-24 text-sm"
              />
              <div className="absolute right-2 bottom-2 flex gap-1">
                {streaming ? (
                  <Button type="button" size="sm" variant="outline" onClick={stop} className="h-7 gap-1">
                    <StopCircle className="h-3.5 w-3.5" />Stop
                  </Button>
                ) : (
                  <Button type="submit" size="sm" disabled={!input.trim()} className="h-7 gap-1">
                    <Send className="h-3.5 w-3.5" />Send
                  </Button>
                )}
              </div>
            </div>
            <div className="flex items-center justify-between text-[10px] text-muted-foreground">
              <span>Enter to send · Shift+Enter for newline</span>
              <span className="flex items-center gap-1"><ShieldCheck className="h-2.5 w-2.5" />Answers stay grounded in loaded papers</span>
            </div>
          </form>
        </div>

        {/* Evidence / citations panel */}
        <aside className="w-72 shrink-0 hidden lg:flex flex-col bg-card/30 min-h-0">
          <div className="px-3 py-2.5 border-b flex items-center gap-2">
            <FileText className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Evidence</span>
            {activeCitations.length > 0 && (
              <Badge variant="secondary" className="ml-auto text-[10px] h-4">{activeCitations.length}</Badge>
            )}
          </div>
          <ScrollArea className="flex-1">
            <div className="p-3 space-y-3">
              {!lastAssistant && (
                <p className="text-xs text-muted-foreground">
                  Cited papers will appear here as the assistant answers. Every [n] in a response links to a
                  specific paper in your workspace so you can verify the reasoning.
                </p>
              )}
              {lastAssistant && activeCitations.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  The last answer did not cite specific papers. Ask a more targeted question to get traceable citations.
                </p>
              )}
              {activeCitations.map(n => {
                const p = papers[n - 1];
                if (!p) return (
                  <div key={n} className="text-xs text-muted-foreground border rounded-md p-2">
                    [{n}] — reference out of range.
                  </div>
                );
                return (
                  <div key={n} className="rounded-md border p-2.5 space-y-1 bg-background hover:border-primary/40 transition-colors">
                    <div className="flex items-start gap-2">
                      <Badge variant="outline" className="text-[10px] h-4 shrink-0 font-mono">[{n}]</Badge>
                      <div className="text-xs font-medium leading-snug line-clamp-3">{p.title}</div>
                    </div>
                    <div className="text-[10px] text-muted-foreground line-clamp-1 ml-1">
                      {p.authors || "Not specified"} · {p.year || "n.d."} · {p.source || "Not specified"}
                    </div>
                    {p.url && (
                      <a href={p.url} target="_blank" rel="noreferrer" className="ml-1 inline-flex items-center gap-1 text-[10px] text-primary hover:underline">
                        <ExternalLink className="h-2.5 w-2.5" />{p.doi || "Open source"}
                      </a>
                    )}
                  </div>
                );
              })}

              {papers.length > 0 && (
                <>
                  <Separator className="my-2" />
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Full corpus</div>
                  <div className="text-[11px] text-muted-foreground">
                    {papers.length} paper{papers.length === 1 ? "" : "s"} loaded and available for grounding.
                  </div>
                </>
              )}
            </div>
          </ScrollArea>
        </aside>
      </div>
    </TooltipProvider>
  );
}

function AssistantMessage({ content, papers, streaming }: { content: string; papers: any[]; streaming: boolean }) {
  const { reasoning, body } = useMemo(() => splitReasoning(content), [content]);
  const confidence = useMemo(() => inferConfidence(content), [content]);
  const cites = useMemo(() => extractCitations(content), [content]);
  const [openReasoning, setOpenReasoning] = useState(false);

  // Turn [n] into hoverable chips inline via a markdown rewrite step
  const rewritten = useMemo(() => body.replace(/\[(\d+(?:\s*,\s*\d+)*)\]/g, (_, g) => {
    const nums = g.split(",").map((s: string) => s.trim());
    return nums.map((n: string) => `\`[${n}]\``).join(" ");
  }), [body]);

  return (
    <div className="flex flex-col">
      <div className="text-[10px] text-muted-foreground mb-1 flex items-center gap-2">
        <Sparkles className="h-2.5 w-2.5 text-primary" />Research Assistant
        {!streaming && content && (
          <Badge variant="outline" className={`h-4 text-[10px] font-normal ${confidenceStyle(confidence.level)}`}>
            {confidence.level} confidence
          </Badge>
        )}
        {!streaming && cites.length > 0 && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge variant="secondary" className="h-4 text-[10px] font-normal gap-1">
                <FileText className="h-2.5 w-2.5" />{cites.length} citation{cites.length === 1 ? "" : "s"}
              </Badge>
            </TooltipTrigger>
            <TooltipContent><p className="text-xs">Verify each in the evidence panel →</p></TooltipContent>
          </Tooltip>
        )}
      </div>

      <div className="rounded-lg border bg-card px-3.5 py-3 text-sm">
        {reasoning && (
          <Collapsible open={openReasoning} onOpenChange={setOpenReasoning}>
            <CollapsibleTrigger className="flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground mb-2">
              <ChevronRight className={`h-3 w-3 transition-transform ${openReasoning ? "rotate-90" : ""}`} />
              <span className="uppercase tracking-wider font-semibold">Reasoning trace</span>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="rounded-md bg-muted/40 border border-dashed p-2.5 mb-3 text-xs text-muted-foreground whitespace-pre-wrap">
                {reasoning}
              </div>
            </CollapsibleContent>
          </Collapsible>
        )}

        <div className="prose prose-sm dark:prose-invert max-w-none prose-p:my-2 prose-ul:my-2 prose-headings:mt-3 prose-headings:mb-1.5 prose-code:text-[11px] prose-code:font-mono prose-code:bg-primary/10 prose-code:text-primary prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:before:content-none prose-code:after:content-none">
          <ReactMarkdown>{rewritten || (streaming ? "_Thinking…_" : "")}</ReactMarkdown>
        </div>

        {!streaming && cites.length > 0 && (
          <div className="mt-3 pt-2 border-t border-dashed flex items-center gap-1.5 flex-wrap">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground mr-1">Cites:</span>
            {cites.map(n => {
              const p = papers[n - 1];
              return (
                <Tooltip key={n}>
                  <TooltipTrigger asChild>
                    <Badge variant="outline" className="text-[10px] font-mono h-4 cursor-help">[{n}]</Badge>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-xs">
                    <p className="text-xs font-medium leading-snug">{p?.title || "Reference out of range"}</p>
                    {p && <p className="text-[10px] text-muted-foreground mt-0.5">{p.authors} · {p.year}</p>}
                  </TooltipContent>
                </Tooltip>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
