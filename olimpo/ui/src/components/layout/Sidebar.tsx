import { Link, useLocation } from 'react-router-dom';
import { Image, LayoutDashboard, LogOut, FileText, Users, Mountain } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';

const navItems = [
  { to: '/olimpo/private-dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/olimpo/private-foto', label: 'Foto', icon: Image },
  { to: '/olimpo/private-materiali', label: 'Materiali', icon: FileText },
  { to: '/olimpo/private-utenti', label: 'Utenti', icon: Users },
];

export function Sidebar() {
  const location = useLocation();
  const { identity, logout } = useAuth();

  return (
    <aside className="flex h-full w-60 flex-col border-r border-sidebar-border bg-sidebar">
      {/* Logo */}
      <div className="flex h-16 items-center gap-3 px-5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 border border-primary/20 olimpo-glow">
          <Mountain className="h-4 w-4 text-primary" />
        </div>
        <div className="flex flex-col leading-none">
          <span className="text-sm font-bold tracking-wider text-gradient-olimpo uppercase">
            Olimpo
          </span>
          <span className="text-[10px] text-muted-foreground uppercase tracking-widest">
            Dashboard
          </span>
        </div>
      </div>

      <Separator className="bg-sidebar-border" />

      {/* Navigation */}
      <nav className="flex-1 space-y-0.5 p-3">
        {navItems.map(({ to, label, icon: Icon }) => {
          const active = location.pathname === to;
          return (
            <Link key={to} to={to}>
              <span
                className={cn(
                  'flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors cursor-pointer select-none',
                  active
                    ? 'bg-primary/10 text-primary border border-primary/20'
                    : 'text-sidebar-foreground hover:bg-secondary hover:text-foreground',
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {label}
              </span>
            </Link>
          );
        })}
      </nav>

      <Separator className="bg-sidebar-border" />

      {/* User info + logout */}
      <div className="p-4 space-y-3">
        {identity && (
          <div className="px-1 space-y-0.5">
            <p className="text-xs font-medium text-foreground/70 truncate">{identity.username}</p>
            <p className="text-[11px] text-muted-foreground">{identity.tipoUtente}</p>
          </div>
        )}
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start gap-3 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
          onClick={logout}
        >
          <LogOut className="h-4 w-4" />
          Disconnetti
        </Button>
      </div>
    </aside>
  );
}
