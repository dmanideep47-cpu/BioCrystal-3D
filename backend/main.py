import os
import sys

# Ensure current backend directory is in sys.path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any

from bio_engine import (
    validate_dna_sequence,
    translate_dna,
    classify_mutation,
    perform_pairwise_alignment,
    perform_exploratory_analysis,
)
from candidate_engine import generate_correction_candidates
from pdf_generator import generate_pdf_report

app = FastAPI(
    title="BioCrystal 3D DNA Simulation Engine",
    version="3.0.0",
    description="Scientific computational biology backend for 3D DNA visualization, mutation analysis, and candidate correction."
)

# Enable CORS for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ==============================================================================
# PYDANTIC DATA CONTRACTS
# ==============================================================================

class ValidateRequest(BaseModel):
    sequence: str = Field(..., description="Raw DNA sequence or FASTA text")


class MutateRequest(BaseModel):
    sequence: str
    type: str  # substitution, insertion, deletion
    position: int  # 1-indexed
    new_bases: str
    table_id: Optional[int] = 1


class CompareRequest(BaseModel):
    reference_sequence: str
    observed_sequence: str
    reading_frame: Optional[int] = Field(0, ge=0, le=2)
    table_id: Optional[int] = 1


class AnnotateRequest(BaseModel):
    sequence: str
    table_id: Optional[int] = 1


class RecommendRequest(BaseModel):
    observed_sequence: str
    reference_sequence: Optional[str] = None
    reading_frame: Optional[int] = Field(0, ge=0, le=2)
    constraints: Optional[Dict[str, Any]] = None
    table_id: Optional[int] = 1


class PDFExportRequest(BaseModel):
    original_sequence: str
    complementary_sequence: Optional[str] = None
    gc_percent: Optional[float] = None
    at_percent: Optional[float] = None
    melting_temp: Optional[float] = None
    molecular_weight_kda: Optional[float] = None
    mutation_diff: Optional[Dict[str, Any]] = None
    reference_sequence: Optional[str] = None
    mutations_list: Optional[List[Dict[str, Any]]] = None
    candidates: Optional[List[Dict[str, Any]]] = None
    analysis_mode: Optional[str] = "reference_based"


# ==============================================================================
# REST API ENDPOINTS
# ==============================================================================

@app.get("/api/health")
def health_check():
    return {
        "status": "healthy",
        "service": "BioCrystal 3D DNA Simulation API",
        "biopython_version": "1.88",
        "version": "3.0.0",
    }


@app.post("/api/validate")
def api_validate(req: ValidateRequest):
    return validate_dna_sequence(req.sequence)


@app.post("/api/mutate")
def api_mutate(req: MutateRequest):
    val = validate_dna_sequence(req.sequence)
    if not val["is_valid"]:
        raise HTTPException(status_code=400, detail="Invalid input sequence.")
    if req.position < 1 or req.position > val["length"] + (1 if req.type == "insertion" else 0):
        raise HTTPException(
            status_code=400,
            detail=f"Position {req.position} is out of bounds for sequence length {val['length']}."
        )

    result = classify_mutation(
        original_seq=val["cleaned_sequence"],
        mut_type=req.type,
        position=req.position,
        new_bases=req.new_bases,
        table_id=req.table_id or 1,
    )
    return result


@app.post("/api/analyze")
def api_analyze(req: ValidateRequest):
    val = validate_dna_sequence(req.sequence)
    if not val["is_valid"]:
        raise HTTPException(status_code=400, detail="Invalid sequence.")

    # Return standard codons along with full exploratory metrics
    codons = translate_dna(val["cleaned_sequence"])
    exploratory = perform_exploratory_analysis(val["cleaned_sequence"])

    return {
        "validation": val,
        "codons": codons,
        "exploratory": exploratory,
    }


@app.post("/api/compare")
def api_compare(req: CompareRequest):
    ref_val = validate_dna_sequence(req.reference_sequence)
    obs_val = validate_dna_sequence(req.observed_sequence)

    if not ref_val["is_valid"]:
        raise HTTPException(status_code=400, detail=f"Invalid reference sequence: {', '.join(ref_val['errors'])}")
    if not obs_val["is_valid"]:
        raise HTTPException(status_code=400, detail=f"Invalid observed sequence: {', '.join(obs_val['errors'])}")

    alignment_res = perform_pairwise_alignment(
        ref_seq=ref_val["cleaned_sequence"],
        obs_seq=obs_val["cleaned_sequence"],
        reading_frame=req.reading_frame or 0,
        table_id=req.table_id or 1,
    )

    return {
        "reference_validation": ref_val,
        "observed_validation": obs_val,
        "alignment": alignment_res,
    }


@app.post("/api/annotate")
def api_annotate(req: AnnotateRequest):
    val = validate_dna_sequence(req.sequence)
    if not val["is_valid"]:
        raise HTTPException(status_code=400, detail=f"Invalid sequence: {', '.join(val['errors'])}")

    return perform_exploratory_analysis(
        sequence=val["cleaned_sequence"],
        table_id=req.table_id or 1
    )


@app.post("/api/recommend")
def api_recommend(req: RecommendRequest):
    obs_val = validate_dna_sequence(req.observed_sequence)
    if not obs_val["is_valid"]:
        raise HTTPException(status_code=400, detail=f"Invalid observed sequence: {', '.join(obs_val['errors'])}")

    clean_ref = None
    if req.reference_sequence and req.reference_sequence.strip():
        ref_val = validate_dna_sequence(req.reference_sequence)
        if ref_val["is_valid"]:
            clean_ref = ref_val["cleaned_sequence"]

    candidates_res = generate_correction_candidates(
        ref_seq=clean_ref,
        obs_seq=obs_val["cleaned_sequence"],
        reading_frame=req.reading_frame or 0,
        constraints=req.constraints,
        table_id=req.table_id or 1,
    )

    return candidates_res


@app.post("/api/export-pdf")
def api_export_pdf(req: PDFExportRequest):
    pdf_bytes = generate_pdf_report(req.model_dump())
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": "attachment; filename=BioCrystal_DNA_Analysis_Report.pdf"}
    )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)
