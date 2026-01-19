import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { 
  LayoutDashboard, 
  Users, 
  Phone, 
  Send, 
  BarChart3, 
  LogOut,
  Menu,
  X,
  Bot,
  MessageSquare,
  FileText,
  Mic
} from 'lucide-react';
import { useState } from 'react';
import { Button } from './ui/button';

const navItems = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Дашборд' },
  { to: '/accounts', icon: Users, label: 'Аккаунты' },
  { to: '/contacts', icon: Phone, label: 'Контакты' },
  { to: '/templates', icon: FileText, label: 'Шаблоны' },
  { to: '/campaigns', icon: Send, label: 'Рассылки' },
  { to: '/voice', icon: Mic, label: 'Голосовые' },
  { to: '/dialogs', icon: MessageSquare, label: 'Диалоги' },
  { to: '/analytics', icon: BarChart3, label: 'Аналитика' },
];

export default function DashboardLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-[#09090B] grid-pattern">
      {/* Mobile menu button */}
      <button 
        data-testid="mobile-menu-btn"
        className="lg:hidden fixed top-4 left-4 z-50 p-2 rounded-lg bg-zinc-900 border border-white/10"
        onClick={() => setSidebarOpen(!sidebarOpen)}
      >
        {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
      </button>

      {/* Sidebar */}
      <aside 
        className={`fixed left-0 top-0 h-full w-64 border-r border-white/10 bg-[#09090B]/95 backdrop-blur-xl z-40 transform transition-transform duration-200 lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="p-6 border-b border-white/10">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-sky-500/20 flex items-center justify-center neon-glow">
                <Bot className="w-6 h-6 text-sky-400" strokeWidth={1.5} />
              </div>
              <div>
                <h1 className="font-heading font-bold text-white">TG Sender</h1>
                <p className="text-xs text-zinc-500 font-mono">v1.0.0</p>
              </div>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-4 space-y-1">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                data-testid={`nav-${item.to.slice(1)}`}
                onClick={() => setSidebarOpen(false)}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 ${
                    isActive
                      ? 'bg-sky-500/10 text-sky-400 border border-sky-500/20'
                      : 'text-zinc-400 hover:text-white hover:bg-white/5'
                  }`
                }
              >
                <item.icon size={20} strokeWidth={1.5} />
                <span className="font-medium">{item.label}</span>
              </NavLink>
            ))}
          </nav>

          {/* User section */}
          <div className="p-4 border-t border-white/10">
            <div className="flex items-center gap-3 px-4 py-3 mb-2">
              <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center">
                <span className="text-sm font-medium text-zinc-400">
                  {user?.name?.charAt(0).toUpperCase()}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">{user?.name}</p>
                <p className="text-xs text-zinc-500 truncate">{user?.email}</p>
              </div>
            </div>
            <Button
              data-testid="logout-btn"
              variant="ghost"
              className="w-full justify-start gap-3 text-zinc-400 hover:text-red-400 hover:bg-red-500/10"
              onClick={handleLogout}
            >
              <LogOut size={20} strokeWidth={1.5} />
              Выйти
            </Button>
          </div>
        </div>
      </aside>

      {/* Overlay for mobile */}
      {sidebarOpen && (
        <div 
          className="lg:hidden fixed inset-0 bg-black/50 z-30"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main content */}
      <main className="lg:pl-64 min-h-screen">
        <div className="p-6 md:p-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
