import { useState, useEffect } from 'react';
import axios from 'axios';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Switch } from '../components/ui/switch';
import { Checkbox } from '../components/ui/checkbox';
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
import { toast } from 'sonner';
import { 
  Plus, 
  Send, 
  Play,
  Trash2,
  CheckCircle,
  MessageSquare,
  Users,
  Phone,
  FileText,
  Sparkles,
  DollarSign,
  Wallet
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

const CategoryBadge = ({ categories }) => {
  if (!categories || categories.length === 0) return null;
  
  const labels = {
    low: { text: 'до 300$', color: 'bg-zinc-500/10 text-zinc-400' },
    medium: { text: '300-500$', color: 'bg-amber-500/10 text-amber-400' },
    high: { text: '500$+', color: 'bg-emerald-500/10 text-emerald-400' },
  };
  
  return (
    <div className="flex gap-1">
      {categories.map(cat => (
        <span key={cat} className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs ${labels[cat]?.color || ''}`}>
          <DollarSign className="w-3 h-3" />
          {labels[cat]?.text || cat}
        </span>
      ))}
    </div>
  );
};

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [accountStats, setAccountStats] = useState({ total: 0, low: 0, medium: 0, high: 0 });
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectionMode, setSelectionMode] = useState('categories'); // 'categories' or 'individual'
  const [newCampaign, setNewCampaign] = useState({
    name: '',
    message_template: '',
    account_ids: [],
    account_categories: [],
    tag_filter: '',
    use_rotation: true,
    respect_limits: true
  });
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [startingCampaign, setStartingCampaign] = useState(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [campaignsRes, accountsRes, templatesRes, statsRes] = await Promise.all([
        axios.get(`${API}/campaigns`),
        axios.get(`${API}/accounts`),
        axios.get(`${API}/templates`),
        axios.get(`${API}/accounts/stats`)
      ]);
      setCampaigns(campaignsRes.data);
      setAccounts(accountsRes.data.filter(a => a.status === 'active'));
      setTemplates(templatesRes.data);
      setAccountStats(statsRes.data);
    } catch (error) {
      toast.error('Ошибка загрузки данных');
    } finally {
      setLoading(false);
    }
  };

  const handleTemplateSelect = (templateId) => {
    setSelectedTemplateId(templateId);
    if (templateId && templateId !== 'custom') {
      const template = templates.find(t => t.id === templateId);
      if (template) {
        setNewCampaign(prev => ({
          ...prev,
          message_template: template.content
        }));
      }
    }
  };

  const handleCreateCampaign = async (e) => {
    e.preventDefault();
    
    if (selectionMode === 'categories' && newCampaign.account_categories.length === 0) {
      toast.error('Выберите хотя бы одну категорию аккаунтов');
      return;
    }
    if (selectionMode === 'individual' && newCampaign.account_ids.length === 0) {
      toast.error('Выберите хотя бы один аккаунт');
      return;
    }
    if (!newCampaign.message_template.trim()) {
      toast.error('Введите текст сообщения');
      return;
    }
    
    try {
      const payload = {
        ...newCampaign,
        account_ids: selectionMode === 'individual' ? newCampaign.account_ids : [],
        account_categories: selectionMode === 'categories' ? newCampaign.account_categories : []
      };
      
      await axios.post(`${API}/campaigns`, payload);
      toast.success('Рассылка создана');
      setDialogOpen(false);
      setNewCampaign({
        name: '',
        message_template: '',
        account_ids: [],
        account_categories: [],
        tag_filter: '',
        use_rotation: true,
        respect_limits: true
      });
      setSelectedTemplateId('');
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Ошибка создания');
    }
  };

  const handleStartCampaign = async (campaignId) => {
    setStartingCampaign(campaignId);
    try {
      const response = await axios.put(`${API}/campaigns/${campaignId}/start`);
      const { delivered, responses, by_category } = response.data;
      
      let categoryInfo = '';
      if (by_category && Object.keys(by_category).length > 0) {
        categoryInfo = ` (${Object.entries(by_category).map(([k, v]) => `${k}: ${v}`).join(', ')})`;
      }
      
      toast.success(`Рассылка завершена: ${delivered} доставлено, ${responses} ответов${categoryInfo}`);
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Ошибка запуска');
    } finally {
      setStartingCampaign(null);
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

  const toggleCategory = (category) => {
    setNewCampaign(prev => ({
      ...prev,
      account_categories: prev.account_categories.includes(category)
        ? prev.account_categories.filter(c => c !== category)
        : [...prev.account_categories, category]
    }));
  };

  const toggleAccountSelection = (accountId) => {
    setNewCampaign(prev => ({
      ...prev,
      account_ids: prev.account_ids.includes(accountId)
        ? prev.account_ids.filter(id => id !== accountId)
        : [...prev.account_ids, accountId]
    }));
  };

  const selectAllCategories = () => {
    setNewCampaign(prev => ({
      ...prev,
      account_categories: ['low', 'medium', 'high']
    }));
  };

  const runningCount = campaigns.filter(c => c.status === 'running').length;
  const completedCount = campaigns.filter(c => c.status === 'completed').length;
  const totalSent = campaigns.reduce((acc, c) => acc + c.messages_sent, 0);
  const totalResponses = campaigns.reduce((acc, c) => acc + c.responses_count, 0);

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
          <DialogContent className="bg-zinc-900 border-white/10 max-w-lg max-h-[90vh] overflow-y-auto">
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
              
              {/* Template Selection */}
              <div className="space-y-2">
                <Label className="text-zinc-300 flex items-center gap-2">
                  <FileText className="w-4 h-4 text-purple-400" />
                  Выбрать шаблон
                </Label>
                <Select value={selectedTemplateId} onValueChange={handleTemplateSelect}>
                  <SelectTrigger className="bg-zinc-950 border-white/10 text-white">
                    <SelectValue placeholder="Выберите шаблон или напишите свой" />
                  </SelectTrigger>
                  <SelectContent className="bg-zinc-900 border-white/10">
                    <SelectItem value="custom">✏️ Свой текст</SelectItem>
                    {templates.map(t => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label className="text-zinc-300">Текст сообщения</Label>
                <Textarea
                  data-testid="campaign-message-input"
                  value={newCampaign.message_template}
                  onChange={(e) => setNewCampaign({ ...newCampaign, message_template: e.target.value })}
                  placeholder="{time}, {name}!

{Хочу предложить|Предлагаю} вам..."
                  className="bg-zinc-950 border-white/10 text-white min-h-[100px] font-mono text-sm"
                  required
                />
              </div>
              
              <div className="space-y-2">
                <Label className="text-zinc-300">Фильтр по тегу контактов</Label>
                <Input
                  value={newCampaign.tag_filter}
                  onChange={(e) => setNewCampaign({ ...newCampaign, tag_filter: e.target.value })}
                  placeholder="VIP, Клиент (оставьте пустым для всех)"
                  className="bg-zinc-950 border-white/10 text-white"
                />
              </div>
              
              {/* Account Selection Mode */}
              <div className="space-y-3 p-4 bg-zinc-950 rounded-lg border border-white/10">
                <Label className="text-zinc-300 flex items-center gap-2">
                  <Wallet className="w-4 h-4 text-emerald-400" />
                  Выбор аккаунтов для рассылки
                </Label>
                
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant={selectionMode === 'categories' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setSelectionMode('categories')}
                    className={selectionMode === 'categories' ? 'bg-sky-500' : 'border-white/10'}
                  >
                    <DollarSign className="w-4 h-4 mr-1" />
                    По категориям
                  </Button>
                  <Button
                    type="button"
                    variant={selectionMode === 'individual' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setSelectionMode('individual')}
                    className={selectionMode === 'individual' ? 'bg-sky-500' : 'border-white/10'}
                  >
                    <Users className="w-4 h-4 mr-1" />
                    Выбрать вручную
                  </Button>
                </div>
                
                {selectionMode === 'categories' ? (
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-zinc-500">Выберите ценовые категории</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={selectAllCategories}
                        className="text-sky-400 hover:text-sky-300"
                      >
                        Выбрать все
                      </Button>
                    </div>
                    
                    <div className="grid grid-cols-3 gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => toggleCategory('low')}
                        className={`flex flex-col items-center p-3 h-auto ${
                          newCampaign.account_categories.includes('low')
                            ? 'bg-zinc-500/20 border-zinc-400'
                            : 'border-white/10'
                        }`}
                      >
                        <DollarSign className="w-5 h-5 text-zinc-400 mb-1" />
                        <span className="text-sm">до 300$</span>
                        <span className="text-xs text-zinc-500">{accountStats.low} акк.</span>
                      </Button>
                      
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => toggleCategory('medium')}
                        className={`flex flex-col items-center p-3 h-auto ${
                          newCampaign.account_categories.includes('medium')
                            ? 'bg-amber-500/20 border-amber-400'
                            : 'border-white/10'
                        }`}
                      >
                        <DollarSign className="w-5 h-5 text-amber-400 mb-1" />
                        <span className="text-sm">300-500$</span>
                        <span className="text-xs text-zinc-500">{accountStats.medium} акк.</span>
                      </Button>
                      
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => toggleCategory('high')}
                        className={`flex flex-col items-center p-3 h-auto ${
                          newCampaign.account_categories.includes('high')
                            ? 'bg-emerald-500/20 border-emerald-400'
                            : 'border-white/10'
                        }`}
                      >
                        <DollarSign className="w-5 h-5 text-emerald-400 mb-1" />
                        <span className="text-sm">500$+</span>
                        <span className="text-xs text-zinc-500">{accountStats.high} акк.</span>
                      </Button>
                    </div>
                    
                    <p className="text-xs text-zinc-500">
                      Выбрано категорий: {newCampaign.account_categories.length}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="max-h-32 overflow-y-auto space-y-2 p-2 bg-zinc-900 rounded-lg border border-white/5">
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
                            <label htmlFor={account.id} className="text-sm text-zinc-300 cursor-pointer flex-1 flex items-center gap-2">
                              {account.name || account.phone}
                              <span className={`text-xs px-1 rounded ${
                                account.price_category === 'high' ? 'bg-emerald-500/10 text-emerald-400' :
                                account.price_category === 'medium' ? 'bg-amber-500/10 text-amber-400' :
                                'bg-zinc-500/10 text-zinc-400'
                              }`}>
                                ${account.value_usdt || 0}
                              </span>
                            </label>
                          </div>
                        ))
                      )}
                    </div>
                    <p className="text-xs text-zinc-500">
                      Выбрано: {newCampaign.account_ids.length} из {accounts.length}
                    </p>
                  </div>
                )}
              </div>
              
              {/* Options */}
              <div className="space-y-3 p-3 bg-zinc-950 rounded-lg border border-white/10">
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-zinc-300">Ротация аккаунтов</Label>
                    <p className="text-xs text-zinc-500">Равномерное распределение</p>
                  </div>
                  <Switch
                    checked={newCampaign.use_rotation}
                    onCheckedChange={(checked) => setNewCampaign({ ...newCampaign, use_rotation: checked })}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-zinc-300">Учитывать лимиты</Label>
                    <p className="text-xs text-zinc-500">Не превышать лимиты</p>
                  </div>
                  <Switch
                    checked={newCampaign.respect_limits}
                    onCheckedChange={(checked) => setNewCampaign({ ...newCampaign, respect_limits: checked })}
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
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
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
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
          <Card className="bg-zinc-900/50 border-white/10">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="w-10 h-10 rounded-lg bg-amber-500/20 flex items-center justify-center">
                <Users className="w-5 h-5 text-amber-400" />
              </div>
              <div>
                <p className="text-xs font-mono uppercase text-zinc-500">Ответов</p>
                <p className="text-2xl font-bold text-white font-mono">{totalResponses}</p>
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
              <p className="text-zinc-500 text-sm">Создайте первую рассылку</p>
            </CardContent>
          </Card>
        ) : (
          campaigns.map((campaign) => (
            <Card 
              key={campaign.id} 
              className="bg-zinc-900/50 border-white/10 hover:border-white/20 transition-colors"
            >
              <CardContent className="p-6">
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2 flex-wrap">
                      <h3 className="font-heading text-lg font-semibold text-white">{campaign.name}</h3>
                      <StatusBadge status={campaign.status} />
                      {campaign.use_rotation && (
                        <span className="px-2 py-0.5 bg-purple-500/10 text-purple-400 text-xs rounded">
                          Ротация
                        </span>
                      )}
                      <CategoryBadge categories={campaign.account_categories} />
                    </div>
                    <p className="text-zinc-400 text-sm line-clamp-2 mb-4 font-mono">{campaign.message_template}</p>
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
                      <div className="flex items-center gap-2 text-amber-400">
                        <Users className="w-4 h-4" />
                        <span>{campaign.responses_count} ответов</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {campaign.status === 'draft' && (
                      <Button
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
                    <Button
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
