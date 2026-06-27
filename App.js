import React, { useState } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StyleSheet, View } from 'react-native';
import { supabase } from './supabase';
import { runAIPipeline } from './utils/aiOrchestrator';

// Import Screens
import LandingScreen from './screens/LandingScreen';
import LoginScreen from './screens/LoginScreen';
import DashboardScreen from './screens/DashboardScreen';
import ReporterFormScreen from './screens/ReporterFormScreen';
import SuccessScreen from './screens/SuccessScreen';

export default function App() {
  const [currentScreen, setCurrentScreen] = useState('Landing'); // 'Landing', 'Login', 'Dashboard', 'ReporterForm', 'Success'
  const [lastSubmittedReport, setLastSubmittedReport] = useState(null);

  const navigateTo = (screenName) => {
    setCurrentScreen(screenName);
  };

  // Upload local image uri to Supabase Storage
  const uploadImageToStorage = async (imageUri) => {
    try {
      const response = await fetch(imageUri);
      const blob = await response.blob();

      // Extract file extension based on blob type or default to jpg
      let fileExt = 'jpg';
      if (blob.type) {
        const mimeParts = blob.type.split('/');
        if (mimeParts.length === 2) {
          fileExt = mimeParts[1];
        }
      } else {
        const lastDotIndex = imageUri.lastIndexOf('.');
        if (lastDotIndex !== -1) {
          const rawExt = imageUri.substring(lastDotIndex + 1);
          fileExt = rawExt.split('?')[0].split('#')[0].toLowerCase();
        }
      }
      if (fileExt === 'jpeg') fileExt = 'jpg';

      const fileName = `${Date.now()}-${Math.random().toString(36).substring(2, 11)}.${fileExt}`;
      const filePath = `${fileName}`;

      const { data, error } = await supabase.storage
        .from('report-images')
        .upload(filePath, blob, {
          contentType: blob.type || 'image/jpeg',
          cacheControl: '3600',
          upsert: false
        });

      if (error) throw error;

      // Retrieve public URL
      const { data: { publicUrl } } = supabase.storage
        .from('report-images')
        .getPublicUrl(filePath);

      return publicUrl;
    } catch (err) {
      console.error("Storage upload helper error:", err);
      throw new Error("Evidence image upload failed: " + err.message);
    }
  };

  // Submit complete report metadata to database
  const handleReportSubmit = async (reportData) => {
    try {
      // 1. Upload image to Supabase Storage
      const publicImageUrl = await uploadImageToStorage(reportData.imageUri);

      // 3. Run AI Classification Pipeline (MobileNet → Gemini fallback)
      let aiResult = {
        ai_label: null,
        ai_confidence: null,
        status: 'Pending',
      };
      try {
        const pipelineResult = await runAIPipeline(reportData.imageUri);
        aiResult = {
          ai_label: pipelineResult.ai_label,
          ai_confidence: pipelineResult.ai_confidence,
          status: pipelineResult.status, // 'Pending' or 'Requires Review'
        };
        console.log('[App] AI pipeline result:', pipelineResult);
      } catch (aiErr) {
        // AI failure is non-blocking — report still submits with null AI fields
        console.warn('[App] AI pipeline failed non-critically:', aiErr.message);
      }

      // 4. Insert report record into database
      const { data, error } = await supabase
        .from('reports')
        .insert([
          {
            reporter_name: reportData.name,
            reporter_phone: reportData.phone,
            image_url: publicImageUrl,
            description: reportData.description || null,
            latitude: reportData.latitude,
            longitude: reportData.longitude,
            location_name: reportData.locationName || null,
            issue_type: reportData.issueType,
            status: aiResult.status,
            priority_level: 'Medium',
            ai_label: aiResult.ai_label,
            ai_confidence: aiResult.ai_confidence,
          }
        ])
        .select();

      if (error) throw error;

      console.log('[App] Report inserted successfully:', data);

      // Save data for Success Screen
      setLastSubmittedReport({ ...reportData, aiResult });
      navigateTo('Success');
      return true;
    } catch (err) {
      console.error('[App] Full pipeline submission error:', err);
      throw err;
    }
  };

  const renderScreen = () => {
    switch (currentScreen) {
      case 'Landing':
        return (
          <LandingScreen 
            onReportPress={() => navigateTo('ReporterForm')} 
            onAdminPress={() => navigateTo('Login')} 
          />
        );
      case 'Login':
        return (
          <LoginScreen 
            onLoginSuccess={() => navigateTo('Dashboard')} 
            onBack={() => navigateTo('Landing')} 
          />
        );
      case 'Dashboard':
        return (
          <DashboardScreen 
            onLogout={() => navigateTo('Landing')} 
          />
        );
      case 'ReporterForm':
        return (
          <ReporterFormScreen 
            onSubmit={handleReportSubmit}
            onBack={() => navigateTo('Landing')}
          />
        );
      case 'Success':
        return (
          <SuccessScreen 
            reportDetails={lastSubmittedReport}
            onBackHome={() => {
              setLastSubmittedReport(null);
              navigateTo('Landing');
            }}
          />
        );
      default:
        return (
          <LandingScreen 
            onReportPress={() => navigateTo('ReporterForm')} 
            onAdminPress={() => navigateTo('Login')} 
          />
        );
    }
  };

  return (
    <SafeAreaProvider>
      <View style={styles.container}>
        {renderScreen()}
      </View>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
});
