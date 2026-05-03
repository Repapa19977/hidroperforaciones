# App Router

La carpeta `app/` define rutas reales de Next.js. Mover carpetas aqui cambia URLs
o endpoints, asi que la estructura se mantiene por rutas:

- `(app)/`: pantallas privadas del CRM.
- `api/`: endpoints del backend.
- `cliente/`: portal del cliente.
- `login/`, `imprimir/`: rutas publicas o auxiliares.

Para ordenar codigo compartido, preferir `components/` o `lib/` en vez de mover
rutas. Si una ruta crece demasiado, extraer paneles a `components/` y logica a
`lib/`.
