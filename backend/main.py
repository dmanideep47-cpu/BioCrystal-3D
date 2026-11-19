import os
import sys
import hashlib

# Ensure current backend directory is in sys.path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from fastapi import FastAPI, HTTPException, Request, UploadFile, File
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
    parse_fasta_content,
    generate_mutation_impact_summary,
    compare_two_variants,
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
from analysis_pipeline import ScientificAnalysisPipeline, validate_analysis_consistency

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


class FastaParseRequest(BaseModel):
    fasta_content: Optional[str] = None


class VariantComparisonRequest(BaseModel):
    reference_sequence: str = Field(..., description="Reference DNA sequence")
    variant_a_sequence: str = Field(..., description="Variant A DNA sequence")
    variant_b_sequence: str = Field(..., description="Variant B DNA sequence")
    variant_a_name: Optional[str] = "Variant A"
    variant_b_name: Optional[str] = "Variant B"
    gene: Optional[str] = None
    pdb_id: Optional[str] = None
    reading_frame: Optional[int] = 0
    table_id: Optional[int] = 1
    is_coding: Optional[bool] = True


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


class PipelineAnalyzeRequest(BaseModel):
    reference_sequence: str
    variant_sequence: str
    gene: Optional[str] = "KRAS"
    reading_frame: Optional[int] = 0
    table_id: Optional[int] = 1
    is_coding: Optional[bool] = True
    accession: Optional[str] = None
    organism: Optional[str] = "Homo sapiens"


class PipelineValidateRequest(BaseModel):
    analysis: Dict[str, Any]


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


@app.post("/api/fasta/parse")
async def api_fasta_parse(
    request: Request,
    file: Optional[UploadFile] = File(None),
):
    content = ""
    content_type = request.headers.get("content-type", "")
    if "multipart/form-data" in content_type:
        try:
            form = await request.form()
            uploaded = form.get("file")
            if uploaded and hasattr(uploaded, "read"):
                raw_bytes = await uploaded.read()
                content = raw_bytes.decode("utf-8", errors="replace")
        except Exception:
            pass
    elif "application/json" in content_type:
        try:
            body = await request.json()
            content = body.get("fasta_content", "") or body.get("content", "") or body.get("sequence", "")
        except Exception:
            pass
    else:
        try:
            body_bytes = await request.body()
            content = body_bytes.decode("utf-8", errors="replace")
        except Exception:
            pass

    result = parse_fasta_content(content)
    if not result.get("valid"):
        raise HTTPException(
            status_code=400,
            detail=result.get("error") or "Invalid FASTA format. Please upload a valid DNA FASTA file."
        )
    return result


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

    # Scientific metadata and interpretation provenance
    ref_clean = ref_val["cleaned_sequence"]
    obs_clean = obs_val["cleaned_sequence"]
    ref_hash = hashlib.sha256(ref_clean.encode('utf-8')).hexdigest()[:8]
    var_hash = hashlib.sha256(obs_clean.encode('utf-8')).hexdigest()[:8]

    mutations_list = alignment_res.get("mutations", [])
    primary_mut = mutations_list[0] if mutations_list else None

    pdb_avail = bool(structure_mapping and structure_mapping.get("mapped"))
    actual_pdb_id = structure_mapping.get("pdb_id") if (pdb_avail and structure_mapping.get("pdb_id")) else None

    if pdb_avail and actual_pdb_id:
        structure_provenance_type = "experimental_pdb"
    elif dna_structure and dna_structure.get("pdb_content"):
        structure_provenance_type = "canonical_dna"
    else:
        structure_provenance_type = "unavailable"

    if not mutations_list:
        mutation_classification = "Wild-type (Identical)"
        codon_change = None
        amino_acid_change = None
        primary_interpretation = (
            f"Interpretation: No sequence alterations detected. Variant sequence matches wild-type reference "
            f"across all {len(ref_clean)} base pairs. Canonical B-DNA conformation modeled."
        )
    else:
        cat = primary_mut.get("category", "")
        mtype = primary_mut.get("type", "variant")
        ref_pos = primary_mut.get("reference_position") or primary_mut.get("observed_position", 1)
        orig_b = primary_mut.get("original_base", "")
        obs_b = primary_mut.get("observed_base", "")

        if cat == "missense":
            mutation_classification = "Missense"
        elif cat == "nonsense":
            mutation_classification = "Nonsense"
        elif cat == "synonymous":
            mutation_classification = "Synonymous"
        elif cat == "frameshift":
            mutation_classification = f"Frameshift {mtype.capitalize()}"
        elif cat == "in_frame_indel":
            mutation_classification = "In-frame Indel"
        elif cat:
            mutation_classification = cat.replace("_", " ").capitalize()
        else:
            mutation_classification = mtype.capitalize()

        ref_codon = primary_mut.get("reference_codon") or primary_mut.get("original_codon")
        obs_codon = primary_mut.get("observed_codon")
        if ref_codon and obs_codon:
            codon_change = f"{ref_codon} > {obs_codon}"
        else:
            codon_change = None

        orig_aa = primary_mut.get("original_amino_acid", {}) or {}
        obs_aa = primary_mut.get("observed_amino_acid", {}) or {}
        orig_aa3 = orig_aa.get("code3") or orig_aa.get("name")
        obs_aa3 = obs_aa.get("code3") or obs_aa.get("name")
        codon_idx = primary_mut.get("affected_codon_index")

        if orig_aa3 and obs_aa3 and codon_idx:
            amino_acid_change = f"p.{orig_aa3}{codon_idx}{obs_aa3}"
        elif orig_aa3 and obs_aa3:
            amino_acid_change = f"{orig_aa3} > {obs_aa3}"
        else:
            amino_acid_change = None

        hgvs_c = f"c.{ref_pos}{orig_b}>{obs_b}" if (mtype == "substitution" and orig_b and obs_b) else f"{mtype} at pos {ref_pos}"
        aa_label = f", {amino_acid_change}" if amino_acid_change else ""

        interp_parts = []
        if mtype == "substitution":
            interp_parts.append(f"Single nucleotide variant ({hgvs_c}{aa_label}) detected" + (f" in codon {codon_idx}." if codon_idx else f" at position {ref_pos}."))
        elif mtype == "insertion":
            interp_parts.append(f"Insertion variant ({hgvs_c}{aa_label}) detected at position {ref_pos}.")
        elif mtype == "deletion":
            interp_parts.append(f"Deletion variant ({hgvs_c}{aa_label}) detected at position {ref_pos}.")
        else:
            interp_parts.append(f"Variant ({hgvs_c}{aa_label}) detected at position {ref_pos}.")

        if cat == "missense":
            interp_parts.append(f"Missense mutation resulting in {orig_aa.get('name', 'residue')} to {obs_aa.get('name', 'residue')} substitution.")
        elif cat == "nonsense":
            interp_parts.append(f"Nonsense mutation introducing premature termination at codon {codon_idx}.")
        elif cat == "synonymous":
            interp_parts.append(f"Synonymous variant conserving {orig_aa.get('name', 'amino acid')} sequence.")
        elif cat == "frameshift":
            interp_parts.append("Frameshift mutation altering downstream translational reading frame.")
        elif cat == "in_frame_indel":
            interp_parts.append("In-frame indel preserving downstream reading frame.")

        if len(mutations_list) > 1:
            interp_parts.append(f"{len(mutations_list)} total sequence variations identified.")

        if pdb_avail and actual_pdb_id:
            interp_parts.append(f"Experimentally determined Protein Data Bank (PDB) structure ({actual_pdb_id}) mapped with atomic resolution.")
        else:
            interp_parts.append("Canonical B-DNA conformation modeled; no experimentally determined PDB structure mapped.")

        primary_interpretation = "Interpretation: " + " ".join(interp_parts)

    metadata = {
        "reference_hash": ref_hash,
        "variant_hash": var_hash,
        "mutation_classification": mutation_classification,
        "codon_change": codon_change,
        "amino_acid_change": amino_acid_change,
        "pdb_available": pdb_avail,
        "pdb_id": actual_pdb_id,
        "structure_provenance_type": structure_provenance_type,
        "primary_interpretation": primary_interpretation,
    }

    mutation_impact = generate_mutation_impact_summary(
        mutations=mutations_list,
        reference_seq=ref_clean,
        variant_seq=obs_clean,
        structure_mapping=structure_mapping,
        gene=req.gene,
        is_coding=req.is_coding if req.is_coding is not None else True,
        reading_frame=req.reading_frame or 0,
        table_id=req.table_id or 1,
    )

    return {
        "reference_validation": ref_val,
        "observed_validation": obs_val,
        "alignment": alignment_res,
        "structure_mapping": structure_mapping,
        "dna_biophysics": dna_biophysics,
        "dna_structure": dna_structure,
        "variant_intelligence": variant_intelligence,
        "metadata": metadata,
        "mutation_impact_summary": mutation_impact,
    }


@app.post("/api/compare-variants")
def api_compare_variants(req: VariantComparisonRequest):
    ref_val = validate_dna_sequence(req.reference_sequence)
    var_a_val = validate_dna_sequence(req.variant_a_sequence)
    var_b_val = validate_dna_sequence(req.variant_b_sequence)

    if not ref_val["is_valid"]:
        raise HTTPException(status_code=400, detail=f"Invalid reference sequence: {', '.join(ref_val['errors'])}")
    if not var_a_val["is_valid"]:
        raise HTTPException(status_code=400, detail=f"Invalid Variant A sequence: {', '.join(var_a_val['errors'])}")
    if not var_b_val["is_valid"]:
        raise HTTPException(status_code=400, detail=f"Invalid Variant B sequence: {', '.join(var_b_val['errors'])}")

    try:
        comparison = compare_two_variants(
            reference_seq=ref_val["cleaned_sequence"],
            variant_a_seq=var_a_val["cleaned_sequence"],
            variant_b_seq=var_b_val["cleaned_sequence"],
            variant_a_name=req.variant_a_name or "Variant A",
            variant_b_name=req.variant_b_name or "Variant B",
            gene=req.gene,
            pdb_id=req.pdb_id,
            reading_frame=req.reading_frame or 0,
            table_id=req.table_id or 1,
            is_coding=req.is_coding if req.is_coding is not None else True,
        )
        return comparison
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Variant comparison failed: {str(exc)}")


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


@app.post("/api/pipeline/analyze")
def api_pipeline_analyze(req: PipelineAnalyzeRequest):
    try:
        return ScientificAnalysisPipeline.execute(
            reference_sequence=req.reference_sequence,
            variant_sequence=req.variant_sequence,
            gene=req.gene,
            reading_frame=req.reading_frame or 0,
            table_id=req.table_id or 1,
            is_coding=req.is_coding if req.is_coding is not None else True,
            accession=req.accession,
            organism=req.organism or "Homo sapiens",
        )
    except ValueError as val_err:
        raise HTTPException(status_code=400, detail=str(val_err))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Pipeline execution error: {str(exc)}")


@app.post("/api/pipeline/validate")
def api_pipeline_validate(req: PipelineValidateRequest):
    return validate_analysis_consistency(req.analysis)


@app.post("/api/export-pdf")
@app.post("/api/report")
def api_export_pdf(req: PDFExportRequest):
    try:
        pdf_bytes = generate_pdf_report(req.model_dump())
        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={"Content-Disposition": "attachment; filename=BioCrystal_DNA_Analysis_Report.pdf"}
        )
    except ValueError as val_err:
        raise HTTPException(status_code=422, detail=str(val_err))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"PDF Generation Error: {str(exc)}")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)
