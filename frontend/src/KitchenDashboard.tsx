import React, { useState, useEffect } from 'react';

const API_BASE_URL = 'http://localhost:8000/api';

interface MealPlanItem {
  meal_category: string;
  food_name: string;
  quantity: number;
}

interface MealPlan {
  id: number;
  timestamp: string;
  items: MealPlanItem[];
}

function KitchenDashboard() {
  const [mealPlans, setMealPlans] = useState<MealPlan[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchMealPlans = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/meal-plans`);
        if (response.ok) {
          const data: MealPlan[] = await response.json();
          setMealPlans(data);
        } else {
          setError(`Failed to fetch meal plans: ${response.statusText}`);
        }
      } catch (err) {
        setError(`Network error fetching meal plans: ${err}`);
      } finally {
        setLoading(false);
      }
    };

    fetchMealPlans();
  }, []);

  if (loading) {
    return <div className="kitchen-dashboard">Loading meal plans...</div>;
  }

  if (error) {
    return <div className="kitchen-dashboard error">Error: {error}</div>;
  }

  return (
    <div className="kitchen-dashboard">
      <h2>Kitchen Dashboard - All Meal Plans</h2>
      {mealPlans.length === 0 ? (
        <p>No meal plans available yet.</p>
      ) : (
        <div className="meal-plans-list">
          {mealPlans.map(plan => (
            <div key={plan.id} className="meal-plan-card">
              <h3>Meal Plan ID: {plan.id}</h3>
              <p>Date: {new Date(plan.timestamp).toLocaleString()}</p>
              <div className="meal-plan-items">
                {Object.entries(
                  plan.items.reduce((acc, item) => {
                    (acc[item.meal_category] = acc[item.meal_category] || []).push(item);
                    return acc;
                  }, {} as {[key: string]: MealPlanItem[]})
                ).map(([category, items]) => (
                  <div key={category} className="meal-category-display">
                    <h4>{category}</h4>
                    <ul>
                      {items.map((item, index) => (
                        <li key={index}>{item.food_name}: {item.quantity}</li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default KitchenDashboard;
