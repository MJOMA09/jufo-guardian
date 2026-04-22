import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Send, Sparkles, Loader2 } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { useToast } from "@/hooks/use-toast";

type Msg = { role: "user" | "assistant"; content: string };

interface Props { papers: any[]; }

const QUICK_PROMPTS = [
  "Which papers are most relevant?",
  "Summarise the methodology",
  "What are the key findings?",
  "Compare the approaches",
];

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/scifilter-chat`;

export default function ChatPanel({ papers }: Props) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const send = async (text: string) => {
    if (!text.trim() || streaming) return;
    if (papers.length === 0) {
      toast({ title: "No papers", description: "Run a search first.", variant: "destructive" });
      return;
    }
    const userMsg: Msg = { role: "user", content: text };
    const next = [...messages, userMsg];
    setMessages(next);
    setInput("");
    setStreaming(true);

    try {
      const resp = await fetch(CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ messages: next, papers }),
      });

      if (!resp.ok || !resp.body) {
        if (resp.status === 429) toast({ title: "Rate limited", description: "Try again shortly.", variant: "destructive" });
        else if (resp.status === 402) toast({ title: "Credits exhausted", description: "Add credits in Workspace → Usage.", variant: "destructive" });
        else toast({ title: "Chat failed", variant: "destructive" });
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
    } catch (e) {
      toast({ title: "Chat error", description: String(e), variant: "destructive" });
    } finally {
      setStreaming(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 px-4 py-3 border-b">
        <Sparkles className="h-4 w-4 text-primary" />
        <h3 className="font-semibold text-sm">Research Assistant</h3>
      </div>
      <ScrollArea className="flex-1 px-4" ref={scrollRef as any}>
        <div className="py-4 space-y-4">
          {messages.length === 0 && (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Ask anything about your current papers:</p>
              <div className="flex flex-wrap gap-2">
                {QUICK_PROMPTS.map(p => (
                  <Button key={p} size="sm" variant="outline" className="text-xs h-auto py-1.5" onClick={() => send(p)}>
                    {p}
                  </Button>
                ))}
              </div>
            </div>
          )}
          {messages.map((m, i) => (
            <div key={i} className={`text-sm ${m.role === "user" ? "text-foreground" : "text-foreground"}`}>
              <div className={`text-xs font-medium mb-1 ${m.role === "user" ? "text-primary" : "text-muted-foreground"}`}>
                {m.role === "user" ? "You" : "Assistant"}
              </div>
              <div className="prose prose-sm dark:prose-invert max-w-none">
                <ReactMarkdown>{m.content || (streaming && i === messages.length - 1 ? "..." : "")}</ReactMarkdown>
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>
      <form className="border-t p-3 flex gap-2" onSubmit={e => { e.preventDefault(); send(input); }}>
        <Input value={input} onChange={e => setInput(e.target.value)} placeholder="Ask about your papers..." disabled={streaming} />
        <Button type="submit" size="icon" disabled={streaming || !input.trim()}>
          {streaming ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      </form>
    </div>
  );
}
