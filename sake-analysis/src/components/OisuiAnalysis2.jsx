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
    
    const coefficientWithWater = baumeChangeWithWater > 0 ? alcoholChangeWithWater / baumeChangeWithWater : null;
    
    return {
      withWater: coefficientWithWater,
      withoutWater: null
    };
  };

  // アルコール閾値到達日数計算
  const calculateDaysToAlcoholThreshold = (tank, threshold) => {
    const alcoholData = Object.entries(tank.dailyData || {})
      .filter(([day, data]) => parseInt(day) >= 8 && data[COLUMN_NAMES.DAILY.ALCOHOL])
      .map(([day, data]) => ({
        day: parseInt(day),
        alcohol: parseFloat(data[COLUMN_NAMES.DAILY.ALCOHOL])
      }))
      .sort((a, b) => a.day - b.day);
      
    if (alcoholData.length < 2) return null;
    
    // 既に閾値を超えている場合は最初のデータの日数を返す
    const firstData = alcoholData[0];
    if (firstData.alcohol >= threshold) return firstData.day;
    
    // 線形補間で閾値到達日を予測
    for (let i = 0; i < alcoholData.length - 1; i++) {
      const current = alcoholData[i];
      const next = alcoholData[i + 1];
      
      if (current.alcohol < threshold && next.alcohol >= threshold) {
        const ratio = (threshold - current.alcohol) / (next.alcohol - current.alcohol);
        const targetDay = current.day + ratio * (next.day - current.day);
        return Math.ceil(targetDay);
      }
    }
    
    // まだ到達していない場合は線形外挿で予測
    const lastData = alcoholData[alcoholData.length - 1];
    const secondLast = alcoholData[alcoholData.length - 2];
    const rate = (lastData.alcohol - secondLast.alcohol) / (lastData.day - secondLast.day);
    
    if (rate > 0) {
      const predictedDay = lastData.day + (threshold - lastData.alcohol) / rate;
      return Math.ceil(predictedDay);
    }
    
    return null;
  };

  // 完了日数計算（現在の分析日から閾値到達日までの残り日数）
  const calculateCompletionDays = (tank, currentDay, threshold) => {
    const thresholdDay = calculateDaysToAlcoholThreshold(tank, threshold);
    if (!thresholdDay || currentDay >= thresholdDay) return 0;
    return thresholdDay - currentDay;
  };

  // selectedTankIds変更時に自動でパラメータ更新
  useEffect(() => {
    if (selectedTanks.length > 0) {
      const firstTank = selectedTanks[0];
      const defaultTargetBaume = parseFloat(firstTank.metadata?.[COLUMN_NAMES.META.FINAL_BAUME]) || -1.21;
      const defaultTargetAlcohol = parseFloat(firstTank.metadata?.[COLUMN_NAMES.META.FINAL_ALCOHOL]) || 18.65;
      
      // 真のアルコール係数①を計算で取得
      const trueCoefficients = calculateTrueCoefficientsFromMeta(firstTank);
      const defaultAlcoholCoeff = trueCoefficients.withWater || 0.64;
      
      setTargetBaume(defaultTargetBaume);
      setTargetAlcohol(defaultTargetAlcohol);
      setAlcoholCoeff(defaultAlcoholCoeff);
    }
  }, [selectedTankIds]); // selectedTankIds変更時に自動実行

  // デフォルト値設定（手動トリガー用）
  const setDefaultValues = () => {
    if (selectedTanks.length === 0) return;
    
    const firstTank = selectedTanks[0];
    const defaultTargetBaume = parseFloat(firstTank.metadata?.[COLUMN_NAMES.META.FINAL_BAUME]) || -1.21;
    const defaultTargetAlcohol = parseFloat(firstTank.metadata?.[COLUMN_NAMES.META.FINAL_ALCOHOL]) || 18.65;
    
    // 真のアルコール係数①を計算で取得
    const trueCoefficients = calculateTrueCoefficientsFromMeta(firstTank);
    const defaultAlcoholCoeff = trueCoefficients.withWater || 0.64;
    
    setTargetBaume(defaultTargetBaume);
    setTargetAlcohol(defaultTargetAlcohol);
    setAlcoholCoeff(defaultAlcoholCoeff);
  };

  // 8日目以降の分析データ作成
  const analysisData = useMemo(() => {
    const results = [];

    selectedTanks.forEach(tank => {
      const tankId = tank.tankId;
      const batchSize = parseFloat(tank.metadata?.[COLUMN_NAMES.META.BATCH_SIZE]) || null;
      const tankNumber = tank.metadata?.[COLUMN_NAMES.META.TANK_NUMBER] || tankId;
      const totalVolume = parseFloat(tank.metadata?.[COLUMN_NAMES.META.TOTAL_VOLUME]) || 3000;

      if (!tank.dailyData || !batchSize) return;

      // 現在の累積追い水量を計算
      let cumulativeWater = 0;
      
      // 8日目以降のデータを処理
      Object.entries(tank.dailyData).forEach(([dayKey, dayData]) => {
        const day = parseInt(dayData[COLUMN_NAMES.DAILY.DAY]);
        if (day < 8) {
          // 8日目より前の追い水を累積
          const water = parseFloat(dayData[COLUMN_NAMES.DAILY.WATER]) || 0;
          cumulativeWater += water;
          return;
        }

        // 8日目以降のデータ処理
        const currentBaume = parseFloat(dayData[COLUMN_NAMES.DAILY.BAUME_BMD_DAY]);
        const currentAlcohol = parseFloat(dayData[COLUMN_NAMES.DAILY.ALCOHOL]);
        const actualWater = parseFloat(dayData[COLUMN_NAMES.DAILY.WATER]) || 0;
        const temp1 = parseFloat(dayData[COLUMN_NAMES.DAILY.TEMP_1]);
        const tempChange = parseFloat(dayData[COLUMN_NAMES.DAILY.TEMP_CHANGE]);
        const tempUpDown = dayData[COLUMN_NAMES.DAILY.TEMP_UP_DOWN] || '';

        if (currentBaume === null || isNaN(currentBaume) || 
            currentAlcohol === null || isNaN(currentAlcohol)) return;

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
          
          // 完了日数計算（現在の分析日から閾値到達日までの残り日数）
          const remainingDays = calculateCompletionDays(tank, day, targetAlcoholThreshold);
          
          // アルコール閾値を既に超えている場合は総量を表示、そうでなければ1回分を計算
          if (remainingDays <= 0) {
            theoreticalWater = requiredTotalWater; // 総量を表示
          } else {
            theoreticalWater = requiredTotalWater / remainingDays * 2; // 1回分
          }
        }

        results.push({
          tankId,
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
          cumulativeWater, // 累積追い水量を表に表示
          requiredTotalWater,
          theoreticalWater,
          actualWater
        });

        // 今日の追い水を累積に追加
        cumulativeWater += actualWater;
      });
    });

    return results.sort((a, b) => a.tankNumber - b.tankNumber || a.day - b.day);
  }, [selectedTanks, alcoholCoeff, targetAlcoholThreshold, targetBaume, targetAlcohol]);

  const formatNumber = (value, decimals = 2) => {
    if (value === null || value === undefined || isNaN(value)) return '-';
    return Number(value).toFixed(decimals);
  };

  const getTempClass = (temp) => {
    if (temp === null || temp === undefined || isNaN(temp)) return '';
    if (temp >= 12) return 'bg-red-100 text-red-800';
    if (temp >= 10) return 'bg-yellow-100 text-yellow-800';
    if (temp >= 8) return 'bg-green-100 text-green-800';
    return 'bg-blue-100 text-blue-800';
  };

  const getUpDownSymbol = (upDown) => {
    if (!upDown || upDown === '') return '-';
    if (upDown === '上' || upDown === '↑') return <span className="text-red-600 font-bold">↑</span>;
    if (upDown === '下' || upDown === '↓') return <span className="text-blue-600 font-bold">↓</span>;
    return <span className="text-gray-500">→</span>;
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
        <h2 className="text-2xl font-bold text-gray-800 mb-4">🌾 8日目以降 追い水計算検証</h2>
        
        {/* パラメータ設定パネル */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold text-blue-800">🔧 計算パラメータ設定</h3>
            <button
              onClick={setDefaultValues}
              className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
            >
              デフォルト値設定
            </button>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                アルコール係数
              </label>
              <input
                type="number"
                step="0.01"
                min="0.1"
                max="2.0"
                value={alcoholCoeff === 0 ? '' : alcoholCoeff}
                onChange={(e) => setAlcoholCoeff(e.target.value === '' ? 0 : parseFloat(e.target.value))}
                className="w-full px-2 py-1 border rounded text-sm"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                アルコール度数が <input
                  type="number"
                  step="0.1"
                  min="10"
                  max="25"
                  value={targetAlcoholThreshold === 0 ? '' : targetAlcoholThreshold}
                  onChange={(e) => setTargetAlcoholThreshold(e.target.value === '' ? 0 : parseFloat(e.target.value))}
                  className="inline-block w-16 px-1 py-0.5 border rounded text-xs mx-1"
                />% 超える日数
              </label>
              <div className="text-sm text-gray-600 bg-gray-50 px-2 py-1 rounded">
                {selectedTanks.length > 0 && selectedTanks[0] ? 
                  `${calculateDaysToAlcoholThreshold(selectedTanks[0], targetAlcoholThreshold) || '-'}日`
                  : '-'}
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                目標ボーメ
              </label>
              <input
                type="number"
                step="0.1"
                value={targetBaume === 0 ? '' : targetBaume}
                onChange={(e) => setTargetBaume(e.target.value === '' ? 0 : parseFloat(e.target.value))}
                className="w-full px-2 py-1 border rounded text-sm"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                目標アルコール (%)
              </label>
              <input
                type="number"
                step="0.1"
                min="10"
                max="25"
                value={targetAlcohol === 0 ? '' : targetAlcohol}
                onChange={(e) => setTargetAlcohol(e.target.value === '' ? 0 : parseFloat(e.target.value))}
                className="w-full px-2 py-1 border rounded text-sm"
              />
            </div>
          </div>
        </div>

        {/* 検証テーブル */}
        {analysisData.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full border border-gray-300">
              <thead className="bg-gray-50">
                <tr>
                  <th className="border border-gray-300 p-2 text-sm font-medium">タンク</th>
                  <th className="border border-gray-300 p-2 text-sm font-medium">日数</th>
                  <th className="border border-gray-300 p-2 text-sm font-medium">仕込み規模</th>
                  <th className="border border-gray-300 p-2 text-sm font-medium">品温1回</th>
                  <th className="border border-gray-300 p-2 text-sm font-medium">品温変動</th>
                  <th className="border border-gray-300 p-2 text-sm font-medium">品温上下</th>
                  <th className="border border-gray-300 p-2 text-sm font-medium">現在ボーメ</th>
                  <th className="border border-gray-300 p-2 text-sm font-medium">現在アルコール</th>
                  <th className="border border-gray-300 p-2 text-sm font-medium">残存ボーメ</th>
                  <th className="border border-gray-300 p-2 text-sm font-medium">予想増加アルコール</th>
                  <th className="border border-gray-300 p-2 text-sm font-medium">予想最終アルコール</th>
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