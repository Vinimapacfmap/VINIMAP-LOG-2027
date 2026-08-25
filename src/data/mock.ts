/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Order, DeliveryRider, ActivityLog, ChartDataPoint, RegionDistribution } from '../types';

// Real Data Defaults: No hardcoded mock riders, orders or logs.
// The system operates exclusively with real data registered by the administrator.
export const INITIAL_RIDERS: DeliveryRider[] = [];
export const INITIAL_ORDERS: Order[] = [];
export const INITIAL_LOGS: ActivityLog[] = [];
export const CHART_DATA: ChartDataPoint[] = [];
export const REGION_DISTRIBUTIONS: RegionDistribution[] = [];
