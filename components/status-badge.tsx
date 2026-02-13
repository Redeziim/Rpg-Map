import { cn } from "@/lib/utils";

interface StatusBadgeProps {
  status: "idle" | "uploading" | "done" | "processing" | "error";
  label: string;
}

export function StatusBadge({ status, label }: StatusBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium",
        status === "idle" && "bg-secondary text-muted-foreground",
        status === "uploading" && "bg-primary/10 text-primary",
        status === "done" && "bg-accent/10 text-accent",
        status === "processing" && "bg-primary/10 text-primary",
        status === "error" && "bg-destructive/10 text-destructive"
      )}
    >
      <span
        className={cn(
          "h-1.5 w-1.5 rounded-full",
          status === "idle" && "bg-muted-foreground",
          status === "uploading" && "bg-primary animate-pulse",
          status === "done" && "bg-accent",
          status === "processing" && "bg-primary animate-pulse",
          status === "error" && "bg-destructive"
        )}
      />
      {label}
    </span>
  );
}
