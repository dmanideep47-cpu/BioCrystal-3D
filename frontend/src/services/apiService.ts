import {
  SequenceValidationResult,
  FullAnalysisResult,
  StructureMappingResult,
  BackendHealthResponse,
} from '../types/dna';

/**
 * Returns the configured API base URL:
 * - Local development: empty string '' so calls use relative paths ('/api/...')
 *   which Vite proxies to http://127.0.0.1:8000 (avoiding CORS & hardcoded ports).
 * - Production / Deployed: set VITE_API_BASE_URL in .env to the remote backend origin.
 */
export const getApiBase = (): string => {
  const envBase = import.meta.env.VITE_API_BASE_URL;
  if (typeof envBase === 'string' && envBase.trim().length > 0) {
    return envBase.trim().replace(/\/+$/, '');
  }
  return '';
};

/**
 * Formats caught errors (network failure, HTTP validation, timeout) into human-readable messages.
 */
export function formatApiError(err: unknown): string {
  if (!err) return 'Unknown error occurred.';
  if (typeof err === 'string') return err;
  if (err instanceof Error) {
    const msg = err.message || '';
    if (
      msg.includes('Failed to fetch') ||
      msg.includes('NetworkError') ||
      msg.includes('ECONNREFUSED') ||
      err.name === 'TypeError'
    ) {
      return (
        'Backend connection failure: The FastAPI backend at http://127.0.0.1:8000 is not reachable. ' +
        'Please verify that the backend is running via run.bat or "python -m uvicorn backend.main:app --port 8000".'
      );
    }
    return msg;
  }
  return String(err);
}

/**
 * Checks backend health at /api/health with timeout.
 */
export async function checkBackendHealthAPI(): Promise<BackendHealthResponse> {
  const url = `${getApiBase()}/api/health`;
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3500);

    const response = await fetch(url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`Health check returned HTTP ${response.status} (${response.statusText})`);
    }

    const data: BackendHealthResponse = await response.json();
    return data;
  } catch (err: any) {
    if (err.name === 'AbortError') {
      throw new Error('Backend health check timed out (3.5s). Server might be under heavy load or offline.');
    }
    throw new Error(formatApiError(err));
  }
}

/**
 * Validates a single DNA sequence.
 */
export async function validateSequenceAPI(sequence: string): Promise<SequenceValidationResult> {
  const url = `${getApiBase()}/api/validate`;
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sequence }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const detail = typeof errorData.detail === 'string'
        ? errorData.detail
        : Array.isArray(errorData.detail)
        ? errorData.detail.map((e: any) => e.msg || JSON.stringify(e)).join(', ')
        : `Validation failed with HTTP ${response.status}`;
      throw new Error(detail);
    }

    return response.json();
  } catch (err: any) {
    throw new Error(formatApiError(err));
  }
}

/**
 * Executes pairwise sequence alignment and mutation analysis via the backend engine.
 */
export async function compareSequencesAPI(params: {
  reference_sequence: string;
  observed_sequence: string;
  reading_frame?: number;
  table_id?: number;
  gene?: string;
  pdb_id?: string;
  is_coding?: boolean;
}): Promise<FullAnalysisResult> {
  const url = `${getApiBase()}/api/compare`;
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const detail = typeof errorData.detail === 'string'
        ? errorData.detail
        : Array.isArray(errorData.detail)
        ? errorData.detail.map((e: any) => `${e.loc?.slice(-1)[0] || 'field'}: ${e.msg}`).join(', ')
        : `Analysis failed with HTTP ${response.status}`;
      throw new Error(detail);
    }

    return response.json();
  } catch (err: any) {
    throw new Error(formatApiError(err));
  }
}

/**
 * Retrieves raw PDB coordinates from backend cache / RCSB.
 */
export async function fetchPdbAPI(pdbId: string): Promise<string> {
  const url = `${getApiBase()}/api/pdb/${encodeURIComponent(pdbId)}`;
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to load PDB structure "${pdbId}" (HTTP ${response.status})`);
    }
    return response.text();
  } catch (err: any) {
    throw new Error(formatApiError(err));
  }
}

/**
 * Maps variant coordinates to 3D macromolecular structures.
 */
export async function mapStructureAPI(params: {
  gene?: string;
  pdb_id?: string;
  mutations: any[];
  is_coding?: boolean;
  reading_frame?: number;
}): Promise<StructureMappingResult> {
  const url = `${getApiBase()}/api/structure/map`;
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const detail = typeof errorData.detail === 'string'
        ? errorData.detail
        : `Structural mapping failed with HTTP ${response.status}`;
      throw new Error(detail);
    }

    return response.json();
  } catch (err: any) {
    throw new Error(formatApiError(err));
  }
}

/**
 * Requests SwissADME-style PDF report generation from ReportLab backend.
 */
export async function exportPdfAPI(data: any): Promise<Blob> {
  const url = `${getApiBase()}/api/export-pdf`;
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || `PDF export failed with HTTP ${response.status}`);
    }

    return response.blob();
  } catch (err: any) {
    throw new Error(formatApiError(err));
  }
}
