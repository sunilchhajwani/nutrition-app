from fastapi import FastAPI, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import pandas as pd
import io
import os
import math
import numpy as np # Import numpy
# import google.generativeai as genai # Uncomment this line when integrating actual Gemini API

app = FastAPI()

# Allow CORS for frontend development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Adjust this to your frontend URL in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

DATA_DIR = os.path.join(os.path.dirname(__file__), "data")
FOODS_FILE = os.path.join(DATA_DIR, "foods.xlsx")
RDA_FILE = os.path.join(DATA_DIR, "rda.xlsx")

foods_df: pd.DataFrame = None
rda_df: pd.DataFrame = None

# --- Pydantic Models for Request Bodies ---
class FoodSelection(BaseModel):
    food_name: str
    quantity: float  # Assuming quantity can be a decimal (e.g., 0.5 cups)

class CalculateNutritionRequest(BaseModel):
    selected_foods: list[FoodSelection]
    rda_profile_name: str

class AIFeedbackRequest(BaseModel):
    nutritional_summary: dict  # This will contain total_nutrients, nutrient_comparison etc.
    co_morbidities: str

# --- Data Loading and Persistence ---
def load_data():
    global foods_df, rda_df
    try:
        if os.path.exists(FOODS_FILE):
            foods_df = pd.read_excel(FOODS_FILE)
            # Convert all columns except 'FoodName', 'ServingSize' to numeric, coercing errors
            food_nutrient_cols = [col for col in foods_df.columns if col not in ['FoodName', 'ServingSize']]
            for col in food_nutrient_cols:
                # Remove '<' character before converting to numeric
                foods_df[col] = foods_df[col].astype(str).str.replace('<', '', regex=False)
                foods_df[col] = pd.to_numeric(foods_df[col], errors='coerce')
            # Replace NaN/inf with None in numeric columns
            foods_df[food_nutrient_cols] = foods_df[food_nutrient_cols].replace([np.nan, np.inf, -np.inf], None)
            print("foods.xlsx loaded from disk.")
        else:
            print("foods.xlsx not found on disk. Will start with empty food data.")

        if os.path.exists(RDA_FILE):
            rda_df = pd.read_excel(RDA_FILE)
            # Get all columns except 'ProfileName' and convert them to numeric
            cols_to_convert = [col for col in rda_df.columns if col != 'ProfileName']
            for col in cols_to_convert:
                # Remove '<' character before converting to numeric
                rda_df[col] = rda_df[col].astype(str).str.replace('<', '', regex=False)
                rda_df[col] = pd.to_numeric(rda_df[col], errors='coerce')
            # Replace NaN/inf with None in numeric columns
            rda_df[cols_to_convert] = rda_df[cols_to_convert].replace([np.nan, np.inf, -np.inf], None)
            print("rda.xlsx loaded from disk.")
        else:
            print("rda.xlsx not found on disk. Will start with empty RDA data.")

    except Exception as e:
        print(f"An error occurred while loading data from disk: {e}")
        foods_df = None
        rda_df = None

@app.on_event("startup")
async def startup_event():
    load_data()
    # Configure Gemini API (Uncomment and replace with your API key)
    # GEMINI_API_KEY = os.getenv("GEMINI_API_KEY") # It's best practice to use environment variables
    # if GEMINI_API_KEY:
    #     genai.configure(api_key=GEMINI_API_KEY)
    # else:
    #     print("Warning: GEMINI_API_KEY not found. AI feedback will not work.")

# --- Utility Functions ---
def sanitize_for_json(obj):
    """Recursively replace NaN and inf values with None in dicts/lists."""
    if isinstance(obj, float):
        if math.isnan(obj) or math.isinf(obj):
            return None
        return obj
    elif isinstance(obj, dict):
        return {k: sanitize_for_json(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [sanitize_for_json(i) for i in obj]
    else:
        return obj

# --- Endpoints ---
@app.get("/")
async def read_root():
    return {"message": "Simran Nutrition App Backend is running!"}

@app.post("/api/upload-foods")
async def upload_foods(file: UploadFile = File(...)):
    global foods_df
    if not file.filename.endswith(('.xlsx', '.xls')):
        raise HTTPException(status_code=400, detail="Invalid file type. Please upload an Excel file (.xlsx or .xls).")
    try:
        content = await file.read()
        temp_df = pd.read_excel(io.BytesIO(content))

        # Basic validation: Check for required columns
        required_food_cols = ['FoodName', 'ServingSize', 'Calories (kcal)', 'Protein (g)', 'Carbohydrates (g)', 'Fat (g)', 'Sodium (mg)', 'Fiber (g)']
        if not all(col in temp_df.columns for col in required_food_cols):
            raise HTTPException(status_code=400, detail=f"Missing required columns in foods.xlsx. Expected: {required_food_cols}")

        # Convert all nutrient columns to numeric, coercing errors
        nutrient_cols = [col for col in temp_df.columns if col not in ['FoodName', 'ServingSize']]
        for col in nutrient_cols:
            temp_df[col] = pd.to_numeric(temp_df[col], errors='coerce')

        # Replace NaN/inf with None in numeric columns BEFORE assigning to global foods_df
        temp_df[nutrient_cols] = temp_df[nutrient_cols].replace([np.nan, np.inf, -np.inf], None)

        # Now that validation and conversion are done, assign to the global dataframe
        foods_df = temp_df

        # Save the uploaded file to disk for persistence
        with open(FOODS_FILE, "wb") as f:
            f.write(content)

        print("foods.xlsx uploaded, loaded, and saved successfully.")
        return {"message": "foods.xlsx uploaded and processed successfully.", "filename": file.filename}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error processing foods.xlsx: {e}")

@app.post("/api/upload-rda")
async def upload_rda(file: UploadFile = File(...)):
    global rda_df
    if not file.filename.endswith(('.xlsx', '.xls')):
        raise HTTPException(status_code=400, detail="Invalid file type. Please upload an Excel file (.xlsx or .xls).")
    try:
        content = await file.read()
        temp_df = pd.read_excel(io.BytesIO(content))

        # Basic validation: Check for required columns (ProfileName and at least one nutrient column)
        if 'ProfileName' not in temp_df.columns:
            raise HTTPException(status_code=400, detail="Missing 'ProfileName' column in rda.xlsx.")

        # Convert all nutrient columns to numeric, coercing errors
        nutrient_cols = [col for col in temp_df.columns if col != 'ProfileName']
        for col in nutrient_cols:
            temp_df[col] = pd.to_numeric(temp_df[col], errors='coerce')

        # Get nutrient columns from foods_df for validation (if foods_df is already loaded)
        if foods_df is not None:
            food_nutrient_cols = [col for col in foods_df.columns if col not in ['FoodName', 'ServingSize']]
            # Check if all food nutrient columns are present in the uploaded RDA file
            missing_rda_cols = [col for col in food_nutrient_cols if col not in temp_df.columns]
            if missing_rda_cols:
                 # Add missing columns to temp_df and fill with None
                 for col in missing_rda_cols:
                     temp_df[col] = None
                 print(f"Warning: Added missing RDA columns from foods.xlsx: {missing_rda_cols}. Filled with None.")

        # Replace NaN/inf with None in numeric columns BEFORE assigning to global rda_df
        # Use the potentially updated nutrient_cols list if columns were added
        current_nutrient_cols = [col for col in temp_df.columns if col != 'ProfileName']
        temp_df[current_nutrient_cols] = temp_df[current_nutrient_cols].replace([np.nan, np.inf, -np.inf], None)


        # Now that validation and conversion are done, assign to the global dataframe
        rda_df = temp_df

        # Save the uploaded file to disk for persistence
        with open(RDA_FILE, "wb") as f:
            f.write(content)

        print("rda.xlsx uploaded, loaded, and saved successfully.")
        return {"message": "rda.xlsx uploaded and processed successfully.", "filename": file.filename}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error processing rda.xlsx: {e}")

@app.get("/api/foods")
async def get_foods():
    if foods_df is None:
        raise HTTPException(status_code=404, detail="Food data not yet uploaded. Please upload foods.xlsx.")
    # Data is already sanitized with None after loading/uploading,
    # but sanitize_for_json is kept as a safeguard.
    return sanitize_for_json(foods_df.to_dict(orient="records"))

@app.get("/api/rda-profiles")
async def get_rda_profiles():
    if rda_df is None:
        raise HTTPException(status_code=404, detail="RDA data not yet uploaded. Please upload rda.xlsx.")
    # No numeric data returned here, so no sanitization needed for this specific endpoint
    return rda_df["ProfileName"].unique().tolist()

@app.post("/api/calculate-nutrition")
async def calculate_nutrition(request: CalculateNutritionRequest):
    if foods_df is None or rda_df is None:
        raise HTTPException(status_code=404, detail="Food or RDA data not uploaded. Please upload both Excel files.")

    # Initialize total_nutrients with 0.0 for known nutrient columns from foods_df
    # Ensure we only include columns that are numeric after loading/sanitizing
    numeric_food_cols = foods_df.select_dtypes(include=np.number).columns.tolist()
    total_nutrients = {col: 0.0 for col in numeric_food_cols}

    selected_menu_details = []

    for item in request.selected_foods:
        food_row = foods_df[foods_df['FoodName'] == item.food_name]
        if food_row.empty:
            raise HTTPException(status_code=404, detail=f"Food item '{item.food_name}' not found in foods data.")
        
        # Convert row to dict. NaN/inf should already be None due to fillna after load/upload
        food_data = food_row.iloc[0].to_dict()
        
        selected_menu_details.append({
            "food_name": item.food_name,
            "quantity": item.quantity,
            # ServingSize might be None if the cell was empty/invalid
            "serving_size": food_data.get('ServingSize') 
        })

        for nutrient in total_nutrients.keys(): # Iterate over the numeric columns we initialized
            # Get nutrient value, default to 0 if None or not present
            food_nutrient_value = food_data.get(nutrient, 0)
            if food_nutrient_value is None: # Treat None as 0 for calculation
                 food_nutrient_value = 0

            # Perform calculation. If food_nutrient_value is 0 or a number, this works.
            # If item.quantity is NaN/inf (unlikely due to Pydantic but possible), result could be NaN/inf.
            # The final sanitize_for_json will handle this.
            total_nutrients[nutrient] += food_nutrient_value * item.quantity

    rda_profile_row = rda_df[rda_df['ProfileName'] == request.rda_profile_name]
    if rda_profile_row.empty:
        raise HTTPException(status_code=404, detail=f"RDA profile '{request.rda_profile_name}' not found.")
    
    # Convert row to dict. NaN/inf should already be None due to fillna after load/upload
    rda_targets = rda_profile_row.iloc[0].drop('ProfileName').to_dict()

    nutrient_comparison = {}
    # Iterate over all nutrients present in either total_nutrients or rda_targets
    all_nutrients = set(total_nutrients.keys()).union(set(rda_targets.keys()))

    for nutrient in all_nutrients:
        total_val = total_nutrients.get(nutrient, 0) # Default to 0 if nutrient not in total
        rda_val = rda_targets.get(nutrient, None) # Default to None if nutrient not in RDA

        # Handle cases where RDA value is None
        if rda_val is None:
            nutrient_comparison[nutrient] = None # Cannot compare if no RDA target
        else:
             # Ensure total_val is treated as 0 if it's None (shouldn't happen with current init, but safe)
            if total_val is None:
                total_val = 0
            nutrient_comparison[nutrient] = total_val - rda_val

    # Generate a simple summary
    summary_parts = []
    summary_parts.append(f"Selected menu provides: ")
    # Iterate over total_nutrients, which only contains numeric columns
    for nutrient, value in total_nutrients.items():
         # Format only if value is not None
        formatted_value = f"{value:.1f}" if value is not None else "N/A"
        summary_parts.append(f"{nutrient}: {formatted_value}")
    
    summary_parts.append(f"\nCompared to {request.rda_profile_name} RDA: ")
    # Iterate over rda_targets, which contains nutrients from RDA file
    for nutrient, rda_val in rda_targets.items():
         # Format only if value is not None
        formatted_rda_val = f"{rda_val:.1f}" if rda_val is not None else "N/A"
        summary_parts.append(f"{nutrient}: {formatted_rda_val}")
    
    summary_parts.append(f"\nDeficit/Excess: ")
    # Iterate over nutrient_comparison
    for nutrient, diff in nutrient_comparison.items():
        if diff is not None:
            status = "excess" if diff > 0 else "deficit" if diff < 0 else "meets target"
            summary_parts.append(f"{nutrient}: {abs(diff):.1f} ({status})")
        else:
             summary_parts.append(f"{nutrient}: N/A (no RDA target)")


    final_summary = "; ".join(summary_parts)

    # Sanitize all outputs as a final check
    # print(f"total_nutrients before sanitize: {total_nutrients}")
    # print(f"rda_targets before sanitize: {rda_targets}")
    # print(f"nutrient_comparison before sanitize: {nutrient_comparison}")

    return sanitize_for_json({
        "selected_menu": selected_menu_details,
        "total_nutrients": total_nutrients,
        "rda_profile_name": request.rda_profile_name,
        "rda_targets": rda_targets,
        "nutrient_comparison": nutrient_comparison,
        "final_summary": final_summary
    })

@app.post("/api/ai-feedback")
async def ai_feedback(request: AIFeedbackRequest):
    # Placeholder for Gemini API integration
    # You will need to uncomment and configure google.generativeai
    # and set your GEMINI_API_KEY environment variable.

    # model = genai.GenerativeModel('gemini-pro')
    # prompt = f"Given the following nutritional summary: {request.nutritional_summary} and patient co-morbidities: {request.co_morbidities}. Provide a concise nutritional feedback, highlighting potential concerns or positive aspects related to their conditions. Keep it professional and actionable for a dietitian."
    # try:
    #     response = model.generate_content(prompt)
    #     ai_response_text = response.text
    # except Exception as e:
    #     ai_response_text = f"Error generating AI feedback: {e}"

    # Mock AI response for now
    ai_response_text = f"Mock AI Feedback for co-morbidities: '{request.co_morbidities}'.\n\nBased on the provided nutritional summary, consider the following:\n- Ensure adequate protein intake for healing.\n- Monitor sodium levels closely if hypertension is a concern.\n- Adjust carbohydrate intake for glycemic control if diabetes is present."

    return {"ai_feedback": ai_response_text}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
