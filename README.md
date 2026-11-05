# BioCrystal 3D

<div align="center">

![BioCrystal 3D Banner](https://images.openai.com/static-rsc-4/8tFXhug_0tXuZoUDm85j5XUYmMsHHakqcn673KUh0PBUZu3ndW-Y7SrHIwzEYfDb0PRuTr7k4YQ5ASI8szhbZYXAuvRDLohAGIk2WEUR-zpfy_sJ_4wkm31QdaT_81EAg67gproHC7Ojcljeizg3xKRKwPXf98eKlM1fZ2fVQI2AcfDGsTbBP0v7MHmwQeD7?purpose=inline)

### **Explore the sequence. Understand the change.**

*An interactive DNA mutation analyzer combining computational bioinformatics, sequence alignment, codon translation, candidate correction, and real-time 3D molecular visualization.*

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![React](https://img.shields.io/badge/React-19.0-61dafb.svg?logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178c6.svg?logo=typescript)](https://www.typescriptlang.org/)
[![Three.js](https://img.shields.io/badge/Three.js-r182-black.svg?logo=three.js)](https://threejs.org/)
[![Python](https://img.shields.io/badge/Python-3.10%2B-3776ab.svg?logo=python)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115%2B-009688.svg?logo=fastapi)](https://fastapi.tiangolo.com/)
[![Biopython](https://img.shields.io/badge/Biopython-1.83%2B-gold.svg)](https://biopython.org/)
[![Vite](https://img.shields.io/badge/Vite-8.3-646cff.svg?logo=vite)](https://vitejs.dev/)

[Key Features](#-key-features) • [Scientific Foundation](#-scientific-foundation) • [Architecture](#-system-architecture) • [Quick Start](#-quick-start) • [REST API](#-rest-api-endpoints) • [Verification](#-verification--tests) • [Responsible Use](#-responsible-use--disclaimer)

</div>

---

## 🔬 Overview

**BioCrystal 3D** is a full-stack computational biology platform and molecular visualization workstation. It bridges the gap between abstract nucleic acid sequence data and physical molecular structures, enabling researchers, bioinformaticians, and students to:

1. **Simulate point mutations, insertions, deletions (indels)**, and frameshifts in real-time.
2. **Visualize canonical B-DNA** in authentic 3D stereoscopic space with dynamic viewport framing, groove depths, and nucleotide color-coding.
3. **Analyze mutation consequences** against the Standard Genetic Code (synonymous, missense, nonsense, in-frame indel, frameshift).
4. **Detect sequence variations** automatically using Biopython pairwise sequence alignment.
5. **Synthesize restorative correction candidates** with scientific rationale and confidence metrics.
6. **Generate publication-ready PDF evaluation reports** compliant with molecular genetics conventions.

---

## ✨ Key Features

### 1. 🧬 Interactive 3D B-DNA Molecular Workstation
- **Avogadro-Grade Scientific Rendering**: Real-time Three.js / React Three Fiber renderer computing mathematical cylindrical coordinates for every base pair.
- **Dynamic Viewport Framing**: Frustum height dynamically scales with sequence length so the double-helix commands **75–80% of vertical viewport space** with depth and volume.
- **Multiple Representation Modes**:
  - `Surface`: Van der Waals continuous envelope.
  - `Ball & Stick`: Atomic-scale spheres with covalent bond struts.
  - `Backbone`: Sugar-phosphate helical ribbon path.
  - `Base Pair`: Skeletal rung ladder with hydrogen bond bridges.
  - `Educational`: Color-block structural topology with position badges.
- **Camera Orientation Dock**: Instantly toggle between `3D Isometric`, `Front (Coronal)`, `Axial Top (Rosette Cross-Section)`, and `Groove Side (Major & Minor Grooves)`.
- **High-Resolution Snapshot Engine**: Direct 1-click canvas snapshot export (`PNG`) with transparent drawing buffer preservation.

### 2. 🧪 Real-Time Mutation Laboratory
- **Interactive Mutation Workbench**: Introduce substitutions ($A, T, G, C$), insertions, and deletions at arbitrary 1-indexed coordinates.
- **Biochemical Consequence Categorization**:
  - **Synonymous (Silent)**: Triplet alters, but translated amino acid remains identical (e.g. `ACT` $\to$ `ACG` both code for Threonine, `Thr`).
  - **Missense**: Triplet encodes a different residue, distinguishing conservative vs non-conservative chemical shifts.
  - **Nonsense**: Introduces a premature STOP codon (`*`), causing truncated polypeptide products.
  - **Frameshift**: Non-triplet indels disrupting all downstream reading frames.
  - **In-frame Indel**: Multiples of 3 nt adding/removing whole residues without altering the downstream phase.
  - **Transitions vs Transversions**: Tracks purine-purine / pyrimidine-pyrimidine transitions vs purine-pyrimidine transversions.

### 3. 🔍 Intelligent Reference Comparison & Alignment
- **Biopython Pairwise Alignment**: Detect substitutions, deletions, and insertions relative to reference sequences or NCBI RefSeq templates.
- **Split-Screen Synchronized View**: Side-by-side synchronized 3D comparison of Canonical Wild-Type vs Observed Variant with synchronized OrbitControls.
- **Differential Highlighting**: Mutated positions illuminate in radiant amber (`#F3B347`), maintaining clear contrast against the scientific dark canvas (`#090A0C`).

### 4. 📊 Dual-Strand Sequence Dock & Molecular Inspector
- **Dual-Strand Ribbon**: $5' \to 3'$ sense coding strand paired with antiparallel $3' \leftarrow 5'$ complementary strand.
- **Deep Molecular Inspector**: Real-time evaluation of selected bases:
  - Formula, Molecular Weight ($g/mol$), Purine/Pyrimidine ring structure.
  - Watson-Crick hydrogen bonding count ($2$ for A-T, $3$ for G-C).
  - Hydropathy index, polarity, and chemical charge category.
  - Codon trio position (1st, 2nd, or 3rd wobble base).

### 5. 📑 Scientific Report & PDF Generator
- Formal computational biology assessment summary.
- Export to PDF using ReportLab with tabular metrics, GC/AT ratios, melting temperatures ($T_m$), and candidate restoration suggestions.

---

## 📐 Scientific Foundation

BioCrystal 3D is engineered upon authoritative physical and stereochemical parameters of **Canonical B-DNA**:

| Parameter | Biological Value | BioCrystal 3D Modeling Implementation |
|---|---|---|
| **Helical Rise per Base Pair** | $3.4\text{ \AA}$ ($0.34\text{ nm}$) | $y = (i - \text{halfLength}) \times 1.35$ |
| **Helical Twist per Base Pair** | $36.0^\circ$ ($10.0\text{ bp/turn}$) | $\theta = i \times \frac{2\pi}{10}$ |
| **Strand Phase Offset** | $144.0^\circ$ ($2.51\text{ rad}$) | Generates canonical **minor groove** ($144^\circ$) and **major groove** ($216^\circ$) |
| **Watson-Crick Base Pairing** | Strict hydrogen bonding | $\text{A} \leftrightarrow \text{T}$ ($2\text{ H-bonds}$), $\text{G} \leftrightarrow \text{C}$ ($3\text{ H-bonds}$) |
| **Antiparallel Architecture** | Reverse 5' to 3' orientation | Coding ($5' \to 3'$) vs Complementary ($3' \to 5'$) ribbons |
| **Translation Tables** | NCBI Standard Genetic Code | Table 1 (Standard), Table 2 (Vertebrate Mitochondrial), Table 11 (Bacterial/Plastid) |

---

## 🏗 System Architecture

```text
BioCrystal-3D/
├── frontend/                     # React 19 + TypeScript + Vite + Three.js + Tailwind CSS
│   ├── src/
│   │   ├── components/
│   │   │   ├── 3d/
│   │   │   │   ├── DNAModel.tsx        # Mathematical 3D B-DNA molecular geometry
│   │   │   │   ├── DNAScene.tsx        # Three.js canvas, dynamic camera framing, presets
│   │   │   │   └── ComparisonView.tsx  # Dual synchronized split-screen comparison
│   │   │   └── ui/
│   │   │       ├── LandingPage.tsx           # Editorial scientific landing interface
│   │   │       ├── Navbar.tsx                # Command bar, modes, presets, snapshot
│   │   │       ├── SidebarNav.tsx            # Navigation & B-DNA parameters card
│   │   │       ├── NucleotideDetailPanel.tsx # Right molecular inspector
│   │   │       ├── BottomSequenceViewer.tsx  # Dual-strand antiparallel sequence ribbon
│   │   │       ├── SequenceInputPanel.tsx    # FASTA editor & NCBI reference sequence catalog
│   │   │       ├── SequenceExplorerView.tsx  # Reading frame translation matrix
│   │   │       ├── MutationControlPanel.tsx  # Point mutation & indel workbench
│   │   │       ├── IntelligentMutationAnalysis.tsx # Biopython AI consequence predictor
│   │   │       └── ReportView.tsx            # Scientific report & PDF exporter
│   │   ├── services/
│   │   │   ├── bDNAEngine.ts      # Canonical B-DNA coordinate generator
│   │   │   └── bioinformatics.ts # In-silico translation, codons, indels
│   │   ├── types/
│   │   │   └── dna.ts             # TypeScript scientific domain models
│   │   ├── App.tsx                # Master workstation layout & state synchronization
│   │   └── App.css                # Scoped scientific dark theme tokens
│   ├── package.json
│   └── vite.config.ts
│
├── backend/                      # Python 3 + FastAPI + Biopython + ReportLab
│   ├── main.py                   # REST API service endpoints
│   ├── bio_engine.py             # Biopython alignment & consequence prediction
│   ├── pdf_generator.py          # ReportLab clinical report generation
│   ├── test_mutation_engine.py   # Unit test suite (7 tests)
│   ├── test_api_integration.py   # FastAPI integration test suite (8 tests)
│   └── requirements.txt          # Python dependencies
│
├── docs/
│   └── screenshots/              # Application screenshots & media
├── run.bat                       # One-click launcher for Windows
├── README.md                     # Comprehensive documentation
└── LICENSE                       # MIT License
```

---

## ⚡ Quick Start

### Prerequisites
- **Node.js** 18+ and **npm**
- **Python** 3.10+

### Option A: One-Click Launch (Windows)
Double-click `run.bat` in the project root:
```bat
run.bat
```
This automatically starts both the Python FastAPI server (`http://127.0.0.1:8000`) and the Vite development server (`http://localhost:5173`).

---

### Option B: Manual Setup

#### 1. Backend Setup (FastAPI + Biopython)
```bash
# Navigate to backend directory
cd backend

# Create virtual environment (optional but recommended)
python -m venv venv
# On Windows:
venv\Scripts\activate
# On Linux/macOS:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Start the API server
python -m uvicorn main:app --host 127.0.0.1 --port 8000 --reload
```
*API interactive documentation will be live at `http://127.0.0.1:8000/docs`.*

#### 2. Frontend Setup (React + Vite)
```bash
# Open a new terminal and navigate to frontend directory
cd frontend

# Install npm packages
npm install

# Start Vite dev server
npm run dev
```
*Open your browser and navigate to `http://localhost:5173`.*

---

## 🔌 REST API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/validate` | Validates raw DNA/FASTA, calculates GC%, melting temperature ($T_m$), and molecular weight. |
| `POST` | `/api/mutate` | Applies point substitution, insertion, or deletion; returns consequence and mutated sequence. |
| `POST` | `/api/analyze` | Executes pairwise alignment, consequence prediction, and candidate restoration. |
| `POST` | `/api/export-pdf` | Generates a binary ReportLab PDF document stream with evaluation tables. |

---

## 🧪 Verification & Tests

### Backend Test Suites
```bash
# Run Biopython mutation engine unit tests
python backend/test_mutation_engine.py

# Run FastAPI endpoint integration tests
python backend/test_api_integration.py
```
*Output: 15/15 tests passing across alignment, frameshifts, and REST endpoints.*

### Frontend Production Build & Linter
```bash
# Run TypeScript compilation and Vite production bundle
npm --prefix frontend run build

# Run Oxlint / ESLint linter
npm --prefix frontend run lint
```
*Output: 0 errors, build succeeds in under 2 seconds.*

---

## 🛡 Responsible Use & Disclaimer

> [!NOTE]
> **BioCrystal 3D** is developed for **academic research, bioinformatics education, and computational simulation purposes**. In-silico consequence predictions and candidate restorative recommendations are algorithmic hypotheses generated using standardized codon translation matrices and pairwise sequence alignments. They do not constitute clinical genetic diagnoses or medical guidance. Wet-lab biological assays (e.g. Sanger/NGS sequencing, functional expression assays) are mandatory before drawing clinical or therapeutic conclusions.

---

## 📄 License

This project is licensed under the **MIT License** — see the [LICENSE](LICENSE) file for details.

---

<div align="center">
Made with precision for Computational Biology & Molecular Visualization.
</div>
