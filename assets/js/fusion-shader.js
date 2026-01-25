/**
 * FUSED SHADER: Volumetric Smoke + React Raymarching Dot Noise
 * 
 * Combines:
 * 1. High-Performance Volumetric Smoke (DataTexture3D, Scattering)
 * 2. Abstract "Dot Noise" Raymarching Field (from React component)
 * 3. ACES Tonemapping
 */

(function () {
    // --- PART 1: NEGATIVE VISUAL CURSOR ---
    // Specifically an "arrow" or small pointer as requested, but standard cursor: none + custom div
    // User said "negative is only the arrow". We can try to make a custom arrow shape or just a small circle.
    // Let's make a small circle that acts as the pointer.

    const cursor = document.createElement('div');
    Object.assign(cursor.style, {
        position: 'fixed',
        top: '0', left: '0',
        width: '15px', height: '15px', // Small pointer size
        borderRadius: '50%',
        backgroundColor: 'white',
        mixBlendMode: 'difference', // The "Negative" effect
        pointerEvents: 'none',
        zIndex: '9999',
        transform: 'translate(-50%, -50%)',
        transition: 'transform 0.1s',
    });
    document.body.appendChild(cursor);

    // Hide default cursor
    document.body.style.cursor = 'none';

    // --- PART 2: WEBGL SHADER SYSTEM ---
    const checkThree = setInterval(() => {
        if (window.THREE) {
            clearInterval(checkThree);
            initThreeJS();
        }
    }, 100);

    function initThreeJS() {
        console.log("Initializing Fused Shader System (V3 Refined)");

        const container = document.createElement('div');
        Object.assign(container.style, {
            position: 'fixed', top: '0', left: '0', width: '100%', height: '100%',
            zIndex: '-1', pointerEvents: 'none', id: 'fusion-container'
        });
        document.body.appendChild(container);

        const style = document.createElement('style');
        style.innerHTML = `
            body, html, .page__content, .initial-content, .page { background-color: transparent !important; cursor: none !important; }
            a, button, input { cursor: none !important; } /* Force no cursor everywhere */
            #fusion-container { pointer-events: none; z-index: -1; }
        `;
        document.head.appendChild(style);

        const renderer = new THREE.WebGLRenderer({ alpha: true, powerPreference: "high-performance" });
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
        container.appendChild(renderer.domElement);

        const scene = new THREE.Scene();
        const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
        const geometry = new THREE.PlaneGeometry(2, 2);

        // --- Generate 3D Noise Texture for Smoke ---
        // (Reusing the optimized texture generation from smoke-shader.js)
        const size = 128;
        const data = new Uint8Array(size * size * size);
        let i = 0;
        const scale = 0.05;

        // Simple CPU noise helpers
        function lerp(a, b, t) { return a + (b - a) * t; }
        function fade(t) { return t * t * t * (t * (t * 6.0 - 15.0) + 10.0); }
        function grad(hash, x, y, z) {
            const h = hash & 15;
            const u = h < 8 ? x : y, v = h < 4 ? y : h === 12 || h === 14 ? x : z;
            return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v);
        }
        const p = new Uint8Array(512);
        const permutation = new Uint8Array(256);
        for (let j = 0; j < 256; j++) permutation[j] = j;
        for (let j = 255; j > 0; j--) {
            const k = Math.floor(Math.random() * (j + 1));
            [permutation[j], permutation[k]] = [permutation[k], permutation[j]];
        }
        for (let j = 0; j < 512; j++) p[j] = permutation[j & 255];
        function noise3D(x, y, z) {
            const X = Math.floor(x) & 255, Y = Math.floor(y) & 255, Z = Math.floor(z) & 255;
            x -= Math.floor(x); y -= Math.floor(y); z -= Math.floor(z);
            const u = fade(x), v = fade(y), w = fade(z);
            const A = p[X] + Y, AA = p[A] + Z, AB = p[A + 1] + Z, B = p[X + 1] + Y, BA = p[B] + Z, BB = p[B + 1] + Z;
            return lerp(w, lerp(v, lerp(u, grad(p[AA], x, y, z), grad(p[BA], x - 1, y, z)),
                lerp(u, grad(p[AB], x, y - 1, z), grad(p[BB], x - 1, y - 1, z))),
                lerp(v, lerp(u, grad(p[AA + 1], x, y, z - 1), grad(p[BA + 1], x - 1, y, z - 1)),
                    lerp(u, grad(p[AB + 1], x, y - 1, z - 1), grad(p[BB + 1], x - 1, y - 1, z - 1))));
        }

        for (let z = 0; z < size; z++) {
            for (let y = 0; y < size; y++) {
                for (let x = 0; x < size; x++) {
                    const nx = x * scale;
                    const ny = y * scale;
                    const nz = z * scale;
                    let val = 0, freq = 1.0, amp = 0.5, max = 0;
                    for (let k = 0; k < 3; k++) {
                        val += (noise3D(nx * freq, ny * freq, nz * freq) + 1.0) * 0.5 * amp;
                        max += amp;
                        freq *= 2.0; amp *= 0.5;
                    }
                    data[i++] = (val / max) * 255;
                }
            }
        }

        const texture3D = new THREE.DataTexture3D(data, size, size, size);
        texture3D.format = THREE.RedFormat;
        texture3D.minFilter = THREE.LinearFilter;
        texture3D.magFilter = THREE.LinearFilter;
        texture3D.unpackAlignment = 1;
        texture3D.needsUpdate = true;
        texture3D.wrapS = THREE.RepeatWrapping;
        texture3D.wrapT = THREE.RepeatWrapping;
        texture3D.wrapR = THREE.RepeatWrapping;

        const uniforms = {
            u_time: { value: 0.0 },
            u_resolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) },
            u_mouse: { value: new THREE.Vector2(0, 0) },
            u_click_time: { value: -100.0 },
            u_click_pos: { value: new THREE.Vector2(0, 0) },
            u_noiseTex: { value: texture3D },
            // React Shader Props mapped to uniforms
            u_speed: { value: 1.0 },
            u_intensity: { value: 1.0 },
            u_complexity: { value: 1.0 },
            u_colorShift: { value: 2.0 } // Slightly shifted for aesthetics
        };

        const material = new THREE.ShaderMaterial({
            uniforms: uniforms,
            vertexShader: `
                varying vec2 vUv;
                void main() {
                    vUv = uv;
                    gl_Position = vec4(position, 1.0);
                }
            `,
            fragmentShader: `
                precision highp float;
                precision highp sampler3D;

                uniform sampler3D u_noiseTex;
                uniform vec2 u_resolution;
                uniform float u_time;
                uniform vec2 u_mouse;
                uniform float u_click_time;
                uniform vec2 u_click_pos;
                
                // Fusion Uniforms
                uniform float u_speed;
                uniform float u_intensity;
                uniform float u_complexity;
                uniform float u_colorShift;

                varying vec2 vUv;

                // --- UTILS ---
                mat2 rot(float a) {
                    float c = cos(a), s = sin(a);
                    return mat2(c, -s, s, c);
                }

                // --- PART 1: DOT NOISE (The "New" Shader) ---
                // Reference: https://mini.gmshaders.com/p/phi
                float dot_noise(vec3 p) {
                    const float PHI = 1.618033988;
                    const mat3 GOLD = mat3(
                        -0.571464913, +0.814921382, +0.096597072,
                        -0.278044873, -0.303026659, +0.911518454,
                        +0.772087367, +0.494042493, +0.399753815
                    );
                    return dot(cos(GOLD * p), sin(PHI * p * GOLD));
                }

                // Subtle Elegant Ripple
                float getRipple(vec2 uv) {
                    vec2 aspect = vec2(u_resolution.x/u_resolution.y, 1.0);
                    vec2 clickNDC = (u_click_pos / u_resolution.xy) * 2.0 - 1.0;
                    clickNDC.y *= -1.0;
                    clickNDC.x *= aspect.x;
                    
                    vec2 pScreen = (vUv - 0.5) * 2.0 * aspect;
                    float dist = distance(pScreen, clickNDC);
                    float t = u_time - u_click_time;
                    
                    if (t > 0.0 && t < 3.0) {
                        float wavePos = t * 0.8; // Slower
                        float waveWidth = 0.5; // Wider, softer
                        float w = smoothstep(waveWidth, 0.0, abs(dist - wavePos));
                        // Soft fade, gentle amplitude
                        return w * exp(-t * 2.0) * 0.3; 
                    }
                    return 0.0;
                }

                vec3 getDotFieldColor(vec2 uv, float ripple) {
                    float t = -u_time * u_speed * 0.5 - 500.0; // Slower speed for elegance
                    vec3 d = normalize(vec3(uv, -1.0)); // Camera looking Z-
                    vec3 p = vec3(0, 0, t);
                    vec3 l = vec3(0.0);

                    // Reduced iterations for performance when mixing with volumetric smoke
                    for (int i = 0; i < 60; i++) {
                        vec3 rp = p;
                        p.xy *= rot(p.z * 0.0001);
                        float s = abs(dot_noise(rp) + (p.y)) * 0.1 + 0.015;
                        p += d * s;
                        
                        // Ripple gently shifts color phase
                        float shift = u_colorShift + ripple * 2.0;

                        // Accumulate radiance
                        vec3 shine = (sin(p.z * 0.5 - vec3(0.5, 0.8, 0.9) * shift) / (abs(s * 0.001) + 1e-6));
                        
                        // Moving orb influence
                        vec3 orb = 0.3 * vec3(7, 4, 1) / 
                                  (length(uv + vec2(-1.0 + 2.0 * smoothstep(-1.0, 1.0, sin(t * 0.50)), -0.4 + sin(t * 0.25) * 0.3)) * (1e-3 * abs(sin(t * 0.4) * 0.5 + 2.0)));
                                  
                        l += shine * 0.01 + orb * 0.02; // Reduced contribution for background mixing
                    }
                    return l;
                }

                // --- PART 2: VOLUMETRIC SMOKE (The "Old" Shader) ---
                float mapSmoke(vec3 p) {
                    vec3 q = p * 0.3 + vec3(u_time * 0.04, u_time * 0.02, 0.0);
                    float n = texture(u_noiseTex, q).r;
                    float n2 = texture(u_noiseTex, q * 2.5).r;
                    float d = n * 0.6 + n2 * 0.4;
                    d = smoothstep(0.4, 0.8, d);
                    return clamp(d * 2.5, 0.0, 1.0);
                }

                float hg(float dotViewLight, float g) {
                    float g2 = g * g;
                    return (1.0 - g2) / (4.0 * 3.14159 * pow(1.0 + g2 - 2.0 * g * dotViewLight, 1.5));
                }

                vec3 getSmokeColor(vec2 uv, float ripple) {
                    vec3 ro = vec3(0.0, 0.0, 2.0);
                    vec3 rd = normalize(vec3(uv, -1.0));
                    
                    vec2 aspect = vec2(u_resolution.x/u_resolution.y, 1.0);
                    vec2 mouseNDC = (u_mouse / u_resolution.xy) * 2.0 - 1.0;
                    mouseNDC.y *= -1.0;
                    vec3 lightPos = vec3(mouseNDC * aspect * 3.0, -0.5);
                    vec3 lightColor = vec3(0.6, 0.7, 0.8) * 3.0;

                    vec3 color = vec3(0.0);
                    float transmittance = 1.0;
                    float t = 0.0;
                    t += fract(sin(dot(gl_FragCoord.xy, vec2(12.9898,78.233))) * 43758.5453) * 0.1; // Dither

                    const int STEPS = 48; // Balanced steps
                    const float STEP_SIZE = 0.1;

                    for (int i = 0; i < STEPS; i++) {
                        vec3 p = ro + rd * t;
                        if (abs(p.x)>4.0 || abs(p.y)>4.0 || p.z<-4.0) break;

                        float dens = mapSmoke(p);
                        
                        // Ripple makes smoke momentarily denser/lighter
                        dens += ripple * 0.5 * smoothstep(0.0, 1.0, 1.0-abs(p.z));

                        if (dens > 0.01) {
                            vec3 ld = normalize(lightPos - p);
                            float shadow = exp(-mapSmoke(p + ld * 0.4) * 6.0);
                            float scatter = hg(dot(rd, ld), 0.5);
                            
                            // Color variation based on density
                            vec3 cloudColor = mix(vec3(0.02), lightColor, shadow * scatter * 0.5);
                            
                            float alpha = 1.0 - exp(-dens * 3.0 * STEP_SIZE);
                            color += transmittance * cloudColor * alpha;
                            transmittance *= (1.0 - alpha);
                            if (transmittance < 0.01) break;
                        }
                        t += STEP_SIZE;
                    }
                    return color;
                }

                // --- ACES TONEMAPING (From Provided Shader) ---
                vec3 aces(vec3 color) {
                    const mat3 M1 = mat3(
                        0.59719, 0.07600, 0.02840,
                        0.35458, 0.90834, 0.13383,
                        0.04823, 0.01566, 0.83777
                    );
                    const mat3 M2 = mat3(
                        1.60475, -0.10208, -0.00327,
                    -0.53108,  1.10813, -0.07276,
                    -0.07367, -0.00605,  1.07602
                    );
                    vec3 v = M1 * color;
                    vec3 a = v * (v + 0.0245786) - 0.000090537;
                    vec3 b = v * (0.983729 * v + 0.4329510) + 0.238081;
                    return M2 * (a / b);
                }

                // --- MAIN ---
                void main() {
                    vec2 uv = (vUv - 0.5) * 2.0;
                    uv.x *= u_resolution.x / u_resolution.y;

                    // Ripple Calc
                    float ripple = getRipple(uv);
                    
                    // Subtle distortion of UVs for background field
                    vec2 distortedUV = uv + normalize(uv) * ripple * 0.02;

                    // 1. Get Dot Field (Background Energy)
                    vec3 field = getDotFieldColor(distortedUV, ripple);
                    
                    // 2. Get Volumetric Smoke (Foreground)
                    vec3 smoke = getSmokeColor(distortedUV, ripple);

                    // 3. Fuse
                    // Use the field as a glowing background behind the smoke
                    // Also let the field contribute slightly to the smoke lighting (emissive approximation)
                    vec3 final = field * 0.3 + smoke;

                    // 4. ACES & Gamma
                    // l*l contrast boost from react shader
                    // scaled HDR before ACES -> gamma 2.2
                    
                    final = aces(final * u_intensity * 1.5); // Boost intensity slightly
                    final = pow(final, vec3(1.0 / 2.2));

                    gl_FragColor = vec4(final, 1.0);
                }
            `
        });

        const mesh = new THREE.Mesh(geometry, material);
        scene.add(mesh);

        window.addEventListener('resize', () => {
            renderer.setSize(window.innerWidth, window.innerHeight);
            uniforms.u_resolution.value.set(window.innerWidth, window.innerHeight);
        });
        window.addEventListener('mousemove', (e) => {
            uniforms.u_mouse.value.set(e.clientX, e.clientY);

            // Move negative cursor
            cursor.style.left = e.clientX + 'px';
            cursor.style.top = e.clientY + 'px';
        });

        window.addEventListener('click', (e) => {
            uniforms.u_click_time.value = performance.now() / 1000;
            uniforms.u_click_pos.value.set(e.clientX, e.clientY);

            // Subtle Scale pop
            cursor.style.transform = 'translate(-50%, -50%) scale(1.5)';
            setTimeout(() => {
                cursor.style.transform = 'translate(-50%, -50%) scale(1)';
            }, 100);
        });

        let clock = new THREE.Clock();
        function animate() {
            requestAnimationFrame(animate);
            uniforms.u_time.value = clock.getElapsedTime();
            renderer.render(scene, camera);
        }
        animate();
    }
})();
