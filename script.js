// Global variables
let scene, camera, renderer, character, ktmBike, computerSetup;
let scrollProgress = 0;
let currentScene = 'intro';
let animationId;
let isInitialized = false;
let debugMode = false;

// Performance settings
let performanceSettings = {
    quality: 'medium',
    shadows: true,
    animations: true,
    targetFPS: 30,
    adaptiveQuality: true
};

// Performance monitoring
let performanceStats = {
    frameCount: 0,
    lastTime: performance.now(),
    fps: 0,
    avgFPS: 0,
    fpsHistory: []
};

// Scene objects
const sceneObjects = {
    mountains: [],
    lights: {},
    backgrounds: {}
};

// Throttling for expensive operations
let lastScrollUpdate = 0;
let lastUIUpdate = 0;
const SCROLL_THROTTLE = 16; // ~60fps
const UI_THROTTLE = 100; // 10fps for UI updates

// Quality settings
const qualitySettings = {
    low: {
        shadowMapSize: 512,
        antialias: false,
        pixelRatio: Math.min(1, window.devicePixelRatio),
        meshDetail: 8
    },
    medium: {
        shadowMapSize: 1024,
        antialias: true,
        pixelRatio: Math.min(1.5, window.devicePixelRatio),
        meshDetail: 16
    },
    high: {
        shadowMapSize: 2048,
        antialias: true,
        pixelRatio: window.devicePixelRatio,
        meshDetail: 32
    }
};

// Debug logging
function debugLog(message) {
    console.log(`[Portfolio Debug] ${message}`);
}

// Performance monitoring
function updatePerformanceStats() {
    const currentTime = performance.now();
    const deltaTime = currentTime - performanceStats.lastTime;
    
    if (deltaTime >= 1000) {
        performanceStats.fps = Math.round(performanceStats.frameCount * 1000 / deltaTime);
        performanceStats.fpsHistory.push(performanceStats.fps);
        
        if (performanceStats.fpsHistory.length > 10) {
            performanceStats.fpsHistory.shift();
        }
        
        performanceStats.avgFPS = Math.round(
            performanceStats.fpsHistory.reduce((a, b) => a + b, 0) / performanceStats.fpsHistory.length
        );
        
        const fpsCounter = document.getElementById('fpsCounter');
        if (fpsCounter) {
            fpsCounter.textContent = performanceStats.fps;
        }
        
        if (performanceSettings.adaptiveQuality) {
            adaptQuality();
        }
        
        performanceStats.frameCount = 0;
        performanceStats.lastTime = currentTime;
    }
    
    performanceStats.frameCount++;
}

// Adaptive quality adjustment
function adaptQuality() {
    if (performanceStats.avgFPS < 20 && performanceSettings.quality !== 'low') {
        debugLog('Low FPS detected, reducing quality');
        setQuality('low');
    } else if (performanceStats.avgFPS > 50 && performanceSettings.quality === 'low') {
        debugLog('Good FPS, increasing quality');
        setQuality('medium');
    }
}

// Set quality level
function setQuality(level) {
    performanceSettings.quality = level;
    const settings = qualitySettings[level];
    
    if (renderer) {
        renderer.setPixelRatio(settings.pixelRatio);
        
        scene.traverse((object) => {
            if (object.isLight && object.castShadow) {
                object.shadow.mapSize.width = settings.shadowMapSize;
                object.shadow.mapSize.height = settings.shadowMapSize;
                if (object.shadow.map) {
                    object.shadow.map.dispose();
                    object.shadow.map = null;
                }
            }
        });
    }
    
    debugLog(`Quality set to: ${level}`);
}

// Toggle shadows
function toggleShadows() {
    performanceSettings.shadows = !performanceSettings.shadows;
    
    if (renderer) {
        renderer.shadowMap.enabled = performanceSettings.shadows;
    }
    
    scene.traverse((object) => {
        if (object.isLight) {
            object.castShadow = performanceSettings.shadows;
        }
        if (object.isMesh) {
            object.castShadow = performanceSettings.shadows;
            object.receiveShadow = performanceSettings.shadows;
        }
    });
    
    debugLog(`Shadows ${performanceSettings.shadows ? 'enabled' : 'disabled'}`);
}

// Toggle animations
function toggleAnimations() {
    performanceSettings.animations = !performanceSettings.animations;
    debugLog(`Animations ${performanceSettings.animations ? 'enabled' : 'disabled'}`);
}

// Update debug information
function updateDebugInfo() {
    if (!debugMode || !renderer) return;
    
    const debugElements = {
        debugScene: currentScene,
        debugScroll: `${Math.round(scrollProgress * 100)}%`,
        debugCamera: `${camera.position.x.toFixed(1)}, ${camera.position.y.toFixed(1)}, ${camera.position.z.toFixed(1)}`,
        debugObjects: `${scene.children.length} objects`,
        debugDrawCalls: renderer.info.render.calls
    };

    Object.entries(debugElements).forEach(([id, value]) => {
        const element = document.getElementById(id);
        if (element) element.textContent = value;
    });
}

// Initialize Three.js
function init() {
    try {
        // Create scene
        scene = new THREE.Scene();
        scene.background = new THREE.Color(0x0f0f23);
        
        // Create camera
        camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        camera.position.set(0, 0, 5);
        
        // Create renderer
        const settings = qualitySettings[performanceSettings.quality];
        renderer = new THREE.WebGLRenderer({ 
            antialias: settings.antialias,
            powerPreference: "high-performance"
        });
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.setPixelRatio(settings.pixelRatio);
        renderer.shadowMap.enabled = performanceSettings.shadows;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.2;
        
        // Add to DOM
        const canvasContainer = document.getElementById('canvasContainer');
        canvasContainer.appendChild(renderer.domElement);
        
        // Setup scene elements
        setupLighting();
        createCharacter();
        createKTMBike();
        createComputerSetup();
        createEnvironments();
        
        // Setup event listeners
        setupEventListeners();
        
        // Start render loop
        animate();
        
        // Hide loading screen
        setTimeout(() => {
            const loadingScreen = document.getElementById('loadingScreen');
            loadingScreen.classList.add('hidden');
            isInitialized = true;
            debugLog('Initialization complete');
        }, 1000);
        
    } catch (error) {
        console.error('Initialization failed:', error);
        debugLog(`Initialization error: ${error.message}`);
    }
}

// Setup lighting with performance considerations
function setupLighting() {
    const settings = qualitySettings[performanceSettings.quality];
    
    // Ambient light
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
    scene.add(ambientLight);
    
    // Main directional light
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(5, 5, 5);
    directionalLight.castShadow = performanceSettings.shadows;
    directionalLight.shadow.mapSize.width = settings.shadowMapSize;
    directionalLight.shadow.mapSize.height = settings.shadowMapSize;
    directionalLight.shadow.camera.near = 0.5;
    directionalLight.shadow.camera.far = 50;
    directionalLight.shadow.camera.left = -10;
    directionalLight.shadow.camera.right = 10;
    directionalLight.shadow.camera.top = 10;
    directionalLight.shadow.camera.bottom = -10;
    scene.add(directionalLight);
    sceneObjects.lights.main = directionalLight;
    
    // Scene-specific lights
    const introLight = new THREE.PointLight(0x00f5ff, 0.3, 8);
    introLight.position.set(0, 2, 3);
    scene.add(introLight);
    sceneObjects.lights.intro = introLight;
    
    const adventureLight = new THREE.DirectionalLight(0xffd700, 0.4);
    adventureLight.position.set(-2, 8, 2);
    scene.add(adventureLight);
    sceneObjects.lights.adventure = adventureLight;
    
    const workLight = new THREE.PointLight(0xffffff, 0.5, 12);
    workLight.position.set(0, 2, 2);
    scene.add(workLight);
    sceneObjects.lights.work = workLight;
    
    updateLighting('intro');
}

// Update lighting based on scene
function updateLighting(sceneName) {
    if (!sceneObjects.lights.intro) return;
    
    sceneObjects.lights.intro.intensity = sceneName === 'intro' ? 0.3 : 0;
    sceneObjects.lights.adventure.intensity = sceneName === 'adventure' ? 0.4 : 0;
    sceneObjects.lights.work.intensity = sceneName === 'work' ? 0.5 : 0;
    sceneObjects.lights.main.intensity = sceneName === 'intro' ? 0.6 : 0.8;
}

// Create character with performance optimizations
function createCharacter() {
    character = new THREE.Group();
    const settings = qualitySettings[performanceSettings.quality];
    
    // Head
    const headGeometry = new THREE.SphereGeometry(0.3, settings.meshDetail, settings.meshDetail);
    const headMaterial = new THREE.MeshStandardMaterial({ color: 0xffdbac });
    const head = new THREE.Mesh(headGeometry, headMaterial);
    head.position.set(0, 1.5, 0);
    head.castShadow = performanceSettings.shadows;
    character.add(head);
    
    // Eyes
    const eyeGeometry = new THREE.SphereGeometry(0.05, 6, 6);
    const eyeMaterial = new THREE.MeshStandardMaterial({ color: 0x000000 });
    
    const leftEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
    leftEye.position.set(-0.1, 1.6, 0.25);
    character.add(leftEye);
    
    const rightEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
    rightEye.position.set(0.1, 1.6, 0.25);
    character.add(rightEye);
    
    // Body
    const bodyGeometry = new THREE.BoxGeometry(0.5, 1, 0.3);
    const bodyMaterial = new THREE.MeshStandardMaterial({ color: 0x2d3748 });
    const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
    body.position.set(0, 0.5, 0);
    body.castShadow = performanceSettings.shadows;
    character.add(body);
    
    // Arms
    const armGeometry = new THREE.CylinderGeometry(0.1, 0.1, 0.8, 6);
    const armMaterial = new THREE.MeshStandardMaterial({ color: 0xffdbac });
    
    const leftArm = new THREE.Mesh(armGeometry, armMaterial);
    leftArm.position.set(-0.4, 0.5, 0);
    leftArm.rotation.z = 0.3;
    leftArm.castShadow = performanceSettings.shadows;
    character.add(leftArm);
    
    const rightArm = new THREE.Mesh(armGeometry, armMaterial);
    rightArm.position.set(0.4, 0.5, 0);
    rightArm.rotation.z = -0.3;
    rightArm.castShadow = performanceSettings.shadows;
    character.add(rightArm);
    
    // Legs
    const legGeometry = new THREE.CylinderGeometry(0.12, 0.12, 0.9, 6);
    const legMaterial = new THREE.MeshStandardMaterial({ color: 0x1a202c });
    
    const leftLeg = new THREE.Mesh(legGeometry, legMaterial);
    leftLeg.position.set(-0.15, -0.5, 0);
    leftLeg.castShadow = performanceSettings.shadows;
    character.add(leftLeg);
    
    const rightLeg = new THREE.Mesh(legGeometry, legMaterial);
    rightLeg.position.set(0.15, -0.5, 0);
    rightLeg.castShadow = performanceSettings.shadows;
    character.add(rightLeg);
    
    character.position.set(0, 0, 2);
    scene.add(character);
}

// Create KTM Bike
function createKTMBike() {
    ktmBike = new THREE.Group();
    const settings = qualitySettings[performanceSettings.quality];
    
    // Main body
    const bodyGeometry = new THREE.BoxGeometry(1.5, 0.3, 0.5);
    const bodyMaterial = new THREE.MeshStandardMaterial({ color: 0xff6600 });
    const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
    body.position.set(0, 0.3, 0);
    body.castShadow = performanceSettings.shadows;
    ktmBike.add(body);
    
    // Wheels
    const wheelGeometry = new THREE.CylinderGeometry(0.4, 0.4, 0.15, Math.max(8, settings.meshDetail / 2));
    const wheelMaterial = new THREE.MeshStandardMaterial({ color: 0x222222 });
    
    const frontWheel = new THREE.Mesh(wheelGeometry, wheelMaterial);
    frontWheel.position.set(-0.6, -0.1, 0);
    frontWheel.rotation.x = Math.PI / 2;
    frontWheel.castShadow = performanceSettings.shadows;
    ktmBike.add(frontWheel);
    
    const backWheel = new THREE.Mesh(wheelGeometry, wheelMaterial);
    backWheel.position.set(0.8, -0.1, 0);
    backWheel.rotation.x = Math.PI / 2;
    backWheel.castShadow = performanceSettings.shadows;
    ktmBike.add(backWheel);
    
    // Handlebars and seat
    const handlebarGeometry = new THREE.CylinderGeometry(0.02, 0.02, 0.8, 6);
    const handlebarMaterial = new THREE.MeshStandardMaterial({ color: 0x333333 });
    const handlebars = new THREE.Mesh(handlebarGeometry, handlebarMaterial);
    handlebars.position.set(-0.5, 0.8, 0);
    handlebars.rotation.z = Math.PI / 2;
    ktmBike.add(handlebars);
    
    const seatGeometry = new THREE.BoxGeometry(0.6, 0.1, 0.3);
    const seatMaterial = new THREE.MeshStandardMaterial({ color: 0x000000 });
    const seat = new THREE.Mesh(seatGeometry, seatMaterial);
    seat.position.set(0, 0.6, 0);
    seat.castShadow = performanceSettings.shadows;
    ktmBike.add(seat);
    
    ktmBike.position.set(2, -0.8, -1);
    ktmBike.rotation.y = -0.5;
    ktmBike.visible = false;
    scene.add(ktmBike);
}

// Create Computer Setup
function createComputerSetup() {
    computerSetup = new THREE.Group();
    
    // Desk
    const deskGeometry = new THREE.BoxGeometry(3, 0.1, 1.5);
    const deskMaterial = new THREE.MeshStandardMaterial({ color: 0x8B4513 });
    const desk = new THREE.Mesh(deskGeometry, deskMaterial);
    desk.position.set(0, 0, 0);
    desk.castShadow = performanceSettings.shadows;
    desk.receiveShadow = performanceSettings.shadows;
    computerSetup.add(desk);
    
    // Monitor
    const monitorGeometry = new THREE.BoxGeometry(1.2, 0.8, 0.05);
    const monitorMaterial = new THREE.MeshStandardMaterial({ color: 0x000000 });
    const monitor = new THREE.Mesh(monitorGeometry, monitorMaterial);
    monitor.position.set(0, 0.5, -0.4);
    monitor.castShadow = performanceSettings.shadows;
    computerSetup.add(monitor);
    
    // Monitor Screen
    const screenGeometry = new THREE.PlaneGeometry(1.1, 0.7);
    const screenMaterial = new THREE.MeshStandardMaterial({ 
        color: 0x1a365d, 
        emissive: 0x1a365d, 
        emissiveIntensity: 0.2 
    });
    const screen = new THREE.Mesh(screenGeometry, screenMaterial);
    screen.position.set(0, 0.5, -0.35);
    computerSetup.add(screen);
    
    // Keyboard and mouse
    const keyboardGeometry = new THREE.BoxGeometry(0.8, 0.03, 0.3);
    const keyboardMaterial = new THREE.MeshStandardMaterial({ color: 0xdddddd });
    const keyboard = new THREE.Mesh(keyboardGeometry, keyboardMaterial);
    keyboard.position.set(0, 0.1, 0.2);
    keyboard.castShadow = performanceSettings.shadows;
    computerSetup.add(keyboard);
    
    const mouseGeometry = new THREE.BoxGeometry(0.1, 0.02, 0.15);
    const mouseMaterial = new THREE.MeshStandardMaterial({ color: 0x333333 });
    const mouse = new THREE.Mesh(mouseGeometry, mouseMaterial);
    mouse.position.set(0.5, 0.1, 0.2);
    mouse.castShadow = performanceSettings.shadows;
    computerSetup.add(mouse);
    
    computerSetup.position.set(0, -1.5, 1);
    computerSetup.visible = false;
    scene.add(computerSetup);
}

// Create environments
function createEnvironments() {
    // Ground plane for shadows
    const groundGeometry = new THREE.PlaneGeometry(20, 20);
    const groundMaterial = new THREE.MeshStandardMaterial({ 
        color: 0x444444, 
        transparent: true, 
        opacity: 0.1 
    });
    const ground = new THREE.Mesh(groundGeometry, groundMaterial);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -2;
    ground.receiveShadow = performanceSettings.shadows;
    scene.add(ground);

    const settings = qualitySettings[performanceSettings.quality];
    
    // Mountains
    const mountainGeometry1 = new THREE.ConeGeometry(2, 4, Math.max(6, settings.meshDetail / 2));
    const mountainMaterial1 = new THREE.MeshStandardMaterial({ color: 0x444444 });
    const mountain1 = new THREE.Mesh(mountainGeometry1, mountainMaterial1);
    mountain1.position.set(-8, -1, -10);
    mountain1.castShadow = performanceSettings.shadows;
    scene.add(mountain1);
    sceneObjects.mountains.push(mountain1);
    
    const mountainGeometry2 = new THREE.ConeGeometry(1.5, 3, Math.max(6, settings.meshDetail / 2));
    const mountainMaterial2 = new THREE.MeshStandardMaterial({ color: 0x555555 });
    const mountain2 = new THREE.Mesh(mountainGeometry2, mountainMaterial2);
    mountain2.position.set(-5, -0.5, -8);
    mountain2.castShadow = performanceSettings.shadows;
    scene.add(mountain2);
    sceneObjects.mountains.push(mountain2);
    
    const mountainGeometry3 = new THREE.ConeGeometry(2.5, 5, Math.max(6, settings.meshDetail / 2));
    const mountainMaterial3 = new THREE.MeshStandardMaterial({ color: 0x333333 });
    const mountain3 = new THREE.Mesh(mountainGeometry3, mountainMaterial3);
    mountain3.position.set(6, -1.5, -12);
    mountain3.castShadow = performanceSettings.shadows;
    scene.add(mountain3);
    sceneObjects.mountains.push(mountain3);
    
    // Starfield
    createStarfield();
}

// Create starfield background
function createStarfield() {
    const starGeometry = new THREE.BufferGeometry();
    const starCount = 1000;
    const positions = new Float32Array(starCount * 3);
    
    for (let i = 0; i < starCount * 3; i += 3) {
        positions[i] = (Math.random() - 0.5) * 100;
        positions[i + 1] = (Math.random() - 0.5) * 100;
        positions[i + 2] = (Math.random() - 0.5) * 100;
    }
    
    starGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    
    const starMaterial = new THREE.PointsMaterial({
        color: 0xffffff,
        size: 0.5,
        transparent: true,
        opacity: 0.8
    });
    
    const stars = new THREE.Points(starGeometry, starMaterial);
    scene.add(stars);
    sceneObjects.backgrounds.stars = stars;
}

// Setup event listeners
function setupEventListeners() {
    // Window resize
    window.addEventListener('resize', onWindowResize, false);
    
    // Scroll events
    const appContainer = document.getElementById('appContainer');
    appContainer.addEventListener('scroll', onScroll, { passive: true });
    
    // Keyboard events
    document.addEventListener('keydown', onKeyDown, false);
    
    // Mouse events for interaction
    document.addEventListener('mousemove', onMouseMove, false);
}

// Handle window resize
function onWindowResize() {
    if (!camera || !renderer) return;
    
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

// Handle scroll events
function onScroll(event) {
    const now = performance.now();
    if (now - lastScrollUpdate < SCROLL_THROTTLE) return;
    lastScrollUpdate = now;
    
    const container = event.target;
    const scrollTop = container.scrollTop;
    const scrollHeight = container.scrollHeight - container.clientHeight;
    scrollProgress = Math.min(scrollTop / scrollHeight, 1);
    
    updateSceneBasedOnScroll();
    updateUI();
}

// Handle keyboard events
function onKeyDown(event) {
    switch (event.key.toLowerCase()) {
        case 'd':
            toggleDebugMode();
            break;
        case 'p':
            togglePerformanceControls();
            break;
        case '1':
            setQuality('low');
            break;
        case '2':
            setQuality('medium');
            break;
        case '3':
            setQuality('high');
            break;
        case 's':
            toggleShadows();
            break;
        case 'a':
            toggleAnimations();
            break;
    }
}

// Handle mouse movement for subtle camera movement
function onMouseMove(event) {
    if (!camera || !isInitialized) return;
    
    const mouseX = (event.clientX / window.innerWidth) * 2 - 1;
    const mouseY = -(event.clientY / window.innerHeight) * 2 + 1;
    
    // Subtle camera movement based on mouse position
    camera.position.x += (mouseX * 0.5 - camera.position.x) * 0.02;
    camera.position.y += (mouseY * 0.3 - camera.position.y) * 0.02;
}

// Toggle debug mode
function toggleDebugMode() {
    debugMode = !debugMode;
    const debugInfo = document.getElementById('debugInfo');
    if (debugInfo) {
        debugInfo.style.display = debugMode ? 'block' : 'none';
    }
    debugLog(`Debug mode ${debugMode ? 'enabled' : 'disabled'}`);
}

// Toggle performance controls
function togglePerformanceControls() {
    const controls = document.getElementById('performanceControls');
    if (controls) {
        const isVisible = controls.style.display === 'block';
        controls.style.display = isVisible ? 'none' : 'block';
    }
}

// Update scene based on scroll progress
function updateSceneBasedOnScroll() {
    if (!isInitialized) return;
    
    // Determine current scene based on scroll progress
    let newScene;
    if (scrollProgress < 0.33) {
        newScene = 'intro';
    } else if (scrollProgress < 0.66) {
        newScene = 'adventure';
    } else {
        newScene = 'work';
    }
    
    // Update scene if changed
    if (newScene !== currentScene) {
        currentScene = newScene;
        updateSceneVisibility();
        updateLighting(currentScene);
        debugLog(`Scene changed to: ${currentScene}`);
    }
    
    // Update camera position based on scroll
    updateCameraPosition();
    
    // Animate objects
    if (performanceSettings.animations) {
        animateObjects();
    }
}

// Update scene visibility
function updateSceneVisibility() {
    if (!character || !ktmBike || !computerSetup) return;
    
    // Show/hide objects based on current scene
    character.visible = currentScene === 'intro';
    ktmBike.visible = currentScene === 'adventure';
    computerSetup.visible = currentScene === 'work';
    
    // Animate transitions
    const targetOpacity = {
        intro: currentScene === 'intro' ? 1 : 0,
        adventure: currentScene === 'adventure' ? 1 : 0,
        work: currentScene === 'work' ? 1 : 0
    };
    
    // Smooth transitions for objects
    if (character.material) {
        character.traverse((child) => {
            if (child.material) {
                child.material.transparent = true;
                child.material.opacity = THREE.MathUtils.lerp(
                    child.material.opacity || 1,
                    targetOpacity.intro,
                    0.1
                );
            }
        });
    }
}

// Update camera position based on scroll
function updateCameraPosition() {
    if (!camera) return;
    
    const progress = scrollProgress;
    
    // Camera movement through scenes
    if (currentScene === 'intro') {
        camera.position.z = THREE.MathUtils.lerp(camera.position.z, 5, 0.05);
        camera.position.y = THREE.MathUtils.lerp(camera.position.y, 0, 0.05);
        camera.rotation.y = THREE.MathUtils.lerp(camera.rotation.y, 0, 0.05);
    } else if (currentScene === 'adventure') {
        camera.position.z = THREE.MathUtils.lerp(camera.position.z, 3, 0.05);
        camera.position.y = THREE.MathUtils.lerp(camera.position.y, 1, 0.05);
        camera.rotation.y = THREE.MathUtils.lerp(camera.rotation.y, 0.2, 0.05);
    } else if (currentScene === 'work') {
        camera.position.z = THREE.MathUtils.lerp(camera.position.z, 4, 0.05);
        camera.position.y = THREE.MathUtils.lerp(camera.position.y, -0.5, 0.05);
        camera.rotation.y = THREE.MathUtils.lerp(camera.rotation.y, -0.1, 0.05);
    }
    
    // Look at the appropriate object
    const lookAtTargets = {
        intro: character ? character.position : new THREE.Vector3(0, 0, 0),
        adventure: ktmBike ? ktmBike.position : new THREE.Vector3(2, -0.8, -1),
        work: computerSetup ? computerSetup.position : new THREE.Vector3(0, -1.5, 1)
    };
    
    if (lookAtTargets[currentScene]) {
        camera.lookAt(lookAtTargets[currentScene]);
    }
}

// Animate objects
function animateObjects() {
    const time = performance.now() * 0.001;
    
    // Rotate character slightly
    if (character && currentScene === 'intro') {
        character.rotation.y = Math.sin(time * 0.5) * 0.1;
    }
    
    // Animate KTM bike wheels
    if (ktmBike && currentScene === 'adventure') {
        ktmBike.children.forEach((child, index) => {
            if (index === 1 || index === 2) { // wheels
                child.rotation.x += 0.02;
            }
        });
    }
    
    // Animate screen glow
    if (computerSetup && currentScene === 'work') {
        const screen = computerSetup.children.find(child => 
            child.material && child.material.emissive
        );
        if (screen) {
            screen.material.emissiveIntensity = 0.2 + Math.sin(time * 2) * 0.1;
        }
    }
    
    // Rotate mountains slightly
    sceneObjects.mountains.forEach((mountain, index) => {
        mountain.rotation.y = Math.sin(time * (0.1 + index * 0.05)) * 0.02;
    });
    
    // Animate starfield
    if (sceneObjects.backgrounds.stars) {
        sceneObjects.backgrounds.stars.rotation.y = time * 0.0005;
        sceneObjects.backgrounds.stars.rotation.x = time * 0.0002;
    }
}

// Update UI elements
function updateUI() {
    const now = performance.now();
    if (now - lastUIUpdate < UI_THROTTLE) return;
    lastUIUpdate = now;
    
    // Update progress bar
    const progressFill = document.getElementById('progressFill');
    if (progressFill) {
        progressFill.style.width = `${scrollProgress * 100}%`;
    }
    
    // Update scroll text
    const scrollText = document.getElementById('scrollText');
    if (scrollText) {
        scrollText.textContent = `Scroll to explore • ${Math.round(scrollProgress * 100)}%`;
    }
    
    // Update scene info based on current scene
    updateSceneInfo();
    
    // Update debug info
    if (debugMode) {
        updateDebugInfo();
    }
}

// Update scene information displayed to user
function updateSceneInfo() {
    const sceneTitle = document.getElementById('sceneTitle');
    const sceneDescription = document.getElementById('sceneDescription');
    const projectsGrid = document.getElementById('projectsGrid');
    
    if (!sceneTitle || !sceneDescription || !projectsGrid) return;
    
    const sceneData = {
        intro: {
            title: 'Tech Enthusiast & Adventure Seeker',
            description: 'Welcome to my interactive portfolio',
            showProjects: false
        },
        adventure: {
            title: 'Adventure & Exploration',
            description: 'Discovering new places and experiences on my KTM',
            showProjects: false
        },
        work: {
            title: 'Professional Projects',
            description: 'My development work and technical expertise',
            showProjects: true
        }
    };
    
    const data = sceneData[currentScene];
    if (data) {
        sceneTitle.textContent = data.title;
        sceneDescription.textContent = data.description;
        
        if (data.showProjects) {
            projectsGrid.classList.add('visible');
        } else {
            projectsGrid.classList.remove('visible');
        }
    }
}

// Main animation loop
function animate() {
    animationId = requestAnimationFrame(animate);
    
    if (!renderer || !scene || !camera) return;
    
    try {
        // Update performance stats
        updatePerformanceStats();
        
        // Render the scene
        renderer.render(scene, camera);
        
    } catch (error) {
        console.error('Render error:', error);
        debugLog(`Render error: ${error.message}`);
    }
}

// Cleanup function
function cleanup() {
    if (animationId) {
        cancelAnimationFrame(animationId);
    }
    
    if (renderer) {
        renderer.dispose();
    }
    
    // Dispose of geometries and materials
    scene.traverse((object) => {
        if (object.geometry) {
            object.geometry.dispose();
        }
        if (object.material) {
            if (Array.isArray(object.material)) {
                object.material.forEach(material => material.dispose());
            } else {
                object.material.dispose();
            }
        }
    });
    
    debugLog('Cleanup completed');
}

// Handle page visibility change
document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
        // Pause animations when tab is not visible
        if (animationId) {
            cancelAnimationFrame(animationId);
            animationId = null;
        }
    } else {
        // Resume animations when tab becomes visible
        if (!animationId && isInitialized) {
            animate();
        }
    }
});

// Handle page unload
window.addEventListener('beforeunload', cleanup);

// Error handling
window.addEventListener('error', (event) => {
    console.error('Global error:', event.error);
    debugLog(`Global error: ${event.error.message}`);
});

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    debugLog('DOM loaded, initializing...');
    
    // Check for WebGL support
    if (!window.WebGLRenderingContext) {
        alert('WebGL is not supported by your browser.');
        return;
    }
    
    try {
        init();
    } catch (error) {
        console.error('Failed to initialize:', error);
        debugLog(`Initialization failed: ${error.message}`);
    }
});

// Mobile optimizations
if (/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)) {
    // Set lower quality for mobile devices
    performanceSettings.quality = 'low';
    performanceSettings.shadows = false;
    performanceSettings.targetFPS = 30;
    
    // Reduce particle count for mobile
    if (typeof createStarfield === 'function') {
        // This will be handled in the createStarfield function
        debugLog('Mobile device detected, applying optimizations');
    }
}

// Touch event handling for mobile
let touchStartY = 0;

document.addEventListener('touchstart', (e) => {
    touchStartY = e.touches[0].clientY;
}, { passive: true });

document.addEventListener('touchmove', (e) => {
    if (!isInitialized) return;
    
    const touchY = e.touches[0].clientY;
    const deltaY = touchStartY - touchY;
    
    // Convert touch movement to scroll progress
    const container = document.getElementById('appContainer');
    if (container) {
        container.scrollTop += deltaY * 2; // Multiply for faster scroll
    }
}, { passive: true });

// Prevent right-click context menu on canvas
document.addEventListener('contextmenu', (e) => {
    if (e.target.tagName === 'CANVAS') {
        e.preventDefault();
    }
});

// Export functions for global access (if needed)
window.portfolioControls = {
    setQuality,
    toggleShadows,
    toggleAnimations,
    toggleDebugMode,
    togglePerformanceControls
};