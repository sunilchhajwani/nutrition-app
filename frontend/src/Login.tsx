import React, { useState } from 'react';
import { jwtDecode } from "jwt-decode";

interface LoginProps {
  onLoginSuccess: (token: string, role: string, username: string) => void;
}

const API_BASE_URL = 'http://localhost:8001/api';

const Login: React.FC<LoginProps> = ({ onLoginSuccess }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    try {
      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      if (response.ok) {
        const data = await response.json();
        const decodedToken: { sub: string; role: string } = jwtDecode(data.access_token);
        onLoginSuccess(data.access_token, data.user_role, decodedToken.sub);
      } else {
        const errorData = await response.json();
        if (typeof errorData.detail === 'string') {
          setError(errorData.detail);
        } else if (Array.isArray(errorData.detail)) {
          setError(errorData.detail.map((err: any) => err.msg).join(', '));
        } else {
          setError('Login failed');
        }
      }
    } catch (err) {
      setError('Network error during login.');
      console.error('Login network error:', err);
    }
  };

  return (
    <div className="auth-container">
      <h2>Login</h2>
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="username">Username:</label>
          <input
            type="text"
            id="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
          />
        </div>
        <div className="form-group">
          <label htmlFor="password">Password:</label>
          <input
            type="password"
            id="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        {error && <p className="error-message">{error}</p>}
        <button type="submit">Login</button>
      </form>
    </div>
  );
};

export default Login;
