import React, { useState, useEffect, useMemo } from 'react';

const API_BASE_URL = 'http://localhost:8000/api';

interface MealPlanItem {
  id: number;
  meal_category: string;
  food_name: string;
  quantity: number;
  prepared: boolean;
  delivered: boolean;
}

interface MealPlan {
  id: number;
  timestamp: string;
  items: MealPlanItem[];
}

const DashboardSummary = ({ mealPlans }: { mealPlans: MealPlan[] }) => {
  const summary = useMemo(() => {
    const preparedMealIds = mealPlans
      .filter(plan => plan.items.length > 0 && plan.items.every(item => item.prepared))
      .map(plan => plan.id);

    const deliveredMealIds = mealPlans
      .filter(plan => plan.items.length > 0 && plan.items.every(item => item.delivered))
      .map(plan => plan.id);

    const unpreparedItems = mealPlans.flatMap(plan =>
      plan.items
        .filter(item => !item.prepared)
        .map(item => ({
          planId: plan.id,
          mealCategory: item.meal_category,
          foodName: item.food_name,
        }))
    );

    const notDeliveredItems = mealPlans.flatMap(plan =>
      plan.items
        .filter(item => !item.delivered)
        .map(item => ({
          planId: plan.id,
          mealCategory: item.meal_category,
          foodName: item.food_name,
        }))
    );

    return {
      preparedMealIds,
      deliveredMealIds,
      unpreparedItems,
      notDeliveredItems,
    };
  }, [mealPlans]);

  return (
    <div className="dashboard-summary" style={{ marginBottom: '20px', padding: '15px', border: '1px solid #ccc', borderRadius: '5px' }}>
      <h3>Summary</h3>
      <div><strong>Prepared Meal IDs:</strong> {summary.preparedMealIds.join(', ') || 'None'}</div>
      <div><strong>Delivered Meal IDs:</strong> {summary.deliveredMealIds.join(', ') || 'None'}</div>
      <div>
        <strong>Unprepared Items:</strong>
        {summary.unpreparedItems.length > 0 ? (
          <ul>
            {summary.unpreparedItems.map((item, index) => (
              <li key={index}>
                Meal ID: {item.planId} - {item.mealCategory} - {item.foodName}
              </li>
            ))}
          </ul>
        ) : (
          <span> None</span>
        )}
      </div>
      <div>
        <strong>Not Delivered Items:</strong>
        {summary.notDeliveredItems.length > 0 ? (
          <ul>
            {summary.notDeliveredItems.map((item, index) => (
              <li key={index}>
                Meal ID: {item.planId} - {item.mealCategory} - {item.foodName}
              </li>
            ))}
          </ul>
        ) : (
          <span> None</span>
        )}
      </div>
    </div>
  );
};

function KitchenDashboard() {
  const [mealPlans, setMealPlans] = useState<MealPlan[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const handleStatusChange = async (itemId: number, type: 'prepared' | 'delivered', newStatus: boolean) => {
    try {
      const response = await fetch(`${API_BASE_URL}/meal-plan-items/${itemId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ [type]: newStatus }),
      });

      if (response.ok) {
        setMealPlans(prevPlans =>
          prevPlans.map(plan => ({
            ...plan,
            items: plan.items.map(item =>
              item.id === itemId ? { ...item, [type]: newStatus } : item
            ),
          }))
        );
      } else {
        setError(`Failed to update status for item ${itemId}: ${response.statusText}`);
      }
    } catch (err) {
      setError(`Network error updating status: ${err}`);
    }
  };

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
      <DashboardSummary mealPlans={mealPlans} />
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
                      {items.map(item => (
                        <li key={item.id}>
                          {item.food_name}: {item.quantity}
                          <label style={{ marginLeft: '10px' }}>
                            <input
                              type="checkbox"
                              checked={item.prepared}
                              onChange={(e) => handleStatusChange(item.id, 'prepared', e.target.checked)}
                            />
                            Prepared
                          </label>
                          <label style={{ marginLeft: '10px' }}>
                            <input
                              type="checkbox"
                              checked={item.delivered}
                              onChange={(e) => handleStatusChange(item.id, 'delivered', e.target.checked)}
                            />
                            Delivered
                          </label>
                        </li>
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
