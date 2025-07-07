// このコードを既存の src/components/PredictionModeling.jsx に置き換えてください

import React, { useState, useEffect } from 'react';
import { Line } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend } from 'chart.js';
import { Calculator, Target, TrendingUp, Info, BarChart3 } from 'lucide-react';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend);

const PredictionModeling = () => {
  const [savedModels, setSavedModels] = useState(() => {
    const saved = localStorage.getItem('fermentationModels');
    return saved ? JSON.parse(saved) : [
      // サンプルモデル（デモ用）
      {
        id: 'model_104_k701',
        name: 'タンク104 K-701モデル',
        type: 'individual',
        tankNumber: 104,
        yeast: 'K-701',
        createdAt: '2025-01-07',
        parameters: {
          maxBMD: 34.12,
          maxBMDDay: 8,
          finalBMD: -29.04,
          finalDay: 24,
          fermentationDays: 16
        },
        progressPattern: [
          { fermentationProgress: 0, progressRate: 0 },
          { fermentationProgress: 10, progressRate: 8 },
          { fermentationProgress: 20, progressRate: 18 },
          { fermentationProgress: 30, progressRate: 28 },
          { fermentationProgress: 40, progressRate: 38 },
          { fermentationProgress: 50, progressRate: 48 },
          { fermentationProgress: 60, progressRate: 58 },
          { fermentationProgress: 70, progressRate: 68 },
          { fermentationProgress: 80, progressRate: 78 },
          { fermentationProgress: 90, progressRate: 88 },
          { fermentationProgress: 100, progressRate: 100 }
        ]
      },
      {
        id: 'model_unified_k701',
        name: '統合K-701モデル',
        type: 'unified',
        yeast: 'K-701',
        createdAt: '2025-01-07',
        parameters: {
          avgMaxBMD: 35.5,
          avgFinalBMD: -28.2,
          avgFermentationDays: 17,
          sourceCount: 5
        },
        progressPattern: [
          { fermentationProgress: 0, progressRate: 0 },
          { fermentationProgress: 10, progressRate: 6 },
          { fermentationProgress: 20, progressRate: 15 },
          { fermentationProgress: 30, progressRate: 25 },
          { fermentationProgress: 40, progressRate: 35 },
          { fermentationProgress: 50, progressRate: 45 },
          { fermentationProgress: 60, progressRate: 55 },
          { fermentationProgress: 70, progressRate: 65 },
          { fermentationProgress: 80, progressRate: 75 },
          { fermentationProgress: 90, progressRate: 88 },
          { fermentationProgress: 100, progressRate: 100 }
        ]
      }
    ];
  });

  // 選択されたモデル
  const [selectedModel, setSelectedModel] = useState(null);
  
  // 基準設定
  const [baseSettings, setBaseSettings] = useState({
    maxBMD: '',
    maxBMDDay: '',
    finalBMD: '',
    finalDay: ''
  });

  // 理想曲線データ
  const [idealCurve, setIdealCurve] = useState([]);
  
  // 予測結果
  const [predictionResult, setPredictionResult] = useState(null);
  
  // 実測データ
  const [actualData, setActualData] = useState([]);
  
  // 新しい実測値入力
  const [newMeasurement, setNewMeasurement] = useState({
    day: '',
    actualBMD: ''
  });

  // モデルから進捗率を補間で取得する関数（改善版）
  const interpolateProgressFromModel = (fermentationProgress, model) => {
    if (!model || !model.progressPattern) {
      console.warn('モデルまたはprogressPatternが存在しません');
      return 0;
    }
    
    const pattern = model.progressPattern;
    console.log(`補間計算: 発酵進行度${fermentationProgress}%`);
    
    // 範囲チェック
    if (fermentationProgress < 0) {
      console.log('範囲外(下限): 0%を返す');
      return 0;
    }
    if (fermentationProgress > 100) {
      console.log('範囲外(上限): 100%を返す');
      return 100;
    }
    
    // 完全一致を探す（より厳密に）
    const exactMatch = pattern.find(p => Math.abs(p.fermentationProgress - fermentationProgress) < 0.01);
    if (exactMatch) {
      console.log(`完全一致: ${exactMatch.progressRate}%`);
      return exactMatch.progressRate;
    }
    
    // 前後のポイントを探して線形補間
    let before = null, after = null;
    
    for (let i = 0; i < pattern.length - 1; i++) {
      if (pattern[i].fermentationProgress <= fermentationProgress && 
          pattern[i + 1].fermentationProgress >= fermentationProgress) {
        before = pattern[i];
        after = pattern[i + 1];
        console.log(`補間範囲: ${before.fermentationProgress}%-${after.fermentationProgress}%`);
        break;
      }
    }
    
    // 前後が見つからない場合の詳細処理
    if (!before || !after) {
      console.warn(`補間範囲が見つかりません。発酵進行度: ${fermentationProgress}%`);
      console.log('パターン配列:', pattern.map(p => `${p.fermentationProgress}%->${p.progressRate}%`));
      
      // より安全な最近値検索
      let closest = pattern[0];
      let minDistance = Math.abs(pattern[0].fermentationProgress - fermentationProgress);
      
      for (let i = 1; i < pattern.length; i++) {
        const distance = Math.abs(pattern[i].fermentationProgress - fermentationProgress);
        if (distance < minDistance) {
          minDistance = distance;
          closest = pattern[i];
        }
      }
      
      console.log(`最近値使用: ${closest.fermentationProgress}%->${closest.progressRate}%`);
      return closest.progressRate;
    }
    
    // 線形補間計算
    const ratio = (fermentationProgress - before.fermentationProgress) / 
                 (after.fermentationProgress - before.fermentationProgress);
    const result = before.progressRate + (after.progressRate - before.progressRate) * ratio;
    
    console.log(`補間計算: ${before.progressRate}% + (${after.progressRate}% - ${before.progressRate}%) × ${ratio.toFixed(3)} = ${result.toFixed(1)}%`);
    
    // 結果の妥当性チェック
    if (result < 0 || result > 100) {
      console.warn(`補間結果が範囲外: ${result}% → 制限適用`);
      return Math.max(0, Math.min(100, result));
    }
    
    return result;
  };

  // 理想曲線を作成
  const createIdealCurve = () => {
    if (!selectedModel || !baseSettings.maxBMD || !baseSettings.finalBMD || 
        !baseSettings.maxBMDDay || !baseSettings.finalDay) {
      return;
    }

    const maxBMD = parseFloat(baseSettings.maxBMD);
    const finalBMD = parseFloat(baseSettings.finalBMD);
    const maxBMDDay = parseInt(baseSettings.maxBMDDay);
    const finalDay = parseInt(baseSettings.finalDay);

    const curve = [];
    
    for (let day = maxBMDDay; day <= finalDay; day++) {
      // 発酵進行度 (0-100%)
      const fermentationProgress = ((day - maxBMDDay) / (finalDay - maxBMDDay)) * 100;
      
      // モデルから期待進捗率を取得
      const expectedProgressRate = interpolateProgressFromModel(fermentationProgress, selectedModel);
      
      // 修正版：正しい理想BMDを計算
      const idealBMD = maxBMD - (maxBMD - finalBMD) * (expectedProgressRate / 100);
      const idealBaume = idealBMD / day;
      
      curve.push({
        day,
        fermentationProgress: fermentationProgress.toFixed(1),
        expectedProgressRate: expectedProgressRate.toFixed(1),
        idealBMD: idealBMD.toFixed(2),
        idealBaume: idealBaume.toFixed(3)
      });
    }

    setIdealCurve(curve);
  };

  // 実測データを追加
  const addActualMeasurement = () => {
    if (!newMeasurement.day || !newMeasurement.actualBMD) return;

    const day = parseInt(newMeasurement.day);
    const actualBMD = parseFloat(newMeasurement.actualBMD);
    const actualBaume = (actualBMD / day).toFixed(3);

    // 理想値を取得
    const idealPoint = idealCurve.find(p => p.day === day);
    let difference = null;
    let status = '';

    if (idealPoint) {
      difference = (actualBMD - parseFloat(idealPoint.idealBMD)).toFixed(2);
      const diffNum = parseFloat(difference);
      status = diffNum > 2 ? '大幅遅れ' : diffNum > 0.5 ? '遅れ' : diffNum < -2 ? '大幅進み' : diffNum < -0.5 ? '進み' : '順調';
    }

    const newData = {
      day,
      actualBMD: actualBMD.toFixed(2),
      actualBaume,
      idealBMD: idealPoint?.idealBMD || null,
      idealBaume: idealPoint?.idealBaume || null,
      difference,
      status
    };

    setActualData(prev => [...prev.filter(d => d.day !== day), newData].sort((a, b) => a.day - b.day));
    setNewMeasurement({ day: '', actualBMD: '' });
    
    // 実測データが追加されたら予測を自動実行
    if (actualData.length >= 0) {
      calculatePrediction();
    }
  };

  // 予測計算
  const calculatePrediction = () => {
    if (!idealCurve || actualData.length === 0) return;

    const maxBMD = parseFloat(baseSettings.maxBMD);
    const finalBMD = parseFloat(baseSettings.finalBMD);
    const maxBMDDay = parseInt(baseSettings.maxBMDDay);
    const finalDay = parseInt(baseSettings.finalDay);

    // 最新の実測データ
    const latestData = actualData[actualData.length - 1];
    const currentDay = latestData.day;
    const currentBMD = parseFloat(latestData.actualBMD);

    // 現在の理想値
    const idealPoint = idealCurve.find(p => p.day === currentDay);
    if (!idealPoint) return;

    const idealBMD = parseFloat(idealPoint.idealBMD);
    const bmdDifference = currentBMD - idealBMD;
    
    // 発酵完了率の差分計算
    const currentActualProgress = ((maxBMD - currentBMD) / (maxBMD - finalBMD)) * 100;
    const currentExpectedProgress = parseFloat(idealPoint.expectedProgressRate);
    const progressDiff = currentActualProgress - currentExpectedProgress;

    // 現在の状況分析
    let status = 'normal';
    if (progressDiff > 10) status = 'fast';
    else if (progressDiff < -10) status = 'slow';

    // パターンA: 現状ペース継続
    const patternA = [];
    let completionDayA = finalDay;

    for (let day = currentDay + 1; day <= finalDay + 10; day++) {
      const timeProgress = ((day - maxBMDDay) / (finalDay - maxBMDDay)) * 100;
      const expectedProgress = interpolateProgressFromModel(timeProgress, selectedModel);
      const adjustedProgress = Math.max(0, Math.min(100, expectedProgress + progressDiff));
      
      const predictedBMD = maxBMD - (maxBMD - finalBMD) * (adjustedProgress / 100);
      
      patternA.push({
        day,
        predictedBMD: predictedBMD.toFixed(2),
        predictedBaume: (predictedBMD / day).toFixed(3),
        progress: adjustedProgress.toFixed(1)
      });

      if (predictedBMD <= finalBMD && completionDayA === finalDay) {
        completionDayA = day;
      }
    }

    // パターンB: 目標日数厳守
    const patternB = [];
    const remainingDays = finalDay - currentDay;
    const remainingBMDChange = finalBMD - currentBMD;

    for (let day = currentDay + 1; day <= finalDay; day++) {
      const progressRatio = (day - currentDay) / remainingDays;
      const requiredBMD = currentBMD + remainingBMDChange * progressRatio;

      patternB.push({
        day,
        predictedBMD: requiredBMD.toFixed(2),
        predictedBaume: (requiredBMD / day).toFixed(3)
      });
    }

    setPredictionResult({
      currentStatus: {
        bmdDifference: bmdDifference.toFixed(2),
        progressDiff: progressDiff.toFixed(1),
        status: status
      },
      patternA: {
        name: '現状ペース継続',
        data: patternA,
        completionDay: completionDayA,
        finalBaume: patternA.length > 0 ? patternA[patternA.length - 1].predictedBaume : '0.000'
      },
      patternB: {
        name: '目標日数厳守',
        data: patternB,
        completionDay: finalDay,
        finalBaume: patternB.length > 0 ? patternB[patternB.length - 1].predictedBaume : '0.000'
      }
    });
  };
  const getChartData = () => {
    const datasets = [];

    // 理想曲線（BMD）
    if (idealCurve.length > 0) {
      datasets.push({
        label: '理想BMD',
        data: idealCurve.map(p => ({ x: p.day, y: parseFloat(p.idealBMD) })),
        borderColor: '#10B981',
        backgroundColor: '#10B981',
        borderWidth: 3,
        fill: false,
        tension: 0.3,
        pointRadius: 3
      });
    }

    // 実測データ（BMD）
    if (actualData.length > 0) {
      datasets.push({
        label: '実測BMD',
        data: actualData.map(d => ({ x: d.day, y: parseFloat(d.actualBMD) })),
        borderColor: '#3B82F6',
        backgroundColor: '#3B82F6',
        borderWidth: 0,
        pointRadius: 4,
        pointHoverRadius: 6,
        showLine: false
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
      legend: { position: 'top' },
      tooltip: {
        callbacks: {
          label: function(context) {
            const day = context.parsed.x;
            const bmd = context.parsed.y;
            const baume = (bmd / day).toFixed(3);
            return `${context.dataset.label}: BMD=${bmd}, ボーメ=${baume}度`;
          }
        }
      }
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="bg-white rounded-lg shadow-lg border border-gray-200 p-6">
        <h1 className="text-2xl font-bold mb-6 flex items-center">
          <Calculator className="w-7 h-7 mr-3 text-blue-600" />
          発酵予測システム
        </h1>

        {/* ステップ1: モデル選択 */}
        <div className="mb-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center">
            <Target className="w-5 h-5 mr-2 text-green-600" />
            ステップ1: 予測モデル選択
          </h2>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                使用するモデル
              </label>
              <select
                value={selectedModel?.id || ''}
                onChange={(e) => {
                  const model = savedModels.find(m => m.id === e.target.value);
                  setSelectedModel(model);
                  setIdealCurve([]);
                  setActualData([]);
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
              >
                <option value="">モデルを選択してください</option>
                {savedModels.map(model => (
                  <option key={model.id} value={model.id}>
                    {model.name} ({model.type === 'unified' ? '統合' : '個別'})
                  </option>
                ))}
              </select>
            </div>

            {/* 選択されたモデルの詳細表示 */}
            {selectedModel && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h3 className="font-semibold text-blue-800 mb-2 flex items-center">
                  <Info className="w-4 h-4 mr-1" />
                  モデル詳細
                </h3>
                <div className="text-sm space-y-1">
                  <div><strong>名前:</strong> {selectedModel.name}</div>
                  <div><strong>作成日:</strong> {selectedModel.createdAt}</div>
                  <div><strong>酵母:</strong> {selectedModel.yeast}</div>
                  
                  {selectedModel.type === 'individual' ? (
                    <>
                      <div><strong>タンク番号:</strong> {selectedModel.tankNumber}</div>
                      <div><strong>発酵日数:</strong> {selectedModel.parameters.fermentationDays}日</div>
                    </>
                  ) : (
                    <>
                      <div><strong>統合タンク数:</strong> {selectedModel.parameters.sourceCount}個</div>
                      <div><strong>平均発酵日数:</strong> {selectedModel.parameters.avgFermentationDays.toFixed(1)}日</div>
                    </>
                  )}
                  
                  <div className="mt-2 pt-2 border-t border-blue-300">
                    <div><strong>参考BMD範囲:</strong></div>
                    <div className="ml-2">
                      最高: {selectedModel.type === 'individual' ? 
                        selectedModel.parameters.maxBMD : 
                        selectedModel.parameters.avgMaxBMD.toFixed(1)}
                    </div>
                    <div className="ml-2">
                      最終: {selectedModel.type === 'individual' ? 
                        selectedModel.parameters.finalBMD : 
                        selectedModel.parameters.avgFinalBMD.toFixed(1)}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ステップ2: 基準設定 */}
        {selectedModel && (
          <div className="mb-6">
            <h2 className="text-lg font-semibold mb-4 flex items-center">
              <TrendingUp className="w-5 h-5 mr-2 text-purple-600" />
              ステップ2: 発酵基準設定
            </h2>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  最高BMD
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={baseSettings.maxBMD}
                  onChange={(e) => setBaseSettings(prev => ({ ...prev, maxBMD: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                  placeholder="35.0"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  最高BMD日
                </label>
                <input
                  type="number"
                  value={baseSettings.maxBMDDay}
                  onChange={(e) => setBaseSettings(prev => ({ ...prev, maxBMDDay: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                  placeholder="8"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  最終BMD
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={baseSettings.finalBMD}
                  onChange={(e) => setBaseSettings(prev => ({ ...prev, finalBMD: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                  placeholder="-30.0"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  最終日
                </label>
                <input
                  type="number"
                  value={baseSettings.finalDay}
                  onChange={(e) => setBaseSettings(prev => ({ ...prev, finalDay: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                  placeholder="26"
                />
              </div>
            </div>

            <button
              onClick={createIdealCurve}
              disabled={!selectedModel || !baseSettings.maxBMD || !baseSettings.finalBMD || 
                       !baseSettings.maxBMDDay || !baseSettings.finalDay}
              className="w-full px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              理想発酵曲線を作成
            </button>
          </div>
        )}

        {/* ステップ3: 理想曲線表示と実測値入力 */}
        {idealCurve.length > 0 && (
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            {/* 理想発酵進捗表 */}
            <div className="xl:col-span-2">
              <h3 className="text-lg font-semibold mb-4 flex items-center">
                <BarChart3 className="w-5 h-5 mr-2 text-green-600" />
                理想発酵進捗表
              </h3>
              
              <div className="overflow-x-auto bg-gray-50 rounded-lg">
                <table className="w-full text-sm">
                  <thead className="bg-green-100">
                    <tr>
                      <th className="px-3 py-2 text-left">日数</th>
                      <th className="px-3 py-2 text-right">時間進行度</th>
                      <th className="px-3 py-2 text-right">発酵完了率</th>
                      <th className="px-3 py-2 text-right">理想BMD</th>
                      <th className="px-3 py-2 text-right">理想ボーメ</th>
                      <th className="px-3 py-2 text-center">実測BMD</th>
                      <th className="px-3 py-2 text-center">差分</th>
                      <th className="px-3 py-2 text-center">状況</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {idealCurve.map((point) => {
                      const actualPoint = actualData.find(a => a.day === point.day);
                      return (
                        <tr key={point.day} className={`hover:bg-gray-50 ${actualPoint ? 'bg-blue-50' : ''}`}>
                          <td className="px-3 py-2 font-medium">{point.day}日</td>
                          <td className="px-3 py-2 text-right">{point.fermentationProgress}%</td>
                          <td className="px-3 py-2 text-right">{point.expectedProgressRate}%</td>
                          <td className="px-3 py-2 text-right font-mono">{point.idealBMD}</td>
                          <td className="px-3 py-2 text-right font-mono">{point.idealBaume}</td>
                          <td className="px-3 py-2 text-center font-mono">
                            {actualPoint ? actualPoint.actualBMD : '-'}
                          </td>
                          <td className="px-3 py-2 text-center font-mono">
                            {actualPoint ? (
                              <span className={`${
                                parseFloat(actualPoint.difference) > 0 ? 'text-red-600' : 
                                parseFloat(actualPoint.difference) < 0 ? 'text-blue-600' : 'text-green-600'
                              }`}>
                                {actualPoint.difference > 0 ? '+' : ''}{actualPoint.difference}
                              </span>
                            ) : '-'}
                          </td>
                          <td className="px-3 py-2 text-center">
                            {actualPoint ? (
                              <span className={`px-2 py-1 rounded text-xs ${
                                actualPoint.status === '大幅遅れ' ? 'bg-red-200 text-red-800' :
                                actualPoint.status === '遅れ' ? 'bg-orange-200 text-orange-800' :
                                actualPoint.status === '大幅進み' ? 'bg-blue-200 text-blue-800' :
                                actualPoint.status === '進み' ? 'bg-cyan-200 text-cyan-800' :
                                'bg-green-200 text-green-800'
                              }`}>
                                {actualPoint.status}
                              </span>
                            ) : '-'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* 右側: グラフと実測値入力 */}
            <div className="space-y-6">
              {/* 実測値入力 */}
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <h4 className="font-semibold text-yellow-800 mb-3">実測データ入力</h4>
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      日数
                    </label>
                    <input
                      type="number"
                      value={newMeasurement.day}
                      onChange={(e) => setNewMeasurement(prev => ({ ...prev, day: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-yellow-500"
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
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-yellow-500"
                      placeholder="33.6"
                    />
                  </div>
                  <button
                    onClick={addActualMeasurement}
                    disabled={!newMeasurement.day || !newMeasurement.actualBMD}
                    className="w-full px-4 py-2 bg-yellow-600 text-white rounded-md hover:bg-yellow-700 disabled:bg-gray-400"
                  >
                    データ追加
                  </button>
                </div>
              </div>

              {/* BMD推移グラフ */}
              <div className="bg-white border border-gray-200 rounded-lg p-4">
                <h4 className="font-semibold text-gray-800 mb-3">理想BMD経過グラフ</h4>
                <div className="h-64">
                  <Line data={getChartData()} options={chartOptions} />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 予測結果表示 */}
        {predictionResult && (
          <div className="mt-6">
            {/* 予測サマリー */}
            <div className="bg-white border border-gray-200 rounded-lg p-4 mb-4">
              <h3 className="text-lg font-semibold mb-4 flex items-center">
                <TrendingUp className="w-5 h-5 mr-2 text-purple-600" />
                予測結果
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className={`p-4 rounded-lg ${
                  predictionResult.currentStatus.status === 'normal' ? 'bg-green-50 border-green-200' :
                  predictionResult.currentStatus.status === 'fast' ? 'bg-blue-50 border-blue-200' :
                  'bg-orange-50 border-orange-200'
                } border`}>
                  <div className="font-medium">現在の状況</div>
                  <div className="text-lg">
                    BMD差分: {predictionResult.currentStatus.bmdDifference > 0 ? '+' : ''}{predictionResult.currentStatus.bmdDifference}
                  </div>
                  <div className="text-sm">
                    {predictionResult.currentStatus.status === 'normal' ? '順調' :
                     predictionResult.currentStatus.status === 'fast' ? `${predictionResult.currentStatus.progressDiff}%進み` :
                     `${Math.abs(predictionResult.currentStatus.progressDiff)}%遅れ`}
                  </div>
                </div>
                
                <div className="bg-red-50 border border-red-200 p-4 rounded-lg">
                  <div className="font-medium">現状ペース継続</div>
                  <div className="text-lg">
                    {predictionResult.patternA.completionDay}日目完成
                  </div>
                  <div className="text-sm text-gray-600">
                    最終ボーメ: {predictionResult.patternA.finalBaume}度
                  </div>
                </div>
                
                <div className="bg-purple-50 border border-purple-200 p-4 rounded-lg">
                  <div className="font-medium">目標日数厳守</div>
                  <div className="text-lg">
                    {predictionResult.patternB.completionDay}日目完成
                  </div>
                  <div className="text-sm text-gray-600">
                    最終ボーメ: {predictionResult.patternB.finalBaume}度
                  </div>
                </div>
              </div>
            </div>

            {/* 予測詳細表 */}
            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <h4 className="font-semibold text-gray-800 mb-3">予測詳細表</h4>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="px-3 py-2 text-left">日数</th>
                      <th className="px-3 py-2 text-right">現状ペース BMD</th>
                      <th className="px-3 py-2 text-right">現状ペース ボーメ</th>
                      <th className="px-3 py-2 text-right">目標厳守 BMD</th>
                      <th className="px-3 py-2 text-right">目標厳守 ボーメ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {predictionResult.patternA.data.slice(0, 10).map((pointA, index) => {
                      const pointB = predictionResult.patternB.data.find(p => p.day === pointA.day);
                      return (
                        <tr key={pointA.day} className="hover:bg-gray-50">
                          <td className="px-3 py-2 font-medium">{pointA.day}日</td>
                          <td className="px-3 py-2 text-right font-mono">{pointA.predictedBMD}</td>
                          <td className="px-3 py-2 text-right font-mono">{pointA.predictedBaume}</td>
                          <td className="px-3 py-2 text-right font-mono">{pointB ? pointB.predictedBMD : '-'}</td>
                          <td className="px-3 py-2 text-right font-mono">{pointB ? pointB.predictedBaume : '-'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 保存済みモデルがない場合 */}
      {savedModels.length === 0 && (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <Calculator className="w-12 h-12 mx-auto text-gray-400 mb-3" />
          <h3 className="text-lg font-medium text-gray-600 mb-2">保存済みモデルがありません</h3>
          <p className="text-gray-500">先に「進捗モデリング」でモデルを作成・保存してください</p>
        </div>
      )}
    </div>
  );
};

export default PredictionModeling;