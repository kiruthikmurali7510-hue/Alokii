/**
 * AI ORCHESTRATOR — Central Backend Delegation Pipeline
 *
 * Flow:
 * Image
 *   │
 *   ▼
 * Flask Backend (/analyze-image)
 *   ├── Runs Roboflow Pothole Detection ("pothole-detection-i00zy/2")
 *   ├── Runs Roboflow Garbage Detection ("garbage-can-overflow/1")
 *   ├── Compares confidences in parallel
 *   └── Returns: { label: "pothole"|"garbage_overflow"|"unknown", confidence: number }
 *
 * Auto-acceptance Threshold (Frontend):
 * - >= 0.70 confidence: Auto-accept (Pending status)
 * - < 0.70 confidence or "unknown": Flag for review (Requires Review status)
 */

export const runAIPipeline = async (imageUri) => {
  console.log('[AIOrchestrator] Starting AI classification pipeline via backend...');
  
  try {
    // 1. Fetch the image blob from the local URI
    const response = await fetch(imageUri);
    if (!response.ok) throw new Error(`Failed to fetch local image: ${response.status}`);
    const blob = await response.blob();
    
    // 2. Construct FormData for multipart/form-data upload
    const formData = new FormData();
    const fileType = blob.type || 'image/jpeg';
    const extension = fileType.split('/')[1] || 'jpg';
    formData.append('image', blob, `image.${extension}`);
    
    // 3. POST to Flask backend
    console.log('[AIOrchestrator] Sending request to Flask /analyze-image endpoint...');
    const apiResponse = await fetch("https://alokii.onrender.com/analyze-image", {
      method: 'POST',
      body: formData,
    });
    
    if (!apiResponse.ok) {
      const errText = await apiResponse.text();
      throw new Error(`Backend API error ${apiResponse.status}: ${errText}`);
    }
    
    const result = await apiResponse.json();
    console.log('[AIOrchestrator] Backend response:', result);
    
    const { label, confidence } = result;
    
    // Map response labels to frontend canonical issue types
    let ai_label = 'UNKNOWN';
    if (label === 'pothole') {
      ai_label = 'Pothole';
    } else if (label === 'garbage_overflow') {
      ai_label = 'Garbage Overflow';
    }
    
    const CONFIDENCE_THRESHOLD = 0.70;
    
    if (ai_label !== 'UNKNOWN') {
      if (confidence >= CONFIDENCE_THRESHOLD) {
        console.log(`[AIOrchestrator] ✅ Auto-accepted via Roboflow Backend: ${ai_label} (${(confidence * 100).toFixed(1)}%)`);
        return {
          ai_label,
          ai_confidence: confidence,
          ai_source: 'Roboflow Backend',
          status: 'Pending',
          autoAccepted: true,
        };
      } else {
        console.log(`[AIOrchestrator] ⚠️ Low confidence (${(confidence * 100).toFixed(1)}%) — flagging for review.`);
        return {
          ai_label,
          ai_confidence: confidence,
          ai_source: 'Roboflow Backend',
          status: 'Requires Review',
          autoAccepted: false,
        };
      }
    }
    
    return {
      ai_label: 'UNKNOWN',
      ai_confidence: confidence || 0.0,
      ai_source: 'Roboflow Backend',
      status: 'Requires Review',
      autoAccepted: false,
    };
    
  } catch (err) {
    console.error('[AIOrchestrator] Pipeline fatal error:', err.message);
    return {
      ai_label: 'UNKNOWN',
      ai_confidence: 0.0,
      ai_source: 'None',
      status: 'Requires Review',
      autoAccepted: false,
    };
  }
};
