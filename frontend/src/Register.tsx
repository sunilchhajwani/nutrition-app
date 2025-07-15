import React, { useState } from 'react';

interface RegisterProps {
  onRegisterSuccess: () => void;
}

const API_BASE_URL = 'http://localhost:8001/api';

const Register: React.FC<RegisterProps> = ({ onRegisterSuccess }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('dietician'); // Default role
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setMessage(null);

    try {
      const response = await fetch(`${API_BASE_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password, role }),
      });

      if (response.ok) {
        setMessage('Registration successful! You can now log in.');
        setUsername('');
        setPassword('');
        setRole('dietician');
        onRegisterSuccess();
      } else {
        const errorData = await response.json();
        if (typeof errorData.detail === 'string') {
          setError(errorData.detail);
        } else if (Array.isArray(errorData.detail)) {
          setError(errorData.detail.map((err: any) => err.msg).join(', '));
        } else {
          setError('Registration failed');
        }
      }
    } catch (err) {
      setError('Network error during registration.');
      console.error('Registration network error:', err);
    }
  };

  return (
    <div className="auth-container">
      <h2>Register</h2>
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="reg-username">Username:</label>
          <input
            type="text"
            id="reg-username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
          />
        </div>
        <div className="form-group">
          <label htmlFor="reg-password">Password:</label>
          <input
            type="password"
            id="reg-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        <div className="form-group">
          <label htmlFor="role">Role:</label>
          <select id="role" value={role} onChange={(e) => setRole(e.target.value)}>
            <option value="dietician">Dietician</option>
            <option value="kitchen_staff">Kitchen Staff</option>
            {/* Add other roles as needed */}
          </select>
        </div>
        {error && <p className="error-message">{error}</p>}
        {message && <p className="success-message">{message}</p>}
        <button type="submit">Register</button>
      </form>
    </div>
  );
};

export default Register;
