'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { GraduationCap, Mail, Lock, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase/client';
import { getDashboardPath } from '@/lib/types';

export default function LoginPage() {
  const { signIn, user, profile, loading: authLoading } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!authLoading && user && profile) {
      router.replace(getDashboardPath(profile.role));
    }
  }, [authLoading, profile, router, user]);

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
        toast.error(profileError?.message ?? 'Your account profile is not available yet.');
        return;
      }

      router.replace(getDashboardPath(profile.role));
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to sign in.');
    } finally {
      setLoading(false);
    }
  }

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
            <CardDescription>Enter your credentials to access your dashboard</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
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
                  <Input id="password" data-testid="login-password-input" type="password" placeholder="••••••••" className="pl-10" value={password} onChange={(e) => setPassword(e.target.value)} required />
                </div>
              </div>
              <Button type="submit" data-testid="login-submit-button" className="w-full gap-2" disabled={loading}>
                {loading ? 'Signing in...' : <>Sign In <ArrowRight className="h-4 w-4" /></>}
              </Button>
            </form>
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
