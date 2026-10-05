// Money maths for shared groups. Everything is in whole paise, so shares always add up exactly.

export const toPaise = (rupees: number) => Math.round(rupees * 100);
export const toRupees = (paise: number) => paise / 100;

// Splits an amount evenly; the leftover paise go one each to the first members,
// so ₹100 between three is 33.34 + 33.33 + 33.33
export function splitEqually(amount: number, memberIds: string[]) {
  const base = Math.floor(amount / memberIds.length);
  const extra = amount - base * memberIds.length;
  return memberIds.map((memberId, i) => ({ memberId, amount: base + (i < extra ? 1 : 0) }));
}

interface Ledger {
  expenses: { paidById: string; amount: number; shares: { memberId: string; amount: number }[] }[];
  settlements: { fromMemberId: string; toMemberId: string; amount: number }[];
}

// Each member's balance: above zero means the group owes them, below zero means they owe
export function balances(memberIds: string[], { expenses, settlements }: Ledger) {
  const balance = new Map(memberIds.map((id) => [id, 0]));
  const add = (id: string, amount: number) => balance.set(id, (balance.get(id) ?? 0) + amount);
  for (const e of expenses) {
    add(e.paidById, e.amount);
    for (const s of e.shares) add(s.memberId, -s.amount);
  }
  for (const s of settlements) {
    add(s.fromMemberId, s.amount);
    add(s.toMemberId, -s.amount);
  }
  return balance;
}

// The fewest payments that settle everyone up: the biggest debtor pays the biggest creditor,
// over and over. Ties are broken by member order, so the suggestion doesn't jump around.
export function simplifyDebts(balance: Map<string, number>) {
  const order = [...balance.keys()];
  const debtors = order.filter((id) => balance.get(id)! < 0).map((id) => ({ id, left: -balance.get(id)! }));
  const creditors = order.filter((id) => balance.get(id)! > 0).map((id) => ({ id, left: balance.get(id)! }));
  const payments: { fromMemberId: string; toMemberId: string; amount: number }[] = [];
  const biggest = <T extends { left: number }>(list: T[]) => list.reduce((best, x) => (x.left > best.left ? x : best));

  while (debtors.some((d) => d.left > 0) && creditors.some((c) => c.left > 0)) {
    const debtor = biggest(debtors.filter((d) => d.left > 0));
    const creditor = biggest(creditors.filter((c) => c.left > 0));
    const amount = Math.min(debtor.left, creditor.left);
    payments.push({ fromMemberId: debtor.id, toMemberId: creditor.id, amount });
    debtor.left -= amount;
    creditor.left -= amount;
  }
  return payments;
}
