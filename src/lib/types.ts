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
  endDate?: string; // dernier jour pour un événement « toute la journée » sur plusieurs jours
  startTime?: string; // HH:mm, absent = toute la journée
  endTime?: string;
  memberIds: string[];
  recurrence: Recurrence;
  until?: string; // AAAA-MM-JJ, fin de la récurrence
  location?: string;
  notes?: string;
  birthday?: boolean; // généré automatiquement, non stocké
  source?: string; // nom de l'agenda Google d'origine, lecture seule
  color?: string; // couleur personnalisée (dans l'app seulement)
  uid?: string; // identifiant iCal de l'événement Google
  feedId?: string; // agenda Google d'origine
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
  note?: string; // souvenir libre : « chez mamie », « les filles ont adoré »…
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

export type SizeEntry = { date: string; clothes?: string; shoes?: string; head?: string };

export type KidProfile = {
  sizes?: { clothes?: string; shoes?: string; head?: string; updated?: string }; // ancien format, repris dans l'historique
  sizeHistory?: SizeEntry[];
  growth?: { date: string; weight?: number; height?: number }[];
  health?: { doctor?: string; allergies?: string; bloodType?: string; notes?: string };
  vaccines?: { name: string; date?: string; nextDue?: string }[];
  contacts?: { name: string; role: string; phone?: string }[];
};

export type CalendarFeed = {
  id: string;
  name: string;
  url: string; // adresse secrète iCal
  memberIds: string[];
  color?: string; // couleur par défaut des événements de cet agenda (dans l'app seulement)
};

export type CalendarSettings = {
  feeds?: CalendarFeed[];
  exportToken?: string; // jeton de l'agenda familial publié pour Google Agenda
  eventColors?: Record<string, string>; // couleur choisie pour un événement Google, clé `${feedId}:${uid}`
};
