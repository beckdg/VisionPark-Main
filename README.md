# VisionPark

VisionPark is a premium, AI-powered parking management system designed to offer distinct, tailor-made experiences for drivers, parking lot owners, and attendants. It leverages AI-driven detection (simulated) to manage real-time parking spot occupancy, automated enforcement, and comprehensive business analytics.

## 📂 Project Structure

```text
.
├── backend/            # Node.js + MongoDB API
├── frontend/           # React + Vite + Tailwind UI
├── postman/            # Postman collections for API testing
├── .cursor/            # Cursor IDE specific configurations and plans
├── .postman/           # Postman resource configurations
├── docker-compose.yml  # Docker orchestration for the system
├── package.json        # Root package file
└── README.md           # Project overview (this file)
```

---

## 🛠️ Tech Stack

### Frontend
- **Framework**: React 19 + Vite
- **Styling**: Tailwind CSS
- **Icons**: Lucide React
- **Maps**: Leaflet & React-Leaflet
- **UI Components**: Radix UI
- **State/Theme**: Context API & next-themes

### Backend
- **Runtime**: Node.js
- **Framework**: Express
- **Database**: MongoDB (via Mongoose)
- **Real-time**: Socket.io
- **Authentication**: JWT (JSON Web Tokens)
- **Validation**: Custom middleware

### Infrastructure
- **Containerization**: Docker & Docker Compose

---

## 🚀 Getting Started

### Prerequisites
- [Docker](https://www.docker.com/) and [Docker Compose](https://docs.docker.com/compose/) installed.
- [Node.js](https://nodejs.org/) (v18+ recommended) if running locally without Docker.

### Using Docker (Quick Start)
To spin up the backend and database:
```bash
docker-compose up --build
```
The Backend API will be available at `http://localhost:4000`.

### Local Development

#### 1. Backend
```bash
cd backend
npm install
npm run seed     # Populate with demo data
npm run dev      # Start development server
```

#### 2. Frontend
```bash
cd frontend
npm install
npm run dev      # Start Vite dev server
```

---

## 📦 Modules Overview

### [Backend](./backend)
The backend serves as the central authority for the system, managing:
- **Sessions**: Full lifecycle from reservation to closure.
- **Parking Management**: Managing lots, zones, and individual spot states.
- **Operations**: Handling incidents, enforcement (clamping), and transactions.
- **AI Ingestion**: Validating and mapping external AI signals (camera events).
- **Real-time Forwarding**: Pushing domain events to users via Socket.io.

### [Frontend](./frontend)
The frontend provides specialized dashboards for four distinct user roles:
- **Driver**: Interactive maps for spot reservation and real-time session tracking.
- **Owner**: Advanced analytics, financial reporting, and lot configuration.
- **Attendant**: Live lot monitoring, AI exception handling, and walk-up POS.
- **System Admin**: Platform-wide health monitoring, session management, and system configuration.

---

## 🧪 Testing & Simulation

### AI Event Simulation
You can simulate AI camera events (entry, exit, mismatch) to see how the system reacts in real-time:
```bash
cd backend
npm run simulate:ai
```

### API Testing
Postman collections are provided in the `postman/` and `.postman/` directories to facilitate testing of the RESTful API endpoints.

### Running Tests
```bash
# Backend tests
cd backend
npm test
```

---

## 📄 Documentation Links
- [Detailed Frontend Documentation](./frontend/README.md)
- [Detailed Backend Documentation](./backend/README.md)
