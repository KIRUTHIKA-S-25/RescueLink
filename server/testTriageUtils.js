/**
 * testTriageUtils.js
 *
 * Dedicated unit test suite for Emergency Triage Urgency Scoring (Phase 2):
 * - Minimum, Maximum, Boundary, Invalid, and Emergency scenarios
 * - 3-component breakdown calculation (W_animal + W_condition + W_location_risk)
 * - Safe handling of missing/uncertain data
 */

const {
  evaluateTriage,
  calculatePriority,
  WEIGHT_CONFIG,
} = require('./src/utils/triageUtils');

let passed = 0;
let failed = 0;

const assert = (condition, title) => {
  if (condition) {
    console.log(`✅ PASS: ${title}`);
    passed++;
  } else {
    console.error(`❌ FAIL: ${title}`);
    failed++;
  }
};

console.log('─── Phase 2: Emergency Triage Urgency Scoring Unit Tests ───\n');

// 1. Extreme Critical Emergency Scenario (Max weights)
console.log('▶ Test Suite 1: Critical Emergency (Hit & Run on Highway)');
const criticalTriage = evaluateTriage({
  animalType: 'Newborn puppy',
  emergencyType: 'Accident',
  description: 'Vehicle collision, severe arterial bleeding, unconscious on main highway',
  locationAddress: 'NH-45 Express Highway Bypass',
});

assert(criticalTriage.score >= 75, `Critical score >= 75 (got ${criticalTriage.score})`);
assert(criticalTriage.priority === 'CRITICAL', `Critical priority mapped correctly (got ${criticalTriage.priority})`);
assert(criticalTriage.breakdown.animalRisk === 30, `Neonatal animal risk is 30 (got ${criticalTriage.breakdown.animalRisk})`);
assert(criticalTriage.breakdown.conditionSeverity === 50, `Critical trauma severity is 50 (got ${criticalTriage.breakdown.conditionSeverity})`);
assert(criticalTriage.breakdown.locationRisk === 25, `Highway extreme hazard is 25 (got ${criticalTriage.breakdown.locationRisk})`);

// 2. High Urgency Scenario
console.log('\n▶ Test Suite 2: High Urgency (Fracture on Residential Street)');
const highTriage = evaluateTriage({
  animalType: 'Stray Dog',
  emergencyType: 'Injured',
  description: 'Broken leg with deep cut, limping and in pain',
  locationAddress: 'Residential street near neighborhood park',
});

assert(highTriage.score >= 55 && highTriage.score < 75, `High urgency score in range [55, 74] (got ${highTriage.score})`);
assert(highTriage.priority === 'HIGH', `High priority mapped correctly (got ${highTriage.priority})`);
assert(highTriage.breakdown.animalRisk === 25, `Domestic dog risk is 25 (got ${highTriage.breakdown.animalRisk})`);
assert(highTriage.breakdown.conditionSeverity === 35, `Fracture/cut condition is 35 (got ${highTriage.breakdown.conditionSeverity})`);
assert(highTriage.breakdown.locationRisk === 10, `Residential location risk is 10 (got ${highTriage.breakdown.locationRisk})`);

// 3. Medium Urgency Scenario
console.log('\n▶ Test Suite 3: Medium Urgency (Sick / Dehydrated)');
const mediumTriage = evaluateTriage({
  animalType: 'Cat',
  emergencyType: 'Sick',
  description: 'Dehydrated and weak kitten unable to walk in garden',
  locationAddress: 'Residential Colony Garden',
});

assert(mediumTriage.score >= 35 && mediumTriage.score < 75, `Medium urgency score in range [35, 74] (got ${mediumTriage.score})`);
assert(mediumTriage.priority === 'HIGH' || mediumTriage.priority === 'MEDIUM', `Priority is non-critical (got ${mediumTriage.priority})`);

// 4. Low Urgency Scenario (Healthy stray wandering)
console.log('\n▶ Test Suite 4: Low Urgency Scenario');
const lowTriage = evaluateTriage({
  animalType: 'Pigeon',
  emergencyType: 'Abandoned',
  description: 'Harmless stray bird resting in quiet residential park',
  locationAddress: 'Apartment quiet terrace',
});

assert(lowTriage.score <= 50, `Low urgency score <= 50 (got ${lowTriage.score})`);
assert(lowTriage.breakdown.conditionSeverity === 10, `Abandoned / minor condition is 10 (got ${lowTriage.breakdown.conditionSeverity})`);

// 5. Boundary Value Tests
console.log('\n▶ Test Suite 5: Exact Boundary Value Checks');
assert(WEIGHT_CONFIG.THRESHOLDS.CRITICAL === 75, 'Critical threshold is 75');
assert(WEIGHT_CONFIG.THRESHOLDS.HIGH === 55, 'High threshold is 55');
assert(WEIGHT_CONFIG.THRESHOLDS.MEDIUM === 35, 'Medium threshold is 35');

// 6. Missing, Null, and Invalid Inputs (Safe Handling)
console.log('\n▶ Test Suite 6: Missing and Invalid Input Safeguards');
const emptyTriage = evaluateTriage({});
assert(emptyTriage.score >= 35, `Empty input does not produce zero score (got ${emptyTriage.score})`);
assert(emptyTriage.priority !== 'CRITICAL', 'Empty input does not produce false CRITICAL');
assert(emptyTriage.breakdown.animalRisk === 20, 'Uncertain animal produces safe baseline 20');
assert(emptyTriage.breakdown.conditionSeverity === 25, 'Uncertain condition produces safe baseline 25');
assert(emptyTriage.breakdown.locationRisk === 10, 'Uncertain location produces safe baseline 10');

const nullTriage = evaluateTriage({
  animalType: null,
  emergencyType: undefined,
  description: '',
  locationAddress: null,
});
assert(nullTriage.score > 0, `Null inputs handled gracefully without throwing (score: ${nullTriage.score})`);

// 7. Backward Compatibility Wrapper Check
console.log('\n▶ Test Suite 7: Backward Compatibility Check');
const legacyP = calculatePriority('dog', 'Hit and Run', 'bleeding on highway');
assert(legacyP === 'CRITICAL', `calculatePriority returns string 'CRITICAL' (got ${legacyP})`);

console.log(`\n═════════════════════════════════════════`);
console.log(`TRIAGE SUITE SUMMARY: ${passed} PASSED, ${failed} FAILED`);
console.log(`═════════════════════════════════════════`);

process.exit(failed > 0 ? 1 : 0);
