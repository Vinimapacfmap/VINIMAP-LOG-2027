import { 
  ShoppingBag, 
  Truck, 
  CheckCircle2, 
  Clock, 
  DollarSign, 
  AlertCircle,
  XCircle,
  TrendingUp,
  TrendingDown
} from 'lucide-react';
import { Order, OrderStatus } from '../types';

interface KPISectionProps {
  orders: Order[];
  onCardClick?: (status: 'Todos' | OrderStatus) => void;
  activeTab?: 'Todos' | OrderStatus;
}

export default function KPISection({ orders, onCardClick, activeTab = 'Todos' }: KPISectionProps) {
  // Dynamic metrics based on current state
  const total = orders.length;
  const notStarted = orders.filter((o) => o.status === 'Não iniciado').length;
  const inRoute = orders.filter((o) => o.status === 'Em rota').length;
  const delivering = orders.filter((o) => o.status === 'Entregando').length;
  const completed = orders.filter((o) => o.status === 'Concluído').length;
  const occurrence = orders.filter((o) => o.status === 'Ocorrência').length;
  const canceled = orders.filter((o) => o.status === 'Cancelado').length;
  
  // Calculate total revenue from Completed and Active orders (excluding Canceled)
  const totalRevenue = orders.reduce((acc, o) => {
    if (o.status !== 'Cancelado') {
      return acc + o.value;
    }
    return acc;
  }, 0);

  const cards = [
    {
      id: 'kpi-total',
      statusValue: 'Todos' as const,
      title: 'Total Geral',
      value: total,
      sub: '+12.5% vs. ontem',
      isTrendUp: true,
      icon: ShoppingBag,
      color: 'blue',
      sparkline: 'M 0 25 Q 15 5, 30 15 T 60 10 T 90 5 T 120 18',
    },
    {
      id: 'kpi-notstarted',
      statusValue: 'Não iniciado' as const,
      title: 'Não Iniciado',
      value: notStarted,
      sub: 'Aguardando despacho',
      isTrendUp: notStarted > 3,
      icon: Clock,
      color: 'amber',
      sparkline: 'M 0 25 Q 15 30, 30 18 T 60 22 T 90 10 T 120 15',
    },
    {
      id: 'kpi-inroute',
      statusValue: 'Em rota' as const,
      title: 'Em Rota',
      value: inRoute,
      sub: 'A caminho da entrega',
      isTrendUp: inRoute > 0,
      icon: Truck,
      color: 'sky',
      sparkline: 'M 0 25 Q 15 20, 30 25 T 60 15 T 90 18 T 120 8',
    },
    {
      id: 'kpi-delivering',
      statusValue: 'Entregando' as const,
      title: 'Entregando',
      value: delivering,
      sub: 'Ações de entrega',
      isTrendUp: true,
      icon: Truck,
      color: 'indigo',
      sparkline: 'M 0 25 Q 15 10, 30 30 T 60 15 T 90 22 T 120 5',
    },
    {
      id: 'kpi-completed',
      statusValue: 'Concluído' as const,
      title: 'Concluído',
      value: completed,
      sub: '98.2% dentro do SLA',
      isTrendUp: true,
      icon: CheckCircle2,
      color: 'emerald',
      sparkline: 'M 0 25 Q 15 20, 30 10 T 60 8 T 90 4 T 120 2',
    },
    {
      id: 'kpi-occurrence',
      statusValue: 'Ocorrência' as const,
      title: 'Ocorrência',
      value: occurrence,
      sub: 'Requer atenção',
      isTrendUp: occurrence > 1,
      icon: AlertCircle,
      color: 'rose',
      sparkline: 'M 0 10 Q 15 15, 30 12 T 60 20 T 90 15 T 120 28',
    },
    {
      id: 'kpi-canceled',
      statusValue: 'Cancelado' as const,
      title: 'Cancelados',
      value: canceled,
      sub: 'Taxa sob controle',
      isTrendUp: false,
      icon: XCircle,
      color: 'slate',
      sparkline: 'M 0 10 L 30 10 L 60 25 L 90 20 L 120 30',
    },
  ];

  const getColorClasses = (color: string) => {
    switch (color) {
      case 'blue':
        return {
          bg: 'bg-blue-50/50',
          border: 'border-blue-100',
          iconBg: 'bg-blue-100 text-blue-600',
          sparkline: 'stroke-blue-400',
          text: 'text-blue-600'
        };
      case 'indigo':
        return {
          bg: 'bg-indigo-50/50',
          border: 'border-indigo-100',
          iconBg: 'bg-indigo-100 text-indigo-600',
          sparkline: 'stroke-indigo-400',
          text: 'text-indigo-600'
        };
      case 'emerald':
        return {
          bg: 'bg-emerald-50/50',
          border: 'border-emerald-100',
          iconBg: 'bg-emerald-100 text-emerald-600',
          sparkline: 'stroke-emerald-400',
          text: 'text-emerald-600'
        };
      case 'amber':
        return {
          bg: 'bg-amber-50/50',
          border: 'border-amber-100',
          iconBg: 'bg-amber-100 text-amber-600',
          sparkline: 'stroke-amber-400',
          text: 'text-amber-600'
        };
      case 'rose':
        return {
          bg: 'bg-rose-50/50',
          border: 'border-rose-100',
          iconBg: 'bg-rose-100 text-rose-600',
          sparkline: 'stroke-rose-400',
          text: 'text-rose-600'
        };
      case 'slate':
        return {
          bg: 'bg-slate-50/50',
          border: 'border-slate-200',
          iconBg: 'bg-slate-200 text-slate-600',
          sparkline: 'stroke-slate-400',
          text: 'text-slate-600'
        };
      case 'sky':
        return {
          bg: 'bg-sky-50/50',
          border: 'border-sky-100',
          iconBg: 'bg-sky-100 text-sky-600',
          sparkline: 'stroke-sky-400',
          text: 'text-sky-600'
        };
      default:
        return {
          bg: 'bg-slate-50/50',
          border: 'border-slate-100',
          iconBg: 'bg-slate-100 text-slate-600',
          sparkline: 'stroke-slate-400',
          text: 'text-slate-600'
        };
    }
  };

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-7 gap-4" id="kpi-grid-container">
      {cards.map((card) => {
        const Icon = card.icon;
        const styles = getColorClasses(card.color);
        const isClickable = card.statusValue !== null && onCardClick;
        const isActive = isClickable && activeTab === card.statusValue;

        return (
          <div
            key={card.id}
            onClick={() => {
              if (isClickable) {
                onCardClick!(card.statusValue!);
              }
            }}
            className={`bg-white border p-4 rounded-2xl relative overflow-hidden shadow-sm transition-all duration-300 group ${
              isClickable ? 'cursor-pointer hover:shadow-md hover:scale-[1.01]' : ''
            } ${
              isActive 
                ? 'ring-2 ring-blue-500 border-blue-300 bg-blue-50/10 scale-[1.02] shadow-md shadow-blue-50' 
                : 'border-slate-100'
            }`}
            id={card.id}
          >
            {/* Background Sparkline Decorator */}
            <div className="absolute bottom-0 right-0 left-0 h-10 overflow-hidden opacity-30 pointer-events-none group-hover:opacity-55 transition-opacity">
              <svg viewBox="0 0 120 30" width="100%" height="100%" preserveAspectRatio="none">
                <path
                  d={card.sparkline}
                  fill="none"
                  className={styles.sparkline}
                  strokeWidth="2.5"
                  strokeLinecap="round"
                />
              </svg>
            </div>

            <div className="flex items-center justify-between relative z-10">
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
                {card.title}
              </span>
              <div className={`p-1.5 rounded-xl ${styles.iconBg} shrink-0 transition-transform group-hover:scale-110`}>
                <Icon size={14} />
              </div>
            </div>

            <div className="mt-2 relative z-10 flex items-baseline gap-1.5">
              <span className="text-lg md:text-xl font-extrabold text-slate-800 tracking-tight">
                {card.value}
              </span>
              {isActive && (
                <span className="text-[9px] text-blue-600 bg-blue-50 border border-blue-100 px-1 rounded-md font-bold uppercase tracking-wider scale-90">
                  Filtro
                </span>
              )}
            </div>

            <div className="mt-1 relative z-10 flex items-center gap-1">
              {card.isTrendUp ? (
                <TrendingUp size={10} className={card.color === 'rose' ? 'text-rose-500' : 'text-emerald-500'} />
              ) : (
                <TrendingDown size={10} className="text-blue-500" />
              )}
              <span className={`text-[9px] font-bold ${
                card.color === 'rose' ? 'text-rose-600' : 
                card.color === 'amber' ? 'text-amber-600' : 
                'text-slate-500'
              }`}>
                {card.sub}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
