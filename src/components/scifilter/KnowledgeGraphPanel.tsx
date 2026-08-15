import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Network, Users, GitBranch, Layers, TrendingUp, AlertTriangle, FileText,
  Gauge, ZoomIn, ZoomOut, Maximize2, ExternalLink, Sparkles, Info,
} from "lucide-react";

export type GraphPaper = {
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
};

type Mode = "authors" | "citations" | "methodology" | "topics";

type Node = {
  id: string;
  label: string;
  kind: "paper" | "author" | "cluster" | "topic" | "patent";
  x: number;
  y: number;
  r: number;
  year?: number | null;
  weight: number;
  paper?: GraphPaper;
  meta?: string;
};

type Edge = { a: string; b: string; strength: number; kind: string };

const MIN_ZOOM = 0.4;
const MAX_ZOOM = 4;
const W = 900;
const H = 620;

const methodologyOf = (p: GraphPaper) => {
  const t = `${p.title} ${p.abstract}`.toLowerCase();
  if (/review|meta-analysis|survey/.test(t)) return "Systematic review";
  if (/simulat|finite element|monte carlo|dft/.test(t)) return "Simulation / modelling";
  if (/experiment|fabricat|synthes|measur/.test(t)) return "Experimental study";
  if (/dataset|machine learning|neural|transformer/.test(t)) return "Data-driven / ML";
  if (/theor|analytic/.test(t)) return "Theoretical analysis";
  return "Empirical study";
};

const applicabilityOf = (p: GraphPaper) => {
  const t = `${p.title} ${p.abstract}`.toLowerCase();
  if (/pilot|industrial|manufactur|scale-?up|deploy/.test(t)) return "Near-term industrial";
  if (/prototype|demonstrat|device|process/.test(t)) return "Applied research";
  return "Fundamental research";
};

const patentLike = (p: GraphPaper) =>
  /patent|novel process|apparatus|method for|device for|claim/i.test(`${p.title} ${p.abstract}`);

const direction = (p: GraphPaper) => {
  const t = `${p.title} ${p.abstract}`.toLowerCase();
  const up = (t.match(/increas|improv|enhanc|higher|superior|feasib/g) || []).length;
  const down = (t.match(/decreas|reduc|degrad|lower|limitat|infeasib|fail/g) || []).length;
  if (up > down + 1) return "positive";
  if (down > up + 1) return "negative";
  return "mixed";
};

const authorList = (p: GraphPaper) =>
  (p.authors || "").split(",").map(a => a.trim()).filter(Boolean);

const tokens = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9\s-]/g, " ").split(/\s+/).filter(w => w.length > 4);

const overlap = (a: GraphPaper, b: GraphPaper) => {
  const ca = new Set(a.concepts.map(c => c.toLowerCase()));
  const cb = new Set(b.concepts.map(c => c.toLowerCase()));
  let shared = 0;
  ca.forEach(c => { if (cb.has(c)) shared++; });
  const ta = new Set(tokens(a.title));
  const tb = new Set(tokens(b.title));
  let tShared = 0;
  ta.forEach(t => { if (tb.has(t)) tShared++; });
  return shared * 2 + tShared;
};

const clusterColor = (i: number) => `hsl(var(--chart-${(i % 5) + 1}))`;

export default function KnowledgeGraphPanel({
  papers,
  query,
  selectedId,
  onSelect,
}: {
  papers: GraphPaper[];
  query?: string;
  selectedId?: string | null;
  onSelect?: (id: string) => void;
}) {
  const [mode, setMode] = useState<Mode>("topics");
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [showContradictions, setShowContradictions] = useState(true);
  const [showPatents, setShowPatents] = useState(true);
  const [showApplicability, setShowApplicability] = useState(true);
  const [showCollaboration, setShowCollaboration] = useState(false);
  const [focusId, setFocusId] = useState<string | null>(null);
  const [hoverId, setHoverId] = useState<string | null>(null);

  const years = papers.map(p => p.year).filter((y): y is number => !!y);
  const minYear = years.length ? Math.min(...years) : 2000;
  const maxYear = years.length ? Math.max(...years) : new Date().getFullYear();
  const [yearCut, setYearCut] = useState(maxYear);
  useEffect(() => setYearCut(maxYear), [maxYear]);

  const inWindow = useMemo(
    () => papers.filter(p => !p.year || p.year <= yearCut),
    [papers, yearCut]
  );

  /* ---------------- graph construction (deterministic) ---------------- */
  const { nodes, edges, clusters } = useMemo(() => {
    const nodes: Node[] = [];
    const edges: Edge[] = [];
    const cx = W / 2;
    const cy = H / 2;

    const groupKey = (p: GraphPaper) =>
      mode === "methodology" ? methodologyOf(p)
      : mode === "authors" ? (authorList(p)[0] || "Not specified")
      : mode === "citations" ? (p.citations > 200 ? "Highly cited" : p.citations > 40 ? "Established" : "Emerging")
      : (p.concepts[0] || "Uncategorised");

    const groups = new Map<string, GraphPaper[]>();
    inWindow.forEach(p => {
      const k = groupKey(p);
      groups.set(k, [...(groups.get(k) || []), p]);
    });

    const clusterNames = Array.from(groups.keys()).sort((a, b) =>
      (groups.get(b)!.length - groups.get(a)!.length) || a.localeCompare(b)
    ).slice(0, 8);

    const ringR = Math.min(W, H) * 0.31;
    clusterNames.forEach((name, ci) => {
      const angle = (ci / Math.max(1, clusterNames.length)) * Math.PI * 2 - Math.PI / 2;
      const gx = cx + Math.cos(angle) * ringR;
      const gy = cy + Math.sin(angle) * ringR;
      const members = groups.get(name)!;

      nodes.push({
        id: `cluster:${name}`,
        label: name,
        kind: mode === "authors" ? "author" : mode === "topics" ? "topic" : "cluster",
        x: gx, y: gy,
        r: 16 + Math.min(14, members.length * 1.6),
        weight: members.length,
        meta: `${members.length} paper${members.length === 1 ? "" : "s"}`,
      });

      members.slice(0, 14).forEach((p, pi) => {
        const spread = Math.PI * 1.5;
        const a = angle - spread / 2 + (spread * (pi + 0.5)) / Math.min(14, members.length);
        const dist = 62 + (pi % 3) * 26;
        const id = p.id || `${p.title}-${pi}`;
        nodes.push({
          id,
          label: p.title,
          kind: "paper",
          x: gx + Math.cos(a) * dist,
          y: gy + Math.sin(a) * dist,
          r: 5 + Math.min(9, Math.log10(p.citations + 1) * 3.4),
          year: p.year,
          weight: p.relevance_score,
          paper: p,
          meta: methodologyOf(p),
        });
        edges.push({ a: `cluster:${name}`, b: id, strength: 0.5, kind: "membership" });
      });
    });

    // hidden relationships: concept/title overlap between papers across clusters
    const paperNodes = nodes.filter(n => n.kind === "paper");
    for (let i = 0; i < paperNodes.length; i++) {
      for (let j = i + 1; j < paperNodes.length; j++) {
        const w = overlap(paperNodes[i].paper!, paperNodes[j].paper!);
        if (w >= 3) edges.push({ a: paperNodes[i].id, b: paperNodes[j].id, strength: Math.min(1, w / 8), kind: "semantic" });
      }
    }

    // shared-author (collaboration overlay) edges
    for (let i = 0; i < paperNodes.length; i++) {
      for (let j = i + 1; j < paperNodes.length; j++) {
        const A = new Set(authorList(paperNodes[i].paper!));
        const shared = authorList(paperNodes[j].paper!).filter(a => A.has(a));
        if (shared.length) edges.push({ a: paperNodes[i].id, b: paperNodes[j].id, strength: 0.8, kind: "coauthor" });
      }
    }

    // contradictory findings
    for (let i = 0; i < paperNodes.length; i++) {
      for (let j = i + 1; j < paperNodes.length; j++) {
        const pi = paperNodes[i].paper!, pj = paperNodes[j].paper!;
        const di = direction(pi), dj = direction(pj);
        if (di !== dj && di !== "mixed" && dj !== "mixed" && overlap(pi, pj) >= 2) {
          edges.push({ a: paperNodes[i].id, b: paperNodes[j].id, strength: 1, kind: "contradiction" });
        }
      }
    }

    // patent-adjacent satellites
    if (showPatents) {
      paperNodes.filter(n => patentLike(n.paper!)).slice(0, 6).forEach((n, i) => {
        const id = `patent:${n.id}`;
        nodes.push({
          id,
          label: `Patent-adjacent claim · ${n.paper!.source}`,
          kind: "patent",
          x: n.x + 34, y: n.y - 30 - (i % 2) * 8,
          r: 6, weight: 0.5,
          meta: "Inferred from claim-style language",
        });
        edges.push({ a: n.id, b: id, strength: 0.6, kind: "patent" });
      });
    }

    return { nodes, edges, clusters: clusterNames };
  }, [inWindow, mode, showPatents]);

  const visibleEdges = useMemo(() => edges.filter(e => {
    if (e.kind === "contradiction") return showContradictions;
    if (e.kind === "coauthor") return showCollaboration;
    return true;
  }), [edges, showContradictions, showCollaboration]);

  const nodeById = useMemo(() => new Map(nodes.map(n => [n.id, n])), [nodes]);
  const focus = focusId ? nodeById.get(focusId) : null;
  const neighbours = useMemo(() => {
    if (!focusId) return new Set<string>();
    const s = new Set<string>();
    visibleEdges.forEach(e => {
      if (e.a === focusId) s.add(e.b);
      if (e.b === focusId) s.add(e.a);
    });
    return s;
  }, [focusId, visibleEdges]);

  /* ---------------- zoom & pan ---------------- */
  const containerRef = useRef<HTMLDivElement>(null);
  const stateRef = useRef({ zoom, offset });
  stateRef.current = { zoom, offset };

  const zoomAt = useCallback((px: number, py: number, next: number) => {
    const { zoom: z, offset: o } = stateRef.current;
    const clamped = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, next));
    const k = clamped / z;
    setOffset({ x: px - (px - o.x) * k, y: py - (py - o.y) * k });
    setZoom(clamped);
  }, []);

  const wheelRef = useRef((e: WheelEvent) => {});
  wheelRef.current = (e: WheelEvent) => {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const dy = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 100 : 1);
    zoomAt(e.clientX - rect.left, e.clientY - rect.top, stateRef.current.zoom * Math.exp(-dy * 0.0015));
  };

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => { e.preventDefault(); wheelRef.current(e); };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  const drag = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);
  const onPointerDown = (e: React.PointerEvent) => {
    drag.current = { x: e.clientX, y: e.clientY, ox: offset.x, oy: offset.y };
    (e.target as Element).setPointerCapture?.(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag.current) return;
    setOffset({ x: drag.current.ox + (e.clientX - drag.current.x), y: drag.current.oy + (e.clientY - drag.current.y) });
  };
  const onPointerUp = () => { drag.current = null; };

  const zoomButton = (dir: 1 | -1) => {
    const el = containerRef.current;
    const rect = el?.getBoundingClientRect();
    zoomAt((rect?.width || W) / 2, (rect?.height || H) / 2, zoom * (dir === 1 ? 1.25 : 1 / 1.25));
  };
  const reset = () => { setZoom(1); setOffset({ x: 0, y: 0 }); };

  /* ---------------- derived insight lists ---------------- */
  const influential = useMemo(() => {
    const map = new Map<string, { papers: number; citations: number }>();
    inWindow.forEach(p => authorList(p).forEach(a => {
      const cur = map.get(a) || { papers: 0, citations: 0 };
      map.set(a, { papers: cur.papers + 1, citations: cur.citations + p.citations });
    }));
    return Array.from(map.entries())
      .sort((a, b) => (b[1].papers - a[1].papers) || (b[1].citations - a[1].citations))
      .slice(0, 6);
  }, [inWindow]);

  const contradictionPairs = useMemo(() =>
    edges.filter(e => e.kind === "contradiction").slice(0, 5).map(e => ({
      a: nodeById.get(e.a)?.paper, b: nodeById.get(e.b)?.paper,
    })).filter(x => x.a && x.b), [edges, nodeById]);

  const pathways = useMemo(() => {
    const buckets = new Map<string, number>();
    inWindow.forEach(p => buckets.set(applicabilityOf(p), (buckets.get(applicabilityOf(p)) || 0) + 1));
    return Array.from(buckets.entries()).sort((a, b) => b[1] - a[1]);
  }, [inWindow]);

  const hidden = useMemo(() =>
    edges.filter(e => e.kind === "semantic")
      .sort((a, b) => b.strength - a.strength)
      .slice(0, 4)
      .map(e => ({ a: nodeById.get(e.a)?.paper, b: nodeById.get(e.b)?.paper, strength: e.strength }))
      .filter(x => x.a && x.b), [edges, nodeById]);

  if (!papers.length) {
    return (
      <div className="h-full flex items-center justify-center p-10 text-center">
        <div>
          <Network className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground">Run a search to build the knowledge graph for your corpus.</p>
        </div>
      </div>
    );
  }

  const edgeStyle = (kind: string) => {
    switch (kind) {
      case "contradiction": return { stroke: "hsl(var(--destructive))", dash: "4 3", w: 1.4 };
      case "coauthor": return { stroke: "hsl(var(--primary))", dash: "1 4", w: 1.2 };
      case "patent": return { stroke: "hsl(var(--muted-foreground))", dash: "2 3", w: 1 };
      case "semantic": return { stroke: "hsl(var(--primary))", dash: "", w: 0.9 };
      default: return { stroke: "hsl(var(--border))", dash: "", w: 1 };
    }
  };

  const dimmed = (id: string) => !!focusId && id !== focusId && !neighbours.has(id);

  return (
    <div className="h-full grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_320px] min-h-0">
      {/* GRAPH */}
      <div className="min-h-0 flex flex-col border-r">
        {/* controls */}
        <div className="border-b px-4 py-2.5 space-y-2.5">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground mr-1">Lens</span>
            {([
              ["topics", "Topic map", TrendingUp],
              ["methodology", "Methodology clusters", Layers],
              ["authors", "Author network", Users],
              ["citations", "Citation influence", GitBranch],
            ] as const).map(([key, label, Icon]) => (
              <Button
                key={key}
                variant={mode === key ? "default" : "outline"}
                size="sm"
                className="h-7 text-xs gap-1.5"
                onClick={() => { setMode(key); setFocusId(null); }}
              >
                <Icon className="h-3.5 w-3.5" />{label}
              </Button>
            ))}
            <div className="flex-1" />
            <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => zoomButton(1)} aria-label="Zoom in"><ZoomIn className="h-3.5 w-3.5" /></Button>
            <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => zoomButton(-1)} aria-label="Zoom out"><ZoomOut className="h-3.5 w-3.5" /></Button>
            <Button variant="outline" size="icon" className="h-7 w-7" onClick={reset} aria-label="Reset view"><Maximize2 className="h-3.5 w-3.5" /></Button>
          </div>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <div className="flex items-center gap-2">
              <Switch id="kg-contra" checked={showContradictions} onCheckedChange={setShowContradictions} />
              <Label htmlFor="kg-contra" className="text-xs">Contradictions</Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch id="kg-collab" checked={showCollaboration} onCheckedChange={setShowCollaboration} />
              <Label htmlFor="kg-collab" className="text-xs">Collaboration overlay</Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch id="kg-patents" checked={showPatents} onCheckedChange={setShowPatents} />
              <Label htmlFor="kg-patents" className="text-xs">Patent-adjacent</Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch id="kg-appl" checked={showApplicability} onCheckedChange={setShowApplicability} />
              <Label htmlFor="kg-appl" className="text-xs">Applicability ring</Label>
            </div>
            <div className="flex items-center gap-2 min-w-[200px] flex-1">
              <span className="text-xs text-muted-foreground whitespace-nowrap">Up to {yearCut}</span>
              <Slider
                value={[yearCut]} min={minYear} max={maxYear} step={1}
                onValueChange={v => setYearCut(v[0])}
                className="flex-1"
                aria-label="Temporal evolution"
              />
            </div>
          </div>
        </div>

        {/* canvas */}
        <div
          ref={containerRef}
          className="relative flex-1 min-h-0 overflow-hidden bg-muted/20 cursor-grab active:cursor-grabbing"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerLeave={onPointerUp}
          style={{ touchAction: "none" }}
        >
          <svg width="100%" height="100%" viewBox={`0 0 ${W} ${H}`} className="select-none">
            <defs>
              <pattern id="kg-grid" width="28" height="28" patternUnits="userSpaceOnUse">
                <path d="M28 0H0V28" fill="none" stroke="hsl(var(--border))" strokeWidth="0.5" opacity="0.5" />
              </pattern>
            </defs>
            <rect width={W} height={H} fill="url(#kg-grid)" />
            <g transform={`translate(${offset.x} ${offset.y}) scale(${zoom})`}>
              {showApplicability && (
                <g opacity="0.5">
                  {[0.2, 0.33, 0.46].map((f, i) => (
                    <circle key={i} cx={W / 2} cy={H / 2} r={Math.min(W, H) * f}
                      fill="none" stroke="hsl(var(--primary))" strokeOpacity={0.16} strokeDasharray="3 6" />
                  ))}
                  <text x={W / 2} y={H / 2 - Math.min(W, H) * 0.46 - 6} textAnchor="middle"
                    className="fill-muted-foreground" style={{ fontSize: 9 }}>Fundamental → applied → industrial pathway</text>
                </g>
              )}

              {visibleEdges.map((e, i) => {
                const a = nodeById.get(e.a), b = nodeById.get(e.b);
                if (!a || !b) return null;
                const st = edgeStyle(e.kind);
                const faded = dimmed(a.id) && dimmed(b.id);
                return (
                  <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y}
                    stroke={st.stroke} strokeWidth={st.w} strokeDasharray={st.dash}
                    strokeOpacity={faded ? 0.08 : e.kind === "membership" ? 0.5 : 0.45 + e.strength * 0.4} />
                );
              })}

              {nodes.map(n => {
                const ci = Math.max(0, clusters.indexOf(n.kind === "paper" ? "" : n.label));
                const isCluster = n.kind !== "paper" && n.kind !== "patent";
                const isSelected = n.paper && (n.paper.id === selectedId);
                const faded = dimmed(n.id);
                const fill = isCluster
                  ? clusterColor(clusters.indexOf(n.label))
                  : n.kind === "patent"
                    ? "hsl(var(--muted))"
                    : n.paper!.relevance === "High" ? "hsl(var(--primary))"
                    : n.paper!.relevance === "Medium" ? "hsl(var(--primary) / 0.55)"
                    : "hsl(var(--muted-foreground) / 0.5)";
                return (
                  <g key={n.id} opacity={faded ? 0.18 : 1}
                    onMouseEnter={() => setHoverId(n.id)}
                    onMouseLeave={() => setHoverId(null)}
                    onClick={() => {
                      setFocusId(prev => (prev === n.id ? null : n.id));
                      if (n.paper?.id) onSelect?.(n.paper.id);
                    }}
                    style={{ cursor: "pointer" }}
                  >
                    <circle cx={n.x} cy={n.y} r={n.r}
                      fill={fill}
                      stroke={isSelected || focusId === n.id ? "hsl(var(--foreground))" : "hsl(var(--background))"}
                      strokeWidth={isSelected || focusId === n.id ? 2 : 1} />
                    {(isCluster || hoverId === n.id || focusId === n.id) && (
                      <text
                        x={n.x} y={n.y - n.r - 5} textAnchor="middle"
                        className="fill-foreground pointer-events-none"
                        style={{ fontSize: isCluster ? 10 : 9, fontWeight: isCluster ? 600 : 400 }}
                      >
                        {n.label.length > 46 ? `${n.label.slice(0, 46)}…` : n.label}
                      </text>
                    )}
                  </g>
                );
              })}
            </g>
          </svg>

          <div className="absolute bottom-2 left-2 flex flex-wrap items-center gap-2.5 rounded-md border bg-card/90 px-2.5 py-1.5 text-[10px] text-muted-foreground backdrop-blur">
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-primary" />High relevance</span>
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-muted-foreground/50" />Low relevance</span>
            <span className="flex items-center gap-1"><span className="h-px w-4 border-t border-dashed border-destructive" />Contradiction</span>
            <span className="flex items-center gap-1"><Info className="h-3 w-3" />Scroll to zoom · drag to pan · click to expand context</span>
          </div>
        </div>
      </div>

      {/* CONTEXT SIDEBAR */}
      <ScrollArea className="min-h-0">
        <div className="p-3 space-y-3">
          <Card className="p-3">
            <div className="flex items-center gap-1.5 text-xs font-medium mb-2"><Sparkles className="h-3.5 w-3.5 text-primary" />Graph context</div>
            {focus ? (
              <div className="space-y-2">
                <div className="text-sm font-medium leading-snug">{focus.label}</div>
                <div className="flex flex-wrap gap-1.5">
                  <Badge variant="outline" className="text-[10px]">{focus.kind}</Badge>
                  {focus.meta && <Badge variant="secondary" className="text-[10px]">{focus.meta}</Badge>}
                  {focus.paper && <Badge variant="outline" className="text-[10px]">{focus.paper.year ?? "Not specified"}</Badge>}
                </div>
                {focus.paper && (
                  <>
                    <p className="text-[11px] text-muted-foreground leading-relaxed">
                      {focus.paper.abstract ? `${focus.paper.abstract.slice(0, 220)}…` : "Abstract: Not specified"}
                    </p>
                    <div className="text-[11px] text-muted-foreground">
                      Applicability pathway: <span className="text-foreground">{applicabilityOf(focus.paper)}</span>
                    </div>
                    {focus.paper.url && (
                      <a href={focus.paper.url} target="_blank" rel="noreferrer"
                        className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline">
                        Open source <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                  </>
                )}
                <div className="text-[11px] text-muted-foreground">
                  {neighbours.size} connected node{neighbours.size === 1 ? "" : "s"} in view
                </div>
                <Button variant="outline" size="sm" className="h-7 text-xs w-full" onClick={() => setFocusId(null)}>Clear focus</Button>
              </div>
            ) : (
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Click any node to expand its scientific context. Connections are derived from your corpus only — shared concepts, shared authors, and opposing findings. Nothing is invented.
              </p>
            )}
          </Card>

          <Card className="p-3">
            <div className="flex items-center gap-1.5 text-xs font-medium mb-2"><Users className="h-3.5 w-3.5" />Influential researchers</div>
            <div className="space-y-1.5">
              {influential.length === 0 && <div className="text-[11px] text-muted-foreground">Not specified</div>}
              {influential.map(([name, s]) => (
                <div key={name} className="flex items-center justify-between gap-2 text-[11px]">
                  <span className="truncate">{name}</span>
                  <span className="text-muted-foreground whitespace-nowrap">{s.papers}p · {s.citations} cit.</span>
                </div>
              ))}
            </div>
          </Card>

          <Card className="p-3">
            <div className="flex items-center gap-1.5 text-xs font-medium mb-2"><Network className="h-3.5 w-3.5" />Hidden relationships</div>
            <div className="space-y-2">
              {hidden.length === 0 && <div className="text-[11px] text-muted-foreground">No strong cross-cluster links in this window.</div>}
              {hidden.map((h, i) => (
                <div key={i} className="text-[11px] leading-relaxed">
                  <span className="text-foreground">{h.a!.title.slice(0, 52)}…</span>
                  <span className="text-muted-foreground"> ↔ </span>
                  <span className="text-foreground">{h.b!.title.slice(0, 52)}…</span>
                  <div className="text-muted-foreground">Shared conceptual overlap · strength {(h.strength * 100).toFixed(0)}%</div>
                </div>
              ))}
            </div>
          </Card>

          <Card className="p-3">
            <div className="flex items-center gap-1.5 text-xs font-medium mb-2"><AlertTriangle className="h-3.5 w-3.5 text-destructive" />Contradictory findings</div>
            <div className="space-y-2">
              {contradictionPairs.length === 0 && <div className="text-[11px] text-muted-foreground">None detected in this window.</div>}
              {contradictionPairs.map((c, i) => (
                <div key={i} className="text-[11px] leading-relaxed">
                  <div className="text-foreground">{c.a!.title.slice(0, 60)}…</div>
                  <div className="text-muted-foreground">opposes</div>
                  <div className="text-foreground">{c.b!.title.slice(0, 60)}…</div>
                  <div className="text-muted-foreground">Requires human verification</div>
                  {i < contradictionPairs.length - 1 && <Separator className="mt-2" />}
                </div>
              ))}
            </div>
          </Card>

          <Card className="p-3">
            <div className="flex items-center gap-1.5 text-xs font-medium mb-2"><Gauge className="h-3.5 w-3.5" />Industrial applicability pathways</div>
            <div className="space-y-1.5">
              {pathways.map(([label, count]) => (
                <div key={label}>
                  <div className="flex items-center justify-between text-[11px] mb-0.5">
                    <span>{label}</span><span className="text-muted-foreground">{count}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                    <div className="h-full bg-primary" style={{ width: `${(count / Math.max(1, inWindow.length)) * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card className="p-3">
            <div className="flex items-center gap-1.5 text-xs font-medium mb-2"><FileText className="h-3.5 w-3.5" />Patent-adjacent signals</div>
            <div className="space-y-1.5">
              {inWindow.filter(patentLike).slice(0, 5).map(p => (
                <div key={p.id || p.title} className="text-[11px] leading-relaxed">
                  <span className="text-foreground">{p.title.slice(0, 60)}…</span>
                  <div className="text-muted-foreground">Claim-style language detected · verify in a patent database</div>
                </div>
              ))}
              {inWindow.filter(patentLike).length === 0 && <div className="text-[11px] text-muted-foreground">Not specified</div>}
            </div>
          </Card>
        </div>
      </ScrollArea>
    </div>
  );
}
