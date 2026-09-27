import { Calculator, Landmark, PiggyBank, ShieldCheck, TrendingUp } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export const CALCULATOR_ICONS: Record<string, LucideIcon> = {
  sip: TrendingUp,
  emi: Landmark,
  fd: PiggyBank,
  inflation: Calculator,
  "emergency-fund": ShieldCheck,
};
