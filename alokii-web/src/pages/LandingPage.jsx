// src/pages/LandingPage.jsx
import React from 'react';
import { useNavigate } from 'react-router-dom';
import './LandingPage.css';

export default function LandingPage() {
  const navigate = useNavigate();
  return (
    <div className="landing-container">
      <div className="bubble bubble1" />
      <div className="bubble bubble2" />
      <div className="content">
        <h1 className="title">CivicMap <span className="accent">AI</span></h1>
        <p className="subtitle">
          Empowering citizens to build cleaner, safer, and smarter neighborhoods through instant AI reporting.
        </p>
        <div className="buttons">
          <button className="primary" onClick={() => navigate('/report')}>🟢 Report an Issue</button>
        </div>
        <footer className="footer">Supported by Municipal Administration</footer>
      </div>
    </div>
  );
}
