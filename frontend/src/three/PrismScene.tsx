import { Suspense, useMemo, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Environment, Float, Lightformer, MeshTransmissionMaterial, Sparkles } from '@react-three/drei';
import * as THREE from 'three';

export const SPECTRUM = ['#8b5cf6', '#6366f1', '#3b82f6', '#22d3ee', '#34d399', '#facc15', '#fb923c'];

type Variant = 'hero' | 'auth' | 'analyze';

/** Soft gradient beam: bright core fading toward the tip, additive so overlapping rays glow. */
function beamMaterial(color: string) {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    uniforms: { uColor: { value: new THREE.Color(color) }, uTime: { value: 0 }, uIntensity: { value: 1 } },
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `
      uniform vec3 uColor; uniform float uTime; uniform float uIntensity; varying vec2 vUv;
      void main(){
        float edge = smoothstep(0.0, 0.5, vUv.y) * smoothstep(1.0, 0.5, vUv.y);
        float fade = pow(1.0 - vUv.x, 1.4);
        float flow = 0.75 + 0.25 * sin(vUv.x * 18.0 - uTime * 3.0);
        float a = edge * fade * flow * uIntensity;
        gl_FragColor = vec4(uColor * (1.2 + edge), a * 0.9);
      }`
  });
}

function Beams({ variant, progress }: { variant: Variant; progress: number }) {
  const group = useRef<THREE.Group>(null);
  const mats = useMemo(() => SPECTRUM.map(beamMaterial), []);
  const incoming = useMemo(() => beamMaterial('#ffffff'), []);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    incoming.uniforms.uTime.value = t;
    mats.forEach((m, i) => {
      m.uniforms.uTime.value = t + i * 0.3;
      const lit = variant === 'analyze' ? (progress * SPECTRUM.length > i ? 1 : 0.12) : 0.85 + 0.15 * Math.sin(t * 1.5 + i);
      m.uniforms.uIntensity.value += (lit - m.uniforms.uIntensity.value) * 0.08;
    });
  });

  return (
    <group ref={group}>
      {/* incoming white light */}
      <mesh position={[-3.4, 0.28, 0]} rotation={[0, Math.PI, 0.08]} material={incoming}>
        <planeGeometry args={[6, 0.16]} />
      </mesh>
      {/* outgoing spectrum, fanned */}
      {SPECTRUM.map((c, i) => {
        const angle = -0.05 - i * 0.075;
        return (
          <mesh key={c} position={[Math.cos(angle) * 3.3, Math.sin(angle) * 3.3, 0]} rotation={[0, 0, angle]} material={mats[i]}>
            <planeGeometry args={[6.2, 0.26]} />
          </mesh>
        );
      })}
    </group>
  );
}

/** Equilateral triangle extruded along Z: the classic prism silhouette faces the camera. */
const prismGeometry = (() => {
  const r = 1.45;
  const shape = new THREE.Shape();
  for (let i = 0; i < 3; i++) {
    const a = Math.PI / 2 + (i * 2 * Math.PI) / 3;
    const x = Math.cos(a) * r, y = Math.sin(a) * r - 0.2;
    if (i === 0) shape.moveTo(x, y); else shape.lineTo(x, y);
  }
  shape.closePath();
  const g = new THREE.ExtrudeGeometry(shape, { depth: 1.6, bevelEnabled: true, bevelSize: 0.04, bevelThickness: 0.04, bevelSegments: 3 });
  g.translate(0, 0, -0.8);
  return g;
})();

function Prism({ variant }: { variant: Variant }) {
  const mesh = useRef<THREE.Mesh>(null);
  const { pointer } = useThree();
  useFrame((_, dt) => {
    if (!mesh.current) return;
    const t = performance.now() / 1000;
    const wobble = variant === 'analyze' ? 0.35 : 0.22;
    mesh.current.rotation.y = Math.sin(t * (variant === 'analyze' ? 1.2 : 0.5)) * wobble;
    void dt;
    mesh.current.rotation.x += ((pointer.y * 0.35) - mesh.current.rotation.x) * 0.05;
    mesh.current.rotation.z += ((-pointer.x * 0.25) - mesh.current.rotation.z) * 0.05;
  });
  return (
    <Float speed={1.4} rotationIntensity={0.2} floatIntensity={0.6}>
      <mesh ref={mesh} geometry={prismGeometry}>
        <MeshTransmissionMaterial
          backside
          samples={6}
          resolution={512}
          thickness={1.4}
          roughness={0.04}
          transmission={1}
          ior={1.5}
          chromaticAberration={0.9}
          anisotropy={0.3}
          distortion={0.25}
          distortionScale={0.4}
          temporalDistortion={0.1}
          clearcoat={1}
          attenuationDistance={2.4}
          attenuationColor="#c4b5fd"
          color="#ffffff"
        />
      </mesh>
    </Float>
  );
}

function Rig({ variant }: { variant: Variant }) {
  const { camera, pointer } = useThree();
  useFrame(() => {
    const baseX = variant === 'auth' ? 0.4 : 0;
    camera.position.x += (baseX + pointer.x * 0.6 - camera.position.x) * 0.04;
    camera.position.y += (pointer.y * 0.4 - camera.position.y) * 0.04;
    camera.lookAt(0, 0, 0);
  });
  return null;
}

export default function PrismScene({ variant = 'hero', progress = 0, className }: { variant?: Variant; progress?: number; className?: string }) {
  return (
    <div className={className} style={{ position: 'absolute', inset: 0 }}>
      <Canvas dpr={[1, 1.75]} camera={{ position: [0, 0, 7.5], fov: 42 }} gl={{ antialias: true, alpha: true }}>
        <Suspense fallback={null}>
          <ambientLight intensity={0.4} />
          <group position={variant === 'hero' ? [1.9, 0.7, 0] : variant === 'analyze' ? [2.2, 0, 0] : [0, 0, 0]} scale={variant === 'hero' ? 0.85 : 1}>
            <Beams variant={variant} progress={progress} />
            <Prism variant={variant} />
          </group>
          <Sparkles count={variant === 'analyze' ? 140 : 80} scale={[12, 6, 4]} size={2.2} speed={0.35} color="#c4b5fd" opacity={0.6} />
          <Environment resolution={256}>
            <Lightformer intensity={4} position={[0, 4, -6]} scale={[10, 1, 1]} color="#ffffff" />
            <Lightformer intensity={2.5} position={[-6, 0, -2]} rotation-y={Math.PI / 2} scale={[8, 2, 1]} color="#8b5cf6" />
            <Lightformer intensity={2.5} position={[6, -1, -2]} rotation-y={-Math.PI / 2} scale={[8, 2, 1]} color="#22d3ee" />
          </Environment>
          <Rig variant={variant} />
        </Suspense>
      </Canvas>
    </div>
  );
}
