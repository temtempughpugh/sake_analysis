import React, { useState, useEffect } from 'react';
import { TrendingUp, AlertCircle, Activity } from 'lucide-react';
import { COLUMN_NAMES } from '../../utils/csvParser';
import { Line } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend } from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend);

const ProgressPrediction = ({ tank, selectedModel, selectedPattern }) => {
  const [baseSettings, setBaseSettings] = useState(null);
  const [idealCurve, setIdealCurve] = useState([]);
  const [currentStatus, setCurrentStatus] = useState(null);
  const [predictionResult, setPredictionResult] = useState(null);

  // 基準設定の自動取得
  const getBaseSettings = (tank) => {
    if (!tank?.dailyData || !tank?.metadata?.['上槽日']) {
      return null;
    }

    let maxBMD = -Infinity;
    let maxBMDDay = null;

    // 最高BMDの検出
    Object.entries(tank.dailyData).forEach(([key, dayData]) => {
      const day = parseInt(key.replace('day_', ''));
      const bmd = parseFloat(dayData[COLUMN_NAMES.DAILY.BMD_COMPLEMENT]);
      if (!isNaN(bmd) && bmd > maxBMD) {
        maxBMD = bmd;
        maxBMDDay = day;
      }
    });

    if (maxBMDDay === null) return null;

    // 最終日の計算
    const startDate = new Date(tank.metadata['仕込み日']);
    const endDate = new Date(tank.metadata['上槽日']);
    const finalDay = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1;

    // 最終BMDの計算
    const targetBaume = parseFloat(tank.metadata['目標ボーメ']) || -1.5;
    const finalBMD = targetBaume * finalDay;

    return {
      maxBMD,
      maxBMDDay,
      finalBMD,
      finalDay
    };
  };

  // 理想曲線計算
  const calculateIdealCurve = (baseSettings, selectedModel, selectedPattern) => {
    if (!baseSettings || !selectedModel || !selectedPattern) {
      console.log('理想曲線計算に必要なデータが不足:', { baseSettings: !!baseSettings, selectedModel: !!selectedModel, selectedPattern });
      return [];
    }

    const { maxBMD, maxBMDDay, finalBMD, finalDay } = baseSettings;
    const curve = [];

    console.log('理想曲線計算パラメータ:', { maxBMD, maxBMDDay, finalBMD, finalDay, selectedPattern });

    // 個別タンクパターンの場合
    if (selectedPattern && selectedPattern.startsWith('タンク')) {
      const tankNumber = selectedPattern.replace('タンク', '');
      
      console.log('=== 個別タンク検索デバッグ ===');
      console.log('selectedPattern:', selectedPattern);
      console.log('tankNumber:', tankNumber, 'typeof:', typeof tankNumber);
      console.log('selectedModel.progressData.tankAnalysis:', selectedModel.progressData?.tankAnalysis);
      
      const individualTankData = selectedModel.progressData?.tankAnalysis?.find(tank => 
        tank.tankNumber.toString() === tankNumber
      );
      
      console.log('individualTankData:', individualTankData);
      console.log('individualTankData.progressRates:', individualTankData?.progressRates);
      console.log('===============================');
      
      if (individualTankData && individualTankData.progressRates) {
        console.log('個別タンクのprogressRatesを使用:', individualTankData.progressRates.length, '点');
        
        // 個別タンクデータを統合パターン形式に変換
        const individualPattern = {
          data: individualTankData.progressRates.map(p => ({
            x: p.normalizedTime, // 発酵進行度
            y: p.progress        // 進捗率
          }))
        };

        console.log('変換された個別パターンデータ:', individualPattern.data);

        // 統合パターンと同じロジックで処理
        for (let day = maxBMDDay; day <= finalDay; day++) {
          // 発酵進行度を計算
          const fermentationProgress = ((day - maxBMDDay) / (finalDay - maxBMDDay)) * 100;
          
          // パターンから進捗率を線形補間で取得（統合パターンと同じ関数を使用）
          const progressRate = interpolateProgressFromPattern(fermentationProgress, individualPattern);
          
          // 理想BMD = 最高BMD - (最高BMD - 最終BMD) × (進捗率 / 100)
          const idealBMD = maxBMD - (maxBMD - finalBMD) * (progressRate / 100);
          
          curve.push({
            day,
            fermentationProgress: fermentationProgress.toFixed(1),
            progressRate: progressRate.toFixed(1),
            idealBMD: idealBMD.toFixed(2),
            idealBaume: (idealBMD / day).toFixed(3)
          });
        }
      } else {
        console.log('個別タンクデータが見つからないため基本データを生成');
        // 基本的なデータを生成（progressRatesがない場合）
        for (let day = maxBMDDay; day <= finalDay; day++) {
          const fermentationProgress = finalDay > maxBMDDay 
            ? ((day - maxBMDDay) / (finalDay - maxBMDDay)) * 100 
            : 0;
          
          // 基本的な線形進捗を使用
          const progressRate = fermentationProgress;
          const idealBMD = maxBMD - (maxBMD - finalBMD) * (progressRate / 100);
          const idealBaume = (idealBMD / day).toFixed(3);

          curve.push({
            day,
            fermentationProgress: fermentationProgress.toFixed(1),
            progressRate: progressRate.toFixed(1),
            idealBMD: idealBMD.toFixed(2),
            idealBaume
          });
        }
      }
    } 
    // 統合パターンの場合（既存のロジック）
    else {
      // 統合パターンを取得
      const pattern = selectedModel.progressData?.patterns?.find(p => p.name === selectedPattern);
      if (!pattern) {
        console.log('統合パターンが見つかりません:', selectedPattern);
        return [];
      }

      console.log('統合パターンを使用:', pattern.name, pattern.data?.length, '点');

      // 各日の理想BMDを計算
      for (let day = maxBMDDay; day <= finalDay; day++) {
        // 発酵進行度を計算
        const fermentationProgress = ((day - maxBMDDay) / (finalDay - maxBMDDay)) * 100;
        
        // パターンから進捗率を線形補間で取得
        const progressRate = interpolateProgressFromPattern(fermentationProgress, pattern);
        
        // 理想BMD = 最高BMD - (最高BMD - 最終BMD) × (進捗率 / 100)
        const idealBMD = maxBMD - (maxBMD - finalBMD) * (progressRate / 100);
        
        curve.push({
          day,
          fermentationProgress: fermentationProgress.toFixed(1),
          progressRate: progressRate.toFixed(1),
          idealBMD: idealBMD.toFixed(2),
          idealBaume: (idealBMD / day).toFixed(3)
        });
      }
    }

    console.log('生成された理想曲線:', curve.length, '点');
    return curve;
  };

  // パターンから進捗率を補間取得
  const interpolateProgressFromPattern = (fermentationProgress, pattern) => {
    if (!pattern?.data) return 0;

    // 範囲チェック
    if (fermentationProgress <= 0) return pattern.data[0]?.y || 0;
    if (fermentationProgress >= 100) return pattern.data[pattern.data.length - 1]?.y || 100;

    // 線形補間
    for (let i = 0; i < pattern.data.length - 1; i++) {
      const current = pattern.data[i];
      const next = pattern.data[i + 1];
      
      if (current.x <= fermentationProgress && next.x >= fermentationProgress) {
        const ratio = (fermentationProgress - current.x) / (next.x - current.x);
        return current.y + (next.y - current.y) * ratio;
      }
    }
    
    // 範囲外の場合は最も近いエッジ値を返す
    const firstPoint = pattern.data[0];
    const lastPoint = pattern.data[pattern.data.length - 1];
    
    if (fermentationProgress < firstPoint.x) {
      return firstPoint.y;
    } else {
      return lastPoint.y;
    }
  };

  // 現在状況の分析
  const analyzeCurrentStatus = (tank, baseSettings, idealCurve) => {
    if (!baseSettings || !idealCurve || idealCurve.length === 0) {
      console.log('分析に必要なデータが不足:', { baseSettings: !!baseSettings, idealCurveLength: idealCurve?.length });
      return null;
    }

    // 実測データから最新の日数とBMDを取得（BMDデータが実際に存在する日のみ）
    const dailyDataEntries = Object.entries(tank.dailyData || {})
      .filter(([key, value]) => 
        key.startsWith('day_') && 
        value?.[COLUMN_NAMES.DAILY.BMD_COMPLEMENT] != null &&
        value[COLUMN_NAMES.DAILY.BMD_COMPLEMENT] !== '' &&
        !isNaN(parseFloat(value[COLUMN_NAMES.DAILY.BMD_COMPLEMENT]))
      )
      .map(([key, value]) => ({
        day: parseInt(key.replace('day_', '')),
        bmd: parseFloat(value[COLUMN_NAMES.DAILY.BMD_COMPLEMENT])
      }))
      .sort((a, b) => a.day - b.day);

    if (dailyDataEntries.length === 0) {
      console.log('実測データが見つかりません');
      return null;
    }

    const latest = dailyDataEntries[dailyDataEntries.length - 1];
    const latestDay = latest.day;
    const latestBMD = latest.bmd;

    console.log('最新実測データ:', { latestDay, latestBMD });

    // 理想曲線から対応する日の理想値を取得
    const idealPoint = idealCurve.find(p => p.day === latestDay);
    if (!idealPoint) {
      console.log(`日数${latestDay}の理想値が見つかりません`);
      return null;
    }

    console.log('理想値:', idealPoint);

    // 差分計算と状態判定
    const difference = latestBMD - parseFloat(idealPoint.idealBMD);
    let status = '順調';
    if (difference > 2) status = '大幅遅れ';
    else if (difference > 0.5) status = '遅れ';
    else if (difference < -2) status = '大幅進み';
    else if (difference < -0.5) status = '進み';

    return {
      day: latestDay,
      actualBMD: latestBMD.toFixed(2),
      idealBMD: idealPoint.idealBMD,
      difference: difference.toFixed(2),
      status
    };
  };

  // 予測計算（パターンA/B）
  const calculatePrediction = (tank, baseSettings, idealCurve, currentStatus) => {
    if (!baseSettings || !currentStatus || !idealCurve) {
      console.log('予測計算に必要なデータが不足:', { 
        baseSettings: !!baseSettings, 
        currentStatus: !!currentStatus, 
        idealCurve: !!idealCurve 
      });
      return null;
    }

    const { maxBMD, finalBMD, finalDay } = baseSettings;
    const currentDay = currentStatus.day;
    const currentBMD = parseFloat(currentStatus.actualBMD);
    const bmdDifference = parseFloat(currentStatus.difference);

    // パターンA: 現状ペース継続
    const patternA = [];
    for (let day = currentDay + 1; day <= finalDay + 10; day++) {
      const idealPoint = idealCurve.find(p => p.day === day);
      if (!idealPoint) continue;

      const predictedBMD = parseFloat(idealPoint.idealBMD) + bmdDifference;
      const predictedBaume = (predictedBMD / day).toFixed(3);

      patternA.push({
        day,
        predictedBMD: predictedBMD.toFixed(2),
        predictedBaume
      });

      // 完了判定
      if (predictedBMD <= finalBMD) break;
    }

    // パターンB: 目標日数厳守
    const patternB = [];
    const remainingDays = finalDay - currentDay;
    const remainingBMDChange = finalBMD - currentBMD;

    for (let day = currentDay + 1; day <= finalDay; day++) {
      const progressRatio = (day - currentDay) / remainingDays;
      const requiredBMD = currentBMD + remainingBMDChange * progressRatio;
      const requiredBaume = (requiredBMD / day).toFixed(3);

      patternB.push({
        day,
        predictedBMD: requiredBMD.toFixed(2),
        predictedBaume: requiredBaume
      });
    }

    return {
      patternA: {
        name: '現状ペース継続',
        data: patternA,
        completionDay: patternA.length > 0 ? patternA[patternA.length - 1].day : finalDay
      },
      patternB: {
        name: '目標日数厳守',
        data: patternB,
        completionDay: finalDay
      }
    };
  };

  // データが変更されたら再計算
  useEffect(() => {
    if (!tank || !selectedModel || !selectedPattern) return;

    console.log('再計算開始:', { tankId: tank.tankId, selectedPattern });

    // 基準設定を取得
    const settings = getBaseSettings(tank);
    if (!settings) return;

    console.log('基準設定:', settings);
    setBaseSettings(settings);

    // 理想曲線を計算
    const curve = calculateIdealCurve(settings, selectedModel, selectedPattern);
    console.log('理想曲線:', curve.length, '点');
    setIdealCurve(curve);

    // 現在状況を分析
    const status = analyzeCurrentStatus(tank, settings, curve);
    console.log('現在状況:', status);
    setCurrentStatus(status);

    // 予測を計算
    if (status) {
      const prediction = calculatePrediction(tank, settings, curve, status);
      setPredictionResult(prediction);
    }
  }, [tank, selectedModel, selectedPattern]);

  // エラーメッセージの判定
  const getErrorMessage = () => {
    const errors = [];

    if (!tank) {
      errors.push('タンクが選択されていません');
      return errors;
    }

    if (!selectedModel || !selectedPattern) {
      errors.push('統合モデルとパターンを選択してください');
      return errors;
    }

    // 詳細なデータ不足チェック
    console.log('=== データ不足チェック ===');
    console.log('tank.metadata:', tank.metadata);
    console.log('tank.dailyData:', tank.dailyData);

    if (!tank.metadata?.['目標ボーメ']) {
      errors.push(`目標ボーメが設定されていません (現在値: ${tank.metadata?.['目標ボーメ']})`);
    }

    if (!tank.metadata?.['仕込み日']) {
      errors.push(`仕込み日が設定されていません (現在値: ${tank.metadata?.['仕込み日']})`);
    }

    if (!tank.metadata?.['上槽日']) {
      errors.push(`上槽日が設定されていません (現在値: ${tank.metadata?.['上槽日']})`);
    }

    if (!tank.dailyData || Object.keys(tank.dailyData).length === 0) {
      errors.push('日次データがありません');
    } else {
      // 日次データの詳細チェック
      const dailyKeys = Object.keys(tank.dailyData);
      console.log('利用可能な日次データキー:', dailyKeys);
      
      const bmdDataCount = dailyKeys.filter(key => 
        key.startsWith('day_') && 
        tank.dailyData[key] && 
        tank.dailyData[key][COLUMN_NAMES.DAILY.BMD_COMPLEMENT] != null
      ).length;
      
      console.log('BMD補完データがある日数:', bmdDataCount);
      
      if (bmdDataCount === 0) {
        errors.push('BMD補完データがありません');
      } else {
        console.log('BMD補完データ例:', Object.entries(tank.dailyData)
          .filter(([key, data]) => 
            key.startsWith('day_') && 
            data && 
            data[COLUMN_NAMES.DAILY.BMD_COMPLEMENT] != null
          )
          .slice(0, 3)
          .map(([key, data]) => ({ 
            日: key, 
            BMD: data[COLUMN_NAMES.DAILY.BMD_COMPLEMENT] 
          }))
        );
      }
    }

    // 基準設定チェック
    const baseSettings = getBaseSettings(tank);
    console.log('基準設定計算結果:', baseSettings);
    
    if (!baseSettings) {
      errors.push('基準設定の計算に失敗しました（最高BMDが検出できません）');
    }

    console.log('最終エラー一覧:', errors);
    console.log('========================');

    return errors.length > 0 ? errors : null;
  };

  // チャートデータの作成
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
    const actualBMDData = [];
    Object.entries(tank.dailyData || {}).forEach(([key, dayData]) => {
      const day = parseInt(key.replace('day_', ''));
      const bmd = parseFloat(dayData[COLUMN_NAMES.DAILY.BMD_COMPLEMENT]);
      if (!isNaN(bmd)) {
        actualBMDData.push({ x: day, y: bmd });
      }
    });

    if (actualBMDData.length > 0) {
      datasets.push({
        label: '実測BMD',
        data: actualBMDData,
        borderColor: '#3B82F6',
        backgroundColor: '#3B82F6',
        borderWidth: 0,
        pointRadius: 4,
        pointHoverRadius: 6,
        showLine: false
      });
    }

    // パターンA（現状ペース継続）- 赤色点線
    if (predictionResult?.patternA?.data?.length > 0) {
      datasets.push({
        label: '予測A（現状ペース継続）',
        data: predictionResult.patternA.data.map(p => ({ 
          x: p.day, 
          y: parseFloat(p.predictedBMD) 
        })),
        borderColor: '#EF4444',
        backgroundColor: '#EF4444',
        borderWidth: 2,
        borderDash: [5, 5],
        fill: false,
        tension: 0.3,
        pointRadius: 2
      });
    }

    // パターンB（目標日数厳守）- 紫色点線
    if (predictionResult?.patternB?.data?.length > 0) {
      datasets.push({
        label: '予測B（目標日数厳守）',
        data: predictionResult.patternB.data.map(p => ({ 
          x: p.day, 
          y: parseFloat(p.predictedBMD) 
        })),
        borderColor: '#8B5CF6',
        backgroundColor: '#8B5CF6',
        borderWidth: 2,
        borderDash: [3, 3],
        fill: false,
        tension: 0.3,
        pointRadius: 2
      });
    }

    return { datasets };
  };

  // チャートオプション
  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top',
      },
      title: {
        display: true,
        text: 'BMD推移と予測'
      }
    },
    scales: {
      x: {
        type: 'linear',
        position: 'bottom',
        title: {
          display: true,
          text: '日数'
        }
      },
      y: {
        title: {
          display: true,
          text: 'BMD'
        }
      }
    }
  };

  const errorMessages = getErrorMessage();

  if (errorMessages && errorMessages.length > 0) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <div className="flex items-start">
          <AlertCircle className="w-5 h-5 text-yellow-600 mr-2 mt-0.5 flex-shrink-0" />
          <div>
            <h4 className="text-yellow-800 font-medium mb-2">進捗予測を実行できません</h4>
            <ul className="text-yellow-700 text-sm space-y-1">
              {errorMessages.map((error, index) => (
                <li key={index} className="flex items-start">
                  <span className="mr-2">•</span>
                  <span>{error}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 現在の進捗状況 */}
      {currentStatus && (
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <h3 className="text-lg font-semibold mb-3 flex items-center">
            <Activity className="w-5 h-5 mr-2" />
            現在の進捗状況（{currentStatus.day}日目）
          </h3>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <span className="font-medium text-gray-600">実測BMD:</span>
              <span className="ml-2 font-semibold">{currentStatus.actualBMD}</span>
            </div>
            <div>
              <span className="font-medium text-gray-600">理想BMD:</span>
              <span className="ml-2">{currentStatus.idealBMD}</span>
            </div>
            <div>
              <span className="font-medium text-gray-600">差分:</span>
              <span className={`ml-2 font-semibold ${
                parseFloat(currentStatus.difference) > 0 ? 'text-red-600' : 
                parseFloat(currentStatus.difference) < 0 ? 'text-blue-600' : 'text-green-600'
              }`}>
                {parseFloat(currentStatus.difference) > 0 ? '+' : ''}{currentStatus.difference}
              </span>
            </div>
            <div>
              <span className="font-medium text-gray-600">状態:</span>
              <span className={`ml-2 font-semibold px-2 py-1 rounded text-xs ${
                currentStatus.status === '大幅遅れ' ? 'bg-red-100 text-red-800' :
                currentStatus.status === '遅れ' ? 'bg-orange-100 text-orange-800' :
                currentStatus.status === '順調' ? 'bg-green-100 text-green-800' :
                currentStatus.status === '進み' ? 'bg-blue-100 text-blue-800' :
                currentStatus.status === '大幅進み' ? 'bg-purple-100 text-purple-800' :
                'bg-gray-100 text-gray-800'
              }`}>
                {currentStatus.status}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* BMD推移グラフ */}
      {(idealCurve.length > 0 || Object.keys(tank.dailyData || {}).length > 0) && (
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <h3 className="text-lg font-semibold mb-3 flex items-center">
            <TrendingUp className="w-5 h-5 mr-2" />
            BMD推移グラフ
          </h3>
          <div className="h-80">
            <Line data={getChartData()} options={chartOptions} />
          </div>
        </div>
      )}

      {/* 理想発酵進捗表 */}
      {idealCurve.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200">
          <div className="px-4 py-3 border-b border-gray-200">
            <h3 className="text-lg font-semibold flex items-center">
              <TrendingUp className="w-5 h-5 mr-2" />
              理想発酵進捗表
            </h3>
          </div>
          
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-center font-medium text-gray-700">日数</th>
                  <th className="px-3 py-2 text-center font-medium text-gray-700">発酵進行度</th>
                  <th className="px-3 py-2 text-center font-medium text-gray-700">完了率</th>
                  <th className="px-3 py-2 text-center font-medium text-gray-700">理想BMD</th>
                  <th className="px-3 py-2 text-center font-medium text-gray-700">理想ボーメ</th>
                  {currentStatus && <th className="px-3 py-2 text-center font-medium text-gray-700">実測との差</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {idealCurve.slice(0, 10).map((point) => {
                  const isCurrentDay = currentStatus && point.day === currentStatus.day;
                  const actualData = tank.dailyData[`day_${point.day}`];
                  const actualBMD = actualData ? parseFloat(actualData[COLUMN_NAMES.DAILY.BMD_COMPLEMENT]) : null;
                  const difference = actualBMD ? (actualBMD - parseFloat(point.idealBMD)).toFixed(2) : null;
                  
                  return (
                    <tr key={point.day} className={isCurrentDay ? 'bg-blue-50' : ''}>
                      <td className="px-3 py-2 text-center font-medium">
                        {point.day}
                        {isCurrentDay && <span className="ml-1 text-blue-600 text-xs">現在</span>}
                      </td>
                      <td className="px-3 py-2 text-center">{point.fermentationProgress}%</td>
                      <td className="px-3 py-2 text-center">{point.progressRate}%</td>
                      <td className="px-3 py-2 text-center">{point.idealBMD}</td>
                      <td className="px-3 py-2 text-center">{point.idealBaume}</td>
                      {currentStatus && (
                        <td className="px-3 py-2 text-center">
                          {difference ? (
                            <span className={
                              parseFloat(difference) > 0.5 ? 'text-red-600 font-medium' :
                              parseFloat(difference) < -0.5 ? 'text-blue-600 font-medium' :
                              'text-green-600'
                            }>
                              {parseFloat(difference) > 0 ? '+' : ''}{difference}
                            </span>
                          ) : '-'}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 予測表（パターンA/B）with サマリーカード */}
      {predictionResult && (
        <div className="space-y-4">
          {/* 予測サマリーカード */}
          {currentStatus && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className={`p-4 rounded-lg border ${
                currentStatus.status === '順調' ? 'bg-green-50 border-green-200' :
                currentStatus.status === '遅れ' || currentStatus.status === '大幅遅れ' ? 
                'bg-red-50 border-red-200' : 'bg-blue-50 border-blue-200'
              }`}>
                <div className="font-medium">現在の状況</div>
                <div className="text-lg">
                  BMD差分: {parseFloat(currentStatus.difference) > 0 ? '+' : ''}{currentStatus.difference}
                </div>
                <div className="text-sm">
                  状態: {currentStatus.status}
                </div>
              </div>
              
              <div className="bg-red-50 border border-red-200 p-4 rounded-lg">
                <div className="font-medium">現状ペース継続</div>
                <div className="text-lg">
                  {predictionResult.patternA.completionDay}日目完成予定
                </div>
                <div className="text-sm text-gray-600">
                  最終ボーメ: {predictionResult.patternA.data.length > 0 ? 
                    predictionResult.patternA.data[predictionResult.patternA.data.length - 1].predictedBaume : 
                    '計算中'}度
                </div>
              </div>
              
              <div className="bg-purple-50 border border-purple-200 p-4 rounded-lg">
                <div className="font-medium">目標日数厳守</div>
                <div className="text-lg">
                  {predictionResult.patternB.completionDay}日目完成
                </div>
                <div className="text-sm text-gray-600">
                  最終ボーメ: {predictionResult.patternB.data.length > 0 ?
                    predictionResult.patternB.data[predictionResult.patternB.data.length - 1].predictedBaume :
                    '計算中'}度
                </div>
              </div>
            </div>
          )}

          {/* 予測詳細表 */}
          <div className="bg-white rounded-lg border border-gray-200">
            <div className="px-4 py-3 border-b border-gray-200">
              <h3 className="text-lg font-semibold flex items-center">
                <Activity className="w-5 h-5 mr-2" />
                予測詳細表
              </h3>
            </div>
            
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-2 text-center font-medium text-gray-700">日数</th>
                    <th className="px-3 py-2 text-center font-medium text-gray-700 text-red-600">パターンA<br/>（現状ペース継続）</th>
                    <th className="px-3 py-2 text-center font-medium text-gray-700 text-purple-600">パターンB<br/>（目標日数厳守）</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {Array.from({ length: Math.min(10, Math.max(
                    predictionResult.patternA.data.length, 
                    predictionResult.patternB.data.length
                  )) }).map((_, index) => {
                    const patternAData = predictionResult.patternA.data[index];
                    const patternBData = predictionResult.patternB.data[index];
                    const day = patternAData?.day || patternBData?.day;
                    
                    return (
                      <tr key={day}>
                        <td className="px-3 py-2 text-center font-medium">{day}日</td>
                        <td className="px-3 py-2 text-center text-red-700 font-mono">
                          {patternAData ? `${patternAData.predictedBMD} / ${patternAData.predictedBaume}` : '-'}
                        </td>
                        <td className="px-3 py-2 text-center text-purple-700 font-mono">
                          {patternBData ? `${patternBData.predictedBMD} / ${patternBData.predictedBaume}` : '-'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            
            <div className="px-4 py-3 border-t border-gray-200 text-xs text-gray-600 space-y-1">
              <div><strong>統合モデル活用:</strong> {selectedModel.name} ({selectedPattern})</div>
              <div><strong>パターンA:</strong> 現在の進捗差を維持した場合の予測</div>
              <div><strong>パターンB:</strong> 目標上槽日に合わせた理想的な進捗予測</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProgressPrediction;