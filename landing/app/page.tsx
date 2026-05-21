import { FaqSection } from "@/components/faq-section";
import { Footer } from "@/components/footer";
import { Hero } from "@/components/hero";
import { HowItWorks } from "@/components/how-it-works";

export default function Home() {
  return (
    <>
      <Hero />
      <main>
        <HowItWorks />
        <FaqSection />
      </main>
      <Footer />
    </>
  );
}
