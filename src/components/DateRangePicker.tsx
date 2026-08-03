/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, X, ChevronDown } from 'lucide-react';

interface DateRangePickerProps {
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
  onChange: (start: string, end: string) => void;
}

// Helper to convert Date object to YYYY-MM-DD in local time
function dateToYmd(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// Helper to parse YYYY-MM-DD to a local Date object
function ymdToDate(ymd: string): Date {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(y, m - 1, d);
}

// Helper to format YYYY-MM-DD to DD/MM/YYYY
function formatYmdBR(ymd: string): string {
  if (!ymd) return '';
  const [y, m, d] = ymd.split('-');
  return `${d}/${m}/${y}`;
}

const MONTH_NAMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

export default function DateRangePicker({ startDate, endDate, onChange }: DateRangePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  
  // Local state for calendar navigation month/year
  const [currentYear, setCurrentYear] = useState(() => {
    const d = startDate ? ymdToDate(startDate) : new Date();
    return d.getFullYear();
  });
  const [currentMonth, setCurrentMonth] = useState(() => {
    const d = startDate ? ymdToDate(startDate) : new Date();
    return d.getMonth(); // 0-11
  });

  // Track hover state for range preview
  const [hoverDate, setHoverDate] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);

  // Close calendar on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Update navigation month/year when startDate is set externally
  useEffect(() => {
    if (startDate) {
      const d = ymdToDate(startDate);
      setCurrentYear(d.getFullYear());
      setCurrentMonth(d.getMonth());
    }
  }, [startDate]);

  // Calendar math
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const firstDayIndex = new Date(currentYear, currentMonth, 1).getDay();

  // Generate calendar cells (padding + active days)
  const cells: { dateStr: string; dayNum: number; isCurrentMonth: boolean }[] = [];
  
  // Previous month padding
  const prevMonthDays = new Date(currentYear, currentMonth, 0).getDate();
  for (let i = firstDayIndex - 1; i >= 0; i--) {
    const d = prevMonthDays - i;
    // Calculate year/month for previous month padding
    let prevY = currentYear;
    let prevM = currentMonth - 1;
    if (prevM < 0) {
      prevM = 11;
      prevY--;
    }
    cells.push({
      dateStr: `${prevY}-${String(prevM + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`,
      dayNum: d,
      isCurrentMonth: false
    });
  }

  // Current month days
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({
      dateStr: `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`,
      dayNum: d,
      isCurrentMonth: true
    });
  }

  // Next month padding to fill grid (6 rows * 7 days = 42 cells)
  const totalCellsNeeded = 42;
  const nextMonthCellsNeeded = totalCellsNeeded - cells.length;
  for (let d = 1; d <= nextMonthCellsNeeded; d++) {
    let nextY = currentYear;
    let nextM = currentMonth + 1;
    if (nextM > 11) {
      nextM = 0;
      nextY++;
    }
    cells.push({
      dateStr: `${nextY}-${String(nextM + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`,
      dayNum: d,
      isCurrentMonth: false
    });
  }

  const handlePrevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear(prev => prev - 1);
    } else {
      setCurrentMonth(prev => prev - 1);
    }
  };

  const handleNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear(prev => prev + 1);
    } else {
      setCurrentMonth(prev => prev + 1);
    }
  };

  const handleDayClick = (dateStr: string) => {
    if (!startDate || (startDate && endDate)) {
      // Start a new range selection - set end date to same date initially
      onChange(dateStr, dateStr);
    } else {
      // Complete range selection
      const startD = ymdToDate(startDate);
      const clickedD = ymdToDate(dateStr);
      
      if (clickedD < startD) {
        // If clicked date is before start date, make it the new start date
        onChange(dateStr, dateStr);
      } else {
        onChange(startDate, dateStr);
        setIsOpen(false);
      }
    }
  };

  // Check if date is selected
  const isStart = (dateStr: string) => startDate === dateStr;
  const isEnd = (dateStr: string) => endDate === dateStr;
  
  const isWithinRange = (dateStr: string) => {
    if (!startDate) return false;
    
    const d = ymdToDate(dateStr);
    const startD = ymdToDate(startDate);
    
    if (endDate) {
      const endD = ymdToDate(endDate);
      return d >= startD && d <= endD;
    }
    
    if (hoverDate) {
      const hoverD = ymdToDate(hoverDate);
      if (hoverD >= startD) {
        return d >= startD && d <= hoverD;
      }
    }
    
    return false;
  };

  // Preset Handlers
  const selectPreset = (daysAgo: number | 'today' | 'yesterday' | 'thisMonth') => {
    const today = new Date();
    today.setHours(12, 0, 0, 0); // avoid UTC rollover problems
    
    if (daysAgo === 'today') {
      const ymd = dateToYmd(today);
      onChange(ymd, ymd);
    } else if (daysAgo === 'yesterday') {
      const yesterday = new Date(today);
      yesterday.setDate(today.getDate() - 1);
      const ymd = dateToYmd(yesterday);
      onChange(ymd, ymd);
    } else if (daysAgo === 'thisMonth') {
      const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
      const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);
      onChange(dateToYmd(firstDay), dateToYmd(lastDay));
    } else {
      // e.g., 7 days or 30 days
      const start = new Date(today);
      start.setDate(today.getDate() - (daysAgo as number));
      onChange(dateToYmd(start), dateToYmd(today));
    }
    setIsOpen(false);
  };

  // Label text for active trigger
  const labelText = startDate && endDate 
    ? `${formatYmdBR(startDate)} - ${formatYmdBR(endDate)}`
    : startDate 
      ? `A partir de ${formatYmdBR(startDate)}`
      : 'Selecionar período';

  return (
    <div className="relative w-full" ref={containerRef} id="date-range-picker-container">
      {/* Trigger Button */}
      <div className="space-y-1">
        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block flex items-center gap-1 select-none">
          <CalendarIcon size={10} className="text-slate-400" />
          Período de Entrega
        </label>
        
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className={`w-full flex items-center justify-between px-3 py-1.5 bg-slate-50 border ${isOpen ? 'border-blue-400 ring-2 ring-blue-100 bg-white' : 'border-slate-100'} rounded-xl text-xs font-semibold text-slate-700 transition-all cursor-pointer`}
          id="date-picker-trigger-btn"
        >
          <div className="flex items-center gap-2 truncate">
            <CalendarIcon size={13} className="text-slate-500 shrink-0" />
            <span className="truncate">{labelText}</span>
          </div>
          <ChevronDown size={14} className={`text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {/* Popover Calendar */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ duration: 0.15 }}
            className="absolute left-0 mt-2 z-50 bg-white border border-slate-100 shadow-xl rounded-2xl p-4 flex flex-col md:flex-row gap-4 min-w-[320px] md:min-w-[480px]"
            id="date-picker-popup"
          >
            {/* Presets Column (Left on Desktop, Top on Mobile) */}
            <div className="w-full md:w-36 shrink-0 flex flex-row md:flex-col gap-1 overflow-x-auto pb-2 md:pb-0 border-b md:border-b-0 md:border-r border-slate-100 pr-0 md:pr-4">
              <button
                type="button"
                onClick={() => selectPreset('today')}
                className="whitespace-nowrap text-left px-2.5 py-1.5 rounded-lg text-[11px] font-bold text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors cursor-pointer"
              >
                Hoje
              </button>
              <button
                type="button"
                onClick={() => selectPreset('yesterday')}
                className="whitespace-nowrap text-left px-2.5 py-1.5 rounded-lg text-[11px] font-bold text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors cursor-pointer"
              >
                Ontem
              </button>
              <button
                type="button"
                onClick={() => selectPreset(6)}
                className="whitespace-nowrap text-left px-2.5 py-1.5 rounded-lg text-[11px] font-bold text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors cursor-pointer"
              >
                Últimos 7 dias
              </button>
              <button
                type="button"
                onClick={() => selectPreset(29)}
                className="whitespace-nowrap text-left px-2.5 py-1.5 rounded-lg text-[11px] font-bold text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors cursor-pointer"
              >
                Últimos 30 dias
              </button>
              <button
                type="button"
                onClick={() => selectPreset('thisMonth')}
                className="whitespace-nowrap text-left px-2.5 py-1.5 rounded-lg text-[11px] font-bold text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors cursor-pointer"
              >
                Este Mês
              </button>
              
              {startDate && (
                <button
                  type="button"
                  onClick={() => {
                    onChange('', '');
                    setIsOpen(false);
                  }}
                  className="whitespace-nowrap text-left px-2.5 py-1.5 rounded-lg text-[11px] font-bold text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer mt-auto"
                >
                  Limpar Período
                </button>
              )}
            </div>

            {/* Calendar Calendar Column */}
            <div className="flex-1 flex flex-col select-none">
              {/* Header Month Navigation */}
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-black text-slate-700 tracking-wide uppercase">
                  {MONTH_NAMES[currentMonth]} {currentYear}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={handlePrevMonth}
                    className="p-1 rounded-lg hover:bg-slate-50 text-slate-500 hover:text-slate-800 transition-all cursor-pointer"
                  >
                    <ChevronLeft size={15} />
                  </button>
                  <button
                    type="button"
                    onClick={handleNextMonth}
                    className="p-1 rounded-lg hover:bg-slate-50 text-slate-500 hover:text-slate-800 transition-all cursor-pointer"
                  >
                    <ChevronRight size={15} />
                  </button>
                </div>
              </div>

              {/* Weekdays Headers */}
              <div className="grid grid-cols-7 text-center gap-y-1 mb-1">
                {WEEKDAYS.map(day => (
                  <span key={day} className="text-[10px] font-black text-slate-400 uppercase tracking-wider">
                    {day}
                  </span>
                ))}
              </div>

              {/* Grid Days */}
              <div className="grid grid-cols-7 text-center gap-y-1.5 gap-x-1">
                {cells.map((cell, index) => {
                  const isS = isStart(cell.dateStr);
                  const isE = isEnd(cell.dateStr);
                  const isMid = isWithinRange(cell.dateStr) && !isS && !isE;
                  const isToday = dateToYmd(new Date()) === cell.dateStr;

                  let textClass = 'text-slate-700';
                  if (!cell.isCurrentMonth) textClass = 'text-slate-300';
                  if (isS || isE) textClass = 'text-white font-extrabold';
                  if (isMid) textClass = 'text-blue-700 font-bold';

                  let bgClass = 'hover:bg-slate-50';
                  if (isS) bgClass = 'bg-blue-600 rounded-l-xl rounded-r-none shadow-sm shadow-blue-200';
                  if (isE) bgClass = 'bg-blue-600 rounded-r-xl rounded-l-none shadow-sm shadow-blue-200';
                  if (isS && isE) bgClass = 'bg-blue-600 rounded-xl shadow-sm shadow-blue-200';
                  if (isMid) bgClass = 'bg-blue-50/70 rounded-none';

                  // Border indicator for today if not selected
                  const borderClass = isToday && !isS && !isE ? 'ring-1 ring-blue-300 ring-offset-1' : '';

                  return (
                    <button
                      key={index}
                      type="button"
                      onClick={() => handleDayClick(cell.dateStr)}
                      onMouseEnter={() => startDate && !endDate && setHoverDate(cell.dateStr)}
                      onMouseLeave={() => setHoverDate(null)}
                      className={`w-full aspect-square flex items-center justify-center text-[11px] font-semibold rounded-lg transition-all relative cursor-pointer ${bgClass} ${textClass} ${borderClass}`}
                    >
                      {cell.dayNum}
                    </button>
                  );
                })}
              </div>

              {/* Footer instruction */}
              <div className="mt-3.5 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-400 font-medium">
                <span>
                  {!startDate 
                    ? 'Selecione data inicial' 
                    : !endDate 
                      ? 'Selecione data final' 
                      : 'Período completo'}
                </span>
                {startDate && !endDate && (
                  <button
                    type="button"
                    onClick={() => {
                      onChange(startDate, startDate);
                      setIsOpen(false);
                    }}
                    className="text-blue-600 font-bold hover:underline"
                  >
                    Selecionar apenas este dia
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
