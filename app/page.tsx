"use client";

import { useState, useCallback } from "react";
import dynamic from "next/dynamic";
import { Users, Map, Swords } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { UploadZone, type UploadStatus } from "@/components/upload-zone";
import { StatusBadge } from "@/components/status-badge";
import { PnjInfo } from "@/components/pnj-info";
import { cn } from "@/lib/utils";

const ModelPreview = dynamic(
  () => import("@/components/model-preview").then((mod) => mod.ModelPreview),
  { ssr: false }
);

const PNJ_FORMATS = [".json", ".xml", ".yaml", ".yml", ".txt", ".csv"];
const MAP_FORMATS = [".obj", ".fbx", ".glb", ".gltf"];

function getStatusLabel(status: UploadStatus): string {
  switch (status) {
    case "idle":
      return "Aguardando";
    case "dragging":
      return "Solte o arquivo";
    case "uploading":
      return "Enviando";
    case "done":
      return "Concluido";
    case "error":
      return "Erro";
    default:
      return "Aguardando";
  }
}

function simulateUpload(
  setProgress: (p: number) => void,
  setStatus: (s: UploadStatus) => void
) {
  setStatus("uploading");
  let p = 0;
  const interval = setInterval(() => {
    p += Math.random() * 15 + 5;
    if (p >= 100) {
      p = 100;
      clearInterval(interval);
      setProgress(100);
      setTimeout(() => setStatus("done"), 300);
    }
    setProgress(Math.min(p, 100));
  }, 200);
}

export default function UploadPage() {
  // PNJ state
  const [pnjFile, setPnjFile] = useState<File | null>(null);
  const [pnjStatus, setPnjStatus] = useState<UploadStatus>("idle");
  const [pnjProgress, setPnjProgress] = useState(0);
  const [pnjError, setPnjError] = useState("");

  // Map state
  const [mapFile, setMapFile] = useState<File | null>(null);
  const [mapStatus, setMapStatus] = useState<UploadStatus>("idle");
  const [mapProgress, setMapProgress] = useState(0);
  const [mapError, setMapError] = useState("");

  // Processing
  const [isProcessing, setIsProcessing] = useState(false);
  const [processComplete, setProcessComplete] = useState(false);

  const bothReady = pnjStatus === "done" && mapStatus === "done";

  const handlePnjSelect = useCallback((file: File) => {
    const ext = file.name.split(".").pop()?.toLowerCase() || "";
    if (!PNJ_FORMATS.includes(`.${ext}`)) {
      setPnjStatus("error");
      setPnjError(`Formato .${ext} invalido. Use: ${PNJ_FORMATS.join(", ")}`);
      return;
    }
    setPnjFile(file);
    setPnjError("");
    simulateUpload(setPnjProgress, setPnjStatus);
  }, []);

  const handleMapSelect = useCallback((file: File) => {
    const ext = file.name.split(".").pop()?.toLowerCase() || "";
    if (!MAP_FORMATS.includes(`.${ext}`)) {
      setMapStatus("error");
      setMapError(`Formato .${ext} invalido. Use: ${MAP_FORMATS.join(", ")}`);
      return;
    }
    setMapFile(file);
    setMapError("");
    simulateUpload(setMapProgress, setMapStatus);
  }, []);

  const handlePnjRemove = useCallback(() => {
    setPnjFile(null);
    setPnjStatus("idle");
    setPnjProgress(0);
    setPnjError("");
    setProcessComplete(false);
  }, []);

  const handleMapRemove = useCallback(() => {
    setMapFile(null);
    setMapStatus("idle");
    setMapProgress(0);
    setMapError("");
    setProcessComplete(false);
  }, []);

  const handleProcess = useCallback(() => {
    if (!bothReady) return;
    setIsProcessing(true);
    setProcessComplete(false);
    setTimeout(() => {
      setIsProcessing(false);
      setProcessComplete(true);
    }, 2500);
  }, [bothReady]);

  return (
    <main className="flex min-h-screen items-center justify-center p-4 sm:p-8">
      <div className="w-full max-w-4xl animate-fade-in-up">
        {/* Main card */}
        <div className="rounded-2xl border border-border bg-card p-6 sm:p-10">
          <PageHeader />

          {/* Status overview */}
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <StatusBadge
              status={pnjStatus === "done" ? "done" : pnjStatus === "uploading" ? "uploading" : pnjStatus === "error" ? "error" : "idle"}
              label={`PNJ: ${getStatusLabel(pnjStatus)}`}
            />
            <StatusBadge
              status={mapStatus === "done" ? "done" : mapStatus === "uploading" ? "uploading" : mapStatus === "error" ? "error" : "idle"}
              label={`Mapa: ${getStatusLabel(mapStatus)}`}
            />
            {isProcessing && (
              <StatusBadge status="processing" label="Processando..." />
            )}
            {processComplete && (
              <StatusBadge status="done" label="Processamento concluido" />
            )}
          </div>

          {/* Upload zones */}
          <div className="mt-8 grid gap-6 md:grid-cols-2">
            {/* PNJ upload */}
            <div className="flex flex-col gap-4">
              <UploadZone
                title="Arquivo PNJ"
                description="Arraste e solte seu arquivo de Personagem Nao Jogavel aqui"
                acceptedFormats={PNJ_FORMATS}
                acceptString={PNJ_FORMATS.join(",")}
                icon={<Users className="h-8 w-8" />}
                onFileSelect={handlePnjSelect}
                onFileRemove={handlePnjRemove}
                file={pnjFile}
                status={pnjStatus}
                progress={pnjProgress}
                errorMessage={pnjError}
              />
              {pnjFile && pnjStatus === "done" && <PnjInfo file={pnjFile} />}
            </div>

            {/* Map upload */}
            <div className="flex flex-col gap-4">
              <UploadZone
                title="Mapa 3D"
                description="Arraste e solte seu arquivo de Mapa 3D aqui"
                acceptedFormats={MAP_FORMATS}
                acceptString={MAP_FORMATS.join(",")}
                icon={<Map className="h-8 w-8" />}
                onFileSelect={handleMapSelect}
                onFileRemove={handleMapRemove}
                file={mapFile}
                status={mapStatus}
                progress={mapProgress}
                errorMessage={mapError}
              />
              {mapFile && mapStatus === "done" && (
                <ModelPreview file={mapFile} />
              )}
            </div>
          </div>

          {/* Process button */}
          <div className="mt-8 flex justify-center">
            <button
              onClick={handleProcess}
              disabled={!bothReady || isProcessing}
              className={cn(
                "relative flex items-center gap-2 rounded-xl px-8 py-3.5 text-sm font-semibold transition-all duration-300",
                bothReady && !isProcessing
                  ? "bg-primary text-primary-foreground hover:brightness-110 animate-pulse-glow"
                  : "bg-secondary text-muted-foreground cursor-not-allowed"
              )}
              aria-label="Process uploaded files"
            >
              {isProcessing ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
                  Processando...
                </>
              ) : (
                <>
                  <Swords className="h-4 w-4" />
                  Processar Arquivos
                </>
              )}
            </button>
          </div>

          {/* Processing complete message */}
          {processComplete && (
            <div className="mt-6 animate-fade-in-up rounded-lg border border-accent/30 bg-accent/5 p-4 text-center">
              <p className="text-sm font-medium text-accent">
                Arquivos processados com sucesso!
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Seu PNJ e Mapa 3D foram carregados e estao prontos para uso.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <p className="mt-4 text-center text-xs text-muted-foreground/40">
          RPG Asset Uploader &middot; Arraste arquivos ou clique para selecionar
        </p>
      </div>
    </main>
  );
}
