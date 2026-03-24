precision highp float;

varying vec2 vUV;

uniform float time;
uniform float power;
uniform vec3 cameraPos;
uniform mat4 worldViewProjection;

const int MAX_STEPS = 48;
const float MAX_DIST = 6.0;
const float MIN_DIST = 0.002;

// Mandelbulb distance estimator
vec2 mandelbulbDE(vec3 pos) {
    vec3 z = pos;
    float dr = 1.0;
    float r = 0.0;
    float trap = 1e10;

    for (int i = 0; i < 8; i++) {
        r = length(z);
        if (r > 2.0) break;

        float theta = acos(z.z / r);
        float phi = atan(z.y, z.x);
        dr = pow(r, power - 1.0) * power * dr + 1.0;

        float zr = pow(r, power);
        theta = theta * power;
        phi = phi * power;

        z = zr * vec3(
            sin(theta) * cos(phi),
            sin(phi) * sin(theta),
            cos(theta)
        );
        z += pos;

        trap = min(trap, length(z));
    }
    return vec2(0.5 * log(r) * r / dr, trap);
}

// Soft shadow / AO approximation via distance field
float calcAO(vec3 pos, vec3 nor) {
    float occ = 0.0;
    float sca = 1.0;
    for (int i = 0; i < 4; i++) {
        float h = 0.01 + 0.12 * float(i);
        float d = mandelbulbDE(pos + h * nor).x;
        occ += (h - d) * sca;
        sca *= 0.7;
    }
    return clamp(1.0 - 2.0 * occ, 0.0, 1.0);
}

vec3 calcNormal(vec3 pos) {
    vec2 e = vec2(0.001, 0.0);
    return normalize(vec3(
        mandelbulbDE(pos + e.xyy).x - mandelbulbDE(pos - e.xyy).x,
        mandelbulbDE(pos + e.yxy).x - mandelbulbDE(pos - e.yxy).x,
        mandelbulbDE(pos + e.yyx).x - mandelbulbDE(pos - e.yyx).x
    ));
}

void main() {
    // Ray from UV across the box face
    vec3 ro = cameraPos;
    vec2 uv = vUV * 2.0 - 1.0;
    vec3 rd = normalize(vec3(uv, 1.0));

    float t = 0.0;
    vec2 hit = vec2(0.0);

    for (int i = 0; i < MAX_STEPS; i++) {
        vec3 p = ro + rd * t;
        hit = mandelbulbDE(p);
        if (hit.x < MIN_DIST || t > MAX_DIST) break;
        t += hit.x;
    }

    if (t < MAX_DIST) {
        vec3 pos = ro + rd * t;
        vec3 nor = calcNormal(pos);
        float ao = calcAO(pos, nor);

        // Color from orbit trap
        vec3 col = 0.5 + 0.5 * cos(3.0 + hit.y * 4.0 + vec3(0.0, 0.6, 1.0) + time * 0.3);

        // Lighting
        vec3 light = normalize(vec3(0.5, 0.8, -0.3));
        float dif = clamp(dot(nor, light), 0.0, 1.0);
        float amb = 0.15;

        col *= (amb + dif * 0.85) * ao;

        // Fog
        float fog = exp(-0.3 * t);
        col = mix(vec3(0.02), col, fog);

        gl_FragColor = vec4(col, 1.0);
    } else {
        discard;
    }
}
