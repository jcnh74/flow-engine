// 2D Fractal shaders: Mandelbrot, Julia, Burning Ship, Newton, Phoenix

export const vert = `#version 300 es
precision highp float;
const vec2 P[3] = vec2[3](vec2(-1,-1), vec2(3,-1), vec2(-1,3));
out vec2 uv;
void main() {
  vec2 p = P[gl_VertexID];
  uv = p;
  gl_Position = vec4(p, 0, 1);
}`;

export const frag = `#version 300 es
precision highp float;
in vec2 uv;
out vec4 fragColor;

uniform int frType; // 0=Mandelbrot, 1=Julia, 2=Burning Ship, 3=Newton, 4=Phoenix
uniform vec2 center;
uniform float zoom;
uniform vec2 juliaC;
uniform int maxIter;
uniform float time;
uniform vec3 palette[8];
uniform int paletteSize;
uniform float paletteOffset;
uniform float rotation;

// Smooth iteration count
float mandelbrot(vec2 c) {
  vec2 z = vec2(0.0);
  float iter = 0.0;
  
  for (int i = 0; i < 1000; i++) {
    if (i >= maxIter) break;
    if (dot(z, z) > 256.0) break;
    
    z = vec2(z.x * z.x - z.y * z.y, 2.0 * z.x * z.y) + c;
    iter += 1.0;
  }
  
  if (iter < float(maxIter)) {
    // Smooth coloring
    float modZ = length(z);
    float smoothIter = iter + 1.0 - log2(log2(modZ));
    return smoothIter;
  }
  
  return -1.0; // In set
}

float julia(vec2 z, vec2 c) {
  float iter = 0.0;
  
  for (int i = 0; i < 1000; i++) {
    if (i >= maxIter) break;
    if (dot(z, z) > 256.0) break;
    
    z = vec2(z.x * z.x - z.y * z.y, 2.0 * z.x * z.y) + c;
    iter += 1.0;
  }
  
  if (iter < float(maxIter)) {
    float modZ = length(z);
    float smoothIter = iter + 1.0 - log2(log2(modZ));
    return smoothIter;
  }
  
  return -1.0;
}

float burningShip(vec2 c) {
  vec2 z = vec2(0.0);
  float iter = 0.0;
  
  for (int i = 0; i < 1000; i++) {
    if (i >= maxIter) break;
    if (dot(z, z) > 256.0) break;
    
    z = abs(z);
    z = vec2(z.x * z.x - z.y * z.y, 2.0 * z.x * z.y) + c;
    iter += 1.0;
  }
  
  if (iter < float(maxIter)) {
    float modZ = length(z);
    float smoothIter = iter + 1.0 - log2(log2(modZ));
    return smoothIter;
  }
  
  return -1.0;
}

// Newton fractal for z^3 - 1
float newton(vec2 z) {
  float iter = 0.0;
  const float epsilon = 0.001;
  
  for (int i = 0; i < 1000; i++) {
    if (i >= maxIter) break;
    
    // z^3
    vec2 z2 = vec2(z.x * z.x - z.y * z.y, 2.0 * z.x * z.y);
    vec2 z3 = vec2(z2.x * z.x - z2.y * z.y, z2.x * z.y + z2.y * z.x);
    
    // z^3 - 1
    vec2 f = z3 - vec2(1.0, 0.0);
    
    if (length(f) < epsilon) break;
    
    // 3*z^2 (derivative)
    vec2 df = 3.0 * z2;
    
    // Newton step: z = z - f/df
    float dfMag2 = dot(df, df);
    if (dfMag2 < 0.0001) break;
    vec2 fDivDf = vec2(f.x * df.x + f.y * df.y, f.y * df.x - f.x * df.y) / dfMag2;
    z -= fDivDf;
    
    iter += 1.0;
  }
  
  return iter;
}

// Phoenix fractal
float phoenix(vec2 c) {
  vec2 z = vec2(0.0);
  vec2 zPrev = vec2(0.0);
  float iter = 0.0;
  
  for (int i = 0; i < 1000; i++) {
    if (i >= maxIter) break;
    if (dot(z, z) > 256.0) break;
    
    vec2 zNew = vec2(z.x * z.x - z.y * z.y, 2.0 * z.x * z.y) + c + vec2(0.5, 0.0) * zPrev;
    zPrev = z;
    z = zNew;
    iter += 1.0;
  }
  
  if (iter < float(maxIter)) {
    float modZ = length(z);
    float smoothIter = iter + 1.0 - log2(log2(modZ));
    return smoothIter;
  }
  
  return -1.0;
}

vec3 getColor(float t) {
  if (t < 0.0) return vec3(0.0); // In set = black
  
  t = mod(t * 0.05 + paletteOffset, 1.0);
  float idx = t * float(paletteSize - 1);
  int i0 = int(floor(idx));
  int i1 = (i0 + 1) % paletteSize;
  float frac = fract(idx);
  
  return mix(palette[i0], palette[i1], frac);
}

void main() {
  // Apply rotation
  float angle = rotation * 3.14159 / 180.0;
  vec2 rotUV = vec2(
    uv.x * cos(angle) - uv.y * sin(angle),
    uv.x * sin(angle) + uv.y * cos(angle)
  );
  
  vec2 coord = center + rotUV / zoom;
  
  float iter;
  if (frType == 0) {
    iter = mandelbrot(coord);
  } else if (frType == 1) {
    iter = julia(coord, juliaC);
  } else if (frType == 2) {
    iter = burningShip(coord);
  } else if (frType == 3) {
    iter = newton(coord);
  } else if (frType == 4) {
    iter = phoenix(coord);
  } else {
    iter = mandelbrot(coord); // Fallback
  }
  
  vec3 color = getColor(iter);
  fragColor = vec4(color, 1.0);
}
`;
