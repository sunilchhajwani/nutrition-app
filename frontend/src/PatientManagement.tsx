import React, { useState, useEffect } from 'react';

const API_BASE_URL = 'http://localhost:8001/api';

interface Patient {
  id: number;
  hospital_id: string;
  name: string;
  age: number;
  sex: string;
}

function PatientManagement({ onPatientUpdate }: { onPatientUpdate: () => void }) {
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
        setForm({ hospital_id: '', name: '', age: 0, sex: '', id: undefined }); // Clear form and reset id
        onPatientUpdate(); // Call the prop to update patient list in App.tsx
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
        onPatientUpdate(); // Call the prop to update patient list in App.tsx
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
    <div style={{ maxWidth: '800px', margin: '20px auto', padding: '25px', backgroundColor: '#ffffff', borderRadius: '10px', boxShadow: '0 5px 15px rgba(0, 0, 0, 0.1)', textAlign: 'center' }}>
      <h2 style={{ color: '#333', marginBottom: '30px', fontSize: '2em' }}>Patient Management</h2>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '15px', marginBottom: '30px', padding: '20px', border: '1px solid #e0e0e0', borderRadius: '8px', backgroundColor: '#f9f9f9' }}>
        <div style={{ display: 'flex', gap: '15px', width: '100%' }}>
          <input type="text" placeholder="Hospital ID" value={form.hospital_id} onChange={e => setForm({ ...form, hospital_id: e.target.value })} required style={{ flex: 1, padding: '12px', border: '1px solid #ced4da', borderRadius: '5px', fontSize: '1em' }} />
          <input type="text" placeholder="Name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required style={{ flex: 1, padding: '12px', border: '1px solid #ced4da', borderRadius: '5px', fontSize: '1em' }} />
        </div>
        <div style={{ display: 'flex', gap: '15px', width: '100%' }}>
          <input type="number" placeholder="Age" value={form.age} onChange={e => setForm({ ...form, age: parseInt(e.target.value) })} required style={{ flex: 1, padding: '12px', border: '1px solid #ced4da', borderRadius: '5px', fontSize: '1em' }} />
          <input type="text" placeholder="Sex" value={form.sex} onChange={e => setForm({ ...form, sex: e.target.value })} required style={{ flex: 1, padding: '12px', border: '1px solid #ced4da', borderRadius: '5px', fontSize: '1em' }} />
        </div>
        <button type="submit" style={{ backgroundColor: '#007bff', color: 'white', padding: '12px 25px', border: 'none', borderRadius: '5px', fontSize: '1.1em', cursor: 'pointer', alignSelf: 'flex-end' }}>{form.id ? 'Update' : 'Add'} Patient</button>
      </form>
      <h3 style={{ color: '#555', marginTop: '40px', marginBottom: '20px', fontSize: '1.8em', borderBottom: '2px solid #eee', paddingBottom: '10px' }}>Patient List</h3>
      <ul style={{ listStyle: 'none', padding: '0' }}>
        {patients.map(p => (
          <li key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#fefefe', border: '1px solid #e9ecef', borderRadius: '8px', marginBottom: '15px', padding: '15px 20px', boxShadow: '0 2px 8px rgba(0, 0, 0, 0.05)' }}>
            <div style={{ textAlign: 'left', flexGrow: 1 }}>
              <span style={{ display: 'block', fontSize: '1.1em', color: '#333', marginBottom: '5px' }}><strong>{p.name}</strong> ({p.hospital_id})</span>
              <span style={{ display: 'block', fontSize: '0.9em', color: '#666' }}>Age: {p.age}, Sex: {p.sex}</span>
            </div>
            <div style={{ marginLeft: '10px' }}>
              <button onClick={() => handleEdit(p)} style={{ padding: '8px 15px', border: 'none', borderRadius: '5px', cursor: 'pointer', fontSize: '0.9em', marginLeft: '10px', backgroundColor: '#ffc107', color: '#333' }}>Edit</button>
              <button onClick={() => handleDelete(p.id)} style={{ padding: '8px 15px', border: 'none', borderRadius: '5px', cursor: 'pointer', fontSize: '0.9em', marginLeft: '10px', backgroundColor: '#dc3545', color: 'white' }}>Delete</button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default PatientManagement;

