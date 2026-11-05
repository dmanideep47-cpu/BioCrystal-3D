import React, { useState } from 'react';
import {
  SequenceValidationResult,
  MutationDiff,
  ReferenceSequence,
} from '../../types/dna';
import {
  generateComplementaryStrand,
} from '../../services/bioinformatics';
import { jsPDF } from 'jspdf';
import {
  Download,
  FileText,
  Database,
  Printer,
  ShieldCheck,
} from 'lucide-react';

interface ReportViewProps {
  originalSequence: string;
  mutatedSequence: string;
  mutationDiff: MutationDiff | null;
  validation: SequenceValidationResult;
  referenceSeq?: ReferenceSequence | null;
}

export const ReportView: React.FC<ReportViewProps> = ({
  originalSequence,
  mutatedSequence: _mutatedSequence,
  mutationDiff,
  validation,
  referenceSeq,
}) => {
  const compOrig = generateComplementaryStrand(originalSequence);
  const [reportDate] = useState(() => new Date().toISOString().split('T')[0]);

  // PDF Export generation using jsPDF
  const exportPDF = () => {
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    });

    const primaryColor = [255, 116, 23]; // Accent Orange
    const textColor = [20, 20, 20];
    const subColor = [100, 100, 100];

    let y = 18;

    // Header Title
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(textColor[0], textColor[1], textColor[2]);
    doc.text('BIOCRYSTAL 3D: DNA MUTATION ANALYSIS REPORT', 14, y);

    y += 7;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(subColor[0], subColor[1], subColor[2]);
    doc.text(`Generated: ${reportDate} | Simulation Core: Canonical B-DNA Engine v2.4`, 14, y);

    y += 8;
    doc.setDrawColor(220, 220, 220);
    doc.line(14, y, 196, y);

    // Section 1: Sequence Summary
    y += 8;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(textColor[0], textColor[1], textColor[2]);
    doc.text('1. Input Sequence & Biophysical Properties', 14, y);

    y += 6;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.text(`Original Sequence (${originalSequence.length} bp, 5' -> 3'):`, 14, y);
    y += 5;
    doc.setFont('courier', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.text(originalSequence, 14, y);

    y += 5;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.setTextColor(textColor[0], textColor[1], textColor[2]);
    doc.text(`Complementary Strand (3' <- 5'):`, 14, y);
    y += 5;
    doc.setFont('courier', 'normal');
    doc.setFontSize(9);
    doc.text(compOrig, 14, y);

    y += 7;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(`GC Content: ${validation.gcPercent}% | AT Content: ${validation.atPercent}% | Melting Temp (Tm): ${validation.meltingTemperature} °C | Mol. Weight: ${validation.molecularWeightKDa} kDa`, 14, y);

    // Section 2: Mutation Differential
    y += 10;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text('2. Mutation Differential & Consequence Evaluation', 14, y);

    y += 6;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    if (mutationDiff) {
      const origB = mutationDiff.originalBase || '-';
      const mutB = mutationDiff.newBase || mutationDiff.insertedBases || '-';
      const origAA = mutationDiff.originalAminoAcid ? `${mutationDiff.originalAminoAcid.name} (${mutationDiff.originalAminoAcid.code3})` : 'N/A';
      const mutAA = mutationDiff.mutatedAminoAcid ? `${mutationDiff.mutatedAminoAcid.name} (${mutationDiff.mutatedAminoAcid.code3})` : 'N/A';

      doc.text(`Observed Mutation at Position #${mutationDiff.position}: ${origB} -> ${mutB} (${mutationDiff.type.toUpperCase()})`, 14, y);
      y += 5;
      doc.text(`Classification: ${mutationDiff.categoryLabel}`, 14, y);
      y += 5;
      doc.text(`Codon Shift: ${mutationDiff.originalCodon || 'N/A'} -> ${mutationDiff.mutatedCodon || 'N/A'}`, 14, y);
      y += 5;
      doc.text(`Translation Consequence: ${origAA} -> ${mutAA}`, 14, y);
      y += 5;
      doc.text(`Recommended Restoration: Change ${mutB} -> ${origB} at Position ${mutationDiff.position}`, 14, y);
    } else {
      doc.text('No sequence differences observed relative to canonical wild-type.', 14, y);
    }

    // Section 3: Data Sources
    y += 10;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text('3. Data Sources & Authority References', 14, y);
    y += 6;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.text('• NCBI Nucleotide & RefSeq Database: Standard Genetic Code (Table 1)', 14, y);
    y += 4.5;
    doc.text('• Ensembl Genome Browser / RCSB Protein Data Bank (PDB coordinates: 1BNA, 1A3N, 1TUP)', 14, y);
    if (referenceSeq) {
      y += 4.5;
      doc.text(`• Active Reference: ${referenceSeq.name} (${referenceSeq.accessionNumber})`, 14, y);
    }

    // Section 4: Modeling Limitations
    y += 9;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text('4. Modeling Assumptions & Limitations', 14, y);
    y += 6;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text('• 3D coordinates reflect canonical B-DNA double-helical parameters: 3.4 Å helical rise per base pair, 36.0° helical twist, 10.0 bp per turn, with antiparallel strands phase-offset at 144° creating canonical major and minor grooves.', 14, y, { maxWidth: 180 });
    y += 8;
    doc.text('• In-silico translation follows standard codon tables. Phenotypic impact or clinical consequence cannot be inferred without wet-lab assays.', 14, y, { maxWidth: 180 });

    doc.save(`BioCrystal_DNA_Report_Pos${mutationDiff?.position || 'ref'}.pdf`);
  };

  return (
    <div className="h-full flex flex-col bg-[#080808] overflow-y-auto p-6 max-w-5xl mx-auto space-y-5 select-none font-mono">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between pb-3 border-b border-[#292929] gap-4">
        <div>
          <h2 className="text-sm font-bold text-[#f5f5f5] uppercase tracking-wider flex items-center space-x-2">
            <FileText className="w-4 h-4 text-[#ff7417]" />
            <span>Scientific Analysis & Mutation Consequence Report</span>
          </h2>
          <p className="text-[11px] text-[#a3a3a3] mt-0.5 font-sans">
            Formal computational biology evaluation report conforming to molecular genetics standards.
          </p>
        </div>

        <div className="flex items-center space-x-2 text-xs">
          <button
            onClick={() => window.print()}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded bg-[#151515] hover:bg-[#1c1c1c] text-[#f5f5f5] border border-[#292929] transition-all cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print</span>
          </button>
          <button
            onClick={async () => {
              try {
                const res = await fetch('/api/export-pdf', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    original_sequence: originalSequence,
                    complementary_sequence: compOrig,
                    gc_percent: validation.gcPercent,
                    at_percent: validation.atPercent,
                    melting_temp: validation.meltingTemperature,
                    molecular_weight_kda: validation.molecularWeightKDa,
                    mutation_diff: mutationDiff,
                    reference_sequence: referenceSeq ? referenceSeq.sequence : null,
                  }),
                });
                if (res.ok) {
                  const blob = await res.blob();
                  const url = window.URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = 'BioCrystal_Scientific_DNA_Report.pdf';
                  document.body.appendChild(a);
                  a.click();
                  window.URL.revokeObjectURL(url);
                  return;
                }
              } catch {
                // fallback to client-side jsPDF
              }
              exportPDF();
            }}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded bg-[#1c1c1c] text-[#36c5e8] border border-[#292929] hover:border-[#36c5e8]/50 transition-all cursor-pointer"
            title="Download SwissADME-style Scientific Report (ReportLab)"
          >
            <Download className="w-3.5 h-3.5" />
            <span>ReportLab PDF</span>
          </button>
          <button
            onClick={exportPDF}
            className="flex items-center space-x-1.5 px-3.5 py-1.5 rounded bg-[#f5f5f5] hover:bg-white text-[#080808] font-bold transition-all cursor-pointer shadow-sm"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export PDF</span>
          </button>
        </div>
      </div>

      {/* Report Document Container */}
      <div className="bg-[#151515] border border-[#292929] rounded p-6 space-y-5 shadow-lg">
        {/* Document Title Banner */}
        <div className="pb-3 border-b border-[#292929] flex justify-between items-start">
          <div>
            <span className="text-[10px] uppercase tracking-wider text-[#ff7417] font-bold block mb-1">
              BioCrystal 3D Computational Report
            </span>
            <h3 className="text-base font-bold text-[#f5f5f5]">
              DNA Sequence & Molecular Mutation Assessment
            </h3>
            <p className="text-[11px] text-[#a3a3a3] mt-0.5 font-sans">
              Reference: {referenceSeq ? referenceSeq.name : 'Canonical Wild-Type'} &bull; Database: {referenceSeq?.database || 'NCBI GenBank'}
            </p>
          </div>
          <div className="text-right text-[11px] text-[#686868]">
            <div>Date: {reportDate}</div>
            <div>Model: B-DNA Canonical</div>
          </div>
        </div>

        {/* 1. Sequence & Chemical Profile */}
        <div className="space-y-2.5">
          <h4 className="text-xs font-bold text-[#f5f5f5] uppercase tracking-wider">
            1. Sequence Properties & Biophysics
          </h4>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
            <div className="bg-[#101010] p-2.5 rounded border border-[#292929]">
              <span className="text-[#686868] text-[10px] block">Length</span>
              <span className="font-bold text-[#36c5e8] text-sm">{originalSequence.length} bp</span>
            </div>
            <div className="bg-[#101010] p-2.5 rounded border border-[#292929]">
              <span className="text-[#686868] text-[10px] block">GC Content</span>
              <span className="font-bold text-[#42cf91] text-sm">{validation.gcPercent}%</span>
            </div>
            <div className="bg-[#101010] p-2.5 rounded border border-[#292929]">
              <span className="text-[#686868] text-[10px] block">AT Content</span>
              <span className="font-bold text-[#ff7417] text-sm">{validation.atPercent}%</span>
            </div>
            <div className="bg-[#101010] p-2.5 rounded border border-[#292929]">
              <span className="text-[#686868] text-[10px] block">Melting Temp</span>
              <span className="font-bold text-[#f4b942] text-sm">{validation.meltingTemperature} °C</span>
            </div>
          </div>

          {/* Sequences */}
          <div className="space-y-1.5 pt-1 text-xs">
            <div className="p-2 rounded bg-[#101010] border border-[#292929]">
              <span className="text-[#686868] text-[10px] block mb-0.5">
                Coding Sense Strand (5' &rarr; 3'):
              </span>
              <span className="text-[#36c5e8] tracking-wider break-all">{originalSequence}</span>
            </div>
            <div className="p-2 rounded bg-[#101010] border border-[#292929]">
              <span className="text-[#686868] text-[10px] block mb-0.5">
                Antiparallel Complementary Strand (3' &larr; 5'):
              </span>
              <span className="text-[#a78bfa] tracking-wider break-all">{compOrig}</span>
            </div>
          </div>
        </div>

        {/* 2. Mutation Analysis */}
        <div className="space-y-2.5 pt-2 border-t border-[#292929]">
          <h4 className="text-xs font-bold text-[#f5f5f5] uppercase tracking-wider">
            2. Genetic Mutation Consequence Evaluation
          </h4>

          {mutationDiff ? (
            <div className="bg-[#101010] border border-[#292929] rounded p-3.5 space-y-3 text-xs">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center space-x-2">
                  <span className="text-[#686868]">Classification:</span>
                  <span
                    className={`font-bold px-2 py-0.5 rounded text-xs ${
                      mutationDiff.category === 'synonymous'
                        ? 'bg-[#42cf91]/15 text-[#42cf91] border border-[#42cf91]/30'
                        : mutationDiff.category === 'nonsense'
                        ? 'bg-[#ff626b]/15 text-[#ff626b] border border-[#ff626b]/30'
                        : 'bg-[#f4b942]/15 text-[#f4b942] border border-[#f4b942]/30'
                    }`}
                  >
                    {mutationDiff.categoryLabel}
                  </span>
                </div>

                <div className="text-[#a3a3a3]">
                  Target Position: <span className="text-[#ff7417] font-bold">#{mutationDiff.position}</span>
                </div>
              </div>

              {/* Codon & Translation Table */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div className="p-2.5 rounded bg-[#151515] border border-[#292929] space-y-0.5">
                  <span className="text-[10px] text-[#686868] uppercase font-semibold">Reference State</span>
                  <div className="text-xs text-[#36c5e8] font-bold">
                    Codon: {mutationDiff.originalCodon || 'N/A'}
                  </div>
                  <div className="text-[11px] text-[#a3a3a3]">
                    Amino Acid: {mutationDiff.originalAminoAcid?.name} ({mutationDiff.originalAminoAcid?.code3})
                  </div>
                </div>

                <div className="p-2.5 rounded bg-[#151515] border border-[#292929] space-y-0.5">
                  <span className="text-[10px] text-[#ff7417] uppercase font-semibold">Mutated State</span>
                  <div className="text-xs text-[#ff7417] font-bold">
                    Codon: {mutationDiff.mutatedCodon || 'N/A'}
                  </div>
                  <div className="text-[11px] text-[#a3a3a3]">
                    Amino Acid: {mutationDiff.mutatedAminoAcid?.name} ({mutationDiff.mutatedAminoAcid?.code3})
                  </div>
                </div>
              </div>

              {/* Biological Narrative */}
              <div className="p-2.5 rounded bg-[#151515] border border-[#292929] text-xs text-[#a3a3a3] leading-relaxed">
                <p className="font-semibold text-[#f5f5f5] mb-0.5">Computational Interpretation:</p>
                <p className="text-[11px] text-[#a3a3a3] font-sans">{mutationDiff.description}</p>
              </div>

              {/* Suggested Reference Restoration */}
              <div className="p-2.5 rounded bg-[#151515] border border-[#292929] text-xs text-[#42cf91] flex items-center space-x-2">
                <ShieldCheck className="w-4 h-4 shrink-0" />
                <span>
                  Suggested Reference Restoration: Revert position #{mutationDiff.position} from {mutationDiff.newBase || mutationDiff.insertedBases || '-'} &rarr; {mutationDiff.originalBase || '-'}
                </span>
              </div>
            </div>
          ) : (
            <div className="p-3.5 rounded bg-[#101010] border border-[#292929] text-xs text-[#686868] font-sans">
              No mutation currently introduced. To evaluate consequences, navigate to the <strong>Mutation Laboratory</strong> or select a nucleotide in the 3D model.
            </div>
          )}
        </div>

        {/* 3. Authoritative Biological Data Sources */}
        <div className="space-y-1.5 pt-2 border-t border-[#292929] text-xs">
          <h4 className="font-bold text-[#f5f5f5] uppercase tracking-wider text-[10px] flex items-center space-x-1.5">
            <Database className="w-3.5 h-3.5 text-[#ff7417]" />
            <span>Authoritative Data Sources</span>
          </h4>
          <ul className="text-[#a3a3a3] space-y-0.5 pl-4 list-disc text-[11px] font-sans">
            <li>NCBI Nucleotide & RefSeq Database (National Center for Biotechnology Information).</li>
            <li>Ensembl Genome Browser (EMBL-EBI / Wellcome Sanger Institute).</li>
            <li>RCSB Protein Data Bank (PDB structures: 1BNA, 1A3N, 1TUP).</li>
            <li>Standard Genetic Code (NCBI translation table 1).</li>
          </ul>
        </div>

        {/* 4. Modeling Limitations & Disclaimers */}
        <div className="space-y-1.5 pt-2 border-t border-[#292929] text-[10px] text-[#686868] leading-relaxed font-sans">
          <h4 className="font-bold text-[#a3a3a3] uppercase tracking-wider text-[10px]">
            Modeling Assumptions & Scientific Disclaimers
          </h4>
          <p>
            The 3D model visualizes canonical right-handed B-DNA geometry with 3.4 Å axial rise per base pair, 36.0° helical rotation, and antiparallel strand geometry with a 144° minor groove angle.
          </p>
          <p>
            Computational translation reflects standard genetic code assignments. In-silico neutrality (e.g. synonymous mutations) does not preclude potential regulatory or splicing consequences in vivo.
          </p>
        </div>
      </div>
    </div>
  );
};
