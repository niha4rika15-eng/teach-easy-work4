'use client';

import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { Button } from '@/components/ui/button';
import { GraduationCap, LogOut, LayoutDashboard, FileText, BarChart3, Bell, BookOpen, ShieldCheck, Users } from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';
import { ReactNode } from 'react';

export function AppNav({ children }: { children: ReactNode }) {
  const { profile, signOut } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  const navItems = {
    professor: [
      { href: '/professor', label: 'Dashboard', icon: LayoutDashboard },
      { href: '/professor/generate', label: 'Generate Content', icon: FileText },
      { href: '/professor/templates', label: 'Templates', icon: BookOpen },
      { href: '/professor/share', label: 'Share Materials', icon: Users },
    ],
    student: [
      { href: '/student', label: 'Dashboard', icon: LayoutDashboard },
      { href: '/student/materials', label: 'Materials', icon: BookOpen },
      { href: '/student/notifications', label: 'Notifications', icon: Bell },
    ],
    admin: [
      { href: '/admin', label: 'Dashboard', icon: LayoutDashboard },
      { href: '/admin/metrics', label: 'Telemetry', icon: BarChart3 },
      { href: '/admin/users', label: 'Users', icon: Users },
    ],
  };

  const userRole = (profile?.role || '').toLowerCase() as keyof typeof navItems;
  const items = profile ? navItems[userRole] || [] : [];
  const roleColor = userRole === 'admin' ? 'text-destructive' : userRole === 'professor' ? 'text-primary' : 'text-accent';

  async function handleSignOut() {
    await signOut();
    router.push('/');
  }

  return (
    <div className="dashboard-shell min-h-screen bg-background text-foreground">
      <nav className="sticky top-0 z-50 border-b border-border/60 bg-background/95 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 sm:px-6 py-3">
          <div className="flex items-center gap-6">
            <Link href="/" className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <GraduationCap className="h-5 w-5" />
              </div>
              <span className="text-lg font-bold">EduAI</span>
            </Link>
            <div className="hidden items-center gap-1 sm:flex">
              {(items || []).map((item) => (
                <Link key={item.href} href={item.href}>
                  <Button variant="ghost" size="sm" className={`group gap-2 rounded-lg text-muted-foreground transition-all duration-200 hover:-translate-y-0.5 hover:bg-secondary hover:text-primary hover:shadow-sm ${pathname === item.href ? 'bg-secondary text-primary shadow-sm' : ''}`}>
                    <item.icon className="h-4 w-4 transition-transform duration-200 group-hover:scale-110" />
                    {item.label}
                  </Button>
                </Link>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden items-center gap-2 sm:flex">
              <div className="flex items-center gap-1.5 rounded-full bg-muted px-3 py-1">
                <ShieldCheck className={`h-3.5 w-3.5 ${roleColor}`} />
                <span className="text-xs font-medium capitalize">{profile?.role}</span>
              </div>
              <span className="text-sm font-medium">{profile?.full_name}</span>
            </div>
            <Button variant="ghost" size="icon" onClick={handleSignOut} title="Sign out">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
        {/* Mobile nav */}
        <div className="grid grid-cols-2 gap-1 border-t border-border/30 px-3 py-2 sm:hidden">
          {(items || []).map((item) => (
            <Link key={item.href} href={item.href}>
              <Button variant="ghost" size="sm" className={`group min-w-0 justify-start gap-1.5 rounded-lg px-2 text-xs transition-all duration-200 hover:-translate-y-0.5 hover:bg-secondary hover:text-primary hover:shadow-sm ${pathname === item.href ? 'bg-secondary text-primary shadow-sm' : ''}`}>
                <item.icon className="h-4 w-4 transition-transform duration-200 group-hover:scale-110" />
                {item.label}
              </Button>
            </Link>
          ))}
        </div>
      </nav>
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">{children}</main>
    </div>
  );
}
