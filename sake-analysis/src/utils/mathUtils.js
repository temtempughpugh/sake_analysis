export const splineInterpolation = (x, y) => {
    // 簡易線形補間（実際は三次スプラインが必要ならライブラリ使用）
    if (!Array.isArray(y)) {
      console.warn('splineInterpolation: y is not an array', y);
      return [];
    }
    
    return x.map((xVal, i) => {
      const yVal = y[i];
      if (yVal !== null && yVal !== undefined) {
        return { x: xVal, y: yVal };
      }
      
      // 前後の有効な値を探して線形補間
      let prevIndex = -1;
      let nextIndex = -1;
      
      // 前の有効な値を探す
      for (let j = i - 1; j >= 0; j--) {
        if (y[j] !== null && y[j] !== undefined) {
          prevIndex = j;
          break;
        }
      }
      
      // 後の有効な値を探す
      for (let j = i + 1; j < y.length; j++) {
        if (y[j] !== null && y[j] !== undefined) {
          nextIndex = j;
          break;
        }
      }
      
      // 補間
      if (prevIndex !== -1 && nextIndex !== -1) {
        const ratio = (i - prevIndex) / (nextIndex - prevIndex);
        const interpolatedY = y[prevIndex] + (y[nextIndex] - y[prevIndex]) * ratio;
        return { x: xVal, y: interpolatedY };
      } else if (prevIndex !== -1) {
        return { x: xVal, y: y[prevIndex] };
      } else if (nextIndex !== -1) {
        return { x: xVal, y: y[nextIndex] };
      }
      
      return null;
    }).filter(point => point !== null);
  };
  
  export const calculateRegression = (data) => {
    if (!Array.isArray(data) || data.length < 2) {
      console.warn('calculateRegression: insufficient data', data);
      return { equation: 'N/A', r2: 0, points: [] };
    }
    
    const n = data.length;
    const sumX = data.reduce((sum, d) => sum + d.x, 0);
    const sumY = data.reduce((sum, d) => sum + d.y, 0);
    const sumXY = data.reduce((sum, d) => sum + d.x * d.y, 0);
    const sumXX = data.reduce((sum, d) => sum + d.x * d.x, 0);
    
    const denominator = n * sumXX - sumX * sumX;
    if (Math.abs(denominator) < 1e-10) {
      console.warn('calculateRegression: singular matrix');
      return { equation: 'N/A', r2: 0, points: [] };
    }
    
    const a = (n * sumXY - sumX * sumY) / denominator;
    const b = (sumY - a * sumX) / n;
    
    const yPred = data.map(d => a * d.x + b);
    const yMean = sumY / n;
    const ssTot = data.reduce((sum, d) => sum + Math.pow(d.y - yMean, 2), 0);
    const ssRes = data.reduce((sum, d, i) => sum + Math.pow(d.y - yPred[i], 2), 0);
    const r2 = ssTot > 0 ? 1 - ssRes / ssTot : 0;
    
    const xMin = Math.min(...data.map(d => d.x));
    const xMax = Math.max(...data.map(d => d.x));
    const points = [
      { x: xMin, y: a * xMin + b },
      { x: xMax, y: a * xMax + b }
    ];
    
    return { 
      equation: `y = ${a.toFixed(2)}x + ${b.toFixed(2)}`, 
      r2: r2.toFixed(3), 
      points 
    };
  };
  
  export const calculateMovingAverage = (data, window = 3) => {
    if (!Array.isArray(data)) {
      console.warn('calculateMovingAverage: data is not an array', data);
      return [];
    }
    
    return data.map((_, i) => {
      const start = Math.max(0, i - window + 1);
      const end = i + 1;
      const slice = data.slice(start, end).filter(v => {
        if (typeof v === 'object' && v !== null) {
          return v.y !== null && v.y !== undefined && (!v.backgroundColor || v.y < 3);
        }
        return v !== null && v !== undefined;
      });
      
      if (slice.length === 0) return null;
      
      const sum = slice.reduce((acc, v) => {
        const value = typeof v === 'object' ? v.y : v;
        return acc + (value || 0);
      }, 0);
      
      return sum / slice.length;
    });
  };