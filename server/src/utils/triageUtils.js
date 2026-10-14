/**
 * triageUtils.js
 *
 * Automated emergency prioritization engine for RescueLink.
 * Calculates Triage Urgency Score (TUS):
 *
 *   TUS = Animal Risk Weight + Condition Severity Weight + Location Risk Weight
 *
 * DISCLAIMER & LIMITATIONS:
 * This scoring algorithm supports operational dispatch prioritization and SLA urgency routing.
 * It is NOT a clinical or veterinary diagnosis. In real-world emergency responses, responders
 * and veterinarians must perform on-site clinical assessment.
 */

// ─── Explicit Weight Configurations ──────────────────────────────────────────

const WEIGHT_CONFIG = {
  ANIMAL: {
    NEONATAL_OR_INFANT: 30, // puppy, kitten, calf, infant, newborn
    VULNERABLE_DOMESTIC: 25, // dog, cat, cattle, cow
    WILDLIFE_RAPTOR: 25,    // eagle, owl, hawk, raptor, snake, monkey, wildlife
    SMALL_OR_BIRD: 20,      // bird, rabbit, squirrel, pigeon
    UNCERTAIN_DEFAULT: 20,  // safe fallback — never penalize missing/unspecified animal
    MINIMUM_BASE: 10,
  },
  CONDITION: {
    CRITICAL_TRAUMA: 50,    // arterial bleeding, unconscious, crushed, convulsing, choking, dying, severe trauma
    HIGH_TRAUMA: 35,        // deep cut, open wound, fracture, broken bone, maggots, paralyzed, severe burn
    MODERATE_DISTRESS: 20,  // trapped, stuck in drain, dehydrated, moderate wound, sick
    MINOR_DISTRESS: 10,     // abandoned, stray wandering, skin rash
    UNCERTAIN_DEFAULT: 25,  // safe baseline for vague descriptions
  },
  LOCATION_RISK: {
    EXTREME_HAZARD: 25,     // highway, expressway, freeway, train track, railway, open drain, deep ditch, well, fast traffic
    MODERATE_HAZARD: 15,    // busy road, traffic junction, construction site, crowded market
    RESIDENTIAL_STANDARD: 10, // street, park, neighborhood, backyard
    UNCERTAIN_DEFAULT: 10,  // safe baseline
    MINIMUM_BASE: 5,
  },
  THRESHOLDS: {
    CRITICAL: 75,
    HIGH: 55,
    MEDIUM: 35,
    LOW: 0,
  },
};

// ─── Keyword Mappings ─────────────────────────────────────────────────────────

const CRITICAL_CONDITION_KEYWORDS = [
  'bleeding', 'arterial bleeding', 'blood loss', 'hit and run', 'hit & run', 'accident',
  'collision', 'vehicle hit', 'unconscious', 'crushed', 'choking', 'convulsion',
  'poison', 'dying', 'cannot breathe', 'severe trauma', 'crushed leg', 'head injury'
];

const HIGH_CONDITION_KEYWORDS = [
  'fracture', 'broken leg', 'broken bone', 'open wound', 'deep cut', 'deep wound',
  'maggots', 'paralyzed', 'hypothermia', 'severe infection', 'burn', 'badly injured',
  'trapped in drain', 'stuck in well', 'drain'
];

const MODERATE_CONDITION_KEYWORDS = [
  'injured', 'trapped', 'stuck', 'sick', 'dehydrated', 'fever', 'weak', 'limping',
  'starving', 'unable to move'
];

const EXTREME_LOCATION_KEYWORDS = [
  'highway', 'expressway', 'freeway', 'train track', 'railway', 'tracks',
  'open drain', 'storm drain', 'sewage', 'deep well', 'river', 'lake',
  'high-speed', 'busy highway', 'flyover', 'bridge'
];

const MODERATE_LOCATION_KEYWORDS = [
  'main road', 'busy road', 'junction', 'traffic', 'market', 'construction site',
  'crossroad', 'signals'
];

/**
 * Computes Animal Risk Weight (W_animal: 10 to 30)
 */
const calculateAnimalRiskWeight = (animalType = '') => {
  if (!animalType || typeof animalType !== 'string' || !animalType.trim()) {
    return WEIGHT_CONFIG.ANIMAL.UNCERTAIN_DEFAULT;
  }

  const a = animalType.toLowerCase().trim();

  // 1. Neonatal / vulnerable young animals
  if (/newborn|infant|puppy|pup|kitten|calf|chick|baby/i.test(a)) {
    return WEIGHT_CONFIG.ANIMAL.NEONATAL_OR_INFANT;
  }

  // 2. High-vulnerability domestic
  if (/dog|cat|cow|cattle|bull|horse|donkey/i.test(a)) {
    return WEIGHT_CONFIG.ANIMAL.VULNERABLE_DOMESTIC;
  }

  // 3. Wildlife / raptor / protected
  if (/wildlife|bird|raptor|owl|eagle|hawk|snake|monkey|deer/i.test(a)) {
    return WEIGHT_CONFIG.ANIMAL.WILDLIFE_RAPTOR;
  }

  // 4. Small domestic / birds
  if (/pigeon|crow|squirrel|rabbit|hamster/i.test(a)) {
    return WEIGHT_CONFIG.ANIMAL.SMALL_OR_BIRD;
  }

  return WEIGHT_CONFIG.ANIMAL.UNCERTAIN_DEFAULT;
};

/**
 * Computes Condition Severity Weight (W_condition: 10 to 50)
 */
const calculateConditionSeverityWeight = (emergencyType = '', description = '') => {
  const text = `${emergencyType || ''} ${description || ''}`.toLowerCase().trim();

  if (!text) {
    return WEIGHT_CONFIG.CONDITION.UNCERTAIN_DEFAULT;
  }

  // 1. Check critical condition keywords or emergency type
  if (
    CRITICAL_CONDITION_KEYWORDS.some((kw) => text.includes(kw)) ||
    /critical|accident|collision|emergency/i.test(emergencyType)
  ) {
    return WEIGHT_CONFIG.CONDITION.CRITICAL_TRAUMA;
  }

  // 2. Check high severity keywords
  if (
    HIGH_CONDITION_KEYWORDS.some((kw) => text.includes(kw)) ||
    /fracture|wound|severe/i.test(emergencyType)
  ) {
    return WEIGHT_CONFIG.CONDITION.HIGH_TRAUMA;
  }

  // 3. Check moderate severity
  if (
    MODERATE_CONDITION_KEYWORDS.some((kw) => text.includes(kw)) ||
    /injured|trapped|sick/i.test(emergencyType)
  ) {
    return WEIGHT_CONFIG.CONDITION.MODERATE_DISTRESS;
  }

  // 4. Check minor/abandoned
  if (/abandoned|stray|wander|healthy/i.test(emergencyType) || /abandoned/i.test(text)) {
    return WEIGHT_CONFIG.CONDITION.MINOR_DISTRESS;
  }

  return WEIGHT_CONFIG.CONDITION.UNCERTAIN_DEFAULT;
};

/**
 * Computes Location Risk Weight (W_location_risk: 5 to 25)
 */
const calculateLocationRiskWeight = (locationAddress = '', description = '') => {
  const text = `${locationAddress || ''} ${description || ''}`.toLowerCase().trim();

  if (!text) {
    return WEIGHT_CONFIG.LOCATION_RISK.UNCERTAIN_DEFAULT;
  }

  if (EXTREME_LOCATION_KEYWORDS.some((kw) => text.includes(kw))) {
    return WEIGHT_CONFIG.LOCATION_RISK.EXTREME_HAZARD;
  }

  if (MODERATE_LOCATION_KEYWORDS.some((kw) => text.includes(kw))) {
    return WEIGHT_CONFIG.LOCATION_RISK.MODERATE_HAZARD;
  }

  return WEIGHT_CONFIG.LOCATION_RISK.RESIDENTIAL_STANDARD;
};

/**
 * Maps numeric score (0 - 100) to Priority Urgency Category
 */
const mapScoreToCategory = (score) => {
  if (score >= WEIGHT_CONFIG.THRESHOLDS.CRITICAL) return 'CRITICAL';
  if (score >= WEIGHT_CONFIG.THRESHOLDS.HIGH) return 'HIGH';
  if (score >= WEIGHT_CONFIG.THRESHOLDS.MEDIUM) return 'MEDIUM';
  return 'LOW';
};

/**
 * Evaluates the full Triage Urgency Score (TUS)
 *
 * @param {Object} params
 * @param {string} params.animalType
 * @param {string} params.emergencyType
 * @param {string} params.description
 * @param {string} [params.locationAddress]
 * @returns {Object} Comprehensive TUS evaluation with breakdown
 */
const evaluateTriage = ({
  animalType = '',
  emergencyType = '',
  description = '',
  locationAddress = '',
} = {}) => {
  const animalRisk = calculateAnimalRiskWeight(animalType);
  const conditionSeverity = calculateConditionSeverityWeight(emergencyType, description);
  const locationRisk = calculateLocationRiskWeight(locationAddress, description);

  // Raw sum and normalization
  const rawSum = animalRisk + conditionSeverity + locationRisk;
  const score = Math.min(100, Math.max(0, rawSum));
  const priority = mapScoreToCategory(score);

  return {
    score,
    priority,
    breakdown: {
      animalRisk,
      conditionSeverity,
      locationRisk,
    },
    scoringInputs: {
      animalType: typeof animalType === 'string' ? animalType.trim() : '',
      emergencyType: typeof emergencyType === 'string' ? emergencyType.trim() : '',
      description: typeof description === 'string' ? description.trim() : '',
      locationAddress: typeof locationAddress === 'string' ? locationAddress.trim() : '',
    },
    calculatedAt: new Date(),
    disclaimer: 'Operational dispatch prioritization score; not a veterinary clinical diagnosis.',
  };
};

/**
 * Backward compatibility wrapper returning just the priority string
 */
const calculatePriority = (animalType = '', emergencyType = '', description = '', locationAddress = '') => {
  const result = evaluateTriage({ animalType, emergencyType, description, locationAddress });
  return result.priority;
};

module.exports = {
  WEIGHT_CONFIG,
  calculateAnimalRiskWeight,
  calculateConditionSeverityWeight,
  calculateLocationRiskWeight,
  mapScoreToCategory,
  evaluateTriage,
  calculatePriority,
};
