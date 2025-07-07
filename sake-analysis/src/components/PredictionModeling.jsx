import React, { useState, useEffect } from 'react';
import { Line } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend } from 'chart.js';
import { Calculator, Target, TrendingUp, AlertTriangle, Plus } from 'lucide-react';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend);

const PredictionModeling = () => {
  const [savedModels, setSavedModels] = useState(() => {
    const saved = localStorage.getItem('fermentationModels');
    return saved ? JSON.parse(saved) : [];
  });

  // 基準設定
  const [targetSettings, setTargetSettings] = useState({
    selectedModel: null,
    maxBMD: '',
    maxBMDDay: '',
    finalBMD: '',
    finalDay: ''
  });

  // 理想曲線データ
  const [idealCurve, setIdealCurve] = useState(null);
  
  // 実測データ
  const [actualData, setActualData] = useState([]);
  
  // 新しい実測値入力
  const [newMeasurement, setNewMeasurement] = useState({
    day: '',
    actualBMD: ''
  });

  // 予測結果
  const [predictionResult, setPredictionResult] = useState(null);

  // ステップ管理
  const [currentStep, setCurrentStep] = useState(1); // 1: 基準設定, 2: 実測入力, 3: 予測結果

  // モデルから進捗率を補間で取得する関数
  const interpolateProgressFromModel = (fermentationProgress, model) => {
    if (!model || !model.progressPattern) return fermentationProgress;
    
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

  // 理想曲線を作成
  const createIdealCurve = () => {
    if (!targetSettings.selectedModel || !targetSettings.maxBMD || !targetSettings.finalBMD || 
        !targetSettings.maxBMDDay || !targetSettings.finalDay) {
      return;
    }

    const maxBMD = parseFloat(targetSettings.maxBMD);
    const finalBMD = parseFloat(targetSettings.finalBMD);
    const maxBMDDay = parseInt(targetSettings.maxBMDDay);
    const finalDay = parseInt(targetSettings.finalDay);

    const curve = [];
    
    for (let day = maxBMDDay; day <= finalDay; day++) {
      // 発酵進行度 (0-100%)
      const fermentationProgress = ((day - maxBMDDay) / (finalDay - maxBMDDay)) * 100;
      
      // モデルから期待進捗率を取得
      const expectedProgressRate = interpolateProgressFromModel(fermentationProgress, targetSettings.selectedModel);
      
      // 理想BMDを計算
      const idealBMD = finalBMD + (maxBMD - finalBMD) * (1 - expectedProgressRate / 100);
      const idealBaume = idealBMD / day;
      
      curve.push({
        day,
        fermentationProgress,
        expectedProgressRate,
        idealBMD,
        idealBaume
      });
    }

    setIdealCurve(curve);
    setCurrentStep(2);
  };

  // 実測データを追加
  const addActualMeasurement = () => {
    if (!newMeasurement.day || !newMeasurement.actualBMD) return;

    const day = parseInt(newMeasurement.day);
    const actualBMD = parseFloat(newMeasurement.actualBMD);
    const actualBaume = actualBMD / day;

    // 理想値を取得
    const idealPoint = idealCurve?.find(p => p.day === day);
    let difference = null;
    let status = '';

    if (idealPoint) {
      difference = actualBMD - idealPoint.idealBMD;
      status = difference > 0 ? '遅れ' : difference < 0 ? '進み' : '順調';
    }

    const newData = {
      day,
      actualBMD,
      actualBaume,
      idealBMD: idealPoint?.idealBMD || null,
      difference,
      status
    };

    setActualData(prev => [...prev.filter(d => d.day !== day), newData].sort((a, b) => a.day - b.day));
    setNewMeasurement({ day: '', actualBMD: '' });
  };

  // 予測計算
  const calculatePrediction = () => {
    if (!idealCurve || actualData.length === 0) return;

    const maxBMD = parseFloat(targetSettings.maxBMD);
    const finalBMD = parseFloat(targetSettings.finalBMD);
    const finalDay = parseInt(targetSettings.finalDay);

    // 最新の実測データ
    const latestData = actualData[actualData.length - 1];
    const currentDay = latestData.day;
    const currentBMD = latestData.actualBMD;

    // 現在の遅れ/進みを計算
    const idealPoint = idealCurve.find(p => p.day === currentDay);
    if (!idealPoint) return;

    const currentActualProgress = (maxBMD - currentBMD) / (maxBMD - finalBMD) * 100;
    const currentExpectedProgress = idealPoint.expectedProgressRate;
    const progressDiff = currentActualProgress - currentExpectedProgress;

    // パターンA: 現状ペース継続
    const patternA = [];
    let completionDayA = null;

    for (let day = currentDay + 1; day <= finalDay + 10; day++) {
      const fermentationProgress = ((day - parseInt(targetSettings.maxBMDDay)) / (finalDay - parseInt(targetSettings.maxBMDDay))) * 100;
      const standardProgress = interpolateProgressFromModel(fermentationProgress, targetSettings.selectedModel);
      const adjustedProgress = Math.max(0, Math.min(100, standardProgress + progressDiff));
      
      const predictedBMD = finalBMD + (maxBMD - finalBMD) * (1 - adjustedProgress / 100);
      const predictedBaume = predictedBMD / day;

      patternA.push({
        day,
        predictedBMD,
        predictedBaume,
        progress: adjustedProgress
      });

      if (predictedBMD <= finalBMD && !completionDayA) {
        completionDayA = day;
      }
    }

    // パターンB: 目標日数厳守
    const patternB = [];
    for (let day = currentDay + 1; day <= finalDay; day++) {
      const progressRatio = (day - currentDay) / (finalDay - currentDay);
      const requiredBMD = currentBMD + (finalBMD - currentBMD) * progressRatio;
      const requiredBaume = requiredBMD / day;

      patternB.push({
        day,
        predictedBMD: requiredBMD,
        predictedBaume: requiredBaume
      });
    }

    setPredictionResult({
      currentStatus: {
        progressDiff: progressDiff,
        status: progressDiff > 5 ? 'fast' : progressDiff < -5 ? 'slow' : 'normal'
      },
      patternA: {
        name: '現状ペース継続',
        data: patternA,
        completionDay: completionDayA || finalDay + 5,
        finalBaume: patternA[patternA.length - 1]?.predictedBaume || 0
      },
      patternB: {
        name: '目標日数厳守',
        data: patternB,
        completionDay: finalDay,
        finalBaume: finalBMD / finalDay
      }
    });

    setCurrentStep(3);
  };

  // グラフデータの準備
  const getChartData = () => {
    const datasets = [];

    // 理想曲線
    if (idealCurve) {
      datasets.push({
        label: '理想曲線',
        data: idealCurve.map(p => ({ x: p.day, y: p.idealBMD })),
        borderColor: '#10B981',
        backgroundColor: '#10B981',
        borderWidth: 3,
        fill: false,
        tension: 0.3
      });
    }

    // 実測データ
    if (actualData.length > 0) {
      datasets.push({
        label: '実測値',
        data: actualData.map(d => ({ x: d.day, y: d.actualBMD })),
        borderColor: '#3B82F6',
        backgroundColor: '#3B82F6',
        borderWidth: 0,
        pointRadius: 8,
        pointHoverRadius: 10,
        showLine: false
      });
    }

    // 予測線
    if (predictionResult) {
      // パターンA
      datasets.push({
        label: predictionResult.patternA.name,
        data: predictionResult.patternA.data.map(p => ({ x: p.day, y: p.predictedBMD })),
        borderColor: '#EF4444',
        backgroundColor: '#EF444420',
        borderWidth: 2,
        borderDash: [5, 5],
        fill: false,
        tension: 0.2
      });

      // パターンB
      datasets.push({
        label: predictionResult.patternB.name,
        data: predictionResult.patternB.data.map(p => ({ x: p.day, y: p.predictedBMD })),
        borderColor: '#8B5CF6',
        backgroundColor: '#8B5CF620',
        borderWidth: 2,
        borderDash: [10, 5],
        fill: false,
        tension: 0.2
      });
    }

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
      {/* ステップ1: 基準設定 */}
      {currentStep >= 1 && (
        <div className="bg-white rounded-lg shadow-lg border border-gray-200 p-4">
          <h2 className="text-xl font-semibold mb-4 flex items-center">
            <Target className="w-6 h-6 mr-2 text-blue-600" />
            ステップ1: 発酵基準設定
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                使用モデル
              </label>
              <select
                value={targetSettings.selectedModel?.id || ''}
                onChange={(e) => {
                  const model = savedModels.find(m => m.id === e.target.value);
                  setTargetSettings(prev => ({ ...prev, selectedModel: model }));
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

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  最高BMD
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={targetSettings.maxBMD}
                  onChange={(e) => setTargetSettings(prev => ({ ...prev, maxBMD: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  placeholder="35.0"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  最高BMD日
                </label>
                <input
                  type="number"
                  value={targetSettings.maxBMDDay}
                  onChange={(e) => setTargetSettings(prev => ({ ...prev, maxBMDDay: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  placeholder="8"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  最終BMD
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={targetSettings.finalBMD}
                  onChange={(e) => setTargetSettings(prev => ({ ...prev, finalBMD: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  placeholder="-30.0"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  最終日
                </label>
                <input
                  type="number"
                  value={targetSettings.finalDay}
                  onChange={(e) => setTargetSettings(prev => ({ ...prev, finalDay: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  placeholder="26"
                />
              </div>
            </div>
          </div>

          <button
            onClick={createIdealCurve}
            disabled={!targetSettings.selectedModel || !targetSettings.maxBMD || !targetSettings.finalBMD}
            className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400"
          >
            基準曲線を作成
          </button>
        </div>
      )}

      {/* 理想曲線表示 */}
      {idealCurve && (
        <div className="bg-white rounded-lg shadow-lg border border-gray-200 p-4">
          <h3 className="text-lg font-semibold mb-4">理想発酵曲線</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left">日数</th>
                  <th className="px-3 py-2 text-right">発酵進行度</th>
                  <th className="px-3 py-2 text-right">期待進捗率</th>
                  <th className="px-3 py-2 text-right">理想BMD</th>
                  <th className="px-3 py-2 text-right">理想ボーメ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {idealCurve.map((point) => (
                  <tr key={point.day} className="hover:bg-gray-50">
                    <td className="px-3 py-2 font-medium">{point.day}日</td>
                    <td className="px-3 py-2 text-right">{point.fermentationProgress.toFixed(1)}%</td>
                    <td className="px-3 py-2 text-right">{point.expectedProgressRate.toFixed(1)}%</td>
                    <td className="px-3 py-2 text-right">{point.idealBMD.toFixed(1)}</td>
                    <td className="px-3 py-2 text-right">{point.idealBaume.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ステップ2: 実測データ入力 */}
      {currentStep >= 2 && (
        <div className="bg-white rounded-lg shadow-lg border border-gray-200 p-4">
          <h2 className="text-xl font-semibold mb-4 flex items-center">
            <Plus className="w-6 h-6 mr-2 text-green-600" />
            ステップ2: 実測データ入力
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                日数
              </label>
              <input
                type="number"
                value={newMeasurement.day}
                onChange={(e) => setNewMeasurement(prev => ({ ...prev, day: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                placeholder="12"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                実測BMD
              </label>
              <input
                type="number"
                step="0.1"
                value={newMeasurement.actualBMD}
                onChange={(e) => setNewMeasurement(prev => ({ ...prev, actualBMD: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                placeholder="33.6"
              />
            </div>
            <div className="flex items-end">
              <button
                onClick={addActualMeasurement}
                disabled={!newMeasurement.day || !newMeasurement.actualBMD}
                className="w-full px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:bg-gray-400"
              >
                データ追加
              </button>
            </div>
          </div>

          {/* 実測データ一覧 */}
          {actualData.length > 0 && (
            <div className="mb-4">
              <h4 className="font-semibold mb-2">実測データ</h4>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-2 text-left">日数</th>
                      <th className="px-3 py-2 text-right">実測BMD</th>
                      <th className="px-3 py-2 text-right">理想BMD</th>
                      <th className="px-3 py-2 text-right">差分</th>
                      <th className="px-3 py-2 text-center">状況</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {actualData.map((data) => (
                      <tr key={data.day} className="hover:bg-gray-50">
                        <td className="px-3 py-2 font-medium">{data.day}日</td>
                        <td className="px-3 py-2 text-right">{data.actualBMD.toFixed(1)}</td>
                        <td className="px-3 py-2 text-right">{data.idealBMD?.toFixed(1) || '-'}</td>
                        <td className="px-3 py-2 text-right">
                          {data.difference ? (data.difference > 0 ? '+' : '') + data.difference.toFixed(1) : '-'}
                        </td>
                        <td className="px-3 py-2 text-center">
                          <span className={`px-2 py-1 rounded text-xs ${
                            data.status === '遅れ' ? 'bg-red-100 text-red-800' :
                            data.status === '進み' ? 'bg-blue-100 text-blue-800' :
                            'bg-green-100 text-green-800'
                          }`}>
                            {data.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {actualData.length > 0 && (
            <button
              onClick={calculatePrediction}
              className="w-full px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700"
            >
              予測を実行
            </button>
          )}
        </div>
      )}

      {/* ステップ3: 予測結果 */}
      {predictionResult && currentStep >= 3 && (
        <>
          {/* 予測サマリー */}
          <div className="bg-white rounded-lg shadow-lg border border-gray-200 p-4">
            <h2 className="text-xl font-semibold mb-4 flex items-center">
              <TrendingUp className="w-6 h-6 mr-2 text-purple-600" />
              ステップ3: 予測結果
            </h2>
            
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
                  {predictionResult.patternA.completionDay}日目完成
                </div>
                <div className="text-sm text-gray-600">
                  最終ボーメ: {predictionResult.patternA.finalBaume.toFixed(2)}度
                </div>
              </div>
              
              <div className="bg-purple-50 border border-purple-200 p-4 rounded-lg">
                <div className="font-medium">目標日数厳守</div>
                <div className="text-lg">
                  {predictionResult.patternB.completionDay}日目完成
                </div>
                <div className="text-sm text-gray-600">
                  最終ボーメ: {predictionResult.patternB.finalBaume.toFixed(2)}度
                </div>
              </div>
            </div>
          </div>

          {/* BMD推移グラフ */}
          <div className="bg-white rounded-lg shadow-lg border border-gray-200 p-4">
            <h3 className="text-lg font-semibold mb-4">BMD推移予測グラフ</h3>
            <div className="h-96">
              <Line data={getChartData()} options={chartOptions} />
            </div>
          </div>
        </>
      )}

      {/* 保存済みモデルがない場合 */}
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