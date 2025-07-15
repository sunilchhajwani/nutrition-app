from fastapi import FastAPI, HTTPException, UploadFile, File, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import pandas as pd
import io
import os
import math
import numpy as np
from sqlalchemy import Column, Integer, String, Float, ForeignKey, Boolean
import google.generativeai as genai
from structure_ai_output import structure_output
from sqlalchemy.orm import relationship, Session
from datetime import datetime, date
from typing import Optional

from database import Base, engine, SessionLocal, get_db # Import from new database.py
from auth import router as auth_router, User # Import User model from auth.py

app = FastAPI()

app.include_router(auth_router, prefix="/api/auth", tags=["auth"])


# Allow CORS for frontend development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Adjust this to your frontend URL in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure Gemini API
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
if not GEMINI_API_KEY:
    raise ValueError("GEMINI_API_KEY environment variable not set.")
genai.configure(api_key=GEMINI_API_KEY)

# --- Database Models ---
class Patient(Base):
    __tablename__ = "patients"
    id = Column(Integer, primary_key=True, index=True)
    hospital_id = Column(String, unique=True, index=True)
    name = Column(String)
    age = Column(Integer)
    sex = Column(String)

    meal_plans = relationship("MealPlan", back_populates="patient")

class FoodItem(Base):
    __tablename__ = "food_items"
    id = Column(Integer, primary_key=True, index=True)
    FoodName = Column(String, unique=True, index=True)
    ServingSize = Column(String)
    Calories_kcal = Column(Float)
    Protein_g = Column(Float)
    Carbohydrates_g = Column(Float)
    Fat_g = Column(Float)
    Sodium_mg = Column(Float)
    Fiber_g = Column(Float)

    # Relationship to MealPlanItem
    meal_plan_items = relationship("MealPlanItem", back_populates="food_item")

class RDAProfile(Base):
    __tablename__ = "rda_profiles"
    id = Column(Integer, primary_key=True, index=True)
    ProfileName = Column(String, unique=True, index=True)
    # Dynamically add nutrient columns based on foods.xlsx
    # For now, hardcode common ones, will handle dynamic later if needed
    Calories_kcal = Column(Float, nullable=True)
    Protein_g = Column(Float, nullable=True)
    Carbohydrates_g = Column(Float, nullable=True)
    Fat_g = Column(Float, nullable=True)
    Sodium_mg = Column(Float, nullable=True)
    Fiber_g = Column(Float, nullable=True)

class MealPlan(Base):
    __tablename__ = "meal_plans"
    id = Column(Integer, primary_key=True, index=True)
    patient_id = Column(Integer, ForeignKey("patients.id"))
    timestamp = Column(String, default=lambda: datetime.now().isoformat()) # Store as ISO format string

    items = relationship("MealPlanItem", back_populates="meal_plan")
    patient = relationship("Patient", back_populates="meal_plans")

class MealPlanItem(Base):
    __tablename__ = "meal_plan_items"
    id = Column(Integer, primary_key=True, index=True)
    meal_plan_id = Column(Integer, ForeignKey("meal_plans.id"))
    food_item_id = Column(Integer, ForeignKey("food_items.id"))
    meal_category = Column(String) # Breakfast, Lunch, Dinner, etc.
    quantity = Column(Float)
    prepared = Column(Boolean, default=False)
    delivered = Column(Boolean, default=False)

    meal_plan = relationship("MealPlan", back_populates="items")
    food_item = relationship("FoodItem", back_populates="meal_plan_items")

# --- Pydantic Models for Request Bodies ---
class PatientRequest(BaseModel):
    hospital_id: str
    name: str
    age: int
    sex: str

class FoodSelection(BaseModel):
    food_name: str
    quantity: float  # Assuming quantity can be a decimal (e.g., 0.5 cups)

class CalculateNutritionRequest(BaseModel):
    selected_foods: list[FoodSelection]
    rda_profile_name: str

class AIFeedbackRequest(BaseModel):
    nutritional_summary: dict  # This will contain total_nutrients, nutrient_comparison etc.
    co_morbidities: str
    diet_preference: str

class MealPlanItemRequest(BaseModel):
    food_name: str
    quantity: float

class SendMealPlanRequest(BaseModel):
    patient_id: int
    meal_plan: dict[str, list[MealPlanItemRequest]] # e.g., {"Breakfast": [{"food_name": "Egg", "quantity": 2}]}

class UpdateMealPlanItemStatusRequest(BaseModel):
    prepared: bool | None = None
    delivered: bool | None = None

@app.on_event("startup")
async def startup_event():
    Base.metadata.create_all(bind=engine)

# --- Patient Endpoints ---
@app.post("/api/patients", response_model=PatientRequest)
async def create_patient(patient: PatientRequest, db: Session = Depends(get_db)):
    db_patient = Patient(**patient.dict())
    db.add(db_patient)
    db.commit()
    db.refresh(db_patient)
    return db_patient

@app.get("/api/patients")
async def get_patients(db: Session = Depends(get_db)):
    return db.query(Patient).all()

@app.get("/api/patients/{patient_id}")
async def get_patient(patient_id: int, db: Session = Depends(get_db)):
    return db.query(Patient).filter(Patient.id == patient_id).first()

@app.put("/api/patients/{patient_id}", response_model=PatientRequest)
async def update_patient(patient_id: int, patient: PatientRequest, db: Session = Depends(get_db)):
    db_patient = db.query(Patient).filter(Patient.id == patient_id).first()
    if not db_patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    for var, value in vars(patient).items():
        setattr(db_patient, var, value) if value else None
    db.commit()
    db.refresh(db_patient)
    return db_patient

@app.delete("/api/patients/{patient_id}")
async def delete_patient(patient_id: int, db: Session = Depends(get_db)):
    db_patient = db.query(Patient).filter(Patient.id == patient_id).first()
    if not db_patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    db.delete(db_patient)
    db.commit()
    return {"message": "Patient deleted successfully"}

# --- Other Endpoints ---
@app.get("/")
async def read_root():
    return {"message": "Simran Nutrition App Backend is running!"}

@app.post("/api/upload-foods")
async def upload_foods(file: UploadFile = File(...), db: Session = Depends(get_db)):
    if not file.filename.endswith(('.xlsx', '.xls')):
        raise HTTPException(status_code=400, detail="Invalid file type. Please upload an Excel file (.xlsx or .xls).")
    try:
        content = await file.read()
        temp_df = pd.read_excel(io.BytesIO(content))

        required_food_cols = ['FoodName', 'ServingSize', 'Calories (kcal)', 'Protein (g)', 'Carbohydrates (g)', 'Fat (g)', 'Sodium (mg)', 'Fiber (g)']
        if not all(col in temp_df.columns for col in required_food_cols):
            raise HTTPException(status_code=400, detail=f"Missing required columns in foods.xlsx. Expected: {required_food_cols}")

        # Prepare data for database insertion
        food_items_to_add = []
        for index, row in temp_df.iterrows():
            food_name = row['FoodName']
            existing_food = db.query(FoodItem).filter(FoodItem.FoodName == food_name).first()

            food_data = {
                "FoodName": food_name,
                "ServingSize": row['ServingSize'],
                "Calories_kcal": row.get('Calories (kcal)'),
                "Protein_g": row.get('Protein (g)'),
                "Carbohydrates_g": row.get('Carbohydrates (g)'),
                "Fat_g": row.get('Fat (g)'),
                "Sodium_mg": row.get('Sodium (mg)'),
                "Fiber_g": row.get('Fiber (g)'),
            }
            # Replace NaN with None for database
            for key, value in food_data.items():
                if isinstance(value, float) and (math.isnan(value) or math.isinf(value)):
                    food_data[key] = None

            if existing_food:
                # Update existing food item
                for key, value in food_data.items():
                    setattr(existing_food, key.replace(' (kcal)', '_kcal').replace(' (g)', '_g').replace(' (mg)', '_mg').replace(' ', ''), value)
            else:
                # Add new food item
                new_food = FoodItem(
                    FoodName=food_data["FoodName"],
                    ServingSize=food_data["ServingSize"],
                    Calories_kcal=food_data["Calories_kcal"],
                    Protein_g=food_data["Protein_g"],
                    Carbohydrates_g=food_data["Carbohydrates_g"],
                    Fat_g=food_data["Fat_g"],
                    Sodium_mg=food_data["Sodium_mg"],
                    Fiber_g=food_data["Fiber_g"],
                )
                food_items_to_add.append(new_food)
        
        if food_items_to_add:
            db.add_all(food_items_to_add)
        db.commit()

        print("Foods data uploaded and processed successfully into SQLite.")
        return {"message": "Foods data uploaded and processed successfully.", "filename": file.filename}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error processing foods.xlsx: {e}")

@app.post("/api/upload-rda")
async def upload_rda(file: UploadFile = File(...), db: Session = Depends(get_db)):
    if not file.filename.endswith(('.xlsx', '.xls')):
        raise HTTPException(status_code=400, detail="Invalid file type. Please upload an Excel file (.xlsx or .xls).")
    try:
        content = await file.read()
        temp_df = pd.read_excel(io.BytesIO(content))

        if 'ProfileName' not in temp_df.columns:
            raise HTTPException(status_code=400, detail="Missing 'ProfileName' column in rda.xlsx.")

        rda_profiles_to_add = []
        for index, row in temp_df.iterrows():
            profile_name = row['ProfileName']
            existing_rda = db.query(RDAProfile).filter(RDAProfile.ProfileName == profile_name).first()

            rda_data = {
                "ProfileName": profile_name,
                "Calories_kcal": row.get('Calories (kcal)'),
                "Protein_g": row.get('Protein (g)'),
                "Carbohydrates_g": row.get('Carbohydrates (g)'),
                "Fat_g": row.get('Fat (g)'),
                "Sodium_mg": row.get('Sodium (mg)'),
                "Fiber_g": row.get('Fiber (g)'),
            }
            # Replace NaN with None for database
            for key, value in rda_data.items():
                if isinstance(value, float) and (math.isnan(value) or math.isinf(value)):
                    rda_data[key] = None

            if existing_rda:
                # Update existing RDA profile
                for key, value in rda_data.items():
                    setattr(existing_rda, key.replace(' (kcal)', '_kcal').replace(' (g)', '_g').replace(' (mg)', '_mg').replace(' ', ''), value)
            else:
                # Add new RDA profile
                new_rda = RDAProfile(
                    ProfileName=rda_data["ProfileName"],
                    Calories_kcal=rda_data["Calories_kcal"],
                    Protein_g=rda_data["Protein_g"],
                    Carbohydrates_g=rda_data["Carbohydrates_g"],
                    Fat_g=rda_data["Fat_g"],
                    Sodium_mg=rda_data["Sodium_mg"],
                    Fiber_g=rda_data["Fiber_g"],
                )
                rda_profiles_to_add.append(new_rda)
        
        if rda_profiles_to_add:
            db.add_all(rda_profiles_to_add)
        db.commit()

        print("RDA data uploaded and processed successfully into SQLite.")
        return {"message": "RDA data uploaded and processed successfully.", "filename": file.filename}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error processing rda.xlsx: {e}")

@app.get("/api/foods")
async def get_foods(db: Session = Depends(get_db)):
    foods = db.query(FoodItem).all()
    if not foods:
        raise HTTPException(status_code=404, detail="No food data available. Please upload foods.xlsx.")
    return [
        {
            "FoodName": food.FoodName,
            "ServingSize": food.ServingSize,
            "Calories (kcal)": food.Calories_kcal,
            "Protein (g)": food.Protein_g,
            "Carbohydrates (g)": food.Carbohydrates_g,
            "Fat (g)": food.Fat_g,
            "Sodium (mg)": food.Sodium_mg,
            "Fiber (g)": food.Fiber_g,
        }
        for food in foods
    ]

@app.get("/api/rda-profiles")
async def get_rda_profiles(db: Session = Depends(get_db)):
    rda_profiles = db.query(RDAProfile).all()
    if not rda_profiles:
        raise HTTPException(status_code=404, detail="No RDA data available. Please upload rda.xlsx.")
    return [profile.ProfileName for profile in rda_profiles]

@app.post("/api/calculate-nutrition")
async def calculate_nutrition(request: CalculateNutritionRequest, db: Session = Depends(get_db)):
    # Fetch all food items from the database once
    all_foods = {food.FoodName: food for food in db.query(FoodItem).all()}

    # Initialize total_nutrients with 0.0 for all known nutrient columns from FoodItem model
    # This assumes all FoodItem attributes ending with _kcal, _g, _mg are nutrients
    nutrient_cols = [
        "Calories_kcal", "Protein_g", "Carbohydrates_g", "Fat_g", "Sodium_mg", "Fiber_g"
    ]
    total_nutrients = {col: 0.0 for col in nutrient_cols}

    selected_menu_details = []

    for item in request.selected_foods:
        food_item = all_foods.get(item.food_name)
        if not food_item:
            raise HTTPException(status_code=404, detail=f"Food item '{item.food_name}' not found in foods data.")
        
        selected_menu_details.append({
            "food_name": item.food_name,
            "quantity": item.quantity,
            "serving_size": food_item.ServingSize
        })

        for nutrient_attr in nutrient_cols:
            food_nutrient_value = getattr(food_item, nutrient_attr, 0.0)
            if food_nutrient_value is None: # Treat None as 0 for calculation
                 food_nutrient_value = 0.0
            total_nutrients[nutrient_attr] += food_nutrient_value * item.quantity

    rda_profile = db.query(RDAProfile).filter(RDAProfile.ProfileName == request.rda_profile_name).first()
    if not rda_profile:
        raise HTTPException(status_code=404, detail=f"RDA profile '{request.rda_profile_name}' not found.")
    
    rda_targets = {
        "Calories_kcal": rda_profile.Calories_kcal,
        "Protein_g": rda_profile.Protein_g,
        "Carbohydrates_g": rda_profile.Carbohydrates_g,
        "Fat_g": rda_profile.Fat_g,
        "Sodium_mg": rda_profile.Sodium_mg,
        "Fiber_g": rda_profile.Fiber_g,
    }

    nutrient_comparison = {}
    for nutrient_attr in nutrient_cols:
        total_val = total_nutrients.get(nutrient_attr, 0.0)
        rda_val = rda_targets.get(nutrient_attr, None)

        if rda_val is None:
            nutrient_comparison[nutrient_attr] = None
        else:
            nutrient_comparison[nutrient_attr] = total_val - rda_val

    # Generate a simple summary
    summary_parts = []
    summary_parts.append(f"Selected menu provides: ")
    for nutrient_attr, value in total_nutrients.items():
        # Convert attribute name back to original format for display
        display_name = nutrient_attr.replace('_kcal', ' (kcal)').replace('_g', ' (g)').replace('_mg', ' (mg)')
        formatted_value = f"{value:.1f}" if value is not None else "N/A"
        summary_parts.append(f"{display_name}: {formatted_value}")
    
    summary_parts.append(f"\nCompared to {request.rda_profile_name} RDA: ")
    for nutrient_attr, rda_val in rda_targets.items():
        display_name = nutrient_attr.replace('_kcal', ' (kcal)').replace('_g', ' (g)').replace('_mg', ' (mg)')
        formatted_rda_val = f"{rda_val:.1f}" if rda_val is not None else "N/A"
        summary_parts.append(f"{display_name}: {formatted_rda_val}")
    
    summary_parts.append(f"\nDeficit/Excess: ")
    for nutrient_attr, diff in nutrient_comparison.items():
        display_name = nutrient_attr.replace('_kcal', ' (kcal)').replace('_g', ' (g)').replace('_mg', ' (mg)')
        if diff is not None:
            status = "excess" if diff > 0 else "deficit" if diff < 0 else "meets target"
            summary_parts.append(f"{display_name}: {abs(diff):.1f} ({status})")
        else:
            summary_parts.append(f"{display_name}: N/A (no RDA target)")

    final_summary = "; ".join(summary_parts)

    return {
        "selected_menu": selected_menu_details,
        "total_nutrients": total_nutrients,
        "rda_profile_name": request.rda_profile_name,
        "rda_targets": rda_targets,
        "nutrient_comparison": nutrient_comparison,
        "final_summary": final_summary
    }

@app.post("/api/ai-feedback")
async def ai_feedback(request: AIFeedbackRequest):
    try:
        model = genai.GenerativeModel('gemini-2.5-flash-preview-05-20')
        
        prompt = f"""
**Task:** You are a clinical nutritionist. Your task is to provide a two-part dietary analysis based on the data provided below.

**Part 1: Nutritional Analysis**

Analyze the "Nutritional Summary" and compare the "total_nutrients" to the "rda_targets".

- In a section titled "**Nutritional Analysis**", create a **numbered list** of your findings.
- For each nutrient, state whether it is within, above, or below the recommended target.
- Briefly explain the clinical significance of any major deviations.

**Part 2: Personalized Recommendations**

Based on your analysis in Part 1, and considering the patient's "Co-morbidities" and "Diet Preferences", provide actionable recommendations.

- In a section titled "**Personalized Recommendations**", create a **numbered list** of specific, prioritized dietary suggestions.
- Suggest concrete food choices and meal adjustments.

**Input Data:**

*   **Nutritional Summary:** {request.nutritional_summary}
*   **Patient Co-morbidities:** {request.co_morbidities}
*   **Diet Preferences:** {request.diet_preference}
"""
        
        response = model.generate_content(prompt)
        ai_feedback_text = response.text
        
        # Structure the raw AI output
        structured_ai_feedback = structure_output(ai_feedback_text)

        return {"ai_feedback": structured_ai_feedback}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error generating AI feedback: {e}")

@app.post("/api/send-to-kitchen")
async def send_to_kitchen(request: SendMealPlanRequest, db: Session = Depends(get_db)):
    try:
        new_meal_plan = MealPlan(patient_id=request.patient_id)
        db.add(new_meal_plan)
        db.commit()
        db.refresh(new_meal_plan)

        for category, items in request.meal_plan.items():
            for item_data in items:
                food_item = db.query(FoodItem).filter(FoodItem.FoodName == item_data.food_name).first()
                if not food_item:
                    raise HTTPException(status_code=404, detail=f"Food item '{item_data.food_name}' not found when creating meal plan.")
                
                new_meal_plan_item = MealPlanItem(
                    meal_plan_id=new_meal_plan.id,
                    food_item_id=food_item.id,
                    meal_category=category,
                    quantity=item_data.quantity
                )
                db.add(new_meal_plan_item)
        db.commit()

        print(f"Meal plan (ID: {new_meal_plan.id}) saved to database for kitchen dashboard.")
        return {"message": "Meal plan sent to kitchen dashboard successfully! (Saved to DB)"}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error saving meal plan to database: {e}")

@app.patch("/api/meal-plan-items/{item_id}")
async def update_meal_plan_item_status(item_id: int, request: UpdateMealPlanItemStatusRequest, db: Session = Depends(get_db)):
    meal_plan_item = db.query(MealPlanItem).filter(MealPlanItem.id == item_id).first()
    if not meal_plan_item:
        raise HTTPException(status_code=404, detail="Meal plan item not found.")

    if request.prepared is not None:
        meal_plan_item.prepared = request.prepared
    if request.delivered is not None:
        meal_plan_item.delivered = request.delivered
    
    db.commit()
    db.refresh(meal_plan_item)
    return {"message": "Meal plan item status updated successfully.", "item_id": item_id, "prepared": meal_plan_item.prepared, "delivered": meal_plan_item.delivered}

@app.get("/api/meal-plans")
async def get_meal_plans(date: Optional[str] = None, db: Session = Depends(get_db)):
    from sqlalchemy.orm import selectinload
    query = db.query(MealPlan).options(selectinload(MealPlan.items))
    if date:
        # Assuming timestamp is stored as ISO format string (e.g., "2023-10-27T10:00:00.000")
        # We need to filter by the date part only
        query = query.filter(MealPlan.timestamp.startswith(date))
    meal_plans = query.all()
    
    result = []
    for plan in meal_plans:
        plan_data = {
            "id": plan.id,
            "timestamp": plan.timestamp,
            "patient": {
                "id": plan.patient.id,
                "hospital_id": plan.patient.hospital_id,
                "name": plan.patient.name,
                "age": plan.patient.age,
                "sex": plan.patient.sex,
            } if plan.patient else None,
            "items": []
        }
        for item in plan.items:
            food_item = db.query(FoodItem).filter(FoodItem.id == item.food_item_id).first()
            plan_data["items"].append({
                "id": item.id, # Include item ID for frontend updates
                "meal_category": item.meal_category,
                "food_name": food_item.FoodName if food_item else "Unknown Food",
                "quantity": item.quantity,
                "prepared": item.prepared,
                "delivered": item.delivered
            })
        result.append(plan_data)
    return result

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
