import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Bogan Bay | After Hours" },
      { name: "description", content: "Drive, brawl and cruise the Victorian coast in Bogan Bay: After Hours." },
      { property: "og:title", content: "Bogan Bay | After Hours" },
      { property: "og:description", content: "Drive, brawl and cruise the Victorian coast in Bogan Bay: After Hours." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <iframe
      src="/game/index.html"
      title="Bogan Bay After Hours"
      className="fixed inset-0 h-screen w-screen border-0"
      allow="autoplay; fullscreen; gamepad"
    />
  );
}
