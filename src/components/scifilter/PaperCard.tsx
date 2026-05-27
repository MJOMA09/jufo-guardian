import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Progress } from "@/components/ui/progress";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  ThumbsUp, ThumbsDown, HelpCircle, ChevronDown, ExternalLink,
  Sparkles, MessageSquare, FolderPlus, GitCompare, Beaker, Users
} from "lucide-react";
import type { Paper } from "@/types/scifilter";

interface Props {
  paper: Paper;
  selected: boolean;
  onToggleSelect: () => void;
  onFeedback: (v: "relevant" | "maybe_relevant" | "not_relevant") => void;
  onOpenAnnotations: () => void;
  onAddToCollection: () => void;
  onFocus: () => void;
  isFocused: boolean;
}

const relevanceTone = (r: string) =>
  r === "High" ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
  : r === "Medium" ? "bg-amber-500/10 text-amber-600 border-amber-500/20"
  : "bg-muted text-muted-foreground";

const applicabilityTone = (a: string) =>
  a === "High" ? "text-emerald-600" : a === "Medium" ? "text-amber-600" : a === "Low" ? "text-muted-foreground" : "text-muted-foreground";

const ReasonBar = ({ label, value }: { label: string; value: number }) => (
  <div className="grid grid-cols-[100px_1fr_36px] items-center gap-2 text-xs">
    <span className="text-muted-foreground">{label}</span>
    <Progress value={Math.round(value * 100)} className="h-1.5" />
    <span className="text-right tabular-nums text-muted-foreground">{Math.round(value * 100)}%</span>
  </div>
);

export default function PaperCard({ paper, selected, onToggleSelect, onFeedback, onOpenAnnotations, onAddToCollection, onFocus, isFocused }: Props) {
  const [open, setOpen] = useState(false);
  const rb = paper.reason_breakdown || {};
  const fb = paper.feedback;

  return (
    <Card
      onClick={onFocus}
      className={`p-4 transition-all cursor-pointer ${isFocused ? "ring-2 ring-primary" : ""} ${fb === "not_relevant" ? "opacity-60" : ""}`}
    >
      <div className="flex items-start gap-3">
        <Checkbox checked={selected} onCheckedChange={onToggleSelect} onClick={(e) => e.stopPropagation()} className="mt-1" />
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="font-semibold leading-tight text-sm">{paper.title}</h3>
              <p className="text-xs text-muted-foreground mt-1 truncate">
                {paper.authors || "Unknown"} · {paper.year ?? "—"} · {paper.source}
              </p>
            </div>
            <div className="flex flex-col items-end gap-1 shrink-0">
              <Badge variant="outline" className={relevanceTone(paper.relevance)}>{paper.relevance}</Badge>
              <Tooltip>
                <TooltipTrigger>
                  <span className="text-[10px] text-muted-foreground tabular-nums">
                    conf {Math.round((paper.confidence ?? 0) * 100)}%
                  </span>
                </TooltipTrigger>
                <TooltipContent><p className="text-xs max-w-[200px]">AI confidence in this relevance judgement.</p></TooltipContent>
              </Tooltip>
            </div>
          </div>

          {/* AI summary */}
          <div className="mt-3 space-y-2">
            <div className="flex items-start gap-1.5 text-xs">
              <Sparkles className="h-3.5 w-3.5 text-primary mt-0.5 shrink-0" />
              <p className="text-foreground/90"><span className="font-medium">Summary: </span>{paper.summary || "Not specified"}</p>
            </div>
            <div className="flex items-start gap-1.5 text-xs">
              <Beaker className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
              <p className="text-muted-foreground"><span className="font-medium text-foreground">Method: </span>{paper.methodology || "Not specified"}</p>
            </div>
            <div className="flex items-start gap-1.5 text-xs">
              <span className="text-foreground"><span className="font-medium">Why selected: </span>{paper.explanation}</span>
            </div>
          </div>

          {/* meta row */}
          <div className="flex flex-wrap items-center gap-2 mt-3">
            <Badge variant="secondary" className="text-[10px]">
              Applicability: <span className={`ml-1 font-medium ${applicabilityTone(paper.applicability || "Unknown")}`}>{paper.applicability || "Unknown"}</span>
            </Badge>
            <Badge variant="secondary" className="text-[10px]">{paper.citations} citations</Badge>
            {(paper.concepts || []).slice(0, 3).map(c => (
              <Badge key={c} variant="outline" className="text-[10px]">{c}</Badge>
            ))}
          </div>

          {/* Why-this-paper panel */}
          <Collapsible open={open} onOpenChange={setOpen} className="mt-3">
            <CollapsibleTrigger asChild>
              <button
                onClick={e => e.stopPropagation()}
                className="flex items-center gap-1 text-xs text-primary hover:underline"
              >
                <HelpCircle className="h-3.5 w-3.5" />
                Why this paper?
                <ChevronDown className={`h-3 w-3 transition-transform ${open ? "rotate-180" : ""}`} />
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-2 p-3 rounded-md bg-muted/40 border space-y-1.5" onClick={e => e.stopPropagation()}>
              <p className="text-[11px] text-muted-foreground mb-2">Transparent relevance signals (each independently computed):</p>
              <ReasonBar label="Semantic" value={rb.semantic ?? 0} />
              <ReasonBar label="Methodology" value={rb.methodology ?? 0} />
              <ReasonBar label="Topic overlap" value={rb.topic ?? 0} />
              <ReasonBar label="Author signal" value={rb.author ?? 0} />
              <ReasonBar label="Citation" value={rb.citation ?? 0} />
              {rb.keyword_matches && (
                <p className="text-[11px] text-muted-foreground pt-1">Keyword matches: {rb.keyword_matches}</p>
              )}
              {paper.related_authors && paper.related_authors.length > 0 && (
                <div className="pt-2 border-t mt-2">
                  <div className="flex items-center gap-1 text-[11px] font-medium mb-1"><Users className="h-3 w-3" /> Authors</div>
                  <div className="flex flex-wrap gap-1">
                    {paper.related_authors.slice(0, 6).map(a => (
                      <Badge key={a.name} variant="outline" className="text-[10px] font-normal">{a.name}</Badge>
                    ))}
                  </div>
                </div>
              )}
            </CollapsibleContent>
          </Collapsible>

          {/* Actions */}
          <div className="flex items-center justify-between flex-wrap gap-2 mt-3 pt-3 border-t" onClick={e => e.stopPropagation()}>
            <div className="inline-flex gap-1">
              <Button size="sm" variant={fb === "relevant" ? "default" : "outline"} className="h-7 text-xs" onClick={() => onFeedback("relevant")}>
                <ThumbsUp className="h-3 w-3 mr-1" />Relevant
              </Button>
              <Button size="sm" variant={fb === "maybe_relevant" ? "secondary" : "outline"} className="h-7 text-xs" onClick={() => onFeedback("maybe_relevant")}>
                <HelpCircle className="h-3 w-3 mr-1" />Maybe
              </Button>
              <Button size="sm" variant={fb === "not_relevant" ? "destructive" : "outline"} className="h-7 text-xs" onClick={() => onFeedback("not_relevant")}>
                <ThumbsDown className="h-3 w-3 mr-1" />Not relevant
              </Button>
            </div>
            <div className="inline-flex gap-1">
              <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={onOpenAnnotations}>
                <MessageSquare className="h-3 w-3 mr-1" />Annotate
              </Button>
              <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={onAddToCollection}>
                <FolderPlus className="h-3 w-3 mr-1" />Save
              </Button>
              {paper.url && (
                <Button size="sm" variant="ghost" className="h-7 text-xs" asChild>
                  <a href={paper.url} target="_blank" rel="noreferrer"><ExternalLink className="h-3 w-3 mr-1" />Open</a>
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}
