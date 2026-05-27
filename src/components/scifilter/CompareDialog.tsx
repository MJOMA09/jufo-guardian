import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { Paper } from "@/types/scifilter";

export default function CompareDialog({ open, onOpenChange, papers }: {
  open: boolean; onOpenChange: (v: boolean) => void; papers: Paper[];
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[85vh]">
        <DialogHeader>
          <DialogTitle>Side-by-side comparison · {papers.length} papers</DialogTitle>
        </DialogHeader>
        <ScrollArea className="max-h-[70vh]">
          <div className={`grid gap-4 ${papers.length === 2 ? "grid-cols-2" : papers.length === 3 ? "grid-cols-3" : "grid-cols-2 lg:grid-cols-4"}`}>
            {papers.map(p => (
              <div key={p.id} className="border rounded-md p-3 space-y-3 text-xs">
                <div>
                  <Badge variant="outline" className="mb-1">{p.relevance}</Badge>
                  <h4 className="font-semibold text-sm leading-tight">{p.title}</h4>
                  <p className="text-muted-foreground mt-1">{p.authors} · {p.year}</p>
                </div>
                <Field label="Summary">{p.summary || "Not specified"}</Field>
                <Field label="Methodology">{p.methodology || "Not specified"}</Field>
                <Field label="Why selected">{p.explanation}</Field>
                <Field label="Applicability">{p.applicability || "Unknown"}</Field>
                <Field label="Citations">{p.citations}</Field>
                <Field label="Concepts">
                  <div className="flex flex-wrap gap-1 mt-0.5">
                    {(p.concepts || []).slice(0, 5).map(c => <Badge key={c} variant="outline" className="text-[10px]">{c}</Badge>)}
                  </div>
                </Field>
                <Field label="Confidence">{Math.round((p.confidence ?? 0) * 100)}%</Field>
              </div>
            ))}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div>
    <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">{label}</div>
    <div className="text-foreground/90">{children}</div>
  </div>
);
