import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { 
  Users, 
  Phone, 
  Send, 
  CheckCircle,
  XCircle,
  MessageSquare,
  TrendingUp,
  ArrowRight,
  Activity
} from 'lucide-react';
import { motion } from 'framer-motion';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const StatCard = ({ icon: Icon, label, value, subValue, color, delay }) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay: delay * 0.1 }}
  >
    <Card className="bg-zinc-900/50 border-white/10 hover:border-white/20 transition-colors">
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-mono uppercase tracking-wider text-zinc-500 mb-2">{label}</p>
            <p className="text-3xl font-bold text-white font-mono">{value}</p>
            {subValue && (
              <p className="text-sm text-zinc-400 mt-1">{subValue}</p>
            )}
          </div>
          <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${color}`}>
            <Icon className="w-6 h-6" strokeWidth={1.5} />
          </div>
        </div>
      </CardContent>
    </Card>
  </motion.div>
);

export default function DashboardPage() {
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const fetchAnalytics = async () => {
    try {
      const response = await axios.get(`${API}/analytics`);
      setAnalytics(response.data);
    } catch (error) {
      console.error('Failed to fetch analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-sky-400 font-mono animate-pulse-glow">Загрузка данных...</div>
      </div>
    );
  }

  const stats = analytics ? [
    { 
      icon: Users, 
      label: 'Аккаунты', 
      value: analytics.total_accounts,
      subValue: `${analytics.active_accounts} активных`,
      color: 'bg-sky-500/20 text-sky-400'
    },
    { 
      icon: Phone, 
      label: 'Контакты', 
      value: analytics.total_contacts,
      subValue: `${analytics.messaged_contacts} отправлено`,
      color: 'bg-purple-500/20 text-purple-400'
    },
    { 
      icon: Send, 
      label: 'Рассылки', 
      value: analytics.total_campaigns,
      subValue: `${analytics.running_campaigns} активных`,
      color: 'bg-emerald-500/20 text-emerald-400'
    },
    { 
      icon: MessageSquare, 
      label: 'Сообщений', 
      value: analytics.total_messages_sent,
      subValue: `${analytics.total_messages_delivered} доставлено`,
      color: 'bg-amber-500/20 text-amber-400'
    },
  ] : [];

  return (
    <div data-testid="dashboard-page" className="h-[calc(100vh-6rem)] flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="font-heading text-2xl font-bold text-white">Дашборд</h1>
          <p className="text-zinc-400 text-sm">Обзор вашей рассылочной активности</p>
        </div>
        <Button 
          data-testid="new-campaign-btn"
          onClick={() => navigate('/campaigns')}
          className="bg-sky-500 hover:bg-sky-600 text-white shadow-[0_0_15px_rgba(14,165,233,0.3)]"
        >
          Новая рассылка
          <ArrowRight className="ml-2 w-4 h-4" />
        </Button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        {stats.map((stat, i) => (
          <StatCard key={stat.label} {...stat} delay={i} />
        ))}
      </div>

      {/* Charts and Info */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 flex-1 min-h-0">
        {/* Main Chart */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="lg:col-span-2"
        >
          <Card className="bg-zinc-900/50 border-white/10">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg font-heading text-white flex items-center gap-2">
                <Activity className="w-5 h-5 text-sky-400" strokeWidth={1.5} />
                Активность за 7 дней
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={analytics?.daily_stats || []}>
                    <defs>
                      <linearGradient id="colorSent" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#38BDF8" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#38BDF8" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="colorDelivered" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#22C55E" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#22C55E" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <XAxis 
                      dataKey="date" 
                      stroke="#52525B"
                      tick={{ fill: '#71717A', fontSize: 12 }}
                      tickFormatter={(value) => value.slice(5)}
                    />
                    <YAxis 
                      stroke="#52525B"
                      tick={{ fill: '#71717A', fontSize: 12 }}
                    />
                    <Tooltip 
                      contentStyle={{ 
                        background: '#18181B', 
                        border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: '8px'
                      }}
                      labelStyle={{ color: '#FAFAFA' }}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="sent" 
                      stroke="#38BDF8" 
                      fillOpacity={1} 
                      fill="url(#colorSent)"
                      name="Отправлено"
                    />
                    <Area 
                      type="monotone" 
                      dataKey="delivered" 
                      stroke="#22C55E" 
                      fillOpacity={1} 
                      fill="url(#colorDelivered)"
                      name="Доставлено"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Side Stats */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="space-y-4"
        >
          <Card className="bg-zinc-900/50 border-white/10">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg font-heading text-white flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-emerald-400" strokeWidth={1.5} />
                Показатели
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-zinc-800/50 rounded-lg">
                <div className="flex items-center gap-3">
                  <CheckCircle className="w-5 h-5 text-emerald-400" strokeWidth={1.5} />
                  <span className="text-zinc-300">Доставляемость</span>
                </div>
                <span className="font-mono text-emerald-400">{analytics?.delivery_rate || 0}%</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-zinc-800/50 rounded-lg">
                <div className="flex items-center gap-3">
                  <MessageSquare className="w-5 h-5 text-sky-400" strokeWidth={1.5} />
                  <span className="text-zinc-300">Ответы</span>
                </div>
                <span className="font-mono text-sky-400">{analytics?.response_rate || 0}%</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-zinc-800/50 rounded-lg">
                <div className="flex items-center gap-3">
                  <XCircle className="w-5 h-5 text-red-400" strokeWidth={1.5} />
                  <span className="text-zinc-300">Заблокировано</span>
                </div>
                <span className="font-mono text-red-400">{analytics?.banned_accounts || 0}</span>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-zinc-900/50 border-white/10">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg font-heading text-white">Быстрые действия</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button 
                variant="ghost" 
                className="w-full justify-start text-zinc-400 hover:text-white hover:bg-white/5"
                onClick={() => navigate('/accounts')}
                data-testid="quick-accounts-btn"
              >
                <Users className="w-4 h-4 mr-2" />
                Добавить аккаунты
              </Button>
              <Button 
                variant="ghost" 
                className="w-full justify-start text-zinc-400 hover:text-white hover:bg-white/5"
                onClick={() => navigate('/contacts')}
                data-testid="quick-contacts-btn"
              >
                <Phone className="w-4 h-4 mr-2" />
                Загрузить контакты
              </Button>
              <Button 
                variant="ghost" 
                className="w-full justify-start text-zinc-400 hover:text-white hover:bg-white/5"
                onClick={() => navigate('/analytics')}
                data-testid="quick-analytics-btn"
              >
                <TrendingUp className="w-4 h-4 mr-2" />
                Аналитика
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
