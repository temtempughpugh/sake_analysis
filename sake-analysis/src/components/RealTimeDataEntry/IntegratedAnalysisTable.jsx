// IntegratedAnalysisTable.jsx - 統合分析表の表示
import React, { useMemo } from 'react';

const IntegratedAnalysisTable = ({ currentTankData, selectedModel, selectedPattern }) => {
  // 基準設定の自動取得
  const getBaseSettings = (tankData) => {
    if (!tankData?.dailyData) return null;

    // 最高BMDの検出
    let maxBMD = -Infinity;
    let maxBMDDay = null;

    tankData.dailyData.forEach(d => {
      const bmd = d['BMD(補完)'];
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
    if (!baseSettings || !pattern || !baseSettings.maxBMD || !baseSettings.finalBMD) return null;

    const { maxBMD, maxBMDDay, finalBMD, finalDay } = baseSettings;

    if (!maxBMDDay || !finalDay) return null;

    // 発酵進行度
    const fermentationProgress = ((day - maxBMDDay) / (finalDay - maxBMDDay)) * 100;

    // パターンから進捗率を線形補間で取得
    let progressRate = 0;
    for (let i = 0; i < pattern.data.length - 1; i++) {
      if (pattern.data[i].x <= fermentationProgress && pattern.data[i + 1].x >= fermentationProgress) {
        const ratio = (fermentationProgress - pattern.data[i].x) / (pattern.data[i + 1].x - pattern.data[i].x);
        progressRate = pattern.data[i].y + (pattern.data[i + 1].y - pattern.data[i].y) * ratio;
        break;
      }
    }

    // 理想BMD
    return maxBMD - (maxBMD - finalBMD) * (progressRate / 100);
  };

  // 統合分析データの生成
  const analysisData = useMemo(() => {
    const baseSettings = getBaseSettings(currentTankData);
    if (!baseSettings) return [];

    return currentTankData.dailyData.map(dayData => {
      const idealBMD = calculateIdealBMD(dayData.day, baseSettings, selectedPattern);
      const actualBMD = dayData['BMD(補完)'];
      const difference = idealBMD ? actualBMD - idealBMD : null;
      
      return {
        day: dayData.day,
        temp: dayData['品温1回目'],
        baume: {
          actual: dayData['ボーメ(補完)'],
          predicted: null, // 予測値は後で実装
          difference: null
        },
        alcohol: {
          actual: dayData['アルコール(補完)'],
          change: null // 変動は後で実装
        },
        bmd: {
          actual: actualBMD,
          ideal: idealBMD,
          difference: difference
        },
        isCurrent: dayData.day === currentTankData.currentDay
      };
    });
  }, [currentTankData, selectedPattern]);

  return (
    <div className="mb-6">
      <h3 className="text-lg font-semibold mb-4">統合分析表</h3>
      <div className="overflow-x-auto">
        <table className="min-w-full border border-gray-300">
          <thead className="bg-gray-50">
            <tr>
              <th className="border px-3 py-2 text-left">日数</th>
              <th className="border px-3 py-2 text-left">品温</th>
              <th className="border px-3 py-2 text-left">ボーメ<br />実測/予測/差分</th>
              <th className="border px-3 py-2 text-left">アルコール<br />実測/変動</th>
              <th className="border px-3 py-2 text-left">BMD<br />実測/理想</th>
            </tr>
          </thead>
          <tbody>
            {analysisData.map(data => (
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
                    <div>{!isNaN(data.baume.actual) ? data.baume.actual.toFixed(2) : '---'} / --- / ---</div>
                    {data.isCurrent && <span className="text-blue-600">現在</span>}
                  </div>
                </td>
                <td className="border px-3 py-2">
                  <div className="text-sm">
                    <div>{!isNaN(data.alcohol.actual) ? data.alcohol.actual.toFixed(1) : '---'} / ---</div>
                  </div>
                </td>
                <td className="border px-3 py-2">
                  <div className="text-sm">
                    <div>
                      {!isNaN(data.bmd.actual) ? data.bmd.actual.toFixed(1) : '---'} / 
                      {data.bmd.ideal ? data.bmd.ideal.toFixed(1) : '---'}
                    </div>
                    {data.bmd.difference && (
                      <div className={`text-xs ${data.bmd.difference > 0 ? 'text-red-600' : 'text-green-600'}`}>
                        {data.bmd.difference > 0 ? '↑遅れ' : '↑進み'}
                      </div>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {/* 予測行 */}
            <tr className="bg-gray-100">
              <td className="border px-3 py-2 font-medium">{currentTankData.currentDay + 1}</td>
              <td className="border px-3 py-2">予測</td>
              <td className="border px-3 py-2">--- / 2.05 / ---</td>
              <td className="border px-3 py-2">--- / -0.25</td>
              <td className="border px-3 py-2">---/25.8</td>
            </tr>
            <tr className="bg-gray-100">
              <td className="border px-3 py-2 font-medium">{currentTankData.currentDay + 2}</td>
              <td className="border px-3 py-2">↓</td>
              <td className="border px-3 py-2">--- / 1.82 / ---</td>
              <td className="border px-3 py-2">--- / -0.23</td>
              <td className="border px-3 py-2">---/24.5</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default IntegratedAnalysisTable;