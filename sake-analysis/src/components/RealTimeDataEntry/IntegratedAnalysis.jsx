import React, { useState, useMemo, useEffect } from 'react';
import { BarChart3, Thermometer, Droplets, Save, FolderOpen, TrendingUp, AlertCircle } from 'lucide-react';
import { Line, Scatter } from 'react-chartjs-2';
import { COLUMN_NAMES } from '../../utils/csvParser';

const IntegratedAnalysis = ({ currentTank, allTanks }) => {
  const [activeTab, setActiveTab] = useState('progress');
  const [integratedModels, setIntegratedModels] = useState([]);
  const [selectedModel, setSelectedModel] = useState(null);
  const [showModelList, setShowModelList] = useState(false);

  // 統合モデリングで保存されたモデルを読み込み
  useEffect(() => {
    const models = localStorage.getItem('integratedModels');
    if (models) {
      try {
        const parsed = JSON.parse(models);
        if (Array.isArray(parsed)) {
          setIntegratedModels(parsed);
        }
      } catch (e) {
        console.error('Failed to parse integrated models:', e);
      }
    }
  }, []);

  // 現在のタンクの実測データ
  const currentTankData = useMemo(() => {
    if (!currentTank.dailyData || Object.keys(currentTank.dailyData).length === 0) {
      return null;
    }

    const data = {
      progress: [],
      temperature: [],
      water: [],
      metadata: currentTank.metadata
    };

    let cumulativeWater = 0;

    Object.entries(currentTank.dailyData).forEach(([key, dayData]) => {
      const day = parseInt(dayData[COLUMN_NAMES.DAILY.DAY]);
      const bmd = parseFloat(dayData[COLUMN_NAMES.DAILY.BMD_COMPLEMENT]);
      const temp = parseFloat(dayData[COLUMN_NAMES.DAILY.TEMP_MORNING]);
      const baume = parseFloat(dayData[COLUMN_NAMES.DAILY.BAUME_COMPLEMENT]);
      const alcohol = parseFloat(dayData[COLUMN_NAMES.DAILY.ALCOHOL_COMPLEMENT]);
      const water = parseFloat(dayData[COLUMN_NAMES.DAILY.OISUI]) || 0;
      
      cumulativeWater += water;

      if (!isNaN(day)) {
        // 進捗データ
        if (!isNaN(bmd)) {
          data.progress.push({ day, bmd });
        }
        
        // 品温データ
        if (!isNaN(temp)) {
          data.temperature.push({
            day,
            temp,
            baume: isNaN(baume) ? null : baume,
            alcohol: isNaN(alcohol) ? null : alcohol
          });
        }
        
        // 追い水データ
        data.water.push({
          day,
          water,
          cumulativeWater,
          baume: isNaN(baume) ? null : baume,
          alcohol: isNaN(alcohol) ? null : alcohol
        });
      }
    });

    // データをソート
    data.progress.sort((a, b) => a.day - b.day);
    data.temperature.sort((a, b) => a.day - b.day);
    data.water.sort((a, b) => a.day - b.day);

    return data;
  }, [currentTank]);

  // 予測計算関数
  const calculatePrediction = (modelData, currentData, type) => {
    if (!modelData || !currentData) return null;

    const predictions = {
      progress: [],
      temperature: [],
      water: []
    };

    // 進捗予測
    if (type === 'progress' && modelData.progressData) {
      // progressDataが配列か、bmdDataを含むオブジェクトかを確認
      const modelProgress = Array.isArray(modelData.progressData) 
        ? modelData.progressData 
        : (modelData.progressData.bmdData || []);
      
      const currentProgress = currentData.progress;
      
      if (currentProgress.length > 0 && modelProgress.length > 0) {
        const latestDay = currentProgress[currentProgress.length - 1].day;
        const latestBMD = currentProgress[currentProgress.length - 1].bmd;
        
        // モデルから対応する日数のデータを探す
        const modelDataAtDay = modelProgress.find(m => m.day === latestDay);
        
        if (modelDataAtDay) {
          // BMDの差分を計算
          const bmdDifference = latestBMD - modelDataAtDay.bmd;
          
          // 今後の予測（モデルに差分を加えて予測）
          modelProgress.forEach(modelPoint => {
            if (modelPoint.day > latestDay) {
              predictions.progress.push({
                day: modelPoint.day,
                predictedBMD: modelPoint.bmd + bmdDifference,
                modelBMD: modelPoint.bmd,
                difference: bmdDifference
              });
            }
          });
        }
      }
    }

    // 品温予測
    if (type === 'temperature' && modelData.temperatureData) {
      const modelTemp = modelData.temperatureData;
      const currentTemp = currentData.temperature;
      
      if (currentTemp.length > 0 && modelTemp.length > 0) {
        // 直近5日間の平均温度差を計算
        let tempDiffSum = 0;
        let tempDiffCount = 0;
        
        currentTemp.slice(-5).forEach(current => {
          const modelPoint = modelTemp.find(m => m.day === current.day);
          if (modelPoint && modelPoint.temp !== null && current.temp !== null) {
            tempDiffSum += current.temp - modelPoint.temp;
            tempDiffCount++;
          }
        });
        
        const avgTempDiff = tempDiffCount > 0 ? tempDiffSum / tempDiffCount : 0;
        
        // 予測
        const latestDay = currentTemp[currentTemp.length - 1].day;
        modelTemp.forEach(modelPoint => {
          if (modelPoint.day > latestDay && modelPoint.temp !== null) {
            predictions.temperature.push({
              day: modelPoint.day,
              predictedTemp: modelPoint.temp + avgTempDiff,
              modelTemp: modelPoint.temp,
              difference: avgTempDiff
            });
          }
        });
      }
    }

    // 追い水予測
    if (type === 'water' && modelData.oisuiData) {
      const currentWater = currentData.water;
      const latestData = currentWater[currentWater.length - 1];
      
      if (latestData && modelData.oisuiData.analysis2?.parameters) {
        const params = modelData.oisuiData.analysis2.parameters;
        
        // 現在のアルコール度数から必要な追い水量を計算
        if (latestData.alcohol && latestData.alcohol > params.targetAlcoholThreshold) {
          const currentVolume = currentData.metadata?.[COLUMN_NAMES.META.TOTAL_VOLUME] || 0;
          const requiredWater = (currentVolume * latestData.alcohol / params.targetAlcohol) - currentVolume;
          
          predictions.water.push({
            recommendedWater: Math.max(0, requiredWater - latestData.cumulativeWater),
            targetAlcohol: params.targetAlcohol,
            currentAlcohol: latestData.alcohol,
            threshold: params.targetAlcoholThreshold
          });
        }
      }
    }

    return predictions;
  };

  // 現在選択されているモデルでの予測
  const predictions = useMemo(() => {
    if (!selectedModel || !currentTankData) return null;
    
    return {
      progress: calculatePrediction(selectedModel, currentTankData, 'progress'),
      temperature: calculatePrediction(selectedModel, currentTankData, 'temperature'),
      water: calculatePrediction(selectedModel, currentTankData, 'water')
    };
  }, [selectedModel, currentTankData]);

  // グラフオプション
  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top',
      },
      tooltip: {
        mode: 'index',
        intersect: false,
      },
    },
    scales: {
      x: {
        title: {
          display: true,
          text: '日数'
        }
      },
      y: {
        title: {
          display: true,
          text: '値'
        }
      }
    }
  };

  return (
    <div className="space-y-4">
      {/* モデル選択 */}
      <div className="bg-blue-50 rounded-lg p-4">
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-sm font-semibold text-blue-900 flex items-center">
            <FolderOpen className="w-4 h-4 mr-2" />
            統合モデルを選択
          </h4>
          <button
            onClick={() => setShowModelList(!showModelList)}
            className="text-sm text-blue-600 hover:text-blue-800"
          >
            {showModelList ? '閉じる' : 'モデル一覧を表示'}
          </button>
        </div>
        
        {selectedModel ? (
          <div className="text-sm">
            <div className="font-medium">{selectedModel.name}</div>
            <div className="text-gray-600">
              作成日: {new Date(selectedModel.savedAt).toLocaleDateString()}
              （元タンク: {selectedModel.sourceTankIds.join(', ')}）
            </div>
          </div>
        ) : (
          <p className="text-sm text-gray-600">
            統合モデルを選択すると、過去の発酵パターンに基づいて予測・分析を行います
          </p>
        )}

        {/* モデル一覧 */}
        {showModelList && (
          <div className="mt-4 max-h-60 overflow-y-auto">
            {integratedModels.length === 0 ? (
              <p className="text-sm text-gray-500">保存された統合モデルがありません</p>
            ) : (
              <div className="space-y-2">
                {integratedModels.map(model => (
                  <div
                    key={model.id}
                    className={`p-3 border rounded cursor-pointer transition-colors ${
                      selectedModel?.id === model.id
                        ? 'border-blue-500 bg-blue-100'
                        : 'border-gray-300 hover:bg-gray-50'
                    }`}
                    onClick={() => {
                      setSelectedModel(model);
                      setShowModelList(false);
                    }}
                  >
                    <div className="font-medium text-sm">{model.name}</div>
                    <div className="text-xs text-gray-600">
                      {new Date(model.savedAt).toLocaleString()} | 
                      タンク: {model.sourceTankIds.join(', ')}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {!selectedModel && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-start space-x-2">
            <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-yellow-800">
              <p className="font-medium">統合モデルを選択してください</p>
              <p className="mt-1">
                分析モードで作成した統合モデルを選択すると、そのモデルに基づいて現在の発酵状況を分析・予測できます。
              </p>
            </div>
          </div>
        </div>
      )}

      {selectedModel && currentTankData && (
        <>
          {/* タブナビゲーション */}
          <div className="flex space-x-2 border-b border-gray-200">
            <button
              onClick={() => setActiveTab('progress')}
              className={`flex items-center space-x-2 px-4 py-2 border-b-2 transition-colors ${
                activeTab === 'progress'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-gray-800'
              }`}
            >
              <TrendingUp className="w-4 h-4" />
              <span>進捗予測</span>
            </button>
            <button
              onClick={() => setActiveTab('temperature')}
              className={`flex items-center space-x-2 px-4 py-2 border-b-2 transition-colors ${
                activeTab === 'temperature'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-gray-800'
              }`}
            >
              <Thermometer className="w-4 h-4" />
              <span>品温予測</span>
            </button>
            <button
              onClick={() => setActiveTab('water')}
              className={`flex items-center space-x-2 px-4 py-2 border-b-2 transition-colors ${
                activeTab === 'water'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-gray-800'
              }`}
            >
              <Droplets className="w-4 h-4" />
              <span>追い水分析</span>
            </button>
          </div>

          {/* 進捗予測タブ */}
          {activeTab === 'progress' && (
            <div className="bg-white rounded-lg p-4">
              <h4 className="text-md font-semibold mb-4">BMD進捗予測</h4>
              
              {/* 現在の状況 */}
              {currentTankData.progress.length > 0 && (
                <div className="mb-4 p-3 bg-gray-50 rounded">
                  <div className="text-sm">
                    <div>現在日数: {currentTankData.progress[currentTankData.progress.length - 1].day}日目</div>
                    <div>現在BMD: {currentTankData.progress[currentTankData.progress.length - 1].bmd.toFixed(2)}</div>
                  </div>
                </div>
              )}

              {/* BMD比較グラフ */}
              <div className="h-64 mb-4">
                <Line
                  data={{
                    labels: [
                      ...currentTankData.progress.map(d => d.day),
                      ...(predictions?.progress?.progress || []).map(p => p.day)
                    ].filter((v, i, a) => a.indexOf(v) === i).sort((a, b) => a - b),
                    datasets: [
                      {
                        label: '実測BMD',
                        data: currentTankData.progress.map(d => ({ x: d.day, y: d.bmd })),
                        borderColor: 'rgb(59, 130, 246)',
                        backgroundColor: 'rgba(59, 130, 246, 0.1)',
                        tension: 0.1
                      },
                      selectedModel && selectedModel.progressData && {
                        label: `モデル: ${selectedModel.name}`,
                        data: Array.isArray(selectedModel.progressData) 
                          ? selectedModel.progressData.map(d => ({ x: d.day, y: d.bmd }))
                          : (selectedModel.progressData.bmdData || []).map(d => ({ x: d.day, y: d.bmd })),
                        borderColor: 'rgb(239, 68, 68)',
                        backgroundColor: 'rgba(239, 68, 68, 0.1)',
                        borderDash: [5, 5],
                        tension: 0.1
                      },
                      predictions?.progress?.progress && {
                        label: '予測BMD',
                        data: predictions.progress.progress.map(p => ({ x: p.day, y: p.predictedBMD })),
                        borderColor: 'rgb(34, 197, 94)',
                        backgroundColor: 'rgba(34, 197, 94, 0.1)',
                        borderDash: [3, 3],
                        tension: 0.1
                      }
                    ].filter(Boolean)
                  }}
                  options={chartOptions}
                />
              </div>

              {/* 予測テーブル */}
              {predictions?.progress?.progress && predictions.progress.progress.length > 0 && (
                <div className="overflow-x-auto">
                  <h5 className="text-sm font-medium mb-2">今後の予測</h5>
                  <table className="min-w-full text-sm">
                    <thead className="bg-gray-100">
                      <tr>
                        <th className="px-3 py-2 text-left">日数</th>
                        <th className="px-3 py-2 text-center">モデルBMD</th>
                        <th className="px-3 py-2 text-center">予測BMD</th>
                        <th className="px-3 py-2 text-center">差分</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {predictions.progress.progress.slice(0, 10).map((pred) => (
                        <tr key={pred.day}>
                          <td className="px-3 py-2">{pred.day}日</td>
                          <td className="px-3 py-2 text-center">{pred.modelBMD.toFixed(2)}</td>
                          <td className="px-3 py-2 text-center font-medium">
                            {pred.predictedBMD.toFixed(2)}
                          </td>
                          <td className="px-3 py-2 text-center">
                            <span className={pred.difference > 0 ? 'text-red-600' : 'text-blue-600'}>
                              {pred.difference > 0 ? '+' : ''}{pred.difference.toFixed(2)}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* 品温予測タブ */}
          {activeTab === 'temperature' && (
            <div className="bg-white rounded-lg p-4">
              <h4 className="text-md font-semibold mb-4">品温予測</h4>
              
              {/* 品温比較グラフ */}
              <div className="h-64 mb-4">
                <Line
                  data={{
                    labels: [
                      ...currentTankData.temperature.map(d => d.day),
                      ...(predictions?.temperature?.temperature || []).map(p => p.day)
                    ].filter((v, i, a) => a.indexOf(v) === i).sort((a, b) => a - b),
                    datasets: [
                      {
                        label: '実測品温',
                        data: currentTankData.temperature.map(d => ({ x: d.day, y: d.temp })),
                        borderColor: 'rgb(239, 68, 68)',
                        backgroundColor: 'rgba(239, 68, 68, 0.1)',
                        tension: 0.1
                      },
                      selectedModel && selectedModel.temperatureData && {
                        label: `モデル品温`,
                        data: Array.isArray(selectedModel.temperatureData)
                          ? selectedModel.temperatureData.filter(d => d.temp !== null).map(d => ({ x: d.day, y: d.temp }))
                          : [],
                        borderColor: 'rgb(156, 163, 175)',
                        backgroundColor: 'rgba(156, 163, 175, 0.1)',
                        borderDash: [5, 5],
                        tension: 0.1
                      },
                      predictions?.temperature?.temperature && {
                        label: '予測品温',
                        data: predictions.temperature.temperature.map(p => ({ x: p.day, y: p.predictedTemp })),
                        borderColor: 'rgb(251, 146, 60)',
                        backgroundColor: 'rgba(251, 146, 60, 0.1)',
                        borderDash: [3, 3],
                        tension: 0.1
                      }
                    ].filter(Boolean)
                  }}
                  options={{
                    ...chartOptions,
                    scales: {
                      ...chartOptions.scales,
                      y: {
                        ...chartOptions.scales.y,
                        title: {
                          display: true,
                          text: '品温 (°C)'
                        }
                      }
                    }
                  }}
                />
              </div>

              {/* 品温管理提案 */}
              {predictions?.temperature?.temperature && predictions.temperature.temperature.length > 0 && (
                <div className="bg-yellow-50 rounded-lg p-4">
                  <h5 className="text-sm font-medium mb-2">品温管理の提案</h5>
                  <div className="text-sm space-y-2">
                    {predictions.temperature.temperature[0].difference > 1 && (
                      <p className="text-yellow-800">
                        ⚠️ 現在の品温はモデルより平均{Math.abs(predictions.temperature.temperature[0].difference).toFixed(1)}°C高めです。
                        冷却を検討してください。
                      </p>
                    )}
                    {predictions.temperature.temperature[0].difference < -1 && (
                      <p className="text-blue-800">
                        ❄️ 現在の品温はモデルより平均{Math.abs(predictions.temperature.temperature[0].difference).toFixed(1)}°C低めです。
                        温度管理に注意してください。
                      </p>
                    )}
                    {Math.abs(predictions.temperature.temperature[0].difference) <= 1 && (
                      <p className="text-green-800">
                        ✓ 品温は理想的な範囲内で推移しています。
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 追い水分析タブ */}
          {activeTab === 'water' && (
            <div className="bg-white rounded-lg p-4">
              <h4 className="text-md font-semibold mb-4">追い水分析</h4>
              
              {/* 現在の状況 */}
              {currentTankData.water.length > 0 && (
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div className="bg-blue-50 p-3 rounded">
                    <div className="text-sm text-gray-600">累積追い水量</div>
                    <div className="text-xl font-bold">
                      {currentTankData.water[currentTankData.water.length - 1].cumulativeWater.toFixed(0)}L
                    </div>
                  </div>
                  <div className="bg-green-50 p-3 rounded">
                    <div className="text-sm text-gray-600">現在アルコール</div>
                    <div className="text-xl font-bold">
                      {currentTankData.water[currentTankData.water.length - 1].alcohol?.toFixed(1) || '-'}%
                    </div>
                  </div>
                </div>
              )}

              {/* 追い水推奨 */}
              {predictions?.water?.water && predictions.water.water.length > 0 && (
                <div className="bg-cyan-50 rounded-lg p-4">
                  <h5 className="text-sm font-medium mb-2">追い水推奨</h5>
                  <div className="text-sm space-y-2">
                    <p>
                      現在のアルコール度数: {predictions.water.water[0].currentAlcohol.toFixed(1)}%
                    </p>
                    <p>
                      目標アルコール度数: {predictions.water.water[0].targetAlcohol}%
                    </p>
                    {predictions.water.water[0].recommendedWater > 0 && (
                      <p className="font-medium text-cyan-800">
                        推奨追い水量: {predictions.water.water[0].recommendedWater.toFixed(0)}L
                      </p>
                    )}
                    {predictions.water.water[0].currentAlcohol <= predictions.water.water[0].threshold && (
                      <p className="text-green-800">
                        ✓ 現在のアルコール度数は閾値以下です。追い水は不要です。
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* モデルの追い水パラメータ */}
              {selectedModel?.oisuiData?.analysis2?.parameters && (
                <div className="mt-4 p-3 bg-gray-50 rounded">
                  <h5 className="text-sm font-medium mb-2">モデルパラメータ</h5>
                  <div className="text-sm grid grid-cols-2 gap-2">
                    <div>アルコール係数: {selectedModel.oisuiData.analysis2.parameters.alcoholCoeff}</div>
                    <div>閾値: {selectedModel.oisuiData.analysis2.parameters.targetAlcoholThreshold}%</div>
                    <div>目標ボーメ: {selectedModel.oisuiData.analysis2.parameters.targetBaume}</div>
                    <div>目標アルコール: {selectedModel.oisuiData.analysis2.parameters.targetAlcohol}%</div>
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default IntegratedAnalysis;