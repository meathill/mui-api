import { HeroSection } from './_components/hero-section';
import { ModelsSection } from './_components/models-section';
import { AdvantagesSection } from './_components/advantages-section';
import { StepsSection } from './_components/steps-section';
import { CodeSection } from './_components/code-section';
import { CtaSection } from './_components/cta-section';

export default function LandingPage() {
  return (
    <div>
      <HeroSection />
      <ModelsSection />
      <AdvantagesSection />
      <StepsSection />
      <CodeSection />
      <CtaSection />
    </div>
  );
}
