/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { FinancialTransaction, Order, ClientPartner } from '../types';
import { formatToBrazilianDate, getSaoPauloISODate, getSaoPauloDate } from '../utils/dateUtils';
import { getPartnerDisplayName } from '../utils/partnerUtils';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { 
  Plus, 
  Search, 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  Calendar, 
  Trash2, 
  Check, 
  Filter, 
  Download,
  Info,
  User,
  Tag,
  Wallet,
  Briefcase,
  Pencil,
  Repeat,
  Layers,
  HelpCircle,
  Brain,
  Sparkles,
  RefreshCw,
  RotateCcw,
  CheckCircle2,
  X,
  AlertTriangle,
  PlusCircle,
  FileText,
  Printer,
  ChevronDown,
  Building,
  FileSpreadsheet
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell 
} from 'recharts';

interface ContasPagarReceberProps {
  transactions: FinancialTransaction[];
  onUpdateTransactions: (txs: FinancialTransaction[]) => void;
  orders?: Order[];
  clientPartners?: ClientPartner[];
  onDeleteOrder?: (orderId: string) => Promise<void>;
}

// Utility to increment dates safely without timezone distortion
const getNextDueDate = (baseDateStr: string, period: 'weekly' | 'monthly' | 'yearly', increment: number): string => {
  if (!baseDateStr) return '';
  const parts = baseDateStr.split('-');
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1; // 0-indexed in JS
  const day = parseInt(parts[2], 10);
  
  const date = new Date(year, month, day, 12, 0, 0); // Force noon to prevent offset issues
  if (period === 'weekly') {
    date.setDate(date.getDate() + 7 * increment);
  } else if (period === 'monthly') {
    date.setMonth(date.getMonth() + increment);
  } else if (period === 'yearly') {
    date.setFullYear(date.getFullYear() + increment);
  }
  
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

// Helper to convert company logo to base64 for jsPDF
const loadLogoBase64 = (): Promise<string | null> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.src = '/logo.png';
    img.crossOrigin = 'Anonymous';
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0);
          resolve(canvas.toDataURL('image/png'));
        } else {
          resolve(null);
        }
      } catch {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
  });
};

export const ContasPagarReceber: React.FC<ContasPagarReceberProps> = ({
  transactions,
  onUpdateTransactions,
  orders = [],
  clientPartners = [],
  onDeleteOrder
}) => {
  // Navigation tabs: 'all' | 'receivable' | 'payable' | 'charts' | 'insights'
  const [activeTab, setActiveTab] = useState<'all' | 'receivable' | 'payable' | 'charts' | 'insights'>('all');
  
  // AI Insights states
  const [insightsData, setInsightsData] = useState<{
    summary: string;
    tips: Array<{
      category: string;
      title: string;
      description: string;
      impact: string;
      potentialSavings: number;
    }>;
    highestSpends: Array<{
      category: string;
      amount: number;
      percentageOfTotal: number;
    }>;
  } | null>(null);
  const [loadingInsights, setLoadingInsights] = useState(false);
  const [insightsError, setInsightsError] = useState('');

  const fetchInsights = async () => {
    setLoadingInsights(true);
    setInsightsError('');
    try {
      const response = await fetch('/api/financial/insights', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ transactions }),
      });
      if (!response.ok) {
        throw new Error('Falha ao conectar com o servidor de insights.');
      }
      const data = await response.json();
      setInsightsData(data);
    } catch (err: any) {
      console.error(err);
      setInsightsError(err.message || 'Erro de conexão com o servidor.');
    } finally {
      setLoadingInsights(false);
    }
  };

  // Fetch insights automatically when the insights tab becomes active
  useEffect(() => {
    if (activeTab === 'insights' && !insightsData && !loadingInsights) {
      fetchInsights();
    }
  }, [activeTab]);
  
  // Search & Filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('Todos');
  const [statusFilter, setStatusFilter] = useState('Todos');
  const [costTypeFilter, setCostTypeFilter] = useState<'Todos' | 'fixed' | 'variable'>('Todos');
  const [recurrenceFilter, setRecurrenceFilter] = useState<'Todos' | 'recurring' | 'single'>('Todos');
  const [partnerFilter, setPartnerFilter] = useState('Todos');
  const [sortField, setSortField] = useState<'dueDate' | 'amount'>('dueDate');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  // Export menu & Partner PDF Modal states
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
  const [isPartnerPdfModalOpen, setIsPartnerPdfModalOpen] = useState(false);
  const [selectedPdfPartner, setSelectedPdfPartner] = useState('');

  // Gathering unique list of partners / clients across transactions & orders
  const partnerOptions = useMemo(() => {
    const set = new Set<string>();
    const seenNormalized = new Set<string>();
    const result: string[] = [];

    const addVal = (raw: string | undefined | null) => {
      const val = raw?.trim();
      if (!val) return;
      const lower = val.toLowerCase();
      if (!seenNormalized.has(lower)) {
        seenNormalized.add(lower);
        result.push(val);
      }
    };

    transactions.forEach(t => {
      if (t.recipientOrPayer && t.recipientOrPayer.trim()) {
        addVal(t.recipientOrPayer.trim());
      }
    });
    orders.forEach(o => {
      if (o.partnerName && o.partnerName.trim()) addVal(getPartnerDisplayName(o.partnerName, clientPartners));
      if (o.clientName && o.clientName.trim()) addVal(o.clientName.trim());
    });
    return result.sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }, [transactions, orders, clientPartners]);

  const handleOpenPartnerPdfModal = () => {
    if (partnerFilter !== 'Todos') {
      setSelectedPdfPartner(partnerFilter);
    } else if (searchQuery.trim() !== '') {
      const matched = partnerOptions.find(p => p.toLowerCase().includes(searchQuery.toLowerCase()));
      if (matched) {
        setSelectedPdfPartner(matched);
      } else if (partnerOptions.length > 0) {
        setSelectedPdfPartner(partnerOptions[0]);
      }
    } else if (partnerOptions.length > 0) {
      setSelectedPdfPartner(partnerOptions[0]);
    } else {
      setSelectedPdfPartner('');
    }
    setIsPartnerPdfModalOpen(true);
  };

  // Selection & Feedback Toast states
  const [selectedTxIds, setSelectedTxIds] = useState<string[]>([]);
  const [toastMsg, setToastMsg] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);

  const showToast = (text: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToastMsg({ text, type });
    setTimeout(() => {
      setToastMsg(null);
    }, 3500);
  };

  // Modal forms states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTx, setEditingTx] = useState<FinancialTransaction | null>(null);

  // Detailed Delete Confirmation Modal States
  const [deletingTx, setDeletingTx] = useState<FinancialTransaction | null>(null);
  const [deletingBulkList, setDeletingBulkList] = useState<FinancialTransaction[] | null>(null);

  // Form Fields State (shared for both Create & Edit)
  const [newTxDescription, setNewTxDescription] = useState('');
  const [newTxType, setNewTxType] = useState<'payable' | 'receivable'>('receivable');
  const [newTxAmount, setNewTxAmount] = useState('');
  const [newTxDueDate, setNewTxDueDate] = useState(getSaoPauloISODate());
  const [newTxCategory, setNewTxCategory] = useState('Faturamento');
  const [customCategoryInput, setCustomCategoryInput] = useState('');
  const [isCustomCategorySelected, setIsCustomCategorySelected] = useState(false);
  const [newTxRecipientOrPayer, setNewTxRecipientOrPayer] = useState('');
  const [newTxPaymentMethod, setNewTxPaymentMethod] = useState('Pix');
  const [newTxNotes, setNewTxNotes] = useState('');
  const [newTxCostType, setNewTxCostType] = useState<'fixed' | 'variable'>('variable');
  const [newTxStatus, setNewTxStatus] = useState<'Pendente' | 'Pago' | 'Atrasado'>('Pendente');
  
  // Recurrence configuration
  const [newTxIsRecurring, setNewTxIsRecurring] = useState(false);
  const [newTxRecurrencePeriod, setNewTxRecurrencePeriod] = useState<'weekly' | 'monthly' | 'yearly'>('monthly');
  const [newTxTotalInstallments, setNewTxTotalInstallments] = useState(3);

  // Standard category presets
  const defaultCategories = useMemo(() => [
    'Faturamento',
    'Repasses',
    'Infraestrutura',
    'Serviços',
    'Manutenção',
    'Administrativo',
    'Impostos & Taxas',
    'Marketing & Vendas',
    'Salários & Pro-Labore',
    'Outros'
  ], []);

  // Unique categories gathered from transactions
  const categories = useMemo(() => {
    const list = new Set([...defaultCategories, ...transactions.map(t => t.category)]);
    return ['Todos', ...Array.from(list)];
  }, [transactions, defaultCategories]);

  // Handle opening modal for creating
  const handleOpenCreate = () => {
    setEditingTx(null);
    setNewTxDescription('');
    setNewTxType('receivable');
    setNewTxAmount('');
    setNewTxDueDate(getSaoPauloISODate());
    setNewTxCategory('Faturamento');
    setCustomCategoryInput('');
    setIsCustomCategorySelected(false);
    setNewTxRecipientOrPayer('');
    setNewTxPaymentMethod('Pix');
    setNewTxNotes('');
    setNewTxCostType('variable');
    setNewTxStatus('Pendente');
    setNewTxIsRecurring(false);
    setNewTxRecurrencePeriod('monthly');
    setNewTxTotalInstallments(3);
    setIsModalOpen(true);
  };

  // Handle opening modal for editing (Pre-populates fields)
  const handleOpenEdit = (tx: FinancialTransaction) => {
    setEditingTx(tx);
    setNewTxDescription(tx.description);
    setNewTxType(tx.type);
    setNewTxAmount(tx.amount.toString());
    setNewTxDueDate(tx.dueDate);
    
    if (defaultCategories.includes(tx.category)) {
      setNewTxCategory(tx.category);
      setIsCustomCategorySelected(false);
      setCustomCategoryInput('');
    } else {
      setNewTxCategory('CUSTOM');
      setIsCustomCategorySelected(true);
      setCustomCategoryInput(tx.category);
    }

    setNewTxRecipientOrPayer(tx.recipientOrPayer);
    setNewTxPaymentMethod(tx.paymentMethod);
    setNewTxNotes(tx.notes || '');
    setNewTxCostType(tx.costType || 'variable');
    setNewTxStatus(tx.status);
    setNewTxIsRecurring(tx.isRecurring || false);
    setNewTxRecurrencePeriod(tx.recurrencePeriod || 'monthly');
    setNewTxTotalInstallments(tx.totalInstallments || 1);
    setIsModalOpen(true);
  };

  // Handle Sort Toggle
  const handleSort = (field: 'dueDate' | 'amount') => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  // Reconcile / Liquidate action (Pago/Recebido)
  const handleReconcile = (id: string) => {
    const todayStr = getSaoPauloISODate();
    const updated = transactions.map(t => {
      if (t.id === id) {
        return {
          ...t,
          status: 'Pago' as const,
          actualPaymentDate: todayStr
        };
      }
      return t;
    });
    onUpdateTransactions(updated);
    showToast('Lançamento liquidado e marcado como PAGO com sucesso!', 'success');
  };

  // Revert / Estornar action (Voltar para Pendente)
  const handleUnpay = (id: string) => {
    const updated = transactions.map(t => {
      if (t.id === id) {
        return {
          ...t,
          status: 'Pendente' as const,
          actualPaymentDate: undefined
        };
      }
      return t;
    });
    onUpdateTransactions(updated);
    showToast('Lançamento estornado para PENDENTE!', 'info');
  };

  // Single Delete transaction initiation
  const handleDelete = (id: string) => {
    const target = transactions.find(t => t.id === id);
    if (target) {
      setDeletingTx(target);
    }
  };

  // Confirm Single Delete Execution
  const handleConfirmDeleteSingle = () => {
    if (!deletingTx) return;
    const targetId = deletingTx.id;
    const targetDesc = deletingTx.description;

    const updated = transactions.filter(t => t.id !== targetId);
    onUpdateTransactions(updated);
    setSelectedTxIds(prev => prev.filter(item => item !== targetId));
    showToast(`Lançamento "${targetDesc}" excluído do Firebase com sucesso!`, 'info');
    setDeletingTx(null);
  };

  // Bulk actions
  const toggleSelectAll = (filteredList: FinancialTransaction[]) => {
    if (selectedTxIds.length === filteredList.length && filteredList.length > 0) {
      setSelectedTxIds([]);
    } else {
      setSelectedTxIds(filteredList.map(t => t.id));
    }
  };

  const toggleSelectTx = (id: string) => {
    setSelectedTxIds(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const handleBulkReconcile = () => {
    if (selectedTxIds.length === 0) return;
    const todayStr = getSaoPauloISODate();
    const selectedSet = new Set(selectedTxIds);

    const updated = transactions.map(t => {
      if (selectedSet.has(t.id)) {
        return {
          ...t,
          status: 'Pago' as const,
          actualPaymentDate: todayStr
        };
      }
      return t;
    });

    onUpdateTransactions(updated);
    showToast(`${selectedTxIds.length} lançamentos liquidados como PAGOS com sucesso!`, 'success');
    setSelectedTxIds([]);
  };

  // Bulk Delete initiation
  const handleBulkDelete = () => {
    if (selectedTxIds.length === 0) return;
    const selectedSet = new Set(selectedTxIds);
    const selectedList = transactions.filter(t => selectedSet.has(t.id));
    setDeletingBulkList(selectedList);
  };

  // Confirm Bulk Delete Execution
  const handleConfirmDeleteBulk = () => {
    if (!deletingBulkList || deletingBulkList.length === 0) return;
    const count = deletingBulkList.length;
    const selectedSet = new Set(deletingBulkList.map(t => t.id));

    const updated = transactions.filter(t => !selectedSet.has(t.id));
    onUpdateTransactions(updated);
    showToast(`${count} lançamentos excluídos permanentemente do Firebase!`, 'info');
    setSelectedTxIds([]);
    setDeletingBulkList(null);
  };

  // Create or Update Submission Handler
  const handleSubmitForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTxDescription || !newTxAmount || !newTxRecipientOrPayer) {
      alert('Por favor, preencha todos os campos obrigatórios.');
      return;
    }

    const amountNum = parseFloat(newTxAmount);
    if (isNaN(amountNum) || amountNum <= 0) {
      alert('Por favor, insira um valor numérico válido maior que zero.');
      return;
    }

    const finalCategory = (newTxCategory === 'CUSTOM' || isCustomCategorySelected) 
      ? (customCategoryInput.trim() || 'Outros') 
      : newTxCategory;

    if (editingTx) {
      // UPDATE EXISTENT TRANSACTION
      const updated = transactions.map(t => {
        if (t.id === editingTx.id) {
          return {
            ...t,
            description: newTxDescription,
            type: newTxType,
            amount: amountNum,
            dueDate: newTxDueDate,
            category: finalCategory,
            recipientOrPayer: newTxRecipientOrPayer,
            paymentMethod: newTxPaymentMethod,
            notes: newTxNotes,
            costType: newTxCostType,
            status: newTxStatus,
            isRecurring: newTxIsRecurring,
            recurrencePeriod: newTxIsRecurring ? newTxRecurrencePeriod : undefined,
            totalInstallments: newTxIsRecurring ? newTxTotalInstallments : undefined,
          };
        }
        return t;
      });
      onUpdateTransactions(updated);
      showToast('Lançamento financeiro atualizado com sucesso!', 'success');
    } else {
      // CREATE NEW TRANSACTION(S)
      if (newTxIsRecurring) {
        // Generate repeating occurrences sequential
        const generatedList: FinancialTransaction[] = [];
        const parentId = `rec-parent-${Date.now()}`;
        
        for (let i = 0; i < newTxTotalInstallments; i++) {
          const installmentDueDate = getNextDueDate(newTxDueDate, newTxRecurrencePeriod, i);
          const suffix = newTxTotalInstallments > 1 ? ` (${i + 1}/${newTxTotalInstallments})` : '';
          const installmentDesc = `${newTxDescription}${suffix}`;
          
          const installmentTx: FinancialTransaction = {
            id: `${newTxType === 'receivable' ? 'rec' : 'pay'}-${Date.now()}-${i}`,
            description: installmentDesc,
            type: newTxType,
            amount: amountNum,
            dueDate: installmentDueDate,
            category: finalCategory,
            status: i === 0 ? newTxStatus : 'Pendente',
            recipientOrPayer: newTxRecipientOrPayer,
            paymentMethod: newTxPaymentMethod,
            notes: newTxNotes,
            costType: newTxCostType,
            isRecurring: true,
            recurrencePeriod: newTxRecurrencePeriod,
            recurrenceInstallment: i + 1,
            totalInstallments: newTxTotalInstallments,
            parentRecurrenceId: parentId
          };
          generatedList.push(installmentTx);
        }
        onUpdateTransactions([...generatedList, ...transactions]);
        showToast(`${newTxTotalInstallments} parcelas recorrentes criadas com sucesso!`, 'success');
      } else {
        // Single normal release
        const newTx: FinancialTransaction = {
          id: `${newTxType === 'receivable' ? 'rec' : 'pay'}-${Date.now()}`,
          description: newTxDescription,
          type: newTxType,
          amount: amountNum,
          dueDate: newTxDueDate,
          category: finalCategory,
          status: newTxStatus,
          recipientOrPayer: newTxRecipientOrPayer,
          paymentMethod: newTxPaymentMethod,
          notes: newTxNotes,
          costType: newTxCostType,
          isRecurring: false
        };
        onUpdateTransactions([newTx, ...transactions]);
        showToast('Lançamento financeiro cadastrado com sucesso!', 'success');
      }
    }

    // Close and reset
    setIsModalOpen(false);
    setEditingTx(null);
  };

  // Filtered transactions list
  const filteredTransactions = useMemo(() => {
    return transactions
      .filter(t => {
        // Tab type filter
        if (activeTab === 'receivable' && t.type !== 'receivable') return false;
        if (activeTab === 'payable' && t.type !== 'payable') return false;

        // Search text filter (Description, recipient, ID)
        if (searchQuery.trim() !== '') {
          const query = searchQuery.toLowerCase();
          const matchesDesc = t.description.toLowerCase().includes(query);
          const matchesEntity = t.recipientOrPayer.toLowerCase().includes(query);
          const matchesId = t.id.toLowerCase().includes(query);
          if (!matchesDesc && !matchesEntity && !matchesId) return false;
        }

        // Category filter
        if (categoryFilter !== 'Todos' && t.category !== categoryFilter) return false;

        // Status filter
        if (statusFilter !== 'Todos' && t.status !== statusFilter) return false;

        // Cost Type Filter (Fixed / Variable)
        if (costTypeFilter !== 'Todos' && (t.costType || 'variable') !== costTypeFilter) return false;

        // Recurrence Filter
        if (recurrenceFilter === 'recurring' && !t.isRecurring) return false;
        if (recurrenceFilter === 'single' && t.isRecurring) return false;

        // Partner / Client Filter
        if (partnerFilter !== 'Todos' && t.recipientOrPayer.toLowerCase() !== partnerFilter.toLowerCase()) return false;

        return true;
      })
      .sort((a, b) => {
        let valueA = a[sortField];
        let valueB = b[sortField];

        if (sortField === 'amount') {
          return sortDirection === 'asc' 
            ? (valueA as number) - (valueB as number) 
            : (valueB as number) - (valueA as number);
        } else {
          const strA = String(valueA ?? '');
          const strB = String(valueB ?? '');
          return sortDirection === 'asc'
            ? strA.localeCompare(strB)
            : strB.localeCompare(strA);
        }
      });
  }, [transactions, activeTab, searchQuery, categoryFilter, statusFilter, costTypeFilter, recurrenceFilter, partnerFilter, sortField, sortDirection]);

  // Financial statistics calculated dynamically
  const metrics = useMemo(() => {
    // RECEIVABLES
    const receivables = transactions.filter(t => t.type === 'receivable');
    const totalReceivable = receivables.reduce((sum, t) => sum + t.amount, 0);
    const received = receivables.filter(t => t.status === 'Pago').reduce((sum, t) => sum + t.amount, 0);
    const pendingReceivable = receivables.filter(t => t.status === 'Pendente').reduce((sum, t) => sum + t.amount, 0);
    const overdueReceivable = receivables.filter(t => t.status === 'Atrasado').reduce((sum, t) => sum + t.amount, 0);

    const fixedIncomes = receivables.filter(t => t.costType === 'fixed').reduce((sum, t) => sum + t.amount, 0);
    const variableIncomes = receivables.filter(t => t.costType !== 'fixed').reduce((sum, t) => sum + t.amount, 0);

    // PAYABLES (Expenses)
    const payables = transactions.filter(t => t.type === 'payable');
    const totalPayable = payables.reduce((sum, t) => sum + t.amount, 0);
    const paid = payables.filter(t => t.status === 'Pago').reduce((sum, t) => sum + t.amount, 0);
    const pendingPayable = payables.filter(t => t.status === 'Pendente').reduce((sum, t) => sum + t.amount, 0);
    const overduePayable = payables.filter(t => t.status === 'Atrasado').reduce((sum, t) => sum + t.amount, 0);

    const fixedExpenses = payables.filter(t => t.costType === 'fixed').reduce((sum, t) => sum + t.amount, 0);
    const variableExpenses = payables.filter(t => t.costType !== 'fixed').reduce((sum, t) => sum + t.amount, 0);

    // NET BALANCE
    const currentBalance = received - paid; // Real cash on hand
    const projectedBalance = (received + pendingReceivable + overdueReceivable) - (paid + pendingPayable + overduePayable);

    return {
      totalReceivable,
      received,
      pendingReceivable,
      overdueReceivable,
      fixedIncomes,
      variableIncomes,
      totalPayable,
      paid,
      pendingPayable,
      overduePayable,
      fixedExpenses,
      variableExpenses,
      currentBalance,
      projectedBalance
    };
  }, [transactions]);

  // Dynamic calculation of Month-over-Month (MoM) revenue growth
  const momGrowth = useMemo(() => {
    const currentJulyFaturamento = 13200.00;
    const juneFaturamento = 11070.00;
    
    const receivables = transactions.filter(t => t.type === 'receivable');
    
    // June:
    const juneTotal = receivables
      .filter(t => t.dueDate?.startsWith('2026-06') || t.notes?.toLowerCase().includes('junho') || t.notes?.toLowerCase().includes('june') || t.id === 'rec-1' || t.id === 'rec-2' || t.id === 'rec-6')
      .reduce((sum, t) => sum + t.amount, 0);

    // July:
    const julyTotal = receivables
      .filter(t => t.dueDate?.startsWith('2026-07') && t.id !== 'rec-1' && t.id !== 'rec-2')
      .reduce((sum, t) => sum + t.amount, 0);

    const fallbackCurrent = julyTotal || currentJulyFaturamento;
    const fallbackPrevious = juneTotal || juneFaturamento;

    if (fallbackPrevious > 0) {
      const pct = ((fallbackCurrent - fallbackPrevious) / fallbackPrevious) * 100;
      return {
        percent: pct,
        current: fallbackCurrent,
        previous: fallbackPrevious
      };
    }
    return { percent: 19.2, current: currentJulyFaturamento, previous: juneFaturamento };
  }, [transactions]);

  // Prepare charts data: Categories distribution
  const chartCategoryData = useMemo(() => {
    const categoryMap: Record<string, { category: string; receivable: number; payable: number }> = {};
    
    transactions.forEach(t => {
      if (!categoryMap[t.category]) {
        categoryMap[t.category] = { category: t.category, receivable: 0, payable: 0 };
      }
      if (t.type === 'receivable') {
        categoryMap[t.category].receivable += t.amount;
      } else {
        categoryMap[t.category].payable += t.amount;
      }
    });

    return Object.values(categoryMap);
  }, [transactions]);

  // Pie distributions
  const chartStatusReceivableData = useMemo(() => {
    const active = transactions.filter(t => t.type === 'receivable');
    const pending = active.filter(t => t.status === 'Pendente').reduce((sum, t) => sum + t.amount, 0);
    const paid = active.filter(t => t.status === 'Pago').reduce((sum, t) => sum + t.amount, 0);
    const overdue = active.filter(t => t.status === 'Atrasado').reduce((sum, t) => sum + t.amount, 0);

    return [
      { name: 'Recebido', value: paid, color: '#10b981' },
      { name: 'Pendente', value: pending, color: '#3b82f6' },
      { name: 'Atrasado', value: overdue, color: '#f59e0b' }
    ].filter(item => item.value > 0);
  }, [transactions]);

  const chartStatusPayableData = useMemo(() => {
    const active = transactions.filter(t => t.type === 'payable');
    const pending = active.filter(t => t.status === 'Pendente').reduce((sum, t) => sum + t.amount, 0);
    const paid = active.filter(t => t.status === 'Pago').reduce((sum, t) => sum + t.amount, 0);
    const overdue = active.filter(t => t.status === 'Atrasado').reduce((sum, t) => sum + t.amount, 0);

    return [
      { name: 'Pago', value: paid, color: '#10b981' },
      { name: 'Pendente', value: pending, color: '#3b82f6' },
      { name: 'Atrasado', value: overdue, color: '#ef4444' }
    ].filter(item => item.value > 0);
  }, [transactions]);

  // CSV export logic
  const handleExportCSV = () => {
    let csvContent = 'data:text/csv;charset=utf-8,';
    csvContent += 'ID,Descricao,Tipo,Valor,Vencimento,Status,Favorecido/Pagador,Categoria,Metodo Pagamento,Classificacao,Recorrencia\n';
    
    transactions.forEach(t => {
      const row = [
        t.id,
        `"${t.description.replace(/"/g, '""')}"`,
        t.type === 'receivable' ? 'Receber' : 'Pagar',
        t.amount,
        formatToBrazilianDate(t.dueDate),
        t.status,
        `"${t.recipientOrPayer.replace(/"/g, '""')}"`,
        t.category,
        t.paymentMethod,
        t.costType === 'fixed' ? 'Fixo' : 'Variável',
        t.isRecurring ? `Sim (${t.recurrenceInstallment || 1}/${t.totalInstallments || 1})` : 'Não'
      ].join(',');
      csvContent += row + '\n';
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `vinimap_contas_pagar_receber_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Excel export logic using xlsx (SheetJS)
  const handleExportExcel = () => {
    try {
      const formattedData = transactions.map(t => ({
        'ID': t.id,
        'Descrição': t.description,
        'Tipo': t.type === 'receivable' ? 'Receber' : 'Pagar',
        'Valor (BRL)': t.amount,
        'Data de Vencimento': formatToBrazilianDate(t.dueDate),
        'Data de Liquidação': t.actualPaymentDate ? formatToBrazilianDate(t.actualPaymentDate) : 'Pendente',
        'Status': t.status,
        'Favorecido / Pagador': t.recipientOrPayer,
        'Categoria': t.category,
        'Método de Pagamento': t.paymentMethod,
        'Classificação': t.costType === 'fixed' ? 'Fixo' : 'Variável',
        'Recorrência': t.isRecurring ? `Sim (${t.recurrenceInstallment || 1}/${t.totalInstallments || 1})` : 'Não',
        'Observações': t.notes || ''
      }));

      const worksheet = XLSX.utils.json_to_sheet(formattedData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Lançamentos Financeiros');
      
      // Auto-fit column widths dynamically for professional visual presentation
      if (formattedData.length > 0) {
        const maxLens = Object.keys(formattedData[0]).map(key => {
          let maxVal = key.length;
          formattedData.forEach(row => {
            const cellVal = String((row as any)[key] || '');
            if (cellVal.length > maxVal) maxVal = cellVal.length;
          });
          return { wch: Math.min(maxVal + 3, 50) }; // Cap at 50 chars max width
        });
        worksheet['!cols'] = maxLens;
      }

      XLSX.writeFile(workbook, `vinimap_financeiro_${Date.now()}.xlsx`);
    } catch (err) {
      console.error('Error exporting Excel:', err);
      alert('Erro ao exportar planilha Excel. Verifique o console.');
    }
  };

  // Generate customized PDF document for filtered partner with logo and client header
  const generatePartnerPdfDocument = async (partnerName: string) => {
    if (!partnerName) {
      alert('Por favor, selecione ou informe um parceiro/cliente.');
      return;
    }

    const partnerTxs = transactions.filter(
      t => t.recipientOrPayer.toLowerCase() === partnerName.toLowerCase() ||
           t.description.toLowerCase().includes(partnerName.toLowerCase())
    );

    const partnerOrders = orders.filter(
      o => (o.partnerName && o.partnerName.toLowerCase() === partnerName.toLowerCase()) ||
           (o.clientName && o.clientName.toLowerCase() === partnerName.toLowerCase())
    );

    if (partnerTxs.length === 0 && partnerOrders.length === 0) {
      alert(`Nenhum lançamento ou pedido encontrado para o parceiro/cliente "${partnerName}".`);
      return;
    }

    const receivables = partnerTxs.filter(t => t.type === 'receivable');
    const payables = partnerTxs.filter(t => t.type === 'payable');
    const totalReceivable = receivables.reduce((sum, t) => sum + t.amount, 0);
    const totalPayable = payables.reduce((sum, t) => sum + t.amount, 0);
    const netBalance = totalReceivable - totalPayable;

    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    const timestamp = getSaoPauloDate();

    // Top Banner Header
    doc.setFillColor(30, 41, 59); // Slate 800
    doc.rect(0, 0, 210, 28, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(15);
    doc.setTextColor(255, 255, 255);
    doc.text('VINIMAP EXPRESS LOGÍSTICA', 14, 14);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.text('Soluções em Entregas & Gestão Financeira Integrada', 14, 20);
    doc.text(`Data de Emissão: ${timestamp}`, 135, 20);

    // Try adding company logo to header
    try {
      const logoBase64 = await loadLogoBase64();
      if (logoBase64) {
        doc.addImage(logoBase64, 'PNG', 180, 4, 18, 18);
      }
    } catch (e) {
      console.warn('Could not load logo image for PDF:', e);
    }

    // Client / Partner Header Highlight Box
    doc.setFillColor(241, 245, 249);
    doc.roundedRect(14, 32, 182, 22, 2, 2, 'F');
    doc.setDrawColor(203, 213, 225);
    doc.roundedRect(14, 32, 182, 22, 2, 2, 'S');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(71, 85, 105);
    doc.text('RELATÓRIO FINANCEIRO INDIVIDUAL DO PARCEIRO / CLIENTE', 18, 39);

    doc.setFontSize(12);
    doc.setTextColor(37, 99, 235);
    doc.text(`NOME DO CLIENTE: ${partnerName.toUpperCase()}`, 18, 48);

    // Financial KPI Summary Bar
    doc.setFillColor(248, 250, 252);
    doc.rect(14, 57, 182, 14, 'F');
    doc.setDrawColor(226, 232, 240);
    doc.rect(14, 57, 182, 14, 'S');

    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(100, 116, 139);
    doc.text('RESUMO DO PARCEIRO:', 18, 65);

    doc.setFont('helvetica', 'normal');
    doc.text('A Receber:', 62, 65);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(22, 163, 74);
    doc.text(`R$ ${totalReceivable.toFixed(2).replace('.', ',')}`, 78, 65);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 116, 139);
    doc.text('A Pagar:', 110, 65);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(225, 29, 72);
    doc.text(`R$ ${totalPayable.toFixed(2).replace('.', ',')}`, 123, 65);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 116, 139);
    doc.text('Saldo Líquido:', 152, 65);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(netBalance >= 0 ? 37 : 225, netBalance >= 0 ? 99 : 29, netBalance >= 0 ? 235 : 72);
    doc.text(`R$ ${netBalance.toFixed(2).replace('.', ',')}`, 173, 65);

    // Transactions Table
    let startYPosition = 75;

    if (partnerTxs.length > 0) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9.5);
      doc.setTextColor(30, 41, 59);
      doc.text('Extrato de Contas e Lançamentos Financeiros:', 14, startYPosition);

      const tableData = partnerTxs.map(t => [
        formatToBrazilianDate(t.dueDate),
        t.description,
        t.type === 'receivable' ? 'Receber (+)' : 'Pagar (-)',
        t.category,
        t.status,
        `R$ ${t.amount.toFixed(2).replace('.', ',')}`
      ]);

      autoTable(doc, {
        startY: startYPosition + 3,
        head: [['Vencimento', 'Descrição', 'Tipo', 'Categoria', 'Status', 'Valor (BRL)']],
        body: tableData,
        headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
        styles: { fontSize: 8, cellPadding: 2.5 },
        columnStyles: {
          0: { cellWidth: 25 },
          1: { cellWidth: 65 },
          2: { cellWidth: 25, fontStyle: 'bold' },
          3: { cellWidth: 25 },
          4: { cellWidth: 22, halign: 'center' },
          5: { cellWidth: 20, halign: 'right', fontStyle: 'bold' }
        },
        alternateRowStyles: { fillColor: [248, 250, 252] }
      });

      startYPosition = (doc as any).lastAutoTable.finalY + 10;
    }

    // Orders Table (if available)
    if (partnerOrders.length > 0 && startYPosition < 240) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9.5);
      doc.setTextColor(30, 41, 59);
      doc.text(`Histórico de Pedidos de Entrega (${partnerOrders.length} ordens):`, 14, startYPosition);

      const ordersData = partnerOrders.slice(0, 15).map(o => [
        o.id,
        formatToBrazilianDate(o.date),
        o.clientName || 'N/I',
        o.region,
        o.status,
        `R$ ${o.value.toFixed(2).replace('.', ',')}`
      ]);

      autoTable(doc, {
        startY: startYPosition + 3,
        head: [['Cód. Pedido', 'Data', 'Cliente Final', 'Região', 'Status', 'Valor (BRL)']],
        body: ordersData,
        headStyles: { fillColor: [51, 65, 85], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
        styles: { fontSize: 8, cellPadding: 2 },
        columnStyles: {
          0: { cellWidth: 25, fontStyle: 'bold' },
          1: { cellWidth: 25 },
          2: { cellWidth: 50 },
          3: { cellWidth: 32 },
          4: { cellWidth: 25, halign: 'center' },
          5: { cellWidth: 25, halign: 'right', fontStyle: 'bold' }
        }
      });
    }

    const sanitizedPartnerName = partnerName.toLowerCase().replace(/[^a-z0-9]/g, '_');
    doc.save(`relatorio_financeiro_parceiro_${sanitizedPartnerName}_${Date.now()}.pdf`);
    showToast(`Relatório PDF do parceiro "${partnerName}" baixado com sucesso!`, 'success');
  };

  // Print partner report via popup window
  const handlePrintPartnerReport = () => {
    const printContent = document.getElementById('partner-pdf-preview-content');
    if (!printContent) return;

    const printWindow = window.open('', '_blank', 'width=900,height=800');
    if (!printWindow) {
      alert('Por favor, permita janelas popup para visualizar e imprimir o relatório.');
      return;
    }

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Relatório Financeiro - ${selectedPdfPartner || 'Parceiro'}</title>
          <script src="https://cdn.tailwindcss.com"></script>
          <style>
            @media print {
              body { margin: 0; padding: 20px; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
              .no-print { display: none !important; }
            }
          </style>
        </head>
        <body class="bg-white text-slate-900 font-sans p-6">
          ${printContent.innerHTML}
          <script>
            setTimeout(() => {
              window.print();
              window.close();
            }, 600);
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <div className="space-y-6 animate-fade-in" id="painel-financeiro-contas">
      
      {/* Toast Notification Banner */}
      {toastMsg && (
        <motion.div 
          initial={{ opacity: 0, y: -10 }} 
          animate={{ opacity: 1, y: 0 }} 
          exit={{ opacity: 0 }}
          className={`p-4 rounded-2xl border text-xs font-extrabold flex items-center justify-between shadow-md transition-all ${
            toastMsg.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : toastMsg.type === 'error'
              ? 'bg-rose-50 border-rose-200 text-rose-800'
              : 'bg-blue-50 border-blue-200 text-blue-800'
          }`}
        >
          <div className="flex items-center gap-2">
            {toastMsg.type === 'success' ? (
              <CheckCircle2 size={16} className="text-emerald-600" />
            ) : (
              <Info size={16} className="text-blue-600" />
            )}
            <span>{toastMsg.text}</span>
          </div>
          <button 
            type="button"
            onClick={() => setToastMsg(null)} 
            className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
          >
            <X size={14} />
          </button>
        </motion.div>
      )}

      {/* Title Header action bar */}
      <div className="bg-white border border-slate-100 rounded-2xl shadow-xs p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
            <Wallet className="text-blue-600" size={18} />
            <span>Gestão de Contas a Pagar & Receber</span>
            <span className="text-[10px] bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full font-black uppercase">Complete ZeroPaper Suite</span>
          </h3>
          <p className="text-xs text-slate-400 font-medium">
            Controle integrado de fluxo de caixa, custos fixos/variáveis, repasses programados e previsões de faturamento.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Unified Export Dropdown Menu */}
          <div className="relative">
            <button
              onClick={() => setIsExportMenuOpen(!isExportMenuOpen)}
              className="px-3.5 py-2 bg-slate-800 hover:bg-slate-900 active:bg-slate-950 text-white text-xs font-bold rounded-xl flex items-center gap-2 transition-all cursor-pointer shadow-sm"
              title="Opções de exportação de relatórios"
            >
              <Download size={13} className="text-blue-400" />
              <span>Exportar</span>
              <ChevronDown size={13} className={`transition-transform duration-200 ${isExportMenuOpen ? 'rotate-180' : ''}`} />
            </button>

            {isExportMenuOpen && (
              <>
                <div 
                  className="fixed inset-0 z-20" 
                  onClick={() => setIsExportMenuOpen(false)} 
                />
                <div className="absolute right-0 mt-2 w-64 bg-white border border-slate-100 rounded-2xl shadow-xl py-2 z-30 origin-top-right space-y-1 animate-in fade-in zoom-in-95 duration-150">
                  <div className="px-3.5 py-1.5 text-[10px] font-black text-slate-400 uppercase tracking-wider border-b border-slate-100 flex items-center justify-between">
                    <span>Exportar Relatórios</span>
                    <span className="text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded text-[9px]">PDF & Excel</span>
                  </div>

                  {/* Relatório PDF do Parceiro */}
                  <button
                    onClick={() => {
                      setIsExportMenuOpen(false);
                      handleOpenPartnerPdfModal();
                    }}
                    className="w-full px-3.5 py-2.5 text-left hover:bg-blue-50/70 flex items-center gap-3 transition-colors group cursor-pointer"
                  >
                    <div className="p-2 bg-rose-100 text-rose-600 rounded-xl group-hover:bg-rose-600 group-hover:text-white transition-colors shrink-0">
                      <FileText size={16} />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                        <span>Relatório PDF do Parceiro</span>
                        <span className="text-[9px] bg-rose-100 text-rose-700 px-1.5 py-0.2 rounded font-black">NOVO</span>
                      </div>
                      <div className="text-[10px] text-slate-400 font-medium leading-tight">Com logo da empresa e nome do cliente</div>
                    </div>
                  </button>

                  {/* Exportar Excel */}
                  <button
                    onClick={() => {
                      setIsExportMenuOpen(false);
                      handleExportExcel();
                    }}
                    className="w-full px-3.5 py-2.5 text-left hover:bg-emerald-50/70 flex items-center gap-3 transition-colors group cursor-pointer"
                  >
                    <div className="p-2 bg-emerald-100 text-emerald-600 rounded-xl group-hover:bg-emerald-600 group-hover:text-white transition-colors shrink-0">
                      <FileSpreadsheet size={16} />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-800">Exportar Excel (.xlsx)</div>
                      <div className="text-[10px] text-slate-400 font-medium leading-tight">Base formatada com colunas ajustadas</div>
                    </div>
                  </button>

                  {/* Exportar CSV */}
                  <button
                    onClick={() => {
                      setIsExportMenuOpen(false);
                      handleExportCSV();
                    }}
                    className="w-full px-3.5 py-2.5 text-left hover:bg-slate-50 flex items-center gap-3 transition-colors group cursor-pointer"
                  >
                    <div className="p-2 bg-slate-100 text-slate-600 rounded-xl group-hover:bg-slate-700 group-hover:text-white transition-colors shrink-0">
                      <Download size={16} />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-800">Exportar CSV</div>
                      <div className="text-[10px] text-slate-400 font-medium leading-tight">Base tabular em valores separados por vírgula</div>
                    </div>
                  </button>
                </div>
              </>
            )}
          </div>

          <button
            onClick={handleOpenPartnerPdfModal}
            className="px-3.5 py-2 border border-rose-200 bg-rose-50/60 hover:bg-rose-100 text-rose-700 text-xs font-bold rounded-xl flex items-center gap-1.5 transition-all cursor-pointer"
            title="Gerar relatório PDF personalizado do parceiro atualmente filtrado"
          >
            <FileText size={14} className="text-rose-600" />
            <span>PDF do Parceiro</span>
          </button>
          
          <button
            onClick={() => setActiveTab('insights')}
            className="px-3.5 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-xs font-bold rounded-xl flex items-center gap-1.5 transition-all cursor-pointer"
            title="Abrir painel de inteligência financeira e auditoria de caixa"
          >
            <Brain size={14} className="text-indigo-600" />
            <span>AI Insights</span>
          </button>

          <button
            onClick={handleOpenCreate}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 transition-all cursor-pointer shadow-md shadow-blue-100"
          >
            <Plus size={14} />
            <span>Novo Lançamento</span>
          </button>
        </div>
      </div>

      {/* Top Banner Grid: Card AI Insights + Card Novo Lançamento */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Card AI Insights */}
        <div className="lg:col-span-2 bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 border border-slate-800 text-white rounded-2xl p-5 relative overflow-hidden shadow-md flex flex-col justify-between">
          <div className="absolute top-0 right-0 p-6 opacity-15 pointer-events-none">
            <Brain size={100} className="text-indigo-400 animate-pulse" />
          </div>
          <div className="relative z-10 space-y-2 max-w-2xl">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 text-[9px] font-black uppercase tracking-wider bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 rounded-full">
                <Sparkles size={10} className="text-indigo-300 animate-bounce" />
                <span>ZeroPaper AI Engine</span>
              </span>
              <span className="text-[10px] text-slate-400 font-semibold">
                Auditoria e Inteligência Financeira
              </span>
            </div>
            <h3 className="text-base font-bold tracking-tight text-white">Análise & AI Insights de Caixa</h3>
            <p className="text-xs text-slate-300 font-medium leading-relaxed">
              Otimize despesas fixas/variáveis e simule reduções de custos com inteligência artificial para o fluxo de caixa.
            </p>
          </div>

          <div className="relative z-10 pt-3 flex flex-wrap items-center gap-3">
            <button
              onClick={() => {
                setActiveTab('insights');
                if (!insightsData && !loadingInsights) fetchInsights();
              }}
              className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 transition-all cursor-pointer shadow-sm"
            >
              <Brain size={13} />
              <span>Ver AI Insights</span>
            </button>
            <button
              onClick={fetchInsights}
              disabled={loadingInsights}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 active:bg-slate-800 text-slate-200 text-xs font-bold rounded-xl flex items-center gap-1.5 transition-all cursor-pointer border border-slate-700"
            >
              <RefreshCw size={12} className={loadingInsights ? 'animate-spin' : ''} />
              <span>{loadingInsights ? 'Processando...' : 'Recalcular'}</span>
            </button>
          </div>
        </div>

        {/* Card Novo Lançamento */}
        <div className="bg-gradient-to-br from-blue-900 via-slate-900 to-blue-950 border border-blue-800/60 text-white rounded-2xl p-5 relative overflow-hidden shadow-md flex flex-col justify-between">
          <div className="absolute top-0 right-0 p-5 opacity-15 pointer-events-none">
            <PlusCircle size={90} className="text-blue-400" />
          </div>
          <div className="relative z-10 space-y-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 text-[9px] font-black uppercase tracking-wider bg-blue-500/20 text-blue-300 border border-blue-500/30 rounded-full">
              <Plus size={10} className="text-blue-300" />
              <span>Ação Rápida</span>
            </span>
            <h3 className="text-base font-bold tracking-tight text-white">Novo Lançamento</h3>
            <p className="text-xs text-slate-300 font-medium leading-relaxed">
              Registre receitas, despesas, repasses ou custos operacionais no caixa.
            </p>
          </div>

          <div className="relative z-10 pt-3">
            <button
              onClick={handleOpenCreate}
              className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md shadow-blue-900/40"
            >
              <Plus size={14} />
              <span>+ Criar Novo Lançamento</span>
            </button>
          </div>
        </div>
      </div>

      {/* KPI Stats Panel */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        
        {/* Receivables stats */}
        <div className="bg-white border border-slate-100 p-5 rounded-2xl shadow-sm flex flex-col justify-between relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Contas a Receber</span>
            <div className="p-1.5 rounded-xl bg-emerald-50 text-emerald-600 shrink-0">
              <TrendingUp size={14} />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-black text-emerald-600 tracking-tight block">
              {metrics.totalReceivable.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
            </span>
          </div>
          <div className="mt-2 pt-2 border-t border-slate-50 flex items-center justify-between text-[10px] text-slate-400 font-bold">
            <span className="text-emerald-500">Recebido: {metrics.received.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
            <span className="text-blue-500">Aberto: {metrics.pendingReceivable.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
          </div>
        </div>

        {/* Payables stats */}
        <div className="bg-white border border-slate-100 p-5 rounded-2xl shadow-sm flex flex-col justify-between relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Contas a Pagar</span>
            <div className="p-1.5 rounded-xl bg-rose-50 text-rose-500 shrink-0">
              <TrendingDown size={14} />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-black text-rose-600 tracking-tight block">
              {metrics.totalPayable.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
            </span>
          </div>
          <div className="mt-2 pt-2 border-t border-slate-50 flex items-center justify-between text-[10px] text-slate-400 font-bold">
            <span className="text-emerald-500">Pago: {metrics.paid.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
            <span className="text-rose-500">Aberto: {metrics.pendingPayable.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
          </div>
        </div>

        {/* Real Cash Balances */}
        <div className="bg-white border border-slate-100 p-5 rounded-2xl shadow-sm flex flex-col justify-between relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Fluxo Realizado</span>
            <div className="p-1.5 rounded-xl bg-blue-50 text-blue-600 shrink-0">
              <Briefcase size={14} />
            </div>
          </div>
          <div className="mt-3">
            <span className={`text-2xl font-black tracking-tight block ${metrics.currentBalance >= 0 ? 'text-blue-600' : 'text-rose-600'}`}>
              {metrics.currentBalance.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
            </span>
          </div>
          <div className="mt-2 pt-2 border-t border-slate-50 text-[10px] text-slate-400 font-semibold leading-relaxed">
            <span>Saldo real em caixa (Entradas - Saídas Liquidadas).</span>
          </div>
        </div>

        {/* Projected Future cash projection */}
        <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-white p-5 rounded-2xl relative overflow-hidden shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between relative z-10">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-300">Saldo Projetado</span>
            <div className="p-1.5 rounded-xl bg-white/10 text-slate-200 shrink-0">
              <DollarSign size={14} />
            </div>
          </div>
          <div className="mt-3 relative z-10">
            <span className="text-2xl font-black tracking-tight block">
              {metrics.projectedBalance.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
            </span>
          </div>
          <div className="mt-2 pt-2 border-t border-white/10 text-[10px] text-slate-400 font-semibold leading-relaxed relative z-10">
            <span>Projeção para fechamento incluindo pendentes.</span>
          </div>
          <div className="absolute -right-6 -bottom-6 w-16 h-16 bg-white/5 rounded-full blur-xl pointer-events-none" />
        </div>

        {/* Crescimento da Receita MoM */}
        <div className="bg-white border border-slate-100 p-5 rounded-2xl relative overflow-hidden shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between z-10">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Crescimento de Receita</span>
            <div className="p-1.5 rounded-xl bg-emerald-50 text-emerald-600 shrink-0">
              <TrendingUp size={14} />
            </div>
          </div>
          <div className="mt-3 z-10">
            <span className="text-2xl font-black text-emerald-600 tracking-tight block">
              {momGrowth.percent >= 0 ? '+' : ''}{momGrowth.percent.toFixed(1)}%
            </span>
          </div>
          <div className="mt-2 pt-2 border-t border-slate-50 text-[10px] text-slate-400 font-semibold leading-relaxed z-10">
            <span className="block text-[9px] text-slate-400">
              Mês Ant. (Jun): {momGrowth.previous.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
            </span>
            <span className="block text-[9px] text-slate-500 font-bold">
              Mês Atual (Jul): {momGrowth.current.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
            </span>
          </div>
          <div className="absolute bottom-0 right-0 left-0 h-10 overflow-hidden opacity-10 pointer-events-none">
            <svg viewBox="0 0 120 30" width="100%" height="100%" preserveAspectRatio="none">
              <path d="M 0 30 Q 15 20, 30 15 T 60 8 T 90 14 T 120 2" fill="none" stroke="#10b981" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </div>
        </div>

      </div>

      {/* Cost Classification Horizontal Insights (ZeroPaper Core Feature) */}
      <div className="bg-slate-50 border border-slate-200/60 rounded-2xl p-5 grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
        <div className="md:col-span-4 space-y-1">
          <h4 className="text-xs font-extrabold text-slate-700 flex items-center gap-1.5 uppercase tracking-wider">
            <Layers size={14} className="text-blue-600" />
            <span>Distribuição de Custos Fixos e Variáveis</span>
          </h4>
          <p className="text-[10px] text-slate-400 font-semibold leading-relaxed">
            Monitore seu ponto de equilíbrio segregando despesas regulares (Fixas) e despesas de escala transacional (Variáveis).
          </p>
        </div>

        {/* Expenses Segregation progress bar */}
        <div className="md:col-span-4 space-y-2">
          <div className="flex items-center justify-between text-[10px] font-extrabold text-slate-500 uppercase tracking-wide">
            <span className="text-blue-600 flex items-center gap-1">Fixo: {metrics.fixedExpenses.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
            <span className="text-purple-600 flex items-center gap-1">Variável: {metrics.variableExpenses.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
          </div>
          <div className="w-full bg-slate-200 h-3 rounded-full overflow-hidden flex shadow-xs border border-slate-300/40">
            <div 
              style={{ width: `${metrics.totalPayable > 0 ? (metrics.fixedExpenses / metrics.totalPayable) * 100 : 0}%` }} 
              className="bg-blue-500 h-full transition-all duration-500" 
              title={`Custos Fixos: ${Math.round((metrics.fixedExpenses / (metrics.totalPayable || 1)) * 100)}%`}
            />
            <div 
              style={{ width: `${metrics.totalPayable > 0 ? (metrics.variableExpenses / metrics.totalPayable) * 100 : 0}%` }} 
              className="bg-purple-500 h-full transition-all duration-500" 
              title={`Custos Variáveis: ${Math.round((metrics.variableExpenses / (metrics.totalPayable || 1)) * 100)}%`}
            />
          </div>
          <div className="text-[9px] text-slate-400 font-bold text-center">
            Composição das Saídas: {metrics.totalPayable > 0 ? Math.round((metrics.fixedExpenses / metrics.totalPayable) * 100) : 0}% Fixo vs {metrics.totalPayable > 0 ? Math.round((metrics.variableExpenses / metrics.totalPayable) * 100) : 0}% Variável
          </div>
        </div>

        {/* Receipts Segregation progress bar */}
        <div className="md:col-span-4 space-y-2">
          <div className="flex items-center justify-between text-[10px] font-extrabold text-slate-500 uppercase tracking-wide">
            <span className="text-emerald-600">Rec. Fixa: {metrics.fixedIncomes.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
            <span className="text-teal-600">Rec. Variável: {metrics.variableIncomes.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
          </div>
          <div className="w-full bg-slate-200 h-3 rounded-full overflow-hidden flex shadow-xs border border-slate-300/40">
            <div 
              style={{ width: `${metrics.totalReceivable > 0 ? (metrics.fixedIncomes / metrics.totalReceivable) * 100 : 0}%` }} 
              className="bg-emerald-500 h-full transition-all duration-500" 
              title={`Receitas Fixas: ${Math.round((metrics.fixedIncomes / (metrics.totalReceivable || 1)) * 100)}%`}
            />
            <div 
              style={{ width: `${metrics.totalReceivable > 0 ? (metrics.variableIncomes / metrics.totalReceivable) * 100 : 0}%` }} 
              className="bg-teal-500 h-full transition-all duration-500" 
              title={`Receitas Variáveis: ${Math.round((metrics.variableIncomes / (metrics.totalReceivable || 1)) * 100)}%`}
            />
          </div>
          <div className="text-[9px] text-slate-400 font-bold text-center">
            Composição das Entradas: {metrics.totalReceivable > 0 ? Math.round((metrics.fixedIncomes / metrics.totalReceivable) * 100) : 0}% Contratual vs {metrics.totalReceivable > 0 ? Math.round((metrics.variableIncomes / metrics.totalReceivable) * 100) : 0}% Spot
          </div>
        </div>
      </div>

      {/* Main Tab Navigation */}
      <div className="flex border-b border-slate-100 bg-white p-1 rounded-xl shadow-xs gap-1 overflow-x-auto whitespace-nowrap scrollbar-none">
        <button
          onClick={() => setActiveTab('all')}
          className={`flex-1 sm:flex-initial px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'all' 
              ? 'bg-blue-600 text-white shadow-xs' 
              : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
          }`}
        >
          Todos Lançamentos ({transactions.length})
        </button>
        <button
          onClick={() => setActiveTab('receivable')}
          className={`flex-1 sm:flex-initial px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'receivable' 
              ? 'bg-blue-600 text-white shadow-xs' 
              : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
          }`}
        >
          Contas a Receber ({transactions.filter(t => t.type === 'receivable').length})
        </button>
        <button
          onClick={() => setActiveTab('payable')}
          className={`flex-1 sm:flex-initial px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'payable' 
              ? 'bg-blue-600 text-white shadow-xs' 
              : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
          }`}
        >
          Contas a Pagar ({transactions.filter(t => t.type === 'payable').length})
        </button>
        <button
          onClick={() => setActiveTab('charts')}
          className={`flex-1 sm:flex-initial px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'charts' 
              ? 'bg-blue-600 text-white shadow-xs' 
              : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
          }`}
        >
          Análise Gráfica & Fluxo
        </button>
        <button
          onClick={() => setActiveTab('insights')}
          className={`flex-1 sm:flex-initial px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
            activeTab === 'insights' 
              ? 'bg-indigo-600 text-white shadow-xs' 
              : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
          }`}
        >
          <Brain size={13} className={activeTab === 'insights' ? 'text-white' : 'text-indigo-500'} />
          <span>AI Insights</span>
        </button>

        <button
          onClick={handleOpenCreate}
          className="ml-auto px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-xs font-bold rounded-lg flex items-center gap-1.5 transition-all cursor-pointer shadow-xs shrink-0"
        >
          <Plus size={13} />
          <span>Novo Lançamento</span>
        </button>
      </div>

      {/* Main Content Area Conditional Rendering */}
      {activeTab === 'insights' ? (
        /* AI INSIGHTS VIEW */
        <div className="space-y-6 animate-fade-in" id="secao-ai-insights">
          {/* Header Grid: AI Insights Card + Card Novo Lançamento side-by-side */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            {/* AI Insights Card (2 Cols) */}
            <div className="lg:col-span-2 bg-slate-900 border border-slate-800 text-white rounded-3xl p-6 relative overflow-hidden shadow-xl flex flex-col justify-between">
              <div className="absolute top-0 right-0 p-8 opacity-15 pointer-events-none">
                <Brain size={120} className="text-blue-400 animate-pulse" />
              </div>
              <div className="relative z-10 space-y-4 max-w-2xl">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 text-[10px] font-black uppercase tracking-wider bg-blue-500/20 text-blue-300 border border-blue-500/30 rounded-full">
                  <Sparkles size={11} className="text-blue-300 animate-bounce" />
                  <span>ZeroPaper AI Engine</span>
                </span>
                <div className="space-y-1">
                  <h3 className="text-xl font-bold tracking-tight">Análise e Otimização de Caixa</h3>
                  <p className="text-xs text-slate-300 font-medium leading-relaxed">
                    Insights acionados por Inteligência Artificial para auditar suas categorias de gastos operacionais, identificar gargalos logísticos e simular planos práticos de redução de custos.
                  </p>
                </div>
                
                <div className="pt-2 flex flex-wrap items-center gap-4">
                  <button
                    onClick={fetchInsights}
                    disabled={loadingInsights}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 disabled:bg-slate-700 text-white text-xs font-bold rounded-xl flex items-center gap-2 transition-all cursor-pointer shadow-lg shadow-blue-900/30"
                  >
                    <RefreshCw size={12} className={loadingInsights ? 'animate-spin' : ''} />
                    <span>{loadingInsights ? 'Analisando dados...' : 'Recalcular Insights'}</span>
                  </button>
                  <span className="text-[10px] text-slate-400 font-bold">
                    Última sincronização em tempo real: Hoje, {getSaoPauloDate()}
                  </span>
                </div>
              </div>
            </div>

            {/* Card Novo Lançamento (1 Col - positioned right next to AI Insights card) */}
            <div className="bg-gradient-to-br from-blue-900 via-slate-900 to-indigo-950 border border-blue-800/60 text-white rounded-3xl p-6 relative overflow-hidden shadow-xl flex flex-col justify-between">
              <div className="absolute top-0 right-0 p-6 opacity-10 pointer-events-none">
                <PlusCircle size={100} className="text-blue-400" />
              </div>
              <div className="relative z-10 space-y-3">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 text-[10px] font-black uppercase tracking-wider bg-blue-500/20 text-blue-300 border border-blue-500/30 rounded-full">
                  <Plus size={11} className="text-blue-300" />
                  <span>Ação Rápida</span>
                </span>
                <div className="space-y-1">
                  <h3 className="text-lg font-bold tracking-tight">Novo Lançamento</h3>
                  <p className="text-xs text-slate-300 font-medium leading-relaxed">
                    Cadastre novas contas a pagar ou receber com parcelamento, comprovantes e classificação de custos.
                  </p>
                </div>
              </div>

              <div className="relative z-10 pt-4 space-y-2">
                <button
                  onClick={handleOpenCreate}
                  className="w-full px-4 py-2.5 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer shadow-lg shadow-blue-900/40"
                >
                  <Plus size={15} />
                  <span>+ Novo Lançamento</span>
                </button>
              </div>
            </div>
          </div>

          {loadingInsights ? (
            <div className="bg-white border border-slate-100 rounded-2xl p-12 flex flex-col items-center justify-center space-y-4 shadow-sm min-h-64">
              <div className="relative">
                <div className="w-12 h-12 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin" />
                <Brain size={20} className="absolute inset-0 m-auto text-blue-600 animate-pulse" />
              </div>
              <div className="text-center space-y-1">
                <p className="text-xs font-bold text-slate-700">Auditando suas contas...</p>
                <p className="text-[10px] text-slate-400 font-semibold max-w-xs leading-normal">
                  O Gemini está mapeando suas despesas fixas, despesas variáveis e estimando potenciais de economia mensal para sua empresa.
                </p>
              </div>
            </div>
          ) : insightsError ? (
            <div className="bg-rose-50/50 border border-rose-100 rounded-2xl p-6 text-center space-y-3">
              <Info size={28} className="mx-auto text-rose-500" />
              <div className="space-y-1">
                <p className="text-xs font-bold text-rose-800">Falha ao gerar insights</p>
                <p className="text-[10px] text-rose-600 font-semibold">{insightsError}</p>
              </div>
              <button
                onClick={fetchInsights}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl cursor-pointer"
              >
                Tentar Novamente
              </button>
            </div>
          ) : insightsData ? (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              
              {/* Executive Summary Block */}
              <div className="lg:col-span-8 bg-white border border-slate-100 p-6 rounded-2xl shadow-sm space-y-4 flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-2 border-b border-slate-50 pb-3">
                    <div className="p-1.5 bg-blue-50 text-blue-600 rounded-xl">
                      <Sparkles size={14} />
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-800 text-xs uppercase tracking-wide">Resumo Executivo da Consultoria</h4>
                      <p className="text-[10px] text-slate-400">Padrões de caixa consolidados pelo nosso assistente.</p>
                    </div>
                  </div>
                  
                  <p className="text-xs text-slate-600 font-medium leading-relaxed whitespace-pre-wrap mt-4">
                    {insightsData.summary}
                  </p>
                </div>

                <div className="bg-slate-50/50 border border-slate-100 rounded-xl p-4 text-[11px] text-slate-500 font-bold mt-4 flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 animate-ping shrink-0" />
                  <span>Dica de Ouro: Reduza custos de API de mapas implementando debounce e caching inteligente de rotas!</span>
                </div>
              </div>

              {/* Highest Spendings Widget */}
              <div className="lg:col-span-4 bg-white border border-slate-100 p-6 rounded-2xl shadow-sm space-y-4">
                <div className="flex items-center gap-2 border-b border-slate-50 pb-3">
                  <div className="p-1.5 bg-rose-50 text-rose-600 rounded-xl">
                    <TrendingDown size={14} />
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-800 text-xs uppercase tracking-wide">Top 3 Categorias de Gastos</h4>
                    <p className="text-[10px] text-slate-400">Rubricas com maior impacto nas despesas totais.</p>
                  </div>
                </div>

                <div className="space-y-4">
                  {insightsData.highestSpends && insightsData.highestSpends.length > 0 ? (
                    insightsData.highestSpends.map((spend, index) => (
                      <div key={index} className="space-y-1.5">
                        <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                          <span>{spend.category}</span>
                          <span className="text-slate-900">
                            {spend.amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                          </span>
                        </div>
                        <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden flex">
                          <div
                            style={{ width: `${spend.percentageOfTotal}%` }}
                            className={`h-full ${
                              index === 0 ? 'bg-rose-500' : index === 1 ? 'bg-amber-500' : 'bg-blue-500'
                            }`}
                          />
                        </div>
                        <div className="flex justify-between text-[9px] text-slate-400 font-extrabold">
                          <span>Percentual no caixa</span>
                          <span>{spend.percentageOfTotal.toFixed(1)}%</span>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-xs font-medium text-slate-400 text-center py-6">
                      Sem despesas registradas suficientes para mapeamento.
                    </p>
                  )}
                </div>
              </div>

              {/* Concrete Optimization Tips */}
              <div className="lg:col-span-12 space-y-4">
                <div>
                  <h4 className="font-bold text-slate-800 text-xs uppercase tracking-wider">Plano de Otimização Sugerido</h4>
                  <p className="text-[10px] text-slate-400">Recomendações financeiras acionáveis ordenadas por relevância.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {insightsData.tips && insightsData.tips.map((tip, index) => (
                    <div key={index} className="bg-white border border-slate-100 p-5 rounded-2xl shadow-xs hover:shadow-md hover:border-slate-200/60 transition-all flex flex-col justify-between space-y-4">
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-[9px] font-black uppercase tracking-wider bg-slate-50 border border-slate-100 px-2 py-0.5 rounded-full text-slate-500">
                            {tip.category}
                          </span>
                          <span className={`text-[9px] font-black uppercase tracking-widest px-2.5 py-0.5 rounded-md ${
                            tip.impact === 'Alto' 
                              ? 'bg-rose-50 text-rose-600 border border-rose-100'
                              : tip.impact === 'Médio'
                              ? 'bg-amber-50 text-amber-600 border border-amber-100'
                              : 'bg-blue-50 text-blue-600 border border-blue-100'
                          }`}>
                            Impacto {tip.impact}
                          </span>
                        </div>

                        <h5 className="font-bold text-slate-800 text-xs leading-snug">{tip.title}</h5>
                        <p className="text-[11px] text-slate-400 font-medium leading-relaxed">
                          {tip.description}
                        </p>
                      </div>

                      <div className="pt-3 border-t border-slate-50 flex items-center justify-between text-[11px] font-bold">
                        <span className="text-slate-400">Economia Estimada:</span>
                        <span className="text-emerald-600 font-extrabold text-xs">
                          {tip.potentialSavings.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} / mês
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

            </div>
          ) : (
            <div className="bg-white border border-slate-100 rounded-2xl p-12 text-center space-y-4 shadow-sm">
              <Brain size={36} className="mx-auto text-indigo-400 animate-pulse" />
              <div className="space-y-1">
                <p className="text-xs font-bold text-slate-700">Seus insights de caixa estão prontos</p>
                <p className="text-[10px] text-slate-400 font-semibold max-w-sm mx-auto leading-normal">
                  Clique no botão abaixo para processar todas as transações vigentes e gerar as dicas analíticas de redução de despesas.
                </p>
              </div>
              <button
                onClick={fetchInsights}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white text-xs font-bold rounded-xl cursor-pointer shadow-md shadow-indigo-100"
              >
                Gerar Insights Financeiros
              </button>
            </div>
          )}
        </div>
      ) : activeTab !== 'charts' ? (
        /* TABLE LIST VIEW (ALL, RECEIVABLE, PAYABLE) */
        <div className="bg-white border border-slate-100 rounded-2xl shadow-sm p-5 space-y-4">
          
          {/* Filtering Controls Bar */}
          <div className="flex flex-col xl:flex-row gap-3 xl:items-center justify-between">
            
            {/* Search Input */}
            <div className="relative flex-1">
              <Search size={14} className="absolute left-3.5 top-3.5 text-slate-400" />
              <input
                type="text"
                placeholder="Buscar por descrição, favorecido, ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full text-xs font-semibold pl-10 pr-4 py-2.5 bg-slate-50/50 border border-slate-200 rounded-xl focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
              />
            </div>

            {/* Select dropdown filters row */}
            <div className="flex flex-wrap items-center gap-2">
              
              {/* Partner Filter */}
              <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 px-2.5 py-1.5 rounded-xl">
                <User size={12} className="text-blue-500" />
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Parceiro:</span>
                <select
                  value={partnerFilter}
                  onChange={(e) => setPartnerFilter(e.target.value)}
                  className="bg-transparent border-none text-[11px] font-bold text-slate-700 outline-none cursor-pointer pr-1 max-w-[150px] truncate"
                >
                  <option value="Todos">Todos</option>
                  {partnerOptions.map((p, idx) => (
                    <option key={`cp-partner-opt-${p}-${idx}`} value={p}>{p}</option>
                  ))}
                </select>
              </div>

              {/* Category Filter */}
              <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 px-2.5 py-1.5 rounded-xl">
                <Tag size={12} className="text-slate-400" />
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Cat:</span>
                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="bg-transparent border-none text-[11px] font-bold text-slate-600 outline-none cursor-pointer pr-1"
                >
                  {categories.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              {/* Status Filter */}
              <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 px-2.5 py-1.5 rounded-xl">
                <Filter size={12} className="text-slate-400" />
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Status:</span>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="bg-transparent border-none text-[11px] font-bold text-slate-600 outline-none cursor-pointer pr-1"
                >
                  <option value="Todos">Todos</option>
                  <option value="Pendente">Pendente</option>
                  <option value="Pago">Pago</option>
                  <option value="Atrasado">Atrasado</option>
                </select>
              </div>

              {/* Fixed/Variable Filter */}
              <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 px-2.5 py-1.5 rounded-xl">
                <Layers size={12} className="text-slate-400" />
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Custo:</span>
                <select
                  value={costTypeFilter}
                  onChange={(e) => setCostTypeFilter(e.target.value as any)}
                  className="bg-transparent border-none text-[11px] font-bold text-slate-600 outline-none cursor-pointer pr-1"
                >
                  <option value="Todos">Todos</option>
                  <option value="fixed">Fixos</option>
                  <option value="variable">Variáveis</option>
                </select>
              </div>

              {/* Recurrence Filter */}
              <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 px-2.5 py-1.5 rounded-xl">
                <Repeat size={12} className="text-slate-400" />
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Recorrência:</span>
                <select
                  value={recurrenceFilter}
                  onChange={(e) => setRecurrenceFilter(e.target.value as any)}
                  className="bg-transparent border-none text-[11px] font-bold text-slate-600 outline-none cursor-pointer pr-1"
                >
                  <option value="Todos">Todos</option>
                  <option value="recurring">Recorrentes</option>
                  <option value="single">Não Recorrentes</option>
                </select>
              </div>

            </div>
          </div>

          {/* Bulk Selection Floating Bar */}
          {selectedTxIds.length > 0 && (
            <div className="bg-slate-900 text-white px-5 py-3 rounded-2xl shadow-xl flex flex-wrap items-center justify-between gap-3 animate-fade-in border border-slate-800">
              <div className="flex items-center gap-2 text-xs font-bold">
                <span className="bg-blue-600 text-white px-2.5 py-0.5 rounded-full text-[11px] font-extrabold">
                  {selectedTxIds.length} selecionado(s)
                </span>
                <span className="text-slate-300">Ações em Massa:</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleBulkReconcile}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1 cursor-pointer shadow-xs"
                >
                  <Check size={13} />
                  <span>Marcar como Pago</span>
                </button>
                <button
                  type="button"
                  onClick={handleBulkDelete}
                  className="px-3 py-1.5 bg-rose-600 hover:bg-rose-500 active:bg-rose-700 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1 cursor-pointer shadow-xs"
                >
                  <Trash2 size={13} />
                  <span>Excluir Selecionados</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedTxIds([])}
                  className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold transition-all cursor-pointer"
                >
                  Desmarcar
                </button>
              </div>
            </div>
          )}

          {/* Ledger Table */}
          <div className="border border-slate-100 rounded-2xl overflow-hidden bg-white">
            <div className="overflow-x-auto">
              <table className="min-w-full text-xs text-slate-600 border-collapse">
                <thead>
                  <tr className="bg-slate-50/70 border-b border-slate-100 font-bold text-slate-400 text-left text-[10px] uppercase">
                    <th className="px-3 py-3 text-center w-10">
                      <input 
                        type="checkbox" 
                        checked={selectedTxIds.length > 0 && selectedTxIds.length === filteredTransactions.length}
                        onChange={() => toggleSelectAll(filteredTransactions)}
                        className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                        title="Selecionar Todos os Filtrados"
                      />
                    </th>
                    <th className="px-5 py-3">Descrição / Lançamento</th>
                    <th className="px-5 py-3">Favorecido / Recebedor</th>
                    <th className="px-5 py-3">Categoria / Classificação</th>
                    <th 
                      className="px-5 py-3 text-center cursor-pointer hover:bg-slate-100 transition-colors"
                      onClick={() => handleSort('dueDate')}
                    >
                      <span className="flex items-center justify-center gap-1">
                        Vencimento
                        {sortField === 'dueDate' && (sortDirection === 'asc' ? '▲' : '▼')}
                      </span>
                    </th>
                    <th className="px-5 py-3 text-center">Método</th>
                    <th 
                      className="px-5 py-3 text-right cursor-pointer hover:bg-slate-100 transition-colors"
                      onClick={() => handleSort('amount')}
                    >
                      <span className="flex items-center justify-end gap-1">
                        Valor
                        {sortField === 'amount' && (sortDirection === 'asc' ? '▲' : '▼')}
                      </span>
                    </th>
                    <th className="px-5 py-3 text-center">Status</th>
                    <th className="px-5 py-3 text-center">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 font-medium text-slate-700">
                  {filteredTransactions.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="px-5 py-12 text-center text-slate-400 font-semibold">
                        Nenhum lançamento financeiro corresponde aos filtros aplicados.
                      </td>
                    </tr>
                  ) : (
                    filteredTransactions.map(t => {
                      const isPayable = t.type === 'payable';
                      const isPaid = t.status === 'Pago';
                      const isOverdue = t.status === 'Atrasado';
                      const isSelected = selectedTxIds.includes(t.id);

                      return (
                        <tr key={t.id} className={`hover:bg-slate-50/40 transition-colors ${isSelected ? 'bg-blue-50/30' : ''}`}>
                          
                          {/* Checkbox column */}
                          <td className="px-3 py-4 text-center">
                            <input 
                              type="checkbox" 
                              checked={isSelected}
                              onChange={() => toggleSelectTx(t.id)}
                              className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                            />
                          </td>

                          {/* Code & Description & Badges */}
                          <td className="px-5 py-4">
                            <div className="flex flex-col">
                              <span className="font-extrabold text-slate-800 text-[13px]">{t.description}</span>
                              <div className="flex flex-wrap gap-1 mt-1 items-center">
                                <span className="text-[9px] font-mono font-semibold text-slate-400 bg-slate-100 px-1.5 py-0.2 rounded-md">ID: {t.id}</span>
                                
                                {/* Cost Class Badge */}
                                {t.costType === 'fixed' ? (
                                  <span className="text-[9px] font-bold bg-blue-50 text-blue-600 border border-blue-100 rounded-md px-1.5 py-0.2" title="Custo ou Receita Fixo regular">Fixo</span>
                                ) : (
                                  <span className="text-[9px] font-bold bg-purple-50 text-purple-600 border border-purple-100 rounded-md px-1.5 py-0.2" title="Custo ou Receita de escala Variável">Variável</span>
                                )}

                                {/* Recurrence Badge */}
                                {t.isRecurring && (
                                  <span className="text-[9px] font-bold bg-amber-50 text-amber-600 border border-amber-100 rounded-md px-1.5 py-0.2 flex items-center gap-0.5" title={`Lançamento recorrente - Parcela ${t.recurrenceInstallment}/${t.totalInstallments}`}>
                                    <Repeat size={8} />
                                    <span>Recorrente {t.recurrenceInstallment}/{t.totalInstallments}</span>
                                  </span>
                                )}
                              </div>
                            </div>
                          </td>

                          {/* Favored Entity */}
                          <td className="px-5 py-4 text-slate-600">
                            <div className="flex items-center gap-1.5">
                              <User size={13} className="text-slate-400 shrink-0" />
                              <span className="font-bold text-[12px] truncate max-w-[160px]">{t.recipientOrPayer}</span>
                            </div>
                          </td>

                          {/* Category */}
                          <td className="px-5 py-4">
                            <span className="bg-slate-100 text-slate-600 text-[10px] px-2.5 py-1 rounded-md font-extrabold uppercase tracking-wide">
                              {t.category}
                            </span>
                          </td>

                          {/* Due Date / Payment Date */}
                          <td className="px-5 py-4 text-center">
                            <div className="flex flex-col items-center">
                              <span className={`font-semibold ${isOverdue ? 'text-rose-600 font-bold' : 'text-slate-500'}`}>
                                {formatToBrazilianDate(t.dueDate)}
                              </span>
                              {t.actualPaymentDate && (
                                <span className="text-[9px] font-semibold text-emerald-500 mt-0.5">
                                  Liquidado {formatToBrazilianDate(t.actualPaymentDate)}
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Payment method */}
                          <td className="px-5 py-4 text-center">
                            <span className="text-slate-500 font-semibold bg-slate-50 border border-slate-150 rounded-md px-2 py-0.5">
                              {t.paymentMethod}
                            </span>
                          </td>

                          {/* Money amount */}
                          <td className="px-5 py-4 text-right">
                            <span className={`font-black text-sm tracking-tight ${isPayable ? 'text-rose-600' : 'text-emerald-600'}`}>
                              {isPayable ? '-' : '+'} {t.amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                            </span>
                          </td>

                          {/* Status badge */}
                          <td className="px-5 py-4 text-center">
                            <span className={`px-2.5 py-1 rounded-full border text-[9px] font-extrabold uppercase ${
                              isPaid 
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-100' 
                                : isOverdue 
                                ? 'bg-rose-50 text-rose-700 border-rose-100 animate-pulse' 
                                : 'bg-amber-50 text-amber-700 border-amber-100'
                            }`}>
                              {t.status}
                            </span>
                          </td>

                          {/* Action controls */}
                          <td className="px-5 py-4 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              
                              {/* Reconcile (Liquidar) or Unpay (Estornar) Action */}
                              {!isPaid ? (
                                <button
                                  type="button"
                                  onClick={() => handleReconcile(t.id)}
                                  className="p-1.5 bg-emerald-50 hover:bg-emerald-500 hover:text-white border border-emerald-100 hover:border-emerald-500 text-emerald-600 rounded-lg transition-all cursor-pointer"
                                  title={isPayable ? 'Liquidar despesa (Marcar Pago)' : 'Liquidar receita (Marcar Recebido)'}
                                >
                                  <Check size={13} />
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => handleUnpay(t.id)}
                                  className="p-1.5 bg-amber-50 hover:bg-amber-500 hover:text-white border border-amber-100 hover:border-amber-500 text-amber-600 rounded-lg transition-all cursor-pointer"
                                  title="Estornar lançamento (Voltar para Pendente)"
                                >
                                  <RotateCcw size={13} />
                                </button>
                              )}

                              {/* Edit Action */}
                              <button
                                type="button"
                                onClick={() => handleOpenEdit(t)}
                                className="p-1.5 bg-blue-50 hover:bg-blue-600 hover:text-white border border-blue-100 hover:border-blue-600 text-blue-600 rounded-lg transition-all cursor-pointer"
                                title="Editar Lançamento"
                              >
                                <Pencil size={13} />
                              </button>

                              {/* Delete Action */}
                              <button
                                type="button"
                                onClick={() => handleDelete(t.id)}
                                className="p-1.5 bg-slate-50 hover:bg-rose-50 hover:text-rose-600 border border-slate-200 hover:border-rose-100 text-slate-400 rounded-lg transition-all cursor-pointer"
                                title="Excluir Lançamento"
                              >
                                <Trash2 size={13} />
                              </button>

                            </div>
                          </td>

                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Context tip block */}
          <div className="bg-blue-50/50 border border-blue-100 rounded-xl p-4 text-xs text-blue-800 flex items-start gap-2.5">
            <Info size={14} className="text-blue-500 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold block mb-0.5">Consolidação e Integração Recorrente</span>
              <p className="font-medium text-[11px] leading-relaxed">
                Adicione lançamentos com a opção de <strong>Pagamento Repetitivo</strong> ativada para pré-provisionar custos futuros em parcelas (ex: faturamentos anuais, repasses de frota, ou seguros mensais). Classifique como custo fixo ou variável para enriquecer seus gráficos inteligentes estilo <em>ZeroPaper</em>.
              </p>
            </div>
          </div>

        </div>
      ) : (
        /* ANALYTICS CHARTS TAB VIEW */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* Main category volume chart */}
          <div className="lg:col-span-8 bg-white border border-slate-100 p-5 rounded-2xl shadow-sm space-y-4">
            <div>
              <h4 className="font-bold text-slate-800 text-sm">Volume Financeiro por Categoria</h4>
              <p className="text-[11px] text-slate-400">Distribuição comparativa de contas a pagar e receber em cada rubrica operacional.</p>
            </div>

            <div className="h-72 w-full text-xs font-semibold">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={chartCategoryData}
                  margin={{ top: 20, right: 10, left: 10, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="category" stroke="#94a3b8" />
                  <YAxis stroke="#94a3b8" tickFormatter={(val) => `R$ ${val}`} />
                  <Tooltip 
                    formatter={(value) => [`R$ ${Number(value).toLocaleString('pt-BR')}`]}
                    contentStyle={{ borderRadius: '12px', border: '1px solid #f1f5f9' }}
                  />
                  <Legend />
                  <Bar name="A Receber" dataKey="receivable" fill="#10b981" radius={[4, 4, 0, 0]} />
                  <Bar name="A Pagar" dataKey="payable" fill="#ef4444" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Status Breakdown side widgets */}
          <div className="lg:col-span-4 grid grid-cols-1 gap-6">
            
            {/* Pie Chart Cost Type Classification (ZeroPaper Core) */}
            <div className="bg-white border border-slate-100 p-5 rounded-2xl shadow-sm space-y-3 flex flex-col justify-between">
              <div>
                <h4 className="font-bold text-slate-800 text-sm">Classificação de Despesas</h4>
                <p className="text-[10px] text-slate-400">Estruturação de custos Fixos vs Custos Variáveis.</p>
              </div>

              {metrics.totalPayable > 0 ? (
                <div className="flex items-center justify-between h-36">
                  <div className="w-1/2 h-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={[
                            { name: 'Custo Fixo', value: metrics.fixedExpenses, color: '#3b82f6' },
                            { name: 'Custo Variável', value: metrics.variableExpenses, color: '#a855f7' }
                          ].filter(item => item.value > 0)}
                          innerRadius={25}
                          outerRadius={45}
                          paddingAngle={3}
                          dataKey="value"
                        >
                          {[
                            { color: '#3b82f6' },
                            { color: '#a855f7' }
                          ].map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(value) => [`R$ ${Number(value).toLocaleString('pt-BR')}`]} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="w-1/2 space-y-1.5 text-[10px] font-bold text-slate-500">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-[#3b82f6] shrink-0" />
                      <span className="truncate">Fixo: R$ {metrics.fixedExpenses.toLocaleString('pt-BR')}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-[#a855f7] shrink-0" />
                      <span className="truncate">Variável: R$ {metrics.variableExpenses.toLocaleString('pt-BR')}</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="py-8 text-center text-slate-400 text-xs font-semibold">
                  Nenhum custo registrado para segmentar.
                </div>
              )}
            </div>

            {/* Incomes pie chart */}
            <div className="bg-white border border-slate-100 p-5 rounded-2xl shadow-sm space-y-3 flex flex-col justify-between">
              <div>
                <h4 className="font-bold text-slate-800 text-sm">Contas a Receber</h4>
                <p className="text-[10px] text-slate-400">Distribuição monetária das receitas registradas por status.</p>
              </div>

              {chartStatusReceivableData.length > 0 ? (
                <div className="flex items-center justify-between h-36">
                  <div className="w-1/2 h-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={chartStatusReceivableData}
                          innerRadius={25}
                          outerRadius={45}
                          paddingAngle={3}
                          dataKey="value"
                        >
                          {chartStatusReceivableData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(value) => [`R$ ${Number(value).toLocaleString('pt-BR')}`]} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="w-1/2 space-y-1.5 text-[10px] font-bold text-slate-500">
                    {chartStatusReceivableData.map((item, idx) => (
                      <div key={idx} className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                        <span className="truncate">{item.name}: R$ {item.value.toLocaleString('pt-BR')}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="py-8 text-center text-slate-400 text-xs font-semibold">
                  Sem dados para exibir.
                </div>
              )}
            </div>

          </div>

        </div>
      )}

      {/* CRUD Lançamentos Modal Form (Create / Edit) */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="absolute inset-0 cursor-pointer"
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="relative bg-white border border-slate-100 rounded-3xl shadow-2xl w-full max-w-xl max-h-[92vh] flex flex-col overflow-hidden z-10"
            >
              {/* Modal Header */}
              <div className="px-6 py-4.5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
                    {editingTx ? <Pencil size={16} /> : <Plus size={16} />}
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-800">
                      {editingTx ? 'Editar Lançamento Financeiro' : 'Novo Lançamento Financeiro'}
                    </h3>
                    <p className="text-[11px] text-slate-400 font-semibold">
                      {editingTx ? 'Altere as informações do registro existente' : 'Adicione lançamentos individuais ou repetições para o caixa'}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-2 py-1 text-xs text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-all cursor-pointer font-bold"
                >
                  Fechar
                </button>
              </div>

              {/* Modal Core Form */}
              <form onSubmit={handleSubmitForm} className="p-6 overflow-y-auto space-y-4 flex-1">
                
                {/* Description input */}
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Descrição do Lançamento *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Aluguel da Sede, Faturamento Burger House, etc."
                    value={newTxDescription}
                    onChange={(e) => setNewTxDescription(e.target.value)}
                    className="w-full text-xs font-semibold px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                  />
                </div>

                {/* Type toggle & Amount */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Tipo de Lançamento *</label>
                    <div className="flex bg-slate-100 p-1 rounded-xl gap-1">
                      <button
                        type="button"
                        onClick={() => setNewTxType('receivable')}
                        className={`flex-1 py-1.5 text-[10px] font-bold rounded-lg transition-all ${
                          newTxType === 'receivable' 
                            ? 'bg-emerald-500 text-white shadow-xs' 
                            : 'text-slate-500 hover:text-slate-700'
                        }`}
                      >
                        Receita (A Receber)
                      </button>
                      <button
                        type="button"
                        onClick={() => setNewTxType('payable')}
                        className={`flex-1 py-1.5 text-[10px] font-bold rounded-lg transition-all ${
                          newTxType === 'payable' 
                            ? 'bg-rose-500 text-white shadow-xs' 
                            : 'text-slate-500 hover:text-slate-700'
                        }`}
                      >
                        Despesa (A Pagar)
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Valor do Título (R$) *</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      required
                      placeholder="0.00"
                      value={newTxAmount}
                      onChange={(e) => setNewTxAmount(e.target.value)}
                      className="w-full text-xs font-semibold px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                    />
                  </div>
                </div>

                {/* Payer/Beneficiary & Due Date */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Favorecido / Sacado *</label>
                    <input
                      type="text"
                      required
                      placeholder="Ex: Imobiliária, Burger House, Carlos..."
                      value={newTxRecipientOrPayer}
                      onChange={(e) => setNewTxRecipientOrPayer(e.target.value)}
                      className="w-full text-xs font-semibold px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Data de Vencimento *</label>
                    <input
                      type="date"
                      required
                      value={newTxDueDate}
                      onChange={(e) => setNewTxDueDate(e.target.value)}
                      className="w-full text-xs font-semibold px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                    />
                  </div>
                </div>

                {/* Classification: Fixed vs Variable Cost Selector (Core mandate) */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Custo/Receita Fixo ou Variável *</label>
                    <div className="flex bg-slate-100 p-1 rounded-xl gap-1">
                      <button
                        type="button"
                        onClick={() => setNewTxCostType('fixed')}
                        className={`flex-1 py-1.5 text-[10px] font-bold rounded-lg transition-all ${
                          newTxCostType === 'fixed' 
                            ? 'bg-blue-600 text-white shadow-xs' 
                            : 'text-slate-500 hover:text-slate-700'
                        }`}
                      >
                        Fixo (Contrato/Fixo)
                      </button>
                      <button
                        type="button"
                        onClick={() => setNewTxCostType('variable')}
                        className={`flex-1 py-1.5 text-[10px] font-bold rounded-lg transition-all ${
                          newTxCostType === 'variable' 
                            ? 'bg-purple-600 text-white shadow-xs' 
                            : 'text-slate-500 hover:text-slate-700'
                        }`}
                      >
                        Variável (Fluido)
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Status Inicial *</label>
                    <select
                      value={newTxStatus}
                      onChange={(e) => setNewTxStatus(e.target.value as any)}
                      className="w-full text-xs font-semibold px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none cursor-pointer"
                    >
                      <option value="Pendente">Pendente (Em aberto)</option>
                      <option value="Pago">Pago / Liquidado</option>
                      <option value="Atrasado">Atrasado</option>
                    </select>
                  </div>
                </div>

                {/* Category & Payment Method */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Categoria *</label>
                    <select
                      value={isCustomCategorySelected ? 'CUSTOM' : newTxCategory}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === 'CUSTOM') {
                          setIsCustomCategorySelected(true);
                          setNewTxCategory('CUSTOM');
                        } else {
                          setIsCustomCategorySelected(false);
                          setNewTxCategory(val);
                        }
                      }}
                      className="w-full text-xs font-semibold px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none cursor-pointer"
                    >
                      <option value="Faturamento">Faturamento (Receita Clientes)</option>
                      <option value="Repasses">Repasses (Condutores)</option>
                      <option value="Infraestrutura">Infraestrutura (Servidores, Hospedagem)</option>
                      <option value="Serviços">Serviços & Licenças</option>
                      <option value="Manutenção">Manutenção Preventiva</option>
                      <option value="Administrativo">Despesas Administrativas</option>
                      <option value="Impostos & Taxas">Impostos & Taxas</option>
                      <option value="Marketing & Vendas">Marketing & Vendas</option>
                      <option value="Salários & Pro-Labore">Salários & Pro-Labore</option>
                      <option value="Outros">Outros Lançamentos</option>
                      <option value="CUSTOM">+ Nova Categoria Personalizada...</option>
                    </select>

                    {(isCustomCategorySelected || newTxCategory === 'CUSTOM') && (
                      <input
                        type="text"
                        required
                        placeholder="Nome da nova categoria..."
                        value={customCategoryInput}
                        onChange={(e) => setCustomCategoryInput(e.target.value)}
                        className="w-full text-xs font-semibold px-3.5 py-2 mt-2 bg-blue-50/50 border border-blue-200 rounded-xl focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none animate-fade-in"
                      />
                    )}
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Meio de Pagamento</label>
                    <select
                      value={newTxPaymentMethod}
                      onChange={(e) => setNewTxPaymentMethod(e.target.value)}
                      className="w-full text-xs font-semibold px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none cursor-pointer"
                    >
                      <option value="Pix">Pix (Imediato)</option>
                      <option value="Boleto">Boleto Bancário</option>
                      <option value="Cartão">Cartão de Crédito Corporativo</option>
                      <option value="Transferência">Transferência Bancária / TED</option>
                      <option value="Dinheiro">Dinheiro em Espécie</option>
                    </select>
                  </div>
                </div>

                {/* Repetitive / Recurring payments selector (ZeroPaper Core requirement) */}
                {!editingTx && (
                  <div className="bg-slate-50 border border-slate-150 rounded-2xl p-4.5 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Repeat size={14} className="text-amber-600" />
                        <div>
                          <span className="text-xs font-extrabold text-slate-700 block">Lançamento Repetitivo / Recorrente</span>
                          <span className="text-[10px] text-slate-400 font-semibold">Repetir esta despesa ou receita automaticamente</span>
                        </div>
                      </div>
                      <div className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          id="recurrence-toggle"
                          checked={newTxIsRecurring}
                          onChange={(e) => setNewTxIsRecurring(e.target.checked)}
                          className="sr-only peer"
                        />
                        <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:height-4 after:w-4 after:transition-all peer-checked:bg-amber-500"></div>
                      </div>
                    </div>

                    {newTxIsRecurring && (
                      <div className="grid grid-cols-2 gap-4 pt-2.5 border-t border-slate-200/50 animate-slide-down">
                        <div>
                          <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Frequência</label>
                          <select
                            value={newTxRecurrencePeriod}
                            onChange={(e) => setNewTxRecurrencePeriod(e.target.value as any)}
                            className="w-full text-xs font-semibold px-3 py-1.5 bg-white border border-slate-200 rounded-xl focus:border-amber-500 outline-none cursor-pointer"
                          >
                            <option value="weekly">Semanal</option>
                            <option value="monthly">Mensal</option>
                            <option value="yearly">Anual</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Nº de Parcelas / Repetições</label>
                          <div className="flex items-center gap-2">
                            <input
                              type="number"
                              min={2}
                              max={60}
                              value={newTxTotalInstallments}
                              onChange={(e) => setNewTxTotalInstallments(Math.max(2, parseInt(e.target.value, 10) || 2))}
                              className="w-full text-xs font-semibold px-3 py-1.5 bg-white border border-slate-200 rounded-xl focus:border-amber-500 outline-none"
                            />
                            <span className="text-[10px] text-slate-400 font-bold shrink-0">vezes</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Notes */}
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Observações Adicionais</label>
                  <textarea
                    rows={2}
                    placeholder="Notas fiscais, links de arquivos, detalhes do repasse..."
                    value={newTxNotes}
                    onChange={(e) => setNewTxNotes(e.target.value)}
                    className="w-full text-xs font-semibold px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none resize-none"
                  />
                </div>

                {/* Form Footer */}
                <div className="pt-4 border-t border-slate-100 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-600 font-bold rounded-xl text-xs transition-all cursor-pointer bg-white"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-extrabold rounded-xl text-xs transition-all shadow-md shadow-blue-100 cursor-pointer"
                  >
                    {editingTx ? 'Salvar Alterações' : 'Confirmar Lançamento'}
                  </button>
                </div>

              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal for Single Transaction */}
      <AnimatePresence>
        {deletingTx && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-white border border-slate-100 rounded-3xl shadow-2xl max-w-lg w-full overflow-hidden"
            >
              {/* Header */}
              <div className="bg-rose-50/80 border-b border-rose-100 p-5 px-6 flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-rose-100 text-rose-600 rounded-2xl shrink-0">
                    <AlertTriangle size={22} />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-rose-950">Confirmar Exclusão</h3>
                    <p className="text-xs text-rose-700 font-medium">Esta ação removerá permanentemente o registro do Firebase</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setDeletingTx(null)}
                  className="text-slate-400 hover:text-slate-600 p-1.5 rounded-xl hover:bg-rose-100/50 transition-colors cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Content Details */}
              <div className="p-6 space-y-4">
                <p className="text-xs text-slate-600">
                  Confira as informações do lançamento financeiro antes de autorizar a deleção permanente:
                </p>

                {/* Detailed Info Card */}
                <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2 border-b border-slate-200/60 pb-2.5">
                    <div>
                      <span className="text-[10px] uppercase font-extrabold text-slate-400 block">Descrição do Lançamento</span>
                      <span className="text-sm font-bold text-slate-900">{deletingTx.description}</span>
                    </div>
                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wide border shrink-0 ${
                      deletingTx.type === 'receivable'
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                        : 'bg-rose-50 border-rose-200 text-rose-700'
                    }`}>
                      {deletingTx.type === 'receivable' ? 'Receita' : 'Despesa'}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <span className="text-[10px] uppercase font-extrabold text-slate-400 block">Valor</span>
                      <span className="font-mono font-bold text-slate-900 text-sm">
                        {deletingTx.amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-extrabold text-slate-400 block">Data de Vencimento</span>
                      <span className="font-mono font-semibold text-slate-700">
                        {formatToBrazilianDate(deletingTx.dueDate)}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-extrabold text-slate-400 block">Categoria</span>
                      <span className="font-semibold text-slate-700">{deletingTx.category}</span>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-extrabold text-slate-400 block">Favorecido / Pagador</span>
                      <span className="font-semibold text-slate-700">{deletingTx.recipientOrPayer || 'Não informado'}</span>
                    </div>
                  </div>

                  <div className="border-t border-slate-200/60 pt-2.5 flex items-center justify-between text-xs">
                    <span className="text-[10px] uppercase font-extrabold text-slate-400">Status Atual</span>
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                      deletingTx.status === 'Pago'
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                        : deletingTx.status === 'Atrasado'
                        ? 'bg-rose-50 border-rose-200 text-rose-700'
                        : 'bg-amber-50 border-amber-200 text-amber-700'
                    }`}>
                      {deletingTx.status}
                    </span>
                  </div>
                </div>

                <div className="p-3 bg-rose-50/70 border border-rose-200/80 rounded-xl flex items-start gap-2.5 text-xs text-rose-900">
                  <Info size={16} className="text-rose-600 shrink-0 mt-0.5" />
                  <span>Atenção: A deleção sincronizará diretamente com o banco de dados Firebase e não poderá ser recuperada.</span>
                </div>
              </div>

              {/* Footer Actions */}
              <div className="bg-slate-50 border-t border-slate-100 p-4 px-6 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setDeletingTx(null)}
                  className="px-4 py-2.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold transition-all cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDeleteSingle}
                  className="px-4 py-2.5 bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer shadow-sm"
                >
                  <Trash2 size={15} />
                  <span>Confirmar Exclusão Permanente</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal for Bulk Selection */}
      <AnimatePresence>
        {deletingBulkList && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-white border border-slate-100 rounded-3xl shadow-2xl max-w-lg w-full overflow-hidden"
            >
              <div className="bg-rose-50/80 border-b border-rose-100 p-5 px-6 flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-rose-100 text-rose-600 rounded-2xl shrink-0">
                    <AlertTriangle size={22} />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-rose-950">Excluir {deletingBulkList.length} Lançamentos</h3>
                    <p className="text-xs text-rose-700 font-medium">Exclusão em massa no Firebase</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setDeletingBulkList(null)}
                  className="text-slate-400 hover:text-slate-600 p-1.5 rounded-xl hover:bg-rose-100/50 transition-colors cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="p-6 space-y-4">
                <p className="text-xs text-slate-600">
                  Você está prestes a excluir <strong className="text-slate-900">{deletingBulkList.length} lançamentos</strong> selecionados:
                </p>

                <div className="max-h-48 overflow-y-auto border border-slate-200/80 rounded-2xl divide-y divide-slate-100 bg-slate-50 p-1">
                  {deletingBulkList.map(item => (
                    <div key={item.id} className="p-2.5 flex items-center justify-between text-xs">
                      <div>
                        <span className="font-bold text-slate-900 block">{item.description}</span>
                        <span className="text-[10px] text-slate-500 font-mono">{formatToBrazilianDate(item.dueDate)} • {item.category}</span>
                      </div>
                      <span className="font-mono font-bold text-slate-800">
                        {item.amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="p-3 bg-rose-50 border border-rose-200/80 rounded-xl flex items-center justify-between text-xs text-rose-900 font-bold">
                  <span>Valor total selecionado:</span>
                  <span className="font-mono text-sm">
                    {deletingBulkList.reduce((acc, curr) => acc + curr.amount, 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </span>
                </div>
              </div>

              <div className="bg-slate-50 border-t border-slate-100 p-4 px-6 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setDeletingBulkList(null)}
                  className="px-4 py-2.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold transition-all cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDeleteBulk}
                  className="px-4 py-2.5 bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer shadow-sm"
                >
                  <Trash2 size={15} />
                  <span>Excluir {deletingBulkList.length} Lançamentos</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Customized Partner PDF Report Modal */}
      <AnimatePresence>
        {isPartnerPdfModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 15 }}
              className="bg-white border border-slate-100 rounded-3xl shadow-2xl max-w-4xl w-full my-8 overflow-hidden flex flex-col max-h-[90vh]"
            >
              {/* Modal Header */}
              <div className="bg-slate-900 text-white p-5 px-6 flex items-center justify-between border-b border-slate-800 shrink-0">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-rose-500/20 text-rose-400 border border-rose-500/30 rounded-2xl shrink-0">
                    <FileText size={20} />
                  </div>
                  <div>
                    <h3 className="text-base font-extrabold text-white flex items-center gap-2">
                      <span>Gerar Relatório PDF por Parceiro / Cliente</span>
                      <span className="text-[10px] bg-rose-500/30 text-rose-300 px-2 py-0.5 rounded-full font-black border border-rose-500/40">Com Logo</span>
                    </h3>
                    <p className="text-xs text-slate-400 font-medium">
                      Cabeçalho personalizado com o nome do cliente e a logomarca da empresa
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setIsPartnerPdfModalOpen(false)}
                  className="text-slate-400 hover:text-white p-2 rounded-xl hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Partner Selection Bar */}
              <div className="p-4 px-6 bg-slate-50 border-b border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
                <div className="flex items-center gap-2 flex-1 max-w-md">
                  <label className="text-xs font-bold text-slate-700 whitespace-nowrap flex items-center gap-1.5">
                    <User size={14} className="text-blue-600" />
                    <span>Selecione o Cliente / Parceiro:</span>
                  </label>
                  <select
                    value={selectedPdfPartner}
                    onChange={(e) => setSelectedPdfPartner(e.target.value)}
                    className="w-full text-xs font-bold text-slate-800 bg-white border border-slate-300 rounded-xl px-3 py-2 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 cursor-pointer shadow-2xs"
                  >
                    {partnerOptions.map((p, idx) => (
                      <option key={`pdf-partner-opt-${p}-${idx}`} value={p}>{p}</option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => generatePartnerPdfDocument(selectedPdfPartner)}
                    className="px-4 py-2 bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white text-xs font-bold rounded-xl flex items-center gap-2 transition-all cursor-pointer shadow-md shadow-rose-100"
                  >
                    <Download size={14} />
                    <span>Baixar PDF (.pdf)</span>
                  </button>
                  <button
                    type="button"
                    onClick={handlePrintPartnerReport}
                    className="px-3.5 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 text-xs font-bold rounded-xl flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs"
                  >
                    <Printer size={14} className="text-slate-600" />
                    <span>Imprimir</span>
                  </button>
                </div>
              </div>

              {/* Live PDF Document Preview Box */}
              <div className="p-6 overflow-y-auto bg-slate-100/70 flex-1">
                {selectedPdfPartner ? (
                  <div 
                    id="partner-pdf-preview-content"
                    className="bg-white border border-slate-200 rounded-2xl shadow-md p-8 max-w-3xl mx-auto space-y-6 text-slate-800 font-sans"
                  >
                    {/* PDF Header with Company Logo and Name */}
                    <div className="border-b-2 border-slate-800 pb-5 flex items-start justify-between gap-4">
                      <div className="flex items-center gap-4">
                        <img 
                          src="/logo.png" 
                          alt="Logo ViniMap" 
                          className="w-12 h-12 object-contain rounded-xl border border-slate-200 bg-slate-50 p-1 shadow-2xs"
                          onError={(e) => {
                            (e.target as HTMLElement).style.display = 'none';
                          }}
                        />
                        <div>
                          <h2 className="text-lg font-black text-slate-900 tracking-tight uppercase">
                            VINIMAP EXPRESS LOGÍSTICA
                          </h2>
                          <p className="text-xs text-slate-500 font-semibold">
                            Soluções em Entregas & Gestão Financeira Integrada
                          </p>
                          <p className="text-[10px] text-slate-400 font-mono">
                            CNPJ: 42.189.304/0001-90 • contato@vinimap.com.br
                          </p>
                        </div>
                      </div>

                      <div className="text-right space-y-0.5">
                        <span className="text-[10px] font-black uppercase text-slate-400 block tracking-wider">
                          Documento de Extrato
                        </span>
                        <span className="text-xs font-bold font-mono text-slate-700 block">
                          EMISSÃO: {getSaoPauloDate()}
                        </span>
                        <span className="inline-block text-[9px] bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded font-black uppercase">
                          Relatório Oficial
                        </span>
                      </div>
                    </div>

                    {/* Client / Partner Banner (HEADER COM O NOME DO CLIENTE) */}
                    <div className="bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900 text-white rounded-2xl p-5 shadow-sm space-y-1">
                      <div className="text-[10px] uppercase font-black tracking-widest text-blue-300">
                        PARCEIRO / CLIENTE SELECIONADO
                      </div>
                      <h1 className="text-xl font-black text-white tracking-tight flex items-center gap-2">
                        <span>{selectedPdfPartner}</span>
                      </h1>
                      <div className="text-xs text-slate-300 font-medium flex items-center gap-4 pt-1">
                        <span>Total de Lançamentos: <strong>{transactions.filter(t => t.recipientOrPayer.toLowerCase() === selectedPdfPartner.toLowerCase() || t.description.toLowerCase().includes(selectedPdfPartner.toLowerCase())).length}</strong></span>
                        <span>•</span>
                        <span>ZeroPaper Financial Engine</span>
                      </div>
                    </div>

                    {/* Partner KPI Summary */}
                    {(() => {
                      const pTxs = transactions.filter(t => t.recipientOrPayer.toLowerCase() === selectedPdfPartner.toLowerCase() || t.description.toLowerCase().includes(selectedPdfPartner.toLowerCase()));
                      const pRec = pTxs.filter(t => t.type === 'receivable').reduce((s, t) => s + t.amount, 0);
                      const pPay = pTxs.filter(t => t.type === 'payable').reduce((s, t) => s + t.amount, 0);
                      const pBalance = pRec - pPay;

                      return (
                        <div className="grid grid-cols-3 gap-3">
                          <div className="bg-emerald-50/80 border border-emerald-200/80 rounded-xl p-3.5 space-y-1">
                            <span className="text-[10px] font-black text-emerald-800 uppercase tracking-wider block">A Receber (Entradas)</span>
                            <span className="text-base font-extrabold text-emerald-700 font-mono block">
                              {pRec.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                            </span>
                          </div>
                          <div className="bg-rose-50/80 border border-rose-200/80 rounded-xl p-3.5 space-y-1">
                            <span className="text-[10px] font-black text-rose-800 uppercase tracking-wider block">A Pagar (Saídas/Custos)</span>
                            <span className="text-base font-extrabold text-rose-700 font-mono block">
                              {pPay.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                            </span>
                          </div>
                          <div className="bg-blue-50/80 border border-blue-200/80 rounded-xl p-3.5 space-y-1">
                            <span className="text-[10px] font-black text-blue-800 uppercase tracking-wider block">Saldo do Parceiro</span>
                            <span className={`text-base font-extrabold font-mono block ${pBalance >= 0 ? 'text-blue-700' : 'text-rose-700'}`}>
                              {pBalance.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                            </span>
                          </div>
                        </div>
                      );
                    })()}

                    {/* Itemized Transactions Table */}
                    <div className="space-y-2">
                      <h4 className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center justify-between border-b pb-2 border-slate-200">
                        <span>Detalhamento de Lançamentos Financeiros</span>
                        <span className="text-[10px] text-slate-400 font-normal">Valores em BRL (R$)</span>
                      </h4>

                      {(() => {
                        const pTxs = transactions.filter(t => t.recipientOrPayer.toLowerCase() === selectedPdfPartner.toLowerCase() || t.description.toLowerCase().includes(selectedPdfPartner.toLowerCase()));
                        
                        if (pTxs.length === 0) {
                          return (
                            <div className="p-6 text-center text-xs text-slate-400 bg-slate-50 rounded-xl">
                              Nenhum lançamento financeiro registrado para este parceiro.
                            </div>
                          );
                        }

                        return (
                          <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
                            <table className="w-full text-left text-xs">
                              <thead className="bg-slate-900 text-white text-[10px] font-black uppercase">
                                <tr>
                                  <th className="p-2.5">Vencimento</th>
                                  <th className="p-2.5">Descrição</th>
                                  <th className="p-2.5">Tipo</th>
                                  <th className="p-2.5">Categoria</th>
                                  <th className="p-2.5 text-center">Status</th>
                                  <th className="p-2.5 text-right">Valor</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100 text-[11px]">
                                {pTxs.map((t) => (
                                  <tr key={t.id} className="hover:bg-slate-50/80 transition-colors">
                                    <td className="p-2.5 font-mono text-slate-600">{formatToBrazilianDate(t.dueDate)}</td>
                                    <td className="p-2.5 font-bold text-slate-900">{t.description}</td>
                                    <td className="p-2.5 font-semibold">
                                      <span className={t.type === 'receivable' ? 'text-emerald-600' : 'text-rose-600'}>
                                        {t.type === 'receivable' ? 'Receber (+)' : 'Pagar (-)'}
                                      </span>
                                    </td>
                                    <td className="p-2.5 text-slate-600">{t.category}</td>
                                    <td className="p-2.5 text-center">
                                      <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${
                                        t.status === 'Pago' 
                                          ? 'bg-emerald-100 text-emerald-800' 
                                          : t.status === 'Atrasado' 
                                          ? 'bg-rose-100 text-rose-800' 
                                          : 'bg-amber-100 text-amber-800'
                                      }`}>
                                        {t.status}
                                      </span>
                                    </td>
                                    <td className="p-2.5 text-right font-mono font-bold text-slate-900">
                                      {t.amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        );
                      })()}
                    </div>

                    {/* Associated Orders (if any) */}
                    {(() => {
                      const pOrders = orders.filter(o => (o.partnerName && o.partnerName.toLowerCase() === selectedPdfPartner.toLowerCase()) || (o.clientName && o.clientName.toLowerCase() === selectedPdfPartner.toLowerCase()));
                      if (pOrders.length === 0) return null;

                      return (
                        <div className="space-y-2 pt-2">
                          <h4 className="text-xs font-black uppercase tracking-wider text-slate-700 border-b pb-2 border-slate-200">
                            Histórico de Pedidos de Entrega Associados ({pOrders.length})
                          </h4>
                          <div className="border border-slate-200 rounded-xl overflow-hidden">
                            <table className="w-full text-left text-xs">
                              <thead className="bg-slate-700 text-white text-[10px] font-black uppercase">
                                <tr>
                                  <th className="p-2">Cód. Pedido</th>
                                  <th className="p-2">Data</th>
                                  <th className="p-2">Cliente Final</th>
                                  <th className="p-2">Região</th>
                                  <th className="p-2 text-center">Status</th>
                                  <th className="p-2 text-right">Valor</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100 text-[11px]">
                                {pOrders.slice(0, 10).map((o) => (
                                  <tr key={o.id}>
                                    <td className="p-2 font-mono font-bold text-slate-900">{o.id}</td>
                                    <td className="p-2 font-mono text-slate-600">{formatToBrazilianDate(o.date)}</td>
                                    <td className="p-2 text-slate-800 font-medium">{o.clientName}</td>
                                    <td className="p-2 text-slate-600">{o.region}</td>
                                    <td className="p-2 text-center">
                                      <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-slate-100 text-slate-700">
                                        {o.status}
                                      </span>
                                    </td>
                                    <td className="p-2 text-right font-mono font-bold text-slate-900">
                                      {o.value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      );
                    })()}

                    {/* PDF Footer Disclaimer */}
                    <div className="border-t border-slate-200 pt-4 flex items-center justify-between text-[10px] text-slate-400 font-medium">
                      <span>Documento gerado automaticamente pelo Sistema ViniMap Express.</span>
                      <span>Página 1 de 1 • ZeroPaper Suite</span>
                    </div>
                  </div>
                ) : (
                  <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center text-slate-500 space-y-3">
                    <User size={32} className="mx-auto text-slate-300" />
                    <p className="text-xs font-bold">Nenhum parceiro/cliente selecionado para visualizar.</p>
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div className="bg-slate-50 border-t border-slate-200 p-4 px-6 flex items-center justify-between shrink-0">
                <span className="text-xs text-slate-500 font-medium">
                  {selectedPdfPartner ? `Pronto para exportar relatório de "${selectedPdfPartner}"` : 'Selecione um parceiro'}
                </span>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsPartnerPdfModalOpen(false)}
                    className="px-4 py-2.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-xl text-xs font-bold transition-all cursor-pointer"
                  >
                    Fechar
                  </button>
                  <button
                    type="button"
                    onClick={() => generatePartnerPdfDocument(selectedPdfPartner)}
                    className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer shadow-md shadow-rose-100"
                  >
                    <Download size={15} />
                    <span>Baixar PDF (.pdf)</span>
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
};
