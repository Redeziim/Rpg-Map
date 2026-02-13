"use client";

import { FileText, HardDrive, Clock } from "lucide-react";

interface PnjInfoProps {
  file: File;
}

export function PnjInfo({ file }: PnjInfoProps) {
  const ext = file.name.split(".").pop()?.toUpperCase() || "?";
  const sizeMB = (file.size / 1024 / 1024).toFixed(2);
  const modified = new Date(file.lastModified).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  return (
    <div className="rounded-lg bg-card border border-border p-4">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
          <FileText className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground truncate">
            {file.name}
          </p>
          <div className="mt-2 flex flex-wrap gap-3">
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
              <HardDrive className="h-3 w-3" />
              {sizeMB} MB
            </span>
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" />
              {modified}
            </span>
            <span className="inline-flex items-center rounded bg-secondary px-1.5 py-0.5 text-xs font-mono text-muted-foreground">
              .{ext}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
