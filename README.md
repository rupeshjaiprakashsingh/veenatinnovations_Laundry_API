# Laundry Management System Backend (NestJS)

A production-ready, clean-architecture backend for a Laundry Management System built with **NestJS**, **TypeScript**, **PostgreSQL**, and **Prisma ORM**.

## Features

- **Clean Architecture**: Structured with a Modular layout, Repository pattern, and Service layer pattern.
- **Authentication & Authorization**: Password hashing (bcrypt), JWT tokens, Refresh Tokens, Password Change, Forgot & Reset Password, and Role-Based Access Control (`SuperAdmin`, `BranchManager`, `Employee`, `DeliveryBoy`, `Customer`).
- **Entity Modules**: Complete CRUD APIs for Branches, Employees, Customers, and Services.
- **Order Workflow**: Multi-state order tracking:
  `New Order` ➔ `Pickup Scheduled` ➔ `Picked Up` ➔ `Processing` ➔ `Washing` ➔ `Dry Cleaning` ➔ `Ironing` ➔ `Ready For Delivery` ➔ `Out For Delivery` ➔ `Delivered` ➔ `Cancelled`
- **Pickup & Delivery Management**: Pickup scheduling, Deliveryboy assignments, and status progressions.
- **Payment Processing**: Record order transactions, handle partial or full payment status updates.
- **Notifications**: Automated trigger notifications on order status transitions.
- **Dashboard & Analytics**: Real-time stats (Total revenue, pending orders, today's actions, top services, top spending customers).
- **Reports**: Standard business reports (daily sales, monthly sales, customer reports, branch reports).
- **Swagger Documentation**: Self-documenting Swagger UI with request examples and Bearer Auth login.
- **Security & Quality**: Winston logger, global Exception normalized filter, Global pipes for DTO validation (class-validator), CORS, Helmet security header, and Docker support.

---

## Technical Stack
- **Runtime**: Node.js (v20+ alpine recommended)
- **Framework**: NestJS (v11)
- **Database**: PostgreSQL (v15+)
- **ORM**: Prisma (v6+)
- **Security**: Passport JWT, Bcrypt, Helmet, class-validator

---

## Getting Started

### 1. Prerequisites
Ensure you have the following installed:
- [Node.js](https://nodejs.org/en) (LTS version)
- [PostgreSQL](https://www.postgresql.org/) (or Docker if running via Compose)

### 2. Environment Setup
Create or edit the `.env` file at the root:
```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/laundry_db?schema=public"
PORT=3000
JWT_SECRET="laundry_jwt_secret_key_123!"
JWT_EXPIRATION="1h"
JWT_REFRESH_EXPIRATION="7d"
CORS_ORIGIN="*"
```

### 3. Installation
Install the project dependencies:
```bash
npm install
```

### 4. Database Setup & Migration
Generate the Prisma client:
```bash
npx prisma generate
```

Run database migrations to initialize tables in PostgreSQL:
```bash
npx prisma migrate dev --name init
```

*Note: If you do not have PostgreSQL running yet, you can spin it up via Docker Compose (see Docker section below).*

### 5. Seeding Database
Seed the database with default branches, services, staff roles, and a default customer account:
```bash
npm run prisma:seed
```

**Seed Credentials Generated:**
- **SuperAdmin**: `admin@laundry.com` / `admin123`
- **BranchManager**: `manager@laundry.com` / `manager123`
- **Employee (Staff)**: `staff@laundry.com` / `staff123`
- **DeliveryBoy**: `delivery@laundry.com` / `delivery123`
- **Customer**: `customer@laundry.com` / `customer123`

---

## Running the Application

### Development Mode
```bash
npm run start:dev
```
The server will start on `http://localhost:3000/api/v1`.

### Production Build & Run
```bash
npm run build
npm run start:prod
```

### API Documentation (Swagger)
Open your browser and navigate to:
**`http://localhost:3000/api/docs`**

---

## Running with Docker (Recommended)

To run the complete stack (PostgreSQL + NestJS App) inside Docker:

```bash
# Build and run the containers
docker compose up --build -d

# Run migrations inside the app container
docker compose exec app npx prisma migrate dev --name init

# Seed the database
docker compose exec app npm run prisma:seed
```

---

## API Endpoints List

### 1. Authentication (`/api/v1/auth`)
- `POST /auth/register` - Register a new Customer.
- `POST /auth/login` - Login to get Access & Refresh token.
- `POST /auth/register-employee` (Admin/Manager only) - Add staff members.
- `POST /auth/refresh` - Refresh access token.
- `POST /auth/change-password` (Authenticated only) - Change user password.
- `POST /auth/forgot-password` - Request a password reset code (logs token to console).
- `POST /auth/reset-password` - Reset password using log token.

### 2. Branches (`/api/v1/branches`)
- `GET /branches` - List all branches.
- `POST /branches` (SuperAdmin only) - Create a branch.
- `GET /branches/:id` - Branch details.
- `PUT /branches/:id` (SuperAdmin/BranchManager) - Edit branch.
- `DELETE /branches/:id` (SuperAdmin only) - Remove branch.

### 3. Services (`/api/v1/services`)
- `GET /services` (Public) - View all services and rates.
- `POST /services` (SuperAdmin) - Add a laundry service.

### 4. Orders (`/api/v1/orders`)
- `POST /orders` (All roles) - Create an order with items.
- `GET /orders` (Staff only) - List all orders.
- `GET /orders/my-orders` (Customer only) - View self orders.
- `PUT /orders/:id/status` (Staff only) - Move order workflow.

### 5. Payments (`/api/v1/payments`)
- `POST /payments` - Record card, cash, or online payment.
- `GET /payments/order/:orderId` - Get transaction logs for an order.

### 6. Pickups (`/api/v1/pickup`)
- `POST /pickup` - Request a pickup.
- `PUT /pickup/:id/assign` (Admin/Manager only) - Assign staff.
- `PUT /pickup/:id/status` (Staff only) - Update status.

### 7. Deliveries (`/api/v1/deliveries`)
- `POST /deliveries` (Staff only) - Assign order to delivery boy.
- `PUT /deliveries/:id/status` (DeliveryBoy/Staff) - Mark delivered or failed.

### 8. Analytics (`/api/v1/dashboard` & `/api/v1/reports`)
- `GET /dashboard` (Admin/Manager only) - Revenue, pending deliveries, today's tasks.
- `GET /reports/sales/daily` - Daily revenue metrics.
- `GET /reports/customers` - Customer spending leaderboards.

---

## Testing

```bash
# Unit Tests
npm run test
```

## Database DDL Script
The raw PostgreSQL DDL script is located in `prisma/schema.sql`.
