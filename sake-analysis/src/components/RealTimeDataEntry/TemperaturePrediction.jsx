// src/components/RealTimeDataEntry/TemperaturePrediction.jsx
import React, { useMemo, useState } from 'react';
import { COLUMN_NAMES } from '../../utils/csvParser';

const TemperaturePrediction = ({ currentTankData, selectedModel }) => {
  const [targetVariable, setTargetVariable] = useState('baume'); // 'baume', 'alcohol', 'bmd'

  // 品温変動予測計算
  const calculateTemperaturePrediction = () => {
    if (!currentTankData?.latestData || !selectedModel?.temperatureData) return null;

    const currentTemp = currentTankData.latestData[COLUMN_NAMES.DAILY.TEMP_1];
    const currentAlcohol = currentTankData.latestData[COLUMN_NAMES.DAILY.ALCOHOL_ESTIMATED];

    if (isNaN(currentTemp) || isNaN(currentAlcohol)) return null;

    // 温度範囲の設定（0.5℃刻み）
    const tempBase = Math.floor(currentTemp * 2) / 2;
    const tempRanges = [
      { min: tempBase - 0.5, max: tempBase, label: `${(tempBase-0.5).toFixed(1)}-${tempBase.toFixed(1)}℃` },
      { min: tempBase, max: tempBase + 0.5, label: `${tempBase.toFixed(1)}-${(tempBase+0.5).toFixed(1)}℃` },
      { min: tempBase + 0.5, max: tempBase + 1.0, label: `${(tempBase+0.5).toFixed(1)}-${(tempBase+1.0).toFixed(1)}℃` }
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
        return { 
          ...range, 
          baumeChange: { min: null, median: null, max: null },
          alcoholChange: { min: null, median: null, max: null },
          dataCount: 0,
          current: index === 1 
        };
      }

      // 各変動の統計値計算
      const baumeChanges = matchingData
        .map(d => d.baumeChange)
        .filter(v => !isNaN(v))
        .sort((a, b) => a - b);
      
      const alcoholChanges = matchingData
        .map(d => d.alcoholChange)
        .filter(v => !isNaN(v))
        .sort((a, b) => a - b);

      return {
        ...range,
        baumeChange: {
          min: baumeChanges.length > 0 ? baumeChanges[0] : null,
          median: baumeChanges.length > 0 ? baumeChanges[Math.floor(baumeChanges.length / 2)] : null,
          max: baumeChanges.length > 0 ? baumeChanges[baumeChanges.length - 1] : null
        },
        alcoholChange: {
          min: alcoholChanges.length > 0 ? alcoholChanges[0] : null,
          median: alcoholChanges.length > 0 ? alcoholChanges[Math.floor(alcoholChanges.length / 2)] : null,
          max: alcoholChanges.length > 0 ? alcoholChanges[alcoholChanges.length - 1] : null
        },
        dataCount: matchingData.length,
        current: index === 1
      };
    });

    return predictions;
  };

  const temperaturePrediction = useMemo(() => calculateTemperaturePrediction(), [currentTankData, selectedModel]);

  if (!temperaturePrediction) {
    return (
      <div className="mb-6 p-4 border rounded-lg bg-gray-50">
        <h3 className="text-lg font-semibold mb-2">品温変動予測</h3>
        <div className="text-sm text-gray-500">
          予測に必要なデータが不足しています
        </div>
      </div>
    );
  }

  return (
    <div className="mb-6">
      <h3 className="text-lg font-semibold mb-4">品温変動予測</h3>
      
      {/* 現在の条件表示 */}
      <div className="mb-4 p-3 bg-blue-50 rounded-lg">
        <div className="text-sm text-gray-700">
          <span className="font-medium">現在の条件：</span>
          品温 {currentTankData.latestData?.[COLUMN_NAMES.DAILY.TEMP_1]?.toFixed(1)}℃、
          アルコール {currentTankData.latestData?.[COLUMN_NAMES.DAILY.ALCOHOL_ESTIMATED]?.toFixed(1)}%
        </div>
      </div>

      {/* 目標変動選択 */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-1">
          予測対象
        </label>
        <select
          value={targetVariable}
          onChange={(e) => setTargetVariable(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="baume">ボーメ変動</option>
          <option value="alcohol">アルコール変動</option>
          <option value="bmd">BMD変動</option>
        </select>
      </div>

      {/* 予測表 */}
      <div className="overflow-x-auto">
        <table className="min-w-full border border-gray-300">
          <thead className="bg-gray-50">
            <tr>
              <th className="border px-3 py-2 text-left text-sm">温度帯</th>
              <th className="border px-3 py-2 text-left text-sm">
                {targetVariable === 'baume' ? 'ボーメ' : 
                 targetVariable === 'alcohol' ? 'アルコール' : 'BMD'}変動
                <br />
                <span className="text-xs font-normal">（最小/中央/最大）</span>
              </th>
              <th className="border px-3 py-2 text-left text-sm">データ件数</th>
            </tr>
          </thead>
          <tbody>
            {temperaturePrediction.map((pred, index) => {
              const changes = targetVariable === 'baume' ? pred.baumeChange : 
                            targetVariable === 'alcohol' ? pred.alcoholChange :
                            pred.baumeChange; // BMDの場合もボーメ変動を使用

              return (
                <tr key={index} className={pred.current ? 'bg-yellow-50' : ''}>
                  <td className="border px-3 py-2 font-medium">
                    {pred.label}
                    {pred.current && <span className="ml-2 text-sm text-blue-600">←現在</span>}
                  </td>
                  <td className="border px-3 py-2">
                    {changes.min !== null ? (
                      <div className="text-sm">
                        <span className="text-red-600">{changes.min?.toFixed(2)}</span>
                        {' / '}
                        <span className="font-medium">{changes.median?.toFixed(2)}</span>
                        {' / '}
                        <span className="text-green-600">{changes.max?.toFixed(2)}</span>
                      </div>
                    ) : (
                      <span className="text-gray-400">データなし</span>
                    )}
                  </td>
                  <td className="border px-3 py-2 text-center">
                    {pred.dataCount > 0 ? (
                      <span className={pred.dataCount < 3 ? 'text-yellow-600' : 'text-green-600'}>
                        {pred.dataCount}件
                      </span>
                    ) : (
                      <span className="text-gray-400">0件</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* 予測結果の解説 */}
      {temperaturePrediction.some(p => p.current && p.dataCount > 0) && (
        <div className="mt-4 p-3 bg-gray-50 rounded-lg">
          <h4 className="text-sm font-medium mb-2">予測結果の見方</h4>
          <ul className="text-xs text-gray-600 space-y-1">
            <li>• 中央値が最も起こりやすい変動です</li>
            <li>• データ件数が多いほど信頼性が高くなります</li>
            <li>• 温度を0.5℃変更した場合の影響も参考にできます</li>
          </ul>
        </div>
      )}

      {/* 0.5℃温度変更の参考値 */}
      <div className="mt-4 p-4 border-t">
        <h4 className="text-sm font-medium mb-2">温度変更シミュレーション</h4>
        <div className="grid grid-cols-2 gap-4 text-sm">
          {temperaturePrediction.map((pred, index) => {
            if (index === 1) return null; // 現在温度帯はスキップ
            const changes = targetVariable === 'baume' ? pred.baumeChange : pred.alcoholChange;
            const direction = index === 0 ? '下げる' : '上げる';
            const impact = index === 0 ? '発酵緩慢' : '発酵促進';
            
            return (
              <div key={index} className="p-2 bg-gray-50 rounded">
                <div className="font-medium">
                  温度を0.5℃{direction}場合
                </div>
                <div className="text-gray-600">
                  {changes.median !== null ? (
                    <>
                      予測変動: {changes.median?.toFixed(2)}
                      <span className={`ml-2 ${index === 0 ? 'text-blue-600' : 'text-red-600'}`}>
                        （{impact}）
                      </span>
                    </>
                  ) : (
                    'データ不足'
                  )}
                </div>
              </div>
            );
          }).filter(Boolean)}
        </div>
      </div>
    </div>
  );
};

export default TemperaturePrediction;