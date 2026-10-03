import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { SifterLogo } from "@/components/Header";
import {
  Sparkles,
  Search,
  Users,
  Network,
  ShieldCheck,
  BookOpen,
  Microscope,
  ArrowRight,
  CheckCircle2,
  FileText,
  Quote,
  Workflow,
  GitBranch,
} from "lucide-react";

/* ---------- Reveal-on-scroll wrapper ---------- */
const Reveal = ({ children, delay = 0, className = "" }: { children: React.ReactNode; delay?: number; className?: string }) => {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => e.isIntersecting && (setVisible(true), io.disconnect()),
      { threshold: 0.15 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <div
      ref={ref}
      style={{ transitionDelay: `${delay}ms` }}
      className={`transition-all duration-700 ease-out ${visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"} ${className}`}
    >
      {children}
    </div>
  );
};

/* ---------- Top nav ---------- */
const Nav = () => (
  <header className="sticky top-0 z-40 backdrop-blur-md bg-background/75 border-b border-border/60">
    <div className="container flex h-16 items-center justify-between">
      <div className="flex items-center gap-2">
        <SifterLogo className="h-9 w-auto max-w-[132px] sm:max-w-[156px]" />
        <span className="ml-1 text-[10px] uppercase tracking-widest text-muted-foreground border border-border rounded px-1.5 py-0.5">
          for R&amp;D
        </span>
      </div>
      <nav className="hidden md:flex items-center gap-8 text-sm text-muted-foreground">
        <a href="#workflow" className="hover:text-foreground transition-colors">Workflow</a>
        <a href="#features" className="hover:text-foreground transition-colors">Features</a>
        <a href="#trust" className="hover:text-foreground transition-colors">Trust</a>
      </nav>
      <div className="flex items-center gap-2">
        <Link to="/auth" className="hidden sm:inline-flex">
          <Button variant="ghost" size="sm">Sign in</Button>
        </Link>
        <Link to="/app">
          <Button size="sm" className="bg-accent-gradient text-primary-foreground hover:opacity-90 shadow-soft">
            Start Screening
          </Button>
        </Link>
      </div>
    </div>
  </header>
);

/* ---------- Hero illustration: research workspace ---------- */
const HeroVisual = () => (
  <div className="relative">
    {/* Soft glow */}
    <div className="absolute -inset-8 bg-accent-gradient opacity-[0.07] blur-3xl rounded-full" aria-hidden />
    <div className="relative rounded-2xl border border-border/80 bg-card shadow-elevated overflow-hidden">
      {/* Window chrome */}
      <div className="flex items-center gap-2 px-4 h-9 border-b border-border/60 bg-muted/40">
        <div className="flex gap-1.5">
          <div className="h-2.5 w-2.5 rounded-full bg-border" />
          <div className="h-2.5 w-2.5 rounded-full bg-border" />
          <div className="h-2.5 w-2.5 rounded-full bg-border" />
        </div>
        <div className="mx-auto text-[11px] text-muted-foreground tracking-wide">sifter · screening workspace</div>
      </div>

      <div className="grid grid-cols-12 gap-0">
        {/* Sidebar: collections */}
        <aside className="col-span-3 border-r border-border/60 p-4 space-y-3 bg-muted/20">
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Collections</div>
          {["Solid-state batteries", "Perovskite stability", "Catalysis ↗ CO₂", "Team review queue"].map((c, i) => (
            <div
              key={c}
              className={`flex items-center gap-2 text-xs px-2 py-1.5 rounded-md ${i === 0 ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >
              <BookOpen className="h-3 w-3" /> {c}
            </div>
          ))}
          <div className="pt-2 mt-2 border-t border-border/60 text-[10px] uppercase tracking-widest text-muted-foreground">Teammates</div>
          <div className="flex -space-x-1.5">
            {["A", "K", "M", "+2"].map((n, i) => (
              <div key={i} className="h-6 w-6 rounded-full ring-2 ring-card bg-secondary text-[10px] flex items-center justify-center text-foreground/70">
                {n}
              </div>
            ))}
          </div>
        </aside>

        {/* Main: papers list */}
        <main className="col-span-6 p-4 space-y-2">
          <div className="flex items-center justify-between mb-1">
            <div className="text-xs font-medium text-foreground">23 papers · sifted</div>
            <div className="text-[10px] text-muted-foreground">AI ranked · explainable</div>
          </div>
          {[
            { t: "Interfacial engineering in solid-state Li-metal cells", r: 0.94, why: ["keyword", "recency", "high citations"] },
            { t: "Garnet electrolytes — review of dendrite suppression", r: 0.88, why: ["domain match", "review article"] },
            { t: "Sulfide vs. oxide electrolytes: comparative study", r: 0.81, why: ["methodology", "keyword"] },
            { t: "In situ XRD of cycled Li/LLZO interfaces", r: 0.72, why: ["technique match"] },
          ].map((p, i) => (
            <div
              key={i}
              className="group border border-border/70 rounded-lg p-3 hover:border-primary/40 hover:bg-accent/30 transition-all"
              style={{ animation: `fade-in 0.6s ${i * 90}ms ease-out both` }}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-2 min-w-0">
                  <FileText className="h-3.5 w-3.5 mt-0.5 text-primary shrink-0" />
                  <div className="text-xs font-medium text-foreground truncate">{p.t}</div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <div className="h-1.5 w-12 bg-secondary rounded-full overflow-hidden">
                    <div className="h-full bg-accent-gradient" style={{ width: `${p.r * 100}%` }} />
                  </div>
                  <span className="text-[10px] tabular-nums text-muted-foreground">{p.r.toFixed(2)}</span>
                </div>
              </div>
              <div className="mt-1.5 flex flex-wrap gap-1 pl-5">
                {p.why.map((w) => (
                  <span key={w} className="text-[10px] px-1.5 py-0.5 rounded bg-accent text-accent-foreground border border-border/50">
                    {w}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </main>

        {/* Right: AI reasoning */}
        <aside className="col-span-3 p-4 border-l border-border/60 bg-muted/10">
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-2">AI reasoning</div>
          <div className="text-[11px] leading-relaxed text-foreground/80 space-y-2">
            <p>Top results favor <em>interfacial</em> and <em>dendrite</em> work post-2022.</p>
            <p className="text-muted-foreground">Suggested next step: compare LLZO vs. argyrodite electrolytes.</p>
          </div>
          <div className="mt-3 pt-3 border-t border-border/60">
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-2">Knowledge graph</div>
            <svg viewBox="0 0 120 80" className="w-full h-20">
              <g fill="none" stroke="hsl(var(--primary))" strokeOpacity="0.35" strokeWidth="0.6">
                <line x1="20" y1="40" x2="60" y2="20" />
                <line x1="20" y1="40" x2="60" y2="60" />
                <line x1="60" y1="20" x2="100" y2="35" />
                <line x1="60" y1="60" x2="100" y2="55" />
                <line x1="60" y1="20" x2="60" y2="60" />
              </g>
              {[
                [20, 40], [60, 20], [60, 60], [100, 35], [100, 55],
              ].map(([x, y], i) => (
                <circle key={i} cx={x} cy={y} r="3" className="fill-primary" style={{ animation: `pulse-ring 2.4s ${i * 0.4}s infinite` }} />
              ))}
            </svg>
          </div>
        </aside>
      </div>

      {/* Status bar */}
      <div className="flex items-center justify-between px-4 h-8 border-t border-border/60 bg-muted/30 text-[10px] text-muted-foreground">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1"><CheckCircle2 className="h-3 w-3 text-primary" /> Synced with Crossref + OpenAlex</span>
        </div>
        <span>2 teammates viewing</span>
      </div>
    </div>
  </div>
);

/* ---------- Sections ---------- */
const features = [
  { icon: Sparkles, title: "AI Research Assistant", body: "Ask questions across your sources. Synthesise, compare methodologies, and prioritise papers in plain language." },
  { icon: Users, title: "Collaborative Research Workflows", body: "Annotate, tag, and review papers with your team. Build shared screening pipelines that survive personnel changes." },
  { icon: ShieldCheck, title: "Explainable Scientific Recommendations", body: "Every relevance score shows its reasoning: keyword match, domain, recency, citation signal — nothing hidden." },
  { icon: Network, title: "Knowledge Transfer Across Teams", body: "Turn screening sessions into reusable collections. New team members start from accumulated context, not zero." },
  { icon: Microscope, title: "Scientific Discovery and Screening", body: "Search Crossref and OpenAlex in real time. Filter by year and domain. Export structured results to CSV." },
  { icon: ShieldCheck, title: "Trusted AI Support for R&D Work", body: "AI grounded in your papers — never invents citations. Designed for engineers, scientists, and innovation teams." },
];

const workflow = [
  { icon: Search, t: "Search", d: "Query open scientific APIs in real time." },
  { icon: Workflow, t: "Screen", d: "AI ranks by relevance, with explainable signals." },
  { icon: GitBranch, t: "Organise", d: "Cluster into collections shared with your team." },
  { icon: BookOpen, t: "Operationalise", d: "Synthesise findings into decisions." },
];

const Index = () => {
  return (
    <div className="min-h-screen bg-soft text-foreground antialiased">
      <Nav />

      {/* ============ HERO ============ */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-grid opacity-[0.35] [mask-image:radial-gradient(ellipse_at_top,black_30%,transparent_75%)]" aria-hidden />
        <div className="container relative pt-20 pb-24 lg:pt-28 lg:pb-32">
          <div className="grid lg:grid-cols-12 gap-12 items-center">
            <div className="lg:col-span-6 space-y-7">
              <Reveal>
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-border/80 bg-card/60 text-xs text-muted-foreground">
                  <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
                  Free for R&amp;D professionals · No credit card
                </div>
              </Reveal>
              <Reveal delay={80}>
                <h1 className="font-display text-5xl md:text-6xl lg:text-7xl leading-[1.02] text-balance">
                  AI-Assisted{" "}
                  <span className="italic text-primary">Knowledge Workflows</span>{" "}
                  for R&amp;D Professionals
                </h1>
              </Reveal>
              <Reveal delay={160}>
                <p className="text-lg text-muted-foreground max-w-xl text-balance leading-relaxed">
                  Reduce information overload and accelerate scientific discovery with AI-supported research workflows — built for collaborative sensemaking, not generic search.
                </p>
              </Reveal>
              <Reveal delay={240}>
                <div className="flex flex-wrap items-center gap-3 pt-2">
                  <Link to="/app">
                    <Button size="lg" className="bg-accent-gradient text-primary-foreground hover:opacity-90 shadow-elevated h-12 px-6 text-base">
                      Start Screening
                      <ArrowRight className="ml-1.5 h-4 w-4" />
                    </Button>
                  </Link>
                  <a href="#workflow">
                    <Button size="lg" variant="outline" className="h-12 px-6 text-base border-border/80">
                      Explore the Workflow
                    </Button>
                  </a>
                </div>
              </Reveal>
              <Reveal delay={320}>
                <div className="flex items-center gap-6 pt-4 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5 text-primary" /> Crossref + OpenAlex</span>
                  <span className="flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5 text-primary" /> Explainable scoring</span>
                  <span className="flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5 text-primary" /> Team-ready</span>
                </div>
              </Reveal>
            </div>

            <div className="lg:col-span-6">
              <Reveal delay={200}>
                <HeroVisual />
              </Reveal>
            </div>
          </div>
        </div>
      </section>

      {/* ============ WORKFLOW STRIP ============ */}
      <section id="workflow" className="border-y border-border/60 bg-card/40">
        <div className="container py-16">
          <Reveal>
            <div className="max-w-2xl">
              <div className="text-xs uppercase tracking-widest text-primary mb-3">The Sifter loop</div>
              <h2 className="font-display text-3xl md:text-4xl leading-tight text-balance">
                A calm, four-step research workflow.
              </h2>
            </div>
          </Reveal>
          <div className="mt-12 grid md:grid-cols-4 gap-px bg-border/70 rounded-xl overflow-hidden border border-border/70">
            {workflow.map((w, i) => (
              <Reveal key={w.t} delay={i * 90}>
                <div className="bg-card p-6 h-full hover:bg-accent/30 transition-colors group">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mb-4">
                    <span className="tabular-nums">0{i + 1}</span>
                    <span className="h-px flex-1 bg-border" />
                  </div>
                  <w.icon className="h-5 w-5 text-primary mb-3 group-hover:scale-110 transition-transform" />
                  <div className="font-medium text-foreground">{w.t}</div>
                  <div className="text-sm text-muted-foreground mt-1.5 leading-relaxed">{w.d}</div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ============ FEATURES ============ */}
      <section id="features" className="container py-24">
        <Reveal>
          <div className="max-w-2xl mb-14">
            <div className="text-xs uppercase tracking-widest text-primary mb-3">Built for R&amp;D</div>
            <h2 className="font-display text-4xl md:text-5xl leading-[1.05] text-balance">
              A focused scientific workspace —{" "}
              <span className="text-muted-foreground">not another search box.</span>
            </h2>
          </div>
        </Reveal>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
          {features.map((f, i) => (
            <Reveal key={f.title} delay={(i % 3) * 80}>
              <div className="group h-full p-7 rounded-xl border border-border/70 bg-card hover:border-primary/30 hover:shadow-elevated transition-all duration-300">
                <div className="h-10 w-10 rounded-lg bg-accent flex items-center justify-center mb-5 group-hover:bg-accent-gradient transition-colors">
                  <f.icon className="h-5 w-5 text-primary group-hover:text-primary-foreground transition-colors" />
                </div>
                <h3 className="font-medium text-lg text-foreground">{f.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed mt-2">{f.body}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ============ TRUST ============ */}
      <section id="trust" className="border-t border-border/60 bg-card/40">
        <div className="container py-24 grid lg:grid-cols-12 gap-12 items-center">
          <Reveal className="lg:col-span-6">
            <div>
              <Quote className="h-6 w-6 text-primary mb-5" />
              <p className="font-display text-2xl md:text-3xl leading-snug text-balance">
                “Sifter feels like the quiet research notebook our lab always needed —
                grounded in the literature, but generous with synthesis.”
              </p>
              <div className="mt-6 text-sm text-muted-foreground">
                Designed alongside R&amp;D scientists, materials engineers, and innovation leads.
              </div>
            </div>
          </Reveal>
          <Reveal delay={120} className="lg:col-span-6">
            <div className="grid grid-cols-2 gap-px bg-border/70 rounded-xl overflow-hidden border border-border/70">
              {[
                { k: "Open APIs", v: "Crossref · OpenAlex" },
                { k: "Grounded AI", v: "No invented citations" },
                { k: "Privacy", v: "Per-user encrypted data" },
                { k: "Pricing", v: "Free for R&D" },
              ].map((s) => (
                <div key={s.k} className="bg-card p-6">
                  <div className="text-xs uppercase tracking-widest text-muted-foreground">{s.k}</div>
                  <div className="font-display text-xl mt-1.5">{s.v}</div>
                </div>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      {/* ============ CTA ============ */}
      <section className="container py-28">
        <Reveal>
          <div className="relative overflow-hidden rounded-2xl border border-border/70 bg-card p-12 lg:p-16 text-center shadow-soft">
            <div className="absolute inset-0 bg-accent-gradient opacity-[0.04]" aria-hidden />
            <div className="relative">
              <h2 className="font-display text-4xl md:text-5xl leading-tight text-balance max-w-3xl mx-auto">
                Start sifting the literature that actually matters.
              </h2>
              <p className="mt-4 text-muted-foreground max-w-xl mx-auto">
                Free for R&amp;D professionals. Sign in and run your first screening session in under a minute.
              </p>
              <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
                <Link to="/app">
                  <Button size="lg" className="bg-accent-gradient text-primary-foreground hover:opacity-90 shadow-elevated h-12 px-7 text-base">
                    Start Screening
                    <ArrowRight className="ml-1.5 h-4 w-4" />
                  </Button>
                </Link>
                <Link to="/auth">
                  <Button size="lg" variant="ghost" className="h-12 px-6 text-base">
                    Create account
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </Reveal>
      </section>

      {/* ============ FOOTER ============ */}
      <footer className="border-t border-border/60">
        <div className="container py-10 flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <SifterLogo className="h-7 w-auto max-w-[120px]" />
            <span>· AI-supported research for R&amp;D</span>
          </div>
          <div className="flex items-center gap-6">
            <a href="#workflow" className="hover:text-foreground transition-colors">Workflow</a>
            <a href="#features" className="hover:text-foreground transition-colors">Features</a>
            <Link to="/app" className="hover:text-foreground transition-colors">Launch app</Link>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Index;
