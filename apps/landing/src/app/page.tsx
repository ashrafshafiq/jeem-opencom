import { Hero } from "@/components/landing/hero";
import { Features } from "@/components/landing/features";
import { Showcase } from "@/components/landing/showcase";
import { CTA } from "@/components/landing/cta";
import { createLandingPageMetadata } from "@/lib/metadata";

export const metadata = createLandingPageMetadata({
  title: "Jeemcom — Class Reminders & Support, powered by Aya",
  description:
    "Automated class reminders over WhatsApp and SMS, with Aya — an AI assistant that answers questions and escalates to a human when needed.",
  path: "/",
});

export default function Home() {
  return (
    <main>
      <Hero />
      <Features />
      <Showcase />
      <CTA />
    </main>
  );
}
