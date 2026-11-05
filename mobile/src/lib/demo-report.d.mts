import type { Trip } from './types';
export function demoReport(trip: Trip, format: 'pdf' | 'xlsx', analytics?: boolean): Uint8Array;
