// src/pages/ReportPage.jsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { uploadImage } from '../services/uploadImage';
import { runAIPipeline } from '../services/api';
import { supabase } from '../services/supabaseClient';
import useGeolocation from '../hooks/useGeolocation';
import './ReportPage.css';

const ISSUE_TYPES = [
  { value: 'Pothole', emoji: '🕳️', color: '#EF4444' },
  { value: 'Garbage Overflow', emoji: '🗑️', color: '#F59E0B' },
  { value: 'Streetlight Issue', emoji: '💡', color: '#3B82F6' },
];

export default function ReportPage() {
  const navigate = useNavigate();

  // Form fields
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [issueType, setIssueType] = useState('Pothole');
  const [description, setDescription] = useState('');
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);

  // Manual location fallback
  const [manualLat, setManualLat] = useState('');
  const [manualLng, setManualLng] = useState('');

  // UI state
  const [submitting, setSubmitting] = useState(false);
  const [submitStep, setSubmitStep] = useState('');
  const [error, setError] = useState(null);

  const { position, error: geoError, loading: geoLoading } = useGeolocation();

  // Resolve final coordinates — GPS first, then manual fallback
  const getFinalLocation = () => {
    if (position) return { latitude: position.latitude, longitude: position.longitude };
    const lat = parseFloat(manualLat);
    const lng = parseFloat(manualLng);
    if (!isNaN(lat) && !isNaN(lng)) return { latitude: lat, longitude: lng };
    return null;
  };

  const handleImageChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    // --- Validation ---
    if (!name.trim()) { setError('Please enter your name.'); return; }
    if (!phone.trim() || phone.trim().length < 7) { setError('Please enter a valid phone number.'); return; }
    if (!imageFile) { setError('Please select an image of the issue.'); return; }

    const location = getFinalLocation();
    if (!location) {
      setError(
        geoLoading
          ? 'Still detecting location — please wait a moment or enter coordinates manually.'
          : 'Location is required. Please enter latitude and longitude manually below.'
      );
      return;
    }

    setSubmitting(true);
    try {
      // Step 1: Upload image to Supabase storage
      setSubmitStep('Uploading image…');
      const imageUrl = await uploadImage(imageFile);

      // Step 2: Run AI pipeline (non-fatal — won't block submission if backend is down)
      setSubmitStep('Running AI analysis…');
      const aiResult = await runAIPipeline(imageFile); // passes file directly
      const aiLabel = aiResult?.label || null;
      const aiConfidence = aiResult?.confidence || null;

      // Step 3: Insert report into Supabase
      // Column names must match the actual Supabase table schema from App.js
      setSubmitStep('Saving report…');
      const { error: insertError } = await supabase.from('reports').insert([
        {
          reporter_name: name.trim(),
          reporter_phone: phone.trim(),
          image_url: imageUrl,
          description: description.trim() || null,
          latitude: location.latitude,
          longitude: location.longitude,
          location_name: `${location.latitude.toFixed(5)}, ${location.longitude.toFixed(5)}`,
          issue_type: issueType,
          status: aiResult?.status || 'Pending',
          priority_level: 'Medium',
          ai_label: aiResult?.label ?? null,
          ai_confidence: aiResult?.confidence ?? null,
        }
      ]);

      if (insertError) throw new Error(`Database error: ${insertError.message}`);

      // Step 4: Navigate to success
      navigate('/success');
    } catch (err) {
      console.error('Submission error:', err);
      setError(err.message || 'Submission failed. Please try again.');
    } finally {
      setSubmitting(false);
      setSubmitStep('');
    }
  };

  return (
    <div className="report-page">
      <button className="admin-login-btn" onClick={() => navigate('/login')}>
        Login as Administrator
      </button>
      <h2 className="report-title">Report Civic Issue</h2>
      <form className="report-form" onSubmit={handleSubmit} noValidate>

        {/* Error Banner */}
        {error && (
          <div className="error-banner">
            <span>⚠️</span>
            <p>{error}</p>
          </div>
        )}

        {/* Submitting Progress */}
        {submitting && (
          <div className="progress-banner">
            <div className="spinner" />
            <p>{submitStep}</p>
          </div>
        )}

        {/* Section 1: Identity */}
        <div className="form-section">
          <h3 className="section-title">1. Your Details</h3>
          <label>
            Full Name *
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. John Doe"
              disabled={submitting}
            />
          </label>
          <label>
            Phone Number *
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="e.g. 9876543210"
              disabled={submitting}
            />
          </label>
        </div>

        {/* Section 2: Image */}
        <div className="form-section">
          <h3 className="section-title">2. Capture Evidence *</h3>
          {imagePreview ? (
            <div className="image-preview-wrap">
              <img src={imagePreview} alt="Preview" className="image-preview" />
              <button
                type="button"
                className="remove-image-btn"
                onClick={() => { setImageFile(null); setImagePreview(null); }}
                disabled={submitting}
              >
                ✕ Remove
              </button>
            </div>
          ) : (
            <div className="upload-options">
              <label className="file-upload-label camera-btn">
                📸 Take Photo
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={handleImageChange}
                  disabled={submitting}
                  className="file-input-hidden"
                />
              </label>
              <label className="file-upload-label gallery-btn">
                🖼️ Choose from Gallery
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageChange}
                  disabled={submitting}
                  className="file-input-hidden"
                />
              </label>
            </div>
          )}
        </div>

        {/* Section 3: Issue Type */}
        <div className="form-section">
          <h3 className="section-title">3. Issue Type *</h3>
          <div className="issue-grid">
            {ISSUE_TYPES.map((t) => (
              <button
                key={t.value}
                type="button"
                className={`issue-card ${issueType === t.value ? 'selected' : ''}`}
                style={issueType === t.value ? { borderColor: t.color, backgroundColor: t.color + '18' } : {}}
                onClick={() => setIssueType(t.value)}
                disabled={submitting}
              >
                <span className="issue-emoji">{t.emoji}</span>
                <span className="issue-label" style={issueType === t.value ? { color: t.color, fontWeight: 700 } : {}}>
                  {t.value}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Section 4: Description */}
        <div className="form-section">
          <h3 className="section-title">4. Additional Details</h3>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            placeholder="Describe the issue, landmarks, or urgency… (optional)"
            disabled={submitting}
          />
        </div>

        {/* Section 5: Location */}
        <div className="form-section">
          <h3 className="section-title">5. Location</h3>
          {geoLoading && <p className="geo-status detecting">📡 Detecting your location…</p>}
          {!geoLoading && position && (
            <p className="geo-status success">
              🟢 GPS detected: {position.latitude.toFixed(5)}, {position.longitude.toFixed(5)}
            </p>
          )}
          {!geoLoading && geoError && (
            <div>
              <p className="geo-status failed">⚠️ Auto-detect failed. Enter coordinates manually:</p>
              <div className="coords-row">
                <input
                  type="number"
                  step="any"
                  placeholder="Latitude (e.g. 11.2719)"
                  value={manualLat}
                  onChange={(e) => setManualLat(e.target.value)}
                  disabled={submitting}
                />
                <input
                  type="number"
                  step="any"
                  placeholder="Longitude (e.g. 77.4120)"
                  value={manualLng}
                  onChange={(e) => setManualLng(e.target.value)}
                  disabled={submitting}
                />
              </div>
            </div>
          )}
        </div>

        {/* Submit */}
        <button type="submit" className="submit-btn" disabled={submitting}>
          {submitting ? submitStep || 'Submitting…' : '🚀 Submit Report'}
        </button>
      </form>
    </div>
  );
}
