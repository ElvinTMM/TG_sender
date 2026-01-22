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
import { toast } from 'sonner';
import { 
  Plus, 
  FileText,
  Trash2,
  Copy,
  Edit,
  Eye,
  Sparkles,
  Variable
} from 'lucide-react';
import { motion } from 'framer-motion';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const VARIABLES = [
  { key: '{name}', label: 'Имя контакта', example: 'Иван' },
  { key: '{phone}', label: 'Телефон', example: '+7999123456' },
  { key: '{first_name}', label: 'Только имя', example: 'Иван' },
  { key: '{time}', label: 'Время суток', example: 'Добрый день' },
];

const parseSpintax = (text) => {
  const regex = /\{([^{}]+)\}/g;
  return text.replace(regex, (match, group) => {
    if (group.includes('|')) {
      const options = group.split('|');
      return options[Math.floor(Math.random() * options.length)];
    }
    return match;
  });
};

const previewMessage = (template, variables = {}) => {
  let text = template;
  text = text.replace(/{name}/g, variables.name || 'Иван');
  text = text.replace(/{first_name}/g, variables.first_name || 'Иван');
  text = text.replace(/{phone}/g, variables.phone || '+79991234567');
  
  const hour = new Date().getHours();
  let timeGreeting = 'Добрый день';
  if (hour < 12) timeGreeting = 'Доброе утро';
  else if (hour >= 18) timeGreeting = 'Добрый вечер';
  text = text.replace(/{time}/g, timeGreeting);
  
  text = parseSpintax(text);
  return text;
};

export default function TemplatesPage() {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewText, setPreviewText] = useState('');
  const [newTemplate, setNewTemplate] = useState({
    name: '',
    content: '',
    description: ''
  });

  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    try {
      const response = await axios.get(`${API}/templates`);
      setTemplates(response.data);
    } catch (error) {
      toast.error('Ошибка загрузки шаблонов');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveTemplate = async (e) => {
    e.preventDefault();
    try {
      if (editingTemplate) {
        await axios.put(`${API}/templates/${editingTemplate.id}`, newTemplate);
        toast.success('Шаблон обновлен');
      } else {
        await axios.post(`${API}/templates`, newTemplate);
        toast.success('Шаблон создан');
      }
      
      setDialogOpen(false);
      setNewTemplate({ name: '', content: '', description: '' });
      setEditingTemplate(null);
      fetchTemplates();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Ошибка сохранения');
    }
  };

  const handleEdit = (template) => {
    setEditingTemplate(template);
    setNewTemplate({
      name: template.name,
      content: template.content,
      description: template.description || ''
    });
    setDialogOpen(true);
  };

  const handleDelete = async (templateId) => {
    if (!window.confirm('Удалить шаблон?')) return;
    
    try {
      await axios.delete(`${API}/templates/${templateId}`);
      toast.success('Шаблон удален');
      fetchTemplates();
    } catch (error) {
      toast.error('Ошибка удаления');
    }
  };

  const handlePreview = (template) => {
    setPreviewText(previewMessage(template.content));
    setPreviewOpen(true);
  };

  const handleCopy = (content) => {
    navigator.clipboard.writeText(content);
    toast.success('Скопировано');
  };

  const insertVariable = (variable) => {
    setNewTemplate(prev => ({
      ...prev,
      content: prev.content + variable
    }));
  };

  return (
    <div data-testid="templates-page" className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-heading text-3xl font-bold text-white">Шаблоны сообщений</h1>
          <p className="text-zinc-400 mt-1">Персонализированные тексты для рассылки</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) {
            setEditingTemplate(null);
            setNewTemplate({ name: '', content: '', description: '' });
          }
        }}>
          <DialogTrigger asChild>
            <Button 
              data-testid="create-template-btn"
              className="bg-sky-500 hover:bg-sky-600 text-white"
            >
              <Plus className="w-4 h-4 mr-2" />
              Создать шаблон
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-zinc-900 border-white/10 max-w-2xl max-h-[85vh] flex flex-col p-0">
            <DialogHeader className="p-6 pb-0">
              <DialogTitle className="text-white font-heading">
                {editingTemplate ? 'Редактировать шаблон' : 'Новый шаблон'}
              </DialogTitle>
            </DialogHeader>
            <div className="flex-1 overflow-y-auto px-6 pb-6">
              <form onSubmit={handleSaveTemplate} className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label className="text-zinc-300">Название шаблона</Label>
                  <Input
                    data-testid="template-name-input"
                    value={newTemplate.name}
                    onChange={(e) => setNewTemplate({ ...newTemplate, name: e.target.value })}
                    placeholder="Холодное предложение v1"
                    className="bg-zinc-950 border-white/10 text-white"
                    required
                  />
                </div>
                
                <div className="space-y-2">
                  <Label className="text-zinc-300">Описание (опционально)</Label>
                  <Input
                    data-testid="template-description-input"
                    value={newTemplate.description}
                    onChange={(e) => setNewTemplate({ ...newTemplate, description: e.target.value })}
                    placeholder="Для B2B клиентов"
                    className="bg-zinc-950 border-white/10 text-white"
                  />
                </div>
                
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-zinc-300">Текст сообщения</Label>
                    <div className="flex gap-1 flex-wrap">
                      {VARIABLES.map((v) => (
                        <Button
                          key={v.key}
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => insertVariable(v.key)}
                          className="text-xs text-sky-400 hover:text-sky-300 hover:bg-sky-500/10 px-2"
                        >
                          {v.key}
                        </Button>
                      ))}
                    </div>
                  </div>
                  <Textarea
                    data-testid="template-content-input"
                    value={newTemplate.content}
                    onChange={(e) => setNewTemplate({ ...newTemplate, content: e.target.value })}
                    placeholder="Добрый вечер, Иван!"
                    className="bg-zinc-950 border-white/10 text-white min-h-[120px] font-mono text-sm"
                    required
                  />
                </div>
                
                <div className="p-3 bg-zinc-950 rounded-lg border border-white/10 space-y-2">
                  <div className="flex items-center gap-2 text-sky-400">
                    <Sparkles className="w-4 h-4" />
                    <span className="text-sm font-medium">Подсказки</span>
                  </div>
                  <div className="space-y-1 text-xs text-zinc-400">
                    <p><span className="text-purple-400 font-mono">{'{name}'}</span> — имя контакта</p>
                    <p><span className="text-purple-400 font-mono">{'{time}'}</span> — утро/день/вечер</p>
                    <p><span className="text-purple-400 font-mono">{'{A|B|C}'}</span> — случайный выбор</p>
                  </div>
                </div>
                
                {newTemplate.content && (
                  <div className="p-3 bg-emerald-500/10 rounded-lg border border-emerald-500/20">
                    <div className="flex items-center gap-2 text-emerald-400 mb-2">
                      <Eye className="w-4 h-4" />
                      <span className="text-sm font-medium">Предпросмотр</span>
                    </div>
                    <p className="text-white text-sm whitespace-pre-wrap">
                      {previewMessage(newTemplate.content)}
                    </p>
                  </div>
                )}
                
                <Button 
                  type="submit" 
                  data-testid="save-template-btn"
                  className="w-full bg-sky-500 hover:bg-sky-600"
                >
                  {editingTemplate ? 'Сохранить изменения' : 'Создать шаблон'}
                </Button>
              </form>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <Card className="bg-zinc-900/50 border-white/10">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="w-10 h-10 rounded-lg bg-sky-500/20 flex items-center justify-center">
                <FileText className="w-5 h-5 text-sky-400" />
              </div>
              <div>
                <p className="text-xs font-mono uppercase text-zinc-500">Всего шаблонов</p>
                <p className="text-2xl font-bold text-white font-mono">{templates.length}</p>
              </div>
            </CardContent>
          </Card>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <Card className="bg-zinc-900/50 border-white/10">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center">
                <Variable className="w-5 h-5 text-purple-400" />
              </div>
              <div>
                <p className="text-xs font-mono uppercase text-zinc-500">Переменных</p>
                <p className="text-2xl font-bold text-white font-mono">{VARIABLES.length}</p>
              </div>
            </CardContent>
          </Card>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <Card className="bg-zinc-900/50 border-white/10">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="w-10 h-10 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-emerald-400" />
              </div>
              <div>
                <p className="text-xs font-mono uppercase text-zinc-500">Спинтакс</p>
                <p className="text-lg font-bold text-white">{'{A|B|C}'}</p>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }} 
        animate={{ opacity: 1, y: 0 }} 
        transition={{ delay: 0.3 }}
      >
        {loading ? (
          <div className="p-8 text-center text-zinc-400">Загрузка...</div>
        ) : templates.length === 0 ? (
          <Card className="bg-zinc-900/50 border-white/10">
            <CardContent className="p-8 text-center">
              <FileText className="w-12 h-12 text-zinc-600 mx-auto mb-4" />
              <p className="text-zinc-400">Нет шаблонов</p>
              <p className="text-zinc-500 text-sm">Создайте первый шаблон для персонализации рассылки</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {templates.map((template) => (
              <Card 
                key={template.id} 
                className="bg-zinc-900/50 border-white/10 hover:border-white/20 transition-colors"
                data-testid={`template-card-${template.id}`}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-lg font-heading text-white">
                        {template.name}
                      </CardTitle>
                      {template.description && (
                        <p className="text-sm text-zinc-500 mt-1">{template.description}</p>
                      )}
                    </div>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handlePreview(template)}
                        className="text-zinc-400 hover:text-white"
                      >
                        <Eye className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleCopy(template.content)}
                        className="text-zinc-400 hover:text-white"
                      >
                        <Copy className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleEdit(template)}
                        className="text-zinc-400 hover:text-white"
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(template.id)}
                        className="text-zinc-400 hover:text-red-400"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="p-3 bg-zinc-950 rounded-lg">
                    <p className="text-sm text-zinc-300 whitespace-pre-wrap line-clamp-4 font-mono">
                      {template.content}
                    </p>
                  </div>
                  <p className="text-xs text-zinc-500 mt-2">
                    Создан: {new Date(template.created_at).toLocaleDateString('ru-RU')}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </motion.div>

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="bg-zinc-900 border-white/10">
          <DialogHeader>
            <DialogTitle className="text-white font-heading flex items-center gap-2">
              <Eye className="w-5 h-5 text-emerald-400" />
              Предпросмотр сообщения
            </DialogTitle>
          </DialogHeader>
          <div className="mt-4 p-4 bg-zinc-950 rounded-lg">
            <p className="text-white whitespace-pre-wrap">{previewText}</p>
          </div>
          <Button 
            onClick={() => setPreviewText(previewMessage(previewText))}
            variant="outline"
            className="border-white/10"
          >
            <Sparkles className="w-4 h-4 mr-2" />
            Сгенерировать другой вариант
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
