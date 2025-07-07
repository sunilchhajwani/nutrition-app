[33mcommit f09c7f219d2fc08009b5d15a45f9c406b8db432e[m[33m ([m[1;36mHEAD[m[33m -> [m[1;32mmaster[m[33m)[m
Author: Your <you@example.com>
Date:   Sun Jul 6 22:24:53 2025 +0530

    feat: kitchen dashboard, meal selection, meal uploading, meal calculation successful

[1mdiff --git a/backend/__pycache__/app.cpython-312.pyc b/backend/__pycache__/app.cpython-312.pyc[m
[1mindex 63c3ff5..69a7489 100644[m
Binary files a/backend/__pycache__/app.cpython-312.pyc and b/backend/__pycache__/app.cpython-312.pyc differ
[1mdiff --git a/backend/app.py b/backend/app.py[m
[1mindex 30e3078..e442431 100644[m
[1m--- a/backend/app.py[m
[1m+++ b/backend/app.py[m
[36m@@ -1,12 +1,15 @@[m
[31m-from fastapi import FastAPI, HTTPException, UploadFile, File[m
[32m+[m[32mfrom fastapi import FastAPI, HTTPException, UploadFile, File, Depends[m
 from fastapi.middleware.cors import CORSMiddleware[m
 from pydantic import BaseModel[m
 import pandas as pd[m
 import io[m
 import os[m
 import math[m
[31m-import numpy as np # Import numpy[m
[31m-# import google.generativeai as genai # Uncomment this line when integrating actual Gemini API[m
[32m+[m[32mimport numpy as np[m
[32m+[m[32mfrom sqlalchemy import create_engine, Column, Integer, String, Float, ForeignKey[m
[32m+[m[32mfrom sqlalchemy.ext.declarative import declarative_base[m
[32m+[m[32mfrom sqlalchemy.orm import sessionmaker, relationship, Session[m
[32m+[m[32mfrom datetime import datetime[m
 [m
 app = FastAPI()[m
 [m
[36m@@ -19,12 +22,67 @@[m [mapp.add_middleware([m
     allow_headers=["*"],[m
 )[m
 [m
[31m-DATA_DIR = os.path.join(os.path.dirname(__file__), "data")[m
[31m-FOODS_FILE = os.path.join(DATA_DIR, "foods.xlsx")[m
[31m-RDA_FILE = os.path.join(DATA_DIR, "rda.xlsx")[m
[31m-[m
[31m-foods_df: pd.DataFrame = None[m
[31m-rda_df: pd.DataFrame = None[m
[32m+[m[32m# --- SQLAlchemy Setup ---[m
[32m+[m[32mDATABASE_URL = "sqlite:///./nutrition.db"[m
[32m+[m[32mengine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})[m
[32m+[m[32mSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)[m
[32m+[m[32mBase = declarative_base()[m
[32m+[m
[32m+[m[32m# --- Database Models ---[m
[32m+[m[32mclass FoodItem(Base):[m
[32m+[m[32m    __tablename__ = "food_items"[m
[32m+[m[32m    id = Column(Integer, primary_key=True, index=True)[m
[32m+[m[32m    FoodName = Column(String, unique=True, index=True)[m
[32m+[m[32m    ServingSize = Column(String)[m
[32m+[m[32m    Calories_kcal = Column(Float)[m
[32m+[m[32m    Protein_g = Column(Float)[m
[32m+[m[32m    Carbohydrates_g = Column(Float)[m
[32m+[m[32m    Fat_g = Column(Float)[m
[32m+[m[32m    Sodium_mg = Column(Float)[m
[32m+[m[32m    Fiber_g = Column(Float)[m
[32m+[m
[32m+[m[32m    # Relationship to MealPlanItem[m
[32m+[m[32m    meal_plan_items = relationship("MealPlanItem", back_populates="food_item")[m
[32m+[m
[32m+[m[32mclass RDAProfile(Base):[m
[32m+[m[32m    __tablename__ = "rda_profiles"[m
[32m+[m[32m    id = Column(Integer, primary_key=True, index=True)[m
[32m+[m[32m    ProfileName = Column(String, unique=True, index=True)[m
[32m+[m[32m    # Dynamically add nutrient columns based on foods.xlsx[m
[32m+[m[32m    # For now, hardcode common ones, will handle dynamic later if needed[m
[32m+[m[32m    Calories_kcal = Column(Float, nullable=True)[m
[32m+[m[32m    Protein_g = Column(Float, nullable=True)[m
[32m+[m[32m    Carbohydrates_g = Column(Float, nullable=True)[m
[32m+[m[32m    Fat_g = Column(Float, nullable=True)[m
[32m+[m[32m    Sodium_mg = Column(Float, nullable=True)[m
[32m+[m[32m    Fiber_g = Column(Float, nullable=True)[m
[32m+[m
[32m+[m[32mclass MealPlan(Base):[m
[32m+[m[32m    __tablename__ = "meal_plans"[m
[32m+[m[32m    id = Column(Integer, primary_key=True, index=True)[m
[32m+[m[32m    timestamp = Column(String, default=lambda: datetime.now().isoformat()) # Store as ISO format string[m
[32m+[m[32m    # Add other fields like dietician_id, patient_id if multi-user is implemented[m
[32m+[m
[32m+[m[32m    items = relationship("MealPlanItem", back_populates="meal_plan")[m
[32m+[m
[32m+[m[32mclass MealPlanItem(Base):[m
[32m+[m[32m    __tablename__ = "meal_plan_items"[m
[32m+[m[32m    id = Column(Integer, primary_key=True, index=True)[m
[32m+[m[32m    meal_plan_id = Column(Integer, ForeignKey("meal_plans.id"))[m
[32m+[m[32m    food_item_id = Column(Integer, ForeignKey("food_items.id"))[m
[32m+[m[32m    meal_category = Column(String) # Breakfast, Lunch, Dinner, etc.[m
[32m+[m[32m    quantity = Column(Float)[m
[32m+[m
[32m+[m[32m    meal_plan = relationship("MealPlan", back_populates="items")[m
[32m+[m[32m    food_item = relationship("FoodItem", back_populates="meal_plan_items")[m
[32m+[m
[32m+[m[32m# Dependency to get the database session[m
[32m+[m[32mdef get_db():[m
[32m+[m[32m    db = SessionLocal()[m
[32m+[m[32m    try:[m
[32m+[m[32m        yield db[m
[32m+[m[32m    finally:[m
[32m+[m[32m        db.close()[m
 [m
 # --- Pydantic Models for Request Bodies ---[m
 class FoodSelection(BaseModel):[m
[36m@@ -39,53 +97,16 @@[m [mclass AIFeedbackRequest(BaseModel):[m
     nutritional_summary: dict  # This will contain total_nutrients, nutrient_comparison etc.[m
     co_morbidities: str[m
 [m
[31m-class MealPlanItem(BaseModel):[m
[32m+[m[32mclass MealPlanItemRequest(BaseModel):[m
     food_name: str[m
     quantity: float[m
 [m
 class SendMealPlanRequest(BaseModel):[m
[31m-    meal_plan: dict[str, list[MealPlanItem]] # e.g., {"Breakfast": [{"food_name": "Egg", "quantity": 2}]}[m
[31m-[m
[31m-# --- Data Loading and Persistence ---[m
[31m-def load_data():[m
[31m-    global foods_df, rda_df[m
[31m-    try:[m
[31m-        if os.path.exists(FOODS_FILE):[m
[31m-            foods_df = pd.read_excel(FOODS_FILE)[m
[31m-            # Convert all columns except 'FoodName', 'ServingSize' to numeric, coercing errors[m
[31m-            food_nutrient_cols = [col for col in foods_df.columns if col not in ['FoodName', 'ServingSize']][m
[31m-            for col in food_nutrient_cols:[m
[31m-                # Remove '<' character before converting to numeric[m
[31m-                foods_df[col] = foods_df[col].astype(str).str.replace('<', '', regex=False)[m
[31m-                foods_df[col] = pd.to_numeric(foods_df[col], errors='coerce')[m
[31m-            # Replace NaN/inf with None in numeric columns[m
[31m-            foods_df[food_nutrient_cols] = foods_df[food_nutrient_cols].replace([np.nan, np.inf, -np.inf], None)[m
[31m-            print("foods.xlsx loaded from disk.")[m
[31m-        else:[m
[31m-            print("foods.xlsx not found on disk. Will start with empty food data.")[m
[31m-[m
[31m-        if os.path.exists(RDA_FILE):[m
[31m-            rda_df = pd.read_excel(RDA_FILE)[m
[31m-            # Get all columns except 'ProfileName' and convert them to numeric[m
[31m-            cols_to_convert = [col for col in rda_df.columns if col != 'ProfileName'][m
[31m-            for col in cols_to_convert:[m
[31m-                # Remove '<' character before converting to numeric[m
[31m-                rda_df[col] = rda_df[col].astype(str).str.replace('<', '', regex=False)[m
[31m-                rda_df[col] = pd.to_numeric(rda_df[col], errors='coerce')[m
[31m-            # Replace NaN/inf with None in numeric columns[m
[31m-            rda_df[cols_to_convert] = rda_df[cols_to_convert].replace([np.nan, np.inf, -np.inf], None)[m
[31m-            print("rda.xlsx loaded from disk.")[m
[31m-        else:[m
[31m-            print("rda.xlsx not found on disk. Will start with empty RDA data.")[m
[31m-[m
[31m-    except Exception as e:[m
[31m-        print(f"An error occurred while loading data from disk: {e}")[m
[31m-        foods_df = None[m
[31m-        rda_df = None[m
[32m+[m[32m    meal_plan: dict[str, list[MealPlanItemRequest]] # e.g., {"Breakfast": [{"food_name": "Egg", 