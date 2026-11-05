import React, { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { Text } from '@react-three/drei';
import {
  VisualizationMode,
  QualityPreset,
  NucleotideType,
} from '../../types/dna';
import {
  generateBDNAGeometry,
  BASE_COLORS,
  MUTATION_COLOR,
  CODING_STRAND_COLOR,
  COMPLEMENTARY_STRAND_COLOR,
  HYDROGEN_BOND_COLOR,
} from '../../services/bDNAEngine';

interface DNAModelProps {
  sequence: string;
  visualizationMode: VisualizationMode;
  selectedPosition: number | null;
  selectedStrand: 'coding' | 'complementary' | null;
  mutatedPositions: Set<number>;
  qualityPreset: QualityPreset;
  onSelectNucleotide: (position: number, strand: 'coding' | 'complementary') => void;
  hoveredPosition: number | null;
  setHoveredPosition: (pos: number | null) => void;
}

export const DNAModel: React.FC<DNAModelProps> = ({
  sequence,
  visualizationMode,
  selectedPosition,
  selectedStrand,
  mutatedPositions,
  qualityPreset,
  onSelectNucleotide,
  hoveredPosition,
  setHoveredPosition,
}) => {
  const groupRef = useRef<THREE.Group>(null);
  const selectionGlowRef = useRef<THREE.Mesh>(null);

  // Geometry quality segmentation based on preset
  const { tubularSegments, radialSegments, sphereSegments } = useMemo(() => {
    switch (qualityPreset) {
      case 'low':
        return { tubularSegments: 64, radialSegments: 6, sphereSegments: 10 };
      case 'medium':
        return { tubularSegments: 128, radialSegments: 10, sphereSegments: 16 };
      case 'high':
        return { tubularSegments: 200, radialSegments: 16, sphereSegments: 24 };
      case 'ultra':
        return { tubularSegments: 300, radialSegments: 24, sphereSegments: 32 };
    }
  }, [qualityPreset]);

  // Generate canonical B-DNA coordinates
  const geometryResult = useMemo(() => {
    return generateBDNAGeometry(sequence, mutatedPositions);
  }, [sequence, mutatedPositions]);

  // Animate selection glow effect
  useFrame(({ clock }) => {
    if (selectionGlowRef.current) {
      const pulse = 1 + 0.15 * Math.sin(clock.getElapsedTime() * 4);
      selectionGlowRef.current.scale.set(pulse, pulse, pulse);
    }
  });

  // Create tube geometries for the two backbones
  const codingTubeGeo = useMemo(() => {
    if (geometryResult.basePairs.length < 2) return null;
    const radius = visualizationMode === 'surface' ? 0.75 : visualizationMode === 'backbone' ? 0.6 : 0.35;
    return new THREE.TubeGeometry(
      geometryResult.codingBackboneSpline,
      tubularSegments,
      radius,
      radialSegments,
      false
    );
  }, [geometryResult, visualizationMode, tubularSegments, radialSegments]);

  const complementTubeGeo = useMemo(() => {
    if (geometryResult.basePairs.length < 2) return null;
    const radius = visualizationMode === 'surface' ? 0.75 : visualizationMode === 'backbone' ? 0.6 : 0.35;
    return new THREE.TubeGeometry(
      geometryResult.complementBackboneSpline,
      tubularSegments,
      radius,
      radialSegments,
      false
    );
  }, [geometryResult, visualizationMode, tubularSegments, radialSegments]);

  // Helper to get color of a base
  const getBaseColor = (base: NucleotideType, isMutated: boolean) => {
    if (isMutated) return MUTATION_COLOR;
    return BASE_COLORS[base] || '#94a3b8';
  };

  // Find 3D coordinate of selected position for highlight ring
  const selectedCoord = useMemo(() => {
    if (!selectedPosition) return null;
    const bp = geometryResult.basePairs.find((b) => b.position === selectedPosition);
    if (!bp) return null;
    return selectedStrand === 'complementary' ? bp.complementBasePos : bp.codingBasePos;
  }, [selectedPosition, selectedStrand, geometryResult]);

  return (
    <group ref={groupRef}>
      {/* 5' and 3' Directional Labels at helix termini */}
      {geometryResult.basePairs.length > 0 && (
        <>
          {/* Coding strand 5' start and 3' end */}
          <group position={geometryResult.basePairs[0].codingBackbonePos}>
            <Text
              position={[-0.8, 0.4, 0]}
              fontSize={0.5}
              color="#36c5e8"
              anchorX="center"
              anchorY="middle"
              outlineWidth={0.06}
              outlineColor="#080808"
            >
              5' (Coding)
            </Text>
          </group>
          <group position={geometryResult.basePairs[geometryResult.basePairs.length - 1].codingBackbonePos}>
            <Text
              position={[-0.8, -0.4, 0]}
              fontSize={0.5}
              color="#36c5e8"
              anchorX="center"
              anchorY="middle"
              outlineWidth={0.06}
              outlineColor="#080808"
            >
              3'
            </Text>
          </group>

          {/* Complementary strand 3' start and 5' end */}
          <group position={geometryResult.basePairs[0].complementBackbonePos}>
            <Text
              position={[0.8, 0.4, 0]}
              fontSize={0.5}
              color="#a78bfa"
              anchorX="center"
              anchorY="middle"
              outlineWidth={0.06}
              outlineColor="#080808"
            >
              3' (Comp)
            </Text>
          </group>
          <group position={geometryResult.basePairs[geometryResult.basePairs.length - 1].complementBackbonePos}>
            <Text
              position={[0.8, -0.4, 0]}
              fontSize={0.5}
              color="#a78bfa"
              anchorX="center"
              anchorY="middle"
              outlineWidth={0.06}
              outlineColor="#080808"
            >
              5'
            </Text>
          </group>
        </>
      )}

      {/* Sugar-Phosphate Backbones */}
      {codingTubeGeo && (
        <mesh geometry={codingTubeGeo}>
          <meshStandardMaterial
            color={CODING_STRAND_COLOR}
            roughness={0.25}
            metalness={0.4}
            transparent={visualizationMode === 'surface'}
            opacity={visualizationMode === 'surface' ? 0.75 : 0.95}
          />
        </mesh>
      )}

      {complementTubeGeo && (
        <mesh geometry={complementTubeGeo}>
          <meshStandardMaterial
            color={COMPLEMENTARY_STRAND_COLOR}
            roughness={0.25}
            metalness={0.4}
            transparent={visualizationMode === 'surface'}
            opacity={visualizationMode === 'surface' ? 0.75 : 0.95}
          />
        </mesh>
      )}

      {/* Base Pairs & Molecular Elements */}
      {geometryResult.basePairs.map((bp) => {
        const isSelected = selectedPosition === bp.position;
        const isHovered = hoveredPosition === bp.position;
        const isMutated = bp.isMutated;

        const codingColor = getBaseColor(bp.codingBase, isMutated);
        const complementColor = getBaseColor(bp.complementBase, isMutated);

        // Vector between coding and complement bases
        const v1 = new THREE.Vector3(...bp.codingBasePos);
        const v2 = new THREE.Vector3(...bp.complementBasePos);
        const rungDir = new THREE.Vector3().subVectors(v2, v1);
        const rungLength = rungDir.length();
        const rungMid = new THREE.Vector3().addVectors(v1, v2).multiplyScalar(0.5);

        // Connecting backbone struts
        const cBackboneVec = new THREE.Vector3(...bp.codingBackbonePos);
        const compBackboneVec = new THREE.Vector3(...bp.complementBackbonePos);

        return (
          <group key={`bp_${bp.position}`}>
            {/* Strut from backbone to base (Coding) */}
            <line>
              <bufferGeometry>
                <bufferAttribute
                  attach="attributes-position"
                  count={2}
                  args={[new Float32Array([...bp.codingBackbonePos, ...bp.codingBasePos]), 3]}
                />
              </bufferGeometry>
              <lineBasicMaterial color={CODING_STRAND_COLOR} linewidth={2} transparent opacity={0.6} />
            </line>

            {/* Strut from backbone to base (Complement) */}
            <line>
              <bufferGeometry>
                <bufferAttribute
                  attach="attributes-position"
                  count={2}
                  args={[new Float32Array([...bp.complementBackbonePos, ...bp.complementBasePos]), 3]}
                />
              </bufferGeometry>
              <lineBasicMaterial color={COMPLEMENTARY_STRAND_COLOR} linewidth={2} transparent opacity={0.6} />
            </line>

            {/* Coding Nucleotide clickable sphere / plate */}
            <mesh
              position={bp.codingBasePos}
              onClick={(e) => {
                e.stopPropagation();
                onSelectNucleotide(bp.position, 'coding');
              }}
              onPointerOver={(e) => {
                e.stopPropagation();
                setHoveredPosition(bp.position);
                document.body.style.cursor = 'pointer';
              }}
              onPointerOut={() => {
                setHoveredPosition(null);
                document.body.style.cursor = 'auto';
              }}
            >
              {visualizationMode === 'educational' ? (
                <boxGeometry args={[0.7, 0.45, 0.7]} />
              ) : visualizationMode === 'surface' ? (
                <sphereGeometry args={[0.85, sphereSegments, sphereSegments]} />
              ) : (
                <sphereGeometry
                  args={[bp.codingBase === 'A' || bp.codingBase === 'G' ? 0.6 : 0.5, sphereSegments, sphereSegments]}
                />
              )}
              <meshStandardMaterial
                color={codingColor}
                emissive={
                  isMutated
                    ? MUTATION_COLOR
                    : isSelected && selectedStrand === 'coding'
                    ? '#ff7417'
                    : isHovered
                    ? '#ffffff'
                    : '#000000'
                }
                emissiveIntensity={isMutated ? 0.75 : isSelected ? 0.65 : isHovered ? 0.2 : 0}
                roughness={0.25}
                metalness={0.25}
              />
            </mesh>

            {/* Nucleotide letter label in educational & base-pair modes */}
            {(visualizationMode === 'educational' || visualizationMode === 'base-pair') && (
              <Text
                position={[bp.codingBasePos[0] * 1.35, bp.codingBasePos[1], bp.codingBasePos[2] * 1.35]}
                fontSize={0.45}
                color={isMutated ? '#fbbf24' : '#ffffff'}
                anchorX="center"
                anchorY="middle"
                outlineWidth={0.05}
                outlineColor="#0f172a"
              >
                {`${bp.codingBase}${bp.position}`}
              </Text>
            )}

            {/* Complementary Nucleotide clickable sphere / plate */}
            <mesh
              position={bp.complementBasePos}
              onClick={(e) => {
                e.stopPropagation();
                onSelectNucleotide(bp.position, 'complementary');
              }}
              onPointerOver={(e) => {
                e.stopPropagation();
                setHoveredPosition(bp.position);
                document.body.style.cursor = 'pointer';
              }}
              onPointerOut={() => {
                setHoveredPosition(null);
                document.body.style.cursor = 'auto';
              }}
            >
              {visualizationMode === 'educational' ? (
                <boxGeometry args={[0.7, 0.45, 0.7]} />
              ) : visualizationMode === 'surface' ? (
                <sphereGeometry args={[0.85, sphereSegments, sphereSegments]} />
              ) : (
                <sphereGeometry
                  args={[
                    bp.complementBase === 'A' || bp.complementBase === 'G' ? 0.6 : 0.5,
                    sphereSegments,
                    sphereSegments,
                  ]}
                />
              )}
              <meshStandardMaterial
                color={complementColor}
                emissive={
                  isMutated
                    ? MUTATION_COLOR
                    : isSelected && selectedStrand === 'complementary'
                    ? '#ff7417'
                    : isHovered
                    ? '#ffffff'
                    : '#000000'
                }
                emissiveIntensity={isMutated ? 0.75 : isSelected ? 0.65 : isHovered ? 0.2 : 0}
                roughness={0.25}
                metalness={0.25}
              />
            </mesh>

            {(visualizationMode === 'educational' || visualizationMode === 'base-pair') && (
              <Text
                position={[bp.complementBasePos[0] * 1.35, bp.complementBasePos[1], bp.complementBasePos[2] * 1.35]}
                fontSize={0.45}
                color={isMutated ? '#fbbf24' : '#ffffff'}
                anchorX="center"
                anchorY="middle"
                outlineWidth={0.05}
                outlineColor="#0f172a"
              >
                {`${bp.complementBase}${bp.position}`}
              </Text>
            )}

            {/* Hydrogen Bonds */}
            {bp.hydrogenBondPoints.map(([p1, p2], hIdx) => {
              const hb1 = new THREE.Vector3(...p1);
              const hb2 = new THREE.Vector3(...p2);
              const hbDir = new THREE.Vector3().subVectors(hb2, hb1);
              const hbLen = hbDir.length();
              const hbMid = new THREE.Vector3().addVectors(hb1, hb2).multiplyScalar(0.5);

              // Quaternion orientation along bond direction
              const orientation = new THREE.Quaternion();
              orientation.setFromUnitVectors(new THREE.Vector3(0, 1, 0), hbDir.clone().normalize());

              return (
                <mesh
                  key={`hb_${bp.position}_${hIdx}`}
                  position={hbMid}
                  quaternion={orientation}
                >
                  <cylinderGeometry args={[0.045, 0.045, hbLen, 6]} />
                  <meshStandardMaterial
                    color={HYDROGEN_BOND_COLOR}
                    emissive={HYDROGEN_BOND_COLOR}
                    emissiveIntensity={0.6}
                    roughness={0.1}
                  />
                </mesh>
              );
            })}

            {/* Ball-and-Stick mode: extra connecting cylinder between base and backbone */}
            {visualizationMode === 'ball-and-stick' && (
              <>
                {/* coding rung segment */}
                <mesh
                  position={new THREE.Vector3().addVectors(cBackboneVec, v1).multiplyScalar(0.5)}
                  quaternion={new THREE.Quaternion().setFromUnitVectors(
                    new THREE.Vector3(0, 1, 0),
                    new THREE.Vector3().subVectors(v1, cBackboneVec).normalize()
                  )}
                >
                  <cylinderGeometry args={[0.08, 0.08, cBackboneVec.distanceTo(v1), 8]} />
                  <meshStandardMaterial color="#64748b" metalness={0.6} roughness={0.3} />
                </mesh>
                {/* complement rung segment */}
                <mesh
                  position={new THREE.Vector3().addVectors(compBackboneVec, v2).multiplyScalar(0.5)}
                  quaternion={new THREE.Quaternion().setFromUnitVectors(
                    new THREE.Vector3(0, 1, 0),
                    new THREE.Vector3().subVectors(v2, compBackboneVec).normalize()
                  )}
                >
                  <cylinderGeometry args={[0.08, 0.08, compBackboneVec.distanceTo(v2), 8]} />
                  <meshStandardMaterial color="#64748b" metalness={0.6} roughness={0.3} />
                </mesh>
              </>
            )}

            {/* Base-Pair mode: central rung connector cylinder */}
            {visualizationMode === 'base-pair' && (
              <mesh
                position={rungMid}
                quaternion={new THREE.Quaternion().setFromUnitVectors(
                  new THREE.Vector3(0, 1, 0),
                  rungDir.clone().normalize()
                )}
              >
                <cylinderGeometry args={[0.12, 0.12, rungLength * 0.75, 8]} />
                <meshStandardMaterial
                  color={isMutated ? MUTATION_COLOR : '#94a3b8'}
                  transparent
                  opacity={0.7}
                  roughness={0.4}
                />
              </mesh>
            )}
          </group>
        );
      })}

      {/* Selected Nucleotide Glowing Halo Ring */}
      {selectedCoord && (
        <mesh ref={selectionGlowRef} position={selectedCoord}>
          <ringGeometry args={[0.75, 0.95, 32]} />
          <meshBasicMaterial
            color="#ff7417"
            side={THREE.DoubleSide}
            transparent
            opacity={0.9}
          />
        </mesh>
      )}
    </group>
  );
};

