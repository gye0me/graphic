// 학번: 20230789
// 이름: 배희겸
// 사용한 Three.js 방법: CDN

import * as THREE from 'three';

// 웹 브라우저 창의 너비와 높이
const h_scr = window.innerWidth;
const v_scr = window.innerHeight;

// 직교 카메라 사용을 위한 화면 크기 설정 (토러스 위치를 건드리지 않고, 투영 영역을 대폭 확장)
const viewSize = 100; 
const aspect = h_scr / v_scr;

// 3D 공간의 모든 요소를 담는 컨테이너 역할
const scene = new THREE.Scene();

// 1. 원근 카메라 (PerspectiveCamera) 정의
const perspectiveCamera = new THREE.PerspectiveCamera(60, h_scr / v_scr, 0.1, 1000);
perspectiveCamera.position.z = 5;

// 2. 직교 카메라 (OrthographicCamera) 정의
// 뷰포트 크기를 화면 비율에 맞춰 정확히 계산합니다.
const orthographicCamera = new THREE.OrthographicCamera(
    viewSize * aspect / -2,
    viewSize * aspect / 2,
    viewSize / 2,
    viewSize / -2,
    -100, 100
);
orthographicCamera.position.z = 5; // 카메라 Z 위치는 5 유지


// 사용할 카메라 선택 (let으로 선언하여 키 입력 시 변경 가능하게 함)
let currentCamera = perspectiveCamera;


// 렌더러 객체 초기화 및 설정
const renderer = new THREE.WebGLRenderer({
    depth: true,    // 깊이 버퍼 활성화 유지
    stencil: true, // 스텐실 버퍼 활성화 유지
});
document.body.appendChild(renderer.domElement);
renderer.setSize(h_scr, v_scr);


// 사각형 (Cube) 생성 - 부모 역할
const geometry = new THREE.BoxGeometry();
const material = new THREE.MeshBasicMaterial({ color: 0xff0000 });
const cube = new THREE.Mesh(geometry, material);
cube.position.x = -0.7;
cube.position.y = -0.7;
cube.position.z = 0;
scene.add(cube); // 큐브를 Scene에 추가

// 그라데이션 도넛 도형 (Torus) 생성 (셰이더 코드 생략)
const torusGeometry = new THREE.TorusGeometry(0.7, 0.3, 16, 100);

const uniforms = {
    color1: { value: new THREE.Color(0x3de6c5) },
    color2: { value: new THREE.Color(0xf183f3) },
};

const vertexShader = `
    varying vec2 vUv;
    void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
`;

const fragmentShader = `
    uniform vec3 color1;
    uniform vec3 color2;
    varying vec2 vUv;
    void main() {
        gl_FragColor = vec4(mix(color1, color2, vUv.y), 1.0);
    }
`;

const shaderMaterial = new THREE.ShaderMaterial({
    uniforms: uniforms,
    vertexShader: vertexShader,
    fragmentShader: fragmentShader,
    depthTest: true,
    depthWrite: false,
    transparent: true,
});

const torus = new THREE.Mesh(torusGeometry, shaderMaterial);


torus.position.x = 1.4;
torus.position.y = 1.4;
torus.position.z = 0; 
cube.add(torus); // Torus를 Cube의 자식으로 추가

torus.renderOrder = 1; // 렌더링 순서 유지


const moveSpeed = 0.1; // 물체 이동 속도

// 키보드 입력 처리 및 투영 방법/물체 변환 
window.addEventListener('keydown', (e) => {
    const k = e.key.toLowerCase();

    // 카메라 투영 방법 변경 로직
    if (k === 'p') {
        currentCamera = perspectiveCamera; // 원근 카메라로 전환
        console.log("P 키가 눌렸습니다. (Perspective Camera로 전환)");
    } else if (k === 'o') {
        currentCamera = orthographicCamera; // 직교 카메라로 전환
        console.log("O 키가 눌렸습니다. (Orthographic Camera로 전환)");
    }

    currentCamera.updateProjectionMatrix();

    // 물체 변환: 화살표 키를 사용하여 cube의 position을 변경합니다.
    switch (e.key) {
        case 'ArrowUp':
            cube.position.y += moveSpeed;
            break;
        case 'ArrowDown':
            cube.position.y -= moveSpeed;
            break;
        case 'ArrowLeft':
            cube.position.x -= moveSpeed;
            break;
        case 'ArrowRight':
            cube.position.x += moveSpeed;
            break;
    }

    if (e.key.startsWith('Arrow')) {
        e.preventDefault();
    }
});


window.addEventListener('resize', () => {
    renderer.setSize(window.innerWidth, window.innerHeight);

    perspectiveCamera.aspect = window.innerWidth / window.innerHeight;
    perspectiveCamera.updateProjectionMatrix();

    // 직교 카메라 업데이트: 넓어진 뷰포트 크기 viewSize를 기준으로 비율만 조정
    const newAspect = window.innerWidth / window.innerHeight;
    orthographicCamera.left = viewSize * newAspect / -2;
    orthographicCamera.right = viewSize * newAspect / 2;
    orthographicCamera.updateProjectionMatrix();
});


// 계층적 애니메이션 루프
function animate() {
    cube.rotation.x += 0.01;
    cube.rotation.y += 0.01;

    torus.rotation.x += 0.01;
    torus.rotation.y += 0.01;

    renderer.render(scene, currentCamera);
}

renderer.setAnimationLoop(animate);