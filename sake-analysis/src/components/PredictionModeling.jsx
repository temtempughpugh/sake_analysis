import React, { useState, useEffect } from 'react';
import { Line } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend } from 'chart.js';
import { Calculator, Target, TrendingUp, AlertTriangle } from 'lucide-react';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend);

const PredictionModeling = () => {
  const [savedModels, setSavedModels] = useState(() => {
    const saved = localStorage.getItem('fermentationModels');
    return saved ? JSON.parse(saved) : [];
  });
  
  const [selectedModel, setSelectedModel] = useState(null);
  const [predictionInputs, setPredictionInputs] = useState({
    currentDay: '',
    currentBaume: '',
    targetDay: '',
    targetBaume: ''
  });
  
  const [predictionResult, setPredictionResult] = useState(null);
  const [showGraph, setShowGraph] = useState(false);

  // モデルから進捗率を補間で取得
  const interpolateProgressFromModel = (fermentationProgress, model) => {
    const pattern = model.progressPattern;
    
    // 完全一致を探す
    const exactMatch = pattern.find(p => Math.abs(p.fermentationProgress - fermentationProgress) < 0.1);
    if (exactMatch) return exactMatch.progressRate;
    
    // 前後のポイントを探して線形補間
    let before = null, after = null;
    
    for (let i = 0; i < pattern.length - 1; i++) {
      if (pattern[i].fermentationProgress <= fermentationProgress && 
          pattern[i + 1].fermentationProgress >= fermentationProgress) {
        before = pattern[i];
        after = pattern[i + 1];
        break;
      }
    }
    
    if (!before || !after) {
      // 範囲外の場合は最近傍を返す
      return pattern.reduce((closest, p) => 
        Math.abs(p.fermentationProgress - fermentationProgress) < 
        Math.abs(closest.fermentationProgress - fermentationProgress) ? p : closest
      ).progressRate;
    }
    
    // 線形補間
    const ratio = (fermentationProgress - before.fermentationProgress) / 
                 (after.fermentationProgress - before.fermentationProgress);
    return before.progressRate + (after.progressRate - before.progressRate) * ratio;
  };

  // 予測計算のメイン関数
  const calculatePrediction = () => {
    if (!selectedModel || !predictionInputs.currentDay || !predictionInputs.currentBaume || 
        !predictionInputs.targetDay || !predictionInputs.targetBaume) {
      return;
    }

    const currentDay = parseInt(predictionInputs.currentDay);
    const currentBaume = parseFloat(predictionInputs.currentBaume);
    const targetDay = parseInt(predictionInputs.targetDay);
    const targetBaume = parseFloat(predictionInputs.targetBaume);

    // 基本パラメータ
    const currentBMD = currentBaume * currentDay;
    const targetBMD = targetBaume * targetDay;
    
    // モデルから基準値を取得
    const modelParams = selectedModel.parameters;
    const maxBMD = modelParams.maxBMD || modelParams.avgMaxBMD;
    const maxBMDDay = modelParams.maxBMDDay || modelParams.avgMaxBMDDay || 8;
    const avgFermentationDays = modelParams.fermentationDays || modelParams.avgFermentationDays || 18;

    // 現在の発酵進行度を計算
    const currentFermentationProgress = ((currentDay - maxBMDDay) / (targetDay - maxBMDDay)) * 100;
    
    // モデルから期待進捗率を取得
    const expectedProgressRate = interpolateProgressFromModel(currentFermentationProgress, selectedModel);
    
    // 実際の進捗率を計算
    const actualProgressRate = ((maxBMD - currentBMD) / (maxBMD - targetBMD)) * 100;
    
    // 進捗差を算出
    const progressDiff = actualProgressRate - expectedProgressRate;

    console.log('予測計算:', {
      currentFermentationProgress,
      expectedProgressRate,
      actualProgressRate,
      progressDiff
    });

    // パターン1: 現状ペース継続
    const pattern1 = [];
    // パターン2: 強制完成（目標日数厳守）
    const pattern2 = [];
    
    // 実績データ（現在まで）
    const historicalData = [];
    
    // 現在日までの実績（仮想データ - 実際は入力された実測値を使用）
    for (let day = maxBMDDay; day <= currentDay; day++) {
      if (day === currentDay) {
        historicalData.push({ x: day, y: currentBMD });
      } else {
        // 簡易的な実績データ生成（実際は保存された実測値を使用）
        const dayProgress = ((day - maxBMDDay) / (currentDay - maxBMDDay)) * currentFermentationProgress;
        const dayProgressRate = interpolateProgressFromModel(dayProgress, selectedModel) + progressDiff;
        const dayBMD = targetBMD + (maxBMD - targetBMD) * (1 - dayProgressRate / 100);
        historicalData.push({ x: day, y: dayBMD });
      }
    }

    // 予測計算
    for (let day = currentDay + 1; day <= targetDay + 5; day++) {
      // パターン1: 現状ペース継続
      const dayFermentationProgress = ((day - maxBMDDay) / (targetDay - maxBMDDay)) * 100;
      const standardProgressRate = interpolateProgressFromModel(dayFermentationProgress, selectedModel);
      const adjustedProgressRate = Math.max(0, Math.min(100, standardProgressRate + progressDiff));
      const predictedBMD1 = targetBMD + (maxBMD - targetBMD) * (1 - adjustedProgressRate / 100);
      
      pattern1.push({
        day: day,
        bmd: predictedBMD1,
        baume: predictedBMD1 / day,
        progress: adjustedProgressRate
      });

      // パターン2: 強制完成（targetDay以内のみ）
      if (day <= targetDay) {
        // 線形補間で目標BMDに到達
        const requiredBMD = currentBMD + (targetBMD - currentBMD) * 
                           ((day - currentDay) / (targetDay - currentDay));
        
        pattern2.push({
          day: day,
          bmd: requiredBMD,
          baume: requiredBMD / day,
          progress: ((maxBMD - requiredBMD) / (maxBMD - targetBMD)) * 100
        });
      }
    }

    // 結果をセット
    setPredictionResult({
      currentStatus: {
        progressDiff: progressDiff,
        status: progressDiff > 5 ? 'fast' : progressDiff < -5 ? 'slow' : 'normal'
      },
      pattern1: {
        name: '現状ペース継続',
        data: pattern1,
        finalDay: pattern1.find(p => p.baume <= targetBaume)?.day || targetDay + 5,
        finalBaume: pattern1[pattern1.length - 1]?.baume || 0
      },
      pattern2: {
        name: '目標日数厳守',
        data: pattern2,
        finalDay: targetDay,
        finalBaume: targetBaume
      },
      historicalData: historicalData,
      modelInfo: {
        name: selectedModel.name,
        type: selectedModel.type
      }
    });

    setShowGraph(true);
  };

  // グラフデータの準備
  const getChartData = () => {
    if (!predictionResult) return { datasets: [] };

    const datasets = [
      // 実績データ
      {
        label: '実績データ',
        data: predictionResult.historicalData,
        borderColor: '#10B981',
        backgroundColor: '#10B981',
        borderWidth: 3,
        pointRadius: 5,
        pointHoverRadius: 7,
        fill: false,
        tension: 0.1
      },
      // パターン1: 現状ペース継続
      {
        label: predictionResult.pattern1.name,
        data: predictionResult.pattern1.data.map(p => ({ x: p.day, y: p.bmd })),
        borderColor: '#EF4444',
        backgroundColor: '#EF444420',
        borderWidth: 2,
        borderDash: [5, 5],
        pointRadius: 3,
        fill: false,
        tension: 0.2
      },
      // パターン2: 目標日数厳守
      {
        label: predictionResult.pattern2.name,
        data: predictionResult.pattern2.data.map(p => ({ x: p.day, y: p.bmd })),
        borderColor: '#3B82F6',
        backgroundColor: '#3B82F620',
        borderWidth: 2,
        borderDash: [10, 5],
        pointRadius: 3,
        fill: false,
        tension: 0.2
      }
    ];

    return { datasets };
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      x: {
        type: 'linear',
        position: 'bottom',
        title: { display: true, text: '発酵日数' },
        grid: { color: '#e5e7eb' }
      },
      y: {
        title: { display: true, text: 'BMD値' },
        grid: { color: '#e5e7eb' }
      }
    },
    plugins: {
      legend: { position: 'bottom' },
      tooltip: {
        callbacks: {
          label: function(context) {
            const day = context.parsed.x;
            const bmd = context.parsed.y;
            const baume = (bmd / day).toFixed(2);
            return `${context.dataset.label}: BMD=${bmd.toFixed(1)}, ボーメ=${baume}度`;
          }
        }
      }
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="bg-white rounded-lg shadow-lg border border-gray-200 p-4">
        <h2 className="text-xl font-semibold mb-4 flex items-center">
          <Calculator className="w-6 h-6 mr-2 text-blue-600" />
          モデリング予測システム
        </h2>

        {/* モデル選択 */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            使用モデル選択
          </label>
          <select
            value={selectedModel?.id || ''}
            onChange={(e) => {
              const model = savedModels.find(m => m.id === e.target.value);
              setSelectedModel(model);
            }}
            className="w-full px-3 py-2 border border-gray-300 rounded-md"
          >
            <option value="">モデルを選択してください</option>
            {savedModels.map(model => (
              <option key={model.id} value={model.id}>
                {model.name} ({model.type === 'unified' ? '統合' : '個別'})
              </option>
            ))}
          </select>
        </div>

        {/* 予測条件入力 */}
        {selectedModel && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                現在日数
              </label>
              <input
                type="number"
                value={predictionInputs.currentDay}
                onChange={(e) => setPredictionInputs(prev => ({
                  ...prev, currentDay: e.target.value
                }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                placeholder="12"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                現在ボーメ
              </label>
              <input
                type="number"
                step="0.1"
                value={predictionInputs.currentBaume}
                onChange={(e) => setPredictionInputs(prev => ({
                  ...prev, currentBaume: e.target.value
                }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                placeholder="2.8"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                目標日数
              </label>
              <input
                type="number"
                value={predictionInputs.targetDay}
                onChange={(e) => setPredictionInputs(prev => ({
                  ...prev, targetDay: e.target.value
                }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                placeholder="26"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                目標ボーメ
              </label>
              <input
                type="number"
                step="0.1"
                value={predictionInputs.targetBaume}
                onChange={(e) => setPredictionInputs(prev => ({
                  ...prev, targetBaume: e.target.value
                }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                placeholder="-1.2"
              />
            </div>
          </div>
        )}

        {selectedModel && (
          <button
            onClick={calculatePrediction}
            className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            予測実行
          </button>
        )}
      </div>

      {/* 予測結果 */}
      {predictionResult && (
        <>
          {/* 結果サマリー */}
          <div className="bg-white rounded-lg shadow-lg border border-gray-200 p-4">
            <h3 className="text-lg font-semibold mb-4 flex items-center">
              <Target className="w-5 h-5 mr-2" />
              予測結果サマリー
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className={`p-4 rounded-lg ${
                predictionResult.currentStatus.status === 'normal' ? 'bg-green-50 border-green-200' :
                predictionResult.currentStatus.status === 'fast' ? 'bg-blue-50 border-blue-200' :
                'bg-yellow-50 border-yellow-200'
              }`}>
                <div className="font-medium">現在の状況</div>
                <div className="text-lg">
                  {predictionResult.currentStatus.status === 'normal' ? '順調' :
                   predictionResult.currentStatus.status === 'fast' ? `${predictionResult.currentStatus.progressDiff.toFixed(1)}%進み` :
                   `${Math.abs(predictionResult.currentStatus.progressDiff).toFixed(1)}%遅れ`}
                </div>
              </div>
              
              <div className="bg-red-50 border border-red-200 p-4 rounded-lg">
                <div className="font-medium">現状ペース継続</div>
                <div className="text-lg">
                  {predictionResult.pattern1.finalDay}日目完成
                </div>
                <div className="text-sm text-gray-600">
                  最終ボーメ: {predictionResult.pattern1.finalBaume.toFixed(2)}度
                </div>
              </div>
              
              <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg">
                <div className="font-medium">目標日数厳守</div>
                <div className="text-lg">
                  {predictionResult.pattern2.finalDay}日目完成
                </div>
                <div className="text-sm text-gray-600">
                  最終ボーメ: {predictionResult.pattern2.finalBaume.toFixed(2)}度
                </div>
              </div>
            </div>
          </div>

          {/* BMD推移グラフ */}
          {showGraph && (
            <div className="bg-white rounded-lg shadow-lg border border-gray-200 p-4">
              <h3 className="text-lg font-semibold mb-4 flex items-center">
                <TrendingUp className="w-5 h-5 mr-2" />
                BMD推移予測グラフ
              </h3>
              <div className="h-96">
                <Line data={getChartData()} options={chartOptions} />
              </div>
            </div>
          )}

          {/* 詳細予測テーブル */}
          <div className="bg-white rounded-lg shadow-lg border border-gray-200 p-4">
            <h3 className="text-lg font-semibold mb-4">詳細予測データ</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-2 text-left">日数</th>
                    <th className="px-3 py-2 text-right">現状ペース BMD</th>
                    <th className="px-3 py-2 text-right">現状ペース ボーメ</th>
                    <th className="px-3 py-2 text-right">目標厳守 BMD</th>
                    <th className="px-3 py-2 text-right">目標厳守 ボーメ</th>
                    <th className="px-3 py-2 text-right">差分</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {predictionResult.pattern1.data.slice(0, 10).map((p1, index) => {
                    const p2 = predictionResult.pattern2.data[index];
                    return (
                      <tr key={p1.day} className="hover:bg-gray-50">
                        <td className="px-3 py-2 font-medium">{p1.day}日</td>
                        <td className="px-3 py-2 text-right">{p1.bmd.toFixed(1)}</td>
                        <td className="px-3 py-2 text-right">{p1.baume.toFixed(2)}</td>
                        <td className="px-3 py-2 text-right">{p2?.bmd.toFixed(1) || '-'}</td>
                        <td className="px-3 py-2 text-right">{p2?.baume.toFixed(2) || '-'}</td>
                        <td className="px-3 py-2 text-right">
                          {p2 ? (p2.baume - p1.baume).toFixed(2) : '-'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {savedModels.length === 0 && (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <AlertTriangle className="w-12 h-12 mx-auto text-gray-400 mb-3" />
          <h3 className="text-lg font-medium text-gray-600 mb-2">保存済みモデルがありません</h3>
          <p className="text-gray-500">先に「進捗モデリング」でモデルを作成・保存してください</p>
        </div>
      )}
    </div>
  );
};

export default PredictionModeling;