import type { MetadataRoute } from "next";

// Web App Manifest. Drives:
// - PWA install prompt criteria
// - Standalone display when launched from home screen
// - Web Share Target API: registers SaveHub as a destination in the OS-level
//   share sheet (Android Chrome/Edge — iOS Safari does not implement this).
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "SaveHub",
    short_name: "SaveHub",
    description:
      "Salve referências de qualquer rede em um só lugar. Organize por coleções e transforme em ideias prontas pra postar.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f6f4f3",
    theme_color: "#0cf2a7",
    lang: "pt-BR",
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    share_target: {
      action: "/share",
      method: "GET",
      // Receiving system maps the shared item into URL params on the GET.
      // - 'url' is the most reliable carrier (TikTok/Insta/YouTube share send a URL).
      // - 'text' gets the share body (some apps put the URL in there instead).
      // - 'title' carries app/page title when available.
      params: {
        url: "url",
        text: "text",
        title: "title",
      },
    },
  };
}
