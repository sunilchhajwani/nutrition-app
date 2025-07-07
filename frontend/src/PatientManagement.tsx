import React, { useState, useEffect } from 'react';

const API_BASE_URL = 'http://localhost:8001/api';

interface Patient {
  id: number;
  hospital_id: string;
  name: string;
  age: number;
  sex: string;
}

function PatientManagement() {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<Omit<Patient, 'id'> & { id?: number }>({ hospital_id: '', name: '', age: 0, sex: '' });

  const token = localStorage.getItem('authToken');
  const authHeaders: Record<string, string> = {};
  if (token) {
    authHeaders['Authorization'] = `Bearer ${token}`;
  }

  const fetchPatients = async () => {
    const token = localStorage.getItem('authToken');
    const authHeaders: Record<string, string> = {};
    if (token) {
      authHeaders['Authorization'] = `Bearer ${token}`;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/patients`, { headers: authHeaders });
      if (response.ok) {
        const data: Patient[] = await response.json();
        setPatients(data);
      } else {
        setError(`Failed to fetch patients: ${response.statusText}`);
      }
    } catch (err) {
      setError(`Network error fetching patients: ${err}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPatients();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const url = form.id ? `${API_BASE_URL}/patients/${form.id}` : `${API_BASE_URL}/patients`;
    const method = form.id ? 'PUT' : 'POST';

    try {
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify(form),
      });

      if (response.ok) {
        setForm({ hospital_id: '', name: '', age: 0, sex: '' });
        fetchPatients();
      } else {
        setError(`Failed to save patient: ${response.statusText}`);
      }
    } catch (err) {
      setError(`Network error saving patient: ${err}`);
    }
  };

  const handleEdit = (patient: Patient) => {
    setForm(patient);
  };

  const handleDelete = async (id: number) => {
    const token = localStorage.getItem('authToken');
    const authHeaders: Record<string, string> = {};
    if (token) {
      authHeaders['Authorization'] = `Bearer ${token}`;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/patients/${id}`, { method: 'DELETE', headers: authHeaders });
      if (response.ok) {
        fetchPatients();
      } else {
        setError(`Failed to delete patient: ${response.statusText}`);
      }
    } catch (err) {
      setError(`Network error deleting patient: ${err}`);
    }
  };

  if (loading) {
    return <div>Loading patients...</div>;
  }

  if (error) {
    return <div className="error">Error: {error}</div>;
  }

  return (
    <div>
      <h2>Patient Management</h2>
      <form onSubmit={handleSubmit}>
        <input type="text" placeholder="Hospital ID" value={form.hospital_id} onChange={e => setForm({ ...form, hospital_id: e.target.value })} required />
        <input type="text" placeholder="Name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required />
        <input type="number" placeholder="Age" value={form.age} onChange={e => setForm({ ...form, age: parseInt(e.target.value) })} required />
        <input type="text" placeholder="Sex" value={form.sex} onChange={e => setForm({ ...form, sex: e.target.value })} required />
        <button type="submit">{form.id ? 'Update' : 'Add'} Patient</button>
      </form>
      <h3>Patient List</h3>
      <ul>
        {patients.map(p => (
          <li key={p.id}>
            {p.name} ({p.hospital_id}) - {p.age}, {p.sex}
            <button onClick={() => handleEdit(p)}>Edit</button>
            <button onClick={() => handleDelete(p.id)}>Delete</button>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default PatientManagement;
