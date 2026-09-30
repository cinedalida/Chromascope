<p align="center">
  <img src="frontend/src/assets/images/chro-banner.png" alt="Chromascope — unlock the biological data beneath your surface." width="100%" />
</p>

# chromascope

### **AI-Powered Personal Beauty & Safety Companion**

Chromascope is a modern, responsive beauty application designed to revolutionize the way users interact with skincare and makeup. By combining **AR Virtual Try-On**, **Smart Ingredient Analysis**, and **Seasonal Color Analysis**, Chromascope provides a personalized safety-first experience for beauty enthusiasts.

---

## 1. Project Overview

Chromascope solves the common challenge of finding beauty products that are both aesthetically pleasing and safe for specific skin types. The application bridges the gap between digital discovery and physical safety by analyzing product ingredients against user-specific concerns (e.g., acne-prone, sensitive skin) while allowing users to visualize products in real-time.

### **Core Workflow**

1. **Personalized Onboarding**: Users define their skin type and specific ingredient concerns.
2. **Color Analysis**: Users upload a photo or use their webcam; the backend identifies their seasonal color palette (e.g., Cool Winter, Warm Autumn) and subtype.
3. **Discovery**: Browsing a curated product catalog with safety verdicts.
4. **Try-On**: Visualizing shades using Augmented Reality.
5. **Safety Engine**: Real-time filtering of products based on ingredient compatibility.

---

## 2. Features

### **Frontend Features**

- **Seasonal Color Analysis**: Photo or webcam capture, analyzed by the backend ML pipeline to place the user in the 12-season system, with sister and contrast seasons.
- **AR Virtual Try-On**: Real-time shade visualization on the live camera feed, with face-landmark tracking (MediaPipe) for lips, cheeks and eyeshadow.
- **Ingredient Filter & Product Catalog**: Products filtered and labeled by safety verdict for the user's skin profile.
- **Responsive Mobile-First UI**: Seamless experience across all devices.
- **Micro-Animations**: Fluid transitions and scroll-triggered reveals using Framer Motion.
- **Glassmorphic Design**: Modern, premium aesthetic with blur effects.

### **Backend Features**

- **Safety Engine**: Advanced logic for ingredient-skin type compatibility.
- **Fuzzy Matching**: Intelligent INCI name matching using RapidFuzz.
- **Skin & Color Analysis**: PyTorch-based pipeline (face parsing, color extraction and season matching) behind `POST /api/analyze-color`.
- **Firebase Integration**: Firestore database, Cloud Storage, and ID-token verification for protected endpoints.
- **FastAPI Performance**: High-speed asynchronous API endpoints.

### **Authentication & Personalization**

- **Sign-in Options**: Email/password and Google sign-in (Firebase Authentication), with a forgot-password flow.
- **User Profiles**: Save skin profiles and favorite products.
- **Onboarding Flow**: Multi-step setup for personalized results.

---

## 3. Tech Stack

### **Frontend**

- **React 19**: Component-based UI library.
- **Vite 8**: Ultra-fast build tool.
- **Tailwind CSS v4**: Styling, via the `@tailwindcss/vite` plugin and configured in CSS (see [Design System](#10-design-system)).
- **Framer Motion**: Advanced animations and transitions.
- **MediaPipe Tasks Vision**: Face-landmark tracking for AR try-on.
- **Firebase JS SDK**: Authentication and Firestore access.
- **Zustand**: Lightweight state management.
- **React Router 7**: Declarative routing.
- **Lucide React**: Premium icon set.

### **Backend**

- **Python 3**: Core programming language (developed on 3.14).
- **FastAPI**: Modern, fast (high-performance) web framework.
- **Uvicorn**: ASGI server implementation.
- **Firebase Admin SDK**: Firestore, Storage, and ID-token verification.
- **RapidFuzz**: High-performance fuzzy string matching.
- **PyTorch, torchvision, timm, OpenCLIP**: ML models for skin and color analysis.
- **OpenCV, pyfacer, scikit-learn, scikit-image, Pillow**: Image processing and face parsing.

### **Tools & Services**

- **Firebase**: Authentication, database and cloud services.
- **Git/GitHub**: Version control.
- **Claude Code/Antigravity/Cline/Copilot**: Development assistance.

---

## 4. Project Structure

```bash
Chromascope/
├── backend/
│   ├── app/
│   │   ├── api/              # FastAPI app, endpoints, auth (Firebase ID-token) helpers
│   │   ├── cli/              # Command-line tools for the safety engine
│   │   └── core/             # Safety engine, filtering, database wrappers
│   │       └── skin_analysis/  # ML pipeline for skin and color analysis (weights go in ml/)
│   ├── data/                 # Local datasets and constants
│   ├── scripts/              # Migration and utility scripts
│   ├── serviceAccountKey.json  # Firebase Admin credentials (not committed)
│   └── requirements.txt      # Python dependencies
├── frontend/
│   ├── src/
│   │   ├── assets/           # Images, logos, splash animation frames
│   │   ├── components/       # UI components (common, navigation, ar-tryon, etc.)
│   │   ├── hooks/            # Custom React hooks
│   │   ├── layouts/          # Layout wrappers (MainLayout)
│   │   ├── pages/            # Main application pages
│   │   ├── routes/           # AppRouter (route definitions)
│   │   ├── services/         # API integration services
│   │   ├── store/            # Zustand state stores
│   │   ├── styles/           # Design tokens and global/component CSS
│   │   ├── utils/            # Shared helpers
│   │   └── firebase.js       # Firebase client initialization
│   ├── public/               # Static assets
│   └── package.json
├── .env.example              # Firebase credential fields and frontend API URL
└── package.json              # Root configuration
```

---

## 5. Frontend Setup Guide

### **Prerequisites**

- **Node.js 20.19+ or 22.12+** (required by Vite 8)

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

### **Other Scripts**

```bash
npm run build     # Production build to frontend/dist
npm run preview   # Serve the production build locally
npm run lint      # Run ESLint
```

### **API URL**

The backend URL is currently **hardcoded** to `http://localhost:8000` in two places:

- `src/services/productService.js` (`API_BASE_URL`)
- `src/pages/ColorAnalysisProcessingPage.jsx`

For production, update both to point to your deployed API. `.env.example` lists a `VITE_API_URL` variable, but the frontend does not read it yet.

---

## 6. Backend Setup Guide

### **Prerequisites**

- **Python 3** (developed on 3.14)
- Note: the ML dependencies (PyTorch, OpenCV, etc.) are large, so the first install can take a while.

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

1. In the Firebase console, generate a service account key for the project.
2. Save it as `backend/serviceAccountKey.json`. The backend loads it by relative path, so run the server from the `backend/` directory.
3. For reference, `.env.example` at the repo root lists the same credential fields (`FIREBASE_*`) that make up this file.

Never commit `serviceAccountKey.json` or `.env`.

### **ML Configuration**

1. Get the weights folder at: [Weights Link](https://drive.google.com/drive/folders/1QBDaRbK5rdIFNH8_7SN4uKwkTrC4NUjp?usp=sharing)
2. Place the weights folder in the `backend/app/core/skin_analysis/ml/` directory.

### **Run API Server**

From the `backend/` directory:

```bash
uvicorn app.api.api:app --reload
```

The API documentation (Swagger) will be available at `http://localhost:8000/docs`.

---

## 7. Frontend Routes Documentation

| Route                        | Page Component                | Description                                       |
| ---------------------------- | ----------------------------- | ------------------------------------------------- |
| `/`                          | `SplashPage`                  | Landing page with product overview.               |
| `/auth`                      | `AuthPage`                    | Login, registration and password reset.           |
| `/onboarding`                | `OnboardingPage`              | Skin type and concern selection.                  |
| `/home`                      | `HomePage`                    | Main dashboard and personalized feed.             |
| `/profile`                   | `ProfilePage`                 | User account settings and saved items.            |
| `/ar-tryon`                  | `ARTryOnPage`                 | Real-time virtual try-on interface.               |
| `/color-analysis`            | `ColorAnalysisPage`           | Photo/webcam capture for seasonal color analysis. |
| `/color-analysis/processing` | `ColorAnalysisProcessingPage` | Runs the analysis and saves the result.           |
| `/color-analysis/subtype`    | `ColorAnalysisSubtypePage`    | Season subtype result details.                    |
| `/ingredient-filter`         | `IngredientFilterPage`        | Deep analysis of product ingredients.             |
| `/product-catalog`           | `ProductCatalogPage`          | Browse products with safety verdicts.             |
| `/palette-product`           | `PaletteGuideProductPage`     | Recommendations by palette (hidden from sidebar). |
| `/user-manual`               | `UserManualPage`              | How to use Chromascope.                           |
| `/terms`                     | `TermsOfServicePage`          | Terms of Service.                                 |
| `/privacy`                   | `PrivacyPolicyPage`           | Privacy Policy.                                   |
| `/admin`                     | `AdminDatabasePage`           | Admin dashboard for catalog management.           |

Pages from `/home` to `/palette-product` render inside `MainLayout` (sidebar + top bar). Unknown routes redirect to `/`.

---

## 8. Backend API Documentation

### **Authentication**

Endpoints marked 🔒 require a Firebase ID token from the signed-in user:

```
Authorization: Bearer <firebase-id-token>
```

### **General Endpoints**

- `GET /`: Health check status.

### **Product Endpoints**

- `GET /api/products`: Fetches all products from Firestore.
- `GET /api/ingredients`: Returns the full ingredient safety database.

### **User Endpoints**

- 🔒 `PATCH /api/user/profile`: Updates the signed-in user's profile (e.g., saves color analysis results).

### **Safety Engine**

- 🔒 `POST /api/run-filter`:
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

### **Color Analysis**

- 🔒 `POST /api/analyze-color`:
  - **Purpose**: Analyzes a face photo and returns the user's seasonal color result.
  - **Request**: `multipart/form-data` with an image in the `file` field.

---

## 9. Architecture Overview

- **Communication**: The Frontend communicates with the FastAPI backend via RESTful endpoints, sending the Firebase ID token for protected routes.
- **Authentication**: Firebase Authentication on the client; the backend verifies ID tokens with the Firebase Admin SDK.
- **State Management**: Zustand is used for global application state (e.g., user profile, active palette).
- **Safety Logic**: The `SafetyFilter` class in the backend core processes product INCI lists against user profiles using fuzzy matching to ensure accuracy despite varied ingredient naming.
- **Color Analysis**: The `AnalyzerPipeline` in `core/skin_analysis` runs the ML models on the uploaded photo, and the result is matched to a season.
- **Database**: Firebase Firestore acts as the primary data store for products, ingredients, and user metadata.

---

## 10. Design System

- **Colors** are theme tokens. To change the palette, edit **both**:
  - `frontend/src/styles/variables.css` (`:root` CSS variables used by `components.css` and inline styles)
  - the `@theme` block in `frontend/src/styles/globals.css` (generates Tailwind classes like `bg-primary`, `text-primary-dark`)
- **Palette**: primary `#6D4EC6` (with `dark`, `darker`, `light`, `lighter`, `lightest` shades) and secondary `#987CE6`. Use token classes (e.g., `text-primary`, `bg-primary-lightest`) instead of hardcoded hex values.
- **Fonts**: MuseoModerno for headings (`font-heading`, semibold) and Google Sans Flex for body text (`font-body`).
- **Tailwind v4 note**: `frontend/tailwind.config.js` is **not loaded**. Tailwind v4 only reads it through an `@config` directive, which this project does not use, so theme changes belong in `globals.css`.

---

## 11. Known Limitations

- **Image paths**: some components reference images with `"/src/assets/..."` string paths. These work in `npm run dev` but break in production builds; import the image instead (`import logo from "../assets/..."`).
- **Container widths**: `variables.css` defines `--container-*` variables that override Tailwind's `max-w-sm` through `max-w-2xl`, so those classes render wider than intended.
- **CORS**: the API currently allows all origins (`allow_origins=["*"]`); restrict this before deploying.

---

## License

This project is licensed under the MIT License - see the `LICENSE` file for details.
