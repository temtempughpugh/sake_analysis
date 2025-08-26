// src/components/RealTimeDataEntry/ProgressPrediction.jsx
import React, { useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { COLUMN_NAMES } from '../../utils/csvParser';

const ProgressPrediction = ({ currentTankData, selectedModel, selectedPattern }) => {
  // 基準設定の自動取得
  const getBaseSettings = (tankData) => {
    if (!tankData?.dailyData) return null;

    let maxBMD = -Infinity;
    let maxBMDDay = null;

    tankData.dailyData.forEach(d => {
      const bmd = d[COLUMN_NAMES.DAILY.BMD_COMPLEMENT];
      if (!isNaN(bmd) && bmd > maxBMD) {
        maxBMD = bmd;
        maxBMDDay = d.day;
      }
    });

    const startDate = tankData.metadata?.['仕込み日'] ? new Date(tankData.metadata['仕込み日']) : null;
    const endDate = tankData.metadata?.['上槽日'] ? new Date(tankData.metadata?.['上槽日']) : null;
    
    let finalDay = null;
    if (startDate && endDate) {
      finalDay = Math.floor((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1;
    }

    const targetBaume = parseFloat(tankData.metadata?.['目標ボーメ']) || -1.5;
    const finalBMD = finalDay ? targetBaume * finalDay : null;

    return {
      maxBMD,
      maxBMDDay,
      finalBMD,
      finalDay,
      targetBaume
    };
  };

  // 理想BMD計算
  const calculateIdealBMD = (day, baseSettings, pattern) => {
    if (!baseSettings || !pattern?.data || !baseSettings.maxBMD || !baseSettings.finalBMD) return null;

    const { maxBMD, maxBMDDay, finalBMD, finalDay } = baseSettings;

    if (!maxBMDDay || !finalDay || day <= maxBMDDay) return null;

    // 発酵進行度
    const fermentationProgress = ((day - maxBMDDay) / (finalDay - maxBMDDay)) * 100;

    // パターンから進捗率を線形補間で取得
    let progressRate = 0;
    const patternData = pattern.data || [];
    
    for (let i = 0; i < patternData.length - 1; i++) {
      if (patternData[i].x <= fermentationProgress && patternData[i + 1].x >= fermentationProgress) {
        const ratio = (fermentationProgress - patternData[i].x) / 
                     (patternData[i + 1].x - patternData[i].x);
        progressRate = patternData[i].y + (patternData[i + 1].y - patternData[i].y) * ratio;
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
      const predictedBMD = idealValue ? idealValue + bmdDifference : null;
      const predictedBaume = predictedBMD ? predictedBMD / day : null;
      
      predictions.push({
        day,
        predictedBMD,
        predictedBaume,
        idealBMD: idealValue
      });
      
      // 終了判定
      if (predictedBMD && predictedBMD <= baseSettings.finalBMD) break;
    }
    
    return predictions;
  };

  // 予測計算（パターンB：目標日数厳守）
  const predictPatternB = (currentDay, currentBMD, baseSettings) => {
    const predictions = [];
    const remainingDays = baseSettings.finalDay - currentDay;
    
    if (remainingDays <= 0) return predictions;
    
    const dailyReduction = (currentBMD - baseSettings.finalBMD) / remainingDays;
    
    for (let i = 1; i <= remainingDays; i++) {
      const day = currentDay + i;
      const predictedBMD = currentBMD - (dailyReduction * i);
      const predictedBaume = predictedBMD / day;
      
      predictions.push({
        day,
        predictedBMD,
        predictedBaume
      });
    }
    
    return predictions;
  };

  // グラフデータの生成
  const chartData = useMemo(() => {
    if (!currentTankData || !selectedPattern) return [];
    
    const baseSettings = getBaseSettings(currentTankData);
    if (!baseSettings) return [];
    
    const data = [];
    
    // 実測値
    currentTankData.dailyData.forEach(d => {
      const idealBMD = calculateIdealBMD(d.day, baseSettings, selectedPattern);
      data.push({
        day: d.day,
        actual: d[COLUMN_NAMES.DAILY.BMD_COMPLEMENT],
        ideal: idealBMD
      });
    });
    
    // 予測値（パターンA）
    const currentBMD = currentTankData.latestData?.[COLUMN_NAMES.DAILY.BMD_COMPLEMENT];
    const currentIdealBMD = calculateIdealBMD(currentTankData.currentDay, baseSettings, selectedPattern);
    
    if (currentBMD && currentIdealBMD) {
      const predictionsA = predictPatternA(
        currentTankData.currentDay, 
        currentBMD, 
        currentIdealBMD, 
        baseSettings, 
        selectedPattern
      );
      
      predictionsA.forEach(p => {
        const existingData = data.find(d => d.day === p.day);
        if (existingData) {
          existingData.predictedA = p.predictedBMD;
        } else {
          data.push({
            day: p.day,
            predictedA: p.predictedBMD,
            ideal: p.idealBMD
          });
        }
      });
    }
    
    // 予測値（パターンB）
    if (currentBMD) {
      const predictionsB = predictPatternB(currentTankData.currentDay, currentBMD, baseSettings);
      predictionsB.forEach(p => {
        const existingData = data.find(d => d.day === p.day);
        if (existingData) {
          existingData.predictedB = p.predictedBMD;
        }
      });
    }
    
    return data.sort((a, b) => a.day - b.day);
  }, [currentTankData, selectedPattern]);

  const baseSettings = useMemo(() => getBaseSettings(currentTankData), [currentTankData]);

  return (
    <div className="space-y-4">
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="day" label={{ value: '日数', position: 'insideBottom', offset: -5 }} />
          <YAxis label={{ value: 'BMD', angle: -90, position: 'insideLeft' }} />
          <Tooltip />
          <Legend />
          <Line 
            type="monotone" 
            dataKey="actual" 
            stroke="#8884d8" 
            name="実測値" 
            strokeWidth={2}
            dot={{ r: 4 }}
          />
          <Line 
            type="monotone" 
            dataKey="ideal" 
            stroke="#82ca9d" 
            name="理想値" 
            strokeDasharray="5 5"
          />
          <Line 
            type="monotone" 
            dataKey="predictedA" 
            stroke="#ff7300" 
            name="予測A（現状ペース）" 
            strokeDasharray="3 3"
          />
          <Line 
            type="monotone" 
            dataKey="predictedB" 
            stroke="#e91e63" 
            name="予測B（目標厳守）" 
            strokeDasharray="3 3"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

// 進捗状態表示コンポーネント
ProgressPrediction.StatusDisplay = ({ currentTankData, selectedModel, selectedPattern }) => {
  const baseSettings = useMemo(() => {
    if (!currentTankData?.dailyData) return null;

    let maxBMD = -Infinity;
    let maxBMDDay = null;

    currentTankData.dailyData.forEach(d => {
      const bmd = d[COLUMN_NAMES.DAILY.BMD_COMPLEMENT];
      if (!isNaN(bmd) && bmd > maxBMD) {
        maxBMD = bmd;
        maxBMDDay = d.day;
      }
    });

    const startDate = currentTankData.metadata?.['仕込み日'] ? new Date(currentTankData.metadata['仕込み日']) : null;
    const endDate = currentTankData.metadata?.['上槽日'] ? new Date(currentTankData.metadata?.['上槽日']) : null;
    
    let finalDay = null;
    if (startDate && endDate) {
      finalDay = Math.floor((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1;
    }

    const targetBaume = parseFloat(currentTankData.metadata?.['目標ボーメ']) || -1.5;
    const finalBMD = finalDay ? targetBaume * finalDay : null;

    return { maxBMD, maxBMDDay, finalBMD, finalDay, targetBaume };
  }, [currentTankData]);

  if (!baseSettings || !currentTankData?.latestData) {
    return <div className="text-gray-500">進捗計算に必要なデータが不足しています</div>;
  }

  const currentBMD = currentTankData.latestData[COLUMN_NAMES.DAILY.BMD_COMPLEMENT];
  const difference = currentBMD - baseSettings.finalBMD;
  
  // 予測完了日計算
  const predictedDaysRemaining = Math.abs(difference / 0.5); // 仮定：1日0.5減少
  const predictedCompletionDay = currentTankData.currentDay + Math.ceil(predictedDaysRemaining);

  return (
    <div className="grid grid-cols-2 gap-4 text-sm">
      <div>
        <span className="text-gray-600">現在：</span>
        <span className="font-medium ml-1">{currentTankData.currentDay}日目</span>
        {difference && (
          <span className={`ml-2 ${difference > 0.5 ? 'text-red-600' : 'text-green-600'}`}>
            （{difference > 0 ? '遅れ' : '進み'} {Math.abs(difference).toFixed(1)}）
          </span>
        )}
      </div>
      <div>
        <span className="text-gray-600">予測完了：</span>
        <span className="font-medium ml-1">{predictedCompletionDay}日（パターンA）</span>
      </div>
    </div>
  );
};

// 理想発酵進捗表コンポーネント
ProgressPrediction.IdealProgressTable = ({ currentTankData, selectedModel, selectedPattern }) => {
  // 実装省略（画面スペースの関係上）
  return (
    <div className="p-4 bg-gray-50 rounded">
      <table className="min-w-full text-sm">
        <thead>
          <tr>
            <th className="px-2 py-1 text-left">日数</th>
            <th className="px-2 py-1 text-left">進行度</th>
            <th className="px-2 py-1 text-left">完了率</th>
            <th className="px-2 py-1 text-left">理想BMD</th>
            <th className="px-2 py-1 text-left">実測BMD</th>
            <th className="px-2 py-1 text-left">差分</th>
            <th className="px-2 py-1 text-left">状態</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td colSpan="7" className="text-center py-4 text-gray-500">
              （詳細データは実装中）
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
};

// 予測詳細表コンポーネント
ProgressPrediction.PredictionComparisonTable = ({ currentTankData, selectedModel, selectedPattern }) => {
  // 実装省略（画面スペースの関係上）
  return (
    <div className="p-4 bg-gray-50 rounded">
      <table className="min-w-full text-sm">
        <thead>
          <tr>
            <th className="px-2 py-1 text-left">日数</th>
            <th className="px-2 py-1 text-left">パターンA<br />BMD / ボーメ</th>
            <th className="px-2 py-1 text-left">パターンB<br />BMD / ボーメ</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td colSpan="3" className="text-center py-4 text-gray-500">
              （詳細データは実装中）
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
};

export default ProgressPrediction;