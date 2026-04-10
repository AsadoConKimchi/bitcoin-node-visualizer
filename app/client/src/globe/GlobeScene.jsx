import React, { useRef, useEffect, forwardRef, useImperativeHandle } from 'react';
import ThreeGlobe from 'three-globe';
import * as THREE from 'three';

const AUTO_ROTATE_SPEED = 0.0008;
const STAR_COUNT = 2000;

// 지구본 색상 상수 (디자인 시스템)
const GLOBE_COLORS = {
  background: 0x0a1628,
  atmosphere: '#4a8bdf',
  nodeDefault: '#4a7dff',
  nodeMyNode: '#f7931a',
  nodePeer: '#22c55e',
  ambientLight: 0x6688aa,
  directionalLight1: 0xccddff,
  directionalLight2: 0x445577,
  starField: 0xffffff,
};

function makeStars() {
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(STAR_COUNT * 3);
  for (let i = 0; i < STAR_COUNT * 3; i++) {
    pos[i] = (Math.random() - 0.5) * 3000;
  }
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const mat = new THREE.PointsMaterial({ color: GLOBE_COLORS.starField, size: 0.5, sizeAttenuation: true });
  return new THREE.Points(geo, mat);
}

/**
 * GlobeScene — Three.js + three-globe 3D 지구본
 * Props:
 *   nodePoints: [{ lat, lng, isMyNode }]
 *   arcs:       [{ startLat, startLng, endLat, endLng, color }]
 *   rings:      [{ lat, lng }]
 */
const GlobeScene = forwardRef(function GlobeScene({ nodePoints, arcs, rings, isServerMode, onReady }, ref) {
  const mountRef = useRef(null);
  const sceneRef = useRef(null);

  // props를 ref로 추적 (초기화 useEffect에서 최신값 접근)
  const nodePointsRef = useRef(nodePoints);
  const arcsRef = useRef(arcs);
  const ringsRef = useRef(rings);
  nodePointsRef.current = nodePoints;
  arcsRef.current = arcs;
  ringsRef.current = rings;

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const w = mount.clientWidth;
    const h = mount.clientHeight;

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setSize(w, h);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(GLOBE_COLORS.background, 1);
    mount.appendChild(renderer.domElement);

    // Scene
    const scene = new THREE.Scene();

    // Camera
    const camera = new THREE.PerspectiveCamera(45, w / h, 0.1, 2000);
    camera.position.z = 280;

    // 별 배경
    scene.add(makeStars());

    // Globe 생성
    const globe = new ThreeGlobe();

    // NASA Blue Marble 텍스처로 대륙/바다 구분
    globe.globeImageUrl('/earth-blue-marble.jpg');
    globe.bumpImageUrl('/earth-topology.png');

    // 텍스처 로딩 완료 감지
    if (onReady) {
      const img = new Image();
      img.onload = () => onReady();
      img.src = '/earth-blue-marble.jpg';
    }

    // 대기권 효과
    globe.showAtmosphere(true);
    globe.atmosphereColor(GLOBE_COLORS.atmosphere);
    globe.atmosphereAltitude(0.15);

    // 포인트 (전세계 노드) — mempool 모드: pointsData, 서버 모드: htmlElementsData(CSS glow)
    globe.pointsData(nodePointsRef.current || []);
    globe.pointLat('lat');
    globe.pointLng('lng');
    globe.pointAltitude(0.015);
    globe.pointRadius((d) => (d.isMyNode ? 1.0 : d.isMyPeer ? 0.7 : 0.25));
    globe.pointColor((d) => (d.isMyNode ? GLOBE_COLORS.nodeMyNode : d.isMyPeer ? GLOBE_COLORS.nodePeer : GLOBE_COLORS.nodeDefault));
    globe.pointsMerge(false);

    // 서버 모드: HTML 요소로 노드 표시 (CSS glow로 겹침 방지)
    globe.htmlElementsData([]);
    globe.htmlLat('lat');
    globe.htmlLng('lng');
    globe.htmlAltitude(0.02);
    globe.htmlElement((d) => {
      const el = document.createElement('div');
      const size = d.isMyNode ? 8 : 5;
      const color = d.isMyNode ? GLOBE_COLORS.nodeMyNode : GLOBE_COLORS.nodePeer;
      el.style.width = size + 'px';
      el.style.height = size + 'px';
      el.style.borderRadius = '50%';
      el.style.background = color;
      el.style.boxShadow = `0 0 ${size}px ${color}, 0 0 ${size * 2}px ${color}80`;
      el.style.pointerEvents = 'none';
      return el;
    });

    // 아크 (블록 전파 경로)
    globe.arcsData(arcsRef.current || []);
    globe.arcStartLat('startLat');
    globe.arcStartLng('startLng');
    globe.arcEndLat('endLat');
    globe.arcEndLng('endLng');
    globe.arcColor('color');
    globe.arcAltitudeAutoScale(0.45);
    globe.arcAltitude(d => d.type === 'connection' ? 0.15 : 0.12);
    globe.arcStroke(d => d.type === 'connection' ? 0.5 : d.type === 'block' ? 3.0 : 2.0);
    globe.arcDashLength(d => d.type === 'connection' ? 1.0 : d.type === 'block' ? 0.04 : 0.03);
    globe.arcDashGap(d => d.type === 'connection' ? 0 : 1.0);
    globe.arcDashAnimateTime(d => d.type === 'connection' ? 0 : d.type === 'block' ? 800 : 1200);

    // 링 (TX 이벤트)
    globe.ringsData(ringsRef.current || []);
    globe.ringLat('lat');
    globe.ringLng('lng');
    globe.ringMaxRadius(4);
    globe.ringPropagationSpeed(3);
    globe.ringRepeatPeriod(800);
    globe.ringColor(() => (t) => `rgba(247,147,26,${Math.max(0, (1 - t) * 0.8)})`);

    scene.add(globe);

    // 조명 (밝은 낮 분위기)
    scene.add(new THREE.AmbientLight(GLOBE_COLORS.ambientLight, 2.0));
    const dirLight = new THREE.DirectionalLight(GLOBE_COLORS.directionalLight1, 1.2);
    dirLight.position.set(200, 100, 100);
    scene.add(dirLight);
    const dirLight2 = new THREE.DirectionalLight(GLOBE_COLORS.directionalLight2, 0.5);
    dirLight2.position.set(-100, -50, -100);
    scene.add(dirLight2);

    // 드래그 회전
    let isDragging = false;
    let prevMouse = { x: 0, y: 0 };
    let velocity = { x: 0, y: 0 };

    const onMouseDown = (e) => {
      isDragging = true;
      prevMouse = { x: e.clientX, y: e.clientY };
      velocity = { x: 0, y: 0 };
    };
    const onMouseMove = (e) => {
      if (!isDragging) return;
      const dx = e.clientX - prevMouse.x;
      const dy = e.clientY - prevMouse.y;
      globe.rotation.y += dx * 0.004;
      globe.rotation.x = Math.max(-1.2, Math.min(1.2, globe.rotation.x + dy * 0.004));
      velocity = { x: dy * 0.004, y: dx * 0.004 };
      prevMouse = { x: e.clientX, y: e.clientY };
    };
    const onMouseUp = () => { isDragging = false; };
    const onWheel = (e) => {
      e.preventDefault();
      camera.position.z = Math.max(130, Math.min(600, camera.position.z + e.deltaY * 0.25));
    };

    mount.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    mount.addEventListener('wheel', onWheel, { passive: false });

    const onResize = () => {
      const nw = mount.clientWidth;
      const nh = mount.clientHeight;
      camera.aspect = nw / nh;
      camera.updateProjectionMatrix();
      renderer.setSize(nw, nh);
    };
    window.addEventListener('resize', onResize);

    // 애니메이션 루프
    // three-globe v2.45+는 내부 rAF로 애니메이션을 관리하므로 외부 tick() 호출 불필요
    let animId;
    const animate = () => {
      animId = requestAnimationFrame(animate);
      try {
        if (!isDragging) {
          globe.rotation.y += AUTO_ROTATE_SPEED;
          if (Math.abs(velocity.x) > 0.0001) { globe.rotation.x += velocity.x; velocity.x *= 0.9; }
          if (Math.abs(velocity.y) > 0.0001) { globe.rotation.y += velocity.y; velocity.y *= 0.9; }
        }
        renderer.render(scene, camera);
      } catch (err) {
        console.error('[GlobeScene] 렌더 오류:', err);
      }
    };
    animate();

    sceneRef.current = { renderer, scene, camera, globe };

    return () => {
      cancelAnimationFrame(animId);
      mount.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      mount.removeEventListener('wheel', onWheel);
      window.removeEventListener('resize', onResize);
      renderer.dispose();
      if (mount.contains(renderer.domElement)) mount.removeChild(renderer.domElement);
      sceneRef.current = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // props 변경 시 globe 업데이트
  useEffect(() => {
    const globe = sceneRef.current?.globe;
    if (!globe) return;
    if (isServerMode) {
      // 서버 모드: pointsData 비우고 htmlElementsData로 표시
      globe.pointsData([]);
      globe.htmlElementsData(nodePoints || []);
    } else {
      // mempool 모드: 기존 pointsData
      globe.htmlElementsData([]);
      globe.pointsData(nodePoints || []);
    }
  }, [nodePoints, isServerMode]);

  useEffect(() => {
    sceneRef.current?.globe?.arcsData(arcs || []);
  }, [arcs]);

  useEffect(() => {
    sceneRef.current?.globe?.ringsData(rings || []);
  }, [rings]);

  useImperativeHandle(ref, () => ({
    getGlobe: () => sceneRef.current?.globe,
    // P2P 모드 진입 시 특정 좌표로 지구본 회전
    pointToCoords: (lat, lng) => {
      const globe = sceneRef.current?.globe;
      if (!globe) return;
      const targetY = -lng * (Math.PI / 180);
      const targetX = -lat * (Math.PI / 180) * 0.5;
      const startY = globe.rotation.y;
      const startX = globe.rotation.x;
      const duration = 1200;
      const startTime = Date.now();
      const tick = () => {
        const t = Math.min(1, (Date.now() - startTime) / duration);
        const ease = t * (2 - t); // easeOutQuad
        globe.rotation.y = startY + (targetY - startY) * ease;
        globe.rotation.x = startX + (targetX - startX) * ease;
        if (t < 1) requestAnimationFrame(tick);
      };
      tick();
    },
  }));

  return (
    <div
      ref={mountRef}
      style={{ position: 'absolute', inset: 0, background: '#0a1628', cursor: 'grab' }}
    />
  );
});

export default GlobeScene;
