import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Switch } from '../components/ui/switch';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '../components/ui/tabs';
import { toast } from 'sonner';
import { 
  Plus, 
  Upload, 
  Users, 
  MoreVertical, 
  Trash2, 
  CheckCircle,
  XCircle,
  Clock,
  Phone,
  Shield,
  Edit,
  DollarSign,
  Wallet,
  Key,
  Send,
  Loader2
} from 'lucide-react';
import { motion } from 'framer-motion';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const StatusBadge = ({ status }) => {
  const styles = {
    active: 'status-active',
    banned: 'status-banned',
    pending: 'status-pending',
  };
  
  const icons = {
    active: CheckCircle,
    banned: XCircle,
    pending: Clock,
  };
  
  const Icon = icons[status] || Clock;
  
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-mono uppercase ${styles[status] || styles.pending}`}>
      <Icon className="w-3 h-3" />
      {status === 'active' ? 'Активен' : status === 'banned' ? 'Заблокирован' : 'Ожидание'}
    </span>
  );
};

const PriceBadge = ({ category, value }) => {
  const styles = {
    low: 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20',
    medium: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    high: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  };
  
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-mono border ${styles[category] || styles.low}`}>
      <DollarSign className="w-3 h-3" />
      {value || 0} USDT
    </span>
  );
};

const defaultAccount = {
  phone: '',
  name: '',
  api_id: '',
  api_hash: '',
  value_usdt: 0,
  proxy: {
    enabled: false,
    type: 'socks5',
    host: '',
    port: '',
    username: '',
    password: ''
  },
  limits: {
    max_per_hour: 20,
    max_per_day: 100,
    delay_min: 30,
    delay_max: 90
  }
};

export default function AccountsPage() {
  const [accounts, setAccounts] = useState([]);
  const [stats, setStats] = useState({ total: 0, low: 0, medium: 0, high: 0 });
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState(null);
  const [newAccount, setNewAccount] = useState(defaultAccount);
  const [activeTab, setActiveTab] = useState('all');
  const fileInputRef = useRef(null);
  
  // Telegram auth state
  const [authDialogOpen, setAuthDialogOpen] = useState(false);
  const [authAccount, setAuthAccount] = useState(null);
  const [authStep, setAuthStep] = useState('idle'); // idle, code_sent, 2fa_required, authorizing
  const [authCode, setAuthCode] = useState('');
  const [auth2FA, setAuth2FA] = useState('');
  const [authLoading, setAuthLoading] = useState(false);

  useEffect(() => {
    fetchAccounts();
    fetchStats();
  }, [activeTab]);

  const fetchAccounts = async () => {
    try {
      let url = `${API}/accounts`;
      if (activeTab !== 'all') {
        url += `?price_category=${activeTab}`;
      }
      const response = await axios.get(url);
      setAccounts(response.data);
    } catch (error) {
      toast.error('Ошибка загрузки аккаунтов');
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await axios.get(`${API}/accounts/stats`);
      setStats(response.data);
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const handleSaveAccount = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        ...newAccount,
        value_usdt: parseFloat(newAccount.value_usdt) || 0,
        proxy: {
          ...newAccount.proxy,
          port: parseInt(newAccount.proxy.port) || 0
        },
        limits: {
          max_per_hour: parseInt(newAccount.limits.max_per_hour) || 20,
          max_per_day: parseInt(newAccount.limits.max_per_day) || 100,
          delay_min: parseInt(newAccount.limits.delay_min) || 30,
          delay_max: parseInt(newAccount.limits.delay_max) || 90
        }
      };

      if (editingAccount) {
        await axios.put(`${API}/accounts/${editingAccount.id}`, payload);
        toast.success('Аккаунт обновлен');
      } else {
        await axios.post(`${API}/accounts`, payload);
        toast.success('Аккаунт добавлен');
      }
      
      setDialogOpen(false);
      setNewAccount(defaultAccount);
      setEditingAccount(null);
      fetchAccounts();
      fetchStats();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Ошибка сохранения');
    }
  };

  const handleEditAccount = (account) => {
    setEditingAccount(account);
    setNewAccount({
      phone: account.phone,
      name: account.name || '',
      api_id: '',
      api_hash: '',
      value_usdt: account.value_usdt || 0,
      proxy: account.proxy || defaultAccount.proxy,
      limits: account.limits || defaultAccount.limits
    });
    setDialogOpen(true);
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await axios.post(`${API}/accounts/import`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      toast.success(`Импортировано ${response.data.imported} аккаунтов`);
      fetchAccounts();
      fetchStats();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Ошибка импорта');
    }
    
    e.target.value = '';
  };

  const handleStatusChange = async (accountId, status) => {
    try {
      await axios.put(`${API}/accounts/${accountId}/status?status=${status}`);
      toast.success('Статус обновлен');
      fetchAccounts();
    } catch (error) {
      toast.error('Ошибка обновления статуса');
    }
  };

  const handleDelete = async (accountId) => {
    if (!window.confirm('Удалить аккаунт?')) return;
    
    try {
      await axios.delete(`${API}/accounts/${accountId}`);
      toast.success('Аккаунт удален');
      fetchAccounts();
      fetchStats();
    } catch (error) {
      toast.error('Ошибка удаления');
    }
  };

  // Telegram Authorization Functions
  const handleStartAuth = async (account) => {
    setAuthAccount(account);
    setAuthDialogOpen(true);
    setAuthStep('idle');
    setAuthCode('');
    setAuth2FA('');
    setAuthLoading(true);
    
    try {
      const response = await axios.post(`${API}/telegram/auth/start`, {
        account_id: account.id
      });
      
      if (response.data.status === 'authorized') {
        toast.success('Аккаунт уже авторизован!');
        setAuthDialogOpen(false);
        fetchAccounts();
      } else if (response.data.status === 'code_sent') {
        setAuthStep('code_sent');
        toast.success('SMS код отправлен');
      } else if (response.data.status === 'error') {
        toast.error(response.data.message);
        setAuthDialogOpen(false);
      }
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Ошибка авторизации');
      setAuthDialogOpen(false);
    } finally {
      setAuthLoading(false);
    }
  };

  const handleVerifyCode = async () => {
    if (!authCode.trim()) {
      toast.error('Введите код');
      return;
    }
    
    setAuthLoading(true);
    try {
      const response = await axios.post(`${API}/telegram/auth/verify-code`, {
        account_id: authAccount.id,
        code: authCode.trim()
      });
      
      if (response.data.status === 'authorized') {
        toast.success('Аккаунт успешно авторизован!');
        setAuthDialogOpen(false);
        fetchAccounts();
      } else if (response.data.status === '2fa_required') {
        setAuthStep('2fa_required');
        toast.info('Требуется двухфакторная аутентификация');
      } else if (response.data.status === 'error') {
        toast.error(response.data.message);
      }
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Неверный код');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleVerify2FA = async () => {
    if (!auth2FA.trim()) {
      toast.error('Введите пароль 2FA');
      return;
    }
    
    setAuthLoading(true);
    try {
      const response = await axios.post(`${API}/telegram/auth/verify-2fa`, {
        account_id: authAccount.id,
        password: auth2FA
      });
      
      if (response.data.status === 'authorized') {
        toast.success('Аккаунт успешно авторизован!');
        setAuthDialogOpen(false);
        fetchAccounts();
      } else if (response.data.status === 'error') {
        toast.error(response.data.message);
      }
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Неверный пароль');
    } finally {
      setAuthLoading(false);
    }
  };

  const activeCount = accounts.filter(a => a.status === 'active').length;
  const withProxyCount = accounts.filter(a => a.proxy?.enabled).length;

  return (
    <div data-testid="accounts-page" className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-heading text-3xl font-bold text-white">Telegram Аккаунты</h1>
          <p className="text-zinc-400 mt-1">Управление аккаунтами по ценовым категориям</p>
        </div>
        <div className="flex gap-2">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            accept=".json,.csv"
            className="hidden"
          />
          <Button
            variant="outline"
            data-testid="import-accounts-btn"
            onClick={() => fileInputRef.current?.click()}
            className="border-white/10 text-zinc-300 hover:bg-white/5"
          >
            <Upload className="w-4 h-4 mr-2" />
            Импорт
          </Button>
          <Dialog open={dialogOpen} onOpenChange={(open) => {
            setDialogOpen(open);
            if (!open) {
              setEditingAccount(null);
              setNewAccount(defaultAccount);
            }
          }}>
            <DialogTrigger asChild>
              <Button 
                data-testid="add-account-btn"
                className="bg-sky-500 hover:bg-sky-600 text-white"
              >
                <Plus className="w-4 h-4 mr-2" />
                Добавить
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-zinc-900 border-white/10 max-w-lg max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="text-white font-heading">
                  {editingAccount ? 'Редактировать аккаунт' : 'Добавить аккаунт'}
                </DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSaveAccount} className="space-y-4 mt-4">
                <Tabs defaultValue="main" className="w-full">
                  <TabsList className="grid w-full grid-cols-3 bg-zinc-800">
                    <TabsTrigger value="main">Основное</TabsTrigger>
                    <TabsTrigger value="proxy">Прокси</TabsTrigger>
                    <TabsTrigger value="limits">Лимиты</TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="main" className="space-y-4 mt-4">
                    <div className="space-y-2">
                      <Label className="text-zinc-300">Номер телефона *</Label>
                      <Input
                        data-testid="account-phone-input"
                        value={newAccount.phone}
                        onChange={(e) => setNewAccount({ ...newAccount, phone: e.target.value })}
                        placeholder="+7 999 123 4567"
                        className="bg-zinc-950 border-white/10 text-white"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-zinc-300">Название</Label>
                      <Input
                        data-testid="account-name-input"
                        value={newAccount.name}
                        onChange={(e) => setNewAccount({ ...newAccount, name: e.target.value })}
                        placeholder="Рабочий аккаунт #1"
                        className="bg-zinc-950 border-white/10 text-white"
                      />
                    </div>
                    
                    {/* Value USDT */}
                    <div className="space-y-2">
                      <Label className="text-zinc-300 flex items-center gap-2">
                        <Wallet className="w-4 h-4 text-emerald-400" />
                        Стоимость аккаунта (USDT)
                      </Label>
                      <Input
                        data-testid="account-value-input"
                        type="number"
                        step="0.01"
                        value={newAccount.value_usdt}
                        onChange={(e) => setNewAccount({ ...newAccount, value_usdt: e.target.value })}
                        placeholder="0"
                        className="bg-zinc-950 border-white/10 text-white"
                      />
                      <div className="flex gap-2 mt-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setNewAccount({ ...newAccount, value_usdt: 100 })}
                          className="border-zinc-500/20 text-zinc-400 hover:bg-zinc-500/10"
                        >
                          100
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setNewAccount({ ...newAccount, value_usdt: 300 })}
                          className="border-amber-500/20 text-amber-400 hover:bg-amber-500/10"
                        >
                          300
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setNewAccount({ ...newAccount, value_usdt: 500 })}
                          className="border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/10"
                        >
                          500
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setNewAccount({ ...newAccount, value_usdt: 1000 })}
                          className="border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/10"
                        >
                          1000+
                        </Button>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="text-zinc-300">API ID</Label>
                        <Input
                          data-testid="account-api-id-input"
                          value={newAccount.api_id}
                          onChange={(e) => setNewAccount({ ...newAccount, api_id: e.target.value })}
                          placeholder="12345678"
                          className="bg-zinc-950 border-white/10 text-white"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-zinc-300">API Hash</Label>
                        <Input
                          data-testid="account-api-hash-input"
                          value={newAccount.api_hash}
                          onChange={(e) => setNewAccount({ ...newAccount, api_hash: e.target.value })}
                          placeholder="abc123..."
                          className="bg-zinc-950 border-white/10 text-white"
                        />
                      </div>
                    </div>
                    <p className="text-xs text-zinc-500">
                      Получите API ID и Hash на <a href="https://my.telegram.org" target="_blank" rel="noopener noreferrer" className="text-sky-400 hover:underline">my.telegram.org</a>
                    </p>
                  </TabsContent>
                  
                  <TabsContent value="proxy" className="space-y-4 mt-4">
                    <div className="flex items-center justify-between">
                      <Label className="text-zinc-300">Использовать прокси</Label>
                      <Switch
                        data-testid="proxy-enabled-switch"
                        checked={newAccount.proxy.enabled}
                        onCheckedChange={(checked) => setNewAccount({
                          ...newAccount,
                          proxy: { ...newAccount.proxy, enabled: checked }
                        })}
                      />
                    </div>
                    
                    {newAccount.proxy.enabled && (
                      <>
                        <div className="space-y-2">
                          <Label className="text-zinc-300">Тип прокси</Label>
                          <Select 
                            value={newAccount.proxy.type} 
                            onValueChange={(value) => setNewAccount({
                              ...newAccount,
                              proxy: { ...newAccount.proxy, type: value }
                            })}
                          >
                            <SelectTrigger className="bg-zinc-950 border-white/10 text-white">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="bg-zinc-900 border-white/10">
                              <SelectItem value="socks5">SOCKS5</SelectItem>
                              <SelectItem value="socks4">SOCKS4</SelectItem>
                              <SelectItem value="http">HTTP</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label className="text-zinc-300">Хост</Label>
                            <Input
                              data-testid="proxy-host-input"
                              value={newAccount.proxy.host}
                              onChange={(e) => setNewAccount({
                                ...newAccount,
                                proxy: { ...newAccount.proxy, host: e.target.value }
                              })}
                              placeholder="proxy.example.com"
                              className="bg-zinc-950 border-white/10 text-white"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label className="text-zinc-300">Порт</Label>
                            <Input
                              data-testid="proxy-port-input"
                              type="number"
                              value={newAccount.proxy.port}
                              onChange={(e) => setNewAccount({
                                ...newAccount,
                                proxy: { ...newAccount.proxy, port: e.target.value }
                              })}
                              placeholder="1080"
                              className="bg-zinc-950 border-white/10 text-white"
                            />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label className="text-zinc-300">Логин</Label>
                            <Input
                              data-testid="proxy-username-input"
                              value={newAccount.proxy.username}
                              onChange={(e) => setNewAccount({
                                ...newAccount,
                                proxy: { ...newAccount.proxy, username: e.target.value }
                              })}
                              placeholder="username"
                              className="bg-zinc-950 border-white/10 text-white"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label className="text-zinc-300">Пароль</Label>
                            <Input
                              data-testid="proxy-password-input"
                              type="password"
                              value={newAccount.proxy.password}
                              onChange={(e) => setNewAccount({
                                ...newAccount,
                                proxy: { ...newAccount.proxy, password: e.target.value }
                              })}
                              placeholder="••••••••"
                              className="bg-zinc-950 border-white/10 text-white"
                            />
                          </div>
                        </div>
                      </>
                    )}
                  </TabsContent>
                  
                  <TabsContent value="limits" className="space-y-4 mt-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="text-zinc-300">Макс. в час</Label>
                        <Input
                          data-testid="limit-per-hour-input"
                          type="number"
                          value={newAccount.limits.max_per_hour}
                          onChange={(e) => setNewAccount({
                            ...newAccount,
                            limits: { ...newAccount.limits, max_per_hour: e.target.value }
                          })}
                          className="bg-zinc-950 border-white/10 text-white"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-zinc-300">Макс. в день</Label>
                        <Input
                          data-testid="limit-per-day-input"
                          type="number"
                          value={newAccount.limits.max_per_day}
                          onChange={(e) => setNewAccount({
                            ...newAccount,
                            limits: { ...newAccount.limits, max_per_day: e.target.value }
                          })}
                          className="bg-zinc-950 border-white/10 text-white"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="text-zinc-300">Задержка мин (сек)</Label>
                        <Input
                          data-testid="delay-min-input"
                          type="number"
                          value={newAccount.limits.delay_min}
                          onChange={(e) => setNewAccount({
                            ...newAccount,
                            limits: { ...newAccount.limits, delay_min: e.target.value }
                          })}
                          className="bg-zinc-950 border-white/10 text-white"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-zinc-300">Задержка макс (сек)</Label>
                        <Input
                          data-testid="delay-max-input"
                          type="number"
                          value={newAccount.limits.delay_max}
                          onChange={(e) => setNewAccount({
                            ...newAccount,
                            limits: { ...newAccount.limits, delay_max: e.target.value }
                          })}
                          className="bg-zinc-950 border-white/10 text-white"
                        />
                      </div>
                    </div>
                  </TabsContent>
                </Tabs>
                
                <Button 
                  type="submit" 
                  data-testid="save-account-btn"
                  className="w-full bg-sky-500 hover:bg-sky-600"
                >
                  {editingAccount ? 'Сохранить изменения' : 'Добавить аккаунт'}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Price Category Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="bg-zinc-800 border border-white/10 p-1">
          <TabsTrigger 
            value="all" 
            className="data-[state=active]:bg-sky-500/20 data-[state=active]:text-sky-400"
          >
            <Users className="w-4 h-4 mr-2" />
            Все ({stats.total})
          </TabsTrigger>
          <TabsTrigger 
            value="low" 
            className="data-[state=active]:bg-zinc-500/20 data-[state=active]:text-zinc-300"
          >
            <DollarSign className="w-4 h-4 mr-1" />
            до 300$ ({stats.low})
          </TabsTrigger>
          <TabsTrigger 
            value="medium" 
            className="data-[state=active]:bg-amber-500/20 data-[state=active]:text-amber-400"
          >
            <DollarSign className="w-4 h-4 mr-1" />
            300-500$ ({stats.medium})
          </TabsTrigger>
          <TabsTrigger 
            value="high" 
            className="data-[state=active]:bg-emerald-500/20 data-[state=active]:text-emerald-400"
          >
            <DollarSign className="w-4 h-4 mr-1" />
            500$+ ({stats.high})
          </TabsTrigger>
        </TabsList>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mt-4">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <Card className="bg-zinc-900/50 border-white/10">
              <CardContent className="p-4 flex items-center gap-4">
                <div className="w-10 h-10 rounded-lg bg-sky-500/20 flex items-center justify-center">
                  <Users className="w-5 h-5 text-sky-400" />
                </div>
                <div>
                  <p className="text-xs font-mono uppercase text-zinc-500">В категории</p>
                  <p className="text-2xl font-bold text-white font-mono">{accounts.length}</p>
                </div>
              </CardContent>
            </Card>
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            <Card className="bg-zinc-900/50 border-white/10">
              <CardContent className="p-4 flex items-center gap-4">
                <div className="w-10 h-10 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                  <CheckCircle className="w-5 h-5 text-emerald-400" />
                </div>
                <div>
                  <p className="text-xs font-mono uppercase text-zinc-500">Активных</p>
                  <p className="text-2xl font-bold text-white font-mono">{activeCount}</p>
                </div>
              </CardContent>
            </Card>
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
            <Card className="bg-zinc-900/50 border-white/10">
              <CardContent className="p-4 flex items-center gap-4">
                <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center">
                  <Shield className="w-5 h-5 text-purple-400" />
                </div>
                <div>
                  <p className="text-xs font-mono uppercase text-zinc-500">С прокси</p>
                  <p className="text-2xl font-bold text-white font-mono">{withProxyCount}</p>
                </div>
              </CardContent>
            </Card>
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
            <Card className="bg-zinc-900/50 border-white/10">
              <CardContent className="p-4 flex items-center gap-4">
                <div className="w-10 h-10 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                  <Wallet className="w-5 h-5 text-emerald-400" />
                </div>
                <div>
                  <p className="text-xs font-mono uppercase text-zinc-500">Общая стоимость</p>
                  <p className="text-2xl font-bold text-white font-mono">
                    ${accounts.reduce((sum, a) => sum + (a.value_usdt || 0), 0).toFixed(0)}
                  </p>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>

        {/* Table */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="mt-4">
          <Card className="bg-zinc-900/50 border-white/10">
            <CardContent className="p-0">
              {loading ? (
                <div className="p-8 text-center text-zinc-400">Загрузка...</div>
              ) : accounts.length === 0 ? (
                <div className="p-8 text-center">
                  <Users className="w-12 h-12 text-zinc-600 mx-auto mb-4" />
                  <p className="text-zinc-400">Нет аккаунтов в этой категории</p>
                  <p className="text-zinc-500 text-sm">Добавьте аккаунты или выберите другую категорию</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="border-white/10 hover:bg-transparent">
                      <TableHead className="text-zinc-400">Телефон</TableHead>
                      <TableHead className="text-zinc-400">Название</TableHead>
                      <TableHead className="text-zinc-400">Стоимость</TableHead>
                      <TableHead className="text-zinc-400">Прокси</TableHead>
                      <TableHead className="text-zinc-400">Статус</TableHead>
                      <TableHead className="text-zinc-400">Отправлено</TableHead>
                      <TableHead className="text-zinc-400 w-[50px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {accounts.map((account) => (
                      <TableRow 
                        key={account.id} 
                        className="border-white/10 table-row-hover"
                        data-testid={`account-row-${account.id}`}
                      >
                        <TableCell className="font-mono text-sky-400">
                          <div className="flex items-center gap-2">
                            <Phone className="w-4 h-4" />
                            {account.phone}
                          </div>
                        </TableCell>
                        <TableCell className="text-zinc-300">{account.name || '-'}</TableCell>
                        <TableCell>
                          <PriceBadge category={account.price_category} value={account.value_usdt} />
                        </TableCell>
                        <TableCell>
                          {account.proxy?.enabled ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-purple-500/10 text-purple-400 rounded text-xs">
                              <Shield className="w-3 h-3" />
                              {account.proxy.type.toUpperCase()}
                            </span>
                          ) : (
                            <span className="text-zinc-500 text-sm">Нет</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <StatusBadge status={account.status} />
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            <span className="font-mono text-zinc-300">{account.total_messages_sent || 0}</span>
                            <span className="text-zinc-500"> / </span>
                            <span className="font-mono text-emerald-400">{account.total_messages_delivered || 0}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button 
                                variant="ghost" 
                                size="icon"
                                data-testid={`account-menu-${account.id}`}
                                className="text-zinc-400 hover:text-white"
                              >
                                <MoreVertical className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="bg-zinc-900 border-white/10">
                              {account.status !== 'active' && (
                                <DropdownMenuItem 
                                  onClick={() => handleStartAuth(account)}
                                  className="text-sky-400 focus:text-sky-400"
                                >
                                  <Key className="w-4 h-4 mr-2" />
                                  Авторизовать в Telegram
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuItem 
                                onClick={() => handleEditAccount(account)}
                                className="text-zinc-300"
                              >
                                <Edit className="w-4 h-4 mr-2" />
                                Редактировать
                              </DropdownMenuItem>
                              {account.status !== 'active' && (
                                <DropdownMenuItem 
                                  onClick={() => handleStatusChange(account.id, 'active')}
                                  className="text-emerald-400 focus:text-emerald-400"
                                >
                                  <CheckCircle className="w-4 h-4 mr-2" />
                                  Активировать
                                </DropdownMenuItem>
                              )}
                              {account.status !== 'banned' && (
                                <DropdownMenuItem 
                                  onClick={() => handleStatusChange(account.id, 'banned')}
                                  className="text-red-400 focus:text-red-400"
                                >
                                  <XCircle className="w-4 h-4 mr-2" />
                                  Заблокировать
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuItem 
                                onClick={() => handleDelete(account.id)}
                                className="text-red-400 focus:text-red-400"
                              >
                                <Trash2 className="w-4 h-4 mr-2" />
                                Удалить
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </Tabs>
    </div>
  );
}
