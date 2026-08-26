"use client";

import { Map, FileType, HardDrive, Clock } from "lucide-react";
import dynamic from "next/dynamic";
import { useState } from "react";

const Model3DViewer = dynamic(
  () => import("./model-3d-viewer").then((mod) => mod.Model3DViewer),
  { ssr: false }
);

interface MapInfoProps {
  file: File;
}

export function MapInfo({ file }: MapInfoProps) {
  const [showPreview, setShowPreview] = useState(false);
  const extension = file.name.split(".").pop()?.toUpperCase() || "UNKNOWN";
  const sizeKB = (file.size / 1024).toFixed(1);
  const sizeMB = (file.size / (1024 * 1024)).toFixed(2);
  const displaySize = file.size > 1024 * 1024 ? `${sizeMB} MB` : `${sizeKB} KB`;
  const lastModified = new Date(file.lastModified).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

  const details = [
    { icon: FileType, label: "Format", value: extension },
    { icon: HardDrive, label: "Size", value: displaySize },
    { icon: Clock, label: "Modified", value: lastModified },
  ];

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-border/60 bg-card/50 p-4">
        <div className="flex items-center gap-3 mb-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent/10">
            <Map className="h-5 w-5 text-accent" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium text-foreground text-sm">{file.name}</p>
            <p className="text-xs text-muted-foreground">3D Map File</p>
          </div>
        </div>
        <div className="space-y-2">
          {details.map((detail) => (
            <div
              key={detail.label}
              className="flex items-center justify-between rounded-md bg-background/50 px-3 py-2"
            >
              <div className="flex items-center gap-2 text-muted-foreground">
                <detail.icon className="h-3.5 w-3.5" />
                <span className="text-xs">{detail.label}</span>
              </div>
              <span className="text-xs font-medium text-foreground">{detail.value}</span>
            </div>
          ))}
        </div>
        <button
          onClick={() => setShowPreview(!showPreview)}
          className="mt-4 w-full rounded-md bg-accent/10 hover:bg-accent/20 transition-colors px-3 py-2 text-xs font-medium text-accent"
        >
          {showPreview ? "Ocultar" : "Visualizar"} Modelo 3D
        </button>
      </div>

      {showPreview && <Model3DViewer file={file} />}
    </div>
  );
}
