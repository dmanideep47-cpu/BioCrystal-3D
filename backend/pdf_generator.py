"""
BioCrystal 3D - Four-page scientific PDF report (ReportLab 5.x).

Public interface (unchanged):
    generate_pdf_report(report_data: dict) -> bytes

Design: ~60% white, ~30% black (cover, table heads, notice), ~10% accent
(blue = observed/data, red = differences). Every chart is drawn as vector
graphics with reportlab.graphics, so there is no matplotlib dependency.

Layout (always exactly 4 A4 pages; each page is wrapped in KeepInFrame so
unusually long data can never spill onto a fifth page):
    1  Overview      cover, KPIs, summary, variant map, composition, properties
    2  Alignment     alignment, variant table, GC + ddG charts, thermodynamics
    3  Consequence   codons/protein, residue properties, structure, edit history
    4  Methods       methodology, QC checks, limitations, interpretation, notice

Fonts: Bitstream Vera (ships with ReportLab) + Courier. To use Geist, drop
Geist-Regular.ttf and Geist-SemiBold.ttf into ./fonts (or set BC_FONT_DIR).
Only Latin-1 punctuation is used, so either family renders correctly.
Greek letters use ReportLab's <greek> tag (Symbol font).
"""

from __future__ import annotations

import math
import os
import re
from collections import Counter
from datetime import datetime, timezone
from html import escape
from io import BytesIO
from typing import Any, Dict, List, Optional, Sequence, Tuple

import reportlab
from reportlab.graphics.shapes import Circle, Drawing, Line, PolyLine, Rect, String
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.pdfmetrics import registerFontFamily
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas
from reportlab.platypus import (
    BaseDocTemplate,
    Frame,
    KeepInFrame,
    PageBreak,
    PageTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
    XPreformatted,
)

try:
    from dna_biophysics import compute_dna_biophysics
except ImportError:
    try:
        from backend.dna_biophysics import compute_dna_biophysics
    except ImportError:  # backend module optional: local nearest-neighbour model is used
        compute_dna_biophysics = None

# ---------------------------------------------------------------------------
# Geometry, palette, fonts
# ---------------------------------------------------------------------------

PAGE_W, PAGE_H = A4
MARGIN_X = 14 * mm
MARGIN_TOP = 20 * mm
MARGIN_BOTTOM = 16 * mm
CONTENT_W = PAGE_W - 2 * MARGIN_X
FRAME_H = PAGE_H - MARGIN_TOP - MARGIN_BOTTOM
GAP = 14

HEX_INK, HEX_BLUE, HEX_RED, HEX_MUTED, HEX_AMBER = "#111111", "#1F5EFF", "#D92D20", "#555555", "#B54708"
INK = colors.HexColor(HEX_INK)
INK2 = colors.HexColor("#222222")
BLUE = colors.HexColor(HEX_BLUE)
RED = colors.HexColor(HEX_RED)
MUTED = colors.HexColor(HEX_MUTED)
HAIR = colors.HexColor("#E5E5E5")
TRACK = colors.HexColor("#EEEEEE")
RED_TINT = colors.HexColor("#FDECEA")
BLUE_TINT = colors.HexColor("#E7EEFF")
WHITE = colors.white
SOFT = colors.HexColor("#F6F6F6")

M, MB = "Courier", "Courier-Bold"
F, FB, FI = "BCSans", "BCSans-Bold", "BCSans-Italic"


def _setup_fonts() -> None:
    here = os.path.dirname(os.path.abspath(__file__))
    vera = os.path.join(os.path.dirname(reportlab.__file__), "fonts")
    custom = os.environ.get("BC_FONT_DIR") or os.path.join(here, "fonts")
    reg = os.path.join(custom, "Geist-Regular.ttf")
    bold = next((p for p in (os.path.join(custom, "Geist-SemiBold.ttf"), os.path.join(custom, "Geist-Bold.ttf")) if os.path.exists(p)), None)
    if os.path.exists(reg) and bold:
        pdfmetrics.registerFont(TTFont(F, reg))
        pdfmetrics.registerFont(TTFont(FB, bold))
        pdfmetrics.registerFont(TTFont(FI, reg))
        pdfmetrics.registerFont(TTFont("BCSans-BoldItalic", bold))
    else:
        pdfmetrics.registerFont(TTFont(F, os.path.join(vera, "Vera.ttf")))
        pdfmetrics.registerFont(TTFont(FB, os.path.join(vera, "VeraBd.ttf")))
        pdfmetrics.registerFont(TTFont(FI, os.path.join(vera, "VeraIt.ttf")))
        pdfmetrics.registerFont(TTFont("BCSans-BoldItalic", os.path.join(vera, "VeraBI.ttf")))
    registerFontFamily(F, normal=F, bold=FB, italic=FI, boldItalic="BCSans-BoldItalic")


_setup_fonts()

DELTA = "<greek>D</greek>"
ARROW = "to"

# ---------------------------------------------------------------------------
# Scientific data: genetic codes, amino-acid properties, nearest-neighbour model
# ---------------------------------------------------------------------------

_BASES = "TCAG"
_STD = "FFLLSSSSYY**CC*WLLLLPPPPHHQQRRRRIIIMTTTTNNKKSSRRVVVVAAAADDEEGGGG"
CODON_TABLES: Dict[int, Dict[str, str]] = {}
for _tid in (1, 2, 11):
    _t = {a + b + c: _STD[i * 16 + j * 4 + k] for i, a in enumerate(_BASES) for j, b in enumerate(_BASES) for k, c in enumerate(_BASES)}
    if _tid == 2:  # vertebrate mitochondrial
        _t.update({"AGA": "*", "AGG": "*", "ATA": "M", "TGA": "W"})
    CODON_TABLES[_tid] = _t

AA3 = dict(A="Ala", R="Arg", N="Asn", D="Asp", C="Cys", E="Glu", Q="Gln", G="Gly", H="His", I="Ile", L="Leu", K="Lys", M="Met", F="Phe", P="Pro", S="Ser", T="Thr", W="Trp", Y="Tyr", V="Val")
AA3.update({"*": "Stop"})
AA1 = {v.upper(): k for k, v in AA3.items()}
KD = dict(A=1.8, R=-4.5, N=-3.5, D=-3.5, C=2.5, Q=-3.5, E=-3.5, G=-0.4, H=-3.2, I=4.5, L=3.8, K=-3.9, M=1.9, F=2.8, P=-1.6, S=-0.8, T=-0.7, W=-0.9, Y=-1.3, V=4.2)
VOL = dict(A=88.6, R=173.4, N=114.1, D=111.1, C=108.5, Q=143.8, E=138.4, G=60.1, H=153.2, I=166.7, L=166.7, K=168.6, M=162.9, F=189.9, P=112.7, S=89.0, T=116.1, W=227.8, Y=193.6, V=140.0)
RMASS = dict(A=71.08, R=156.19, N=114.10, D=115.09, C=103.14, Q=128.13, E=129.12, G=57.05, H=137.14, I=113.16, L=113.16, K=128.17, M=131.19, F=147.18, P=97.12, S=87.08, T=101.10, W=186.21, Y=163.18, V=99.13)
NT_MASS = dict(A=313.21, C=289.18, G=329.21, T=304.20)
COMP = {"A": "T", "T": "A", "C": "G", "G": "C"}

# SantaLucia (1998) unified nearest-neighbour parameters: (dH kcal/mol, dS cal/mol/K)
NN = {
    "AA": (-7.9, -22.2), "TT": (-7.9, -22.2), "AT": (-7.2, -20.4), "TA": (-7.2, -21.3),
    "CA": (-8.5, -22.7), "TG": (-8.5, -22.7), "GT": (-8.4, -22.4), "AC": (-8.4, -22.4),
    "CT": (-7.8, -21.0), "AG": (-7.8, -21.0), "GA": (-8.2, -22.2), "TC": (-8.2, -22.2),
    "CG": (-10.6, -27.2), "GC": (-9.8, -24.4), "GG": (-8.0, -19.9), "CC": (-8.0, -19.9),
}
NA_MOLAR, STRAND_MOLAR = 0.05, 0.25e-6


def nn_thermo(seq: str) -> Dict[str, Any]:
    """Nearest-neighbour duplex thermodynamics for an A/C/G/T sequence."""
    if len(seq) < 2 or set(seq) - set("ACGT"):
        return {}
    dh = ds = g = 0.0
    cum: List[float] = []
    for a, b in zip(seq, seq[1:]):
        h, s = NN[a + b]
        dh, ds = dh + h, ds + s
        g += h - 310.15 * s / 1000.0
        cum.append(g)
    for end in (seq[0], seq[-1]):
        h, s = (0.1, -2.8) if end in "GC" else (2.3, 4.1)
        dh, ds = dh + h, ds + s
    ds += 0.368 * (len(seq) - 1) * math.log(NA_MOLAR)
    dg = dh - 310.15 * ds / 1000.0
    tm = dh * 1000.0 / (ds + 1.987 * math.log(STRAND_MOLAR / 4.0)) - 273.15
    return {"dh": dh, "ds": ds, "dg": dg, "tm": tm, "cum": cum}


def gc_count(s: str) -> int:
    return sum(c in "GC" for c in s)


def gc_pct(s: str) -> float:
    return 100.0 * gc_count(s) / len(s) if s else 0.0


def ds_mass_kda(s: str) -> Optional[float]:
    if not s or set(s) - set("ACGT"):
        return None
    return (sum(NT_MASS[c] for c in s) + sum(NT_MASS[COMP[c]] for c in s)) / 1000.0


def gc_windows(s: str, w: int) -> Tuple[List[int], List[float]]:
    if len(s) < w:
        return [], []
    xs = list(range(1, len(s) - w + 2))
    return xs, [100.0 * gc_count(s[i:i + w]) / w for i in range(len(xs))]


def translate(seq: str, frame: int, table: int) -> str:
    t = CODON_TABLES.get(table, CODON_TABLES[1])
    return "".join(t.get(seq[i:i + 3], "X") for i in range(frame, len(seq) - 2, 3))


# ---------------------------------------------------------------------------
# Small helpers
# ---------------------------------------------------------------------------

def _clean_seq(seq: Any) -> str:
    return re.sub(r"[^A-Za-z]+", "", str(seq or "")).upper()


def _first(data: Dict[str, Any], *keys: str, default: Any = None) -> Any:
    for k in keys:
        v = data.get(k)
        if v is not None and v != "":
            return v
    return default


def _e(x: Any) -> str:
    return escape(str(x))


def _sgn(x: float, d: int = 1) -> str:
    return f"{x:+.{d}f}"


def _num(v: Any, d: int = 1, suffix: str = "") -> str:
    try:
        return f"{float(v):.{d}f}{suffix}"
    except (TypeError, ValueError):
        return "n/a"


def _format_timestamp(value: Any) -> str:
    raw = str(value or "").strip()
    if not raw:
        raw = datetime.now(timezone.utc).isoformat()
    try:
        parsed = datetime.fromisoformat(raw.replace("Z", "+00:00"))
    except ValueError:
        return raw
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed.astimezone(timezone.utc).strftime("%d %b %Y, %H:%M UTC")


def _styles() -> Dict[str, ParagraphStyle]:
    def S(n: str, **k: Any) -> ParagraphStyle:
        return ParagraphStyle(n, **k)

    return {
        "body": S("body", fontName=F, fontSize=8.4, leading=12.4, textColor=INK2),
        "small": S("small", fontName=F, fontSize=7, leading=9.8, textColor=MUTED),
        "lab": S("lab", fontName=FB, fontSize=6.4, leading=8, textColor=MUTED),
        "cell": S("cell", fontName=F, fontSize=7.9, leading=10.6, textColor=INK),
        "cellb": S("cellb", fontName=FB, fontSize=7.9, leading=10.6, textColor=INK),
        "mono": S("mono", fontName=M, fontSize=7.9, leading=10.6, textColor=INK),
        "th": S("th", fontName=FB, fontSize=6.5, leading=8.4, textColor=WHITE),
        "sec": S("sec", fontName=FB, fontSize=10, leading=13, textColor=INK),
        "cov_lab": S("cov_lab", fontName=FB, fontSize=6.2, leading=8, textColor=colors.HexColor("#B8B8B8")),
        "cov_val": S("cov_val", fontName=F, fontSize=8.2, leading=11, textColor=WHITE),
        "kpi_v": S("kpi_v", fontName=MB, fontSize=18, leading=23, textColor=INK),
        "ctr": S("ctr", fontName=F, fontSize=7.5, leading=10, textColor=INK, alignment=1),
        "align": S("align", fontName=M, fontSize=7.7, leading=10.2, textColor=INK),
    }


ST = _styles()


def P(text: Any, style: str = "cell") -> Paragraph:
    return Paragraph(str(text), ST[style])


def section(num: str, title: str) -> Table:
    t = Table([[Paragraph(f'<font name="{MB}" size="7.5" color="{HEX_BLUE}">{num}</font>&nbsp;&nbsp;{title}', ST["sec"])]], colWidths=[CONTENT_W])
    t.setStyle(TableStyle([("LINEABOVE", (0, 0), (-1, 0), 1.2, INK), ("TOPPADDING", (0, 0), (-1, -1), 4), ("BOTTOMPADDING", (0, 0), (-1, -1), 3), ("LEFTPADDING", (0, 0), (-1, -1), 0), ("RIGHTPADDING", (0, 0), (-1, -1), 0)]))
    return t


def table(headers: Sequence[str], rows: Sequence[Sequence[Any]], widths: Sequence[float]) -> Table:
    data = [[P(h.upper(), "th") for h in headers]] + [[c if not isinstance(c, str) else P(c) for c in r] for r in rows]
    t = Table(data, colWidths=list(widths), repeatRows=1)
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), INK),
        ("LINEBELOW", (0, 1), (-1, -1), 0.4, HAIR),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING", (0, 0), (-1, -1), 3.6), ("BOTTOMPADDING", (0, 0), (-1, -1), 3.6),
        ("LEFTPADDING", (0, 0), (-1, -1), 5), ("RIGHTPADDING", (0, 0), (-1, -1), 5),
    ]))
    return t


def kpi_row(items: Sequence[Tuple[str, str, str, str]]) -> Table:
    n = len(items)
    gap = 12
    cw = (CONTENT_W - gap * (n - 1)) / n
    rows: List[List[Any]] = [[], [], []]
    widths: List[float] = []
    for i, (label, value, sub, color) in enumerate(items):
        if i:
            for r in rows:
                r.append("")
            widths.append(gap)
        rows[0].append(P(label.upper(), "lab"))
        rows[1].append(Paragraph(f'<font color="{color}">{value}</font>', ST["kpi_v"]))
        rows[2].append(P(sub, "small"))
        widths.append(cw)
    t = Table(rows, colWidths=widths)
    cmds: List[Any] = [("LEFTPADDING", (0, 0), (-1, -1), 0), ("RIGHTPADDING", (0, 0), (-1, -1), 0), ("TOPPADDING", (0, 0), (-1, -1), 1), ("BOTTOMPADDING", (0, 0), (-1, -1), 1), ("TOPPADDING", (0, 0), (-1, 0), 5)]
    for c in range(0, len(widths), 2):
        cmds.append(("LINEABOVE", (c, 0), (c, 0), 1.2, INK))
    t.setStyle(TableStyle(cmds))
    return t


def two_col(left: List[Any], right: List[Any], gap: float = GAP) -> Table:
    w = (CONTENT_W - gap) / 2
    t = Table([[left, "", right]], colWidths=[w, gap, w])
    t.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "TOP"), ("LEFTPADDING", (0, 0), (-1, -1), 0), ("RIGHTPADDING", (0, 0), (-1, -1), 0), ("TOPPADDING", (0, 0), (-1, -1), 0), ("BOTTOMPADDING", (0, 0), (-1, -1), 0)]))
    return t


def legend(items: Sequence[Tuple[str, str]]) -> Paragraph:
    return Paragraph("&nbsp;&nbsp;&nbsp;".join(f'<font color="{c}">&#9632;</font>&nbsp;{_e(t)}' for c, t in items), ST["small"])


# ---------------------------------------------------------------------------
# Charts (vector)
# ---------------------------------------------------------------------------

def _s(d: Drawing, x: float, y: float, t: str, size: float = 6.2, color: Any = MUTED, anchor: str = "middle", font: str = M) -> None:
    d.add(String(x, y, t, fontName=font, fontSize=size, fillColor=color, textAnchor=anchor))


def hgvs(m: Dict[str, Any], coding: bool) -> str:
    pre = "c." if coding else "g."
    typ = m.get("type", "substitution")
    if typ == "insertion":
        return f"{pre}{m.get('reference_left_position', '?')}_{m.get('reference_right_position', '?')}ins{_first(m, 'observed_bases', 'observed_base', default='')}"
    pos = m.get("reference_position", "?")
    end = m.get("reference_end_position")
    span = f"{pos}_{end}" if end not in (None, pos) else f"{pos}"
    if typ == "deletion":
        return f"{pre}{span}del"
    return f"{pre}{pos}{_first(m, 'reference_bases', 'original_base', 'ref', default='?')}>{_first(m, 'observed_bases', 'observed_base', 'alt', default='?')}"


def _mut_pos(m: Dict[str, Any]) -> Optional[float]:
    if m.get("type") == "insertion":
        l, r = m.get("reference_left_position"), m.get("reference_right_position")
        return (l + 0.5) if isinstance(l, int) else (r - 0.5 if isinstance(r, int) else None)
    p = m.get("reference_position")
    return float(p) if isinstance(p, (int, float)) else None


def chart_variant_map(n: int, muts: List[Dict[str, Any]], coding: bool, frame: int, w: float, h: float = 84) -> Drawing:
    d = Drawing(w, h)
    d.hAlign = "LEFT"
    if n <= 0:
        return d
    pl, iw, ty = 4, w - 8, 30
    X = lambda p: pl + (p - 0.5) / n * iw
    d.add(Rect(pl, ty, iw, 9, fillColor=TRACK, strokeColor=None))
    pos = [(_mut_pos(m), m) for m in muts if _mut_pos(m) is not None]
    if coding and pos:
        c0 = int((pos[0][0] - 1 - frame) // 3) * 3 + frame + 1
        d.add(Rect(X(c0 - 0.5), ty, 3 * iw / n, 9, fillColor=BLUE_TINT, strokeColor=None))
    step = max(1, int(round(n / 10 / 5.0)) * 5) if n > 20 else 1
    for p in sorted({1, n, *range(step, n, step)}):
        d.add(Line(X(p), ty - 1, X(p), ty - 4, strokeColor=MUTED, strokeWidth=0.5))
        _s(d, X(p), ty - 12, str(p))
    colmap = {"substitution": RED, "insertion": BLUE, "deletion": INK}
    last_x, lvl = -999.0, 0
    for k, (p, m) in enumerate(sorted(pos, key=lambda t: t[0])[:60]):
        c = colmap.get(m.get("type", "substitution"), RED)
        x = X(p)
        d.add(Line(x, ty + 9, x, ty + 22, strokeColor=c, strokeWidth=1))
        d.add(Circle(x, ty + 25, 3, fillColor=c, strokeColor=None))
        if k < 4:
            lvl = (lvl + 1) % 2 if x - last_x < 46 else 0
            _s(d, x + 6, ty + 33 + lvl * 8 - 8 + 8, hgvs(m, coding), 7.2, c, "start", MB)
            last_x = x
    if len(pos) > 4:
        _s(d, w - 4, h - 7, f"+{len(pos) - 4} more", 6.5, MUTED, "end")
    return d


def chart_composition(ref: str, obs: str, w: float, h: float = 118) -> Drawing:
    d = Drawing(w, h)
    d.hAlign = "LEFT"
    cr, co = Counter(ref), Counter(obs)
    mx = max([1] + [cr[b] for b in "ACGT"] + [co[b] for b in "ACGT"]) * 1.18
    pl, pb, pt = 8, 16, 10
    ih = h - pb - pt
    gw = (w - pl) / 4
    d.add(Line(pl, pb, w, pb, strokeColor=INK, strokeWidth=0.7))
    for j, b in enumerate("ACGT"):
        for q, (c, col) in enumerate(((cr, INK), (co, BLUE))):
            bh = c[b] / mx * ih
            x = pl + j * gw + gw / 2 - 17 + q * 18
            d.add(Rect(x, pb, 16, bh, fillColor=col, strokeColor=None))
            _s(d, x + 8, pb + bh + 3, str(c[b]), 6.6, INK)
        _s(d, pl + j * gw + gw / 2, 4, b, 8, INK, "middle", MB)
    return d


def chart_lines(w: float, h: float, series: Sequence[Tuple[List[float], List[float], Any, float]], band: Optional[Tuple[float, float]] = None, yfmt: str = "{:.0f}") -> Drawing:
    d = Drawing(w, h)
    d.hAlign = "LEFT"
    xs = [x for s in series for x in s[0]]
    ys = [y for s in series for y in s[1]]
    if not xs:
        _s(d, w / 2, h / 2, "not enough data", 7, MUTED)
        return d
    pl, pr, pt, pb = 34, 6, 6, 16
    iw, ih = w - pl - pr, h - pt - pb
    x0, x1 = min(xs), max(xs)
    x1 = x1 if x1 > x0 else x0 + 1
    lo, hi = min(ys), max(ys)
    if hi - lo < 1e-9:
        lo, hi = lo - 1, hi + 1
    pad = (hi - lo) * 0.12
    lo, hi = lo - pad, hi + pad
    X = lambda v: pl + (v - x0) / (x1 - x0) * iw
    Y = lambda v: pb + (v - lo) / (hi - lo) * ih
    if band:
        d.add(Rect(X(band[0]), pb, max(X(band[1]) - X(band[0]), 2.5), ih, fillColor=RED_TINT, strokeColor=None))
    for k in range(4):
        v = lo + (hi - lo) * k / 3
        d.add(Line(pl, Y(v), w - pr, Y(v), strokeColor=HAIR, strokeWidth=0.5))
        _s(d, pl - 4, Y(v) - 2.2, yfmt.format(v), 6.2, MUTED, "end")
    for k in range(5):
        xv = x0 + (x1 - x0) * k / 4
        _s(d, X(xv), 3, f"{xv:.0f}")
    for sx, sy, col, wd in series:
        pts: List[float] = []
        for a, b in zip(sx, sy):
            pts += [X(a), Y(b)]
        if len(pts) >= 4:
            d.add(PolyLine(pts, strokeColor=col, strokeWidth=wd, strokeLineJoin=1))
    return d


def chart_property_bars(rows: Sequence[Tuple[str, float, float, float, float, str]], w: float, a_lab: str, b_lab: str) -> Drawing:
    rh = 30
    d = Drawing(w, rh * len(rows) + 4)
    d.hAlign = "LEFT"
    lx, rx = 118, 110
    bw = w - lx - rx
    for i, (name, a, b, lo, hi, unit) in enumerate(rows):
        y = (len(rows) - 1 - i) * rh + 4
        P0 = lambda v: lx + (v - lo) / (hi - lo) * bw
        z = P0(0) if lo < 0 else lx
        d.add(Line(lx, y - 1, w - rx, y - 1, strokeColor=HAIR, strokeWidth=0.4))
        d.add(Line(z, y, z, y + rh - 4, strokeColor=MUTED, strokeWidth=0.5))
        _s(d, 0, y + 11, name, 7.4, INK, "start", F)
        for k, (v, col) in enumerate(((a, INK), (b, BLUE))):
            x0, x1 = (z, P0(v)) if v >= 0 else (P0(v), z)
            d.add(Rect(x0, y + 12 - k * 9, max(x1 - x0, 0.8), 7, fillColor=col, strokeColor=None))
        _s(d, w, y + 9, f"{a:g} / {b:g} {unit}".strip(), 7, INK, "end")
    return d


def chart_timeline(nodes: Sequence[Tuple[str, str]], w: float) -> Drawing:
    d = Drawing(w, 44)
    d.hAlign = "LEFT"
    n = len(nodes)
    d.add(Line(6, 36, w - 6, 36, strokeColor=BLUE, strokeWidth=1.4))
    for i, (title, sub) in enumerate(nodes):
        x = 6 + i * (w - 12) / max(n - 1, 1) if n > 1 else 6
        anchor = "start" if i == 0 else ("end" if i == n - 1 else "middle")
        d.add(Circle(x, 36, 4, fillColor=BLUE, strokeColor=WHITE, strokeWidth=1.5))
        _s(d, x, 20, title, 7.4, INK, anchor, FB)
        _s(d, x, 10, sub, 6.4, MUTED, anchor, F)
    return d


# ---------------------------------------------------------------------------
# Header / footer canvas (true "Page X of N")
# ---------------------------------------------------------------------------

def _canvas_factory(meta: Dict[str, str]):
    class NumberedCanvas(canvas.Canvas):
        def __init__(self, *a: Any, **k: Any) -> None:
            super().__init__(*a, **k)
            self._states: List[Dict[str, Any]] = []

        def showPage(self) -> None:
            self._states.append(dict(self.__dict__))
            self._startPage()

        def save(self) -> None:
            total = len(self._states)
            for st in self._states:
                self.__dict__.update(st)
                self._furniture(total)
                super().showPage()
            super().save()

        def _furniture(self, total: int) -> None:
            self.saveState()
            top = PAGE_H - 12 * mm
            self.setFillColor(INK)
            p = self.beginPath()
            cx, cy, r = MARGIN_X + 5, top + 2.6, 5.2
            for k in range(6):
                a = math.radians(60 * k - 90)
                (p.moveTo if k == 0 else p.lineTo)(cx + r * math.cos(a), cy + r * math.sin(a))
            p.close()
            self.drawPath(p, stroke=0, fill=1)
            self.setFont(FB, 8)
            self.drawString(MARGIN_X + 15, top, "BIOCRYSTAL 3D")
            self.setFont(M, 7)
            self.setFillColor(MUTED)
            self.drawRightString(PAGE_W - MARGIN_X, top, f"{meta['id']}  |  Revision {meta['rev']}")
            self.setStrokeColor(HAIR)
            self.setLineWidth(0.6)
            self.line(MARGIN_X, top - 7, PAGE_W - MARGIN_X, top - 7)
            self.line(MARGIN_X, 12 * mm, PAGE_W - MARGIN_X, 12 * mm)
            self.setFont(F, 6.8)
            self.drawString(MARGIN_X, 8 * mm, "BioCrystal 3D computational analysis for research and education. Not a clinical diagnostic.")
            self.setFillColor(INK)
            self.setFont(MB, 7)
            self.drawRightString(PAGE_W - MARGIN_X, 8 * mm, f"Page {self._pageNumber} of {total}")
            self.restoreState()

    return NumberedCanvas


# ---------------------------------------------------------------------------
# Context extraction
# ---------------------------------------------------------------------------

def _build_context(data: Dict[str, Any]) -> Dict[str, Any]:
    ar = data.get("analysis_result") or {}
    ar = ar if isinstance(ar, dict) else {}
    ctx_in = data.get("analysis_context") or {}
    options = ar.get("options") or {}
    ref_val = ar.get("reference_validation") or data.get("reference_validation") or {}
    obs_val = ar.get("observed_validation") or data.get("observed_validation") or {}
    aln = ar.get("alignment") or data.get("alignment") or {}
    smap = ar.get("structure_mapping") or data.get("structure_mapping") or data.get("structure") or {}

    ref = _clean_seq(_first(data, "reference_sequence", "ref_sequence", default=ref_val.get("cleanedSequence", "")))
    obs = _clean_seq(_first(data, "current_sequence", "observed_sequence", "original_sequence", "query_sequence", default=obs_val.get("cleanedSequence", "")))
    orig = _clean_seq(_first(data, "original_sequence", default=obs))
    edits = data.get("edit_history") or []
    muts = data.get("mutations_list") or aln.get("mutations") or data.get("mutations") or []
    muts = [muts] if isinstance(muts, dict) else (list(muts) if isinstance(muts, (list, tuple)) else [])

    seq_type = _first(ctx_in, "sequence_type", default=_first(data, "sequence_type", default="unknown"))
    frame_raw = _first(ctx_in, "reading_frame", default=_first(data, "reading_frame", default=None))
    coding = seq_type == "coding" and frame_raw is not None
    frame = int(frame_raw) if coding else 0
    code_raw = str(_first(ctx_in, "genetic_code", default=_first(data, "genetic_code", default="1")))
    m = re.search(r"\d+", code_raw)
    table_id = int(m.group()) if m and int(m.group()) in CODON_TABLES else 1

    aref, aobs = aln.get("aligned_reference"), aln.get("aligned_observed")
    identity = aln.get("identity_percent")
    if not isinstance(identity, (int, float)) and aref and aobs and len(aref) == len(aobs):
        identity = 100.0 * sum(a == b and a != "-" for a, b in zip(aref, aobs)) / len(aref)
    gene = _first(options, "geneName", default=_first(data, "gene", default="Not specified"))
    acc = _first(data, "accession", default="Not provided")
    ref_name = _first(data, "reference_name", default=f"{gene} reference" if gene != "Not specified" else "User-provided reference")

    biophys: Dict[str, Any] = data.get("dna_biophysics") or {}
    if not biophys and compute_dna_biophysics and (obs or ref):
        try:
            biophys = compute_dna_biophysics(obs or ref, mutations=muts) or {}
        except Exception:
            biophys = {}

    return dict(
        ref=ref, obs=obs, orig=orig, edits=edits, muts=muts, aln=aln, smap=smap, coding=coding, frame=frame, table=table_id,
        seq_type=seq_type, identity=identity, gene=gene, acc=acc, ref_name=ref_name, biophys=biophys,
        aref=aref or ref, aobs=aobs or obs, ref_val=ref_val, obs_val=obs_val,
        id=_first(data, "analysis_id", "run_id", default=f"BC-{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')}"),
        when=_format_timestamp(_first(data, "analysis_timestamp", "generated_at", default=None)),
        rev=data.get("revision") or (len(edits) + 1 if edits else 1),
        organism=_first(options, "organism", default=_first(data, "organism", default="Not specified")),
        complete=bool(aln.get("aligned_reference") is not None and aln.get("aligned_observed") is not None),
    )


def _protein_change(m: Dict[str, Any], c: Dict[str, Any]) -> str:
    if not c["coding"] or m.get("type", "substitution") != "substitution":
        return "-"
    oa, ba = m.get("original_amino_acid") or {}, m.get("observed_amino_acid") or {}
    o3, b3 = oa.get("code3"), ba.get("code3")
    pos = m.get("reference_position")
    if not o3 or not b3 or "Unk" in (o3, b3) or not isinstance(pos, int):
        return "-"
    num = (pos - 1 - c["frame"]) // 3 + 1
    return "p." + o3.capitalize() + str(num) + ("=" if o3 == b3 else b3.capitalize())


def _aa_pair(m: Dict[str, Any], c: Dict[str, Any]) -> Optional[Tuple[str, str]]:
    rc, oc = m.get("reference_codon"), m.get("observed_codon")
    t = CODON_TABLES[c["table"]]
    if rc and oc and rc in t and oc in t:
        return t[rc], t[oc]
    oa, ba = (m.get("original_amino_acid") or {}).get("code3"), (m.get("observed_amino_acid") or {}).get("code3")
    if oa and ba and oa.upper() in AA1 and ba.upper() in AA1:
        return AA1[oa.upper()], AA1[ba.upper()]
    return None


# ---------------------------------------------------------------------------
# Pages
# ---------------------------------------------------------------------------

def _alignment_block(aref: str, aobs: str, per: int = 60, max_cols: int = 180) -> XPreformatted:
    lines: List[str] = []
    rp = op = 1
    n = min(max(len(aref), len(aobs)), max_cols)
    for i in range(0, n, per):
        r, o = aref[i:i + per], aobs[i:i + per]
        rl, ml, ol, ruler = [], [], [], []
        for k in range(0, len(r), 10):
            rb, ob = r[k:k + 10], o[k:k + 10]
            ruler.append(f"{rp + sum(x != '-' for x in r[:k]):<10d}"[:10] + " ")
            rs = os_ = ms = ""
            for a, b in zip(rb.ljust(len(ob), " "), ob.ljust(len(rb), " ")):
                if a == b:
                    rs, os_, ms = rs + a, os_ + b, ms + "|"
                elif a == "-" or b == "-":
                    rs += f'<font color="{HEX_BLUE}"><b>{a}</b></font>'
                    os_ += f'<font color="{HEX_BLUE}"><b>{b}</b></font>'
                    ms += f'<font color="{HEX_BLUE}">+</font>'
                else:
                    rs += a
                    os_ += f'<font color="{HEX_RED}"><b>{b}</b></font>'
                    ms += f'<font color="{HEX_RED}"><b>x</b></font>'
            rl.append(rs + " ")
            ol.append(os_ + " ")
            ml.append(ms.replace("|", f'<font color="#BBBBBB">|</font>') + " ")
        lines += [f'<font color="{HEX_MUTED}">     </font>' + "".join(f'<font color="{HEX_MUTED}">{x}</font>' for x in ruler),
                  f'<font color="{HEX_MUTED}">REF  </font>' + "".join(rl), "     " + "".join(ml), f'<font color="{HEX_MUTED}">OBS  </font>' + "".join(ol), ""]
        rp += sum(x != "-" for x in r)
        op += sum(x != "-" for x in o)
    return XPreformatted("\n".join(lines).rstrip(), ST["align"])


def page1(c: Dict[str, Any]) -> List[Any]:
    ref, obs, muts = c["ref"], c["obs"], c["muts"]
    cov_meta = [
        ("Analysis ID", _e(c["id"])), ("Generated", _e(c["when"])), ("Revision", f"{c['rev']} ({'post-editing' if c['edits'] else 'initial submission'})"), ("Locus", f"{_e(c['gene'])} (acc. {_e(c['acc'])})"),
        ("Organism", f"<i>{_e(c['organism'])}</i>"), ("Alignment", _e(c["aln"].get("method") or "Not supplied")), ("Genetic code", f"Table {c['table']}"), ("Reading frame", f"+{c['frame'] + 1}" if c["coding"] else "Not selected"),
    ]
    mt = Table([[[P(l.upper(), "cov_lab"), P(v, "cov_val")] for l, v in cov_meta[:4]], [[P(l.upper(), "cov_lab"), P(v, "cov_val")] for l, v in cov_meta[4:]]], colWidths=[(CONTENT_W - 36) / 4] * 4)
    mt.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "TOP"), ("LEFTPADDING", (0, 0), (-1, -1), 0), ("RIGHTPADDING", (0, 0), (-1, -1), 6), ("TOPPADDING", (0, 0), (-1, -1), 4), ("BOTTOMPADDING", (0, 0), (-1, -1), 4), ("LINEABOVE", (0, 0), (-1, 0), 0.5, colors.HexColor("#3A3A3A"))]))
    ev = ParagraphStyle("ev", fontName=FB, fontSize=7, leading=9, textColor=colors.HexColor("#8FB0FF"))
    cover = Table([
        [Paragraph("DNA MUTATION &amp; SEQUENCE ANALYSIS REPORT", ev)],
        [Paragraph(f'<font color="white">{_e(c["ref_name"])} vs observed sequence</font>', ParagraphStyle("ct", fontName=FB, fontSize=21, leading=26))],
        [Paragraph("Pairwise alignment, variant localisation, coding consequence and thermodynamic profile.", ParagraphStyle("cs", fontName=F, fontSize=8.8, leading=12, textColor=colors.HexColor("#C9C9C9")))],
        [mt],
    ], colWidths=[CONTENT_W])
    cover.setStyle(TableStyle([("BACKGROUND", (0, 0), (-1, -1), INK), ("LEFTPADDING", (0, 0), (-1, -1), 16), ("RIGHTPADDING", (0, 0), (-1, -1), 16), ("TOPPADDING", (0, 0), (-1, -1), 3), ("BOTTOMPADDING", (0, 0), (-1, -1), 3), ("TOPPADDING", (0, 0), (-1, 0), 14), ("BOTTOMPADDING", (0, -1), (-1, -1), 12)]))

    types = Counter(m.get("type", "substitution") for m in muts)
    cats = [m.get("category_label") or m.get("category") for m in muts if (m.get("category_label") or m.get("category"))]
    top_cat = Counter(cats).most_common(1)[0][0] if cats and c["coding"] else "Not assessed"
    n_len = f"{len(ref)} / {len(obs)}" if len(ref) != len(obs) else f"{len(obs)}"
    kp = kpi_row([
        ("Differences", str(len(muts)), f"{types.get('substitution', 0)} subst. / {types.get('insertion', 0)} ins. / {types.get('deletion', 0)} del.", HEX_RED if muts else HEX_INK),
        ("Identity", _num(c["identity"], 1, "%") if c["identity"] is not None else "n/a", "alignment identity", HEX_INK),
        ("Length (bp)", n_len, "reference / observed" if len(ref) != len(obs) else "reference = observed", HEX_INK),
        ("Coding effect", f'<font size="12">{_e(top_cat)}</font>', f"{len(cats)} of {len(muts)} variants classified" if c["coding"] else "select coding context", HEX_BLUE),
    ])
    names = ", ".join(hgvs(m, c["coding"]) for m in muts[:3]) + (f" and {len(muts) - 3} more" if len(muts) > 3 else "")
    prot = [p for p in (_protein_change(m, c) for m in muts) if p != "-"]
    summary = (f"The observed {len(obs)} bp sequence was globally aligned to {_e(c['ref_name'])} ({len(ref)} bp) with "
               f"{_num(c['identity'], 1, '%') if c['identity'] is not None else 'unreported'} identity. "
               + (f"{len(muts)} difference(s) were detected: <font name=\"{MB}\">{_e(names)}</font>. " if muts else "No differences were detected. ")
               + (f"With coding context enabled (frame +{c['frame'] + 1}, genetic code {c['table']}), predicted protein change: <font name=\"{MB}\">{_e(', '.join(prot[:3]))}</font>. " if prot else "")
               + ("User edits are recorded in this revision." if c["edits"] else "No manual edits were applied."))
    ts = nn_thermo(ref), nn_thermo(obs)
    mw = ds_mass_kda(ref), ds_mass_kda(obs)
    rows = [["Length", f"{len(ref)} bp", f"{len(obs)} bp"], ["GC content", _num(gc_pct(ref), 1, "%"), _num(gc_pct(obs), 1, "%")], ["AT content", _num(100 - gc_pct(ref) if ref else 0, 1, "%"), _num(100 - gc_pct(obs) if obs else 0, 1, "%")],
            ["Mol. weight (dsDNA)", _num(mw[0], 1, " kDa"), _num(mw[1], 1, " kDa")], ["Melting temp. (Tm)", _num(ts[0].get("tm"), 1, " &deg;C"), _num(ts[1].get("tm"), 1, " &deg;C")], [f"{DELTA}G&deg;37", _num(ts[0].get("dg"), 1, " kcal/mol"), _num(ts[1].get("dg"), 1, " kcal/mol")]]
    half = (CONTENT_W - GAP) / 2
    return [cover, Spacer(1, 14), kp, Spacer(1, 14),
            section("01", "Executive summary"), P(summary, "body"), Spacer(1, 14),
            section("02", "Variant position map"), Spacer(1, 4), chart_variant_map(len(ref), muts, c["coding"], c["frame"], CONTENT_W),
            legend([(HEX_RED, "Substitution"), (HEX_BLUE, "Insertion"), (HEX_INK, "Deletion"), ("#C9D8FF", "Affected codon")]), Spacer(1, 14),
            two_col([section("03", "Base composition"), Spacer(1, 4), chart_composition(ref, obs, half), legend([(HEX_INK, "Reference"), (HEX_BLUE, "Observed")])],
                    [section("04", "Sequence properties"), Spacer(1, 2), table(["Property", "Reference", "Observed"], rows, [half * 0.40, half * 0.30, half * 0.30])])]


def page2(c: Dict[str, Any]) -> List[Any]:
    ref, obs, muts = c["ref"], c["obs"], c["muts"]
    aref, aobs = c["aref"], c["aobs"]
    gaps = aref.count("-") + aobs.count("-") if aref and aobs else 0
    mism = sum(a != b and a != "-" and b != "-" for a, b in zip(aref, aobs)) if aref and aobs and len(aref) == len(aobs) else len([m for m in muts if m.get("type", "substitution") == "substitution"])
    matches = sum(a == b and a != "-" for a, b in zip(aref, aobs)) if aref and aobs and len(aref) == len(aobs) else None
    kp = kpi_row([("Identity", _num(c["identity"], 1, "%") if c["identity"] is not None else "n/a", "", HEX_INK), ("Matches", str(matches) if matches is not None else "n/a", "", HEX_INK), ("Mismatches", str(mism), "", HEX_RED if mism else HEX_INK), ("Gap columns", str(gaps), "", HEX_INK), ("Score", _num(c["aln"].get("alignment_score"), 1), "", HEX_INK)])
    out: List[Any] = [section("05", "Pairwise sequence alignment"), Spacer(1, 4), kp, Spacer(1, 8), _alignment_block(aref, aobs)]
    if max(len(aref), len(aobs)) > 180:
        out.append(P(f"Showing the first 180 of {max(len(aref), len(aobs)):,} alignment columns.", "small"))
    out += [legend([(HEX_RED, "Mismatch (x)"), (HEX_BLUE, "Gap (+)"), ("#BBBBBB", "Match (|)")]), P("Coordinates are 1-based and relative to the reference.", "small"), Spacer(1, 12)]

    rows: List[List[Any]] = []
    for m in muts[:6]:
        ref_b, obs_b = _first(m, "reference_bases", "original_base", "ref", default="-"), _first(m, "observed_bases", "observed_base", "alt", default="-")
        pos = _mut_pos(m)
        rp = f"{m.get('reference_left_position', '?')}-{m.get('reference_right_position', '?')}" if m.get("type") == "insertion" else str(m.get("reference_position", "-"))
        rc, oc = m.get("reference_codon"), m.get("observed_codon")
        rows.append([f'<font name="{MB}">{_e(rp)}</font>', f'<font name="{MB}">{_e(m.get("observed_position", "-"))}</font>', f'<font name="{MB}">{_e(ref_b)}</font>', f'<font name="{MB}" color="{HEX_RED}">{_e(obs_b)}</font>',
                     _e(str(m.get("type", "substitution")).capitalize()), f'<font name="{MB}">{_e(rc)} {ARROW} {_e(oc)}</font>' if rc and oc else "-", f'<font name="{MB}">{_e(_protein_change(m, c))}</font>',
                     f'<font name="{FB}" color="{HEX_BLUE}">{_e(m.get("category_label") or m.get("category") or "Unclassified")}</font>'])
    if not rows:
        rows = [["-", "-", "-", "-", "Identical", "-", "-", "No differences detected"]]
    w = CONTENT_W
    out += [section("06", "Variant table"), Spacer(1, 2), table(["Ref pos", "Obs pos", "Ref", "Obs", "Type", "Codon", "Protein", "Consequence"], rows, [w * .09, w * .09, w * .09, w * .09, w * .13, w * .17, w * .15, w * .19])]
    if len(muts) > 6:
        out.append(P(f"Showing 6 of {len(muts)} variants. The complete list is in the CSV export.", "small"))
    out.append(Spacer(1, 12))

    half = (CONTENT_W - GAP) / 2
    win = 10 if min(len(ref), len(obs) or 1) >= 30 else max(3, (len(obs) or 3) // 3)
    (rx, ry), (ox, oy) = gc_windows(ref, win), gc_windows(obs, win)
    pos = [p for p in (_mut_pos(m) for m in muts) if p]
    band = (max(1, pos[0] - win + 1), pos[0]) if pos else None
    c1 = chart_lines(half, 128, [(rx, ry, INK, 2.2), (ox, oy, BLUE, 1.2)], band, "{:.0f}%")
    tr, to = nn_thermo(ref), nn_thermo(obs)
    if tr and to and len(tr["cum"]) == len(to["cum"]):
        xs = list(range(1, len(tr["cum"]) + 1))
        c2 = chart_lines(half, 128, [(xs, [b - a for a, b in zip(tr["cum"], to["cum"])], BLUE, 1.6)], (pos[0] - 1, pos[0]) if pos else None, "{:+.2f}")
        t2, l2 = f"Cumulative {DELTA}{DELTA}G&deg;37 (obs - ref)", legend([(HEX_BLUE, "kcal/mol along the sequence")])
    elif tr and to:
        c2 = chart_lines(half, 128, [(list(range(1, len(tr["cum"]) + 1)), tr["cum"], INK, 2.0), (list(range(1, len(to["cum"]) + 1)), to["cum"], BLUE, 1.2)], None, "{:.0f}")
        t2, l2 = f"Cumulative {DELTA}G&deg;37", legend([(HEX_INK, "Reference"), (HEX_BLUE, "Observed")])
    else:
        c2, t2, l2 = chart_lines(half, 128, []), f"Cumulative {DELTA}G&deg;37", legend([])
    out.append(two_col([section("07", f"GC content, {win}-bp window"), Spacer(1, 4), c1, legend([(HEX_INK, "Reference"), (HEX_BLUE, "Observed"), ("#F5B5AE", "Windows covering variant")])],
                       [section("08", t2), Spacer(1, 4), c2, l2]))
    out.append(Spacer(1, 12))

    def row(label: str, a: Any, b: Any, d: int = 1) -> List[str]:
        return [label, _num(a, d), _num(b, d), _sgn(b - a, d) if isinstance(a, (int, float)) and isinstance(b, (int, float)) else "n/a"]
    g = lambda t, k: t.get(k) if t else None
    trows = [row(f"{DELTA}H&deg; (kcal/mol)", g(tr, "dh"), g(to, "dh")), row(f"{DELTA}S&deg; (cal/mol&middot;K)", g(tr, "ds"), g(to, "ds")), row(f"{DELTA}G&deg;37 (kcal/mol)", g(tr, "dg"), g(to, "dg")), row("Tm (&deg;C)", g(tr, "tm"), g(to, "tm")), row("GC content (%)", gc_pct(ref) if ref else None, gc_pct(obs) if obs else None)]
    bp = c["biophys"]
    eps = (bp.get("spectroscopic_profile") or {}).get("molar_extinction_260_m_cm")
    if isinstance(eps, (int, float)):
        trows.append(["Extinction e260 (observed)", "-", f"{eps:,.0f} M<super>-1</super>cm<super>-1</super>", "-"])
    out += [section("09", "Thermodynamic profile"), Spacer(1, 2), table(["Parameter", "Reference", "Observed", "Change"], trows, [w * .40, w * .20, w * .20, w * .20]),
            P("Unified nearest-neighbour model (SantaLucia 1998), 50 mM Na<super>+</super>, 0.25 &micro;M strands, non-self-complementary, fully paired duplex. Both columns use the same model, so the change is directly comparable. Tm is approximate for long fragments.", "small")]
    return out


def _codon_strip(seq: str, c: Dict[str, Any], centre: int, other: str) -> Table:
    t = CODON_TABLES[c["table"]]
    n = (len(seq) - c["frame"]) // 3
    start = max(0, min(centre - 3, n - 7))
    cells = []
    sty = []
    for k, i in enumerate(range(start, min(start + 7, n))):
        cod = seq[c["frame"] + 3 * i:c["frame"] + 3 * i + 3]
        oc = other[c["frame"] + 3 * i:c["frame"] + 3 * i + 3]
        diff = cod != oc
        col = HEX_RED if diff else HEX_INK
        cells.append([P(f"codon {i + 1}", "lab"), Paragraph(f'<font name="{MB}" size="10.5" color="{col}">{cod}</font>', ST["ctr"]), Paragraph(f'<font color="{col}">{AA3.get(t.get(cod, "X"), "?")}</font>', ST["ctr"])])
        sty += [("BACKGROUND", (k, 0), (k, 0), RED_TINT if diff else WHITE), ("BOX", (k, 0), (k, 0), 0.6, RED if diff else HAIR)]
    tb = Table([cells], colWidths=[(CONTENT_W - 6 * 5) / 7] * len(cells), hAlign="LEFT")
    tb.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "MIDDLE"), ("TOPPADDING", (0, 0), (-1, -1), 5), ("BOTTOMPADDING", (0, 0), (-1, -1), 5), ("LEFTPADDING", (0, 0), (-1, -1), 2), ("RIGHTPADDING", (0, 0), (-1, -1), 2)] + sty))
    return tb


def _protein_lines(pr: str, po: str, per: int = 60, max_aa: int = 120) -> XPreformatted:
    lines = []
    for i in range(0, min(max(len(pr), len(po)), max_aa), per):
        a, b = pr[i:i + per], po[i:i + per]
        lines.append(f'<font color="{HEX_MUTED}">REF {i + 1:>4}  </font>' + a)
        lines.append(f'<font color="{HEX_MUTED}">OBS {i + 1:>4}  </font>' + "".join(x if (k + i < len(a) and a[k] == x) else f'<font color="{HEX_RED}"><b>{x}</b></font>' for k, x in enumerate(b)))
        lines.append("")
    return XPreformatted("\n".join(lines).rstrip(), ST["align"])


def page3(c: Dict[str, Any]) -> List[Any]:
    ref, obs, muts = c["ref"], c["obs"], c["muts"]
    w = CONTENT_W
    out: List[Any] = [section("10", f"Coding consequence (genetic code {c['table']}, frame +{c['frame'] + 1})" if c["coding"] else "Coding consequence"), Spacer(1, 4)]
    if c["coding"] and ref and obs:
        pos = [p for p in (_mut_pos(m) for m in muts) if p]
        centre = int((pos[0] - 1 - c["frame"]) // 3) if pos else 0
        out += [P("REFERENCE, CODONS AROUND THE FIRST VARIANT", "lab"), Spacer(1, 2), _codon_strip(ref, c, centre, obs), Spacer(1, 6), P("OBSERVED", "lab"), Spacer(1, 2), _codon_strip(obs, c, centre, ref), Spacer(1, 8),
                _protein_lines(translate(ref, c["frame"], c["table"]), translate(obs, c["frame"], c["table"])),
                P("Differences are shown in red. Trailing nucleotides that do not complete a codon are not translated.", "small")]
    else:
        out.append(P("Coding context was not selected, so no amino-acid consequences are reported. Re-run with a reading frame and genetic code to enable this section.", "body"))
    out.append(Spacer(1, 12))

    pair = next((p for p in (_aa_pair(m, c) for m in muts) if p and p[0] != p[1]), None) if c["coding"] else None
    out.append(section("11", f"Residue property change ({AA3[pair[0]]} {ARROW} {AA3[pair[1]]})" if pair else "Residue property change"))
    out.append(Spacer(1, 4))
    if pair and pair[0] in KD and pair[1] in KD:
        a, b = pair
        out += [chart_property_bars([("Hydropathy (Kyte-Doolittle)", KD[a], KD[b], -4.5, 4.5, ""), ("Side-chain volume", VOL[a], VOL[b], 0, 240, "A^3"), ("Residue mass", RMASS[a], RMASS[b], 0, 190, "Da")], w, AA3[a], AA3[b]),
                legend([(HEX_INK, f"{AA3[a]} (reference)"), (HEX_BLUE, f"{AA3[b]} (observed)")]),
                P(f"Hydropathy changes by {KD[b] - KD[a]:+.1f}, volume by {VOL[b] - VOL[a]:+.1f} cubic angstroms, and residue mass by {RMASS[b] - RMASS[a]:+.1f} Da.", "body")]
    else:
        out.append(P("No amino-acid substitution is available for property comparison.", "body"))
    out.append(Spacer(1, 12))

    sm = c["smap"]
    out += [section("12", "Structure mapping"), Spacer(1, 2)]
    maps = sm.get("mappings") or []
    if sm.get("mapped") and maps:
        pm, prov = maps[0], sm.get("provenance") or {}
        pdb = _first(sm, "pdb_id", default="-")
        dna = str(pdb).startswith("DNA_")
        rows = [["Structure", f'<font name="{MB}" color="{HEX_BLUE}">{_e(pdb)}</font> (chain {_e(_first(sm, "chain", default=prov.get("chain", "-")))})'] if not dna else ["Structure", "De novo canonical B-DNA duplex (BioCrystal builder)"],
                ["Residue", f"{_e(pm.get('original_residue', '-'))}{_e(pm.get('residue_number', ''))}{_e(pm.get('mutated_residue', ''))}"], ["Region", _e(pm.get("structural_region", "Not supplied"))],
                ["Source", _e(prov.get("database") or ("BioCrystal B-DNA engine" if dna else "RCSB PDB"))], ["Limitation", _e(prov.get("disclaimer") or "Coordinates describe the deposited or generated model, not the analysed sequence.")]]
    else:
        rows = [["Status", "No reliable structure mapping is available. " + _e(sm.get("reason") or "Sequence comparison remains valid; no synthetic conformation is shown.")]]
    out.append(table(["Item", "Value"], rows, [w * .18, w * .82]))
    out.append(Spacer(1, 12))

    nodes = [("Submitted", f"{len(c['orig'])} bp")]
    for i, e in enumerate(c["edits"][:3], 1):
        nodes.append((f"Edit {i}", f"pos {e.get('position', '-')}"))
    nodes += [("Analysed", f"Revision {c['rev']}"), ("Report", "this document")]
    out += [section("13", "Revision and edit history"), Spacer(1, 6), chart_timeline(nodes, w), Spacer(1, 4)]
    if c["edits"]:
        er = [[f"#{i}", f"Pos {_e(e.get('position', '-'))}", f'<font name="{M}">{_e(e.get("original") or e.get("old_bases") or e.get("oldBases") or "-")}</font>', f'<font name="{MB}">{_e(e.get("edited") or e.get("new_bases") or e.get("newBases") or "-")}</font>', _e(e.get("action") or e.get("reason") or "Manual base edit")] for i, e in enumerate(c["edits"][:4], 1)]
    else:
        er = [["-", "-", "-", "-", "No manual edits applied"]]
    out.append(table(["Edit", "Position", "Previous", "Replaced", "Action"], er, [w * .1, w * .15, w * .2, w * .2, w * .35]))
    if len(c["edits"]) > 4:
        out.append(P(f"Showing 4 of {len(c['edits'])} edits.", "small"))
    return out


def page4(c: Dict[str, Any]) -> List[Any]:
    ref, obs, muts, aln = c["ref"], c["obs"], c["muts"], c["aln"]
    w = CONTENT_W
    sc = aln.get("scoring")
    method = _e(aln.get("method") or "Method not supplied") + (f" (match {sc.get('match')}, mismatch {sc.get('mismatch')}, gap open {sc.get('gap_open')}, gap extend {sc.get('gap_extend')})." if isinstance(sc, dict) else ".")
    meth = [["Alignment", method], ["Coordinates", "1-based positions on the reference. Insertions are placed at alignment gaps between reference bases."],
            ["Coding context", f"Sequence type: {_e(c['seq_type'])}; " + (f"frame +{c['frame'] + 1}; NCBI genetic code table {c['table']}." if c["coding"] else "no frame selected, so amino-acid effects are not reported.")],
            ["Thermodynamics", "Unified nearest-neighbour parameters (SantaLucia 1998) at 50 mM Na<super>+</super> and 0.25 &micro;M strand concentration."], ["Normalisation", _e(aln.get("normalization") or "No normalisation was applied; the first optimal alignment is reported.")]]
    ok = lambda b: ("PASS", HEX_BLUE) if b else ("NOTE", HEX_AMBER)
    gaps = c["aref"].count("-") + c["aobs"].count("-")
    qc = [("Validation", "only A, C, G, T present" if set(ref + obs) <= set("ACGT") else "non-ACGT characters present", ok(set(ref + obs) <= set("ACGT") and bool(ref and obs))),
          ("Length", f"{len(ref)} bp vs {len(obs)} bp", ok(len(ref) == len(obs))), ("Start codon", "ATG at position 1" if obs[:3] == "ATG" else "no ATG at position 1", ok(obs[:3] == "ATG")),
          ("Alignment", "no gaps introduced" if gaps == 0 else f"{gaps} gap column(s)", ok(gaps == 0)),
          ("Frame", "length is a multiple of 3" if len(obs) % 3 == 0 else f"length is not a multiple of 3 ({len(obs) % 3} nt untranslated)", ok(len(obs) % 3 == 0 or not c["coding"])),
          ("Revision", "analysed = current sequence" if c["orig"] == obs or c["edits"] else "sequence differs from submitted", ok(True))]
    qcells = []
    for name, note, (status, col) in qc:
        qcells.append(Paragraph(f'<font name="{MB}" size="6.8" color="{col}">{status}</font>&nbsp;&nbsp;<b>{name}</b> <font color="{HEX_MUTED}">{note}</font>', ST["cell"]))
    while len(qcells) % 2:
        qcells.append("")
    qt = Table([qcells[i:i + 2] for i in range(0, len(qcells), 2)], colWidths=[w / 2] * 2)
    qt.setStyle(TableStyle([("LINEBELOW", (0, 0), (-1, -1), 0.4, HAIR), ("TOPPADDING", (0, 0), (-1, -1), 4.5), ("BOTTOMPADDING", (0, 0), (-1, -1), 4.5), ("LEFTPADDING", (0, 0), (-1, -1), 0), ("RIGHTPADDING", (0, 0), (-1, -1), 10), ("VALIGN", (0, 0), (-1, -1), "TOP")]))
    lim = ["<b>Reference-relative.</b> Differences are relative to the chosen reference and do not establish biological or clinical significance.", "<b>Coding context.</b> Amino-acid effects need a selected frame and genetic code and are predictions only.",
           "<b>Alignment equivalence.</b> In repetitive regions equivalent gap placements may exist; the first optimal alignment is reported.", "<b>Structure.</b> Deposited coordinates do not model the analysed sequence; residue mapping exists only for curated references."]
    lt = Table([[P(x, "body")] for x in lim], colWidths=[w])
    lt.setStyle(TableStyle([("LINEBELOW", (0, 0), (-1, -1), 0.4, HAIR), ("TOPPADDING", (0, 0), (-1, -1), 3.5), ("BOTTOMPADDING", (0, 0), (-1, -1), 3.5), ("LEFTPADDING", (0, 0), (-1, -1), 0)]))
    tr, to = nn_thermo(ref), nn_thermo(obs)
    names = ", ".join(hgvs(m, c["coding"]) for m in muts[:3])
    prot = [p for p in (_protein_change(m, c) for m in muts) if p != "-"]
    interp = (f"The observed sequence ({len(obs)} bp) was compared with {_e(c['ref_name'])} ({len(ref)} bp) and shows {_num(c['identity'], 1, '%') if c['identity'] is not None else 'unreported'} identity with {len(muts)} detected difference(s)"
              + (f" (<font name=\"{MB}\">{_e(names)}</font>)" if muts else "") + ". "
              + (f"Under the selected coding context this predicts <font name=\"{MB}\">{_e(', '.join(prot[:2]))}</font>. " if prot else "")
              + (f"GC content changes from {gc_pct(ref):.1f}% to {gc_pct(obs):.1f}% and predicted duplex stability shifts by {to['dg'] - tr['dg']:+.1f} kcal/mol ({DELTA}G&deg;37), Tm {to['tm'] - tr['tm']:+.1f} &deg;C. " if tr and to else "")
              + "These are sequence-level observations. They are not evidence of pathogenicity and not a recommended intervention.")
    gl = [("c.35G&gt;T", "Coding-DNA position 35, G replaced by T (example)."), ("p.Gly12Val", "Protein residue 12, glycine replaced by valine (example)."), ("Missense", "A substitution that changes the encoded amino acid."), (f"{DELTA}G&deg;37", "Duplex free energy at 37 &deg;C; more negative is more stable.")]
    gt = Table([[[Paragraph(f'<font name="{MB}" size="8">{a}</font>', ST["cell"]), P(b, "small")] for a, b in gl]], colWidths=[w / 4] * 4)
    gt.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "TOP"), ("LEFTPADDING", (0, 0), (-1, -1), 0), ("RIGHTPADDING", (0, 0), (-1, -1), 8)]))
    notice = Table([[Paragraph("NOTICE &amp; COMPUTATIONAL USE DISCLAIMER", ParagraphStyle("nt", fontName=FB, fontSize=6.8, leading=9, textColor=colors.HexColor("#8FB0FF")))],
                    [Paragraph("This report contains educational computational sequence analysis and simplified visualization. It does not establish pathogenicity, clinical significance, biological repair, protein function, or experimentally validated molecular structure. It does not constitute clinical diagnosis, therapeutic, or medical advice. Any conclusion requires independent experimental validation.", ParagraphStyle("nb", fontName=F, fontSize=8, leading=11.5, textColor=colors.HexColor("#E5E5E5")))]], colWidths=[w])
    notice.setStyle(TableStyle([("BACKGROUND", (0, 0), (-1, -1), INK), ("LEFTPADDING", (0, 0), (-1, -1), 14), ("RIGHTPADDING", (0, 0), (-1, -1), 14), ("TOPPADDING", (0, 0), (-1, 0), 11), ("BOTTOMPADDING", (0, 0), (-1, 0), 2), ("TOPPADDING", (0, 1), (-1, 1), 2), ("BOTTOMPADDING", (0, 1), (-1, 1), 12)]))
    return [section("14", "Computational methodology"), Spacer(1, 2), table(["Step", "Specification"], meth, [w * .20, w * .80]), Spacer(1, 12),
            section("15", "Quality checks"), Spacer(1, 2), qt, Spacer(1, 12),
            section("16", "Scientific limitations"), Spacer(1, 2), lt, Spacer(1, 12),
            section("17", "Final interpretation"), Spacer(1, 3), P(interp, "body"), Spacer(1, 12),
            section("18", "Notation"), Spacer(1, 4), gt, Spacer(1, 14), notice]


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def generate_pdf_report(report_data: Dict[str, Any]) -> bytes:
    """Build the four-page BioCrystal 3D report and return the PDF bytes."""
    c = _build_context(report_data or {})
    story: List[Any] = []
    for i, build in enumerate((page1, page2, page3, page4)):
        story.append(KeepInFrame(CONTENT_W, FRAME_H - 2, build(c), mode="shrink"))
        if i < 3:
            story.append(PageBreak())
    buf = BytesIO()
    doc = BaseDocTemplate(buf, pagesize=A4, leftMargin=MARGIN_X, rightMargin=MARGIN_X, topMargin=MARGIN_TOP, bottomMargin=MARGIN_BOTTOM,
                          title="BioCrystal 3D - DNA Sequence Analysis Report", author="BioCrystal 3D")
    doc.addPageTemplates([PageTemplate(id="p", frames=[Frame(MARGIN_X, MARGIN_BOTTOM, CONTENT_W, FRAME_H, leftPadding=0, rightPadding=0, topPadding=0, bottomPadding=0, id="f")])])
    doc.build(story, canvasmaker=_canvas_factory({"id": str(c["id"]), "rev": str(c["rev"])}))
    return buf.getvalue()


if __name__ == "__main__":  # python report_generator.py  ->  sample_report.pdf
    _ref = "ATGACTGAATATAAACTTGTGGTAGTTGGAGCTGGTGGCGTAGGCAAGAGTGCCTTGACGATACAGCTAATTCAGAATCATTTTGTGGACGAATATGATC"
    _obs = _ref[:34] + "T" + _ref[35:]
    _sample = {
        "analysis_id": "BC-20261110-0942", "revision": 1, "reference_name": "KRAS (6OIM)", "organism": "Homo sapiens",
        "reference_sequence": _ref, "current_sequence": _obs, "original_sequence": _obs,
        "analysis_context": {"sequence_type": "coding", "reading_frame": 0, "genetic_code": 1},
        "analysis_result": {"options": {"organism": "Homo sapiens", "geneName": "KRAS"}, "alignment": {
            "method": "Global pairwise alignment (Biopython)", "aligned_reference": _ref, "aligned_observed": _obs, "alignment_score": 98.0,
            "mutations": [{"type": "substitution", "reference_position": 35, "observed_position": 35, "original_base": "G", "observed_base": "T",
                           "reference_codon": "GGT", "observed_codon": "GTT", "category_label": "Missense",
                           "original_amino_acid": {"name": "Glycine", "code3": "Gly"}, "observed_amino_acid": {"name": "Valine", "code3": "Val"}}]},
            "structure_mapping": {"mapped": True, "pdb_id": "6OIM", "chain": "A", "provenance": {"database": "RCSB PDB"},
                                  "mappings": [{"residue_number": 12, "original_residue": "G", "mutated_residue": "V", "structural_region": "P-loop"}]}},
    }
    with open("sample_report.pdf", "wb") as fh:
        fh.write(generate_pdf_report(_sample))
    print("wrote sample_report.pdf")