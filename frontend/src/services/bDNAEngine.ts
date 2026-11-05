import * as THREE from 'three';
import { NucleotideType, AtomCoord, BasePair3DGeometry } from '../types/dna';
import { getComplementaryBase } from './bioinformatics';

export interface BDNAHelixParameters {
  risePerBasePair: number; // vertical distance per bp (world units)
  twistPerBasePair: number; // rotation in radians (36 deg = ~0.6283 rad)
  backboneRadius: number; // distance from central axis to phosphate
  baseCenterRadius: number; // distance from central axis to base center
  strandPhaseOffset: number; // offset between strands creating minor/major groove (144 deg)
  propellerTwist: number; // small angle between base planes (~10-12 deg)
}

export const CANONICAL_BDNA_PARAMS: BDNAHelixParameters = {
  risePerBasePair: 1.35,
  twistPerBasePair: (36 * Math.PI) / 180, // 36 degrees = 10 bp / turn
  backboneRadius: 3.4,
  baseCenterRadius: 1.5,
  strandPhaseOffset: (144 * Math.PI) / 180, // produces minor groove (144 deg) & major groove (216 deg)
  propellerTwist: (-12 * Math.PI) / 180,
};

// Base colors according to scientific molecular conventions & enterprise workstation palette
export const BASE_COLORS: Record<NucleotideType, string> = {
  A: '#35C98A', // Precision Green (Adenine)
  T: '#FF6500', // Scientific Orange (Thymine)
  G: '#22C7E8', // Cyan Molecular Accent (Guanine)
  C: '#F06464', // Coral Red (Cytosine)
};

export const MUTATION_COLOR = '#F3B347'; // Radiant Amber (Mutation Differential)
export const CODING_STRAND_COLOR = '#22C7E8'; // Cyan (5' to 3' Coding Strand)
export const COMPLEMENTARY_STRAND_COLOR = '#A78BFA'; // Purple (3' to 5' Complementary Strand)
export const HYDROGEN_BOND_COLOR = '#F4F4F2'; // Polar White / Ice

export interface HelixGeometryResult {
  basePairs: BasePair3DGeometry[];
  codingBackboneSpline: THREE.CatmullRomCurve3;
  complementBackboneSpline: THREE.CatmullRomCurve3;
  atoms: AtomCoord[];
  boundingBox: THREE.Box3;
  centerOfMass: THREE.Vector3;
}

/**
 * Computes canonical 3D coordinates and geometries for a B-DNA double helix.
 */
export function generateBDNAGeometry(
  sequence: string,
  mutatedPositions: Set<number> = new Set(),
  params: BDNAHelixParameters = CANONICAL_BDNA_PARAMS
): HelixGeometryResult {
  const basePairs: BasePair3DGeometry[] = [];
  const atoms: AtomCoord[] = [];
  const codingPoints: THREE.Vector3[] = [];
  const complementPoints: THREE.Vector3[] = [];

  const length = sequence.length;
  const halfLength = (length - 1) / 2;

  for (let i = 0; i < length; i++) {
    const position = i + 1; // 1-indexed
    const codingBase = sequence[i] as NucleotideType;
    const complementBase = getComplementaryBase(codingBase);
    const isMutated = mutatedPositions.has(position);
    const codonIndex = Math.floor(i / 3) + 1;

    // Y axis aligns along the helical axis, centered at 0
    const y = (i - halfLength) * params.risePerBasePair;

    // Rotation angle around helical axis
    const angle1 = i * params.twistPerBasePair;
    // Antiparallel complementary strand is offset by minor groove angle
    const angle2 = angle1 + params.strandPhaseOffset;

    // Sugar-phosphate backbone positions
    const b1x = Math.cos(angle1) * params.backboneRadius;
    const b1z = Math.sin(angle1) * params.backboneRadius;
    const codingBackbonePos: [number, number, number] = [b1x, y, b1z];

    const b2x = Math.cos(angle2) * params.backboneRadius;
    const b2z = Math.sin(angle2) * params.backboneRadius;
    const complementBackbonePos: [number, number, number] = [b2x, y, b2z];

    codingPoints.push(new THREE.Vector3(b1x, y, b1z));
    complementPoints.push(new THREE.Vector3(b2x, y, b2z));

    // Base center positions (inward towards central helical axis)
    const base1x = Math.cos(angle1) * params.baseCenterRadius;
    const base1z = Math.sin(angle1) * params.baseCenterRadius;
    const codingBasePos: [number, number, number] = [base1x, y, base1z];

    const base2x = Math.cos(angle2) * params.baseCenterRadius;
    const base2z = Math.sin(angle2) * params.baseCenterRadius;
    const complementBasePos: [number, number, number] = [base2x, y, base2z];

    // Center of the base pair rung
    const centerX = (base1x + base2x) / 2;
    const centerZ = (base1z + base2z) / 2;
    const center: [number, number, number] = [centerX, y, centerZ];

    // Compute hydrogen bond bridge points
    // A-T has 2 H-bonds; G-C has 3 H-bonds
    const hBondCount = codingBase === 'A' || codingBase === 'T' ? 2 : 3;
    const hydrogenBondPoints: Array<[[number, number, number], [number, number, number]]> = [];

    const hOffsetStep = 0.22;
    for (let h = 0; h < hBondCount; h++) {
      const hYOffset = (h - (hBondCount - 1) / 2) * hOffsetStep;
      const t1 = 0.35;
      const t2 = 0.65;
      const p1: [number, number, number] = [
        base1x + (base2x - base1x) * t1,
        y + hYOffset,
        base1z + (base2z - base1z) * t1,
      ];
      const p2: [number, number, number] = [
        base1x + (base2x - base1x) * t2,
        y + hYOffset,
        base1z + (base2z - base1z) * t2,
      ];
      hydrogenBondPoints.push([p1, p2]);
    }

    basePairs.push({
      position,
      codingBase,
      complementBase,
      center,
      rotation: [0, -angle1, params.propellerTwist],
      codingBackbonePos,
      complementBackbonePos,
      codingBasePos,
      complementBasePos,
      hydrogenBondPoints,
      isMutated,
      codonIndex,
    });

    // Generate atom coordinates for ball-and-stick mode:
    // 1. Phosphate group (Phosphorus + oxygens) on coding strand
    atoms.push({
      id: `P1_${position}`,
      name: 'P',
      element: 'P',
      x: b1x,
      y,
      z: b1z,
      radius: 0.38,
      color: '#fbbf24',
      strand: 'coding',
      basePosition: position,
      isMutated,
    });
    // Sugar ring center
    atoms.push({
      id: `S1_${position}`,
      name: 'Sugar-C',
      element: 'C',
      x: b1x * 0.75 + base1x * 0.25,
      y: y - 0.2,
      z: b1z * 0.75 + base1z * 0.25,
      radius: 0.3,
      color: '#38bdf8',
      strand: 'coding',
      basePosition: position,
      isMutated,
    });
    // Base atom / ring
    atoms.push({
      id: `B1_${position}`,
      name: codingBase,
      element: 'N',
      x: base1x,
      y,
      z: base1z,
      radius: codingBase === 'A' || codingBase === 'G' ? 0.45 : 0.38, // Purines are larger than pyrimidines
      color: isMutated ? MUTATION_COLOR : BASE_COLORS[codingBase],
      strand: 'coding',
      basePosition: position,
      isMutated,
    });

    // Complementary strand atoms
    atoms.push({
      id: `P2_${position}`,
      name: 'P',
      element: 'P',
      x: b2x,
      y,
      z: b2z,
      radius: 0.38,
      color: '#f43f5e',
      strand: 'complementary',
      basePosition: position,
      isMutated,
    });
    atoms.push({
      id: `S2_${position}`,
      name: 'Sugar-C',
      element: 'C',
      x: b2x * 0.75 + base2x * 0.25,
      y: y + 0.2, // antiparallel offset
      z: b2z * 0.75 + base2z * 0.25,
      radius: 0.3,
      color: '#fb7185',
      strand: 'complementary',
      basePosition: position,
      isMutated,
    });
    atoms.push({
      id: `B2_${position}`,
      name: complementBase,
      element: 'N',
      x: base2x,
      y,
      z: base2z,
      radius: complementBase === 'A' || complementBase === 'G' ? 0.45 : 0.38,
      color: isMutated ? MUTATION_COLOR : BASE_COLORS[complementBase],
      strand: 'complementary',
      basePosition: position,
      isMutated,
    });
  }

  // Create smooth Catmull-Rom splines for the sugar-phosphate backbones
  const codingBackboneSpline = new THREE.CatmullRomCurve3(codingPoints);
  const complementBackboneSpline = new THREE.CatmullRomCurve3(complementPoints);

  // Compute bounding box and center
  const boundingBox = new THREE.Box3();
  codingPoints.forEach((pt) => boundingBox.expandByPoint(pt));
  complementPoints.forEach((pt) => boundingBox.expandByPoint(pt));

  const centerOfMass = new THREE.Vector3();
  boundingBox.getCenter(centerOfMass);

  return {
    basePairs,
    codingBackboneSpline,
    complementBackboneSpline,
    atoms,
    boundingBox,
    centerOfMass,
  };
}

