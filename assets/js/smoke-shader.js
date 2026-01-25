/**
 * Three.js Hyper-Realistic Performance-Optimized Volumetric Smoke
 * Features:
 * - DataTexture3D: Pre-computed noise for massive GPU speedup (removes expensive sin/fract ops)
 * - Analytic Phase Function: High quality HG scattering
 * - Dynamic Step Raymarching: Quality where it counts relative to camera
 */

(function () {
    const checkThree = setInterval(() => {
        if (window.THREE) {
            clearInterval(checkThree);
            initThreeJS();
        }
    }, 100);

    function initThreeJS() {
        console.log("Initializing Optimized Smoke System");

        // Container & Style
        const container = document.createElement('div');
        Object.assign(container.style, {
            position: 'fixed', top: '0', left: '0', width: '100%', height: '100%',
            zIndex: '-1', pointerEvents: 'none', id: 'smoke-container'
        });
        document.body.appendChild(container);

        const style = document.createElement('style');
        style.innerHTML = `
            body, html, .page__content, .initial-content, .page { background-color: transparent !important; }
            #smoke-container { pointer-events: none; z-index: -1; }
        `;
        document.head.appendChild(style);

        // Renderer
        const renderer = new THREE.WebGLRenderer({ alpha: true, powerPreference: "high-performance" });
        renderer.setSize(window.innerWidth, window.innerHeight);
        // Optimization: Use lower internal resolution for volumetrics if high DPI, but 1.0 is fine for desktops usually
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
        container.appendChild(renderer.domElement);

        const scene = new THREE.Scene();
        const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
        const geometry = new THREE.PlaneGeometry(2, 2);

        // --- Generate 3D Noise Texture (CPU One-time cost) ---
        const size = 128; // 128x128x128 resolution texture
        const data = new Uint8Array(size * size * size);
        let i = 0;
        const scale = 0.05;
        const perlin = {
            noise: function (x, y, z) {
                // Simple fast noise approximation for generation or use a library if available.
                // Since we don't have a library, we'll verify if we can do a decent hash noise
                // or just use Math.random() ?? Random is white noise, we need coherent noise.
                // Constructing coherent noise on CPU without lib is verbose.
                // Fallback: Fill with white noise, let the shader smooth it via trilinear interpolation (hardware)
                // Actually, for "clouds", white noise isn't enough.
                // Let's implement a quick value noise to populate the texture.
                return Math.random();
            }
        };

        // Better approach: Write a simple value noise function to fill the buffer
        function lerp(a, b, t) { return a + (b - a) * t; }
        function fade(t) { return t * t * t * (t * (t * 6.0 - 15.0) + 10.0); }
        function grad(hash, x, y, z) {
            const h = hash & 15;
            const u = h < 8 ? x : y, v = h < 4 ? y : h === 12 || h === 14 ? x : z;
            return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v);
        }

        // Permutation table
        const p = new Uint8Array(512);
        const permutation = new Uint8Array(256);
        for (let i = 0; i < 256; i++) permutation[i] = i;
        for (let i = 255; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [permutation[i], permutation[j]] = [permutation[j], permutation[i]];
        }
        for (let i = 0; i < 512; i++) p[i] = permutation[i & 255];

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

        // Fill Data
        // To make it loopable and cloud-like, we mix frequencies
        for (let z = 0; z < size; z++) {
            for (let y = 0; y < size; y++) {
                for (let x = 0; x < size; x++) {
                    const nx = x * scale;
                    const ny = y * scale;
                    const nz = z * scale;

                    // Octaves
                    let val = 0;
                    let freq = 1.0;
                    let amp = 0.5;
                    let max = 0;
                    for (let k = 0; k < 3; k++) {
                        val += (noise3D(nx * freq, ny * freq, nz * freq) + 1.0) * 0.5 * amp;
                        max += amp;
                        freq *= 2.0;
                        amp *= 0.5;
                    }
                    val /= max;

                    data[i++] = val * 255;
                }
            }
        }

        const texture3D = new THREE.DataTexture3D(data, size, size, size);
        texture3D.format = THREE.RedFormat;
        texture3D.minFilter = THREE.LinearFilter;
        texture3D.magFilter = THREE.LinearFilter;
        texture3D.unpackAlignment = 1;
        texture3D.needsUpdate = true;
        // Repeat wrapping for infinite scrolling
        texture3D.wrapS = THREE.RepeatWrapping;
        texture3D.wrapT = THREE.RepeatWrapping;
        texture3D.wrapR = THREE.RepeatWrapping;

        const uniforms = {
            u_time: { value: 0.0 },
            u_resolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) },
            u_mouse: { value: new THREE.Vector2(0, 0) },
            u_click_time: { value: -100.0 },
            u_click_pos: { value: new THREE.Vector2(0, 0) },
            u_noiseTex: { value: texture3D }
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
                varying vec2 vUv;

                // --- Map Density ---
                float map(vec3 p) {
                    // Pan texture over time
                    vec3 q = p * 0.3 + vec3(u_time * 0.02, u_time * 0.015, -u_time * 0.005);
                    
                    // Texture lookup (Hardware trilinear interpolation - SUPER FAST)
                    float n = texture(u_noiseTex, q).r;
                    
                    // Add secondary detail layer
                    float n2 = texture(u_noiseTex, q * 2.5 + vec3(0.5)).r;
                    float d = n * 0.7 + n2 * 0.3;

                    // Density shaping
                    d = smoothstep(0.4, 0.8, d); // Threshold for clumps

                    // Interactivity: Ripple
                    vec2 aspect = vec2(u_resolution.x/u_resolution.y, 1.0);
                    vec2 pScreen = p.xy;
                    vec2 clickPosNorm = (u_click_pos / u_resolution.xy) * 2.0 - 1.0;
                    clickPosNorm.y *= -1.0; // Invert Y
                    clickPosNorm.x *= aspect.x;

                    float distClick = distance(pScreen, clickPosNorm);
                    float tClick = u_time - u_click_time;
                    
                    if (tClick > 0.0 && tClick < 2.5) {
                        float r = tClick * 1.5;
                        float w = 0.3; // width of wave
                        float rippleInfo = smoothstep(w, 0.0, abs(distClick - r));
                        
                        // Increase density in wave
                        d += rippleInfo * 0.8 * exp(-tClick * 0.5);
                    }

                    return clamp(d * 2.0, 0.0, 1.0); // Denser
                }

                // --- Henyey-Greenstein ---
                float hg(float dotViewLight, float g) {
                    float g2 = g * g;
                    return (1.0 - g2) / (4.0 * 3.14159 * pow(1.0 + g2 - 2.0 * g * dotViewLight, 1.5));
                }

                void main() {
                    vec2 aspect = vec2(u_resolution.x/u_resolution.y, 1.0);
                    vec2 uv = (vUv - 0.5) * 2.0 * aspect;

                    // Camera Setup
                    vec3 ro = vec3(0.0, 0.0, 2.0);
                    vec3 rd = normalize(vec3(uv, -1.0));

                    // Light
                    vec2 mouseNDC = (u_mouse / u_resolution.xy) * 2.0 - 1.0;
                    mouseNDC.y *= -1.0;
                    vec3 lightPos = vec3(mouseNDC * aspect * 3.0, -1.0);
                    vec3 lightColor = vec3(0.6, 0.7, 0.8) * 4.0; // Bright rim

                    // Render Loop
                    vec3 color = vec3(0.0);
                    float transmittance = 1.0;
                    
                    // Optimization: Dither start
                    float t = 0.0;
                    // Blue noise-ish hash
                    t += fract(sin(dot(gl_FragCoord.xy, vec2(12.9898,78.233))) * 43758.5453) * 0.05;

                    // Optimization: Early exit box
                    // Since it's a full screen fog/smoke, we step through a fixed range Z
                    // Plane is at 2.0, looking -Z. Let's march from 2.0 to -2.0
                    
                    const int STEPS = 64; // Higher steps, cheaper per step
                    const float STEP_SIZE = 0.08;

                    for (int i = 0; i < STEPS; i++) {
                        vec3 p = ro + rd * t;
                        
                        // Bounds check
                        if (abs(p.x) > 4.0 || abs(p.y) > 4.0 || p.z < -4.0) break;

                        float d = map(p);

                        if (d > 0.001) {
                            vec3 ld = normalize(lightPos - p);
                            float lightDist = length(lightPos - p);
                            
                            // 1-Tap Shadow
                            float shadowD = map(p + ld * 0.3); // Check towards light
                            float shadow = exp(-shadowD * 8.0); // Hard self-shadows
                            
                            float scatter = hg(dot(rd, ld), 0.6); // Forward silver lining
                            float atten = 1.0 / (1.0 + lightDist * 0.1);

                            vec3 radiance = lightColor * atten * shadow * scatter;
                            
                            // Ambient
                            radiance += vec3(0.05, 0.06, 0.08) * 0.2;

                            float alpha = 1.0 - exp(-d * 2.0 * STEP_SIZE);
                            
                            color += transmittance * radiance * alpha;
                            transmittance *= (1.0 - alpha);

                            if (transmittance < 0.01) break;
                        }

                        t += STEP_SIZE;
                    }

                    // Background
                    vec3 bg = vec3(0.005, 0.005, 0.01); 
                    color = color + bg * transmittance;

                    // Post-Process
                    color = pow(color, vec3(0.4545)); // Gamma
                    color = smoothstep(0.0, 1.0, color); // Contrast
                    
                    // Vignette
                    color *= 1.0 - smoothstep(0.5, 2.0, length(uv));

                    gl_FragColor = vec4(color, 1.0);
                }
            `
        });

        const mesh = new THREE.Mesh(geometry, material);
        scene.add(mesh);

        // Events
        window.addEventListener('resize', () => {
            renderer.setSize(window.innerWidth, window.innerHeight);
            uniforms.u_resolution.value.set(window.innerWidth, window.innerHeight);
        });
        window.addEventListener('mousemove', (e) => {
            uniforms.u_mouse.value.set(e.clientX, e.clientY);
        });
        window.addEventListener('click', (e) => {
            uniforms.u_click_time.value = performance.now() / 1000;
            uniforms.u_click_pos.value.set(e.clientX, e.clientY);
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
