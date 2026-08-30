/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { 
  Search, 
  Plus, 
  Trash2, 
  Edit3, 
  Pin, 
  Share2, 
  Copy, 
  FileText, 
  CheckSquare, 
  Square, 
  Bookmark, 
  Tag, 
  Calendar, 
  Clock, 
  Sparkles, 
  Lightbulb, 
  Check, 
  X, 
  ChevronDown, 
  BookOpen, 
  Download,
  AlertTriangle,
  Notebook,
  StickyNote,
  Heart,
  Save,
  PenTool,
  HelpCircle,
  Undo
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { DailyNote, NoteTodo } from '../types';

export default function DailyNotebook() {
  // Core states
  const [notes, setNotes] = useState<DailyNote[]>(() => {
    const saved = localStorage.getItem('vinimap_daily_notes');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          // Filter out legacy mock notes
          return parsed.filter(n => !['note-1', 'note-2', 'note-3', 'note-4'].includes(n.id));
        }
      } catch (e) {
        console.error('Erro ao decodificar notas locais', e);
      }
    }
    
    return [];
  });

  // Save notes to LocalStorage
  useEffect(() => {
    localStorage.setItem('vinimap_daily_notes', JSON.stringify(notes));
  }, [notes]);

  // Scratchpad quick note state
  const [scratchpad, setScratchpad] = useState(() => {
    return localStorage.getItem('vinimap_scratchpad') || '';
  });

  const handleScratchpadChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setScratchpad(val);
    localStorage.setItem('vinimap_scratchpad', val);
  };

  const handleClearScratchpad = () => {
    if (window.confirm('Deseja limpar todo o rascunho rápido?')) {
      setScratchpad('');
      localStorage.setItem('vinimap_scratchpad', '');
    }
  };

  // Convert scratchpad to a formal note
  const handleConvertScratchpadToNote = () => {
    if (!scratchpad.trim()) return;
    
    const lines = scratchpad.split('\n');
    const title = lines[0].substring(0, 40) + (lines[0].length > 40 ? '...' : '');
    const content = scratchpad;
    
    const newNote: DailyNote = {
      id: `note-from-scratch-${Date.now()}`,
      title: title.startsWith('💡') || title.startsWith('📝') || title.startsWith('⚡') ? title : `📝 ${title}`,
      content,
      category: 'Geral',
      createdAt: new Date().toISOString(),
      pinned: false,
      tags: ['rascunho'],
      color: 'bg-slate-50 border-slate-200 text-slate-900'
    };

    setNotes(prev => [newNote, ...prev]);
    setScratchpad('');
    localStorage.setItem('vinimap_scratchpad', '');
    
    // Visual alert
    alert('Rascunho convertido em nota oficial com sucesso!');
  };

  // Filter & Search states
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategoryFilter, setActiveCategoryFilter] = useState<string>('Todos');
  const [activeTagFilter, setActiveTagFilter] = useState<string>('Todos');

  // New Note Modal / Editing States
  const [isNoteModalOpen, setIsNoteModalOpen] = useState(false);
  const [editingNote, setEditingNote] = useState<DailyNote | null>(null);

  // Form States
  const [formTitle, setFormTitle] = useState('');
  const [formContent, setFormContent] = useState('');
  const [formCategory, setFormCategory] = useState<DailyNote['category']>('Geral');
  const [formTagsString, setFormTagsString] = useState('');
  const [formColor, setFormColor] = useState('bg-amber-50/70 border-amber-200 text-amber-950');
  const [formTodos, setFormTodos] = useState<NoteTodo[]>([]);
  const [newTodoText, setNewTodoText] = useState('');

  // Handle open modal for creation
  const handleOpenCreateModal = () => {
    setEditingNote(null);
    setFormTitle('');
    setFormContent('');
    setFormCategory('Geral');
    setFormTagsString('');
    setFormColor('bg-amber-50/70 border-amber-200 text-amber-950');
    setFormTodos([]);
    setIsNoteModalOpen(true);
  };

  // Handle open modal for edit
  const handleOpenEditModal = (note: DailyNote) => {
    setEditingNote(note);
    setFormTitle(note.title);
    setFormContent(note.content);
    setFormCategory(note.category);
    setFormTagsString(note.tags.join(', '));
    setFormColor(note.color || 'bg-slate-50 border-slate-200 text-slate-950');
    setFormTodos(note.todos || []);
    setIsNoteModalOpen(true);
  };

  // Add todo to form
  const handleAddTodoToForm = () => {
    if (!newTodoText.trim()) return;
    const newTodo: NoteTodo = {
      id: `todo-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      text: newTodoText.trim(),
      completed: false
    };
    setFormTodos(prev => [...prev, newTodo]);
    setNewTodoText('');
  };

  // Remove todo from form
  const handleRemoveTodoFromForm = (id: string) => {
    setFormTodos(prev => prev.filter(t => t.id !== id));
  };

  // Save/Create Note Handler
  const handleSaveNote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim() && !formContent.trim()) {
      alert('Por favor, preencha pelo menos o título ou conteúdo da nota.');
      return;
    }

    const cleanTags = formTagsString
      .split(',')
      .map(t => t.trim().toLowerCase())
      .filter(t => t.length > 0);

    const noteTitle = formTitle.trim() || 'Nota Sem Título';

    if (editingNote) {
      // Edit note
      setNotes(prev => prev.map(n => {
        if (n.id === editingNote.id) {
          return {
            ...n,
            title: noteTitle,
            content: formContent.trim(),
            category: formCategory,
            tags: cleanTags,
            todos: formTodos,
            color: formColor,
            updatedAt: new Date().toISOString()
          };
        }
        return n;
      }));
    } else {
      // Create brand new note
      const newNote: DailyNote = {
        id: `note-${Date.now()}`,
        title: noteTitle,
        content: formContent.trim(),
        category: formCategory,
        createdAt: new Date().toISOString(),
        pinned: false,
        tags: cleanTags,
        todos: formTodos,
        color: formColor
      };
      setNotes(prev => [newNote, ...prev]);
    }

    setIsNoteModalOpen(false);
  };

  // Delete Note Handler
  const handleDeleteNote = (noteId: string) => {
    if (window.confirm('Deseja realmente excluir esta nota?')) {
      setNotes(prev => prev.filter(n => n.id !== noteId));
    }
  };

  // Pin/Unpin Note Handler
  const handleTogglePin = (noteId: string) => {
    setNotes(prev => prev.map(n => {
      if (n.id === noteId) {
        return { ...n, pinned: !n.pinned };
      }
      return n;
    }));
  };

  // Toggle single todo inside a note card
  const handleToggleTodo = (noteId: string, todoId: string) => {
    setNotes(prev => prev.map(n => {
      if (n.id === noteId && n.todos) {
        const updatedTodos = n.todos.map(t => {
          if (t.id === todoId) {
            return { ...t, completed: !t.completed };
          }
          return t;
        });
        return { ...n, todos: updatedTodos };
      }
      return n;
    }));
  };

  // Copy note text to clipboard
  const handleCopyNote = (note: DailyNote) => {
    let text = `${note.title}\nCategoria: ${note.category}\nTags: ${note.tags.map(t => '#' + t).join(' ')}\n\n${note.content}`;
    if (note.todos && note.todos.length > 0) {
      text += `\n\nChecklist:\n` + note.todos.map(t => `[${t.completed ? 'x' : ' '}] ${t.text}`).join('\n');
    }
    navigator.clipboard.writeText(text);
    alert('Conteúdo copiado para a área de transferência!');
  };

  // Download note as TXT
  const handleDownloadNote = (note: DailyNote) => {
    let text = `${note.title}\nCategoria: ${note.category}\nCriado em: ${formatDateTime(note.createdAt)}\nTags: ${note.tags.map(t => '#' + t).join(' ')}\n\n${note.content}`;
    if (note.todos && note.todos.length > 0) {
      text += `\n\nChecklist:\n` + note.todos.map(t => `[${t.completed ? 'x' : ' '}] ${t.text}`).join('\n');
    }

    const element = document.createElement("a");
    const file = new Blob([text], {type: 'text/plain'});
    element.href = URL.createObjectURL(file);
    element.download = `${note.title.replace(/[^\w\s-]/gi, '').trim().replace(/\s+/g, '_')}_nota.txt`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  // Helpers to format date/time
  const formatDateTime = (isoString: string) => {
    try {
      const date = new Date(isoString);
      return date.toLocaleString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (e) {
      return isoString;
    }
  };

  // Get list of all unique tags in the system
  const allTags = React.useMemo(() => {
    const tagsSet = new Set<string>();
    notes.forEach(note => {
      note.tags.forEach(tag => {
        if (tag.trim()) tagsSet.add(tag.trim().toLowerCase());
      });
    });
    return Array.from(tagsSet);
  }, [notes]);

  // Categories list
  const categories: DailyNote['category'][] = ['Geral', 'Ideia', 'Operacional', 'Financeiro', 'Urgente', 'Lembrete'];

  // Filters notes based on Search Query, Category & Tags
  const filteredNotes = notes.filter(note => {
    const matchesSearch = 
      note.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      note.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
      note.tags.some(t => t.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesCategory = 
      activeCategoryFilter === 'Todos' || 
      note.category === activeCategoryFilter;

    const matchesTag = 
      activeTagFilter === 'Todos' || 
      note.tags.includes(activeTagFilter);

    return matchesSearch && matchesCategory && matchesTag;
  });

  // Separate pinned and unpinned
  const pinnedNotes = filteredNotes.filter(n => n.pinned);
  const unpinnedNotes = filteredNotes.filter(n => !n.pinned);

  // Category Color badges mapper
  const getCategoryStyles = (category: DailyNote['category']) => {
    switch (category) {
      case 'Ideia':
        return 'bg-indigo-50 text-indigo-700 border-indigo-200/50';
      case 'Financeiro':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200/50';
      case 'Operacional':
        return 'bg-blue-50 text-blue-700 border-blue-200/50';
      case 'Urgente':
        return 'bg-rose-50 text-rose-700 border-rose-200/50 animate-pulse';
      case 'Lembrete':
        return 'bg-amber-50 text-amber-700 border-amber-200/50';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  // Card Color Presets for Note Form
  const colorPresets = [
    { value: 'bg-amber-50/70 border-amber-200 text-amber-950', name: 'Amarelo Suave' },
    { value: 'bg-blue-50/70 border-blue-200 text-blue-950', name: 'Azul Celeste' },
    { value: 'bg-emerald-50/70 border-emerald-200 text-emerald-950', name: 'Verde Menta' },
    { value: 'bg-indigo-50/70 border-indigo-200 text-indigo-950', name: 'Índigo' },
    { value: 'bg-rose-50/70 border-rose-200 text-rose-950', name: 'Rosa Claro' },
    { value: 'bg-purple-50/70 border-purple-200 text-purple-950', name: 'Lilás' },
    { value: 'bg-slate-50 border-slate-200 text-slate-900', name: 'Cinza Minimal' }
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -15 }}
      className="space-y-6"
      id="view-caderno-notebook"
    >
      {/* Title & Introduction Banner */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-xl font-extrabold text-slate-800 tracking-tight flex items-center gap-2">
            <Notebook className="text-blue-600 animate-pulse" size={24} />
            <span>Caderno Diário de Operações</span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">Registre ideias de roteamento, lembretes financeiros, ocorrências do dia e insights operacionais.</p>
        </div>

        <button
          onClick={handleOpenCreateModal}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-xs font-bold rounded-xl shadow-md shadow-blue-100 flex items-center gap-1.5 transition-all cursor-pointer"
        >
          <Plus size={14} />
          <span>Nova Nota Diária</span>
        </button>
      </div>

      {/* Main Grid Layout: Interactive Notepad (Left) + Notes Grid (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        
        {/* LEFT COLUMN: Scratchpad & Quick Filters */}
        <div className="space-y-6 lg:col-span-1">
          
          {/* Quick Scratchpad */}
          <div className="bg-white border border-slate-100 rounded-2xl shadow-sm p-4 relative overflow-hidden flex flex-col h-[320px]">
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-400 to-amber-200" />
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-extrabold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <StickyNote size={13} className="text-amber-500" />
                <span>Rascunho Rápido</span>
              </span>
              <div className="flex items-center gap-1">
                {scratchpad.trim() && (
                  <>
                    <button
                      onClick={handleConvertScratchpadToNote}
                      className="p-1 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded transition-colors cursor-pointer"
                      title="Salvar como Nota Oficial"
                    >
                      <Save size={12} />
                    </button>
                    <button
                      onClick={handleClearScratchpad}
                      className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors cursor-pointer"
                      title="Limpar Rascunho"
                    >
                      <Trash2 size={12} />
                    </button>
                  </>
                )}
              </div>
            </div>

            <textarea
              value={scratchpad}
              onChange={handleScratchpadChange}
              placeholder="Digite livremente ideias rápidas aqui... Salva instantaneamente de forma automática!"
              className="w-full flex-1 p-2 text-xs bg-amber-50/20 border border-slate-100 rounded-xl focus:outline-none focus:ring-1 focus:ring-amber-300 resize-none font-sans text-slate-700 placeholder-slate-400 leading-relaxed"
            />

            <div className="mt-2.5 flex items-center justify-between text-[10px] text-slate-400">
              <span className="font-mono">{scratchpad.length} caracteres</span>
              {scratchpad.trim() && (
                <button
                  onClick={handleConvertScratchpadToNote}
                  className="font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1"
                >
                  <span>Tornar Nota</span>
                  <Plus size={10} />
                </button>
              )}
            </div>
          </div>

          {/* Quick Filter Sidebar */}
          <div className="bg-white border border-slate-100 rounded-2xl shadow-sm p-4 space-y-4">
            <div>
              <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block mb-2">Filtrar por Categoria</span>
              <div className="flex flex-col gap-1">
                <button
                  onClick={() => setActiveCategoryFilter('Todos')}
                  className={`w-full text-left px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center justify-between transition-all cursor-pointer ${
                    activeCategoryFilter === 'Todos'
                      ? 'bg-blue-50 text-blue-700 font-bold'
                      : 'text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <span>Todas</span>
                  <span className="text-[9px] px-1 bg-slate-150 text-slate-500 rounded">{notes.length}</span>
                </button>
                {categories.map(cat => {
                  const count = notes.filter(n => n.category === cat).length;
                  return (
                    <button
                      key={cat}
                      onClick={() => setActiveCategoryFilter(cat)}
                      className={`w-full text-left px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center justify-between transition-all cursor-pointer ${
                        activeCategoryFilter === cat
                          ? 'bg-blue-50 text-blue-700 font-bold'
                          : 'text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      <span>{cat}</span>
                      <span className="text-[9px] px-1 bg-slate-100 text-slate-500 rounded">{count}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {allTags.length > 0 && (
              <div>
                <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block mb-2">Marcadores (#Tags)</span>
                <div className="flex flex-wrap gap-1">
                  <button
                    onClick={() => setActiveTagFilter('Todos')}
                    className={`px-2 py-1 text-[10px] font-bold rounded-lg border transition-all cursor-pointer ${
                      activeTagFilter === 'Todos'
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-slate-50 text-slate-500 border-slate-100 hover:border-slate-200'
                    }`}
                  >
                    Todos
                  </button>
                  {allTags.map(tag => (
                    <button
                      key={tag}
                      onClick={() => setActiveTagFilter(tag)}
                      className={`px-2 py-1 text-[10px] font-mono font-bold rounded-lg border transition-all flex items-center gap-1 cursor-pointer ${
                        activeTagFilter === tag
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'bg-slate-50 text-slate-500 border-slate-150 hover:bg-slate-100'
                      }`}
                    >
                      <Tag size={8} />
                      <span>#{tag}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

        </div>

        {/* RIGHT COLUMN: Notes stage (Search + Grid) */}
        <div className="lg:col-span-3 space-y-6">
          
          {/* Search bar & statistics card */}
          <div className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar nota por título, conteúdo ou marcadores..."
                className="w-full pl-10 pr-4 py-2 text-xs bg-slate-50 border border-slate-100 rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              {searchQuery && (
                <button 
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <X size={12} />
                </button>
              )}
            </div>

            <div className="flex items-center gap-4 text-xs font-semibold text-slate-500">
              <div className="flex items-center gap-1">
                <span className="text-slate-800 font-bold">{filteredNotes.length}</span>
                <span>filtradas</span>
              </div>
              <div className="w-1.5 h-1.5 rounded-full bg-slate-200" />
              <div className="flex items-center gap-1">
                <span className="text-slate-800 font-bold">{notes.filter(n => n.pinned).length}</span>
                <span>fixadas</span>
              </div>
            </div>
          </div>

          {/* Fallback Empty State */}
          {filteredNotes.length === 0 && (
            <div className="bg-white border border-slate-100 rounded-3xl p-12 text-center shadow-sm flex flex-col items-center max-w-2xl mx-auto">
              <div className="p-4 bg-blue-50 rounded-full text-blue-600 mb-4 animate-bounce">
                <Notebook size={32} />
              </div>
              <h3 className="text-base font-extrabold text-slate-800">Nenhuma nota diária encontrada</h3>
              <p className="text-xs text-slate-400 mt-1 max-w-sm">Use o campo de busca acima, limpe os filtros ativos ou crie um novo registro operacional para acompanhar a rotina da sua central.</p>
              
              <div className="mt-6 flex flex-wrap justify-center gap-2.5">
                {(searchQuery || activeCategoryFilter !== 'Todos' || activeTagFilter !== 'Todos') && (
                  <button
                    onClick={() => {
                      setSearchQuery('');
                      setActiveCategoryFilter('Todos');
                      setActiveTagFilter('Todos');
                    }}
                    className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-600 text-xs font-bold rounded-xl transition-all cursor-pointer"
                  >
                    Limpar Filtros e Busca
                  </button>
                )}
                <button
                  onClick={handleOpenCreateModal}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-md transition-all cursor-pointer"
                >
                  Adicionar Nota
                </button>
              </div>
            </div>
          )}

          {/* NOTES FLOW CONTAINER */}
          <div className="space-y-6">
            
            {/* PINNED NOTES SECTION */}
            {pinnedNotes.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center gap-1.5 px-1">
                  <Pin size={13} className="text-blue-500 rotate-45 animate-bounce" />
                  <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">Notas Fixadas e Prioritárias</span>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {pinnedNotes.map(note => (
                    <NoteCard 
                      key={note.id} 
                      note={note} 
                      onEdit={handleOpenEditModal}
                      onDelete={handleDeleteNote}
                      onPinToggle={handleTogglePin}
                      onTodoToggle={handleToggleTodo}
                      onCopy={handleCopyNote}
                      onDownload={handleDownloadNote}
                      getCategoryStyles={getCategoryStyles}
                      formatDateTime={formatDateTime}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* OTHER NOTES SECTION */}
            {unpinnedNotes.length > 0 && (
              <div className="space-y-3">
                {pinnedNotes.length > 0 && (
                  <div className="flex items-center gap-1.5 px-1 pt-2 border-t border-slate-100">
                    <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">Todas as Notas Diárias</span>
                  </div>
                )}
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {unpinnedNotes.map(note => (
                    <NoteCard 
                      key={note.id} 
                      note={note} 
                      onEdit={handleOpenEditModal}
                      onDelete={handleDeleteNote}
                      onPinToggle={handleTogglePin}
                      onTodoToggle={handleToggleTodo}
                      onCopy={handleCopyNote}
                      onDownload={handleDownloadNote}
                      getCategoryStyles={getCategoryStyles}
                      formatDateTime={formatDateTime}
                    />
                  ))}
                </div>
              </div>
            )}

          </div>

        </div>

      </div>

      {/* COMPREHENSIVE NOTE MODAL (Add / Edit Note) */}
      <AnimatePresence>
        {isNoteModalOpen && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsNoteModalOpen(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />

            {/* Dialog Container */}
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 10 }}
              className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[90vh] z-10"
            >
              
              {/* Header */}
              <div className="p-5 border-b border-slate-50 flex items-center justify-between bg-slate-50/50">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
                    <Notebook size={16} />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-slate-800 text-sm">
                      {editingNote ? 'Editar Registro Diário' : 'Novo Registro Diário'}
                    </h3>
                    <p className="text-[10px] text-slate-400">Insira as anotações do turno operacional ou suas ideias.</p>
                  </div>
                </div>

                <button
                  onClick={() => setIsNoteModalOpen(false)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer transition-colors"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Form Content Scrollable Area */}
              <form onSubmit={handleSaveNote} className="flex-1 overflow-y-auto p-5.5 space-y-4">
                
                {/* Title */}
                <div className="space-y-1">
                  <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block">Título do Registro</label>
                  <input
                    type="text"
                    required
                    value={formTitle}
                    onChange={(e) => setFormTitle(e.target.value)}
                    placeholder="Ex: 💡 Nova Faixa de CEP Centro ou Ocorrência Paulista"
                    className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 focus:border-blue-500 rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500 font-semibold text-slate-800"
                  />
                </div>

                {/* Category & Color Selector */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block">Categoria</label>
                    <div className="relative">
                      <select
                        value={formCategory}
                        onChange={(e) => setFormCategory(e.target.value as DailyNote['category'])}
                        className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500 font-bold text-slate-700 cursor-pointer appearance-none"
                      >
                        {categories.map(cat => (
                          <option key={cat} value={cat}>{cat}</option>
                        ))}
                      </select>
                      <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block">Aparência do Card</label>
                    <div className="relative">
                      <select
                        value={formColor}
                        onChange={(e) => setFormColor(e.target.value)}
                        className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500 font-bold text-slate-700 cursor-pointer appearance-none"
                      >
                        {colorPresets.map(color => (
                          <option key={color.value} value={color.value}>{color.name}</option>
                        ))}
                      </select>
                      <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                    </div>
                  </div>
                </div>

                {/* Main Content Body */}
                <div className="space-y-1">
                  <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block">Conteúdo / Descrição</label>
                  <textarea
                    rows={5}
                    value={formContent}
                    onChange={(e) => setFormContent(e.target.value)}
                    placeholder="Escreva detalhadamente o registro, observação logística, ideia de tarifa ou anotação operacional do turno..."
                    className="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-200 focus:border-blue-500 rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500 text-slate-700 leading-relaxed font-sans placeholder-slate-400"
                  />
                </div>

                {/* Interactive Checklist (Todos builder) */}
                <div className="space-y-2">
                  <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block">Checklist / Subtarefas Operacionais</label>
                  
                  {/* Form todo list */}
                  {formTodos.length > 0 && (
                    <div className="space-y-1.5 p-3.5 bg-slate-50/50 border border-slate-100 rounded-xl max-h-[140px] overflow-y-auto">
                      {formTodos.map(todo => (
                        <div key={todo.id} className="flex items-center justify-between gap-2 text-xs text-slate-700 font-medium">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                            <span className="truncate leading-normal">{todo.text}</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleRemoveTodoFromForm(todo.id)}
                            className="text-slate-400 hover:text-rose-500 p-0.5 cursor-pointer"
                            title="Remover item"
                          >
                            <Trash2 size={11} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Todo Input field */}
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={newTodoText}
                      onChange={(e) => setNewTodoText(e.target.value)}
                      placeholder="Adicione uma tarefa (ex: 'Contatar entregador'...)"
                      className="flex-1 px-3.5 py-1.5 text-xs bg-slate-50 border border-slate-200 focus:border-blue-500 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 font-medium text-slate-700 placeholder-slate-400"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddTodoToForm();
                        }
                      }}
                    />
                    <button
                      type="button"
                      onClick={handleAddTodoToForm}
                      className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-700 text-xs font-bold rounded-lg transition-colors cursor-pointer"
                    >
                      Inserir
                    </button>
                  </div>
                </div>

                {/* Comma-separated Tags */}
                <div className="space-y-1">
                  <div className="flex justify-between items-center">
                    <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block">Marcadores (#Tags)</label>
                    <span className="text-[9px] text-slate-400">Separar por vírgula</span>
                  </div>
                  <input
                    type="text"
                    value={formTagsString}
                    onChange={(e) => setFormTagsString(e.target.value)}
                    placeholder="Ex: ceps, urgentes, rotas, paulista"
                    className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 focus:border-blue-500 rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500 font-semibold text-slate-700 placeholder-slate-350"
                  />
                </div>

              </form>

              {/* Footer Actions */}
              <div className="p-4 border-t border-slate-50 bg-slate-50/50 flex items-center justify-end gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsNoteModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-600 text-xs font-bold rounded-xl transition-all cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSaveNote}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-xs font-bold rounded-xl shadow-md transition-all cursor-pointer"
                >
                  {editingNote ? 'Salvar Alterações' : 'Criar Registro'}
                </button>
              </div>

            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </motion.div>
  );
}

// Subcomponent: Individual Note Card for cleaner modular rendering
interface NoteCardProps {
  key?: React.Key | string;
  note: DailyNote;
  onEdit: (note: DailyNote) => void;
  onDelete: (id: string) => void;
  onPinToggle: (id: string) => void;
  onTodoToggle: (noteId: string, todoId: string) => void;
  onCopy: (note: DailyNote) => void;
  onDownload: (note: DailyNote) => void;
  getCategoryStyles: (category: DailyNote['category']) => string;
  formatDateTime: (isoString: string) => string;
}

function NoteCard({ 
  note, 
  onEdit, 
  onDelete, 
  onPinToggle, 
  onTodoToggle, 
  onCopy, 
  onDownload, 
  getCategoryStyles, 
  formatDateTime 
}: NoteCardProps) {
  return (
    <div 
      className={`p-4 border shadow-sm rounded-2xl flex flex-col justify-between transition-all duration-200 hover:shadow-md relative group ${
        note.color || 'bg-white border-slate-100'
      }`}
    >
      
      {/* Pin Overlay Toggle Button */}
      <button
        onClick={() => onPinToggle(note.id)}
        className={`absolute top-3.5 right-3.5 p-1 rounded-lg transition-all cursor-pointer ${
          note.pinned 
            ? 'text-blue-600 bg-blue-50 rotate-45' 
            : 'text-slate-400 opacity-0 group-hover:opacity-100 focus:opacity-100 hover:bg-slate-100 hover:text-slate-600'
        }`}
        title={note.pinned ? "Desfixar nota" : "Fixar nota no topo"}
      >
        <Pin size={12} />
      </button>

      <div>
        {/* Header Metadata */}
        <div className="flex items-center gap-2 mb-2">
          <span className={`px-2 py-0.5 text-[9px] font-extrabold uppercase border rounded-md tracking-wider ${getCategoryStyles(note.category)}`}>
            {note.category}
          </span>
          <span className="text-[10px] text-slate-400 font-medium flex items-center gap-1">
            <Calendar size={10} />
            <span>{formatDateTime(note.createdAt)}</span>
          </span>
        </div>

        {/* Title */}
        <h4 className="font-extrabold text-slate-800 text-sm tracking-tight leading-snug pr-6 mb-1.5">
          {note.title}
        </h4>

        {/* Content paragraph */}
        <p className="text-[11px] text-slate-600 font-medium leading-relaxed whitespace-pre-wrap break-words">
          {note.content}
        </p>

        {/* Dynamic Nested Interactive Checklists (Todos) */}
        {note.todos && note.todos.length > 0 && (
          <div className="mt-3.5 space-y-1.5 pt-3 border-t border-slate-100/40">
            <span className="text-[9px] text-slate-400 font-extrabold uppercase tracking-wider block">Fluxo de tarefas do registro</span>
            <div className="space-y-1">
              {note.todos.map(todo => (
                <button
                  key={todo.id}
                  onClick={() => onTodoToggle(note.id, todo.id)}
                  className="w-full flex items-start gap-2.5 text-left text-[11px] font-medium text-slate-600 hover:text-slate-800 group/todo cursor-pointer py-0.5"
                >
                  <span className="mt-0.5 shrink-0 text-slate-400 group-hover/todo:text-blue-500 transition-colors">
                    {todo.completed ? (
                      <CheckSquare size={13} className="text-blue-600" />
                    ) : (
                      <Square size={13} />
                    )}
                  </span>
                  <span className={`leading-snug break-words ${todo.completed ? 'line-through text-slate-400 decoration-slate-300' : ''}`}>
                    {todo.text}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Footer Details: Tags + Actions */}
      <div className="mt-4 pt-3 border-t border-slate-100/40 flex items-center justify-between gap-3 flex-wrap">
        
        {/* Note tag pills */}
        <div className="flex flex-wrap gap-1">
          {note.tags.map(tag => (
            <span key={tag} className="text-[9px] font-mono font-bold text-slate-500 bg-slate-100/60 border border-slate-200/20 px-1.5 py-0.2 rounded-md">
              #{tag}
            </span>
          ))}
          {note.tags.length === 0 && (
            <span className="text-[9px] italic text-slate-350">Sem marcadores</span>
          )}
        </div>

        {/* Action icons row */}
        <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
          <button
            onClick={() => onCopy(note)}
            className="p-1.5 rounded text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer transition-colors"
            title="Copiar anotação"
          >
            <Copy size={11} />
          </button>
          
          <button
            onClick={() => onDownload(note)}
            className="p-1.5 rounded text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer transition-colors"
            title="Baixar em formato de texto"
          >
            <Download size={11} />
          </button>

          <button
            onClick={() => onEdit(note)}
            className="p-1.5 rounded text-slate-400 hover:text-blue-600 hover:bg-blue-50 cursor-pointer transition-colors"
            title="Editar registro"
          >
            <Edit3 size={11} />
          </button>
          
          <button
            onClick={() => onDelete(note.id)}
            className="p-1.5 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 cursor-pointer transition-colors"
            title="Excluir nota"
          >
            <Trash2 size={11} />
          </button>
        </div>

      </div>

    </div>
  );
}
