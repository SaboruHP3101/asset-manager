# Asset Management System

An enterprise-oriented asset management system for managing company assets, assignments, procurement, maintenance, inventory, suppliers, and related workflows.

The project is organized as a monorepo with three main applications:

```text
.
├── backend/       # NestJS REST API
├── mobile/        # Flutter mobile application
├── back-office/   # React admin dashboard
└── README.md
```

## Tech Stack

### Backend

Located in:

```text
/backend
```

Built with:

* NestJS
* TypeScript
* Drizzle ORM
* PostgreSQL
* REST API
* JWT-based authentication
* OpenAPI / Swagger
* Docker for local infrastructure

Responsibilities include:

* Authentication and authorization
* User and employee management
* Asset management
* Asset categories
* Departments
* Roles and permissions
* Suppliers
* Purchase requests
* Asset assignments and transfers
* Maintenance and repair records
* Inventory checks
* Asset liquidation / disposal
* File attachment metadata
* Audit logs
* Business rules and validation

---

### Mobile Application

Located in:

```text
/mobile
```

Built with:

* Flutter
* Dart

The mobile application is primarily intended for employees and operational staff.

Possible features include:

* Sign in
* View assigned assets
* View asset details
* Scan QR codes / barcodes
* Submit asset-related requests
* Report damaged assets
* View assignment history
* Perform inventory checks
* Upload asset photos
* Receive asset-related notifications

---

### Back Office

Located in:

```text
/back-office
```

Built with:

* React
* TypeScript
* React Router
* TanStack Query

The back-office application is intended for administrators, asset managers, procurement teams, and other authorized personnel.

Responsibilities include:

* Dashboard and statistics
* Asset administration
* Employee management
* Department management
* Asset category management
* Supplier management
* Purchase request workflows
* Asset handover and transfer management
* Maintenance management
* Inventory management
* Liquidation management
* Role and permission management
* Audit history

---

# Requirements

Before starting development, install the following tools.

## Backend / Back Office

* Node.js 20+
* npm
* PostgreSQL 16+
* Docker and Docker Compose recommended

## Mobile

* Flutter SDK
* Dart SDK
* Android Studio and/or Xcode
* Android Emulator, iOS Simulator, or physical device

Check your Flutter installation with:

```bash
flutter doctor
```

---

# Getting Started

Clone the repository:

```bash
git clone <repository-url>
cd asset-manager
```

---

# Backend Setup

Navigate to the backend:

```bash
cd backend
```

Install dependencies:

```bash
npm install
```
