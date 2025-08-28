// src/components/RealTimeDataEntry/WaterAnalysis.jsx
import React, { useMemo, useState, useEffect } from 'react';
import { COLUMN_NAMES } from '../../utils/csvParser';

const WaterAnalysis = ({ currentTankData, selectedModel }) => {
  const [editableParams, setEditableParams] = useState({
    alcoholCoeff: 0.64,
    targetAlcoholThreshold: 15,
    targetBaume: -1.21,
    targetAlcohol: 18.65
  });

  // パラメータ初期化
  useEffect(() => {
    if (selectedModel?.oisuiData?.analysis2?.parameters) {
      setEditableParams(prev => ({
        ...prev,
        ...selectedModel.oisuiData.analysis2.parameters
      }));
    } else if (currentTankData?.metadata) {
      // タンクメタデータから初期値を設定
      const metadata = currentTankData.metadata;
      setEditableParams(prev => ({
        ...prev,
        targetBaume: parseFloat(metadata['目標ボーメ']) || prev.targetBaume,
        targetAlcohol: parseFloat(metadata['目標アルコール度数']) || prev.targetAlcohol
      }));
    }
  }, [selectedModel, currentTankData]);

  // 追い水提案計算
  const calculateWaterSuggestions = useMemo(() => {
    if (!currentTankData || !currentTankData.dailyData) return [];

    const suggestions = [];
    const totalVolume = parseFloat(currentTankData.metadata?.['仕込み総量']) || 1555;

    // 5日目・7日目の回帰式による計算
    if (selectedModel?.oisuiData?.analysis1) {
      const { day5Regression, day7Regression } = selectedModel.oisuiData.analysis1;
      
      [5, 7].forEach(day => {
        const regression = day === 5 ? day5Regression : day7Regression;
        if (!regression || !regression.a || !regression.b) return;

        // day_5, day_7 形式でアクセス
        const dayData = currentTankData.dailyData[`day_${day}`];
        if (!dayData) return;

        const baume = parseFloat(dayData['ボーメ(BMD/日数)']);
        if (isNaN(baume)) return;

        const theoreticalChange = regression.a * baume + regression.b;
        if (theoreticalChange <= 0) return; // 無効な変動量

        const dilutionRatio = baume / (baume - theoreticalChange);
        const waterAmount = totalVolume * (dilutionRatio - 1);

        if (waterAmount > 0 && waterAmount < totalVolume) { // 妥当性チェック
          suggestions.push({
            day,
            amount: Math.round(waterAmount),
            reason: `ボーメ${baume.toFixed(1)}→変動${theoreticalChange.toFixed(2)}（回帰式）`,
            type: 'regression'
          });
        }
      });
    }

    // 8日目以降のパラメータ計算
    if (currentTankData.currentDay >= 8) {
      // 最新データの取得
      const latestDayKey = `day_${currentTankData.currentDay}`;
      const latestData = currentTankData.dailyData[latestDayKey];
      
      if (latestData) {
        const currentBaume = parseFloat(latestData['ボーメ(補完)']);
        const currentAlcohol = parseFloat(latestData['アルコール(補complete)']);
        
        if (!isNaN(currentBaume) && !isNaN(currentAlcohol)) {
          // 残りボーメ計算
          const remainingBaume = currentBaume - editableParams.targetBaume;
          const predictedAlcoholIncrease = remainingBaume * editableParams.alcoholCoeff;
          const predictedFinalAlcohol = currentAlcohol + predictedAlcoholIncrease;

          // 追い水が必要な場合
          if (predictedFinalAlcohol > editableParams.targetAlcohol) {
            const dilutionRatio = editableParams.targetAlcohol / predictedFinalAlcohol;
            const requiredFinalVolume = totalVolume / dilutionRatio;
            const requiredTotalWater = requiredFinalVolume - totalVolume;

            if (requiredTotalWater > 0) {
              // 累積追い水量を計算
              let cumulativeWater = 0;
              Object.keys(currentTankData.dailyData).forEach(key => {
                if (key.startsWith('day_')) {
                  const water = parseFloat(currentTankData.dailyData[key]['追水']) || 0;
                  cumulativeWater += water;
                }
              });

              const remainingWater = requiredTotalWater - cumulativeWater;
              if (remainingWater > 0) {
                suggestions.push({
                  day: currentTankData.currentDay,
                  amount: Math.round(remainingWater / 2), // 分割して推奨
                  reason: `予測${predictedFinalAlcohol.toFixed(1)}%→目標${editableParams.targetAlcohol}%（希釈）`,
                  type: 'parameter'
                });
              }
            }
          }
        }
      }
    }

    return suggestions;
  }, [currentTankData, selectedModel, editableParams]);

  // 累積追い水量の計算
  const cumulativeWaterData = useMemo(() => {
    if (!currentTankData?.dailyData) return [];

    const data = [];
    let cumulative = 0;

    // day_1, day_2... の順番でソート
    const sortedDays = Object.keys(currentTankData.dailyData)
      .filter(key => key.startsWith('day_'))
      .sort((a, b) => {
        const dayA = parseInt(a.replace('day_', ''));
        const dayB = parseInt(b.replace('day_', ''));
        return dayA - dayB;
      });

    sortedDays.forEach(key => {
      const dayNumber = parseInt(key.replace('day_', ''));
      const dayData = currentTankData.dailyData[key];
      const dailyWater = parseFloat(dayData['追水']) || 0;
      cumulative += dailyWater;

      data.push({
        day: dayNumber,
        daily: dailyWater,
        cumulative: cumulative
      });
    });

    return data;
  }, [currentTankData]);

  if (!currentTankData) {
    return (
      <div className="p-4 text-center text-gray-500">
        追い水分析に必要なデータが不足しています
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 累積追い水量表示 */}
      <div className="bg-blue-50 p-4 rounded-lg">
        <h4 className="text-lg font-semibold mb-2">累積追い水量：{cumulativeWaterData.length > 0 ? cumulativeWaterData[cumulativeWaterData.length - 1]?.cumulative?.toFixed(0) || 0 : 0}L</h4>
        <p className="text-sm text-gray-600">
          仕込み総量：{parseFloat(currentTankData.metadata?.['仕込み総量']) || 1555}L
        </p>
      </div>

      {/* 追い水提案表 */}
      {calculateWaterSuggestions.length > 0 && (
        <div className="border rounded-lg overflow-hidden">
          <table className="min-w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left text-sm font-medium">日</th>
                <th className="px-4 py-2 text-left text-sm font-medium">推奨量</th>
                <th className="px-4 py-2 text-left text-sm font-medium">根拠</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {calculateWaterSuggestions.map((suggestion, index) => (
                <tr key={index}>
                  <td className="px-4 py-2 font-medium">{suggestion.day}</td>
                  <td className="px-4 py-2">{suggestion.amount}L</td>
                  <td className="px-4 py-2 text-sm">{suggestion.reason}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {calculateWaterSuggestions.length === 0 && (
        <div className="text-center text-gray-500 py-8">
          <p>追い水提案なし</p>
          <p className="text-sm mt-2">現在の条件では追い水は不要です</p>
        </div>
      )}

      {/* 回帰分析情報 */}
      {selectedModel?.oisuiData?.analysis1 && (
        <div className="bg-gray-50 p-4 rounded-lg">
          <h4 className="text-sm font-medium mb-3">回帰分析（5日目・7日目）</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {selectedModel.oisuiData.analysis1.day5Regression && (
              <div className="p-2 bg-white border rounded">
                <div className="font-medium">5日目回帰式</div>
                <div className="text-xs mt-1">
                  y = {selectedModel.oisuiData.analysis1.day5Regression.a.toFixed(4)}x + 
                  {selectedModel.oisuiData.analysis1.day5Regression.b.toFixed(4)}
                </div>
                <div className="text-xs text-gray-500">
                  (R² = {selectedModel.oisuiData.analysis1.day5Regression.rSquared?.toFixed(3) || 'N/A'})
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
                  (R² = {selectedModel.oisuiData.analysis1.day7Regression.rSquared?.toFixed(3) || 'N/A'})
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 累積追い水グラフ */}
      <div className="border rounded-lg p-4">
        <h4 className="text-sm font-medium mb-3">累積追い水量グラフ</h4>
        <div className="h-40 flex items-end space-x-1">
          {cumulativeWaterData.length > 0 ? (
            cumulativeWaterData.map((data, index) => {
              const maxCumulative = Math.max(...cumulativeWaterData.map(d => d.cumulative), 1);
              const height = Math.max((data.cumulative / maxCumulative) * 100, 2);
              
              return (
                <div key={`water-${data.day}-${index}`} className="flex-1 flex flex-col items-center">
                  <div className="w-full bg-blue-200 relative" style={{ height: `${height}%` }}>
                    {data.daily > 0 && (
                      <div 
                        className="absolute top-0 w-full bg-blue-500" 
                        style={{ height: `${Math.max((data.daily / Math.max(data.cumulative, 1)) * 100, 2)}%` }} 
                      />
                    )}
                  </div>
                  {(index % 5 === 0 || index === cumulativeWaterData.length - 1) && (
                    <div className="text-xs mt-1">{data.day}</div>
                  )}
                </div>
              );
            })
          ) : (
            <div className="w-full h-full flex items-center justify-center text-gray-500 text-sm">
              データなし
            </div>
          )}
        </div>
        <div className="mt-2 flex items-center justify-between text-xs text-gray-600">
          <span>日数</span>
          <span>累積: {cumulativeWaterData.length > 0 ? cumulativeWaterData[cumulativeWaterData.length - 1]?.cumulative?.toFixed(0) || 0 : 0}L</span>
        </div>
      </div>

      {/* パラメータ編集パネル */}
      <div className="border rounded-lg p-4">
        <h4 className="text-sm font-medium mb-4">追い水パラメータ編集</h4>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              アルコール係数
            </label>
            <input
              type="number"
              step="0.01"
              value={editableParams.alcoholCoeff}
              onChange={(e) => setEditableParams(prev => ({
                ...prev,
                alcoholCoeff: parseFloat(e.target.value) || 0.64
              }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              アルコール閾値
            </label>
            <input
              type="number"
              step="0.1"
              value={editableParams.targetAlcoholThreshold}
              onChange={(e) => setEditableParams(prev => ({
                ...prev,
                targetAlcoholThreshold: parseFloat(e.target.value) || 15
              }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              目標ボーメ
            </label>
            <input
              type="number"
              step="0.1"
              value={editableParams.targetBaume}
              onChange={(e) => setEditableParams(prev => ({
                ...prev,
                targetBaume: parseFloat(e.target.value) || -1.21
              }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              目標アルコール度数
            </label>
            <input
              type="number"
              step="0.1"
              value={editableParams.targetAlcohol}
              onChange={(e) => setEditableParams(prev => ({
                ...prev,
                targetAlcohol: parseFloat(e.target.value) || 18.65
              }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
            />
          </div>
        </div>
        <div className="mt-4 flex space-x-2">
          <button
            onClick={() => setEditableParams({
              alcoholCoeff: 0.64,
              targetAlcoholThreshold: 15,
              targetBaume: -1.21,
              targetAlcohol: 18.65
            })}
            className="px-4 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50"
          >
            デフォルトに戻す
          </button>
          <button
            onClick={() => {
              // LocalStorageに保存（簡易実装）
              if (currentTankData?.tankId) {
                const key = `waterParams_${currentTankData.tankId}`;
                localStorage.setItem(key, JSON.stringify(editableParams));
              }
              alert('パラメータを保存しました');
            }}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            保存
          </button>
        </div>
      </div>
    </div>
  );
};

export default WaterAnalysis;