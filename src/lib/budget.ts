import type { Expense, Member } from "./types";

/** Valeur de `paidBy` pour une dépense payée à deux (compte commun). */
export const JOINT = "ensemble";

/**
 * Comptes entre les deux parents : chaque dépense partagée et non réglée
 * vaut une moitié due à celui qui l'a payée. Renvoie qui doit combien à qui.
 */
export function balance(expenses: Expense[], parents: Member[]) {
  const [a, b] = parents;
  if (!a || !b) return null;
  const open = expenses.filter((e) => e.shared && !e.settled && (e.paidBy === a.id || e.paidBy === b.id));
  // > 0 : b doit à a ; < 0 : a doit à b.
  const net = open.reduce((s, e) => s + (e.paidBy === a.id ? e.amount / 2 : -e.amount / 2), 0);
  const amount = Math.round(Math.abs(net) * 100) / 100;
  return {
    open,
    amount,
    from: net > 0 ? b : a,
    to: net > 0 ? a : b,
  };
}
