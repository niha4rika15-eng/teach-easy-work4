export default function HomePage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6 text-foreground">
      <section className="w-full max-w-2xl rounded-2xl border border-border bg-card p-8 shadow-xl">
        <p className="mb-3 text-sm font-medium uppercase tracking-[0.2em] text-primary">Teach Easy</p>
        <h1 className="text-3xl font-semibold tracking-tight">The application is online.</h1>
        <p className="mt-4 text-muted-foreground">
          Next.js is now loading the project root correctly. The previous startup error was caused by the repository files being flattened at the root, so the required app directory was missing.
        </p>
      </section>
    </main>
  )
}
