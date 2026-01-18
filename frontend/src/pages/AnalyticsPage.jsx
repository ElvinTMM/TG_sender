import { useState, useEffect } from 'react';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { 
  Users, 
  Phone, 
  Send, 
  MessageSquare,
  CheckCircle,
  XCircle,
  TrendingUp,
  Activity,
  BarChart3
} from 'lucide-react';
import { motion } from 'framer-motion';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  Tooltip, 
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell
} from 'recharts';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const StatCard = ({ icon: Icon, label, value, subLabel, color, delay }) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay: delay * 0.1 }}
  >
    <Card className="bg-zinc-900/50 border-white/10">
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-mono uppercase tracking-wider text-zinc-500 mb-2">{label}</p>
            <p className="text-3xl font-bold text-white font-mono">{value}</p>
            {subLabel && <p className="text-sm text-zinc-400 mt-1">{subLabel}</p>}
          </div>
          <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${color}`}>
            <Icon className="w-6 h-6" strokeWidth={1.5} />
          </div>
        </div>
      </CardContent>
    </Card>
  </motion.div>
);

export default function AnalyticsPage() {
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);

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
        <div className="text-sky-400 font-mono animate-pulse-glow">Загрузка аналитики...</div>
      </div>
    );
  }

  if (!analytics) {
    return (
      <div className="text-center text-zinc-400 py-12">
        Не удалось загрузить аналитику
      </div>
    );
  }

  const accountsData = [
    { name: 'Активные', value: analytics.active_accounts, color: '#22C55E' },
    { name: 'Заблокированные', value: analytics.banned_accounts, color: '#EF4444' },
    { name: 'Ожидающие', value: analytics.total_accounts - analytics.active_accounts - analytics.banned_accounts, color: '#71717A' },
  ].filter(d => d.value > 0);

  const contactsData = [
    { name: 'Ожидают', value: analytics.total_contacts - analytics.messaged_contacts, color: '#71717A' },
    { name: 'Отправлено', value: analytics.messaged_contacts - analytics.responded_contacts, color: '#38BDF8' },
    { name: 'Ответили', value: analytics.responded_contacts, color: '#22C55E' },
  ].filter(d => d.value > 0);

  return (
    <div data-testid="analytics-page" className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="font-heading text-3xl font-bold text-white">Аналитика</h1>
        <p className="text-zinc-400 mt-1">Детальная статистика вашей рассылочной активности</p>
      </div>

      {/* Main Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard 
          icon={Users} 
          label="Всего аккаунтов" 
          value={analytics.total_accounts}
          subLabel={`${analytics.active_accounts} активных`}
          color="bg-sky-500/20 text-sky-400"
          delay={0}
        />
        <StatCard 
          icon={Phone} 
          label="Всего контактов" 
          value={analytics.total_contacts}
          subLabel={`${analytics.messaged_contacts} отправлено`}
          color="bg-purple-500/20 text-purple-400"
          delay={1}
        />
        <StatCard 
          icon={Send} 
          label="Рассылок" 
          value={analytics.total_campaigns}
          subLabel={`${analytics.running_campaigns} активных`}
          color="bg-emerald-500/20 text-emerald-400"
          delay={2}
        />
        <StatCard 
          icon={MessageSquare} 
          label="Сообщений" 
          value={analytics.total_messages_sent}
          subLabel={`${analytics.total_messages_delivered} доставлено`}
          color="bg-amber-500/20 text-amber-400"
          delay={3}
        />
      </div>

      {/* Rates */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
          <Card className="bg-zinc-900/50 border-white/10">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <p className="text-zinc-400">Доставляемость</p>
                <CheckCircle className="w-5 h-5 text-emerald-400" />
              </div>
              <p className="text-4xl font-bold text-emerald-400 font-mono">{analytics.delivery_rate}%</p>
              <div className="mt-4 h-2 bg-zinc-800 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                  style={{ width: `${analytics.delivery_rate}%` }}
                />
              </div>
            </CardContent>
          </Card>
        </motion.div>
        
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}>
          <Card className="bg-zinc-900/50 border-white/10">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <p className="text-zinc-400">Конверсия ответов</p>
                <TrendingUp className="w-5 h-5 text-sky-400" />
              </div>
              <p className="text-4xl font-bold text-sky-400 font-mono">{analytics.response_rate}%</p>
              <div className="mt-4 h-2 bg-zinc-800 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-sky-500 rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(analytics.response_rate * 5, 100)}%` }}
                />
              </div>
            </CardContent>
          </Card>
        </motion.div>
        
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }}>
          <Card className="bg-zinc-900/50 border-white/10">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <p className="text-zinc-400">Заблокировано</p>
                <XCircle className="w-5 h-5 text-red-400" />
              </div>
              <p className="text-4xl font-bold text-red-400 font-mono">{analytics.banned_accounts}</p>
              <p className="text-sm text-zinc-500 mt-2">
                {analytics.total_accounts > 0 
                  ? `${((analytics.banned_accounts / analytics.total_accounts) * 100).toFixed(1)}% от общего числа`
                  : 'Нет аккаунтов'
                }
              </p>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Daily Activity Chart */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.7 }}>
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
                  <AreaChart data={analytics.daily_stats}>
                    <defs>
                      <linearGradient id="colorSentA" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#38BDF8" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#38BDF8" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="colorDeliveredA" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#22C55E" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#22C55E" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="colorResponsesA" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#A855F7" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#A855F7" stopOpacity={0}/>
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
                      fill="url(#colorSentA)"
                      name="Отправлено"
                    />
                    <Area 
                      type="monotone" 
                      dataKey="delivered" 
                      stroke="#22C55E" 
                      fillOpacity={1} 
                      fill="url(#colorDeliveredA)"
                      name="Доставлено"
                    />
                    <Area 
                      type="monotone" 
                      dataKey="responses" 
                      stroke="#A855F7" 
                      fillOpacity={1} 
                      fill="url(#colorResponsesA)"
                      name="Ответы"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Bar Chart */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.8 }}>
          <Card className="bg-zinc-900/50 border-white/10">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg font-heading text-white flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-purple-400" strokeWidth={1.5} />
                Сообщения по дням
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={analytics.daily_stats}>
                    <XAxis 
                      dataKey="date" 
                      stroke="#52525B"
                      tick={{ fill: '#71717A', fontSize: 12 }}
                      tickFormatter={(value) => value.slice(8)}
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
                    <Bar dataKey="sent" fill="#38BDF8" name="Отправлено" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="delivered" fill="#22C55E" name="Доставлено" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Pie Charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.9 }}>
          <Card className="bg-zinc-900/50 border-white/10">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg font-heading text-white flex items-center gap-2">
                <Users className="w-5 h-5 text-sky-400" strokeWidth={1.5} />
                Статус аккаунтов
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="h-64 flex items-center justify-center">
                {accountsData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={accountsData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {accountsData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip 
                        contentStyle={{ 
                          background: '#18181B', 
                          border: '1px solid rgba(255,255,255,0.1)',
                          borderRadius: '8px'
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-zinc-500">Нет данных</p>
                )}
              </div>
              <div className="flex justify-center gap-4 mt-4">
                {accountsData.map((item, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ background: item.color }} />
                    <span className="text-sm text-zinc-400">{item.name}: {item.value}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1 }}>
          <Card className="bg-zinc-900/50 border-white/10">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg font-heading text-white flex items-center gap-2">
                <Phone className="w-5 h-5 text-purple-400" strokeWidth={1.5} />
                Статус контактов
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="h-64 flex items-center justify-center">
                {contactsData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={contactsData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {contactsData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip 
                        contentStyle={{ 
                          background: '#18181B', 
                          border: '1px solid rgba(255,255,255,0.1)',
                          borderRadius: '8px'
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-zinc-500">Нет данных</p>
                )}
              </div>
              <div className="flex justify-center gap-4 mt-4">
                {contactsData.map((item, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ background: item.color }} />
                    <span className="text-sm text-zinc-400">{item.name}: {item.value}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
