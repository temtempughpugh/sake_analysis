import React, { useState, useMemo, useEffect } from 'react';
import { ChevronUp, ChevronDown } from 'lucide-react';
import { COLUMN_NAMES } from '../utils/csvParser';

const OisuiAnalysis2 = ({ tanks = [], selectedTankIds = [] }) => {
  // パラメータ状態管理（すべて入力可能）
  const [alcoholCoeff, setAlcoholCoeff] = useState(0.64);
  const [targetAlcoholThreshold, setTargetAlcoholThreshold] = useState(15); // アルコール閾値
  const [targetBaume, setTargetBaume] = useState(-1.21);
  const [targetAlcohol, setTargetAlcohol] = useState(18.65);

  // 選択されたタンクのデータを取得
  const selectedTanks = useMemo(() => {
    return Array.isArray(tanks) ? tanks.filter(tank => 
      Array.isArray(selectedTankIds) && selectedTankIds.includes(tank.tankId)
    ) : [];
  }, [tanks, selectedTankIds]);

  // 真のアルコール係数計算関数（DataTableと同じロジック）
  const calculateTrueCoefficientsFromMeta = (tank) => {
    const metadata = tank.metadata || {};
    
    const startBaume = parseFloat(metadata[COLUMN_NAMES.META.AB_START_BAUME]);
    const startAlcohol = parseFloat(metadata[COLUMN_NAMES.META.AB_START_ALCOHOL]);
    const finalBaume = parseFloat(metadata[COLUMN_NAMES.META.FINAL_BAUME]);
    const finalAlcohol = parseFloat(metadata[COLUMN_NAMES.META.FINAL_ALCOHOL]);
    const totalVolume = parseFloat(metadata[COLUMN_NAMES.META.TOTAL_VOLUME]);
    const totalWater = parseFloat(metadata[COLUMN_NAMES.META.TOTAL_WATER]) || 0;
    
    if (isNaN(startBaume) || isNaN(startAlcohol) || isNaN(finalBaume) || isNaN(finalAlcohol) || isNaN(totalVolume)) {
      return { withWater: null, withoutWater: null };
    }
    
    // ①追い水反映（希釈効果を除去）
    const dilutionFactor = (totalVolume + totalWater) / totalVolume;
    const trueFinalBaumeWithWater = finalBaume * dilutionFactor;
    const trueFinalAlcoholWithWater = finalAlcohol * dilutionFactor;
    
    const baumeChangeWithWater = startBaume - trueFinalBaumeWithWater;
    const alcoholChangeWithWater = trueFinalAlcoholWithWater - startAlcohol;
    
    const coefficientWithWater = baumeChangeWithWater > 0 ? 
      alcoholChangeWithWater / baumeChangeWithWater : null;
    
    // ②追い水無視（そのまま）
    const baumeChangeWithoutWater = startBaume - finalBaume;
    const alcoholChangeWithoutWater = finalAlcohol - startAlcohol;
    
    const coefficientWithoutWater = baumeChangeWithoutWater > 0 ? 
      alcoholChangeWithoutWater / baumeChangeWithoutWater : null;
    
    return {
      withWater: coefficientWithWater,
      withoutWater: coefficientWithoutWater
    };
  };

  // アルコール閾値到達日数計算
  const calculateDaysToAlcoholThreshold = (tank, threshold) => {
    const alcoholData = Object.entries(tank.dailyData || {})
      .filter(([day, data]) => parseInt(day) >= 8 && data[COLUMN_NAMES.DAILY.ALCOHOL])
      .map(([day, data]) => ({
        day: parseInt(data[COLUMN_NAMES.DAILY.DAY]),
        alcohol: parseFloat(data[COLUMN_NAMES.DAILY.ALCOHOL])
      }))
      .filter(item => !isNaN(item.day) && !isNaN(item.alcohol))
      .sort((a, b) => a.day - b.day);
    
    if (alcoholData.length < 2) return null;
    
    // 線形補間で閾値到達日を予測
    for (let i = 0; i < alcoholData.length - 1; i++) {
      const current = alcoholData[i];
      const next = alcoholData[i + 1];
      
      if (current.alcohol < threshold && next.alcohol >= threshold) {
        const ratio = (threshold - current.alcohol) / (next.alcohol - current.alcohol);
        return current.day + ratio * (next.day - current.day);
      }
    }
    
    // 最後のデータが閾値未満の場合、外挿で予測
    if (alcoholData.length >= 2) {
      const last = alcoholData[alcoholData.length - 1];
      const secondLast = alcoholData[alcoholData.length - 2];
      const slope = (last.alcohol - secondLast.alcohol) / (last.day - secondLast.day);
      
      if (slope > 0) {
        return last.day + (threshold - last.alcohol) / slope;
      }
    }
    
    return null;
  };

  // 完了日数計算
  const calculateCompletionDays = (tank, currentDay, threshold) => {
    const thresholdDay = calculateDaysToAlcoholThreshold(tank, threshold);
    return thresholdDay ? Math.max(0, Math.ceil(thresholdDay - currentDay)) : 12;
  };

  // その日時点での真のアルコール係数を計算（追い水反映）
  const calculateDailyTrueAlcoholCoeff = (tank, currentDay, cumulativeWater) => {
    const metadata = tank.metadata || {};
    const totalVolume = parseFloat(metadata[COLUMN_NAMES.META.TOTAL_VOLUME]) || 3000;
    
    // AB開始データ
    const startBaume = parseFloat(metadata[COLUMN_NAMES.META.AB_START_BAUME]);
    const startAlcohol = parseFloat(metadata[COLUMN_NAMES.META.AB_START_ALCOHOL]);
    
    // 現在日のデータ
    const currentDayData = Object.entries(tank.dailyData || {}).find(([dayKey, dayData]) => {
      return parseInt(dayData[COLUMN_NAMES.DAILY.DAY]) === currentDay;
    });
    
    if (!currentDayData || isNaN(startBaume) || isNaN(startAlcohol)) {
      return null;
    }
    
    const [, dayData] = currentDayData;
    const currentBaume = parseFloat(dayData[COLUMN_NAMES.DAILY.BAUME_BMD_DAY]);
    const currentAlcohol = parseFloat(dayData[COLUMN_NAMES.DAILY.ALCOHOL]);
    
    if (isNaN(currentBaume) || isNaN(currentAlcohol)) {
      return null;
    }
    
    // 希釈効果を除去（追い水反映）
    const dilutionFactor = (totalVolume + cumulativeWater) / totalVolume;
    const trueBaume = currentBaume * dilutionFactor;
    const trueAlcohol = currentAlcohol * dilutionFactor;
    
    // 真のアルコール係数計算
    const baumeChange = startBaume - trueBaume;
    const alcoholChange = trueAlcohol - startAlcohol;
    
    return baumeChange > 0 ? alcoholChange / baumeChange : null;
  };

  // selectedTankIds変更時に自動でパラメータ更新
  useEffect(() => {
    if (selectedTanks.length > 0) {
      const firstTank = selectedTanks[0];
      const defaultTargetBaume = parseFloat(firstTank.metadata?.[COLUMN_NAMES.META.FINAL_BAUME]) || -1.21;
      const defaultTargetAlcohol = parseFloat(firstTank.metadata?.[COLUMN_NAMES.META.FINAL_ALCOHOL]) || 18.65;
      const defaultAlcoholCoeff = calculateTrueCoefficientsFromMeta(firstTank)?.withWater || 0.64;
      
      setTargetBaume(defaultTargetBaume);
      setTargetAlcohol(defaultTargetAlcohol);
      setAlcoholCoeff(defaultAlcoholCoeff);
    }
  }, [selectedTankIds]);

  // デフォルト値設定
  const setDefaultValues = () => {
    if (selectedTanks.length === 0) return;
    
    const firstTank = selectedTanks[0];
    const defaultTargetBaume = parseFloat(firstTank.metadata?.[COLUMN_NAMES.META.FINAL_BAUME]) || -1.21;
    const defaultTargetAlcohol = parseFloat(firstTank.metadata?.[COLUMN_NAMES.META.FINAL_ALCOHOL]) || 18.65;
    const defaultAlcoholCoeff = calculateTrueCoefficientsFromMeta(firstTank)?.withWater || 0.64;
    
    setTargetBaume(defaultTargetBaume);
    setTargetAlcohol(defaultTargetAlcohol);
    setAlcoholCoeff(defaultAlcoholCoeff);
  };

  // 8日目以降のデータ処理
  const analysisData = useMemo(() => {
    if (selectedTanks.length === 0) return [];

    const results = [];

    selectedTanks.forEach(tank => {
      const tankNumber = tank.metadata?.[COLUMN_NAMES.META.TANK_NUMBER] || tank.tankId;
      const batchSize = tank.metadata?.[COLUMN_NAMES.META.BATCH_SIZE] || '-';
      const totalVolume = parseFloat(tank.metadata?.[COLUMN_NAMES.META.TOTAL_VOLUME]) || 3000;

      // 累積追い水量を計算
      let cumulativeWater = 0;

      Object.entries(tank.dailyData || {}).forEach(([dayKey, dayData]) => {
        const day = parseInt(dayData[COLUMN_NAMES.DAILY.DAY]);
        if (day < 8) {
          const water = parseFloat(dayData[COLUMN_NAMES.DAILY.WATER]) || 0;
          cumulativeWater += water;
          return;
        }

        // 8日目以降のデータ処理
        const currentBaume = parseFloat(dayData[COLUMN_NAMES.DAILY.BAUME_BMD_DAY]);
        const currentAlcohol = parseFloat(dayData[COLUMN_NAMES.DAILY.ALCOHOL]);
        const temp1 = parseFloat(dayData[COLUMN_NAMES.DAILY.TEMP_1]);
        const tempChange = parseFloat(dayData[COLUMN_NAMES.DAILY.TEMP_CHANGE]);
        const tempUpDown = dayData[COLUMN_NAMES.DAILY.TEMP_UP_DOWN] || '';
        const actualWater = parseFloat(dayData[COLUMN_NAMES.DAILY.WATER]) || 0;

        if (isNaN(currentBaume) || isNaN(currentAlcohol)) return;

        // その日時点での真のアルコール係数を計算（追い水反映）
        const dailyTrueCoeff = calculateDailyTrueAlcoholCoeff(tank, day, cumulativeWater);

        // 追い水計算
        const remainingBaume = currentBaume - targetBaume;
        const predictedAlcoholIncrease = remainingBaume * alcoholCoeff;
        const predictedFinalAlcohol = currentAlcohol + predictedAlcoholIncrease;
        
        let requiredTotalWater = 0;
        let theoreticalWater = 0;

        if (predictedFinalAlcohol > targetAlcohol) {
          // 容量は仕込み総量固定（累積追い水量は考慮しない）
          const currentVolume = totalVolume;
          
          const dilutionRatio = targetAlcohol / predictedFinalAlcohol;
          const requiredFinalVolume = currentVolume / dilutionRatio;
          requiredTotalWater = requiredFinalVolume - currentVolume;

          // 完了日数計算
          const remainingDays = calculateCompletionDays(tank, day, targetAlcoholThreshold);
          
          if (remainingDays <= 0) {
            theoreticalWater = requiredTotalWater; // 総量をそのまま
          } else {
            theoreticalWater = requiredTotalWater / remainingDays * 2; // 1回分
          }
        }

        const analysisItem = {
          tankId: tank.tankId,
          tankNumber,
          day,
          batchSize,
          temp1,
          tempChange,
          tempUpDown,
          currentBaume,
          currentAlcohol,
          remainingBaume,
          predictedAlcoholIncrease,
          predictedFinalAlcohol,
          dailyTrueCoeff,
          cumulativeWater,
          requiredTotalWater,
          theoreticalWater,
          actualWater
        };

        results.push(analysisItem);
        
        // 今日の追い水を累積に追加
        cumulativeWater += actualWater;
      });
    });

    return results.sort((a, b) => {
      if (a.tankNumber !== b.tankNumber) return a.tankNumber - b.tankNumber;
      return a.day - b.day;
    });
  }, [selectedTanks, alcoholCoeff, targetBaume, targetAlcohol, targetAlcoholThreshold]);

  const formatNumber = (value, decimals = 2) => {
    if (value === null || value === undefined || isNaN(value)) return '-';
    return Number(value).toFixed(decimals);
  };

  const getTempClass = (temp) => {
    if (temp < 6) return 'text-blue-600';
    if (temp > 15) return 'text-red-600';
    return '';
  };

  const getUpDownSymbol = (upDown) => {
    if (!upDown) return '-';
    if (upDown === '上') return '↑';
    if (upDown === '下') return '↓';
    return upDown;
  };

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-lg shadow">
        <h2 className="text-xl font-bold mb-4 text-gray-800">🌾 8日目以降 追い水計算検証</h2>
        
        {/* 計算パラメータ設定 */}
        <div className="bg-blue-50 p-4 rounded-lg mb-6">
          <h3 className="text-lg font-semibold mb-4">🔧 計算パラメータ設定</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                アルコール係数
              </label>
              <input
                type="number"
                step="0.001"
                value={alcoholCoeff || ''}
                onChange={(e) => setAlcoholCoeff(e.target.value === '' ? 0 : parseFloat(e.target.value))}
                className="w-full p-2 border border-gray-300 rounded text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                アルコール度数が
                <input
                  type="number"
                  step="0.1"
                  value={targetAlcoholThreshold || ''}
                  onChange={(e) => setTargetAlcoholThreshold(e.target.value === '' ? 0 : parseFloat(e.target.value))}
                  className="w-16 mx-1 p-1 border border-gray-300 rounded text-xs"
                />
                % 超える日数
              </label>
              <div className="text-sm text-gray-600 mt-1">
                {selectedTanks.length > 0 && calculateDaysToAlcoholThreshold(selectedTanks[0], targetAlcoholThreshold) ? 
                  Math.ceil(calculateDaysToAlcoholThreshold(selectedTanks[0], targetAlcoholThreshold)) + '日' : '-'}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                目標ボーメ
              </label>
              <input
                type="number"
                step="0.1"
                value={targetBaume || ''}
                onChange={(e) => setTargetBaume(e.target.value === '' ? 0 : parseFloat(e.target.value))}
                className="w-full p-2 border border-gray-300 rounded text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                目標アルコール
              </label>
              <input
                type="number"
                step="0.1"
                value={targetAlcohol || ''}
                onChange={(e) => setTargetAlcohol(e.target.value === '' ? 0 : parseFloat(e.target.value))}
                className="w-full p-2 border border-gray-300 rounded text-sm"
              />
            </div>
          </div>
          <button
            onClick={setDefaultValues}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
          >
            デフォルト値設定
          </button>
        </div>

        {/* 検証テーブル */}
        {analysisData.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse border border-gray-300 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="border border-gray-300 p-2 text-sm font-medium">タンク番号</th>
                  <th className="border border-gray-300 p-2 text-sm font-medium">日数</th>
                  <th className="border border-gray-300 p-2 text-sm font-medium">仕込み規模</th>
                  <th className="border border-gray-300 p-2 text-sm font-medium">品温1回</th>
                  <th className="border border-gray-300 p-2 text-sm font-medium">品温変動</th>
                  <th className="border border-gray-300 p-2 text-sm font-medium">品温上下</th>
                  <th className="border border-gray-300 p-2 text-sm font-medium">現在ボーメ</th>
                  <th className="border border-gray-300 p-2 text-sm font-medium">現在アルコール</th>
                  <th className="border border-gray-300 p-2 text-sm font-medium">残存ボーメ</th>
                  <th className="border border-gray-300 p-2 text-sm font-medium">予想アルコール増加</th>
                  <th className="border border-gray-300 p-2 text-sm font-medium">予想最終アルコール</th>
                  <th className="border border-gray-300 p-2 text-sm font-medium">真のアルコール係数</th>
                  <th className="border border-gray-300 p-2 text-sm font-medium">累積追い水量</th>
                  <th className="border border-gray-300 p-2 text-sm font-medium">必要追い水量(総量)</th>
                  <th className="border border-gray-300 p-2 text-sm font-medium">理論追い水量(1回分)</th>
                  <th className="border border-gray-300 p-2 text-sm font-medium">実際追い水量</th>
                </tr>
              </thead>
              <tbody>
                {analysisData.map((data, index) => (
                  <tr key={`${data.tankId}-${data.day}-${index}`} className="hover:bg-gray-50">
                    <td className="border border-gray-300 p-2 text-center font-medium">{data.tankNumber}</td>
                    <td className="border border-gray-300 p-2 text-center">{data.day}</td>
                    <td className="border border-gray-300 p-2 text-center">{data.batchSize}</td>
                    <td className={`border border-gray-300 p-2 text-center ${getTempClass(data.temp1)}`}>
                      {formatNumber(data.temp1, 1)}
                    </td>
                    <td className="border border-gray-300 p-2 text-center">{formatNumber(data.tempChange, 1)}</td>
                    <td className="border border-gray-300 p-2 text-center">{getUpDownSymbol(data.tempUpDown)}</td>
                    <td className="border border-gray-300 p-2 text-center">{formatNumber(data.currentBaume, 2)}</td>
                    <td className="border border-gray-300 p-2 text-center">{formatNumber(data.currentAlcohol, 1)}</td>
                    <td className="border border-gray-300 p-2 text-center">{formatNumber(data.remainingBaume, 2)}</td>
                    <td className="border border-gray-300 p-2 text-center">{formatNumber(data.predictedAlcoholIncrease, 2)}</td>
                    <td className="border border-gray-300 p-2 text-center font-medium">{formatNumber(data.predictedFinalAlcohol, 1)}</td>
                    <td className="border border-gray-300 p-2 text-center bg-orange-50">
                      {data.dailyTrueCoeff !== null ? formatNumber(data.dailyTrueCoeff, 3) : '-'}
                    </td>
                    <td className="border border-gray-300 p-2 text-center bg-purple-50">
                      {formatNumber(data.cumulativeWater, 0)}
                    </td>
                    <td className="border border-gray-300 p-2 text-center bg-yellow-50 font-medium">
                      {formatNumber(data.requiredTotalWater, 0)}
                    </td>
                    <td className="border border-gray-300 p-2 text-center bg-green-50">
                      {formatNumber(data.theoreticalWater, 0)}
                    </td>
                    <td className="border border-gray-300 p-2 text-center bg-blue-50">
                      {formatNumber(data.actualWater, 0)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500">
            8日目以降のデータがある選択されたタンクがありません
          </div>
        )}
      </div>
    </div>
  );
};

export default OisuiAnalysis2;