"use client";

import { useCallback, useState, useRef } from "react";
import { cn } from "@/lib/utils";
import { Upload, FileCheck, AlertCircle, X } from "lucide-react";

export type UploadStatus = "idle" | "dragging" | "uploading" | "done" | "error";

interface UploadZoneProps {
  title: string;
  description: string;
  acceptedFormats: string[];
  acceptString: string;
  icon: React.ReactNode;
  onFileSelect: (file: File) => void;
  onFileRemove: () => void;
  file: File | null;
  status: UploadStatus;
  progress: number;
  errorMessage?: string;
}

export function UploadZone({
  title,
  description,
  acceptedFormats,
  acceptString,
  icon,
  onFileSelect,
  onFileRemove,
  file,
  status,
  progress,
  errorMessage,
}: UploadZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const validateFile = useCallback(
    (f: File) => {
      const ext = f.name.split(".").pop()?.toLowerCase() || "";
      return acceptedFormats.includes(`.${ext}`);
    },
    [acceptedFormats]
  );

  const handleFile = useCallback(
    (f: File) => {
      if (validateFile(f)) {
        onFileSelect(f);
      }
    },
    [validateFile, onFileSelect]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);
      const droppedFile = e.dataTransfer.files[0];
      if (droppedFile) handleFile(droppedFile);
    },
    [handleFile]
  );

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const selectedFile = e.target.files?.[0];
      if (selectedFile) handleFile(selectedFile);
      if (inputRef.current) inputRef.current.value = "";
    },
    [handleFile]
  );

  const zoneClass = cn(
    "relative flex flex-col items-center justify-center rounded-lg p-8 transition-all duration-300 min-h-[260px] cursor-pointer group",
    isDragging && "upload-zone-active scale-[1.02]",
    status === "done" && "upload-zone-done",
    status === "error" && "border-2 border-dashed border-destructive/50 bg-destructive/5",
    status === "idle" && !isDragging && "upload-zone-idle",
    status === "uploading" && "upload-zone-idle opacity-80"
  );

  return (
    <div
      className={zoneClass}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={() => status !== "uploading" && inputRef.current?.click()}
      role="button"
      tabIndex={0}
      aria-label={`Upload zone for ${title}`}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          inputRef.current?.click();
        }
      }}
    >
      <input
        ref={inputRef}
        type="file"
        className="sr-only"
        accept={acceptString}
        onChange={handleInputChange}
        aria-label={`Select ${title} file`}
      />

      {/* Icon */}
      <div
        className={cn(
          "mb-4 flex h-16 w-16 items-center justify-center rounded-xl transition-all duration-300",
          status === "done"
            ? "bg-accent/10 text-accent"
            : status === "error"
            ? "bg-destructive/10 text-destructive"
            : "bg-secondary text-muted-foreground group-hover:text-primary group-hover:bg-primary/10"
        )}
      >
        {status === "done" ? (
          <FileCheck className="h-8 w-8" />
        ) : status === "error" ? (
          <AlertCircle className="h-8 w-8" />
        ) : (
          icon
        )}
      </div>

      {/* Title */}
      <h3 className="mb-1 text-lg font-semibold text-foreground">{title}</h3>

      {/* Description or file info */}
      {file && status === "done" ? (
        <div className="flex flex-col items-center gap-1">
          <p className="text-sm text-accent font-mono">{file.name}</p>
          <p className="text-xs text-muted-foreground">
            {(file.size / 1024 / 1024).toFixed(2)} MB
          </p>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onFileRemove();
            }}
            className="mt-2 flex items-center gap-1 rounded-md bg-secondary px-3 py-1 text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
            aria-label="Remove file"
          >
            <X className="h-3 w-3" />
            Remover
          </button>
        </div>
      ) : status === "error" ? (
        <div className="flex flex-col items-center gap-1">
          <p className="text-sm text-destructive">{errorMessage}</p>
          <p className="text-xs text-muted-foreground mt-1">
            Clique para tentar novamente
          </p>
        </div>
      ) : (
        <>
          <p className="mb-3 text-center text-sm text-muted-foreground">
            {description}
          </p>
          <div className="flex items-center gap-2 rounded-md bg-primary/10 px-4 py-2 text-sm font-medium text-primary transition-colors group-hover:bg-primary/20">
            <Upload className="h-4 w-4" />
            Selecionar Arquivo
          </div>
          <p className="mt-3 text-xs text-muted-foreground/60 font-mono">
            {acceptedFormats.join(" ")}
          </p>
        </>
      )}

      {/* Progress bar */}
      {status === "uploading" && (
        <div className="absolute bottom-0 left-0 right-0 px-4 pb-4">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-muted-foreground">Enviando...</span>
            <span className="text-xs text-primary font-mono">
              {Math.round(progress)}%
            </span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary">
            <div
              className="h-full rounded-full bg-primary transition-all duration-300 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
