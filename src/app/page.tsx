import Hero from "@/components/sections/hero";
import ServicesPreview from "@/components/sections/services-preview";
import Stats from "@/components/sections/stats";
import ProductsPreview from "@/components/sections/products-preview";
import BlogPreview from "@/components/sections/blog-preview";
import CtaSection from "@/components/sections/cta-section";

export default function Home() {
  return (
    <>
      <Hero />
      <ServicesPreview />
      <Stats />
      <ProductsPreview />
      <BlogPreview />
      <CtaSection />
    </>
  );
}
