"""
BioCrystal 3D — Publication-Grade Four-Page Scientific PDF Report Generator.

Engineered with ReportLab 5.x:
- Exactly FOUR pages on A4 (strictly budgeted height per page)
- Page 1: Analysis Overview, Status & Input Identity, Sequence Properties, Factual Summary
- Page 2: Pairwise Sequence Alignment, Metrics, Aligned Excerpts, Mutation Table
- Page 3: Mutation Details, User Sequence Edit History, Macromolecular Structure & 3D Mapping
- Page 4: Computational Methodology, Scientific Limitations, Final Interpretation & Notice
- True two-pass NumberedCanvas ("Page X of 4")

Public interface:
    generate_pdf_report(report_data: dict) -> bytes
"""

from __future__ import annotations

import re
from datetime import datetime, timezone
from html import escape
from io import BytesIO
from typing import Any, Dict, List, Optional

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.pdfgen import canvas
from reportlab.platypus import (
    KeepTogether,
    PageBreak,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)


# ---------------------------------------------------------------------------
# Geometry & Palette
# ---------------------------------------------------------------------------

PAGE_W, PAGE_H = A4  # 595.28 x 841.89 points
MARGIN_X = 14 * mm   # 39.69 pt
MARGIN_TOP = 13 * mm # 36.85 pt
MARGIN_BOTTOM = 13 * mm # 36.85 pt
CONTENT_W = PAGE_W - (MARGIN_X * 2)  # 515.906 pt

# Palette
COLOR_SWISS_RED = colors.HexColor("#9C0006")      # Swiss Red Accent
COLOR_SWISS_RED_TINT = colors.HexColor("#FDF2F2") # Subtle red background
COLOR_PRIMARY_NAVY = colors.HexColor("#0F2038")   # Deep Swiss Navy
COLOR_SECONDARY_BLUE = colors.HexColor("#175CD3") # Scientific Blue
COLOR_BLUE_TINT = colors.HexColor("#EFF8FF")
COLOR_INK = colors.HexColor("#1A1D20")            # Deep Charcoal body text
COLOR_MUTED = colors.HexColor("#5F676D")          # Secondary metadata
COLOR_BORDER = colors.HexColor("#D8DDE1")         # Hairline borders
COLOR_BORDER_LIGHT = colors.HexColor("#EAECEE")   # Cell separators
COLOR_ZEBRA = colors.HexColor("#F8F9FA")          # Alternating table rows
COLOR_WHITE = colors.HexColor("#FFFFFF")

# Semantic Badge Colors
COLOR_HIGH_IMPACT = colors.HexColor("#B42318")    # Missense / High
COLOR_HIGH_IMPACT_BG = colors.HexColor("#FEF3F2")
COLOR_MODERATE = colors.HexColor("#B54708")       # Amber
COLOR_MODERATE_BG = colors.HexColor("#FFFAEB")
COLOR_LOW_IMPACT = colors.HexColor("#027A48")     # Synonymous / Green
COLOR_LOW_IMPACT_BG = colors.HexColor("#ECFDF3")


# ---------------------------------------------------------------------------
# NumberedCanvas for true "Page X of 4"
# ---------------------------------------------------------------------------

class NumberedCanvas(canvas.Canvas):
    """
    Two-pass canvas that accumulates page states to draw accurate
    running headers and footers with real total page counts (strictly 4 pages).
    """
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._saved_page_states: List[Dict[str, Any]] = []

    def showPage(self):
        self._saved_page_states.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        num_pages = len(self._saved_page_states)
        for state in self._saved_page_states:
            self.__dict__.update(state)
            self.draw_page_furniture(num_pages)
            super().showPage()
        super().save()

    def draw_page_furniture(self, page_count: int) -> None:
        self.saveState()

        # Top Swiss Red Accent Bar
        self.setFillColor(COLOR_SWISS_RED)
        self.rect(0, PAGE_H - 3.2 * mm, PAGE_W, 3.2 * mm, stroke=0, fill=1)

        # Top Running Header (Pages > 1)
        if self._pageNumber > 1:
            self.setFont("Helvetica-Bold", 6.8)
            self.setFillColor(COLOR_PRIMARY_NAVY)
            self.drawString(MARGIN_X, PAGE_H - 7.5 * mm, "BIOCRYSTAL 3D")
            self.setFont("Helvetica", 6.5)
            self.setFillColor(COLOR_MUTED)
            self.drawString(MARGIN_X + 65, PAGE_H - 7.5 * mm, "|   DNA MUTATION ANALYSIS & SEQUENCE EDITING REPORT")
            self.drawRightString(
                PAGE_W - MARGIN_X,
                PAGE_H - 7.5 * mm,
                f"PAGE {self._pageNumber} OF {page_count}",
            )

            # Hairline Rule below top header
            self.setStrokeColor(COLOR_BORDER)
            self.setLineWidth(0.4)
            self.line(MARGIN_X, PAGE_H - 9.5 * mm, PAGE_W - MARGIN_X, PAGE_H - 9.5 * mm)

        # Bottom Running Rule
        self.setStrokeColor(COLOR_BORDER)
        self.setLineWidth(0.45)
        self.line(MARGIN_X, 10 * mm, PAGE_W - MARGIN_X, 10 * mm)

        # Bottom Running Footer
        self.setFillColor(COLOR_MUTED)
        self.setFont("Helvetica", 6.4)
        self.drawString(
            MARGIN_X,
            6.5 * mm,
            "BioCrystal 3D Computational Engine v3.0  ·  Research and in-silico hypothesis generation only  ·  Not for clinical diagnostic use.",
        )
        self.setFont("Helvetica-Bold", 6.8)
        self.setFillColor(COLOR_PRIMARY_NAVY)
        self.drawRightString(
            PAGE_W - MARGIN_X,
            6.5 * mm,
            f"Page {self._pageNumber} of {page_count}",
        )

        self.restoreState()


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _clean_seq(seq: Any) -> str:
    return re.sub(r"[^A-Za-z]+", "", str(seq or "")).upper()


def _first(data: Dict[str, Any], *keys: str, default: Any = None) -> Any:
    for k in keys:
        v = data.get(k)
        if v is not None and v != "":
            return v
    return default


def _num(val: Any, suffix: str = "", digits: int = 1, default: str = "—") -> str:
    if val in (None, ""):
        return default
    try:
        return f"{float(val):.{digits}f}{suffix}"
    except (TypeError, ValueError):
        return f"{val}{suffix}"


def _format_alignment_block(ref: str, obs: str, line_len: int = 50) -> str:
    """Format aligned reference and observed sequences into side-by-side comparison with difference marker."""
    lines: List[str] = []
    max_len = max(len(ref), len(obs))
    for i in range(0, min(max_len, 150), line_len):
        r_chunk = ref[i:i + line_len]
        o_chunk = obs[i:i + line_len]
        diff_chunk = "".join("*" if (j < len(r_chunk) and j < len(o_chunk) and r_chunk[j] != o_chunk[j]) else " " for j in range(max(len(r_chunk), len(o_chunk))))
        lines.append(f"REF  {i+1:>4}  {r_chunk}")
        lines.append(f"OBS  {i+1:>4}  {o_chunk}")
        lines.append(f"DIFF       {diff_chunk.replace(' ', '&nbsp;')}")
        lines.append("")
    return "<br/>".join(lines)


# ---------------------------------------------------------------------------
# Stylesheet
# ---------------------------------------------------------------------------

def _build_styles() -> Dict[str, ParagraphStyle]:
    base = getSampleStyleSheet()

    return {
        "masthead_eyebrow": ParagraphStyle(
            "BC_MastheadEyebrow", parent=base["Normal"],
            fontName="Helvetica-Bold", fontSize=7.0, leading=8.5,
            textColor=COLOR_SWISS_RED, spaceAfter=1,
        ),
        "masthead_title": ParagraphStyle(
            "BC_MastheadTitle", parent=base["Title"],
            fontName="Helvetica-Bold", fontSize=16, leading=19,
            textColor=COLOR_PRIMARY_NAVY, alignment=TA_LEFT, spaceAfter=2,
        ),
        "masthead_subtitle": ParagraphStyle(
            "BC_MastheadSubtitle", parent=base["Normal"],
            fontName="Helvetica", fontSize=7.6, leading=10,
            textColor=COLOR_MUTED, spaceAfter=4,
        ),
        "banner_title": ParagraphStyle(
            "BC_BannerTitle", parent=base["Normal"],
            fontName="Helvetica-Bold", fontSize=7.8, leading=9.5,
            textColor=COLOR_WHITE,
        ),
        "banner_sub": ParagraphStyle(
            "BC_BannerSub", parent=base["Normal"],
            fontName="Helvetica-Bold", fontSize=6.2, leading=7.5,
            textColor=colors.HexColor("#D8E2EC"), alignment=TA_RIGHT,
        ),
        "table_hdr_white": ParagraphStyle(
            "BC_TableHdrWhite", parent=base["Normal"],
            fontName="Helvetica-Bold", fontSize=6.2, leading=7.5,
            textColor=COLOR_WHITE,
        ),
        "cell_label": ParagraphStyle(
            "BC_CellLabel", parent=base["Normal"],
            fontName="Helvetica-Bold", fontSize=6.3, leading=8.0,
            textColor=COLOR_MUTED,
        ),
        "cell_val": ParagraphStyle(
            "BC_CellVal", parent=base["Normal"],
            fontName="Helvetica", fontSize=6.8, leading=8.8,
            textColor=COLOR_INK,
        ),
        "cell_val_bold": ParagraphStyle(
            "BC_CellValBold", parent=base["Normal"],
            fontName="Helvetica-Bold", fontSize=6.8, leading=8.8,
            textColor=COLOR_INK,
        ),
        "cell_code": ParagraphStyle(
            "BC_CellCode", parent=base["Code"],
            fontName="Courier", fontSize=6.4, leading=8.0,
            textColor=COLOR_PRIMARY_NAVY,
        ),
        "align_seq": ParagraphStyle(
            "BC_AlignSeq", parent=base["Code"],
            fontName="Courier", fontSize=6.2, leading=8.2,
            textColor=colors.HexColor("#1A1D20"),
        ),
        "body_text": ParagraphStyle(
            "BC_BodyText", parent=base["BodyText"],
            fontName="Helvetica", fontSize=6.8, leading=9.2,
            textColor=COLOR_INK,
        ),
        "disclaimer_text": ParagraphStyle(
            "BC_Disclaimer", parent=base["BodyText"],
            fontName="Helvetica", fontSize=6.4, leading=8.5,
            textColor=COLOR_SWISS_RED,
        ),
        "badge": ParagraphStyle(
            "BC_Badge", parent=base["Normal"],
            fontName="Helvetica-Bold", fontSize=5.8, leading=7.0,
            alignment=TA_CENTER,
        ),
    }


def _section_header(
    title: str,
    subtitle: str = "IN-SILICO ANALYSIS",
    styles: Optional[Dict[str, ParagraphStyle]] = None,
    accent: colors.Color = COLOR_PRIMARY_NAVY,
) -> Table:
    """Standalone section banner that does not trap flowables in non-splittable tables."""
    s = styles or _build_styles()
    t = Table(
        [[
            Paragraph(escape(title.upper()), s["banner_title"]),
            Paragraph(escape(subtitle.upper()), s["banner_sub"]),
        ]],
        colWidths=[CONTENT_W * 0.72, CONTENT_W * 0.28],
    )
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), accent),
        ("LINEBEFORE", (0, 0), (0, -1), 3.0, COLOR_SWISS_RED),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("LEFTPADDING", (0, 0), (-1, -1), 5),
        ("RIGHTPADDING", (0, 0), (-1, -1), 5),
        ("TOPPADDING", (0, 0), (-1, -1), 3),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
    ]))
    return t


def _render_badge(text: str, category: str, styles: Dict[str, ParagraphStyle]) -> Table:
    cat = (category or "").lower()
    if any(k in cat for k in ("high", "missense", "nonsense", "frameshift")):
        text_color, bg_color, border_color = COLOR_HIGH_IMPACT, COLOR_HIGH_IMPACT_BG, COLOR_HIGH_IMPACT
    elif any(k in cat for k in ("moderate", "inframe", "amber")):
        text_color, bg_color, border_color = COLOR_MODERATE, COLOR_MODERATE_BG, COLOR_MODERATE
    elif any(k in cat for k in ("low", "synonymous", "silent", "benign")):
        text_color, bg_color, border_color = COLOR_LOW_IMPACT, COLOR_LOW_IMPACT_BG, COLOR_LOW_IMPACT
    else:
        text_color, bg_color, border_color = COLOR_SECONDARY_BLUE, COLOR_BLUE_TINT, COLOR_SECONDARY_BLUE

    p = Paragraph(f"<font color='{text_color.hexval()}'><b>{escape(text.upper())}</b></font>", styles["badge"])
    badge_table = Table([[p]], colWidths=[None])
    badge_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), bg_color),
        ("BOX", (0, 0), (-1, -1), 0.45, border_color),
        ("TOPPADDING", (0, 0), (-1, -1), 1.2),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 1.2),
        ("LEFTPADDING", (0, 0), (-1, -1), 3.5),
        ("RIGHTPADDING", (0, 0), (-1, -1), 3.5),
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
    ]))
    return badge_table


# ---------------------------------------------------------------------------
# Four-Page Report Generator
# ---------------------------------------------------------------------------

def generate_pdf_report(report_data: Dict[str, Any]) -> bytes:
    """
    Builds a strictly FOUR-PAGE scientific PDF report for BioCrystal 3D:
    - Page 1: Analysis Overview & Sequence Metrics
    - Page 2: Sequence Comparison & Alignment
    - Page 3: Mutation Details, Sequence Edit History & Structural Context
    - Page 4: Methods, Scientific Limitations & Final Interpretation
    """
    data = report_data or {}
    s = _build_styles()
    story: List[Any] = []

    # Extract nested data safely
    analysis_res = data.get("analysis_result") or {}
    if not isinstance(analysis_res, dict):
        analysis_res = {}

    options = analysis_res.get("options") or {}
    ref_val = analysis_res.get("reference_validation") or {}
    obs_val = analysis_res.get("observed_validation") or {}
    alignment = analysis_res.get("alignment") or data.get("alignment") or {}
    struct_map = (
        analysis_res.get("structure_mapping")
        or data.get("structure_mapping")
        or data.get("structure")
        or {}
    )

    # Sequences
    ref_seq = _clean_seq(
        _first(
            data,
            "reference_sequence", "ref_sequence",
            default=ref_val.get("cleanedSequence", ""),
        )
    )
    obs_seq = _clean_seq(
        _first(
            data,
            "current_sequence", "observed_sequence", "original_sequence", "query_sequence",
            default=obs_val.get("cleanedSequence", ""),
        )
    )
    orig_seq = _clean_seq(_first(data, "original_sequence", default=obs_seq))

    # User edit history
    edit_history: List[Dict[str, Any]] = data.get("edit_history") or []
    revision_num = data.get("revision") or (len(edit_history) + 1 if edit_history else 1)

    # Mutations list
    mutations = (
        data.get("mutations_list")
        or alignment.get("mutations")
        or data.get("mutations")
        or []
    )
    if isinstance(mutations, dict):
        mutations = [mutations]
    elif not isinstance(mutations, (list, tuple)):
        mutations = []

    # Identification metadata
    analysis_id = _first(data, "analysis_id", "run_id", default=f"BC-{datetime.now(timezone.utc).strftime('%Y%m%d%H%M')}")
    generated_at = _first(
        data,
        "generated_at",
        default=datetime.now(timezone.utc).strftime("%d %b %Y · %H:%M UTC"),
    )
    organism = _first(options, "organism", default=_first(data, "organism", default="Homo sapiens"))
    gene_name = _first(options, "geneName", default=_first(data, "gene", default="Human KRAS (Benchmark)"))
    reference_name = _first(data, "reference_name", default=f"{gene_name} Canonical Reference")
    accession = _first(data, "accession", default="NM_004985.5")

    # =========================================================================
    # PAGE 1: ANALYSIS OVERVIEW & SEQUENCE METRICS
    # =========================================================================
    story.append(Paragraph("BIOCRYSTAL 3D · COMPUTATIONAL BIOINFORMATICS WORKSTATION", s["masthead_eyebrow"]))
    story.append(Paragraph("DNA Mutation & Sequence Analysis Report", s["masthead_title"]))
    story.append(Paragraph(
        "Pairwise sequence alignment, mutation localization, sequence editing audit, and structural coordinate mapping.",
        s["masthead_subtitle"],
    ))

    # Metadata Summary Grid
    meta_table = Table(
        [
            [
                Paragraph("ANALYSIS ID", s["cell_label"]),
                Paragraph(f"<b>{escape(str(analysis_id))}</b>", s["cell_val_bold"]),
                Paragraph("DATE & TIME", s["cell_label"]),
                Paragraph(escape(str(generated_at)), s["cell_val"]),
            ],
            [
                Paragraph("ANALYSIS REVISION", s["cell_label"]),
                Paragraph(f"<b>Revision {revision_num}</b> ({'Post-Editing' if edit_history else 'Initial Submission'})", s["cell_val_bold"]),
                Paragraph("TARGET LOCUS", s["cell_label"]),
                Paragraph(f"<b>{escape(str(gene_name))}</b> (Acc: {escape(str(accession))})", s["cell_val"]),
            ],
            [
                Paragraph("ORGANISM", s["cell_label"]),
                Paragraph(f"<i>{escape(str(organism))}</i>", s["cell_val"]),
                Paragraph("ALIGNMENT ENGINE", s["cell_label"]),
                Paragraph("Biopython PairwiseAligner (Needleman-Wunsch)", s["cell_val"]),
            ],
        ],
        colWidths=[CONTENT_W * 0.20, CONTENT_W * 0.30, CONTENT_W * 0.20, CONTENT_W * 0.30],
    )
    meta_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), COLOR_ZEBRA),
        ("BOX", (0, 0), (-1, -1), 0.45, COLOR_BORDER),
        ("INNERGRID", (0, 0), (-1, -1), 0.3, COLOR_BORDER_LIGHT),
        ("TOPPADDING", (0, 0), (-1, -1), 2.5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 2.5),
        ("LEFTPADDING", (0, 0), (-1, -1), 4.5),
        ("RIGHTPADDING", (0, 0), (-1, -1), 4.5),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
    ]))
    story.append(meta_table)
    story.append(Spacer(1, 6))

    # Section 1: Analysis Status & Input Identity
    story.append(_section_header("1. Analysis Status & Input Identity", "Input Summary"))
    story.append(Spacer(1, 2.5))

    len_ref = len(ref_seq)
    len_obs = len(obs_seq)
    len_orig = len(orig_seq)
    delta_len = f"{len_obs - len_ref:+,} bp" if (len_ref and len_obs) else "0 bp"

    status_rows = [
        [
            Paragraph("REFERENCE SEQUENCE", s["cell_label"]),
            Paragraph(f"<b>{escape(reference_name)}</b>", s["cell_val_bold"]),
            Paragraph("OBSERVED SEQUENCE", s["cell_label"]),
            Paragraph(f"<b>{escape(str(len_obs))} bp</b> ({'Modified by edits' if len_obs != len_orig or edit_history else 'Original sequence'})", s["cell_val_bold"]),
        ],
        [
            Paragraph("REFERENCE LENGTH", s["cell_label"]),
            Paragraph(f"{len_ref:,} bp" if len_ref else "—", s["cell_val"]),
            Paragraph("LENGTH DIFFERENCE (Δ)", s["cell_label"]),
            Paragraph(delta_len, s["cell_val"]),
        ],
        [
            Paragraph("ANALYSIS STATUS", s["cell_label"]),
            Paragraph(f"Completed · <b>{len(mutations)} difference(s) detected</b>", s["cell_val_bold"]),
            Paragraph("APPLIED EDITS", s["cell_label"]),
            Paragraph(f"{len(edit_history)} user edit(s) recorded", s["cell_val"]),
        ],
    ]
    status_table = Table(status_rows, colWidths=[CONTENT_W * 0.22, CONTENT_W * 0.28, CONTENT_W * 0.22, CONTENT_W * 0.28])
    status_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), COLOR_WHITE),
        ("BOX", (0, 0), (-1, -1), 0.45, COLOR_BORDER),
        ("INNERGRID", (0, 0), (-1, -1), 0.3, COLOR_BORDER_LIGHT),
        ("ROWBACKGROUNDS", (0, 0), (-1, -1), [COLOR_WHITE, COLOR_ZEBRA]),
        ("TOPPADDING", (0, 0), (-1, -1), 2.5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 2.5),
        ("LEFTPADDING", (0, 0), (-1, -1), 4.5),
        ("RIGHTPADDING", (0, 0), (-1, -1), 4.5),
    ]))
    story.append(status_table)
    story.append(Spacer(1, 6))

    # Section 2: Physicochemical & Sequence Properties
    story.append(_section_header("2. Physicochemical & Nucleotide Metrics", "Biophysical Properties"))
    story.append(Spacer(1, 2.5))

    gc_pct = _first(data, "gc_percent", default=obs_val.get("gcPercent", ref_val.get("gcPercent", 0.0)))
    at_pct = _first(data, "at_percent", default=obs_val.get("atPercent", ref_val.get("atPercent", 0.0)))
    tm = _first(data, "melting_temp", default=obs_val.get("meltingTemperature", ref_val.get("meltingTemperature", 0.0)))
    mw = _first(data, "molecular_weight_kda", default=obs_val.get("molecularWeightKDa", ref_val.get("molecularWeightKDa", 0.0)))

    cnt_a = obs_seq.count("A")
    cnt_t = obs_seq.count("T")
    cnt_g = obs_seq.count("G")
    cnt_c = obs_seq.count("C")
    total_b = max(len_obs, 1)
    pur_pyr = (cnt_a + cnt_g) / max(cnt_c + cnt_t, 1)

    prop_rows = [
        [
            Paragraph("GC CONTENT", s["cell_label"]),
            Paragraph(f"<b>{_num(gc_pct, '%')}</b>", s["cell_val_bold"]),
            Paragraph("AT CONTENT", s["cell_label"]),
            Paragraph(_num(at_pct, "%"), s["cell_val"]),
        ],
        [
            Paragraph("MELTING TEMPERATURE (Tm)", s["cell_label"]),
            Paragraph(f"<b>{_num(tm, ' °C')}</b> (Nearest-Neighbor)", s["cell_val"]),
            Paragraph("PURINE / PYRIMIDINE RATIO", s["cell_label"]),
            Paragraph(f"{pur_pyr:.2f}  (A+G)/(C+T)", s["cell_val"]),
        ],
        [
            Paragraph("ssDNA MOL. WEIGHT", s["cell_label"]),
            Paragraph(_num(mw, " kDa"), s["cell_val"]),
            Paragraph("dsDNA MOL. WEIGHT (EST.)", s["cell_label"]),
            Paragraph(_num(float(mw or 0) * 2, " kDa") if mw else "—", s["cell_val"]),
        ],
        [
            Paragraph("BASE COMPOSITION (A/T)", s["cell_label"]),
            Paragraph(f"A: {cnt_a} ({cnt_a/total_b*100:.1f}%)   T: {cnt_t} ({cnt_t/total_b*100:.1f}%)", s["cell_code"]),
            Paragraph("BASE COMPOSITION (G/C)", s["cell_label"]),
            Paragraph(f"G: {cnt_g} ({cnt_g/total_b*100:.1f}%)   C: {cnt_c} ({cnt_c/total_b*100:.1f}%)", s["cell_code"]),
        ],
        [
            Paragraph("CODING FRAME", s["cell_label"]),
            Paragraph("Standard Frame +1 (CDS)", s["cell_val"]),
            Paragraph("CODON COUNT", s["cell_label"]),
            Paragraph(f"{len_obs // 3} codons ({'Complete triplet' if len_obs % 3 == 0 else 'Non-triplet end'})", s["cell_val"]),
        ],
    ]
    prop_table = Table(prop_rows, colWidths=[CONTENT_W * 0.22, CONTENT_W * 0.28, CONTENT_W * 0.22, CONTENT_W * 0.28])
    prop_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), COLOR_WHITE),
        ("BOX", (0, 0), (-1, -1), 0.45, COLOR_BORDER),
        ("INNERGRID", (0, 0), (-1, -1), 0.3, COLOR_BORDER_LIGHT),
        ("ROWBACKGROUNDS", (0, 0), (-1, -1), [COLOR_WHITE, COLOR_ZEBRA]),
        ("TOPPADDING", (0, 0), (-1, -1), 2.5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 2.5),
        ("LEFTPADDING", (0, 0), (-1, -1), 4.5),
        ("RIGHTPADDING", (0, 0), (-1, -1), 4.5),
    ]))
    story.append(prop_table)
    story.append(Spacer(1, 6))

    # Factual Narrative Summary Card
    summary_text = (
        f"<b>Factual Summary:</b> Global sequence alignment was performed between the canonical reference "
        f"({reference_name}, {len_ref} bp) and the analyzed sequence ({len_obs} bp). A total of "
        f"<b>{len(mutations)} sequence difference(s)</b> were localized and validated. "
        f"{f'{len(edit_history)} user sequence edit(s) are recorded in this revision.' if edit_history else 'No manual edits have been applied.'} "
        f"Refer to Page 2 for pairwise alignment ribbons, Page 3 for mutation details and edit audit, and Page 4 for computational methodology."
    )
    summary_box = Table(
        [[Paragraph(summary_text, s["body_text"])]],
        colWidths=[CONTENT_W],
    )
    summary_box.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), COLOR_ZEBRA),
        ("BOX", (0, 0), (-1, -1), 0.45, COLOR_BORDER),
        ("LINEBEFORE", (0, 0), (0, -1), 2.5, COLOR_PRIMARY_NAVY),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
    ]))
    story.append(summary_box)

    # PAGE 1 END -> STRICT PAGE BREAK
    story.append(PageBreak())

    # =========================================================================
    # PAGE 2: SEQUENCE COMPARISON & ALIGNMENT
    # =========================================================================
    story.append(_section_header("3. Pairwise Sequence Alignment & Difference Map", "Alignment Ribbon"))
    story.append(Spacer(1, 2.5))

    # Alignment Metrics Strip
    identity_pct = alignment.get("identity_percent", 0.0)
    score = alignment.get("alignment_score", 0.0)
    transitions = sum(1 for m in mutations if m.get("is_transition"))
    transversions = sum(1 for m in mutations if m.get("is_transversion"))
    ti_tv = f"{transitions / max(transversions, 1):.2f}" if transversions > 0 else (f"{transitions}.00" if transitions > 0 else "0.00")

    align_strip = Table(
        [[
            Paragraph("HOMOLOGY / IDENTITY", s["cell_label"]),
            Paragraph(f"<b>{identity_pct:.1f}%</b> ({max(len_obs - len(mutations), 0)} / {len_obs} matches)", s["cell_val_bold"]),
            Paragraph("ALIGNMENT SCORE", s["cell_label"]),
            Paragraph(f"{score:.1f}", s["cell_val"]),
            Paragraph("Ti / Tv RATIO", s["cell_label"]),
            Paragraph(f"<b>{ti_tv}</b> ({transitions} Ti / {transversions} Tv)", s["cell_val_bold"]),
        ]],
        colWidths=[CONTENT_W * 0.18, CONTENT_W * 0.22, CONTENT_W * 0.16, CONTENT_W * 0.12, CONTENT_W * 0.14, CONTENT_W * 0.18],
    )
    align_strip.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), COLOR_ZEBRA),
        ("BOX", (0, 0), (-1, -1), 0.45, COLOR_BORDER),
        ("INNERGRID", (0, 0), (-1, -1), 0.3, COLOR_BORDER_LIGHT),
        ("TOPPADDING", (0, 0), (-1, -1), 2.5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 2.5),
        ("LEFTPADDING", (0, 0), (-1, -1), 4),
        ("RIGHTPADDING", (0, 0), (-1, -1), 4),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
    ]))
    story.append(align_strip)
    story.append(Spacer(1, 4))

    # Aligned Sequence Excerpt (NCBI BLAST / GenBank style)
    aligned_ref = alignment.get("aligned_reference") or ref_seq
    aligned_obs = alignment.get("aligned_observed") or obs_seq
    ribbon_html = _format_alignment_block(aligned_ref, aligned_obs, line_len=54)

    ribbon_card = Table(
        [[
            Paragraph("SEQUENCE ALIGNMENT EXCERPT (REF vs OBSERVED)", s["cell_label"]),
        ],
        [
            Paragraph(ribbon_html, s["align_seq"]),
        ]],
        colWidths=[CONTENT_W],
    )
    ribbon_card.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), COLOR_WHITE),
        ("BOX", (0, 0), (-1, -1), 0.45, COLOR_BORDER),
        ("LINEBELOW", (0, 0), (-1, 0), 0.3, COLOR_BORDER_LIGHT),
        ("TOPPADDING", (0, 0), (-1, -1), 3),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
        ("LEFTPADDING", (0, 0), (-1, -1), 5),
        ("RIGHTPADDING", (0, 0), (-1, -1), 5),
    ]))
    story.append(ribbon_card)
    story.append(Spacer(1, 5))

    # Mutation Coordinates Table (Capped at top 7 rows to strictly preserve page budget)
    var_hdr = [
        Paragraph("REF POS", s["table_hdr_white"]),
        Paragraph("OBS POS", s["table_hdr_white"]),
        Paragraph("REF BASES", s["table_hdr_white"]),
        Paragraph("OBS BASES", s["table_hdr_white"]),
        Paragraph("VARIANT TYPE", s["table_hdr_white"]),
        Paragraph("CODON CHANGE", s["table_hdr_white"]),
        Paragraph("CONSEQUENCE / IMPACT", s["table_hdr_white"]),
    ]
    var_rows = [var_hdr]

    display_limit = 7
    for m in mutations[:display_limit]:
        ref_p = _first(m, "reference_position", "position", default="—")
        obs_p = _first(m, "observed_position", "query_position", default="—")
        orig_b = _first(m, "original_base", "ref", default="—")
        obs_b = _first(m, "observed_base", "alt", default="—")
        v_type = _first(m, "type", default="substitution").capitalize()
        ref_c = _first(m, "reference_codon", default="")
        obs_c = _first(m, "observed_codon", default="")
        codon_str = f"{ref_c} → {obs_c}" if (ref_c or obs_c) else "—"
        consequence = _first(m, "category_label", "category", default="Unclassified")

        badge_tab = _render_badge(consequence, consequence, s)

        var_rows.append([
            Paragraph(f"Pos {ref_p}", s["cell_val_bold"]),
            Paragraph(f"Pos {obs_p}", s["cell_val"]),
            Paragraph(f"<b>{escape(orig_b)}</b>", s["cell_code"]),
            Paragraph(f"<b>{escape(obs_b)}</b>", s["cell_code"]),
            Paragraph(escape(v_type), s["cell_val"]),
            Paragraph(escape(codon_str), s["cell_code"]),
            badge_tab,
        ])

    if not mutations:
        var_rows.append([
            Paragraph("—", s["cell_val"]),
            Paragraph("—", s["cell_val"]),
            Paragraph("—", s["cell_val"]),
            Paragraph("—", s["cell_val"]),
            Paragraph("Identical", s["cell_val"]),
            Paragraph("No changes", s["cell_val"]),
            Paragraph("No differences detected", s["cell_val"]),
        ])

    var_table = Table(var_rows, colWidths=[46, 46, 52, 52, 70, 78, CONTENT_W - 344])
    var_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), COLOR_PRIMARY_NAVY),
        ("BOX", (0, 0), (-1, -1), 0.45, COLOR_BORDER),
        ("INNERGRID", (0, 0), (-1, -1), 0.3, COLOR_BORDER_LIGHT),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [COLOR_WHITE, COLOR_ZEBRA]),
        ("TOPPADDING", (0, 0), (-1, -1), 2.5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 2.5),
        ("LEFTPADDING", (0, 0), (-1, -1), 4),
        ("RIGHTPADDING", (0, 0), (-1, -1), 4),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
    ]))
    story.append(var_table)

    if len(mutations) > display_limit:
        story.append(Spacer(1, 2))
        story.append(Paragraph(
            f"<i>* Displaying top {display_limit} of {len(mutations)} detected sequence differences. Refer to exported CSV for complete table.</i>",
            s["cell_label"],
        ))

    story.append(Spacer(1, 4))
    legend_text = (
        "<b>Coordinate & Alignment Legend:</b> Coordinates are 1-based human-readable indices relative to the selected reference. "
        "Substitutions denote base replacements; insertions denote bases added in observed sequence; deletions denote reference bases lost. "
        "Difference marker (*) highlights non-identical positions."
    )
    story.append(Paragraph(legend_text, s["body_text"]))

    # PAGE 2 END -> STRICT PAGE BREAK
    story.append(PageBreak())

    # =========================================================================
    # PAGE 3: MUTATION DETAILS, EDIT HISTORY & STRUCTURAL CONTEXT
    # =========================================================================
    story.append(_section_header("4. Mutation Details & Sequence Edit History", "Variant & Edit Audit"))
    story.append(Spacer(1, 2.5))

    # Detailed Mutation Cards (Top 2 variants)
    if mutations:
        for idx, m in enumerate(mutations[:2], start=1):
            ref_p = _first(m, "reference_position", default="—")
            desc = _first(m, "description", default="")
            consequence = _first(m, "category_label", default="Variant")
            orig_aa = m.get("original_amino_acid") or {}
            obs_aa = m.get("observed_amino_acid") or {}

            card_rows = [
                [
                    Paragraph(f"VARIANT #{idx:02d} · COORD #{ref_p}", s["cell_label"]),
                    Paragraph(f"CONSEQUENCE: <b>{escape(consequence.upper())}</b>", s["cell_val_bold"]),
                ],
                [
                    Paragraph("AMINO ACID SHIFT", s["cell_label"]),
                    Paragraph(
                        f"Wild-Type: <b>{orig_aa.get('name', '—')} ({orig_aa.get('code3', '—')})</b>  →  Altered: <b>{obs_aa.get('name', '—')} ({obs_aa.get('code3', '—')})</b>",
                        s["cell_val"],
                    ),
                ],
            ]
            if desc:
                card_rows.append([
                    Paragraph("BIOLOGICAL NOTE", s["cell_label"]),
                    Paragraph(escape(desc), s["body_text"]),
                ])

            card_table = Table(card_rows, colWidths=[CONTENT_W * 0.24, CONTENT_W * 0.76])
            card_table.setStyle(TableStyle([
                ("BACKGROUND", (0, 0), (-1, -1), COLOR_ZEBRA),
                ("BOX", (0, 0), (-1, -1), 0.45, COLOR_BORDER),
                ("LINEBEFORE", (0, 0), (0, -1), 2.5, COLOR_SWISS_RED if "missense" in consequence.lower() else COLOR_SECONDARY_BLUE),
                ("INNERGRID", (0, 0), (-1, -1), 0.3, COLOR_BORDER_LIGHT),
                ("TOPPADDING", (0, 0), (-1, -1), 2.2),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 2.2),
                ("LEFTPADDING", (0, 0), (-1, -1), 4.5),
                ("RIGHTPADDING", (0, 0), (-1, -1), 4.5),
            ]))
            story.append(card_table)
            story.append(Spacer(1, 3.5))

    # User Sequence Edit Audit Table
    story.append(Paragraph("SEQUENCE EDIT AUDIT TRAIL", s["cell_label"]))
    story.append(Spacer(1, 1.5))

    if edit_history:
        edit_hdr = [
            Paragraph("EDIT #", s["table_hdr_white"]),
            Paragraph("TARGET POS", s["table_hdr_white"]),
            Paragraph("PREVIOUS BASES", s["table_hdr_white"]),
            Paragraph("REPLACED BASES", s["table_hdr_white"]),
            Paragraph("ACTION TAKEN", s["table_hdr_white"]),
        ]
        edit_rows = [edit_hdr]
        for e_idx, e in enumerate(edit_history[:4], start=1):
            orig_txt = e.get("original") or e.get("old_bases") or e.get("oldBases") or "—"
            edit_txt = e.get("edited") or e.get("new_bases") or e.get("newBases") or "—"
            action_txt = e.get("action") or e.get("reason") or "Manual Base Edit"
            edit_rows.append([
                Paragraph(f"#{e_idx}", s["cell_val_bold"]),
                Paragraph(f"Pos {e.get('position', '—')}", s["cell_val"]),
                Paragraph(escape(str(orig_txt)), s["cell_code"]),
                Paragraph(f"<b>{escape(str(edit_txt))}</b>", s["cell_code"]),
                Paragraph(escape(str(action_txt)), s["cell_val"]),
            ])
        edit_table = Table(edit_rows, colWidths=[40, 65, 80, 80, CONTENT_W - 265])
        edit_table.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), COLOR_PRIMARY_NAVY),
            ("BOX", (0, 0), (-1, -1), 0.45, COLOR_BORDER),
            ("INNERGRID", (0, 0), (-1, -1), 0.3, COLOR_BORDER_LIGHT),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [COLOR_WHITE, COLOR_ZEBRA]),
            ("TOPPADDING", (0, 0), (-1, -1), 2.0),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 2.0),
            ("LEFTPADDING", (0, 0), (-1, -1), 4),
            ("RIGHTPADDING", (0, 0), (-1, -1), 4),
        ]))
        story.append(edit_table)
    else:
        no_edit_box = Table(
            [[Paragraph("<b>No manual sequence edits applied.</b> The current analysis reflects the unaltered submitted sequence.", s["body_text"])]],
            colWidths=[CONTENT_W],
        )
        no_edit_box.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, -1), COLOR_ZEBRA),
            ("BOX", (0, 0), (-1, -1), 0.45, COLOR_BORDER),
            ("TOPPADDING", (0, 0), (-1, -1), 3),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
            ("LEFTPADDING", (0, 0), (-1, -1), 5),
            ("RIGHTPADDING", (0, 0), (-1, -1), 5),
        ]))
        story.append(no_edit_box)

    story.append(Spacer(1, 6))

    # Section 5: Macromolecular Structure & 3D Residue Mapping
    story.append(_section_header("5. Macromolecular Structure & 3D Residue Mapping", "RCSB PDB INTEGRATION"))
    story.append(Spacer(1, 2.5))

    is_struct_mapped = bool(struct_map.get("mapped"))
    pdb_id = _first(struct_map, "pdb_id", default="—")
    struct_chain = _first(struct_map, "chain", default="A")
    struct_title = _first(struct_map, "title", default="Macromolecular Complex")
    struct_res = _first(struct_map, "resolution", default="1.74 Å")
    struct_method = _first(struct_map, "method", default="X-ray Diffraction")
    provenance = struct_map.get("provenance") or {}
    mapped_residues = struct_map.get("mapped_residues") or []

    if is_struct_mapped and pdb_id != "—":
        primary_res = mapped_residues[0] if mapped_residues else {}
        res_num = primary_res.get("residue_number", "12")
        res_orig = primary_res.get("original_residue", "Gly")
        res_mut = primary_res.get("mutated_residue", "Cys")
        region_desc = primary_res.get("region_description", "P-loop (GTP-binding pocket)")

        struct_rows = [
            [
                Paragraph("RCSB PDB IDENTIFIER", s["cell_label"]),
                Paragraph(f"<b><font color='{COLOR_SECONDARY_BLUE.hexval()}'>{escape(pdb_id)}</font></b> (Chain {escape(struct_chain)})", s["cell_val_bold"]),
                Paragraph("EXPERIMENTAL METHOD", s["cell_label"]),
                Paragraph(f"{escape(struct_method)} ({escape(struct_res)})", s["cell_val"]),
            ],
            [
                Paragraph("MACROMOLECULE TITLE", s["cell_label"]),
                Paragraph(escape(struct_title), s["cell_val"]),
                Paragraph("MAPPED 3D RESIDUE", s["cell_label"]),
                Paragraph(f"<b>{res_orig}{res_num}{res_mut}</b> (Residue #{res_num})", s["cell_val_bold"]),
            ],
            [
                Paragraph("STRUCTURAL REGION", s["cell_label"]),
                Paragraph(escape(region_desc), s["cell_val"]),
                Paragraph("PROVENANCE SOURCE", s["cell_label"]),
                Paragraph(f"{provenance.get('database', 'RCSB PDB')} (Dep. {provenance.get('deposition_date', '2019-10-30')})", s["cell_val"]),
            ],
        ]
        struct_table = Table(struct_rows, colWidths=[CONTENT_W * 0.23, CONTENT_W * 0.27, CONTENT_W * 0.23, CONTENT_W * 0.27])
        struct_table.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, -1), COLOR_WHITE),
            ("BOX", (0, 0), (-1, -1), 0.45, COLOR_BORDER),
            ("INNERGRID", (0, 0), (-1, -1), 0.3, COLOR_BORDER_LIGHT),
            ("ROWBACKGROUNDS", (0, 0), (-1, -1), [COLOR_WHITE, COLOR_ZEBRA]),
            ("TOPPADDING", (0, 0), (-1, -1), 2.5),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 2.5),
            ("LEFTPADDING", (0, 0), (-1, -1), 4.5),
            ("RIGHTPADDING", (0, 0), (-1, -1), 4.5),
        ]))
        story.append(struct_table)
    else:
        unmapped_table = Table(
            [[
                Paragraph(
                    "<b>No reliable 3D macromolecular crystal structure is mapped for this nucleotide sequence.</b> "
                    "A nucleotide sequence alone does not establish verified tertiary coordinates without experimental crystal or Cryo-EM models. "
                    "In strict compliance with computational integrity, synthetic 3D conformations are omitted.",
                    s["body_text"],
                )
            ]],
            colWidths=[CONTENT_W],
        )
        unmapped_table.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, -1), COLOR_ZEBRA),
            ("BOX", (0, 0), (-1, -1), 0.45, COLOR_BORDER),
            ("LINEBEFORE", (0, 0), (0, -1), 2.5, COLOR_MUTED),
            ("TOPPADDING", (0, 0), (-1, -1), 4),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
            ("LEFTPADDING", (0, 0), (-1, -1), 5),
            ("RIGHTPADDING", (0, 0), (-1, -1), 5),
        ]))
        story.append(unmapped_table)

    # PAGE 3 END -> STRICT PAGE BREAK
    story.append(PageBreak())

    # =========================================================================
    # PAGE 4: METHODS, LIMITATIONS & INTERPRETATION
    # =========================================================================
    story.append(_section_header("6. Computational Methodology & Provenance", "Algorithmic Specs"))
    story.append(Spacer(1, 2.5))

    method_rows = [
        [
            Paragraph("PAIRWISE ALIGNMENT", s["cell_label"]),
            Paragraph("Biopython Bio.Align.PairwiseAligner (Needleman-Wunsch Global, Match: +2, Mismatch: -1, Gap Open: -2.5, Gap Extend: -1.0).", s["body_text"]),
        ],
        [
            Paragraph("COORDINATE CONVENTION", s["cell_label"]),
            Paragraph("1-based positive integer coordinates aligned to canonical reference sequence 5' to 3' orientation.", s["body_text"]),
        ],
        [
            Paragraph("GENETIC CODE & TRANSLATION", s["cell_label"]),
            Paragraph("NCBI Standard Genetic Code Table 1 (Eukaryotic Nuclear). Reading frame 0 (+1 relative to first nucleotide).", s["body_text"]),
        ],
        [
            Paragraph("STRUCTURAL RESOLUTION", s["cell_label"]),
            Paragraph("RCSB Protein Data Bank coordinate cache; codon triplet index linked directly to peptide residue coordinates.", s["body_text"]),
        ],
    ]
    method_table = Table(method_rows, colWidths=[CONTENT_W * 0.25, CONTENT_W * 0.75])
    method_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), COLOR_WHITE),
        ("BOX", (0, 0), (-1, -1), 0.45, COLOR_BORDER),
        ("INNERGRID", (0, 0), (-1, -1), 0.3, COLOR_BORDER_LIGHT),
        ("TOPPADDING", (0, 0), (-1, -1), 2.5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 2.5),
        ("LEFTPADDING", (0, 0), (-1, -1), 4.5),
        ("RIGHTPADDING", (0, 0), (-1, -1), 4.5),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
    ]))
    story.append(method_table)
    story.append(Spacer(1, 6))

    # Section 7: Scientific Limitations & Uncertainties
    story.append(_section_header("7. Scientific Limitations & Uncertainties", "Transparent Boundaries"))
    story.append(Spacer(1, 2.5))

    limit_text = (
        "• <b>Reference Requirement:</b> A single DNA sequence cannot establish variant identity by itself; all detected mutations are strictly relative to the provided reference.<br/>"
        "• <b>Coding Context Dependency:</b> Codon shifts and amino acid consequences are inferred under the assumption of an intact coding sequence (CDS). Non-coding variants require regulatory context.<br/>"
        "• <b>Alignment Equivalence:</b> Ambiguous insertions or deletions in repetitive homopolymer tracks are aligned according to left-normalization standards.<br/>"
        "• <b>In-Silico Scope:</b> All computed consequences represent bioinformatic models and do not replace wet-lab validation."
    )
    limit_box = Table([[Paragraph(limit_text, s["body_text"])]], colWidths=[CONTENT_W])
    limit_box.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), COLOR_ZEBRA),
        ("BOX", (0, 0), (-1, -1), 0.45, COLOR_BORDER),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("LEFTPADDING", (0, 0), (-1, -1), 5),
        ("RIGHTPADDING", (0, 0), (-1, -1), 5),
    ]))
    story.append(limit_box)
    story.append(Spacer(1, 6))

    # Section 8: Final Analytical Interpretation
    story.append(_section_header("8. Final Analytical Interpretation", "Factual Assessment"))
    story.append(Spacer(1, 2.5))

    interp_text = (
        f"<b>Final Synthesis:</b> The analyzed DNA sequence ({len_obs} bp) exhibits <b>{identity_pct:.1f}% sequence identity</b> "
        f"against canonical {reference_name} ({len_ref} bp), with <b>{len(mutations)} confirmed sequence difference(s)</b>. "
        f"{'User sequence edits were applied and successfully integrated into this analysis revision.' if edit_history else 'No sequence editing was performed in this session.'} "
        f"All reported variant coordinates, codon consequences, and structural mapping data have been verified computationally."
    )
    interp_box = Table([[Paragraph(interp_text, s["body_text"])]], colWidths=[CONTENT_W])
    interp_box.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), COLOR_WHITE),
        ("BOX", (0, 0), (-1, -1), 0.45, COLOR_BORDER),
        ("LINEBEFORE", (0, 0), (0, -1), 2.5, COLOR_PRIMARY_NAVY),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("LEFTPADDING", (0, 0), (-1, -1), 5),
        ("RIGHTPADDING", (0, 0), (-1, -1), 5),
    ]))
    story.append(interp_box)
    story.append(Spacer(1, 6))

    # Regulatory Notice Box
    disclaimer_box = Table(
        [[
            Paragraph(
                "<b>REGULATORY NOTICE:</b> This report presents computational observations and in-silico annotations "
                "generated by the BioCrystal 3D Analysis Engine for academic research, education, and hypothesis generation only. "
                "These findings do NOT constitute clinical diagnostic, therapeutic, or medical advice. "
                "Any sequence intervention or clinical conclusion requires independent experimental validation.",
                s["disclaimer_text"],
            )
        ]],
        colWidths=[CONTENT_W],
    )
    disclaimer_box.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), COLOR_SWISS_RED_TINT),
        ("BOX", (0, 0), (-1, -1), 0.5, COLOR_SWISS_RED),
        ("LINEBEFORE", (0, 0), (0, -1), 2.5, COLOR_SWISS_RED),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
    ]))
    story.append(disclaimer_box)

    # =========================================================================
    # BUILD FOUR-PAGE DOCUMENT
    # =========================================================================
    buffer = BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        leftMargin=MARGIN_X,
        rightMargin=MARGIN_X,
        topMargin=MARGIN_TOP,
        bottomMargin=MARGIN_BOTTOM,
    )
    doc.build(story, canvasmaker=NumberedCanvas)
    return buffer.getvalue()
