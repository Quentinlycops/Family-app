/** Les espaces de l'app : un emoji et une couleur chacun, pour s'y retrouver d'un coup d'œil. */
export type Space = {
  href: string;
  label: string;
  emoji: string;
  /** Couleur douce de la bulle (fond) et couleur vive (texte, accent). */
  soft: string;
  strong: string;
  hint: string;
};

export const SPACES: Space[] = [
  { href: "/accueil", label: "Accueil", emoji: "🏡", soft: "#ede9fe", strong: "#6d28d9", hint: "Le résumé du jour" },
  { href: "/agenda", label: "Agenda", emoji: "📅", soft: "#dbeafe", strong: "#1d4ed8", hint: "Rendez-vous et activités" },
  { href: "/courses", label: "Courses", emoji: "🛒", soft: "#dcfce7", strong: "#15803d", hint: "La liste à emporter" },
  { href: "/repas", label: "Repas", emoji: "🍝", soft: "#ffedd5", strong: "#c2410c", hint: "Planning et recettes" },
  { href: "/todo", label: "To-do", emoji: "✅", soft: "#f3e8ff", strong: "#7e22ce", hint: "Ce qu'il reste à faire" },
  { href: "/sorties", label: "Sorties", emoji: "🎈", soft: "#fce7f3", strong: "#be185d", hint: "Idées en famille ou à deux" },
  { href: "/voyages", label: "Voyages", emoji: "🧳", soft: "#e0f2fe", strong: "#0369a1", hint: "Billets et hébergement" },
  { href: "/enfants", label: "Enfants", emoji: "🧸", soft: "#fef3c7", strong: "#b45309", hint: "Santé, tailles, courbes" },
  { href: "/contacts", label: "Contacts", emoji: "📞", soft: "#ccfbf1", strong: "#0f766e", hint: "Pédiatre, crèche, famille" },
  { href: "/famille", label: "Famille", emoji: "👨‍👩‍👧‍👧", soft: "#fee2e2", strong: "#b91c1c", hint: "Membres et invitation" },
  { href: "/parametres", label: "Réglages", emoji: "⚙️", soft: "#f5f5f4", strong: "#44403c", hint: "Couleurs, Google Agenda" },
];

export const space = (href: string) => SPACES.find((s) => href.startsWith(s.href));

/** Onglets de la barre du bas sur téléphone (comme avant la refonte) ; le reste est dans « Plus ». */
export const MAIN_TABS = ["/accueil", "/agenda", "/courses", "/repas", "/enfants"];
