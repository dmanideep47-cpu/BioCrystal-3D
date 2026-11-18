import os, sys
import pypdf
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib import colors
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak, Image, HRFlowable, KeepTogether
)
from reportlab.pdfgen import canvas

# ----------------------------------------------------------------------
# Numbered Canvas for Running Headers and "Page X of 14" Footers
# ----------------------------------------------------------------------
class NumberedCanvas(canvas.Canvas):
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
        page = self._pageNumber
        if page == 1:
            return  # Suppress headers/footers on Cover Page

        self.saveState()
        self.setFont('Helvetica', 8)
        self.setFillColor(colors.HexColor('#64748B'))

        # Running Header
        self.drawString(45, 808, "BIOCRYSTAL 3D: EXPERIENTIAL LEARNING PROJECT REPORT")
        self.drawRightString(A4[0] - 45, 808, "CANDIDATE: D. MANIDEEP")
        self.setStrokeColor(colors.HexColor('#E2E8F0'))
        self.setLineWidth(0.6)
        self.line(45, 802, A4[0] - 45, 802)

        # Running Footer
        self.line(45, 38, A4[0] - 45, 38)
        self.drawString(45, 26, "Department of Computer Science & Engineering | Bioinformatics & Molecular Simulation")
        self.drawRightString(A4[0] - 45, 26, f"Page {page} of {total_pages}")
        self.restoreState()

def build_pdf_report():
    pdf_filename = "BioCrystal_3D_Experiential_Learning_Report.pdf"
    doc = SimpleDocTemplate(
        pdf_filename,
        pagesize=A4,
        leftMargin=45,
        rightMargin=45,
        topMargin=46,
        bottomMargin=46
    )

    styles = getSampleStyleSheet()

    # Base typography styles
    TEAL = colors.HexColor('#0F766E')
    TEAL_DARK = colors.HexColor('#115E59')
    TEXT_DARK = colors.HexColor('#171717')
    TEXT_MUTED = colors.HexColor('#475569')
    BG_LIGHT = colors.HexColor('#F8FAFC')
    BORDER_LIGHT = colors.HexColor('#E2E8F0')

    style_cover_dept = ParagraphStyle(
        'CoverDept',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=12,
        leading=16,
        alignment=1,
        textColor=TEXT_DARK
    )
    style_cover_sub = ParagraphStyle(
        'CoverSub',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=10,
        leading=14,
        alignment=1,
        textColor=TEAL
    )
    style_cover_title = ParagraphStyle(
        'CoverTitle',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=15,
        leading=20,
        alignment=1,
        textColor=TEXT_DARK
    )
    style_cover_prod = ParagraphStyle(
        'CoverProd',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=10,
        leading=14,
        alignment=1,
        textColor=TEAL_DARK
    )
    style_h1 = ParagraphStyle(
        'H1',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=12,
        leading=15,
        textColor=TEXT_DARK,
        spaceAfter=4
    )
    style_h2 = ParagraphStyle(
        'H2',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=9.5,
        leading=13,
        textColor=TEAL_DARK,
        spaceBefore=3,
        spaceAfter=2
    )
    style_body = ParagraphStyle(
        'Body',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=8.2,
        leading=11.2,
        textColor=TEXT_DARK,
        spaceAfter=3,
        alignment=4 # Justified
    )
    style_body_bold = ParagraphStyle(
        'BodyBold',
        parent=style_body,
        fontName='Helvetica-Bold'
    )
    style_caption = ParagraphStyle(
        'Caption',
        parent=styles['Normal'],
        fontName='Helvetica-Oblique',
        fontSize=7.6,
        leading=10,
        alignment=1,
        textColor=TEXT_MUTED,
        spaceAfter=3
    )
    style_ph = ParagraphStyle(
        'Placeholder',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=7.8,
        leading=10.5,
        alignment=1,
        textColor=TEAL
    )

    story = []

    def make_ph_box(fig_num, label, height=44):
        txt = f"<b>{fig_num}: {label}</b><br/><font color='#64748B' size='6.5'>[Empirical Application Capture / High-Resolution Rendering Placeholder]</font>"
        p = Paragraph(txt, style_ph)
        t = Table([[p]], colWidths=[505], rowHeights=[height])
        t.setStyle(TableStyle([
            ('BACKGROUND', (0,0), (-1,-1), colors.HexColor('#F8FAFC')),
            ('BOX', (0,0), (-1,-1), 0.8, colors.HexColor('#CBD5E1')),
            ('ALIGN', (0,0), (-1,-1), 'CENTER'),
            ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
            ('BOTTOMPADDING', (0,0), (-1,-1), 2),
            ('TOPPADDING', (0,0), (-1,-1), 2),
        ]))
        return t

    # =========================================================================
    # PAGE 1 — COVER PAGE
    # =========================================================================
    story.append(Spacer(1, 10))
    story.append(Paragraph("[COLLEGE / UNIVERSITY NAME PLACEHOLDER]", style_cover_dept))
    story.append(Paragraph("DEPARTMENT OF COMPUTER SCIENCE &amp; ENGINEERING", style_cover_sub))
    story.append(Paragraph("EXPERIENTIAL LEARNING PROJECT REPORT (ACADEMIC YEAR: 2025 – 2026)", style_caption))
    story.append(Spacer(1, 10))

    if os.path.exists('report/assets/cover_banner.png'):
        story.append(Image('report/assets/cover_banner.png', width=505, height=110))
    else:
        story.append(Spacer(1, 110))

    story.append(Spacer(1, 16))
    story.append(Paragraph("DESIGN AND DEVELOPMENT OF AN INTERACTIVE DNA MUTATION ANALYZER USING BIOINFORMATICS", style_cover_title))
    story.append(Spacer(1, 4))
    story.append(Paragraph("BioCrystal 3D — Intelligent DNA Mutation Analysis, In-Silico Translation &amp; 3D Macromolecular Simulation Workstation", style_cover_prod))
    story.append(Spacer(1, 18))

    meta_data = [
        [Paragraph("<b>Student Name:</b>", style_body), Paragraph("<b>D. MANIDEEP</b>", style_body_bold)],
        [Paragraph("<b>Register / Roll Number:</b>", style_body), Paragraph("[Student Register / Roll Number Placeholder]", style_body)],
        [Paragraph("<b>Project Domain:</b>", style_body), Paragraph("Bioinformatics, Computational Biology, Molecular Visualization, Data Analysis", style_body)],
        [Paragraph("<b>Faculty Supervisor / Guide:</b>", style_body), Paragraph("[Internal Guide / Faculty Supervisor Name Placeholder]", style_body)],
        [Paragraph("<b>Degree &amp; Program:</b>", style_body), Paragraph("Bachelor of Technology (B.Tech) — Computer Science &amp; Engineering", style_body)],
        [Paragraph("<b>Curriculum Component:</b>", style_body), Paragraph("Experiential Learning Project (Core Capstone Requirement)", style_body)],
        [Paragraph("<b>Institutional Department:</b>", style_body), Paragraph("Department of Computer Science and Engineering", style_body)],
        [Paragraph("<b>Date of Submission:</b>", style_body), Paragraph("November 2026", style_body)],
    ]
    t_meta = Table(meta_data, colWidths=[165, 330])
    t_meta.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), colors.HexColor('#F8FAFC')),
        ('BOX', (0,0), (-1,-1), 1, BORDER_LIGHT),
        ('INNERGRID', (0,0), (-1,-1), 0.5, BORDER_LIGHT),
        ('TOPPADDING', (0,0), (-1,-1), 4.5),
        ('BOTTOMPADDING', (0,0), (-1,-1), 4.5),
        ('LEFTPADDING', (0,0), (-1,-1), 10),
        ('RIGHTPADDING', (0,0), (-1,-1), 10),
    ]))
    story.append(t_meta)
    story.append(Spacer(1, 25))
    story.append(Paragraph("<font color='#64748B' size='7.5'><i>Figure 1: BioCrystal 3D Workstation — Dedicated to Scientific Rigor, Empirical Grounding and Reproducible Bioinformatics</i></font>", style_caption))
    story.append(PageBreak())

    # =========================================================================
    # PAGE 2 — CERTIFICATE, DECLARATION AND ACKNOWLEDGEMENT
    # =========================================================================
    story.append(Paragraph("BONA FIDE CERTIFICATE", style_h1))
    story.append(HRFlowable(width="100%", thickness=1, color=TEAL, spaceBefore=1, spaceAfter=5))
    cert_text = (
        "This is to certify that this Experiential Learning Project Report entitled "
        "<b>“Design and Development of an Interactive DNA Mutation Analyzer Using Bioinformatics”</b> "
        "is a bona fide record of independent research and engineering work carried out by "
        "<b>D. MANIDEEP</b> (Register No: <b>[Register Number Placeholder]</b>) in partial fulfillment of the requirements "
        "for the award of Bachelor of Technology in Computer Science &amp; Engineering at "
        "<b>[College / University Name Placeholder]</b> during the academic year 2025–2026. "
        "The project demonstrates rigorous implementation of Needleman–Wunsch alignment, NCBI Table 1 translation, "
        "SantaLucia nearest-neighbour thermodynamics, and dual 3D macromolecular visualization without reliance on ungrounded AI predictions."
    )
    story.append(Paragraph(cert_text, style_body))
    story.append(Spacer(1, 16))

    sig_data = [
        [Paragraph("<b>Internal Guide / Supervisor</b><br/><font color='#64748B'>Signature &amp; Date</font>", style_body),
         Paragraph("<b>Head of the Department</b><br/><font color='#64748B'>Department of CSE</font>", style_body),
         Paragraph("<b>External Examiner</b><br/><font color='#64748B'>Board of Evaluation</font>", style_body)]
    ]
    t_sig = Table(sig_data, colWidths=[165, 170, 170])
    t_sig.setStyle(TableStyle([
        ('LINEBEFORE', (1,0), (-1,-1), 0.5, BORDER_LIGHT),
        ('TOPPADDING', (0,0), (-1,-1), 2),
        ('BOTTOMPADDING', (0,0), (-1,-1), 2),
    ]))
    story.append(t_sig)
    story.append(Spacer(1, 12))

    story.append(Paragraph("CANDIDATE DECLARATION", style_h1))
    story.append(HRFlowable(width="100%", thickness=1, color=TEAL, spaceBefore=1, spaceAfter=5))
    decl_text = (
        "I, <b>D. MANIDEEP</b>, hereby declare that this project report entitled <b>“Design and Development of an "
        "Interactive DNA Mutation Analyzer Using Bioinformatics”</b> submitted to <b>[College Name Placeholder]</b> is an original "
        "record of work conducted by me. I have not submitted the same work to any other institution for the award of any degree, diploma, "
        "or fellowship. All software modules, algorithms, mathematical formulations, test suites (38/38 passing), and empirical analyses "
        "presented herein represent my authentic work."
    )
    story.append(Paragraph(decl_text, style_body))
    story.append(Spacer(1, 10))
    story.append(Paragraph("<b>D. Manideep</b> &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; Date: November 18, 2026", style_body))
    story.append(Spacer(1, 12))

    story.append(Paragraph("ACKNOWLEDGEMENT", style_h1))
    story.append(HRFlowable(width="100%", thickness=1, color=TEAL, spaceBefore=1, spaceAfter=5))
    ack_text = (
        "I express my deepest gratitude to my Faculty Guide <b>[Internal Guide Name Placeholder]</b> for invaluable guidance, "
        "scholarly insights, and encouragement throughout the architectural design and implementation phases of BioCrystal 3D. "
        "I extend my sincere thanks to the Head of the Department and the Principal of <b>[College Name Placeholder]</b> for providing "
        "the advanced computing facilities and infrastructure necessary to execute this experiential learning project.<br/>"
        "Special thanks are due to the open-source scientific computing community behind Biopython, Three.js, 3Dmol.js, FastAPI, "
        "and the RCSB Protein Data Bank for providing the robust foundation upon which this research workstation is established. "
        "Finally, I am profoundly indebted to my parents and peers for their continuous moral support and motivation."
    )
    story.append(Paragraph(ack_text, style_body))
    story.append(PageBreak())

    # =========================================================================
    # PAGE 3 — ABSTRACT AND TABLE OF CONTENTS
    # =========================================================================
    story.append(Paragraph("ABSTRACT", style_h1))
    story.append(HRFlowable(width="100%", thickness=1, color=TEAL, spaceBefore=1, spaceAfter=4))
    abs_text = (
        "Accurate identification and structural characterization of genetic mutations are critical for understanding disease etiology, "
        "anticipating oncogenic transformation, and designing targeted pharmacotherapies. However, existing bioinformatics workflows remain "
        "heavily fragmented, requiring researchers to manually coordinate disconnected tools for sequence alignment, translation, "
        "thermodynamic stability, and molecular visualization. Furthermore, emerging generative AI tools frequently hallucinate fictitious "
        "macromolecular structures, eroding scientific trust. To resolve these challenges, this project presents <b>BioCrystal 3D</b>, "
        "an interactive, client-server DNA mutation analyzer and 3D simulation workstation. Built using React 19, TypeScript, and Vite on the "
        "frontend, and FastAPI, Python, and Biopython on the backend, BioCrystal 3D executes an integrated 11-step analytical pipeline. "
        "The system performs Needleman–Wunsch global pairwise alignment, identifies transitions, transversions, and indels, executes in-silico "
        "translation via NCBI Standard Genetic Code Table 1, computes peptide physicochemical telemetry (molecular weight, GRAVY hydropathy, "
        "net charge at pH 7.0), and evaluates DNA duplex thermodynamics using SantaLucia's unified nearest-neighbour model with monovalent "
        "and divalent salt corrections. A dual 3D graphics architecture renders canonical B-DNA double helices alongside experimentally "
        "determined Protein Data Bank (PDB) structures, rigorously enforcing provenance labels to eliminate hallucinations. A stale-result "
        "protection mechanism safeguards against outdated interpretations during sequence drafting, while a multi-page vector PDF engine "
        "generates publication-ready clinical reports. The platform was validated across four canonical cancer driver benchmarks (KRAS G12D, "
        "BRAF V600E, EGFR L858R, TP53 R273H), achieving a 100% pass rate across 38 core automated test cases and zero frontend build errors. "
        "BioCrystal 3D demonstrates the practical unification of bioinformatics algorithms into a robust web platform."
    )
    story.append(Paragraph(abs_text, style_body))
    story.append(Paragraph("<b>Keywords:</b> Bioinformatics, DNA Mutation Analysis, Needleman–Wunsch Alignment, In-Silico Translation, SantaLucia Thermodynamics, Macromolecular Visualization, Protein Data Bank, Stale-Result Protection.", style_caption))
    story.append(Spacer(1, 8))

    story.append(Paragraph("TABLE OF CONTENTS", style_h1))
    story.append(HRFlowable(width="100%", thickness=1, color=TEAL, spaceBefore=1, spaceAfter=4))

    toc_data = [
        [Paragraph("<b>Section No. &amp; Title</b>", style_body_bold), Paragraph("<b>Page</b>", style_body_bold),
         Paragraph("<b>Section No. &amp; Title</b>", style_body_bold), Paragraph("<b>Page</b>", style_body_bold)],
        [Paragraph("1. Cover Page", style_body), Paragraph("1", style_body), Paragraph("12. 3D Visualization and Provenance", style_body), Paragraph("10", style_body)],
        [Paragraph("2. Certificate, Declaration &amp; Ack.", style_body), Paragraph("2", style_body), Paragraph("13. Results and Discussion", style_body), Paragraph("11", style_body)],
        [Paragraph("3. Abstract &amp; Table of Contents", style_body), Paragraph("3", style_body), Paragraph("14. Graphs &amp; Visual Results", style_body), Paragraph("12", style_body)],
        [Paragraph("4. Introduction &amp; Problem Statement", style_body), Paragraph("4", style_body), Paragraph("15. Before &amp; After Edit Analysis", style_body), Paragraph("12", style_body)],
        [Paragraph("5. Objectives &amp; Literature Review", style_body), Paragraph("5", style_body), Paragraph("16. Testing &amp; Validation (38 Tests)", style_body), Paragraph("13", style_body)],
        [Paragraph("6. Existing vs Proposed System", style_body), Paragraph("6", style_body), Paragraph("17. Advantages of BioCrystal 3D", style_body), Paragraph("13", style_body)],
        [Paragraph("7. System Architecture", style_body), Paragraph("6", style_body), Paragraph("18. Practical Applications", style_body), Paragraph("13", style_body)],
        [Paragraph("8. Technology Stack", style_body), Paragraph("6", style_body), Paragraph("19. System Limitations", style_body), Paragraph("13", style_body)],
        [Paragraph("9. Methodology &amp; Workflow", style_body), Paragraph("7", style_body), Paragraph("20. Future Scope", style_body), Paragraph("13", style_body)],
        [Paragraph("10. Implementation Details — Part 1", style_body), Paragraph("8", style_body), Paragraph("21. Conclusion", style_body), Paragraph("14", style_body)],
        [Paragraph("11. Implementation Details — Part 2", style_body), Paragraph("9", style_body), Paragraph("22. References (IEEE Format)", style_body), Paragraph("14", style_body)],
    ]
    t_toc = Table(toc_data, colWidths=[200, 35, 220, 35])
    t_toc.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#F1F5F9')),
        ('BOX', (0,0), (-1,-1), 0.8, BORDER_LIGHT),
        ('INNERGRID', (0,0), (-1,-1), 0.4, BORDER_LIGHT),
        ('TOPPADDING', (0,0), (-1,-1), 2.2),
        ('BOTTOMPADDING', (0,0), (-1,-1), 2.2),
        ('LEFTPADDING', (0,0), (-1,-1), 6),
        ('RIGHTPADDING', (0,0), (-1,-1), 6),
        ('ALIGN', (1,0), (1,-1), 'CENTER'),
        ('ALIGN', (3,0), (3,-1), 'CENTER'),
    ]))
    story.append(t_toc)
    story.append(PageBreak())

    # =========================================================================
    # PAGE 4 — INTRODUCTION AND PROBLEM STATEMENT
    # =========================================================================
    story.append(Paragraph("1. INTRODUCTION", style_h1))
    story.append(HRFlowable(width="100%", thickness=1, color=TEAL, spaceBefore=1, spaceAfter=4))
    intro_p1 = (
        "Deoxyribonucleic acid (DNA) serves as the primary biochemical repository of genetic instruction across all cellular organisms. "
        "The precise linear ordering of nucleotide bases (Adenine, Thymine, Guanine, Cytosine) encodes the structural blueprints for proteins "
        "through transcriptional and translational machinery. However, genomic sequences are continuously subjected to replication errors, "
        "spontaneous deamination, reactive oxygen species, and environmental mutagens. These events yield single nucleotide polymorphisms "
        "(SNPs), point mutations, and insertions/deletions (indels). When such alterations occur within protein-coding regions (exons), "
        "they disrupt triplet codon reading frames, altering amino acid identity, hydropathy, charge, and tertiary macromolecular folding. "
        "In oncology and pharmacogenomics, identifying driver mutations—such as KRAS G12D in colorectal carcinomas or BRAF V600E in "
        "melanomas—is paramount for patient stratification and targeted targeted inhibitor administration."
    )
    story.append(Paragraph(intro_p1, style_body))
    intro_p2 = (
        "Historically, decoding the biophysical impact of mutations demanded extensive wet-lab site-directed mutagenesis, circular dichroism, "
        "and X-ray crystallography. In the modern era, computational biology and bioinformatics accelerate discovery by evaluating sequence "
        "divergence and thermodynamic stability in-silico. However, software accessibility remains a critical bottleneck."
    )
    story.append(Paragraph(intro_p2, style_body))
    story.append(Spacer(1, 4))

    story.append(Paragraph("2. PROBLEM STATEMENT", style_h1))
    story.append(HRFlowable(width="100%", thickness=1, color=TEAL, spaceBefore=1, spaceAfter=4))
    prob_p1 = (
        "Contemporary bioinformatics workflows suffer from severe operational fragmentation, mathematical disconnect, and provenance vulnerability: "
        "<br/><b>1. Workflow Fragmentation:</b> To analyze a single gene mutation, a researcher typically runs NCBI BLAST for sequence alignment, "
        "copies coordinates to Expasy Translate for codon mapping, accesses OligoCalc or DINAMelt for duplex melting temperatures, and uploads "
        "files to PyMOL or UCSF Chimera for structural visualization. This manual juggling introduces transcription errors and disrupts reproducibility."
        "<br/><b>2. Unverified AI Structural Hallucinations:</b> The rise of black-box deep learning tools has led to generative models that "
        "hallucinate speculative tertiary conformations for novel sequences without experimental grounding, presenting fictitious protein folds as facts."
        "<br/><b>3. Absence of Result Provenance &amp; Stale-Draft Risks:</b> In existing web tools, if a user modifies an input sequence after "
        "generating an analysis, the screen silently displays obsolete data, leading to dangerous clinical misinterpretations."
        "<br/><b>4. High Computational &amp; Deployment Overhead:</b> Traditional command-line pipelines (GATK, SAMtools, Biopython scripts) require "
        "Linux environments, dependency chains, and terminal expertise, alienating clinicians and students."
    )
    story.append(Paragraph(prob_p1, style_body))
    story.append(Spacer(1, 4))
    story.append(Paragraph("<b>Why BioCrystal 3D Was Developed:</b> BioCrystal 3D was conceived to bridge this divide by delivering a zero-installation, "
                           "provably grounded scientific workstation that unites Needleman–Wunsch alignment, in-silico translation, SantaLucia 1998 thermodynamics, "
                           "and dual 3D visualization (canonical B-DNA + verified PDB structures) in an interactive, reactive browser interface.", style_body))
    story.append(Spacer(1, 6))
    story.append(make_ph_box("Figure 2", "BioCrystal 3D DNA Sequence Input Workspace & FASTA Ingestion Interface", 48))
    story.append(PageBreak())

    # =========================================================================
    # PAGE 5 — OBJECTIVES, SCOPE AND LITERATURE REVIEW
    # =========================================================================
    story.append(Paragraph("3. OBJECTIVES OF THE PROJECT", style_h1))
    story.append(HRFlowable(width="100%", thickness=1, color=TEAL, spaceBefore=1, spaceAfter=4))
    story.append(Paragraph("<b>Main Objective:</b> To design, engineer, and validate an interactive, full-stack scientific software workstation for real-time DNA mutation analysis, thermodynamic profiling, in-silico translation, and dual macromolecular 3D simulation.", style_body))
    obj_p = (
        "<b>Specific Engineering &amp; Scientific Objectives:</b>"
        "<br/>1. Implement Needleman–Wunsch dynamic programming algorithm for global pairwise sequence alignment."
        "<br/>2. Engineer an automated mutation detection engine classifying substitutions (transitions/transversions), in-frame indels, and frameshifts."
        "<br/>3. Construct an in-silico translation pipeline based on NCBI Standard Genetic Code Table 1 with reading frame offset controls."
        "<br/>4. Compute peptide physicochemical telemetry: molecular weight ($M_w$), Kyte–Doolittle hydropathy (GRAVY), and net charge at pH 7.0."
        "<br/>5. Implement SantaLucia (1998) unified nearest-neighbour thermodynamics evaluating $\\Delta H^\\circ$, $\\Delta S^\\circ$, $\\Delta G^\\circ_{37}$, and melting temperature ($T_m$)."
        "<br/>6. Build an automated canonical B-DNA 3D coordinate generator outputting standard PDB files for WebGL rendering."
        "<br/>7. Interface with RCSB Protein Data Bank to map experimentally verified tertiary structures for curated cancer targets (KRAS, BRAF, EGFR, TP53)."
        "<br/>8. Formulate a strict anti-hallucination policy with mandatory provenance labels distinguishing models from empirical crystallography."
        "<br/>9. Implement stale-result protection alerting users when active drafts deviate from analyzed results."
        "<br/>10. Develop a multi-page vector PDF report generator utilizing ReportLab for clinical-grade documentation."
    )
    story.append(Paragraph(obj_p, style_body))
    story.append(Spacer(1, 4))

    story.append(Paragraph("4. SCOPE OF THE PROJECT", style_h1))
    story.append(HRFlowable(width="100%", thickness=1, color=TEAL, spaceBefore=1, spaceAfter=4))
    scope_p = (
        "The scope encompasses single and dual variant comparison of DNA sequences up to educational/clinical bench limits (1,000 bp), "
        "FASTA file ingestion, codon-level translation, nearest-neighbour thermodynamics, WebGL 3D molecular inspection, and vector PDF compilation. "
        "The software operates fully within standard desktop web browsers without external plugins or proprietary licenses."
    )
    story.append(Paragraph(scope_p, style_body))
    story.append(Spacer(1, 4))

    story.append(Paragraph("5. LITERATURE REVIEW", style_h1))
    story.append(HRFlowable(width="100%", thickness=1, color=TEAL, spaceBefore=1, spaceAfter=4))
    lit_p = (
        "<b>Needleman and Wunsch (1970) [1]</b> formulated the dynamic programming foundation for global pairwise sequence alignment, establishing "
        "optimal matching matrices with gap penalties. <b>SantaLucia (1998) [2]</b> unified nearest-neighbour thermodynamic parameters across polymer "
        "and oligonucleotide duplexes, providing empirical enthalpy and entropy parameters for all 10 Watson–Crick dimer pairs. "
        "<b>Allawi and SantaLucia (1997) [3]</b> extended this model with mismatch free-energy penalties. <b>Kyte and Doolittle (1982) [4]</b> "
        "introduced the hydropathic index (GRAVY) to quantify peptide hydrophobicity. <b>NCBI Genetic Codes [5]</b> formalized standard codon mappings. "
        "<b>Berman et al. (2000) [6]</b> established the Protein Data Bank (PDB) as the primary archive of empirical macromolecular structures. "
        "<b>Cock et al. (2009) [7]</b> developed Biopython, providing validated modules for sequence parsing and structural coordinate extraction. "
        "<b>Rego and Koes (2015) [8]</b> pioneered 3Dmol.js, demonstrating that hardware-accelerated WebGL provides native macromolecular rendering."
    )
    story.append(Paragraph(lit_p, style_body))
    story.append(PageBreak())

    # =========================================================================
    # PAGE 6 — EXISTING SYSTEM, PROPOSED SYSTEM AND ARCHITECTURE
    # =========================================================================
    story.append(Paragraph("6. EXISTING SYSTEM AND LIMITATIONS", style_h1))
    story.append(HRFlowable(width="100%", thickness=1, color=TEAL, spaceBefore=1, spaceAfter=4))

    comp_table_data = [
        [Paragraph("<b>Feature / Capability</b>", style_body_bold),
         Paragraph("<b>NCBI BLAST [1]</b>", style_body_bold),
         Paragraph("<b>Expasy Translate [5]</b>", style_body_bold),
         Paragraph("<b>OligoCalc [2]</b>", style_body_bold),
         Paragraph("<b>PyMOL / Chimera [6]</b>", style_body_bold),
         Paragraph("<b>BioCrystal 3D (Ours)</b>", style_body_bold)],
        [Paragraph("Pairwise Global Alignment", style_body), Paragraph("Heuristic Local", style_body), Paragraph("No", style_body), Paragraph("No", style_body), Paragraph("Structural only", style_body), Paragraph("<b>Needleman–Wunsch</b>", style_body_bold)],
        [Paragraph("In-Silico Translation", style_body), Paragraph("Six-frame basic", style_body), Paragraph("Six-frame text", style_body), Paragraph("No", style_body), Paragraph("No", style_body), Paragraph("<b>Codon-level NCBI</b>", style_body_bold)],
        [Paragraph("Duplex Thermodynamics", style_body), Paragraph("No", style_body), Paragraph("No", style_body), Paragraph("Nearest-Neighbor", style_body), Paragraph("No", style_body), Paragraph("<b>SantaLucia 1998 Unified</b>", style_body_bold)],
        [Paragraph("3D Structure Visualization", style_body), Paragraph("No", style_body), Paragraph("No", style_body), Paragraph("No", style_body), Paragraph("Desktop WebGL", style_body), Paragraph("<b>B-DNA + PDB WebGL</b>", style_body_bold)],
        [Paragraph("Provenance &amp; Stale Alert", style_body), Paragraph("No", style_body), Paragraph("No", style_body), Paragraph("No", style_body), Paragraph("No", style_body), Paragraph("<b>Active Stale Guard</b>", style_body_bold)],
        [Paragraph("Integrated PDF Reporting", style_body), Paragraph("Raw text / hit", style_body), Paragraph("Raw text", style_body), Paragraph("No", style_body), Paragraph("Image render", style_body), Paragraph("<b>Multi-page Vector PDF</b>", style_body_bold)],
    ]
    t_comp = Table(comp_table_data, colWidths=[115, 75, 75, 70, 80, 90])
    t_comp.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#F1F5F9')),
        ('BACKGROUND', (5,1), (5,-1), colors.HexColor('#F0FDFA')),
        ('BOX', (0,0), (-1,-1), 0.8, BORDER_LIGHT),
        ('INNERGRID', (0,0), (-1,-1), 0.4, BORDER_LIGHT),
        ('TOPPADDING', (0,0), (-1,-1), 2),
        ('BOTTOMPADDING', (0,0), (-1,-1), 2),
        ('LEFTPADDING', (0,0), (-1,-1), 4),
        ('RIGHTPADDING', (0,0), (-1,-1), 4),
    ]))
    story.append(t_comp)
    story.append(Spacer(1, 5))

    story.append(Paragraph("7. PROPOSED SYSTEM &amp; ARCHITECTURE", style_h1))
    story.append(HRFlowable(width="100%", thickness=1, color=TEAL, spaceBefore=1, spaceAfter=4))
    story.append(Paragraph("BioCrystal 3D resolves tool fragmentation through an asynchronous, decoupled client-server architecture:", style_body))

    arch_box = (
        "<font face='Courier' size='7.5' color='#0F766E'>"
        "+---------------------------------------------------------------------------------------+<br/>"
        "| &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<b>USER INTERFACE (Desktop Browser)</b> &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;|<br/>"
        "+-------------------------------------------+-------------------------------------------+<br/>"
        "&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;| (User Input / FASTA File Upload / Preset)<br/>"
        "&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;v<br/>"
        "+---------------------------------------------------------------------------------------+<br/>"
        "| &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<b>REACT 19 + TYPESCRIPT + VITE FRONTEND</b> &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;|<br/>"
        "| &nbsp;* SequenceInputWorkspace &nbsp;* ResultsAndEditView &nbsp;* ReportView &nbsp;* StaleResultGuard &nbsp;&nbsp;&nbsp;&nbsp;|<br/>"
        "+-------------------------------------------+-------------------------------------------+<br/>"
        "&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;| REST API Requests (JSON Payload / Async Fetch)<br/>"
        "&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;v<br/>"
        "+---------------------------------------------------------------------------------------+<br/>"
        "| &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<b>FASTAPI + PYTHON BACKEND</b> &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;|<br/>"
        "| &nbsp;+--> Needleman–Wunsch Alignment Engine (Dynamic Programming, Match=+2, Gap=-2) &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;|<br/>"
        "| &nbsp;+--> Mutation Classification Engine (SNP Transitions/Transversions, Indels, HGVS) &nbsp;|<br/>"
        "| &nbsp;+--> NCBI Table 1 Translation Engine (Reading Frames, Codon Shift, Stop Codons) &nbsp;&nbsp;&nbsp;&nbsp;|<br/>"
        "| &nbsp;+--> SantaLucia Thermodynamics Engine (Unified Nearest-Neighbor, dH, dS, dG, Tm) &nbsp;&nbsp;&nbsp;&nbsp;|<br/>"
        "| &nbsp;+--> PDB Structure Mapping Engine (De Novo B-DNA Builder + RCSB Experimental PDBs) &nbsp;&nbsp;|<br/>"
        "| &nbsp;+--> ReportLab PDF Generator (4-Page Clinical Vector Report Generation) &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;|<br/>"
        "+-------------------------------------------+-------------------------------------------+<br/>"
        "&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;| Structured JSON Response / PDB Stream / PDF<br/>"
        "&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;v<br/>"
        "+---------------------------------------------------------------------------------------+<br/>"
        "| &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<b>ANALYSIS RESULTS / 3D VISUALIZATION / PDF REPORT</b> &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;|<br/>"
        "+---------------------------------------------------------------------------------------+</font>"
    )
    story.append(Paragraph(arch_box, style_body))
    story.append(Spacer(1, 5))

    story.append(Paragraph("8. TECHNOLOGY STACK", style_h1))
    story.append(HRFlowable(width="100%", thickness=1, color=TEAL, spaceBefore=1, spaceAfter=4))
    tech_data = [
        [Paragraph("<b>Component Layer</b>", style_body_bold), Paragraph("<b>Technologies / Libraries</b>", style_body_bold), Paragraph("<b>Functional Responsibility in BioCrystal 3D</b>", style_body_bold)],
        [Paragraph("Frontend Client", style_body), Paragraph("React 19, TypeScript, Vite, Tailwind CSS", style_body), Paragraph("Reactive workstation UI, state management, client validation, tabs", style_body)],
        [Paragraph("Backend Server", style_body), Paragraph("FastAPI, Uvicorn, Python 3.14, Pydantic", style_body), Paragraph("RESTful endpoints, asynchronous request orchestration, data validation", style_body)],
        [Paragraph("Bioinformatics Core", style_body), Paragraph("Biopython (Bio.Seq, Bio.PDB, Bio.SeqUtils)", style_body), Paragraph("Pairwise alignment, translation, amino acid physicochemical calculations", style_body)],
        [Paragraph("Thermodynamics", style_body), Paragraph("NumPy, Custom SantaLucia 1998 Engine", style_body), Paragraph("Nearest-neighbour enthalpy/entropy, salt corrections, melting temperature", style_body)],
        [Paragraph("Molecular Rendering", style_body), Paragraph("Three.js, 3Dmol.js, WebGL", style_body), Paragraph("Interactive hardware-accelerated rendering of B-DNA and PDB structures", style_body)],
        [Paragraph("Report Generation", style_body), Paragraph("ReportLab 5.0.1 Open-Source", style_body), Paragraph("Automated clinical-grade vector PDF compilation with telemetry tables", style_body)],
    ]
    t_tech = Table(tech_data, colWidths=[105, 170, 230])
    t_tech.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#F1F5F9')),
        ('BOX', (0,0), (-1,-1), 0.8, BORDER_LIGHT),
        ('INNERGRID', (0,0), (-1,-1), 0.4, BORDER_LIGHT),
        ('TOPPADDING', (0,0), (-1,-1), 2),
        ('BOTTOMPADDING', (0,0), (-1,-1), 2),
        ('LEFTPADDING', (0,0), (-1,-1), 5),
        ('RIGHTPADDING', (0,0), (-1,-1), 5),
    ]))
    story.append(t_tech)
    story.append(PageBreak())

    # =========================================================================
    # PAGE 7 — METHODOLOGY AND EXPERIMENTAL PROCEDURE
    # =========================================================================
    story.append(Paragraph("9. METHODOLOGY AND EXPERIMENTAL WORKFLOW", style_h1))
    story.append(HRFlowable(width="100%", thickness=1, color=TEAL, spaceBefore=1, spaceAfter=4))
    story.append(Paragraph("BioCrystal 3D follows a rigorous, reproducible 11-step analytical procedure for every sequence evaluation:", style_body))

    method_steps = (
        "<b>Step 1: Sequence Ingestion &amp; FASTA Parsing:</b> Accepts raw text input or multi-sequence FASTA files (.fa, .fasta). Header lines (>), whitespace, and line breaks are sanitized.<br/>"
        "<b>Step 2: Sequence Validation &amp; Sanitization:</b> Regex inspection enforces IUPAC nucleotide alphabet (A, C, G, T). Non-conforming characters trigger instant descriptive validation errors.<br/>"
        "<b>Step 3: Needleman–Wunsch Pairwise Alignment:</b> Constructs dynamic programming score matrix allocating +2 for matches, -1 for mismatches, and -2 for insertion/deletion gap penalties.<br/>"
        "<b>Step 4: Coordinate-Accurate Mutation Classification:</b> Scans aligned pairs to identify single base substitutions (transitions/transversions), in-frame insertions/deletions, and frameshifts.<br/>"
        "<b>Step 5: Codon-Level In-Silico Translation:</b> Translates 5'->3' reading frames via NCBI Standard Genetic Code Table 1, pinpointing altered codons, synonymous vs nonsynonymous changes, and premature stops.<br/>"
        "<b>Step 6: Peptide Physicochemical Telemetry:</b> Calculates molecular mass shift (ΔMW), Kyte–Doolittle hydropathy (ΔGRAVY), and net charge shift at physiological pH 7.0.<br/>"
        "<b>Step 7: SantaLucia Unified Duplex Thermodynamics:</b> Evaluates nearest-neighbour dimer parameters, calculating ΔH°, ΔS°, Gibbs free energy (ΔG°37), and sodium/magnesium salt-adjusted melting temperature (Tm).<br/>"
        "<b>Step 8: Canonical B-DNA 3D Model Construction:</b> Generates de novo atomic coordinates for the user sequence conforming to standard B-DNA helicoidal geometry (36° twist, 3.4 Å rise).<br/>"
        "<b>Step 9: Experimental PDB Structure Mapping:</b> Resolves target gene against curated Protein Data Bank entries (e.g., 6OIM for KRAS, 4EHE for BRAF, 1TUP for TP53) and maps mutations onto 3D residues.<br/>"
        "<b>Step 10: Primary Interpretation Synthesis:</b> Synthesizes molecular consequences into a deterministic, clinically grounded sentence without neural hallucinations.<br/>"
        "<b>Step 11: Multi-Page Vector PDF Report Generation:</b> Compiles telemetry, alignment tables, thermodynamics, and disclaimers into a standardized 4-page PDF document via ReportLab."
    )
    story.append(Paragraph(method_steps, style_body))
    story.append(Spacer(1, 4))

    flow_box = (
        "<font face='Courier' size='7.2' color='#0F766E'>"
        "[1. Sequence Input / FASTA] --> [2. IUPAC Validation] --> [3. Needleman–Wunsch Alignment]<br/>"
        "&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;|<br/>"
        "&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;+-------------------------------------------------------------------+<br/>"
        "&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;| (Parallel Feature Extraction Pipeline)<br/>"
        "&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;+--> [4. Mutation Detection] &nbsp;&nbsp;--> [5. NCBI Translation] &nbsp;--> [6. Peptide Telemetry (MW/GRAVY)]<br/>"
        "&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;+--> [7. SantaLucia Thermo] &nbsp;&nbsp;&nbsp;&nbsp;--> [8. B-DNA 3D Model] &nbsp;&nbsp;&nbsp;&nbsp;--> [9. RCSB PDB Structure Map]<br/>"
        "&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;|<br/>"
        "&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;v &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;v<br/>"
        "[10. Deterministic Interpretation Synthesis] --------------------> [11. 4-Page PDF Clinical Report]</font>"
    )
    story.append(Paragraph(flow_box, style_body))
    story.append(Spacer(1, 6))
    story.append(make_ph_box("Figure 3", "Interactive Needleman–Wunsch Alignment View with Mutation Highlighting", 46))
    story.append(PageBreak())

    # =========================================================================
    # PAGE 8 — IMPLEMENTATION DETAILS — PART 1
    # =========================================================================
    story.append(Paragraph("10. IMPLEMENTATION DETAILS — PART 1: ALIGNMENT &amp; MUTATIONS", style_h1))
    story.append(HRFlowable(width="100%", thickness=1, color=TEAL, spaceBefore=1, spaceAfter=4))

    story.append(Paragraph("10.1 Sequence Input Validation &amp; FASTA Ingestion", style_h2))
    val_p = (
        "The FASTA parser reads multi-line sequences, strips whitespace, ignores comments (>), and validates nucleotide symbols against IUPAC standards. "
        "A regular expression filter <code>^[ACGTNacgtn]+$</code> ensures that only biologically valid sequences enter the computational pipeline."
    )
    story.append(Paragraph(val_p, style_body))

    story.append(Paragraph("10.2 Needleman–Wunsch Global Pairwise Alignment", style_h2))
    nw_p = (
        "The Needleman–Wunsch algorithm computes the optimal global alignment between reference sequence $R$ of length $M$ and observed sequence $O$ of length $N$. "
        "The dynamic programming score matrix $S(i,j)$ is populated recursively: "
        "<br/>$$S(i,j) = \\max \\begin{cases} S(i-1, j-1) + \\sigma(R_i, O_j) & \\text{(Match / Mismatch)} \\\\ S(i-1, j) + \\gamma & \\text{(Deletion in } O) \\\\ S(i, j-1) + \\gamma & \\text{(Insertion in } O) \\end{cases}$$"
        "<br/>where $\\sigma(R_i, O_j) = +2$ if $R_i = O_j$, $\\sigma(R_i, O_j) = -1$ if $R_i \\neq O_j$, and gap penalty $\\gamma = -2$. "
        "Traceback traverses backward from $S(M,N)$ to $S(0,0)$ to generate aligned string pairs with coordinates."
    )
    story.append(Paragraph(nw_p, style_body))

    story.append(Paragraph("10.3 Mutation Detection and Categorization", style_h2))
    mut_p = (
        "Following traceback, an inspection pass evaluates every aligned column. Substitutions are categorized into <b>Transitions</b> (purine↔purine: A↔G, or pyrimidine↔pyrimidine: C↔T) "
        "and <b>Transversions</b> (purine↔pyrimidine). InDels are classified as in-frame if their length is a multiple of 3, or frameshift otherwise. "
        "Each mutation is assigned HGVS nomenclature (e.g., c.35G>A), codon coordinates, and an extracted $\\pm 8$ bp flanking context window for PCR primer/probe design."
    )
    story.append(Paragraph(mut_p, style_body))

    story.append(Paragraph("10.4 Concrete Execution Example: KRAS G12D Oncogene (c.35G>A)", style_h2))
    ex_nw = (
        "<font face='Courier' size='7.5'>"
        "Reference : ATGACTGAATATAAACTTGTGGTAGTTGGAGCT<b>G</b>GTGGCGTAGGCAAGAGTGCCTTGACG (60 bp)<br/>"
        "Variant &nbsp;&nbsp;: ATGACTGAATATAAACTTGTGGTAGTTGGAGCT<b>A</b>TGGCGTAGGCAAGAGTGCCTTGACG (60 bp)<br/>"
        "Alignment : Coordinate Pos 35 | Ref Base: G | Variant Base: A | Transition (Purine to Purine)<br/>"
        "HGVS &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;: c.35G>A | Codon 12: GGT (Gly) -> GAT (Asp) | Consequence: Missense Mutation<br/>"
        "Flanking &nbsp;: Context Window (\\pm 8 bp): [TAGTTGGA - <b>G/A</b> - TGGCGTAG]</font>"
    )
    story.append(Paragraph(ex_nw, style_body))
    story.append(Spacer(1, 4))
    story.append(make_ph_box("Figure 4", "BioCrystal 3D Mutation Classification Table & Consequence Breakdown", 44))
    story.append(PageBreak())

    # =========================================================================
    # PAGE 9 — IMPLEMENTATION DETAILS — PART 2
    # =========================================================================
    story.append(Paragraph("11. IMPLEMENTATION DETAILS — PART 2: TRANSLATION &amp; THERMODYNAMICS", style_h1))
    story.append(HRFlowable(width="100%", thickness=1, color=TEAL, spaceBefore=1, spaceAfter=4))

    story.append(Paragraph("11.1 NCBI Table 1 In-Silico Translation Engine", style_h2))
    trans_p = (
        "The translation engine parses coding strands into consecutive non-overlapping triplets based on NCBI Genetic Code Table 1. "
        "User-selectable reading frames (0, +1, +2) permit evaluation of non-canonical starts. The engine evaluates: "
        "<br/>* <b>Synonymous (Silent):</b> Codon alters but translated amino acid remains identical (e.g., GGT -> GGC both yield Glycine)."
        "<br/>* <b>Missense:</b> Codon substitution alters amino acid chemistry (e.g., GGT -> GAT replaces neutral Glycine with acidic Aspartic acid)."
        "<br/>* <b>Nonsense:</b> Mutation introduces premature stop codons (UAA, UAG, UGA), truncating peptide elongation."
        "<br/>* <b>Frameshift:</b> Non-triplet indel disrupts downstream reading frame, radically altering all subsequent codons."
    )
    story.append(Paragraph(trans_p, style_body))

    story.append(Paragraph("11.2 Protein Physicochemical Telemetry Computation", style_h2))
    props_p = (
        "Translated peptide products are subjected to rigorous biophysical analysis:"
        "<br/>* <b>Molecular Weight ($M_w$):</b> Evaluated by summing isotopic monoisotopic residue masses minus condensation water loss ($18.015$ Da per peptide bond)."
        "<br/>* <b>GRAVY Score:</b> Grand Average of Hydropathy calculated via the Kyte–Doolittle hydropathy scale: $\\text{GRAVY} = \\frac{1}{N} \\sum_{i=1}^N H_i$."
        "<br/>* <b>Net Charge at pH 7.0:</b> Computed via Henderson–Hasselbalch ionization summation of Arg, Lys, His, Asp, Glu, and terminal groups."
    )
    story.append(Paragraph(props_p, style_body))

    story.append(Paragraph("11.3 SantaLucia (1998) Unified Nearest-Neighbour Thermodynamics", style_h2))
    thermo_p = (
        "Duplex stability is computed across all 10 Watson–Crick nearest-neighbour dimer pairs (AA/TT, AT/TA, GC/CG, etc.): "
        "<br/>$$\\Delta H^\\circ = \\Delta H^\\circ_{\\text{init}} + \\sum n_i \\Delta H^\\circ_i + \\Delta H^\\circ_{\\text{sym}}, \\quad \\Delta S^\\circ = \\Delta S^\\circ_{\\text{init}} + \\sum n_i \\Delta S^\\circ_i + \\Delta S^\\circ_{\\text{sym}} + \\Delta S^\\circ_{\\text{salt}}$$"
        "<br/>Gibbs free energy at $37^\\circ\\text{C}$ is determined by: $\\Delta G^\\circ_{37} = \\Delta H^\\circ - T\\Delta S^\\circ$. "
        "Melting temperature ($T_m$) under user-specified strand concentration ($C_t = 0.5\\,\\mu\\text{M}$) and effective salt ($[\\text{Na}^+]_{\\text{eff}} = [\\text{Na}^+] + 120\\sqrt{[\\text{Mg}^{2+}]}$) is evaluated as: "
        "$$T_m = \\frac{\\Delta H^\\circ}{\\Delta S^\\circ + R \\ln(C_t / 4)} - 273.15$$"
    )
    story.append(Paragraph(thermo_p, style_body))

    story.append(Paragraph("11.4 Concrete Mathematical Example: KRAS G12D Telemetry Shift", style_h2))
    calc_ex = (
        "<font face='Courier' size='7.5'>"
        "Reference Protein : MTEYKLVVVGAGGVGKSALT (20 aa) | MW: 1980.4 Da | GRAVY: +0.680 | Net Charge: +1.0 e<br/>"
        "Variant Protein &nbsp;&nbsp;: MTEYKLVVVGADGVGKSALT (20 aa) | MW: 2038.4 Da | GRAVY: +0.520 | Net Charge: 0.0 e<br/>"
        "Biochemical Shift : \\Delta MW = +58.0 Da | \\Delta GRAVY = -0.160 (Hydrophilic shift) | \\Delta Charge = -1.0 e<br/>"
        "Thermodynamic Shift: Ref Tm = 99.4°C, Var Tm = 98.5°C (\\Delta Tm = -0.9°C) | \\Delta\\Delta G = +1.1 kcal/mol destabilization</font>"
    )
    story.append(Paragraph(calc_ex, style_body))
    story.append(Spacer(1, 3))
    story.append(make_ph_box("Figure 5", "In-Silico Translation & SantaLucia Thermodynamics Analysis Panel", 42))
    story.append(PageBreak())

    # =========================================================================
    # PAGE 10 — 3D VISUALIZATION AND PROVENANCE
    # =========================================================================
    story.append(Paragraph("12. 3D MACROMOLECULAR VISUALIZATION AND PROVENANCE", style_h1))
    story.append(HRFlowable(width="100%", thickness=1, color=TEAL, spaceBefore=1, spaceAfter=4))

    story.append(Paragraph("12.1 Canonical B-DNA 3D Model Generation", style_h2))
    bdna_p = (
        "BioCrystal 3D incorporates a custom geometric coordinate engine (<code>dna_structure_builder.py</code>) that converts raw nucleotide sequences "
        "into valid atomic Protein Data Bank (PDB) format files. The model constructs a canonical right-handed B-form double helix adhering to: "
        "<br/>* Helical rise per base pair: $h = 3.40$ Å, Helical twist per base pair: $\\theta = 36.0^\\circ$ (10.0 bp per turn)."
        "<br/>* Phosphate-deoxyribose backbone coordinates (P, O1P, O2P, C5', C4', O4', C3', O3', C2', C1') and planar purine/pyrimidine base rings."
        "<br/>* Automated Watson–Crick antiparallel complementary strand generation (DA=DT, DG=DC)."
        "<br/>The synthesized coordinate stream is cached locally and rendered natively via Three.js with Phong specular shading, depth-tested backbones, "
        "and interactive orbit/zoom controls."
    )
    story.append(Paragraph(bdna_p, style_body))

    story.append(Paragraph("12.2 Experimentally Determined PDB Structure Mapping", style_h2))
    pdb_p = (
        "For coding sequence benchmarks, BioCrystal 3D interfaces with the RCSB Protein Data Bank to render empirically resolved crystallographic structures: "
        "<br/>* <b>KRAS G12D:</b> Mapped to PDB ID <b>6OIM</b> (1.35 Å resolution, X-ray diffraction). Mutation locus residue 12 (P-loop) is isolated."
        "<br/>* <b>BRAF V600E:</b> Mapped to PDB ID <b>4EHE</b> (2.60 Å resolution) isolating the kinase activation domain."
        "<br/>* <b>EGFR L858R:</b> Mapped to PDB ID <b>2ITX</b> (2.80 Å resolution) highlighting exon 21 activation loop residue 858."
        "<br/>* <b>TP53 R273H:</b> Mapped to PDB ID <b>1TUP</b> (2.20 Å resolution) pinpointing DNA-binding contact residue 273."
        "<br/>A $5.0$ Å heavy-atom spatial neighborhood algorithm identifies all proximal catalytic residues, mapping mutation microenvironments."
    )
    story.append(Paragraph(pdb_p, style_body))

    story.append(Paragraph("12.3 Strict No-Hallucination Policy &amp; Mandatory Provenance Labels", style_h2))
    prov_p = (
        "To safeguard scientific honesty and eliminate fictitious structural predictions, BioCrystal 3D enforces three mandatory provenance notices: "
        "<br/>1. <i>“Canonical B-DNA model generated from input sequence.”</i>"
        "<br/>2. <i>“Experimentally determined Protein Data Bank (PDB) structure.”</i>"
        "<br/>3. <i>“No experimentally determined PDB structure available; sequence-level and canonical B-DNA analysis are shown.”</i>"
        "<br/>This policy guarantees that users always distinguish mathematically modeled duplexes from empirically resolved crystal structures."
    )
    story.append(Paragraph(prov_p, style_body))
    story.append(Spacer(1, 4))

    t_ph_3d = Table([
        [make_ph_box("Figure 7", "Canonical B-DNA 3D Helical Visualization", 42),
         make_ph_box("Figure 8", "KRAS G12D PDB 6OIM Structure Mapping (5 Å Neighborhood)", 42)]
    ], colWidths=[250, 250])
    t_ph_3d.setStyle(TableStyle([('VALIGN', (0,0), (-1,-1), 'MIDDLE')]))
    story.append(t_ph_3d)
    story.append(Spacer(1, 4))
    story.append(make_ph_box("Figure 9", "Primary Interpretation Panel with Empirical Provenance Badges", 36))
    story.append(PageBreak())

    # =========================================================================
    # PAGE 11 — RESULTS AND DISCUSSION
    # =========================================================================
    story.append(Paragraph("13. RESULTS AND DISCUSSION", style_h1))
    story.append(HRFlowable(width="100%", thickness=1, color=TEAL, spaceBefore=1, spaceAfter=4))
    story.append(Paragraph("BioCrystal 3D was empirically tested against four canonical clinical oncogenic driver mutations. All computational modules completed synchronously with zero exceptions:", style_body))

    bench_table_data = [
        [Paragraph("<b>Benchmark</b>", style_body_bold), Paragraph("<b>Gene</b>", style_body_bold), Paragraph("<b>Mutation</b>", style_body_bold), Paragraph("<b>Detected Consequence</b>", style_body_bold), Paragraph("<b>Amino-Acid Change</b>", style_body_bold), Paragraph("<b>PDB Mapping</b>", style_body_bold)],
        [Paragraph("KRAS G12D", style_body_bold), Paragraph("KRAS", style_body), Paragraph("c.35G>A", style_body), Paragraph("Missense mutation", style_body), Paragraph("Glycine to Aspartic acid", style_body), Paragraph("Available (6OIM)", style_body_bold)],
        [Paragraph("BRAF V600E", style_body_bold), Paragraph("BRAF", style_body), Paragraph("c.1799T>A", style_body), Paragraph("Missense mutation", style_body), Paragraph("Valine to Glutamic acid", style_body), Paragraph("Available (4EHE)", style_body_bold)],
        [Paragraph("EGFR L858R", style_body_bold), Paragraph("EGFR", style_body), Paragraph("c.2573T>G", style_body), Paragraph("Missense mutation", style_body), Paragraph("Leucine to Arginine", style_body), Paragraph("Available (2ITX)", style_body_bold)],
        [Paragraph("TP53 R273H", style_body_bold), Paragraph("TP53", style_body), Paragraph("c.818G>A", style_body), Paragraph("Missense mutation", style_body), Paragraph("Arginine to Histidine", style_body), Paragraph("Available (1TUP)", style_body_bold)],
    ]
    t_bench = Table(bench_table_data, colWidths=[80, 50, 65, 110, 120, 80])
    t_bench.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#F1F5F9')),
        ('BOX', (0,0), (-1,-1), 0.8, BORDER_LIGHT),
        ('INNERGRID', (0,0), (-1,-1), 0.4, BORDER_LIGHT),
        ('TOPPADDING', (0,0), (-1,-1), 2.5),
        ('BOTTOMPADDING', (0,0), (-1,-1), 2.5),
        ('LEFTPADDING', (0,0), (-1,-1), 4),
        ('RIGHTPADDING', (0,0), (-1,-1), 4),
    ]))
    story.append(t_bench)
    story.append(Spacer(1, 4))

    story.append(Paragraph("13.1 Multi-Dimensional Biophysical &amp; Biochemical Shift Summary", style_h2))
    telemetry_table = [
        [Paragraph("<b>Benchmark</b>", style_body_bold), Paragraph("<b>Ref GC%</b>", style_body_bold), Paragraph("<b>Mut GC%</b>", style_body_bold), Paragraph("<b>Ref Tm</b>", style_body_bold), Paragraph("<b>Mut Tm</b>", style_body_bold), Paragraph("<b>ΔMW (Da)</b>", style_body_bold), Paragraph("<b>ΔGRAVY</b>", style_body_bold), Paragraph("<b>ΔCharge</b>", style_body_bold)],
        [Paragraph("KRAS G12D", style_body), Paragraph("48.33%", style_body), Paragraph("46.67%", style_body), Paragraph("99.4°C", style_body), Paragraph("98.5°C", style_body), Paragraph("+58.0", style_body), Paragraph("-0.160", style_body), Paragraph("-1.0 e", style_body)],
        [Paragraph("BRAF V600E", style_body), Paragraph("61.11%", style_body), Paragraph("61.11%", style_body), Paragraph("106.0°C", style_body), Paragraph("105.6°C", style_body), Paragraph("+16.0", style_body), Paragraph("-0.230", style_body), Paragraph("0.0 e", style_body)],
        [Paragraph("EGFR L858R", style_body), Paragraph("45.00%", style_body), Paragraph("46.67%", style_body), Paragraph("98.0°C", style_body), Paragraph("98.8°C", style_body), Paragraph("+43.0", style_body), Paragraph("-0.430", style_body), Paragraph("+1.0 e", style_body)],
        [Paragraph("TP53 R273H", style_body), Paragraph("62.00%", style_body), Paragraph("62.00%", style_body), Paragraph("103.5°C", style_body), Paragraph("103.4°C", style_body), Paragraph("+9.0", style_body), Paragraph("+0.010", style_body), Paragraph("+0.1 e", style_body)],
    ]
    t_tel = Table(telemetry_table, colWidths=[80, 58, 58, 58, 58, 65, 65, 63])
    t_tel.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#F1F5F9')),
        ('BOX', (0,0), (-1,-1), 0.8, BORDER_LIGHT),
        ('INNERGRID', (0,0), (-1,-1), 0.4, BORDER_LIGHT),
        ('TOPPADDING', (0,0), (-1,-1), 2),
        ('BOTTOMPADDING', (0,0), (-1,-1), 2),
        ('ALIGN', (1,0), (-1,-1), 'CENTER'),
    ]))
    story.append(t_tel)
    story.append(Spacer(1, 4))

    story.append(Paragraph("13.2 Biological Discussion of Results", style_h2))
    disc_text = (
        "<b>KRAS G12D (c.35G>A):</b> Replaces small neutral Glycine with negatively charged Aspartate at codon 12 in the P-loop. "
        "The negative charge introduces steric clash with GAP arginine fingers, permanently locking KRAS in the active GTP-bound state.<br/>"
        "<b>BRAF V600E (c.1799T>A):</b> Phosphomimetic substitution of Valine by Glutamate destabilizes inactive auto-inhibited kinase conformations, "
        "stimulating constitutive monomeric kinase signaling independent of RAS activation.<br/>"
        "<b>EGFR L858R (c.2573T>G):</b> Introduces basic Arginine into the activation loop, disrupting autoinhibitory contacts and conferring gefitinib sensitivity.<br/>"
        "<b>TP53 R273H (c.818G>A):</b> Mutation eliminates a vital direct hydrogen-bonding contact between basic Arginine and the DNA minor groove, "
        "completely abolishing sequence-specific transcriptional activation without disrupting the global zinc-stabilized beta-sandwich fold."
    )
    story.append(Paragraph(disc_text, style_body))
    story.append(PageBreak())

    # =========================================================================
    # PAGE 12 — GRAPHS, BEFORE/AFTER ANALYSIS AND VISUAL RESULTS
    # =========================================================================
    story.append(Paragraph("14. QUANTITATIVE GRAPHICAL ANALYSIS", style_h1))
    story.append(HRFlowable(width="100%", thickness=1, color=TEAL, spaceBefore=1, spaceAfter=3))
    story.append(Paragraph("Publication-grade analytical charts generated from empirical benchmark telemetry using Matplotlib:", style_body))

    g_dir = 'report/assets/graphs'
    row1 = [
        Image(f"{g_dir}/graph1_gc_content.png", width=248, height=115) if os.path.exists(f"{g_dir}/graph1_gc_content.png") else Paragraph("Graph 1 Missing", style_body),
        Image(f"{g_dir}/graph2_melting_temperature.png", width=248, height=115) if os.path.exists(f"{g_dir}/graph2_melting_temperature.png") else Paragraph("Graph 2 Missing", style_body)
    ]
    row2 = [
        Image(f"{g_dir}/graph3_molecular_weight.png", width=248, height=115) if os.path.exists(f"{g_dir}/graph3_molecular_weight.png") else Paragraph("Graph 3 Missing", style_body),
        Image(f"{g_dir}/graph4_gravy_score.png", width=248, height=115) if os.path.exists(f"{g_dir}/graph4_gravy_score.png") else Paragraph("Graph 4 Missing", style_body)
    ]
    row3 = [
        Image(f"{g_dir}/graph5_net_charge.png", width=248, height=115) if os.path.exists(f"{g_dir}/graph5_net_charge.png") else Paragraph("Graph 5 Missing", style_body),
        Image(f"{g_dir}/graph6_backend_test_results.png", width=248, height=115) if os.path.exists(f"{g_dir}/graph6_backend_test_results.png") else Paragraph("Graph 6 Missing", style_body)
    ]
    t_graphs = Table([row1, row2, row3], colWidths=[252, 252])
    t_graphs.setStyle(TableStyle([
        ('ALIGN', (0,0), (-1,-1), 'CENTER'),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('BOTTOMPADDING', (0,0), (-1,-1), 1),
        ('TOPPADDING', (0,0), (-1,-1), 1),
    ]))
    story.append(t_graphs)
    story.append(Spacer(1, 3))

    story.append(Paragraph("15. BEFORE AND AFTER SEQUENCE EDIT ANALYSIS", style_h1))
    story.append(HRFlowable(width="100%", thickness=1, color=TEAL, spaceBefore=1, spaceAfter=3))
    ba_text = (
        "<b>Stale-Result Protection Mechanism:</b> In conventional genomic web applications, editing sequence inputs silently invalidates "
        "displayed alignment and thermodynamic outputs, leading users to associate new inputs with obsolete outputs. "
        "BioCrystal 3D resolves this through cryptographic draft hash tracking. When a sequence is modified: "
        "<br/>1. <b>Before Edit:</b> Shows verified analysis for KRAS G12D (c.35G>A, Tm=98.5°C, MW=2038.4 Da, Gly12Asp)."
        "<br/>2. <b>During Edit:</b> The user modifies codon 12 to GTT (KRAS G12V). The system displays a high-visibility, non-intrusive banner: "
        "<i>“Results correspond to the previously analyzed sequence. Current draft contains unsaved edits.”</i> Previous results are preserved."
        "<br/>3. <b>After Re-Analysis:</b> Clicking <i>“Re-run analysis”</i> synchronously updates alignment, codon consequence (Valine), "
        "thermodynamics (Tm=98.4°C), 3D structure, and the PDF export without data loss."
    )
    story.append(Paragraph(ba_text, style_body))
    story.append(Spacer(1, 2))

    t_ph_ba = Table([
        [make_ph_box("Figure 10", "Before Edit: Verified KRAS G12D Analysis State", 30),
         make_ph_box("Figure 11", "After Edit: Stale Warning Banner & Re-Analysis State", 30)]
    ], colWidths=[250, 250])
    t_ph_ba.setStyle(TableStyle([('VALIGN', (0,0), (-1,-1), 'MIDDLE')]))
    story.append(t_ph_ba)
    story.append(PageBreak())

    # =========================================================================
    # PAGE 13 — TESTING, VALIDATION AND ADVANTAGES
    # =========================================================================
    story.append(Paragraph("16. TESTING AND VALIDATION", style_h1))
    story.append(HRFlowable(width="100%", thickness=1, color=TEAL, spaceBefore=1, spaceAfter=4))
    story.append(Paragraph("BioCrystal 3D was subjected to comprehensive automated regression testing across all computational modules:", style_body))

    test_table_data = [
        [Paragraph("<b>Test Module / Test Suite</b>", style_body_bold), Paragraph("<b>Test Cases</b>", style_body_bold), Paragraph("<b>Passed</b>", style_body_bold), Paragraph("<b>Failed</b>", style_body_bold), Paragraph("<b>Pass Rate</b>", style_body_bold)],
        [Paragraph("Sequence Alignment Engine (Needleman–Wunsch)", style_body), Paragraph("9", style_body), Paragraph("9", style_body), Paragraph("0", style_body), Paragraph("100%", style_body_bold)],
        [Paragraph("Mutation Classification &amp; HGVS Parsing", style_body), Paragraph("9", style_body), Paragraph("9", style_body), Paragraph("0", style_body), Paragraph("100%", style_body_bold)],
        [Paragraph("In-Silico Translation (NCBI Table 1)", style_body), Paragraph("5", style_body), Paragraph("5", style_body), Paragraph("0", style_body), Paragraph("100%", style_body_bold)],
        [Paragraph("DNA Thermodynamics (SantaLucia 1998)", style_body), Paragraph("5", style_body), Paragraph("5", style_body), Paragraph("0", style_body), Paragraph("100%", style_body_bold)],
        [Paragraph("PDB Structure Mapping &amp; B-DNA Builder", style_body), Paragraph("9", style_body), Paragraph("9", style_body), Paragraph("0", style_body), Paragraph("100%", style_body_bold)],
        [Paragraph("API Integration &amp; REST Endpoints", style_body), Paragraph("15", style_body), Paragraph("15", style_body), Paragraph("0", style_body), Paragraph("100%", style_body_bold)],
        [Paragraph("PDF Generation Pipeline (ReportLab)", style_body), Paragraph("2", style_body), Paragraph("2", style_body), Paragraph("0", style_body), Paragraph("100%", style_body_bold)],
        [Paragraph("<b>Core Test Suite Total</b>", style_body_bold), Paragraph("<b>38</b>", style_body_bold), Paragraph("<b>38</b>", style_body_bold), Paragraph("<b>0</b>", style_body_bold), Paragraph("<b>100%</b>", style_body_bold)],
    ]
    t_test = Table(test_table_data, colWidths=[185, 75, 75, 75, 95])
    t_test.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#F1F5F9')),
        ('BACKGROUND', (0,-1), (-1,-1), colors.HexColor('#F0FDFA')),
        ('BOX', (0,0), (-1,-1), 0.8, BORDER_LIGHT),
        ('INNERGRID', (0,0), (-1,-1), 0.4, BORDER_LIGHT),
        ('TOPPADDING', (0,0), (-1,-1), 1.8),
        ('BOTTOMPADDING', (0,0), (-1,-1), 1.8),
        ('ALIGN', (1,0), (-1,-1), 'CENTER'),
    ]))
    story.append(t_test)
    story.append(Spacer(1, 3))

    test_summary = (
        "<b>Frontend Build Verification:</b> <code>npm --prefix frontend run build</code> completed in 2.20s with <b>0 TypeScript errors</b> "
        "and <b>0 Vite bundler errors</b> across 2,637 transformed modules.<br/>"
        "<b>Backend Automated Test Verification:</b> <code>pytest backend/</code> executed <b>38 core tests (65 expanded tests)</b> in 11.03s with a <b>100% pass rate</b>.<br/>"
        "<b>PDF Endpoint Verification:</b> <code>POST /api/export-pdf</code> returned HTTP 200 with a valid <code>%PDF-</code> binary stream."
    )
    story.append(Paragraph(test_summary, style_body))
    story.append(Spacer(1, 3))

    story.append(Paragraph("17. ADVANTAGES OF BIOCRYSTAL 3D", style_h1))
    story.append(HRFlowable(width="100%", thickness=1, color=TEAL, spaceBefore=1, spaceAfter=2))
    adv_text = (
        "<b>1. Unified Scientific Platform:</b> Replaces disjointed tools with an end-to-end alignment, translation, and thermodynamic suite.<br/>"
        "<b>2. Strict Anti-Hallucination Policy:</b> Only verified experimental PDB structures or mathematically derived B-DNA models are displayed.<br/>"
        "<b>3. Provenance &amp; Stale-Draft Guard:</b> Ensures that researchers never mistake previous analyses for unsubmitted draft edits.<br/>"
        "<b>4. Publication-Ready PDF Reports:</b> Instantly outputs multi-page vector clinical reports formatted for laboratory archiving."
    )
    story.append(Paragraph(adv_text, style_body))
    story.append(Spacer(1, 2))

    story.append(Paragraph("18. APPLICATIONS, LIMITATIONS &amp; FUTURE SCOPE", style_h1))
    story.append(HRFlowable(width="100%", thickness=1, color=TEAL, spaceBefore=1, spaceAfter=2))
    app_text = (
        "<b>Applications:</b> Oncological mutation screening, targeted drug design, academic pedagogy in molecular genetics, and primer verification.<br/>"
        "<b>Limitations:</b> Sequence lengths are currently bounded to educational/bench duplexes (1,000 bp); static PDB structures do not compute molecular dynamics trajectories.<br/>"
        "<b>Future Scope:</b> Integration of Clustal Omega for multiple sequence alignment, AlphaFold DB integration with explicit pLDDT confidence heatmaps, and automated VCF file parsing for clinical cohorts."
    )
    story.append(Paragraph(app_text, style_body))
    story.append(Spacer(1, 3))

    t_ph_test = Table([
        [make_ph_box("Figure 12", "Generated 4-Page Vector PDF Report Sample", 32),
         make_ph_box("Figure 13", "PyTest 38/38 Core Test Suite 100% Pass Output", 32)]
    ], colWidths=[250, 250])
    t_ph_test.setStyle(TableStyle([('VALIGN', (0,0), (-1,-1), 'MIDDLE')]))
    story.append(t_ph_test)
    story.append(PageBreak())

    # =========================================================================
    # PAGE 14 — CONCLUSION AND REFERENCES
    # =========================================================================
    story.append(Paragraph("21. CONCLUSION", style_h1))
    story.append(HRFlowable(width="100%", thickness=1, color=TEAL, spaceBefore=1, spaceAfter=4))
    concl_p = (
        "This experiential learning project successfully designed, developed, and validated <b>BioCrystal 3D</b>, an interactive, "
        "client-server DNA mutation analyzer, translation, and 3D macromolecular simulation workstation. By synthesizing global pairwise "
        "alignment (Needleman–Wunsch), codon-level consequence mapping (NCBI Table 1), peptide physicochemical telemetry, and duplex thermodynamics "
        "(SantaLucia 1998) into a unified reactive platform, BioCrystal 3D eliminates the dependency on disjointed bioinformatics command-line utilities. "
        "The system's dual 3D graphics architecture bridges sequence analysis with macromolecular space, while strict provenance labeling "
        "actively combats the proliferation of AI-generated structural hallucinations. Empirical validation across four canonical cancer driver "
        "benchmarks (KRAS G12D, BRAF V600E, EGFR L858R, TP53 R273H) confirmed mathematical and biophysical accuracy. With a 100% pass rate "
        "across 38 automated test cases, zero frontend build errors, and automated clinical-grade PDF reporting, BioCrystal 3D establishes "
        "a reliable, reproducible foundation for computational biology education and preclinical research."
    )
    story.append(Paragraph(concl_p, style_body))
    story.append(Spacer(1, 6))

    story.append(Paragraph("22. REFERENCES (IEEE FORMAT)", style_h1))
    story.append(HRFlowable(width="100%", thickness=1, color=TEAL, spaceBefore=1, spaceAfter=4))
    refs = [
        "[1] S. B. Needleman and C. D. Wunsch, “A general method applicable to the search for similarities in the amino acid sequence of two proteins,” <i>Journal of Molecular Biology</i>, vol. 48, no. 3, pp. 443–453, 1970.",
        "[2] J. SantaLucia Jr., “A unified view of polymer, dumbbell, and oligonucleotide DNA nearest-neighbor thermodynamics,” <i>Proceedings of the National Academy of Sciences USA</i>, vol. 95, no. 4, pp. 1460–1465, 1998.",
        "[3] H. T. Allawi and J. SantaLucia Jr., “Thermodynamics and NMR structure of internal G·T mismatches in DNA,” <i>Biochemistry</i>, vol. 36, no. 34, pp. 10581–10594, 1997.",
        "[4] J. Kyte and R. F. Doolittle, “A simple method for displaying the hydropathic character of a protein,” <i>Journal of Molecular Biology</i>, vol. 157, no. 1, pp. 105–132, 1982.",
        "[5] National Center for Biotechnology Information (NCBI), “The Genetic Codes (NCBI Table 1: Standard Genetic Code),” U.S. National Library of Medicine, Bethesda, MD, USA, 2024.",
        "[6] H. M. Berman, J. Westbrook, Z. Feng, G. Gilliland, T. N. Bhat, H. Weissig, I. N. Shindyalov, and P. E. Bourne, “The Protein Data Bank,” <i>Nucleic Acids Research</i>, vol. 28, no. 1, pp. 235–242, 2000.",
        "[7] P. J. A. Cock, C. J. Fields, N. Goto, M. L. Heuer, and P. M. Rice, “Biopython: freely available Python tools for computational molecular biology and bioinformatics,” <i>Bioinformatics</i>, vol. 25, no. 11, pp. 1422–1423, 2009.",
        "[8] N. Rego and D. Koes, “3Dmol.js: molecular visualization without Java,” <i>Bioinformatics</i>, vol. 31, no. 8, pp. 1322–1324, 2015.",
        "[9] S. Ramírez, “FastAPI: High performance, easy to learn, fast to code, ready for production,” Tiangolo Web Framework, 2023. [Online]. Available: https://fastapi.tiangolo.com",
        "[10] ReportLab Europe Ltd., “ReportLab PDF Generation User Guide (Version 3.6+ / 5.0+),” London, UK, 2024. [Online]. Available: https://www.reportlab.com",
    ]
    for r in refs:
        p_ref = Paragraph(r, ParagraphStyle('Ref', parent=style_body, fontSize=7.4, leading=10, spaceAfter=2.5))
        story.append(p_ref)

    # Build document
    doc.build(story, canvasmaker=NumberedCanvas)
    print(f"Report generated successfully: {pdf_filename}")

    # Verify exact page count using pypdf
    reader = pypdf.PdfReader(pdf_filename)
    num_pages = len(reader.pages)
    print(f"TOTAL PAGE COUNT: {num_pages}")
    return num_pages

if __name__ == "__main__":
    count = build_pdf_report()
    sys.exit(0 if count == 14 else 1)
