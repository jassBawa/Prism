import { CoinsBand } from "@/components/site/coins-band";
import { FaqSection } from "@/components/site/faq-section";
import { Footer } from "@/components/site/footer";
// Old hero kept at @/components/site/hero — swap back here if needed.
import { HeroOrbit } from "@/components/site/hero-orbit";
import { HowItWorks } from "@/components/site/how-it-works";
import { WhoItsFor } from "@/components/site/who-its-for";
import { Roadmap } from "@/components/site/roadmap";
import { WhatsInside } from "@/components/site/whats-inside";

export default function Page() {
  return (
    <>
      <HeroOrbit />
      <main>
        <WhatsInside />
        <CoinsBand />
        <HowItWorks />
        <WhoItsFor />
        <Roadmap />
        <FaqSection />
      </main>
      <Footer />
    </>
  );
}
