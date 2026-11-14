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
    generate_correction_candidates,
    analyze_mutation_experiment,
)
from structure_engine import (
    fetch_pdb_file,
    map_mutations_to_structure,
    generate_dna_structure_mapping,
    GENE_STRUCTURE_REGISTRY,
)
from dna_biophysics import compute_dna_biophysics
from pdf_generator import generate_pdf_report
from property_engine import analyze_property, SUPPORTED_OBJECTIVES
from variant_intelligence import analyze_variant_intelligence

app = FastAPI(
    title="BioCrystal 3D DNA Simulation Engine",
    version="3.0.0",
    description="Scientific computational biology backend for 3D DNA visualization, mutation analysis, and candidate correction."
)

# Enable CORS for frontend (supports local dev proxy and configurable deployed origins)
cors_env = os.environ.get("CORS_ORIGINS", "*")
allowed_origins = [o.strip() for o in cors_env.split(",") if o.strip()] or ["*"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
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
    gene: Optional[str] = None
    pdb_id: Optional[str] = None
    is_coding: Optional[bool] = False


class ExperimentAnalyzeRequest(BaseModel):
    reference_sequence: str = Field(..., description="Educational reference coding sequence")
    variant_sequence: str = Field(..., description="Variant coding sequence")
    prediction: Optional[Dict[str, Any]] = Field(None, description="Student prediction and rationale")
    reading_frame: Optional[int] = Field(0, ge=0, le=2)
    table_id: Optional[int] = 1


class StructureMapRequest(BaseModel):
    gene: Optional[str] = None
    pdb_id: Optional[str] = None
    mutations: List[Dict[str, Any]]
    reference_sequence: Optional[str] = None
    is_coding: Optional[bool] = True
    reading_frame: Optional[int] = 0


class DNABiophysicsRequest(BaseModel):
    sequence: str = Field(..., description="DNA sequence to compute biophysical metrics for")
    mutations: Optional[List[Dict[str, Any]]] = None
    na_molar: Optional[float] = Field(0.050, description="Monovalent salt concentration in Molar (default 50 mM)")
    mg_molar: Optional[float] = Field(0.0015, description="Divalent Mg2+ concentration in Molar (default 1.5 mM)")
    strand_molar: Optional[float] = Field(5e-7, description="Oligonucleotide strand concentration in Molar (default 500 nM)")


class DNAStructureRequest(BaseModel):
    sequence: str = Field(..., description="DNA nucleotide sequence to generate 3D B-DNA duplex for")
    mutations: Optional[List[Dict[str, Any]]] = None
    gene: Optional[str] = "DNA"


class AnnotateRequest(BaseModel):
    sequence: str
    table_id: Optional[int] = 1


class RecommendRequest(BaseModel):
    observed_sequence: str
    reference_sequence: Optional[str] = None
    reading_frame: Optional[int] = Field(0, ge=0, le=2)
    constraints: Optional[Dict[str, Any]] = None
    table_id: Optional[int] = 1


class PropertyAnalysisRequest(BaseModel):
    reference_sequence: str = Field(..., description="Reference DNA sequence")
    variant_sequence: str = Field(..., description="Variant DNA sequence")
    objective_id: Optional[str] = Field("gb1_binding_fitness", description="Target property objective identifier")
    reading_frame: Optional[int] = Field(0, ge=0, le=2)
    table_id: Optional[int] = 1


class PDFExportRequest(BaseModel):
    model_config = {"extra": "allow"}
    original_sequence: str
    current_sequence: Optional[str] = None
    edit_history: Optional[List[Dict[str, Any]]] = None
    revision: Optional[int] = 1
    reference_name: Optional[str] = None
    accession: Optional[str] = None
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
    structure_mapping: Optional[Dict[str, Any]] = None
    structure: Optional[Dict[str, Any]] = None
    gene: Optional[str] = None
    organism: Optional[str] = None
    alignment: Optional[Dict[str, Any]] = None
    analysis_result: Optional[Dict[str, Any]] = None


# ==============================================================================
# REST API ENDPOINTS
# ==============================================================================

@app.get("/api/health")
def health_check():
    import Bio
    return {
        "status": "healthy",
        "service": "BioCrystal 3D",
        "biopython_version": getattr(Bio, "__version__", "1.83"),
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
        is_coding=req.is_coding if req.is_coding is not None else False,
    )

    structure_mapping = map_mutations_to_structure(
        gene=req.gene,
        pdb_id=req.pdb_id,
        mutations=alignment_res.get("mutations", []),
        reference_sequence=ref_val["cleaned_sequence"],
        is_coding=req.is_coding if req.is_coding is not None else True,
        reading_frame=req.reading_frame or 0,
    )

    # Exact 3D B-DNA structure generation & SwissADME DNA biophysics (Reference & Variant comparative)
    ref_biophysics = compute_dna_biophysics(
        sequence=ref_val["cleaned_sequence"],
        mutations=[],
    )
    var_biophysics = compute_dna_biophysics(
        sequence=obs_val["cleaned_sequence"],
        mutations=alignment_res.get("mutations", []),
    )

    # Compute step-by-step nearest-neighbor energy profile for position-by-position graphs
    ref_steps_energy = []
    var_steps_energy = []
    try:
        from backend.dna_biophysics import NN_DELTA_H, NN_DELTA_S
    except ImportError:
        from dna_biophysics import NN_DELTA_H, NN_DELTA_S
    for idx in range(len(ref_val["cleaned_sequence"]) - 1):
        stp = ref_val["cleaned_sequence"][idx:idx+2]
        h = NN_DELTA_H.get(stp, -8.0)
        s = NN_DELTA_S.get(stp, -22.0)
        g = h - 310.15 * (s / 1000.0)
        ref_steps_energy.append({"position": idx + 1, "step": stp, "dg": round(g, 2), "dh": round(h, 2)})
    for idx in range(len(obs_val["cleaned_sequence"]) - 1):
        stp = obs_val["cleaned_sequence"][idx:idx+2]
        h = NN_DELTA_H.get(stp, -8.0)
        s = NN_DELTA_S.get(stp, -22.0)
        g = h - 310.15 * (s / 1000.0)
        var_steps_energy.append({"position": idx + 1, "step": stp, "dg": round(g, 2), "dh": round(h, 2)})

    ref_tm = ref_biophysics["thermodynamics"]["melting_temperature_c"]
    var_tm = var_biophysics["thermodynamics"]["melting_temperature_c"]
    delta_tm = round(var_tm - ref_tm, 2)

    ref_dg = ref_biophysics["thermodynamics"]["delta_g_37_kcal_mol"]
    var_dg = var_biophysics["thermodynamics"]["delta_g_37_kcal_mol"]
    delta_dg = round(var_dg - ref_dg, 2)

    ref_dh = ref_biophysics["thermodynamics"]["delta_h_kcal_mol"]
    var_dh = var_biophysics["thermodynamics"]["delta_h_kcal_mol"]
    delta_dh = round(var_dh - ref_dh, 2)

    ref_gc = ref_biophysics["spectroscopic_profile"]["gc_percent"]
    var_gc = var_biophysics["spectroscopic_profile"]["gc_percent"]
    delta_gc = round(var_gc - ref_gc, 2)

    ref_mw = ref_biophysics["spectroscopic_profile"]["molecular_weight_duplex_da"]
    var_mw = var_biophysics["spectroscopic_profile"]["molecular_weight_duplex_da"]
    delta_mw = round(var_mw - ref_mw, 2)

    ref_score = ref_biophysics["swiss_radar_scores"]["biocrystal_dna_index"]
    var_score = var_biophysics["swiss_radar_scores"]["biocrystal_dna_index"]
    delta_score = round(var_score - ref_score, 1)

    # Determine scientific verdict (Higher Tm and lower dG mean enhanced thermal & thermodynamic stability)
    if delta_tm > 0.4 or delta_dg < -0.4:
        verdict_status = "superior"
        verdict_badge = "Thermodynamically Enhanced"
        verdict_description = f"Variant sequence exhibits superior thermal stability ({delta_tm:+.1f}°C Tm) and more favorable free energy ({delta_dg:+.1f} kcal/mol ΔG°37) with enhanced base-stacking affinity over reference."
    elif delta_tm < -0.4 or delta_dg > 0.4:
        verdict_status = "destabilized"
        verdict_badge = "Thermodynamically Depressed"
        verdict_description = f"Variant sequence exhibits reduced thermal stability ({delta_tm:+.1f}°C Tm) and higher free energy ({delta_dg:+.1f} kcal/mol ΔG°37) relative to reference, with localized structural relaxation."
    else:
        verdict_status = "iso_stable"
        verdict_badge = "Iso-Stable Duplex"
        verdict_description = f"Variant maintains near-identical thermodynamic stability (ΔTm = {delta_tm:+.1f}°C, ΔΔG = {delta_dg:+.1f} kcal/mol) and conserved duplex pairing geometry relative to reference."

    dna_biophysics = {
        **var_biophysics,
        "reference": ref_biophysics,
        "variant": var_biophysics,
        "step_energy_profiles": {
            "reference": ref_steps_energy,
            "variant": var_steps_energy,
        },
        "deltas": {
            "delta_tm_celsius": delta_tm,
            "delta_dg_37_kcal_mol": delta_dg,
            "delta_dh_kcal_mol": delta_dh,
            "delta_gc_percent": delta_gc,
            "delta_mw_da": delta_mw,
            "score_delta": delta_score,
        },
        "verdict": {
            "status": verdict_status,
            "badge": verdict_badge,
            "description": verdict_description,
        },
    }

    dna_structure = generate_dna_structure_mapping(
        sequence=obs_val["cleaned_sequence"],
        mutations=alignment_res.get("mutations", []),
        gene=req.gene or "DNA",
    )

    # Integrated Variant Intelligence Snapshot (DNA, protein, biochemical, ESM ML, structure)
    variant_intelligence = None
    try:
        variant_intelligence = analyze_variant_intelligence(
            reference_sequence=ref_val["cleaned_sequence"],
            variant_sequence=obs_val["cleaned_sequence"],
            gene=req.gene,
            pdb_id=req.pdb_id,
            reading_frame=req.reading_frame or 0,
            table_id=req.table_id or 1,
            is_coding=req.is_coding if req.is_coding is not None else True,
            fetch_pdb_func=fetch_pdb_file,
        )
    except Exception as vi_err:
        variant_intelligence = {
            "analysis_id": "AN-ERR",
            "layer_statuses": {
                "nucleotide_comparison": "available",
                "ml_scoring": "failed",
            },
            "error": str(vi_err),
        }

    return {
        "reference_validation": ref_val,
        "observed_validation": obs_val,
        "alignment": alignment_res,
        "structure_mapping": structure_mapping,
        "dna_biophysics": dna_biophysics,
        "dna_structure": dna_structure,
        "variant_intelligence": variant_intelligence,
    }


@app.post("/api/intelligence/analyze")
def api_variant_intelligence(req: CompareRequest):
    try:
        return analyze_variant_intelligence(
            reference_sequence=req.reference_sequence,
            variant_sequence=req.observed_sequence,
            gene=req.gene,
            pdb_id=req.pdb_id,
            reading_frame=req.reading_frame or 0,
            table_id=req.table_id or 1,
            is_coding=req.is_coding if req.is_coding is not None else True,
            fetch_pdb_func=fetch_pdb_file,
        )
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Variant intelligence analysis failed: {str(exc)}")


@app.post("/api/experiment/analyze")
def api_experiment_analyze(req: ExperimentAnalyzeRequest):
    result = analyze_mutation_experiment(
        reference_seq=req.reference_sequence,
        variant_seq=req.variant_sequence,
        prediction=req.prediction,
        reading_frame=req.reading_frame or 0,
        table_id=req.table_id or 1,
    )
    if not result.get("success"):
        raise HTTPException(
            status_code=400,
            detail="; ".join(result.get("errors", ["Sequence analysis failed"]))
        )
    return result


@app.post("/api/dna/biophysics")
def api_dna_biophysics(req: DNABiophysicsRequest):
    val = validate_dna_sequence(req.sequence)
    if not val["is_valid"]:
        raise HTTPException(status_code=400, detail=f"Invalid DNA sequence: {', '.join(val['errors'])}")
    return compute_dna_biophysics(
        sequence=val["cleaned_sequence"],
        mutations=req.mutations,
        na_molar=req.na_molar if req.na_molar is not None else 0.050,
        mg_molar=req.mg_molar if req.mg_molar is not None else 0.0015,
        strand_molar=req.strand_molar if req.strand_molar is not None else 5e-7,
    )


@app.post("/api/dna/structure")
def api_dna_structure(req: DNAStructureRequest):
    val = validate_dna_sequence(req.sequence)
    if not val["is_valid"]:
        raise HTTPException(status_code=400, detail=f"Invalid DNA sequence: {', '.join(val['errors'])}")
    return generate_dna_structure_mapping(
        sequence=val["cleaned_sequence"],
        mutations=req.mutations,
        gene=req.gene or "DNA",
    )


@app.get("/api/pdb/{pdb_id}")
def api_get_pdb(pdb_id: str):
    pdb_text = fetch_pdb_file(pdb_id)
    if not pdb_text:
        raise HTTPException(
            status_code=404,
            detail=f"PDB structure '{pdb_id}' could not be located or retrieved from RCSB PDB."
        )
    return Response(content=pdb_text, media_type="text/plain")


@app.post("/api/structure/map")
def api_structure_map(req: StructureMapRequest):
    return map_mutations_to_structure(
        gene=req.gene,
        pdb_id=req.pdb_id,
        mutations=req.mutations,
        reference_sequence=req.reference_sequence,
        is_coding=req.is_coding if req.is_coding is not None else True,
        reading_frame=req.reading_frame or 0,
    )


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


@app.get("/api/property-objectives")
def api_property_objectives():
    return {"objectives": SUPPORTED_OBJECTIVES}


@app.post("/api/property-analysis")
def api_property_analysis(req: PropertyAnalysisRequest):
    return analyze_property(
        reference_dna=req.reference_sequence,
        variant_dna=req.variant_sequence,
        objective_id=req.objective_id or "gb1_binding_fitness",
        reading_frame=req.reading_frame or 0,
        table_id=req.table_id or 1,
    )


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
