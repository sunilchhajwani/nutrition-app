# Simran Nutrition App

This is a full-stack nutrition management application designed for clinical or hospital settings. It allows healthcare professionals to manage patient information, create personalized meal plans, analyze nutritional content, and track meal preparation and delivery. The application leverages the Gemini API for intelligent dietary feedback.

## Tech Stack

*   **Frontend:** React, TypeScript
*   **Backend:** Python, FastAPI
*   **Database:** SQLite
*   **AI Integration:** Google Gemini API

## Prerequisites

Before you begin, ensure you have the following installed on your system:

*   [Node.js](https://nodejs.org/) (which includes npm)
*   [Python 3.8+](https://www.python.org/)
*   [Git](https://git-scm.com/)

## Getting Started

### 1. Clone the Repository

```bash
git clone <repository-url>
cd simran-nutrition-app
```

### 2. Set Up the Backend

*   Navigate to the `backend` directory:
    ```bash
    cd backend
    ```
*   Create a virtual environment:
    ```bash
    python -m venv venv
    ```
*   Activate the virtual environment:
    *   On Windows:
        ```bash
        venv\Scripts\activate
        ```
    *   On macOS/Linux:
        ```bash
        source venv/bin/activate
        ```
*   Install the required Python packages:
    *   `fastapi`
    *   `uvicorn`
    *   `pandas`
    *   `openpyxl`
    *   `SQLAlchemy`
    *   `passlib`
    *   `bcrypt`
    *   `python-jose[cryptography]`
    *   `python-multipart`
    ```bash
    pip install -r requirements.txt
    ```

### 3. Configure the Gemini API Key

The backend uses the Gemini API for AI-powered feedback. You will need to obtain a Gemini API key and set it as an environment variable.

*   Create a `.env` file in the `backend` directory.
*   Add the following line to the `.env` file:
    ```
    GEMINI_API_KEY="your-gemini-api-key"
    ```

### 4. Set Up the Frontend

*   Navigate to the `frontend` directory:
    ```bash
    cd ../frontend
    ```
*   Install the required npm packages:
    ```bash
    npm install
    ```

### 5. Run the Application

*   **Start the Backend Server:**

    *   Make sure you are in the `backend` directory with the virtual environment activated.
    *   Run the FastAPI application using Uvicorn:
        ```bash
        uvicorn app:app --reload --port 8001
        ```
        Alternatively, you can run it directly via Python (though `--reload` won't be active unless configured in `app.py`):
        ```bash
        python app.py
        ```
    *   The backend server will be running at `http://localhost:8001`.

*   **Start the Frontend Development Server:**

    *   In a new terminal, navigate to the `frontend` directory.
    *   Run the following command:
        ```bash
        npm start
        ```
    *   The frontend application will open in your browser at `http://localhost:3000`.

### 6. Initial Data Upload

For the application to function correctly, you need to upload the initial food and RDA (Recommended Dietary Allowance) data.

*   In the application's user interface, you will find options to upload data.
*   Upload the `foods.xlsx` and `rda.xlsx` files located in the `backend/data` directory.

## Building for Production

To create a production-ready build of the frontend, run the following command in the `frontend` directory:

```bash
npm run build
```

This will create a `build` directory with the optimized and minified static files for the frontend.

## Deployment

For a production deployment, you would typically:

1.  **Backend:**
    *   Use a production-grade ASGI server like Gunicorn with Uvicorn workers.
    *   Run the FastAPI application behind a reverse proxy like Nginx or Caddy.
    *   Consider using a more robust database like PostgreSQL or MySQL instead of SQLite.

2.  **Frontend:**
    *   Serve the static files from the `frontend/build` directory using a web server like Nginx or a static site hosting service.

## API Endpoints

Here is a list of the available API endpoints:

*   `POST /api/auth/register`: Register a new user.
*   `POST /api/auth/token`: Obtain a JWT token for authentication.
*   `GET /api/patients`: Get a list of all patients.
*   `POST /api/patients`: Create a new patient.
*   `GET /api/patients/{patient_id}`: Get a specific patient by ID.
*   `PUT /api/patients/{patient_id}`: Update a patient's information.
*   `DELETE /api/patients/{patient_id}`: Delete a patient.
*   `POST /api/upload-foods`: Upload an Excel file with food data.
*   `POST /api/upload-rda`: Upload an Excel file with RDA profiles.
*   `GET /api/foods`: Get a list of all food items.
*   `GET /api/rda-profiles`: Get a list of all RDA profiles.
*   `POST /api/calculate-nutrition`: Calculate the nutritional value of a meal.
*   `POST /api/ai-feedback`: Get AI-powered feedback on a meal plan.
*   `POST /api/send-to-kitchen`: Send a meal plan to the kitchen.
*   `PATCH /api/meal-plan-items/{item_id}`: Update the status of a meal plan item.
*   `GET /api/meal-plans`: Get a list of meal plans, with an optional date filter.