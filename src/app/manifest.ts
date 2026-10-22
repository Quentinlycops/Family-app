import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Famille",
    short_name: "Famille",
    description: "Agenda, courses, repas, to-do et budget de la famille",
    start_url: "/accueil",
    display: "standalone",
    background_color: "#fafaf9",
    theme_color: "#0f766e",
    lang: "fr",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml" }],
  };
}
