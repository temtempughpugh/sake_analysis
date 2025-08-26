// src/components/RealTimeDataEntry/WaterAnalysis.jsx
import React, { useMemo, useState, useEffect } from 'react';
import { COLUMN_NAMES } from '../../utils/csvParser';

const WaterAnalysis = ({ currentTankData, selectedModel }) => {
  const [editableParams, setEditableParams] = useState(null);
  
  // 初期パラメータ設定
  useEffect(() => {
    if (selectedModel?.oisuiData?.analysis2?.parameters) {
      setEditableParams({...selectedModel.oisuiData.analysis2.parameters});
    }
  }, [selectedModel]);

  // 追い水提案計算
  const calculateWaterSuggestions = () => {
    if (!currentTankData || !selectedModel) return [];

    const suggestions = [];
    const totalVolume = parseFloat(currentTankData.metadata?.[COLUMN_NAMES.META.TOTAL_VOLUME]) || 1000;

    // 5日目・7日目の回帰式による計算
    if (selectedModel.oisuiData?.analysis1) {
      const { day5Regression, day7Regression } = selectedModel.oisuiData.analysis1;
      
      [5, 7].forEach(day => {
        const regression = day === 5 ? day5Regression : day7Regression;
        if (!regression) return;

        const dayData = currentTankData.dailyData.find(d => d.day === day);
        if (!dayData) return;

        const baume = dayData[COLUMN_NAMES.DAILY.BAUME_BMD_DAY];
        if (isNaN(baume)) return;

        const theoreticalChange = regression.a * baume + regression.b;
        const dilutionRatio = baume / (baume - theoreticalChange);
        const waterAmount = totalVolume * (dilutionRatio - 1);

        suggestions.push({
          day,
          amount: Math.round(waterAmount),
          reason: `ボーメ${baume.toFixed(1)}→変動${theoreticalChange.toFixed(2)}（回帰式）`,
          type: 'regression'
        });
      });
    }

    // 8日目以降のパラメータ計算（編集可能なパラメータを使用）
    const params = editableParams || selectedModel.oisuiData?.analysis2?.parameters;
    
    if (params && currentTankData.currentDay >= 8) {
      const currentBaume = currentTankData.latestData?.[COLUMN_NAMES.DAILY.BAUME_ESTIMATED];
      const currentAlcohol = currentTankData.latestData?.[COLUMN_NAMES.DAILY.ALCOHOL_ESTIMATED];

      if (!isNaN(currentBaume) && !isNaN(currentAlcohol)) {
        const remainingBaume = currentBaume - params.targetBaume;
        const predictedAlcoholIncrease = remainingBaume * params.alcoholCoeff;
        const predictedFinalAlcohol = currentAlcohol + predictedAlcoholIncrease;

        if (predictedFinalAlcohol > params.targetAlcohol) {
          const dilutionRatio = params.targetAlcohol / predictedFinalAlcohol;
          const requiredFinalVolume = totalVolume / dilutionRatio;
          const requiredWater = requiredFinalVolume - totalVolume - currentTankData.cumulativeWater;

          suggestions.push({
            day: currentTankData.currentDay,
            amount: Math.round(requiredWater),
            reason: `予測${predictedFinalAlcohol.toFixed(1)}%→目標${params.targetAlcohol}%（希釈）`,
            type: 'parameter',
            details: {
              currentBaume,
              currentAlcohol,
              remainingBaume,
              predictedAlcoholIncrease,
              predictedFinalAlcohol
            }
          });
        }
      }
    }

    return suggestions;
  };

  const waterSuggestions = useMemo(() => calculateWaterSuggestions(), 
    [currentTankData, selectedModel, editableParams]);

  // 累積追い水グラフ用データ
  const cumulativeWaterData = useMemo(() => {
    if (!currentTankData?.dailyData) return [];
    
    let cumulative = 0;
    return currentTankData.dailyData.map(d => {
      const water = d[COLUMN_NAMES.DAILY.WATER] || 0;
      cumulative += water;
      return {
        day: d.day,
        daily: water,
        cumulative
      };
    });
  }, [currentTankData]);

  return (
    <div className="mb-6">
      <h3 className="text-lg font-semibold mb-4">追い水提案</h3>
      
      {/* 現在の状況 */}
      <div className="mb-4 p-3 bg-blue-50 rounded-lg">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-gray-600">累積追い水量：</span>
            <span className="font-medium">{currentTankData?.cumulativeWater?.toFixed(0) || 0}L</span>
          </div>
          <div>
            <span className="text-gray-600">仕込み総量：</span>
            <span className="font-medium">
              {currentTankData?.metadata?.[COLUMN_NAMES.META.TOTAL_VOLUME] || '---'}L
            </span>
          </div>
        </div>
      </div>

      {/* 追い水提案表 */}
      <div className="overflow-x-auto mb-6">
        <table className="min-w-full border border-gray-300">
          <thead className="bg-gray-50">
            <tr>
              <th className="border px-3 py-2 text-left text-sm">日</th>
              <th className="border px-3 py-2 text-left text-sm">推奨量</th>
              <th className="border px-3 py-2 text-left text-sm">根拠</th>
            </tr>
          </thead>
          <tbody>
            {waterSuggestions.length > 0 ? (
              waterSuggestions.map((suggestion, index) => (
                <tr key={index}>
                  <td className="border px-3 py-2 font-medium">{suggestion.day}</td>
                  <td className="border px-3 py-2">
                    <span className="font-medium text-blue-600">{suggestion.amount}L</span>
                  </td>
                  <td className="border px-3 py-2 text-sm">{suggestion.reason}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="3" className="border px-3 py-4 text-center text-gray-500">
                  追い水提案なし
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* 詳細情報（8日目以降） */}
      {waterSuggestions.some(s => s.type === 'parameter' && s.details) && (
        <div className="mb-6 p-4 bg-gray-50 rounded-lg">
          <h4 className="text-sm font-medium mb-2">計算根拠（8日目以降）</h4>
          {waterSuggestions.filter(s => s.type === 'parameter' && s.details).map((s, i) => (
            <div key={i} className="text-sm space-y-1">
              <div>現在ボーメ: {s.details.currentBaume?.toFixed(2)}</div>
              <div>現在アルコール: {s.details.currentAlcohol?.toFixed(1)}%</div>
              <div>残りボーメ: {s.details.remainingBaume?.toFixed(2)}</div>
              <div>予測アルコール増加: {s.details.predictedAlcoholIncrease?.toFixed(1)}%</div>
              <div>予測最終アルコール: {s.details.predictedFinalAlcohol?.toFixed(1)}%</div>
            </div>
          ))}
        </div>
      )}

      {/* 回帰分析グラフ（5日/7日） */}
      {selectedModel?.oisuiData?.analysis1 && (
        <div className="mb-6 p-4 border rounded-lg">
          <h4 className="text-sm font-medium mb-2">回帰分析（5日目・7日目）</h4>
          <div className="grid grid-cols-2 gap-4 text-sm">
            {selectedModel.oisuiData.analysis1.day5Regression && (
              <div className="p-2 bg-white border rounded">
                <div className="font-medium">5日目回帰式</div>
                <div className="text-xs mt-1">
                  y = {selectedModel.oisuiData.analysis1.day5Regression.a.toFixed(4)}x + 
                  {selectedModel.oisuiData.analysis1.day5Regression.b.toFixed(4)}
                </div>
                <div className="text-xs text-gray-500">
                  (R² = {selectedModel.oisuiData.analysis1.day5Regression.rSquared?.toFixed(3)})
                </div>
              </div>
            )}
            {selectedModel.oisuiData.analysis1.day7Regression && (
              <div className="p-2 bg-white border rounded">
                <div className="font-medium">7日目回帰式</div>
                <div className="text-xs mt-1">
                  y = {selectedModel.oisuiData.analysis1.day7Regression.a.toFixed(4)}x + 
                  {selectedModel.oisuiData.analysis1.day7Regression.b.toFixed(4)}
                </div>
                <div className="text-xs text-gray-500">
                  (R² = {selectedModel.oisuiData.analysis1.day7Regression.rSquared?.toFixed(3)})
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 累積追い水グラフ */}
      <div className="mb-6 p-4 border rounded-lg">
        <h4 className="text-sm font-medium mb-3">累積追い水量グラフ</h4>
        <div className="h-40 flex items-end space-x-1">
          {cumulativeWaterData.length > 0 ? cumulativeWaterData.map((data, index) => {
  const maxCumulative = Math.max(...cumulativeWaterData.map(d => d.cumulative)) || 1;
  const height = (data.cumulative / maxCumulative) * 100;
  
  return (
    <div key={`water-${data.day}-${index}`} className="flex-1 flex flex-col items-center">
      <div className="w-full bg-blue-200 relative" style={{ height: `${height}%` }}>
        {data.daily > 0 && (
          <div className="absolute top-0 w-full bg-blue-500" 
               style={{ height: `${(data.daily / data.cumulative) * 100}%` }} />
        )}
      </div>
      {(index % 5 === 0 || index === cumulativeWaterData.length - 1) && (
        <div className="text-xs mt-1">{data.day}</div>
      )}
    </div>
  );
}) : null}
        </div>
        <div className="mt-2 flex items-center justify-between text-xs text-gray-600">
          <span>日数</span>
          <span>累積: {currentTankData?.cumulativeWater?.toFixed(0) || 0}L</span>
        </div>
      </div>
    </div>
  );
};

// パラメータ編集コンポーネント
WaterAnalysis.ParameterEditor = ({ selectedModel, onUpdate }) => {
  const [params, setParams] = useState({
    alcoholCoeff: 0.64,
    targetAlcoholThreshold: 15,
    targetBaume: -1.21,
    targetAlcohol: 18.65
  });

  useEffect(() => {
    if (selectedModel?.oisuiData?.analysis2?.parameters) {
      setParams({...selectedModel.oisuiData.analysis2.parameters});
    }
  }, [selectedModel]);

  const handleParamChange = (key, value) => {
    const newParams = { ...params, [key]: parseFloat(value) || 0 };
    setParams(newParams);
  };

  const handleSave = () => {
    onUpdate(params);
    // LocalStorageに保存
    const modelId = selectedModel?.id;
    const tankId = selectedModel?.sourceTankIds?.[0];
    if (modelId && tankId) {
      localStorage.setItem(
        `oisui2Params_${tankId}_${modelId}`,
        JSON.stringify(params)
      );
    }
  };

  const handleReset = () => {
    const defaultParams = {
      alcoholCoeff: 0.64,
      targetAlcoholThreshold: 15,
      targetBaume: -1.21,
      targetAlcohol: 18.65
    };
    setParams(defaultParams);
  };

  return (
    <div className="p-4 bg-gray-50 rounded-lg">
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            アルコール係数
          </label>
          <input
            type="number"
            step="0.01"
            value={params.alcoholCoeff}
            onChange={(e) => handleParamChange('alcoholCoeff', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            アルコール閾値
          </label>
          <input
            type="number"
            step="0.1"
            value={params.targetAlcoholThreshold}
            onChange={(e) => handleParamChange('targetAlcoholThreshold', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            目標ボーメ
          </label>
          <input
            type="number"
            step="0.01"
            value={params.targetBaume}
            onChange={(e) => handleParamChange('targetBaume', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            目標アルコール度数
          </label>
          <input
            type="number"
            step="0.01"
            value={params.targetAlcohol}
            onChange={(e) => handleParamChange('targetAlcohol', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>
      
      <div className="flex justify-end space-x-2">
        <button
          onClick={handleReset}
          className="px-4 py-2 text-gray-600 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
        >
          デフォルトに戻す
        </button>
        <button
          onClick={handleSave}
          className="px-4 py-2 text-white bg-blue-600 rounded-md hover:bg-blue-700"
        >
          保存
        </button>
      </div>
    </div>
  );
};

export default WaterAnalysis;