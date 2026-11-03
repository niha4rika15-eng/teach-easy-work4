'use client'

import { FormEvent, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function SignupPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<'student' | 'professor'>('student')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setPending(true)
    setError('')
    setMessage('')
    const { data, error: signUpError } = await createClient().auth.signUp({ email, password, options: { emailRedirectTo: process.env.NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL ?? `${window.location.origin}/auth/callback`, data: { role } } })
    if (signUpError) setError(signUpError.message.includes('password') ? signUpError.message : 'Unable to create this account. Check your details and try again.')
    else if (data.session) {
      router.replace(`/${role}`)
      router.refresh()
    }
    else setMessage('Account created. Check your email to confirm your account before signing in.')
    setPending(false)
  }

  return <main className="min-h-screen bg-background px-6 py-16 text-white"><div className="mx-auto max-w-md"><Link href="/" className="text-sm font-semibold uppercase tracking-[0.24em] text-emerald-400">Teach Easy</Link><div className="mt-8 rounded-2xl border border-violet-300/20 bg-violet-950/40 p-8"><h1 className="text-3xl font-semibold">Create your account</h1><p className="mt-2 text-violet-200/70">Choose your workspace to get started.</p><form onSubmit={handleSubmit} className="mt-8 space-y-4"><input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="Email address" className="w-full rounded-xl border border-violet-300/20 bg-black/20 px-4 py-3 outline-none focus:border-emerald-400" /><input required minLength={8} type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Password (at least 8 characters)" className="w-full rounded-xl border border-violet-300/20 bg-black/20 px-4 py-3 outline-none focus:border-emerald-400" /><select value={role} onChange={(event) => setRole(event.target.value as 'student' | 'professor')} className="w-full rounded-xl border border-violet-300/20 bg-[#1d102d] px-4 py-3 outline-none focus:border-emerald-400"><option value="student">Student</option><option value="professor">Professor</option></select>{error && <p role="alert" className="text-sm text-rose-300">{error}</p>}{message && <p role="status" className="text-sm text-emerald-300">{message}</p>}<button disabled={pending} className="w-full rounded-xl bg-emerald-400 px-4 py-3 font-semibold text-[#07110e] disabled:opacity-60">{pending ? 'Creating account…' : 'Create account'}</button></form><p className="mt-6 text-sm text-violet-200/70">Already registered? <Link className="text-emerald-300 hover:underline" href="/login">Sign in</Link></p></div></div></main>
}
