import Link from 'next/link'

const destinations = [
  { href: '/login', label: 'Sign in', description: 'Open your professor or student workspace.' },
  { href: '/signup', label: 'Create account', description: 'Register as a student or professor.' },
]

export default function HomePage() {
  return (
    <main className="min-h-screen bg-[#0d0618] px-6 py-16 text-white">
      <div className="mx-auto flex min-h-[70vh] max-w-5xl flex-col justify-center">
        <p className="text-sm font-semibold uppercase tracking-[0.24em] text-emerald-400">Teach Easy</p>
        <h1 className="mt-5 max-w-3xl text-5xl font-semibold tracking-tight sm:text-6xl">Teaching tools that keep learning moving.</h1>
        <p className="mt-6 max-w-2xl text-lg leading-8 text-violet-200/75">Create structured academic content, share materials, and keep students connected from one workspace.</p>
        <div className="mt-10 grid gap-4 sm:grid-cols-2">
          {destinations.map((destination) => (
            <Link key={destination.href} href={destination.href} className="rounded-2xl border border-violet-300/20 bg-violet-950/40 p-6 transition hover:border-emerald-400/60 hover:bg-violet-900/40">
              <span className="text-xl font-semibold">{destination.label}</span>
              <span className="mt-2 block text-sm text-violet-200/70">{destination.description}</span>
            </Link>
          ))}
        </div>
      </div>
    </main>
  )
}
