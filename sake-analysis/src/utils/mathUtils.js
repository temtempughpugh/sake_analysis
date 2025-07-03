export const splineInterpolation = (x, y) => {
    // 簡易線形補間（実際は三次スプラインが必要ならライブラリ使用）
    return y.map((val, i) => {
      if (val !== null) return val;
      if (i > 0 && y[i - 1] !== null && y[i + 1] !== null) {
        return (y[i - 1] + y[i + 1]) / 2;
      }
      return null;
    });
  };
  
  export const calculateRegression = (data) => {
    const n = data.length;
    const sumX = data.reduce((sum, d) => sum + d.x, 0);
    const sumY = data.reduce((sum, d) => sum + d.y, 0);
    const sumXY = data.reduce((sum, d) => sum + d.x * d.y, 0);
    const sumXX = data.reduce((sum, d) => sum + d.x * d.x, 0);
    const a = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    const b = (sumY - a * sumX) / n;
    const yPred = data.map(d => a * d.x + b);
    const ssTot = data.reduce((sum, d) => sum + Math.pow(d.y - sumY / n, 2), 0);
    const ssRes = data.reduce((sum, d, i) => sum + Math.pow(d.y - yPred[i], 2), 0);
    const r2 = 1 - ssRes / ssTot;
    const points = [{ x: Math.min(...data.map(d => d.x)), y: a * Math.min(...data.map(d => d.x)) + b }, { x: Math.max(...data.map(d => d.x)), y: a * Math.max(...data.map(d => d.x)) + b }];
    return { equation: `y = ${a.toFixed(2)}x + ${b.toFixed(2)}`, r2, points };
  };
  
  export const calculateMovingAverage = (data, window) => {
    return data.map((_, i) => {
      const slice = data.slice(Math.max(0, i - window + 1), i + 1).filter(v => v !== null && (!v.backgroundColor || v.y < 3));
      return slice.length ? slice.reduce((sum, v) => sum + (v.y || v), 0) / slice.length : null;
    });
  };