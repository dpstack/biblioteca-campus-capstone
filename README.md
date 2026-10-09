# Biblioteca Campus · Proyecto Capstone

SPA de biblioteca universitaria basada en React, TypeScript y Vite. Los metadatos y portadas provienen de [Open Library](https://openlibrary.org/developers/api); las cuentas, el inventario propio, los préstamos, las reservas y la lista de lectura se almacenan en Supabase.

> **Estado:** aplicación académica desplegada en Vercel. Inventario de demostración; no representa existencias reales de una universidad.

## Laboratorio Semana 6

**URL pública:** https://biblioteca-campus-capstone-dpstacks-projects.vercel.app

Consulta [el entregable y la verificación del laboratorio](docs/LAB_SEMANA_6.md).

```bash
npm ci
npm test
npm run test:coverage
```

Jest y React Testing Library prueban los componentes `BookCard`, `SiteLayout` y `AuthPage`, el hook `useAuth`, la restauración de sesión y el flujo de tokens con el SDK real y HTTP simulado. Las pruebas unitarias no necesitan credenciales ni conexión externa. Playwright permanece disponible con `npm run test:e2e`.

**Verificación del laboratorio (9 de octubre de 2026):** seis suites y 17 pruebas Jest aprobadas; TypeScript y Vite compilados correctamente. Se observaron catálogo, disponibilidad, protección de rutas y carga del historial con una sesión real en producción. El usuario confirmó manualmente registro, recepción de correo, inicio con contraseña y cierre de sesión. Consulta la documentación del laboratorio para distinguir comprobaciones manuales y automatizadas.

**Autenticación:** Supabase Auth valida correo y contraseña y devuelve access token JWT y refresh token. El SDK persiste la sesión en localStorage, renueva el access token y lo envía como `Authorization: Bearer <token>` al backend REST. `AuthProvider` sincroniza cambios de sesión; Mi biblioteca redirige visitantes al formulario. Las políticas RLS y las funciones SQL autorizan las operaciones en el servidor. Cerrar sesión revoca los refresh tokens y elimina la sesión local. Los JWT emitidos pueden seguir siendo válidos hasta su expiración; el cierre no invalida instantáneamente todos los access tokens. localStorage es accesible a JavaScript: evitar scripts no confiables y mantener la prevención de XSS; nunca guardar contraseñas ni claves secretas en el cliente. La clave publishable identifica el proyecto, no sustituye el token del usuario.

## Estado actual

**Actualización del capstone (9 de octubre de 2026):** lectura persistida; orden global por fecha, popularidad y autor con el alcance descrito abajo; teclado y foco de navegación; mobile-first; carga diferida de rutas y autenticación. Pasaron 46 pruebas Jest, 14 de navegador y comprobaciones reales de préstamos, reservas, lectura y RLS. Consulta [pruebas](docs/TESTING.md), [accesibilidad](docs/ACCESSIBILITY.md) y [rendimiento](docs/PERFORMANCE.md).

- Catálogo público con búsqueda por palabra clave, título o autor; categorías, ordenamiento y paginación.
- Fichas de obras, portadas, descripción, autores y temas.
- Diseño responsivo, navegación SPA y ruta de Mi biblioteca con carga diferida.
- Registro e inicio de sesión con Supabase Auth.
- Inventario institucional separado del catálogo externo, préstamos de 14 días, reservas, devoluciones, historial y estados de lectura. Las operaciones de inventario usan funciones SQL transaccionales y políticas RLS.

**Configuración:** cada instalación necesita su propio `.env.local` con la URL y la clave publicable de Supabase. El archivo local está excluido de Git. La migración incluida crea tres obras de ejemplo; no representa existencias institucionales reales.

**Alcance del catálogo:** Autor A–Z ordena todos los resultados de búsquedas de hasta 200 obras antes de paginar. Si hay más, pide afinar la búsqueda; nunca presenta un orden parcial como global. Es el alcance elegido para mantener Open Library. La colección de demostración contiene tres obras. Las notificaciones de disponibilidad son una función opcional pendiente.

## Ejecutar localmente

Requisitos: Node.js 24 LTS y npm. Primero configura Supabase como se explica más abajo; después, desde la raíz de este proyecto:

```bash
npm ci
npm run dev
```

Abre la dirección que indique Vite (por defecto, `http://localhost:5173`). Para revisar la compilación:

```bash
npm run build
npm run preview
```

La verificación automatizada inicia Vite si hace falta, usa Chromium y cubre inicio, búsqueda, ficha, acceso, menú móvil y reglas WCAG A/AA detectables por axe. Requiere conexión a Open Library:

```bash
npx playwright install chromium
npm run lint
npm run test:e2e
```

## Capturas de la aplicación

![Inicio de Biblioteca Campus en escritorio](docs/screenshots/home-desktop.png)

La pantalla inicial permite buscar libros y descubrir obras destacadas obtenidas de Open Library.

![Inicio de Biblioteca Campus en móvil](docs/screenshots/home-mobile.png)

La misma interfaz adapta navegación, buscador y tarjetas a una pantalla pequeña.

![Ficha de un libro en escritorio](docs/screenshots/book-desktop.png)

La ficha muestra metadatos públicos y, por separado, la disponibilidad real de la colección de prueba consultada en Supabase.

## Conectar Supabase

1. Crea un proyecto en [Supabase](https://supabase.com/dashboard).
2. Abre **SQL Editor** y ejecuta íntegro [`supabase/migrations/20261006_initial_library.sql`](supabase/migrations/20261006_initial_library.sql). Crea tablas, índices, políticas RLS, funciones seguras y tres obras de ejemplo en el inventario. Sustituye estas obras por existencias reales antes de uso institucional.
3. En **Authentication → Providers**, habilita Email. La confirmación por correo es recomendable. En **Authentication → URL Configuration**, registra la URL local y la futura URL de producción como destinos permitidos.
4. Copia `.env.example` a `.env.local` y usa **Project URL** y la clave **publishable/anon** del proyecto:

   ```dotenv
   VITE_SUPABASE_URL=https://TU-PROYECTO.supabase.co
   VITE_SUPABASE_PUBLISHABLE_KEY=TU_CLAVE_PUBLICABLE
   ```

5. Reinicia `npm run dev` y crea una cuenta desde `/acceso`. Nunca coloques la clave `service_role` o una clave secreta en variables `VITE_` ni en el navegador.

La migración deja lectura pública únicamente del número de ejemplares. Cada usuario solo puede leer sus préstamos, reservas y lista de lectura. Las escrituras que cambian existencias se hacen mediante funciones SQL que bloquean las filas para evitar dos préstamos simultáneos del mismo ejemplar. El SQL debe instalarse mediante SQL Editor o una cuenta administrativa, jamás desde el cliente React.

## Rutas

### Probar préstamos y lecturas

Inicia sesión y abre `/libro/OL27448W`, una de las obras del inventario de demostración. En la ficha, **Solicitar préstamo** registra el vencimiento a 14 días. En **Mi biblioteca → Préstamos**, **Devolver** restaura el ejemplar y conserva el historial. Cuando una obra no tiene ejemplares disponibles, la ficha permite **Reservar**; la cuenta puede cancelar su reserva. La primera reserva tiene prioridad cuando regresa un ejemplar.

El selector **Mi estado de lectura** guarda y restaura «Quiero leer», «Leyendo» o «Terminado». Puedes quitar el libro desde la ficha o desde la lista de lectura de Mi biblioteca. Las obras externas sin ejemplares propios permiten organizar lecturas, pero no solicitar préstamos.

| Ruta             | Función                                           |
| ---------------- | ------------------------------------------------- |
| `/`              | Inicio y búsqueda rápida                          |
| `/catalogo`      | Catálogo, filtros, orden y paginación             |
| `/libro/:workId` | Ficha de obra y acciones de préstamo o reserva    |
| `/acceso`        | Registro e inicio de sesión                       |
| `/mi-biblioteca` | Préstamos, historial, reservas y lista de lectura |

## Arquitectura y límites

Consulta [el diagrama, los flujos y el modelo de datos](docs/ARCHITECTURE.md). `src/lib/openLibrary.ts` normaliza los metadatos externos y valida los IDs de obras; `src/lib/library.ts` concentra las operaciones Supabase; `src/context/AuthContext.tsx` comparte la sesión. Open Library **no** indica la disponibilidad física de esta biblioteca: esa información proviene únicamente de `library_books`.

### Límites conocidos

- El ordenamiento se aplica a los 24 resultados de la página visible; «más ediciones» es una aproximación a popularidad, no una métrica de préstamos.
- La cola de reservas se protege en la base de datos, pero todavía no hay avisos automáticos ni una indicación especial para quien tiene el siguiente turno. La interfaz puede ofrecer un préstamo que la cola rechace.
- La lista de lectura admite «Quiero leer», «Leyendo» y «Terminado», pero no incluye una acción visible para quitar un libro ni notificaciones de disponibilidad.
- El archivo JavaScript inicial genera una advertencia de tamaño en la compilación. Solo la ruta «Mi biblioteca» usa división de código actualmente.
- Las reservas y la lista de lectura todavía requieren validación completa con una cuenta autenticada en producción.

Antes de un uso institucional: cargar inventario real, decidir políticas de préstamos y reservas, configurar correo de confirmación y recuperación, añadir pruebas contra un proyecto Supabase de **pruebas** y revisar accesibilidad con teclado y lector de pantalla. El despliegue usa HTTPS; configura en Supabase las URLs permitidas para autenticación y redirecciones. No publiques `.env.local` ni utilices una clave `service_role` en variables `VITE_`.

## Fuentes técnicas

- [Open Library Search API](https://openlibrary.org/dev/docs/api/search)
- [Open Library Works API](https://openlibrary.org/dev/docs/api/books)
- [Supabase Auth para React](https://supabase.com/docs/guides/auth/quickstarts/react)
- [Supabase Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security)
