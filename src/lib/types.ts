export type Member = {
  id: string;
  name: string;
  birthDate: string; // AAAA-MM-JJ
  color: string;
  role: "parent" | "enfant";
  uid?: string; // compte lié (parents uniquement)
};

export type Family = {
  id: string;
  name: string;
  memberUids: string[];
  members: Member[];
};

export type Recurrence = "none" | "daily" | "weekly" | "monthly" | "yearly";

export type CalendarEvent = {
  id: string;
  title: string;
  date: string; // AAAA-MM-JJ
  startTime?: string; // HH:mm, absent = toute la journée
  endTime?: string;
  memberIds: string[];
  recurrence: Recurrence;
  until?: string; // AAAA-MM-JJ, fin de la récurrence
  location?: string;
  notes?: string;
  birthday?: boolean; // généré automatiquement, non stocké
};

export type Todo = {
  id: string;
  title: string;
  done: boolean;
  assigneeId?: string;
  dueDate?: string;
  createdAt: number;
};

export type ShoppingItem = {
  id: string;
  name: string;
  quantity?: string;
  aisle: string;
  checked: boolean;
  createdAt: number;
};

export type Recipe = {
  id: string;
  name: string;
  ingredients: string[];
  notes?: string;
  tags?: string[];
};

export type MealSlot = {
  id: string; // AAAA-MM-JJ_midi | AAAA-MM-JJ_soir
  date: string;
  slot: "midi" | "soir";
  recipeId?: string;
  text?: string;
};

export type Expense = {
  id: string;
  label: string;
  amount: number;
  category: string;
  date: string;
  paidBy: string; // id membre
};

export type BudgetSettings = {
  categories: { name: string; monthly: number }[];
};
