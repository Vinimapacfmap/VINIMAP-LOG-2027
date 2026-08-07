import { useMemo } from 'react';
import { Order, DeliveryRider } from '../types';

/**
 * Custom hook that returns a map of riderId -> completed deliveries count.
 * Recalculates automatically in real time based strictly on orders with status 'Concluído'.
 */
export function useRiderCompletedDeliveriesMap(orders: Order[] = []): Record<string, number> {
  return useMemo(() => {
    const map: Record<string, number> = {};
    if (!Array.isArray(orders)) return map;

    for (let i = 0; i < orders.length; i++) {
      const order = orders[i];
      if (order && order.status === 'Concluído' && order.riderId) {
        map[order.riderId] = (map[order.riderId] || 0) + 1;
      }
    }
    return map;
  }, [orders]);
}

/**
 * Custom hook that calculates completed deliveries count for a single rider.
 */
export function useRiderCompletedCount(riderId: string | undefined | null, orders: Order[] = []): number {
  const map = useRiderCompletedDeliveriesMap(orders);
  if (!riderId) return 0;
  return map[riderId] || 0;
}

/**
 * Custom hook that recalculates rider.completedDeliveries in real time for an array of riders.
 * Eliminates manual state increments by computing counts directly from orders with status 'Concluído'.
 */
export function useCalculatedRiders(riders: DeliveryRider[] = [], orders: Order[] = []): DeliveryRider[] {
  const countsMap = useRiderCompletedDeliveriesMap(orders);

  return useMemo(() => {
    if (!Array.isArray(riders)) return [];

    return riders.map(rider => {
      const completedCount = countsMap[rider.id] || 0;
      return {
        ...rider,
        completedDeliveries: completedCount,
      };
    });
  }, [riders, countsMap]);
}

export default useCalculatedRiders;
