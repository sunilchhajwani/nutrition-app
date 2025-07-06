import React, { useState, useEffect } from 'react';
import './App.css';

const API_BASE_URL = 'http://localhost:8001/api'; // Backend is running on port 8001

interface FoodItem {
  'FoodName': string;
  'ServingSize': string;
  'Calories (kcal)': number;
  'Protein (g)': number;
  'Carbohydrates (g)': number;
  'Fat (g)': number;
  'Sodium (mg)': number;
  'Fiber (g)': number;
}

interface SelectedFood {
  food_name: string;
  quantity: number;
}

interface CalculationResult {
  selected_menu: Array<{ food_name: string; quantity: number; serving_size: string }>;
  total_nutrients: { [key: string]: number };
  rda_profile_name: string;
  rda_targets: { [key: string]: number };
  nutrient_comparison: { [key: string]: number | null };
  final_summary: string;
}

interface ErrorResponse {
  detail: string;
}

function App() {
  const [foodsFile, setFoodsFile] = useState<File | null>(null);
  const [rdaFile, setRdaFile] = useState<File | null>(null);
  const [message, setMessage] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState<string>('');

  const [foods, setFoods] = useState<FoodItem[]>([]);
  const [rdaProfiles, setRdaProfiles] = useState<string[]>([]);
  const [selectedFoods, setSelectedFoods] = useState<SelectedFood[]>([]);
  const [selectedRdaProfile, setSelectedRdaProfile] = useState<string>('');
  const [calculationResult, setCalculationResult] = useState<CalculationResult | null>(null);
  const [coMorbidities, setCoMorbidities] = useState<string>('');
  const [aiFeedback, setAiFeedback] = useState<string>('');
  const [mealPlan, setMealPlan] = useState<{[key: string]: SelectedFood[]}>({ // New state for meal plan
    'Breakfast': [],
    'Lunch': [],
    'Dinner': [],
    'Morning Snacks': [],
    'Evening Snacks': [],
  });
  const mealCategories = ['Breakfast', 'Lunch', 'Dinner', 'Morning Snacks', 'Evening Snacks'];
  const [selectedMealCategory, setSelectedMealCategory] = useState<string>(mealCategories[0]); // Default to first category

  // --- Data Fetching --- //
  const filteredFoods = foods.filter(food =>
    food.FoodName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  useEffect(() => {
    const fetchFoods = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/foods`);
        if (response.ok) {
          const data: FoodItem[] = await response.json();
          setFoods(data);
        } else {
          console.error('Failed to fetch foods:', response.statusText);
        }
      } catch (error) {
        console.error('Network error fetching foods:', error);
      }
    };

    const fetchRdaProfiles = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/rda-profiles`);
        if (response.ok) {
          const data: string[] = await response.json();
          setRdaProfiles(data);
          if (data.length > 0) {
            setSelectedRdaProfile(data[0]); // Select first profile by default
          }
        } else {
          console.error('Failed to fetch RDA profiles:', response.statusText);
        }
      } catch (error) {
        console.error('Network error fetching RDA profiles:', error);
      }
    };

    fetchFoods();
    fetchRdaProfiles();
  }, []); // Run only once on component mount

  // --- File Upload Handlers --- //
  const handleFoodsFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      setFoodsFile(event.target.files[0]);
    }
  };

  const handleRdaFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      setRdaFile(event.target.files[0]);
    }
  };

  const uploadFile = async (file: File, endpoint: string) => {
    if (!file) {
      setMessage(`Please select a file for ${endpoint.split('/').pop()}.`);
      return;
    }

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch(`${API_BASE_URL}/${endpoint}`, {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (response.ok) {
        setMessage(`${file.name} uploaded successfully: ${data.message}`);
        // Re-fetch data after successful upload
        if (endpoint === 'upload-foods') {
          const foodsResponse = await fetch(`${API_BASE_URL}/foods`);
          if (foodsResponse.ok) setFoods(await foodsResponse.json());
        }
        if (endpoint === 'upload-rda') {
          const rdaResponse = await fetch(`${API_BASE_URL}/rda-profiles`);
          if (rdaResponse.ok) {
            const rdaData = await rdaResponse.json();
            setRdaProfiles(rdaData);
            if (rdaData.length > 0) setSelectedRdaProfile(rdaData[0]);
          }
        }
      } else {
        const errorData: ErrorResponse = data; // Cast to ErrorResponse
        setMessage(`Error uploading ${file.name}: ${errorData.detail || response.statusText}`);
      }
    } catch (error) {
      setMessage(`Network error uploading ${file.name}: ${error}`);
    }
  };

  // --- Menu Selection Handlers ---
  const handleFoodQuantityChange = (foodName: string, quantity: string) => {
    const qty = parseFloat(quantity);
    if (isNaN(qty) || qty < 0) return; // Prevent invalid quantities

    setSelectedFoods(prevSelectedFoods => {
      const existingIndex = prevSelectedFoods.findIndex(item => item.food_name === foodName);
      if (existingIndex > -1) {
        const updatedFoods = [...prevSelectedFoods];
        if (qty === 0) {
          updatedFoods.splice(existingIndex, 1); // Remove if quantity is 0
        } else {
          updatedFoods[existingIndex] = { ...updatedFoods[existingIndex], quantity: qty };
        }
        return updatedFoods;
      } else if (qty > 0) {
        return [...prevSelectedFoods, { food_name: foodName, quantity: qty }];
      }
      return prevSelectedFoods;
    });
  };

  const getSelectedFoodQuantity = (foodName: string) => {
    const food = selectedFoods.find(item => item.food_name === foodName);
    return food ? food.quantity : 0;
  };

  const handleAddToMeal = (foodName: string, quantity: number, mealCategory: string) => {
    if (quantity <= 0) {
      setMessage('Quantity must be greater than 0 to add to meal plan.');
      return;
    }

    setMealPlan(prevMealPlan => {
      const updatedCategoryFoods = [...prevMealPlan[mealCategory]];
      const existingIndex = updatedCategoryFoods.findIndex(item => item.food_name === foodName);

      if (existingIndex > -1) {
        updatedCategoryFoods[existingIndex] = { ...updatedCategoryFoods[existingIndex], quantity: quantity };
      } else {
        updatedCategoryFoods.push({ food_name: foodName, quantity: quantity });
      }

      return {
        ...prevMealPlan,
        [mealCategory]: updatedCategoryFoods,
      };
    });
    setMessage(`${quantity} of ${foodName} added to ${mealCategory}.`);
  };

  // --- Calculation Handler ---
  const handleCalculateNutrition = async () => {
    if (selectedFoods.length === 0) {
      setMessage('Please select some food items for the menu.');
      return;
    }
    if (!selectedRdaProfile) {
      setMessage('Please select an RDA profile.');
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/calculate-nutrition`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          selected_foods: selectedFoods,
          rda_profile_name: selectedRdaProfile,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setCalculationResult(data as CalculationResult); // Cast to CalculationResult
        setMessage('Nutritional calculation successful!');
      } else {
        const errorData: ErrorResponse = data; // Cast to ErrorResponse
        setMessage(`Error calculating nutrition: ${errorData.detail || response.statusText}`);
        setCalculationResult(null);
      }
    } catch (error) {
      setMessage(`Network error calculating nutrition: ${error}`);
      setCalculationResult(null);
    }
  };

  // --- AI Feedback Handler ---
  const handleGenerateAiFeedback = async () => {
    if (!calculationResult) {
      setMessage('Please perform a nutritional calculation first.');
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/ai-feedback`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          nutritional_summary: calculationResult.total_nutrients, // Sending total nutrients for AI context
          co_morbidities: coMorbidities,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setAiFeedback(data.ai_feedback);
        setMessage('AI feedback generated successfully!');
      } else {
        const errorData: ErrorResponse = data; // Cast to ErrorResponse
        setMessage(`Error generating AI feedback: ${errorData.detail || response.statusText}`);
        setAiFeedback('');
      }
    } catch (error) {
      setMessage(`Network error generating AI feedback: ${error}`);
      setAiFeedback('');
    }
  };

  return (
    <div className="App">
      <header className="App-header">
        <h1>Simran Nutrition App</h1>
      </header>
      <main className="App-main">
        <section className="file-upload-section">
          <h2>Upload Data Files</h2>
          <div className="upload-item">
            <label htmlFor="foods-file">Foods Data (foods.xlsx):</label>
            <input type="file" id="foods-.xlsx, .xls" onChange={handleFoodsFileChange} />
            <button onClick={() => uploadFile(foodsFile!, 'upload-foods')}>Upload Foods</button>
          </div>
          <div className="upload-item">
            <label htmlFor="rda-file">RDA Data (rda.xlsx):</label>
            <input type="file" id="rda-file" accept=".xlsx, .xls" onChange={handleRdaFileChange} />
            <button onClick={() => uploadFile(rdaFile!, 'upload-rda')}>Upload RDA</button>
          </div>
          {message && <p className="message">{message}</p>}
        </section>

        <section className="menu-planning-section">
          <h2>Menu Planning</h2>
          <div className="rda-profile-selection">
            <label htmlFor="rda-profile">Select RDA Profile:</label>
            <select
              id="rda-profile"
              value={selectedRdaProfile}
              onChange={(e) => setSelectedRdaProfile(e.target.value)}
            >
              {rdaProfiles.map(profile => (
                <option key={profile} value={profile}>{profile}</option>
              ))}
            </select>
          </div>

          <h3>Available Foods</h3>
          <div className="search-bar">
            <input
              type="text"
              placeholder="Search food items..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="food-list">
            {filteredFoods.length > 0 ? (
              filteredFoods.map(food => (
                <div key={food.FoodName} className="food-item">
                  <span>{food.FoodName} ({food.ServingSize})</span>
                  <input
                    type="number"
                    min="0"
                    step="0.1"
                    value={getSelectedFoodQuantity(food.FoodName)}
                    onChange={(e) => handleFoodQuantityChange(food.FoodName, e.target.value)}
                    placeholder="Quantity"
                  />
                  <select
                    value={selectedMealCategory}
                    onChange={(e) => setSelectedMealCategory(e.target.value)}
                  >
                    {mealCategories.map(category => (
                      <option key={category} value={category}>{category}</option>
                    ))}
                  </select>
                  <button onClick={() => handleAddToMeal(food.FoodName, getSelectedFoodQuantity(food.FoodName), selectedMealCategory)}>
                    Add to Meal
                  </button>
                </div>
              ))
            ) : (
              <p>No food data available or no items match your search. Please upload foods.xlsx.</p>
            )}
          </div>
          <button onClick={handleCalculateNutrition} className="calculate-button">
            Calculate Nutrition
          </button>
        </section>

        <section className="meal-plan-section">
          <h2>Your Meal Plan</h2>
          {mealCategories.map(category => (
            <div key={category} className="meal-category">
              <h3>{category}</h3>
              {mealPlan[category].length > 0 ? (
                <ul>
                  {mealPlan[category].map((item, index) => (
                    <li key={index}>{item.food_name}: {item.quantity}</li>
                  ))}
                </ul>
              ) : (
                <p>No items added to {category}.</p>
              )}
            </div>
          ))}
        </section>

        {calculationResult && (
          <section className="calculation-results-section">
            <h2>Nutritional Analysis</h2>
            <h3>Selected Menu:</h3>
            <ul>
              {calculationResult.selected_menu.map((item, index) => (
                <li key={index}>{item.food_name}: {item.quantity} {item.serving_size}</li>
              ))}
            </ul>

            <h3>Total Nutrients:</h3>
            <table>
              <thead>
                <tr>
                  <th>Nutrient</th>
                  <th>Amount</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(calculationResult.total_nutrients).map(([nutrient, amount]) => (
                  <tr key={nutrient}>
                    <td>{nutrient}</td>
                    <td>{amount !== null ? amount.toFixed(2) : 'N/A'}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <h3>RDA Targets ({calculationResult.rda_profile_name}):</h3>
            <table>
              <thead>
                <tr>
                  <th>Nutrient</th>
                  <th>Target</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(calculationResult.rda_targets).map(([nutrient, target]) => (
                  <tr key={nutrient}>
                    <td>{nutrient}</td>
                    <td>{target !== null ? target.toFixed(2) : 'N/A'}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <h3>Deficit/Excess:</h3>
            <table>
              <thead>
                <tr>
                  <th>Nutrient</th>
                  <th>Difference</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(calculationResult.nutrient_comparison).map(([nutrient, diff]) => (
                  <tr key={nutrient} className={diff !== null ? (diff < 0 ? 'deficit' : 'excess') : ''}>
                    <td>{nutrient}</td>
                    <td>{diff !== null ? diff.toFixed(2) : 'N/A'}</td>
                    <td>
                      {diff !== null
                        ? (diff < 0 ? 'Deficit' : (diff > 0 ? 'Excess' : 'Meets Target'))
                        : 'N/A'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <h3>Summary:</h3>
            <p>{calculationResult.final_summary}</p>
          </section>
        )}

        <section className="ai-feedback-section">
          <h2>AI Feedback</h2>
          <div className="co-morbidities-input">
            <label htmlFor="co-morbidities">Patient Co-morbidities/Associated Conditions:</label>
            <textarea
              id="co-morbidities"
              rows={5}
              value={coMorbidities}
              onChange={(e) => setCoMorbidities(e.target.value)}
              placeholder="e.g., Diabetes, Hypertension, Renal Failure, Post-operative recovery..."
            ></textarea>
          </div>
          <button onClick={handleGenerateAiFeedback} className="ai-button">
            Generate AI Feedback
          </button>
          {aiFeedback && (
            <div className="ai-output">
              <h3>AI Recommendations:</h3>
              <p>{aiFeedback}</p>
            </div>
          )}
        </section>

      </main>
    </div>
  );
}

export default App;