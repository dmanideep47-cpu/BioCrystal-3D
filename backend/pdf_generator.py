import io
from typing import Dict, Any, Optional, List
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.platypus import (
    SimpleDocTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
    HRFlowable,
    KeepTogether,
)
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle


def generate_pdf_report(report_data: Dict[str, Any]) -> bytes:
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=letter,
        rightMargin=36,
        leftMargin=36,
        topMargin=36,
        bottomMargin=36,
    )

    styles = getSampleStyleSheet()

    # Brand Colors inspired by scientific laboratory dashboards
    c_primary = colors.HexColor('#0284c7')      # Ocean Blue
    c_dark = colors.HexColor('#0f172a')         # Slate 900
    c_subtle = colors.HexColor('#475569')       # Slate 600
    c_bg_light = colors.HexColor('#f8fafc')     # Light table bg
    c_border = colors.HexColor('#cbd5e1')       # Border color
    c_amber = colors.HexColor('#b45309')        # Mutation warning
    c_green = colors.HexColor('#15803d')        # Candidate success

    title_style = ParagraphStyle(
        'DocTitle',
        parent=styles['Heading1'],
        fontSize=17,
        leading=21,
        textColor=c_primary,
        fontName='Helvetica-Bold',
        spaceAfter=2,
    )

    subtitle_style = ParagraphStyle(
        'DocSubtitle',
        parent=styles['Normal'],
        fontSize=9,
        leading=13,
        textColor=c_subtle,
        fontName='Helvetica',
        spaceAfter=6,
    )

    h2_style = ParagraphStyle(
        'SectionH2',
        parent=styles['Heading2'],
        fontSize=11,
        leading=15,
        textColor=c_dark,
        fontName='Helvetica-Bold',
        spaceBefore=11,
        spaceAfter=4,
    )

    body_style = ParagraphStyle(
        'BodyDark',
        parent=styles['Normal'],
        fontSize=8.5,
        leading=12.5,
        textColor=c_dark,
        fontName='Helvetica',
    )

    mono_style = ParagraphStyle(
        'MonoSeq',
        parent=styles['Code'],
        fontSize=8,
        leading=10.5,
        textColor=colors.HexColor('#0369a1'),
        fontName='Courier',
        backColor=colors.HexColor('#f1f5f9'),
    )

    callout_style = ParagraphStyle(
        'CalloutText',
        parent=styles['Normal'],
        fontSize=8,
        leading=11.5,
        textColor=c_subtle,
        fontName='Helvetica',
    )

    disclaimer_style = ParagraphStyle(
        'Disclaimer',
        parent=styles['Normal'],
        fontSize=7.5,
        leading=10.5,
        textColor=colors.HexColor('#64748b'),
        fontName='Helvetica-Oblique',
    )

    elements = []

    # Title Banner (SwissADME style clean header)
    elements.append(Paragraph("BIOCRYSTAL 3D: DNA MUTATION DETECTION & CORRECTION REPORT", title_style))
    elements.append(Paragraph("Scientific Computational Biology & Structural Genetic Assessment Platform", subtitle_style))
    elements.append(HRFlowable(width="100%", thickness=1.5, color=c_primary, spaceAfter=10))

    # 1. Executive Summary & Biophysical Metrics
    elements.append(Paragraph("1. Sequence Identification & Biophysical Metrics", h2_style))
    orig_seq = report_data.get('original_sequence', '').strip().upper()
    comp_seq = report_data.get('complementary_sequence', '')
    ref_seq = report_data.get('reference_sequence', '')
    gc_pct = report_data.get('gc_percent', 0.0)
    at_pct = report_data.get('at_percent', 0.0)
    tm = report_data.get('melting_temp', 0.0)
    mw = report_data.get('molecular_weight_kda', 0.0)

    summary_data = [
        ["Query Sequence Length", f"{len(orig_seq)} bp", "GC Content", f"{gc_pct}%"],
        ["Base Composition (AT)", f"{at_pct}%", "Melting Temp (Tm)", f"{tm} °C"],
        ["Est. MW (ssDNA)", f"{mw} kDa", "Analysis Mode", "Ref-Guided" if ref_seq else "Sequence-Only"],
    ]
    t = Table(summary_data, colWidths=[120, 150, 120, 150])
    t.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), c_bg_light),
        ('TEXTCOLOR', (0, 0), (-1, -1), c_dark),
        ('FONTNAME', (0, 0), (-1, -1), 'Helvetica'),
        ('FONTSIZE', (0, 0), (-1, -1), 8.5),
        ('GRID', (0, 0), (-1, -1), 0.5, c_border),
        ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
        ('FONTNAME', (2, 0), (2, -1), 'Helvetica-Bold'),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
        ('TOPPADDING', (0, 0), (-1, -1), 4),
    ]))
    elements.append(t)
    elements.append(Spacer(1, 6))

    elements.append(Paragraph("<b>Submitted Observed Sequence (5' &rarr; 3'):</b>", body_style))
    elements.append(Paragraph(orig_seq if orig_seq else "None", mono_style))
    if ref_seq:
        elements.append(Paragraph("<b>Reference Wild-Type Sequence (5' &rarr; 3'):</b>", body_style))
        elements.append(Paragraph(ref_seq, mono_style))
    elif comp_seq:
        elements.append(Paragraph("<b>Complementary Strand (3' &larr; 5'):</b>", body_style))
        elements.append(Paragraph(comp_seq, mono_style))
    elements.append(Spacer(1, 8))

    # 2. Mutation Differential & Consequence Classification
    elements.append(Paragraph("2. Mutation Differential & Consequence Classification", h2_style))
    mutations_list = report_data.get('mutations_list') or []
    diff = report_data.get('mutation_diff')

    if mutations_list:
        table_rows = [["Locus", "Ref", "Obs", "Type", "Codon Shift", "Consequence"]]
        for m in mutations_list:
            ref_pos = str(m.get('reference_position', '-'))
            ref_b = str(m.get('original_base', '-'))
            obs_b = str(m.get('observed_base', '-'))
            m_type = str(m.get('type', '-')).capitalize()
            ref_c = m.get('reference_codon') or '-'
            obs_c = m.get('observed_codon') or '-'
            codon_str = f"{ref_c} &rarr; {obs_c}" if ref_c != '-' else '-'
            cat_label = str(m.get('category_label', m.get('category', 'Unknown')))
            table_rows.append([ref_pos, ref_b, obs_b, m_type, codon_str, cat_label])

        m_table = Table(table_rows, colWidths=[45, 35, 35, 75, 140, 210])
        m_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#e2e8f0')),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('GRID', (0, 0), (-1, -1), 0.5, c_border),
            ('FONTNAME', (0, 1), (-1, -1), 'Helvetica'),
            ('FONTSIZE', (0, 0), (-1, -1), 8),
            ('TEXTCOLOR', (0, 0), (-1, -1), c_dark),
            ('TOPPADDING', (0, 0), (-1, -1), 3),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
        ]))
        elements.append(m_table)
    elif diff:
        single_row = [
            ["Position", str(diff.get('position')), "Classification", diff.get('category_label', 'N/A')],
            ["Original Codon", str(diff.get('original_codon')), "Mutated Codon", str(diff.get('mutated_codon'))],
            [
                "Original Product",
                f"{diff.get('original_amino_acid', {}).get('name', '')} ({diff.get('original_amino_acid', {}).get('code3', '')})",
                "Mutated Product",
                f"{diff.get('mutated_amino_acid', {}).get('name', '')} ({diff.get('mutated_amino_acid', {}).get('code3', '')})",
            ],
        ]
        s_table = Table(single_row, colWidths=[100, 150, 120, 170])
        s_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#f1f5f9')),
            ('GRID', (0, 0), (-1, -1), 0.5, c_border),
            ('FONTNAME', (0, 0), (-1, -1), 'Helvetica'),
            ('FONTSIZE', (0, 0), (-1, -1), 8.5),
            ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
            ('FONTNAME', (2, 0), (2, -1), 'Helvetica-Bold'),
        ]))
        elements.append(s_table)
        if diff.get('description'):
            elements.append(Spacer(1, 4))
            elements.append(Paragraph(f"<b>Consequence Detail:</b> {diff.get('description')}", body_style))
    else:
        elements.append(Paragraph("Exploratory analysis: No confirmed mutations asserted without reference sequence.", callout_style))

    elements.append(Spacer(1, 8))

    # 3. Candidate Correction Recommendations
    elements.append(Paragraph("3. Intelligent Candidate Correction Recommendations", h2_style))
    candidates = report_data.get('candidates') or []
    if candidates:
        cand_rows = [["Rank", "Strategy / Title", "Edits", "GC%", "Translation Match", "Objective Fit"]]
        for idx, c in enumerate(candidates[:5]):
            cand_rows.append([
                f"#{idx + 1}",
                c.get('title', 'Candidate'),
                str(c.get('edits_count', 0)),
                f"{c.get('resulting_gc_percent', 0)}%",
                "Yes" if c.get('protein_preserved') else "No",
                f"{c.get('objective_fit_score', c.get('score', 0)):.1f}",
            ])

        c_table = Table(cand_rows, colWidths=[40, 220, 45, 60, 110, 65])
        c_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#e0f2fe')),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('GRID', (0, 0), (-1, -1), 0.5, c_border),
            ('FONTNAME', (0, 1), (-1, -1), 'Helvetica'),
            ('FONTSIZE', (0, 0), (-1, -1), 8),
            ('TEXTCOLOR', (0, 0), (-1, -1), c_dark),
            ('TOPPADDING', (0, 0), (-1, -1), 3),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
        ]))
        elements.append(c_table)
        elements.append(Spacer(1, 6))

        # Top candidate detail
        top_c = candidates[0]
        elements.append(Paragraph(f"<b>Top Ranked Proposal:</b> {top_c.get('title')}", body_style))
        elements.append(Paragraph(f"<b>Objective Rationale:</b> {top_c.get('rationale')}", callout_style))
        if top_c.get('score_label'):
            elements.append(Paragraph(f"<b>Ranking metric:</b> {top_c.get('score_label')}", callout_style))
        for edit in top_c.get('edits_detail') or []:
            elements.append(Paragraph(f"&bull; {edit}", callout_style))
        elements.append(Paragraph("<b>Candidate Sequence:</b>", body_style))
        elements.append(Paragraph(top_c.get('sequence', ''), mono_style))
    else:
        notice = report_data.get('recommendation_notice') or "No candidate was generated for this session."
        elements.append(Paragraph(str(notice), callout_style))

    ranking_basis = report_data.get('ranking_basis')
    recommendation_status = report_data.get('recommendation_status')
    if recommendation_status:
        elements.append(Paragraph(f"<b>Assessment status:</b> {recommendation_status}", callout_style))
    if ranking_basis:
        elements.append(Paragraph(f"<b>Ranking basis:</b> {ranking_basis}", callout_style))
    if report_data.get('recommendation_notice'):
        elements.append(Paragraph(f"<b>Assessment note:</b> {report_data.get('recommendation_notice')}", callout_style))

    elements.append(Spacer(1, 10))

    # 4. Applied Candidate Before/After Comparison
    elements.append(Paragraph("4. Applied Candidate Before/After Comparison", h2_style))
    before_sequence = (report_data.get('before_sequence') or '').strip().upper()
    applied_candidate = report_data.get('applied_candidate') or {}
    if before_sequence and applied_candidate.get('sequence'):
        elements.append(Paragraph("<b>Before application:</b>", body_style))
        elements.append(Paragraph(before_sequence, mono_style))
        elements.append(Paragraph("<b>After application:</b>", body_style))
        elements.append(Paragraph(str(applied_candidate.get('sequence', '')), mono_style))
        elements.append(Paragraph(
            f"<b>Applied proposal:</b> {applied_candidate.get('title', 'Candidate')}",
            body_style
        ))
        for edit in applied_candidate.get('edits_detail') or []:
            elements.append(Paragraph(f"&bull; {edit}", callout_style))
        if applied_candidate.get('rationale'):
            elements.append(Paragraph(
                f"<b>Objective rationale:</b> {applied_candidate.get('rationale')}",
                callout_style
            ))
        elements.append(Paragraph(
            "The comparison records the software state before and after candidate application. "
            "It does not establish experimental or clinical benefit.",
            disclaimer_style
        ))
    else:
        elements.append(Paragraph(
            "No candidate application was recorded in this report. Candidate proposals, if present, remain previews.",
            callout_style
        ))

    elements.append(Spacer(1, 10))

    # 5. Computational Methodology & Scientific Safeguards
    elements.append(Paragraph("5. Computational Methodology & Scientific Limitations", h2_style))
    elements.append(Paragraph(
        "• Pairwise Alignment: Conducted via Biopython <code>Bio.Align.PairwiseAligner</code> implementing global Needleman-Wunsch dynamic programming.",
        callout_style
    ))
    elements.append(Paragraph(
        "• Translation & Codon Mapping: NCBI Translation Table 1 (Standard Genetic Code). Consequence categories follow Sequence Ontology guidelines.",
        callout_style
    ))
    elements.append(Paragraph(
        "• Biophysical Estimates: Nearest-neighbor thermodynamics (SantaLucia 1998) for Tm; ssDNA mass estimation via molecular weight summing.",
        callout_style
    ))
    elements.append(Spacer(1, 6))
    elements.append(Paragraph(
        "Scientific Safeguards Notice: BioCrystal 3D candidate recommendations are computational hypotheses. "
        "Sequence modifications must never be implemented in biological systems without experimental wet-lab validation and clinical diagnostic verification.",
        disclaimer_style
    ))

    doc.build(elements)
    buffer.seek(0)
    return buffer.getvalue()
