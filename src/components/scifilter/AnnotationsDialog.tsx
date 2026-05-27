import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Loader2, Sparkles, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import type { Paper, Annotation, Comment } from "@/types/scifilter";

interface Props {
  paper: Paper | null;
  userId: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

export default function AnnotationsDialog({ paper, userId, open, onOpenChange }: Props) {
  const { toast } = useToast();
  const [tab, setTab] = useState("findings");
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [text, setText] = useState("");
  const [shared, setShared] = useState(true);
  const [kind, setKind] = useState<"finding" | "note" | "handover">("finding");
  const [comment, setComment] = useState("");
  const [generating, setGenerating] = useState(false);
  const [aiSummary, setAiSummary] = useState("");

  useEffect(() => {
    if (!open || !paper?.id) return;
    (async () => {
      const [{ data: a }, { data: c }] = await Promise.all([
        supabase.from("scifilter_annotations").select("*").eq("paper_id", paper.id).order("created_at", { ascending: false }),
        supabase.from("scifilter_comments").select("*").eq("paper_id", paper.id).order("created_at", { ascending: true }),
      ]);
      setAnnotations((a || []) as any);
      setComments((c || []) as any);
      setAiSummary("");
    })();
  }, [open, paper?.id]);

  const addAnnotation = async () => {
    if (!paper?.id || !text.trim()) return;
    const { data, error } = await supabase.from("scifilter_annotations").insert({
      paper_id: paper.id, user_id: userId, content: text.trim(), kind, is_shared: shared,
    }).select().single();
    if (error) { toast({ title: "Failed", description: error.message, variant: "destructive" }); return; }
    setAnnotations(a => [data as any, ...a]); setText("");
  };

  const addComment = async () => {
    if (!paper?.id || !comment.trim()) return;
    const { data, error } = await supabase.from("scifilter_comments").insert({
      paper_id: paper.id, user_id: userId, content: comment.trim(),
    }).select().single();
    if (error) { toast({ title: "Failed", description: error.message, variant: "destructive" }); return; }
    setComments(c => [...c, data as any]); setComment("");
  };

  const generateHandover = async () => {
    if (!paper) return;
    setGenerating(true); setAiSummary("");
    try {
      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/scifilter-chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}` },
        body: JSON.stringify({
          messages: [{
            role: "user",
            content: `Write a concise team handover summary (5-7 bullets) for this paper so a colleague can pick up the research thread. Cover: what it claims, methodology, why it was selected, our team annotations, open questions. Use only the data provided.\n\nAnnotations from team:\n${annotations.map(a => `- [${a.kind}] ${a.content}`).join("\n") || "(none)"}`,
          }],
          papers: [paper],
        }),
      });
      if (!resp.ok || !resp.body) throw new Error("AI request failed");
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
          if (j === "[DONE]") { setGenerating(false); return; }
          try { const c = JSON.parse(j).choices?.[0]?.delta?.content; if (c) { acc += c; setAiSummary(acc); } } catch {}
        }
      }
    } catch (e: any) {
      toast({ title: "Generation failed", description: e.message, variant: "destructive" });
    } finally { setGenerating(false); }
  };

  if (!paper) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-sm leading-tight">{paper.title}</DialogTitle>
        </DialogHeader>
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="findings">Annotations</TabsTrigger>
            <TabsTrigger value="comments">Team comments</TabsTrigger>
            <TabsTrigger value="handover">AI handover</TabsTrigger>
          </TabsList>

          <TabsContent value="findings" className="space-y-3">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                {(["finding", "note", "handover"] as const).map(k => (
                  <Button key={k} size="sm" variant={kind === k ? "default" : "outline"} className="h-7 text-xs capitalize" onClick={() => setKind(k)}>{k}</Button>
                ))}
                <div className="ml-auto flex items-center gap-2">
                  <Label htmlFor="sh" className="text-xs"><Users className="h-3 w-3 inline mr-1" />Share</Label>
                  <Switch id="sh" checked={shared} onCheckedChange={setShared} />
                </div>
              </div>
              <Textarea value={text} onChange={e => setText(e.target.value)} placeholder="Capture a finding, method note, or handover detail…" rows={3} />
              <Button size="sm" onClick={addAnnotation} disabled={!text.trim()}>Add annotation</Button>
            </div>
            <ScrollArea className="h-[280px] border rounded-md">
              <div className="p-3 space-y-2">
                {annotations.length === 0 && <p className="text-xs text-muted-foreground">No annotations yet.</p>}
                {annotations.map(a => (
                  <div key={a.id} className="text-xs border-l-2 border-primary/40 pl-2 py-1">
                    <div className="flex items-center gap-2 mb-0.5">
                      <Badge variant="outline" className="text-[10px] capitalize">{a.kind}</Badge>
                      {a.is_shared && <Badge variant="secondary" className="text-[10px]"><Users className="h-2.5 w-2.5 mr-1" />shared</Badge>}
                      <span className="text-muted-foreground">{new Date(a.created_at).toLocaleString()}</span>
                    </div>
                    <p>{a.content}</p>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="comments" className="space-y-3">
            <div className="space-y-2">
              <Textarea value={comment} onChange={e => setComment(e.target.value)} placeholder="Discuss this paper with your team…" rows={2} />
              <Button size="sm" onClick={addComment} disabled={!comment.trim()}>Post comment</Button>
            </div>
            <ScrollArea className="h-[280px] border rounded-md">
              <div className="p-3 space-y-2">
                {comments.length === 0 && <p className="text-xs text-muted-foreground">No comments yet.</p>}
                {comments.map(c => (
                  <div key={c.id} className="text-xs">
                    <span className="text-muted-foreground">{new Date(c.created_at).toLocaleString()}</span>
                    <p>{c.content}</p>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="handover" className="space-y-3">
            <Button size="sm" onClick={generateHandover} disabled={generating}>
              {generating ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Sparkles className="h-3 w-3 mr-1" />}
              Generate handover summary
            </Button>
            <ScrollArea className="h-[280px] border rounded-md p-3">
              <pre className="text-xs whitespace-pre-wrap font-sans">{aiSummary || "Generate an AI summary that pulls together the paper, your team's annotations, and open questions — ready to hand off."}</pre>
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
