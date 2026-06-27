import React from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Dimensions } from 'react-native';
import { StatusBar } from 'expo-status-bar';

const { width } = Dimensions.get('window');

export default function SuccessScreen({ reportDetails, onBackHome }) {
  const formatDate = () => {
    return new Date().toLocaleDateString() + ' ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />

      {/* Background soft circle */}
      <View style={styles.successGlow} />

      <View style={styles.content}>
        {/* Success Icon */}
        <View style={styles.iconContainer}>
          <Text style={styles.checkmarkIcon}>🎉</Text>
        </View>

        <Text style={styles.title}>Report Filed Successfully!</Text>
        <Text style={styles.subtitle}>
          Thank you for reporting. Your submission has been securely logged and mapped on our government dispatch grid.
        </Text>

        {/* Summary Card */}
        {reportDetails ? (
          <View style={styles.summaryCard}>
            <Text style={styles.summaryTitle}>Report Details</Text>
            
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Issue Type:</Text>
              <Text style={styles.summaryValue}>{reportDetails.issueType}</Text>
            </View>

            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Location:</Text>
              <Text style={styles.summaryValue} numberOfLines={1}>
                {reportDetails.locationName || `Lat: ${reportDetails.latitude?.toFixed(4)}, Lng: ${reportDetails.longitude?.toFixed(4)}`}
              </Text>
            </View>

            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Reporter:</Text>
              <Text style={styles.summaryValue}>{reportDetails.name}</Text>
            </View>

            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Submitted:</Text>
              <Text style={styles.summaryValue}>{formatDate()}</Text>
            </View>
          </View>
        ) : null}

        {/* Action Button */}
        <TouchableOpacity 
          style={styles.homeButton}
          onPress={onBackHome}
          activeOpacity={0.8}
        >
          <Text style={styles.homeButtonText}>Back to Home Screen</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  successGlow: {
    position: 'absolute',
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: '#ECFDF5',
    opacity: 0.8,
    zIndex: -1,
  },
  content: {
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
  },
  iconContainer: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: '#D1FAE5',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 3,
  },
  checkmarkIcon: {
    fontSize: 48,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: '#0F172A',
    textAlign: 'center',
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 14,
    color: '#475569',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 32,
    paddingHorizontal: 12,
  },
  summaryCard: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 16,
    padding: 16,
    marginBottom: 32,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.02,
    shadowRadius: 6,
    elevation: 2,
  },
  summaryTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
    borderBottomWidth: 1,
    borderColor: '#F1F5F9',
    paddingBottom: 8,
    marginBottom: 12,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  summaryLabel: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '500',
  },
  summaryValue: {
    fontSize: 13,
    color: '#334155',
    fontWeight: '700',
    maxWidth: '65%',
  },
  homeButton: {
    backgroundColor: '#10B981',
    borderRadius: 12,
    paddingVertical: 15,
    paddingHorizontal: 24,
    width: '100%',
    alignItems: 'center',
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 3,
  },
  homeButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});
