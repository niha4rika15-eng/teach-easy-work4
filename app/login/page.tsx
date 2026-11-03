'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { GraduationCap, Mail, Lock, ArrowRight, Briefcase, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase/client';
import { getDashboardPath } from '@/lib/types';

const SIGN_IN_ROLES = [
  { value: 'student', label: 'Student', icon: GraduationCap },
  { value: 'professor', label: 'Professor', icon: Briefcase },
  { value: 'admin', label: 'Admin', icon: ShieldCheck },
] as const;

type SignInRole = (typeof SIGN_IN_ROLES)[number]['value'];

function safeNextPath(value: string | null, role: string) {
  return value && value.startsWith(`/${role}`) && !value.startsWith('//') ? value : getDashboardPath(role);
}

function LoginForm() {
  const { signIn } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [role, setRole] = useState<SignInRole>('student');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (searchParams.get('registered') === '1') toast.success('Account created. Confirm your email if asked, then sign in.');
  }, [searchParams]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await signIn(email, password);
      if (error) {
        toast.error(error);
        return;
      }

      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session) {
        toast.error(sessionError?.message ?? 'Sign-in succeeded, but no session was created.');
        return;
      }

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', session.user.id)
        .maybeSingle();
      if (profileError || !profile) {
        await supabase.auth.signOut();
        toast.error(profileError?.message ?? 'Your account profile is not available yet.');
        return;
      }

      // The chosen role must match the role granted in the database; it never grants access by itself.
      const actualRole = String(profile.role ?? '').toLowerCase();
      if (actualRole !== role) {
        await supabase.auth.signOut();
        const label = SIGN_IN_ROLES.find((item) => item.value === role)?.label ?? role;
        toast.error(`This account does not have ${label} access. Choose the role assigned to your account.`);
        return;
      }

      router.replace(safeNextPath(searchParams.get('next'), actualRole));
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to sign in.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label>Sign in as</Label>
        <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Sign in as">
          {SIGN_IN_ROLES.map((item) => (
            <button
              key={item.value}
              type="button"
              role="radio"
              aria-checked={role === item.value}
              data-testid={`login-role-${item.value}`}
              onClick={() => setRole(item.value)}
              className={`flex flex-col items-center gap-1.5 rounded-lg border-2 p-3 transition-colors ${role === item.value ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/30'}`}
            >
              <item.icon className={`h-5 w-5 ${role === item.value ? 'text-primary' : 'text-muted-foreground'}`} />
              <span className="text-xs font-medium">{item.label}</span>
            </button>
          ))}
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <div className="relative">
          <Mail className="absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" />
          <Input id="email" data-testid="login-email-input" type="email" placeholder="you@example.com" className="pl-10" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <div className="relative">
          <Lock className="absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" />
          <Input id="password" data-testid="login-password-input" type="password" placeholder="Enter your password" className="pl-10" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </div>
      </div>
      <Button type="submit" data-testid="login-submit-button" className="w-full gap-2" disabled={loading}>
        {loading ? 'Signing in...' : <>Sign In <ArrowRight className="h-4 w-4" /></>}
      </Button>
    </form>
  );
}

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-background to-card px-4">
      <div className="w-full max-w-md animate-scale-in">
        <div className="mb-8 text-center">
          <Link href="/" className="inline-flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <GraduationCap className="h-6 w-6" />
            </div>
            <span className="text-2xl font-bold">Teach Easy</span>
          </Link>
        </div>
        <Card className="border-border/60 shadow-xl">
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl">Sign in</CardTitle>
            <CardDescription>Choose your role and enter your credentials. Dashboards open only after you sign in.</CardDescription>
          </CardHeader>
          <CardContent>
            <Suspense fallback={null}>
              <LoginForm />
            </Suspense>
          </CardContent>
          <CardFooter className="justify-center">
            <p className="text-sm text-muted-foreground">
              Don&apos;t have an account?{' '}
              <Link href="/signup" className="font-medium text-primary hover:underline">Sign up</Link>
            </p>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
