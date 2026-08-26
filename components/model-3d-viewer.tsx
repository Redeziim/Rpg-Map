"use client";

import { Suspense, useEffect, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Stage, useGLTF } from "@react-three/drei";
import * as THREE from "three";

interface Model3DViewerProps {
  file: File;
  className?: string;
}

function ModelLoader({ url }: { url: string }) {
  const [geometry, setGeometry] = useState<THREE.BufferGeometry | null>(null);
  const fileExtension = url.split(".").pop()?.toLowerCase();

  useEffect(() => {
    if (fileExtension === "stl") {
      import("three/examples/jsm/loaders/STLLoader").then(({ STLLoader }) => {
        const loader = new STLLoader();
        loader.load(url, (geo) => {
          geo.center();
          setGeometry(geo);
        });
      });
    }
  }, [url, fileExtension]);

  if (fileExtension === "gltf" || fileExtension === "glb") {
    const { scene } = useGLTF(url);
    return <primitive object={scene} />;
  }

  if (fileExtension === "stl" && geometry) {
    return (
      <mesh geometry={geometry}>
        <meshStandardMaterial color="#8b7355" metalness={0.3} roughness={0.7} />
      </mesh>
    );
  }

  return null;
}

function LoadingFallback() {
  return (
    <mesh>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial color="#444" wireframe />
    </mesh>
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

  return (
    <div className={`rounded-lg border border-border/60 bg-card/50 overflow-hidden ${className}`}>
      <Canvas
        camera={{ position: [0, 0, 50], fov: 50 }}
        style={{ width: "100%", height: "400px" }}
      >
        <color attach="background" args={["#0a0a0c"]} />
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
