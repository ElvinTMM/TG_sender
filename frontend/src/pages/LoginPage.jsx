import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { toast } from 'sonner';
import { Bot, Mail, Lock, ArrowRight } from 'lucide-react';
import { motion } from 'framer-motion';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      await login(email, password);
      toast.success('Успешный вход!');
      navigate('/dashboard');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Ошибка входа');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#09090B] flex">
      {/* Left side - decorative */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-sky-500/20 via-transparent to-purple-500/20" />
        <div className="absolute inset-0 grid-pattern" />
        <div className="relative z-10 flex flex-col justify-center items-center p-12">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center"
          >
            <div className="w-24 h-24 rounded-2xl bg-sky-500/20 flex items-center justify-center mx-auto mb-8 neon-glow-strong">
              <Bot className="w-14 h-14 text-sky-400" strokeWidth={1.5} />
            </div>
            <h1 className="font-heading text-4xl font-bold text-white mb-4">TG Sender</h1>
            <p className="text-zinc-400 text-lg max-w-md">
              Автоматизируйте рассылку в Telegram с помощью нашей платформы
            </p>
          </motion.div>
          
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3, duration: 0.6 }}
            className="mt-16 grid grid-cols-3 gap-8 text-center"
          >
            {[
              { label: 'Аккаунтов', value: '∞' },
              { label: 'Доставляемость', value: '99%' },
              { label: 'Аналитика', value: 'Real-time' },
            ].map((stat, i) => (
              <div key={i}>
                <div className="text-2xl font-bold text-sky-400 font-mono">{stat.value}</div>
                <div className="text-sm text-zinc-500">{stat.label}</div>
              </div>
            ))}
          </motion.div>
        </div>
      </div>

      {/* Right side - login form */}
      <div className="flex-1 flex items-center justify-center p-6">
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.4 }}
          className="w-full max-w-md"
        >
          <div className="lg:hidden flex items-center gap-3 mb-8">
            <div className="w-10 h-10 rounded-lg bg-sky-500/20 flex items-center justify-center">
              <Bot className="w-6 h-6 text-sky-400" strokeWidth={1.5} />
            </div>
            <h1 className="font-heading font-bold text-xl text-white">TG Sender</h1>
          </div>

          <h2 className="font-heading text-2xl font-bold text-white mb-2">Вход в систему</h2>
          <p className="text-zinc-400 mb-8">Введите данные для доступа к панели управления</p>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-zinc-300">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" strokeWidth={1.5} />
                <Input
                  id="email"
                  type="email"
                  data-testid="login-email-input"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your@email.com"
                  className="pl-10 bg-zinc-950 border-white/10 focus:border-sky-500/50 text-white placeholder:text-zinc-600"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-zinc-300">Пароль</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" strokeWidth={1.5} />
                <Input
                  id="password"
                  type="password"
                  data-testid="login-password-input"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="pl-10 bg-zinc-950 border-white/10 focus:border-sky-500/50 text-white placeholder:text-zinc-600"
                  required
                />
              </div>
            </div>

            <Button
              type="submit"
              data-testid="login-submit-btn"
              disabled={loading}
              className="w-full bg-sky-500 hover:bg-sky-600 text-white font-medium shadow-[0_0_15px_rgba(14,165,233,0.3)] hover:shadow-[0_0_25px_rgba(14,165,233,0.5)] transition-all"
            >
              {loading ? (
                <span className="animate-pulse">Вход...</span>
              ) : (
                <>
                  Войти
                  <ArrowRight className="ml-2 w-4 h-4" />
                </>
              )}
            </Button>
          </form>

          <p className="mt-8 text-center text-zinc-500">
            Нет аккаунта?{' '}
            <Link 
              to="/register" 
              data-testid="register-link"
              className="text-sky-400 hover:text-sky-300 transition-colors"
            >
              Зарегистрироваться
            </Link>
          </p>
        </motion.div>
      </div>
    </div>
  );
}
