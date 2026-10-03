import { announceNotificationsChange } from "./dataEvents";

// Returned when saving an expense takes a budget to 80% or past 100% for the first time this month
export interface BudgetAlert {
  level: 80 | 100;
  message: string;
}

// The toast after saving, with the budget alert added when there is one. The alert is also
// in the bell now, so the bell's count is refreshed.
export function withBudgetAlert(saved: string, alert: BudgetAlert | null) {
  if (!alert) return saved;
  announceNotificationsChange();
  return `${saved}. ${alert.message}.`;
}
