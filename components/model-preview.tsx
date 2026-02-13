"use client";

import { Suspense, useMemo } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Environment, useGLTF, Center } from "@react-three/drei";
import { Loader2 } from "lucide-react";

function GLBModel({ url }: { url: string }) {
  const { scene } = useGLTF(url);
  return (
    <Center>
      <primitive object={scene} />
    </Center>
  );
}

function FallbackBox() {
  return (
    <Center>
      <mesh rotation={[0.5, 0.5, 0]}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="hsl(45, 90%, 55%)" wireframe />
      </mesh>
    </Center>
  );
}

function LoadingSpinner() {
  return (
    <div className="absolute inset-0 flex items-center justify-center">
      <Loader2 className="h-6 w-6 animate-spin text-primary" />
    </div>
  );
}

interface ModelPreviewProps {
  file: File | null;
}

export function ModelPreview({ file }: ModelPreviewProps) {
  const objectUrl = useMemo(() => {
    if (!file) return null;
    return URL.createObjectURL(file);
  }, [file]);

  const ext = file?.name.split(".").pop()?.toLowerCase();
  const isGLB = ext === "glb" || ext === "gltf";

  return (
    <div className="relative h-[240px] w-full overflow-hidden rounded-lg bg-card border border-border">
      <div className="absolute top-2 left-2 z-10">
        <span className="inline-flex items-center rounded-md bg-background/80 px-2 py-1 text-xs font-mono text-muted-foreground backdrop-blur-sm">
          Preview 3D
        </span>
      </div>
      <Suspense fallback={<LoadingSpinner />}>
        <Canvas
          camera={{ position: [3, 2, 3], fov: 50 }}
          style={{ background: "transparent" }}
        >
          <ambientLight intensity={0.5} />
          <directionalLight position={[5, 5, 5]} intensity={1} />
          <Environment preset="city" />
          {isGLB && objectUrl ? (
            <GLBModel url={objectUrl} />
          ) : (
            <FallbackBox />
          )}
          <OrbitControls
            enableZoom={true}
            enablePan={false}
            autoRotate
            autoRotateSpeed={2}
          />
        </Canvas>
      </Suspense>
      {!isGLB && file && (
        <div className="absolute bottom-2 left-2 right-2 z-10">
          <p className="text-center text-xs text-muted-foreground bg-background/80 rounded px-2 py-1 backdrop-blur-sm">
            Preview completo disponivel para .glb e .gltf
          </p>
        </div>
      )}
    </div>
  );
}
