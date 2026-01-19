import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Switch } from '../components/ui/switch';
import { ScrollArea } from '../components/ui/scroll-area';
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/table';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '../components/ui/tabs';
import { toast } from 'sonner';
import { 
  Mic, 
  Upload,
  Play,
  Pause,
  Trash2,
  Clock,
  Send,
  Users,
  Phone,
  CheckCircle,
  XCircle,
  Eye,
  RefreshCw,
  Volume2
} from 'lucide-react';
import { motion } from 'framer-motion';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function VoicePage() {
  const [voiceMessages, setVoiceMessages] = useState([]);
  const [queue, setQueue] = useState([]);
  const [readContacts, setReadContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [playingId, setPlayingId] = useState(null);
  const audioRef = useRef(null);
  
  const [newVoice, setNewVoice] = useState({
    name: '',
    description: '',
    delay_minutes: 30,
    file: null
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [voiceRes, queueRes, contactsRes] = await Promise.all([
        axios.get(`${API}/voice-messages`),
        axios.get(`${API}/followup-queue`),
        axios.get(`${API}/contacts?status=read`)
      ]);
      setVoiceMessages(voiceRes.data);
      setQueue(queueRes.data);
      setReadContacts(contactsRes.data);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!newVoice.file) {
      toast.error('Выберите аудиофайл');
      return;
    }

    const formData = new FormData();
    formData.append('file', newVoice.file);
    formData.append('name', newVoice.name);
    formData.append('description', newVoice.description);
    formData.append('delay_minutes', newVoice.delay_minutes);

    try {
      await axios.post(`${API}/voice-messages`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        params: {
          name: newVoice.name,
          description: newVoice.description,
          delay_minutes: newVoice.delay_minutes
        }
      });
      toast.success('Голосовое сообщение загружено');
      setUploadOpen(false);
      setNewVoice({ name: '', description: '', delay_minutes: 30, file: null });
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Ошибка загрузки');
    }
  };

  const handleToggle = async (voiceId) => {
    try {
      await axios.put(`${API}/voice-messages/${voiceId}/toggle`);
      toast.success('Статус обновлен');
      fetchData();
    } catch (error) {
      toast.error('Ошибка');
    }
  };

  const handleDelete = async (voiceId) => {
    if (!window.confirm('Удалить голосовое сообщение?')) return;
    
    try {
      await axios.delete(`${API}/voice-messages/${voiceId}`);
      toast.success('Удалено');
      fetchData();
    } catch (error) {
      toast.error('Ошибка удаления');
    }
  };

  const handleAddToQueue = async (voiceId) => {
    try {
      const response = await axios.post(`${API}/followup-queue/add-read-contacts`, null, {
        params: { voice_message_id: voiceId }
      });
      toast.success(`Добавлено ${response.data.added} контактов в очередь`);
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Ошибка');
    }
  };

  const handleProcessQueue = async () => {
    setProcessing(true);
    try {
      const response = await axios.post(`${API}/followup-queue/process`);
      toast.success(`Обработано: ${response.data.processed}, отправлено: ${response.data.sent}`);
      fetchData();
    } catch (error) {
      toast.error('Ошибка обработки');
    } finally {
      setProcessing(false);
    }
  };

  const handleCancelQueue = async (queueId) => {
    try {
      await axios.delete(`${API}/followup-queue/${queueId}`);
      toast.success('Отменено');
      fetchData();
    } catch (error) {
      toast.error('Ошибка');
    }
  };

  const handleClearQueue = async () => {
    if (!window.confirm('Очистить обработанные записи?')) return;
    
    try {
      await axios.delete(`${API}/followup-queue`);
      toast.success('Очередь очищена');
      fetchData();
    } catch (error) {
      toast.error('Ошибка');
    }
  };

  const pendingCount = queue.filter(q => q.status === 'pending').length;
  const sentCount = queue.filter(q => q.status === 'sent').length;

  return (
    <div data-testid="voice-page" className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-heading text-3xl font-bold text-white">Голосовые сообщения</h1>
          <p className="text-zinc-400 mt-1">Авто-отправка тем, кто прочитал но не ответил</p>
        </div>
        <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
          <DialogTrigger asChild>
            <Button 
              data-testid="upload-voice-btn"
              className="bg-sky-500 hover:bg-sky-600 text-white"
            >
              <Upload className="w-4 h-4 mr-2" />
              Загрузить аудио
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-zinc-900 border-white/10">
            <DialogHeader>
              <DialogTitle className="text-white font-heading">Загрузить голосовое</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleUpload} className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label className="text-zinc-300">Название</Label>
                <Input
                  data-testid="voice-name-input"
                  value={newVoice.name}
                  onChange={(e) => setNewVoice({ ...newVoice, name: e.target.value })}
                  placeholder="Напоминание о предложении"
                  className="bg-zinc-950 border-white/10 text-white"
                  required
                />
              </div>
              
              <div className="space-y-2">
                <Label className="text-zinc-300">Описание</Label>
                <Input
                  value={newVoice.description}
                  onChange={(e) => setNewVoice({ ...newVoice, description: e.target.value })}
                  placeholder="Для тех кто прочитал первое сообщение"
                  className="bg-zinc-950 border-white/10 text-white"
                />
              </div>
              
              <div className="space-y-2">
                <Label className="text-zinc-300">Отправлять через (минут после прочтения)</Label>
                <Select 
                  value={String(newVoice.delay_minutes)} 
                  onValueChange={(v) => setNewVoice({ ...newVoice, delay_minutes: parseInt(v) })}
                >
                  <SelectTrigger className="bg-zinc-950 border-white/10 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-zinc-900 border-white/10">
                    <SelectItem value="15">15 минут</SelectItem>
                    <SelectItem value="30">30 минут</SelectItem>
                    <SelectItem value="60">1 час</SelectItem>
                    <SelectItem value="120">2 часа</SelectItem>
                    <SelectItem value="240">4 часа</SelectItem>
                    <SelectItem value="1440">24 часа</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label className="text-zinc-300">Аудиофайл</Label>
                <div className="p-4 bg-zinc-950 rounded-lg border border-dashed border-white/20 text-center">
                  <input
                    type="file"
                    accept=".mp3,.ogg,.wav,.m4a"
                    onChange={(e) => setNewVoice({ ...newVoice, file: e.target.files[0] })}
                    className="hidden"
                    id="voice-file"
                  />
                  <label htmlFor="voice-file" className="cursor-pointer">
                    <Mic className="w-8 h-8 text-zinc-500 mx-auto mb-2" />
                    {newVoice.file ? (
                      <p className="text-sky-400">{newVoice.file.name}</p>
                    ) : (
                      <p className="text-zinc-400">MP3, OGG, WAV, M4A</p>
                    )}
                  </label>
                </div>
              </div>
              
              <Button 
                type="submit" 
                data-testid="save-voice-btn"
                className="w-full bg-sky-500 hover:bg-sky-600"
              >
                Загрузить
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
                <Mic className="w-5 h-5 text-sky-400" />
              </div>
              <div>
                <p className="text-xs font-mono uppercase text-zinc-500">Голосовых</p>
                <p className="text-2xl font-bold text-white font-mono">{voiceMessages.length}</p>
              </div>
            </CardContent>
          </Card>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <Card className="bg-zinc-900/50 border-white/10">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="w-10 h-10 rounded-lg bg-amber-500/20 flex items-center justify-center">
                <Eye className="w-5 h-5 text-amber-400" />
              </div>
              <div>
                <p className="text-xs font-mono uppercase text-zinc-500">Прочитали</p>
                <p className="text-2xl font-bold text-white font-mono">{readContacts.length}</p>
              </div>
            </CardContent>
          </Card>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <Card className="bg-zinc-900/50 border-white/10">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center">
                <Clock className="w-5 h-5 text-purple-400" />
              </div>
              <div>
                <p className="text-xs font-mono uppercase text-zinc-500">В очереди</p>
                <p className="text-2xl font-bold text-white font-mono">{pendingCount}</p>
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
                <p className="text-xs font-mono uppercase text-zinc-500">Отправлено</p>
                <p className="text-2xl font-bold text-white font-mono">{sentCount}</p>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="voices" className="w-full">
        <TabsList className="bg-zinc-800 border border-white/10">
          <TabsTrigger value="voices" className="data-[state=active]:bg-sky-500/20">
            <Mic className="w-4 h-4 mr-2" />
            Голосовые ({voiceMessages.length})
          </TabsTrigger>
          <TabsTrigger value="queue" className="data-[state=active]:bg-sky-500/20">
            <Clock className="w-4 h-4 mr-2" />
            Очередь ({pendingCount})
          </TabsTrigger>
          <TabsTrigger value="read" className="data-[state=active]:bg-sky-500/20">
            <Eye className="w-4 h-4 mr-2" />
            Прочитали ({readContacts.length})
          </TabsTrigger>
        </TabsList>
        
        {/* Voice Messages Tab */}
        <TabsContent value="voices" className="mt-4">
          {voiceMessages.length === 0 ? (
            <Card className="bg-zinc-900/50 border-white/10">
              <CardContent className="p-8 text-center">
                <Mic className="w-12 h-12 text-zinc-600 mx-auto mb-4" />
                <p className="text-zinc-400">Нет голосовых сообщений</p>
                <p className="text-zinc-500 text-sm">Загрузите аудиофайл для отправки</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {voiceMessages.map((voice) => (
                <Card 
                  key={voice.id} 
                  className="bg-zinc-900/50 border-white/10"
                  data-testid={`voice-card-${voice.id}`}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h3 className="font-medium text-white">{voice.name}</h3>
                        {voice.description && (
                          <p className="text-sm text-zinc-500">{voice.description}</p>
                        )}
                      </div>
                      <Switch
                        checked={voice.is_active}
                        onCheckedChange={() => handleToggle(voice.id)}
                      />
                    </div>
                    
                    <div className="flex items-center gap-4 text-sm text-zinc-400 mb-3">
                      <span className="flex items-center gap-1">
                        <Clock className="w-4 h-4" />
                        {voice.delay_minutes} мин
                      </span>
                      <span className="flex items-center gap-1">
                        <Send className="w-4 h-4" />
                        {voice.sent_count} отправлено
                      </span>
                    </div>
                    
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleAddToQueue(voice.id)}
                        className="flex-1 border-sky-500/20 text-sky-400 hover:bg-sky-500/10"
                      >
                        <Users className="w-4 h-4 mr-1" />
                        В очередь
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDelete(voice.id)}
                        className="border-red-500/20 text-red-400 hover:bg-red-500/10"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
        
        {/* Queue Tab */}
        <TabsContent value="queue" className="mt-4">
          <Card className="bg-zinc-900/50 border-white/10">
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <CardTitle className="text-lg font-heading text-white">
                Очередь на отправку
              </CardTitle>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleProcessQueue}
                  disabled={processing || pendingCount === 0}
                  className="border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/10"
                >
                  {processing ? (
                    <RefreshCw className="w-4 h-4 mr-1 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4 mr-1" />
                  )}
                  Отправить сейчас
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleClearQueue}
                  className="border-white/10 text-zinc-400 hover:bg-white/5"
                >
                  Очистить
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {queue.length === 0 ? (
                <div className="p-8 text-center text-zinc-500">
                  Очередь пуста
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="border-white/10">
                      <TableHead className="text-zinc-400">Контакт</TableHead>
                      <TableHead className="text-zinc-400">Голосовое</TableHead>
                      <TableHead className="text-zinc-400">Запланировано</TableHead>
                      <TableHead className="text-zinc-400">Статус</TableHead>
                      <TableHead className="text-zinc-400 w-[50px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {queue.map((item) => (
                      <TableRow key={item.id} className="border-white/10">
                        <TableCell>
                          <div>
                            <p className="text-white">{item.contact_name || item.contact_phone}</p>
                            <p className="text-xs text-zinc-500 font-mono">{item.contact_phone}</p>
                          </div>
                        </TableCell>
                        <TableCell className="text-zinc-300">
                          {item.voice_message_name || '-'}
                        </TableCell>
                        <TableCell className="text-zinc-400 text-sm">
                          {new Date(item.scheduled_at).toLocaleString('ru-RU')}
                        </TableCell>
                        <TableCell>
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs ${
                            item.status === 'pending' ? 'bg-amber-500/10 text-amber-400' :
                            item.status === 'sent' ? 'bg-emerald-500/10 text-emerald-400' :
                            'bg-red-500/10 text-red-400'
                          }`}>
                            {item.status === 'pending' ? 'Ожидает' :
                             item.status === 'sent' ? 'Отправлено' : 'Отменено'}
                          </span>
                        </TableCell>
                        <TableCell>
                          {item.status === 'pending' && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleCancelQueue(item.id)}
                              className="text-zinc-400 hover:text-red-400"
                            >
                              <XCircle className="w-4 h-4" />
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* Read Contacts Tab */}
        <TabsContent value="read" className="mt-4">
          <Card className="bg-zinc-900/50 border-white/10">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg font-heading text-white">
                Прочитали, но не ответили
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {readContacts.length === 0 ? (
                <div className="p-8 text-center text-zinc-500">
                  Нет контактов со статусом "прочитал"
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="border-white/10">
                      <TableHead className="text-zinc-400">Контакт</TableHead>
                      <TableHead className="text-zinc-400">Телефон</TableHead>
                      <TableHead className="text-zinc-400">Прочитано</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {readContacts.map((contact) => (
                      <TableRow key={contact.id} className="border-white/10">
                        <TableCell className="text-white">
                          {contact.name || '-'}
                        </TableCell>
                        <TableCell className="font-mono text-sky-400">
                          {contact.phone}
                        </TableCell>
                        <TableCell className="text-zinc-400 text-sm">
                          {contact.read_at ? new Date(contact.read_at).toLocaleString('ru-RU') : '-'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      
      {/* Info */}
      <Card className="bg-zinc-900/50 border-white/10">
        <CardContent className="p-4">
          <h3 className="font-medium text-white mb-2 flex items-center gap-2">
            <Volume2 className="w-4 h-4 text-sky-400" />
            Как это работает
          </h3>
          <ol className="text-sm text-zinc-400 space-y-1 list-decimal list-inside">
            <li>Загрузите голосовое сообщение (MP3, OGG, WAV)</li>
            <li>Укажите задержку (через сколько минут после прочтения отправлять)</li>
            <li>Контакты со статусом "прочитал" появятся во вкладке</li>
            <li>Нажмите "В очередь" чтобы добавить их в рассылку</li>
            <li>Нажмите "Отправить сейчас" или дождитесь запланированного времени</li>
          </ol>
          <p className="text-xs text-zinc-500 mt-3">
            * Отправка голосовых <span className="text-amber-400">СИМУЛИРОВАНА</span>. Для реальной отправки требуется интеграция Telethon.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
