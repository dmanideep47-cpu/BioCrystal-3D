import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import "./LandingPage.css";
import {
  Activity,
  ArrowDown,
  ArrowUpRight,
  Atom,
  Binary,
  Check,
  ChevronRight,
  Copy,
  Dna,
  Layers3,
  Menu,
  Pause,
  Play,
  ScanSearch,
  ShieldCheck,
  X,
} from "lucide-react";

interface LandingPageProps {
  onLaunch: () => void;
}

type SequenceMode = "reference" | "observed";
type Base = "A" | "T" | "G" | "C";
type CapabilityId = "sequence" | "mutation" | "molecular" | "translation" | "report";

const REFERENCE_SEQUENCE = "ATGGCTACTGGTTAA";
const OBSERVED_SEQUENCE = "ATGGCTACGGGTTAA";
const MUTATION_INDEX = 8;

const BASE_STYLES: Record<Base, string> = {
  A: "bg-[#b8e7c7] text-[#10251a]",
  T: "bg-[#ffd3a8] text-[#3a210d]",
  G: "bg-[#b8dff1] text-[#102432]",
  C: "bg-[#f1c6d6] text-[#321522]",
};

const COMPLEMENT: Record<Base, Base> = { A: "T", T: "A", G: "C", C: "G" };
const BASE_NAMES: Record<Base, string> = {
  A: "Adenine",
  T: "Thymine",
  G: "Guanine",
  C: "Cytosine",
};

const AMINO_ACIDS: Record<string, string> = {
  ATG: "Methionine",
  GCT: "Alanine",
  ACT: "Threonine",
  ACG: "Threonine",
  GGT: "Glycine",
  TAA: "Stop",
};

const CAPABILITIES: {
  id: CapabilityId;
  number: string;
  label: string;
  category: string;
  description: string;
  output: string;
}[] = [
    {
      id: "sequence",
      number: "01",
      label: "Sequence validation",
      category: "BIOINFORMATICS",
      description:
        "Check nucleotide symbols, sequence length and composition before downstream analysis begins.",
      output: "Length · GC content · base composition",
    },
    {
      id: "mutation",
      number: "02",
      label: "Mutation detection",
      category: "COMPARATIVE ANALYSIS",
      description:
        "Compare a reference sequence with an observed sample and locate substitutions, insertions and deletions.",
      output: "Alignment · variant position · mutation type",
    },
    {
      id: "molecular",
      number: "03",
      label: "Molecular visualization",
      category: "MOLECULAR MODELING",
      description:
        "Explore the DNA double helix and connect an individual nucleotide to its structural context.",
      output: "B-DNA geometry · base pairing · 3D inspection",
    },
    {
      id: "translation",
      number: "04",
      label: "Codon translation",
      category: "GENETIC CODE",
      description:
        "Inspect reading-frame triplets and translate supported codons into amino-acid annotations.",
      output: "Codons · reading frame · amino-acid label",
    },
    {
      id: "report",
      number: "05",
      label: "Scientific reporting",
      category: "SCIENTIFIC OUTPUT",
      description:
        "Bring the sequence metrics, comparison results and analysis context into a structured report.",
      output: "Summary · mutation table · report export",
    },
  ];

const WORKFLOW = [
  ["01", "Input the sequence", "Enter a DNA sequence or load a FASTA-formatted sample."],
  ["02", "Validate the data", "Check sequence alphabet, length and nucleotide composition."],
  ["03", "Compare the reference", "Align the observed sample and locate sequence differences."],
  ["04", "Inspect consequences", "Review the affected codon and translation context where supported."],
  ["05", "Explore and report", "Inspect the molecular model and organize the findings."],
] as const;

const STYLES = `
  .bc-page { --bc-paper:#f4f3ef; --bc-orange:#ff6500; --bc-ink:#111315; --bc-muted:#777873; background:var(--bc-paper); color:var(--bc-ink); }
  .bc-grid { background-image:linear-gradient(rgba(17,19,21,.075) 1px,transparent 1px),linear-gradient(90deg,rgba(17,19,21,.075) 1px,transparent 1px); background-size:22px 22px; }
  .bc-grid-dark { background-image:linear-gradient(rgba(255,255,255,.09) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.09) 1px,transparent 1px); background-size:22px 22px; }
  .bc-hatch { background-image:repeating-linear-gradient(135deg,rgba(90,90,90,.28) 0,rgba(90,90,90,.28) 1px,transparent 1px,transparent 7px); }
  .bc-dot-grid { background-image:radial-gradient(rgba(20,20,20,.22) .7px,transparent .7px); background-size:6px 6px; }
  .bc-button { position:relative; isolation:isolate; overflow:hidden; transition:color .25s ease,border-color .25s ease,transform .25s ease,background .25s ease; }
  .bc-button::before { content:""; position:absolute; inset:0; z-index:-1; transform:translateX(-102%); background:var(--bc-orange); transition:transform .32s cubic-bezier(.2,.7,.2,1); }
  .bc-button:hover::before { transform:translateX(0); }
  .bc-button:hover { color:#111315; border-color:var(--bc-orange); transform:translateY(-2px); }
  .bc-button-light::before { background:#fff; }
  .bc-nav-link { position:relative; }
  .bc-nav-link::after { content:""; position:absolute; left:0; right:100%; bottom:-7px; height:2px; background:var(--bc-orange); transition:right .25s ease; }
  .bc-nav-link:hover::after { right:0; }
  .bc-reveal { opacity:0; transform:translateY(28px); filter:blur(2px); transition:opacity .75s ease,transform .75s cubic-bezier(.2,.7,.2,1),filter .75s ease; }
  .bc-reveal.is-visible { opacity:1; transform:translateY(0); filter:blur(0); }
  .bc-scan-line { animation:bc-scan 5.5s ease-in-out infinite; }
  .bc-float { animation:bc-float 7s ease-in-out infinite; }
  .bc-spin-slow { animation:bc-spin 32s linear infinite; transform-origin:center; }
  .bc-pulse-dot { animation:bc-pulse 1.8s ease-in-out infinite; }
  .bc-marquee-track { animation:bc-marquee 34s linear infinite; }
  .bc-marquee-track:hover { animation-play-state:paused; }
  .bc-tab-active { box-shadow:inset 0 -3px 0 var(--bc-orange); background:rgba(255,255,255,.065); }
  .bc-card-hover { transition:transform .35s ease,border-color .35s ease,background .35s ease,box-shadow .35s ease; }
  .bc-card-hover:hover { transform:translateY(-5px); border-color:var(--bc-orange); background:rgba(255,255,255,.84); box-shadow:0 18px 42px rgba(0,0,0,.075); }
  .bc-terminal-cursor { animation:bc-blink 1s steps(2,start) infinite; }
  .bc-route-path { stroke-dasharray:8 11; animation:bc-route-dash 16s linear infinite; }
  .bc-route-node { transition:transform .4s ease,opacity .4s ease,filter .4s ease; transform-box:fill-box; transform-origin:center; }
  .bc-route-node.is-active { filter:drop-shadow(0 0 9px rgba(255,101,0,.32)); transform:scale(1.045); }
  .bc-data-packet { animation:bc-packet-glow 2.8s ease-in-out infinite; }
  .bc-chart-line { stroke-dasharray:1200; stroke-dashoffset:1200; animation:bc-chart-draw 2.4s cubic-bezier(.2,.7,.2,1) forwards; }
  .bc-chart-point { transform-box:fill-box; transform-origin:center; animation:bc-point-pulse 2.2s ease-in-out infinite; }
  .bc-metric-tile { transition:transform .35s ease,border-color .35s ease,background .35s ease; }
  .bc-metric-tile:hover { transform:translateY(-4px); border-color:var(--bc-orange); background:rgba(255,255,255,.8); }
  .bc-composition-fill { transform-origin:left center; animation:bc-bar-in 1.1s cubic-bezier(.2,.7,.2,1) both; }
  @keyframes bc-route-dash { to { stroke-dashoffset:-380; } }
  @keyframes bc-packet-glow { 0%,100% { opacity:.55; } 50% { opacity:1; filter:drop-shadow(0 0 8px rgba(255,101,0,.7)); } }
  @keyframes bc-chart-draw { to { stroke-dashoffset:0; } }
  @keyframes bc-point-pulse { 0%,100% { transform:scale(1); } 50% { transform:scale(1.35); } }
  @keyframes bc-bar-in { from { transform:scaleX(.04); opacity:.3; } to { transform:scaleX(1); opacity:1; } }
  @keyframes bc-number-reveal { from { opacity:.3; transform:translateY(9px); } to { opacity:1; transform:translateY(0); } }
  .bc-number-reveal { animation:bc-number-reveal .45s cubic-bezier(.2,.7,.2,1) both; }
  @keyframes bc-scan { 0%,100% { transform:translateX(-120%); opacity:0; } 20% { opacity:1; } 70% { transform:translateX(400%); opacity:.8; } }
  @keyframes bc-float { 0%,100% { transform:translateY(0); } 50% { transform:translateY(-11px); } }
  @keyframes bc-spin { to { transform:rotate(360deg); } }
  @keyframes bc-pulse { 0%,100% { opacity:1; box-shadow:0 0 0 0 rgba(255,101,0,.45); } 50% { opacity:.65; box-shadow:0 0 0 7px rgba(255,101,0,0); } }
  @keyframes bc-marquee { to { transform:translateX(-50%); } }
  @keyframes bc-blink { to { visibility:hidden; } }
  .bc-technical-canvas { box-shadow:0 18px 50px rgba(20,22,24,.045); }
  .bc-diagram-unit { opacity:.72; transition:opacity .35s ease,filter .35s ease; }
  .bc-diagram-unit.is-active { opacity:1; filter:drop-shadow(0 0 7px rgba(255,101,0,.12)); }
  .bc-step-row { position:relative; padding-left:12px; }
  .bc-step-row[aria-pressed="true"]::before { content:""; position:absolute; left:0; top:13px; bottom:13px; width:2px; background:#ff6500; }
  .bc-flow-dash { stroke-dasharray:10 12; animation:bc-flow-dash 18s linear infinite; }
  .bc-benchmark-tile { transition:transform .3s ease,border-color .3s ease; }
  .bc-benchmark-tile:hover { transform:translateY(-3px); border-color:#ff6500; }
  .bc-blueprint-glow { background:radial-gradient(ellipse at 50% 48%,rgba(255,101,0,.12),transparent 42%); }
  .bc-stack-layer { transition:filter .4s ease,opacity .4s ease; animation:bc-layer-drift 8s ease-in-out infinite; }
  .bc-stack-layer:nth-of-type(2) { animation-delay:-2s; }
  .bc-stack-layer:nth-of-type(3) { animation-delay:-4s; }
  .bc-stack-layer:nth-of-type(4) { animation-delay:-6s; }
  .bc-stack-layer.is-selected { filter:drop-shadow(0 0 9px rgba(255,101,0,.28)); }
  .bc-scan-path { stroke-dasharray:52 668; animation:bc-scan-path 5s linear infinite; }
  .bc-diagram-pulse { transform-box:fill-box; transform-origin:center; animation:bc-pulse-node 2s ease-in-out infinite; }
  .bc-analysis-tab[aria-selected="true"] { box-shadow:inset 0 -3px 0 #ff6500; }
  .bc-panel-title { animation:bc-panel-enter .45s cubic-bezier(.2,.7,.2,1) both; }
  @keyframes bc-flow-dash { to { stroke-dashoffset:-440; } }
  @keyframes bc-layer-drift { 0%,100% { translate:0 0; } 50% { translate:0 -3px; } }
  @keyframes bc-scan-path { to { stroke-dashoffset:-720; } }
  @keyframes bc-pulse-node { 0%,100% { transform:scale(1); opacity:.8; } 50% { transform:scale(1.65); opacity:1; } }
  @keyframes bc-panel-enter { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }
  @media (prefers-reduced-motion:reduce) { .bc-reveal,.bc-reveal.is-visible { opacity:1; transform:none; filter:none; transition:none; } .bc-scan-line,.bc-float,.bc-spin-slow,.bc-pulse-dot,.bc-marquee-track,.bc-terminal-cursor,.bc-route-path,.bc-data-packet,.bc-chart-line,.bc-chart-point,.bc-composition-fill,.bc-number-reveal { animation:none!important; } html { scroll-behavior:auto!important; } }
`;

function sequenceMetrics(sequence: string) {
  const gc = (sequence.match(/[GC]/g) ?? []).length;
  const counts: Record<Base, number> = { A: 0, T: 0, G: 0, C: 0 };
  for (const base of sequence) if (base in counts) counts[base as Base] += 1;
  return {
    length: sequence.length,
    gcCount: gc,
    gcPercent: sequence.length ? (gc / sequence.length) * 100 : 0,
    codons: Math.floor(sequence.length / 3),
    counts,
  };
}

function codonAt(sequence: string, nucleotideIndex: number) {
  const start = Math.floor(nucleotideIndex / 3) * 3;
  const triplet = sequence.slice(start, start + 3);
  return {
    triplet,
    aminoAcid: AMINO_ACIDS[triplet] ?? "Translation unavailable",
    codonNumber: Math.floor(nucleotideIndex / 3) + 1,
    positionInCodon: (nucleotideIndex % 3) + 1,
  };
}

function Eyebrow({ children, dark = false }: { children: ReactNode; dark?: boolean }) {
  return (
    <div className={`flex items-center gap-3 font-mono text-[9px] font-bold tracking-[.16em] ${dark ? "text-orange-400" : "text-orange-700"}`}>
      <span className="h-2 w-2 shrink-0 bg-[#ff6500]" />
      {children}
    </div>
  );
}

function SectionRule({ number, title, meta, dark = false }: { number: string; title: string; meta: string; dark?: boolean }) {
  return (
    <div className={`flex flex-col gap-3 border-y border-dashed py-4 md:flex-row md:items-center md:justify-between ${dark ? "border-orange-500/55" : "border-orange-500/70"}`}>
      <span className={`font-mono text-[9px] font-bold tracking-[.13em] ${dark ? "text-white" : "text-neutral-950"}`}>
        <span className="mr-3 text-orange-600">{number} //</span>{title}
      </span>
      <span className="font-mono text-[8px] font-bold tracking-[.12em] text-neutral-500">{meta}</span>
    </div>
  );
}

function Reveal({ children, className = "", delay = 0 }: { children: ReactNode; className?: string; delay?: number }) {
  const [visible, setVisible] = useState(false);
  const nodeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = nodeRef.current;
    if (!node) return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches || !("IntersectionObserver" in window)) {
      setVisible(true);
      return;
    }
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setVisible(true);
        observer.unobserve(node);
      }
    }, { threshold: 0.12, rootMargin: "0px 0px -35px 0px" });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={nodeRef} style={{ transitionDelay: `${delay}ms` }} className={`bc-reveal ${visible ? "is-visible" : ""} ${className}`}>
      {children}
    </div>
  );
}

function ActionButton({ children, onClick, variant = "dark", className = "" }: { children: ReactNode; onClick: () => void; variant?: "dark" | "orange" | "light"; className?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`bc-precision-cta bc-precision-cta--${variant} group inline-flex min-h-12 items-center justify-between gap-7 px-5 ${className}`}
    >
      <span className="bc-precision-cta__corners" aria-hidden="true">
        <i className="bc-precision-cta__corner bc-precision-cta__corner--tl" />
        <i className="bc-precision-cta__corner bc-precision-cta__corner--tr" />
        <i className="bc-precision-cta__corner bc-precision-cta__corner--bl" />
        <i className="bc-precision-cta__corner bc-precision-cta__corner--br" />
      </span>
      <span className="bc-precision-cta__label">{children}</span>
      <span className="bc-precision-cta__icon" aria-hidden="true">
        <ArrowUpRight size={16} strokeWidth={2.4} />
      </span>
    </button>
  );
}

function TechnicalGrid({ dark = false, className = "" }: { dark?: boolean; className?: string }) {
  return <div aria-hidden="true" className={`pointer-events-none absolute inset-0 ${dark ? "bc-grid-dark" : "bc-grid"} ${className}`} />;
}

function DNAHelix() {
  const rungs = Array.from({ length: 13 }, (_, i) => {
    const phase = i * 0.78;
    return { y: 31 + i * 30, left: 310 + Math.sin(phase) * 122, right: 310 - Math.sin(phase) * 122 };
  });
  return (
    <div className="group relative overflow-hidden border border-neutral-800 bg-[#101214] text-white shadow-[0_22px_70px_rgba(0,0,0,.18)]">
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-3 font-mono text-[8px] font-bold tracking-[.13em] text-neutral-400">
        <span>MOLECULAR MODEL / B-DNA</span><span>FIG 01.01</span>
      </div>
      <div className="relative grid min-h-[380px] place-items-center overflow-hidden bg-[#101214] sm:min-h-[450px]">
        <TechnicalGrid dark className="opacity-50" />
        <div className="bc-spin-slow absolute h-64 w-64 rounded-full border border-orange-500/25" />
        <div className="bc-float absolute h-80 w-48 rounded-[50%] border border-cyan-400/15" />
        <svg viewBox="0 0 620 430" role="img" aria-label="Illustrative animated DNA double helix" className="relative z-10 w-full max-w-[620px] transition-transform duration-700 group-hover:scale-[1.025]">
          <defs>
            <linearGradient id="bc-helix-orange" x1="0" x2="1"><stop offset="0" stopColor="#ff6500" /><stop offset="1" stopColor="#ffb16d" /></linearGradient>
            <linearGradient id="bc-helix-cyan" x1="0" x2="1"><stop offset="0" stopColor="#087e9b" /><stop offset="1" stopColor="#48d7ee" /></linearGradient>
            <filter id="bc-helix-glow"><feGaussianBlur stdDeviation="3" result="blur" /><feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
          </defs>
          <path d="M175 15 C470 80 160 175 310 215 C460 255 150 345 445 415" fill="none" stroke="url(#bc-helix-orange)" strokeWidth="9" strokeLinecap="round" />
          <path d="M445 15 C150 80 460 175 310 215 C160 255 470 345 175 415" fill="none" stroke="url(#bc-helix-cyan)" strokeWidth="9" strokeLinecap="round" />
          {rungs.map((rung, index) => (
            <g key={index}>
              <line x1={rung.left} y1={rung.y} x2={rung.right} y2={rung.y} stroke="#a1a1aa" strokeWidth="2" opacity=".72" />
              <circle cx={rung.left} cy={rung.y} r="6.5" fill="#ff6500" filter="url(#bc-helix-glow)" />
              <circle cx={rung.right} cy={rung.y} r="6.5" fill="#d4d4d8" stroke="#71717a" strokeWidth="1" />
            </g>
          ))}
          <g stroke="#9ca3af" strokeWidth="1" fill="none"><path d="M175 95L60 65H10" /><path d="M445 190L550 155H610" /><path d="M310 325L80 365H10" /><path d="M445 375L555 405H610" /></g>
          <g fill="#e5e5e5" fontSize="9" fontFamily="monospace" fontWeight="bold"><text x="10" y="52">SUGAR BACKBONE</text><text x="490" y="140">BASE PAIR</text><text x="10" y="355">HYDROGEN BONDS</text><text x="500" y="425">DNA STRAND</text></g>
          <circle r="5" fill="#ff6500" filter="url(#bc-helix-glow)"><animateMotion dur="9s" repeatCount="indefinite" path="M175 15 C470 80 160 175 310 215 C460 255 150 345 445 415" /></circle>
        </svg>
        <span className="absolute left-4 top-4 z-10 font-mono text-[8px] text-neutral-500">MODEL / 001</span>
        <span className="absolute bottom-4 right-4 z-10 flex items-center gap-2 font-mono text-[8px] text-orange-400"><span className="bc-pulse-dot h-2 w-2 rounded-full bg-orange-500" /> CANONICAL MODEL</span>
      </div>
      <div className="grid grid-cols-2 border-t border-white/10 sm:grid-cols-4">
        {[["STRUCTURE", "B-DNA"], ["RISE / BP", "3.4 Å"], ["TWIST / BP", "36°"], ["PAIRING", "A-T / G-C"]].map(([label, value]) => (
          <div key={label} className="border-r border-white/10 p-4 last:border-r-0"><p className="font-mono text-[8px] text-neutral-500">{label}</p><p className="mt-2 font-mono text-xs font-bold text-orange-400">{value}</p></div>
        ))}
      </div>
    </div>
  );
}

function ExplodedDiagram() {
  return (
    <div className="group relative overflow-hidden border border-neutral-800 bg-[#101214] text-white shadow-2xl">
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-3 font-mono text-[8px] font-bold tracking-[.13em] text-neutral-400"><span>MOLECULAR ASSEMBLY / EXPLODED VIEW</span><span>FIG 02.04</span></div>
      <div className="relative min-h-[410px] overflow-hidden p-4 sm:min-h-[520px]">
        <TechnicalGrid dark className="opacity-50" />
        <svg viewBox="0 0 700 540" className="relative z-10 w-full transition-transform duration-700 group-hover:scale-[1.02]" role="img" aria-label="Exploded molecular assembly diagram">
          <g stroke="#626a73" strokeWidth="1" strokeDasharray="4 5" fill="none"><path d="M350 20V510" /><path d="M110 160L350 30L590 160" /><path d="M110 275L350 145L590 275" /><path d="M110 390L350 260L590 390" /></g>
          <g><path d="M110 155L350 25L590 155L350 285Z" fill="#fff" fillOpacity=".045" stroke="#ff6500" strokeWidth="2.5" /><path d="M170 155L350 57L530 155L350 253Z" fill="none" stroke="#949ba3" strokeWidth="1.5" />{Array.from({ length: 8 }, (_, i) => <circle key={i} cx={190 + i * 46} cy={155 - Math.abs(3.5 - i) * 20} r="5" fill="#ff6500" />)}</g>
          <g><path d="M110 270L350 140L590 270L350 400Z" fill="#fff" fillOpacity=".055" stroke="#a1a1aa" strokeWidth="2" /><path d="M170 270L350 172L530 270L350 368Z" fill="none" stroke="#ff6500" strokeWidth="1.5" /><path d="M225 270L350 202L475 270L350 338Z" fill="none" stroke="#777f88" />{Array.from({ length: 9 }, (_, i) => <path key={i} d={`M${210 + i * 35} ${270 - Math.abs(4 - i) * 18}h15`} stroke="#b7bdc5" strokeWidth="2" />)}</g>
          <g><path d="M110 385L350 255L590 385L350 515Z" fill="#fff" fillOpacity=".045" stroke="#a1a1aa" strokeWidth="2" /><path d="M170 385L350 287L530 385L350 483Z" fill="none" stroke="#858b93" strokeWidth="1.5" /><path d="M245 385L350 327L455 385L350 443Z" fill="none" stroke="#ff6500" strokeWidth="2" /></g>
          <g fill="#ff6500"><circle cx="350" cy="25" r="5" /><circle cx="350" cy="140" r="5" /><circle cx="350" cy="255" r="5" /><circle cx="350" cy="515" r="5" /></g>
          <g stroke="#a1a1aa" strokeWidth="1" fill="none"><path d="M110 155L35 115H5" /><path d="M590 270L660 230H695" /><path d="M110 385L35 440H5" /><path d="M455 385L650 445H695" /></g>
          <g fill="#e5e5e5" fontFamily="monospace" fontSize="10" fontWeight="bold"><text x="5" y="100">BASE PAIR LAYER</text><text x="555" y="215">MOLECULAR CORE</text><text x="5" y="460">BACKBONE</text><text x="555" y="465">STRUCTURAL LAYER</text></g>
        </svg>
      </div>
      <div className="grid grid-cols-3 border-t border-white/10">{[["LAYER 01", "BASE PAIRS"], ["LAYER 02", "MOLECULAR CORE"], ["LAYER 03", "BACKBONE"]].map(([a, b]) => <div key={a} className="border-r border-white/10 p-4 last:border-r-0"><p className="font-mono text-[8px] text-neutral-500">{a}</p><p className="mt-2 font-mono text-[8px] font-bold text-orange-400">{b}</p></div>)}</div>
    </div>
  );
}

function WorkflowDiagram() {
  const points = [{ x: 55, y: 220, n: "01", t: "INPUT" }, { x: 185, y: 175, n: "02", t: "VALIDATE" }, { x: 315, y: 130, n: "03", t: "COMPARE" }, { x: 445, y: 85, n: "04", t: "TRANSLATE" }, { x: 575, y: 40, n: "05", t: "REPORT" }];
  return (
    <div className="overflow-hidden border border-neutral-300 bg-[#f9f8f4]">
      <div className="flex items-center justify-between border-b border-neutral-300 px-4 py-3 font-mono text-[8px] font-bold tracking-[.13em] text-neutral-500"><span>COMPUTATIONAL PIPELINE</span><span>PROCESS / 05</span></div>
      <div className="p-3 sm:p-7">
        <svg viewBox="0 0 650 285" className="w-full" role="img" aria-label="Five-stage DNA analysis workflow">
          <path d="M55 220L185 175L315 130L445 85L575 40" fill="none" stroke="#b6b6b1" strokeWidth="2" strokeDasharray="5 6" />
          {points.map((p, i) => <g key={p.n}><circle cx={p.x} cy={p.y} r="23" fill={i === 4 ? "#ff6500" : "#151719"} stroke={i === 4 ? "#ff6500" : "#737373"} strokeWidth="1.5" /><text x={p.x} y={p.y + 4} fill={i === 4 ? "#111" : "#fff"} textAnchor="middle" fontSize="10" fontFamily="monospace" fontWeight="bold">{p.n}</text><text x={p.x} y={p.y + 43} fill="#555" textAnchor="middle" fontSize="8" fontFamily="monospace" fontWeight="bold">{p.t}</text></g>)}
          <circle r="5" fill="#ff6500"><animateMotion dur="7s" repeatCount="indefinite" path="M55 220L185 175L315 130L445 85L575 40" /></circle>
        </svg>
      </div>
    </div>
  );
}

function SequenceTerminal({ mode, onModeChange, onLaunch }: { mode: SequenceMode; onModeChange: (mode: SequenceMode) => void; onLaunch: () => void }) {
  const sequence = mode === "reference" ? REFERENCE_SEQUENCE : OBSERVED_SEQUENCE;
  const metrics = sequenceMetrics(sequence);
  const commandText = mode === "reference"
    ? "analyze --reference reference.fasta"
    : "compare --observed variant.fasta";
  const [paused, setPaused] = useState(false);
  const [commandTyped, setCommandTyped] = useState(0);
  const [typed, setTyped] = useState(0);
  const [copied, setCopied] = useState(false);

  const isTypingCommand = commandTyped < commandText.length;
  const isTypingSequence = !isTypingCommand && typed < sequence.length;
  const streamStatus = paused
    ? "STREAM PAUSED"
    : isTypingCommand
      ? "ENTERING COMMAND"
      : isTypingSequence
        ? "STREAMING BASES"
        : "SEQUENCE READY";

  useEffect(() => {
    if (paused) return;

    let timer: number;
    if (commandTyped < commandText.length) {
      timer = window.setTimeout(
        () => setCommandTyped((current) => Math.min(current + 1, commandText.length)),
        34,
      );
    } else if (typed < sequence.length) {
      timer = window.setTimeout(
        () => setTyped((current) => Math.min(current + 1, sequence.length)),
        68,
      );
    } else {
      timer = window.setTimeout(() => {
        setCommandTyped(0);
        setTyped(0);
      }, 2100);
    }

    return () => window.clearTimeout(timer);
  }, [paused, commandText, commandTyped, sequence.length, typed]);

  useEffect(() => {
    setCommandTyped(0);
    setTyped(0);
  }, [mode]);

  const copySequence = async () => {
    try {
      await navigator.clipboard.writeText(sequence);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="overflow-hidden rounded-[3px] border border-neutral-700 bg-[#101214] text-white shadow-[0_22px_70px_rgba(0,0,0,.20)]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 bg-[#191c1f] px-4 py-3">
        <div className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-[#fb6b64]" /><span className="h-2 w-2 rounded-full bg-[#e9b44d]" /><span className="h-2 w-2 rounded-full bg-[#60c58a]" /></div>
        <span className="font-mono text-[8px] tracking-[.13em] text-neutral-400">BIOCRYSTAL / SEQUENCE TERMINAL</span>
        <span className="font-mono text-[8px] text-neutral-600">LOCAL DEMO</span>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
        <div className="flex gap-1">
          <button type="button" onClick={() => onModeChange("reference")} className={`px-3 py-2 font-mono text-[8px] font-bold tracking-wide transition-colors ${mode === "reference" ? "bg-orange-500 text-black" : "bg-neutral-800 text-neutral-400 hover:text-white"}`}>REFERENCE</button>
          <button type="button" onClick={() => onModeChange("observed")} className={`px-3 py-2 font-mono text-[8px] font-bold tracking-wide transition-colors ${mode === "observed" ? "bg-orange-500 text-black" : "bg-neutral-800 text-neutral-400 hover:text-white"}`}>OBSERVED</button>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => setPaused((value) => !value)} aria-label={paused ? "Resume sequence typing" : "Pause sequence typing"} className="inline-flex items-center gap-2 border border-white/15 px-3 py-2 font-mono text-[8px] text-neutral-300 transition-colors hover:border-orange-500 hover:text-orange-400">{paused ? <Play size={12} /> : <Pause size={12} />} {paused ? "PLAY" : "PAUSE"}</button>
          <button type="button" onClick={copySequence} className="inline-flex items-center gap-2 border border-white/15 px-3 py-2 font-mono text-[8px] text-neutral-300 transition-colors hover:border-orange-500 hover:text-orange-400">{copied ? <Check size={12} /> : <Copy size={12} />} {copied ? "COPIED" : "COPY"}</button>
        </div>
      </div>
      <div className="grid lg:grid-cols-[1.08fr_.92fr]">
        <div className="relative min-h-[250px] overflow-hidden border-b border-white/10 p-5 sm:p-7 lg:border-b-0 lg:border-r">
          <div className="bc-grid-dark absolute inset-0 opacity-20" />
          <div className="bc-scan-line pointer-events-none absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r from-transparent via-orange-500/10 to-transparent" />
          <div className="relative">
            <div className="flex items-center justify-between font-mono text-[8px] text-neutral-500"><span>CLIENT / INPUT STREAM</span><span>SEQ-{mode === "reference" ? "REF" : "OBS"}-001</span></div>
            <p className="bc-terminal-command mt-8 font-mono text-xs text-neutral-300">
              <span className="text-orange-400">bio@crystal:~$</span>
              <span>{commandText.slice(0, commandTyped)}</span>
              <span className={`bc-terminal-command__caret ${isTypingCommand ? "" : "is-idle"}`} aria-hidden="true" />
            </p>
            <div className="mt-5 min-h-[54px] break-all font-mono text-base font-bold leading-8 tracking-[.12em] text-orange-400 sm:text-lg">
              {isTypingCommand ? <span className="text-neutral-600">awaiting command…</span> : sequence.slice(0, typed)}
              {!isTypingCommand && <span className="bc-terminal-cursor ml-1 inline-block h-5 w-[2px] bg-orange-500 align-middle" />}
            </div>
            <div className="bc-terminal-stream-meter mt-4" aria-hidden="true">
              <span style={{ width: `${(typed / sequence.length) * 100}%` }} />
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-3 font-mono text-[8px] text-neutral-500">
              <span className="bc-pulse-dot h-2 w-2 rounded-full bg-emerald-400" />
              {streamStatus}
              <span className="text-neutral-700">/</span>
              {typed}/{sequence.length} BASES
            </div>
          </div>
        </div>
        <div className="p-5 sm:p-7">
          <div className="flex items-center justify-between"><p className="font-mono text-[8px] font-bold tracking-[.15em] text-neutral-500">SEQUENCE SUMMARY</p><span className="font-mono text-[8px] text-orange-400">SAMPLE / 001</span></div>
          <div className="mt-5 space-y-3">{[["SEQUENCE LENGTH", `${metrics.length} bp`], ["COMPLETE CODONS", String(metrics.codons)], ["GC CONTENT", `${metrics.gcPercent.toFixed(1)}%`], ["A / T / G / C", `${metrics.counts.A} / ${metrics.counts.T} / ${metrics.counts.G} / ${metrics.counts.C}`], ["VALIDATION", "VALID DNA SAMPLE"]].map(([label, value], i) => <div key={label} className="flex items-center justify-between gap-4 border-b border-white/10 pb-3 font-mono text-[8px]"><span className="text-neutral-500">{label}</span><span className={i === 4 ? "font-bold text-emerald-400" : "font-bold text-neutral-100"}>{value}</span></div>)}</div>
          <ActionButton onClick={onLaunch} variant="light" className="mt-6">OPEN ANALYSIS WORKSPACE</ActionButton>
        </div>
      </div>
    </div>
  );
}


const EVIDENCE_STAGES = [
  {
    number: "01",
    label: "REFERENCE LOCKED",
    short: "REFERENCE",
    description: "Preserve the selected reference sequence as the comparison baseline. Every downstream observation remains tied to the same source.",
    output: "Reference sequence retained",
  },
  {
    number: "02",
    label: "DIFFERENCE LOCATED",
    short: "VARIANT",
    description: "Align the observed sample and isolate the changed nucleotide. Keep the position and neighbouring bases visible for review.",
    output: "Variant position identified",
  },
  {
    number: "03",
    label: "CODON CONTEXT CHECKED",
    short: "CODON",
    description: "Map the changed base into its triplet and inspect the translation context when the coding frame is known.",
    output: "Codon context available for review",
  },
  {
    number: "04",
    label: "EVIDENCE RECORDED",
    short: "EVIDENCE",
    description: "Carry the original sequence, observed difference, calculation and interpretation notes into one traceable result.",
    output: "Analysis context ready to report",
  },
] as const;

function IsometricAnalysisDiagram({ activeStage }: { activeStage: number }) {
  const bases = ["A", "T", "G", "C", "A", "T", "G", "C", "A", "T", "G", "C"];
  const stageColors = ["#ff6500", "#ff6500", "#ff6500", "#ff6500"];
  return (
    <div className="bc-technical-canvas relative overflow-hidden border border-neutral-300 bg-[#f8f7f3]">
      <div className="bc-dot-grid pointer-events-none absolute inset-0 opacity-45" />
      <div className="relative flex items-center justify-between border-b border-neutral-200 px-5 py-4 font-mono text-[8px] font-bold tracking-[.14em] text-neutral-500">
        <span>MOLECULAR EVIDENCE PIPELINE / ISOMETRIC VIEW</span>
        <span>FIG 07.02</span>
      </div>
      <div className="relative px-2 py-5 sm:px-5 sm:py-7">
        <svg viewBox="0 0 920 570" className="w-full" role="img" aria-label="Technical illustration showing DNA sequence input, reference alignment, variant isolation, codon context and scientific evidence output">
          <defs>
            <linearGradient id="bc07-metal" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#ffffff" />
              <stop offset="1" stopColor="#d9d8d1" />
            </linearGradient>
            <linearGradient id="bc07-orange" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0" stopColor="#ff6500" stopOpacity=".15" />
              <stop offset=".5" stopColor="#ff6500" />
              <stop offset="1" stopColor="#ff6500" stopOpacity=".15" />
            </linearGradient>
            <filter id="bc07-glow"><feGaussianBlur stdDeviation="5" result="blur" /><feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
          </defs>

          {/* Engineering registration marks */}
          <g stroke="#d4d2ca" strokeWidth="1" fill="none" opacity=".8">
            <path d="M25 35h35M42 18v34M860 35h35M878 18v34M25 535h35M42 518v34M860 535h35M878 518v34" />
            <path d="M460 35v500M35 285h850" strokeDasharray="2 8" />
          </g>

          {/* Process route */}
          <path d="M115 276H810" fill="none" stroke="#c4c2ba" strokeWidth="2" />
          <path d="M115 276H810" fill="none" stroke="#ff6500" strokeWidth="2.3" className="bc-flow-dash" />
          <circle r="7" fill="#ff6500" filter="url(#bc07-glow)">
            <animateMotion dur="8s" repeatCount="indefinite" path="M115 276H810" />
          </circle>
          <circle r="3" fill="#fff">
            <animateMotion dur="8s" repeatCount="indefinite" path="M115 276H810" />
          </circle>

          {/* 01 / DNA sequence input */}
          <g className={`bc-diagram-unit ${activeStage === 0 ? "is-active" : ""}`}>
            <path d="M45 185L135 135L225 185L135 235Z" fill="url(#bc07-metal)" stroke={activeStage === 0 ? stageColors[0] : "#777970"} strokeWidth={activeStage === 0 ? 3 : 1.3} />
            <path d="M45 185V278L135 328V235Z" fill="#e2e1da" stroke="#8a8b83" />
            <path d="M135 235V328L225 278V185Z" fill="#d2d1ca" stroke="#8a8b83" />
            <path d="M59 188L135 146L211 188L135 230Z" fill="none" stroke="#a5a49d" strokeDasharray="3 4" />
            {bases.map((base, i) => <g key={i}>
              <rect x={72 + (i % 6) * 20} y={174 + Math.floor(i / 6) * 31 - (i % 6) * 3} width="13" height="17" fill={i === 8 && activeStage === 0 ? "#ff6500" : "#252729"} opacity=".92" />
              <text x={78.5 + (i % 6) * 20} y={186 + Math.floor(i / 6) * 31 - (i % 6) * 3} fill="#fff" fontSize="7" textAnchor="middle" fontFamily="monospace">{base}</text>
            </g>)}
            <path d="M135 328v34" stroke="#8d8c85" strokeDasharray="3 4" />
            <text x="135" y="382" textAnchor="middle" fill="#242629" fontFamily="monospace" fontSize="11" fontWeight="bold">01 / INPUT</text>
            <text x="135" y="399" textAnchor="middle" fill="#74756e" fontFamily="monospace" fontSize="8">DNA SAMPLE</text>
          </g>

          {/* 02 / reference alignment plane */}
          <g className={`bc-diagram-unit ${activeStage === 1 ? "is-active" : ""}`}>
            <path d="M250 170L360 110L470 170L360 230Z" fill="url(#bc07-metal)" stroke={activeStage === 1 ? stageColors[1] : "#777970"} strokeWidth={activeStage === 1 ? 3 : 1.3} />
            <path d="M250 170V285L360 345V230Z" fill="#e6e5de" stroke="#8a8b83" />
            <path d="M360 230V345L470 285V170Z" fill="#d5d4cd" stroke="#8a8b83" />
            {Array.from({ length: 5 }, (_, row) => <g key={row}>
              <path d={`M278 ${171 + row * 19}L360 ${216 + row * 19}L442 ${171 + row * 19}`} fill="none" stroke="#9c9c94" strokeWidth="1.2" />
              {Array.from({ length: 7 }, (_, col) => <rect key={col} x={292 + col * 19} y={166 + row * 8 - col * 2.3} width="11" height="7" fill={row === 2 && col === 4 ? "#ff6500" : "#777970"} opacity={row === 2 && col === 4 ? 1 : .55} />)}
            </g>)}
            <path d="M360 345v25" stroke="#8d8c85" strokeDasharray="3 4" />
            <text x="360" y="390" textAnchor="middle" fill="#242629" fontFamily="monospace" fontSize="11" fontWeight="bold">02 / ALIGN</text>
            <text x="360" y="407" textAnchor="middle" fill="#74756e" fontFamily="monospace" fontSize="8">REFERENCE MAP</text>
          </g>

          {/* 03 / variant isolation chip */}
          <g className={`bc-diagram-unit ${activeStage === 2 ? "is-active" : ""}`}>
            <path d="M500 180L595 128L690 180L595 232Z" fill="url(#bc07-metal)" stroke={activeStage === 2 ? stageColors[2] : "#777970"} strokeWidth={activeStage === 2 ? 3 : 1.3} />
            <path d="M500 180V286L595 338V232Z" fill="#deddd6" stroke="#8a8b83" />
            <path d="M595 232V338L690 286V180Z" fill="#c9c8c1" stroke="#8a8b83" />
            <path d="M530 181L595 146L660 181L595 216Z" fill="#f8f7f3" stroke="#999991" />
            <path d="M545 181L595 154L645 181L595 208Z" fill="none" stroke="#a5a49d" strokeDasharray="3 3" />
            <path d="M579 181l16 -9 16 9 -16 9Z" fill="#ff6500" filter="url(#bc07-glow)" />
            <path d="M595 232V338" stroke="#ff6500" strokeWidth="1.5" strokeDasharray="4 5" />
            <path d="M595 338v34" stroke="#8d8c85" strokeDasharray="3 4" />
            <text x="595" y="392" textAnchor="middle" fill="#242629" fontFamily="monospace" fontSize="11" fontWeight="bold">03 / VARIANT</text>
            <text x="595" y="409" textAnchor="middle" fill="#74756e" fontFamily="monospace" fontSize="8">POSITION + BASE</text>
          </g>

          {/* 04 / codon and report output */}
          <g className={`bc-diagram-unit ${activeStage === 3 ? "is-active" : ""}`}>
            <path d="M730 164L805 123L880 164L805 205Z" fill="url(#bc07-metal)" stroke={activeStage === 3 ? stageColors[3] : "#777970"} strokeWidth={activeStage === 3 ? 3 : 1.3} />
            <path d="M730 164V262L805 303V205Z" fill="#e0dfd8" stroke="#8a8b83" />
            <path d="M805 205V303L880 262V164Z" fill="#cfcec7" stroke="#8a8b83" />
            <path d="M750 164L805 134L860 164L805 194Z" fill="#17191b" stroke="#ff6500" />
            <g fontFamily="monospace" fontSize="11" fontWeight="bold" textAnchor="middle">
              <text x="780" y="167" fill="#fff">A</text><text x="805" y="181" fill="#ff6500">C</text><text x="830" y="167" fill="#fff">G</text>
            </g>
            <path d="M805 303v47" stroke="#8d8c85" strokeDasharray="3 4" />
            <text x="805" y="370" textAnchor="middle" fill="#242629" fontFamily="monospace" fontSize="11" fontWeight="bold">04 / RECORD</text>
            <text x="805" y="387" textAnchor="middle" fill="#74756e" fontFamily="monospace" fontSize="8">CODON + REPORT</text>
          </g>

          {/* labels and leader lines */}
          <g fill="none" stroke="#85867e" strokeWidth="1">
            <path d="M85 140L49 89H20" /><path d="M360 110V66H295" /><path d="M595 128V72H660" /><path d="M840 144L885 101" />
          </g>
          <g fill="#5f605a" fontFamily="monospace" fontSize="8" fontWeight="bold">
            <text x="20" y="78">INPUT STRING</text><text x="295" y="56">REFERENCE ALIGNMENT</text><text x="660" y="62">CHANGED BASE</text><text x="860" y="91" textAnchor="end">CODING CONTEXT</text>
          </g>
        </svg>
      </div>
      <div className="relative grid grid-cols-2 border-t border-neutral-300 bg-white/65 sm:grid-cols-4">
        {EVIDENCE_STAGES.map((stage, index) => <div key={stage.number} className={`border-r border-neutral-300 px-3 py-4 text-left last:border-r-0 ${activeStage === index ? "bg-orange-500/10" : ""}`}>
          <span className="block font-mono text-[7px] text-neutral-500">{stage.number} / STAGE</span>
          <span className={`mt-1 block font-mono text-[8px] font-black ${activeStage === index ? "text-orange-700" : "text-neutral-700"}`}>{stage.short}</span>
        </div>)}
      </div>
    </div>
  );
}

function InterpretationLoopSection({ onLaunch }: { onLaunch: () => void }) {
  const [activeStage, setActiveStage] = useState(0);
  const active = EVIDENCE_STAGES[activeStage];
  const currentMetrics = sequenceMetrics(OBSERVED_SEQUENCE);
  const codons = Array.from({ length: currentMetrics.codons }, (_, index) => {
    const triplet = OBSERVED_SEQUENCE.slice(index * 3, index * 3 + 3);
    return { label: `C${String(index + 1).padStart(2, "0")}`, triplet, gc: (triplet.match(/[GC]/g) ?? []).length };
  });
  const chartPoints = codons.map((item, index) => ({ x: 70 + index * 142, y: 210 - (item.gc / 3) * 150 }));
  const chartLine = chartPoints.map((point) => `${point.x},${point.y}`).join(" ");

  return (
    <section id="interpretation" className="scroll-mt-20 bg-[#f4f3ef] px-5 py-20 md:px-10 md:py-24 lg:px-16">
      <div className="mx-auto max-w-[1400px]">
        <SectionRule number="07" title="FORWARD-TRACEABLE VARIANT REVIEW" meta="REFERENCE / ALIGNMENT / CODON / EVIDENCE" />

        <Reveal className="mt-14 grid items-start gap-9 lg:grid-cols-[.78fr_1.22fr] lg:gap-14">
          <div className="pt-1">
            <h2 className="max-w-[570px] text-[clamp(2.8rem,5vw,5.25rem)] font-black leading-[.91] tracking-[-.075em]">
              THE SEQUENCE ENDS.<br />THE <span className="text-orange-600">INVESTIGATION</span><br />DOESN'T.
            </h2>
            <p className="mt-6 max-w-[490px] text-[14px] leading-7 text-neutral-700">
              BioCrystal keeps each computational step connected to the sequence it came from. Move from a verified reference to a located difference, inspect its codon context, and preserve the evidence for review.
            </p>
            <div className="mt-8 flex items-center gap-3 font-mono text-[8px] font-bold tracking-[.13em] text-neutral-500"><span className="h-[2px] w-8 bg-orange-500" /> THE REVIEW LOOP / FOUR CHECKPOINTS</div>
            <div className="mt-4 border-t border-neutral-300">
              {EVIDENCE_STAGES.map((stage, index) => {
                const selected = activeStage === index;
                return <button key={stage.number} type="button" onClick={() => setActiveStage(index)} aria-pressed={selected} className={`bc-step-row grid w-full grid-cols-[38px_1fr_20px] gap-3 border-b border-neutral-300 py-4 text-left transition-colors ${selected ? "bg-white/75" : "hover:bg-white/50"}`}>
                  <span className={`pt-0.5 font-mono text-[10px] font-black ${selected ? "text-orange-600" : "text-neutral-400"}`}>{stage.number}</span>
                  <span>
                    <span className="flex flex-wrap items-center gap-2 font-mono text-[8px] font-black tracking-[.12em]">{stage.label}{selected && <span className="bg-orange-500 px-1.5 py-1 text-[7px] text-black">CURRENT</span>}</span>
                    <span className="mt-2 block max-w-md text-[12px] leading-6 text-neutral-600">{stage.description}</span>
                  </span>
                  <ChevronRight size={15} className={`mt-1 transition-transform ${selected ? "translate-x-1 text-orange-600" : "text-neutral-400 group-hover:translate-x-1"}`} />
                </button>;
              })}
            </div>
            <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-l-2 border-orange-500 bg-[#eeede7] px-4 py-3">
              <div><p className="font-mono text-[7px] font-bold tracking-[.14em] text-neutral-500">ACTIVE CHECKPOINT / {active.number}</p><p className="mt-1 text-[12px] font-semibold">{active.output}</p></div>
              <div className="flex gap-1">{EVIDENCE_STAGES.map((stage, index) => <span key={stage.number} className={`h-[3px] w-5 transition-colors ${index <= activeStage ? "bg-orange-500" : "bg-neutral-300"}`} />)}</div>
            </div>
          </div>
          <div className="space-y-5">
            <IsometricAnalysisDiagram activeStage={activeStage} />
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-300 pb-4 font-mono text-[8px] font-bold tracking-[.12em] text-neutral-500"><span>ONE SAMPLE / FIVE COMPLETE CODONS</span><span className="text-orange-700">BUILT-IN DEMONSTRATION DATA</span></div>
            <div className="grid gap-4 lg:grid-cols-[1.12fr_.88fr]">
              <div className="border border-neutral-300 bg-[#faf9f6] p-4 sm:p-5">
                <div className="flex items-start justify-between gap-3"><div><p className="font-mono text-[8px] font-black tracking-[.14em]">GC FRACTION BY CODON</p><p className="mt-1 text-[10px] text-neutral-500">Observed demonstration sequence</p></div><span className="font-mono text-[7px] text-neutral-400">FIG 07.03</span></div>
                <svg viewBox="0 0 680 275" className="mt-4 w-full" role="img" aria-label="Calculated GC content by codon for the observed demonstration DNA sequence">
                  <g stroke="#deddd6" strokeWidth="1"><path d="M48 35H650" /><path d="M48 91H650" /><path d="M48 147H650" /><path d="M48 203H650" /></g>
                  <g fill="#777873" fontSize="9" fontFamily="monospace"><text x="8" y="39">100%</text><text x="17" y="95">75%</text><text x="17" y="151">50%</text><text x="17" y="207">25%</text></g>
                  <path d="M48 19V220H650" fill="none" stroke="#85867e" strokeWidth="1" />
                  {codons.map((item, index) => {
                    const x = 95 + index * 130;
                    const y = 220 - item.gc / 3 * 180;
                    return <g key={item.label}><rect x={x - 18} y={220 - item.gc / 3 * 180} width="36" height={item.gc / 3 * 180} fill={index === 2 ? "#ff6500" : "#252729"} opacity={index === 2 ? 1 : .8} className="bc-bar-grow" style={{ animationDelay: `${index * 100}ms` }} /><text x={x} y="244" textAnchor="middle" fill="#60615b" fontSize="9" fontFamily="monospace">{item.label}</text><text x={x} y={Math.max(18, y - 10)} textAnchor="middle" fill="#282a2b" fontSize="9" fontFamily="monospace">{item.gc}/3</text></g>;
                  })}
                  {chartPoints.length > 1 && <polyline points={chartLine} fill="none" stroke="#ff6500" strokeWidth="2.4" strokeLinejoin="round" strokeLinecap="round" className="bc-chart-line" />}
                  {chartPoints.map((point, index) => <circle key={index} cx={point.x} cy={point.y} r="4.5" fill="#ff6500" stroke="#faf9f6" strokeWidth="2" className="bc-chart-point" />)}
                </svg>
                <div className="mt-1 flex items-center justify-between border-t border-neutral-200 pt-3 font-mono text-[7px] text-neutral-500"><span>CODON POSITION / 5′ → 3′</span><span>G + C / 3 BASES</span></div>
              </div>
              <div className="grid grid-cols-2 border-l border-t border-neutral-300">
                {[
                  { label: "SEQUENCE LENGTH", value: `${currentMetrics.length}`, unit: "BASES", tone: "orange" },
                  { label: "GC CONTENT", value: `${currentMetrics.gcPercent.toFixed(1)}%`, unit: `${currentMetrics.gcCount} OF ${currentMetrics.length}`, tone: "paper" },
                  { label: "COMPLETE CODONS", value: String(currentMetrics.codons).padStart(2, "0"), unit: "TRIPLETS", tone: "paper" },
                  { label: "OBSERVED DIFFERENCES", value: "01", unit: "VS REFERENCE", tone: "dark" },
                ].map((metric) => <div key={metric.label} className={`bc-benchmark-tile flex min-h-[130px] flex-col justify-between border-b border-r border-neutral-300 p-4 sm:min-h-[145px] sm:p-5 ${metric.tone === "orange" ? "bg-orange-500 text-black" : metric.tone === "dark" ? "bg-[#111315] text-white" : "bg-[#faf9f6] text-neutral-950"}`}>
                  <p className="font-mono text-[7px] font-black tracking-[.12em] opacity-65">{metric.label}</p>
                  <div><p className="bc-number-reveal text-[clamp(2rem,3.4vw,3.5rem)] font-black leading-none tracking-[-.07em]">{metric.value}</p><p className={`mt-2 font-mono text-[7px] font-bold tracking-[.1em] ${metric.tone === "dark" ? "text-orange-400" : "opacity-60"}`}>{metric.unit}</p></div>
                </div>)}
              </div>
            </div>
            <div className="flex flex-wrap gap-6 pt-1">
              <button type="button" onClick={onLaunch} className="group inline-flex items-center gap-2 border-b border-neutral-900 pb-1 text-[13px] font-medium transition-colors hover:border-orange-600 hover:text-orange-700">OPEN MOLECULAR WORKSPACE <ArrowUpRight size={15} className="text-orange-600 transition-transform group-hover:-translate-y-1 group-hover:translate-x-1" /></button>
              <a href="#workflow" className="group inline-flex items-center gap-2 border-b border-neutral-300 pb-1 text-[13px] font-medium transition-colors hover:border-orange-600 hover:text-orange-700">HOW THE ANALYSIS WORKS <ArrowUpRight size={15} className="text-orange-600 transition-transform group-hover:-translate-y-1 group-hover:translate-x-1" /></a>
            </div>
            <p className="font-mono text-[7px] leading-5 text-neutral-500">NOTE / METRICS ARE CALCULATED FROM THE BUILT-IN OBSERVED DEMONSTRATION SEQUENCE. THEY ARE DESCRIPTIVE SAMPLE METRICS, NOT CLINICAL PERFORMANCE CLAIMS.</p>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

const ANALYSIS_TABS = [
  {
    number: "01",
    id: "alignment",
    label: "REFERENCE ALIGNMENT",
    title: "Keep the reference in view.",
    body: "Compare the observed sample against a named baseline. The original sequence stays visible while differences are isolated, so the analysis does not lose its point of comparison.",
    points: ["Reference sequence retained", "Observed bases aligned by position", "Differences separated from interpretation"],
    output: "POSITIONAL COMPARISON / REFERENCE + OBSERVED",
  },
  {
    number: "02",
    id: "codon",
    label: "CODON INTERPRETATION",
    title: "Read the change in its triplet.",
    body: "A nucleotide is interpreted within its codon, not in isolation. Inspect the triplet before and after a substitution and review the amino-acid annotation when the reading frame is established.",
    points: ["Affected codon identified", "Reading-frame assumption stated", "Translation context displayed"],
    output: "CODING CONTEXT / TRIPLET + AMINO ACID",
  },
  {
    number: "03",
    id: "report",
    label: "EVIDENCE REPORT",
    title: "Carry the evidence forward.",
    body: "A useful report preserves what was entered, what changed, which calculations were performed and what assumptions were used. The result is structured for review instead of presented as an unsupported verdict.",
    points: ["Input and reference documented", "Computed metrics included", "Interpretation and assumptions separated"],
    output: "TRACEABLE OUTPUT / SAMPLE + FINDING + CONTEXT",
  },
] as const;

type AnalysisTabId = (typeof ANALYSIS_TABS)[number]["id"];

function ExplodedEvidenceStack({ activeTab }: { activeTab: number }) {
  return (
    <div className="relative overflow-hidden border border-neutral-800 bg-[#101214] text-white">
      <div className="flex items-center justify-between border-b border-white/10 px-5 py-4 font-mono text-[8px] font-bold tracking-[.14em] text-neutral-400"><span>SEQUENCE EVIDENCE / EXPLODED VIEW</span><span>FIG 08.04</span></div>
      <div className="bc-grid-dark relative min-h-[470px] overflow-hidden px-2 py-4 sm:min-h-[570px] sm:px-5">
        <div className="bc-blueprint-glow pointer-events-none absolute inset-0" />
        <svg viewBox="0 0 900 560" className="relative z-10 w-full" role="img" aria-label="Exploded scientific evidence diagram showing stacked DNA sequence, alignment, codon interpretation and reporting layers">
          <defs>
            <linearGradient id="bc08-sheet" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#34383c" /><stop offset="1" stopColor="#181b1e" /></linearGradient>
            <filter id="bc08-highlight"><feGaussianBlur stdDeviation="4" result="blur" /><feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
          </defs>
          <g fill="none" stroke="#53575b" strokeWidth="1" strokeDasharray="4 6" opacity=".8"><path d="M80 100L450 20L820 100L450 180Z" /><path d="M80 200L450 120L820 200L450 280Z" /><path d="M80 300L450 220L820 300L450 380Z" /><path d="M80 400L450 320L820 400L450 480Z" /><path d="M450 28V505" /></g>
          {/* Base sheet: reference sequence */}
          <g className={`bc-stack-layer ${activeTab === 0 ? "is-selected" : ""}`}>
            <path d="M120 390L450 318L780 390L450 470Z" fill="url(#bc08-sheet)" stroke={activeTab === 0 ? "#ff6500" : "#73777b"} strokeWidth={activeTab === 0 ? 2.6 : 1.2} />
            <path d="M160 390L450 326L740 390L450 454Z" fill="none" stroke="#6c7175" strokeWidth="1" />
            {Array.from({ length: 13 }, (_, i) => {
              const x = 220 + i * 38;
              const y = 390 - Math.abs(6 - i) * 8;
              const letters = ["A", "T", "G", "G", "C", "T", "A", "C", "G", "G", "G", "T", "T"];
              return <g key={i}><rect x={x - 10} y={y - 10} width="20" height="20" fill={i === 8 ? "#ff6500" : "#464b4f"} stroke={i === 8 ? "#ffad79" : "#81868b"} strokeWidth=".7" transform={`rotate(0 ${x} ${y})`} /><text x={x} y={y + 3} textAnchor="middle" fill={i === 8 ? "#111315" : "#e8e7e1"} fontFamily="monospace" fontSize="9" fontWeight="bold">{letters[i]}</text></g>;
            })}
            <text x="450" y="493" fill="#a8adb1" textAnchor="middle" fontFamily="monospace" fontSize="9" letterSpacing="2">LAYER 01 / OBSERVED SEQUENCE</text>
          </g>
          {/* Alignment sheet */}
          <g className={`bc-stack-layer ${activeTab === 0 ? "is-selected" : ""}`}>
            <path d="M120 292L450 220L780 292L450 372Z" fill="url(#bc08-sheet)" stroke={activeTab === 0 ? "#ff6500" : "#73777b"} strokeWidth={activeTab === 0 ? 2.3 : 1.2} />
            <path d="M170 292L450 231L730 292L450 353Z" fill="none" stroke="#6c7175" />
            {Array.from({ length: 5 }, (_, row) => <g key={row}><path d={`M205 ${280 + row * 8}L450 ${226 + row * 8}L695 ${280 + row * 8}`} stroke="#6b7074" strokeWidth="1" fill="none" />{Array.from({ length: 8 }, (_, col) => <path key={col} d={`M${254 + col * 28} ${270 + row * 8 - col * 2.3}h15`} stroke={row === 2 && col === 4 ? "#ff6500" : "#b6b8b5"} strokeWidth={row === 2 && col === 4 ? 4 : 1.5} />)}</g>)}
            <path d="M450 220L450 170" stroke="#ff6500" strokeDasharray="4 5" /><circle cx="450" cy="170" r="5" fill="#ff6500" className="bc-diagram-pulse" />
            <text x="450" y="397" fill="#a8adb1" textAnchor="middle" fontFamily="monospace" fontSize="9" letterSpacing="2">LAYER 02 / REFERENCE ALIGNMENT</text>
          </g>
          {/* Codon annotation sheet */}
          <g className={`bc-stack-layer ${activeTab === 1 ? "is-selected" : ""}`}>
            <path d="M170 194L450 132L730 194L450 258Z" fill="url(#bc08-sheet)" stroke={activeTab === 1 ? "#ff6500" : "#73777b"} strokeWidth={activeTab === 1 ? 2.8 : 1.2} />
            <path d="M260 194L450 152L640 194L450 236Z" fill="#111315" stroke="#777c80" />
            {[
              { x: 370, t: "A" }, { x: 450, t: "C" }, { x: 530, t: "G" },
            ].map((b, i) => <g key={b.t}><path d={`M${b.x - 30} 194l30 -7 30 7 -30 7Z`} fill={i === 1 ? "#ff6500" : "#44494d"} stroke={i === 1 ? "#ffb27d" : "#777c80"} /><text x={b.x} y="198" textAnchor="middle" fill={i === 1 ? "#111315" : "#fff"} fontFamily="monospace" fontSize="13" fontWeight="bold">{b.t}</text></g>)}
            <path d="M450 132V101" stroke="#ff6500" strokeDasharray="4 5" /><circle cx="450" cy="101" r="5" fill="#ff6500" className="bc-diagram-pulse" />
            <text x="450" y="281" fill="#a8adb1" textAnchor="middle" fontFamily="monospace" fontSize="9" letterSpacing="2">LAYER 03 / CODON WINDOW</text>
          </g>
          {/* Report output sheet */}
          <g className={`bc-stack-layer ${activeTab === 2 ? "is-selected" : ""}`}>
            <path d="M240 96L450 50L660 96L450 144Z" fill="url(#bc08-sheet)" stroke={activeTab === 2 ? "#ff6500" : "#73777b"} strokeWidth={activeTab === 2 ? 2.8 : 1.2} />
            <path d="M300 96L450 63L600 96L450 129Z" fill="#1b1f22" stroke="#73777b" />
            <path d="M360 91L450 71L540 91L450 111Z" fill="#282c30" stroke="#ff6500" />
            <g stroke="#9fa4a7" strokeWidth="1"><path d="M370 91l80 -17 80 17M385 101l65 -14 65 14M405 111l45 -10 45 10" /></g>
            <path d="M450 50V22" stroke="#ff6500" strokeDasharray="4 5" /><circle cx="450" cy="22" r="5" fill="#ff6500" className="bc-diagram-pulse" />
            <text x="450" y="166" fill="#ff6500" textAnchor="middle" fontFamily="monospace" fontSize="9" letterSpacing="2">LAYER 04 / EVIDENCE REPORT</text>
          </g>
          {/* Moving scan path */}
          <path d="M90 520H810" stroke="#4b5054" strokeWidth="1" strokeDasharray="2 7" />
          <path d="M90 520H810" stroke="#ff6500" strokeWidth="1.4" strokeDasharray="44 676" className="bc-scan-path" />
          <g fill="#a8adb1" fontFamily="monospace" fontSize="8"><text x="90" y="540">SOURCE DATA</text><text x="450" y="540" textAnchor="middle">ANNOTATION STACK</text><text x="810" y="540" textAnchor="end">TRACEABLE OUTPUT</text></g>
        </svg>
      </div>
      <div className="grid grid-cols-2 border-t border-white/10 sm:grid-cols-4">
        {[["01", "SEQUENCE"], ["02", "ALIGNMENT"], ["03", "CODON"], ["04", "REPORT"]].map(([n, label], index) => <div key={n} className={`border-r border-white/10 px-4 py-3 last:border-r-0 ${activeTab === Math.min(index, 2) ? "bg-orange-500/10" : ""}`}><p className="font-mono text-[7px] text-neutral-500">LAYER {n}</p><p className={`mt-1 font-mono text-[8px] font-bold ${activeTab === Math.min(index, 2) ? "text-orange-400" : "text-neutral-300"}`}>{label}</p></div>)}
      </div>
    </div>
  );
}

function AnalysisEvolutionSection({ onLaunch }: { onLaunch: () => void }) {
  const [activeTab, setActiveTab] = useState<AnalysisTabId>("alignment");
  const activeIndex = ANALYSIS_TABS.findIndex((tab) => tab.id === activeTab);
  const active = ANALYSIS_TABS[activeIndex] ?? ANALYSIS_TABS[0];

  return (
    <section id="analysis-evolution" className="scroll-mt-20 bg-[#f4f3ef] px-5 py-20 md:px-10 md:py-24 lg:px-16">
      <div className="mx-auto max-w-[1400px]">
        <SectionRule number="08" title="THE ANALYSIS DOES NOT STOP AT DETECTION" meta="REFERENCE / CODING CONTEXT / EVIDENCE OUTPUT" />
        <Reveal className="mt-14 max-w-[780px]">
          <h2 className="text-[clamp(2.8rem,5.2vw,5.7rem)] font-black leading-[.9] tracking-[-.075em]">A FINDING IS A STARTING POINT.<br /><span className="text-orange-600">NOT THE FINAL ANSWER.</span></h2>
          <p className="mt-6 max-w-[630px] text-sm leading-7 text-neutral-700">Good analysis makes its reasoning inspectable. Move between sequence alignment, codon interpretation and report preparation while the evidence stack shows how each view builds on the last.</p>
        </Reveal>

        <Reveal className="mt-12">
          <div role="tablist" aria-label="Analysis stages" className="grid border border-neutral-300 bg-[#efeee8] md:grid-cols-3">
            {ANALYSIS_TABS.map((tab) => <button key={tab.id} role="tab" id={`bc-tab-${tab.id}`} aria-selected={activeTab === tab.id} aria-controls="bc-analysis-panel" type="button" onClick={() => setActiveTab(tab.id)} className={`bc-analysis-tab flex min-h-[62px] items-center gap-3 border-b border-r border-neutral-300 px-4 py-4 text-left font-mono text-[8px] font-black tracking-[.09em] transition-colors last:border-r-0 md:border-b-0 ${activeTab === tab.id ? "bg-[#faf9f6] text-neutral-950" : "text-neutral-500 hover:bg-white/70 hover:text-neutral-900"}`}><span className={`h-2 w-2 shrink-0 ${activeTab === tab.id ? "bg-orange-500" : "bg-neutral-400"}`} /><span className="text-orange-700">{tab.number}</span>{tab.label}<span className={`ml-auto h-[2px] w-5 transition-all ${activeTab === tab.id ? "bg-orange-500" : "bg-transparent"}`} /></button>)}
          </div>
        </Reveal>

        <div id="bc-analysis-panel" role="tabpanel" aria-labelledby={`bc-tab-${active.id}`} className="grid gap-8 border-x border-b border-neutral-300 bg-[#faf9f6] p-5 sm:p-8 lg:grid-cols-[.82fr_1.18fr] lg:gap-12 lg:p-10">
          <div className="flex flex-col">
            <p className="font-mono text-[8px] font-black tracking-[.15em] text-orange-700">{active.number} / {active.label}</p>
            <h3 key={active.title} className="bc-panel-title mt-7 max-w-[440px] text-3xl font-semibold leading-[1.05] tracking-[-.045em] sm:text-4xl">{active.title}</h3>
            <p className="mt-5 max-w-[470px] text-[13px] leading-7 text-neutral-600">{active.body}</p>
            <div className="mt-8 border-t border-neutral-300">
              {active.points.map((point, index) => <div key={point} className="grid grid-cols-[28px_1fr] gap-3 border-b border-neutral-300 py-4"><span className="font-mono text-[8px] font-black text-orange-600">0{index + 1}</span><p className="text-[12px] leading-6 text-neutral-700">{point}</p></div>)}
            </div>
            <div className="mt-7 flex flex-wrap items-center gap-4">
              <ActionButton onClick={onLaunch} variant="dark">OPEN THE LAB</ActionButton>
              <span className="font-mono text-[7px] font-bold tracking-[.1em] text-neutral-500">AVAILABLE IN WORKSPACE</span>
            </div>
          </div>
          <div className="min-w-0">
            <ExplodedEvidenceStack activeTab={activeIndex} />
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-neutral-300 pt-4 font-mono text-[7px] font-bold tracking-[.12em] text-neutral-500"><span>{active.output}</span><span className="flex items-center gap-2 text-orange-700"><span className="bc-diagram-pulse h-2 w-2 rounded-full bg-orange-500" /> VIEW / {active.number} OF 03</span></div>
          </div>
        </div>
      </div>
    </section>
  );
}

export const LandingPage = ({ onLaunch }: LandingPageProps) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [sequenceMode, setSequenceMode] = useState<SequenceMode>("reference");
  const [activeCapability, setActiveCapability] = useState<CapabilityId>("sequence");
  const [selectedBase, setSelectedBase] = useState(MUTATION_INDEX);

  const currentSequence = sequenceMode === "reference" ? REFERENCE_SEQUENCE : OBSERVED_SEQUENCE;
  const metrics = useMemo(() => sequenceMetrics(currentSequence), [currentSequence]);
  const selectedNucleotide = currentSequence[selectedBase] as Base;
  const complementaryBase = COMPLEMENT[selectedNucleotide];
  const codon = codonAt(currentSequence, selectedBase);
  const activeCapabilityIndex = CAPABILITIES.findIndex((item) => item.id === activeCapability);
  const activeCapabilityData = CAPABILITIES[activeCapabilityIndex] ?? CAPABILITIES[0];

  const launch = () => {
    setMenuOpen(false);
    onLaunch();
  };



  const navItems = [
    ["PLATFORM", "#platform"],
    ["BENCHMARKS", "#benchmarks"],
    ["MOLECULAR LAB", "#molecular"],
    ["WORKFLOW", "#workflow"],
    ["CAPABILITIES", "#capabilities"],
    ["INTERPRETATION", "#interpretation"],
    ["ANALYSIS SYSTEM", "#analysis-evolution"],
  ];

  return (
    <div id="top" className="bc-page relative min-h-screen overflow-x-clip font-sans selection:bg-orange-500 selection:text-black">
      <style>{STYLES}</style>

      <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-0 opacity-[.035]"><TechnicalGrid /></div>
      <div aria-hidden="true" className="bc-hatch pointer-events-none fixed inset-y-0 left-0 z-[60] hidden w-5 border-r border-neutral-300 opacity-50 md:block" />
      <div aria-hidden="true" className="bc-hatch pointer-events-none fixed inset-y-0 right-0 z-[60] hidden w-5 border-l border-neutral-300 opacity-50 md:block" />

      {/* Top navigation */}
      <header className="sticky top-0 z-50 border-b border-neutral-300/90 bg-[#f4f3ef]/95 backdrop-blur-xl">
        <div className="mx-auto flex min-h-[68px] max-w-[1480px] items-center justify-between gap-4 px-5 md:px-10 lg:px-16">
          <a href="#top" aria-label="BioCrystal 3D home" className="group flex shrink-0 items-center gap-2.5">
            <span className="grid h-8 w-8 place-items-center border border-neutral-900 transition-all duration-300 group-hover:rotate-45 group-hover:border-orange-500 group-hover:bg-orange-500"><Dna size={19} className="-rotate-45 transition-transform group-hover:rotate-0" /></span>
            <span className="text-[17px] font-black tracking-[-.075em]">BIOCRYSTAL<span className="text-orange-600">3D</span></span>
          </a>

          <nav className={`${menuOpen ? "flex" : "hidden"} absolute left-0 right-0 top-full flex-col border-b border-neutral-300 bg-[#f4f3ef] px-6 py-4 shadow-xl md:static md:flex md:flex-row md:items-center md:gap-7 md:border-0 md:bg-transparent md:p-0 md:shadow-none`}>
            {navItems.map(([label, href]) => <a key={href} href={href} onClick={() => setMenuOpen(false)} className={`bc-nav-link border-b border-neutral-200 py-4 font-mono text-[9px] font-bold tracking-[.12em] text-neutral-600 transition-colors hover:text-neutral-950 md:border-0 md:py-2 ${href === "#interpretation" || href === "#insights" ? "md:hidden 2xl:block" : ""}`}>{label}</a>)}
          </nav>

          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            <ActionButton onClick={launch} variant="dark" className="bc-precision-cta--compact hidden sm:inline-flex">OPEN LAB</ActionButton>
            <button type="button" onClick={() => setMenuOpen((value) => !value)} aria-expanded={menuOpen} aria-label={menuOpen ? "Close navigation" : "Open navigation"} className="grid h-10 w-10 place-items-center border border-neutral-300 transition-colors hover:border-orange-500 hover:bg-orange-500 md:hidden">{menuOpen ? <X size={18} /> : <Menu size={18} />}</button>
            <button type="button" onClick={launch} aria-label="Launch BioCrystal workspace" className="hidden h-10 w-10 place-items-center border border-neutral-300 transition-colors hover:border-orange-500 hover:bg-orange-500 sm:grid"><ArrowUpRight size={17} /></button>
          </div>
        </div>
      </header>

      <main className="relative z-10">
        {/* Hero */}
        <section className="relative overflow-hidden px-5 pb-16 pt-12 md:px-10 md:pb-20 md:pt-16 lg:px-16">
          <div className="mx-auto max-w-[1400px]">
            <Reveal>
              <div className="mb-10 flex flex-wrap items-center justify-between gap-4">
                <Eyebrow>COMPUTATIONAL BIOLOGY / DNA INTELLIGENCE</Eyebrow>
                <div className="flex gap-5 font-mono text-[8px] font-bold tracking-[.12em] text-neutral-500"><span>PROJECT / BC-3D</span><span>MODE / RESEARCH</span><span>REV / 01.05</span></div>
              </div>
            </Reveal>

            <div className="grid items-center gap-10 lg:grid-cols-[1.08fr_.92fr] lg:gap-12">
              <Reveal>
                <div>
                  <h1 className="bc-hero-title max-w-[850px] text-[clamp(3.2rem,7.7vw,7.6rem)] font-black leading-[.84] tracking-[-.085em]">
                    <span className="bc-hero-title__line">READ THE CODE.</span>
                    <span className="bc-hero-title__line bc-hero-title__line--accent text-orange-600">REVEAL THE CHANGE.</span>
                  </h1>
                  <p className="mt-8 max-w-[600px] text-sm leading-7 text-neutral-600 md:text-base md:leading-8">A scientific workspace for exploring DNA mutations through sequence analysis, codon translation and interactive molecular visualization.</p>
                  <div className="mt-8 flex flex-wrap items-center gap-4">
                    <ActionButton onClick={launch} variant="dark">LAUNCH LABORATORY</ActionButton>
                    <a href="#platform" className="group inline-flex items-center gap-3 px-2 py-3 font-mono text-[9px] font-black tracking-[.11em] text-neutral-800 transition-colors hover:text-orange-700">EXPLORE THE PLATFORM <ArrowDown size={14} className="transition-transform group-hover:translate-y-1" /></a>
                  </div>
                  <div className="mt-10 flex flex-wrap gap-x-7 gap-y-3 border-t border-neutral-300 pt-5 font-mono text-[8px] font-bold tracking-[.1em] text-neutral-500"><span className="flex items-center gap-2"><ShieldCheck size={14} className="text-orange-600" /> REFERENCE-AWARE ANALYSIS</span><span className="flex items-center gap-2"><Atom size={14} className="text-orange-600" /> MOLECULAR INSPECTION</span><span className="flex items-center gap-2"><Activity size={14} className="text-orange-600" /> SEQUENCE METRICS</span></div>
                </div>
              </Reveal>
              <Reveal delay={130}><DNAHelix /></Reveal>
            </div>

            <Reveal className="mt-14">
              <SequenceTerminal mode={sequenceMode} onModeChange={setSequenceMode} onLaunch={launch} />
            </Reveal>

            <div className="mt-7 flex items-center gap-4 font-mono text-[8px] font-bold tracking-[.13em] text-neutral-500"><span>01 / 08</span><span className="h-px flex-1 bg-neutral-300" /><span>SCROLL TO EXPLORE</span><ArrowDown size={14} className="text-orange-600" /></div>
          </div>
        </section>

        {/* Platform overview */}
        <section id="platform" className="scroll-mt-20 border-y border-neutral-300 bg-[#eeede7] px-5 py-20 md:px-10 lg:px-16">
          <div className="mx-auto max-w-[1400px]">
            <SectionRule number="01" title="THE PLATFORM" meta="SEQUENCE / STRUCTURE / INTERPRETATION" />
            <Reveal className="mt-16 grid gap-10 lg:grid-cols-[1.1fr_.9fr] lg:gap-24">
              <h2 className="text-5xl font-black leading-[.88] tracking-[-.08em] md:text-7xl">FROM RAW DATA<br />TO <span className="text-orange-600">MOLECULAR</span><br />UNDERSTANDING.</h2>
              <div className="max-w-xl"><Eyebrow>ONE SCIENTIFIC ENVIRONMENT</Eyebrow><p className="mt-6 text-sm leading-7 text-neutral-600">BioCrystal 3D connects the steps that are often scattered across separate tools: sequence validation, mutation comparison, codon context, molecular visualization and reporting.</p><p className="mt-4 text-sm leading-7 text-neutral-600">Move from a nucleotide-level difference to the surrounding biological context without losing track of the reference sequence.</p><button type="button" onClick={launch} className="bc-button mt-7 inline-flex items-center gap-5 border border-neutral-950 bg-neutral-950 px-5 py-4 font-mono text-[9px] font-black tracking-[.12em] text-white">ENTER THE WORKSPACE <ArrowUpRight size={15} /></button></div>
            </Reveal>
            <Reveal className="mt-16 grid border border-neutral-300 sm:grid-cols-2 lg:grid-cols-3">
              {[
                { n: "01", title: "SEQUENCE ANALYSIS", desc: "Validate nucleotide input, inspect base composition and calculate sequence properties.", icon: Binary, tag: "BIOINFORMATICS" },
                { n: "02", title: "MUTATION DETECTION", desc: "Compare reference and observed sequences and identify the position and type of variation.", icon: ScanSearch, tag: "COMPARATIVE ANALYSIS" },
                { n: "03", title: "MOLECULAR MODELING", desc: "Explore an interactive DNA representation and inspect selected nucleotide positions.", icon: Layers3, tag: "3D VISUALIZATION" },
              ].map((card) => <article key={card.n} className="bc-card-hover group relative flex min-h-[280px] flex-col border-b border-r border-neutral-300 p-7"><div className="flex items-center justify-between"><span className="font-mono text-[9px] font-black text-orange-700">{card.n} / {card.tag}</span><span className="grid h-11 w-11 place-items-center border border-neutral-300 bg-white text-orange-600 transition-all duration-300 group-hover:rotate-6 group-hover:border-orange-500 group-hover:bg-orange-500 group-hover:text-black"><card.icon size={21} /></span></div><div className="mt-auto"><h3 className="text-lg font-black tracking-[-.04em]">{card.title}</h3><p className="mt-3 max-w-sm text-xs leading-6 text-neutral-600">{card.desc}</p></div><div className="mt-7 flex items-center justify-between border-t border-neutral-300 pt-3 font-mono text-[8px] font-bold text-neutral-400"><span>BIOCRYSTAL / MODULE</span><ArrowUpRight size={14} className="transition-transform group-hover:-translate-y-1 group-hover:translate-x-1 group-hover:text-orange-600" /></div></article>)}
            </Reveal>
          </div>
        </section>

        {/* Benchmarks / transparent sample metrics */}
        <section id="benchmarks" className="scroll-mt-20 bg-[#f4f3ef] px-5 py-20 md:px-10 lg:px-16">
          <div className="mx-auto max-w-[1400px]">
            <SectionRule number="02" title="SAMPLE DATA / LIVE CALCULATION" meta="DEMONSTRATION SEQUENCE / NOT A PERFORMANCE BENCHMARK" />
            <Reveal className="mt-16 grid gap-8 lg:grid-cols-[.9fr_1.1fr]">
              <div><h2 className="text-5xl font-black leading-[.9] tracking-[-.08em] md:text-7xl">MEASURE<br />WHAT THE<br /><span className="text-orange-600">SEQUENCE</span><br />CONTAINS.</h2><p className="mt-7 max-w-lg text-sm leading-7 text-neutral-600">These values are calculated directly from the built-in 15-base demonstration sequence. Switch the sample in the terminal to see the metrics update.</p><p className="mt-5 font-mono text-[8px] font-bold tracking-[.12em] text-neutral-500">DATA SOURCE / BUILT-IN DEMONSTRATION SAMPLE</p></div>
              <div className="grid grid-cols-2 border border-neutral-300 bg-white/40 sm:grid-cols-4">
                {[["SEQUENCE LENGTH", `${metrics.length}`, "BASE PAIRS"], ["GC CONTENT", `${metrics.gcPercent.toFixed(1)}%`, "OF THE SAMPLE"], ["COMPLETE CODONS", `${metrics.codons}`, "FULL TRIPLETS"], ["VARIANT POSITION", "09", "T → G"]].map(([label, value, note], i) => <div key={label} className={`group relative flex min-h-[190px] flex-col justify-between overflow-hidden border-b border-r border-neutral-300 p-5 ${i === 0 ? "bg-orange-500 text-black" : ""}`}><span className={`font-mono text-[8px] font-bold tracking-[.12em] ${i === 0 ? "text-black/65" : "text-neutral-500"}`}>{label}</span><div><p className="text-5xl font-black tracking-[-.08em] transition-transform duration-300 group-hover:translate-x-1 md:text-6xl">{value}</p><p className={`mt-3 font-mono text-[7px] font-bold tracking-[.1em] ${i === 0 ? "text-black/65" : "text-neutral-500"}`}>{note}</p></div><span className="absolute -bottom-8 -right-3 font-mono text-8xl font-black opacity-[.045]">0{i + 1}</span></div>)}
              </div>
            </Reveal>
            <Reveal className="mt-10 grid gap-6 lg:grid-cols-[1.1fr_.9fr]">
              <div className="border border-neutral-300 bg-[#faf9f6] p-5 md:p-7"><div className="flex items-center justify-between gap-4"><div><p className="font-mono text-[9px] font-black">BASE COMPOSITION</p><p className="mt-1 text-xs text-neutral-500">Count in the selected sample</p></div><span className="font-mono text-[8px] text-orange-700">FIG 02.01</span></div><div className="mt-8 space-y-5">{(["A", "T", "G", "C"] as Base[]).map((base) => { const count = metrics.counts[base]; const pct = metrics.length ? count / metrics.length * 100 : 0; return <div key={base} className="grid grid-cols-[28px_1fr_52px] items-center gap-4"><span className={`grid h-7 w-7 place-items-center font-mono text-[10px] font-black ${BASE_STYLES[base]}`}>{base}</span><div className="h-2 overflow-hidden bg-neutral-200"><div className={`h-full transition-all duration-700 ${base === "A" ? "bg-[#5fae7d]" : base === "T" ? "bg-[#ef9d4d]" : base === "G" ? "bg-[#4a9ec1]" : "bg-[#c47c9a]"}`} style={{ width: `${pct}%` }} /></div><span className="text-right font-mono text-[9px] font-bold">{count} / {pct.toFixed(0)}%</span></div> })}</div></div>
              <div className="flex flex-col justify-between border border-neutral-300 bg-[#eeede7] p-6 md:p-8"><Eyebrow>ANALYSIS NOTE</Eyebrow><div className="mt-8"><h3 className="text-2xl font-black tracking-[-.05em]">A sequence difference is a starting point, not a diagnosis.</h3><p className="mt-4 text-sm leading-7 text-neutral-600">The demonstration includes one single-nucleotide substitution. Its coding interpretation depends on the assumed reading frame and reference sequence. BioCrystal presents the computational comparison without treating a variant as proof of disease or harm.</p></div><button type="button" onClick={launch} className="bc-button mt-8 inline-flex items-center justify-between gap-6 border border-neutral-950 bg-neutral-950 px-5 py-4 font-mono text-[8px] font-black tracking-[.12em] text-white">INSPECT THE COMPARISON <ArrowUpRight size={14} /></button></div>
            </Reveal>
          </div>
        </section>

        {/* Orange architecture band */}
        <section id="molecular" className="scroll-mt-20 relative overflow-hidden bg-[#ff6500] px-5 py-20 md:px-10 lg:px-16">
          <TechnicalGrid className="opacity-40" />
          <div className="relative z-10 mx-auto max-w-[1400px]">
            <SectionRule number="03" title="MOLECULAR ARCHITECTURE" meta="STRUCTURE / LAYERS / SPATIAL INSPECTION" />
            <div className="mt-14 grid items-start gap-10 lg:grid-cols-[.82fr_1.18fr] lg:gap-14">
              <Reveal>
                <Eyebrow>STRUCTURAL EXPLORATION</Eyebrow>
                <h2 className="mt-7 text-5xl font-black leading-[.9] tracking-[-.08em] md:text-7xl">UNPACK<br />THE HELIX.<br /><span className="text-white">INSPECT</span><br />EVERY LAYER.</h2>
                <p className="mt-7 max-w-lg text-sm leading-7 text-neutral-950/75">Explore molecular organization through a technical exploded illustration. Connect base pairing, the molecular core and the DNA backbone in one structural view.</p>
                <div className="mt-8 border-t border-black/25">{[["01", "BASE PAIR LAYER", "Complementary nucleotides form the paired rungs of the helix."], ["02", "MOLECULAR CORE", "Explore the central region and the geometry connecting both strands."], ["03", "SUGAR-PHOSPHATE BACKBONE", "Follow the two outer strands through the double helix."], ["04", "POSITION CONTEXT", "Relate a selected base to the wider sequence."]].map(([n, title, desc]) => <div key={n} className="grid grid-cols-[34px_1fr] gap-3 border-b border-black/25 py-4 transition-colors hover:bg-white/10"><span className="font-mono text-[9px] font-black">{n}</span><div><p className="font-mono text-[9px] font-black tracking-wide">{title}</p><p className="mt-2 text-xs leading-6 text-neutral-950/70">{desc}</p></div></div>)}</div>
                <ActionButton onClick={launch} variant="dark" className="mt-8">OPEN THE 3D LAB</ActionButton>
              </Reveal>
              <Reveal delay={140}><ExplodedDiagram /></Reveal>
            </div>
            <div className="mt-8 h-3 border border-black/35 bg-[repeating-linear-gradient(135deg,#111315_0px,#111315_7px,#ff6500_7px,#ff6500_14px)]" />
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border border-black/30 px-5 py-4 font-mono text-[8px] font-black tracking-[.11em]"><span>MODEL / B-DNA</span><span>VIEW / EXPLODED ISOMETRIC</span><span>LAYERS / 03</span><span>FIGURE / ILLUSTRATIVE</span></div>
          </div>
        </section>

        {/* Comparison */}
        <section id="comparison" className="scroll-mt-20 bg-[#111315] px-5 py-20 text-white md:px-10 lg:px-16">
          <div className="mx-auto max-w-[1400px]">
            <SectionRule number="04" title="REFERENCE / OBSERVED DIFFERENTIAL" meta="ALIGNMENT / VARIANT / CODON CONTEXT" dark />
            <Reveal className="mt-16 grid gap-10 lg:grid-cols-[1.05fr_.95fr] lg:gap-20">
              <h2 className="text-5xl font-black leading-[.9] tracking-[-.08em] md:text-7xl">FIND THE<br />CHANGE.<br /><span className="text-orange-500">KEEP THE</span><br />CONTEXT.</h2>
              <div><Eyebrow dark>COMPARATIVE SEQUENCE ANALYSIS</Eyebrow><p className="mt-6 text-sm leading-7 text-neutral-400">Switch between the reference and observed demonstration sequence. The highlighted base marks the single-nucleotide difference at position 9.</p><p className="mt-4 text-sm leading-7 text-neutral-400">The displayed codons ACT and ACG both encode threonine in the standard genetic code, assuming this coding frame.</p><button type="button" onClick={launch} className="bc-button mt-8 inline-flex items-center gap-6 border border-orange-500 bg-orange-500 px-5 py-4 font-mono text-[9px] font-black tracking-[.12em] text-black">OPEN MUTATION ANALYZER <ArrowUpRight size={15} /></button></div>
            </Reveal>
            <Reveal className="mt-14 grid gap-5 lg:grid-cols-[1.35fr_.65fr]">
              <div className="overflow-hidden border border-neutral-700 bg-[#171a1d]">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-5 py-4"><span className="font-mono text-[9px] font-black tracking-[.13em]">SEQUENCE ALIGNMENT / 001</span><div className="flex gap-1"><button type="button" onClick={() => setSequenceMode("reference")} className={`px-3 py-2 font-mono text-[8px] font-bold ${sequenceMode === "reference" ? "bg-orange-500 text-black" : "bg-neutral-800 text-neutral-400 hover:text-white"}`}>REFERENCE</button><button type="button" onClick={() => setSequenceMode("observed")} className={`px-3 py-2 font-mono text-[8px] font-bold ${sequenceMode === "observed" ? "bg-orange-500 text-black" : "bg-neutral-800 text-neutral-400 hover:text-white"}`}>OBSERVED</button></div></div>
                <div className="p-5 md:p-7"><div className="flex items-center justify-between font-mono text-[8px] text-neutral-500"><span>{sequenceMode.toUpperCase()} / CODING STRAND</span><span>5′ → 3′ / {currentSequence.length} BP</span></div><div className="mt-7 flex flex-wrap gap-1.5 sm:gap-2">{currentSequence.split("").map((base, index) => <button key={index} type="button" onClick={() => setSelectedBase(index)} aria-pressed={selectedBase === index} className={`relative grid h-9 w-9 place-items-center font-mono text-[10px] font-black transition-all duration-200 hover:-translate-y-1 sm:h-11 sm:w-11 ${BASE_STYLES[base as Base]} ${index === MUTATION_INDEX ? "outline outline-2 outline-orange-400 outline-offset-2" : ""} ${selectedBase === index ? "ring-2 ring-white ring-offset-2 ring-offset-[#171a1d]" : ""}`}>{base}<span className="absolute -bottom-5 font-mono text-[7px] text-neutral-500">{index + 1}</span></button>)}</div><div className="mt-9 border-t border-white/10 pt-5"><div className="flex flex-wrap items-center justify-between gap-3 font-mono text-[8px] text-neutral-500"><span>VARIANT POSITION / 09</span><span className="text-orange-400">T → G / SUBSTITUTION</span></div><div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">{[["REFERENCE BASE", "T"], ["OBSERVED BASE", "G"], ["CODON BEFORE", "ACT"], ["CODON AFTER", "ACG"]].map(([label, value]) => <div key={label} className="border border-white/10 p-3"><p className="font-mono text-[7px] text-neutral-500">{label}</p><p className="mt-2 font-mono text-xl font-black">{value}</p></div>)}</div></div></div>
              </div>
              <div className="border border-neutral-700 bg-[#1c2024] p-5 md:p-7"><div className="flex items-center justify-between border-b border-white/10 pb-4"><span className="font-mono text-[9px] font-black">SELECTED BASE</span><span className="font-mono text-[8px] text-orange-400">POSITION {selectedBase + 1}</span></div><div className="mt-7 grid grid-cols-2 gap-3"><div className="border border-white/10 p-4"><p className="font-mono text-[7px] text-neutral-500">NUCLEOTIDE</p><p className={`mt-3 inline-grid h-12 w-12 place-items-center font-mono text-2xl font-black ${BASE_STYLES[selectedNucleotide]}`}>{selectedNucleotide}</p><p className="mt-2 text-[10px] text-neutral-400">{BASE_NAMES[selectedNucleotide]}</p></div><div className="border border-white/10 p-4"><p className="font-mono text-[7px] text-neutral-500">COMPLEMENT</p><p className={`mt-3 inline-grid h-12 w-12 place-items-center font-mono text-2xl font-black ${BASE_STYLES[complementaryBase]}`}>{complementaryBase}</p><p className="mt-2 text-[10px] text-neutral-400">{BASE_NAMES[complementaryBase]}</p></div></div><div className="mt-4 border border-white/10 p-4"><p className="font-mono text-[7px] text-neutral-500">CODON CONTEXT / {codon.codonNumber}</p><p className="mt-2 text-3xl font-black tracking-[.12em] text-orange-400">{codon.triplet || "—"}</p><p className="mt-2 text-xs text-neutral-300">{codon.aminoAcid}</p><p className="mt-1 text-[9px] text-neutral-500">Base {codon.positionInCodon} of codon {codon.codonNumber}</p></div><div className="mt-4 border border-emerald-500/30 bg-emerald-500/[.05] p-4"><p className="font-mono text-[8px] font-bold text-emerald-400">DEMONSTRATION INTERPRETATION</p><p className="mt-2 text-xs leading-6 text-neutral-300">ACT and ACG both encode threonine. Under the displayed coding-frame assumption, this sample change is synonymous.</p></div></div>
            </Reveal>
          </div>
        </section>

        {/* Workflow */}
        <section id="workflow" className="scroll-mt-20 bg-[#f4f3ef] px-5 py-20 md:px-10 lg:px-16">
          <div className="mx-auto max-w-[1400px]">
            <SectionRule number="05" title="THE ANALYSIS WORKFLOW" meta="INPUT / VALIDATION / INTERPRETATION" />
            <Reveal className="mt-16 grid gap-12 lg:grid-cols-[.78fr_1.22fr]">
              <div><h2 className="text-5xl font-black leading-[.9] tracking-[-.08em] md:text-7xl">A CLEAR<br />PATH FROM<br /><span className="text-orange-600">SEQUENCE</span><br />TO INSIGHT.</h2><p className="mt-7 max-w-lg text-sm leading-7 text-neutral-600">Each stage has a defined purpose. The workflow keeps the sample, reference, analysis context and final output connected.</p><div className="mt-8 border-t border-neutral-300">{WORKFLOW.map(([number, title, description]) => <div key={number} className="group grid grid-cols-[36px_1fr_18px] gap-3 border-b border-neutral-300 py-5 transition-colors hover:bg-white/70"><span className="font-mono text-[9px] font-black text-orange-600">{number}</span><div><h3 className="font-mono text-[9px] font-black tracking-[.12em]">{title.toUpperCase()}</h3><p className="mt-2 text-xs leading-6 text-neutral-600">{description}</p></div><ChevronRight size={16} className="text-neutral-400 transition-transform group-hover:translate-x-1 group-hover:text-orange-600" /></div>)}</div></div>
              <div className="space-y-5"><WorkflowDiagram /><div className="grid grid-cols-2 border border-neutral-300 bg-white/30 sm:grid-cols-4">{[["SAMPLE LENGTH", "15 BP"], ["GC CONTENT", "33.3%"], ["CODONS", "05"], ["DEMO VARIANT", "01"]].map(([a, b]) => <div key={a} className="border-r border-neutral-300 p-4 last:border-r-0"><p className="font-mono text-[7px] font-bold text-neutral-500">{a}</p><p className="mt-2 font-mono text-xl font-black">{b}</p></div>)}</div><p className="font-mono text-[8px] leading-5 text-neutral-500">SAMPLE VALUES ARE DERIVED FROM THE BUILT-IN DEMONSTRATION SEQUENCE.</p></div>
            </Reveal>
          </div>
        </section>

        {/* Capabilities */}
        <section id="capabilities" className="scroll-mt-20 bg-[#141619] px-5 py-20 text-white md:px-10 lg:px-16">
          <div className="mx-auto max-w-[1400px]">
            <SectionRule number="06" title="SCIENTIFIC CAPABILITIES" meta="MODULES / COMPUTATION / OUTPUT" dark />
            <Reveal className="mt-16 grid gap-8 lg:grid-cols-[1.1fr_.9fr]"><h2 className="text-5xl font-black leading-[.9] tracking-[-.08em] md:text-7xl">ONE SEQUENCE.<br /><span className="text-orange-500">FIVE DIMENSIONS.</span></h2><p className="max-w-xl self-end text-sm leading-7 text-neutral-400">Select a capability to inspect its purpose and expected output. Every entry is connected to the BioCrystal research workflow.</p></Reveal>
            <Reveal className="mt-14 grid grid-cols-2 border border-neutral-700 md:grid-cols-5">{CAPABILITIES.map((cap) => { const active = activeCapability === cap.id; return <button key={cap.id} type="button" onClick={() => setActiveCapability(cap.id)} className={`group flex min-h-[130px] flex-col items-start justify-between border-b border-r border-neutral-700 p-4 text-left transition-all duration-300 ${active ? "bc-tab-active bg-orange-500 text-black" : "text-neutral-300 hover:bg-white/[.05]"}`}><span className={`font-mono text-[8px] font-black ${active ? "text-black" : "text-orange-400"}`}>{cap.number} / {cap.category}</span><span className="mt-5 font-mono text-[9px] font-black uppercase tracking-[.08em]">{cap.label}</span></button> })}</Reveal>
            <div className="grid gap-8 border border-neutral-700 bg-[#1b1e22] p-6 md:p-9 lg:grid-cols-[.85fr_1.15fr]">
              <div><Eyebrow dark>{activeCapabilityData.category}</Eyebrow><h3 className="mt-6 text-3xl font-black tracking-[-.05em]">{activeCapabilityData.label}</h3><p className="mt-5 text-sm leading-7 text-neutral-400">{activeCapabilityData.description}</p><div className="mt-7 border-y border-neutral-700 py-4"><p className="font-mono text-[8px] font-bold text-neutral-500">EXPECTED OUTPUT</p><p className="mt-2 text-xs font-bold text-white">{activeCapabilityData.output}</p></div><ActionButton onClick={launch} variant="orange" className="mt-7">OPEN THIS MODULE</ActionButton></div>
              <div className="relative min-h-[260px] overflow-hidden border border-neutral-700 bg-[#111315] p-5"><TechnicalGrid dark className="opacity-50" /><div className="relative flex items-center justify-between border-b border-white/10 pb-3 font-mono text-[8px] text-neutral-500"><span>MODULE OUTPUT / VISUAL MAP</span><span>BC-3D / 06</span></div><div className="relative mt-7 grid grid-cols-2 gap-3 sm:grid-cols-3">{[["INPUT", "DNA STRING"], ["ENGINE", "BIOINFORMATICS"], ["CONTEXT", "REFERENCE"], ["ANALYSIS", "VARIANT MAP"], ["VISUAL", "MOLECULAR"], ["OUTPUT", "REPORT"]].map(([a, b], i) => <div key={a} className={`min-h-[90px] border p-3 transition-all duration-300 hover:-translate-y-1 ${i === activeCapabilityIndex ? "border-orange-500 bg-orange-500/10" : "border-white/10 bg-white/[.025]"}`}><p className="font-mono text-[7px] text-neutral-500">{a}</p><p className="mt-3 font-mono text-[8px] font-bold text-neutral-200">{b}</p></div>)}</div><div className="relative mt-6 flex items-center gap-2 font-mono text-[8px] text-orange-400"><span className="bc-pulse-dot h-2 w-2 rounded-full bg-orange-500" /> MODULE SELECTED / {activeCapabilityData.number}</div></div>
            </div>
          </div>
        </section>

        {/* Interpretation loop / Section 07 */}
        <InterpretationLoopSection onLaunch={launch} />

        {/* Live sample evidence / Section 08 */}
        <AnalysisEvolutionSection onLaunch={launch} />

        {/* Final CTA */}
        <section className="relative overflow-hidden bg-orange-500 px-5 py-16 md:px-10 md:py-20 lg:px-16">
          <TechnicalGrid className="opacity-40" />
          <div className="relative z-10 mx-auto grid max-w-[1400px] gap-5 lg:grid-cols-[1.25fr_.75fr]">
            <div className="flex min-h-[340px] flex-col justify-between bg-[#111315] p-7 text-orange-500 sm:p-10 md:p-14"><Eyebrow dark>THE MOLECULAR WORKSPACE</Eyebrow><h2 className="mt-12 text-5xl font-black leading-[.88] tracking-[-.08em] sm:text-6xl md:text-7xl">YOUR SEQUENCE.<br />YOUR QUESTIONS.<br /><span className="text-white">ONE LAB.</span></h2><div className="mt-10 flex flex-wrap gap-3"><ActionButton onClick={launch} variant="light">START ANALYZING</ActionButton><a href="#top" className="inline-flex items-center gap-3 border border-orange-500/50 px-5 py-4 font-mono text-[9px] font-black tracking-[.12em] text-orange-500 transition-colors hover:bg-orange-500 hover:text-black">BACK TO TOP <ArrowUpRight size={14} /></a></div></div>
            <div className="relative grid min-h-[340px] place-items-center overflow-hidden border border-black/70 bg-[#17191c] text-orange-500"><TechnicalGrid dark className="opacity-60" /><div className="bc-spin-slow absolute h-64 w-64 rounded-full border border-orange-500/25" /><div className="bc-float relative grid h-48 w-48 place-items-center border border-orange-500/40 bg-[#111315] shadow-[0_0_80px_rgba(255,101,0,.13)]"><Dna size={104} strokeWidth={1.1} /></div><span className="absolute bottom-5 left-5 font-mono text-[8px] font-bold tracking-[.14em] text-neutral-500">BIOCRYSTAL / END OF OVERVIEW</span><span className="absolute right-5 top-5 font-mono text-[8px] text-orange-400">BC-3D / 2026</span></div>
          </div>
        </section>
      </main>

      <footer className="border-t border-neutral-300 bg-[#f4f3ef] px-5 py-12 md:px-10 lg:px-16">
        <div className="mx-auto grid max-w-[1400px] gap-10 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div><a href="#top" className="inline-flex items-center gap-2 text-lg font-black tracking-[-.07em]"><Dna size={22} className="text-orange-600" /> BIOCRYSTAL<span className="text-orange-600">3D</span></a><p className="mt-5 max-w-xs text-sm leading-6 text-neutral-600">An interactive environment for DNA sequence analysis, mutation inspection and molecular visualization.</p><p className="mt-8 font-mono text-[8px] font-bold tracking-[.12em] text-neutral-500">COMPUTATIONAL BIOLOGY / PROJECT BC-3D</p></div>
          <div><p className="font-mono text-[8px] font-black tracking-[.14em] text-neutral-500">PLATFORM</p><div className="mt-5 space-y-3">{[["Sequence analysis", "#platform"], ["Mutation comparison", "#comparison"], ["Molecular lab", "#molecular"]].map(([a, b]) => <a key={a} href={b} className="block text-xs text-neutral-700 transition-colors hover:text-orange-700">{a}</a>)}</div></div>
          <div><p className="font-mono text-[8px] font-black tracking-[.14em] text-neutral-500">WORKFLOW</p><div className="mt-5 space-y-3">{[["Analysis pipeline", "#workflow"], ["Capabilities", "#capabilities"], ["Interpretation loop", "#interpretation"], ["Analysis system", "#analysis-evolution"]].map(([a, b]) => <a key={a} href={b} className="block text-xs text-neutral-700 transition-colors hover:text-orange-700">{a}</a>)}</div></div>
          <div><p className="font-mono text-[8px] font-black tracking-[.14em] text-neutral-500">GET STARTED</p><ActionButton onClick={launch} variant="dark" className="bc-precision-cta--compact mt-5">OPEN WORKSPACE</ActionButton><p className="mt-5 text-[10px] leading-5 text-neutral-500">Illustrative sequence data is provided for demonstration and educational exploration.</p></div>
        </div>
        <div className="mx-auto mt-12 flex max-w-[1400px] flex-wrap items-center justify-between gap-3 border-t border-neutral-300 pt-5 font-mono text-[8px] font-bold tracking-[.1em] text-neutral-500"><span>© 2026 BIOCRYSTAL 3D</span><span>BUILT FOR SCIENTIFIC EXPLORATION</span><a href="#top" className="inline-flex items-center gap-2 transition-colors hover:text-orange-700">BACK TO TOP <ArrowUpRight size={12} /></a></div>
      </footer>
    </div>
  );
};

export default LandingPage;
