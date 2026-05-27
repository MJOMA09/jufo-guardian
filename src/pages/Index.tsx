import React, { useEffect } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  ArrowRight,
  Sparkles,
  Users,
  Brain,
  Network,
  Workflow,
  ShieldCheck,
  Search,
  Quote,
  CheckCircle2,
  GitBranch,
  MessageSquare,
} from "lucide-react";

/* ---------------------- Utilities ---------------------- */

const useReveal = () => {
  useEffect(() => {
    const els = document.querySelectorAll<HTMLElement>("[data-reveal]");
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add("opacity-100", "translate-y-0");
            e.target.classList.remove("opacity-0", "translate-y-4");
          }
        });
      },
      { threshold: 0.12 }
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);
};

/* ---------------------- Nav ---------------------- */

const Nav: React.FC = () => (
  <header className="sticky top-0 z-40 w-full border-b border-border/60 bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
    <div className="container mx-auto flex h-16 items-center justify-between px-6">
      <Link to="/" className="flex items-center gap-2">
        <div className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-accent shadow-soft">
          <span className="font-display text-lg italic text-primary-foreground">S</span>
        </div>
        <span className="text-base font-semibold tracking-tight text-foreground">Sifter</span>
      </Link>
      <nav className="hidden items-center gap-8 md:flex">
        {["Product", "Workflows", "Research", "Pricing"].map((l) => (
          <a key={l} href={`#${l.toLowerCase()}`} className="text-sm text-muted-foreground transition-colors hover:text-foreground">
            {l}
          </a>
        ))}
      </nav>
      <div className="flex items-center gap-2">
        <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
          <Link to="/auth">Sign in</Link>
        </Button>
        <Button asChild size="sm" className="bg-foreground text-background hover:bg-foreground/90">
          <Link to="/scifilter">
            Start Screening <ArrowRight className="ml-1 h-4 w-4" />
          </Link>
        </Button>
      </div>
    </div>
  </header>
);

/* ---------------------- Hero Visual ---------------------- */

const HeroVisual: React.FC = () => (
  <div className="relative mx-auto mt-16 max-w-6xl px-6" data-reveal style={{ transitionDuration: "700ms" }}>
    <div className="relative rounded-2xl border border-border bg-card/70 p-3 shadow-glow backdrop-blur">
      <div className="rounded-xl border border-border/70 bg-gradient-to-b from-background to-secondary/40 overflow-hidden">
        {/* Top bar */}
        <div className="flex items-center justify-between border-b border-border/60 px-5 py-3">
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-muted-foreground/30" />
            <span className="h-2.5 w-2.5 rounded-full bg-muted-foreground/30" />
            <span className="h-2.5 w-2.5 rounded-full bg-muted-foreground/30" />
          </div>
          <div className="flex items-center gap-2 rounded-md border border-border bg-background px-3 py-1.5 text-xs text-muted-foreground">
            <Search className="h-3.5 w-3.5" />
            <span>graphene oxide membranes — water filtration</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="h-6 w-6 rounded-full bg-primary/20 ring-2 ring-background" />
            <div className="h-6 w-6 rounded-full bg-accent ring-2 ring-background" />
            <div className="h-6 w-6 rounded-full bg-muted ring-2 ring-background" />
          </div>
        </div>

        {/* Body grid */}
        <div className="grid grid-cols-12 gap-0">
          {/* Left: papers list */}
          <div className="col-span-7 border-r border-border/60 p-5">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Screening queue · 124 results</p>
              <span className="text-xs text-muted-foreground">AI-ranked</span>
            </div>
            <ul className="space-y-2">
              {[
                { t: "Nanoporous graphene oxide membranes for selective ion transport", a: "Liu, Chen, Park · 2024 · Nature Materials", s: 96, tag: "High relevance" },
                { t: "Scalable fabrication of GO laminates: a manufacturing review", a: "Okafor et al. · 2023 · Adv. Materials", s: 88, tag: "High relevance" },
                { t: "Mechanical stability of layered 2D filtration stacks", a: "Tanaka, Berg · 2024 · ACS Nano", s: 74, tag: "Medium" },
                { t: "Comparative study: GO vs. MoS₂ separation efficiency", a: "Singh, Roussel · 2022 · J. Membrane Sci.", s: 61, tag: "Medium" },
              ].map((p, i) => (
                <li
                  key={i}
                  className="group rounded-lg border border-border/70 bg-background/70 p-3 transition-all hover:border-primary/40 hover:bg-background"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">{p.t}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">{p.a}</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <span className="rounded-full bg-primary-soft px-2 py-0.5 text-[11px] font-medium text-accent-foreground">{p.tag}</span>
                      <span className="font-mono text-xs text-muted-foreground">{p.s}</span>
                    </div>
                  </div>
                  {i === 0 && (
                    <div className="mt-2 flex items-center gap-2 text-[11px] text-muted-foreground">
                      <MessageSquare className="h-3 w-3" />
                      <span>Maya annotated: “Strong candidate — relevant to Phase 2 prototype.”</span>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </div>

          {/* Right: AI panel + graph */}
          <div className="col-span-5 p-5 space-y-4">
            <div className="rounded-lg border border-border/70 bg-background/70 p-4">
              <div className="mb-2 flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">AI reasoning</p>
              </div>
              <p className="text-sm leading-relaxed text-foreground">
                Ranked <span className="font-medium">Liu et al.</span> first — matches keyword <em>selectivity</em>, cites your lab's 2023 method, and aligns with workflow stage <em>Material selection</em>.
              </p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {["keyword match", "citation overlap", "recency", "team relevance"].map((c) => (
                  <span key={c} className="rounded-md border border-border bg-secondary/60 px-2 py-0.5 text-[11px] text-muted-foreground">
                    {c}
                  </span>
                ))}
              </div>
            </div>

            <div className="rounded-lg border border-border/70 bg-background/70 p-4">
              <div className="mb-3 flex items-center gap-2">
                <Network className="h-4 w-4 text-primary" />
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Knowledge graph</p>
              </div>
              <svg viewBox="0 0 280 140" className="h-32 w-full">
                {[
                  ["a", 40, 70], ["b", 110, 30], ["c", 110, 110], ["d", 180, 60], ["e", 240, 100], ["f", 240, 30],
                ].map(([id, x, y]) => (
                  <g key={id as string}>
                    <circle cx={x as number} cy={y as number} r="6" className="fill-primary/80" />
                    <circle cx={x as number} cy={y as number} r="10" className="fill-primary/15 animate-pulse-soft" />
                  </g>
                ))}
                {[
                  [40, 70, 110, 30], [40, 70, 110, 110], [110, 30, 180, 60], [110, 110, 180, 60], [180, 60, 240, 100], [180, 60, 240, 30],
                ].map((c, i) => (
                  <line key={i} x1={c[0]} y1={c[1]} x2={c[2]} y2={c[3]} className="stroke-border" strokeWidth="1.25" />
                ))}
              </svg>
              <div className="mt-1 flex items-center justify-between text-[11px] text-muted-foreground">
                <span>42 concepts · 118 links</span>
                <span className="inline-flex items-center gap-1"><CheckCircle2 className="h-3 w-3 text-primary" /> synced with team</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Floating cards */}
      <div className="pointer-events-none absolute -left-6 top-24 hidden rotate-[-4deg] animate-float md:block">
        <div className="rounded-lg border border-border bg-card/90 p-3 shadow-soft backdrop-blur w-56">
          <div className="flex items-center gap-2 text-xs font-medium text-foreground">
            <Users className="h-3.5 w-3.5 text-primary" /> 3 teammates reviewing
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground">Maya, Idris and Lin are screening this batch.</p>
        </div>
      </div>
      <div className="pointer-events-none absolute -right-4 bottom-16 hidden rotate-[3deg] animate-float md:block" style={{ animationDelay: "1.2s" }}>
        <div className="rounded-lg border border-border bg-card/90 p-3 shadow-soft backdrop-blur w-56">
          <div className="flex items-center gap-2 text-xs font-medium text-foreground">
            <Workflow className="h-3.5 w-3.5 text-primary" /> Workflow: Phase 2 → Review
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground">17 papers promoted to next stage.</p>
        </div>
      </div>
    </div>
  </div>
);

/* ---------------------- Hero ---------------------- */

const Hero: React.FC = () => (
  <section className="relative overflow-hidden bg-gradient-hero">
    <div className="container mx-auto px-6 pt-20 pb-8 text-center">
      <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-border bg-background/70 px-3 py-1 text-xs text-muted-foreground shadow-soft animate-fade-in">
        <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
        New · Collaborative AI reasoning for R&D teams
      </div>
      <h1 className="mx-auto mt-6 max-w-4xl font-display text-5xl leading-[1.05] tracking-tight text-foreground md:text-6xl lg:text-7xl animate-fade-in">
        AI-Assisted Knowledge<br className="hidden md:block" />
        <span className="italic text-primary"> Workflows </span>
        for R&D Teams
      </h1>
      <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-muted-foreground animate-fade-in" style={{ animationDelay: "120ms" }}>
        Transform information overload into actionable scientific knowledge through AI-supported collaborative workflows.
      </p>
      <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row animate-fade-in" style={{ animationDelay: "200ms" }}>
        <Button asChild size="lg" className="h-12 px-6 bg-foreground text-background hover:bg-foreground/90 shadow-soft">
          <Link to="/scifilter">
            Start Screening <ArrowRight className="ml-1.5 h-4 w-4" />
          </Link>
        </Button>
        <Button asChild size="lg" variant="outline" className="h-12 px-6 border-border bg-background/60">
          <a href="#workflows">See Workflow Demo</a>
        </Button>
      </div>
      <p className="mt-4 text-xs text-muted-foreground">No credit card · SOC 2 in progress · GDPR-ready</p>
    </div>

    <HeroVisual />

    {/* Trust strip */}
    <div className="container mx-auto px-6 pt-16 pb-20">
      <p className="text-center text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
        Built with research teams at
      </p>
      <div className="mx-auto mt-6 grid max-w-4xl grid-cols-2 items-center gap-x-10 gap-y-4 opacity-70 sm:grid-cols-3 md:grid-cols-6">
        {["Helix Bio", "Northlab", "Atrium R&D", "Veridian", "Polartek", "Kintera"].map((n) => (
          <div key={n} className="text-center text-sm font-semibold tracking-tight text-muted-foreground">{n}</div>
        ))}
      </div>
    </div>
  </section>
);

/* ---------------------- Features ---------------------- */

type Feature = {
  icon: React.ElementType;
  eyebrow: string;
  title: string;
  body: string;
  visual: React.ReactNode;
};

const features: Feature[] = [
  {
    icon: Brain,
    eyebrow: "AI Research Assistant",
    title: "An assistant that reads the literature with you.",
    body: "Ask questions across your screened corpus. Sifter synthesises, compares methodologies, and surfaces gaps — grounded only in your team's selected papers.",
    visual: (
      <div className="rounded-xl border border-border bg-card p-4 shadow-soft">
        <div className="space-y-2 text-sm">
          <div className="rounded-md bg-secondary/60 p-3 text-muted-foreground">Which papers compare GO and MoS₂ for ion selectivity?</div>
          <div className="rounded-md border border-border bg-background p-3">
            <p className="text-foreground">Three papers compare both directly:</p>
            <ul className="mt-1 list-disc pl-4 text-muted-foreground">
              <li>Singh & Roussel (2022) — efficiency benchmarks <span className="text-primary">[2]</span></li>
              <li>Liu et al. (2024) — ion-radius selectivity <span className="text-primary">[1]</span></li>
              <li>Tanaka & Berg (2024) — long-term stability <span className="text-primary">[3]</span></li>
            </ul>
          </div>
        </div>
      </div>
    ),
  },
  {
    icon: Users,
    eyebrow: "Workflow Collaboration",
    title: "Screen, annotate, and decide as a team.",
    body: "Share workspaces with reviewers. Track who approved what, comment inline on abstracts, and reach consensus without endless email threads.",
    visual: (
      <div className="rounded-xl border border-border bg-card p-4 shadow-soft">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <GitBranch className="h-3.5 w-3.5" /> Review board · Phase 2
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2">
          {["Inbox", "Reviewing", "Approved"].map((col, i) => (
            <div key={col} className="rounded-lg border border-border bg-background p-2">
              <p className="mb-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{col}</p>
              {Array.from({ length: i === 1 ? 3 : 2 }).map((_, j) => (
                <div key={j} className="mb-1 h-6 rounded bg-secondary/70" />
              ))}
            </div>
          ))}
        </div>
      </div>
    ),
  },
  {
    icon: Sparkles,
    eyebrow: "Explainable Recommendations",
    title: "Every ranking shows its reasoning.",
    body: "Sifter never hides why a paper made the shortlist. See keyword matches, citation overlap, recency, and team relevance — and override the model when needed.",
    visual: (
      <div className="rounded-xl border border-border bg-card p-4 shadow-soft">
        <div className="space-y-2">
          {[
            { l: "Keyword match", v: 92 },
            { l: "Citation overlap", v: 71 },
            { l: "Recency", v: 88 },
            { l: "Team relevance", v: 64 },
          ].map((r) => (
            <div key={r.l}>
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{r.l}</span>
                <span className="font-mono">{r.v}</span>
              </div>
              <div className="mt-1 h-1.5 rounded-full bg-secondary">
                <div className="h-full rounded-full bg-gradient-accent" style={{ width: `${r.v}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    ),
  },
  {
    icon: Network,
    eyebrow: "Knowledge Transfer",
    title: "Move what teams learn — not just what they read.",
    body: "Build a living knowledge graph of concepts, decisions, and references. New teammates onboard into context, not into chaos.",
    visual: (
      <div className="rounded-xl border border-border bg-card p-4 shadow-soft">
        <svg viewBox="0 0 320 160" className="h-40 w-full">
          {[[60,80],[140,40],[140,120],[220,80],[280,40],[280,120]].map(([x,y],i)=>(
            <g key={i}>
              <circle cx={x} cy={y} r="7" className="fill-primary/80" />
              <circle cx={x} cy={y} r="14" className="fill-primary/10" />
            </g>
          ))}
          {[[60,80,140,40],[60,80,140,120],[140,40,220,80],[140,120,220,80],[220,80,280,40],[220,80,280,120]].map((c,i)=>(
            <line key={i} x1={c[0]} y1={c[1]} x2={c[2]} y2={c[3]} className="stroke-border" strokeWidth="1.5"/>
          ))}
        </svg>
      </div>
    ),
  },
  {
    icon: Workflow,
    eyebrow: "Scientific Workflow Automation",
    title: "Automate the boring parts of screening.",
    body: "Trigger reviewer assignments, deduplicate references, export structured CSVs, and pipe approved papers into your downstream stack.",
    visual: (
      <div className="rounded-xl border border-border bg-card p-4 shadow-soft">
        <ol className="space-y-2 text-sm">
          {["Fetch · OpenAlex + Crossref", "Score · AI relevance", "Route · Assign reviewers", "Sync · Notion / Slack"].map((s, i) => (
            <li key={s} className="flex items-center gap-3 rounded-md border border-border bg-background p-2.5">
              <span className="grid h-6 w-6 place-items-center rounded-full bg-primary-soft text-xs font-medium text-accent-foreground">{i + 1}</span>
              <span className="text-foreground">{s}</span>
            </li>
          ))}
        </ol>
      </div>
    ),
  },
  {
    icon: ShieldCheck,
    eyebrow: "Trusted AI for R&D",
    title: "Enterprise-grade, evidence-grounded.",
    body: "Your data stays yours. Models reason only over your selected corpus. Audit trails, SSO, and granular permissions for regulated industries.",
    visual: (
      <div className="rounded-xl border border-border bg-card p-4 shadow-soft">
        <div className="grid grid-cols-2 gap-2 text-xs">
          {["SOC 2 (in progress)", "GDPR-ready", "SSO / SAML", "Role-based access", "EU data residency", "Audit logs"].map((b) => (
            <div key={b} className="flex items-center gap-2 rounded-md border border-border bg-background p-2">
              <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
              <span className="text-foreground">{b}</span>
            </div>
          ))}
        </div>
      </div>
    ),
  },
];

const Features: React.FC = () => (
  <section id="product" className="container mx-auto px-6 py-28">
    <div className="mx-auto max-w-2xl text-center" data-reveal style={{ transitionProperty: "all", transitionDuration: "600ms" }}>
      <p className="text-xs font-medium uppercase tracking-[0.18em] text-primary">The Sifter platform</p>
      <h2 className="mt-3 font-display text-4xl leading-tight tracking-tight text-foreground md:text-5xl">
        Six surfaces that turn reading into <span className="italic">knowing</span>.
      </h2>
    </div>

    <div className="mt-20 space-y-28">
      {features.map((f, i) => {
        const Icon = f.icon;
        const reverse = i % 2 === 1;
        return (
          <div
            key={f.title}
            className={`grid items-center gap-10 opacity-0 translate-y-4 transition-all duration-700 md:grid-cols-2 md:gap-16 ${reverse ? "md:[&>div:first-child]:order-2" : ""}`}
            data-reveal
          >
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-border bg-secondary/50 px-3 py-1 text-xs text-muted-foreground">
                <Icon className="h-3.5 w-3.5 text-primary" />
                {f.eyebrow}
              </div>
              <h3 className="mt-4 font-display text-3xl leading-tight tracking-tight text-foreground md:text-4xl">{f.title}</h3>
              <p className="mt-4 text-base leading-relaxed text-muted-foreground">{f.body}</p>
            </div>
            <div>{f.visual}</div>
          </div>
        );
      })}
    </div>
  </section>
);

/* ---------------------- Workflow band ---------------------- */

const WorkflowBand: React.FC = () => (
  <section id="workflows" className="border-y border-border bg-secondary/40 py-24">
    <div className="container mx-auto px-6">
      <div className="mx-auto max-w-2xl text-center" data-reveal style={{ transitionProperty: "all", transitionDuration: "600ms" }}>
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-primary">How it works</p>
        <h2 className="mt-3 font-display text-4xl tracking-tight text-foreground md:text-5xl">From query to decision in four moves.</h2>
      </div>
      <div className="mt-14 grid gap-4 md:grid-cols-4">
        {[
          { n: "01", t: "Search", b: "Pull from Crossref, OpenAlex, and internal libraries." },
          { n: "02", t: "Screen", b: "AI ranks and explains — your team approves." },
          { n: "03", t: "Synthesise", b: "Ask questions across the approved corpus." },
          { n: "04", t: "Operationalise", b: "Push insights into Notion, Slack, or your stack." },
        ].map((s, i) => (
          <div
            key={s.n}
            className="group relative rounded-xl border border-border bg-card p-6 shadow-soft transition-all hover:-translate-y-1 hover:shadow-glow opacity-0 translate-y-4 duration-700"
            data-reveal
            style={{ transitionDelay: `${i * 80}ms` }}
          >
            <span className="font-mono text-xs text-muted-foreground">{s.n}</span>
            <h3 className="mt-2 text-lg font-semibold text-foreground">{s.t}</h3>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{s.b}</p>
          </div>
        ))}
      </div>
    </div>
  </section>
);

/* ---------------------- Quote ---------------------- */

const QuoteSection: React.FC = () => (
  <section className="container mx-auto px-6 py-28">
    <div className="mx-auto max-w-3xl text-center" data-reveal style={{ transitionProperty: "all", transitionDuration: "700ms" }}>
      <Quote className="mx-auto h-8 w-8 text-primary/60" />
      <p className="mt-6 font-display text-3xl leading-snug tracking-tight text-foreground md:text-4xl">
        “Sifter compressed a three-week literature review into two afternoons — and the explanations made it easy to trust.”
      </p>
      <div className="mt-6 text-sm text-muted-foreground">
        <p className="font-medium text-foreground">Dr. Maya Okonkwo</p>
        <p>Head of Materials R&D, Helix Bio</p>
      </div>
    </div>
  </section>
);

/* ---------------------- CTA ---------------------- */

const CTA: React.FC = () => (
  <section className="container mx-auto px-6 pb-28">
    <div className="relative overflow-hidden rounded-3xl border border-border bg-gradient-hero p-12 text-center shadow-soft md:p-20">
      <div className="absolute inset-0 -z-10 opacity-50 bg-[radial-gradient(circle_at_30%_20%,hsl(190_70%_85%),transparent_60%)]" />
      <h2 className="mx-auto max-w-2xl font-display text-4xl tracking-tight text-foreground md:text-5xl">
        Bring calm and clarity to your <span className="italic text-primary">scientific workflows</span>.
      </h2>
      <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
        Start with a single screening project. Invite your team. Watch the noise dissolve.
      </p>
      <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
        <Button asChild size="lg" className="h-12 px-6 bg-foreground text-background hover:bg-foreground/90">
          <Link to="/scifilter">Start Screening <ArrowRight className="ml-1.5 h-4 w-4" /></Link>
        </Button>
        <Button asChild size="lg" variant="outline" className="h-12 px-6">
          <a href="#workflows">See Workflow Demo</a>
        </Button>
      </div>
    </div>
  </section>
);

/* ---------------------- Footer ---------------------- */

const Footer: React.FC = () => (
  <footer className="border-t border-border bg-background">
    <div className="container mx-auto grid gap-8 px-6 py-12 md:grid-cols-4">
      <div>
        <div className="flex items-center gap-2">
          <div className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-accent">
            <span className="font-display text-lg italic text-primary-foreground">S</span>
          </div>
          <span className="font-semibold text-foreground">Sifter</span>
        </div>
        <p className="mt-3 text-sm text-muted-foreground">AI-assisted knowledge workflows for R&D teams.</p>
      </div>
      {[
        { h: "Product", l: ["Research Assistant", "Workflows", "Knowledge Graph", "Integrations"] },
        { h: "Company", l: ["About", "Customers", "Careers", "Contact"] },
        { h: "Resources", l: ["Docs", "Changelog", "Security", "Privacy"] },
      ].map((c) => (
        <div key={c.h}>
          <p className="text-xs font-medium uppercase tracking-wider text-foreground">{c.h}</p>
          <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
            {c.l.map((i) => (
              <li key={i}><a href="#" className="hover:text-foreground transition-colors">{i}</a></li>
            ))}
          </ul>
        </div>
      ))}
    </div>
    <div className="border-t border-border">
      <div className="container mx-auto flex flex-col items-center justify-between gap-2 px-6 py-5 text-xs text-muted-foreground sm:flex-row">
        <span>© {new Date().getFullYear()} Sifter Labs. All rights reserved.</span>
        <span>Made for scientists who'd rather be in the lab.</span>
      </div>
    </div>
  </footer>
);

/* ---------------------- Page ---------------------- */

const Index: React.FC = () => {
  useReveal();
  return (
    <div className="min-h-screen bg-background text-foreground antialiased">
      <Nav />
      <main>
        <Hero />
        <Features />
        <WorkflowBand />
        <QuoteSection />
        <CTA />
      </main>
      <Footer />
    </div>
  );
};

export default Index;
