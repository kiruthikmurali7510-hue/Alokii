import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, TextInput, TouchableOpacity, ScrollView, Image, ActivityIndicator, KeyboardAvoidingView, Platform, Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { StatusBar } from 'expo-status-bar';

export default function ReporterFormScreen({ onSubmit, onBack }) {
  // Identity Fields
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  
  // Report Details
  const [image, setImage] = useState(null);
  const [issueType, setIssueType] = useState('Pothole'); // 'Pothole', 'Garbage Overflow', 'Streetlight Issue'
  const [description, setDescription] = useState('');
  
  // Location States
  const [latitude, setLatitude] = useState(null);
  const [longitude, setLongitude] = useState(null);
  const [locationName, setLocationName] = useState('');
  const [detectingLocation, setDetectingLocation] = useState(false);
  const [locationStatus, setLocationStatus] = useState('Not captured'); // 'Not captured', 'Detecting', 'Success', 'Failed'
  
  // App States
  const [submitting, setSubmitting] = useState(false);
  const [validationError, setValidationError] = useState('');


  // Request Permissions on Mount
  useEffect(() => {
    (async () => {
      if (Platform.OS !== 'web') {
        const { status: cameraStatus } = await ImagePicker.requestCameraPermissionsAsync();
        const { status: libraryStatus } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        const { status: locationStatus } = await Location.requestForegroundPermissionsAsync();
        
        if (cameraStatus !== 'granted' || libraryStatus !== 'granted') {
          console.log('Camera or media library permission was denied');
        }
        if (locationStatus === 'granted') {
          // Auto-trigger location detection if permission exists
          handleDetectLocation();
        }
      } else {
        // Fallback for web preview
        handleDetectLocation();
      }
    })();
  }, []);

  // Location Detector
  const handleDetectLocation = async () => {
    setDetectingLocation(true);
    setLocationStatus('Detecting');
    setValidationError('');
    
    try {
      if (Platform.OS === 'web') {
        // Simulate web location
        setTimeout(() => {
          setLatitude(12.9716);
          setLongitude(77.5946);
          setLocationName('MG Road, Bengaluru, Karnataka 560001');
          setLocationStatus('Success');
          setDetectingLocation(false);
        }, 1000);
        return;
      }

      // Request foreground permission
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setLocationStatus('Failed');
        setValidationError('Location access denied. Please enter coordinate fallback details.');
        setDetectingLocation(false);
        return;
      }

      let location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      const lat = location.coords.latitude;
      const lng = location.coords.longitude;
      setLatitude(lat);
      setLongitude(lng);

      // Attempt reverse geocoding to get location name
      let geocode = await Location.reverseGeocodeAsync({
        latitude: lat,
        longitude: lng,
      });

      if (geocode && geocode.length > 0) {
        const addr = geocode[0];
        const formattedAddr = [
          addr.streetNumber,
          addr.street,
          addr.district,
          addr.city,
          addr.region,
          addr.postalCode
        ].filter(Boolean).join(', ');
        
        setLocationName(formattedAddr || `Lat: ${lat.toFixed(4)}, Lng: ${lng.toFixed(4)}`);
      } else {
        setLocationName(`Lat: ${lat.toFixed(4)}, Lng: ${lng.toFixed(4)}`);
      }
      setLocationStatus('Success');
    } catch (err) {
      console.error("Location detection error:", err);
      setLocationStatus('Failed');
      setValidationError('Could not auto-detect location. Please enter custom coordinates.');
    } finally {
      setDetectingLocation(false);
    }
  };

  // Image Pickers
  const pickImage = async (useCamera = false) => {
    setValidationError('');
    try {
      let result;
      const options = {
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      };

      if (useCamera) {
        result = await ImagePicker.launchCameraAsync(options);
      } else {
        result = await ImagePicker.launchImageLibraryAsync(options);
      }

      if (!result.canceled && result.assets && result.assets.length > 0) {
        setImage(result.assets[0].uri);
      }
    } catch (err) {
      console.error("Image pick error:", err);
      setValidationError("Failed to capture image. Please try again.");
    }
  };


  // Validate and Submit
  const handleSubmit = async () => {
    setValidationError('');

    // Input Validations
    if (!name.trim()) {
      setValidationError("Please enter your name.");
      return;
    }
    if (!phone.trim() || phone.length < 8) {
      setValidationError("Please enter a valid contact phone number.");
      return;
    }
    if (!image) {
      setValidationError("Please upload an image of the civic issue.");
      return;
    }
    if (latitude === null || longitude === null) {
      setValidationError("Location coordinates are required. Please trigger GPS or enter manually.");
      return;
    }

    setSubmitting(true);

    try {

      const reportData = {
        name: name.trim(),
        phone: phone.trim(),
        imageUri: image,
        issueType,
        description: description.trim(),
        latitude,
        longitude,
        locationName: locationName.trim() || `Lat: ${latitude.toFixed(5)}, Lng: ${longitude.toFixed(5)}`
      };

      // Call parent submit handler
      const success = await onSubmit(reportData);
    } catch (err) {
      console.error("Submission error:", err);
      setValidationError(err.message || "Failed to submit report. Please check connection and try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <StatusBar style="dark" />
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={onBack} activeOpacity={0.7}>
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Report Civic Issue</Text>
        <View style={{ width: 60 }} />
      </View>
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        {validationError ? (
          <View style={styles.errorBanner}>
            <Text style={styles.errorBannerText}>⚠️ {validationError}</Text>
          </View>
        ) : null}

        {/* Identity Fields */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>1. Reporter Identity</Text>
          <Text style={styles.sectionSubtitle}>Mandatory fields for spam control verification.</Text>
          
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Your Name *</Text>
            <TextInput 
              style={styles.input}
              placeholder="e.g. John Doe"
              placeholderTextColor="#94A3B8"
              value={name}
              onChangeText={(text) => {
                setName(text);
                setValidationError('');
              }}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Phone Number *</Text>
            <TextInput 
              style={styles.input}
              placeholder="e.g. 9876543210"
              placeholderTextColor="#94A3B8"
              keyboardType="phone-pad"
              value={phone}
              onChangeText={(text) => {
                setPhone(text);
                setValidationError('');
              }}
            />
          </View>
        </View>

        {/* Image Upload */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>2. Capture Evidence</Text>
          <Text style={styles.sectionSubtitle}>Provide a clear photo of the issue so AI can analyze it.</Text>
          
          {image ? (
            <View style={styles.imagePreviewContainer}><Image source={{ uri: image }} style={styles.imagePreview} /><TouchableOpacity style={styles.changeImageButton} onPress={() => setImage(null)}><Text style={styles.changeImageButtonText}>✕ Remove Photo</Text></TouchableOpacity></View>
          ) : (
            <View style={styles.imageButtonsRow}>
              <TouchableOpacity 
                style={styles.imageButton} 
                onPress={() => pickImage(true)}
                activeOpacity={0.8}
              >
                <Text style={styles.imageButtonIcon}>📷</Text>
                <Text style={styles.imageButtonText}>Camera</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.imageButton} 
                onPress={() => pickImage(false)}
                activeOpacity={0.8}
              >
                <Text style={styles.imageButtonIcon}>🖼️</Text>
                <Text style={styles.imageButtonText}>Gallery</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Issue Categorization */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>3. Select Issue Type</Text>
          <Text style={styles.sectionSubtitle}>Select the option that matches best.</Text>
          
          <View style={styles.issueGrid}>
            {[
              { id: 'Pothole', emoji: '🕳️', label: 'Pothole', color: '#EF4444' },
              { id: 'Garbage Overflow', emoji: '🗑️', label: 'Garbage Overflow', color: '#F59E0B' },
              { id: 'Streetlight Issue', emoji: '💡', label: 'Streetlight Issue', color: '#3B82F6' },
            ].map((type) => (
              <TouchableOpacity
                key={type.id}
                style={[
                  styles.issueCard,
                  issueType === type.id && { borderColor: type.color, backgroundColor: type.color + '0C' }
                ]}
                onPress={() => setIssueType(type.id)}
                activeOpacity={0.8}
              >
                <Text style={styles.issueCardEmoji}>{type.emoji}</Text>
                <Text style={[styles.issueCardLabel, issueType === type.id && { color: type.color, fontWeight: '700' }]}>
                  {type.label}
                </Text>
                {issueType === type.id ? (
                  <View style={[styles.activeIndicator, { backgroundColor: type.color }]} />
                ) : null}
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Description */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>4. Additional Details</Text>
          <Text style={styles.sectionSubtitle}>Describe any extra context (optional).</Text>
          
          <TextInput 
            style={[styles.input, styles.textArea]}
            placeholder="Describe the issue, landmarks, or level of urgency..."
            placeholderTextColor="#94A3B8"
            multiline
            numberOfLines={4}
            value={description}
            onChangeText={setDescription}
          />
        </View>

        {/* Location Detection */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>5. Location Coordinates</Text>
          <Text style={styles.sectionSubtitle}>Required for maintenance dispatch.</Text>

          {locationStatus === 'Success' && latitude && longitude ? (
            <View style={styles.locationContainer}>
              <View style={styles.locationInfo}>
                <Text style={styles.locationStatusBadge}>🟢 GPS Active</Text>
                <Text style={styles.locationCoordinates}>
                  Lat: {latitude.toFixed(6)}, Lng: {longitude.toFixed(6)}
                </Text>
                <TextInput 
                  style={styles.locationNameInput}
                  value={locationName}
                  onChangeText={setLocationName}
                  placeholder="Enter location name/address"
                  placeholderTextColor="#94A3B8"
                />
              </View>
              <TouchableOpacity style={styles.reDetectButton} onPress={handleDetectLocation} disabled={detectingLocation}>
                <Text style={styles.reDetectButtonText}>🔄 Recapture</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.locationActions}>
              <TouchableOpacity 
                style={[styles.detectLocationButton, detectingLocation && styles.disabledButton]}
                onPress={handleDetectLocation}
                disabled={detectingLocation}
                activeOpacity={0.8}
              >
                {detectingLocation ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.detectLocationButtonText}>📍 Auto-Detect Location</Text>
                )}
              </TouchableOpacity>

              {locationStatus === 'Failed' ? (
                <View style={styles.fallbackLocationGroup}>
                  <Text style={styles.fallbackLabel}>Enter Latitude/Longitude Manually</Text>
                  <View style={styles.coordsRow}>
                    <TextInput 
                      style={[styles.input, styles.coordInput]} 
                      placeholder="Latitude (e.g. 12.971)"
                      placeholderTextColor="#94A3B8"
                      keyboardType="numeric"
                      onChangeText={(v) => setLatitude(parseFloat(v) || null)}
                    />
                    <TextInput 
                      style={[styles.input, styles.coordInput]} 
                      placeholder="Longitude (e.g. 77.594)"
                      placeholderTextColor="#94A3B8"
                      keyboardType="numeric"
                      onChangeText={(v) => setLongitude(parseFloat(v) || null)}
                    />
                  </View>
                </View>
              ) : null}
            </View>
          )}
        </View>

        {/* Submit */}
        <TouchableOpacity 
          style={[styles.submitButton, submitting && styles.submitButtonDisabled]}
          onPress={handleSubmit}
          disabled={submitting}
          activeOpacity={0.85}
        >
          {submitting ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Text style={styles.submitButtonText}>🚀 Submit Report Now</Text>
          )}
        </TouchableOpacity>
        
        <View style={{ height: 40 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
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
  backButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  backButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#64748B',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
  },
  scrollContent: {
    padding: 16,
  },
  errorBanner: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FEE2E2',
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
  },
  errorBannerText: {
    color: '#EF4444',
    fontSize: 13,
    fontWeight: '600',
  },
  section: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 16,
    marginBottom: 16,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.01,
    shadowRadius: 4,
    elevation: 1,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 2,
  },
  sectionSubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginBottom: 14,
    fontWeight: '500',
  },
  inputGroup: {
    marginBottom: 12,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
    marginBottom: 6,
  },
  input: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    fontSize: 14,
    color: '#0F172A',
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  imageButtonsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  imageButton: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderStyle: 'dashed',
    borderRadius: 12,
    paddingVertical: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  imageButtonIcon: {
    fontSize: 24,
    marginBottom: 4,
  },
  imageButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#475569',
  },
  imagePreviewContainer: {
    width: '100%',
    height: 200,
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative',
  },
  imagePreview: {
    width: '100%',
    height: '100%',
    backgroundColor: '#F1F5F9',
  },
  changeImageButton: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  changeImageButtonText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  issueGrid: {
    flexDirection: 'row',
    gap: 8,
  },
  issueCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  issueCardEmoji: {
    fontSize: 22,
    marginBottom: 6,
  },
  issueCardLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
    textAlign: 'center',
    paddingHorizontal: 4,
  },
  activeIndicator: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 4,
  },
  locationContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0',
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
  },
  locationInfo: {
    flex: 1,
    marginRight: 12,
  },
  locationStatusBadge: {
    color: '#059669',
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 4,
  },
  locationCoordinates: {
    color: '#047857',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 6,
  },
  locationNameInput: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D1FAE5',
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 10,
    fontSize: 12,
    color: '#0F172A',
  },
  reDetectButton: {
    backgroundColor: '#FFFFFF',
    borderColor: '#A7F3D0',
    borderWidth: 1,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  reDetectButtonText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#059669',
  },
  locationActions: {
    gap: 12,
  },
  detectLocationButton: {
    backgroundColor: '#0F172A',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabledButton: {
    opacity: 0.7,
  },
  detectLocationButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  fallbackLocationGroup: {
    marginTop: 8,
  },
  fallbackLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
    marginBottom: 6,
  },
  coordsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  coordInput: {
    flex: 1,
  },
  submitButton: {
    backgroundColor: '#10B981',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 4,
    marginTop: 8,
  },
  submitButtonDisabled: {
    opacity: 0.7,
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
});
