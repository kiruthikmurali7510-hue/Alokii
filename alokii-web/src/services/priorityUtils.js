// src/services/priorityUtils.js

/**
 * Gets the severity score for an issue category
 * @param {string} issueType 
 * @returns {number}
 */
export function getIssueSeverityScore(issueType) {
  const normalized = (issueType || '').toLowerCase();
  if (normalized === 'pothole') return 90;
  if (normalized === 'garbage overflow') return 80;
  return 40; // Other
}

/**
 * Gets the road importance score based on classification
 * @param {string} roadType 
 * @returns {number}
 */
export function getRoadImportanceScore(roadType) {
  const normalized = (roadType || '').toLowerCase();
  if (normalized === 'main road') return 100;
  if (normalized === 'medium road') return 70;
  if (normalized === 'local road') return 40;
  return 50; // Unknown
}

/**
 * Calculates the waiting time score dynamically based on age of report
 * @param {string|Date} createdAt 
 * @returns {number}
 */
export function getTimeWaitingScore(createdAt) {
  if (!createdAt) return 20; // Default to new
  const createdDate = new Date(createdAt);
  const now = new Date();
  const diffMs = now - createdDate;
  const diffHours = diffMs / (1000 * 60 * 60);

  if (diffHours < 1) return 20;
  if (diffHours < 6) return 40;
  if (diffHours < 24) return 60;
  if (diffHours < 72) return 80; // 1-3 days (24 to 72 hours)
  return 100; // More than 3 days (> 72 hours)
}

/**
 * Formats duration of wait time for display
 * @param {string|Date} createdAt 
 * @returns {string}
 */
export function getTimeWaitingDisplay(createdAt) {
  if (!createdAt) return '0 hours';
  const createdDate = new Date(createdAt);
  const now = new Date();
  const diffMs = now - createdDate;
  const diffHours = diffMs / (1000 * 60 * 60);

  if (diffHours < 1) {
    const mins = Math.max(1, Math.round(diffMs / (1000 * 60)));
    return `${mins} min${mins > 1 ? 's' : ''}`;
  }
  if (diffHours < 24) {
    const hrs = Math.round(diffHours);
    return `${hrs} hour${hrs > 1 ? 's' : ''}`;
  }
  const days = Math.round(diffHours / 24);
  return `${days} day${days > 1 ? 's' : ''}`;
}

/**
 * Computes Priority Score and Priority Level dynamically.
 *
 * Priority Score =
 *   (Road Importance × 0.25) +
 *   (Issue Severity  × 0.25) +
 *   (Time Waiting    × 0.20) +
 *   (Nearby Risk     × 0.20) +
 *   (AI Confidence   × 0.10)
 *
 * @param {number} aiConfidence  - Float from 0 to 1 (or 0 to 100)
 * @param {string} issueType     - Pothole, Garbage Overflow, Other
 * @param {string} roadType      - Main Road, Medium Road, Local Road, Unknown
 * @param {string|Date} createdAt
 * @param {number} nearbyRiskScore - 0-60 from analyzeNearbyPlaces (default 30 if unknown)
 * @returns {object}
 */
export function calculatePriority(aiConfidence, issueType, roadType, createdAt, nearbyRiskScore = 30) {
  // Normalize AI confidence to 0-100
  let aiScore = 0;
  if (aiConfidence !== null && aiConfidence !== undefined) {
    aiScore = aiConfidence <= 1 ? aiConfidence * 100 : aiConfidence;
  }

  const severityScore = getIssueSeverityScore(issueType);
  const roadScore     = getRoadImportanceScore(roadType);
  const timeScore     = getTimeWaitingScore(createdAt);

  // Clamp nearbyRiskScore to 0-60 range for safety
  const nearbyScore = Math.min(60, Math.max(0, nearbyRiskScore ?? 30));

  // New weighted formula
  const priorityScore = Math.round(
    (roadScore    * 0.25) +
    (severityScore * 0.25) +
    (timeScore    * 0.20) +
    (nearbyScore  * 0.20) +
    (aiScore      * 0.10)
  );

  let priorityLevel = 'Low Priority';
  if (priorityScore >= 70) {
    priorityLevel = 'High Priority';
  } else if (priorityScore >= 45) {
    priorityLevel = 'Medium Priority';
  }

  return {
    priorityScore,
    priorityLevel,
    severityScore,
    roadScore,
    timeScore,
    nearbyScore,
    timeDisplay: getTimeWaitingDisplay(createdAt)
  };
}


/**
 * Generates a human-friendly explanation of why a report has its priority level/score
 * @param {string} priorityLevel 
 * @param {number} aiConfidence 
 * @param {string} issueType 
 * @param {string} roadType 
 * @param {string} timeDisplay 
 * @returns {string}
 */
export function getPriorityExplanation(priorityLevel, aiConfidence, issueType, roadType, timeDisplay) {
  const levelText = priorityLevel.replace(' Priority', '').toLowerCase(); // high, medium, low
  const issueText = (issueType || 'civic issue').toLowerCase();
  
  const isHighConf = aiConfidence && (aiConfidence <= 1 ? aiConfidence >= 0.8 : aiConfidence >= 80);
  const isMajorRoad = (roadType || '').toLowerCase() === 'main road' || (roadType || '').toLowerCase() === 'medium road';
  const hasWaitedLong = timeDisplay.includes('day') || (timeDisplay.includes('hour') && parseInt(timeDisplay) >= 6);

  let reasons = [];
  
  if (isHighConf) {
    reasons.push("was detected with high confidence");
  } else {
    reasons.push("was detected by AI");
  }
  
  if (isMajorRoad) {
    reasons.push(`is located on a ${roadType.toLowerCase()}`);
  } else {
    reasons.push(`is located on a ${roadType ? roadType.toLowerCase() : 'local road'}`);
  }
  
  if (hasWaitedLong) {
    reasons.push(`has remained unresolved for a long time (${timeDisplay})`);
  } else {
    reasons.push(`was reported relatively recently (${timeDisplay} ago)`);
  }

  // Combine reasons grammatically
  return `${priorityLevel} because this ${issueText} ${reasons[0]}, ${reasons[1]}, and ${reasons[2]}.`;
}
