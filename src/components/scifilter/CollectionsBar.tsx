import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Folder, Plus, Users } from "lucide-react";
import type { Collection } from "@/types/scifilter";

interface Props {
  collections: Collection[];
  activeId: string | null;
  onSelect: (id: string | null) => void;
  onCreate: (name: string, description: string, isShared: boolean) => Promise<void>;
}

export default function CollectionsBar({ collections, activeId, onSelect, onCreate }: Props) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [shared, setShared] = useState(true);

  const create = async () => {
    if (!name.trim()) return;
    await onCreate(name.trim(), desc.trim(), shared);
    setName(""); setDesc(""); setShared(true); setOpen(false);
  };

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Folder className="h-3.5 w-3.5" />Workflow:
      </div>
      <Button size="sm" variant={activeId === null ? "default" : "outline"} className="h-7 text-xs" onClick={() => onSelect(null)}>
        All results
      </Button>
      {collections.map(c => (
        <Button key={c.id} size="sm" variant={activeId === c.id ? "default" : "outline"}
          className="h-7 text-xs" onClick={() => onSelect(c.id)}>
          {c.name}
          {c.is_shared && <Users className="h-3 w-3 ml-1 opacity-70" />}
        </Button>
      ))}
      <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setOpen(true)}>
        <Plus className="h-3 w-3 mr-1" />New collection
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>New workflow collection</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label className="text-xs">Name</Label><Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Battery materials Q3" /></div>
            <div><Label className="text-xs">Description</Label><Input value={desc} onChange={e => setDesc(e.target.value)} placeholder="Purpose / project context" /></div>
            <div className="flex items-center justify-between rounded-md border p-3">
              <div>
                <div className="text-sm font-medium">Share with team</div>
                <div className="text-xs text-muted-foreground">Other signed-in users can view this collection.</div>
              </div>
              <Switch checked={shared} onCheckedChange={setShared} />
            </div>
          </div>
          <DialogFooter><Button onClick={create} disabled={!name.trim()}>Create</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
