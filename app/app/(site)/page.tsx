import { FaqSection } from "@/components/site/faq-section";
import { Footer } from "@/components/site/footer";
import { Hero } from "@/components/site/hero";
import { HowItWorks } from "@/components/site/how-it-works";

export default function Page() {
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
