import React, { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { Save, Database, TrendingUp, Droplets, Thermometer, FolderOpen, Trash2, Edit2 } from 'lucide-react';
import ProgressModeling from './ProgressModeling';
import OisuiAnalysis from './OisuiAnalysis';
import OisuiAnalysis2 from './OisuiAnalysis2';
import TemperatureAnalysis from './TemperatureAnalysis';
import { COLUMN_NAMES } from '../utils/csvParser';

// OisuiAnalysis2の機能を統合モデリング用に再実装
const OisuiAnalysis2Integration = ({ tanks, selectedTankIds, params, onParamsChange }) => {
  const selectedTanks = useMemo(() => 
    tanks.filter(tank => selectedTankIds.includes(tank.tankId)),
    [tanks, selectedTankIds]
  );

  // アルコール閾値を超える日数を計算
  const calculateDaysToAlcoholThreshold = (tank, threshold) => {
    if (!tank.dailyData || !threshold) return null;
    
    const entries = Object.entries(tank.dailyData || {})
      .map(([key, data]) => ({
        day: parseInt(data[COLUMN_NAMES.DAILY.DAY]),
        alcohol: parseFloat(data[COLUMN_NAMES.DAILY.ALCOHOL])
      }))
      .filter(d => d.day >= 8 && !isNaN(d.alcohol))
      .sort((a, b) => a.day - b.day);
    
    for (const entry of entries) {
      if (entry.alcohol >= threshold) {
        return entry.day;
      }
    }
    return null;
  };

  // デフォルト値設定
  const setDefaultValues = () => {
    if (selectedTanks.length === 0) return;
    
    const firstTank = selectedTanks[0];
    const metadata = firstTank.metadata || {};
    
    // 真のアルコール係数を計算
    const calculateTrueCoefficient = (tank) => {
      const metadata = tank.metadata || {};
      const startBaume = parseFloat(metadata[COLUMN_NAMES.META.AB_START_BAUME]);
      const startAlcohol = parseFloat(metadata[COLUMN_NAMES.META.AB_START_ALCOHOL]);
      const finalBaume = parseFloat(metadata[COLUMN_NAMES.META.FINAL_BAUME]);
      const finalAlcohol = parseFloat(metadata[COLUMN_NAMES.META.FINAL_ALCOHOL]);
      const totalVolume = parseFloat(metadata[COLUMN_NAMES.META.TOTAL_VOLUME]);
      const totalWater = parseFloat(metadata[COLUMN_NAMES.META.TOTAL_WATER]) || 0;
      
      if (isNaN(startBaume) || isNaN(startAlcohol) || isNaN(finalBaume) || isNaN(finalAlcohol) || isNaN(totalVolume)) {
        return 0.64;
      }
      
      const dilutionFactor = (totalVolume + totalWater) / totalVolume;
      const trueFinalBaume = finalBaume * dilutionFactor;
      const trueFinalAlcohol = finalAlcohol * dilutionFactor;
      const baumeChange = startBaume - trueFinalBaume;
      const alcoholChange = trueFinalAlcohol - startAlcohol;
      
      return baumeChange > 0 ? alcoholChange / baumeChange : 0.64;
    };
    
    onParamsChange({
      alcoholCoeff: calculateTrueCoefficient(firstTank),
      targetAlcoholThreshold: 15,
      targetBaume: parseFloat(metadata[COLUMN_NAMES.META.FINAL_BAUME]) || -1.21,
      targetAlcohol: parseFloat(metadata[COLUMN_NAMES.META.FINAL_ALCOHOL]) || 18.65
    });
  };

  // 完了日数計算
  const calculateCompletionDays = (tank, currentDay, threshold) => {
    if (!tank.dailyData || !threshold) return 0;
    
    const futureEntries = Object.entries(tank.dailyData || {})
      .map(([key, data]) => ({
        day: parseInt(data[COLUMN_NAMES.DAILY.DAY]),
        alcohol: parseFloat(data[COLUMN_NAMES.DAILY.ALCOHOL])
      }))
      .filter(d => d.day > currentDay && !isNaN(d.alcohol))
      .sort((a, b) => a.day - b.day);
    
    for (const entry of futureEntries) {
      if (entry.alcohol >= threshold) {
        return entry.day - currentDay;
      }
    }
    
    return 0;
  };

  // 計算関数（OisuiAnalysis2から移植）
  const calculateAnalysisData = useMemo(() => {
    const analysisData = [];
    
    selectedTanks.forEach(tank => {
      const tankNumber = tank.metadata?.[COLUMN_NAMES.META.TANK_NUMBER] || tank.tankId;
      const batchSize = parseFloat(tank.metadata?.[COLUMN_NAMES.META.BATCH_SIZE]) || 0;
      const totalVolume = parseFloat(tank.metadata?.[COLUMN_NAMES.META.TOTAL_VOLUME]) || 0;
      
      let cumulativeWater = 0;
      
      // 日別データを処理
      const dailyEntries = Object.entries(tank.dailyData || {})
        .map(([dayKey, dayData]) => ({
          day: parseInt(dayData[COLUMN_NAMES.DAILY.DAY]),
          ...dayData
        }))
        .filter(d => d.day >= 8)
        .sort((a, b) => a.day - b.day);
      
      dailyEntries.forEach((dayData) => {
        const currentBaume = parseFloat(dayData[COLUMN_NAMES.DAILY.BAUME_BMD_DAY]);
        const currentAlcohol = parseFloat(dayData[COLUMN_NAMES.DAILY.ALCOHOL]);
        const temp1 = parseFloat(dayData[COLUMN_NAMES.DAILY.TEMP_1]);
        const tempChange = parseFloat(dayData[COLUMN_NAMES.DAILY.TEMP_CHANGE]);
        const tempUpDown = dayData[COLUMN_NAMES.DAILY.TEMP_UP_DOWN];
        const actualWater = parseFloat(dayData[COLUMN_NAMES.DAILY.WATER]) || 0;
        
        if (!isNaN(currentBaume) && !isNaN(currentAlcohol)) {
          const remainingBaume = currentBaume - params.targetBaume;
          const predictedAlcoholIncrease = remainingBaume * params.alcoholCoeff;
          const predictedFinalAlcohol = currentAlcohol + predictedAlcoholIncrease;
          
          // 追い水量計算
          let requiredTotalWater = 0;
          let theoreticalWater = 0;
          
          if (predictedFinalAlcohol > params.targetAlcohol) {
            const currentVolume = totalVolume;
            const dilutionRatio = params.targetAlcohol / predictedFinalAlcohol;
            const requiredFinalVolume = currentVolume / dilutionRatio;
            requiredTotalWater = requiredFinalVolume - currentVolume;
            
            const remainingDays = calculateCompletionDays(tank, dayData.day, params.targetAlcoholThreshold);
            
            if (remainingDays <= 0) {
              theoreticalWater = requiredTotalWater;
            } else {
              theoreticalWater = requiredTotalWater / remainingDays * 2; // 1回分
            }
          }
          
          // 真のアルコール係数（日次）
          const dailyBaumeChange = parseFloat(dayData[COLUMN_NAMES.DAILY.BAUME_CHANGE]);
          const dailyAlcoholChange = parseFloat(dayData[COLUMN_NAMES.DAILY.ALCOHOL_CHANGE]);
          const dailyTrueCoeff = (!isNaN(dailyBaumeChange) && dailyBaumeChange !== 0) ? 
            dailyAlcoholChange / Math.abs(dailyBaumeChange) : null;
          
          analysisData.push({
            tankId: tank.tankId,
            tankNumber,
            day: dayData.day,
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
          });
          
          cumulativeWater += actualWater;
        }
      });
    });
    
    return analysisData.sort((a, b) => {
      if (a.tankNumber !== b.tankNumber) return a.tankNumber - b.tankNumber;
      return a.day - b.day;
    });
  }, [selectedTanks, params]);

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
                value={params.alcoholCoeff || ''}
                onChange={(e) => onParamsChange({
                  ...params,
                  alcoholCoeff: e.target.value === '' ? 0 : parseFloat(e.target.value)
                })}
                className="w-full p-2 border border-gray-300 rounded text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                アルコール度数が
                <input
                  type="number"
                  step="0.1"
                  value={params.targetAlcoholThreshold || ''}
                  onChange={(e) => onParamsChange({
                    ...params,
                    targetAlcoholThreshold: e.target.value === '' ? 0 : parseFloat(e.target.value)
                  })}
                  className="w-16 mx-1 p-1 border border-gray-300 rounded text-xs"
                />
                % 超える日数
              </label>
              <div className="text-sm text-gray-600 mt-1">
                {selectedTanks.length > 0 && calculateDaysToAlcoholThreshold(selectedTanks[0], params.targetAlcoholThreshold) ? 
                  Math.ceil(calculateDaysToAlcoholThreshold(selectedTanks[0], params.targetAlcoholThreshold)) + '日' : '-'}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                目標ボーメ
              </label>
              <input
                type="number"
                step="0.1"
                value={params.targetBaume || ''}
                onChange={(e) => onParamsChange({
                  ...params,
                  targetBaume: e.target.value === '' ? 0 : parseFloat(e.target.value)
                })}
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
                value={params.targetAlcohol || ''}
                onChange={(e) => onParamsChange({
                  ...params,
                  targetAlcohol: e.target.value === '' ? 0 : parseFloat(e.target.value)
                })}
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
        {calculateAnalysisData.length > 0 ? (
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
                {calculateAnalysisData.map((data, index) => (
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

const IntegratedModeling = ({ tanks = [], selectedTankIds = [] }) => {
  const selectedTanks = useMemo(() => 
    tanks.filter(tank => selectedTankIds.includes(tank.tankId)),
    [tanks, selectedTankIds]
  );

  // タブの状態管理
  const [activeTab, setActiveTab] = useState('progress');
  
  // モデル管理の状態
  const [modelName, setModelName] = useState('');
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [showModelList, setShowModelList] = useState(false);
  
  // 保存済みモデルの状態管理
  const [savedModels, setSavedModels] = useState(() => {
    const saved = localStorage.getItem('integratedModels');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        // 古い形式（オブジェクト）から新しい形式（配列）への移行
        if (!Array.isArray(parsed)) {
          return [];
        }
        return parsed;
      } catch (e) {
        console.error('Failed to parse saved models:', e);
        return [];
      }
    }
    return [];
  });
  
  // 現在読み込んでいるモデルのID
  const [loadedModelId, setLoadedModelId] = useState(null);
  
  // 現在のモード（edit: 編集モード、view: 読み込みモード）
  const [mode, setMode] = useState('edit');
  
  // 読み込んだモデルのデータ
  const [loadedModelData, setLoadedModelData] = useState(null);
  
  // OisuiAnalysis2のパラメータ（編集可能）
  const [oisui2EditParams, setOisui2EditParams] = useState({
    alcoholCoeff: 0.64,
    targetAlcoholThreshold: 15,
    targetBaume: -1.21,
    targetAlcohol: 18.65
  });
  
  // 選択タンクが変更されたら初期パラメータを設定（初回のみ）
  const [isParamsInitialized, setIsParamsInitialized] = useState(false);
  
  useEffect(() => {
    if (isParamsInitialized) return; // 既に初期化済みならスキップ
    
    const selectedTanksData = tanks.filter(tank => selectedTankIds.includes(tank.tankId));
    if (selectedTanksData.length === 0) return;
    
    const firstTank = selectedTanksData[0];
    const defaultTargetBaume = firstTank?.metadata?.[COLUMN_NAMES.META.FINAL_BAUME] || -1.21;
    const defaultTargetAlcohol = firstTank?.metadata?.[COLUMN_NAMES.META.FINAL_ALCOHOL] || 18.65;
    
    // 真のアルコール係数を計算
    const calculateTrueCoefficient = (tank) => {
      const nominalCoeff = tank.metadata?.[COLUMN_NAMES.META.ALCOHOL_COEFFICIENT] || 0.64;
      const avgWater = tank.metadata?.[COLUMN_NAMES.META.AVG_WATER_PER_DAY] || 0;
      const halfWaterRate = tank.metadata?.[COLUMN_NAMES.META.FIRST_HALF_WATER_RATE] || 0.5;
      const avgBaume = tank.metadata?.[COLUMN_NAMES.META.AVG_BAUME_BMD] || 1;
      
      if (avgBaume === 0) return nominalCoeff;
      
      const trueCoeffWithWater = nominalCoeff * (1 + (avgWater * (1 - halfWaterRate)) / avgBaume);
      return trueCoeffWithWater;
    };
    
    const defaultAlcoholCoeff = calculateTrueCoefficient(firstTank);
    
    setOisui2EditParams({
      alcoholCoeff: defaultAlcoholCoeff,
      targetAlcoholThreshold: 15,
      targetBaume: defaultTargetBaume,
      targetAlcohol: defaultTargetAlcohol
    });
    
    setIsParamsInitialized(true);
  }, [tanks, selectedTankIds, isParamsInitialized]);

  // 分析データを取得
  const getAnalysisData = useCallback(() => {
    // 進捗モデリングのデータを計算
    const calculateProgressData = () => {
      const tankAnalysis = [];
      
      selectedTanks.forEach(tank => {
        if (!tank.dailyData) return;
        
        const bmdData = [];
        Object.entries(tank.dailyData).forEach(([dayKey, dayData]) => {
          const day = parseInt(dayData[COLUMN_NAMES.DAILY.DAY]);
          const bmd = parseFloat(dayData[COLUMN_NAMES.DAILY.BMD]);
          if (!isNaN(day) && !isNaN(bmd)) {
            bmdData.push({ day, bmd });
          }
        });
        
        if (bmdData.length === 0) return;
        
        // ソート
        bmdData.sort((a, b) => a.day - b.day);
        
        // 最高BMDポイントを見つける
        const maxBMDPoint = bmdData.reduce((max, point) => 
          point.bmd > max.bmd ? point : max, bmdData[0]);
        
        const maxBMD = maxBMDPoint.bmd;
        const maxBMDDay = maxBMDPoint.day;
        const finalBMD = bmdData[bmdData.length - 1].bmd;
        const finalDay = bmdData[bmdData.length - 1].day;
        const fermentationDays = finalDay - maxBMDDay;
        
        // 進捗率データを計算
        const progressRates = bmdData.map(point => ({
          day: point.day,
          actualDay: point.day,
          actualBMD: point.bmd,
          progress: (point.bmd / maxBMD) * 100,
          normalizedTime: fermentationDays > 0 ? ((point.day - maxBMDDay) / fermentationDays) * 100 : 0
        }));
        
        tankAnalysis.push({
          tankId: tank.tankId,
          tankNumber: tank.metadata?.[COLUMN_NAMES.META.TANK_NUMBER] || tank.tankId,
          maxBMD,
          maxBMDDay,
          finalBMD,
          finalDay,
          fermentationDays,
          progressRates,
          dataQuality: 'good'
        });
      });
      
      // 統合パターンの作成
      const patterns = [];
      
      if (tankAnalysis.length >= 2) {
        // 発酵進行度ベース統合（ProgressModelingの補間ロジックを使用）
        const fermentationProgressPattern = [];
        
        for (let fermentationProgress = 0; fermentationProgress <= 100; fermentationProgress += 5) {
          const progressValues = [];
          
          tankAnalysis.forEach(analysis => {
            if (analysis.fermentationDays <= 0) return;
            
            // 発酵進行度に対応する実際の日数を計算
            const targetDay = analysis.maxBMDDay + (analysis.fermentationDays * fermentationProgress / 100);
            
            // 補間で進捗率を取得
            const sortedRates = analysis.progressRates.sort((a, b) => a.actualDay - b.actualDay);
            
            // 完全一致を探す
            const exactMatch = sortedRates.find(point => Math.abs(point.actualDay - targetDay) < 0.1);
            if (exactMatch) {
              progressValues.push(exactMatch.progress);
            } else {
              // 線形補間
              let beforePoint = null;
              let afterPoint = null;
              
              for (let i = 0; i < sortedRates.length - 1; i++) {
                if (sortedRates[i].actualDay <= targetDay && sortedRates[i + 1].actualDay >= targetDay) {
                  beforePoint = sortedRates[i];
                  afterPoint = sortedRates[i + 1];
                  break;
                }
              }
              
              if (beforePoint && afterPoint) {
                const ratio = (targetDay - beforePoint.actualDay) / (afterPoint.actualDay - beforePoint.actualDay);
                const interpolatedProgress = beforePoint.progress + (afterPoint.progress - beforePoint.progress) * ratio;
                progressValues.push(interpolatedProgress);
              }
            }
          });
          
          // 十分なデータがある場合のみ統合
          if (progressValues.length >= Math.max(1, tankAnalysis.length * 0.7)) {
            const avgProgress = progressValues.reduce((sum, p) => sum + p, 0) / progressValues.length;
            fermentationProgressPattern.push({ 
              x: fermentationProgress, 
              y: Math.max(0, Math.min(100, avgProgress))
            });
          }
        }
        
        if (fermentationProgressPattern.length > 0) {
          patterns.push({
            name: `発酵進行度ベース (${tankAnalysis.length}タンク)`,
            type: 'fermentation_progress',
            data: fermentationProgressPattern,
            sourceCount: tankAnalysis.length
          });
        }
      }
      
      return {
        tankAnalysis,
        patterns
      };
    };
    
    // 追い水分析1のデータ
    const calculateOisui1Data = () => {
      const day5Data = [];
      const day7Data = [];
      
      selectedTanks.forEach(tank => {
        // 5日目データ
        const day5 = tank.dailyData?.['day5'];
        if (day5) {
          const baume = parseFloat(day5[COLUMN_NAMES.DAILY.BAUME_BMD_DAY]);
          const theoreticalChange = parseFloat(day5[COLUMN_NAMES.DAILY.THEORETICAL_BAUME_CHANGE]);
          if (!isNaN(baume) && !isNaN(theoreticalChange)) {
            day5Data.push({ x: baume, y: theoreticalChange });
          }
        }
        
        // 7日目データ
        const day7 = tank.dailyData?.['day7'];
        if (day7) {
          const baume = parseFloat(day7[COLUMN_NAMES.DAILY.BAUME_BMD_DAY]);
          const theoreticalChange = parseFloat(day7[COLUMN_NAMES.DAILY.THEORETICAL_BAUME_CHANGE]);
          if (!isNaN(baume) && !isNaN(theoreticalChange)) {
            day7Data.push({ x: baume, y: theoreticalChange });
          }
        }
      });
      
      // 回帰分析
      const calculateRegression = (data) => {
        if (data.length < 2) return null;
        
        const n = data.length;
        const sumX = data.reduce((sum, p) => sum + p.x, 0);
        const sumY = data.reduce((sum, p) => sum + p.y, 0);
        const sumXY = data.reduce((sum, p) => sum + p.x * p.y, 0);
        const sumX2 = data.reduce((sum, p) => sum + p.x * p.x, 0);
        
        const a = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
        const b = (sumY - a * sumX) / n;
        
        // R²の計算
        const yMean = sumY / n;
        const ssTotal = data.reduce((sum, p) => sum + Math.pow(p.y - yMean, 2), 0);
        const ssResidual = data.reduce((sum, p) => {
          const yPred = a * p.x + b;
          return sum + Math.pow(p.y - yPred, 2);
        }, 0);
        const rSquared = 1 - (ssResidual / ssTotal);
        
        return { a, b, rSquared };
      };
      
      return {
        day5Data,
        day7Data,
        day5Regression: calculateRegression(day5Data),
        day7Regression: calculateRegression(day7Data)
      };
    };
    
    // 追い水分析2のデータ
    const calculateOisui2Data = () => {
      const analysisData = [];
      
      selectedTanks.forEach(tank => {
        const tankNumber = tank.metadata?.[COLUMN_NAMES.META.TANK_NUMBER] || tank.tankId;
        const batchSize = tank.metadata?.[COLUMN_NAMES.META.BATCH_SIZE] || '-';
        
        Object.entries(tank.dailyData || {}).forEach(([dayKey, dayData]) => {
          const day = parseInt(dayData[COLUMN_NAMES.DAILY.DAY]);
          if (day < 8) return;
          
          const currentBaume = parseFloat(dayData[COLUMN_NAMES.DAILY.BAUME_BMD_DAY]);
          const currentAlcohol = parseFloat(dayData[COLUMN_NAMES.DAILY.ALCOHOL]);
          
          if (!isNaN(currentBaume) && !isNaN(currentAlcohol)) {
            analysisData.push({
              tankId: tank.tankId,
              tankNumber,
              day,
              batchSize,
              currentBaume,
              currentAlcohol,
              temp1: parseFloat(dayData[COLUMN_NAMES.DAILY.TEMP_1]) || null,
              addedWater: parseFloat(dayData[COLUMN_NAMES.DAILY.WATER]) || 0
            });
          }
        });
      });
      
      return analysisData;
    };
    
    // 品温分析のデータ
    const calculateTemperatureData = () => {
      const tempData = [];
      
      selectedTanks.forEach(tank => {
        Object.entries(tank.dailyData || {}).forEach(([dayKey, dayData]) => {
          const temp1 = parseFloat(dayData[COLUMN_NAMES.DAILY.TEMP_1]);
          const alcohol = parseFloat(dayData[COLUMN_NAMES.DAILY.ALCOHOL]);
          const baume = parseFloat(dayData[COLUMN_NAMES.DAILY.BAUME_BMD_DAY]);
          const bmd = parseFloat(dayData[COLUMN_NAMES.DAILY.BMD]);
          
          if (!isNaN(temp1)) {
            tempData.push({
              tankId: tank.tankId,
              day: parseInt(dayData[COLUMN_NAMES.DAILY.DAY]),
              temp1,
              alcohol: isNaN(alcohol) ? null : alcohol,
              baume: isNaN(baume) ? null : baume,
              bmd: isNaN(bmd) ? null : bmd
            });
          }
        });
      });
      
      return tempData;
    };
    
    return {
      oisui1Data: calculateOisui1Data(),
      oisui2Data: calculateOisui2Data(),
      temperatureData: calculateTemperatureData(),
      progressData: calculateProgressData()
    };
  }, [selectedTanks]);

  // 統合モデルを保存
  const handleSaveModel = () => {
    if (!modelName.trim()) {
      alert('モデル名を入力してください');
      return;
    }
    
    // 分析データを取得
    const analysisData = getAnalysisData();
    
    console.log('保存時のパラメータ:', oisui2EditParams);
    
    const modelData = {
      id: Date.now(),
      name: modelName,
      savedAt: new Date().toISOString(),
      sourceTankIds: selectedTankIds,
      
      // 進捗モデリングのデータ（直接計算）
      progressData: analysisData.progressData,
      
      // 追い水分析のデータ
      oisuiData: {
        analysis1: analysisData.oisui1Data,
        analysis2: {
          parameters: oisui2EditParams, // 編集可能なパラメータを保存
          data: analysisData.oisui2Data
        }
      },
      
      // 品温分析のデータ
      temperatureData: analysisData.temperatureData
    };
    
    const updatedModels = loadedModelId 
      ? savedModels.map(m => m.id === loadedModelId ? { ...modelData, id: loadedModelId } : m)
      : [...savedModels, modelData];
    
    setSavedModels(updatedModels);
    localStorage.setItem('integratedModels', JSON.stringify(updatedModels));
    
    setShowSaveDialog(false);
    setModelName('');
    setLoadedModelId(modelData.id);
    
    alert(`統合モデル「${modelName}」を保存しました`);
  };
  
  // モデルを読み込み
  const handleLoadModel = (model) => {
    setLoadedModelId(model.id);
    setLoadedModelData(model);
    setMode('view'); // 読み込みモードに切り替え
    setShowModelList(false);
    
    alert(`統合モデル「${model.name}」を読み込みました。\n` +
          `読み込みモードで表示しています。`);
  };
  
  // 編集モードに戻る
  const handleBackToEdit = () => {
    setMode('edit');
    setLoadedModelId(null);
    setLoadedModelData(null);
  };
  
  // モデルを削除
  const handleDeleteModel = (modelId) => {
    if (!confirm('このモデルを削除してもよろしいですか？')) return;
    
    const updatedModels = savedModels.filter(m => m.id !== modelId);
    setSavedModels(updatedModels);
    localStorage.setItem('integratedModels', JSON.stringify(updatedModels));
    
    if (loadedModelId === modelId) {
      setLoadedModelId(null);
    }
  };

  // タブコンポーネント
  const TabButton = ({ tabKey, icon: Icon, label, isActive, onClick }) => (
    <button
      onClick={() => onClick(tabKey)}
      className={`flex items-center space-x-2 px-6 py-3 font-medium transition-colors ${
        isActive 
          ? 'bg-blue-600 text-white' 
          : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
      }`}
    >
      <Icon className="w-5 h-5" />
      <span>{label}</span>
    </button>
  );

  if (selectedTankIds.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
        <h2 className="text-xl font-bold mb-4 flex items-center">
          <Database className="mr-2" />
          統合モデリング
        </h2>
        <p className="text-gray-500">分析するタンクを選択してください。</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow border border-gray-200">
      {/* ヘッダー */}
      <div className="p-6 border-b border-gray-200">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-bold flex items-center">
            <Database className="mr-2" />
            統合モデリング
            {mode === 'edit' ? 
              ` - 編集モード (選択タンク: ${selectedTankIds.join(', ')})` :
              ` - 読み込みモード: ${loadedModelData?.name} (タンク: ${loadedModelData?.sourceTankIds.join(', ')})`
            }
          </h2>
          <div className="flex space-x-2">
            {mode === 'view' && (
              <button
                onClick={handleBackToEdit}
                className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 flex items-center"
              >
                <Edit2 className="w-4 h-4 mr-2" />
                編集モードに戻る
              </button>
            )}
            {mode === 'edit' && (
              <button
                onClick={() => setShowSaveDialog(true)}
                className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 flex items-center"
              >
                <Save className="w-4 h-4 mr-2" />
                統合モデルを保存
              </button>
            )}
            <button
              onClick={() => setShowModelList(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 flex items-center"
            >
              <FolderOpen className="w-4 h-4 mr-2" />
              モデル一覧
            </button>
          </div>
        </div>
      </div>

      {/* タブナビゲーション */}
      <div className="flex border-b border-gray-200">
        <TabButton
          tabKey="progress"
          icon={TrendingUp}
          label="進捗モデリング"
          isActive={activeTab === 'progress'}
          onClick={setActiveTab}
        />
        <TabButton
          tabKey="oisui"
          icon={Droplets}
          label="追い水モデリング"
          isActive={activeTab === 'oisui'}
          onClick={setActiveTab}
        />
        <TabButton
          tabKey="temperature"
          icon={Thermometer}
          label="品温モデリング"
          isActive={activeTab === 'temperature'}
          onClick={setActiveTab}
        />
      </div>

      {/* タブコンテンツ */}
      <div className="p-6">
        {/* 進捗モデリング */}
        {activeTab === 'progress' && (
          <div>
            <div className="mb-4">
              <h3 className="text-lg font-semibold">BMD進捗パターン分析</h3>
            </div>
            {mode === 'edit' ? (
              <ProgressModeling tanks={tanks} selectedTankIds={selectedTankIds} />
            ) : (
              <div className="bg-gray-50 p-6 rounded-lg">
                <h4 className="font-semibold mb-4">保存された進捗データ</h4>
                {loadedModelData?.progressData ? (
                  <div className="space-y-4">
                    {/* 個別タンクデータ */}
                    <div>
                      <h5 className="font-medium mb-2">個別タンクデータ</h5>
                      <div className="space-y-2">
                        {loadedModelData.progressData.tankAnalysis?.map((tankData, index) => (
                          <div key={index} className="p-3 bg-white rounded border">
                            <div className="font-medium">タンク {tankData.tankNumber}</div>
                            <div className="text-sm text-gray-600">
                              最高BMD: {tankData.maxBMD?.toFixed(1)} (第{tankData.maxBMDDay}日)
                              → 最終BMD: {tankData.finalBMD?.toFixed(1)} (第{tankData.finalDay}日)
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                    
                    {/* 統合パターン */}
                    {loadedModelData.progressData.patterns && loadedModelData.progressData.patterns.length > 0 && (
                      <div>
                        <h5 className="font-medium mb-2">統合パターン</h5>
                        <div className="space-y-2">
                          {loadedModelData.progressData.patterns.map((pattern, index) => (
                            <div key={index} className="p-3 bg-blue-50 rounded border border-blue-200">
                              <div className="font-medium text-blue-800">{pattern.name}</div>
                              <div className="text-sm text-blue-600">
                                データ点数: {pattern.data?.length || 0}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-gray-500">進捗データがありません</p>
                )}
              </div>
            )}
          </div>
        )}

        {/* 追い水モデリング */}
        {activeTab === 'oisui' && (
          <div>
            <div className="mb-4">
              <h3 className="text-lg font-semibold">追い水分析統合</h3>
            </div>
            
            {mode === 'edit' ? (
              <div className="space-y-6">
                {/* 追い水分析1（5日目・7日目） */}
                <div>
                  <h4 className="text-md font-semibold mb-4 text-gray-700">
                    追い水分析1 - 5日目・7日目のボーメ回帰分析
                  </h4>
                  <OisuiAnalysis tanks={tanks} selectedTankIds={selectedTankIds} />
                </div>
                
                {/* 追い水分析2（8日目以降） */}
                <div>
                  <h4 className="text-md font-semibold mb-4 text-gray-700">
                    追い水分析2 - 8日目以降の追い水計算
                  </h4>
                  
                  {/* OisuiAnalysis2の機能を統合モデリング内で再実装 */}
                  <OisuiAnalysis2Integration 
                    tanks={tanks} 
                    selectedTankIds={selectedTankIds}
                    params={oisui2EditParams}
                    onParamsChange={setOisui2EditParams}
                  />
                </div>
              </div>
            ) : (
              <div className="bg-gray-50 p-6 rounded-lg">
                <h4 className="font-semibold mb-4">保存された追い水分析データ</h4>
                <div className="space-y-4">
                  {/* 5日目・7日目の回帰データ */}
                  {loadedModelData?.oisuiData?.analysis1 && (
                    <div>
                      <h5 className="font-medium mb-2">5日目・7日目回帰関数</h5>
                      {loadedModelData.oisuiData.analysis1.day5Regression && (
                        <div className="p-3 bg-white rounded border">
                          <div className="font-medium">5日目回帰関数</div>
                          <div className="text-sm">
                            y = {loadedModelData.oisuiData.analysis1.day5Regression.a.toFixed(6)}x + 
                            {loadedModelData.oisuiData.analysis1.day5Regression.b.toFixed(6)}
                            (R² = {loadedModelData.oisuiData.analysis1.day5Regression.rSquared.toFixed(4)})
                          </div>
                        </div>
                      )}
                      {loadedModelData.oisuiData.analysis1.day7Regression && (
                        <div className="p-3 bg-white rounded border mt-2">
                          <div className="font-medium">7日目回帰関数</div>
                          <div className="text-sm">
                            y = {loadedModelData.oisuiData.analysis1.day7Regression.a.toFixed(6)}x + 
                            {loadedModelData.oisuiData.analysis1.day7Regression.b.toFixed(6)}
                            (R² = {loadedModelData.oisuiData.analysis1.day7Regression.rSquared.toFixed(4)})
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                  
                  {/* 8日目以降のパラメータ */}
                  {loadedModelData?.oisuiData?.analysis2?.parameters && (
                    <div>
                      <h5 className="font-medium mb-2">8日目以降のパラメータ</h5>
                      <div className="p-3 bg-white rounded border">
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <div>アルコール係数: {loadedModelData.oisuiData.analysis2.parameters.alcoholCoeff}</div>
                          <div>アルコール閾値: {loadedModelData.oisuiData.analysis2.parameters.targetAlcoholThreshold}%</div>
                          <div>目標ボーメ: {loadedModelData.oisuiData.analysis2.parameters.targetBaume}</div>
                          <div>目標アルコール: {loadedModelData.oisuiData.analysis2.parameters.targetAlcohol}%</div>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {/* 8日目以降のデータ */}
                  {loadedModelData?.oisuiData?.analysis2?.data && (
                    <div className="p-3 bg-white rounded border">
                      <div className="font-medium">8日目以降のデータ</div>
                      <div className="text-sm">データ件数: {loadedModelData.oisuiData.analysis2.data.length}件</div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* 品温モデリング */}
        {activeTab === 'temperature' && (
          <div>
            <div className="mb-4">
              <h3 className="text-lg font-semibold">品温変動分析</h3>
            </div>
            {mode === 'edit' ? (
              <TemperatureAnalysis tanks={tanks} selectedTankIds={selectedTankIds} />
            ) : (
              <div className="bg-gray-50 p-6 rounded-lg">
                <h4 className="font-semibold mb-4">保存された品温データ</h4>
                {loadedModelData?.temperatureData && loadedModelData.temperatureData.length > 0 ? (
                  <div className="p-3 bg-white rounded border">
                    <div>データ件数: {loadedModelData.temperatureData.length}件</div>
                    <div className="text-sm text-gray-600">
                      温度、アルコール度数、ボーメ、BMDの相関データ
                    </div>
                  </div>
                ) : (
                  <p className="text-gray-500">品温データがありません</p>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* 保存ダイアログ */}
      {showSaveDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-96">
            <h3 className="text-lg font-semibold mb-4">統合モデルの保存</h3>
            <input
              type="text"
              value={modelName}
              onChange={(e) => setModelName(e.target.value)}
              placeholder="モデル名を入力"
              className="w-full px-4 py-2 border border-gray-300 rounded mb-4"
              autoFocus
            />
            <div className="flex justify-end space-x-2">
              <button
                onClick={() => {
                  setShowSaveDialog(false);
                  setModelName('');
                }}
                className="px-4 py-2 bg-gray-300 text-gray-700 rounded hover:bg-gray-400"
              >
                キャンセル
              </button>
              <button
                onClick={handleSaveModel}
                disabled={!modelName.trim()}
                className={`px-4 py-2 rounded text-white ${
                  modelName.trim() 
                    ? 'bg-green-600 hover:bg-green-700' 
                    : 'bg-gray-400 cursor-not-allowed'
                }`}
              >
                保存
              </button>
            </div>
          </div>
        </div>
      )}

      {/* モデル一覧 */}
      {showModelList && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-[600px] max-h-[80vh] overflow-y-auto">
            <h3 className="text-lg font-semibold mb-4">保存済みモデル一覧</h3>
            
            {savedModels.length === 0 ? (
              <p className="text-gray-500 mb-4">保存されたモデルはありません</p>
            ) : (
              <div className="space-y-2 mb-4">
                {savedModels.map(model => (
                  <div 
                    key={model.id}
                    className={`p-4 border rounded-lg hover:bg-gray-50 ${
                      loadedModelId === model.id ? 'border-blue-500 bg-blue-50' : 'border-gray-300'
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="font-semibold">{model.name}</h4>
                        <p className="text-sm text-gray-600">
                          保存日時: {new Date(model.savedAt).toLocaleString('ja-JP')}
                        </p>
                        <p className="text-sm text-gray-600">
                          対象タンク: {model.sourceTankIds.join(', ')}
                        </p>
                      </div>
                      <div className="flex space-x-2">
                        <button
                          onClick={() => handleLoadModel(model)}
                          className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
                        >
                          読み込み
                        </button>
                        <button
                          onClick={() => handleDeleteModel(model.id)}
                          className="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700 text-sm"
                        >
                          削除
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
            
            <div className="flex justify-end">
              <button
                onClick={() => setShowModelList(false)}
                className="px-4 py-2 bg-gray-300 text-gray-700 rounded hover:bg-gray-400"
              >
                閉じる
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default IntegratedModeling;