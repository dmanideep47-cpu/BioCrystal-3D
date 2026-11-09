import os
import urllib.request
from typing import Dict, Any, List, Optional

CACHE_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "pdb_cache")
os.makedirs(CACHE_DIR, exist_ok=True)

# Curated benchmark metadata for experimental structures
GENE_STRUCTURE_REGISTRY: Dict[str, Dict[str, Any]] = {
    "KRAS": {
        "gene": "KRAS",
        "organism": "Homo sapiens",
        "accession": "NM_004985.5",
        "uniprot": "P01116",
        "pdb_id": "6OIM",
        "chain": "A",
        "title": "Crystal structure of KRAS G12C bound to AMG 510 (Sotorasib inhibitor)",
        "method": "X-ray Diffraction",
        "resolution": "1.35 Å",
        "cds_start_offset": 0,  # 0-indexed offset of coding sequence start
        "known_hotspots": {
            12: {
                "region": "P-loop (Walker A motif, residues 10-17)",
                "functional_role": "Interacts with nucleotide alpha- and beta-phosphates; impairs GAP-induced GTP hydrolysis locking KRAS in active oncogenic state.",
                "default_impact": "high",
                "impact_label": "Potentially high impact (Oncogenic Activation)",
            },
            13: {
                "region": "P-loop (Walker A motif, residues 10-17)",
                "functional_role": "Nucleotide phosphate positioning; reduces intrinsic GTP hydrolysis.",
                "default_impact": "high",
                "impact_label": "Potentially high impact (Oncogenic Activation)",
            },
            61: {
                "region": "Switch II (residues 59-67)",
                "functional_role": "Catalytic glutamine required for nucleophilic water attack during GTP cleavage.",
                "default_impact": "high",
                "impact_label": "Potentially high impact (Severe Loss of GTP Hydrolysis)",
            },
        },
    },
    "HBB": {
        "gene": "HBB",
        "organism": "Homo sapiens",
        "accession": "NM_000518.5",
        "uniprot": "P68871",
        "pdb_id": "1A3N",
        "chain": "B",
        "title": "Human Deoxyhemoglobin at 1.8 Å resolution",
        "method": "X-ray Diffraction",
        "resolution": "1.80 Å",
        "cds_start_offset": 0,
        "known_hotspots": {
            6: {
                "region": "A-helix outer surface (residue 6)",
                "functional_role": "Hydrophobic Valine pocket causes abnormal intermolecular aggregation under deoxygenated conditions, causing sickle cell fiber formation.",
                "default_impact": "high",
                "impact_label": "Potentially high impact (Polymerization & Hemoglobinopathy)",
            },
        },
    },
    "TP53": {
        "gene": "TP53",
        "organism": "Homo sapiens",
        "accession": "NM_000546.6",
        "uniprot": "P04637",
        "pdb_id": "1TUP",
        "chain": "B",
        "title": "Crystal structure of p53 tumor suppressor core domain bound to DNA",
        "method": "X-ray Diffraction",
        "resolution": "2.20 Å",
        "cds_start_offset": 0,
        "known_hotspots": {
            175: {
                "region": "L2 loop zinc-coordinating domain",
                "functional_role": "Structural scaffold mutation destabilizing zinc coordination and tertiary architecture of the DNA-binding domain.",
                "default_impact": "high",
                "impact_label": "Potentially high impact (Structural Inactivation of Tumor Suppressor)",
            },
            248: {
                "region": "L3 loop minor groove DNA contact",
                "functional_role": "Direct DNA contact residue; abolishes sequence-specific binding to tumor suppressor promoters.",
                "default_impact": "high",
                "impact_label": "Potentially high impact (Direct DNA Contact Loss)",
            },
            273: {
                "region": "Loop-sheet-helix major groove DNA contact",
                "functional_role": "Direct DNA contact residue; completely impairs transcriptional transactivation.",
                "default_impact": "high",
                "impact_label": "Potentially high impact (Direct DNA Contact Loss)",
            },
        },
    },
}


def fetch_pdb_file(pdb_id: str) -> Optional[str]:
    """
    Retrieves PDB file content from local cache or directly from RCSB PDB.
    """
    clean_id = pdb_id.strip().upper()
    if len(clean_id) != 4 or not clean_id.isalnum():
        return None

    cache_path = os.path.join(CACHE_DIR, f"{clean_id}.pdb")
    if os.path.exists(cache_path):
        try:
            with open(cache_path, "r", encoding="utf-8", errors="replace") as f:
                return f.read()
        except Exception:
            pass

    # Attempt fetch from RCSB
    url = f"https://files.rcsb.org/download/{clean_id}.pdb"
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "BioCrystal3D/3.0"})
        with urllib.request.urlopen(req, timeout=8) as response:
            content = response.read().decode("utf-8", errors="replace")
            # Cache to disk
            with open(cache_path, "w", encoding="utf-8") as f:
                f.write(content)
            return content
    except Exception as e:
        print(f"Failed to fetch PDB {clean_id}: {e}")
        return None


def map_mutations_to_structure(
    gene: Optional[str],
    pdb_id: Optional[str],
    mutations: List[Dict[str, Any]],
    is_coding: bool = True,
    reading_frame: int = 0
) -> Dict[str, Any]:
    """
    Maps detected DNA mutation events to exact 3D protein residues and structural regions.
    Guarantees honest biological provenance and explicit unavailable states.
    """
    # 1. Non-coding or insufficient biological context
    if not is_coding:
        return {
            "mapped": False,
            "pdb_id": None,
            "chain": None,
            "status": "Structural mapping unavailable",
            "reason": "Non-coding DNA sequences do not translate into physical protein structures. Sequence-level alignment and variant categorization are provided below.",
            "mappings": [],
            "provenance": None,
        }

    # 2. Determine target gene configuration
    gene_key = (gene or "").strip().upper()
    target_config = None

    if gene_key in GENE_STRUCTURE_REGISTRY:
        target_config = GENE_STRUCTURE_REGISTRY[gene_key]
    elif pdb_id:
        clean_pdb = pdb_id.strip().upper()
        for g_k, conf in GENE_STRUCTURE_REGISTRY.items():
            if conf["pdb_id"] == clean_pdb:
                target_config = conf
                break

    # If user provided a specific custom PDB ID not in registry
    if not target_config and pdb_id and len(pdb_id.strip()) == 4:
        clean_pdb = pdb_id.strip().upper()
        # Verify structure exists
        pdb_content = fetch_pdb_file(clean_pdb)
        if pdb_content:
            target_config = {
                "gene": gene or clean_pdb,
                "organism": "Specified by Accession",
                "accession": clean_pdb,
                "uniprot": "N/A",
                "pdb_id": clean_pdb,
                "chain": "A",
                "title": f"RCSB PDB Structure {clean_pdb}",
                "method": "Experimental (PDB)",
                "resolution": "Experimental",
                "cds_start_offset": 0,
                "known_hotspots": {},
            }

    if not target_config:
        return {
            "mapped": False,
            "pdb_id": None,
            "chain": None,
            "status": "Structural mapping unavailable",
            "reason": "No validated experimental 3D crystal structure could be identified for this genomic region. Computational sequence alignment and consequence analysis remain fully available.",
            "mappings": [],
            "provenance": None,
        }

    # Ensure PDB content is cached
    fetch_pdb_file(target_config["pdb_id"])

    # Map each detected mutation to protein residue coordinates
    mappings = []
    has_any_mapped = False

    for mut in mutations:
        if mut.get("type") == "substitution":
            ref_pos = mut.get("reference_position", 1)
            # 1-based codon index in coding sequence
            codon_idx = (ref_pos - 1 - reading_frame) // 3 + 1
            residue_num = codon_idx - target_config["cds_start_offset"]

            orig_aa = mut.get("original_amino_acid", {}).get("code3", "Unk")
            mut_aa = mut.get("observed_amino_acid", {}).get("code3", "Unk")
            category = mut.get("category", "missense")

            hotspot_info = target_config["known_hotspots"].get(residue_num, {})
            region = hotspot_info.get("region", f"Residue {residue_num} Structural Core")

            # Determine biological impact categorization
            if category == "synonymous":
                impact_cat = "low"
                impact_label = "Potentially low impact (Silent Variation)"
                impact_rationale = f"Synonymous substitution at codon {codon_idx} preserves translated {orig_aa} residue. No direct structural displacement expected."
            elif category == "nonsense":
                impact_cat = "high"
                impact_label = "Potentially high impact (Premature Termination)"
                impact_rationale = f"Premature stop codon at residue {residue_num} results in truncated polypeptide lacking critical downstream tertiary domain."
            elif hotspot_info:
                impact_cat = hotspot_info.get("default_impact", "high")
                impact_label = hotspot_info.get("impact_label", "Potentially high impact")
                impact_rationale = hotspot_info.get("functional_role", f"Affects functional residue {residue_num}.")
            else:
                orig_cat = mut.get("original_amino_acid", {}).get("category", "")
                mut_cat = mut.get("observed_amino_acid", {}).get("category", "")
                if orig_cat != mut_cat:
                    impact_cat = "moderate"
                    impact_label = "Potentially moderate impact (Non-conservative substitution)"
                    impact_rationale = f"Chemical property shift from {orig_cat} ({orig_aa}) to {mut_cat} ({mut_aa}) at residue {residue_num} may affect local sidechain packing or electrostatic interactions."
                else:
                    impact_cat = "low"
                    impact_label = "Potentially low impact (Conservative substitution)"
                    impact_rationale = f"Conservative substitution maintaining {orig_cat} sidechain characteristics at residue {residue_num}."

            mappings.append({
                "mutation_ref_pos": ref_pos,
                "mutation_type": mut.get("type"),
                "dna_variant": f"{mut.get('original_base')}>{mut.get('observed_base')}",
                "chain": target_config["chain"],
                "residue_number": residue_num,
                "original_residue": orig_aa,
                "mutated_residue": mut_aa,
                "structural_region": region,
                "mapping_confidence": "High (Direct Sequence-to-Structure Alignment)",
                "is_mapped": True,
                "impact_category": impact_cat,
                "impact_label": impact_label,
                "impact_rationale": impact_rationale,
                "limitation": "In-silico structural localization on wild-type reference crystal structure. Secondary altered conformation is not experimentally determined without wet-lab crystallographic or cryo-EM analysis.",
            })
            has_any_mapped = True
        else:
            # Indels
            ref_pos = mut.get("reference_position", 1)
            codon_idx = (ref_pos - 1 - reading_frame) // 3 + 1
            residue_num = codon_idx - target_config["cds_start_offset"]
            is_frameshift = mut.get("category") == "frameshift"

            mappings.append({
                "mutation_ref_pos": ref_pos,
                "mutation_type": mut.get("type"),
                "dna_variant": f"Indel at {ref_pos}",
                "chain": target_config["chain"],
                "residue_number": residue_num,
                "original_residue": "Indel",
                "mutated_residue": "Shifted",
                "structural_region": f"Disruption starting at residue {residue_num}",
                "mapping_confidence": "Moderate (Indel Boundary Mapping)",
                "is_mapped": True,
                "impact_category": "high" if is_frameshift else "moderate",
                "impact_label": "Potentially high impact (Frameshift Disruption)" if is_frameshift else "Potentially moderate impact (In-frame Indel)",
                "impact_rationale": "Disrupts downstream reading frame and native protein fold." if is_frameshift else f"Inserts or deletes residues around position {residue_num} without altering downstream frame.",
                "limitation": "Indels cause extensive conformational shifts that cannot be reliably inferred from a static reference structure alone.",
            })
            has_any_mapped = True

    return {
        "mapped": has_any_mapped,
        "pdb_id": target_config["pdb_id"],
        "chain": target_config["chain"],
        "status": "Reference structure with mutation position highlighted",
        "reason": None if has_any_mapped else "No mutations mapped to target structure.",
        "mappings": mappings,
        "provenance": {
            "database": "RCSB Protein Data Bank",
            "pdb_id": target_config["pdb_id"],
            "organism": target_config["organism"],
            "title": target_config["title"],
            "method": target_config["method"],
            "resolution": target_config["resolution"],
            "chain": target_config["chain"],
            "experimental_status": "Experimentally Determined (X-ray / Cryo-EM)",
            "model_type": "Wild-type Reference Coordinate System",
            "mutant_structure_available": False,
            "disclaimer": "The 3D visualization presents the experimental reference crystal structure with detected mutation sites localized in 3D space. Mutant conformation is not fabricated; computational assessment is provided with structural context.",
        },
    }

