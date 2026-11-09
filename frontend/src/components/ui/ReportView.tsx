import React, { useState, useEffect, useCallback } from 'react';
import {
  Download,
  FileText,
  FileSpreadsheet,
  ExternalLink,
  RotateCcw,
  AlertTriangle,
} from 'lucide-react';
import {
  FullAnalysisResult,
  SequenceEditRecord,
} from '../../types/dna';
import { exportPdfAPI } from '../../services/apiService';

interface ReportViewProps {
  analysisResult: FullAnalysisResult;
  referenceSequence: string;
  originalSubmittedSequence: string;
  currentEditedSequence: string;
  lastAnalysedSequence: string;
  editHistory: SequenceEditRecord[];
  revision: number;
  gene: string;
  accession: string;
  organism: string;
  onReanalyse?: () => Promise<void>;
  isReanalysing?: boolean;
}

export const ReportView: React.FC<ReportViewProps> = ({
  analysisResult,
  referenceSequence,
  originalSubmittedSequence,
  currentEditedSequence,
  lastAnalysedSequence,
  editHistory,
  revision,
  gene,
  accession,
  organism,
  onReanalyse,
  isReanalysing,
}) => {
  const [pdfBlob, setPdfBlob] = useState<Blob | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [isLoadingPdf, setIsLoadingPdf] = useState<boolean>(true);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [isDownloading, setIsDownloading] = useState<boolean>(false);

  const isModified = currentEditedSequence !== lastAnalysedSequence;

  // Generate / Fetch PDF from ReportLab Backend
  const fetchPdfReport = useCallback(async () => {
    setIsLoadingPdf(true);
    setPdfError(null);

    try {
      const payload = {
        original_sequence: originalSubmittedSequence || lastAnalysedSequence,
        current_sequence: lastAnalysedSequence,
        reference_sequence: referenceSequence,
        gene,
        organism,
        accession,
        revision,
        edit_history: editHistory.map((e) => ({
          position: e.position,
          oldBases: e.oldBases,
          newBases: e.newBases,
          action: e.action,
          reason: e.reason,
          timestamp: e.timestamp,
        })),
        alignment: analysisResult.alignment,
        structure_mapping: analysisResult.structure_mapping,
        reference_validation: analysisResult.reference_validation,
        observed_validation: analysisResult.observed_validation,
      };

      const blob = await exportPdfAPI(payload);
      setPdfBlob(blob);

      // Create local object URL for preview
      const url = URL.createObjectURL(blob);
      setPdfUrl((prevUrl) => {
        if (prevUrl) URL.revokeObjectURL(prevUrl);
        return url;
      });
    } catch (err: any) {
      console.error('Error fetching PDF report:', err);
      setPdfError(err.message || 'Failed to generate 4-page scientific PDF report.');
    } finally {
      setIsLoadingPdf(false);
    }
  }, [
    originalSubmittedSequence,
    lastAnalysedSequence,
    referenceSequence,
    gene,
    organism,
    accession,
    revision,
    editHistory,
    analysisResult,
  ]);

  // Load PDF on mount and when analysis / revision changes
  useEffect(() => {
    fetchPdfReport();
    return () => {
      if (pdfUrl) {
        URL.revokeObjectURL(pdfUrl);
      }
    };
  }, [fetchPdfReport]);

  // Action: Download PDF File
  const handleDownloadPdf = () => {
    if (!pdfBlob) return;
    setIsDownloading(true);
    try {
      const filename = `BioCrystal_${gene}_Report_Rev${revision}.pdf`;
      const tempUrl = URL.createObjectURL(pdfBlob);
      const a = document.createElement('a');
      a.href = tempUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(tempUrl);
    } finally {
      setIsDownloading(false);
    }
  };

  // Action: Export Variants as CSV
  const handleExportCsv = () => {
    const mutations = analysisResult.alignment.mutations || [];
    const headers = [
      'Variant_ID',
      'Reference_Position',
      'Observed_Position',
      'Reference_Bases',
      'Observed_Bases',
      'Variant_Type',
      'Original_Codon',
      'Observed_Codon',
      'Amino_Acid_Change',
      'Consequence_Category',
      'Is_Transition',
      'Is_Transversion',
      'Gene',
      'Accession',
      'Revision',
    ];

    const rows = mutations.map((m, idx) => {
      const refB = m.reference_bases || m.original_base || '';
      const obsB = m.observed_bases || m.observed_base || '';
      const mType = m.mutation_type || m.type || '';
      const origCodon = m.original_codon || m.reference_codon || '';
      const obsCodon = m.observed_codon || '';
      const aaChg =
        m.amino_acid_change ||
        (m.original_amino_acid && m.observed_amino_acid
          ? `${m.original_amino_acid.code3}->${m.observed_amino_acid.code3}`
          : '');

      return [
        `VAR-${idx + 1}`,
        m.reference_position,
        m.observed_position || '',
        `"${refB}"`,
        `"${obsB}"`,
        mType,
        `"${origCodon}"`,
        `"${obsCodon}"`,
        `"${aaChg}"`,
        `"${m.category_label || m.category}"`,
        m.is_transition ? 'TRUE' : 'FALSE',
        m.is_transversion ? 'TRUE' : 'FALSE',
        gene,
        accession,
        revision,
      ];
    });

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const a = document.createElement('a');
    a.href = encodedUri;
    a.download = `BioCrystal_${gene}_Variants_Rev${revision}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const mutations = analysisResult.alignment.mutations || [];

  return (
    <div className="flex-1 flex flex-col h-full bg-[#090A0C] text-[#F4F4F2] font-mono select-none overflow-hidden">
      {/* ===================================================================
          1. REPORT ACTION TOOLBAR
      =================================================================== */}
      <div className="border-b border-[#2A2D33] px-5 py-2.5 bg-[#111316] flex items-center justify-between shrink-0 flex-wrap gap-2">
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-2">
            <FileText className="w-4 h-4 text-[#FF6500]" />
            <span className="text-xs font-bold uppercase tracking-wider text-[#F4F4F2]">
              Destination 3: Scientific Report
            </span>
          </div>

          <span className="text-[#3D424B]">|</span>

          <div className="flex items-center space-x-2 text-[11px]">
            <span className="px-2 py-0.5 rounded bg-[#17191D] text-[#35C98A] border border-[#2A2D33] font-bold">
              Revision {revision}
            </span>
            <span className="text-[#70757D]">
              Exact 4-Page SwissADME Architecture
            </span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center space-x-2">
          {/* Download 4-Page PDF */}
          <button
            type="button"
            onClick={handleDownloadPdf}
            disabled={!pdfBlob || isLoadingPdf || isDownloading}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded text-xs font-bold transition-all cursor-pointer shadow-md ${
              pdfBlob && !isLoadingPdf && !isDownloading
                ? 'bg-gradient-to-r from-[#FF6500] to-[#E05300] hover:from-[#FF7A1A] hover:to-[#FF6500] text-white shadow-[#FF6500]/20'
                : 'bg-[#1D2025] text-[#70757D] border border-[#2A2D33] cursor-not-allowed opacity-50'
            }`}
            title="Download the full 4-page SwissADME-style PDF report"
          >
            <Download className="w-3.5 h-3.5" />
            <span>{isDownloading ? 'Downloading...' : 'Download 4-Page PDF'}</span>
          </button>

          {/* Export CSV */}
          <button
            type="button"
            onClick={handleExportCsv}
            disabled={mutations.length === 0}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded bg-[#17191D] hover:bg-[#1D2025] text-[#35C98A] border border-[#2A2D33] text-xs font-bold transition-all cursor-pointer"
            title="Export all detected mutations as CSV"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Export CSV</span>
          </button>

          {/* Refresh Report */}
          <button
            type="button"
            onClick={fetchPdfReport}
            disabled={isLoadingPdf}
            className="p-1.5 rounded bg-[#17191D] hover:bg-[#1D2025] text-[#A0A3AA] hover:text-[#F4F4F2] border border-[#2A2D33] text-xs transition-all cursor-pointer"
            title="Refresh PDF from backend"
          >
            <RotateCcw className={`w-3.5 h-3.5 ${isLoadingPdf ? 'animate-spin text-[#FF6500]' : ''}`} />
          </button>

          {/* Open in New Tab */}
          {pdfUrl && (
            <a
              href={pdfUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="p-1.5 rounded bg-[#17191D] hover:bg-[#1D2025] text-[#22C7E8] border border-[#2A2D33] text-xs transition-all cursor-pointer"
              title="Open full PDF in a new browser tab"
            >
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          )}
        </div>
      </div>

      {/* ===================================================================
          2. STALE NOTICE (If sequence has unanalysed edits)
      =================================================================== */}
      {isModified && (
        <div className="bg-[#F3B347]/10 border-b border-[#F3B347]/30 px-5 py-2.5 flex items-center justify-between text-xs shrink-0 flex-wrap gap-2">
          <div className="flex items-center space-x-2">
            <AlertTriangle className="w-4 h-4 text-[#F3B347] shrink-0" />
            <span className="text-[#F3B347] font-semibold">
              Warning: Sequence has {editHistory.length} uncommitted edit(s).
            </span>
            <span className="text-[#A0A3AA] hidden md:inline">
              This preview reflects Revision {revision} (from your last analysis run).
            </span>
          </div>

          {onReanalyse && (
            <button
              type="button"
              onClick={onReanalyse}
              disabled={isReanalysing}
              className="flex items-center space-x-1.5 px-3 py-1 rounded bg-[#FF6500] hover:bg-[#FF7A1A] text-white text-xs font-bold transition-all cursor-pointer shadow-sm"
            >
              {isReanalysing ? (
                <>
                  <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Reanalysing...</span>
                </>
              ) : (
                <>
                  <RotateCcw className="w-3 h-3" />
                  <span>Reanalyse & Update Report</span>
                </>
              )}
            </button>
          )}
        </div>
      )}

      {/* ===================================================================
          3. MAIN PREVIEW AREA
      =================================================================== */}
      <div className="flex-1 min-h-0 flex overflow-hidden">
        {/* Left Information Strip */}
        <div className="w-64 border-r border-[#2A2D33] bg-[#111316] p-4 flex flex-col justify-between shrink-0 hidden md:flex text-xs space-y-4 overflow-y-auto">
          <div className="space-y-4">
            <div>
              <span className="text-[10px] text-[#70757D] uppercase font-bold block mb-1">
                Report Metadata
              </span>
              <div className="space-y-2 bg-[#090A0C] p-2.5 rounded border border-[#2A2D33] text-[11px]">
                <div className="flex justify-between">
                  <span className="text-[#70757D]">Target Gene:</span>
                  <span className="font-bold text-[#F4F4F2]">{gene}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#70757D]">Accession:</span>
                  <span className="text-[#22C7E8] font-mono text-[10px]">{accession}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#70757D]">Organism:</span>
                  <span className="text-[#F4F4F2]">{organism}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#70757D]">Revision:</span>
                  <span className="text-[#35C98A] font-bold">Rev {revision}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#70757D]">Total Pages:</span>
                  <span className="text-[#FF6500] font-bold">4 Pages (A4)</span>
                </div>
              </div>
            </div>

            <div>
              <span className="text-[10px] text-[#70757D] uppercase font-bold block mb-1">
                Report Page Guide
              </span>
              <div className="space-y-1.5 text-[10px] text-[#A0A3AA]">
                <div className="p-2 rounded bg-[#090A0C] border border-[#2A2D33]">
                  <span className="text-[#35C98A] font-bold block">Page 1: Overview & Metrics</span>
                  <span>Input identity, GC%, Tm, length & factual synthesis.</span>
                </div>
                <div className="p-2 rounded bg-[#090A0C] border border-[#2A2D33]">
                  <span className="text-[#22C7E8] font-bold block">Page 2: Pairwise Alignment</span>
                  <span>Needleman-Wunsch ribbon, difference map & mutation table.</span>
                </div>
                <div className="p-2 rounded bg-[#090A0C] border border-[#2A2D33]">
                  <span className="text-[#A78BFA] font-bold block">Page 3: Details & Audit</span>
                  <span>Variant cards, sequence edit audit & PDB 3D mapping.</span>
                </div>
                <div className="p-2 rounded bg-[#090A0C] border border-[#2A2D33]">
                  <span className="text-[#FF6500] font-bold block">Page 4: Methodology & Legal</span>
                  <span>Algorithms, scientific limitations & SwissADME notice.</span>
                </div>
              </div>
            </div>
          </div>

          <div className="p-2.5 rounded bg-[#090A0C] border border-[#2A2D33] text-[10px] text-[#70757D] space-y-1">
            <span className="font-bold text-[#A0A3AA] block">ReportLab 5.x Engine</span>
            <span>Strict vertical height budgeting ensures exact 4-page pagination.</span>
          </div>
        </div>

        {/* Central PDF Viewer Frame */}
        <div className="flex-1 bg-[#1A1D20] flex items-center justify-center p-2 relative overflow-hidden">
          {isLoadingPdf ? (
            <div className="flex flex-col items-center justify-center space-y-3 text-xs text-[#A0A3AA]">
              <span className="w-8 h-8 border-3 border-[#FF6500]/30 border-t-[#FF6500] rounded-full animate-spin" />
              <span className="font-bold text-[#F4F4F2]">
                Rendering publication-grade 4-page PDF report...
              </span>
              <span className="text-[11px] text-[#70757D]">
                ReportLab Biopython engine running at /api/export-pdf
              </span>
            </div>
          ) : pdfError ? (
            <div className="max-w-md bg-[#111316] border border-[#F06464]/30 rounded-lg p-5 text-center space-y-3">
              <AlertTriangle className="w-8 h-8 text-[#F06464] mx-auto" />
              <div className="font-bold text-[#F06464] text-sm">Failed to Generate PDF Report</div>
              <p className="text-xs text-[#A0A3AA]">{pdfError}</p>
              <button
                type="button"
                onClick={fetchPdfReport}
                className="px-4 py-1.5 rounded bg-[#FF6500] hover:bg-[#FF7A1A] text-white text-xs font-bold transition-all cursor-pointer"
              >
                Retry Generation
              </button>
            </div>
          ) : pdfUrl ? (
            <iframe
              src={pdfUrl}
              title="BioCrystal 3D Four-Page Scientific PDF Report"
              className="w-full h-full rounded border border-[#2A2D33] bg-white shadow-2xl"
            />
          ) : null}
        </div>
      </div>
    </div>
  );
};
