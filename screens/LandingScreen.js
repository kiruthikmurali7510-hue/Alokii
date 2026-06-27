import React from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Image, Dimensions } from 'react-native';
import { StatusBar } from 'expo-status-bar';

const { width } = Dimensions.get('window');

export default function LandingScreen({ onReportPress, onAdminPress }) {
  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      
      {/* Decorative background shapes */}
      <View style={styles.bubble1} />
      <View style={styles.bubble2} />

      <View style={styles.content}>
        {/* Header/Logo section */}
        <View style={styles.logoContainer}>
          <View style={styles.logoIcon}>
            <Text style={styles.logoText}>🏛️</Text>
          </View>
          <Text style={styles.title}>CivicMap <Text style={styles.titleAccent}>AI</Text></Text>
          <Text style={styles.subtitle}>Empowering citizens to build cleaner, safer, and smarter neighborhoods through instant AI reporting.</Text>
        </View>

        {/* Feature quick badges */}
        <View style={styles.badgeContainer}>
          <View style={styles.badge}><Text style={styles.badgeText}>📸 Snap Photo</Text></View>
          <View style={styles.badge}><Text style={styles.badgeText}>🤖 AI Detect</Text></View>
          <View style={styles.badge}><Text style={styles.badgeText}>📍 Live Map</Text></View>
        </View>

        {/* Action Buttons */}
        <View style={styles.buttonContainer}>
          <TouchableOpacity 
            style={styles.primaryButton}
            onPress={onReportPress}
            activeOpacity={0.85}
          >
            <Text style={styles.primaryButtonText}>🟢 Report an Issue</Text>
            <Text style={styles.primaryButtonSub}>No registration required</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.secondaryButton}
            onPress={onAdminPress}
            activeOpacity={0.85}
          >
            <Text style={styles.secondaryButtonText}>🔒 Government Access</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.footer}>Supported by Municipal Administration</Text>
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
  bubble1: {
    position: 'absolute',
    top: -50,
    right: -50,
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: '#E2F1E8',
    opacity: 0.6,
  },
  bubble2: {
    position: 'absolute',
    bottom: -80,
    left: -80,
    width: 250,
    height: 250,
    borderRadius: 125,
    backgroundColor: '#E0F2FE',
    opacity: 0.6,
  },
  content: {
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
    justifyContent: 'space-between',
    height: '80%',
  },
  logoContainer: {
    alignItems: 'center',
    marginTop: 40,
  },
  logoIcon: {
    width: 80,
    height: 80,
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    // Shadows
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 4,
  },
  logoText: {
    fontSize: 40,
  },
  title: {
    fontSize: 34,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.5,
    marginBottom: 12,
  },
  titleAccent: {
    color: '#10B981',
  },
  subtitle: {
    fontSize: 15,
    color: '#475569',
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: 10,
  },
  badgeContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    flexWrap: 'wrap',
    marginVertical: 20,
    gap: 8,
  },
  badge: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  badgeText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
  },
  buttonContainer: {
    width: '100%',
    gap: 16,
    marginBottom: 40,
  },
  primaryButton: {
    backgroundColor: '#10B981',
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 6,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
  primaryButtonSub: {
    color: '#D1FAE5',
    fontSize: 12,
    marginTop: 2,
    fontWeight: '500',
  },
  secondaryButton: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  secondaryButtonText: {
    color: '#334155',
    fontSize: 16,
    fontWeight: '700',
  },
  footer: {
    fontSize: 12,
    color: '#94A3B8',
    fontWeight: '500',
    marginBottom: 10,
  },
});
