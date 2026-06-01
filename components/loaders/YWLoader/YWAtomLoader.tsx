"use client";

import { Canvas, useFrame, useLoader } from "@react-three/fiber";
import Image from "next/image";
import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { AdditiveBlending, BackSide, Color, Group, MathUtils, Mesh, TextureLoader } from "three";
import styles from "./YWAtomLoader.module.css";

type LoaderSize = "sm" | "md" | "lg";

type YWAtomLoaderProps = {
  className?: string;
  label?: string;
  size?: LoaderSize;
};

type WebGLStatus = "checking" | "supported" | "unsupported";

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export function YWAtomLoader({
  className,
  label = "Loading YW Coach",
  size = "md"
}: YWAtomLoaderProps) {
  const [webGLStatus, setWebGLStatus] = useState<WebGLStatus>("checking");
  const [isCanvasReady, setIsCanvasReady] = useState(false);
  const canUse3D = webGLStatus === "supported";

  useEffect(() => {
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reducedMotion) {
      window.requestAnimationFrame(() => setWebGLStatus("unsupported"));
      return;
    }

    const canvas = document.createElement("canvas");
    const context = canvas.getContext("webgl2") || canvas.getContext("webgl");
    window.requestAnimationFrame(() => setWebGLStatus(context ? "supported" : "unsupported"));
  }, []);

  return (
    <div
      aria-label={label}
      className={cx(
        styles.atom,
        styles[size],
        webGLStatus === "checking" && styles.checking,
        canUse3D && styles.webglEnabled,
        isCanvasReady && styles.webglReady,
        className
      )}
      role="img"
    >
      <FallbackAtom />
      {canUse3D ? (
        <div className={styles.canvasLayer} aria-hidden="true">
          <Canvas
            camera={{
              far: 100,
              fov: 36,
              near: 0.1,
              position: [0, 0, 9]
            }}
            dpr={1}
            gl={{
              alpha: true,
              antialias: false,
              powerPreference: "high-performance",
              preserveDrawingBuffer: false
            }}
            onCreated={({ gl }) => {
              gl.setClearColor(0x000000, 0);
              setIsCanvasReady(true);
            }}
          >
            <AtomScene />
          </Canvas>
        </div>
      ) : null}
    </div>
  );
}

function FallbackAtom() {
  return (
    <div className={styles.fallbackLayer}>
      <div className={styles.stage}>
        <span className={styles.aura} aria-hidden="true" />
        <span className={styles.floorShadow} aria-hidden="true" />

        <svg aria-hidden="true" className={styles.rings} focusable="false" viewBox="0 0 720 420">
          <defs>
            <linearGradient id="ywLoaderRingBlue" x1="78" x2="642" y1="220" y2="178">
              <stop offset="0" stopColor="#48dff6" stopOpacity="0.95" />
              <stop offset="0.42" stopColor="#9fd4ff" stopOpacity="0.48" />
              <stop offset="0.72" stopColor="#4a8deb" stopOpacity="0.7" />
              <stop offset="1" stopColor="#ffffff" stopOpacity="0.34" />
            </linearGradient>
            <linearGradient id="ywLoaderRingGlass" x1="170" x2="566" y1="40" y2="382">
              <stop offset="0" stopColor="#f7fbff" stopOpacity="0.78" />
              <stop offset="0.32" stopColor="#6aaaff" stopOpacity="0.28" />
              <stop offset="0.72" stopColor="#bcd9ff" stopOpacity="0.45" />
              <stop offset="1" stopColor="#ffffff" stopOpacity="0.72" />
            </linearGradient>
            <filter
              id="ywLoaderGlow"
              colorInterpolationFilters="sRGB"
              x="-20%"
              y="-40%"
              width="140%"
              height="180%"
            >
              <feGaussianBlur stdDeviation="5" result="blur" />
              <feColorMatrix
                in="blur"
                result="blueGlow"
                type="matrix"
                values="0 0 0 0 0.05 0 0 0 0 0.42 0 0 0 0 1 0 0 0 .52 0"
              />
              <feMerge>
                <feMergeNode in="blueGlow" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            <radialGradient id="ywElectronBlue" cx="32%" cy="24%" r="70%">
              <stop offset="0" stopColor="#ffffff" stopOpacity="1" />
              <stop offset="0.18" stopColor="#73e8ff" stopOpacity="0.92" />
              <stop offset="0.55" stopColor="#1479ff" stopOpacity="1" />
              <stop offset="1" stopColor="#043fc0" stopOpacity="1" />
            </radialGradient>
            <radialGradient id="ywElectronCyan" cx="32%" cy="24%" r="70%">
              <stop offset="0" stopColor="#ffffff" stopOpacity="1" />
              <stop offset="0.2" stopColor="#7effff" stopOpacity="0.92" />
              <stop offset="0.58" stopColor="#12d5e8" stopOpacity="1" />
              <stop offset="1" stopColor="#057e9e" stopOpacity="1" />
            </radialGradient>
            <radialGradient id="ywElectronWhite" cx="32%" cy="24%" r="70%">
              <stop offset="0" stopColor="#ffffff" stopOpacity="1" />
              <stop offset="0.55" stopColor="#f7fbff" stopOpacity="0.95" />
              <stop offset="1" stopColor="#b6d3fb" stopOpacity="0.9" />
            </radialGradient>
            <filter
              id="ywElectronGlow"
              colorInterpolationFilters="sRGB"
              x="-90%"
              y="-90%"
              width="280%"
              height="280%"
            >
              <feGaussianBlur stdDeviation="5" result="softGlow" />
              <feMerge>
                <feMergeNode in="softGlow" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          <g className={cx(styles.ringRotor, styles.ringRotorBack)}>
            <ellipse
              className={styles.ringGlass}
              cx="360"
              cy="210"
              fill="none"
              rx="104"
              ry="284"
              stroke="url(#ywLoaderRingGlass)"
              strokeWidth="4"
              transform="rotate(11 360 210)"
            />
          </g>

          <path
            className={styles.rearSweep}
            d="M112 225 C176 128 455 77 603 143 C674 176 658 252 558 303 C417 374 183 336 107 257"
            fill="none"
            stroke="url(#ywLoaderRingGlass)"
            strokeLinecap="round"
            strokeWidth="8"
          />

          <g className={cx(styles.ringRotor, styles.ringRotorSlow)}>
            <ellipse
              className={styles.ringBlue}
              cx="360"
              cy="210"
              fill="none"
              rx="286"
              ry="72"
              stroke="url(#ywLoaderRingBlue)"
              strokeWidth="6"
              transform="rotate(-9 360 210)"
            />
          </g>

          <path
            className={styles.frontSweep}
            d="M98 246 C165 326 408 334 565 282 C660 249 698 192 624 156 C529 109 278 129 121 208"
            fill="none"
            filter="url(#ywLoaderGlow)"
            stroke="url(#ywLoaderRingBlue)"
            strokeLinecap="round"
            strokeWidth="8"
          />

          <g className={styles.svgElectronLayer} filter="url(#ywElectronGlow)">
            <g className={cx(styles.svgElectron, styles.svgElectronCyan)}>
              <circle className={styles.svgElectronHalo} r="16" />
              <circle className={styles.svgElectronCore} fill="url(#ywElectronCyan)" r="10" />
              <circle className={styles.svgElectronHighlight} cx="-3.5" cy="-4" r="2.5" />
              <animateMotion
                calcMode="linear"
                dur="8.6s"
                path="M112 225 C176 128 455 77 603 143 C674 176 658 252 558 303 C417 374 183 336 107 257 C94 247 96 237 112 225"
                repeatCount="indefinite"
              />
            </g>

            <g className={cx(styles.svgElectron, styles.svgElectronBlueLarge)}>
              <circle className={styles.svgElectronHalo} r="26" />
              <circle className={styles.svgElectronCore} fill="url(#ywElectronBlue)" r="17" />
              <circle className={styles.svgElectronHighlight} cx="-5.5" cy="-6.5" r="3.7" />
              <animateMotion
                calcMode="linear"
                dur="7.2s"
                keyPoints="1;0"
                keyTimes="0;1"
                path="M98 246 C165 326 408 334 565 282 C660 249 698 192 624 156 C529 109 278 129 121 208 C89 224 80 237 98 246"
                repeatCount="indefinite"
              />
            </g>

            <g className={cx(styles.svgElectron, styles.svgElectronBlueMedium)}>
              <circle className={styles.svgElectronHalo} r="21" />
              <circle className={styles.svgElectronCore} fill="url(#ywElectronBlue)" r="13" />
              <circle className={styles.svgElectronHighlight} cx="-4.3" cy="-5" r="3" />
              <animateMotion
                begin="-2.1s"
                calcMode="linear"
                dur="9.8s"
                path="M86 252 C159 336 422 351 588 289 C682 253 705 191 624 151 C513 96 253 122 103 216 C78 232 72 244 86 252"
                repeatCount="indefinite"
              />
            </g>

            <g className={cx(styles.svgElectron, styles.svgElectronBlueSmall)}>
              <circle className={styles.svgElectronHalo} r="15" />
              <circle className={styles.svgElectronCore} fill="url(#ywElectronBlue)" r="9.5" />
              <circle className={styles.svgElectronHighlight} cx="-3.2" cy="-3.8" r="2.3" />
              <animateMotion
                begin="-3.4s"
                calcMode="linear"
                dur="11.8s"
                keyPoints="1;0"
                keyTimes="0;1"
                path="M245 352 C333 240 366 103 440 68 C502 38 550 83 514 178 C472 286 359 375 271 373 C241 372 229 366 245 352"
                repeatCount="indefinite"
              />
            </g>

            <g className={cx(styles.svgElectron, styles.svgElectronWhite)}>
              <circle className={styles.svgElectronHalo} r="17" />
              <circle className={styles.svgElectronCore} fill="url(#ywElectronWhite)" r="11" />
              <circle className={styles.svgElectronHighlight} cx="-3.6" cy="-4.3" r="2.6" />
              <animateMotion
                begin="-4.6s"
                calcMode="linear"
                dur="13.2s"
                path="M474 353 C350 282 270 159 304 94 C338 30 472 77 551 179 C631 283 594 376 499 365 C490 364 482 360 474 353"
                repeatCount="indefinite"
              />
            </g>
          </g>
        </svg>

        <span className={styles.badge} aria-hidden="true">
          <span className={styles.badgeRim} />
          <span className={styles.badgeGlass} />
          <Image
            alt=""
            className={styles.logo}
            draggable={false}
            height={994}
            priority
            src="/images/yw-nutritech-logo.png"
            width={1302}
          />
        </span>

        <span className={cx(styles.spark, styles.sparkOne)} aria-hidden="true" />
        <span className={cx(styles.spark, styles.sparkTwo)} aria-hidden="true" />
        <span className={cx(styles.spark, styles.sparkThree)} aria-hidden="true" />
      </div>
    </div>
  );
}

function AtomScene() {
  return (
    <>
      <ambientLight intensity={2.2} />
      <directionalLight color="#f8fcff" intensity={2.8} position={[0, 1.8, 4]} />
      <pointLight color="#2bdff0" intensity={5.5} position={[-2.5, -0.8, 2.6]} />
      <AtomModel />
    </>
  );
}

function AtomModel() {
  const groupRef = useRef<Group>(null);
  const badgeRef = useRef<Group>(null);
  const frontRingRef = useRef<Mesh>(null);
  const rearRingRef = useRef<Mesh>(null);
  const verticalRingRef = useRef<Mesh>(null);
  const logoTexture = useLoader(TextureLoader, "/images/yw-nutritech-logo.png");

  useFrame((state) => {
    const elapsed = state.clock.getElapsedTime();
    if (groupRef.current) {
      groupRef.current.position.y = Math.sin(elapsed * 1.35) * 0.035;
      groupRef.current.rotation.z = Math.sin(elapsed * 0.4) * 0.018;
    }
    if (badgeRef.current) {
      const scale = 1 + Math.sin(elapsed * 1.8) * 0.012;
      badgeRef.current.scale.setScalar(scale);
    }
    if (frontRingRef.current) {
      frontRingRef.current.rotation.z = elapsed * 0.22;
    }
    if (rearRingRef.current) {
      rearRingRef.current.rotation.z = -elapsed * 0.16;
    }
    if (verticalRingRef.current) {
      verticalRingRef.current.rotation.y = elapsed * 0.18;
    }
  });

  return (
    <group ref={groupRef} scale={1.08}>
      <mesh position={[0, -0.82, -0.32]} rotation={[-Math.PI / 2, 0, 0]} scale={[2.1, 0.42, 1]}>
        <circleGeometry args={[1, 32]} />
        <meshBasicMaterial color="#1c78d6" transparent opacity={0.12} />
      </mesh>

      <mesh position={[0, -0.1, -0.72]} scale={[2.35, 0.72, 0.72]}>
        <sphereGeometry args={[1, 24, 12]} />
        <meshBasicMaterial
          blending={AdditiveBlending}
          color="#2bdff0"
          depthWrite={false}
          transparent
          opacity={0.16}
        />
      </mesh>

      <OrbitRing
        meshRef={verticalRingRef}
        color="#d8edff"
        opacity={0.38}
        position={[0, 0, -0.18]}
        rotation={[MathUtils.degToRad(84), MathUtils.degToRad(8), MathUtils.degToRad(5)]}
        scale={[1.05, 2.65, 1]}
        tube={0.012}
      />
      <OrbitRing
        meshRef={rearRingRef}
        color="#9fcaff"
        opacity={0.28}
        position={[0, 0.02, -0.24]}
        rotation={[MathUtils.degToRad(66), MathUtils.degToRad(18), MathUtils.degToRad(-8)]}
        scale={[3.1, 0.76, 1]}
        tube={0.018}
      />

      <group ref={badgeRef} position={[0, 0, 0.1]}>
        <mesh>
          <sphereGeometry args={[0.92, 36, 18]} />
          <meshStandardMaterial
            color="#ffffff"
            metalness={0}
            opacity={0.9}
            roughness={0.18}
            transparent
          />
        </mesh>
        <mesh scale={1.04}>
          <sphereGeometry args={[0.92, 32, 16]} />
          <meshBasicMaterial color="#b8d8ff" side={BackSide} transparent opacity={0.28} />
        </mesh>
        <mesh position={[-0.09, -0.01, 0.94]} scale={[1.12, 0.86, 1]}>
          <planeGeometry args={[1.5, 1.14]} />
          <meshBasicMaterial map={logoTexture} transparent depthWrite={false} />
        </mesh>
      </group>

      <OrbitRing
        meshRef={frontRingRef}
        color="#2bdff0"
        opacity={0.72}
        position={[0, -0.01, 0.16]}
        rotation={[MathUtils.degToRad(72), MathUtils.degToRad(-10), MathUtils.degToRad(5)]}
        scale={[3.35, 0.72, 1]}
        tube={0.024}
      />

      <ElectronOrbit
        color="#16d7e8"
        glow="#2bdff0"
        offset={0.08}
        radius={0.16}
        speed={0.75}
        tilt={-9}
        xRadius={3.1}
        yRadius={0.66}
      />
      <ElectronOrbit
        color="#0b73e8"
        glow="#3188ff"
        offset={0.34}
        radius={0.24}
        speed={-0.92}
        tilt={7}
        xRadius={2.92}
        yRadius={0.74}
      />
      <ElectronOrbit
        color="#0b64df"
        glow="#2d7dff"
        offset={0.58}
        radius={0.19}
        speed={1.08}
        tilt={6}
        xRadius={3.2}
        yRadius={0.72}
      />
      <ElectronOrbit
        color="#0a6fe8"
        glow="#2d7dff"
        offset={0.72}
        radius={0.12}
        speed={-0.62}
        tilt={24}
        xRadius={2.36}
        yRadius={0.84}
      />
      <ElectronOrbit
        color="#edf7ff"
        glow="#abd7ff"
        offset={0.84}
        radius={0.15}
        speed={0.54}
        tilt={32}
        xRadius={2.46}
        yRadius={0.88}
      />
    </group>
  );
}

function OrbitRing({
  color,
  meshRef,
  opacity,
  position,
  rotation,
  scale,
  tube
}: {
  color: string;
  meshRef?: RefObject<Mesh | null>;
  opacity: number;
  position: [number, number, number];
  rotation: [number, number, number];
  scale: [number, number, number];
  tube: number;
}) {
  return (
    <mesh ref={meshRef} position={position} rotation={rotation} scale={scale}>
      <torusGeometry args={[1, tube, 8, 96]} />
      <meshBasicMaterial
        blending={AdditiveBlending}
        color={color}
        depthWrite={false}
        transparent
        opacity={opacity}
      />
    </mesh>
  );
}

function ElectronOrbit({
  color,
  glow,
  offset,
  radius,
  speed,
  tilt,
  xRadius,
  yRadius
}: {
  color: string;
  glow: string;
  offset: number;
  radius: number;
  speed: number;
  tilt: number;
  xRadius: number;
  yRadius: number;
}) {
  const electronRef = useRef<Group>(null);
  const colorValue = useMemo(() => new Color(color), [color]);
  const glowValue = useMemo(() => new Color(glow), [glow]);

  useFrame((state) => {
    const phase = offset + state.clock.getElapsedTime() * speed * 0.08;
    const angle = phase * Math.PI * 2;
    const x = Math.cos(angle) * xRadius;
    const y = Math.sin(angle) * yRadius;
    const tiltRadians = MathUtils.degToRad(tilt);
    const depth = Math.sin(angle);
    const rotatedX = x * Math.cos(tiltRadians) - y * Math.sin(tiltRadians);
    const rotatedY = x * Math.sin(tiltRadians) + y * Math.cos(tiltRadians);
    const scale = 0.82 + ((depth + 1) / 2) * 0.28;

    if (electronRef.current) {
      electronRef.current.position.set(rotatedX, rotatedY, depth * 0.62 + 0.24);
      electronRef.current.scale.setScalar(scale);
    }
  });

  return (
    <group ref={electronRef}>
      <mesh>
        <sphereGeometry args={[radius, 24, 14]} />
        <meshStandardMaterial
          color={colorValue}
          emissive={colorValue}
          emissiveIntensity={0.42}
          metalness={0.08}
          roughness={0.16}
        />
      </mesh>
      <mesh scale={1.55}>
        <sphereGeometry args={[radius, 16, 10]} />
        <meshBasicMaterial
          blending={AdditiveBlending}
          color={glowValue}
          depthWrite={false}
          transparent
          opacity={0.24}
        />
      </mesh>
      <mesh position={[-radius * 0.34, radius * 0.38, radius * 0.72]} scale={0.34}>
        <sphereGeometry args={[radius, 8, 6]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.92} />
      </mesh>
    </group>
  );
}
