// Enumerate ALL numeric sliders and modulation coverage
import fs from 'fs';

const mainTs = fs.readFileSync('./src/main.ts', 'utf-8');

// Extract P object and all parameters
const pMatch = mainTs.match(/const P: any = \{([^}]+(?:\{[^}]*\}[^}]*)*)\}/s);
if (!pMatch) {
  console.error('Could not find P object');
  process.exit(1);
}

// Extract SMOOTH array
const smoothMatch = mainTs.match(/const SMOOTH = \[([^\]]+)\]/);
if (!smoothMatch) {
  console.error('Could not find SMOOTH array');
  process.exit(1);
}

const smoothStr = smoothMatch[1];
const smoothParams = smoothStr
  .split(',')
  .map(s => s.trim().replace(/['"]/g, ''))
  .filter(s => s.length > 0);

console.log('=== MODULATION COVERAGE ANALYSIS ===\n');
console.log(`SMOOTH parameters (modulatable): ${smoothParams.length}`);
console.log('');

// Find GUI additions to identify ALL numeric parameters
const guiMatches = [...mainTs.matchAll(/(?:gui|[a-z]+F|[a-z]+f|pre|ex|cf|audioF|modF|frF)\.add\(P,\s*'([^']+)',\s*([^)]+)\)/g)];
const guiFolderMatches = [...mainTs.matchAll(/([a-z]+(?:F|f))\.add\(P,\s*'([^']+)',\s*([^)]+)\)/g)];

// Extract lights and wells parameters (nested objects)
const lightsMatch = mainTs.match(/P\.lights\.forEach\(\(x: Light[^)]*\) => \{[^}]*g\.add\(x,\s*'([^']+)'[^}]*g\.add\(x,\s*'([^']+)'[^}]*\}/gs);
const wellsMatch = mainTs.match(/P\.wells\.forEach\(\(w: Well[^)]*\) => \{[^}]*g\.add\(w,\s*'([^']+)'[^}]*\}/gs);

// Count numeric params from GUI
let numericParams = [];
let nonNumericParams = [];

guiMatches.forEach(match => {
  const paramName = match[1];
  const args = match[2];
  
  // Check if it's numeric (has min/max or is in SMOOTH)
  const hasRange = /,\s*-?\d+/.test(args) || /\d+,\s*\d+/.test(args);
  const hasStep = /,\s*0\.\d+\)/.test(args) || /,\s*\d+\)$/.test(args);
  const inSmooth = smoothParams.includes(paramName);
  
  if (hasRange || hasStep || inSmooth) {
    numericParams.push(paramName);
  } else {
    nonNumericParams.push(paramName);
  }
});

// Remove duplicates
numericParams = [...new Set(numericParams)];
nonNumericParams = [...new Set(nonNumericParams)];

// Find lights numeric params
const lightsNumeric = ['az', 'el', 'dist', 'intensity', 'cone'];
const lightsCount = 4; // P.lights has 4 lights by default

// Find wells numeric params
const wellsNumeric = ['x', 'y', 'z', 'mass', 'falloff', 'swirl'];
const wellsCount = 4; // P.wells has 4 wells by default

console.log('=== NUMERIC PARAMETERS ===');
console.log(`\nTop-level P parameters: ${numericParams.length}`);
console.log(`Nested in lights (${lightsCount} lights × ${lightsNumeric.length} params): ${lightsCount * lightsNumeric.length}`);
console.log(`Nested in wells (${wellsCount} wells × ${wellsNumeric.length} params): ${wellsCount * wellsNumeric.length}`);
console.log(`\nTOTAL numeric parameters: ${numericParams.length + (lightsCount * lightsNumeric.length) + (wellsCount * wellsNumeric.length)}`);

console.log('\n=== MODULATION COVERAGE ===');
console.log(`Modulatable (in SMOOTH array): ${smoothParams.length}`);
console.log(`Not modulatable (not in SMOOTH): ${numericParams.length - smoothParams.filter(s => numericParams.includes(s)).length}`);

console.log('\n=== EXCLUSIONS ===');
const excluded = numericParams.filter(p => !smoothParams.includes(p));
console.log(`Parameters NOT in SMOOTH array: ${excluded.length}`);
if (excluded.length > 0 && excluded.length < 30) {
  console.log('Excluded params:', excluded.sort().join(', '));
}

console.log('\n=== LIGHTS/WELLS COVERAGE ===');
console.log(`Lights numeric params: ${lightsNumeric.join(', ')}`);
console.log(`Wells numeric params: ${wellsNumeric.join(', ')}`);
console.log('Note: These are NOT in SMOOTH array (per-object, not smoothed params)');

console.log('\n=== TARGET LIST FOR MODULATION GUI ===');
const MOD_TARGETS_IN_CODE = mainTs.match(/const MOD_TARGETS = \[([^\]]+)\]/);
if (MOD_TARGETS_IN_CODE) {
  const targets = MOD_TARGETS_IN_CODE[1]
    .split(',')
    .map(s => s.trim().replace(/['"]/g, ''))
    .filter(s => s.length > 0);
  console.log(`Targets in GUI dropdown: ${targets.length}`);
  console.log('Targets:', targets.join(', '));
} else {
  console.log('MOD_TARGETS not found in code');
}

console.log('\n=== SUMMARY ===');
console.log(`✓ Total numeric parameters: ${numericParams.length + (lightsCount * lightsNumeric.length) + (wellsCount * wellsNumeric.length)}`);
console.log(`✓ Modulatable via SMOOTH: ${smoothParams.length}`);
console.log(`✓ Lights/Wells params (not smoothed): ${(lightsCount * lightsNumeric.length) + (wellsCount * wellsNumeric.length)}`);
console.log(`✗ Excluded from modulation: ${excluded.length}`);
console.log('');
console.log('CONCLUSION:');
console.log(`  ${smoothParams.length}/${numericParams.length} top-level parameters modulatable`);
console.log(`  Lights/wells NOT modulatable (per-object params, not global state)`);
console.log(`  Coverage: ${Math.round(smoothParams.length / numericParams.length * 100)}% of top-level numeric params`);
