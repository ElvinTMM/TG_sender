import { useState, useEffect } from 'react';
import axios from 'axios';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { ScrollArea } from '../components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import { toast } from 'sonner';
import { 
  MessageSquare, 
  Send,
  User,
  Phone,
  Clock,
  CheckCircle,
  Filter,
  ArrowLeft
} from 'lucide-react';
import { motion } from 'framer-motion';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function DialogsPage() {
  const [dialogs, setDialogs] = useState([]);
  const [selectedDialog, setSelectedDialog] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [replyText, setReplyText] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    fetchDialogs();
  }, [filter]);

  const fetchDialogs = async () => {
    try {
      let url = `${API}/dialogs`;
      if (filter === 'responded') {
        url += '?has_response=true';
      } else if (filter === 'waiting') {
        url += '?has_response=false';
      }
      const response = await axios.get(url);
      setDialogs(response.data);
    } catch (error) {
      toast.error('Ошибка загрузки диалогов');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectDialog = async (dialog) => {
    setSelectedDialog(dialog);
  };

  const handleSendReply = async () => {
    if (!replyText.trim() || !selectedDialog) return;
    
    setSending(true);
    try {
      await axios.post(`${API}/dialogs/${selectedDialog.id}/reply`, null, {
        params: { message: replyText }
      });
      toast.success('Сообщение отправлено');
      setReplyText('');
      
      // Refresh dialog
      const response = await axios.get(`${API}/dialogs/${selectedDialog.id}`);
      setSelectedDialog(response.data);
      fetchDialogs();
    } catch (error) {
      toast.error('Ошибка отправки');
    } finally {
      setSending(false);
    }
  };

  const respondedCount = dialogs.filter(d => d.has_response).length;

  return (
    <div data-testid="dialogs-page" className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-heading text-3xl font-bold text-white">Диалоги</h1>
          <p className="text-zinc-400 mt-1">Просмотр ответов от клиентов</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 px-3 py-2 bg-emerald-500/10 rounded-lg border border-emerald-500/20">
            <CheckCircle className="w-4 h-4 text-emerald-400" />
            <span className="text-emerald-400 font-mono">{respondedCount}</span>
            <span className="text-zinc-400 text-sm">ответов</span>
          </div>
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger 
              data-testid="dialog-filter-select"
              className="w-40 bg-zinc-900 border-white/10 text-white"
            >
              <Filter className="w-4 h-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-zinc-900 border-white/10">
              <SelectItem value="all">Все диалоги</SelectItem>
              <SelectItem value="responded">С ответами</SelectItem>
              <SelectItem value="waiting">Без ответов</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[calc(100vh-220px)]">
        {/* Dialog List */}
        <motion.div 
          initial={{ opacity: 0, x: -20 }} 
          animate={{ opacity: 1, x: 0 }}
          className={`${selectedDialog ? 'hidden lg:block' : ''}`}
        >
          <Card className="bg-zinc-900/50 border-white/10 h-full">
            <CardContent className="p-0 h-full">
              <ScrollArea className="h-full">
                {loading ? (
                  <div className="p-8 text-center text-zinc-400">Загрузка...</div>
                ) : dialogs.length === 0 ? (
                  <div className="p-8 text-center">
                    <MessageSquare className="w-12 h-12 text-zinc-600 mx-auto mb-4" />
                    <p className="text-zinc-400">Нет диалогов</p>
                    <p className="text-zinc-500 text-sm">Запустите рассылку для начала общения</p>
                  </div>
                ) : (
                  <div className="divide-y divide-white/5">
                    {dialogs.map((dialog) => (
                      <div
                        key={dialog.id}
                        data-testid={`dialog-item-${dialog.id}`}
                        onClick={() => handleSelectDialog(dialog)}
                        className={`p-4 cursor-pointer transition-colors hover:bg-white/5 ${
                          selectedDialog?.id === dialog.id ? 'bg-sky-500/10 border-l-2 border-sky-500' : ''
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                            dialog.has_response ? 'bg-emerald-500/20' : 'bg-zinc-700'
                          }`}>
                            <User className={`w-5 h-5 ${dialog.has_response ? 'text-emerald-400' : 'text-zinc-400'}`} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                              <p className="font-medium text-white truncate">
                                {dialog.contact_name || dialog.contact_phone}
                              </p>
                              {dialog.has_response && (
                                <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-400 text-xs rounded">
                                  Ответил
                                </span>
                              )}
                            </div>
                            <p className="text-sm text-zinc-500 truncate mt-1">
                              {dialog.messages[dialog.messages.length - 1]?.text || 'Нет сообщений'}
                            </p>
                            <p className="text-xs text-zinc-600 mt-1 font-mono">
                              {dialog.contact_phone}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </motion.div>

        {/* Chat View */}
        <motion.div 
          initial={{ opacity: 0 }} 
          animate={{ opacity: 1 }}
          className={`lg:col-span-2 ${!selectedDialog && 'hidden lg:block'}`}
        >
          <Card className="bg-zinc-900/50 border-white/10 h-full flex flex-col">
            {selectedDialog ? (
              <>
                {/* Chat Header */}
                <div className="p-4 border-b border-white/10 flex items-center gap-4">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="lg:hidden"
                    onClick={() => setSelectedDialog(null)}
                  >
                    <ArrowLeft className="w-5 h-5" />
                  </Button>
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                    selectedDialog.has_response ? 'bg-emerald-500/20' : 'bg-zinc-700'
                  }`}>
                    <User className={`w-5 h-5 ${selectedDialog.has_response ? 'text-emerald-400' : 'text-zinc-400'}`} />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-white">
                      {selectedDialog.contact_name || selectedDialog.contact_phone}
                    </p>
                    <p className="text-sm text-zinc-500 flex items-center gap-2">
                      <Phone className="w-3 h-3" />
                      {selectedDialog.contact_phone}
                    </p>
                  </div>
                </div>

                {/* Messages */}
                <ScrollArea className="flex-1 p-4">
                  <div className="space-y-4">
                    {selectedDialog.messages.map((msg, idx) => (
                      <div
                        key={msg.id || idx}
                        className={`flex ${msg.direction === 'outgoing' ? 'justify-end' : 'justify-start'}`}
                      >
                        <div className={`max-w-[70%] rounded-lg p-3 ${
                          msg.direction === 'outgoing' 
                            ? 'bg-sky-500/20 text-white' 
                            : 'bg-emerald-500/20 text-white'
                        }`}>
                          <p className="text-sm">{msg.text}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <Clock className="w-3 h-3 text-zinc-500" />
                            <span className="text-xs text-zinc-500">
                              {msg.sent_at || msg.received_at 
                                ? new Date(msg.sent_at || msg.received_at).toLocaleString('ru-RU')
                                : ''
                              }
                            </span>
                            {msg.direction === 'outgoing' && msg.status === 'delivered' && (
                              <CheckCircle className="w-3 h-3 text-emerald-400" />
                            )}
                          </div>
                          {msg.direction === 'outgoing' && msg.account_phone && (
                            <p className="text-xs text-zinc-500 mt-1">
                              С аккаунта: {msg.account_phone}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>

                {/* Reply Input */}
                <div className="p-4 border-t border-white/10">
                  <div className="flex gap-2">
                    <Textarea
                      data-testid="reply-input"
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      placeholder="Введите ответ..."
                      className="bg-zinc-950 border-white/10 text-white resize-none min-h-[60px]"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleSendReply();
                        }
                      }}
                    />
                    <Button
                      data-testid="send-reply-btn"
                      onClick={handleSendReply}
                      disabled={!replyText.trim() || sending}
                      className="bg-sky-500 hover:bg-sky-600 px-6"
                    >
                      <Send className="w-4 h-4" />
                    </Button>
                  </div>
                  <p className="text-xs text-zinc-500 mt-2">
                    * Отправка симулирована. Для реальной отправки требуется интеграция Telethon.
                  </p>
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center">
                  <MessageSquare className="w-16 h-16 text-zinc-600 mx-auto mb-4" />
                  <p className="text-zinc-400">Выберите диалог</p>
                  <p className="text-zinc-500 text-sm">для просмотра переписки</p>
                </div>
              </div>
            )}
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
