// ProgressPrediction.jsx - 進捗予測計算ロジック
import React, { useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const ProgressPrediction = ({ currentTankData, selectedModel, selectedPattern }) => {
  // 基準設定の自動取得
  const getBaseSettings = (tankData) => {
    if (!tankData?.dailyData) return null;

    let maxBMD = -Infinity;
    let maxBMDDay = null;

    tankData.dailyData.forEach(d => {
      const bmd = d['BMD(補完)'];
      if (!isNaN(bmd) && bmd > maxBMD) {
        maxBMD = bmd;
        maxBMDDay = d.day;
      }
    });

    const startDate = tankData.metadata?.['仕込み日'] ? new Date(tankData.metadata['仕込み日']) : null;
    const endDate = tankData.metadata?.['上槽日'] ? new Date(tankData.metadata['上槽日']) : null;
    
    let finalDay = null;
    if (startDate && endDate) {
      finalDay = Math.floor((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1;
    }

    const targetBaume = parseFloat(tankData.metadata?.['目標ボーメ']) || -1.5;
    const finalBMD = finalDay ? targetBaume * finalDay : null;

    return { maxBMD, maxBMDDay, finalBMD, finalDay, targetBaume };
  };

  // 理想BMD計算
  const calculateIdealBMD = (day, baseSettings, pattern) => {
    if (!baseSettings || !pattern || !baseSettings.maxBMD || !baseSettings.finalBMD) return null;

    const { maxBMD, maxBMDDay, finalBMD, finalDay } = baseSettings;
    if (!maxBMDDay || !finalDay) return null;

    const fermentationProgress = ((day - maxBMDDay) / (finalDay - maxBMDDay)) * 100;

    let progressRate = 0;
    for (let i = 0; i < pattern.data.length - 1; i++) {
      if (pattern.data[i].x <= fermentationProgress && pattern.data[i + 1].x >= fermentationProgress) {
        const ratio = (fermentationProgress - pattern.data[i].x) / (pattern.data[i + 1].x - pattern.data[i].x);
        progressRate = pattern.data[i].y + (pattern.data[i + 1].y - pattern.data[i].y) * ratio;
        break;
      }
    }

    return maxBMD - (maxBMD - finalBMD) * (progressRate / 100);
  };

  // 予測計算（パターンA：現状ペース継続）
  const predictPatternA = (currentDay, currentBMD, idealBMD, baseSettings, pattern) => {
    const predictions = [];
    const bmdDifference = currentBMD - idealBMD;
    
    for (let day = currentDay + 1; day <= baseSettings.finalDay + 10; day++) {
      const idealValue = calculateIdealBMD(day, baseSettings, pattern);
      const predictedBMD = idealValue + bmdDifference;
      const predictedBaume = predictedBMD / day;
      
      predictions.push({
        day,
        predictedBMD,
        predictedBaume,
        idealBMD: idealValue
      });
      
      if (predictedBMD <= baseSettings.finalBMD) break;
    }
    
    return predictions;
  };

  // BMD推移グラフデータ作成
  const chartData = useMemo(() => {
    const baseSettings = getBaseSettings(currentTankData);
    if (!baseSettings) return [];

    const data = [];
    const maxDay = Math.max(currentTankData.currentDay + 5, baseSettings.finalDay || 25);

    for (let day = 1; day <= maxDay; day++) {
      const actualData = currentTankData.dailyData.find(d => d.day === day);
      const idealBMD = calculateIdealBMD(day, baseSettings, selectedPattern);

      data.push({
        day,
        actual: actualData ? actualData['BMD(補完)'] : null,
        ideal: idealBMD,
        predictedA: day > currentTankData.currentDay ? idealBMD : null,
        predictedB: day > currentTankData.currentDay ? idealBMD : null
      });
    }

    return data;
  }, [currentTankData, selectedPattern]);

  // 進捗状態計算
  const progressAnalysis = useMemo(() => {
    const baseSettings = getBaseSettings(currentTankData);
    if (!baseSettings) return null;

    const currentBMD = currentTankData.latestData?.['BMD(補完)'];
    if (isNaN(currentBMD)) return null;

    const idealBMD = calculateIdealBMD(currentTankData.currentDay, baseSettings, selectedPattern);
    if (idealBMD === null) return null;

    const difference = currentBMD - idealBMD;

    let status = '順調';
    if (difference > 1.0) status = '大幅遅れ';
    else if (difference > 0.3) status = '遅れ';
    else if (difference < -1.0) status = '大幅進み';
    else if (difference < -0.3) status = '進み';

    return {
      currentBMD,
      idealBMD,
      difference,
      status,
      baseSettings
    };
  }, [currentTankData, selectedPattern]);

  return (
    <div className="space-y-6">
      {/* BMD推移グラフ */}
      <div className="mb-6">
        <h3 className="text-lg font-semibold mb-4">BMD推移グラフ</h3>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="day" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line 
                type="monotone" 
                dataKey="actual" 
                stroke="#2563eb" 
                name="実測値"
                connectNulls={false}
                strokeWidth={2}
              />
              <Line 
                type="monotone" 
                dataKey="ideal" 
                stroke="#dc2626" 
                strokeDasharray="5 5"
                name="理想値"
                connectNulls={false}
              />
              <Line 
                type="monotone" 
                dataKey="predictedA" 
                stroke="#16a34a" 
                strokeDasharray="3 3"
                name="予測パターンA"
                connectNulls={false}
              />
              <Line 
                type="monotone" 
                dataKey="predictedB" 
                stroke="#ca8a04" 
                strokeDasharray="2 2"
                name="予測パターンB"
                connectNulls={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 進捗状態 */}
      {progressAnalysis && (
        <div className="mb-6">
          <h3 className="text-lg font-semibold mb-4">進捗状態</h3>
          <div className="bg-gray-50 p-4 rounded-lg">
            <div className="text-sm">
              現在：{currentTankData.currentDay}日目（{progressAnalysis.status} {progressAnalysis.difference.toFixed(1)}）| 
              予測完了：26日（パターンA）
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm mt-2">
              <div>
                <div className="font-medium">現在BMD</div>
                <div>{progressAnalysis.currentBMD.toFixed(1)}</div>
              </div>
              <div>
                <div className="font-medium">理想BMD</div>
                <div>{progressAnalysis.idealBMD.toFixed(1)}</div>
              </div>
              <div>
                <div className="font-medium">差分</div>
                <div className={progressAnalysis.difference > 0 ? 'text-red-600' : 'text-green-600'}>
                  {progressAnalysis.difference > 0 ? '+' : ''}{progressAnalysis.difference.toFixed(1)}
                </div>
              </div>
              <div>
                <div className="font-medium">状態</div>
                <div className={`font-bold ${
                  progressAnalysis.status === '順調' ? 'text-green-600' :
                  progressAnalysis.status.includes('遅れ') ? 'text-red-600' :
                  'text-orange-600'
                }`}>
                  {progressAnalysis.status}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProgressPrediction;