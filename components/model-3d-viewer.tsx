"use client";

import { Suspense, useEffect, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Stage, useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { STLLoader } from "three/addons/loaders/STLLoader.js";

interface Model3DViewerProps {
  file: File;
  className?: string;
}

function ModelLoader({ url }: { url: string }) {
  const [geometry, setGeometry] = useState<THREE.BufferGeometry | null>(null);
  const fileExtension = url.split(".").pop()?.toLowerCase();

  useEffect(() => {
    if (fileExtension === "stl") {
      const loader = new STLLoader();
      loader.load(url, (geo) => {
        geo.center();
        setGeometry(geo);
      });
    }
  }, [url, fileExtension]);

  if (fileExtension === "gltf" || fileExtension === "glb") {
    const { scene } = useGLTF(url);
    const Primitive = "primitive" as any;
    return <Primitive object={scene} />;
  }

  if (fileExtension === "stl" && geometry) {
    const Mesh = "mesh" as any;
    const MeshStandardMaterial = "meshStandardMaterial" as any;
    return (
      <Mesh geometry={geometry}>
        <MeshStandardMaterial color="#8b7355" metalness={0.3} roughness={0.7} />
      </Mesh>
    );
  }

  return null;
}

function LoadingFallback() {
  const Mesh = "mesh" as any;
  const BoxGeometry = "boxGeometry" as any;
  const MeshStandardMaterial = "meshStandardMaterial" as any;

  return (
    <Mesh>
      <BoxGeometry args={[1, 1, 1]} />
      <MeshStandardMaterial color="#444" wireframe />
    </Mesh>
  );
}

export function Model3DViewer({ file, className = "" }: Model3DViewerProps) {
  const [objectURL, setObjectURL] = useState<string>("");

  useEffect(() => {
    const url = URL.createObjectURL(file);
    setObjectURL(url);

    return () => {
      URL.revokeObjectURL(url);
    };
  }, [file]);

  if (!objectURL) {
    return (
      <div className={`flex items-center justify-center bg-background/50 rounded-lg ${className}`}>
        <p className="text-sm text-muted-foreground">Carregando modelo...</p>
      </div>
    );
  }

  const Color = "color" as any;

  return (
    <div className={`rounded-lg border border-border/60 bg-card/50 overflow-hidden ${className}`}>
      <Canvas
        camera={{ position: [0, 0, 50], fov: 50 }}
        style={{ width: "100%", height: "400px" }}
      >
        <Color attach="background" args={["#0a0a0c"]} />
        <Suspense fallback={<LoadingFallback />}>
          <Stage environment="city" intensity={0.6}>
            <ModelLoader url={objectURL} />
          </Stage>
        </Suspense>
        <OrbitControls makeDefault />
      </Canvas>
      <div className="p-3 bg-background/50 border-t border-border/40">
        <p className="text-xs text-muted-foreground text-center">
          Arraste para rotacionar • Scroll para zoom
        </p>
      </div>
    </div>
  );
}
