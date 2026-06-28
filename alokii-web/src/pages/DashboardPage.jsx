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
  
  // Tabs
  const [activeTab, setActiveTab] = useState('dashboard'); // 'dashboard', 'map', 'analytics'
  
  // Filtering & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedStatus, setSelectedStatus] = useState('All');
  const [selectedTimeframe, setSelectedTimeframe] = useState('All');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 6;

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

  const handleLogout = () => {
    sessionStorage.removeItem('isAdminLoggedIn');
    navigate('/');
  };

  // Dynamic calculations for status totals
  const totalCount = reports.length;
  const pendingCount = reports.filter(r => (r.status || '').toLowerCase() === 'pending').length;
  const inProgressCount = reports.filter(r => (r.status || '').toLowerCase() === 'in progress' || (r.status || '').toLowerCase() === 'in-progress').length;
  const resolvedCount = reports.filter(r => (r.status || '').toLowerCase() === 'resolved').length;

  // Filter reports array
  const filteredReports = reports.filter(r => {
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

  return (
    <div className="bg-background text-on-background min-h-screen flex flex-col font-sans">
      
      {/* Top Header */}
      <header className="h-20 bg-surface border-b border-outline-variant px-6 md:px-10 flex items-center justify-between sticky top-0 z-40 shadow-sm">
        <div className="flex items-center gap-4 w-full">
          <div className="flex items-center gap-3 mr-8 cursor-pointer" onClick={() => setActiveTab('dashboard')}>
            <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center text-on-primary shrink-0">
              <span className="material-symbols-outlined">location_city</span>
            </div>
            <h1 className="text-xl text-primary font-extrabold tracking-tight">CivicConnect</h1>
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
        
        {/* Summary Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-surface border border-outline-variant p-6 rounded-2xl flex items-center gap-4 shadow-sm hover:shadow-md transition-shadow">
            <div className="w-12 h-12 bg-primary-container text-white rounded-xl flex items-center justify-center shadow-inner">
              <span className="material-symbols-outlined">description</span>
            </div>
            <div>
              <p className="text-xs text-on-surface-variant font-medium">Total Reports</p>
              <h4 className="text-2xl font-bold text-on-surface">{totalCount}</h4>
            </div>
          </div>
          
          <div className="bg-surface border border-outline-variant p-6 rounded-2xl flex items-center gap-4 shadow-sm hover:shadow-md transition-shadow">
            <div className="w-12 h-12 bg-yellow-100 text-yellow-800 rounded-xl flex items-center justify-center">
              <span className="material-symbols-outlined">pending_actions</span>
            </div>
            <div>
              <p className="text-xs text-on-surface-variant font-medium">Pending</p>
              <h4 className="text-2xl font-bold text-on-surface">{pendingCount}</h4>
            </div>
          </div>
          
          <div className="bg-surface border border-outline-variant p-6 rounded-2xl flex items-center gap-4 shadow-sm hover:shadow-md transition-shadow">
            <div className="w-12 h-12 bg-blue-100 text-blue-700 rounded-xl flex items-center justify-center">
              <span className="material-symbols-outlined">engineering</span>
            </div>
            <div>
              <p className="text-xs text-on-surface-variant font-medium">In Progress</p>
              <h4 className="text-2xl font-bold text-on-surface">{inProgressCount}</h4>
            </div>
          </div>
          
          <div className="bg-surface border border-outline-variant p-6 rounded-2xl flex items-center gap-4 shadow-sm hover:shadow-md transition-shadow">
            <div className="w-12 h-12 bg-green-100 text-green-700 rounded-xl flex items-center justify-center">
              <span className="material-symbols-outlined">task_alt</span>
            </div>
            <div>
              <p className="text-xs text-on-surface-variant font-medium">Resolved</p>
              <h4 className="text-2xl font-bold text-on-surface">{resolvedCount}</h4>
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

        {loading ? (
          <div className="flex-1 flex flex-col items-center justify-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
            <p className="mt-4 text-on-surface-variant font-semibold">Fetching city reports...</p>
          </div>
        ) : (
          <>
            {/* 1. Dashboard Tab */}
            {activeTab === 'dashboard' && (
              <div className="flex flex-col xl:flex-row gap-8 items-start">
                
                {/* Main Table Container */}
                <div className="flex-1 w-full bg-surface border border-outline-variant rounded-2xl overflow-hidden shadow-sm">
                  <div className="p-6 border-b border-outline-variant flex items-center justify-between bg-white">
                    <h2 className="text-lg font-bold text-on-background">Recent Submissions</h2>
                    
                    {/* Add new report button for mobile */}
                    <button 
                      className="md:hidden bg-primary text-white p-2 rounded-full shadow"
                      onClick={handleNewReport}
                    >
                      <span className="material-symbols-outlined text-[20px] block">add</span>
                    </button>
                  </div>
                  
                  {/* Table wrapper */}
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse whitespace-nowrap">
                      <thead>
                        <tr className="bg-surface-container-low border-b border-outline-variant">
                          <th className="py-4 px-4 text-xs font-bold uppercase tracking-wider text-on-surface-variant">Timestamp</th>
                          <th className="py-4 px-4 text-xs font-bold uppercase tracking-wider text-on-surface-variant">Evidence</th>
                          <th className="py-4 px-4 text-xs font-bold uppercase tracking-wider text-on-surface-variant">Category</th>
                          <th className="py-4 px-4 text-xs font-bold uppercase tracking-wider text-on-surface-variant">Reporter</th>
                          <th className="py-4 px-4 text-xs font-bold uppercase tracking-wider text-on-surface-variant">Phone</th>
                          <th className="py-4 px-4 text-xs font-bold uppercase tracking-wider text-on-surface-variant">AI Label</th>
                          <th className="py-4 px-4 text-xs font-bold uppercase tracking-wider text-on-surface-variant">AI Confidence</th>
                          <th className="py-4 px-4 text-xs font-bold uppercase tracking-wider text-on-surface-variant">Status</th>
                          <th className="py-4 px-4 text-xs font-bold uppercase tracking-wider text-on-surface-variant">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-outline-variant bg-white">
                        {paginatedReports.length === 0 ? (
                          <tr>
                            <td colSpan="9" className="py-12 text-center text-on-surface-variant font-medium">
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
                                <td className="py-4 px-4 text-sm text-on-surface-variant">
                                  {new Date(r.created_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                                </td>
                                
                                <td className="py-4 px-4">
                                  <div className="w-12 h-12 rounded-lg bg-surface-container-highest overflow-hidden border border-outline-variant shadow-sm shrink-0">
                                    {r.image_url ? (
                                      <img alt={r.issue_type} className="w-full h-full object-cover" src={r.image_url} />
                                    ) : (
                                      <div className="w-full h-full flex items-center justify-center bg-gray-100 text-gray-400">
                                        <span className="material-symbols-outlined">image</span>
                                      </div>
                                    )}
                                  </div>
                                </td>

                                <td className="py-4 px-4">
                                  <div className="flex items-center gap-3">
                                    <div className={`w-8 h-8 ${style.colorClass} rounded-lg flex items-center justify-center shrink-0`}>
                                      <span className="material-symbols-outlined text-[18px]">{style.icon}</span>
                                    </div>
                                    <span className="font-semibold text-sm text-on-surface">{r.issue_type || 'Other'}</span>
                                  </div>
                                </td>

                                <td className="py-4 px-4 text-sm text-on-surface font-medium">
                                  {r.reporter_name || 'Anonymous'}
                                </td>

                                <td className="py-4 px-4 text-sm text-on-surface-variant">
                                  {r.reporter_phone || '—'}
                                </td>

                                <td className="py-4 px-4 text-sm font-semibold text-on-surface font-medium">
                                  {r.ai_label ? (
                                    <span className="bg-primary/10 text-primary px-2.5 py-1 rounded-md text-xs font-bold">
                                      {r.ai_label}
                                    </span>
                                  ) : (
                                    <span className="text-gray-400 font-normal text-xs">Pending</span>
                                  )}
                                </td>

                                <td className="py-4 px-4 text-sm font-mono text-on-surface-variant font-medium">
                                  {r.ai_confidence ? (
                                    <span className="bg-primary/10 text-primary px-2 py-0.5 rounded font-bold text-xs">
                                      {(r.ai_confidence * 100).toFixed(1)}%
                                    </span>
                                  ) : (
                                    <span className="text-gray-400 font-normal text-xs">—</span>
                                  )}
                                </td>

                                <td className="py-4 px-4" onClick={(e) => e.stopPropagation()}>
                                  <select 
                                    className={`border-none rounded-full px-3 py-1 font-bold text-xs cursor-pointer focus:ring-2 focus:ring-primary shadow-sm ${getStatusColor(r.status)}`}
                                    value={r.status || 'Pending'}
                                    onChange={(e) => handleStatusChange(r.id, e.target.value)}
                                  >
                                    <option value="Pending">Pending</option>
                                    <option value="In Progress">In Progress</option>
                                    <option value="Resolved">Resolved</option>
                                  </select>
                                </td>

                                <td className="py-4 px-4">
                                  <button 
                                    className="text-primary hover:text-on-primary-fixed-variant font-bold text-sm hover:underline"
                                    onClick={() => setSelectedReport(r)}
                                  >
                                    Details
                                  </button>
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* Pagination footer */}
                  <div className="p-4 border-t border-outline-variant flex items-center justify-between bg-surface-container-low">
                    <span className="text-xs text-on-surface-variant font-semibold">
                      Showing {paginatedReports.length} of {totalFiltered} entries
                    </span>
                    <div className="flex items-center gap-2">
                      <button 
                        className="p-1.5 border border-outline-variant rounded-lg bg-white hover:bg-surface-container-high transition-colors disabled:opacity-50"
                        onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                        disabled={currentPage === 1}
                      >
                        <span className="material-symbols-outlined text-[20px] block">chevron_left</span>
                      </button>
                      <span className="text-xs font-bold px-3">
                        Page {currentPage} of {totalPages}
                      </span>
                      <button 
                        className="p-1.5 border border-outline-variant rounded-lg bg-white hover:bg-surface-container-high transition-colors disabled:opacity-50"
                        onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                        disabled={currentPage === totalPages}
                      >
                        <span className="material-symbols-outlined text-[20px] block">chevron_right</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Sidebar Filter / Mini Map */}
                <div className="w-full xl:w-80 flex flex-col gap-6">
                  
                  {/* Advanced Filters */}
                  <div className="bg-surface border border-outline-variant rounded-2xl p-6 shadow-sm">
                    <h3 className="text-md font-bold text-on-background mb-4 flex items-center gap-2">
                      <span className="material-symbols-outlined text-[20px] text-primary">tune</span>
                      Advanced Filters
                    </h3>
                    
                    <div className="flex flex-col gap-4">
                      {/* Search Bar for Mobile/Tablet */}
                      <div className="md:hidden">
                        <label className="text-xs text-outline font-bold uppercase block mb-1.5">Search</label>
                        <input 
                          className="w-full px-3 py-2 bg-surface-container-low border border-outline-variant rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary"
                          placeholder="Search issues..."
                          type="text"
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                        />
                      </div>

                      {/* Category Buttons */}
                      <div>
                        <label className="text-xs text-outline font-bold uppercase block mb-2">Category</label>
                        <div className="flex flex-wrap gap-2">
                          {['All', 'Pothole', 'Streetlight', 'Garbage'].map((cat) => (
                            <button
                              key={cat}
                              className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors ${
                                selectedCategory === cat
                                  ? 'bg-primary text-white border-primary'
                                  : 'bg-white border-outline-variant text-on-surface-variant hover:bg-surface-container-high'
                              }`}
                              onClick={() => setSelectedCategory(cat)}
                            >
                              {cat}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Status Dropdown */}
                      <div>
                        <label className="text-xs text-outline font-bold uppercase block mb-1.5">Status</label>
                        <select 
                          className="w-full bg-surface-container-low border border-outline-variant rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary font-medium"
                          value={selectedStatus}
                          onChange={(e) => setSelectedStatus(e.target.value)}
                        >
                          <option value="All">All Statuses</option>
                          <option value="Pending">Pending</option>
                          <option value="In Progress">In Progress</option>
                          <option value="Resolved">Resolved</option>
                        </select>
                      </div>

                      {/* Timeframe Dropdown */}
                      <div>
                        <label className="text-xs text-outline font-bold uppercase block mb-1.5">Timeframe</label>
                        <select 
                          className="w-full bg-surface-container-low border border-outline-variant rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary font-medium"
                          value={selectedTimeframe}
                          onChange={(e) => setSelectedTimeframe(e.target.value)}
                        >
                          <option value="All">All Time</option>
                          <option value="24h">Last 24 Hours</option>
                          <option value="7d">Last 7 Days</option>
                          <option value="30d">Last 30 Days</option>
                        </select>
                      </div>

                      <button 
                        className="mt-2 w-full py-2.5 text-primary font-bold text-xs border border-primary rounded-xl hover:bg-primary-container hover:text-white transition-all bg-white shadow-sm"
                        onClick={resetFilters}
                      >
                        Reset Filters
                      </button>
                    </div>
                  </div>

                  {/* Map Preview Card */}
                  <div 
                    className="bg-surface border border-outline-variant rounded-2xl p-4 shadow-sm hover:shadow-md transition-shadow cursor-pointer group"
                    onClick={() => setActiveTab('map')}
                  >
                    <div className="w-full h-32 rounded-xl overflow-hidden mb-3 relative bg-gray-100 border border-outline-variant">
                      <div className="pointer-events-none absolute inset-0 z-10 bg-black/5 group-hover:bg-black/0 transition-all"></div>
                      {/* Leaflet map inside sidebar */}
                      <LeafletMap 
                        center={reports.length ? [reports[0].latitude, reports[0].longitude] : [11.2719, 77.4120]}
                        zoom={11}
                        markers={reports}
                        onMarkerClick={(report) => setSelectedReport(report)}
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-bold text-sm text-on-surface">Interactive Map Preview</h4>
                        <p className="text-xs text-on-surface-variant">{filteredReports.length} reports mapped</p>
                      </div>
                      <span className="material-symbols-outlined text-primary text-[20px] group-hover:translate-x-1 transition-transform">open_in_new</span>
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
                  <button 
                    className="bg-primary text-white text-xs font-bold px-3 py-1.5 rounded-lg hover:bg-on-primary-fixed-variant transition-colors"
                    onClick={() => setActiveTab('dashboard')}
                  >
                    Back to Table view
                  </button>
                </div>
                <div className="w-full h-[500px] relative">
                  <LeafletMap 
                    center={filteredReports.length ? [filteredReports[0].latitude, filteredReports[0].longitude] : [11.2719, 77.4120]}
                    zoom={13}
                    markers={filteredReports}
                    onMarkerClick={(report) => setSelectedReport(report)}
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
                  <span className="text-xs font-extrabold uppercase text-outline tracking-wider">GPS Coordinates</span>
                  <span className="text-sm font-semibold text-on-surface">
                    Latitude: {selectedReport.latitude?.toFixed(6)} | Longitude: {selectedReport.longitude?.toFixed(6)}
                  </span>
                </div>
              </div>

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
          </div>
        </div>
      )}

    </div>
  );
}
