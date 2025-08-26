// src/components/RealTimeDataEntry/IntegratedAnalysisTable.jsx
import React, { useMemo } from 'react';
import { COLUMN_NAMES } from '../../utils/csvParser';

const IntegratedAnalysisTable = ({ currentTankData, selectedModel, selectedPattern }) => {
  // 基準設定の自動取得
  const getBaseSettings = (tankData) => {
    if (!tankData?.dailyData) return null;

    // 最高BMDの検出
    let maxBMD = -Infinity;
    let maxBMDDay = null;

    tankData.dailyData.forEach(d => {
      const bmd = d[COLUMN_NAMES.DAILY.BMD_COMPLEMENT];
      if (!isNaN(bmd) && bmd > maxBMD) {
        maxBMD = bmd;
        maxBMDDay = d.day;
      }
    });

    // 最終日計算（上槽日がある場合）
    const startDate = tankData.metadata?.['仕込み日'] ? new Date(tankData.metadata['仕込み日']) : null;
    const endDate = tankData.metadata?.['上槽日'] ? new Date(tankData.metadata['上槽日']) : null;
    
    let finalDay = null;
    if (startDate && endDate) {
      finalDay = Math.floor((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1;
    }

    // 最終BMD計算
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

    // 理想BMD
    return maxBMD - (maxBMD - finalBMD) * (progressRate / 100);
  };

  // 予測値の計算
  const calculatePredictions = (dayData, baseSettings, selectedModel) => {
    // 品温変動予測
    let tempPrediction = null;
    if (selectedModel?.temperatureData && dayData[COLUMN_NAMES.DAILY.TEMP_1]) {
      const currentTemp = dayData[COLUMN_NAMES.DAILY.TEMP_1];
      const currentAlcohol = dayData[COLUMN_NAMES.DAILY.ALCOHOL_ESTIMATED];
      
      if (!isNaN(currentTemp) && !isNaN(currentAlcohol)) {
        const tempBase = Math.floor(currentTemp * 2) / 2;
        const alcoholBase = Math.floor(currentAlcohol);
        
        // 類似データを抽出
        const matchingData = selectedModel.temperatureData.filter(d =>
          d.temp >= tempBase && d.temp < tempBase + 0.5 &&
          d.alcohol >= alcoholBase && d.alcohol < alcoholBase + 1
        );
        
        if (matchingData.length > 0) {
          const baumeChanges = matchingData.map(d => d.baumeChange).sort((a, b) => a - b);
          tempPrediction = baumeChanges[Math.floor(baumeChanges.length / 2)]; // 中央値
        }
      }
    }
    
    return {
      baumePrediction: tempPrediction,
      alcoholChange: tempPrediction ? tempPrediction * 0.64 : null // 仮のアルコール係数
    };
  };

  // 統合分析データの生成
  const analysisData = useMemo(() => {
    if (!currentTankData?.dailyData) return [];
    
    const baseSettings = getBaseSettings(currentTankData);
    if (!baseSettings) return [];

    return currentTankData.dailyData.map(dayData => {
      const idealBMD = calculateIdealBMD(dayData.day, baseSettings, selectedPattern);
      const actualBMD = dayData[COLUMN_NAMES.DAILY.BMD_COMPLEMENT];
      const difference = (idealBMD && !isNaN(actualBMD)) ? actualBMD - idealBMD : null;
      
      const predictions = calculatePredictions(dayData, baseSettings, selectedModel);
      
      return {
        day: dayData.day,
        temp: dayData[COLUMN_NAMES.DAILY.TEMP_1],
        baume: {
          actual: dayData[COLUMN_NAMES.DAILY.BAUME_ESTIMATED],
          predicted: predictions.baumePrediction,
          difference: null
        },
        alcohol: {
          actual: dayData[COLUMN_NAMES.DAILY.ALCOHOL_ESTIMATED],
          change: predictions.alcoholChange
        },
        bmd: {
          actual: actualBMD,
          ideal: idealBMD,
          difference: difference
        },
        isCurrent: dayData.day === currentTankData.currentDay
      };
    });
  }, [currentTankData, selectedPattern, selectedModel]);

  // 進捗状態の判定
  const getProgressStatus = (difference) => {
    if (difference === null) return '';
    const abs = Math.abs(difference);
    if (abs < 0.5) return '順調';
    if (abs < 1.0) return difference > 0 ? '遅れ' : '進み';
    return difference > 0 ? '大幅遅れ' : '大幅進み';
  };

  return (
    <div className="mb-6">
      <h3 className="text-lg font-semibold mb-4">統合分析表</h3>
      <div className="overflow-x-auto">
        <table className="min-w-full border border-gray-300">
          <thead className="bg-gray-50">
            <tr>
              <th className="border px-3 py-2 text-left text-sm">日数</th>
              <th className="border px-3 py-2 text-left text-sm">品温</th>
              <th className="border px-3 py-2 text-left text-sm">
                ボーメ<br />
                <span className="text-xs">実測/予測/差分</span>
              </th>
              <th className="border px-3 py-2 text-left text-sm">
                アルコール<br />
                <span className="text-xs">実測/変動</span>
              </th>
              <th className="border px-3 py-2 text-left text-sm">
                BMD<br />
                <span className="text-xs">実測/理想</span>
              </th>
              <th className="border px-3 py-2 text-left text-sm">状態</th>
            </tr>
          </thead>
          <tbody>
            {analysisData.map((data, index) => (
              <tr key={data.day} className={data.isCurrent ? 'bg-blue-50' : ''}>
                <td className="border px-3 py-2 font-medium">
                  {data.day}
                  {data.isCurrent && <span className="ml-2 text-sm text-blue-600">現在</span>}
                </td>
                <td className="border px-3 py-2">
                  {!isNaN(data.temp) ? data.temp.toFixed(1) : '---'}
                </td>
                <td className="border px-3 py-2">
                  <div className="text-sm">
                    <span>{!isNaN(data.baume.actual) ? data.baume.actual.toFixed(2) : '---'}</span>
                    {' / '}
                    <span>{data.baume.predicted ? data.baume.predicted.toFixed(2) : '---'}</span>
                    {' / '}
                    <span>{data.baume.difference ? data.baume.difference.toFixed(2) : '---'}</span>
                  </div>
                </td>
                <td className="border px-3 py-2">
                  <div className="text-sm">
                    <span>{!isNaN(data.alcohol.actual) ? data.alcohol.actual.toFixed(1) : '---'}</span>
                    {' / '}
                    <span className={data.alcohol.change > 0 ? 'text-green-600' : 'text-red-600'}>
                      {data.alcohol.change ? 
                        (data.alcohol.change > 0 ? '+' : '') + data.alcohol.change.toFixed(2) : 
                        '---'}
                    </span>
                  </div>
                </td>
                <td className="border px-3 py-2">
                  <div className="text-sm">
                    <span>{!isNaN(data.bmd.actual) ? data.bmd.actual.toFixed(1) : '---'}</span>
                    {' / '}
                    <span>{data.bmd.ideal ? data.bmd.ideal.toFixed(1) : '---'}</span>
                  </div>
                  {data.bmd.difference !== null && (
                    <div className={`text-xs ${data.bmd.difference > 0 ? 'text-red-600' : 'text-green-600'}`}>
                      {data.bmd.difference > 0 ? '↑' : '↓'} {Math.abs(data.bmd.difference).toFixed(1)}
                    </div>
                  )}
                </td>
                <td className="border px-3 py-2">
                  <span className={`text-sm font-medium ${
                    data.bmd.difference === null ? 'text-gray-400' :
                    Math.abs(data.bmd.difference) < 0.5 ? 'text-green-600' :
                    Math.abs(data.bmd.difference) < 1.0 ? 'text-yellow-600' : 'text-red-600'
                  }`}>
                    {getProgressStatus(data.bmd.difference)}
                  </span>
                </td>
              </tr>
            ))}
            {analysisData.length === 0 && (
              <tr>
                <td colSpan="6" className="border px-3 py-4 text-center text-gray-500">
                  データがありません
                </td>
              </tr>
            )}
            
            {/* 予測行（未来） */}
            {currentTankData?.currentDay && baseSettings?.finalDay && 
             currentTankData.currentDay < baseSettings.finalDay && (
              <>
                <tr className="bg-gray-50">
                  <td colSpan="6" className="border px-3 py-1 text-center text-sm font-medium text-gray-600">
                    ↓ 予測
                  </td>
                </tr>
                {[1, 2].map(offset => {
                  const futureDay = currentTankData.currentDay + offset;
                  if (futureDay > baseSettings.finalDay) return null;
                  
                  return (
                    <tr key={`future-${futureDay}`} className="bg-yellow-50">
                      <td className="border px-3 py-2">{futureDay}</td>
                      <td className="border px-3 py-2">予測</td>
                      <td className="border px-3 py-2">--- / --- / ---</td>
                      <td className="border px-3 py-2">--- / ---</td>
                      <td className="border px-3 py-2">--- / ---</td>
                      <td className="border px-3 py-2">---</td>
                    </tr>
                  );
                })}
              </>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default IntegratedAnalysisTable;