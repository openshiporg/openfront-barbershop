# Openfront Barbershop

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fopenshiporg%2Fopenfront-barbershop&env=DATABASE_URL%2CSESSION_SECRET)

Openfront Barbershop is a self-hostable appointment, walk-in, and shop-management application. Customers can browse services and barbers, book visits, and join the queue. Staff manage chairs, schedules, customer records, checkout, packages, inventory, and commissions from the dashboard.

## Demo

![Shop interior photograph included with the Barbershop storefront](public/images/barbershop/photo/shop-interior.webp)

Explore the application locally using the setup instructions below.

| | |
|---|---|
| **Public application** | `/` on your development URL |
| **Dashboard** | `/dashboard` on your development URL |

[Learn more →](https://openship.org/products/openfront-barbershop)

[Documentation →](https://docs.openship.org/docs/openfront/barbershop/)

## The Openfront Ecosystem

Openfront is part of an ecosystem of open-source commerce tools:

- **[Openfront E-commerce](https://github.com/openshiporg/openfront)**: Headless e-commerce for retail.
- **[Openfront Restaurant](https://github.com/openshiporg/openfront-restaurant)**: Restaurant ordering, point of sale, and kitchen operations.
- **[Openship](https://github.com/openshiporg/openship)**: Order routing for multi-channel fulfillment.
- **Openfront Barbershop**: (This repository) a self-hostable appointment, walk-in, and shop-management application.

## Core Features

### Admin Dashboard
Manage customers, booking, store settings, pos, barbershop, queue, staff, services, reports through dedicated dashboard workspaces and permission-controlled data screens.

### Storefront
Public pages include `/services`, `/barbers`, `/book`, `/queue`, `/appointment`, and `/account`. Online booking and queue entry connect to shop-scoped operator workflows.

### Appointments & Walk-Ins
Check barber availability, create bookings, manage appointment changes, and seat walk-in queue entries. Staff can track service progress, waivers, waitlists, and no-shows.

### Shop Checkout
Record services and retail sales, cash refunds, package use, tips, commissions, and reconciliation. The registered payment adapter is manual, for payment in person; it does not process online card payments.

### Staff & Inventory
Maintain barber schedules, exceptions, shifts, chairs, practitioner credentials, products, suppliers, and inventory lots. Shop memberships determine the active operating context.

## Architecture

### Technology Stack
- **Frontend**: Next.js 16 with App Router and React 19.
- **Backend**: KeystoneJS 6 with a GraphQL API.
- **Database**: PostgreSQL with Prisma ORM.
- **Styling**: Tailwind CSS 4 and shared shadcn/ui components.
- **Authentication**: Password-based user accounts and session-based access with role capabilities.

### Application Structure
```text
openfront-barbershop/
├── app/                    # Public pages, dashboard routes, and HTTP endpoints
├── features/
│   ├── keystone/           # Backend models, access rules, and GraphQL workflows
│   ├── platform/           # Operator workspaces and onboarding
│   ├── storefront/         # Public application components and screens
│   └── dashboard/          # Authentication and shared dashboard shell
└── components/             # Shared UI components
```

### Data Models
The [model registry](features/keystone/models/index.ts) and [Prisma schema](schema.prisma) cover:

- Shops, memberships, settings, staff, chairs, schedules, and shifts.
- Services, appointments, change events, queue entries, waivers, and customers.
- Checkout transactions, cash refunds, product-sale lines, tips, and commissions.
- Membership plans, packages, usage, inventory lots, movements, and lifecycle events.

## Getting Started

### Prerequisites
- Node.js 22, compatible with the [package requirements](package.json) and Next.js 16.
- A PostgreSQL database you can migrate.
- npm.

### Setup

1. **Clone and install dependencies:**
   ```bash
   git clone https://github.com/openshiporg/openfront-barbershop.git
   cd openfront-barbershop
   npm install
   ```

2. **Configure environment variables:**
   Create a local `.env` file using the [runtime configuration](features/keystone/utils/runtimeConfig.ts) as the authority.

   ```env
   DATABASE_URL=postgresql://user:password@host/database
   SESSION_SECRET=replace-with-a-new-private-random-secret
   ```

   Generate the session secret with `openssl rand -hex 32`; use the generated value, not the placeholder. Never commit `.env`.

   Review [runtime configuration](features/keystone/utils/runtimeConfig.ts) for additional application settings before building or deploying. Configure enabled integrations separately; the two values above are not a complete production configuration.

3. **Start development server:**
   ```bash
   npm run dev
   ```

   The development script prepares the backend schema, applies checked-in migrations, and starts Next.js.

4. **Access the application:**
   Open the URL `npm run dev` prints, then use these paths:

   - **Public application**: `/`
   - **Admin dashboard**: `/dashboard`
   - **GraphQL API**: `/api/graphql`

5. **Create your first admin user:**
   Visit `/dashboard/init` on an empty database to create the initial administrator, then sign in to the dashboard.

6. **Run application onboarding:**
   Use dashboard onboarding to establish the shop and membership, then configure services, barbers, schedules, chairs, and booking policies.

## Development Commands

- `npm run dev` - Prepare the backend schema, apply migrations, and start Next.js development.
- `npm run build` - Build the backend and Next.js for production; does not apply migrations.
- `npm start` - Start the production Next.js server.
- `npm run migrate:gen` - Prepare the schema and generate/apply development migrations.
- `npm run migrate` - Apply checked-in Prisma migrations.
- `npm run lint` - Run the repository's ESLint script.

Use a disposable development database for migration generation. Review the script before running it against any existing data.

### Payment Integration
The [payment registry](features/integrations/payment/index.ts) exposes only the manual offline adapter. Staff record collection at checkout; public settlement and processor capture are not enabled.

## Documentation

See the [Openfront Barbershop documentation](https://docs.openship.org/docs/openfront/barbershop/) for the application guide. The [backend models](features/keystone/models), [registered business workflows](features/keystone/mutations/index.ts), [access rules](features/keystone/access.ts), and [application routes](app) document the implementation in this repository.

## Security & Permissions

### Role-Based Access Control
- `canAccessDashboard` - Access dashboard.
- `canManageAppointments` - Manage appointments.
- `canManageQueue` - Manage queue.
- `canManageServices` - Manage services.
- `canManageCustomers` - Manage customers.
- `canManageCustomerNotes` - Manage customer notes.
- `canManagePayments` - Manage payments.

### Security Features
- Session-based authentication for signed-in users.
- Backend list access and workflow authorization, rather than dashboard visibility alone.
- Staff access is filtered through active shop memberships and the selected active shop. Owner and manager membership roles determine shop-management access; customer-note authority is separately checked.

Review the [access implementation](features/keystone/access.ts) and individual workflow checks before extending permissions.

## Platform Components

### Admin Platform (`/dashboard`)
- **Customers**: `/dashboard/platform/customers`.
- **Booking**: `/dashboard/platform/booking`.
- **Store Settings**: `/dashboard/platform/store-settings`.
- **Pos**: `/dashboard/platform/pos`.
- **Barbershop**: `/dashboard/platform/barbershop`.
- **Queue**: `/dashboard/platform/queue`.
- **Staff**: `/dashboard/platform/staff`.
- **Services**: `/dashboard/platform/services`.
- **Reports**: `/dashboard/platform/reports`.

### Storefront Experience
Public pages include `/services`, `/barbers`, `/book`, `/queue`, `/appointment`, and `/account`. Online booking and queue entry connect to shop-scoped operator workflows.

Check barber availability, create bookings, manage appointment changes, and seat walk-in queue entries. Staff can track service progress, waivers, waitlists, and no-shows.

## Deployment

### Production Deployment
The Vercel button imports this application's own repository. Provision PostgreSQL and configure the application's complete runtime requirements, storage, mail, and enabled providers before building. Importing the source does not configure these services.

Build the application and apply checked-in migrations as a release step before starting the server. Back up existing data before migration.

```bash
npm run build
npm run migrate
npm start
```

The included [Railway configuration](railway.toml) defines this app's build and startup lifecycle. Provision services and secrets separately.

### Scaling Considerations
Keep the shared PostgreSQL database, session secrets, and configured object storage consistent across application processes. Review background delivery and integration requirements before choosing a serverless runtime; a source import does not supply persistent workers.

## Contributing

Use the development commands above when preparing changes. Keep model changes and their migrations together, and describe workflow and permission changes in pull requests.

## License

No top-level license file or package license declaration is included in this repository.

## Support

- **Documentation**: [Openfront Barbershop guide](https://docs.openship.org/docs/openfront/barbershop/).
- **Issues**: [Report bugs and feature requests](https://github.com/openshiporg/openfront-barbershop/issues).
- **Product**: [Learn more about Openfront Barbershop](https://openship.org/products/openfront-barbershop).

---

Built with [Next.js](https://nextjs.org) and [KeystoneJS](https://keystonejs.com).
