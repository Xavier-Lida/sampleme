import { TranscriptionFlow } from "@/components/transcription-flow";

export default function Home() {
  return (
    <div className="flex min-h-full flex-col">
      <header className="sticky top-0 z-10 border-b bg-background/95 px-4 py-4 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <h1 className="text-lg font-semibold tracking-tight">MusicMe</h1>
        <p className="text-sm text-muted-foreground">
          Sons → partitions → lecture
        </p>
      </header>
      <main className="mx-auto flex w-full max-w-lg flex-1 flex-col px-4 py-6">
        <TranscriptionFlow />
      </main>
    </div>
  );
}
