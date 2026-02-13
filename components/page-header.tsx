import { Gamepad2 } from "lucide-react";

export function PageHeader() {
  return (
    <header className="flex flex-col items-center gap-3 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
        <Gamepad2 className="h-6 w-6 text-primary" />
      </div>
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl text-balance">
          RPG Asset Uploader
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Envie seus arquivos de PNJ e Mapa 3D para processar seu mundo
        </p>
      </div>
    </header>
  );
}
