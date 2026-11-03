import Link from 'next/link'

const destinations = [
  { href: '/login', label: 'Sign in', description: 'Open your professor or student workspace.' },
  { href: '/signup', label: 'Create account', description: 'Register as a student or professor.' },
]

export default function HomePage() {
  return (
    <main className="min-h-screen bg-background px-6 py-16 text-foreground">
      <div className="mx-auto flex min-h-[70vh] max-w-5xl flex-col justify-center">
        <p className="text-sm font-semibold uppercase tracking-[0.24em] text-primary">Teach Easy</p>
        <h1 className="mt-5 max-w-3xl text-5xl font-semibold tracking-tight sm:text-6xl">Teaching tools that keep learning moving.</h1>
        <p className="mt-6 max-w-2xl text-lg leading-8 text-muted-foreground">Create structured academic content, share materials, and keep students connected from one workspace.</p>
        <div className="mt-10 grid gap-4 sm:grid-cols-2">
          {destinations.map((destination) => (
            <Link key={destination.href} href={destination.href} className="rounded-2xl border border-border bg-card p-6 shadow-sm transition hover:border-primary/60 hover:shadow-md">
              <span className="text-xl font-semibold">{destination.label}</span>
              <span className="mt-2 block text-sm text-muted-foreground">{destination.description}</span>
            </Link>
          ))}
        </div>
      </div>
    </main>
  )
}
