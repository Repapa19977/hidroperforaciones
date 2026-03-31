import { Metadata } from "next";
import ServicesContent from "./services-content";

export const metadata: Metadata = {
  title: "Servicios",
  description:
    "Perforacion, mantenimiento basico, intermedio y completo, emergencias y diagnostico de pozos mecanicos en Guatemala.",
};

export default function ServiciosPage() {
  return <ServicesContent />;
}
