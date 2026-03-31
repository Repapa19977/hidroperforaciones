import { Metadata } from "next";
import ContactContent from "./contact-content";

export const metadata: Metadata = {
  title: "Contacto",
  description:
    "Contacte a Hidroperforaciones SA para cotizaciones, consultas y servicio tecnico de pozos mecanicos en Guatemala.",
};

export default function ContactoPage() {
  return <ContactContent />;
}
