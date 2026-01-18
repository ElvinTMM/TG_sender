import { useState, useEffect } from 'react';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import { Checkbox } from '../components/ui/checkbox';
import { toast } from 'sonner';
import { 
  Plus, 
  Send, 
  Play,
  Pause,
  Trash2,
  CheckCircle,
  XCircle,
  Clock,
  MessageSquare,
  Users,
  Phone
} from 'lucide-react';
import { motion } from 'framer-motion';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const StatusBadge = ({ status }) => {
  const styles = {
    draft: 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20',
    running: 'bg-sky-500/10 text-sky-400 border-sky-500/20',
    paused: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
    completed: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  };
  
  const labels = {
    draft: 'Черновик',
    running: 'Активна',
    paused: 'Пауза',
    completed: 'Завершена',
  };
  
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-mono border ${styles[status] || styles.draft}`}>
      {labels[status] || status}
    </span>
  );
};

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newCampaign, setNewCampaign] = useState({
    name: '',
    message_template: '',
    account_ids: [],
    tag_filter: '',
    delay_min: 30,
    delay_max: 60
  });
  const [startingCampaign, setStartingCampaign] = useState(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [campaignsRes, accountsRes] = await Promise.all([
        axios.get(`${API}/campaigns`),
        axios.get(`${API}/accounts`)
      ]);
      setCampaigns(campaignsRes.data);
      setAccounts(accountsRes.data.filter(a => a.status === 'active'));
    } catch (error) {
      toast.error('Ошибка загрузки данных');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateCampaign = async (e) => {
    e.preventDefault();
    if (newCampaign.account_ids.length === 0) {
      toast.error('Выберите хотя бы один аккаунт');
      return;
    }
    
    try {
      await axios.post(`${API}/campaigns`, newCampaign);
      toast.success('Рассылка создана');
      setDialogOpen(false);
      setNewCampaign({
        name: '',
        message_template: '',
        account_ids: [],
        tag_filter: '',
        delay_min: 30,
        delay_max: 60
      });
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Ошибка создания');
    }
  };

  const handleStartCampaign = async (campaignId) => {
    setStartingCampaign(campaignId);
    try {
      const response = await axios.put(`${API}/campaigns/${campaignId}/start`);
      toast.success(`Рассылка завершена: ${response.data.delivered} доставлено`);
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Ошибка запуска');
    } finally {
      setStartingCampaign(null);
    }
  };

  const handlePauseCampaign = async (campaignId) => {
    try {
      await axios.put(`${API}/campaigns/${campaignId}/pause`);
      toast.success('Рассылка приостановлена');
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Ошибка');
    }
  };

  const handleDeleteCampaign = async (campaignId) => {
    if (!window.confirm('Удалить рассылку?')) return;
    
    try {
      await axios.delete(`${API}/campaigns/${campaignId}`);
      toast.success('Рассылка удалена');
      fetchData();
    } catch (error) {
      toast.error('Ошибка удаления');
    }
  };

  const toggleAccountSelection = (accountId) => {
    setNewCampaign(prev => ({
      ...prev,
      account_ids: prev.account_ids.includes(accountId)
        ? prev.account_ids.filter(id => id !== accountId)
        : [...prev.account_ids, accountId]
    }));
  };

  const runningCount = campaigns.filter(c => c.status === 'running').length;
  const completedCount = campaigns.filter(c => c.status === 'completed').length;
  const totalSent = campaigns.reduce((acc, c) => acc + c.messages_sent, 0);

  return (
    <div data-testid="campaigns-page" className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-heading text-3xl font-bold text-white">Рассылки</h1>
          <p className="text-zinc-400 mt-1">Создание и управление кампаниями</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button 
              data-testid="create-campaign-btn"
              className="bg-sky-500 hover:bg-sky-600 text-white"
            >
              <Plus className="w-4 h-4 mr-2" />
              Создать рассылку
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-zinc-900 border-white/10 max-w-lg">
            <DialogHeader>
              <DialogTitle className="text-white font-heading">Новая рассылка</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCreateCampaign} className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label className="text-zinc-300">Название кампании</Label>
                <Input
                  data-testid="campaign-name-input"
                  value={newCampaign.name}
                  onChange={(e) => setNewCampaign({ ...newCampaign, name: e.target.value })}
                  placeholder="Новогодняя акция"
                  className="bg-zinc-950 border-white/10 text-white"
                  required
                />
              </div>
              
              <div className="space-y-2">
                <Label className="text-zinc-300">Текст сообщения</Label>
                <Textarea
                  data-testid="campaign-message-input"
                  value={newCampaign.message_template}
                  onChange={(e) => setNewCampaign({ ...newCampaign, message_template: e.target.value })}
                  placeholder="Привет! У нас отличное предложение..."
                  className="bg-zinc-950 border-white/10 text-white min-h-[100px]"
                  required
                />
              </div>
              
              <div className="space-y-2">
                <Label className="text-zinc-300">Фильтр по тегу (опционально)</Label>
                <Input
                  data-testid="campaign-tag-input"
                  value={newCampaign.tag_filter}
                  onChange={(e) => setNewCampaign({ ...newCampaign, tag_filter: e.target.value })}
                  placeholder="VIP, Клиент"
                  className="bg-zinc-950 border-white/10 text-white"
                />
              </div>
              
              <div className="space-y-2">
                <Label className="text-zinc-300">Выберите аккаунты для рассылки</Label>
                <div className="max-h-32 overflow-y-auto space-y-2 p-2 bg-zinc-950 rounded-lg border border-white/10">
                  {accounts.length === 0 ? (
                    <p className="text-zinc-500 text-sm">Нет активных аккаунтов</p>
                  ) : (
                    accounts.map((account) => (
                      <div key={account.id} className="flex items-center gap-2">
                        <Checkbox
                          id={account.id}
                          checked={newCampaign.account_ids.includes(account.id)}
                          onCheckedChange={() => toggleAccountSelection(account.id)}
                        />
                        <label htmlFor={account.id} className="text-sm text-zinc-300 cursor-pointer">
                          {account.name || account.phone}
                        </label>
                      </div>
                    ))
                  )}
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-zinc-300">Задержка мин (сек)</Label>
                  <Input
                    type="number"
                    data-testid="campaign-delay-min-input"
                    value={newCampaign.delay_min}
                    onChange={(e) => setNewCampaign({ ...newCampaign, delay_min: parseInt(e.target.value) })}
                    className="bg-zinc-950 border-white/10 text-white"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-zinc-300">Задержка макс (сек)</Label>
                  <Input
                    type="number"
                    data-testid="campaign-delay-max-input"
                    value={newCampaign.delay_max}
                    onChange={(e) => setNewCampaign({ ...newCampaign, delay_max: parseInt(e.target.value) })}
                    className="bg-zinc-950 border-white/10 text-white"
                  />
                </div>
              </div>
              
              <Button 
                type="submit" 
                data-testid="save-campaign-btn"
                className="w-full bg-sky-500 hover:bg-sky-600"
              >
                Создать рассылку
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <Card className="bg-zinc-900/50 border-white/10">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="w-10 h-10 rounded-lg bg-sky-500/20 flex items-center justify-center">
                <Send className="w-5 h-5 text-sky-400" />
              </div>
              <div>
                <p className="text-xs font-mono uppercase text-zinc-500">Всего</p>
                <p className="text-2xl font-bold text-white font-mono">{campaigns.length}</p>
              </div>
            </CardContent>
          </Card>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <Card className="bg-zinc-900/50 border-white/10">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="w-10 h-10 rounded-lg bg-sky-500/20 flex items-center justify-center">
                <Play className="w-5 h-5 text-sky-400" />
              </div>
              <div>
                <p className="text-xs font-mono uppercase text-zinc-500">Активных</p>
                <p className="text-2xl font-bold text-white font-mono">{runningCount}</p>
              </div>
            </CardContent>
          </Card>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <Card className="bg-zinc-900/50 border-white/10">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="w-10 h-10 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                <CheckCircle className="w-5 h-5 text-emerald-400" />
              </div>
              <div>
                <p className="text-xs font-mono uppercase text-zinc-500">Завершено</p>
                <p className="text-2xl font-bold text-white font-mono">{completedCount}</p>
              </div>
            </CardContent>
          </Card>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
          <Card className="bg-zinc-900/50 border-white/10">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center">
                <MessageSquare className="w-5 h-5 text-purple-400" />
              </div>
              <div>
                <p className="text-xs font-mono uppercase text-zinc-500">Отправлено</p>
                <p className="text-2xl font-bold text-white font-mono">{totalSent}</p>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Campaigns List */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }} 
        animate={{ opacity: 1, y: 0 }} 
        transition={{ delay: 0.4 }}
        className="space-y-4"
      >
        {loading ? (
          <div className="p-8 text-center text-zinc-400">Загрузка...</div>
        ) : campaigns.length === 0 ? (
          <Card className="bg-zinc-900/50 border-white/10">
            <CardContent className="p-8 text-center">
              <Send className="w-12 h-12 text-zinc-600 mx-auto mb-4" />
              <p className="text-zinc-400">Нет рассылок</p>
              <p className="text-zinc-500 text-sm">Создайте первую рассылку для начала работы</p>
            </CardContent>
          </Card>
        ) : (
          campaigns.map((campaign) => (
            <Card 
              key={campaign.id} 
              className="bg-zinc-900/50 border-white/10 hover:border-white/20 transition-colors"
              data-testid={`campaign-card-${campaign.id}`}
            >
              <CardContent className="p-6">
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="font-heading text-lg font-semibold text-white">{campaign.name}</h3>
                      <StatusBadge status={campaign.status} />
                    </div>
                    <p className="text-zinc-400 text-sm line-clamp-2 mb-4">{campaign.message_template}</p>
                    <div className="flex flex-wrap gap-4 text-sm">
                      <div className="flex items-center gap-2 text-zinc-400">
                        <Phone className="w-4 h-4" />
                        <span>{campaign.total_contacts} контактов</span>
                      </div>
                      <div className="flex items-center gap-2 text-sky-400">
                        <MessageSquare className="w-4 h-4" />
                        <span>{campaign.messages_sent} отправлено</span>
                      </div>
                      <div className="flex items-center gap-2 text-emerald-400">
                        <CheckCircle className="w-4 h-4" />
                        <span>{campaign.messages_delivered} доставлено</span>
                      </div>
                      <div className="flex items-center gap-2 text-purple-400">
                        <Users className="w-4 h-4" />
                        <span>{campaign.responses_count} ответов</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {campaign.status === 'draft' && (
                      <Button
                        data-testid={`start-campaign-${campaign.id}`}
                        onClick={() => handleStartCampaign(campaign.id)}
                        disabled={startingCampaign === campaign.id}
                        className="bg-emerald-500 hover:bg-emerald-600 text-white"
                      >
                        {startingCampaign === campaign.id ? (
                          <span className="animate-pulse">Запуск...</span>
                        ) : (
                          <>
                            <Play className="w-4 h-4 mr-2" />
                            Запустить
                          </>
                        )}
                      </Button>
                    )}
                    {campaign.status === 'running' && (
                      <Button
                        data-testid={`pause-campaign-${campaign.id}`}
                        onClick={() => handlePauseCampaign(campaign.id)}
                        variant="outline"
                        className="border-yellow-500/20 text-yellow-400 hover:bg-yellow-500/10"
                      >
                        <Pause className="w-4 h-4 mr-2" />
                        Пауза
                      </Button>
                    )}
                    <Button
                      data-testid={`delete-campaign-${campaign.id}`}
                      onClick={() => handleDeleteCampaign(campaign.id)}
                      variant="outline"
                      className="border-red-500/20 text-red-400 hover:bg-red-500/10"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </motion.div>
    </div>
  );
}
