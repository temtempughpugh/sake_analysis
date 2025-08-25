import React, { useState, useEffect, useMemo } from 'react';
import { Line } from 'react-chartjs-2';
import { AlertCircle, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { COLUMN_NAMES } from '../../utils/csvParser';

const ProgressPrediction = ({ tank, allTanks }) => {
  const [selectedModel, setSelectedModel] = useState(null);
  const [savedModels, setSavedModels] = useState([]);
  const [idealCurve, setIdealCurve] = useState([]);
  const [currentPacePrediction, setCurrentPacePrediction] = useState([]);

  // 保存されたモデルを読み込み
  useEffect(() => {
    const models = localStorage.getItem('fermentationModels');
    if (models) {
      const parsedModels = JSON.parse(models);
      setSavedModels(parsedModels);
      // デフォルトで最初のモデルを選択
      if (parsedModels.length > 0 && !selectedModel) {
        setSelectedModel(parsedModels[0]);
      }
    }
  }, []);

  // タンクの基準値を取得
  const baseValues = useMemo(() => {
    const maxBMD = parseFloat(tank.metadata?.[COLUMN_NAMES.META.MAX_BMD]) || 0;
    const maxBMDDay = parseInt(tank.metadata?.[COLUMN_NAMES.META.MAX_BMD_DAY]) || 0;
    const finalBaume = parseFloat(tank.metadata?.[COLUMN_NAMES.META.FINAL_BAUME]) || 0;
    const finalAlcohol = parseFloat(tank.metadata?.[COLUMN_NAMES.META.FINAL_ALCOHOL]) || 0;
    
    // 最終日数を推定（通常は17-20日）
    const estimatedFinalDay = maxBMDDay + 10; // 仮の値
    
    return { maxBMD, maxBMDDay, finalBaume, finalAlcohol, estimatedFinalDay };
  }, [tank]);

  // 実測データを取得
  const actualData = useMemo(() => {
    const data = [];
    Object.entries(tank.dailyData || {}).forEach(([day, dayData]) => {
      const dayNum = parseInt(day);
      const bmd = parseFloat(dayData[COLUMN_NAMES.DAILY.BMD_COMPLEMENT]);
      const baume = parseFloat(dayData[COLUMN_NAMES.DAILY.BAUME_COMPLEMENT]);
      const alcohol = parseFloat(dayData[COLUMN_NAMES.DAILY.ALCOHOL_COMPLEMENT]);
      
      if (!isNaN(dayNum) && !isNaN(bmd)) {
        data.push({
          day: dayNum,
          bmd,
          baume: isNaN(baume) ? null : baume,
          alcohol: isNaN(alcohol) ? null : alcohol
        });
      }
    });
    return data.sort((a, b) => a.day - b.day);
  }, [tank]);

  // 現在の進捗を計算
  const currentProgress = useMemo(() => {
    if (actualData.length === 0) return null;
    
    const latestData = actualData[actualData.length - 1];
    const { maxBMD, maxBMDDay } = baseValues;
    
    // BMDベースの進捗計算
    const currentBMD = latestData.bmd;
    const progressPercent = (currentBMD / maxBMD) * 100;
    
    return {
      day: latestData.day,
      bmd: currentBMD,
      baume: latestData.baume,
      alcohol: latestData.alcohol,
      progressPercent,
      daysFromMaxBMD: latestData.day - maxBMDDay
    };
  }, [actualData, baseValues]);

  // 理想曲線を生成
  useEffect(() => {
    if (!selectedModel || !baseValues.maxBMD) return;
    
    const curve = [];
    const { maxBMD, maxBMDDay, estimatedFinalDay } = baseValues;
    
    // モデルから理想曲線を生成
    for (let day = 1; day <= estimatedFinalDay + 5; day++) {
      // 発酵進行度を計算
      const fermentationProgress = day <= maxBMDDay ? 
        (day / maxBMDDay) * 50 : // 最高BMDまでは50%
        50 + ((day - maxBMDDay) / (estimatedFinalDay - maxBMDDay)) * 50; // その後100%まで
      
      // モデルから進捗率を取得
      const progressRate = interpolateFromModel(fermentationProgress, selectedModel);
      
      // BMDを計算
      const idealBMD = (progressRate / 100) * maxBMD;
      
      curve.push({
        day,
        idealBMD,
        idealBaume: null, // 後で実装
        progressRate,
        fermentationProgress
      });
    }
    
    setIdealCurve(curve);
  }, [selectedModel, baseValues]);

  // 現在ペースでの予測を計算
  useEffect(() => {
    if (actualData.length < 3) return;
    
    // 直近3日間の変動から予測
    const recentData = actualData.slice(-3);
    const avgBMDChange = calculateAverageChange(recentData, 'bmd');
    
    const prediction = [];
    const lastData = actualData[actualData.length - 1];
    let currentBMD = lastData.bmd;
    
    // 30日先まで予測
    for (let day = lastData.day + 1; day <= lastData.day + 30; day++) {
      currentBMD += avgBMDChange;
      prediction.push({
        day,
        predictedBMD: currentBMD,
        predictedBaume: null // 後で実装
      });
    }
    
    setCurrentPacePrediction(prediction);
  }, [actualData]);

  // モデルから補間
  const interpolateFromModel = (fermentationProgress, model) => {
    if (!model?.progressPattern) return 0;
    
    const pattern = model.progressPattern;
    
    // 完全一致を探す
    const exact = pattern.find(p => Math.abs(p.fermentationProgress - fermentationProgress) < 0.1);
    if (exact) return exact.progressRate;
    
    // 線形補間
    for (let i = 0; i < pattern.length - 1; i++) {
      if (pattern[i].fermentationProgress <= fermentationProgress && 
          pattern[i + 1].fermentationProgress >= fermentationProgress) {
        const ratio = (fermentationProgress - pattern[i].fermentationProgress) / 
                     (pattern[i + 1].fermentationProgress - pattern[i].fermentationProgress);
        return pattern[i].progressRate + ratio * (pattern[i + 1].progressRate - pattern[i].progressRate);
      }
    }
    
    return fermentationProgress; // フォールバック
  };

  // 平均変化量を計算
  const calculateAverageChange = (data, field) => {
    if (data.length < 2) return 0;
    
    let totalChange = 0;
    let count = 0;
    
    for (let i = 1; i < data.length; i++) {
      if (data[i][field] !== null && data[i-1][field] !== null) {
        totalChange += data[i][field] - data[i-1][field];
        count++;
      }
    }
    
    return count > 0 ? totalChange / count : 0;
  };

  // 差分を計算
  const calculateDifference = (actual, ideal) => {
    if (!actual || !ideal) return null;
    
    const actualPoint = actualData.find(d => d.day === actual);
    const idealPoint = idealCurve.find(d => d.day === ideal);
    
    if (!actualPoint || !idealPoint) return null;
    
    const bmdDiff = actualPoint.bmd - idealPoint.idealBMD;
    const daysDiff = Math.round(bmdDiff / calculateAverageChange(actualData.slice(-3), 'bmd'));
    
    return {
      bmdDifference: bmdDiff,
      daysDifference: daysDiff,
      status: Math.abs(bmdDiff) < 1 ? '順調' : 
              bmdDiff > 2 ? '遅れ' : 
              bmdDiff < -2 ? '進み' : '微調整'
    };
  };

  return (
    <div className="space-y-4">
      {/* モデル選択 */}
      <div className="flex items-center space-x-4">
        <label className="text-sm font-medium text-gray-700">参照モデル:</label>
        <select
          value={selectedModel?.id || ''}
          onChange={(e) => {
            const model = savedModels.find(m => m.id === e.target.value);
            setSelectedModel(model);
          }}
          className="px-3 py-1 border border-gray-300 rounded-md text-sm"
        >
          <option value="">モデルを選択</option>
          {savedModels.map(model => (
            <option key={model.id} value={model.id}>
              {model.name} ({model.type === 'unified' ? '統合' : `タンク${model.tankNumber}`})
            </option>
          ))}
        </select>
      </div>

      {/* 現在の状況サマリー */}
      {currentProgress && (
        <div className="bg-blue-50 rounded-lg p-4">
          <h4 className="font-medium text-blue-900 mb-2">現在の発酵状況</h4>
          <div className="grid grid-cols-4 gap-4 text-sm">
            <div>
              <span className="text-gray-600">日数:</span>
              <span className="ml-2 font-medium">{currentProgress.day}日目</span>
            </div>
            <div>
              <span className="text-gray-600">BMD:</span>
              <span className="ml-2 font-medium">{currentProgress.bmd.toFixed(2)}</span>
            </div>
            <div>
              <span className="text-gray-600">進捗:</span>
              <span className="ml-2 font-medium">{currentProgress.progressPercent.toFixed(1)}%</span>
            </div>
            <div>
              <span className="text-gray-600">最高BMD後:</span>
              <span className="ml-2 font-medium">{currentProgress.daysFromMaxBMD}日</span>
            </div>
          </div>
        </div>
      )}

      {/* 進捗予測テーブル */}
      {idealCurve.length > 0 && (
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-100">
              <tr>
                <th className="px-3 py-2 text-left font-medium text-gray-700">日数</th>
                <th className="px-3 py-2 text-center font-medium text-gray-700">理想BMD</th>
                <th className="px-3 py-2 text-center font-medium text-gray-700">実測BMD</th>
                <th className="px-3 py-2 text-center font-medium text-gray-700">差分</th>
                <th className="px-3 py-2 text-center font-medium text-gray-700">日数差</th>
                <th className="px-3 py-2 text-center font-medium text-gray-700">状況</th>
                <th className="px-3 py-2 text-center font-medium text-gray-700">予測BMD<br/>(現ペース)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {idealCurve.map((ideal) => {
                const actual = actualData.find(a => a.day === ideal.day);
                const prediction = currentPacePrediction.find(p => p.day === ideal.day);
                const diff = actual ? calculateDifference(ideal.day, ideal.day) : null;
                
                return (
                  <tr key={ideal.day} className={actual ? 'bg-blue-50' : ''}>
                    <td className="px-3 py-2 font-medium">{ideal.day}日</td>
                    <td className="px-3 py-2 text-center">{ideal.idealBMD.toFixed(2)}</td>
                    <td className="px-3 py-2 text-center">
                      {actual ? actual.bmd.toFixed(2) : '-'}
                    </td>
                    <td className="px-3 py-2 text-center">
                      {diff ? (
                        <span className={`font-medium ${
                          diff.bmdDifference > 0 ? 'text-red-600' : 
                          diff.bmdDifference < 0 ? 'text-blue-600' : 
                          'text-green-600'
                        }`}>
                          {diff.bmdDifference > 0 ? '+' : ''}{diff.bmdDifference.toFixed(2)}
                        </span>
                      ) : '-'}
                    </td>
                    <td className="px-3 py-2 text-center">
                      {diff ? (
                        <span className={`${
                          diff.daysDifference > 0 ? 'text-red-600' : 
                          diff.daysDifference < 0 ? 'text-blue-600' : 
                          'text-gray-600'
                        }`}>
                          {diff.daysDifference > 0 ? `${diff.daysDifference}日遅れ` : 
                           diff.daysDifference < 0 ? `${Math.abs(diff.daysDifference)}日進み` : 
                           '予定通り'}
                        </span>
                      ) : '-'}
                    </td>
                    <td className="px-3 py-2 text-center">
                      {diff ? (
                        <span className={`px-2 py-1 rounded text-xs ${
                          diff.status === '順調' ? 'bg-green-200 text-green-800' :
                          diff.status === '遅れ' ? 'bg-red-200 text-red-800' :
                          diff.status === '進み' ? 'bg-blue-200 text-blue-800' :
                          'bg-yellow-200 text-yellow-800'
                        }`}>
                          {diff.status}
                        </span>
                      ) : '-'}
                    </td>
                    <td className="px-3 py-2 text-center">
                      {prediction ? prediction.predictedBMD.toFixed(2) : '-'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* モデルが選択されていない場合 */}
      {!selectedModel && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-start space-x-2">
            <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-yellow-800">
              <p className="font-medium">参照モデルを選択してください</p>
              <p className="mt-1">
                保存済みの発酵モデルを選択すると、理想的な発酵経過との比較が可能になります。
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProgressPrediction;