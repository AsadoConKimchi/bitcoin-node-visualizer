/**
 * nodeData.js — bitnodes.io 노드 위치 데이터 관리
 * https://bitnodes.io/api/v1/snapshots/latest/
 */

const BITNODES_API = 'https://bitnodes.io/api/v1/snapshots/latest/';
const MAX_NODES = 500;
const REFRESH_INTERVAL = 5 * 60 * 1000; // 5분

// "내 노드" 기본 위치 (서울) — 서버 모드에서 동적 업데이트
export let MY_NODE = { lat: 37.5665, lng: 126.978, isMyNode: true };

// 폴백: 주요 도시 기반 더미 노드
function getFallbackNodes() {
  const cities = [
    { lat: 40.7128, lng: -74.006 },   // New York
    { lat: 51.5074, lng: -0.1278 },   // London
    { lat: 48.8566, lng: 2.3522 },    // Paris
    { lat: 35.6762, lng: 139.6503 },  // Tokyo
    { lat: 37.5665, lng: 126.978 },   // Seoul
    { lat: -33.8688, lng: 151.2093 }, // Sydney
    { lat: 52.52, lng: 13.405 },      // Berlin
    { lat: 55.7558, lng: 37.6173 },   // Moscow
    { lat: 31.2304, lng: 121.4737 },  // Shanghai
    { lat: 19.0760, lng: 72.8777 },   // Mumbai
    { lat: -23.5505, lng: -46.6333 }, // São Paulo
    { lat: 34.0522, lng: -118.2437 }, // Los Angeles
    { lat: 41.8781, lng: -87.6298 },  // Chicago
    { lat: 43.6532, lng: -79.3832 },  // Toronto
    { lat: 1.3521, lng: 103.8198 },   // Singapore
    { lat: 25.2048, lng: 55.2708 },   // Dubai
    { lat: -26.2041, lng: 28.0473 },  // Johannesburg
    { lat: 6.5244, lng: 3.3792 },     // Lagos
    { lat: 59.9139, lng: 10.7522 },   // Oslo
    { lat: 47.3769, lng: 8.5417 },    // Zurich
  ];
  // 각 도시 주변에 여러 노드 생성
  const nodes = [];
  cities.forEach((city) => {
    for (let i = 0; i < 10; i++) {
      nodes.push({
        lat: city.lat + (Math.random() - 0.5) * 5,
        lng: city.lng + (Math.random() - 0.5) * 5,
        isMyNode: false,
      });
    }
  });
  return nodes;
}

/**
 * bitnodes.io API에서 노드 위치 데이터 가져오기
 * 응답 구조: nodes[addr] = [protocol, userAgent, connSince, services, height, hostname, country, city, lat, lng, tz, asn, org]
 */
export async function fetchNodePoints(signal) {
  try {
    const res = await fetch(BITNODES_API, { signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    const nodes = data.nodes;
    if (!nodes) return getFallbackNodes();

    const entries = Object.entries(nodes);
    // 무작위 샘플링 (최대 500개)
    const shuffled = entries.sort(() => Math.random() - 0.5).slice(0, MAX_NODES);

    const points = shuffled
      .map(([, nodeInfo]) => ({
        lat: nodeInfo[8],
        lng: nodeInfo[9],
        isMyNode: false,
      }))
      .filter((n) => n.lat != null && n.lng != null && !isNaN(n.lat) && !isNaN(n.lng));

    return points;
  } catch (err) {
    console.debug('[nodeData] bitnodes.io 요청 실패, 폴백 사용:', err);
    return getFallbackNodes();
  }
}

/**
 * 노드 데이터 관리 클래스 (주기적 갱신)
 */
export class NodeDataManager {
  constructor(onUpdate, serverUrl = '', isServerMode = false) {
    this._onUpdate = onUpdate;
    this._serverUrl = serverUrl ? serverUrl.replace(/\/+$/, '') : '';
    this._isServerMode = isServerMode;
    this._timer = null;
    this._nodes = [];
    this._destroyed = false;
    this._abortController = null;
  }

  async start() {
    await this._load();
    this._timer = setInterval(() => this._load(), REFRESH_INTERVAL);
  }

  async _load() {
    if (this._destroyed) return;
    if (this._abortController) this._abortController.abort();
    this._abortController = new AbortController();
    const { signal } = this._abortController;

    // 서버 모드: bitnodes 외부 API 스킵, 실제 피어만 표시
    const bgPoints = this._isServerMode ? [] : await fetchNodePoints(signal);
    this._nodes = bgPoints;

    if (this._isServerMode) {
      // 서버 모드: /api/info에서 노드 위치 가져와 MY_NODE 업데이트
      try {
        const infoRes = await fetch(`${this._serverUrl}/api/info`, { signal });
        if (infoRes.ok) {
          const info = await infoRes.json();
          if (info.nodeLocation?.lat != null && info.nodeLocation?.lng != null) {
            MY_NODE = { lat: info.nodeLocation.lat, lng: info.nodeLocation.lng, isMyNode: true };
          }
          // nodeLocation이 null이면 기본값(서울) 유지
        }
      } catch (_) { /* 위치 조회 실패 시 기본값 유지 */ }

      // 서버 모드: bitnodes 배경 노드 제거 — 실제 피어 + 내 노드만 표시
      const peerPoints = await this._fetchPeers(signal);
      if (!this._destroyed) this._onUpdate([...peerPoints, MY_NODE]);
    } else {
      // mempool 모드: bitnodes 데이터에서 가상 피어 8~12개 선택
      const peerCount = 8 + Math.floor(Math.random() * 5);
      const shuffled = [...bgPoints].sort(() => Math.random() - 0.5);
      const virtualPeers = shuffled.slice(0, peerCount).map((p) => ({
        ...p,
        isMyPeer: true,
        subver: '/Satoshi:27.0.0/',
      }));
      const remaining = shuffled.slice(peerCount);
      if (!this._destroyed) this._onUpdate([...remaining, ...virtualPeers, MY_NODE]);
    }
  }

  async _fetchPeers(signal) {
    try {
      const res = await fetch(`${this._serverUrl}/api/peers`, { signal });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      return (data.peers || []).map((p) => ({
        lat: p.lat,
        lng: p.lng,
        isMyNode: false,
        isMyPeer: true,
        subver: p.subver,
        country: p.country,
        inbound: p.inbound,
        pingtime: p.pingtime,
      }));
    } catch (err) {
      console.warn('[nodeData] 피어 데이터 요청 실패:', err);
      return [];
    }
  }

  getNodes() {
    return this._nodes;
  }

  /** 랜덤 노드 n개 위치 반환 */
  getRandomNodes(n) {
    const nodes = this._nodes;
    if (nodes.length === 0) return [];
    const result = [];
    for (let i = 0; i < n; i++) {
      result.push(nodes[Math.floor(Math.random() * nodes.length)]);
    }
    return result;
  }

  destroy() {
    this._destroyed = true;
    if (this._timer) clearInterval(this._timer);
    if (this._abortController) this._abortController.abort();
  }
}
