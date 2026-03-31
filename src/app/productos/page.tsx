import { Metadata } from "next";
import ProductsContent from "./products-content";

export const metadata: Metadata = {
  title: "Productos",
  description:
    "Bombas sumergibles, motores, tuberia, paneles electricos y materiales para pozos mecanicos en Guatemala.",
};

export default function ProductosPage() {
  return <ProductsContent />;
}
