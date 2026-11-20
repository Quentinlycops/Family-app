import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Famille",
    short_name: "Famille",
    description: "Agenda, courses, repas, to-do, sorties et voyages de la famille",
    start_url: "/accueil",
    display: "standalone",
    background_color: "#faf7f2",
    theme_color: "#6248e0",
    lang: "fr",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml" }],
  };
}
