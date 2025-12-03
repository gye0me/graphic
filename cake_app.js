// 학번: 20230789
// 이름: 배희겸
// 사용한 Three.js 방법: CDN

const h_scr = window.innerWidth;
const v_scr = window.innerHeight;
const viewSize = 10; 
const aspect = h_scr / v_scr;
const moveSpeed = 0.1; 
const CAKE_HEIGHT = 1.0; 

const BASE_ROTATION_SPEED = 0.001;
const TOPPING_ROTATION_SPEED = 0.015;

const scene = new THREE.Scene(); 
scene.background = new THREE.Color(0xf8e8f0); // 🚨 MODIFIED: 배경색을 핑크빛 주방처럼 유지 (배경 이미지와 블렌딩 목적)

// --- Physics Variables for Topping Drop Simulation ---
const GRAVITY = -0.01;      // Downward acceleration (per frame)
const START_Y = 1.0;        // Initial vertical position for dropping (relative to customToppingGroup)
const SETTLED_Y = 0.05;     // The Y position where toppings rest (relative to customToppingGroup)
const activePhysicsMeshes = []; // List of meshes currently undergoing physics simulation
// ---------------------------------------------------

// --- Rhythm Game Variables ---
let rhythmActive = false;
let rhythmTargets = []; // Sequence of required keys
let targetIndex = 0;
let rhythmScore = 0;
const RHYTHM_MAX_SCORE = 100;
const RHYTHM_DURATION = 5000; // 5 seconds
let rhythmStartTime = 0;
const ARROW_KEYS = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];
const ARROW_SYMBOLS = { 'ArrowUp': '↑', 'ArrowDown': '↓', 'ArrowLeft': '←', 'ArrowRight': '→' };
// -----------------------------

let mixingQuality = 0; // 0 to 100
const NUM_SEGMENTS = 8; // For topping distribution score calculation
// --- 모드 변수 ---
let gameMode = 'MAKING'; 
let makingStep = 0; // 0: 시작, 1: 믹싱 중, 2: 반죽 완료, 3: 굽기 완료, 4: 크림 펴바르기 완료 대기, 5: 장식 모드
let selectedToppingType = null;
let selectedCreamColor = 0xffffff;

// 🚨 점수 및 미니게임 변수 추가
let score = 0;
let toppingsCount = 0;
const MAX_COMPLETENESS_COUNT = 25; // 🚨 ADDED: 완성도 바 최대 토핑 개수 정의
let pipingActive = false;
let lastPipingPoint = null;
const MAX_TOPPING_RADIUS = 1.4; 
const PIPING_CREAM_COLOR = 0xffffff; 
const activeSplashMeshes = []; 


const mouse = new THREE.Vector2();
const raycaster = new THREE.Raycaster();

// --- HTML 요소 ---
const paletteContainer = document.getElementById('palette-container');
const messageElement = document.getElementById('message');
const controlsElement = document.getElementById('viewing-controls');
const scoreOverlay = document.getElementById('score-overlay');


// --- 1. 카메라 설정 ---
const perspectiveCamera = new THREE.PerspectiveCamera(75, h_scr / v_scr, 0.1, 1000);
perspectiveCamera.position.set(0, 2.0, 4); 

const orthographicCamera = new THREE.OrthographicCamera(
    viewSize * aspect / -2, viewSize * aspect / 2, viewSize / 2, viewSize / -2, 0.1, 100
);
orthographicCamera.position.set(0, 5, 0);

let currentCamera = perspectiveCamera;
currentCamera.lookAt(0, 0, 0); 

// 렌더러 설정
const renderer = new THREE.WebGLRenderer({ antialias: true });
document.body.appendChild(renderer.domElement);
renderer.setSize(h_scr, v_scr);
renderer.shadowMap.enabled = true; 
renderer.shadowMap.type = THREE.PCFSoftShadowMap; 


// --- 2. 조명 설정 ---
const ambientLight = new THREE.AmbientLight(0xffffff, 0.7); 
scene.add(ambientLight);

const spotLight = new THREE.SpotLight(0xffffff, 2.0, 10, Math.PI * 0.15, 0.5, 2); 
spotLight.position.set(2, 4, 3);
spotLight.castShadow = true;
spotLight.shadow.mapSize.width = 1024;
spotLight.shadow.mapSize.height = 1024;
scene.add(spotLight);

const frontLight = new THREE.DirectionalLight(0xffffff, 0.5);
frontLight.position.set(0, 3, 5);
frontLight.castShadow = true;
scene.add(frontLight);

const lightColors = [0xffffff, 0xf183f3, 0x3de6c5, 0xffa500]; 
let currentLightColorIndex = 0;

// 🚨 ADDED/MODIFIED: 배경 이미지 Texture Loading 및 투명 평면 적용
const loader = new THREE.TextureLoader();
loader.load('./kitchen.jpg', function(texture) {
    // 1. 큰 평면 생성
    const bgGeometry = new THREE.PlaneGeometry(20, 10);
    // 2. 텍스처를 맵핑하고 투명도를 0.5로 설정하여 배경색과 블렌딩 (덜 집중되게 함)
    const bgMaterial = new THREE.MeshBasicMaterial({ 
        map: texture, 
        transparent: true, 
        opacity: 0.5, // 🚨 투명도 적용
        side: THREE.DoubleSide
    });
    const backgroundMesh = new THREE.Mesh(bgGeometry, bgMaterial);
    
    // 3. 케이크 뒤쪽에 배치
    backgroundMesh.position.set(0, 4, -4.9);
    scene.add(backgroundMesh);
}, undefined, function(err) {
    console.error('An error happened loading the kitchen background texture. Falling back to color.', err);
});


// --- 3. 주방 환경 설정 (카운터/받침 복원) --- 
const kitchenGroup = new THREE.Group();
scene.add(kitchenGroup);

// 🚨 ADDED: 카운터 재질 및 메쉬 복원
const counterMaterial = new THREE.MeshLambertMaterial({ color: 0xffa07a }); // 연한 오렌지 핑크 카운터
const counter = new THREE.Mesh(new THREE.BoxGeometry(5, 1, 5), counterMaterial);
counter.position.set(0, -0.5, 0);
counter.receiveShadow = true;
kitchenGroup.add(counter);

// 🚨 ADDED: 바닥 복원
const floor = new THREE.Mesh(new THREE.PlaneGeometry(20, 20), new THREE.MeshLambertMaterial({ color: 0xfde2e2, side: THREE.DoubleSide })); // 연핑크 바닥
floor.rotation.x = -Math.PI / 2; 
floor.position.y = -1; 
floor.receiveShadow = true;
scene.add(floor);


// --- 4. 케이크 제작/모델링 요소 ---

// 🚨 텍스처 제거 및 Material 개선
const bakedMaterial = new THREE.MeshStandardMaterial({ 
    color: 0xe0b28a, 
    roughness: 0.8, 
    metalness: 0.1 
}); 
const creamMaterial = new THREE.MeshStandardMaterial({ 
    color: selectedCreamColor, 
    roughness: 0.5, 
    metalness: 0.01 
}); 
const strawberryMaterial = new THREE.MeshPhongMaterial({ color: 0xff0000, shininess: 50 }); 
const chocolateMaterial = new THREE.MeshPhongMaterial({ color: 0x8b4513, shininess: 20 }); 
const macaronMaterial = new THREE.MeshPhongMaterial({ color: 0xe0e0e0, shininess: 80 }); 
const beanMaterial = new THREE.MeshPhongMaterial({ color: 0x803333, shininess: 20 }); 

// 🚨 파이핑 크림 재질
const pipingMaterial = new THREE.MeshStandardMaterial({ 
    color: PIPING_CREAM_COLOR, 
    roughness: 0.5, 
    metalness: 0.01 
});


// 4-1. 믹싱 용기 (기존 코드 유지)
const bowlGroup = new THREE.Group();
bowlGroup.position.y = 1.0;
scene.add(bowlGroup);
const bowl = new THREE.Mesh(
    new THREE.CylinderGeometry(2.0, 1.5, 1.0, 32, 1, true),
    new THREE.MeshStandardMaterial({ 
        color: 0xaaaaaa, // 🚨 MODIFIED: 색상 약간 어둡게 조정
        transparent: true, 
        opacity: 0.8, // 🚨 MODIFIED: 오파시티 증가 (0.3 -> 0.8)
        side: THREE.BackSide 
    })
);
bowl.position.y = 0.5;
bowlGroup.add(bowl);
const mixingContent = new THREE.Group();
const egg = new THREE.Mesh(new THREE.SphereGeometry(0.15), new THREE.MeshBasicMaterial({ color: 0xffaa00 }));
const flour = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.3), new THREE.MeshBasicMaterial({ color: 0xffffff }));
for(let i=0; i<30; i++) {
    const item = i % 5 === 0 ? egg.clone() : flour.clone();
    item.position.set((Math.random() - 0.5) * 2, Math.random() * 0.5, (Math.random() - 0.5) * 2);
    mixingContent.add(item);
}
mixingContent.position.y = 0.5;
mixingContent.visible = false;
bowlGroup.add(mixingContent);


// 4-2. 케이크 본체 (1층)
const cakeGroup = new THREE.Group();
cakeGroup.position.y = 0.5; 
cakeGroup.visible = false; 
scene.add(cakeGroup);

const cakeLayerGeometry = new THREE.CylinderGeometry(1.5, 1.5, CAKE_HEIGHT, 32);

// 빵 층
const cakeBody = new THREE.Mesh(cakeLayerGeometry, bakedMaterial);
cakeBody.position.y = 0; 
cakeBody.castShadow = true;
cakeBody.receiveShadow = true;
cakeGroup.add(cakeBody);

// 생크림 레이어 (케이크 윗면)
const creamTop = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.5, 0.1, 32), creamMaterial);
creamTop.position.y = CAKE_HEIGHT * 0.5 + 0.05; 
creamTop.castShadow = true;
creamTop.receiveShadow = true;
cakeGroup.add(creamTop);


// 4-3. 토핑 그룹
const customToppingGroup = new THREE.Group();
customToppingGroup.position.y = 0.5 * CAKE_HEIGHT + 0.1;
cakeGroup.add(customToppingGroup);

const themeToppingGroup = new THREE.Group();
themeToppingGroup.position.y = 0.5 * CAKE_HEIGHT + 0.1;
cakeGroup.add(themeToppingGroup);
themeToppingGroup.visible = false; 

// --- 촛불 (기존 코드 유지) ---
const mainCandleGroup = new THREE.Group();
mainCandleGroup.position.set(0, CAKE_HEIGHT * 0.5 + 0.15, 0); 
cakeGroup.add(mainCandleGroup);

const candleBody = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.6, 16), new THREE.MeshPhongMaterial({ color: 0xffa500, shininess: 50 })); 
candleBody.position.y = 0.3; 
mainCandleGroup.add(candleBody);
const flame = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 8), new THREE.MeshBasicMaterial({ color: 0xffc800, transparent: true, opacity: 0.8 })); 
flame.position.y = 0.65; 
mainCandleGroup.add(flame);
const candleLight = new THREE.PointLight(0xffaa00, 1.0, 2); 
candleLight.position.y = 0.7; 
mainCandleGroup.add(candleLight);

let isCandleOn = true;
candleLight.visible = isCandleOn;
flame.visible = isCandleOn;


// 4-4. 테마별 토핑 (기존 코드 유지)
const themeMeshes = new THREE.Group(); 
themeToppingGroup.add(themeMeshes); 

const strawberryMeshes = [];
[[1.0, 0], [-1.0, 0], [0.7, 0.7], [-0.7, 0.7], [0, -1.0]].forEach(pos => {
    const s = new THREE.Mesh(new THREE.SphereGeometry(0.2, 16, 16), strawberryMaterial);
    s.position.set(pos[0], 0, pos[1]);
    themeMeshes.add(s);
    strawberryMeshes.push(s);
});

const chocolateDrizzle = new THREE.Mesh(new THREE.TorusKnotGeometry(1.3, 0.08, 64, 8, 2, 3), chocolateMaterial);
chocolateDrizzle.position.set(0, -0.15, 0); 
chocolateDrizzle.scale.set(1.0, 0.5, 1.0);
chocolateDrizzle.rotation.x = Math.PI / 2;
themeMeshes.add(chocolateDrizzle);

const sweetPotatoMeshes = [];
const sweetPotatoGeometry = new THREE.SphereGeometry(0.3, 16, 16);
[[0.5, 0.5, 0.8], [-0.5, 0.5, 1.2], [0, -0.7, 1.0], [1.0, -0.3, 0.9]].forEach(params => {
    const m = new THREE.Mesh(sweetPotatoGeometry, new THREE.MeshPhongMaterial({ color: 0xd7af70, shininess: 30 }));
    m.position.set(params[0], 0.1 + params[2] * 0.15, params[1]);
    m.scale.y = params[2];
    themeMeshes.add(m);
    sweetPotatoMeshes.push(m);
});

const matchaMeshes = [];
const macaronGeometry = new THREE.CylinderGeometry(0.4, 0.4, 0.2, 32);
[['macaron', 1.2, 0.5], ['macaron', -1.2, 0.5], ['macaron', 0.8, -0.9], 
 ['bean', 0.3, 0.9], ['bean', -0.4, 0.8], ['bean', 0.6, 0.1], ['bean', -0.8, -0.2], ['bean', 0.1, -0.6]]
.forEach(params => {
    let element;
    if (params[0] === 'macaron') {
        element = new THREE.Mesh(macaronGeometry, macaronMaterial);
        element.rotation.x = Math.PI / 2; 
    } else { 
        element = new THREE.Mesh(new THREE.SphereGeometry(0.1, 12, 12), beanMaterial);
    }
    element.position.set(params[1], 0.05, params[2]);
    themeMeshes.add(element);
    matchaMeshes.push(element);
});

const themeSprinkleMeshes = [];
const sprinkleGeometry = new THREE.CylinderGeometry(0.03, 0.03, 0.1, 8);
const sprinkleColors = [0xffa500, 0x00ff00, 0x0000ff, 0xff00ff, 0xffff00]; 
for (let i = 0; i < 50; i++) { 
    const material = new THREE.MeshPhongMaterial({ shininess: 100 });
    const sprinkle = new THREE.Mesh(sprinkleGeometry, material);
    const radius = Math.random() * 1.3;
    const angle = Math.random() * Math.PI * 2;
    sprinkle.position.set(Math.cos(angle) * radius, 0.05, Math.sin(angle) * radius);
    sprinkle.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
    themeMeshes.add(sprinkle);
    themeSprinkleMeshes.push(sprinkle);
}
themeMeshes.children.forEach(m => m.visible = false); 


// --- 5. 케이크 종류 정의 및 업데이트 함수 (기존 코드 유지) ---
const CAKE_THEMES = [
    { body: 0x4a2c2a, cream: 0x7b3f00, topping: 'chocolate' }, 
    { body: 0xffe0e0, cream: 0xffffff, topping: 'strawberry' }, 
    { body: 0xc8a2c8, cream: 0xffd700, topping: 'sweetpotato' }, 
    { body: 0xc0c8a0, cream: 0x5a8d41, topping: 'matcha' } 
];
let currentThemeIndex = -1; 
let isToppingRotating = true;


function updateCakeTheme() {
    if (currentThemeIndex === -1) { 
        cakeBody.material = bakedMaterial;
        cakeBody.material.color.set(0xe0b28a); 
        
        creamTop.material.color.set(selectedCreamColor); 
        
        customToppingGroup.visible = true;
        themeToppingGroup.visible = false;
        
    } else {
        const theme = CAKE_THEMES[currentThemeIndex];
        const toppingType = theme.topping;
        
        cakeBody.material.color.set(theme.body);
        creamTop.material.color.set(theme.cream);
        
        customToppingGroup.visible = false;
        themeToppingGroup.visible = true;
        
        themeMeshes.children.forEach(m => m.visible = false);
        strawberryMeshes.forEach(s => s.visible = toppingType === 'strawberry');
        chocolateDrizzle.visible = toppingType === 'chocolate';
        sweetPotatoMeshes.forEach(s => s.visible = toppingType === 'sweetpotato');
        matchaMeshes.forEach(s => s.visible = toppingType === 'matcha');
        
        themeSprinkleMeshes.forEach((s, i) => {
            s.visible = true;
            const material = s.material;
            if (toppingType === 'matcha') material.color.set(Math.random() > 0.5 ? 0x90ee90 : 0xffffff);
            else if (toppingType === 'sweetpotato') material.color.set(0x8b4513);
            else material.color.set(sprinkleColors[i % sprinkleColors.length]);
            material.needsUpdate = true;
        });
    }

    cakeBody.material.needsUpdate = true;
    creamTop.material.needsUpdate = true;
}


// --- 6. 모드 전환 및 제작 단계 로직 ---

// 🚨 점수 표시 업데이트 함수
function updateScoreDisplay() {
    const finalScore = Math.max(0, Math.round(score + (toppingsCount * 2)));
    const scoreElement = document.getElementById('score-value');
    if (scoreElement) {
        scoreElement.textContent = finalScore;
    }
    
    // 🚨 MODIFIED/ADDED: Completeness Bar Update (장식 완성도 바 업데이트)
    const completenessRatio = Math.min(1, toppingsCount / MAX_COMPLETENESS_COUNT);
    const widthPercent = completenessRatio * 100;
    
    const completenessBar = document.getElementById('completeness-bar');
    if (completenessBar) {
        completenessBar.style.width = widthPercent + '%';
    }
}

// 🚨 Topping Balance Quality Mini-game Score Calculation
function calculateToppingScore() {
    let balanceScore = 0;
    let totalToppings = customToppingGroup.children.length;
    if (totalToppings === 0) return 0;
    
    // 1. Radial Distribution Check (Evenness)
    const segmentCounts = new Array(NUM_SEGMENTS).fill(0);
    let totalRadius = 0;

    customToppingGroup.children.forEach(topping => {
        // 'drizzle'은 위치가 고정되어 있으므로 스코어 계산에서 제외
        if (topping.name === 'drizzle') return;

        const pos = topping.position;
        // x, z 좌표를 사용하여 반지름과 각도 계산
        const radius = Math.sqrt(pos.x * pos.x + pos.z * pos.z);
        totalRadius += radius;

        // Angle check (0 to 2*PI)
        const angle = Math.atan2(pos.z, pos.x);
        // Normalize angle to 0 to 2*PI and map to segment index
        let segmentIndex = Math.floor(((angle + Math.PI) / (2 * Math.PI)) * NUM_SEGMENTS) % NUM_SEGMENTS;
        segmentCounts[segmentIndex]++;
    });

    // Count non-drizzle toppings for accurate average calculation
    const actualToppings = customToppingGroup.children.filter(c => c.name !== 'drizzle').length;
    if (actualToppings === 0) return 0;

    // Calculate variance of counts (lower variance = better distribution)
    const avgCount = actualToppings / NUM_SEGMENTS;
    const variance = segmentCounts.reduce((acc, count) => acc + Math.pow(count - avgCount, 2), 0) / NUM_SEGMENTS;
    
    // Convert low variance into high score. Max variance is high (e.g., if all 10 toppings are in 1 segment: ~11)
    const MAX_THEORETICAL_VARIANCE = 15; // Set a high baseline
    const normalizedVariance = Math.min(1, variance / MAX_THEORETICAL_VARIANCE); 
    
    // Score based on evenness (Max 50 points)
    balanceScore += Math.round(50 * (1 - normalizedVariance)); 
    
    // 2. Clustering Penalty (Encourage spreading out)
    const avgRadius = totalRadius / actualToppings;
    const IDEAL_RADIUS = 0.8; // Ideal average distance for a spread-out look (Cake radius 1.5)
    const radiusDeviation = Math.abs(avgRadius - IDEAL_RADIUS);
    
    // Apply penalty for deviation from ideal radius (Max penalty 20 points)
    if (radiusDeviation > 0.3) { 
        balanceScore -= Math.round(20 * Math.min(1, radiusDeviation / 0.8)); // Normalize deviation to 0-1
    }
    
    return Math.max(0, balanceScore);
}
function setGameMode(mode) {
    gameMode = mode;
    messageElement.style.display = 'none';
    paletteContainer.style.display = 'none';
    controlsElement.style.display = 'none';
    scoreOverlay.style.display = 'none';
    bowlGroup.visible = false;
    cakeGroup.visible = false;
    
    mainCandleGroup.visible = true;
    candleLight.visible = isCandleOn;
    flame.visible = isCandleOn;
    
    // 크림 펴바르기 미니게임 제거: 관련 리스너 제거 로직 삭제

    if (mode === 'MAKING') {
        bowlGroup.visible = true;
        cakeBody.visible = false;
        creamTop.visible = false;
        messageElement.innerHTML = `**Little Patissier's Dream**<br>케이크 제작 시뮬레이션을 시작합니다!<br><span style="color: #f8bbd0;">[Spacebar]</span>를 눌러 반죽 및 믹싱 과정을 진행하세요.`;
        messageElement.style.display = 'block';
        makingStep = 0;
        mixingContent.visible = false;
        mixingContent.children.forEach(m => m.material.color.set(m.geometry.type === 'SphereGeometry' ? 0xffaa00 : 0xffffff)); 
        mixingQuality = 0;
        
    } else if (mode === 'DECORATING') {
        cakeGroup.visible = true;
        cakeBody.visible = true;
        creamTop.visible = true;

        // 🚨 점수 초기화 및 UI 업데이트
        score = 0;
        toppingsCount = 0;
        customToppingGroup.children.length = 0; 
        updateScoreDisplay();
        
        // 🚨 메시지 업데이트: Spacebar 추가
        messageElement.innerHTML = `**장식 모드**<br>팔레트에서 <span class="highlight">생크림 색상</span> 또는 <span class="highlight">토핑</span> 선택 후 케이크 윗면을 <span class="highlight">클릭/드래그</span>.<br>완료 후 <span style="color: #f8bbd0;">[Enter]</span> 또는 <span style="color: #f8bbd0;">[Spacebar]</span> 키를 누르세요.`;
        messageElement.style.display = 'block';
        paletteContainer.style.display = 'block';
        scoreOverlay.style.display = 'block'; // 점수 오버레이 표시
        customToppingGroup.visible = true;
        themeToppingGroup.visible = false;
        
        // DECORATING 모드 진입 시 생크림 색상을 흰색으로 초기화
        creamTop.material.color.set(0xffffff); 
        selectedCreamColor = 0xffffff;
        
        document.querySelectorAll('.palette-item').forEach(i => i.classList.remove('selected'));
        document.querySelector('.palette-item[data-color="0xffffff"]').classList.add('selected');

    } else if (mode === 'VIEWING') {
        cakeGroup.visible = true;
        cakeBody.visible = true;
        creamTop.visible = true;

        controlsElement.style.display = 'block';
        
        selectedCreamColor = creamTop.material.color.getHex(); 
        
        currentThemeIndex = -1; 
        updateCakeTheme();

        // 🚨 Topping Quality Mini-game: 밸런스 점수 계산
        const toppingQualityScore = calculateToppingScore();
        score += toppingQualityScore;
        
        let toppingQualityMessage = "";
        if (toppingQualityScore >= 40) {
            toppingQualityMessage = " (✨ 완벽한 배치!)";
        } else if (toppingQualityScore >= 20) {
            toppingQualityMessage = " (✅ 균형 잡힌 배치)";
        } else {
            toppingQualityMessage = " (❌ 불균형 배치)";
        }
        
        const finalScore = Math.max(0, Math.round(score + (toppingsCount * 2))); 
        messageElement.innerHTML = `⭐ 케이크 완성! 최종 점수: <span style="color: #ffaa00; font-size: 1.5em;">${finalScore}</span>점! ⭐ ${toppingQualityMessage}<br> [Enter]를 눌러 관람 모드를 시작하세요.`;
        messageElement.style.display = 'block';
        setTimeout(() => messageElement.style.display = 'none', 3000); 
    }
}


// --- 크림 펴바르기 미니게임 관련 함수 제거 완료 ---


function advanceMakingStep() {
    makingStep++;

    if (makingStep === 1) { 
        mixingContent.visible = true;
        
        // --- START RHYTHM MIXER GAME ---
        const rhythmDisplay = document.getElementById('rhythm-display');
        document.getElementById('rhythm-mixer').style.display = 'flex';
        messageElement.style.display = 'none';

        // 🚨 ADDED: 리듬 게임 시간 경과 바 초기화
        const rhythmProgressBar = document.getElementById('rhythm-progress-bar');
        if (rhythmProgressBar) {
            rhythmProgressBar.style.width = '100%';
        }

        rhythmTargets = [];
        targetIndex = 0;
        rhythmScore = 0;
        rhythmStartTime = Date.now();
        rhythmActive = true;
        
        // Generate a sequence of 15 random arrows
        for(let i = 0; i < 15; i++) {
            rhythmTargets.push(ARROW_KEYS[Math.floor(Math.random() * ARROW_KEYS.length)]);
        }

        rhythmDisplay.innerHTML = rhythmTargets.map(key => `<span class="target-arrow" style="opacity: 0.3;">${ARROW_SYMBOLS[key]}</span>`).join('');
        
        // Highlight the first target
        if (rhythmDisplay.firstChild) {
            rhythmDisplay.firstChild.style.opacity = 1.0;
            rhythmDisplay.firstChild.style.color = '#d81b60'; // Set target color
        }
        
    } else if (makingStep === 2) { 
        // 🚨 믹싱 퀄리티 최종 계산 및 시각화 (Rhythm Game Result)
        
        // Normalize score to 0-100% based on max possible score (15 targets * 100/15)
        const targetsCount = rhythmTargets.length;
        const maxPossibleScore = targetsCount * (100 / targetsCount);
        const qualityRatio = Math.min(1, rhythmScore / maxPossibleScore);
        
        // Finalize mixing quality score
        mixingQuality = qualityRatio * 100;
        
        document.getElementById('rhythm-mixer').style.display = 'none';
        // 🚨 믹싱 퀄리티 최종 계산 및 시각화 (MAKING Quality Mini-game)
        
        // 퀄리티에 따라 반죽 색상 미묘하게 변경 (1.0 = 황금색, 0.0 = 연한 색)
        const perfectColor = new THREE.Color(0xf4d03f);
        const poorColor = new THREE.Color(0xffffe0); 
        const finalColor = poorColor.lerp(perfectColor, qualityRatio); 
        
        mixingContent.children.forEach(m => m.material.color.set(finalColor.getHex()));
        
        // 점수 반영 (최대 30점)
        const mixingScore = Math.round(qualityRatio * 30);
        score += mixingScore;

        let qualityMessage;
        if (qualityRatio >= 0.9) {
            qualityMessage = "✨ **최고의 반죽!** 황금빛 반죽이 완성되었습니다. (+" + mixingScore + "점)";
        } else if (qualityRatio >= 0.5) {
            qualityMessage = "✅ **좋은 반죽!** 무난하게 믹싱되었습니다. (+" + mixingScore + "점)";
        } else {
            qualityMessage = "❌ **믹싱 부족!** 리듬감이 부족했어요. (+" + mixingScore + "점)";
        }

        messageElement.innerHTML = `**반죽 완료!** ${qualityMessage}<br> <span style="color: #f8bbd0;">[Spacebar]</span>로 굽기를 시작하세요.`;
        messageElement.style.display = 'block';

    } else if (makingStep === 3) { 
        bowlGroup.visible = false;
        cakeGroup.visible = true;
        cakeBody.visible = true;
        creamTop.visible = true;
        cakeBody.material = bakedMaterial; 
        cakeBody.material.color.set(0xe0b28a); 
        
        // 🚨 크림 펴바르기 미니게임 제거: 바로 장식 모드로 진입합니다.
        // 크림은 자동으로 발린 것으로 간주하고, 다음 Spacebar에 DECORATING으로 넘어갑니다.
        messageElement.innerHTML = `**굽기 완료 및 크림 코팅 완료!**<br> <span style="color: #f8bbd0;">[Spacebar]</span>를 눌러 장식 모드에 진입하세요.`;

    } else if (makingStep === 4) {
        // makingStep 4는 이제 사용되지 않으며, makingStep 3에서 직접 makingStep 5로 넘어갑니다.
        // 코드를 단순화하기 위해 이 블록을 제거하거나, 다음 단계로 직접 점프하도록 설정합니다.
        setGameMode('DECORATING');
    } else if (makingStep === 5) { // 장식 모드 진입
        setGameMode('DECORATING');
    }
}


window.addEventListener('keydown', (e) => {
    const k = e.key.toLowerCase(); 
    const isSpace = (k === ' ' || e.code === 'Space');
    
    // --- Rhythm Game Input Handling (MAKING Step 1) ---
    if (rhythmActive) {
        e.preventDefault();
        
        if (targetIndex >= rhythmTargets.length) return; 

        const requiredKey = rhythmTargets[targetIndex];
        const displayElement = document.getElementById('rhythm-display');
        const currentTargetElement = displayElement.children[targetIndex];
        
        // Only consume key if it's an Arrow Key
        if (!ARROW_KEYS.includes(e.code)) {
            return; 
        }

        // Check if the pressed key is the required key
        if (e.code === requiredKey) {
            rhythmScore += 100 / rhythmTargets.length; 
            
            // Mark correct hit visually
            if (currentTargetElement) {
                currentTargetElement.classList.add('correct');
            }
            
        } else {
            // Wrong key pressed
            if (currentTargetElement) {
                currentTargetElement.classList.add('wrong');
                // Apply penalty only if wrong key is pressed when a target is active
                rhythmScore -= 50 / rhythmTargets.length; 
                rhythmScore = Math.max(0, rhythmScore); 
            }
        }
        
        // In rhythm game, every Arrow key press (correct or wrong) advances to the next target
        targetIndex++;
        
        // Highlight next target
        const nextTargetElement = displayElement.children[targetIndex];
        if (nextTargetElement) {
            nextTargetElement.style.opacity = 1.0;
            nextTargetElement.style.color = '#d81b60';
        }

        // Check for completion
        if (targetIndex >= rhythmTargets.length) {
            rhythmActive = false; 
            advanceMakingStep();
        }
        return; 
    }

    // 🚨 MODIFIED: Camera/Movement Controls (Shared by VIEWING and DECORATING)
    const isSharedControlMode = (gameMode === 'VIEWING' || gameMode === 'DECORATING');

    if (isSharedControlMode) {
        // Arrow Key Movement (Cake Group)
        switch (e.key) {
            case 'ArrowUp':
                cakeGroup.position.y += moveSpeed;
                break;
            case 'ArrowDown':
                cakeGroup.position.y -= moveSpeed;
                break;
            case 'ArrowLeft':
                cakeGroup.position.x -= moveSpeed;
                break;
            case 'ArrowRight':
                cakeGroup.position.x += moveSpeed;
                break;
        }

        if (e.key.startsWith('Arrow')) {
            e.preventDefault();
        }

        // Camera Switch (P/O)
        if (k === 'p') currentCamera = perspectiveCamera; 
        else if (k === 'o') currentCamera = orthographicCamera; 
        currentCamera.updateProjectionMatrix();

        // Preset Camera Positions (1/2)
        if (k === '1' || k === '2') {
            const targetPosition = new THREE.Vector3();
            cakeGroup.getWorldPosition(targetPosition); 
            
            if (k === '1') { 
                perspectiveCamera.position.set(targetPosition.x + 4, targetPosition.y + 1, targetPosition.z);
            } else if (k === '2') { 
                perspectiveCamera.position.set(targetPosition.x, targetPosition.y + 3, targetPosition.z + 5);
            }

            currentCamera = perspectiveCamera;
            currentCamera.lookAt(targetPosition); 
            currentCamera.updateProjectionMatrix();
        }
    }
    
    // 제작 모드 (MAKING) 컨트롤
    if (gameMode === 'MAKING' && isSpace) { 
        if (makingStep === 3) { 
            makingStep = 4; 
            advanceMakingStep();
            e.preventDefault(); 
            return;
        } else if (makingStep < 3) {
            advanceMakingStep();
            e.preventDefault(); 
            return;
        }
    }

    // 장식 모드 (DECORATING) 컨트롤
    const isEnterOrSpace = (k === 'enter' || isSpace);
    if (gameMode === 'DECORATING' && isEnterOrSpace) {
        setGameMode('VIEWING');
        e.preventDefault(); 
        return;
    }
    
    // 3. 관람 모드 (VIEWING) 컨트롤 (Only mode-specific controls remain here)
    if (gameMode !== 'VIEWING') return;

    if (k === 'k') {
        if (currentThemeIndex === -1) { 
            selectedCreamColor = creamTop.material.color.getHex(); 
            currentThemeIndex = 0; 
        } else {
            currentThemeIndex++;
            if (currentThemeIndex >= CAKE_THEMES.length) {
                currentThemeIndex = -1; 
            }
        }
        updateCakeTheme();
    }
    
    if (k === 'l') {
        currentLightColorIndex = (currentLightColorIndex + 1) % lightColors.length;
        const newColor = lightColors[currentLightColorIndex];
        spotLight.color.set(newColor);
        frontLight.color.set(newColor); 
        spotLight.intensity = (currentLightColorIndex === 0) ? 2.0 : 1.5;
    }

    if (isSpace) {
        isToppingRotating = !isToppingRotating;
        e.preventDefault();
    }

    if (k === 'c') {
        isCandleOn = !isCandleOn;
        candleLight.visible = isCandleOn;
        flame.visible = isCandleOn;
    }
});


// --- 7. 장식 모드 클릭 및 팔레트 로직 (파이핑 시뮬레이션 및 정교화된 배치) ---

document.querySelectorAll('.palette-item').forEach(item => {
    item.addEventListener('click', () => {
        if (gameMode !== 'DECORATING') return;
        
        document.querySelectorAll('.palette-item').forEach(i => i.classList.remove('selected'));
        item.classList.add('selected');
        
        const type = item.dataset.type;
        if (type === 'cream') {
            selectedToppingType = null;
            selectedCreamColor = parseInt(item.dataset.color);
            pipingMaterial.color.set(selectedCreamColor); 
        } else {
            selectedToppingType = type;
            selectedCreamColor = 0; 
        }
    });
});


window.addEventListener('mousedown', onMouseDown);
window.addEventListener('mousemove', onMouseMove);
window.addEventListener('mouseup', onMouseUp);


// 🚨 파이핑 조각 생성 함수 (원뿔 모양)
function createPipingSegment(x, y, z) {
    const distance = new THREE.Vector2(x, z).length();
    if (distance > MAX_TOPPING_RADIUS) return; 

    // 🚨 원뿔(ConeGeometry)을 사용하여 파이핑 크림 모양 시뮬레이션
    const pipingGeometry = new THREE.ConeGeometry(0.06, 0.12, 16); 
    pipingGeometry.translate(0, 0.06, 0); 
    
    const newTopping = new THREE.Mesh(pipingGeometry, pipingMaterial.clone());
    newTopping.position.set(x, START_Y, z); 
    newTopping.rotation.y = Math.random() * Math.PI * 2; 
    
    newTopping.castShadow = true;
    newTopping.name = 'piping_segment';
    // Physics Setup for Dropping
    newTopping.userData.velocity = new THREE.Vector3(0, 0, 0);
    newTopping.userData.settled = false;
    activePhysicsMeshes.push(newTopping);
    customToppingGroup.add(newTopping);
    
    toppingsCount++;
    
    // 🚨 스플래시 이벤트 추가
    activeSplashMeshes.push({ mesh: newTopping, scale: 1.0, timer: 0, duration: 30 });
    
    // 🚨 점수 시스템: 중앙에서 너무 벗어난 파이핑에 대해 페널티
    if (distance > 1.0) { 
        score -= 0.1;
    } else {
        score += 0.05;
    }
    updateScoreDisplay();
}

function onMouseDown(event) {
    if (gameMode !== 'DECORATING' && gameMode !== 'MAKING') { // 미니게임 중에도 클릭 이벤트 처리
        return;
    }
    
    // 🚨 크림 펴바르기 미니게임 제거: 마우스 클릭으로 진행되는 미니게임 로직 삭제
    
    if (gameMode !== 'DECORATING') return;
    
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

    raycaster.setFromCamera(mouse, currentCamera);
    const intersects = raycaster.intersectObject(creamTop); 
    
    if (intersects.length > 0) {
        if (selectedToppingType === 'piping') {
            pipingActive = true;
            const point = intersects[0].point;
            lastPipingPoint = point;
            createPipingSegment(point.x, point.y, point.z);
        } else {
            onDecoratingClick(event);
        }
    }
}

function onMouseMove(event) {
    if (gameMode !== 'DECORATING' || !pipingActive) return;

    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

    raycaster.setFromCamera(mouse, currentCamera);
    const intersects = raycaster.intersectObject(creamTop); 

    if (intersects.length > 0) {
        const point = intersects[0].point;
        if (lastPipingPoint && point.distanceTo(lastPipingPoint) > 0.05) { 
            createPipingSegment(point.x, point.y, point.z);
            lastPipingPoint = point;
        }
    }
}

function onMouseUp(event) {
    if (gameMode !== 'DECORATING') return;
    pipingActive = false;
    lastPipingPoint = null;
}


function onDecoratingClick(event) { // 일반 토핑 및 색상 변경 전용
    // 🚨 이 함수는 onMouseDown에서 호출되도록 변경되었으며, 직접 이벤트 리스너는 제거됨
    if (gameMode !== 'DECORATING' || selectedToppingType === 'piping') return;
    
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

    raycaster.setFromCamera(mouse, currentCamera);
    
    const intersects = raycaster.intersectObject(creamTop); 
    
    if (intersects.length > 0) {
        if (selectedCreamColor) {
            creamTop.material.color.set(selectedCreamColor);
            creamTop.material.needsUpdate = true;
            
        } else if (selectedToppingType) {
            const point = intersects[0].point;
            const distance = new THREE.Vector2(point.x, point.z).length();
            
            if (distance <= MAX_TOPPING_RADIUS) { 
                let newTopping;

                if (selectedToppingType === 'drizzle') {
                    if (customToppingGroup.children.some(c => c.name === 'drizzle')) return; 
                    newTopping = new THREE.Mesh(new THREE.TorusKnotGeometry(1.3, 0.08, 64, 8, 2, 3), chocolateMaterial);
                    newTopping.position.set(0, -0.15, 0); 
                    newTopping.scale.set(1.0, 0.5, 1.0);
                    newTopping.rotation.x = Math.PI / 2;
                    newTopping.name = 'drizzle';
                } else if (selectedToppingType === 'strawberry') {
                    const isTooClose = customToppingGroup.children.some(c => 
                        c.name !== 'drizzle' && c.position.distanceTo(new THREE.Vector3(point.x, 0.05, point.z)) < 0.4
                    );
                    if (isTooClose) {
                        messageElement.innerHTML = `<span style="color: red;">너무 가깝습니다!</span> 간격을 두고 배치하세요.`;
                        messageElement.style.display = 'block';
                        setTimeout(() => messageElement.style.display = 'none', 1000);
                        return;
                    }
                    
                    newTopping = new THREE.Mesh(new THREE.SphereGeometry(0.2, 16, 16), strawberryMaterial);
                    newTopping.position.set(point.x, START_Y, point.z); 
                    score += 5; 
                } else if (selectedToppingType === 'sprinkle') {
                    const color = sprinkleColors[Math.floor(Math.random() * sprinkleColors.length)];
                    const material = new THREE.MeshPhongMaterial({ color: color, shininess: 100 });
                    newTopping = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.1, 8), material);
                    newTopping.position.set(point.x, START_Y, point.z); 
                    // 🚨 MODIFIED: 스프링클이 클릭 지점에 정확히 놓이도록 X/Z 틸트 제거. Y축 스핀만 허용
                    const randomSpinY = Math.random() * Math.PI * 2; 
                    newTopping.rotation.set(0, randomSpinY, 0); 
                    score += 0.5;
                } else if (selectedToppingType === 'cherry') {
                    // 🚨 MODIFIED: 체리 위치 제약 완화 (0.5 -> 1.0)
                    if (distance > 1.0) {
                         messageElement.innerHTML = `<span style="color: red;">체리는 중앙에!</span> 중앙 1m 반경 내에 배치하세요.`;
                         messageElement.style.display = 'block';
                         setTimeout(() => messageElement.style.display = 'none', 1000);
                         return;
                    }
                    newTopping = new THREE.Mesh(new THREE.SphereGeometry(0.15, 16, 16), new THREE.MeshPhongMaterial({ color: 0xcc0000, shininess: 50 }));
                    newTopping.position.set(point.x, START_Y, point.z); 
                    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.3, 8), new THREE.MeshBasicMaterial({ color: 0x442200 }));
                    stem.position.y = 0.1;
                    newTopping.add(stem);
                    score += 10; 
                }
                
                if (newTopping) {
                    // Physics Setup for Dropping
                    newTopping.userData.velocity = new THREE.Vector3(0, 0, 0);
                    newTopping.userData.settled = false;
                    activePhysicsMeshes.push(newTopping);

                    newTopping.castShadow = true;
                    customToppingGroup.add(newTopping);
                    toppingsCount++;
                    updateScoreDisplay(); 
                    
                    if (selectedToppingType !== 'drizzle') {
                        activeSplashMeshes.push({ mesh: newTopping, scale: 1.0, timer: 0, duration: 30 });
                    }
                }
            } else {
                 messageElement.innerHTML = `<span style="color: red;">케이크 밖에는 배치할 수 없습니다!</span>`;
                 messageElement.style.display = 'block';
                 setTimeout(() => messageElement.style.display = 'none', 1000);
            }
        }
    }
}


window.addEventListener('resize', () => {
    renderer.setSize(window.innerWidth, window.innerHeight);
    perspectiveCamera.aspect = window.innerWidth / window.innerHeight;
    perspectiveCamera.updateProjectionMatrix();

    const newAspect = window.innerWidth / window.innerHeight;
    orthographicCamera.left = viewSize * newAspect / -2;
    orthographicCamera.right = viewSize * newAspect / 2;
    orthographicCamera.updateProjectionMatrix();
});


// 계층적 애니메이션 루프
function animate() {
    // 믹싱 모션 및 리듬 게임 루프
    if (gameMode === 'MAKING' && makingStep === 1) {
        mixingContent.rotation.y += 0.05;

        // 🚨 ADDED: 리듬 게임 시간 경과 바 업데이트 (Rhythm Game Progress Bar update)
        const rhythmProgressBar = document.getElementById('rhythm-progress-bar');

        if (rhythmActive) {
            const elapsedTime = Date.now() - rhythmStartTime;
            const progress = Math.max(0, RHYTHM_DURATION - elapsedTime) / RHYTHM_DURATION;
            const widthPercent = progress * 100;
            
            if (rhythmProgressBar) {
                rhythmProgressBar.style.width = widthPercent + '%'; // 남은 시간만큼 바 줄이기
            }

            // 🚨 리듬 게임 타임아웃 체크
            if (Date.now() > rhythmStartTime + RHYTHM_DURATION) {
                rhythmActive = false;
                // Calculate final score before advancing
                const targetsCount = rhythmTargets.length;
                const maxPossibleScore = targetsCount * (100 / targetsCount);
                mixingQuality = rhythmScore / maxPossibleScore * 100;
                
                messageElement.innerHTML = `**시간 초과!** 리듬 믹싱이 완료되었습니다.<br> <span style="color: #f8bbd0;">[Spacebar]</span>를 눌러 반죽을 완료하세요.`;
                document.getElementById('rhythm-mixer').style.display = 'none';
                messageElement.style.display = 'block';
            }
        } else {
            // 게임이 비활성 상태일 때 바를 숨김 (혹시 모를 잔상을 위해)
            if (rhythmProgressBar && rhythmProgressBar.style.width !== '0%') {
                rhythmProgressBar.style.width = '0%';
            }
        }
    }

    // 회전 (관람 모드에서만)
    if (gameMode === 'VIEWING' && isToppingRotating) {
        const targetGroup = themeToppingGroup.visible ? themeToppingGroup : customToppingGroup;
        targetGroup.rotation.y += TOPPING_ROTATION_SPEED;
    }
    // 케이크 그룹 전체는 항상 천천히 회전
    cakeGroup.rotation.y += BASE_ROTATION_SPEED;

    
    // --- Physics Update: Simulate Dropping Toppings ---
    const meshesToSettle = [];
    activePhysicsMeshes.forEach(mesh => {
        if (mesh.userData.settled) return;

        // 1. Apply gravity to vertical velocity
        mesh.userData.velocity.y += GRAVITY;

        // 2. Update position
        mesh.position.add(mesh.userData.velocity);

        // 3. Collision check (check if topping hits the surface)
        if (mesh.position.y <= SETTLED_Y) {
            mesh.position.y = SETTLED_Y; // Clamp to the surface
            mesh.userData.settled = true; // Mark as settled
            meshesToSettle.push(mesh);
            mesh.userData.velocity.set(0, 0, 0); // Stop motion
        }
    });

    // Remove settled meshes from the active physics list (to save performance)
    meshesToSettle.forEach(mesh => {
        const index = activePhysicsMeshes.indexOf(mesh);
        if (index > -1) {
            activePhysicsMeshes.splice(index, 1);
        }
    });

    // 🚨 ADDED: 스플래쉬 이벤트 애니메이션 처리 (유지)
    const meshesToRemove = [];
    activeSplashMeshes.forEach(item => {
        item.timer++;
        const progress = item.timer / item.duration;
        
        const targetScale = 1.0 + Math.sin(progress * Math.PI) * 0.2; 
        item.mesh.scale.set(targetScale, targetScale, targetScale);
        
        if (item.timer >= item.duration) {
            item.mesh.scale.set(1.0, 1.0, 1.0); 
            meshesToRemove.push(item);
        }
    });

    meshesToRemove.forEach(item => {
        const index = activeSplashMeshes.indexOf(item);
        if (index > -1) activeSplashMeshes.splice(index, 1);
    });

    // 촛불 깜빡임 효과
    if (isCandleOn) {
        flame.scale.set(1 + Math.sin(Date.now() * 0.01) * 0.1, 1 + Math.sin(Date.now() * 0.01) * 0.1, 1);
        candleLight.intensity = 1.0 + Math.sin(Date.now() * 0.005) * 0.5; 
    }

    // 카메라가 현재 활성화된 그룹을 응시하도록 업데이트
    let target = cakeGroup.visible ? cakeGroup : bowlGroup;
    const targetPosition = new THREE.Vector3();
    target.getWorldPosition(targetPosition);

    if (currentCamera === perspectiveCamera) {
        currentCamera.lookAt(targetPosition);
    } else if (currentCamera === orthographicCamera) {
        currentCamera.lookAt(targetPosition);
    }

    renderer.render(scene, currentCamera);
}