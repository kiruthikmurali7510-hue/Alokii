// src/pages/SuccessPage.jsx
import React from 'react';
import { useNavigate } from 'react-router-dom';
import './SuccessPage.css';

export default function SuccessPage() {
  const navigate = useNavigate();
  return (
    <div className="success-container">
      <div className="success-card">
        <div className="success-icon">✅</div>
        <h1 className="success-title">Report Submitted!</h1>
        <p className="success-message">
          Your civic issue has been reported successfully. Our team will review it shortly.
        </p>
        <div className="success-buttons">
          <button className="btn-primary" onClick={() => navigate('/dashboard')}>
            View Dashboard
          </button>
          <button className="btn-secondary" onClick={() => navigate('/report')}>
            Submit Another
          </button>
        </div>
      </div>
    </div>
  );
}
