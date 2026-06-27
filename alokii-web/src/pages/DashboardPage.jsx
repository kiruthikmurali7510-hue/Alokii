// src/pages/DashboardPage.jsx
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../services/supabaseClient';
import LeafletMap from '../components/LeafletMap';
import './DashboardPage.css';

export default function DashboardPage() {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedReport, setSelectedReport] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (sessionStorage.getItem('isAdminLoggedIn') !== 'true') {
      navigate('/login');
      return;
    }
    fetchReports();
  }, [navigate]);

  const fetchReports = async () => {
    setLoading(true);
    const { data, error } = await supabase.from('reports').select('*').order('created_at', { ascending: false });
    if (error) {
      console.error('Error fetching reports:', error);
    } else {
      setReports(data);
    }
    setLoading(false);
  };

  const handleNewReport = () => {
    navigate('/report');
  };

  const handleLogout = () => {
    sessionStorage.removeItem('isAdminLoggedIn');
    navigate('/');
  };

  return (
    <div className="dashboard-container">
      <h1 className="dashboard-title">Reported Issues</h1>
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem' }}>
        <button className="new-report-button" style={{ marginBottom: 0 }} onClick={handleNewReport}>+ New Report</button>
        <button className="new-report-button" style={{ marginBottom: 0, backgroundColor: '#ef4444' }} onClick={handleLogout}>Logout</button>
      </div>
      {loading ? (
        <p>Loading reports…</p>
      ) : (
        <div className="dashboard-content">
          <table className="reports-table">
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>Name</th>
                <th>Phone</th>
                <th>Issue</th>
                <th>Status</th>
                <th>Location</th>
                <th>Image</th>
              </tr>
            </thead>
            <tbody>
              {reports.map((r) => (
                <tr key={r.id} onClick={() => setSelectedReport(r)} style={{ cursor: 'pointer' }}>
                  <td>{new Date(r.created_at).toLocaleString()}</td>
                  <td>{r.reporter_name}</td>
                  <td>{r.reporter_phone}</td>
                  <td>{r.issue_type}</td>
                  <td>{r.status || '—'}</td>
                  <td>{r.latitude?.toFixed(5)}, {r.longitude?.toFixed(5)}</td>
                  <td>
                    {r.image_url ? (
                      <a href={r.image_url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>View</a>
                    ) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="map-wrapper">
            <LeafletMap
              center={reports.length ? [reports[0].latitude, reports[0].longitude] : [0, 0]}
              zoom={13}
              markers={reports}
            />
            {/* Markers show report locations */}
          </div>
        </div>
      )}

      {/* Report Details Modal */}
      {selectedReport && (
        <div className="modal-overlay" onClick={() => setSelectedReport(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setSelectedReport(null)}>✕</button>
            <div className="modal-header">
              <h2 className="modal-title">{selectedReport.issue_type || 'Report Details'}</h2>
              <p className="modal-subtitle">Submitted on {new Date(selectedReport.created_at).toLocaleString()}</p>
            </div>
            <div className="modal-body">
              <div className="detail-row">
                <span className="detail-label">AI Analysis</span>
                <span className="detail-value">
                  {selectedReport.ai_label ? (
                    <>
                      <strong>Label:</strong> {selectedReport.ai_label} <br />
                      <strong>Confidence:</strong> {selectedReport.ai_confidence ? (selectedReport.ai_confidence * 100).toFixed(1) + '%' : 'N/A'}
                    </>
                  ) : 'Not analyzed or Pending'}
                </span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Status</span>
                <span className="detail-value">{selectedReport.status || '—'}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Reporter</span>
                <span className="detail-value">{selectedReport.reporter_name} ({selectedReport.reporter_phone})</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Location</span>
                <span className="detail-value">{selectedReport.latitude?.toFixed(5)}, {selectedReport.longitude?.toFixed(5)}</span>
              </div>
              {selectedReport.description && (
                <div className="detail-row">
                  <span className="detail-label">Description</span>
                  <span className="detail-value">{selectedReport.description}</span>
                </div>
              )}
              {selectedReport.image_url && (
                <div className="detail-row">
                  <span className="detail-label">Evidence Image</span>
                  <img src={selectedReport.image_url} alt="Civic Issue" className="modal-image" />
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
