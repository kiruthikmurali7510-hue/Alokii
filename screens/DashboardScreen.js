import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, ScrollView, Image, ActivityIndicator, Platform, Dimensions, TextInput, Modal } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { supabase } from '../supabase';
import LeafletMap from '../components/MapView';

const { width, height } = Dimensions.get('window');

export default function DashboardScreen({ onLogout }) {
  const [activeTab, setActiveTab] = useState('list'); // 'list' or 'map'
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [issueFilters, setIssueFilters] = useState([]);
  const [statusFilters, setStatusFilters] = useState([]);
  const [startDate, setStartDate] = useState(''); // YYYY-MM-DD
  const [endDate, setEndDate] = useState(''); // YYYY-MM-DD
  const [refreshing, setRefreshing] = useState(false);
  const [sortBy, setSortBy] = useState('newest'); // 'newest' or 'oldest'
  const [selectedReport, setSelectedReport] = useState(null);
  const [editIssueType, setEditIssueType] = useState('');
  const [editStatus, setEditStatus] = useState('');

  useEffect(() => {
    if (selectedReport) {
      setEditIssueType(selectedReport.issue_type);
      setEditStatus(selectedReport.status);
    }
  }, [selectedReport]);

  // Helper to toggle filter arrays
  const toggleFilter = (value, setFn, current) => {
    if (current.includes(value)) {
      setFn(current.filter(v => v !== value));
    } else {
      setFn([...current, value]);
    }
  };

  // Compute filtered reports based on debounced search, selected filters, and optional date range
  const filteredReports = reports.filter(r => {
    const matchesSearch =
      r.reporter_name.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
      r.reporter_phone.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
      (r.description && r.description.toLowerCase().includes(debouncedSearch.toLowerCase())) ||
      (r.location_name && r.location_name.toLowerCase().includes(debouncedSearch.toLowerCase()));
    const matchesIssue = issueFilters.length === 0 || issueFilters.includes(r.issue_type);
    const matchesStatus = statusFilters.length === 0 || statusFilters.includes(r.status);
    const matchesDate = (
      (!startDate || new Date(r.created_at) >= new Date(startDate)) &&
      (!endDate || new Date(r.created_at) <= new Date(endDate))
    );
    return matchesSearch && matchesIssue && matchesStatus && matchesDate;
  });

  // Sort reports by date
  const displayedReports = [...filteredReports].sort((a, b) => {
    const dateA = new Date(a.created_at);
    const dateB = new Date(b.created_at);
    return sortBy === 'newest' ? dateB - dateA : dateA - dateB;
  });



  const fetchReports = async () => {
  try {
    setLoading(true);
    setError('');
    const { data, error: fetchError } = await supabase
      .from('reports')
      .select('*')
      .order('created_at', { ascending: false });

    if (fetchError) throw fetchError;
    setReports(data || []);
  } catch (err) {
    console.error('Error fetching reports:', err);
    setError(err.message || 'Failed to load reports.');
  } finally {
    setLoading(false);
    setRefreshing(false);
  }
};

// Debounce search input to avoid rapid re‑renders
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 300); // 300ms debounce
    return () => clearTimeout(handler);
  }, [searchQuery]);

  useEffect(() => {
    fetchReports();
  }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchReports();
  };

  const handleResolveStatus = async (id, currentStatus) => {
    const newStatus = currentStatus === 'Resolved' ? 'Pending' : 'Resolved';
    try {
      const { error: updateError } = await supabase
        .from('reports')
        .update({ status: newStatus })
        .eq('id', id);

      if (updateError) throw updateError;
      
      // Update local state
      setReports(prev => prev.map(r => r.id === id ? { ...r, status: newStatus } : r));
    } catch (err) {
      alert('Failed to update status: ' + err.message);
    }
  };

  const handleUpdateReport = async (updatedFields) => {
    if (!selectedReport) return;
    try {
      const { error: updateError } = await supabase
        .from('reports')
        .update(updatedFields)
        .eq('id', selectedReport.id);

      if (updateError) throw updateError;

      // Update local state
      setReports(prev => prev.map(r => r.id === selectedReport.id ? { ...r, ...updatedFields } : r));
      setSelectedReport(prev => ({ ...prev, ...updatedFields }));
      alert('Report updated successfully!');
    } catch (err) {
      alert('Failed to update report: ' + err.message);
    }
  };

  const formatDate = (dateString) => {
    const d = new Date(dateString);
    return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // Helper to determine map pin colors based on issue type
  const getMarkerColor = (type) => {
    switch (type) {
      case 'Pothole': return '#EF4444'; // Red
      case 'Garbage Overflow': return '#F59E0B'; // Yellow
      case 'Streetlight Issue': return '#3B82F6'; // Blue
      default: return '#64748B'; // Gray
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Gov Portal</Text>
          <Text style={styles.headerSubtitle}>Civic Management Dashboard</Text>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.refreshButton} onPress={handleRefresh}>
            <Text style={styles.refreshButtonText}>🔄 Refresh</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.logoutButton} onPress={onLogout}>
            <Text style={styles.logoutButtonText}>Sign Out</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Control Panel (Search, Filters, Date Range, Sort) */}
      <View style={styles.controlPanel}>
        <View style={styles.searchRow}>
          <TextInput
            placeholder="Search by name, phone, description..."
            placeholderTextColor="#94A3B8"
            value={searchQuery}
            onChangeText={setSearchQuery}
            style={styles.searchInput}
          />
        </View>

        {/* Date Filters & Sort Row */}
        <View style={styles.dateAndSortRow}>
          <TextInput
            placeholder="Start: YYYY-MM-DD"
            placeholderTextColor="#94A3B8"
            value={startDate}
            onChangeText={setStartDate}
            style={styles.dateInput}
          />
          <TextInput
            placeholder="End: YYYY-MM-DD"
            placeholderTextColor="#94A3B8"
            value={endDate}
            onChangeText={setEndDate}
            style={styles.dateInput}
          />
          <TouchableOpacity 
            style={styles.sortToggle} 
            onPress={() => setSortBy(prev => prev === 'newest' ? 'oldest' : 'newest')}
          >
            <Text style={styles.sortToggleText}>
              🕒 {sortBy === 'newest' ? 'Newest' : 'Oldest'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Issue Type Chips */}
        <View style={styles.filterRowContainer}>
          <Text style={styles.filterLabel}>Type:</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsScroll}>
            {['Pothole', 'Garbage Overflow', 'Streetlight Issue'].map(type => (
              <TouchableOpacity
                key={type}
                style={[styles.filterChip, issueFilters.includes(type) && styles.filterChipActive]}
                onPress={() => toggleFilter(type, setIssueFilters, issueFilters)}
              >
                <Text style={[styles.filterChipText, issueFilters.includes(type) && styles.filterChipTextActive]}>
                  {type}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Status Chips */}
        <View style={styles.filterRowContainer}>
          <Text style={styles.filterLabel}>Status:</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsScroll}>
            {['Pending', 'Resolved', 'Requires Review'].map(st => (
              <TouchableOpacity
                key={st}
                style={[styles.filterChip, statusFilters.includes(st) && styles.filterChipActive]}
                onPress={() => toggleFilter(st, setStatusFilters, statusFilters)}
              >
                <Text style={[styles.filterChipText, statusFilters.includes(st) && styles.filterChipTextActive]}>
                  {st}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
        
        {/* Reset Filters Option (if any filters active) */}
        {(!!searchQuery || !!startDate || !!endDate || issueFilters.length > 0 || statusFilters.length > 0) && (
          <TouchableOpacity 
            style={styles.clearButton} 
            onPress={() => {
              setSearchQuery('');
              setStartDate('');
              setEndDate('');
              setIssueFilters([]);
              setStatusFilters([]);
            }}
          >
            <Text style={styles.clearButtonText}>Clear All Filters</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Tabs */}
      <View style={styles.tabContainer}>
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'list' && styles.activeTab]}
          onPress={() => setActiveTab('list')}
        >
          <Text style={[styles.tabText, activeTab === 'list' && styles.activeTabText]}>📋 List View ({displayedReports.length})</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'map' && styles.activeTab]}
          onPress={() => setActiveTab('map')}
        >
          <Text style={[styles.tabText, activeTab === 'map' && styles.activeTabText]}>🗺️ Smart Map</Text>
        </TouchableOpacity>
      </View>

      {/* Content */}
      {loading && !refreshing ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#0F172A" />
          <Text style={styles.loadingText}>Loading reports...</Text>
        </View>
      ) : error ? (
        <View style={styles.centered}>
          <Text style={styles.errorText}>⚠️ {error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={fetchReports}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : activeTab === 'list' ? (
        /* LIST VIEW */
        displayedReports.length === 0 ? (
          <View style={styles.centered}>
            <Text style={styles.emptyIcon}>📭</Text>
            <Text style={styles.emptyText}>No issues reported yet.</Text>
            <Text style={styles.emptySubtext}>New citizen complaints will appear here.</Text>
          </View>
        ) : (
          <ScrollView contentContainerStyle={styles.scrollContent}>
            {displayedReports.map((report) => (
              <View key={report.id} style={styles.card}>
                <View style={styles.cardHeader}>
                  <View>
                    <View style={styles.categoryBadgeRow}>
                      <View style={[styles.badge, { backgroundColor: getMarkerColor(report.issue_type) }]}>
                        <Text style={styles.badgeText}>{report.issue_type}</Text>
                      </View>
                      <View style={[
                        styles.statusBadge, 
                        report.status === 'Resolved' ? styles.statusResolved : styles.statusPending
                      ]}>
                        <Text style={[
                          styles.statusBadgeText,
                          report.status === 'Resolved' ? styles.statusResolvedText : styles.statusPendingText
                        ]}>
                          {report.status}
                        </Text>
                      </View>
                    </View>
                    <Text style={styles.cardDate}>{formatDate(report.created_at)}</Text>
                  </View>
                  <TouchableOpacity 
                    style={[
                      styles.actionButton, 
                      report.status === 'Resolved' ? styles.actionButtonReopen : styles.actionButtonResolve
                    ]}
                    onPress={() => handleResolveStatus(report.id, report.status)}
                  >
                    <Text style={styles.actionButtonText}>
                      {report.status === 'Resolved' ? 'Reopen' : '✓ Resolve'}
                    </Text>
                  </TouchableOpacity>
                </View>

                <TouchableOpacity onPress={() => setSelectedReport(report)} activeOpacity={0.85}>
                  {report.image_url ? (
                    <Image source={{ uri: report.image_url }} style={styles.cardImage} resizeMode="cover" />
                  ) : null}

                  <View style={styles.cardBody}>
                    <Text style={styles.reporterTitle}>Reporter Identity:</Text>
                    <Text style={styles.reporterDetails}>{report.reporter_name} ({report.reporter_phone})</Text>

                    {report.description ? (
                      <>
                        <Text style={styles.descriptionTitle}>Description:</Text>
                        <Text style={styles.descriptionText}>{report.description}</Text>
                      </>
                    ) : null}

                    <Text style={styles.locationTitle}>📍 Location:</Text>
                    <Text style={styles.locationText}>
                      {report.location_name || `Lat: ${parseFloat(report.latitude).toFixed(5)}, Lng: ${parseFloat(report.longitude).toFixed(5)}`}
                    </Text>
                  </View>
                </TouchableOpacity>
              </View>
            ))}
          </ScrollView>
        )
      ) : (
        /* MAP VIEW */
        <LeafletMap reports={displayedReports} onMarkerPress={setSelectedReport} />
      )}

      {/* Detail & Action Modal */}
      <Modal
        visible={!!selectedReport}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setSelectedReport(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Report Detail & Action</Text>
              <TouchableOpacity 
                style={styles.modalCloseButton} 
                onPress={() => setSelectedReport(null)}
              >
                <Text style={styles.modalCloseButtonText}>✕</Text>
              </TouchableOpacity>
            </View>

            {selectedReport ? (
              <ScrollView contentContainerStyle={styles.modalScrollContent}>
                {selectedReport.image_url ? (
                  <Image source={{ uri: selectedReport.image_url }} style={styles.modalImage} resizeMode="cover" />
                ) : (
                  <View style={styles.modalNoImage}>
                    <Text style={styles.noImageText}>No Image Evidence Provided</Text>
                  </View>
                )}

                {/* AI Classification Info Card */}
                <View style={styles.sectionCard}>
                  <Text style={styles.sectionCardTitle}>🤖 AI Classification Details</Text>
                  <View style={styles.metaRow}>
                    <Text style={styles.metaLabel}>Suggested Category:</Text>
                    <Text style={styles.metaValue}>{selectedReport.ai_label || 'N/A'}</Text>
                  </View>
                  <View style={styles.metaRow}>
                    <Text style={styles.metaLabel}>Confidence Score:</Text>
                    <Text style={styles.metaValue}>
                      {selectedReport.ai_confidence !== null && selectedReport.ai_confidence !== undefined
                        ? `${(selectedReport.ai_confidence * 100).toFixed(0)}%` 
                        : 'N/A'}
                    </Text>
                  </View>
                  <View style={styles.metaRow}>
                    <Text style={styles.metaLabel}>AI Status:</Text>
                    <View style={[
                      styles.aiStatusBadge, 
                      { backgroundColor: selectedReport.status === 'Requires Review' ? '#FFFBEB' : '#ECFDF5' }
                    ]}>
                      <Text style={[
                        styles.aiStatusText, 
                        { color: selectedReport.status === 'Requires Review' ? '#D97706' : '#059669' }
                      ]}>
                        {selectedReport.status === 'Requires Review' ? 'Requires Human Verification' : 'Verified / High Confidence'}
                      </Text>
                    </View>
                  </View>
                </View>

                {/* Reporter & Issue Info */}
                <View style={styles.sectionCard}>
                  <Text style={styles.sectionCardTitle}>📋 Report Info</Text>
                  <View style={styles.metaRow}>
                    <Text style={styles.metaLabel}>Reporter:</Text>
                    <Text style={styles.metaValue}>{selectedReport.reporter_name} ({selectedReport.reporter_phone})</Text>
                  </View>
                  <View style={styles.metaRow}>
                    <Text style={styles.metaLabel}>Reported At:</Text>
                    <Text style={styles.metaValue}>{formatDate(selectedReport.created_at)}</Text>
                  </View>
                  {selectedReport.location_name && (
                    <View style={styles.metaRow}>
                      <Text style={styles.metaLabel}>Location:</Text>
                      <Text style={styles.metaValue}>{selectedReport.location_name}</Text>
                    </View>
                  )}
                  <View style={styles.metaRow}>
                    <Text style={styles.metaLabel}>Coordinates:</Text>
                    <Text style={styles.metaValue}>
                      Lat: {parseFloat(selectedReport.latitude).toFixed(5)}, Lng: {parseFloat(selectedReport.longitude).toFixed(5)}
                    </Text>
                  </View>
                  {selectedReport.description ? (
                    <View style={styles.descriptionBlock}>
                      <Text style={styles.metaLabel}>Description:</Text>
                      <Text style={styles.modalDescriptionText}>{selectedReport.description}</Text>
                    </View>
                  ) : null}
                </View>

                {/* Admin Actions / Overrides */}
                <View style={styles.sectionCard}>
                  <Text style={styles.sectionCardTitle}>🛡️ Manual Overrides (Admin Action)</Text>
                  
                  {/* Category Selection */}
                  <Text style={styles.overrideLabel}>Override Category:</Text>
                  <View style={styles.overrideRow}>
                    {['Pothole', 'Garbage Overflow', 'Streetlight Issue'].map(type => (
                      <TouchableOpacity
                        key={type}
                        style={[
                          styles.overrideChip,
                          editIssueType === type && styles.overrideChipActive
                        ]}
                        onPress={() => setEditIssueType(type)}
                      >
                        <Text style={[
                          styles.overrideChipText,
                          editIssueType === type && styles.overrideChipTextActive
                        ]}>
                          {type}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  {/* Status Selection */}
                  <Text style={styles.overrideLabel}>Update Workflow Status:</Text>
                  <View style={styles.overrideRow}>
                    {['Pending', 'Resolved', 'Requires Review'].map(st => (
                      <TouchableOpacity
                        key={st}
                        style={[
                          styles.overrideChip,
                          editStatus === st && styles.overrideChipActive
                        ]}
                        onPress={() => setEditStatus(st)}
                      >
                        <Text style={[
                          styles.overrideChipText,
                          editStatus === st && styles.overrideChipTextActive
                        ]}>
                          {st}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                {/* Action Buttons */}
                <View style={styles.modalActionButtons}>
                  <TouchableOpacity 
                    style={styles.modalCancelButton}
                    onPress={() => setSelectedReport(null)}
                  >
                    <Text style={styles.modalCancelButtonText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={styles.modalSaveButton}
                    onPress={() => {
                      handleUpdateReport({
                        issue_type: editIssueType,
                        status: editStatus,
                      });
                      setSelectedReport(null);
                    }}
                  >
                    <Text style={styles.modalSaveButtonText}>Save Changes</Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>
            ) : null}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  controlPanel: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    paddingBottom: 12,
  },
  searchRow: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  searchInput: {
    backgroundColor: '#F1F5F9',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    color: '#0F172A',
  },
  dateAndSortRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  dateInput: {
    flex: 1,
    backgroundColor: '#F1F5F9',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 12,
    color: '#0F172A',
  },
  sortToggle: {
    backgroundColor: '#F1F5F9',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  sortToggleText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0F172A',
  },
  filterRowContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 4,
  },
  filterLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
    width: 60,
  },
  chipsScroll: {
    gap: 8,
    alignItems: 'center',
    paddingRight: 16,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
  },
  filterChipActive: {
    backgroundColor: '#0F172A',
  },
  filterChipText: {
    color: '#0F172A',
    fontSize: 12,
    fontWeight: '600',
  },
  filterChipTextActive: {
    color: '#FFFFFF',
  },
  clearButton: {
    alignSelf: 'flex-end',
    marginHorizontal: 16,
    marginTop: 6,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 6,
    backgroundColor: '#FFF1F2',
    borderWidth: 1,
    borderColor: '#FECDD3',
  },
  clearButtonText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#E11D48',
  },
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    paddingTop: Platform.OS === 'ios' ? 54 : 36,
    paddingBottom: 16,
    paddingHorizontal: 20,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderColor: '#E2E8F0',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0F172A',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '500',
  },
  headerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  refreshButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
  },
  refreshButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#334155',
  },
  logoutButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#EF4444',
    justifyContent: 'center',
  },
  logoutButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderColor: '#E2E8F0',
  },
  tab: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderColor: 'transparent',
  },
  activeTab: {
    borderColor: '#0F172A',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748B',
  },
  activeTabText: {
    color: '#0F172A',
  },
  scrollContent: {
    padding: 16,
    gap: 16,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  loadingText: {
    marginTop: 12,
    color: '#475569',
    fontSize: 14,
    fontWeight: '500',
  },
  errorText: {
    color: '#EF4444',
    fontSize: 15,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 16,
  },
  retryButton: {
    backgroundColor: '#0F172A',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 4,
  },
  emptySubtext: {
    fontSize: 13,
    color: '#64748B',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.02,
    shadowRadius: 8,
    elevation: 2,
  },
  cardHeader: {
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    borderBottomWidth: 1,
    borderColor: '#F1F5F9',
  },
  categoryBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  statusPending: {
    backgroundColor: '#FFFBEB',
    borderColor: '#FEF3C7',
  },
  statusPendingText: {
    color: '#D97706',
  },
  statusResolved: {
    backgroundColor: '#ECFDF5',
    borderColor: '#D1FAE5',
  },
  statusResolvedText: {
    color: '#059669',
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  cardDate: {
    fontSize: 11,
    color: '#94A3B8',
    fontWeight: '500',
  },
  actionButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionButtonResolve: {
    backgroundColor: '#10B981',
  },
  actionButtonReopen: {
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  actionButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  cardImage: {
    width: '100%',
    height: 200,
    backgroundColor: '#F1F5F9',
  },
  cardBody: {
    padding: 16,
    gap: 8,
  },
  reporterTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
    textTransform: 'uppercase',
  },
  reporterDetails: {
    fontSize: 13,
    color: '#334155',
    fontWeight: '600',
  },
  descriptionTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
    textTransform: 'uppercase',
    marginTop: 4,
  },
  descriptionText: {
    fontSize: 14,
    color: '#334155',
    lineHeight: 20,
  },
  locationTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
    textTransform: 'uppercase',
    marginTop: 4,
  },
  locationText: {
    fontSize: 13,
    color: '#475569',
    fontWeight: '500',
  },
  /* Web Map Fallback */
  webMapContainer: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  webMapTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 6,
  },
  webMapSubtitle: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    marginBottom: 20,
  },
  webMarkersList: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 16,
    maxHeight: 300,
  },
  webMarkerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderColor: '#F1F5F9',
  },
  colorDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 12,
  },
  webMarkerInfo: {
    flex: 1,
  },
  webMarkerType: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1E293B',
  },
  webMarkerCoords: {
    fontSize: 11,
    color: '#64748B',
  },
  webMapNoMarkers: {
    textAlign: 'center',
    padding: 24,
    color: '#94A3B8',
    fontStyle: 'italic',
  },
  /* Native Map Styles */
  nativeMapContainer: {
    flex: 1,
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },
  mapEmptyOverlay: {
    position: 'absolute',
    top: 20,
    left: 20,
    right: 20,
    backgroundColor: 'rgba(255,255,255,0.9)',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    zIndex: 100,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  customCallout: {
    width: 220,
  },
  calloutCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  calloutImage: {
    width: '100%',
    height: 80,
    borderRadius: 8,
    marginBottom: 6,
    backgroundColor: '#F1F5F9',
  },
  calloutType: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 2,
  },
  calloutStatus: {
    fontSize: 11,
    fontWeight: '600',
    color: '#10B981',
    marginBottom: 6,
  },
  calloutDetails: {
    fontSize: 12,
    color: '#475569',
    marginBottom: 6,
  },
  calloutTapText: {
    fontSize: 9,
    fontWeight: '500',
    color: '#94A3B8',
    fontStyle: 'italic',
  },
  /* Modal Styles */
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)', // Semi-transparent Slate-900 overlay
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#F8FAFC',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
    width: '100%',
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 18,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
  },
  modalCloseButton: {
    backgroundColor: '#F1F5F9',
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalCloseButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#64748B',
  },
  modalScrollContent: {
    padding: 16,
    gap: 16,
  },
  modalImage: {
    width: '100%',
    height: 220,
    borderRadius: 16,
    backgroundColor: '#E2E8F0',
  },
  modalNoImage: {
    width: '100%',
    height: 120,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#CBD5E1',
  },
  noImageText: {
    fontSize: 13,
    color: '#94A3B8',
    fontWeight: '600',
  },
  sectionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 12,
  },
  sectionCardTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    paddingBottom: 6,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  metaLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
  },
  metaValue: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1E293B',
    textAlign: 'right',
    flex: 1,
  },
  aiStatusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  aiStatusText: {
    fontSize: 11,
    fontWeight: '700',
  },
  descriptionBlock: {
    gap: 6,
    marginTop: 4,
  },
  modalDescriptionText: {
    fontSize: 13,
    color: '#334155',
    lineHeight: 20,
    backgroundColor: '#F8FAFC',
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  overrideLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
    marginTop: 4,
  },
  overrideRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
    marginBottom: 8,
  },
  overrideChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  overrideChipActive: {
    backgroundColor: '#0F172A',
    borderColor: '#0F172A',
  },
  overrideChipText: {
    fontSize: 12,
    color: '#475569',
    fontWeight: '600',
  },
  overrideChipTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  modalActionButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
    marginBottom: 16,
  },
  modalCancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  modalCancelButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#475569',
  },
  modalSaveButton: {
    flex: 2,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#0F172A',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  modalSaveButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
