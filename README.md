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
2. **Color Analysis**: Users upload a photo or use their webcam; the backend classifies them directly into one of 12 seasons (e.g., Cool Winter, Warm Autumn) and extracts their skin tone in LAB color space.
3. **Discovery**: Browsing a curated product catalog with safety verdicts.
4. **Try-On**: Visualizing shades using Augmented Reality.
5. **Safety Engine**: Real-time filtering of products based on ingredient compatibility.

---

## 2. Features

### **Frontend Features**

- **Seasonal Color Analysis**: Photo or webcam capture, analyzed by the backend ML pipeline to place the user in the 12-season system. The results page also shows a sister and a contrast season, taken from a fixed lookup table in the frontend (`ColorAnalysisSubtypePage.jsx`).
- **AR Virtual Try-On**: Real-time shade visualization on the live camera feed, with on-device face-landmark tracking (MediaPipe) for lips, cheeks and eyeshadow.
- **Ingredient Filter & Product Catalog**: Products filtered and labeled by safety verdict for the user's skin profile.
- **Responsive Mobile-First UI**: Seamless experience across all devices.
- **Micro-Animations**: Fluid transitions and scroll-triggered reveals using Framer Motion.
- **Glassmorphic Design**: Modern, premium aesthetic with blur effects.

### **Backend Features**

- **Safety Engine**: Advanced logic for ingredient-skin type compatibility.
- **Fuzzy Matching**: Intelligent INCI name matching using RapidFuzz.
- **Skin & Color Analysis**: PyTorch-based pipeline (face parsing, skin-color extraction and 12-season classification) behind `POST /api/analyze-color`. See [Color Analysis Pipeline](#10-color-analysis-pipeline).
- **Firebase Integration**: Firestore database and ID-token verification for protected endpoints.
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
- **Tailwind CSS v4**: Styling, via the `@tailwindcss/vite` plugin and configured in CSS (see [Design System](#14-design-system)).
- **Framer Motion**: Advanced animations and transitions.
- **MediaPipe Tasks Vision**: Face-landmark tracking for AR try-on.
- **Firebase JS SDK**: Authentication and Firestore access.
- **Zustand**: Lightweight state management.
- **React Router 7**: Declarative routing.
- **Lucide React**: Premium icon set.

### **Backend**

- **Python 3.14**: Core programming language.
- **FastAPI**: Modern, fast (high-performance) web framework.
- **Uvicorn**: ASGI server implementation.
- **Firebase Admin SDK**: Firestore and ID-token verification.
- **RapidFuzz**: High-performance fuzzy string matching.
- **PyTorch + OpenCLIP**: ViT-B/16 backbone with FaRL weights for season classification.
- **pyfacer**: Face detection (RetinaFace) and face parsing (FaRL).
- **scikit-learn, scikit-image, SciPy, Pillow**: K-means skin-color extraction in LAB space, white balance, image handling.
- **torchvision**: Image preprocessing transforms only.
- `timm`, `opencv-python` and `torchmetrics` are listed in `requirements.txt`; `timm` and `torchmetrics` are not imported by the app, and OpenCV is used for the photo quality check (blur and brightness) and debug image output. SciPy is imported but not listed; it is installed as a dependency of scikit-learn.

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
│   │       └── skin_analysis/  # ML pipeline for skin and color analysis (weights go in ml/weights/)
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

- **Node.js 20.19+ or 22.12+** — required by Vite 8 (`"node": "^20.19.0 || >=22.12.0"` in `package-lock.json`; `frontend/package.json` has no `engines` field of its own)

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
- `src/pages/ColorAnalysisProcessingPage.jsx` (two `fetch` calls: `/api/analyze-color` and `/api/user/profile`)

For production, update both files to point to your deployed API. `.env.example` lists a `VITE_API_URL` variable, but the frontend does not read it yet. See [Deployment](#13-deployment).

---

## 6. Backend Setup Guide

### **Prerequisites**

- **Python 3.14** — the project's virtual environments were created with Python 3.14.3. No Python version is pinned in a project file (no `.python-version`, `pyproject.toml` or `runtime.txt`).
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
2. Place the folder at `backend/app/core/skin_analysis/ml/weights/`. The pipeline needs these two files:
   - `FaRL-Base-Patch16-LAIONFace20M-ep64.pth` (FaRL backbone weights)
   - `final_sub_class_model.pth` (trained 12-season classification head)
3. The face detection and face parsing models are not in this folder. pyfacer downloads them automatically from GitHub releases the first time the server starts, so the first run needs internet access.

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
| `/color-analysis/subtype`    | `ColorAnalysisSubtypePage`    | 12-season result, with sister/contrast seasons.   |
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
  - **Response**: `safety_results` (products with a safety verdict of `safe`, `caution` or `excluded`, plus detailed reasoning), `color_matched` (the same products sorted by color match to the user's season / skin tone), and `active_profile`.

### **Color Analysis**

- 🔒 `POST /api/analyze-color`:
  - **Purpose**: Analyzes a face photo and returns the user's seasonal color result.
  - **Request**: `multipart/form-data` with an image in the `file` field.
  - **Response**:
    ```json
    {
      "season": "Cool Winter",
      "confidence": 87.4,
      "low_confidence": false,
      "lab_color": [62.1, 12.3, 18.7]
    }
    ```
    `season` is one of the 12 seasons, `confidence` is a percentage, `low_confidence` is `true` when confidence is below 30%, and `lab_color` is the dominant skin color in CIE LAB.
  - **Errors**: photo problems return **422** with `{"detail": {"code": "...", "message": "..."}}`. The frontend shows a pop-up for each code:

    | Code            | Meaning                                                    |
    | --------------- | ---------------------------------------------------------- |
    | `invalid_image` | The file is not a readable image.                          |
    | `no_face`       | No face was detected.                                      |
    | `face_unclear`  | Too little skin is visible, or the skin color can't be read. |
    | `too_dark`      | The skin is too dark to read (poor lighting).              |
    | `too_bright`    | The skin is washed out (overexposed or flash).             |
    | `too_blurry`    | The face is out of focus.                                  |

    Any other failure returns **500**.

---

## 9. Architecture Overview

- **Communication**: The Frontend communicates with the FastAPI backend via RESTful endpoints, sending the Firebase ID token for protected routes.
- **Authentication**: Firebase Authentication on the client; the backend verifies ID tokens with the Firebase Admin SDK.
- **State Management**: Zustand is used for global application state (e.g., user profile, active palette).
- **Safety Logic**: The `SafetyFilter` class in the backend core processes product INCI lists against user profiles using fuzzy matching to ensure accuracy despite varied ingredient naming.
- **Color Analysis**: The `AnalyzerPipeline` in `core/skin_analysis` runs the ML models on the uploaded photo and returns a 12-season label and skin color (see [Color Analysis Pipeline](#10-color-analysis-pipeline)).
- **Database**: Firebase Firestore acts as the primary data store for products, ingredients, and user metadata.

---

## 10. Color Analysis Pipeline

`AnalyzerPipeline` (`backend/app/core/skin_analysis/pipeline.py`) is loaded once when the API starts and runs on GPU if CUDA is available, otherwise CPU. For each photo it runs:

1. **White balance**: gray-edge white balancing to reduce color casts from lighting.
2. **Face detection and parsing (pyfacer)**: RetinaFace (`retinaface/mobilenet`) finds the face, and the FaRL face parser (`farl/celebm/448`) labels each pixel. Two masks are built from those labels:
   - **Skin mask** (face + nose only), used for skin-color extraction.
   - **Head mask** (face, hair, eyes, brows, lips, ears, etc., with background, neck and clothing removed), used for season classification.
   If no face is detected, the request fails with error code `no_face`.
3. **Photo quality check** (`quality_check.py`): runs on the original (not white-balanced) photo using the skin mask, and rejects the photo if too little skin is visible (`face_unclear`), the mean skin L\* is below 30 (`too_dark`) or above 85 (`too_bright`), or the face's sharpness score (Laplacian variance) is below 15 (`too_blurry`). These thresholds are plain constants at the top of `quality_check.py` and have not been tuned yet; check them against real photos.
4. **Skin color**: K-means (k = 3) on the skin pixels in CIE LAB space; the center of the largest cluster is returned as `lab_color`. If the skin color can't be extracted, the request fails with `face_unclear`.
5. **Season classification**: the masked head image is resized to 224×224 and passed through an **OpenCLIP ViT-B/16** image encoder loaded with **FaRL** weights, followed by a small two-layer MLP head that outputs **12 classes** (the 12 seasons). The highest-probability class is returned as `season`, with its probability as `confidence`. Results below 30% confidence are flagged `low_confidence`; the results page then shows a warning and a "Retake Photo" link.

**One-stage classification.** The model predicts the 12-season label directly. There is no separate step that predicts a base season first and then a sub-type.

**Where the weights come from:**

| Model                               | Weights file / source                                                                              |
| ----------------------------------- | -------------------------------------------------------------------------------------------------- |
| RetinaFace (MobileNet) face detector | Downloaded automatically by pyfacer from GitHub releases on first run                             |
| FaRL face parser (CelebAMask-HQ, 448) | Downloaded automatically by pyfacer from GitHub releases on first run                            |
| OpenCLIP ViT-B/16 backbone          | Architecture from OpenCLIP (no pretrained download); weights from `ml/weights/FaRL-Base-Patch16-LAIONFace20M-ep64.pth` |
| 12-season classification head       | Trained for this project; `ml/weights/final_sub_class_model.pth`                                   |

The two `ml/weights/` files come from the Google Drive folder in [ML Configuration](#ml-configuration). No weights are loaded from timm or Hugging Face, and torchvision is used only for image transforms.

`ml/inference.py` is an older standalone script for a 4-season model (`final_model.pth`). The API does not use it.

---

## 11. Data Privacy

### **Color analysis photo (`POST /api/analyze-color`)**

- The photo is uploaded once from the browser to the backend as form data.
- The backend reads it into memory, runs the analysis, and returns the result. The code does **not** save the photo to disk, Firebase Cloud Storage, or Firestore, and does not log it.
- FastAPI buffers uploads in memory; uploads larger than about 1 MB are temporarily spooled to a temporary file by the framework, which is deleted automatically when the request finishes. Nothing in the app keeps a copy after the response is sent.
- **What is saved:** after the analysis, the frontend calls `PATCH /api/user/profile`, which stores only the numeric result in the user's Firestore document (`users/{uid}`): `seasonal_label`, `user_lab` and `season_confidence_level`.

### **AR try-on**

- Face tracking runs **on-device** in the browser with MediaPipe FaceLandmarker. Camera frames are **not** sent to the backend or any other server.
- The browser downloads the MediaPipe runtime from jsDelivr and the face-landmark model from Google Cloud Storage (`storage.googleapis.com`). These are one-way downloads; no camera data is sent with them.
- The **Capture** button saves a PNG directly to the user's device as a browser download. It is not uploaded.

---

## 12. AR Performance Readout (Planned)

An on-screen FPS / latency readout for the AR try-on (`frontend/src/utils/perfMeter.js` and `frontend/src/components/ar-tryon/PerfOverlay.jsx`, enabled with `/ar-tryon?perf=1`) is planned but **not implemented yet**.

---

## 13. Deployment

The app currently runs only against a local backend. Before user testing on phones:

1. **Deploy the backend** to a host reachable over **HTTPS**, with `serviceAccountKey.json` and the `ml/weights/` files available on the server. The server must start from the `backend/` directory (the key is loaded by relative path), and it needs internet access on first start so pyfacer can download its models.
2. **Point the frontend to the deployed API.** The URL is hardcoded to `http://localhost:8000` in `src/services/productService.js` and `src/pages/ColorAnalysisProcessingPage.jsx`. Either update both, or change the code to read `VITE_API_URL` (it is not read yet).
3. **Restrict CORS.** `backend/app/api/api.py` allows all origins (`allow_origins=["*"]`). Change it to allow only the deployed frontend origin.
4. **Serve the frontend over HTTPS.** Phone browsers only allow camera access (color-analysis webcam capture and AR try-on) on HTTPS pages or `localhost`, and an HTTPS page cannot call an HTTP API.

---

## 14. Design System

- **Colors** are theme tokens. To change the palette, edit **both**:
  - `frontend/src/styles/variables.css` (`:root` CSS variables used by `components.css` and inline styles)
  - the `@theme` block in `frontend/src/styles/globals.css` (generates Tailwind classes like `bg-primary`, `text-primary-dark`)
- **Palette**: primary `#6D4EC6` (with `dark`, `darker`, `light`, `lighter`, `lightest` shades) and secondary `#987CE6`. Use token classes (e.g., `text-primary`, `bg-primary-lightest`) instead of hardcoded hex values.
- **Fonts**: MuseoModerno for headings (`font-heading`, semibold) and Google Sans Flex for body text (`font-body`).
- **Tailwind v4 note**: `frontend/tailwind.config.js` is **not loaded**. Tailwind v4 only reads it through an `@config` directive, which this project does not use, so theme changes belong in `globals.css`.

---

## 15. Known Limitations

- **Image paths**: some components reference images with `"/src/assets/..."` string paths. These work in `npm run dev` but break in production builds; import the image instead (`import logo from "../assets/..."`).
- **Container widths**: `variables.css` defines `--container-*` variables that override Tailwind's `max-w-sm` through `max-w-2xl`, so those classes render wider than intended.
- **CORS**: the API currently allows all origins (`allow_origins=["*"]`); restrict this before deploying (see [Deployment](#13-deployment)).
- **API URL**: hardcoded to `http://localhost:8000`; `VITE_API_URL` is not read yet (see [API URL](#api-url)).

---

## License

This project is licensed under the MIT License - see the `LICENSE` file for details.
