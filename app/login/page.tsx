'use client'

import { FormEvent, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setPending(true)
    setError('')
    const supabase = createClient()
    const { data, error: signInError } = await supabase.auth.signInWithPassword({ email, password })
    if (signInError) {
      setError('Invalid email or password. If your email is not confirmed, check your inbox first.')
    } else {
      const role = data.user?.user_metadata?.role === 'professor' ? 'professor' : 'student'
      router.replace(`/${role}`)
      router.refresh()
    }
    setPending(false)
  }

  return <AuthShell title="Welcome back" subtitle="Sign in to continue to Teach Easy.">
    <form onSubmit={handleSubmit} className="space-y-4">
      <input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="Email address" className="w-full rounded-xl border border-violet-300/20 bg-black/20 px-4 py-3 outline-none focus:border-emerald-400" />
      <input required type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Password" className="w-full rounded-xl border border-violet-300/20 bg-black/20 px-4 py-3 outline-none focus:border-emerald-400" />
      {error && <p role="alert" className="text-sm text-rose-300">{error}</p>}
      <button disabled={pending} className="w-full rounded-xl bg-emerald-400 px-4 py-3 font-semibold text-[#07110e] disabled:opacity-60">{pending ? 'Signing in…' : 'Sign in'}</button>
    </form>
    <p className="mt-6 text-sm text-violet-200/70">New here? <Link className="text-emerald-300 hover:underline" href="/signup">Create an account</Link></p>
  </AuthShell>
}

function AuthShell({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return <main className="min-h-screen bg-[#0d0618] px-6 py-16 text-white"><div className="mx-auto max-w-md"><Link href="/" className="text-sm font-semibold uppercase tracking-[0.24em] text-emerald-400">Teach Easy</Link><div className="mt-8 rounded-2xl border border-violet-300/20 bg-violet-950/40 p-8"><h1 className="text-3xl font-semibold">{title}</h1><p className="mt-2 text-violet-200/70">{subtitle}</p><div className="mt-8">{children}</div></div></div></main>
}
