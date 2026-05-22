# Chromascope

### **AI-Powered Personal Beauty & Safety Companion**

Chromascope is a modern, responsive beauty application designed to revolutionize the way users interact with skincare and makeup. By combining **AR Virtual Try-On**, **Smart Ingredient Analysis**, and **Seasonal Color Analysis**, Chromascope provides a personalized safety-first experience for beauty enthusiasts.

---

## 1. Project Overview

Chromascope solves the common challenge of finding beauty products that are both aesthetically pleasing and safe for specific skin types. The application bridges the gap between digital discovery and physical safety by analyzing product ingredients against user-specific concerns (e.g., acne-prone, sensitive skin) while allowing users to visualize products in real-time.

### **Core Workflow**

1. **Personalized Onboarding**: Users define their skin type and specific ingredient concerns.
2. **Color Analysis**: Identification of the user's seasonal color palette (e.g., Cool Winter, Warm Autumn).
3. **Discovery**: Browsing a curated product catalog with safety verdicts.
4. **Try-On**: Visualizing shades using Augmented Reality.
5. **Safety Engine**: Real-time filtering of products based on ingredient compatibility.

---

## 2. Features

### **Frontend Features**

- **Seasonal Color Analysis**: Interactive quiz and palette matching.
- **AR Virtual Try-On**: Real-time shade visualization (Camera-based).
- **Responsive Mobile-First UI**: Seamless experience across all devices.
- **Micro-Animations**: Fluid transitions using Framer Motion.
- **Glassmorphic Design**: Modern, premium aesthetic with blur effects.

### **Backend Features**

- **Safety Engine**: Advanced logic for ingredient-skin type compatibility.
- **Fuzzy Matching**: Intelligent INCI name matching using RapidFuzz.
- **Firebase Integration**: Real-time Firestore database and Cloud Storage.
- **FastAPI Performance**: High-speed asynchronous API endpoints.

### **Authentication & Personalization**

- **User Profiles**: Save skin profiles and favorite products.
- **Onboarding Flow**: Multi-step setup for personalized results.

---

## 3. Tech Stack

### **Frontend**

- **React 19**: Component-based UI library.
- **Vite**: Ultra-fast build tool.
- **Tailwind CSS**: Modern styling framework.
- **Framer Motion**: Advanced animations and transitions.
- **Zustand**: Lightweight state management.
- **React Router 7**: Declarative routing.
- **Lucide React**: Premium icon set.

### **Backend**

- **Python 3.x**: Core programming language.
- **FastAPI**: Modern, fast (high-performance) web framework.
- **Firebase Admin SDK**: For Firestore and Storage access.
- **RapidFuzz**: High-performance fuzzy string matching.
- **Uvicorn**: ASGI server implementation.

### **Tools & Services**

- **Firebase**: Database and cloud services.
- **Git/GitHub**: Version control.
- **Claude Code/Antigravity**: Development assistance.

---

## 4. Project Structure

```bash
Chromascope/
├── backend/
│   ├── app/
│   │   ├── api/          # FastAPI endpoints
│   │   ├── core/         # Engine logic, filtering, database wrappers
│   ├── data/             # Local datasets and constants
│   ├── scripts/          # Migration and utility scripts
│   └── requirements.txt  # Python dependencies
├── frontend/
│   ├── src/
│   │   ├── components/   # UI components (common, navigation, etc.)
│   │   ├── pages/        # Main application pages
│   │   ├── layouts/      # Layout wrappers (MainLayout)
│   │   ├── services/     # API integration services
│   │   ├── store/        # Zustand state stores
│   │   └── context/      # React Context providers
│   ├── public/           # Static assets
│   └── tailwind.config.js
├── serviceAccountKey.js  # Firebase configuration
└── package.json          # Root configuration
```

---

## 5. Frontend Setup Guide

### **Installation**

1. Navigate to the frontend directory:
   ```bash
   cd frontend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```

### **Development**

Run the development server:

```bash
npm run dev
```

The app will be available at `http://localhost:5173`.

### **Environment Variables**

The frontend communicates with the backend via a hardcoded `API_BASE_URL` in `src/services/`. For production, ensure this points to your deployed API.

### **Build**

```bash
npm run build
```

---

## 6. Backend Setup Guide

### **Installation**

1. Navigate to the backend directory:
   ```bash
   cd backend
   ```
2. Create and activate a virtual environment:
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```
3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

### **Firebase Configuration**

1. Place your `serviceAccountKey.json` in the `backend/` directory.
2. Ensure the `.env` file in the root directory contains the necessary Firebase credentials.

### **ML Configuration**

1. Get the weights folder at: [Weights Link](https://drive.google.com/drive/folders/1QBDaRbK5rdIFNH8_7SN4uKwkTrC4NUjp?usp=sharing)
1. Place the weights folder in the `backend/app/core/skin_analysis/ml/` directory.

### **Run API Server**

```bash
uvicorn app.api.api:app --reload
```

The API documentation (Swagger) will be available at `http://localhost:8000/docs`.

---

## 7. Frontend Routes Documentation

| Route                | Page Component            | Description                             |
| -------------------- | ------------------------- | --------------------------------------- |
| `/`                  | `SplashPage`              | Landing page with product overview.     |
| `/auth`              | `AuthPage`                | Login and Registration.                 |
| `/home`              | `HomePage`                | Main dashboard and personalized feed.   |
| `/onboarding`        | `OnboardingPage`          | Skin type and concern selection.        |
| `/ar-tryon`          | `ARTryOnPage`             | Real-time virtual try-on interface.     |
| `/color-analysis`    | `ColorAnalysisPage`       | Start of the seasonal color test.       |
| `/palette-product`   | `PaletteGuideProductPage` | Recommendations based on color palette. |
| `/ingredient-filter` | `IngredientFilterPage`    | Deep analysis of product ingredients.   |
| `/profile`           | `ProfilePage`             | User account settings and saved items.  |
| `/admin`             | `AdminDatabasePage`       | Admin dashboard for catalog management. |

---

## 8. Backend API Documentation

### **General Endpoints**

- `GET /`: Health check status.

### **Product Endpoints**

- `GET /api/products`: Fetches all products from Firestore.
- `GET /api/ingredients`: Returns the full ingredient safety database.

### **Safety Engine**

- `POST /api/run-filter`:
  - **Purpose**: Runs the safety filtering logic for a list of products.
  - **Request Body**:
    ```json
    {
      "skin_type": "Oily",
      "concerns": ["Acne", "Redness"],
      "avoid_ingredients": ["Fragrance"],
      "category": "Serum"
    }
    ```
  - **Response**: A list of products with safety verdicts (`safe`, `caution`, `avoid`) and detailed reasoning.

---

## 9. Architecture Overview

- **Communication**: The Frontend communicates with the FastAPI backend via RESTful endpoints.
- **State Management**: Zustand is used for global application state (e.g., user profile, active palette).
- **Safety Logic**: The `SafetyFilter` class in the backend core processes product INCI lists against user profiles using fuzzy matching to ensure accuracy despite varied ingredient naming.
- **Database**: Firebase Firestore acts as the primary data store for products, ingredients, and user metadata.

---

## License

This project is licensed under the MIT License - see the `LICENSE` file for details.
