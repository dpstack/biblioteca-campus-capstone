# Biblioteca Campus

Aplicación de biblioteca universitaria desarrollada con **React, TypeScript y Vite**. Permite descubrir obras, consultar los ejemplares de la colección, gestionar préstamos y reservas y organizar una lista de lectura. Incluye un panel administrativo para mantener el inventario.

**[Aplicación en vivo](https://biblioteca-campus-capstone-dpstacks-projects.vercel.app/)** · **[Repositorio](https://github.com/dpstack/biblioteca-campus-capstone)** · **[Diapositivas](docs/presentation/Biblioteca-Campus-Demo-Final.pdf)** · **[Guion de demo](docs/DEMO_FINAL.md)**

Proyecto académico de Desarrollo Web, Jala University. El inventario es de demostración y no representa existencias de una universidad real.

![Inicio de Biblioteca Campus](docs/screenshots/final-home-light-desktop.png)

## Contenido

- [Funcionalidades](#funcionalidades)
- [Tecnologías y arquitectura](#tecnologías-y-arquitectura)
- [Instalación](#instalación)
- [Configuración de Supabase](#configuración-de-supabase)
- [Pruebas y compilación](#pruebas-y-compilación)
- [Rutas y uso](#rutas-y-uso)
- [Despliegue](#despliegue)
- [Alcance y límites](#alcance-y-límites)
- [Presentación y documentación](#presentación-y-documentación)

## Funcionalidades

- Catálogo público de Open Library con búsqueda por título, autor o palabra clave, categorías, orden y páginas de 24 obras.
- Filtro **Disponibles para préstamo**, aplicado al inventario activo antes de ordenar y paginar. Los filtros se conservan en la URL.
- Fichas con portada, descripción, autores, temas y disponibilidad propia de la biblioteca.
- Registro, confirmación de correo, inicio de sesión y cierre de sesión con Supabase Auth.
- Préstamos de 14 días, devoluciones, historial, reservas con prioridad por turno y cancelación de reservas.
- Estados de lectura **Quiero leer**, **Leyendo** y **Terminado**, con persistencia y eliminación.
- Administración de obras, ejemplares y retiro/reactivación, con consulta de circulación para cuentas autorizadas.
- Diseño móvil, navegación por teclado, foco visible, tema claro/oscuro y preferencia persistida en el navegador.
- Mensajes de carga, errores recuperables y estados vacíos. La portada permite continuar al catálogo si no hay destacados.

## Tecnologías y arquitectura

| Capa                       | Tecnología y responsabilidad                                                   |
| -------------------------- | ------------------------------------------------------------------------------ |
| Interfaz                   | React 19, TypeScript, CSS y Lucide                                             |
| Navegación                 | React Router, rutas personales protegidas y páginas cargadas de forma diferida |
| Catálogo                   | Open Library Search y Works API                                                |
| Identidad y datos propios  | Supabase Auth y PostgreSQL                                                     |
| Reglas de préstamo         | Funciones SQL transaccionales, bloqueo de inventario y políticas RLS           |
| Pruebas                    | Jest, React Testing Library, Playwright y axe                                  |
| Construcción y alojamiento | Vite y Vercel                                                                  |

Open Library proporciona metadatos. Supabase conserva usuarios, ejemplares y operaciones de la biblioteca. Ambas fuentes se relacionan por el identificador de obra, como `OL27448W`. Encontrar un título en Open Library no garantiza que pertenezca a la colección.

```text
src/
  components/     Layout, tarjetas, controles y selector de tema
  context/        Sesión compartida y hook useAuth
  pages/          Inicio, catálogo, ficha, acceso, cuenta y administración
  lib/            Servicios de Open Library y Supabase
supabase/
  migrations/     Esquema y funciones de biblioteca y administración
  tests/          Comprobaciones SQL con datos que se revierten
tests/            Pruebas de navegador y tests/unit/
docs/             Arquitectura, verificación, presentación y guion
```

Consulta [arquitectura y flujos](docs/ARCHITECTURE.md) para el detalle técnico.

## Instalación

Requisitos: **Node.js 24.x**, npm y conexión a Internet para consultar los servicios externos.

```bash
git clone https://github.com/dpstack/biblioteca-campus-capstone.git
cd biblioteca-campus-capstone
npm ci
cp .env.example .env.local
```

Completa `.env.local` con la configuración de tu proyecto:

```dotenv
VITE_SUPABASE_URL=https://TU-PROYECTO.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=TU_CLAVE_PUBLICABLE
```

La clave publicable identifica el proyecto. Los permisos del usuario dependen de su sesión y del servidor. **Nunca uses una clave secreta o `service_role` en variables `VITE_`.** `.env.local` está excluido de Git.

Después de instalar el esquema de Supabase:

```bash
npm run dev
```

Abre la URL que indique Vite, normalmente `http://localhost:5173`. Reinicia el servidor si cambias las variables. Sin Supabase, la aplicación ofrece el modo de exploración pública, pero no cuentas ni operaciones de préstamo.

## Configuración de Supabase

Para un proyecto nuevo, ejecuta en SQL Editor las migraciones completas **en este orden**:

1. [`20261006_initial_library.sql`](supabase/migrations/20261006_initial_library.sql): inventario de ejemplo, préstamos, reservas, lectura, RLS y funciones base.
2. [`20261009_admin.sql`](supabase/migrations/20261009_admin.sql): roles administrativos, metadatos y retiro de obras y funciones del panel.

En una base existente, comprueba qué migraciones ya se aplicaron antes de repetir la instalación. La aplicación React no ejecuta migraciones.

Habilita el proveedor Email en Supabase Auth. Configura **Site URL** con la URL pública de tu despliegue y permite las URLs de redirección que utilices, incluida la local para desarrollo. Crea y confirma la cuenta desde `/acceso`. La demostración en vivo debe utilizar una cuenta ya confirmada para evitar depender de la entrega de correo durante la exposición.

Para asignar administración a una cuenta existente, ejecuta desde SQL Editor, sustituyendo el correo:

```sql
insert into public.library_admins (user_id)
select id from auth.users
where lower(email) = lower('admin@example.com')
on conflict do nothing;
```

Recarga la sesión para mostrar Administración. Los usuarios comunes no pueden asignarse roles ni escribir directamente en inventario. Consulta [administración](docs/ADMINISTRATION.md) para instalación, revocación y demostración.

### Autenticación y autorización

Supabase Auth devuelve un access token JWT y un refresh token. El SDK conserva y renueva la sesión y envía `Authorization: Bearer <token>` al backend REST. `AuthProvider` comparte la sesión y mantiene un estado de carga mientras se restaura, antes de resolver las rutas personales.

RLS limita los datos personales a su propietario. Las funciones SQL verifican identidad, permisos, ejemplares y turnos antes de modificar existencias. Cerrar sesión elimina la sesión local y revoca los refresh tokens según el comportamiento del SDK. Los access tokens ya emitidos pueden ser válidos hasta su expiración. La persistencia en localStorage requiere mantener la prevención de XSS y evitar scripts no confiables.

## Pruebas y compilación

```bash
npm test
npm run test:coverage
npm run lint
npm run build
```

Las pruebas Jest usan respuestas HTTP simuladas y no requieren credenciales ni Internet. La cobertura se limita a los archivos configurados en Jest y no representa cobertura total del producto.

Para las pruebas de navegador:

```bash
npx playwright install chromium
npm run test:e2e
```

Playwright inicia Vite automáticamente. Los recorridos públicos consultan Open Library y los casos de inventario real requieren Supabase configurado. También hay casos con HTTP simulado para comprobar permisos e interacciones sin modificar datos reales. Para usar Chrome instalado en PowerShell:

```powershell
$env:PLAYWRIGHT_CHANNEL='chrome'
npm run test:e2e
```

Para repetir contra el despliegue público:

```powershell
$env:BASE_URL='https://biblioteca-campus-capstone-dpstacks-projects.vercel.app'
$env:PLAYWRIGHT_CHANNEL='chrome'
npm run test:e2e
```

Las suites [`library_flows.sql`](supabase/tests/library_flows.sql) y [`admin_flows.sql`](supabase/tests/admin_flows.sql) se ejecutan completas en SQL Editor de un proyecto de prueba con ambas migraciones. Crean identidades y obras sintéticas dentro de una transacción y terminan en `ROLLBACK`. No ejecutes fragmentos fuera de esa transacción.

[La verificación de entrega](docs/LAB_SEMANA_7.md) distingue resultados actuales, pruebas SQL realizadas anteriormente y comprobaciones humanas pendientes. [TESTING.md](docs/TESTING.md) conserva el alcance y los comandos.

Para comprobar el paquete de producción local:

```bash
npm run build
npm run preview
```

## Rutas y uso

| Ruta                    | Función                                               |
| ----------------------- | ----------------------------------------------------- |
| `/`                     | Inicio y búsqueda rápida                              |
| `/catalogo`             | Búsqueda, filtros, orden y paginación                 |
| `/catalogo?available=1` | Obras activas con ejemplares disponibles              |
| `/libro/:workId`        | Ficha y acciones de lectura, préstamo o reserva       |
| `/acceso`               | Registro e inicio de sesión                           |
| `/mi-biblioteca`        | Préstamos, historial, reservas y lectura de la cuenta |
| `/administracion`       | Gestión y circulación para administradores            |

### Recorrido del lector

1. Activa **Disponibles para préstamo** y abre una obra de la colección.
2. Inicia sesión y pulsa **Solicitar préstamo** si hay disponibilidad y tu turno lo permite.
3. Revisa el vencimiento y devuelve el ejemplar desde **Mi biblioteca**. El historial conserva la operación.
4. Si no quedan ejemplares, solicita una reserva y consulta o cancela su turno.
5. Guarda y recupera el estado de lectura desde la ficha o la cuenta.

El administrador puede incorporar una obra desde Open Library, definir el total de ejemplares y retirarla de nuevos préstamos. El servidor conserva los préstamos y admite devoluciones de obras retiradas. Las reservas pendientes impiden retirar una obra.

El botón de sol/luna sigue inicialmente el sistema y recuerda una elección explícita con `biblioteca-theme-v1` en localStorage. DM Sans se usa para controles y texto, y Playfair Display para encabezados y títulos de obras.

## Despliegue

La versión pública está alojada en **Vercel**, con HTTPS y reescritura de rutas SPA en `vercel.json`.

Para desplegar tu propia instalación:

1. Importa el repositorio en Vercel y elige **Vite** como framework.
2. Utiliza **Node.js 24.x**, `npm run build` y directorio de salida `dist`.
3. Configura `VITE_SUPABASE_URL` y `VITE_SUPABASE_PUBLISHABLE_KEY` para el entorno de destino.
4. Instala las migraciones en el proyecto Supabase y configura las URLs permitidas de autenticación.
5. Despliega y verifica el catálogo, una ruta anidada, acceso, inventario y cuenta.

Las variables `VITE_` se incorporan al construir el frontend: un cambio requiere otro build y despliegue. No es necesario incluir `.env.local` en el repositorio.

## Alcance y límites

- Aplicación académica con inventario de demostración, no un servicio institucional validado para operación real.
- **Autor A–Z** ordena búsquedas completas de hasta 200 obras. Las mayores requieren afinar filtros. Fecha y popularidad usan el orden de Open Library.
- El filtro de préstamo consulta existencias actuales. El servidor vuelve a validar disponibilidad y turnos al solicitar el préstamo.
- La búsqueda administrativa devuelve hasta 24 resultados. Los roles se asignan desde SQL Editor.
- Open Library puede omitir portadas, autores o descripciones. Sus interrupciones afectan la exploración externa.
- Las reservas no generan notificaciones automáticas ni asignación automática del ejemplar devuelto.
- Axe y las pruebas de teclado no equivalen a una certificación de accesibilidad. Falta revisión humana con lector de pantalla.
- Las mediciones sintéticas de rendimiento anteriores muestran oportunidades de mejora bajo red y CPU limitadas. Conservan su fecha y procedencia en [PERFORMANCE.md](docs/PERFORMANCE.md).

## Presentación y documentación

- [Diapositivas de la demo en PDF](docs/presentation/Biblioteca-Campus-Demo-Final.pdf)
- [Guion, preparación de cuentas y plan alternativo](docs/DEMO_FINAL.md)
- [Entrega del laboratorio final y revisión entre pares](docs/LAB_SEMANA_7.md)
- [Arquitectura](docs/ARCHITECTURE.md), [pruebas](docs/TESTING.md), [accesibilidad](docs/ACCESSIBILITY.md) y [administración](docs/ADMINISTRATION.md)
- [Laboratorio Semana 6](docs/LAB_SEMANA_6.md), conservado como evidencia histórica

## Autoría y fuentes

Proyecto de [dpstack](https://github.com/dpstack) para Desarrollo Web en Jala University. Metadatos y portadas de Open Library.

- [Open Library Search API](https://openlibrary.org/dev/docs/api/search)
- [Supabase Auth](https://supabase.com/docs/guides/auth/quickstarts/react)
- [Supabase Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Funciones de PostgreSQL en Supabase](https://supabase.com/docs/guides/database/functions)
