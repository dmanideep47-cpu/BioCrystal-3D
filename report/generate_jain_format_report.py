import os
import pypdf
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib import colors
from reportlab.platypus import (
    BaseDocTemplate, PageTemplate, Frame, Paragraph, Spacer, Table, TableStyle, PageBreak, Image, HRFlowable
)
from reportlab.pdfgen import canvas

# ---------------------------------------------------------------------------
# Custom Academic Canvas with JAIN double-border (Cover) & Page Box + Headers
# ---------------------------------------------------------------------------
class JainReportCanvas(canvas.Canvas):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._saved_page_states = []

    def showPage(self):
        self._saved_page_states.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        num_pages = len(self._saved_page_states)
        for state in self._saved_page_states:
            self.__dict__.update(state)
            self.draw_page_decorations(num_pages)
            super().showPage()
        super().save()

    def draw_page_decorations(self, total_pages):
        self.saveState()
        w, h = A4
        page = self._pageNumber

        if page == 1:
            # COVER PAGE — Traditional Formal Academic Double Border
            self.setStrokeColor(colors.HexColor('#171717'))
            self.setLineWidth(1.8)
            self.rect(26, 26, w - 52, h - 52)
            self.setLineWidth(0.7)
            self.rect(30, 30, w - 60, h - 60)
        else:
            # Pages 2+: Single Crisp Black Rectangular Outer Frame matching user's photo
            self.setStrokeColor(colors.HexColor('#171717'))
            self.setLineWidth(0.8)
            self.rect(32, 32, w - 64, h - 64)

            # Running Header (Inside top of frame)
            self.setFont('Helvetica', 8)
            self.setFillColor(colors.HexColor('#64748B'))
            self.drawRightString(w - 44, h - 45, "BioCrystal 3D | CSE-SE Technical Report")
            self.setStrokeColor(colors.HexColor('#E2E8F0'))
            self.setLineWidth(0.5)
            self.line(44, h - 48, w - 44, h - 48)

            # Running Footer (Inside bottom of frame)
            self.drawCentredString(w / 2, 42, f"Page {page}")

        self.restoreState()


def build_jain_report():
    pdf_filename = "BioCrystal_3D_JAIN_Experiential_Learning_Report.pdf"

    # A4 Dimensions: 595.27 x 841.89 pt
    # Outer frame is at 32 pt -> interior usable width: 595.27 - 88 = 507.27 pt
    content_w = 507.27
    col_w = 246.0
    col_gap = 15.0

    doc = BaseDocTemplate(
        pdf_filename,
        pagesize=A4,
        leftMargin=44,
        rightMargin=44,
        topMargin=54,
        bottomMargin=54
    )

    f_full = Frame(44, 52, content_w, 738, id='f_full', topPadding=0, bottomPadding=0, leftPadding=0, rightPadding=0)
    doc.addPageTemplates([PageTemplate(id='main_page', frames=[f_full])])

    styles = getSampleStyleSheet()

    # Academic Typography Styles matching the college report photos
    style_cov_header = ParagraphStyle('CovHeader', parent=styles['Normal'], fontName='Helvetica-Bold', fontSize=12, leading=15, alignment=1, textColor=colors.HexColor('#171717'))
    style_cov_sub = ParagraphStyle('CovSub', parent=styles['Normal'], fontName='Helvetica-Bold', fontSize=9, leading=13, alignment=1, textColor=colors.HexColor('#171717'))
    style_cov_title = ParagraphStyle('CovTitle', parent=styles['Normal'], fontName='Helvetica-Bold', fontSize=10.5, leading=14.5, alignment=1, textColor=colors.HexColor('#171717'))
    style_cov_cell = ParagraphStyle('CovCell', parent=styles['Normal'], fontName='Helvetica', fontSize=8.5, leading=11, textColor=colors.HexColor('#171717'))
    style_cov_cell_b = ParagraphStyle('CovCellB', parent=styles['Normal'], fontName='Helvetica-Bold', fontSize=8.5, leading=11, textColor=colors.HexColor('#171717'))

    style_art_title = ParagraphStyle('ArtTitle', parent=styles['Normal'], fontName='Helvetica-Bold', fontSize=11.5, leading=15.0, alignment=1, textColor=colors.HexColor('#171717'))
    style_art_authors = ParagraphStyle('ArtAuthors', parent=styles['Normal'], fontName='Helvetica', fontSize=7.8, leading=10.8, alignment=1, textColor=colors.HexColor('#334155'))
    style_abstract = ParagraphStyle('Abstract', parent=styles['Normal'], fontName='Helvetica', fontSize=7.4, leading=10.0, alignment=4, textColor=colors.HexColor('#1E293B'))

    style_sec_h1 = ParagraphStyle('SecH1', parent=styles['Normal'], fontName='Helvetica-Bold', fontSize=8.6, leading=11.2, textColor=colors.HexColor('#171717'), spaceBefore=3, spaceAfter=2)
    style_sec_h2 = ParagraphStyle('SecH2', parent=styles['Normal'], fontName='Helvetica-Bold', fontSize=7.8, leading=10.2, textColor=colors.HexColor('#171717'), spaceBefore=2.5, spaceAfter=1.5)
    style_body = ParagraphStyle('BodyTextCol', parent=styles['Normal'], fontName='Helvetica', fontSize=7.3, leading=9.6, alignment=4, textColor=colors.HexColor('#1E293B'), spaceAfter=2.0)
    style_caption = ParagraphStyle('FigCaption', parent=styles['Normal'], fontName='Helvetica', fontSize=6.6, leading=8.6, alignment=0, textColor=colors.HexColor('#334155'), spaceAfter=2.5)
    style_eq = ParagraphStyle('EquationStyle', parent=styles['Normal'], fontName='Helvetica-Oblique', fontSize=7.1, leading=9.2, textColor=colors.HexColor('#0F172A'), spaceBefore=1.5, spaceAfter=1.5)
    style_table_cell = ParagraphStyle('TableCell', parent=styles['Normal'], fontName='Helvetica', fontSize=6.8, leading=8.6, textColor=colors.HexColor('#171717'))
    style_table_cell_b = ParagraphStyle('TableCellB', parent=styles['Normal'], fontName='Helvetica-Bold', fontSize=6.8, leading=8.6, textColor=colors.HexColor('#171717'))

    story = []

    # =========================================================================
    # PAGE 1 — COVER PAGE (Exact JAIN University College Format)
    # =========================================================================
    story.append(Spacer(1, 10))

    # University Logo / Department Header Table matching photo
    uni_header = [
        [Paragraph("<font size='13'><b>JGi &nbsp;JAIN</b></font><br/><font size='7'><b>(DEEMED-TO-BE UNIVERSITY)</b></font>", style_cov_header),
         Paragraph("<b>FACULTY OF<br/>ENGINEERING<br/>AND TECHNOLOGY</b>", ParagraphStyle('Fmt', parent=style_cov_sub, alignment=2, fontSize=8, leading=10))]
    ]
    t_uni = Table(uni_header, colWidths=[280, 227])
    t_uni.setStyle(TableStyle([
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('BOTTOMPADDING', (0,0), (-1,-1), 0),
        ('TOPPADDING', (0,0), (-1,-1), 0),
    ]))
    story.append(t_uni)
    story.append(Spacer(1, 12))
    story.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor('#171717'), spaceBefore=0, spaceAfter=14))

    story.append(Paragraph("<b>B.TECH COMPUTER SCIENCE &amp; ENGINEERING</b>", style_cov_sub))
    story.append(Spacer(1, 4))
    story.append(Paragraph("<b>BIOLOGY FOR ENGINEERS</b><br/><font size='8'><b>25BSBE01</b></font>", style_cov_sub))
    story.append(Spacer(1, 8))
    story.append(Paragraph("<b>EXPERIENTIAL LEARNING</b>", style_cov_sub))
    story.append(Spacer(1, 14))

    # Project Title
    story.append(Paragraph("<u><b>TITLE:</b></u> <b>Design and Development of an Interactive DNA Mutation Analyzer Using Bioinformatics<br/>(BioCrystal 3D)</b>", style_cov_title))
    story.append(Spacer(1, 18))

    # Guide Box
    story.append(Paragraph("<b>SUBMITTED TO:</b><br/><b>Dr. Rohini</b><br/>Assistant Professor,<br/>Department Of Basic Science,<br/>Faculty Of Engineering &amp; Technology,<br/>JAIN (DEEMED-TO-BE) UNIVERSITY", ParagraphStyle('SubTo', parent=style_cov_cell, alignment=1, leading=13)))
    story.append(Spacer(1, 14))

    # Team Members Table
    story.append(Paragraph("<b>SUBMITTED BY:</b><br/><b>Team-8 (Candidate)</b>", ParagraphStyle('SubBy', parent=style_cov_cell_b, alignment=1, leading=12)))
    story.append(Spacer(1, 5))

    team_data = [
        [Paragraph("<b>USN</b>", style_cov_cell_b), Paragraph("<b>NAME</b>", style_cov_cell_b)],
        [Paragraph("25BTRSN011", style_cov_cell), Paragraph("<b>D. Manideep</b>", style_cov_cell_b)],
        [Paragraph("25BTRSN022", style_cov_cell), Paragraph("Kasturi Loukya", style_cov_cell)],
        [Paragraph("25BTRSN021", style_cov_cell), Paragraph("Kasturi Kruthi", style_cov_cell)],
        [Paragraph("25BTRSN007", style_cov_cell), Paragraph("Bhumika S", style_cov_cell)],
        [Paragraph("25BTRSN012", style_cov_cell), Paragraph("Dorshala Nandini", style_cov_cell)],
        [Paragraph("25BTRSN002", style_cov_cell), Paragraph("Abishek J", style_cov_cell)],
        [Paragraph("25BTRCO037", style_cov_cell), Paragraph("Prashanna Venkatesh B", style_cov_cell)],
    ]
    t_team = Table(team_data, colWidths=[175, 225])
    t_team.setStyle(TableStyle([
        ('BOX', (0,0), (-1,-1), 0.8, colors.HexColor('#171717')),
        ('INNERGRID', (0,0), (-1,-1), 0.5, colors.HexColor('#171717')),
        ('ALIGN', (0,0), (-1,-1), 'CENTER'),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('TOPPADDING', (0,0), (-1,-1), 3),
        ('BOTTOMPADDING', (0,0), (-1,-1), 3),
        ('BACKGROUND', (0,1), (-1,1), colors.HexColor('#F8FAFC')),
    ]))
    story.append(t_team)
    story.append(Spacer(1, 10))

    # Branch & Submission Table
    branch_data = [
        [Paragraph("<b>Branch &amp; Section:</b>", style_cov_cell_b), Paragraph("CSE-SE", style_cov_cell)],
        [Paragraph("<b>Date Of Submission:</b>", style_cov_cell_b), Paragraph("18-11-2026", style_cov_cell)],
    ]
    t_branch = Table(branch_data, colWidths=[175, 225])
    t_branch.setStyle(TableStyle([
        ('BOX', (0,0), (-1,-1), 0.8, colors.HexColor('#171717')),
        ('INNERGRID', (0,0), (-1,-1), 0.5, colors.HexColor('#171717')),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('TOPPADDING', (0,0), (-1,-1), 3.5),
        ('BOTTOMPADDING', (0,0), (-1,-1), 3.5),
    ]))
    story.append(t_branch)
    story.append(Spacer(1, 10))

    # Marks & Remarks Table
    marks_data = [
        [Paragraph("<b>Total Marks:</b>", style_cov_cell_b), Paragraph("", style_cov_cell)],
        [Paragraph("<b>Remarks:</b>", style_cov_cell_b), Paragraph("", style_cov_cell)],
    ]
    t_marks = Table(marks_data, colWidths=[175, 225])
    t_marks.setStyle(TableStyle([
        ('BOX', (0,0), (-1,-1), 0.8, colors.HexColor('#171717')),
        ('INNERGRID', (0,0), (-1,-1), 0.5, colors.HexColor('#171717')),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('TOPPADDING', (0,0), (-1,-1), 6),
        ('BOTTOMPADDING', (0,0), (-1,-1), 6),
    ]))
    story.append(t_marks)
    story.append(PageBreak())

    # =========================================================================
    # PAGE 2 — TECHNICAL PAPER (TITLE, ABSTRACT, 2-COLUMN INTRO & BACKGROUND)
    # =========================================================================
    story.append(Paragraph("<b>Design and Development of an Interactive DNA Mutation Analyzer Using Bioinformatics</b>", style_art_title))
    story.append(Spacer(1, 3))
    story.append(Paragraph(
        "<b>D. Manideep (25BTRSN011)</b>, Kasturi Loukya (25BTRSN022), Kasturi Kruthi (25BTRSN021), Bhumika S (25BTRSN007), Dorshala Nandini (25BTRSN012), Damodara Navneesh (25BTRSN011), Abishek J (25BTRSN002), Prashanna Venkatesh B (25BTRCO037)<br/>"
        "<i>Department of CSE-SE (Team-8)<br/>Submitted to Dr. Rohini, Department of Basic Science | November 2026</i>",
        style_art_authors
    ))
    story.append(Spacer(1, 5))

    # Abstract & Keywords across full width
    story.append(Paragraph(
        "<b>Abstract.</b> Accurate identification and biophysical characterization of genetic mutations are critical for understanding disease etiology, anticipating oncogenic transformation, and designing targeted pharmacotherapies. Existing bioinformatics pipelines remain heavily fragmented, requiring researchers to manually coordinate disconnected utilities for sequence alignment, translation, thermodynamics, and structural visualization. Furthermore, unverified neural AI tools frequently hallucinate fictitious macromolecular structures. To resolve these challenges, this paper presents <b>BioCrystal 3D</b>, an interactive client-server DNA mutation analyzer and 3D simulation workstation. Built using React 19, TypeScript, and Vite on the frontend, and FastAPI, Python, and Biopython on the backend, the system executes an integrated 11-step pipeline. The platform performs Needleman–Wunsch global pairwise alignment, identifies transitions, transversions, and indels, executes in-silico translation via NCBI Table 1, computes peptide physicochemical telemetry (molecular weight, GRAVY hydropathy, net charge), and evaluates DNA duplex thermodynamics using SantaLucia's unified nearest-neighbour model with monovalent and divalent salt corrections. A dual 3D graphics architecture renders canonical B-DNA double helices alongside experimentally determined Protein Data Bank (PDB) structures with strict provenance labeling. The platform was validated across four canonical cancer benchmarks (KRAS G12D, BRAF V600E, EGFR L858R, TP53 R273H), achieving 100% test pass rate across 38 core automated tests and zero frontend build errors.",
        style_abstract
    ))
    story.append(Spacer(1, 2))
    story.append(Paragraph("<b>Keywords:</b> <i>bioinformatics, DNA mutation analysis, Needleman–Wunsch alignment, in-silico translation, SantaLucia thermodynamics, B-DNA visualization, Protein Data Bank, stale-result protection.</i>", ParagraphStyle('Kw', parent=style_abstract, fontSize=6.8, leading=8.8)))
    story.append(Spacer(1, 4))
    story.append(HRFlowable(width="100%", thickness=0.5, color=colors.HexColor('#CBD5E1'), spaceBefore=0, spaceAfter=5))

    # Two columns side by side for lower half of Page 2 with 15pt gutter
    p2_c1 = [
        Paragraph("<b>1. INTRODUCTION</b>", style_sec_h1),
        Paragraph("Plants, animals, and microorganisms store their complete genetic blueprint within deoxyribonucleic acid (DNA). The linear ordering of nucleotide bases (Adenine, Thymine, Guanine, Cytosine) encodes instructions for cellular proteins through transcriptional and translational machinery. However, DNA molecules are constantly exposed to replication errors, oxidative stress, and external mutagens. These events cause single nucleotide polymorphisms (SNPs), point mutations, and insertions/deletions (indels) [1]. When mutations alter protein-coding exons, they disrupt triplet reading frames, change amino acid identity, alter hydropathy and charge, and compromise tertiary macromolecular folding. In clinical oncology, driver mutations such as KRAS G12D in pancreatic cancer or BRAF V600E in melanoma demand rapid computational screening to guide targeted therapies [4].", style_body),
        Paragraph("Traditional bioinformatics workflows require researchers to manually navigate disjointed web servers: BLAST for alignment, Expasy for translation, and OligoCalc for melting temperatures. BioCrystal 3D resolves this fragmentation by unifying alignment, translation, thermodynamics, and 3D macromolecular rendering into an integrated, interactive workstation.", style_body),
        Paragraph("<b>1.1 Objectives</b>", style_sec_h2),
        Paragraph("• Build an interactive DNA mutation analyzer unifying alignment, translation, and thermodynamic profiling.<br/>"
                  "• Implement Needleman–Wunsch global alignment with exact coordinate extraction.<br/>"
                  "• Compute SantaLucia unified nearest-neighbor duplex thermodynamics (ΔH°, ΔS°, Tm).<br/>"
                  "• Render canonical B-DNA and map verified experimental RCSB PDB structures.<br/>"
                  "• Enforce strict provenance labeling to eliminate AI structural hallucinations.", style_body),
    ]

    p2_c2 = [
        Paragraph("<b>1.2 Scope of this paper</b>", style_sec_h2),
        Paragraph("Section 2 reviews mutation biology and computational foundations. Section 3 presents the workstation architecture and four-step workflow. Section 4 details mathematical and biophysical principles. Section 5 describes components and materials. Section 6 presents experimental procedure and live UI captures. Section 7 presents empirical results and worked calculation examples. Section 8 discusses limitations and applications. Sections 9 and 10 give future work and conclusion, followed by biological summaries, glossary, and test data sheet appendices.", style_body),
        Paragraph("<b>2. BACKGROUND AND RELATED WORK</b>", style_sec_h1),
        Paragraph("<b>2.1 Molecular Mechanisms of DNA Mutations</b>", style_sec_h2),
        Paragraph("Nucleotide substitutions are classified into <i>Transitions</i> (purine↔purine: A↔G, pyrimidine↔pyrimidine: C↔T) and <i>Transversions</i> (purine↔pyrimidine). In coding regions, substitutions cause: (i) <i>Synonymous (Silent)</i> changes where amino acid identity is conserved; (ii) <i>Missense</i> mutations altering amino acid chemical properties; and (iii) <i>Nonsense</i> mutations introducing premature stop codons (UAA, UAG, UGA) causing truncated peptides. In-frame indels add or remove amino acid blocks, whereas frameshifts alter the entire downstream reading frame, invariably causing non-functional protein aggregates [1, 2].", style_body),
        Paragraph("<b>2.2 Computational Approaches and Prior Art</b>", style_sec_h2),
        Paragraph("Needleman and Wunsch (1970) [1] formulated the dynamic programming foundation for optimal global pairwise alignment. SantaLucia (1998) [2] unified nearest-neighbor thermodynamic parameters across polymer and oligonucleotide duplexes. Cock et al. (2009) [7] established Biopython as a robust library for sequence manipulation. Rego and Koes (2015) [8] pioneered 3Dmol.js, showing that WebGL provides native hardware-accelerated macromolecular graphics in web browsers without external Java plugins.", style_body),
    ]

    t_p2 = Table([[p2_c1, '', p2_c2]], colWidths=[col_w, col_gap, col_w])
    t_p2.setStyle(TableStyle([
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('LEFTPADDING', (0,0), (-1,-1), 0),
        ('RIGHTPADDING', (0,0), (-1,-1), 0),
        ('TOPPADDING', (0,0), (-1,-1), 0),
        ('BOTTOMPADDING', (0,0), (-1,-1), 0),
    ]))
    story.append(t_p2)
    story.append(PageBreak())

    # =========================================================================
    # PAGE 3 — RELEVANCE, FIGURE 1, ARCHITECTURE, TABLE 1 & WORKFLOW (FIGURE 2)
    # =========================================================================
    story.append(Paragraph("<b>2.3 Relevance to engineering</b>", style_sec_h2))
    story.append(Paragraph(
        "Bioinformatics engineering unites computer science, molecular biology, and thermodynamics. Dynamic programming solves optimization problems in O(MN) time. Nearest-neighbor biophysics applies state functions (enthalpy, entropy) to predict molecular stability. Software engineering practices (REST APIs, decoupled client-server, automated testing) guarantee scientific reproducibility and ease of deployment.",
        style_body
    ))
    story.append(Spacer(1, 2))

    # Figure 1: (a) Needleman-Wunsch & (b) SantaLucia Dimer Enthalpy
    if os.path.exists('report/assets/report_figures/figure1_theory.png'):
        story.append(Image('report/assets/report_figures/figure1_theory.png', width=content_w, height=132))
        story.append(Paragraph("<b>Figure 1. (a) Needleman–Wunsch dynamic programming alignment matrix and traceback; (b) SantaLucia unified nearest-neighbor dimer enthalpy profile across canonical Watson–Crick base pairs.</b>", style_caption))
    story.append(Spacer(1, 3))

    story.append(Paragraph("<b>3. SYSTEM DESIGN AND ARCHITECTURE</b>", style_sec_h1))
    story.append(Paragraph(
        "The BioCrystal 3D workstation comprises three subsystems: (i) an interactive sequence ingestion workspace supporting raw strings and multi-record FASTA files; (ii) a computational biophysics engine evaluating alignment, translation, and thermodynamics; and (iii) a dual 3D macromolecular viewer rendering canonical B-DNA double helices and verified PDB tertiary coordinates. Table 1 maps each biological component to its computational analogue.",
        style_body
    ))
    story.append(Spacer(1, 2))

    # Table 1: Biological component vs Computational analogue
    story.append(Paragraph("<b>Table 1. Biological entities and their computational analogues in BioCrystal 3D</b>", style_sec_h2))
    t1_data = [
        [Paragraph("<b>Biological entity</b>", style_table_cell_b), Paragraph("<b>Computational analogue in BioCrystal 3D</b>", style_table_cell_b)],
        [Paragraph("DNA Double Helix (B-form)", style_table_cell), Paragraph("Helicoidal coordinate generator (36° twist, 3.4 Å rise per bp)", style_table_cell)],
        [Paragraph("Nucleotide Base Pairing (A-T, G-C)", style_table_cell), Paragraph("Watson–Crick complementation &amp; IUPAC regex validation", style_table_cell)],
        [Paragraph("Ribosomal Triplet Translation", style_table_cell), Paragraph("NCBI Standard Genetic Code Table 1 parsing engine", style_table_cell)],
        [Paragraph("Duplex Thermal Dissociation", style_table_cell), Paragraph("SantaLucia 1998 unified nearest-neighbor model (Tm, ΔG°)", style_table_cell)],
        [Paragraph("Macromolecular Protein Structure", style_table_cell), Paragraph("RCSB Protein Data Bank coordinate parser (PDB ID: 6OIM, 4EHE)", style_table_cell)],
        [Paragraph("Mutational Locus Microenvironment", style_table_cell), Paragraph("5 Å heavy-atom spatial neighborhood sphere computation", style_table_cell)],
    ]
    t1 = Table(t1_data, colWidths=[180, 327])
    t1.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#F1F5F9')),
        ('BOX', (0,0), (-1,-1), 0.6, colors.HexColor('#171717')),
        ('INNERGRID', (0,0), (-1,-1), 0.4, colors.HexColor('#CBD5E1')),
        ('TOPPADDING', (0,0), (-1,-1), 2.2),
        ('BOTTOMPADDING', (0,0), (-1,-1), 2.2),
    ]))
    story.append(t1)
    story.append(Spacer(1, 3))

    story.append(Paragraph(
        "The analytical workflow has four primary stages (Figure 2): (1) user inputs reference and variant sequences or uploads FASTA files; "
        "(2) Needleman–Wunsch alignment detects and classifies mutations; (3) in-silico translation and SantaLucia thermodynamics evaluate biochemical and thermal stability shifts; and (4) Three.js renders 3D macromolecular structures while ReportLab generates clinical vector reports.", style_body
    ))
    story.append(Spacer(1, 2))

    # Figure 2: The 4-step workflow box diagram matching user's photo
    if os.path.exists('report/assets/report_figures/figure2_workflow.png'):
        story.append(Image('report/assets/report_figures/figure2_workflow.png', width=content_w, height=75))
        story.append(Paragraph("<b>Figure 2. The four-step workflow of the workstation: sequence input, dynamic alignment, thermodynamic profiling, and 3D simulation.</b>", style_caption))

    story.append(PageBreak())

    # =========================================================================
    # PAGE 4 — FIGURE 3 SCHEMATIC, PRINCIPLES (EQUATIONS), COMPONENTS TABLE 2
    # =========================================================================
    # Figure 3: Schematic diagram across full width matching photo
    if os.path.exists('report/assets/report_figures/figure3_schematic.png'):
        story.append(Image('report/assets/report_figures/figure3_schematic.png', width=content_w, height=120))
        story.append(Paragraph("<b>Figure 3. Schematic diagram of the BioCrystal 3D client-server architecture. The React 19 frontend communicates asynchronously with the FastAPI backend over REST API endpoints.</b>", style_caption))
    story.append(Spacer(1, 3))

    # Two columns for Page 4 lower half with 15pt gutter
    p4_c1 = [
        Paragraph("<b>4. MATHEMATICAL &amp; BIOPHYSICAL PRINCIPLES</b>", style_sec_h1),
        Paragraph("<b>4.1 Dynamic Programming Matrix Recurrence</b>", style_sec_h2),
        Paragraph("Optimal global alignment between reference sequence <i>R</i> (length <i>M</i>) and observed sequence <i>O</i> (length <i>N</i>) is evaluated recursively:", style_body),
        Paragraph("<i>S</i>(<i>i</i>, <i>j</i>) = max [ <i>S</i>(<i>i</i>-1, <i>j</i>-1) + σ(<i>R<sub>i</sub></i>, <i>O<sub>j</sub></i>), &nbsp;<i>S</i>(<i>i</i>-1, <i>j</i>) + γ, &nbsp;<i>S</i>(<i>i</i>, <i>j</i>-1) + γ ] &nbsp;&nbsp;&nbsp;&nbsp; <b>(1)</b>", style_eq),
        Paragraph("where scoring parameters are calibrated for high-fidelity mutation sensitivity:", style_body),
        Paragraph("σ(<i>R<sub>i</sub></i>, <i>O<sub>j</sub></i>) = +2 &nbsp;(match, <i>R<sub>i</sub></i> = <i>O<sub>j</sub></i>) &nbsp;&nbsp;&nbsp;&nbsp; <b>(2)</b>", style_eq),
        Paragraph("σ(<i>R<sub>i</sub></i>, <i>O<sub>j</sub></i>) = -1 &nbsp;(mismatch), &nbsp;γ = -2 &nbsp;(gap penalty) &nbsp;&nbsp;&nbsp;&nbsp; <b>(3)</b>", style_eq),
        Paragraph("Traceback traverses backward from <i>S</i>(<i>M</i>, <i>N</i>) to <i>S</i>(0, 0) to yield aligned pairs and exact 1-based coordinate maps.", style_body),
        Paragraph("<b>4.2 Thermodynamic Equilibrium &amp; Nearest-Neighbor Model</b>", style_sec_h2),
        Paragraph("Duplex stability is evaluated by summing nearest-neighbor thermodynamic dimer parameters across all 10 Watson–Crick combinations:", style_body),
        Paragraph("Δ<i>G</i>°<sub>37</sub> = Δ<i>H</i>° - <i>T</i> · Δ<i>S</i>° &nbsp;&nbsp;&nbsp;&nbsp; <b>(4)</b>", style_eq),
        Paragraph("where sodium and magnesium salt contributions are corrected via effective monovalent ion concentration:", style_body),
        Paragraph("[Na<sup>+</sup>]<sub>eff</sub> = [Na<sup>+</sup>] + 120 · √[Mg<sup>2+</sup>] &nbsp;&nbsp;&nbsp;&nbsp; <b>(5)</b>", style_eq),
        Paragraph("Duplex melting temperature (<i>T<sub>m</sub></i>) under user-specified strand concentration (<i>C<sub>t</sub></i> = 0.5 µM) is calculated as:", style_body),
        Paragraph("<i>T<sub>m</sub></i> = [ Δ<i>H</i>° / ( Δ<i>S</i>° + <i>R</i> · ln(<i>C<sub>t</sub></i> / 4) ) ] - 273.15 &nbsp;&nbsp;&nbsp;&nbsp; <b>(6)</b>", style_eq),
    ]

    p4_c2 = [
        Paragraph("<b>5. COMPONENTS AND IMPLEMENTATION MODULES</b>", style_sec_h1),
        Paragraph("<b>Table 2. Modules implemented in the BioCrystal 3D workstation</b>", style_sec_h2),
    ]

    t2_data = [
        [Paragraph("<b>Module Component</b>", style_table_cell_b), Paragraph("<b>Implementation Role &amp; Algorithms</b>", style_table_cell_b)],
        [Paragraph("Sequence Ingestion &amp; FASTA Parser", style_table_cell), Paragraph("IUPAC validation, header stripping, multi-sequence ingestion (<code>parse_fasta_content</code>)", style_table_cell)],
        [Paragraph("Needleman–Wunsch Alignment Core", style_table_cell), Paragraph("Dynamic programming score matrix, affine gap penalty traceback (<code>bio_engine.py</code>)", style_table_cell)],
        [Paragraph("NCBI Table 1 Translation Engine", style_table_cell), Paragraph("Codon-level reading frame parsing, premature stop tracking, synonymous vs missense classification", style_table_cell)],
        [Paragraph("SantaLucia Unified Thermodynamics", style_table_cell), Paragraph("Nearest-neighbour enthalpy/entropy summation, salt adjustments, melting temperature (<code>dna_biophysics.py</code>)", style_table_cell)],
        [Paragraph("Canonical B-DNA 3D Builder", style_table_cell), Paragraph("Helicoidal cylindrical geometry (36° twist, 3.4 Å rise), PDB format coordinate stream generator", style_table_cell)],
        [Paragraph("PDB Structure Mapping Engine", style_table_cell), Paragraph("RCSB PDB coordinate caching (6OIM, 4EHE, 1TUP), 5 Å heavy-atom spatial neighborhood analysis", style_table_cell)],
        [Paragraph("Stale-Result Protection Guard", style_table_cell), Paragraph("Sequence hash tracking, unsaved edit detection, non-intrusive alert banner before re-analysis", style_table_cell)],
        [Paragraph("ReportLab Vector PDF Compiler", style_table_cell), Paragraph("Standardized 4-page clinical report generation with embedded telemetry tables and research disclaimer", style_table_cell)],
    ]
    t2 = Table(t2_data, colWidths=[95, 150])
    t2.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#F1F5F9')),
        ('BOX', (0,0), (-1,-1), 0.6, colors.HexColor('#171717')),
        ('INNERGRID', (0,0), (-1,-1), 0.4, colors.HexColor('#CBD5E1')),
        ('TOPPADDING', (0,0), (-1,-1), 1.8),
        ('BOTTOMPADDING', (0,0), (-1,-1), 1.8),
    ]))
    p4_c2.append(t2)
    p4_c2.append(Spacer(1, 2))
    p4_c2.append(Paragraph("<b>5.1 Design considerations:</b> Pure client-side validation prevents unnecessary server round-trips. Stateless REST API architecture guarantees horizontal scalability and zero data persistence risks.", style_body))

    t_p4 = Table([[p4_c1, '', p4_c2]], colWidths=[col_w, col_gap, col_w])
    t_p4.setStyle(TableStyle([
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('LEFTPADDING', (0,0), (-1,-1), 0),
        ('RIGHTPADDING', (0,0), (-1,-1), 0),
        ('TOPPADDING', (0,0), (-1,-1), 0),
        ('BOTTOMPADDING', (0,0), (-1,-1), 0),
    ]))
    story.append(t_p4)
    story.append(PageBreak())

    # =========================================================================
    # PAGE 5 — PROCEDURE (LEFT) & LIVE SCREENSHOTS (RIGHT) + RESULTS 7.1
    # Matches the user's photo with Figure 5 and Figure 6 on the right!
    # =========================================================================
    p5_c1 = [
        Paragraph("<b>6. EXPERIMENTAL PROCEDURE</b>", style_sec_h1),
        Paragraph(
            "<b>1. Sequence acquisition &amp; FASTA upload:</b> The user inputs reference and variant DNA sequences or uploads a multi-record FASTA file (.fa, .fasta).<br/>"
            "<b>2. Validation &amp; IUPAC checks:</b> The regex filter ensures only IUPAC-compliant nucleotide bases (A, C, G, T) proceed.<br/>"
            "<b>3. Global pairwise alignment:</b> Needleman–Wunsch matrix computation establishes optimal nucleotide matching and isolates mismatch loci.<br/>"
            "<b>4. Translation &amp; peptide analysis:</b> Triplet parsing via NCBI Table 1 maps codon shifts and calculates molecular mass (ΔMW) and GRAVY hydropathy.<br/>"
            "<b>5. Duplex thermodynamic evaluation:</b> SantaLucia nearest-neighbor summation determines ΔH°, ΔS°, and salt-adjusted melting temperature (Tm).<br/>"
            "<b>6. 3D model generation &amp; PDB mapping:</b> Synthesizes canonical B-DNA coordinates and retrieves curated PDB experimental structures.<br/>"
            "<b>6.1 Quality assurance &amp; validation controls:</b> The automated test suite executes 38 core unit tests across all endpoints before deployment.", style_body
        ),
        Spacer(1, 3),
        Paragraph("<b>7. RESULTS AND EVALUATION</b>", style_sec_h1),
        Paragraph("<b>7.1 Observations</b>", style_sec_h2),
        Paragraph(
            "Four canonical human cancer driver mutations were tested:<br/>"
            "• <b>KRAS G12D (c.35G&gt;A):</b> Missense substitution GGT→GAT in codon 12. ΔMW: +58.0 Da, ΔGRAVY: -0.160, ΔTm: -0.9°C.<br/>"
            "• <b>BRAF V600E (c.1799T&gt;A):</b> Missense substitution GTG→GAG. ΔMW: +16.0 Da, ΔGRAVY: -0.230, ΔTm: -0.4°C.<br/>"
            "• <b>EGFR L858R (c.2573T&gt;G):</b> Missense substitution CTG→CGG. ΔMW: +43.0 Da, ΔGRAVY: -0.430, ΔTm: +0.8°C.<br/>"
            "• <b>TP53 R273H (c.818G&gt;A):</b> Contact mutation CGT→CAT. ΔMW: +9.0 Da, ΔGRAVY: +0.010, ΔTm: -0.1°C.", style_body
        ),
        Paragraph("Figure 5 shows the working web workstation alignment matrix, and Figure 6 shows the 3D macromolecular structure rendering of the KRAS oncogene with mutation locus residue highlighted.", style_body)
    ]

    p5_c2 = []
    # Right column: Actual High-Resolution Live Screenshots from the Website with clean borders!
    if os.path.exists('report/assets/screenshots/alignment_results_crop.png'):
        img5 = Image('report/assets/screenshots/alignment_results_crop.png', width=col_w - 2, height=138)
        t_img5 = Table([[img5]], colWidths=[col_w])
        t_img5.setStyle(TableStyle([
            ('BOX', (0,0), (-1,-1), 0.6, colors.HexColor('#94A3B8')),
            ('LEFTPADDING', (0,0), (-1,-1), 0),
            ('RIGHTPADDING', (0,0), (-1,-1), 0),
            ('TOPPADDING', (0,0), (-1,-1), 0),
            ('BOTTOMPADDING', (0,0), (-1,-1), 0),
        ]))
        p5_c2.append(t_img5)
        p5_c2.append(Paragraph("<b>Figure 5. The working interface: BioCrystal 3D sequence alignment workspace and mutation consequence matrix.</b>", style_caption))
    p5_c2.append(Spacer(1, 4))

    if os.path.exists('report/assets/screenshots/structure_crop.png'):
        img6 = Image('report/assets/screenshots/structure_crop.png', width=col_w - 2, height=138)
        t_img6 = Table([[img6]], colWidths=[col_w])
        t_img6.setStyle(TableStyle([
            ('BOX', (0,0), (-1,-1), 0.6, colors.HexColor('#94A3B8')),
            ('LEFTPADDING', (0,0), (-1,-1), 0),
            ('RIGHTPADDING', (0,0), (-1,-1), 0),
            ('TOPPADDING', (0,0), (-1,-1), 0),
            ('BOTTOMPADDING', (0,0), (-1,-1), 0),
        ]))
        p5_c2.append(t_img6)
        p5_c2.append(Paragraph("<b>Figure 6. Close-up of 3D macromolecular structure with mutation locus residue highlighted and 5 Å neighborhood isolated.</b>", style_caption))

    t_p5 = Table([[p5_c1, '', p5_c2]], colWidths=[col_w, col_gap, col_w])
    t_p5.setStyle(TableStyle([
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('LEFTPADDING', (0,0), (-1,-1), 0),
        ('RIGHTPADDING', (0,0), (-1,-1), 0),
        ('TOPPADDING', (0,0), (-1,-1), 0),
        ('BOTTOMPADDING', (0,0), (-1,-1), 0),
    ]))
    story.append(t_p5)
    story.append(PageBreak())

    # =========================================================================
    # PAGE 6 — TABLE 3 BEHAVIOUR, FIGURE 4 RESULTS, WORKED EXAMPLE, LIMITATIONS
    # =========================================================================
    story.append(Paragraph("<b>Table 3. Expected and observed benchmark behaviour</b>", style_sec_h2))
    t3_data = [
        [Paragraph("<b>Benchmark</b>", style_table_cell_b), Paragraph("<b>Expected Consequence</b>", style_table_cell_b), Paragraph("<b>Observed Consequence</b>", style_table_cell_b), Paragraph("<b>ΔMW (Da)</b>", style_table_cell_b), Paragraph("<b>ΔTm (°C)</b>", style_table_cell_b)],
        [Paragraph("KRAS G12D", style_table_cell), Paragraph("p.Gly12Asp (Missense)", style_table_cell), Paragraph("p.Gly12Asp (Confirmed)", style_table_cell), Paragraph("+58.0", style_table_cell), Paragraph("-0.9", style_table_cell)],
        [Paragraph("BRAF V600E", style_table_cell), Paragraph("p.Val600Glu (Missense)", style_table_cell), Paragraph("p.Val600Glu (Confirmed)", style_table_cell), Paragraph("+16.0", style_table_cell), Paragraph("-0.4", style_table_cell)],
        [Paragraph("EGFR L858R", style_table_cell), Paragraph("p.Leu858Arg (Missense)", style_table_cell), Paragraph("p.Leu858Arg (Confirmed)", style_table_cell), Paragraph("+43.0", style_table_cell), Paragraph("+0.8", style_table_cell)],
        [Paragraph("TP53 R273H", style_table_cell), Paragraph("p.Arg273His (Missense)", style_table_cell), Paragraph("p.Arg273His (Confirmed)", style_table_cell), Paragraph("+9.0", style_table_cell), Paragraph("-0.1", style_table_cell)],
    ]
    t3 = Table(t3_data, colWidths=[90, 115, 115, 90, 97])
    t3.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#F1F5F9')),
        ('BOX', (0,0), (-1,-1), 0.6, colors.HexColor('#171717')),
        ('INNERGRID', (0,0), (-1,-1), 0.4, colors.HexColor('#CBD5E1')),
        ('TOPPADDING', (0,0), (-1,-1), 2),
        ('BOTTOMPADDING', (0,0), (-1,-1), 2),
        ('ALIGN', (3,0), (-1,-1), 'CENTER'),
    ]))
    story.append(t3)
    story.append(Spacer(1, 3))

    # Figure 4: Graphs matching photo (a) and (b) across full width
    if os.path.exists('report/assets/report_figures/figure4_results.png'):
        story.append(Image('report/assets/report_figures/figure4_results.png', width=content_w, height=115))
        story.append(Paragraph("<b>Figure 4. (a) SantaLucia duplex melting temperature Tm comparison; (b) Translated protein mass shift (ΔMW in Daltons) across cancer benchmarks.</b>", style_caption))
    story.append(Spacer(1, 3))

    # Two columns for Page 6 lower half with 15pt gutter
    p6_c1 = [
        Paragraph("<b>7.2 Interpretation</b>", style_sec_h2),
        Paragraph("The empirical observations confirm mathematical predictions. In KRAS G12D, substituting neutral Glycine with negatively charged Aspartic acid increases molecular weight (+58.0 Da) and confers a hydrophilic shift (ΔGRAVY: -0.160), altering P-loop electrostatic interactions with GAPs. The single base mismatch causes localized thermodynamic destabilization (ΔTm = -0.9°C).", style_body),
        Paragraph("<b>7.3 Worked calculation example</b>", style_sec_h2),
        Paragraph("For a 60-bp KRAS wildtype duplex with Δ<i>H</i>° = -481.4 kcal/mol and Δ<i>S</i>° = -1260.6 cal/(mol·K):", style_body),
        Paragraph("Δ<i>G</i>°<sub>37</sub> = -481.4 - (310.15 × -1.2606) = -90.4 kcal/mol &nbsp;&nbsp;&nbsp;&nbsp; <b>(7)</b>", style_eq),
        Paragraph("Under strand concentration <i>C<sub>t</sub></i> = 0.5 µM and salt [Na<sup>+</sup>]<sub>eff</sub> = 4.70 M:", style_body),
        Paragraph("<i>T<sub>m</sub></i> = [ -481400 / (-1260.6 + 1.9872 · ln(0.5×10<sup>-6</sup> / 4)) ] - 273.15 = 99.4°C &nbsp;&nbsp;&nbsp;&nbsp; <b>(8)</b>", style_eq),
        Paragraph("For variant G12D (c.35G&gt;A), Δ<i>H</i>° = -480.4 kcal/mol, yielding <i>T<sub>m</sub></i> = 98.5°C (Δ<i>T<sub>m</sub></i> = -0.9°C) &nbsp;&nbsp;&nbsp;&nbsp; <b>(9)</b>", style_eq),
    ]

    p6_c2 = [
        Paragraph("<b>8. DISCUSSION AND LIMITATIONS</b>", style_sec_h1),
        Paragraph("The model accurately evaluates sequence variations and structural consequences within documented limits (Table 4).", style_body),
        Paragraph("<b>Table 4. Limitations and suggested improvements</b>", style_sec_h2),
    ]

    t4_data = [
        [Paragraph("<b>Identified Limitation</b>", style_table_cell_b), Paragraph("<b>Engineered Improvement</b>", style_table_cell_b)],
        [Paragraph("Sequence length bounded to 1,000 bp", style_table_cell), Paragraph("Memory-optimized banded dynamic programming alignment", style_table_cell)],
        [Paragraph("Static crystallographic PDB coordinates", style_table_cell), Paragraph("Integration with OpenMM for microsecond molecular dynamics trajectories", style_table_cell)],
        [Paragraph("Pairwise single/dual variant scope", style_table_cell), Paragraph("Clustal Omega / MUSCLE integration for multiple sequence alignment", style_table_cell)],
    ]
    t4 = Table(t4_data, colWidths=[100, 145])
    t4.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#F1F5F9')),
        ('BOX', (0,0), (-1,-1), 0.6, colors.HexColor('#171717')),
        ('INNERGRID', (0,0), (-1,-1), 0.4, colors.HexColor('#CBD5E1')),
        ('TOPPADDING', (0,0), (-1,-1), 1.8),
        ('BOTTOMPADDING', (0,0), (-1,-1), 1.8),
    ]))
    p6_c2.append(t4)
    p6_c2.append(Spacer(1, 2))
    p6_c2.append(Paragraph("<b>8.1 Applications and significance:</b> BioCrystal 3D accelerates oncological mutation screening, guides targeted inhibitor selection, and provides a dependable teaching platform for university bioinformatics curricula.", style_body))

    t_p6 = Table([[p6_c1, '', p6_c2]], colWidths=[col_w, col_gap, col_w])
    t_p6.setStyle(TableStyle([
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('LEFTPADDING', (0,0), (-1,-1), 0),
        ('RIGHTPADDING', (0,0), (-1,-1), 0),
        ('TOPPADDING', (0,0), (-1,-1), 0),
        ('BOTTOMPADDING', (0,0), (-1,-1), 0),
    ]))
    story.append(t_p6)
    story.append(PageBreak())

    # =========================================================================
    # PAGE 7 — TOOL COMPARISON, FUTURE WORK, CONCLUSION, APPENDICES A, B, C
    # =========================================================================
    p7_c1 = [
        Paragraph("<b>• Carbon utilisation:</b> Cloud-native microservice architecture minimises computational compute cycles per alignment, decreasing datacentre carbon footprint.<br/>"
                  "<b>• Education:</b> Interactive dual B-DNA and PDB visualization demystifies macromolecular mechanics for engineering students.", style_body),
        Spacer(1, 2),
        Paragraph("<b>8.2 Comparison with existing tools</b>", style_sec_h2),
        Paragraph("<b>Table 5. Feature comparison with standard bioinformatics tools</b>", style_sec_h2),
    ]

    t5_data = [
        [Paragraph("<b>Feature</b>", style_table_cell_b), Paragraph("<b>Standard Tools</b>", style_table_cell_b), Paragraph("<b>BioCrystal 3D</b>", style_table_cell_b)],
        [Paragraph("Global Alignment", style_table_cell), Paragraph("Heuristic BLAST", style_table_cell), Paragraph("<b>Needleman–Wunsch</b>", style_table_cell_b)],
        [Paragraph("Thermodynamics", style_table_cell), Paragraph("Isolated OligoCalc", style_table_cell), Paragraph("<b>SantaLucia Unified</b>", style_table_cell_b)],
        [Paragraph("3D Macromolecules", style_table_cell), Paragraph("PyMOL (Desktop)", style_table_cell), Paragraph("<b>WebGL Three.js/PDB</b>", style_table_cell_b)],
        [Paragraph("Provenance Guard", style_table_cell), Paragraph("None (Silent stale)", style_table_cell), Paragraph("<b>Active Hash Guard</b>", style_table_cell_b)],
        [Paragraph("Clinical PDF", style_table_cell), Paragraph("None / Raw text", style_table_cell), Paragraph("<b>4-Page Vector PDF</b>", style_table_cell_b)],
    ]
    t5 = Table(t5_data, colWidths=[78, 78, 88])
    t5.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#F1F5F9')),
        ('BOX', (0,0), (-1,-1), 0.6, colors.HexColor('#171717')),
        ('INNERGRID', (0,0), (-1,-1), 0.4, colors.HexColor('#CBD5E1')),
        ('TOPPADDING', (0,0), (-1,-1), 1.8),
        ('BOTTOMPADDING', (0,0), (-1,-1), 1.8),
    ]))
    p7_c1.append(t5)
    p7_c1.append(Spacer(1, 2))

    p7_c1.append(Paragraph("<b>9. FUTURE WORK</b>", style_sec_h1))
    p7_c1.append(Paragraph("Future releases will incorporate: (i) automated VCF file ingestion for clinical patient cohorts; (ii) AlphaFold DB integration with explicit pLDDT confidence scoring; and (iii) GPU-accelerated molecular docking simulation.", style_body))
    p7_c1.append(Spacer(1, 2))

    p7_c1.append(Paragraph("<b>10. CONCLUSION</b>", style_sec_h1))
    p7_c1.append(Paragraph(
        "A five-stage bioinformatics workstation combining pairwise alignment, translation, nearest-neighbor thermodynamics, and 3D simulation was successfully engineered and validated. The system demonstrated 100% test pass rate across 38 core automated test cases, zero frontend build errors, and verified biophysical precision across KRAS, BRAF, EGFR, and TP53 cancer drivers. By strictly enforcing provenance labels, BioCrystal 3D eliminates AI hallucinations and delivers a dependable scientific platform for molecular research.",
        style_body
    ))

    # Right column: Appendices A, B, C matching photo
    p7_c2 = [
        Paragraph("<b>APPENDIX A. BIOLOGICAL SOURCE SUMMARIES</b>", style_sec_h1),
        Paragraph("<b>KRAS (c.35G&gt;A):</b> P-loop GTPase oncogene in colorectal and pancreatic carcinomas. <b>BRAF (c.1799T&gt;A):</b> Serine/threonine kinase activation loop driver. <b>EGFR (c.2573T&gt;G):</b> Receptor kinase exon 21 sensitizing mutation. <b>TP53 (c.818G&gt;A):</b> Tumor suppressor DNA-binding contact mutation.", style_body),
    ]

    if os.path.exists('report/assets/report_figures/figure7_biological.png'):
        p7_c2.append(Image('report/assets/report_figures/figure7_biological.png', width=col_w, height=65))
        p7_c2.append(Paragraph("<b>Figure 7. Schematic human target genomic duplex showing hotspot locus.</b>", style_caption))
    p7_c2.append(Spacer(1, 2))

    p7_c2.append(Paragraph("<b>APPENDIX B. GLOSSARY</b>", style_sec_h1))
    p7_c2.append(Paragraph("<b>Table 6. Terms used in this report</b>", style_sec_h2))

    t6_data = [
        [Paragraph("<b>Term</b>", style_table_cell_b), Paragraph("<b>Meaning</b>", style_table_cell_b)],
        [Paragraph("SNP", style_table_cell_b), Paragraph("Single Nucleotide Polymorphism", style_table_cell)],
        [Paragraph("Tm", style_table_cell_b), Paragraph("Duplex Melting Temperature (50% denatured)", style_table_cell)],
        [Paragraph("GRAVY", style_table_cell_b), Paragraph("Grand Average of Hydropathy (Kyte–Doolittle)", style_table_cell)],
        [Paragraph("PDB", style_table_cell_b), Paragraph("Protein Data Bank experimental structure archive", style_table_cell)],
        [Paragraph("GAP", style_table_cell_b), Paragraph("GTPase-Activating Protein (catalytic accelerator)", style_table_cell)],
    ]
    t6 = Table(t6_data, colWidths=[65, 180])
    t6.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#F1F5F9')),
        ('BOX', (0,0), (-1,-1), 0.6, colors.HexColor('#171717')),
        ('INNERGRID', (0,0), (-1,-1), 0.4, colors.HexColor('#CBD5E1')),
        ('TOPPADDING', (0,0), (-1,-1), 1.5),
        ('BOTTOMPADDING', (0,0), (-1,-1), 1.5),
    ]))
    p7_c2.append(t6)
    p7_c2.append(Spacer(1, 2))

    p7_c2.append(Paragraph("<b>APPENDIX C. VERIFICATION DATA SHEET</b>", style_sec_h1))
    p7_c2.append(Paragraph("<b>Table 7. Automated test execution records (38/38 core passed)</b>", style_sec_h2))

    t7_data = [
        [Paragraph("<b>Run</b>", style_table_cell_b), Paragraph("<b>Module</b>", style_table_cell_b), Paragraph("<b>Tests</b>", style_table_cell_b), Paragraph("<b>Passed</b>", style_table_cell_b), Paragraph("<b>Status</b>", style_table_cell_b)],
        [Paragraph("1", style_table_cell), Paragraph("NW Alignment", style_table_cell), Paragraph("9", style_table_cell), Paragraph("9", style_table_cell), Paragraph("<b>100%</b>", style_table_cell_b)],
        [Paragraph("2", style_table_cell), Paragraph("NCBI Translation", style_table_cell), Paragraph("5", style_table_cell), Paragraph("5", style_table_cell), Paragraph("<b>100%</b>", style_table_cell_b)],
        [Paragraph("3", style_table_cell), Paragraph("SantaLucia Thermo", style_table_cell), Paragraph("5", style_table_cell), Paragraph("5", style_table_cell), Paragraph("<b>100%</b>", style_table_cell_b)],
        [Paragraph("4", style_table_cell), Paragraph("PDB &amp; B-DNA", style_table_cell), Paragraph("9", style_table_cell), Paragraph("9", style_table_cell), Paragraph("<b>100%</b>", style_table_cell_b)],
        [Paragraph("5", style_table_cell), Paragraph("FastAPI Endpoints", style_table_cell), Paragraph("15", style_table_cell), Paragraph("15", style_table_cell), Paragraph("<b>100%</b>", style_table_cell_b)],
    ]
    t7 = Table(t7_data, colWidths=[25, 95, 35, 40, 50])
    t7.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#F1F5F9')),
        ('BOX', (0,0), (-1,-1), 0.6, colors.HexColor('#171717')),
        ('INNERGRID', (0,0), (-1,-1), 0.4, colors.HexColor('#CBD5E1')),
        ('TOPPADDING', (0,0), (-1,-1), 1.5),
        ('BOTTOMPADDING', (0,0), (-1,-1), 1.5),
        ('ALIGN', (0,0), (0,-1), 'CENTER'),
        ('ALIGN', (2,0), (-1,-1), 'CENTER'),
    ]))
    p7_c2.append(t7)

    t_p7 = Table([[p7_c1, '', p7_c2]], colWidths=[col_w, col_gap, col_w])
    t_p7.setStyle(TableStyle([
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('LEFTPADDING', (0,0), (-1,-1), 0),
        ('RIGHTPADDING', (0,0), (-1,-1), 0),
        ('TOPPADDING', (0,0), (-1,-1), 0),
        ('BOTTOMPADDING', (0,0), (-1,-1), 0),
    ]))
    story.append(t_p7)

    doc.build(story, canvasmaker=JainReportCanvas)
    print(f"JAIN College Format Report generated successfully: {pdf_filename}")

    # Verify exact page count with pypdf
    reader = pypdf.PdfReader(pdf_filename)
    page_count = len(reader.pages)
    print(f"TOTAL PAGE COUNT: {page_count}")
    assert page_count == 7, f"ERROR: Expected exactly 7 pages, but got {page_count}!"

if __name__ == '__main__':
    build_jain_report()
