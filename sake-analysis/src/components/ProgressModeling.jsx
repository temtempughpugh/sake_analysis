import React, { useState, useEffect } from 'react';
import { Line } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend } from 'chart.js';
import { TrendingUp, Database, Calculator, BarChart3 } from 'lucide-react';
import { COLUMN_NAMES } from '../utils/csvParser';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend);

const colorPalette = [
  '#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8',
  '#F7DC6F', '#BB8FCE', '#85C1E2', '#FF99CC', '#66CCCC',
];

const ProgressModeling = ({ tanks = [], selectedTankIds = [] }) => {
  const [selectedTanksForModeling, setSelectedTanksForModeling] = useState([]);
  const [progressData, setProgressData] = useState([]);
  const [tankAnalysis, setTankAnalysis] = useState([]);
  const [showRawBMD, setShowRawBMD] = useState(false);
  const [unifiedPattern, setUnifiedPattern] = useState(null);
  const [patternMethod, setPatternMethod] = useState('fermentation_progress'); // デフォルトを発酵進行度ベースに
  const [savedModels, setSavedModels] = useState(() => {
    const saved = localStorage.getItem('fermentationModels');
    return saved ? JSON.parse(saved) : [];
  });
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [saveTarget, setSaveTarget] = useState(null); // 'tank' | 'unified'
  const [saveTargetIndex, setSaveTargetIndex] = useState(null);
  const [modelName, setModelName] = useState('');

  // 選択されたタンクのデータを取得
  useEffect(() => {
    if (tanks && selectedTankIds && selectedTankIds.length > 0) {
      const selected = tanks.filter(tank => selectedTankIds.includes(tank.tankId));
      setSelectedTanksForModeling(selected);
    }
  }, [tanks, selectedTankIds]);

  // タンクの基準値を検出する関数
  const detectKeyValues = (tank) => {
    const bmdData = [];
    
    // 日次データからBMD（補完）を配列化
    Object.keys(tank.dailyData).forEach(day => {
      const dayNum = parseInt(day);
      const bmd = tank.dailyData[day][COLUMN_NAMES.DAILY.BMD_COMPLEMENT];
      if (bmd !== null && !isNaN(bmd)) {
        bmdData.push({ day: dayNum, bmd: parseFloat(bmd) });
      }
    });

    if (bmdData.length === 0) return null;

    // 最高BMDとその日数を検出
    const maxBMDEntry = bmdData.reduce((max, current) => 
      current.bmd > max.bmd ? current : max
    );
    
    // 最終BMDとその日数を検出（最後の有効データ）
    const finalBMDEntry = bmdData[bmdData.length - 1];
    
    return {
      tankId: tank.tankId,
      tankNumber: tank.metadata[COLUMN_NAMES.META.TANK_NUMBER],
      yeast: tank.metadata[COLUMN_NAMES.META.YEAST],
      maxBMD: maxBMDEntry.bmd,
      maxBMDDay: maxBMDEntry.day,
      finalBMD: finalBMDEntry.bmd,
      finalDay: finalBMDEntry.day,
      bmdSeries: bmdData
    };
  };

  // 進捗率を計算する関数
  const calculateProgressRates = (tankData) => {
    const { maxBMD, finalBMD, maxBMDDay, finalDay, bmdSeries } = tankData;
    const progressData = [];
    
    bmdSeries.forEach(entry => {
      if (entry.day >= maxBMDDay) {  // 最高BMD日以降のみ処理
        // 進捗率 = (最高BMD - 現在BMD) / (最高BMD - 最終BMD)
        const progress = (maxBMD - entry.bmd) / (maxBMD - finalBMD);
        
        // 時間正規化 = (現在日数 - 最高BMD日) / (最終日数 - 最高BMD日)
        const normalizedTime = (entry.day - maxBMDDay) / (finalDay - maxBMDDay);
        
        progressData.push({
          normalizedTime: normalizedTime * 100,  // パーセント表示
          progress: Math.max(0, Math.min(100, progress * 100)),  // 0-100%に制限
          actualDay: entry.day,
          actualBMD: entry.bmd
        });
      }
    });
    
    return progressData.sort((a, b) => a.normalizedTime - b.normalizedTime);
  };

  // 進捗データを生成（統合パターンを含む）
  useEffect(() => {
    if (selectedTanksForModeling.length > 0) {
      const analysisResults = [];
      const chartDatasets = [];

      selectedTanksForModeling.forEach((tank, index) => {
        const keyValues = detectKeyValues(tank);
        if (keyValues) {
          const progressRates = calculateProgressRates(keyValues);
          console.log(`Tank ${keyValues.tankNumber} progress data:`, progressRates);
          
          analysisResults.push({
            ...keyValues,
            progressRates: progressRates,
            fermentationDays: keyValues.finalDay - keyValues.maxBMDDay
          });

          // チャート用データセット作成
          const chartData = progressRates.map(p => ({ x: p.normalizedTime, y: p.progress }));
          console.log(`Tank ${keyValues.tankNumber} chart data:`, chartData);
          
          chartDatasets.push({
            label: `タンク${keyValues.tankNumber} (${keyValues.yeast})`,
            data: chartData,
            borderColor: colorPalette[index % colorPalette.length],
            backgroundColor: colorPalette[index % colorPalette.length] + '20',
            borderWidth: 2,
            fill: false,
            tension: 0.3,
            pointRadius: 3,
            pointHoverRadius: 6
          });
        }
      });

      console.log('Final chart datasets:', chartDatasets);
      setTankAnalysis(analysisResults);
      
      // 統合パターンがある場合は追加
      if (unifiedPattern) {
        chartDatasets.push({
          label: unifiedPattern.name,
          data: unifiedPattern.data,
          borderColor: '#FF1744',
          backgroundColor: '#FF174420',
          borderWidth: 4,
          fill: false,
          tension: 0.2,
          pointRadius: 0,
          borderDash: [5, 5]
        });
      }
      
      setProgressData(chartDatasets);
    }
  }, [selectedTanksForModeling, unifiedPattern]);

  // 統合パターン作成関数群
  const removeOutliers = (data) => {
    if (data.length < 4) return data;
    const sorted = [...data].sort((a, b) => a - b);
    const q1 = sorted[Math.floor(sorted.length * 0.25)];
    const q3 = sorted[Math.floor(sorted.length * 0.75)];
    const iqr = q3 - q1;
    return sorted.filter(p => p >= q1 - 1.5 * iqr && p <= q3 + 1.5 * iqr);
  };

  const calculatePatternQuality = (pattern, sourceAnalyses) => {
    // パターンの滑らかさと一貫性を評価
    let smoothness = 0;
    for (let i = 1; i < pattern.length; i++) {
      const slope = (pattern[i].y - pattern[i-1].y) / (pattern[i].x - pattern[i-1].x);
      smoothness += Math.abs(slope);
    }
    return Math.max(0, 1 - smoothness / 100); // 0-1の品質スコア
  };

  // 時間軸平均化方式
  const createTimeAveragedPattern = (analyses) => {
    const unifiedPoints = [];
    const stepSize = 2; // 2%刻み
    
    for (let t = 0; t <= 100; t += stepSize) {
      const nearbyPoints = [];
      
      analyses.forEach(analysis => {
        analysis.progressRates.forEach(point => {
          if (Math.abs(point.normalizedTime - t) <= stepSize) {
            nearbyPoints.push(point.progress);
          }
        });
      });
      
      if (nearbyPoints.length >= Math.max(1, analyses.length * 0.3)) { // 30%以上のタンクにデータがある点
        const filtered = removeOutliers(nearbyPoints);
        if (filtered.length > 0) {
          const avgProgress = filtered.reduce((sum, p) => sum + p, 0) / filtered.length;
          unifiedPoints.push({ x: t, y: Math.max(0, Math.min(100, avgProgress)) });
        }
      }
    }
    
    return {
      name: `時間軸平均 (${analyses.length}タンク)`,
      data: unifiedPoints,
      method: 'average',
      quality: calculatePatternQuality(unifiedPoints, analyses),
      sourceCount: analyses.length,
      description: '各時点での進捗率を平均化'
    };
  };

  // 多項式フィッティング方式
  const createPolynomialPattern = (analyses) => {
    // 全データポイントを収集
    const allPoints = [];
    analyses.forEach(analysis => {
      analysis.progressRates.forEach(point => {
        allPoints.push({
          x: point.normalizedTime / 100, // 0-1に正規化
          y: point.progress / 100
        });
      });
    });

    if (allPoints.length < 10) return null;

    // 簡易3次多項式フィッティング（最小二乗法の近似）
    const n = allPoints.length;
    let sumX = 0, sumX2 = 0, sumX3 = 0, sumX4 = 0, sumX5 = 0, sumX6 = 0;
    let sumY = 0, sumXY = 0, sumX2Y = 0, sumX3Y = 0;

    allPoints.forEach(p => {
      const x = p.x, y = p.y;
      const x2 = x * x, x3 = x2 * x, x4 = x3 * x, x5 = x4 * x, x6 = x5 * x;
      sumX += x; sumX2 += x2; sumX3 += x3; sumX4 += x4; sumX5 += x5; sumX6 += x6;
      sumY += y; sumXY += x * y; sumX2Y += x2 * y; sumX3Y += x3 * y;
    });

    // 簡略化された係数計算（厳密ではないが実用的）
    const a = (sumX3Y - sumX3 * sumY / n) / (sumX6 - sumX3 * sumX3 / n);
    const b = (sumX2Y - sumX2 * sumY / n - a * (sumX5 - sumX2 * sumX3 / n)) / (sumX4 - sumX2 * sumX2 / n);
    const c = (sumXY - sumX * sumY / n - a * (sumX4 - sumX * sumX3 / n) - b * (sumX3 - sumX * sumX2 / n)) / (sumX2 - sumX * sumX / n);
    const d = (sumY - a * sumX3 - b * sumX2 - c * sumX) / n;

    // パターンポイント生成
    const patternPoints = [];
    for (let t = 0; t <= 100; t += 1) {
      const x = t / 100;
      const y = Math.max(0, Math.min(100, (a * x * x * x + b * x * x + c * x + d) * 100));
      patternPoints.push({ x: t, y });
    }

    return {
      name: `多項式近似 (${analyses.length}タンク)`,
      data: patternPoints,
      method: 'polynomial',
      quality: calculatePatternQuality(patternPoints, analyses),
      sourceCount: analyses.length,
      description: '3次多項式による曲線フィッティング',
      coefficients: { a, b, c, d }
    };
  };

  // 線形補間で進捗率を計算する関数
  const interpolateProgressRate = (analysis, targetDay) => {
    const sortedData = analysis.progressRates.sort((a, b) => a.actualDay - b.actualDay);
    
    // targetDayと完全一致するデータがあるかチェック
    const exactMatch = sortedData.find(point => Math.abs(point.actualDay - targetDay) < 0.1);
    if (exactMatch) {
      return exactMatch.progress;
    }
    
    // targetDayを挟む前後のデータを探す
    let beforePoint = null;
    let afterPoint = null;
    
    for (let i = 0; i < sortedData.length - 1; i++) {
      if (sortedData[i].actualDay <= targetDay && sortedData[i + 1].actualDay >= targetDay) {
        beforePoint = sortedData[i];
        afterPoint = sortedData[i + 1];
        break;
      }
    }
    
    // 補間できない場合（範囲外など）
    if (!beforePoint || !afterPoint) {
      return null;
    }
    
    // 線形補間で計算
    const ratio = (targetDay - beforePoint.actualDay) / (afterPoint.actualDay - beforePoint.actualDay);
    const interpolatedProgress = beforePoint.progress + (afterPoint.progress - beforePoint.progress) * ratio;
    
    return interpolatedProgress;
  };

  // 発酵進行度ベース統合方式（補間付き）
  const createFermentationProgressPattern = (analyses) => {
    const unifiedPoints = [];
    const stepSize = 5; // 5%刻み
    
    console.log('=== 発酵進行度ベース統合開始 ===');
    
    for (let fermentationProgress = 0; fermentationProgress <= 100; fermentationProgress += stepSize) {
      const progressValues = [];
      
      analyses.forEach(analysis => {
        // 発酵進行度に対応する実際の日数を計算
        const fermentationDays = analysis.finalDay - analysis.maxBMDDay;
        const targetDay = analysis.maxBMDDay + (fermentationDays * fermentationProgress / 100);
        
        console.log(`Tank ${analysis.tankNumber}, 発酵進行度${fermentationProgress}%: 目標日数=${targetDay.toFixed(1)}日`);
        
        // 補間で進捗率を取得
        const interpolatedProgress = interpolateProgressRate(analysis, targetDay);
        
        if (interpolatedProgress !== null) {
          progressValues.push(interpolatedProgress);
          console.log(`  → 補間進捗率: ${interpolatedProgress.toFixed(1)}%`);
        } else {
          console.log(`  → 補間不可（範囲外）`);
        }
      });
      
      // 十分なデータがある場合のみ統合
      if (progressValues.length >= Math.max(1, analyses.length * 0.7)) {
        const avgProgress = progressValues.reduce((sum, p) => sum + p, 0) / progressValues.length;
        unifiedPoints.push({ 
          x: fermentationProgress, 
          y: Math.max(0, Math.min(100, avgProgress))
        });
        console.log(`発酵進行度${fermentationProgress}%: 統合進捗率=${avgProgress.toFixed(1)}% (${progressValues.length}タンク平均)`);
      }
    }
    
    console.log('=== 統合完了 ===', unifiedPoints);
    
    return {
      name: `発酵進行度ベース (${analyses.length}タンク)`,
      data: unifiedPoints,
      method: 'fermentation_progress',
      quality: calculatePatternQuality(unifiedPoints, analyses),
      sourceCount: analyses.length,
      description: '実発酵日数による進行度統合（補間付き）'
    };
  };
  const createWeightedPattern = (analyses) => {
    // 各タンクの重みを計算（データ数、一貫性、代表性）
    const weights = analyses.map(analysis => {
      const dataCount = analysis.progressRates.length;
      const consistency = 1 / (1 + Math.abs(analysis.fermentationDays - 17)); // 17日を標準とした一貫性
      const completeness = dataCount / 30; // 30ポイントを満点とした完全性
      return Math.min(1, dataCount * 0.03 + consistency * 0.5 + completeness * 0.5);
    });

    const totalWeight = weights.reduce((sum, w) => sum + w, 0);
    const normalizedWeights = weights.map(w => w / totalWeight);

    const unifiedPoints = [];
    const stepSize = 2;
    
    for (let t = 0; t <= 100; t += stepSize) {
      let weightedSum = 0;
      let totalWeightUsed = 0;
      
      analyses.forEach((analysis, index) => {
        const nearbyPoints = analysis.progressRates.filter(point => 
          Math.abs(point.normalizedTime - t) <= stepSize
        );
        
        if (nearbyPoints.length > 0) {
          const avgProgress = nearbyPoints.reduce((sum, p) => sum + p.progress, 0) / nearbyPoints.length;
          weightedSum += avgProgress * normalizedWeights[index];
          totalWeightUsed += normalizedWeights[index];
        }
      });
      
      if (totalWeightUsed > 0) {
        unifiedPoints.push({ x: t, y: Math.max(0, Math.min(100, weightedSum / totalWeightUsed)) });
      }
    }
    
    return {
      name: `重み付き平均 (${analyses.length}タンク)`,
      data: unifiedPoints,
      method: 'weighted',
      quality: calculatePatternQuality(unifiedPoints, analyses),
      sourceCount: analyses.length,
      description: 'データ品質による重み付き平均',
      weights: normalizedWeights
    };
  };

  // モデル保存関連の関数
  const generateModelId = () => {
    return 'model_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  };

  const createTankModel = (analysis) => {
    return {
      id: generateModelId(),
      type: 'individual',
      name: `タンク${analysis.tankNumber}モデル`,
      tankNumber: analysis.tankNumber,
      yeast: analysis.yeast,
      createdAt: new Date().toISOString(),
      parameters: {
        maxBMD: analysis.maxBMD,
        maxBMDDay: analysis.maxBMDDay,
        finalBMD: analysis.finalBMD,
        finalDay: analysis.finalDay,
        fermentationDays: analysis.fermentationDays
      },
      progressPattern: analysis.progressRates.map(p => ({
        fermentationProgress: p.normalizedTime,
        progressRate: p.progress,
        actualDay: p.actualDay,
        actualBMD: p.actualBMD
      })),
      dataQuality: {
        dataPoints: analysis.progressRates.length,
        completeness: Math.min(1, analysis.progressRates.length / 25),
        consistency: calculateConsistency(analysis.progressRates)
      }
    };
  };

  const createUnifiedModel = (pattern, sourceAnalyses) => {
    return {
      id: generateModelId(),
      type: 'unified',
      name: pattern.name,
      method: pattern.method,
      createdAt: new Date().toISOString(),
      sourceModels: sourceAnalyses.map(a => ({
        tankNumber: a.tankNumber,
        yeast: a.yeast,
        fermentationDays: a.fermentationDays
      })),
      parameters: {
        avgMaxBMD: sourceAnalyses.reduce((sum, a) => sum + a.maxBMD, 0) / sourceAnalyses.length,
        avgFinalBMD: sourceAnalyses.reduce((sum, a) => sum + a.finalBMD, 0) / sourceAnalyses.length,
        avgFermentationDays: sourceAnalyses.reduce((sum, a) => sum + a.fermentationDays, 0) / sourceAnalyses.length,
        sourceCount: sourceAnalyses.length
      },
      progressPattern: pattern.data.map(p => ({
        fermentationProgress: p.x,
        progressRate: p.y
      })),
      dataQuality: {
        quality: pattern.quality,
        sourceCount: sourceAnalyses.length,
        method: pattern.method,
        description: pattern.description
      }
    };
  };

  const calculateConsistency = (progressRates) => {
    if (progressRates.length < 3) return 0.5;
    
    let smoothness = 0;
    for (let i = 1; i < progressRates.length - 1; i++) {
      const slope1 = progressRates[i].progress - progressRates[i-1].progress;
      const slope2 = progressRates[i+1].progress - progressRates[i].progress;
      const slopeDiff = Math.abs(slope2 - slope1);
      smoothness += slopeDiff;
    }
    
    return Math.max(0, Math.min(1, 1 - smoothness / (progressRates.length * 20)));
  };

  const saveModel = (model, customName = null) => {
    if (customName) {
      model.name = customName;
    }
    
    const updatedModels = [...savedModels, model];
    setSavedModels(updatedModels);
    localStorage.setItem('fermentationModels', JSON.stringify(updatedModels));
    
    setShowSaveDialog(false);
    setModelName('');
    setSaveTarget(null);
    setSaveTargetIndex(null);
  };

  const handleSaveClick = (type, index = null) => {
    setSaveTarget(type);
    setSaveTargetIndex(index);
    setShowSaveDialog(true);
    
    if (type === 'tank' && index !== null) {
      setModelName(`タンク${tankAnalysis[index].tankNumber}モデル`);
    } else if (type === 'unified' && unifiedPattern) {
      setModelName(unifiedPattern.name);
    }
  };

  const confirmSave = () => {
    if (saveTarget === 'tank' && saveTargetIndex !== null) {
      const model = createTankModel(tankAnalysis[saveTargetIndex]);
      saveModel(model, modelName);
    } else if (saveTarget === 'unified' && unifiedPattern) {
      const model = createUnifiedModel(unifiedPattern, tankAnalysis);
      saveModel(model, modelName);
    }
  };

  const deleteModel = (modelId) => {
    const updatedModels = savedModels.filter(m => m.id !== modelId);
    setSavedModels(updatedModels);
    localStorage.setItem('fermentationModels', JSON.stringify(updatedModels));
  };
  const createUnifiedPattern = (method = 'average') => {
    if (tankAnalysis.length < 2) return null;
    
    let pattern;
    switch (method) {
      case 'average':
        pattern = createTimeAveragedPattern(tankAnalysis);
        break;
      case 'polynomial':
        pattern = createPolynomialPattern(tankAnalysis);
        break;
      case 'weighted':
        pattern = createWeightedPattern(tankAnalysis);
        break;
      case 'fermentation_progress':
        pattern = createFermentationProgressPattern(tankAnalysis);
        break;
      default:
        pattern = createTimeAveragedPattern(tankAnalysis);
    }
    
    return pattern;
  };
  const getBMDChartData = () => {
    return selectedTanksForModeling.map((tank, index) => {
      const keyValues = detectKeyValues(tank);
      if (!keyValues) return null;

      return {
        label: `タンク${keyValues.tankNumber} BMD`,
        data: keyValues.bmdSeries.map(d => ({ x: d.day, y: d.bmd })),
        borderColor: colorPalette[index % colorPalette.length],
        backgroundColor: colorPalette[index % colorPalette.length] + '20',
        borderWidth: 2,
        fill: false,
        tension: 0.1,
        pointRadius: 2
      };
    }).filter(dataset => dataset !== null);
  };

  // チャートオプション
  const progressChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      x: {
        type: 'linear',
        position: 'bottom',
        title: { display: true, text: '正規化時間 (%)' },
        min: 0,
        max: 100,
        grid: { color: '#e5e7eb' }
      },
      y: {
        title: { display: true, text: '発酵進捗率 (%)' },
        min: 0,
        max: 100,
        grid: { color: '#e5e7eb' }
      }
    },
    plugins: {
      legend: { position: 'bottom' },
      tooltip: {
        callbacks: {
          label: function(context) {
            const dataIndex = context.dataIndex;
            const tankIndex = context.datasetIndex;
            const analysis = tankAnalysis[tankIndex];
            if (analysis && analysis.progressRates[dataIndex]) {
              const point = analysis.progressRates[dataIndex];
              return [
                `${context.dataset.label}`,
                `進捗率: ${point.progress.toFixed(1)}%`,
                `実際の日数: ${point.actualDay}日目`,
                `BMD: ${point.actualBMD.toFixed(1)}`
              ];
            }
            return context.dataset.label + ': ' + context.parsed.y.toFixed(1) + '%';
          }
        }
      }
    }
  };

  const bmdChartOptions = {
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
            return `${context.dataset.label}: ${context.parsed.y.toFixed(1)}`;
          }
        }
      }
    }
  };

  if (!selectedTanksForModeling.length) {
    return (
      <div className="mt-4 p-6 bg-gray-50 rounded-lg text-center">
        <Database className="w-12 h-12 mx-auto text-gray-400 mb-3" />
        <h3 className="text-lg font-medium text-gray-600 mb-2">進捗モデリング</h3>
        <p className="text-gray-500">タンクを選択してから「分析」ボタンを押してください</p>
      </div>
    );
  }

  return (
    <div className="mt-6 space-y-6">
      {/* ヘッダー */}
      <div className="bg-white rounded-lg shadow-lg border border-gray-200 p-4">
        <div className="flex items-center space-x-3 mb-4">
          <TrendingUp className="w-6 h-6 text-blue-600" />
          <h3 className="text-xl font-semibold">発酵進捗モデリング</h3>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
          <div className="bg-blue-50 p-3 rounded">
            <div className="font-medium text-blue-800">分析対象</div>
            <div className="text-blue-600">{selectedTanksForModeling.length}タンク</div>
          </div>
          <div className="bg-green-50 p-3 rounded">
            <div className="font-medium text-green-800">表示モード</div>
            <div className="text-green-600">{showRawBMD ? 'BMD生データ' : '進捗率比較'}</div>
          </div>
          <div className="bg-purple-50 p-3 rounded">
            <div className="font-medium text-purple-800">データ品質</div>
            <div className="text-purple-600">
              {tankAnalysis.length > 0 ? '良好' : '計算中...'}
            </div>
          </div>
        </div>

        <div className="mt-4 flex space-x-3">
          <button
            onClick={() => setShowRawBMD(false)}
            className={`px-4 py-2 rounded text-sm font-medium ${
              !showRawBMD 
                ? 'bg-blue-600 text-white' 
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            <BarChart3 className="w-4 h-4 inline mr-1" />
            進捗率比較
          </button>
          <button
            onClick={() => setShowRawBMD(true)}
            className={`px-4 py-2 rounded text-sm font-medium ${
              showRawBMD 
                ? 'bg-blue-600 text-white' 
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            <Database className="w-4 h-4 inline mr-1" />
            BMD生データ
          </button>
        </div>

        {/* 統合パターン作成セクション */}
        {tankAnalysis.length >= 2 && !showRawBMD && (
          <div className="mt-4 p-4 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg border border-blue-200">
            <h5 className="font-semibold mb-3 flex items-center">
              <TrendingUp className="w-4 h-4 mr-2" />
              統合進捗パターン作成
            </h5>
            
            <div className="flex items-center space-x-4 mb-3">
              <select 
                value={patternMethod} 
                onChange={(e) => setPatternMethod(e.target.value)}
                className="px-3 py-1 border rounded text-sm"
              >
                <option value="fermentation_progress">発酵進行度ベース（推奨）</option>
                <option value="average">時間軸平均化</option>
                <option value="polynomial">多項式フィッティング</option>
                <option value="weighted">重み付き平均</option>
              </select>
              
              <button
                onClick={() => setUnifiedPattern(createUnifiedPattern(patternMethod))}
                disabled={tankAnalysis.length < 2}
                className="px-4 py-2 bg-purple-600 text-white rounded text-sm hover:bg-purple-700 disabled:bg-gray-400"
              >
                パターン作成
              </button>
              
              {unifiedPattern && (
                <button
                  onClick={() => setUnifiedPattern(null)}
                  className="px-3 py-2 bg-gray-500 text-white rounded text-sm hover:bg-gray-600"
                >
                  削除
                </button>
              )}
            </div>
            
            {unifiedPattern && (
              <div className="text-sm space-y-1">
                <div className="text-purple-800 font-medium">
                  ✅ {unifiedPattern.name}
                </div>
                <div className="text-gray-600">
                  {unifiedPattern.description} | 品質スコア: {(unifiedPattern.quality * 100).toFixed(1)}%
                </div>
                {unifiedPattern.method === 'polynomial' && unifiedPattern.coefficients && (
                  <div className="text-xs text-gray-500">
                    数式: progress = {unifiedPattern.coefficients.a.toFixed(3)}t³ + {unifiedPattern.coefficients.b.toFixed(3)}t² + {unifiedPattern.coefficients.c.toFixed(3)}t + {unifiedPattern.coefficients.d.toFixed(3)}
                  </div>
                )}
                {unifiedPattern.method === 'weighted' && unifiedPattern.weights && (
                  <div className="text-xs text-gray-500">
                    重み: {unifiedPattern.weights.map((w, i) => `T${tankAnalysis[i].tankNumber}:${(w*100).toFixed(0)}%`).join(', ')}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* グラフ表示 */}
      <div className="bg-white rounded-lg shadow-lg border border-gray-200 p-4">
        <div className="h-96">
          {showRawBMD ? (
            <Line
              data={{ datasets: getBMDChartData() }}
              options={bmdChartOptions}
            />
          ) : (
            progressData.length > 0 && (
              <Line
                data={{ datasets: progressData }}
                options={progressChartOptions}
              />
            )
          )}
        </div>
      </div>

      {/* 分析結果テーブル */}
      {tankAnalysis.length > 0 && (
        <div className="bg-white rounded-lg shadow-lg border border-gray-200 p-4">
          <h4 className="text-lg font-semibold mb-4 flex items-center">
            <Calculator className="w-5 h-5 mr-2" />
            分析結果
          </h4>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left">タンク</th>
                  <th className="px-3 py-2 text-left">酵母</th>
                  <th className="px-3 py-2 text-right">最高BMD</th>
                  <th className="px-3 py-2 text-right">最高BMD日</th>
                  <th className="px-3 py-2 text-right">最終BMD</th>
                  <th className="px-3 py-2 text-right">最終日</th>
                  <th className="px-3 py-2 text-right">実質発酵日数</th>
                  <th className="px-3 py-2 text-right">BMD変化量</th>
                  <th className="px-3 py-2 text-center">アクション</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {tankAnalysis.map((analysis, index) => (
                  <tr key={analysis.tankId} className="hover:bg-gray-50">
                    <td className="px-3 py-2 font-medium">{analysis.tankNumber}</td>
                    <td className="px-3 py-2">{analysis.yeast}</td>
                    <td className="px-3 py-2 text-right">{analysis.maxBMD.toFixed(1)}</td>
                    <td className="px-3 py-2 text-right">{analysis.maxBMDDay}日</td>
                    <td className="px-3 py-2 text-right">{analysis.finalBMD.toFixed(1)}</td>
                    <td className="px-3 py-2 text-right">{analysis.finalDay}日</td>
                    <td className="px-3 py-2 text-right">{analysis.fermentationDays}日</td>
                    <td className="px-3 py-2 text-right">
                      {(analysis.maxBMD - analysis.finalBMD).toFixed(1)}
                    </td>
                    <td className="px-3 py-2 text-center">
                      <button
                        onClick={() => handleSaveClick('tank', index)}
                        className="px-2 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700"
                      >
                        モデル保存
                      </button>
                    </td>
                  </tr>
                ))}
                {unifiedPattern && (
                  <tr className="bg-purple-50 border-t-2 border-purple-200">
                    <td className="px-3 py-2 font-bold text-purple-800" colSpan={8}>
                      {unifiedPattern.name} (品質: {(unifiedPattern.quality * 100).toFixed(1)}%)
                    </td>
                    <td className="px-3 py-2 text-center">
                      <button
                        onClick={() => handleSaveClick('unified')}
                        className="px-2 py-1 bg-purple-600 text-white text-xs rounded hover:bg-purple-700"
                      >
                        統合モデル保存
                      </button>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* モデル保存ダイアログ */}
      {showSaveDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-96 max-w-90vw">
            <h3 className="text-lg font-semibold mb-4">
              {saveTarget === 'tank' ? 'タンクモデル保存' : '統合モデル保存'}
            </h3>
            
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                モデル名
              </label>
              <input
                type="text"
                value={modelName}
                onChange={(e) => setModelName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                placeholder="モデル名を入力"
              />
            </div>

            <div className="mb-4 text-sm text-gray-600">
              {saveTarget === 'tank' && saveTargetIndex !== null && (
                <div>
                  <p><strong>タンク:</strong> {tankAnalysis[saveTargetIndex].tankNumber}</p>
                  <p><strong>酵母:</strong> {tankAnalysis[saveTargetIndex].yeast}</p>
                  <p><strong>発酵日数:</strong> {tankAnalysis[saveTargetIndex].fermentationDays}日</p>
                  <p><strong>データ点数:</strong> {tankAnalysis[saveTargetIndex].progressRates.length}点</p>
                </div>
              )}
              {saveTarget === 'unified' && unifiedPattern && (
                <div>
                  <p><strong>統合方式:</strong> {unifiedPattern.description}</p>
                  <p><strong>ソースタンク数:</strong> {unifiedPattern.sourceCount}タンク</p>
                  <p><strong>品質スコア:</strong> {(unifiedPattern.quality * 100).toFixed(1)}%</p>
                </div>
              )}
            </div>

            <div className="flex space-x-3">
              <button
                onClick={confirmSave}
                disabled={!modelName.trim()}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400"
              >
                保存
              </button>
              <button
                onClick={() => setShowSaveDialog(false)}
                className="flex-1 px-4 py-2 bg-gray-300 text-gray-700 rounded hover:bg-gray-400"
              >
                キャンセル
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 保存済みモデル一覧 */}
      {savedModels.length > 0 && (
        <div className="bg-white rounded-lg shadow-lg border border-gray-200 p-4">
          <h4 className="text-lg font-semibold mb-4 flex items-center">
            <Database className="w-5 h-5 mr-2" />
            保存済みモデル ({savedModels.length}個)
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {savedModels.map((model) => (
              <div key={model.id} className={`border rounded-lg p-3 ${
                model.type === 'unified' ? 'border-purple-200 bg-purple-50' : 'border-blue-200 bg-blue-50'
              }`}>
                <div className="flex items-center justify-between mb-2">
                  <h5 className={`font-medium ${
                    model.type === 'unified' ? 'text-purple-800' : 'text-blue-800'
                  }`}>
                    {model.name}
                  </h5>
                  <button
                    onClick={() => deleteModel(model.id)}
                    className="text-red-500 hover:text-red-700 text-sm"
                  >
                    削除
                  </button>
                </div>
                
                <div className="text-xs text-gray-600 space-y-1">
                  <div><strong>作成日:</strong> {new Date(model.createdAt).toLocaleDateString()}</div>
                  
                  {model.type === 'individual' ? (
                    <>
                      <div><strong>タンク:</strong> {model.tankNumber}</div>
                      <div><strong>酵母:</strong> {model.yeast}</div>
                      <div><strong>発酵日数:</strong> {model.parameters.fermentationDays}日</div>
                      <div><strong>データ点:</strong> {model.progressPattern.length}点</div>
                      <div><strong>完全性:</strong> {(model.dataQuality.completeness * 100).toFixed(0)}%</div>
                    </>
                  ) : (
                    <>
                      <div><strong>統合方式:</strong> {model.method}</div>
                      <div><strong>ソース:</strong> {model.parameters.sourceCount}タンク</div>
                      <div><strong>平均発酵日数:</strong> {model.parameters.avgFermentationDays.toFixed(1)}日</div>
                      <div><strong>品質:</strong> {(model.dataQuality.quality * 100).toFixed(1)}%</div>
                    </>
                  )}
                </div>
                
                <div className="mt-2 pt-2 border-t border-gray-200">
                  <span className={`text-xs px-2 py-1 rounded ${
                    model.type === 'unified' 
                      ? 'bg-purple-200 text-purple-800' 
                      : 'bg-blue-200 text-blue-800'
                  }`}>
                    {model.type === 'unified' ? '統合モデル' : '個別モデル'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 統計情報 */}
      {tankAnalysis.length > 1 && (
        <div className="bg-white rounded-lg shadow-lg border border-gray-200 p-4">
          <h4 className="text-lg font-semibold mb-4">統計サマリー</h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div className="text-center p-3 bg-blue-50 rounded">
              <div className="font-medium text-blue-800">平均発酵日数</div>
              <div className="text-xl font-bold text-blue-600">
                {(tankAnalysis.reduce((sum, t) => sum + t.fermentationDays, 0) / tankAnalysis.length).toFixed(1)}日
              </div>
            </div>
            <div className="text-center p-3 bg-green-50 rounded">
              <div className="font-medium text-green-800">平均最高BMD</div>
              <div className="text-xl font-bold text-green-600">
                {(tankAnalysis.reduce((sum, t) => sum + t.maxBMD, 0) / tankAnalysis.length).toFixed(1)}
              </div>
            </div>
            <div className="text-center p-3 bg-yellow-50 rounded">
              <div className="font-medium text-yellow-800">平均最終BMD</div>
              <div className="text-xl font-bold text-yellow-600">
                {(tankAnalysis.reduce((sum, t) => sum + t.finalBMD, 0) / tankAnalysis.length).toFixed(1)}
              </div>
            </div>
            <div className="text-center p-3 bg-purple-50 rounded">
              <div className="font-medium text-purple-800">平均BMD変化</div>
              <div className="text-xl font-bold text-purple-600">
                {(tankAnalysis.reduce((sum, t) => sum + (t.maxBMD - t.finalBMD), 0) / tankAnalysis.length).toFixed(1)}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProgressModeling;