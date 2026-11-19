"""
BioCrystal 3D — Structural Bioinformatics & Macromolecular 3D DNA Engine.

Responsible for:
1. De novo generation of full-atom 3D B-DNA double-helix structures (Chain A + Chain B)
   for any input sequence using Arnott & Dickerson canonical stereochemistry.
2. Direct mapping of DNA mutations (substitutions, mismatches) onto 3D nucleic acid coordinates.
3. Serving cached or generated PDB files to WebGL viewers (3Dmol.js).
4. Backward-compatible resolution of curated benchmark macromolecular entries.
"""

from __future__ import annotations

import hashlib
import os
import re
import urllib.request
from io import StringIO
from typing import Any, Dict, List, Optional

from Bio.PDB import PDBParser
from Bio.PDB.PDBExceptions import PDBConstructionException
from Bio.SeqUtils import seq1

try:
    from dna_structure_builder import build_b_dna_pdb, clean_dna_sequence
except ImportError:
    from backend.dna_structure_builder import build_b_dna_pdb, clean_dna_sequence

CACHE_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "pdb_cache")
os.makedirs(CACHE_DIR, exist_ok=True)

# Curated benchmark metadata for experimental structures (legacy reference registry)
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
        "reference_pdb_id": "4OBE",
        "reference_chain": "A",
        "coding_sequence": "ATGACTGAATATAAACTTGTGGTAGTTGGAGCTGGTGGCGTAGGCAAGAGTGCCTTGACG",
        "cds_start_offset": 0,
        "known_hotspots": {
            12: {"region": "P-loop (residues 10-17)"},
            13: {"region": "P-loop (residues 10-17)"},
            61: {"region": "Switch II (residues 59-67)"},
        },
    },
    "BRAF": {
        "gene": "BRAF",
        "organism": "Homo sapiens",
        "accession": "NM_004333.6",
        "uniprot": "P15056",
        "pdb_id": "4MNF",
        "chain": "A",
        "title": "Crystal structure of active BRAF V600E kinase domain",
        "method": "X-ray Diffraction",
        "resolution": "2.65 Å",
        "reference_pdb_id": "4MNE",
        "reference_chain": "A",
        "coding_sequence": "CTAGTAAAAATAGGTGATTTTGGTCTAGCCACAGTGAAATCTCGATGGAGTGGGTCCCATCAGTTTGAACAGTTGTCTGGATCC",
        "cds_start_offset": 590,
        "known_hotspots": {
            600: {"region": "Activation loop (residues 594-623)"},
        },
    },
    "EGFR": {
        "gene": "EGFR",
        "organism": "Homo sapiens",
        "accession": "NM_005228.5",
        "uniprot": "P00533",
        "pdb_id": "2ITV",
        "chain": "A",
        "title": "Crystal structure of EGFR kinase domain L858R mutant",
        "method": "X-ray Diffraction",
        "resolution": "2.70 Å",
        "reference_pdb_id": "2ITX",
        "reference_chain": "A",
        "coding_sequence": "CACAGATTTTGGGCTGGCCAAACTGCTGGGTGCGGAAGAGAAAGAATACCATGCAGAAGGAGGCAAAGTG",
        "cds_start_offset": 850,
        "known_hotspots": {
            858: {"region": "Activation loop / Exon 21"},
        },
    },
    "TP53": {
        "gene": "TP53",
        "organism": "Homo sapiens",
        "accession": "NM_000546.6",
        "uniprot": "P04637",
        "pdb_id": "2BIM",
        "chain": "A",
        "title": "Crystal structure of cancer mutant p53 core domain R273H",
        "method": "X-ray Diffraction",
        "resolution": "1.50 Å",
        "reference_pdb_id": "1TUP",
        "reference_chain": "B",
        "coding_sequence": "ATTTGCGTGTGGAGTATTTGGATGACAGAAACACTTTTCGACATAGTGTGGTGGTGCCCTATGAGCCGCCTGAG",
        "cds_start_offset": 265,
        "known_hotspots": {
            273: {"region": "DNA contact surface / Loop-Sheet-Helix motif"},
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
        "coding_sequence": "ATGGTGCACCTGACTCCTGAGGAGAAGTCT",
        "cds_start_offset": 1,
        "known_hotspots": {
            6: {"region": "A-helix"},
        },
    },
}


def fetch_pdb_file(pdb_id: str) -> Optional[str]:
    """
    Retrieves PDB file content from local cache or directly from RCSB PDB.
    Supports generated DNA structures (DNA_*) as well as 4-character RCSB entries.
    """
    clean_id = (pdb_id or "").strip()
    if not clean_id:
        return None

    # Check local cache first (handles DNA_* and cached experimental PDBs)
    cache_path = os.path.join(CACHE_DIR, f"{clean_id}.pdb")
    if os.path.exists(cache_path):
        try:
            with open(cache_path, "r", encoding="utf-8", errors="replace") as f:
                return f.read()
        except Exception:
            pass

    # Upper case for standard PDB IDs
    upper_id = clean_id.upper()
    cache_path_upper = os.path.join(CACHE_DIR, f"{upper_id}.pdb")
    if os.path.exists(cache_path_upper):
        try:
            with open(cache_path_upper, "r", encoding="utf-8", errors="replace") as f:
                return f.read()
        except Exception:
            pass

    # If it is a 4-character alphanumeric RCSB identifier, attempt fetch from RCSB
    if len(upper_id) == 4 and upper_id.isalnum():
        url = f"https://files.rcsb.org/download/{upper_id}.pdb"
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "BioCrystal3D/3.0"})
            with urllib.request.urlopen(req, timeout=8) as response:
                content = response.read().decode("utf-8", errors="replace")
                with open(cache_path_upper, "w", encoding="utf-8") as f:
                    f.write(content)
                return content
        except Exception as e:
            print(f"Failed to fetch PDB {upper_id}: {e}")
            return None

    return None


def generate_dna_structure_mapping(
    sequence: str,
    mutations: Optional[List[Dict[str, Any]]] = None,
    gene: Optional[str] = "DNA",
    organism: Optional[str] = None,
    accession: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Generates an idealized canonical full-atom B-DNA model for the input sequence,
    maps all mutations onto the DNA duplex coordinates, caches the PDB file, and returns
    the structure mapping result for the 3D visualization workstation.
    """
    clean_seq = clean_dna_sequence(sequence)
    if not clean_seq:
        clean_seq = "ATGC"

    # Include the full alignment event so distinct indels cannot share stale cached metadata.
    mut_sig = "_".join(
        ":".join(str(m.get(key) or "") for key in (
            "type",
            "mutation_type",
            "reference_position",
            "reference_end_position",
            "observed_position",
            "reference_bases",
            "original_base",
            "observed_bases",
            "observed_base",
        ))
        for m in (mutations or [])
    )
    raw_hash = hashlib.md5(f"{clean_seq}_{mut_sig}".encode()).hexdigest()[:8].upper()
    gene_slug = re.sub(r"[^A-Za-z0-9]+", "", (gene or "DNA").upper())[:6] or "DNA"
    pdb_id = f"DNA_{gene_slug}_{raw_hash}"

    # Build the idealized canonical B-DNA coordinate model.
    pdb_text, mapped_residues, metrics = build_b_dna_pdb(
        sequence=clean_seq,
        mutations=mutations,
        title=f"BioCrystal 3D B-DNA - {gene_slug} ({len(clean_seq)} bp)",
    )

    # Save to cache so GET /api/pdb/{pdb_id} can serve it immediately
    cache_path = os.path.join(CACHE_DIR, f"{pdb_id}.pdb")
    try:
        with open(cache_path, "w", encoding="utf-8") as f:
            f.write(pdb_text)
    except Exception as e:
        print(f"Notice: could not write {cache_path}: {e}")

    try:
        from structure_comparison import compute_structural_comparison
    except ImportError:
        from backend.structure_comparison import compute_structural_comparison

    dna_comp = compute_structural_comparison(
        gene=gene or "DNA",
        mutations=mutations or [],
        reference_sequence=clean_seq,
    )

    return {
        "mapped": True,
        "structure_type": "idealized_dna_duplex",
        "pdb_id": pdb_id,
        "chain": "A",
        "reference_pdb_id": pdb_id,
        "reference_chain": "A",
        "comparison": dna_comp,
        "status": f"Computed idealized canonical B-DNA model ({len(clean_seq)} bp)",
        "reason": None,
        "mappings": mapped_residues,
        "metrics": metrics,
        "pdb_data": pdb_text,
        "provenance": {
            "database": "BioCrystal 3D Idealized B-DNA Builder",
            "pdb_id": pdb_id,
            "organism": organism or "In silico DNA model",
            "accession": accession or "Not applicable (generated model)",
            "title": f"Idealized Canonical B-DNA Model ({len(clean_seq)} bp)",
            "method": "Idealized canonical B-DNA coordinate builder",
            "resolution": "Not applicable (computed idealized model)",
            "chain": "A",
            "experimental_status": "Computed coordinates; not experimental",
            "model_type": "Idealized canonical antiparallel B-DNA duplex (Chains A + B)",
            "disclaimer": (
                "Generated idealized canonical B-DNA coordinates with Watson-Crick complementarity. "
                "This is not an experimental structure and does not model variant-specific folding or effects."
            ),
        },
    }


def map_mutations_to_structure(
    gene: Optional[str],
    pdb_id: Optional[str],
    mutations: List[Dict[str, Any]],
    reference_sequence: Optional[str] = None,
    is_coding: bool = True,
    reading_frame: int = 0,
    force_dna_mode: bool = False,
) -> Dict[str, Any]:
    """
    Structural mapping entry point.

    - By default, if force_dna_mode is True or if pdb_id is not a curated protein benchmark,
      it generates an idealized canonical B-DNA model for the submitted DNA sequence.
    - If a curated protein benchmark PDB (6OIM, 1A3N) is explicitly requested with is_coding=True,
      it resolves the protein coordinates for backward compatibility.
    """
    clean_reference = clean_dna_sequence(reference_sequence or "")

    # If explicit DNA mode or a DNA structure identifier is requested, generate an idealized B-DNA model.
    if force_dna_mode or (pdb_id and pdb_id.startswith("DNA_")):
        return generate_dna_structure_mapping(
            sequence=clean_reference,
            mutations=mutations,
            gene=gene or "DNA",
            organism="Homo sapiens",
        )

    # 1. Non-coding: never fabricate or infer a protein structure
    if not is_coding:
        return {
            "mapped": False,
            "pdb_id": None,
            "chain": None,
            "status": "Structural mapping unavailable",
            "reason": "Molecular structure unavailable for this sequence. Non-coding DNA sequences do not translate into physical protein structures. Sequence-level alignment and variant categorization are provided below.",
            "mappings": [],
            "provenance": None,
        }

    # 2. Determine curated reference/structure pair
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

    if target_config:
        supplied_pdb = (pdb_id or "").strip().upper()
        if len(supplied_pdb) == 4 and supplied_pdb != target_config["pdb_id"]:
            return {
                "mapped": False,
                "pdb_id": None,
                "chain": None,
                "status": "Structural mapping unavailable",
                "reason": "Molecular structure unavailable for this sequence. The supplied PDB identifier does not match the curated structure for this gene.",
                "mappings": [],
                "provenance": None,
            }

        # Verify that the submitted sequence exactly matches the curated coding sequence for this structure
        if clean_reference != target_config["coding_sequence"]:
            return {
                "mapped": False,
                "pdb_id": None,
                "chain": None,
                "status": "Structural mapping unavailable",
                "reason": "Molecular structure unavailable for this sequence. The supplied reference does not exactly match the curated coding sequence used for this PDB residue mapping. No residue coordinates were inferred.",
                "mappings": [],
                "provenance": None,
            }
    else:
        # Not in curated registry: check sequence length for informative scientific explanation
        if len(clean_reference) < 30:
            stop_codons = {"TAA", "TAG", "TGA"}
            total_codons = len(clean_reference) // 3
            aa_count = total_codons
            for c_i in range(total_codons):
                if clean_reference[c_i * 3 : c_i * 3 + 3] in stop_codons:
                    aa_count = c_i
                    break

            return {
                "mapped": False,
                "pdb_id": None,
                "chain": None,
                "status": "Structural mapping unavailable",
                "reason": f"Molecular structure unavailable for this sequence. The submitted sequence ({len(clean_reference)} bp) encodes only {aa_count} amino acids before its stop codon. No experimentally verified macromolecular structure exists in the Protein Data Bank.",
                "mappings": [],
                "provenance": None,
            }
        return {
            "mapped": False,
            "pdb_id": None,
            "chain": None,
            "status": "Structural mapping unavailable",
            "reason": "Molecular structure unavailable for this sequence. No curated coding-sequence-to-PDB mapping is available for this gene and structure. Sequence comparison remains available.",
            "mappings": [],
            "provenance": None,
        }

    pdb_content = fetch_pdb_file(target_config["pdb_id"])
    if not pdb_content:
        return {
            "mapped": False,
            "pdb_id": target_config["pdb_id"],
            "chain": target_config["chain"],
            "status": "Structural mapping unavailable",
            "reason": f"PDB structure {target_config['pdb_id']} could not be retrieved.",
            "mappings": [],
            "provenance": None,
        }

    try:
        structure = PDBParser(QUIET=True).get_structure(
            target_config["pdb_id"], StringIO(pdb_content)
        )
        chain = structure[0][target_config["chain"]]
    except (IndexError, KeyError, ValueError, PDBConstructionException) as exc:
        return {
            "mapped": False,
            "pdb_id": target_config["pdb_id"],
            "chain": target_config["chain"],
            "status": "Structural mapping unavailable",
            "reason": f"The configured PDB chain could not be parsed: {exc}",
            "mappings": [],
            "provenance": None,
        }

    mappings = []
    has_any_mapped = False

    for mut in mutations:
        if mut.get("type") == "substitution":
            ref_pos = mut.get("reference_position", 1)
            codon_idx = (ref_pos - 1 - reading_frame) // 3 + 1
            residue_num = codon_idx - target_config["cds_start_offset"]

            oa_raw = mut.get("original_amino_acid") or mut.get("reference_amino_acid") or {}
            ma_raw = mut.get("observed_amino_acid") or {}
            orig_aa = oa_raw.get("code3", "Unk") if isinstance(oa_raw, dict) else (oa_raw if isinstance(oa_raw, str) else "Unk")
            mut_aa = ma_raw.get("code3", "Unk") if isinstance(ma_raw, dict) else (ma_raw if isinstance(ma_raw, str) else "Unk")
            hotspot_info = target_config["known_hotspots"].get(residue_num, {})
            if residue_num not in chain:
                continue
            pdb_residue = seq1(chain[residue_num].resname)
            region = hotspot_info.get("region", "No curated region annotation")

            mut_code1 = ma_raw.get("code1") if isinstance(ma_raw, dict) else (ma_raw if isinstance(ma_raw, str) and len(ma_raw) == 1 else "")
            mappings.append({
                "mutation_ref_pos": ref_pos,
                "mutation_type": mut.get("type"),
                "dna_variant": f"{mut.get('original_base')}>{mut.get('observed_base')}",
                "chain": target_config["chain"],
                "residue_number": residue_num,
                "original_residue": orig_aa,
                "mutated_residue": mut_aa,
                "pdb_residue": pdb_residue,
                "pdb_matches_observed_residue": pdb_residue == mut_code1,
                "structural_region": region,
                "mapping_confidence": "Curated reference coordinate; PDB residue verified",
                "is_mapped": True,
                "limitation": "The displayed experimental coordinates are from this entry. Sequence differences outside curated codons are not modeled.",
            })
            has_any_mapped = True

    # If any frameshift mutation disrupts the protein reading frame:
    has_frameshift = any(
        m.get("category") == "frameshift" or m.get("mutation_type") == "frameshift"
        for m in mutations
    )
    if has_frameshift:
        return {
            "mapped": False,
            "pdb_id": target_config["pdb_id"],
            "chain": target_config["chain"],
            "status": "Structural mapping unmapped",
            "reason": "Molecular structure unmapped: frameshift mutation alters reading frame and disrupts native protein fold. Static reference PDB structure cannot model frameshifted conformation.",
            "mappings": [],
            "provenance": None,
        }

    is_mapped_status = True if (len(mutations) == 0 or has_any_mapped) else False

    try:
        from structure_comparison import compute_structural_comparison
    except ImportError:
        from backend.structure_comparison import compute_structural_comparison

    comp = compute_structural_comparison(
        gene=gene_key or target_config.get("gene", "KRAS"),
        mutations=mutations,
        reference_pdb_id=target_config.get("reference_pdb_id", target_config["pdb_id"]),
        reference_sequence=clean_reference,
    )

    # Fetch reference PDB data for dual side-by-side viewer
    ref_pdb_id = comp["reference"]["pdb_id"]
    ref_pdb_data = fetch_pdb_file(ref_pdb_id) if ref_pdb_id else None

    return {
        "mapped": is_mapped_status,
        "pdb_id": target_config["pdb_id"],
        "chain": target_config["chain"],
        "reference_pdb_id": ref_pdb_id,
        "reference_chain": comp["reference"]["chain"],
        "reference_pdb_data": ref_pdb_data,
        "comparison": comp,
        "status": "Wildtype reference PDB structure (0 mutations)" if len(mutations) == 0 else "Experimental PDB coordinates with verified residue locations",
        "reason": None if is_mapped_status else "No substitution could be localized in the configured PDB chain; indels are not mapped to static residue coordinates.",
        "mappings": mappings,
        "provenance": {
            "database": "RCSB Protein Data Bank",
            "pdb_id": target_config["pdb_id"],
            "organism": target_config["organism"],
            "title": target_config["title"],
            "method": target_config["method"],
            "resolution": target_config["resolution"],
            "chain": target_config["chain"],
            "experimental_status": "Reference-derived structure with mutated positions highlighted",
            "model_type": "Reference-derived structure with mutated positions highlighted",
            "disclaimer": "Reference-derived structure with mutated positions highlighted. The displayed coordinates are from this experimental PDB entry and are not generated de novo from this analysis.",
        },
    }
