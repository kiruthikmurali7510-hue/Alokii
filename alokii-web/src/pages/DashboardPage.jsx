// src/pages/DashboardPage.jsx
import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../services/supabaseClient';
import LeafletMap from '../components/LeafletMap';
import { calculatePriority, getPriorityExplanation } from '../services/priorityUtils';
import './DashboardPage.css';

export default function DashboardPage() {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedReport, setSelectedReport] = useState(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  // Undo delete state
  const [undoReport, setUndoReport] = useState(null);   // the report object cached for undo
  const undoTimerRef = useRef(null);                     // setTimeout handle
  const UNDO_DURATION = 15000; // 15 seconds
  
  const [activeTab, setActiveTab] = useState('dashboard'); // 'dashboard', 'map', 'analytics'
  const [mapStatsVisible, setMapStatsVisible] = useState(true);
  const [hideResolvedOnMap, setHideResolvedOnMap] = useState(false);
  
  // Filtering & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedStatus, setSelectedStatus] = useState('All');
  const [selectedTimeframe, setSelectedTimeframe] = useState('All');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const navigate = useNavigate();

  // Watch tab changes to collapse stats in map mode
  useEffect(() => {
    if (activeTab === 'map') {
      setMapStatsVisible(false);
    } else {
      setMapStatsVisible(true);
    }
  }, [activeTab]);

  useEffect(() => {
    if (sessionStorage.getItem('isAdminLoggedIn') !== 'true') {
      navigate('/login');
      return;
    }
    fetchReports();
  }, [navigate]);

  const fetchReports = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('reports')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('Error fetching reports:', error);
    } else {
      setReports(data || []);
    }
    setLoading(false);
  };

  const handleStatusChange = async (reportId, newStatus) => {
    // Optimistically update local state first
    setReports(prev => prev.map(r => r.id === reportId ? { ...r, status: newStatus } : r));

    // Update DB
    const { error } = await supabase
      .from('reports')
      .update({ status: newStatus })
      .eq('id', reportId);

    if (error) {
      console.error('Error updating status:', error);
      alert('Failed to update status: ' + error.message);
      fetchReports(); // Revert
    }
  };

  const handleNewReport = () => {
    navigate('/report');
  };

  const handleDeleteReport = (reportId) => {
    // Find & cache the report for undo before removing
    const reportToDelete = reports.find(r => r.id === reportId);
    if (!reportToDelete) return;

    // Optimistically remove from UI immediately
    setReports(prev => prev.filter(r => r.id !== reportId));
    if (selectedReport?.id === reportId) setSelectedReport(null);
    setConfirmDeleteId(null);

    // Show undo toast
    setUndoReport(reportToDelete);

    // Clear any existing timer
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current);

    // After 15s, actually delete from DB
    undoTimerRef.current = setTimeout(async () => {
      setUndoReport(null);
      const { error } = await supabase.from('reports').delete().eq('id', reportId);
      if (error) {
        console.error('Error deleting report:', error);
        fetchReports(); // revert on failure
      }
    }, UNDO_DURATION);
  };

  const handleUndoDelete = () => {
    if (!undoReport) return;
    // Cancel the pending DB delete
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    // Restore the report back into local state (keep sorted by date desc)
    setReports(prev => {
      const restored = [undoReport, ...prev];
      return restored.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    });
    setUndoReport(null);
  };

  const handleLogout = () => {
    sessionStorage.removeItem('isAdminLoggedIn');
    navigate('/');
  };

  // Dynamic calculations for status totals
  const totalCount = reports.length;
  const pendingCount = reports.filter(r => (r.status || '').toLowerCase() === 'pending').length;
  const inProgressCount = reports.filter(r => (r.status || '').toLowerCase() === 'in progress' || (r.status || '').toLowerCase() === 'in-progress').length;
  const resolvedCount = reports.filter(r => (r.status || '').toLowerCase() === 'resolved').length;

  // Filter and dynamically calculate priority for reports array
  const filteredReports = useMemo(() => {
    const enriched = reports.map(r => {
      // Recalculate priority dynamically in real-time
      const prio = calculatePriority(r.ai_confidence, r.issue_type, r.road_type, r.created_at);
      return {
        ...r,
        // Override with dynamically computed values
        priority_score: prio.priorityScore,
        priority_level: prio.priorityLevel,
        time_score: prio.timeScore,
        time_display: prio.timeDisplay,
        severity_score: prio.severityScore,
        road_score: prio.roadScore
      };
    });

    // Sort by priority_score DESC (Priority Queue)
    const sorted = enriched.sort((a, b) => b.priority_score - a.priority_score);

    return sorted.filter(r => {
      // 1. Search Query filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const nameMatch = r.reporter_name?.toLowerCase().includes(q);
        const phoneMatch = r.reporter_phone?.toLowerCase().includes(q);
        const typeMatch = r.issue_type?.toLowerCase().includes(q);
        const descMatch = r.description?.toLowerCase().includes(q);
        const locMatch = r.location_name?.toLowerCase().includes(q);
        if (!nameMatch && !phoneMatch && !typeMatch && !descMatch && !locMatch) {
          return false;
        }
      }
      // 2. Category Filter
      if (selectedCategory !== 'All') {
        const type = r.issue_type?.toLowerCase() || '';
        const filterType = selectedCategory.toLowerCase();
        if (filterType === 'streetlight') {
          if (!type.includes('streetlight')) return false;
        } else if (filterType === 'garbage') {
          if (!type.includes('garbage')) return false;
        } else {
          if (!type.includes(filterType)) return false;
        }
      }
      // 3. Status Filter
      if (selectedStatus !== 'All') {
        if ((r.status || '').toLowerCase() !== selectedStatus.toLowerCase()) {
          return false;
        }
      }
      // 4. Timeframe Filter
      if (selectedTimeframe !== 'All') {
        const reportDate = new Date(r.created_at);
        const now = new Date();
        if (selectedTimeframe === '24h') {
          if (now - reportDate > 24 * 60 * 60 * 1000) return false;
        } else if (selectedTimeframe === '7d') {
          if (now - reportDate > 7 * 24 * 60 * 60 * 1000) return false;
        } else if (selectedTimeframe === '30d') {
          if (now - reportDate > 30 * 24 * 60 * 60 * 1000) return false;
        }
      }
      return true;
    });
  }, [reports, searchQuery, selectedCategory, selectedStatus, selectedTimeframe]);

  // Memoize map center coordinates to stabilize map references
  const mapCenter = useMemo(() => {
    return filteredReports.length 
      ? [filteredReports[0].latitude, filteredReports[0].longitude] 
      : [11.2719, 77.4120];
  }, [filteredReports]);

  // Apply hide-resolved filter for map markers only
  const mapMarkers = useMemo(() => {
    if (!hideResolvedOnMap) return filteredReports;
    return filteredReports.filter(r => (r.status || '').toLowerCase() !== 'resolved');
  }, [filteredReports, hideResolvedOnMap]);

  // Wrap marker click handler to preserve function reference across renders
  const handleMarkerClick = useCallback((report) => {
    setSelectedReport(report);
  }, []);

  // Paginated subset
  const totalFiltered = filteredReports.length;
  const totalPages = Math.ceil(totalFiltered / itemsPerPage) || 1;
  const paginatedReports = filteredReports.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  // Reset pagination on filter update
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedCategory, selectedStatus, selectedTimeframe]);

  const resetFilters = () => {
    setSelectedCategory('All');
    setSelectedStatus('All');
    setSelectedTimeframe('All');
    setSearchQuery('');
  };

  // Helper icons and styles
  const getIssueStyle = (type) => {
    const t = (type || '').toLowerCase();
    if (t.includes('pothole')) {
      return { icon: 'construction', colorClass: 'bg-red-100 text-red-700' };
    } else if (t.includes('garbage')) {
      return { icon: 'delete', colorClass: 'bg-yellow-100 text-yellow-800' };
    } else if (t.includes('streetlight')) {
      return { icon: 'lightbulb', colorClass: 'bg-blue-100 text-blue-700' };
    }
    return { icon: 'description', colorClass: 'bg-gray-100 text-gray-700' };
  };

  const getStatusColor = (status) => {
    const s = (status || '').toLowerCase();
    if (s === 'resolved') return 'bg-green-50 text-green-700 border-green-200';
    if (s === 'in-progress' || s === 'in progress') return 'bg-blue-50 text-blue-700 border-blue-200';
    return 'bg-yellow-50 text-yellow-800 border-yellow-200';
  };

  const getPriorityBadgeClass = (level) => {
    const l = (level || '').toLowerCase();
    if (l.includes('high')) return 'bg-red-50 text-red-700 border border-red-200';
    if (l.includes('medium')) return 'bg-amber-50 text-amber-700 border border-amber-200';
    return 'bg-slate-50 text-slate-700 border border-slate-200';
  };

  const getPriorityDot = (level) => {
    const l = (level || '').toLowerCase();
    if (l.includes('high')) return '🔴';
    if (l.includes('medium')) return '🟡';
    return '🟢';
  };

  const getPriorityAnalysisStyle = (level) => {
    const l = (level || '').toLowerCase();
    if (l.includes('high')) return { bg: 'bg-red-50/30', border: 'border-red-100', text: 'text-red-700', dashBorder: 'border-red-200' };
    if (l.includes('medium')) return { bg: 'bg-amber-50/30', border: 'border-amber-100', text: 'text-amber-700', dashBorder: 'border-amber-200' };
    return { bg: 'bg-slate-50/40', border: 'border-slate-200/60', text: 'text-slate-700', dashBorder: 'border-slate-300/60' };
  };

  return (
    <div className="bg-background text-on-background min-h-screen flex flex-col font-sans">
      
      {/* Top Header */}
      <header className="h-20 bg-surface border-b border-outline-variant px-6 md:px-10 flex items-center justify-between sticky top-0 z-40 shadow-sm">
        <div className="flex items-center gap-4 w-full">
          <div className="flex items-center gap-3 mr-8 cursor-pointer" onClick={() => setActiveTab('dashboard')}>
            <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center text-on-primary shrink-0">
              <span className="material-symbols-outlined">location_city</span>
            </div>
            <h1 className="text-xl text-primary font-extrabold tracking-tight">Tidy City</h1>
          </div>
          
          {/* Search bar */}
          <div className="relative w-1/2 max-w-xl hidden md:block">
            <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-outline">search</span>
            <input 
              className="w-full pl-12 pr-4 py-2.5 bg-surface-container-low border border-outline-variant rounded-full focus:ring-2 focus:ring-primary focus:border-primary transition-all outline-none text-body-md" 
              placeholder="Search reports by name, phone, issue..." 
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        {/* Profile and actions */}
        <div className="flex items-center gap-6">
          <button 
            className="hidden md:flex bg-primary hover:bg-on-primary-fixed-variant text-white px-4 py-2 rounded-full font-bold text-sm items-center gap-2 shadow-md transition-all shrink-0"
            onClick={handleNewReport}
          >
            <span className="material-symbols-outlined text-[18px]">add</span>
            New Report
          </button>
          
          <div 
            className="flex items-center gap-3 p-1 pl-3 hover:bg-surface-container-high rounded-full cursor-pointer transition-all border border-outline-variant"
            onClick={handleLogout}
            title="Click to Logout"
          >
            <div className="flex flex-col text-right hidden sm:flex">
              <span className="text-sm font-semibold text-on-surface leading-tight">Admin User</span>
              <span className="text-[10px] text-outline leading-tight">Logout</span>
            </div>
            <div className="w-8 h-8 bg-surface-container-highest rounded-full flex items-center justify-center text-primary overflow-hidden border border-outline-variant shrink-0">
              <span className="material-symbols-outlined text-[20px]">logout</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col p-6 md:p-10">
        
        {/* Summary Stats with Collapsible Behavior & Micro-animations */}
        <div 
          onClick={() => {
            if (activeTab === 'map') {
              setMapStatsVisible(false);
            }
          }}
          title={activeTab === 'map' ? "Click to hide stats summary and focus map" : ""}
          className={`relative group transition-all duration-500 ease-in-out overflow-hidden ${
            activeTab === 'map' && !mapStatsVisible 
              ? 'max-h-0 mb-0 opacity-0 pointer-events-none scale-95' 
              : 'max-h-[400px] mb-8 opacity-100 scale-100'
          } ${activeTab === 'map' ? 'cursor-pointer' : ''}`}
        >
          {activeTab === 'map' && mapStatsVisible && (
            <div className="absolute top-2 right-4 bg-primary/10 text-primary text-[10px] px-2 py-0.5 rounded-full font-bold flex items-center gap-1 opacity-60 group-hover:opacity-100 transition-opacity animate-pulse shadow-sm z-10">
              <span className="material-symbols-outlined text-[12px]">visibility_off</span>
              Click stats panel to hide
            </div>
          )}
          
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Total Reports */}
            <div className="bg-surface border border-outline-variant p-6 rounded-2xl flex items-center gap-4 shadow-sm hover:shadow-md hover:-translate-y-1 hover:border-primary/20 hover:scale-[1.01] active:scale-[0.98] transition-all duration-300 ease-out">
              <div className="w-12 h-12 bg-primary-container text-white rounded-xl flex items-center justify-center shadow-inner transition-transform duration-300 group-hover:scale-110">
                <span className="material-symbols-outlined">description</span>
              </div>
              <div>
                <p className="text-xs text-on-surface-variant font-medium">Total Reports</p>
                <h4 className="text-2xl font-bold text-on-surface">{totalCount}</h4>
              </div>
            </div>
            
            {/* Pending */}
            <div className="bg-surface border border-outline-variant p-6 rounded-2xl flex items-center gap-4 shadow-sm hover:shadow-md hover:-translate-y-1 hover:border-yellow-300 hover:scale-[1.01] active:scale-[0.98] transition-all duration-300 ease-out">
              <div className="w-12 h-12 bg-yellow-100 text-yellow-800 rounded-xl flex items-center justify-center transition-transform duration-300 group-hover:scale-110">
                <span className="material-symbols-outlined">pending_actions</span>
              </div>
              <div>
                <p className="text-xs text-on-surface-variant font-medium">Pending</p>
                <h4 className="text-2xl font-bold text-on-surface">{pendingCount}</h4>
              </div>
            </div>
            
            {/* In Progress */}
            <div className="bg-surface border border-outline-variant p-6 rounded-2xl flex items-center gap-4 shadow-sm hover:shadow-md hover:-translate-y-1 hover:border-blue-300 hover:scale-[1.01] active:scale-[0.98] transition-all duration-300 ease-out">
              <div className="w-12 h-12 bg-blue-100 text-blue-700 rounded-xl flex items-center justify-center transition-transform duration-300 group-hover:scale-110">
                <span className="material-symbols-outlined">engineering</span>
              </div>
              <div>
                <p className="text-xs text-on-surface-variant font-medium">In Progress</p>
                <h4 className="text-2xl font-bold text-on-surface">{inProgressCount}</h4>
              </div>
            </div>
            
            {/* Resolved */}
            <div className="bg-surface border border-outline-variant p-6 rounded-2xl flex items-center gap-4 shadow-sm hover:shadow-md hover:-translate-y-1 hover:border-green-300 hover:scale-[1.01] active:scale-[0.98] transition-all duration-300 ease-out">
              <div className="w-12 h-12 bg-green-100 text-green-700 rounded-xl flex items-center justify-center transition-transform duration-300 group-hover:scale-110">
                <span className="material-symbols-outlined">task_alt</span>
              </div>
              <div>
                <p className="text-xs text-on-surface-variant font-medium">Resolved</p>
                <h4 className="text-2xl font-bold text-on-surface">{resolvedCount}</h4>
              </div>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <nav className="bg-surface border-b border-outline-variant mb-6 flex items-center gap-8 px-2">
          <button 
            className={`py-4 px-2 font-semibold text-sm flex items-center gap-2 border-b-2 transition-all outline-none ${activeTab === 'dashboard' ? 'text-primary border-primary' : 'text-on-surface-variant border-transparent hover:text-primary'}`} 
            onClick={() => setActiveTab('dashboard')}
          >
            <span className="material-symbols-outlined text-[20px]">dashboard</span>
            Dashboard
          </button>
          <button 
            className={`py-4 px-2 font-semibold text-sm flex items-center gap-2 border-b-2 transition-all outline-none ${activeTab === 'map' ? 'text-primary border-primary' : 'text-on-surface-variant border-transparent hover:text-primary'}`} 
            onClick={() => setActiveTab('map')}
          >
            <span className="material-symbols-outlined text-[20px]">map</span>
            Full Issue Map
          </button>
          <button 
            className={`py-4 px-2 font-semibold text-sm flex items-center gap-2 border-b-2 transition-all outline-none ${activeTab === 'analytics' ? 'text-primary border-primary' : 'text-on-surface-variant border-transparent hover:text-primary'}`} 
            onClick={() => setActiveTab('analytics')}
          >
            <span className="material-symbols-outlined text-[20px]">analytics</span>
            Analytics Breakdowns
          </button>
        </nav>

        {/* Loading Spinner */}
        {loading ? (
          <div className="flex-1 flex flex-col items-center justify-center py-20 gap-3">
            <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            <p className="text-xs text-outline font-bold uppercase tracking-wider">Syncing dashboard data...</p>
          </div>
        ) : (
          <>
            {/* 1. Dashboard Table Tab */}
            {activeTab === 'dashboard' && (
              <div className="flex flex-col gap-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
                
                {/* Filter and control controls */}
                <div className="w-full bg-surface border border-outline-variant rounded-2xl p-4 flex flex-wrap gap-4 items-end shadow-sm">
                  {/* Category */}
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] text-outline font-bold uppercase tracking-wider">Category</label>
                    <select
                      className="bg-surface-container-low border border-outline-variant rounded-xl px-3 py-1.5 text-xs outline-none focus:ring-2 focus:ring-primary font-medium transition-colors duration-200 ease-in-out hover:bg-surface-container-high"
                      value={selectedCategory}
                      onChange={(e) => setSelectedCategory(e.target.value)}
                    >
                      <option value="All">All Categories</option>
                      <option value="Pothole">Potholes</option>
                      <option value="Garbage">Garbage Overflow</option>
                      <option value="Streetlight">Streetlight Issues</option>
                    </select>
                  </div>

                  {/* Status */}
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] text-outline font-bold uppercase tracking-wider">Status</label>
                    <select
                      className="bg-surface-container-low border border-outline-variant rounded-xl px-3 py-1.5 text-xs outline-none focus:ring-2 focus:ring-primary font-medium transition-colors duration-200 ease-in-out hover:bg-surface-container-high"
                      value={selectedStatus}
                      onChange={(e) => setSelectedStatus(e.target.value)}
                    >
                      <option value="All">All Statuses</option>
                      <option value="Pending">Pending</option>
                      <option value="In Progress">In Progress</option>
                      <option value="Resolved">Resolved</option>
                    </select>
                  </div>

                  {/* Time Range */}
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] text-outline font-bold uppercase tracking-wider">Time Range</label>
                    <select
                      className="bg-surface-container-low border border-outline-variant rounded-xl px-3 py-1.5 text-xs outline-none focus:ring-2 focus:ring-primary font-medium transition-colors duration-200 ease-in-out hover:bg-surface-container-high focus:scale-105"
                      value={selectedTimeframe}
                      onChange={(e) => setSelectedTimeframe(e.target.value)}
                    >
                      <option value="All">All Time</option>
                      <option value="24h">Last 24 Hours</option>
                      <option value="7d">Last 7 Days</option>
                      <option value="30d">Last 30 Days</option>
                    </select>
                  </div>

                  {/* Reset */}
                  <button
                    className="px-4 py-1.5 text-primary font-bold text-xs border border-primary rounded-xl hover:bg-primary hover:text-white transition-all bg-white hover:scale-105 focus:ring-2 focus:ring-primary"
                    onClick={resetFilters}
                  >
                    Reset Filters
                  </button>
                </div>

                {/* ── Full-width Table ── */}
                <div className="w-full bg-surface border border-outline-variant rounded-2xl overflow-hidden shadow-sm">
                  <div className="px-4 py-3 border-b border-outline-variant flex items-center justify-between bg-white">
                    <h2 className="text-base font-bold text-on-background">Priority Queue</h2>
                    <button
                      className="md:hidden bg-primary text-white p-1.5 rounded-full shadow"
                      onClick={handleNewReport}
                    >
                      <span className="material-symbols-outlined text-[18px] block">add</span>
                    </button>
                  </div>

                  {/* Table — no whitespace-nowrap, compact padding */}
                  <div className="w-full overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-surface-container-low border-b border-outline-variant">
                          <th className="py-3 px-3 text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">Issue Type</th>
                          <th className="py-3 px-3 text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">Priority Level</th>
                          <th className="py-3 px-3 text-[11px] font-bold uppercase tracking-wider text-on-surface-variant whitespace-nowrap">Priority Score</th>
                          <th className="py-3 px-3 text-[11px] font-bold uppercase tracking-wider text-on-surface-variant whitespace-nowrap">Road Importance</th>
                          <th className="py-3 px-3 text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">Status</th>
                          <th className="py-3 px-3 text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">Location</th>
                          <th className="py-3 px-3 text-[11px] font-bold uppercase tracking-wider text-on-surface-variant whitespace-nowrap">Report Date</th>
                          <th className="py-3 px-3 text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-outline-variant bg-white">
                        {paginatedReports.length === 0 ? (
                          <tr>
                            <td colSpan="8" className="py-12 text-center text-on-surface-variant font-medium">
                              No reports match the current filters.
                            </td>
                          </tr>
                        ) : (
                          paginatedReports.map((r) => {
                            const style = getIssueStyle(r.issue_type);
                            return (
                              <tr
                                key={r.id}
                                className="hover:bg-blue-50/30 transition-colors cursor-pointer"
                                onClick={() => setSelectedReport(r)}
                              >
                                {/* Issue Type */}
                                <td className="py-3 px-3">
                                  <div className="flex items-center gap-2">
                                    <div className={`w-6 h-6 ${style.colorClass} rounded-md flex items-center justify-center shrink-0`}>
                                      <span className="material-symbols-outlined text-[14px]">{style.icon}</span>
                                    </div>
                                    <span className="font-semibold text-xs text-on-surface">{r.issue_type || 'Other'}</span>
                                  </div>
                                </td>

                                {/* Priority Level */}
                                <td className="py-3 px-3">
                                  <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold whitespace-nowrap ${getPriorityBadgeClass(r.priority_level)}`}>
                                    {getPriorityDot(r.priority_level)} {r.priority_level}
                                  </span>
                                </td>

                                {/* Priority Score */}
                                <td className="py-3 px-3 text-xs font-bold text-on-surface">
                                  {r.priority_score || 0}/100
                                </td>

                                {/* Road Importance */}
                                <td className="py-3 px-3 text-xs font-semibold text-on-surface-variant">
                                  {r.road_type || 'Unknown'}
                                </td>

                                {/* Status */}
                                <td className="py-3 px-3" onClick={(e) => e.stopPropagation()}>
                                  <select
                                    className={`border-none rounded-full px-2 py-1 font-bold text-[11px] cursor-pointer focus:ring-2 focus:ring-primary shadow-sm ${getStatusColor(r.status)}`}
                                    value={r.status || 'Pending'}
                                    onChange={(e) => handleStatusChange(r.id, e.target.value)}
                                  >
                                    <option value="Pending">Pending</option>
                                    <option value="In Progress">In Progress</option>
                                    <option value="Resolved">Resolved</option>
                                  </select>
                                </td>

                                {/* Location */}
                                <td className="py-3 px-3 text-xs text-on-surface-variant whitespace-nowrap max-w-[120px] truncate">
                                  {r.location_name || '—'}
                                </td>

                                {/* Report Date */}
                                <td className="py-3 px-3 text-xs text-on-surface-variant whitespace-nowrap">
                                  {r.time_display ? `${r.time_display} ago` : new Date(r.created_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                                </td>

                                {/* Action */}
                                <td className="py-3 px-3" onClick={(e) => e.stopPropagation()}>
                                  <div className="flex items-center gap-1.5">
                                    <button
                                      className="flex items-center gap-1 bg-primary/10 hover:bg-primary text-primary hover:text-white text-[11px] font-bold px-2.5 py-1.5 rounded-lg transition-all duration-200 hover:scale-105 active:scale-95 whitespace-nowrap"
                                      onClick={() => setSelectedReport(r)}
                                      title="View report details"
                                    >
                                      <span className="material-symbols-outlined text-[13px]">open_in_new</span>
                                      View
                                    </button>
                                    <button
                                      className="flex items-center justify-center w-7 h-7 rounded-lg bg-red-50 hover:bg-red-500 text-red-500 hover:text-white transition-all duration-200 hover:scale-105 active:scale-95"
                                      onClick={() => handleDeleteReport(r.id)}
                                      title="Delete report"
                                    >
                                      <span className="material-symbols-outlined text-[14px]">delete</span>
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* Pagination footer */}
                  <div className="px-4 py-3 border-t border-outline-variant flex items-center justify-between bg-surface-container-low">
                    <span className="text-xs text-on-surface-variant font-semibold">
                      Showing {paginatedReports.length} of {totalFiltered} entries
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        className="p-1.5 border border-outline-variant rounded-lg bg-white hover:bg-surface-container-high transition-colors disabled:opacity-50"
                        onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                        disabled={currentPage === 1}
                      >
                        <span className="material-symbols-outlined text-[18px] block">chevron_left</span>
                      </button>
                      <span className="text-xs font-bold px-2">
                        Page {currentPage} of {totalPages}
                      </span>
                      <button
                        className="p-1.5 border border-outline-variant rounded-lg bg-white hover:bg-surface-container-high transition-colors disabled:opacity-50"
                        onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                        disabled={currentPage === totalPages}
                      >
                        <span className="material-symbols-outlined text-[18px] block">chevron_right</span>
                      </button>
                    </div>
                  </div>
                </div>

              </div>
            )}


            {/* 2. Full Issue Map Tab */}
            {activeTab === 'map' && (
              <div className="flex-1 w-full bg-white border border-outline-variant rounded-2xl overflow-hidden shadow-md flex flex-col min-h-[500px]">
                <div className="p-4 border-b border-outline-variant bg-surface flex items-center justify-between">
                  <div>
                    <h3 className="font-bold text-on-background flex items-center gap-2">
                      <span className="material-symbols-outlined text-primary">map</span>
                      City-wide Issue Dashboard Map
                    </h3>
                    <p className="text-xs text-on-surface-variant">Showing coordinates of all {filteredReports.length} filtered issues</p>
                  </div>
                  <div className="flex items-center gap-3">
                    {!mapStatsVisible && (
                      <button 
                        className="bg-white border border-outline-variant text-primary text-xs font-bold px-3 py-1.5 rounded-lg hover:bg-primary hover:text-white transition-all hover:scale-105 active:scale-95 flex items-center gap-1.5"
                        onClick={() => setMapStatsVisible(true)}
                      >
                        <span className="material-symbols-outlined text-[16px]">bar_chart</span>
                        Show Stats
                      </button>
                    )}
                    <button
                      className={`text-xs font-bold px-3 py-1.5 rounded-lg transition-all hover:scale-105 active:scale-95 flex items-center gap-1.5 border ${
                        hideResolvedOnMap
                          ? 'bg-emerald-600 text-white border-emerald-600 hover:bg-emerald-700'
                          : 'bg-white border-outline-variant text-on-surface-variant hover:bg-surface-container-high'
                      }`}
                      onClick={() => setHideResolvedOnMap(prev => !prev)}
                    >
                      <span className="material-symbols-outlined text-[16px]">{hideResolvedOnMap ? 'visibility_off' : 'visibility'}</span>
                      {hideResolvedOnMap ? 'Show Resolved' : 'Hide Resolved'}
                    </button>
                    <button 
                      className="bg-primary text-white text-xs font-bold px-3 py-1.5 rounded-lg hover:bg-on-primary-fixed-variant transition-all hover:scale-105 active:scale-95"
                      onClick={() => setActiveTab('dashboard')}
                    >
                      Back to Table view
                    </button>
                  </div>
                </div>
                <div className="w-full h-[500px] relative">
                  <LeafletMap 
                    center={mapCenter}
                    zoom={13}
                    markers={mapMarkers}
                    onMarkerClick={handleMarkerClick}
                  />
                </div>
              </div>
            )}

            {/* 3. Analytics Breakdowns Tab */}
            {activeTab === 'analytics' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                
                {/* Issue Type Chart Card */}
                <div className="bg-surface border border-outline-variant p-6 rounded-2xl shadow-sm">
                  <h3 className="text-md font-bold text-on-background mb-6 flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary">category</span>
                    Category Distribution
                  </h3>
                  <div className="flex flex-col gap-5">
                    {['Pothole', 'Garbage Overflow', 'Streetlight Issue', 'Other'].map(type => {
                      const count = reports.filter(r => (r.issue_type || '').toLowerCase().includes(type.split(' ')[0].toLowerCase())).length;
                      const percentage = totalCount ? Math.round((count / totalCount) * 100) : 0;
                      return (
                        <div key={type} className="flex flex-col gap-1.5">
                          <div className="flex justify-between text-sm font-semibold">
                            <span className="text-on-surface">{type}</span>
                            <span className="text-primary">{count} reports ({percentage}%)</span>
                          </div>
                          <div className="w-full bg-gray-200 h-2.5 rounded-full overflow-hidden">
                            <div 
                              className={`h-full rounded-full ${
                                type.includes('Pothole') ? 'bg-red-500' :
                                type.includes('Garbage') ? 'bg-yellow-500' :
                                type.includes('Streetlight') ? 'bg-blue-500' : 'bg-gray-500'
                              }`} 
                              style={{ width: `${percentage}%` }}
                            ></div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Status Breakdown Card */}
                <div className="bg-surface border border-outline-variant p-6 rounded-2xl shadow-sm">
                  <h3 className="text-md font-bold text-on-background mb-6 flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary">donut_large</span>
                    Issue Status Metrics
                  </h3>
                  <div className="flex flex-col gap-5">
                    {[
                      { name: 'Pending Initial Review', count: pendingCount, color: 'bg-yellow-500', text: 'text-yellow-800' },
                      { name: 'Under Active Investigation', count: inProgressCount, color: 'bg-blue-500', text: 'text-blue-700' },
                      { name: 'Successfully Resolved', count: resolvedCount, color: 'bg-green-500', text: 'text-green-700' }
                    ].map(status => {
                      const percentage = totalCount ? Math.round((status.count / totalCount) * 100) : 0;
                      return (
                        <div key={status.name} className="flex flex-col gap-1.5">
                          <div className="flex justify-between text-sm font-semibold">
                            <span className="text-on-surface">{status.name}</span>
                            <span className={status.text}>{status.count} ({percentage}%)</span>
                          </div>
                          <div className="w-full bg-gray-200 h-2.5 rounded-full overflow-hidden">
                            <div 
                              className={`h-full rounded-full ${status.color}`}
                              style={{ width: `${percentage}%` }}
                            ></div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

              </div>
            )}
          </>
        )}

      </main>

      {/* Detailed Report Modal */}
      {selectedReport && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm flex justify-center items-center z-[9999] p-4 transition-all duration-300"
          onClick={() => setSelectedReport(null)}
        >
          <div 
            className="bg-white border border-outline-variant rounded-3xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6 md:p-8 shadow-2xl relative animate-in fade-in zoom-in duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Close */}
            <button 
              className="absolute top-4 right-4 w-10 h-10 rounded-full bg-gray-100 hover:bg-gray-200 transition-colors flex items-center justify-center text-on-surface-variant font-bold"
              onClick={() => setSelectedReport(null)}
            >
              ✕
            </button>

            {/* Modal Header */}
            <div className="border-b border-outline-variant pb-4 mb-6">
              <div className="flex items-center gap-3 mb-2">
                <span className="text-2xl">{getIssueStyle(selectedReport.issue_type).icon === 'construction' ? '🕳️' : getIssueStyle(selectedReport.issue_type).icon === 'lightbulb' ? '💡' : '🗑️'}</span>
                <h2 className="text-xl font-extrabold text-on-surface">{selectedReport.issue_type || 'Report Details'}</h2>
              </div>
              <p className="text-xs text-outline">
                Submitted on {new Date(selectedReport.created_at).toLocaleString([], { dateStyle: 'long', timeStyle: 'short' })}
              </p>
            </div>

            {/* Modal Body */}
            <div className="flex flex-col gap-6">
              
              {/* Flex Grid details */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-slate-50 p-5 rounded-2xl border border-slate-100">
                <div className="flex flex-col gap-1">
                  <span className="text-xs font-extrabold uppercase text-outline tracking-wider">AI Analysis Label</span>
                  <span className="text-sm font-semibold text-on-surface">
                    {selectedReport.ai_label ? (
                      <span className="bg-primary/10 text-primary px-2.5 py-1 rounded-md">
                        {selectedReport.ai_label}
                      </span>
                    ) : 'Not analyzed / Pending'}
                  </span>
                </div>

                <div className="flex flex-col gap-1">
                  <span className="text-xs font-extrabold uppercase text-outline tracking-wider">AI Confidence</span>
                  <span className="text-sm font-semibold text-on-surface">
                    {selectedReport.ai_confidence ? (
                      <span className="bg-primary/10 text-primary px-2.5 py-1 rounded-md font-mono">
                        {(selectedReport.ai_confidence * 100).toFixed(1)}%
                      </span>
                    ) : '—'}
                  </span>
                </div>

                <div className="flex flex-col gap-1">
                  <span className="text-xs font-extrabold uppercase text-outline tracking-wider">Resolution Status</span>
                  <div className="mt-1">
                    <select 
                      className={`border-none rounded-full px-3 py-1 font-bold text-xs cursor-pointer focus:ring-2 focus:ring-primary shadow-sm ${getStatusColor(selectedReport.status)}`}
                      value={selectedReport.status || 'Pending'}
                      onChange={(e) => {
                        handleStatusChange(selectedReport.id, e.target.value);
                        setSelectedReport(prev => ({ ...prev, status: e.target.value }));
                      }}
                    >
                      <option value="Pending">Pending</option>
                      <option value="In Progress">In Progress</option>
                      <option value="Resolved">Resolved</option>
                    </select>
                  </div>
                </div>

                <div className="flex flex-col gap-1">
                  <span className="text-xs font-extrabold uppercase text-outline tracking-wider">Reporter details</span>
                  <span className="text-sm font-semibold text-on-surface">
                    {selectedReport.reporter_name || 'Anonymous'} ({selectedReport.reporter_phone || '—'})
                  </span>
                </div>

                <div className="flex flex-col gap-1 md:col-span-2">
                  <span className="text-xs font-extrabold uppercase text-outline tracking-wider">GPS Coordinates & Location</span>
                  <span className="text-sm font-semibold text-on-surface">
                    Latitude: {selectedReport.latitude?.toFixed(6)} | Longitude: {selectedReport.longitude?.toFixed(6)}
                  </span>
                  <span className="text-sm text-on-surface mt-1">
                    <span className="font-bold">Road Type:</span> {selectedReport.road_type || 'Unknown'}
                  </span>
                </div>
              </div>

              {/* Priority Analysis Section */}
              {(() => {
                const colors = getPriorityAnalysisStyle(selectedReport.priority_level);
                return (
                  <div className={`flex flex-col gap-3 ${colors.bg} border ${colors.border} p-5 rounded-2xl shadow-sm`}>
                    <span className={`text-xs font-extrabold uppercase ${colors.text} tracking-wider flex items-center gap-1.5`}>
                      <span className="material-symbols-outlined text-[16px]">analytics</span>
                      Priority Analysis
                    </span>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-2">
                      <div className="flex flex-col">
                        <span className="text-[10px] uppercase font-bold text-outline">Priority Level</span>
                        <span className="text-sm font-extrabold flex items-center gap-1 mt-0.5 text-on-surface">
                          {getPriorityDot(selectedReport.priority_level)} {selectedReport.priority_level}
                        </span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[10px] uppercase font-bold text-outline">Priority Score</span>
                        <span className="text-sm font-extrabold text-on-surface mt-0.5">
                          {selectedReport.priority_score || 0}/100
                        </span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[10px] uppercase font-bold text-outline">AI Confidence</span>
                        <span className="text-sm font-extrabold text-on-surface mt-0.5">
                          {selectedReport.ai_confidence ? `${(selectedReport.ai_confidence * 100).toFixed(1)}%` : '—'}
                        </span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[10px] uppercase font-bold text-outline">Issue Severity</span>
                        <span className="text-sm font-semibold text-on-surface mt-0.5">
                          {selectedReport.severity_score || 40}
                        </span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[10px] uppercase font-bold text-outline">Road Importance</span>
                        <span className="text-sm font-semibold text-on-surface mt-0.5">
                          {selectedReport.road_type || 'Unknown'}
                        </span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[10px] uppercase font-bold text-outline">Time Waiting</span>
                        <span className="text-sm font-semibold text-on-surface mt-0.5">
                          {selectedReport.time_display || '0 mins'}
                        </span>
                      </div>
                    </div>
                    <p className={`text-xs italic text-on-surface-variant bg-white/80 p-3 rounded-xl border border-dashed ${colors.dashBorder} mt-2 leading-relaxed`}>
                      "{getPriorityExplanation(
                        selectedReport.priority_level,
                        selectedReport.ai_confidence,
                        selectedReport.issue_type,
                        selectedReport.road_type,
                        selectedReport.time_display || '0 mins'
                      )}"
                    </p>
                  </div>
                );
              })()}

              {selectedReport.description && (
                <div className="flex flex-col gap-1.5">
                  <span className="text-xs font-extrabold uppercase text-outline tracking-wider">Reporter's Comments</span>
                  <p className="text-sm text-on-surface-variant leading-relaxed bg-white border border-outline-variant p-4 rounded-xl shadow-sm">
                    "{selectedReport.description}"
                  </p>
                </div>
              )}

              {selectedReport.image_url && (
                <div className="flex flex-col gap-2">
                  <span className="text-xs font-extrabold uppercase text-outline tracking-wider">Evidence Picture</span>
                  <div className="w-full rounded-2xl overflow-hidden border border-outline-variant shadow-md">
                    <img src={selectedReport.image_url} alt="Evidence" className="w-full max-h-[350px] object-cover block" />
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer — Delete */}
            <div className="mt-6 pt-5 border-t border-outline-variant flex justify-between items-center">
              <p className="text-xs text-outline">Only administrators can delete reports.</p>
              <button
                className="flex items-center gap-2 bg-red-50 hover:bg-red-500 text-red-500 hover:text-white font-bold text-sm px-4 py-2 rounded-xl transition-all duration-200 hover:scale-105 active:scale-95"
                onClick={() => setConfirmDeleteId(selectedReport.id)}
              >
                <span className="material-symbols-outlined text-[16px]">delete</span>
                Delete Report
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Custom Confirmation Dialog */}
      {confirmDeleteId && (
        <div
          className="fixed inset-0 bg-black/70 backdrop-blur-sm flex justify-center items-center z-[10000] p-4"
          onClick={() => setConfirmDeleteId(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 flex flex-col gap-5"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Icon */}
            <div className="flex flex-col items-center gap-3 text-center">
              <div className="w-14 h-14 rounded-full bg-red-100 flex items-center justify-center">
                <span className="material-symbols-outlined text-red-500 text-[28px]">delete_forever</span>
              </div>
              <h3 className="text-lg font-extrabold text-on-surface">Delete Report?</h3>
              <p className="text-sm text-on-surface-variant leading-relaxed">
                This action is <strong>permanent</strong> and cannot be undone. The report will be removed from both the dashboard and the map.
              </p>
            </div>
            {/* Actions */}
            <div className="flex gap-3">
              <button
                className="flex-1 py-2.5 rounded-xl border border-outline-variant font-bold text-sm text-on-surface hover:bg-surface-container-high transition-all"
                onClick={() => setConfirmDeleteId(null)}
              >
                Cancel
              </button>
              <button
                className="flex-1 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 text-white font-bold text-sm transition-all hover:scale-105 active:scale-95 shadow-md"
                onClick={() => handleDeleteReport(confirmDeleteId)}
              >
                Yes, Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Undo Delete Toast */}
      {undoReport && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[10001] w-full max-w-md px-4 animate-in slide-in-from-bottom-4 fade-in duration-300">
          <div className="bg-gray-900 text-white rounded-2xl shadow-2xl overflow-hidden">
            {/* Countdown progress bar */}
            <div
              className="h-1 bg-primary rounded-t-2xl"
              style={{
                animation: `shrink ${UNDO_DURATION}ms linear forwards`,
              }}
            />
            <div className="flex items-center gap-3 px-5 py-4">
              <div className="w-9 h-9 rounded-full bg-red-500/20 flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-red-400 text-[18px]">delete</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-white leading-tight">Report deleted</p>
                <p className="text-xs text-gray-400 truncate mt-0.5">
                  {undoReport.issue_type || 'Report'} — {undoReport.reporter_name || 'Anonymous'}
                </p>
              </div>
              <button
                className="shrink-0 bg-primary hover:bg-on-primary-fixed-variant text-white font-extrabold text-sm px-4 py-2 rounded-xl transition-all hover:scale-105 active:scale-95"
                onClick={handleUndoDelete}
              >
                Undo
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Keyframe for countdown bar */}
      <style>{`
        @keyframes shrink {
          from { width: 100%; }
          to   { width: 0%; }
        }
      `}</style>

    </div>
  );
}
