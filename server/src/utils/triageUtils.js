/**
 * triageUtils.js
 *
 * Automated priority triage algorithm for incoming animal rescue requests.
 * Evaluates animal vulnerability, trauma level, and risk environment.
 */

const CRITICAL_KEYWORDS = [
  'bleeding', 'hit and run', 'hit & run', 'accident', 'unconscious',
  'crushed', 'choking', 'convulsion', 'poison', 'highway', 'train track',
  'severe trauma', 'dying', 'cannot breathe'
];

const HIGH_KEYWORDS = [
  'fracture', 'broken leg', 'broken bone', 'open wound', 'deep cut',
  'trapped in drain', 'stuck in well', 'hypothermia', 'severe infection',
  'maggots', 'paralyzed', 'newborn puppy', 'tiny kitten'
];

/**
 * Calculates priority level based on animal type, emergency category, and description.
 *
 * @param {string} animalType
 * @param {string} emergencyType
 * @param {string} description
 * @returns {'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'}
 */
const calculatePriority = (animalType = '', emergencyType = '', description = '') => {
  const text = `${emergencyType} ${description}`.toLowerCase();
  const animal = animalType.toLowerCase();

  let score = 20;

  // 1. Domestic/vulnerable animal baseline
  if (/dog|cat|pup|kitten|cattle|cow|calf/i.test(animal)) {
    score += 10;
  }

  // 2. Keyword condition weighting
  if (CRITICAL_KEYWORDS.some((kw) => text.includes(kw))) {
    score += 60;
  } else if (HIGH_KEYWORDS.some((kw) => text.includes(kw))) {
    score += 35;
  }

  // 3. Emergency Type category
  if (/critical|emergency|accident|trauma/i.test(emergencyType)) {
    score += 20;
  } else if (/injured|trapped|sick/i.test(emergencyType)) {
    score += 10;
  } else if (/abandoned|stray/i.test(emergencyType)) {
    score += 10;
  }

  // 4. Wildlife/raptor handling
  if (/wildlife|bird|raptor|owl|eagle|snake/i.test(animal)) {
    score += 10;
  }

  // Final classification mapping
  if (score >= 80) return 'CRITICAL';
  if (score >= 50) return 'HIGH';
  if (score >= 30) return 'MEDIUM';
  return 'LOW';
};

module.exports = {
  calculatePriority,
};
