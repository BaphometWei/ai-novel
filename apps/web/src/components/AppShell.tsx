import { BookOpen, Boxes, ClipboardCheck, Library, Settings, Sparkles } from 'lucide-react';
import type { ReactNode } from 'react';

const navItems = [
  { href: '#dashboard', label: 'Dashboard', icon: ClipboardCheck },
  { href: '#manuscript', label: 'Manuscript', icon: BookOpen },
  { href: '#story-bible', label: 'Story Bible', icon: Boxes },
  { href: '#agent-room', label: 'Agent Room', icon: Sparkles },
  { href: '#knowledge', label: 'Knowledge', icon: Library },
  { href: '#settings', label: 'Settings', icon: Settings }
];

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">AI</span>
          <h1>AI Novel Workspace</h1>
        </div>
        <nav aria-label="Primary navigation">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <a href={item.href} key={item.href}>
                <Icon aria-hidden="true" size={18} />
                <span>{item.label}</span>
              </a>
            );
          })}
        </nav>
      </aside>
      <section className="workspace" id="dashboard">
        {children}
      </section>
    </main>
  );
}
