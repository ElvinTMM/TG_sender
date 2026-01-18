import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { Card, CardContent } from '../components/ui/card';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import { toast } from 'sonner';
import { 
  Plus, 
  Upload, 
  Phone, 
  Trash2,
  Search,
  Filter,
  CheckCircle,
  MessageSquare,
  Clock
} from 'lucide-react';
import { motion } from 'framer-motion';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const StatusBadge = ({ status }) => {
  const styles = {
    pending: 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20',
    messaged: 'bg-sky-500/10 text-sky-400 border-sky-500/20',
    responded: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    blocked: 'bg-red-500/10 text-red-400 border-red-500/20',
  };
  
  const labels = {
    pending: 'Ожидание',
    messaged: 'Отправлено',
    responded: 'Ответил',
    blocked: 'Заблокирован',
  };
  
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-mono border ${styles[status] || styles.pending}`}>
      {labels[status] || status}
    </span>
  );
};

export default function ContactsPage() {
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [newContact, setNewContact] = useState({ phone: '', name: '', tags: '' });
  const [importTag, setImportTag] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const fileInputRef = useRef(null);

  useEffect(() => {
    fetchContacts();
  }, [statusFilter]);

  const fetchContacts = async () => {
    try {
      let url = `${API}/contacts`;
      if (statusFilter !== 'all') {
        url += `?status=${statusFilter}`;
      }
      const response = await axios.get(url);
      setContacts(response.data);
    } catch (error) {
      toast.error('Ошибка загрузки контактов');
    } finally {
      setLoading(false);
    }
  };

  const handleAddContact = async (e) => {
    e.preventDefault();
    try {
      const tags = newContact.tags ? newContact.tags.split(',').map(t => t.trim()) : [];
      await axios.post(`${API}/contacts`, { ...newContact, tags });
      toast.success('Контакт добавлен');
      setDialogOpen(false);
      setNewContact({ phone: '', name: '', tags: '' });
      fetchContacts();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Ошибка добавления');
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);
    if (importTag) {
      formData.append('tag', importTag);
    }

    try {
      const response = await axios.post(`${API}/contacts/import`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      toast.success(`Импортировано ${response.data.imported} контактов`);
      setImportDialogOpen(false);
      setImportTag('');
      fetchContacts();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Ошибка импорта');
    }
    
    e.target.value = '';
  };

  const handleDelete = async (contactId) => {
    if (!window.confirm('Удалить контакт?')) return;
    
    try {
      await axios.delete(`${API}/contacts/${contactId}`);
      toast.success('Контакт удален');
      fetchContacts();
    } catch (error) {
      toast.error('Ошибка удаления');
    }
  };

  const handleDeleteAll = async () => {
    if (!window.confirm('Удалить все контакты? Это действие необратимо.')) return;
    
    try {
      await axios.delete(`${API}/contacts`);
      toast.success('Все контакты удалены');
      fetchContacts();
    } catch (error) {
      toast.error('Ошибка удаления');
    }
  };

  const filteredContacts = contacts.filter(c => 
    c.phone.includes(search) || c.name?.toLowerCase().includes(search.toLowerCase())
  );

  const pendingCount = contacts.filter(c => c.status === 'pending').length;
  const messagedCount = contacts.filter(c => c.status === 'messaged').length;
  const respondedCount = contacts.filter(c => c.status === 'responded').length;

  return (
    <div data-testid="contacts-page" className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-heading text-3xl font-bold text-white">База контактов</h1>
          <p className="text-zinc-400 mt-1">Управление номерами телефонов для рассылки</p>
        </div>
        <div className="flex gap-2">
          <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
            <DialogTrigger asChild>
              <Button
                variant="outline"
                data-testid="import-contacts-btn"
                className="border-white/10 text-zinc-300 hover:bg-white/5"
              >
                <Upload className="w-4 h-4 mr-2" />
                Импорт
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-zinc-900 border-white/10">
              <DialogHeader>
                <DialogTitle className="text-white font-heading">Импорт контактов</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label className="text-zinc-300">Тег для импортируемых контактов (опционально)</Label>
                  <Input
                    data-testid="import-tag-input"
                    value={importTag}
                    onChange={(e) => setImportTag(e.target.value)}
                    placeholder="Например: Холодная база"
                    className="bg-zinc-950 border-white/10 text-white"
                  />
                </div>
                <div className="p-4 bg-zinc-950 rounded-lg border border-dashed border-white/20 text-center">
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileUpload}
                    accept=".json,.csv,.xlsx,.xls"
                    className="hidden"
                  />
                  <Upload className="w-8 h-8 text-zinc-500 mx-auto mb-2" />
                  <p className="text-zinc-400 mb-2">Поддерживаемые форматы: JSON, CSV, Excel</p>
                  <Button
                    onClick={() => fileInputRef.current?.click()}
                    data-testid="select-file-btn"
                    className="bg-sky-500 hover:bg-sky-600"
                  >
                    Выбрать файл
                  </Button>
                </div>
                <p className="text-xs text-zinc-500">
                  Файл должен содержать колонку "phone" или "Phone" с номерами телефонов
                </p>
              </div>
            </DialogContent>
          </Dialog>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button 
                data-testid="add-contact-btn"
                className="bg-sky-500 hover:bg-sky-600 text-white"
              >
                <Plus className="w-4 h-4 mr-2" />
                Добавить
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-zinc-900 border-white/10">
              <DialogHeader>
                <DialogTitle className="text-white font-heading">Добавить контакт</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleAddContact} className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label className="text-zinc-300">Номер телефона</Label>
                  <Input
                    data-testid="contact-phone-input"
                    value={newContact.phone}
                    onChange={(e) => setNewContact({ ...newContact, phone: e.target.value })}
                    placeholder="+7 999 123 4567"
                    className="bg-zinc-950 border-white/10 text-white"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-zinc-300">Имя (опционально)</Label>
                  <Input
                    data-testid="contact-name-input"
                    value={newContact.name}
                    onChange={(e) => setNewContact({ ...newContact, name: e.target.value })}
                    placeholder="Иван Иванов"
                    className="bg-zinc-950 border-white/10 text-white"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-zinc-300">Теги (через запятую)</Label>
                  <Input
                    data-testid="contact-tags-input"
                    value={newContact.tags}
                    onChange={(e) => setNewContact({ ...newContact, tags: e.target.value })}
                    placeholder="Клиент, VIP"
                    className="bg-zinc-950 border-white/10 text-white"
                  />
                </div>
                <Button 
                  type="submit" 
                  data-testid="save-contact-btn"
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
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <Card className="bg-zinc-900/50 border-white/10">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="w-10 h-10 rounded-lg bg-sky-500/20 flex items-center justify-center">
                <Phone className="w-5 h-5 text-sky-400" />
              </div>
              <div>
                <p className="text-xs font-mono uppercase text-zinc-500">Всего</p>
                <p className="text-2xl font-bold text-white font-mono">{contacts.length}</p>
              </div>
            </CardContent>
          </Card>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <Card className="bg-zinc-900/50 border-white/10">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="w-10 h-10 rounded-lg bg-zinc-500/20 flex items-center justify-center">
                <Clock className="w-5 h-5 text-zinc-400" />
              </div>
              <div>
                <p className="text-xs font-mono uppercase text-zinc-500">Ожидают</p>
                <p className="text-2xl font-bold text-white font-mono">{pendingCount}</p>
              </div>
            </CardContent>
          </Card>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <Card className="bg-zinc-900/50 border-white/10">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="w-10 h-10 rounded-lg bg-sky-500/20 flex items-center justify-center">
                <MessageSquare className="w-5 h-5 text-sky-400" />
              </div>
              <div>
                <p className="text-xs font-mono uppercase text-zinc-500">Отправлено</p>
                <p className="text-2xl font-bold text-white font-mono">{messagedCount}</p>
              </div>
            </CardContent>
          </Card>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
          <Card className="bg-zinc-900/50 border-white/10">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="w-10 h-10 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                <CheckCircle className="w-5 h-5 text-emerald-400" />
              </div>
              <div>
                <p className="text-xs font-mono uppercase text-zinc-500">Ответили</p>
                <p className="text-2xl font-bold text-white font-mono">{respondedCount}</p>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
          <Input
            data-testid="search-contacts-input"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Поиск по номеру или имени..."
            className="pl-10 bg-zinc-900 border-white/10 text-white"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger 
            data-testid="status-filter-select"
            className="w-full sm:w-48 bg-zinc-900 border-white/10 text-white"
          >
            <Filter className="w-4 h-4 mr-2" />
            <SelectValue placeholder="Все статусы" />
          </SelectTrigger>
          <SelectContent className="bg-zinc-900 border-white/10">
            <SelectItem value="all">Все статусы</SelectItem>
            <SelectItem value="pending">Ожидание</SelectItem>
            <SelectItem value="messaged">Отправлено</SelectItem>
            <SelectItem value="responded">Ответил</SelectItem>
          </SelectContent>
        </Select>
        {contacts.length > 0 && (
          <Button
            variant="outline"
            data-testid="delete-all-contacts-btn"
            onClick={handleDeleteAll}
            className="border-red-500/20 text-red-400 hover:bg-red-500/10"
          >
            <Trash2 className="w-4 h-4 mr-2" />
            Очистить
          </Button>
        )}
      </div>

      {/* Table */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
        <Card className="bg-zinc-900/50 border-white/10">
          <CardContent className="p-0">
            {loading ? (
              <div className="p-8 text-center text-zinc-400">Загрузка...</div>
            ) : filteredContacts.length === 0 ? (
              <div className="p-8 text-center">
                <Phone className="w-12 h-12 text-zinc-600 mx-auto mb-4" />
                <p className="text-zinc-400">Нет контактов</p>
                <p className="text-zinc-500 text-sm">Добавьте контакты вручную или импортируйте из файла</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="border-white/10 hover:bg-transparent">
                    <TableHead className="text-zinc-400">Телефон</TableHead>
                    <TableHead className="text-zinc-400">Имя</TableHead>
                    <TableHead className="text-zinc-400">Теги</TableHead>
                    <TableHead className="text-zinc-400">Статус</TableHead>
                    <TableHead className="text-zinc-400 w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredContacts.slice(0, 100).map((contact) => (
                    <TableRow 
                      key={contact.id} 
                      className="border-white/10 table-row-hover"
                      data-testid={`contact-row-${contact.id}`}
                    >
                      <TableCell className="font-mono text-sky-400">{contact.phone}</TableCell>
                      <TableCell className="text-zinc-300">{contact.name || '-'}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {contact.tags?.map((tag, i) => (
                            <span 
                              key={i}
                              className="px-2 py-0.5 bg-purple-500/10 text-purple-400 rounded text-xs"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={contact.status} />
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          data-testid={`delete-contact-${contact.id}`}
                          onClick={() => handleDelete(contact.id)}
                          className="text-zinc-400 hover:text-red-400"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
            {filteredContacts.length > 100 && (
              <div className="p-4 text-center text-zinc-500 border-t border-white/10">
                Показано 100 из {filteredContacts.length} контактов
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
