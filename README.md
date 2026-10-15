# Campus Library

A university library application built with **React, TypeScript, and Vite**. Discover books, check the library's own copies, manage loans and reservations, and organize a reading list. Authorized administrators can maintain the collection and review circulation.

**[Live application](https://biblioteca-campus-capstone-dpstacks-projects.vercel.app/)** · **[Source repository](https://github.com/dpstack/biblioteca-campus-capstone)**

An academic Web Development capstone for Jala University. The demonstration inventory does not represent a real university's holdings. The interface, documentation, presentation, and demo script are in English. Existing repository and deployment identifiers remain unchanged.

## Contents

- [Features](#features)
- [Technology and architecture](#technology-and-architecture)
- [Installation](#installation)
- [Supabase setup](#supabase-setup)
- [Testing and production build](#testing-and-production-build)
- [Routes and usage](#routes-and-usage)
- [Deployment](#deployment)
- [Scope](#scope)

## Features

- Open Library catalog with title, author, and keyword search, categories, sorting, and pages of 24 works.
- An **Available to borrow** filter applied to active inventory before sorting and pagination. Search filters remain in the URL.
- Book details with cover, description, authors, subjects, and the library's own availability.
- Registration, email confirmation, sign-in, and sign-out through Supabase Auth.
- Fourteen-day loans, returns, history, reservations with queue priority, and cancellation.
- Persistent **Want to read**, **Reading**, and **Finished** statuses, with removal from the reading list.
- Administrative collection management, copy adjustments, retirement/reactivation, and circulation views.
- Responsive layouts, keyboard navigation, visible focus, accessible labels, and persistent light/dark themes.
- Loading, recoverable error, and empty states. The home page offers catalog navigation when no featured books are available.

## Technology and architecture

| Layer                   | Technology and responsibility                                  |
| ----------------------- | -------------------------------------------------------------- |
| Interface               | React 19, TypeScript, CSS, and Lucide                          |
| Routing                 | React Router, protected account routes, and lazy-loaded pages  |
| Catalog                 | Open Library Search and Works APIs                             |
| Identity and owned data | Supabase Auth and PostgreSQL                                   |
| Borrowing rules         | Transactional SQL functions, inventory locks, and RLS policies |
| Tests                   | Jest, React Testing Library, Playwright, and axe               |
| Build and hosting       | Vite and Vercel                                                |

Open Library supplies metadata. Supabase stores identity, physical copies, and library operations. A work identifier such as `OL27448W` connects the two sources. A title found in Open Library is not necessarily part of this library's collection.

```text
src/
  components/     Shared layout, cards, controls, and theme toggle
  context/        Shared session and useAuth
  pages/          Home, catalog, book, login, account, and administration
  lib/            API services and legacy server-error normalization
supabase/
  migrations/     Library schema, permissions, and administrative functions
  tests/          SQL checks inside transactions that roll back
tests/            Browser tests and tests/unit/
```

## Installation

Requirements: **Node.js 24.x**, npm, and Internet access for external services.

```bash
git clone https://github.com/dpstack/biblioteca-campus-capstone.git
cd biblioteca-campus-capstone
npm ci
cp .env.example .env.local
```

Complete `.env.local` using your own Supabase project:

```dotenv
VITE_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLISHABLE_KEY
```

The publishable key identifies the project. The session and server determine access permissions. **Never put a secret or `service_role` key in a `VITE_` variable.** Git ignores `.env.local`.

After installing the Supabase schema:

```bash
npm run dev
```

Open the URL printed by Vite, normally `http://localhost:5173`. Restart the server after changing environment variables. Without Supabase, the public catalog is available, while accounts and borrowing operations remain disconnected.

## Supabase setup

For a new project, run these complete migrations in SQL Editor **in order**:

1. [`20261006_initial_library.sql`](supabase/migrations/20261006_initial_library.sql): demonstration stock, loans, reservations, reading lists, RLS, and base functions.
2. [`20261009_admin.sql`](supabase/migrations/20261009_admin.sql): administrative roles, work metadata, retirement, and panel functions.

Check which migrations are already installed before applying them to an existing database. React does not run migrations. The original applied migrations retain their historical server messages; the frontend normalizes those known messages to English without changing their business rules.

Enable the Email provider in Supabase Auth. Set **Site URL** to your public deployment and allow the authentication redirect URLs you use, including the local development origin. Register and confirm an account through `/login`. Prepare a confirmed account before a live demonstration so the presentation does not depend on email delivery.

Assign administration to an existing account from SQL Editor, replacing the example address:

```sql
insert into public.library_admins (user_id)
select id from auth.users
where lower(email) = lower('admin@example.com')
on conflict do nothing;
```

Refresh the session to display Administration. Regular users cannot assign themselves roles or write inventory directly.

### Authentication and authorization

Supabase Auth returns a JWT access token and a refresh token. The SDK persists and renews the session and sends `Authorization: Bearer <token>` to the REST backend. `AuthProvider` shares the session and keeps protected pages loading until session restoration completes.

RLS limits personal rows to their owner. SQL functions check identity, role, copies, and reservation priority before changing inventory. Sign-out removes the local session and revokes refresh tokens according to SDK behavior. Existing access tokens can remain valid until expiration. localStorage persistence requires XSS prevention and avoiding untrusted scripts.

## Testing and production build

```bash
npm test
npm run test:coverage
npm run lint
npm run build
```

Jest uses mocked HTTP responses and needs neither credentials nor Internet access. Coverage includes only the files configured in Jest, rather than the whole product.

For browser tests:

```bash
npx playwright install chromium
npm run test:e2e
```

Playwright starts Vite automatically. Public flows use Open Library. Real inventory scenarios require configured Supabase variables; other scenarios simulate HTTP without modifying real user data. To use installed Chrome in PowerShell:

```powershell
$env:PLAYWRIGHT_CHANNEL='chrome'
npm run test:e2e
```

To test the public deployment:

```powershell
$env:BASE_URL='https://biblioteca-campus-capstone-dpstacks-projects.vercel.app'
$env:PLAYWRIGHT_CHANNEL='chrome'
npm run test:e2e
```

Run [`library_flows.sql`](supabase/tests/library_flows.sql) and [`admin_flows.sql`](supabase/tests/admin_flows.sql) in full in SQL Editor of a test project with both migrations installed. They create synthetic identities and works inside a transaction ending in `ROLLBACK`. Keep the transaction intact.

The English release passed 66 Jest tests in 14 suites and 30 desktop/mobile browser scenarios, including repeats after transient external-service failures. Selected-file line coverage was 87.58%. Real SQL checks and user-confirmed authentication were recorded separately on October 9, 2026; browser fixtures do not establish database permissions.

To inspect a production build locally:

```bash
npm run build
npm run preview
```

## Routes and usage

| Route                  | Purpose                                                      |
| ---------------------- | ------------------------------------------------------------ |
| `/`                    | Home and quick search                                        |
| `/catalog`             | Search, filters, sorting, and pagination                     |
| `/catalog?available=1` | Active works with available copies                           |
| `/books/:workId`       | Work details and reading, loan, or reservation actions       |
| `/login`               | Registration and sign-in                                     |
| `/my-library`          | The account's loans, history, reservations, and reading list |
| `/admin`               | Collection and circulation management for administrators     |

The original `/catalogo`, `/libro/:workId`, `/acceso`, `/mi-biblioteca`, and `/administracion` links redirect to their English equivalents. Search parameters are preserved.

### Reader flow

1. Enable **Available to borrow** and open a work in the collection.
2. Sign in and select **Borrow book** when inventory and queue priority allow it.
3. Check the due date and return the copy from **My library**. History preserves the operation.
4. When all copies are on loan, reserve the work and view or cancel the reservation.
5. Save and restore a reading status from the work page or account.

Administrators can add a work from Open Library, set total copies, and retire it from new operations. Existing loans and returns remain supported. Pending reservations prevent retirement.

The sun/moon button initially follows the system and persists an explicit choice using `biblioteca-theme-v1` in localStorage. DM Sans supports body text and controls; Playfair Display supports headings and book titles. Dates, number formatting, author collation, and the Open Library language preference use English. Original book titles and metadata remain as supplied by Open Library.

## Deployment

The public application uses **Vercel**, HTTPS, and SPA rewrites in `vercel.json`.

For your own installation:

1. Import the repository into Vercel and select **Vite**.
2. Use **Node.js 24.x**, build command `npm run build`, and output directory `dist`.
3. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` for the target environment.
4. Install the Supabase migrations and configure permitted authentication URLs.
5. Deploy and check catalog, nested routes, login, inventory, and account behavior.

Vite embeds `VITE_` variables at build time. Changing them requires another build and deployment. Do not commit `.env.local`.

## Scope

- Academic application with demonstration inventory, rather than an institutional service validated for real operations.
- **Author A–Z** sorts complete searches of up to 200 works. Refine larger searches. Date and popularity sorting use Open Library.
- Availability is a snapshot. The server checks copies and queue priority again when processing a loan.
- Administrative searches return up to 24 works. Database administrators assign roles through SQL Editor.
- Open Library may omit metadata or become unavailable. Original titles are preserved in their source language.
- Reservations enforce queue priority without automatic email notifications or automatic copy assignment.
- Axe and keyboard checks are not a complete accessibility certification.
- Performance audits are synthetic measurements, not real-user Core Web Vitals.

## Credits

A project by [dpstack](https://github.com/dpstack) for Web Development at Jala University. Metadata and book covers come from Open Library.

- [Open Library Search API](https://openlibrary.org/dev/docs/api/search)
- [Supabase Auth](https://supabase.com/docs/guides/auth/quickstarts/react)
- [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Supabase database functions](https://supabase.com/docs/guides/database/functions)
