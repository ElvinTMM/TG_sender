import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { toast } from 'sonner';
import { Bot, Mail, Lock, User, ArrowRight } from 'lucide-react';
import { motion } from 'framer-motion';

export default function RegisterPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      await register(email, password, name);
      toast.success('Регистрация успешна!');
      navigate('/dashboard');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Ошибка регистрации');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#09090B] flex">
      {/* Left side - decorative */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-purple-500/20 via-transparent to-sky-500/20" />
        <div className="absolute inset-0 grid-pattern" />
        <div className="relative z-10 flex flex-col justify-center items-center p-12">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center"
          >
            <div className="w-24 h-24 rounded-2xl bg-purple-500/20 flex items-center justify-center mx-auto mb-8">
              <Bot className="w-14 h-14 text-purple-400" strokeWidth={1.5} />
            </div>
            <h1 className="font-heading text-4xl font-bold text-white mb-4">Присоединяйтесь</h1>
            <p className="text-zinc-400 text-lg max-w-md">
              Создайте аккаунт и начните эффективную рассылку уже сегодня
            </p>
          </motion.div>
          
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3, duration: 0.6 }}
            className="mt-16 space-y-4 text-left"
          >
            {[
              'Импорт аккаунтов из файла',
              'Загрузка базы номеров',
              'Детальная аналитика',
              'Управление кампаниями',
            ].map((feature, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="w-6 h-6 rounded-full bg-purple-500/20 flex items-center justify-center">
                  <div className="w-2 h-2 rounded-full bg-purple-400" />
                </div>
                <span className="text-zinc-300">{feature}</span>
              </div>
            ))}
          </motion.div>
        </div>
      </div>

      {/* Right side - register form */}
      <div className="flex-1 flex items-center justify-center p-6">
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.4 }}
          className="w-full max-w-md"
        >
          <div className="lg:hidden flex items-center gap-3 mb-8">
            <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center">
              <Bot className="w-6 h-6 text-purple-400" strokeWidth={1.5} />
            </div>
            <h1 className="font-heading font-bold text-xl text-white">TG Sender</h1>
          </div>

          <h2 className="font-heading text-2xl font-bold text-white mb-2">Регистрация</h2>
          <p className="text-zinc-400 mb-8">Создайте аккаунт для начала работы</p>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="name" className="text-zinc-300">Имя</Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" strokeWidth={1.5} />
                <Input
                  id="name"
                  type="text"
                  data-testid="register-name-input"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ваше имя"
                  className="pl-10 bg-zinc-950 border-white/10 focus:border-purple-500/50 text-white placeholder:text-zinc-600"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email" className="text-zinc-300">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" strokeWidth={1.5} />
                <Input
                  id="email"
                  type="email"
                  data-testid="register-email-input"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your@email.com"
                  className="pl-10 bg-zinc-950 border-white/10 focus:border-purple-500/50 text-white placeholder:text-zinc-600"
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
                  data-testid="register-password-input"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="pl-10 bg-zinc-950 border-white/10 focus:border-purple-500/50 text-white placeholder:text-zinc-600"
                  minLength={6}
                  required
                />
              </div>
            </div>

            <Button
              type="submit"
              data-testid="register-submit-btn"
              disabled={loading}
              className="w-full bg-purple-500 hover:bg-purple-600 text-white font-medium shadow-[0_0_15px_rgba(168,85,247,0.3)] hover:shadow-[0_0_25px_rgba(168,85,247,0.5)] transition-all"
            >
              {loading ? (
                <span className="animate-pulse">Регистрация...</span>
              ) : (
                <>
                  Зарегистрироваться
                  <ArrowRight className="ml-2 w-4 h-4" />
                </>
              )}
            </Button>
          </form>

          <p className="mt-8 text-center text-zinc-500">
            Уже есть аккаунт?{' '}
            <Link 
              to="/login" 
              data-testid="login-link"
              className="text-purple-400 hover:text-purple-300 transition-colors"
            >
              Войти
            </Link>
          </p>
        </motion.div>
      </div>
    </div>
  );
}
