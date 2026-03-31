import { Metadata } from "next";
import AboutContent from "./about-content";

export const metadata: Metadata = {
  title: "Nosotros",
  description:
    "Conozca a Hidroperforaciones SA: expertos en agua subterranea en Guatemala con mas de 15 anos de experiencia.",
};

export default function NosotrosPage() {
  return <AboutContent />;
}
