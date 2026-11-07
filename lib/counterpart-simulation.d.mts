export interface CounterpartSimulation {
  totalCents: string;
  rateBasisPoints: number;
  municipalCents: string;
  remainingProjectCents: string;
  availableCents: string;
  shortageCents: string;
  surplusCents: string;
}

export declare function simulateCounterpart(
  totalCents: string,
  percent: string,
  availableBudget: string,
): CounterpartSimulation | null;
