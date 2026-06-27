// src/pages/LoginPage.jsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './LoginPage.css';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  const handleSubmit = (e) => {
    e.preventDefault();
    setError(null);
    if (username === '123asdf' && password === 'asdfasdf') {
      sessionStorage.setItem('isAdminLoggedIn', 'true');
      navigate('/dashboard');
    } else {
      setError('Invalid username or password.');
    }
  };

  return (
    <div className="login-container">
      <h2 className="login-title">Administrator Login</h2>
      <form className="login-form" onSubmit={handleSubmit}>
        {error && <p className="login-error" style={{ color: 'red', textAlign: 'center' }}>{error}</p>}
        <label>
          Username
          <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} required />
        </label>
        <label>
          Password
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </label>
        <button type="submit" className="login-submit">Login</button>
      </form>
    </div>
  );
}
