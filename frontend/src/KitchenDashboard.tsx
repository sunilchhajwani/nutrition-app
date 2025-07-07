import React, { useState, useEffect, useMemo } from 'react';

const API_BASE_URL = 'http://localhost:8001/api';

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
  patient: {
    id: number;
    hospital_id: string;
    name: string;
    age: number;
    sex: string;
  } | null;
  items: MealPlanItem[];
}

const DashboardSummary = ({ mealPlans }: { mealPlans: MealPlan[] }) => {
  const [showAllPrepared, setShowAllPrepared] = useState(false);
  const [showAllDelivered, setShowAllDelivered] = useState(false);
  const [showAllUnprepared, setShowAllUnprepared] = useState(false);
  const [showAllNotDelivered, setShowAllNotDelivered] = useState(false);

  const summary = useMemo(() => {
    const preparedItems = mealPlans.flatMap(plan =>
      plan.items
        .filter(item => item.prepared)
        .map(item => ({
          planId: plan.id,
          mealCategory: item.meal_category,
          foodName: item.food_name,
        }))
    );

    const deliveredItems = mealPlans.flatMap(plan =>
      plan.items
        .filter(item => item.delivered)
        .map(item => ({
          planId: plan.id,
          mealCategory: item.meal_category,
          foodName: item.food_name,
        }))
    );

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
      preparedItems,
      deliveredItems,
      unpreparedItems,
      notDeliveredItems,
    };
  }, [mealPlans]);

  const renderItems = (items: any[], showAll: boolean, toggleShowAll: () => void) => {
    const displayItems = showAll ? items : items.slice(0, 5);
    return (
      <>
        {displayItems.length > 0 ? (
          <ul>
            {displayItems.map((item, index) => (
              <li key={index}>
                Meal ID: {item.planId} - {item.mealCategory} - {item.foodName}
              </li>
            ))}
          </ul>
        ) : (
          <p>None</p>
        )}
        {items.length > 5 && (
          <button onClick={toggleShowAll} style={{ marginTop: '5px' }}>
            {showAll ? 'Show Less' : 'Show More'}
          </button>
        )}
      </>
    );
  };

  return (
    <div className="dashboard-summary" style={{ marginBottom: '20px', padding: '15px', border: '1px solid #ccc', borderRadius: '5px' }}>
      <h3>Summary</h3>
      <details open>
        <summary style={{ color: 'green', cursor: 'pointer' }}>
          <strong>Prepared Items ({summary.preparedItems.length})</strong>
        </summary>
        {renderItems(summary.preparedItems, showAllPrepared, () => setShowAllPrepared(!showAllPrepared))}
      </details>
      <details open>
        <summary style={{ color: 'green', cursor: 'pointer' }}>
          <strong>Delivered Items ({summary.deliveredItems.length})</strong>
        </summary>
        {renderItems(summary.deliveredItems, showAllDelivered, () => setShowAllDelivered(!showAllDelivered))}
      </details>
      <details open>
        <summary style={{ color: 'red', cursor: 'pointer' }}>
          <strong>Unprepared Items ({summary.unpreparedItems.length})</strong>
        </summary>
        {renderItems(summary.unpreparedItems, showAllUnprepared, () => setShowAllUnprepared(!showAllUnprepared))}
      </details>
      <details open>
        <summary style={{ color: 'red', cursor: 'pointer' }}>
          <strong>Not Delivered Items ({summary.notDeliveredItems.length})</strong>
        </summary>
        {renderItems(summary.notDeliveredItems, showAllNotDelivered, () => setShowAllNotDelivered(!showAllNotDelivered))}
      </details>
    </div>
  );
};

export default function KitchenDashboard() {
  const [mealPlans, setMealPlans] = useState<MealPlan[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]); // Default to today's date
  const [displayMode, setDisplayMode] = useState<'patientView' | 'timeView'>('patientView'); // New state for display mode

  const groupedMealItems = useMemo(() => {
    const grouped: { [key: string]: (MealPlanItem & { patientName: string; patientHospitalId: string })[] } = {};
    mealPlans.forEach(plan => {
      if (plan.patient) {
        plan.items.forEach(item => {
          if (!grouped[item.meal_category]) {
            grouped[item.meal_category] = [];
          }
          grouped[item.meal_category].push({
            ...item,
            patientName: plan.patient!.name,
            patientHospitalId: plan.patient!.hospital_id,
          });
        });
      }
    });
    return grouped;
  }, [mealPlans]);

  const handleStatusChange = async (itemId: number, type: 'prepared' | 'delivered', newStatus: boolean) => {
    try {
      const token = localStorage.getItem('authToken');
      const authHeaders: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (token) {
        authHeaders['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch(`${API_BASE_URL}/meal-plan-items/${itemId}`, {
        method: 'PATCH',
        headers: authHeaders,
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
        const errorData = await response.json();
        setError(`Failed to update status for item ${itemId}: ${errorData.detail || response.statusText}`);
      }
    } catch (err: any) {
      setError(`Network error updating status: ${err.message || err}`);
    }
  };

  useEffect(() => {
    const fetchMealPlans = async () => {
      const token = localStorage.getItem('authToken');
    const authHeaders: Record<string, string> = {};
    if (token) {
      authHeaders['Authorization'] = `Bearer ${token}`;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/meal-plans?date=${selectedDate}`, { headers: authHeaders });
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
  }, [selectedDate]); // Re-fetch when selectedDate changes

  if (loading) {
    return <div className="kitchen-dashboard">Loading meal plans...</div>;
  }

  if (error) {
    return <div className="kitchen-dashboard error">Error: {error}</div>;
  }

  return (
    <div className="kitchen-dashboard">
      <h2>Kitchen Dashboard - All Meal Plans</h2>
      <div className="date-filter">
        <label htmlFor="meal-date">Select Date:</label>
        <input
          type="date"
          id="meal-date"
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
        />
      </div>
      <DashboardSummary mealPlans={mealPlans} />

      <div className="display-mode-toggle">
        <button
          className={displayMode === 'patientView' ? 'active' : ''}
          onClick={() => setDisplayMode('patientView')}
        >
          View by Patient
        </button>
        <button
          className={displayMode === 'timeView' ? 'active' : ''}
          onClick={() => setDisplayMode('timeView')}
        >
          View by Time (Meal Category)
        </button>
      </div>

      {displayMode === 'patientView' && (
        <div className="meal-plans-list">
          {mealPlans.length === 0 ? (
            <p>No meal plans available yet.</p>
          ) : (
            <>
              {mealPlans.map(plan => (
                <div key={plan.id} className={`meal-plan-card ${plan.items.every(item => item.prepared && item.delivered) ? 'meal-plan-complete' : 'meal-plan-pending'}`}>
                  <h3>Meal Plan ID: {plan.id}</h3>
                  <p>Date: {new Date(plan.timestamp).toLocaleString()}</p>
                  {plan.patient && (
                    <div className="patient-details">
                      <h4>Patient: {plan.patient.name} ({plan.patient.hospital_id})</h4>
                      <p>Age: {plan.patient.age}, Sex: {plan.patient.sex}</p>
                    </div>
                  )}
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
            </>
          )}
        </div>
      )}

      {displayMode === 'timeView' && (
        <div className="time-wise-view">
          {mealPlans.length === 0 ? (
            <p>No meal plans available for the selected date.</p>
          ) : (
            <>
              {Object.entries(groupedMealItems).map(([category, items]) => (
                <div key={category} className="meal-category-section">
                  <h3>{category}</h3>
                  <ul>
                    {items.map(item => (
                      <li key={item.id}>
                        {item.food_name}: {item.quantity} (Patient: {item.patientName}, ID: {item.patientHospitalId})
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
            </>
          )}
        </div>
      )}
    </div>
  );
}