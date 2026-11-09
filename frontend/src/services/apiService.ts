import {
  SequenceValidationResult,
  FullAnalysisResult,
  StructureMappingResult,
} from '../types/dna';

const API_BASE = 'http://127.0.0.1:8000';

export async function validateSequenceAPI(sequence: string): Promise<SequenceValidationResult> {
  const response = await fetch(`${API_BASE}/api/validate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sequence }),
  });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || `Validation failed with status ${response.status}`);
  }
  return response.json();
}

export async function compareSequencesAPI(params: {
  reference_sequence: string;
  observed_sequence: string;
  reading_frame?: number;
  table_id?: number;
  gene?: string;
  pdb_id?: string;
  is_coding?: boolean;
}): Promise<FullAnalysisResult> {
  const response = await fetch(`${API_BASE}/api/compare`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || `Analysis failed with status ${response.status}`);
  }
  return response.json();
}

export async function fetchPdbAPI(pdbId: string): Promise<string> {
  const response = await fetch(`${API_BASE}/api/pdb/${encodeURIComponent(pdbId)}`);
  if (!response.ok) {
    throw new Error(`Failed to load PDB structure ${pdbId}`);
  }
  return response.text();
}

export async function mapStructureAPI(params: {
  gene?: string;
  pdb_id?: string;
  mutations: any[];
  is_coding?: boolean;
  reading_frame?: number;
}): Promise<StructureMappingResult> {
  const response = await fetch(`${API_BASE}/api/structure/map`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || `Structural mapping failed with status ${response.status}`);
  }
  return response.json();
}

export async function exportPdfAPI(data: any): Promise<Blob> {
  const response = await fetch(`${API_BASE}/api/export-pdf`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    throw new Error(`PDF export failed with status ${response.status}`);
  }
  return response.blob();
}
