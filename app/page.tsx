'use client';

import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { getDashboardPath } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { GraduationCap, FileText, ShieldCheck, Languages, BarChart3, Bell, Sparkles, ArrowRight, Brain, CheckCircle2 } from 'lucide-react';

export default function Home() {
  const { user, profile, authError } = useAuth();

  const features = [
    { icon: FileText, title: 'Prompt Template Engine', desc: 'Built-in templates for PPTs, study notes, visual notes with diagrams, and quizzes.' },
    { icon: ShieldCheck, title: 'Source & Rubric Estimates', desc: 'Review cited source passages and clearly labeled AI estimates for NEP alignment, evidence risk, and content quality.' },
    { icon: Languages, title: 'Multilingual Generation', desc: 'Generate content in English, Hindi, Bengali, Marathi, and Telugu.' },
    { icon: Brain, title: 'Google Forms Push', desc: 'Publish structured quizzes through a configured Apps Script connection and receive form links.' },
    { icon: BarChart3, title: 'Admin Telemetry', desc: 'Review generation activity, usage trends, and model-generated rubric estimates.' },
    { icon: Bell, title: 'Student Hub', desc: 'Share materials through private file storage and let students access authorized resources.' },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-background">
      {/* Nav */}
      <nav className="sticky top-0 z-50 border-b border-border/40 bg-card/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <GraduationCap className="h-5 w-5" />
            </div>
            <span className="text-xl font-bold tracking-tight">Teach Easy</span>
          </div>
          <div className="flex items-center gap-3">
            {user ? (
              <Link href={getDashboardPath(profile?.role)}>
                <Button size="sm" className="gap-2">
                  Go to Dashboard <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            ) : (
              <>
                <Link href="/login">
                  <Button variant="ghost" size="sm">Sign In</Button>
                </Link>
                <Link href="/signup">
                  <Button size="sm">Get Started</Button>
                </Link>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden px-6 pt-20 pb-16">
        <div className="absolute inset-0 -z-10">
          <div className="absolute left-1/2 top-0 h-[400px] w-[600px] -translate-x-1/2 rounded-full bg-primary/10 blur-3xl" />
          <div className="absolute right-0 top-40 h-[300px] w-[300px] rounded-full bg-accent/10 blur-3xl" />
        </div>
        <div className="mx-auto max-w-4xl text-center">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5 text-sm font-medium text-primary animate-fade-in">
            <Sparkles className="h-4 w-4" />
            AI-assisted teaching and learning workspace
          </div>
          <h1 className="mb-6 text-5xl font-bold tracking-tight text-foreground sm:text-6xl animate-slide-up">
            Generate, review, and distribute
            <br />
            <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">educational content with AI</span>
          </h1>
          <p className="mx-auto mb-10 max-w-2xl text-lg text-muted-foreground animate-slide-up">
            A platform for professors and students to create multilingual learning content, review source citations, and share course materials.
          </p>
          <div className="flex flex-col items-center justify-center gap-4 sm:flex-row animate-slide-up">
            {!user && (
              <>
                <Link href="/signup">
                  <Button size="lg" className="gap-2 px-8">
                    Start Creating <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
                <Link href="/login">
                  <Button size="lg" variant="outline" className="px-8">Sign In</Button>
                </Link>
              </>
            )}
          </div>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-x-8 gap-y-2 text-sm text-muted-foreground">
            {(['Source citations', 'AI rubric estimates', '5 Languages', 'Google Forms publishing'] || []).map((item) => (
              <div key={item} className="flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-accent" />
                {item}
              </div>
            ))}
          </div>
        </div>
      </section>

      {authError && (
        <div className="mx-auto max-w-4xl px-6 pb-8">
          <div className="rounded-xl border border-primary/30 bg-secondary p-4 text-sm text-foreground" role="status">
            Authentication is unavailable: {authError}
          </div>
        </div>
      )}

      {/* Features */}
      <section className="px-6 py-16">
        <div className="mx-auto max-w-7xl">
          <div className="mb-12 text-center">
            <h2 className="mb-4 text-3xl font-bold tracking-tight">Everything educators need, in one platform</h2>
            <p className="text-muted-foreground">Create, review, and share learning materials with clear limits on what automated scores mean.</p>
          </div>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {(features || []).map((f, i) => (
              <Card key={i} className="group border-border/60 transition-all hover:border-primary/30 hover:shadow-lg animate-scale-in">
                <CardHeader>
                  <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                    <f.icon className="h-6 w-6" />
                  </div>
                  <CardTitle className="text-xl">{f.title}</CardTitle>
                  <CardDescription className="text-base leading-relaxed">{f.desc}</CardDescription>
                </CardHeader>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="px-6 py-20">
        <div className="mx-auto max-w-4xl">
          <Card className="overflow-hidden border-primary/20 bg-secondary/40">
            <CardContent className="p-12 text-center">
              <h2 className="mb-4 text-3xl font-bold text-foreground">Ready to transform your teaching?</h2>
              <p className="mb-8 text-muted-foreground">Join Teach Easy to create and review multilingual educational content.</p>
              <Link href="/signup">
                <Button size="lg" className="gap-2 bg-accent text-white hover:bg-accent/90">
                  Create Free Account <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </section>

      <footer className="border-t border-border/40 px-6 py-8">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <GraduationCap className="h-4 w-4" /> Teach Easy
          </div>
          <p className="text-sm text-muted-foreground">AI-assisted Educational Content</p>
        </div>
      </footer>
    </div>
  );
}
