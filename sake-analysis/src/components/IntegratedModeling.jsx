import React, { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { Save, Database, TrendingUp, Droplets, Thermometer, FolderOpen, Trash2, Edit2 } from 'lucide-react';
import ProgressModeling from './ProgressModeling';
import OisuiAnalysis from './OisuiAnalysis';
import OisuiAnalysis2 from './OisuiAnalysis2';
import TemperatureAnalysis from './TemperatureAnalysis';
import { COLUMN_NAMES } from '../utils/csvParser';

// IntegratedModeling.jsx内のOisuiAnalysis2Integrationコンポーネントを以下に完全に置き換える

// OisuiAnalysis2の機能を統合モデリング用に再実装
const OisuiAnalysis2Integration = ({ tanks, selectedTankIds, params, onParamsChange }) => {
  const selectedTanks = useMemo(() => 
    tanks.filter(tank => selectedTankIds.includes(tank.tankId)),
    [tanks, selectedTankIds]
  );

  // 真のアルコール係数計算（OisuiAnalysis2と同じロジック）
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
    
    // 追い水反映（希釈効果を除去）
    const dilutionFactor = (totalVolume + totalWater) / totalVolume;
    const trueFinalBaumeWithWater = finalBaume * dilutionFactor;
    const trueFinalAlcoholWithWater = finalAlcohol * dilutionFactor;
    
    const baumeChangeWithWater = startBaume - trueFinalBaumeWithWater;
    const alcoholChangeWithWater = trueFinalAlcoholWithWater - startAlcohol;
    
    const coefficientWithWater = baumeChangeWithWater > 0 ? 
      alcoholChangeWithWater / baumeChangeWithWater : null;
    
    return { withWater: coefficientWithWater, withoutWater: null };
  };

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

  // selectedTankIds変更時に自動でパラメータ更新
  useEffect(() => {
    if (selectedTanks.length > 0) {
      const firstTank = selectedTanks[0];
      const defaultTargetBaume = parseFloat(firstTank.metadata?.[COLUMN_NAMES.META.FINAL_BAUME]) || -1.21;
      const defaultTargetAlcohol = parseFloat(firstTank.metadata?.[COLUMN_NAMES.META.FINAL_ALCOHOL]) || 18.65;
      const defaultAlcoholCoeff = calculateTrueCoefficientsFromMeta(firstTank)?.withWater || 0.64;
      
      onParamsChange({
        alcoholCoeff: defaultAlcoholCoeff,
        targetAlcoholThreshold: params.targetAlcoholThreshold || 15,
        targetBaume: defaultTargetBaume,
        targetAlcohol: defaultTargetAlcohol
      });
    }
  }, [selectedTankIds]);

  // デフォルト値設定
  const setDefaultValues = () => {
    if (selectedTanks.length === 0) return;
    
    const firstTank = selectedTanks[0];
    const defaultTargetBaume = parseFloat(firstTank.metadata?.[COLUMN_NAMES.META.FINAL_BAUME]) || -1.21;
    const defaultTargetAlcohol = parseFloat(firstTank.metadata?.[COLUMN_NAMES.META.FINAL_ALCOHOL]) || 18.65;
    const defaultAlcoholCoeff = calculateTrueCoefficientsFromMeta(firstTank)?.withWater || 0.64;
    
    onParamsChange({
      alcoholCoeff: defaultAlcoholCoeff,
      targetAlcoholThreshold: 15,
      targetBaume: defaultTargetBaume,
      targetAlcohol: defaultTargetAlcohol
    });
  };

  // アルコール度数の計算（日数）
  const calculateEstimatedDays = (tank, currentDay, threshold) => {
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

  // 8日目以降のデータ処理
  const analysisData = useMemo(() => {
    if (selectedTanks.length === 0) return [];

    const results = [];

    selectedTanks.forEach(tank => {
      const tankNumber = tank.metadata?.[COLUMN_NAMES.META.TANK_NUMBER] || tank.tankId;
      const batchSize = tank.metadata?.[COLUMN_NAMES.META.BATCH_SIZE] || '3000';
      const totalVolume = parseFloat(tank.metadata?.[COLUMN_NAMES.META.TOTAL_VOLUME]) || parseFloat(batchSize);
      const yeast = tank.metadata?.[COLUMN_NAMES.META.YEAST] || '不明';

      // 8日目以降のデータを取得
      const entries = Object.entries(tank.dailyData || {})
        .map(([key, data]) => ({
          day: parseInt(data[COLUMN_NAMES.DAILY.DAY]),
          date: data[COLUMN_NAMES.DAILY.DATE],
          baume: parseFloat(data[COLUMN_NAMES.DAILY.BAUME_BMD_DAY]) || parseFloat(data[COLUMN_NAMES.DAILY.BAUME]),
          alcohol: parseFloat(data[COLUMN_NAMES.DAILY.ALCOHOL]),
          water: parseFloat(data[COLUMN_NAMES.DAILY.WATER]) || 0
        }))
        .filter(d => d.day >= 8 && !isNaN(d.alcohol))
        .sort((a, b) => a.day - b.day);

      entries.forEach(entry => {
        // 累積追い水量計算
        const cumulativeWater = Object.entries(tank.dailyData || {})
          .filter(([key, data]) => {
            const day = parseInt(data[COLUMN_NAMES.DAILY.DAY]);
            return day <= entry.day;
          })
          .reduce((sum, [key, data]) => {
            const water = parseFloat(data[COLUMN_NAMES.DAILY.WATER]) || 0;
            return sum + water;
          }, 0);

        // 日次アルコール係数計算
        const dailyTrueCoeff = calculateDailyTrueAlcoholCoeff(tank, entry.day, cumulativeWater);

        // 必要追い水量計算
        const remainingBaume = entry.baume - params.targetBaume;
        const predictedAlcoholIncrease = remainingBaume * params.alcoholCoeff;
        const predictedFinalAlcohol = entry.alcohol + predictedAlcoholIncrease;
        
        let requiredWater = 0;
        let theoreticalWater = 0;
        
        if (predictedFinalAlcohol > params.targetAlcohol) {
          // OisuiAnalysis2と同じ計算方法
          const currentVolume = totalVolume; // 累積追い水量は考慮しない
          const dilutionRatio = params.targetAlcohol / predictedFinalAlcohol;
          const requiredFinalVolume = currentVolume / dilutionRatio;
          requiredWater = requiredFinalVolume - currentVolume;
          
          // 理論的な追い水量（分割考慮）
          const remainingDays = calculateEstimatedDays(tank, entry.day, params.targetAlcoholThreshold);
          if (remainingDays <= 0) {
            theoreticalWater = requiredWater;
          } else {
            theoreticalWater = requiredWater / remainingDays * 2; // 1回分
          }
        }

        // 到達予想日数
        const estimatedDays = calculateEstimatedDays(tank, entry.day, params.targetAlcoholThreshold);

        results.push({
          tankNumber,
          yeast,
          day: entry.day,
          date: entry.date || '-',
          baume: entry.baume,
          alcohol: entry.alcohol,
          trueCoeff: calculateTrueCoefficientsFromMeta(tank)?.withWater,
          dailyTrueCoeff,
          cumulativeWater,
          requiredTotalWater: requiredWater,
          theoreticalWater,
          actualWater: entry.water,
          estimatedDays
        });
      });
    });

    return results;
  }, [selectedTanks, params]);


  // 数値フォーマット
  const formatNumber = (value, decimals = 2) => {
    if (value === null || value === undefined || isNaN(value)) return '-';
    return value.toFixed(decimals);
  };

  return (
    <div className="space-y-4">
      {/* パラメータ設定 */}
      <div className="bg-blue-50 p-4 rounded-lg">
        <div className="flex items-center justify-between mb-3">
          <h5 className="font-medium text-gray-700">パラメータ設定（編集可能）</h5>
          <button
            onClick={setDefaultValues}
            className="text-sm text-blue-600 hover:text-blue-700 underline"
          >
            デフォルト値に戻す
          </button>
        </div>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm text-gray-600 mb-1">アルコール係数</label>
            <input
              type="number"
              step="0.01"
              value={params.alcoholCoeff}
              onChange={(e) => onParamsChange({ ...params, alcoholCoeff: parseFloat(e.target.value) || 0 })}
              className="w-full px-2 py-1 border rounded"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">アルコール閾値(%)</label>
            <input
              type="number"
              step="0.1"
              value={params.targetAlcoholThreshold}
              onChange={(e) => onParamsChange({ ...params, targetAlcoholThreshold: parseFloat(e.target.value) || 0 })}
              className="w-full px-2 py-1 border rounded"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">目標ボーメ</label>
            <input
              type="number"
              step="0.01"
              value={params.targetBaume}
              onChange={(e) => onParamsChange({ ...params, targetBaume: parseFloat(e.target.value) || 0 })}
              className="w-full px-2 py-1 border rounded"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">目標アルコール(%)</label>
            <input
              type="number"
              step="0.01"
              value={params.targetAlcohol}
              onChange={(e) => onParamsChange({ ...params, targetAlcohol: parseFloat(e.target.value) || 0 })}
              className="w-full px-2 py-1 border rounded"
            />
          </div>
        </div>
      </div>

      {/* 結果表示 */}
      <div className="overflow-x-auto">
        {analysisData.length > 0 ? (
          <div>
            <table className="min-w-full border-collapse">
              <thead>
                <tr className="bg-gray-100">
                  <th className="border border-gray-300 p-2 text-left">タンク</th>
                  <th className="border border-gray-300 p-2 text-left">酵母</th>
                  <th className="border border-gray-300 p-2 text-center">日数</th>
                  <th className="border border-gray-300 p-2 text-center">日付</th>
                  <th className="border border-gray-300 p-2 text-center">ボーメ</th>
                  <th className="border border-gray-300 p-2 text-center">アルコール(%)</th>
                  <th className="border border-gray-300 p-2 text-center">真の係数</th>
                  <th className="border border-gray-300 p-2 text-center">日次係数</th>
                  <th className="border border-gray-300 p-2 text-center">累積追水(L)</th>
                  <th className="border border-gray-300 p-2 text-center">必要追水(L)</th>
                  <th className="border border-gray-300 p-2 text-center">理論追水(L)</th>
                  <th className="border border-gray-300 p-2 text-center">実際追水(L)</th>
                  <th className="border border-gray-300 p-2 text-center">閾値まで</th>
                </tr>
              </thead>
              <tbody>
                {analysisData.map((data, index) => (
                  <tr key={index} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    <td className="border border-gray-300 p-2">{data.tankNumber}</td>
                    <td className="border border-gray-300 p-2">{data.yeast}</td>
                    <td className="border border-gray-300 p-2 text-center">{data.day}</td>
                    <td className="border border-gray-300 p-2 text-center">{data.date}</td>
                    <td className="border border-gray-300 p-2 text-center">{formatNumber(data.baume, 2)}</td>
                    <td className="border border-gray-300 p-2 text-center">{formatNumber(data.alcohol, 1)}</td>
                    <td className="border border-gray-300 p-2 text-center">
                      {data.trueCoeff ? formatNumber(data.trueCoeff, 3) : '-'}
                    </td>
                    <td className="border border-gray-300 p-2 text-center">
                      {data.dailyTrueCoeff ? formatNumber(data.dailyTrueCoeff, 3) : '-'}
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
                    <td className="border border-gray-300 p-2 text-center">
                      {data.estimatedDays > 0 ? `${data.estimatedDays}日` : '超過'}
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
        
        // 修正版
const progressRates = bmdData
  .filter(point => point.day >= maxBMDDay)  // 最高BMD日以降のみ
  .map(point => ({
    day: point.day,
    actualDay: point.day,
    actualBMD: point.bmd,
    progress: ((maxBMD - point.bmd) / (maxBMD - finalBMD)) * 100,
    normalizedTime: fermentationDays > 0 ? 
      ((point.day - maxBMDDay) / fermentationDays) * 100 : 0
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

    // === ここに追加 ===
  console.log('保存するmodelData:', modelData);
  console.log('tankAnalysis[0].progressRates:', modelData.progressData?.tankAnalysis?.[0]?.progressRates);
  // ================
    
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