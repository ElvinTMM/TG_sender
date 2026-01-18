import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
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
  Phone
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

export default function AccountsPage() {
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newAccount, setNewAccount] = useState({ phone: '', name: '' });
  const fileInputRef = useRef(null);

  useEffect(() => {
    fetchAccounts();
  }, []);

  const fetchAccounts = async () => {
    try {
      const response = await axios.get(`${API}/accounts`);
      setAccounts(response.data);
    } catch (error) {
      toast.error('Ошибка загрузки аккаунтов');
    } finally {
      setLoading(false);
    }
  };

  const handleAddAccount = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API}/accounts`, newAccount);
      toast.success('Аккаунт добавлен');
      setDialogOpen(false);
      setNewAccount({ phone: '', name: '' });
      fetchAccounts();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Ошибка добавления');
    }
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
    } catch (error) {
      toast.error('Ошибка удаления');
    }
  };

  const activeCount = accounts.filter(a => a.status === 'active').length;
  const bannedCount = accounts.filter(a => a.status === 'banned').length;

  return (
    <div data-testid="accounts-page" className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-heading text-3xl font-bold text-white">Telegram Аккаунты</h1>
          <p className="text-zinc-400 mt-1">Управление аккаунтами для рассылки</p>
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
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button 
                data-testid="add-account-btn"
                className="bg-sky-500 hover:bg-sky-600 text-white"
              >
                <Plus className="w-4 h-4 mr-2" />
                Добавить
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-zinc-900 border-white/10">
              <DialogHeader>
                <DialogTitle className="text-white font-heading">Добавить аккаунт</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleAddAccount} className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label className="text-zinc-300">Номер телефона</Label>
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
                  <Label className="text-zinc-300">Название (опционально)</Label>
                  <Input
                    data-testid="account-name-input"
                    value={newAccount.name}
                    onChange={(e) => setNewAccount({ ...newAccount, name: e.target.value })}
                    placeholder="Рабочий аккаунт"
                    className="bg-zinc-950 border-white/10 text-white"
                  />
                </div>
                <Button 
                  type="submit" 
                  data-testid="save-account-btn"
                  className="w-full bg-sky-500 hover:bg-sky-600"
                >
                  Добавить
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <Card className="bg-zinc-900/50 border-white/10">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="w-10 h-10 rounded-lg bg-sky-500/20 flex items-center justify-center">
                <Users className="w-5 h-5 text-sky-400" />
              </div>
              <div>
                <p className="text-xs font-mono uppercase text-zinc-500">Всего</p>
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
              <div className="w-10 h-10 rounded-lg bg-red-500/20 flex items-center justify-center">
                <XCircle className="w-5 h-5 text-red-400" />
              </div>
              <div>
                <p className="text-xs font-mono uppercase text-zinc-500">Заблокировано</p>
                <p className="text-2xl font-bold text-white font-mono">{bannedCount}</p>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Table */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
        <Card className="bg-zinc-900/50 border-white/10">
          <CardContent className="p-0">
            {loading ? (
              <div className="p-8 text-center text-zinc-400">Загрузка...</div>
            ) : accounts.length === 0 ? (
              <div className="p-8 text-center">
                <Users className="w-12 h-12 text-zinc-600 mx-auto mb-4" />
                <p className="text-zinc-400">Нет аккаунтов</p>
                <p className="text-zinc-500 text-sm">Добавьте аккаунты вручную или импортируйте из файла</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="border-white/10 hover:bg-transparent">
                    <TableHead className="text-zinc-400">Телефон</TableHead>
                    <TableHead className="text-zinc-400">Название</TableHead>
                    <TableHead className="text-zinc-400">Статус</TableHead>
                    <TableHead className="text-zinc-400">Отправлено</TableHead>
                    <TableHead className="text-zinc-400">Доставлено</TableHead>
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
                        <StatusBadge status={account.status} />
                      </TableCell>
                      <TableCell className="font-mono text-zinc-300">{account.messages_sent}</TableCell>
                      <TableCell className="font-mono text-emerald-400">{account.messages_delivered}</TableCell>
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
    </div>
  );
}
