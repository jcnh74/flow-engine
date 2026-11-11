// Analyze which parameters each mode uses
import fs from 'fs';

const mainTs = fs.readFileSync('./src/main.ts', 'utf-8');
const grassShaders = fs.readFileSync('./src/grass_shaders.ts', 'utf-8');
const fractalShaders = fs.readFileSync('./src/fractal_shaders.ts', 'utf-8');
const shaders = fs.readFileSync('./src/shaders.ts', 'utf-8');

// Extract all parameter references from shader code
function extractParams(code, prefix = '') {
  const params = new Set();
  // Match uniform references like P.paramName or V.paramName
  const matches = code.matchAll(/[PV]\.(\w+)/g);
  for (const match of matches) {
    params.add(match[1]);
  }
  return Array.from(params).sort();
}

console.log('=== MODE PARAMETER USAGE ANALYSIS ===\n');

// Analyze each mode
const modes = {
  'Wall Studio': { shaders: 'src/shaders.ts (wall)', params: [] },
  'Grass Field': { shaders: 'src/grass_shaders.ts', params: [] },
  '3D Fractal': { shaders: 'src/fractal_shaders.ts', params: [] },
  '2D Flow': { shaders: 'src/shaders.ts (2d flow)', params: [] },
  '3D Fabric': { shaders: 'src/shaders.ts (3d fabric)', params: [] }
};

// Find parameters used in each shader set
console.log('## Shader Parameter References:\n');

console.log('### Grass Shaders (grass_shaders.ts):');
const grassParams = extractParams(grassShaders);
console.log(`Parameters: ${grassParams.length}`);
console.log(grassParams.join(', '));
console.log('');

console.log('### Fractal Shaders (fractal_shaders.ts):');
const fractalParams = extractParams(fractalShaders);
console.log(`Parameters: ${fractalParams.length}`);
console.log(fractalParams.join(', '));
console.log('');

console.log('### Main Shaders (shaders.ts):');
const mainParams = extractParams(shaders);
console.log(`Parameters: ${mainParams.length}`);
console.log(mainParams.join(', '));
console.log('');

// Analyze mode-specific code sections in main.ts
console.log('## Mode-Specific Logic in main.ts:\n');

// Find Wall Studio specific params
const wallMatch = mainTs.match(/isW\(\) \? .+ : /g);
console.log(`Wall Studio conditions found: ${wallMatch ? wallMatch.length : 0}`);

// Find Grass specific params
const grassMatch = mainTs.match(/g === true|P\.mode === 'Grass'/gi);
console.log(`Grass Field conditions found: ${grassMatch ? grassMatch.length : 0}`);

// Find Fractal specific params
const fractalMatch = mainTs.match(/fr === true|P\.mode === '3D Fractal'/gi);
console.log(`3D Fractal conditions found: ${fractalMatch ? fractalMatch.length : 0}`);

console.log('\n=== DONE ===');
