# Lib

Logica compartida del sistema.

- Calculos de cotizacion, bitacora, liquidacion e inventario viven aqui.
- Formato de fechas, validadores y utilidades compartidas viven aqui.
- Generadores PDF deben mantenerse separados por dominio.

Regla: si una funcion afecta datos, calculos o PDFs en mas de una pantalla,
debe vivir en `lib/` y no duplicarse dentro de componentes.
