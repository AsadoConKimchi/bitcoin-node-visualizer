// Squarified treemap 알고리즘
// slice-and-dice 레이아웃으로 아이템을 weight 비례 사각형으로 배치

export function squarify(items, containerW, containerH) {
  if (!items.length || containerW <= 0 || containerH <= 0) return [];

  const totalArea = containerW * containerH;
  const totalWeight = items.reduce((s, it) => s + (it.weight || 560), 0);
  if (totalWeight <= 0) return [];

  // 면적 비례 할당
  const normalized = items.map((it) => ({
    ...it,
    area: ((it.weight || 560) / totalWeight) * totalArea,
  }));

  // 간단한 slice-and-dice 레이아웃
  const rects = [];
  let x = 0, y = 0, w = containerW, h = containerH;
  let remaining = [...normalized];

  while (remaining.length > 0) {
    const isHorizontal = w >= h;
    const total = remaining.reduce((s, r) => s + r.area, 0);

    // 현재 행/열에 넣을 아이템 결정
    let rowItems = [];
    let rowArea = 0;

    for (let i = 0; i < remaining.length; i++) {
      rowItems.push(remaining[i]);
      rowArea += remaining[i].area;

      // 행 면적이 전체의 절반 이상이면 분할
      if (rowArea >= total / 2 && remaining.length - rowItems.length > 0) {
        break;
      }
    }

    remaining = remaining.slice(rowItems.length);

    // 행 크기 계산
    const rowTotal = rowItems.reduce((s, r) => s + r.area, 0);
    const rowSize = isHorizontal ? (rowTotal / h) : (rowTotal / w);

    let offset = 0;
    for (const item of rowItems) {
      const itemSize = item.area / Math.max(rowSize, 1);
      const clampedSize = Math.max(itemSize, 2);

      if (isHorizontal) {
        rects.push({
          ...item,
          x: x,
          y: y + offset,
          w: Math.min(rowSize, w),
          h: clampedSize,
        });
      } else {
        rects.push({
          ...item,
          x: x + offset,
          y: y,
          w: clampedSize,
          h: Math.min(rowSize, h),
        });
      }
      offset += clampedSize;
    }

    if (isHorizontal) {
      x += rowSize;
      w -= rowSize;
    } else {
      y += rowSize;
      h -= rowSize;
    }
  }

  return rects;
}
