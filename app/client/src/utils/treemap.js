// Squarified treemap 알고리즘 (Bruls et al., 2000)
// 각 행에서 worst aspect ratio를 최소화하여 정사각형에 가까운 셀 생성

export function squarify(items, containerW, containerH) {
  if (!items.length || containerW <= 0 || containerH <= 0) return [];

  const totalArea = containerW * containerH;
  const totalWeight = items.reduce((s, it) => s + (it.weight || 560), 0);
  if (totalWeight <= 0) return [];

  // 면적 비례 할당 + 내림차순 정렬
  const normalized = items
    .map((it) => ({
      ...it,
      area: ((it.weight || 560) / totalWeight) * totalArea,
    }))
    .sort((a, b) => b.area - a.area);

  const rects = [];
  let x = 0, y = 0, w = containerW, h = containerH;

  // 행의 worst aspect ratio 계산 (Bruls et al. 정확한 공식)
  function worstRatio(row, w) {
    if (row.length === 0 || w <= 0) return Infinity;
    const s = row.reduce((sum, r) => sum + r.area, 0);
    if (s <= 0) return Infinity;
    const w2 = w * w;
    const s2 = s * s;
    let rmin = Infinity, rmax = 0;
    for (const r of row) {
      if (r.area < rmin) rmin = r.area;
      if (r.area > rmax) rmax = r.area;
    }
    return Math.max((w2 * rmax) / s2, s2 / (w2 * rmin));
  }

  // 행 확정: 셀 좌표 계산 후 남은 영역 업데이트
  function layoutRow(row) {
    const rowArea = row.reduce((s, r) => s + r.area, 0);
    const shortSide = Math.min(w, h);
    const isHorizontal = w >= h;
    const thickness = rowArea / shortSide;

    let offset = 0;
    for (const item of row) {
      const cellSize = item.area / Math.max(thickness, 0.01);
      if (isHorizontal) {
        rects.push({ ...item, x, y: y + offset, w: thickness, h: cellSize });
      } else {
        rects.push({ ...item, x: x + offset, y, w: cellSize, h: thickness });
      }
      offset += cellSize;
    }

    if (isHorizontal) {
      x += thickness;
      w -= thickness;
    } else {
      y += thickness;
      h -= thickness;
    }
  }

  let i = 0;
  while (i < normalized.length) {
    const shortSide = Math.min(w, h);
    const row = [normalized[i]];
    let current = worstRatio(row, shortSide);
    i++;

    // 아이템 추가가 ratio를 악화시키지 않는 한 계속 추가
    while (i < normalized.length) {
      const next = [...row, normalized[i]];
      const nextRatio = worstRatio(next, shortSide);
      if (nextRatio > current) break;
      row.push(normalized[i]);
      current = nextRatio;
      i++;
    }

    layoutRow(row);
  }

  return rects;
}
