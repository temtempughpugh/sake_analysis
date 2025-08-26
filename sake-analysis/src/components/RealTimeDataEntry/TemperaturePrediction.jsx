// TemperaturePrediction.jsx - 品温変動予測計算
import React, { useMemo } from 'react';

const TemperaturePrediction = ({ currentTankData, selectedModel }) => {
  // 品温変動予測計算
  const calculateTemperaturePrediction = () => {
    if (!currentTankData?.latestData || !selectedModel?.temperatureData) return null;

    const currentTemp = currentTankData.latestData['品温1回目'];
    const currentAlcohol = currentTankData.latestData['アルコール(補完)'];

    if (isNaN(currentTemp) || isNaN(currentAlcohol)) return null;

    // 温度範囲の設定（0.5℃刻み）
    const tempBase = Math.floor(currentTemp * 2) / 2;
    const tempRanges = [
      { min: tempBase - 0.5, max: tempBase, label: `${tempBase-0.5}-${tempBase}℃` },
      { min: tempBase, max: tempBase + 0.5, label: `${tempBase}-${tempBase+0.5}℃` },
      { min: tempBase + 0.5, max: tempBase + 1.0, label: `${tempBase+0.5}-${tempBase+1}℃` }
    ];

    // アルコール範囲の設定（1%刻み）
    const alcoholBase = Math.floor(currentAlcohol);

    const predictions = tempRanges.map((range, index) => {
      // 統合モデルの品温データから類似条件を抽出
      const matchingData = selectedModel.temperatureData?.filter(d =>
        d.temp >= range.min && d.temp < range.max &&
        d.alcohol >= alcoholBase && d.alcohol < alcoholBase + 1
      ) || [];

      if (matchingData.length === 0) {
        return { ...range, min: null, median: null, max: null, current: index === 1 };
      }

      // ボーメ変動の統計値
      const baumeChanges = matchingData.map(d => d.baumeChange).sort((a, b) => a - b);
      const min = baumeChanges[0];
      const max = baumeChanges[baumeChanges.length - 1];
      const median = baumeChanges[Math.floor(baumeChanges.length / 2)];

      return {
        ...range,
        min: min?.toFixed(2),
        median: median?.toFixed(2),
        max: max?.toFixed(2),
        dataCount: matchingData.length,
        current: index === 1
      };
    });

    return predictions;
  };

  const temperaturePrediction = useMemo(() => calculateTemperaturePrediction(), [currentTankData, selectedModel]);

  return (
    <div className="mb-6">
      <h3 className="text-lg font-semibold mb-4">品温変動予測</h3>
      {temperaturePrediction ? (
        <>
          <div className="text-sm text-gray-600 mb-2">
            現在：{currentTankData.latestData?.['品温1回目']?.toFixed(1)}℃、
            {currentTankData.latestData?.['アルコール(補完)']?.toFixed(1)}%
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full border border-gray-300">
              <thead className="bg-gray-50">
                <tr>
                  <th className="border px-3 py-2 text-left">温度帯</th>
                  <th className="border px-3 py-2 text-left">ボーメ変動（最小/中央/最大）</th>
                  <th className="border px-3 py-2 text-left">データ件数</th>
                </tr>
              </thead>
              <tbody>
                {temperaturePrediction.map((pred, index) => (
                  <tr key={index} className={pred.current ? 'bg-blue-50' : ''}>
                    <td className="border px-3 py-2">
                      {pred.label}
                      {pred.current && <span className="ml-2 text-blue-600">← 現在</span>}
                    </td>
                    <td className="border px-3 py-2">
                      {pred.min !== null ? `${pred.min} / ${pred.median} / ${pred.max}` : 'データなし'}
                    </td>
                    <td className="border px-3 py-2">{pred.dataCount || 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <div className="text-gray-500 text-sm">
          品温変動予測データがありません。統合モデルに品温データが含まれていない可能性があります。
        </div>
      )}
    </div>
  );
};

export default TemperaturePrediction;