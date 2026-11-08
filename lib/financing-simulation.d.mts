export interface FinancingScenarioInput {
  monthlyRate: string;
  amortizationMonths: string;
  graceMonths: string;
}

export interface FinancingInstallment {
  month: number;
  phase: 'grace' | 'amortization';
  openingBalanceCents: string;
  amortizationCents: string;
  interestCents: string;
  installmentCents: string;
  balanceCents: string;
}

export interface FinancingSimulationResult {
  principalCents: string;
  monthlyRateUnits: number;
  amortizationMonths: number;
  graceMonths: number;
  gracePaymentCents: string | null;
  firstAmortizationPaymentCents: string;
  lastAmortizationPaymentCents: string;
  totalInterestCents: string;
  totalPaidCents: string;
  installments: FinancingInstallment[];
}

export declare function simulateFinancing(
  principalCents: string,
  input: FinancingScenarioInput,
): FinancingSimulationResult | null;
