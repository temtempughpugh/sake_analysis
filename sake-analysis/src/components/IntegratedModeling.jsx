import React, { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { Save, Database, TrendingUp, Droplets, Thermometer, FolderOpen, Trash2, Edit2 } from 'lucide-react';
import ProgressModeling from './ProgressModeling';
import OisuiAnalysis from './OisuiAnalysis';
import OisuiAnalysis2 from './OisuiAnalysis2';
import TemperatureAnalysis from './TemperatureAnalysis';
import { COLUMN_NAMES } from '../utils/csvParser';

const IntegratedModeling = ({ tanks, selectedTankIds }) => {
  // タブの状態管理
  const [activeTab, setActiveTab] = useState('progress'); // 'progress', 'oisui', 'temperature'
  
  // 各分析コンポーネントのrefを作成（現在は使用しない）
  // const progressRef = useRef(null);
  // const oisui1Ref = useRef(null);
  // const oisui2Ref = useRef(null);
  // const temperatureRef = useRef(null);
  
  // 保存済みモデルの状態管理
  const [savedModels, setSavedModels] = useState(() => {
    const saved = localStorage.getItem('integratedModels');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        // 古い形式（オブジェクト）から新しい形式（配列）への移行
        if (Array.isArray(parsed)) {
          return parsed;
        } else if (parsed && typeof parsed === 'object') {
          // 古い形式の場合は空配列を返す
          return [];
        }
      } catch (e) {
        console.error('Failed to parse saved models:', e);
      }
    }
    return [];
  });
  
  // モデル名入力ダイアログの状態
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [modelName, setModelName] = useState('');
  
  // モデル一覧表示の状態
  const [showModelList, setShowModelList] = useState(false);
  
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
    const firstTank = selectedTanksData[0];
    if (!firstTank) return;
    
    const metadata = firstTank.metadata || {};
    const startBaume = parseFloat(metadata[COLUMN_NAMES.META.AB_START_BAUME]);
    const startAlcohol = parseFloat(metadata[COLUMN_NAMES.META.AB_START_ALCOHOL]);
    const finalBaume = parseFloat(metadata[COLUMN_NAMES.META.FINAL_BAUME]);
    const finalAlcohol = parseFloat(metadata[COLUMN_NAMES.META.FINAL_ALCOHOL]);
    const totalVolume = parseFloat(metadata[COLUMN_NAMES.META.TOTAL_VOLUME]);
    const totalWater = parseFloat(metadata[COLUMN_NAMES.META.TOTAL_WATER]) || 0;
    
    let alcoholCoeff = 0.64;
    if (!isNaN(startBaume) && !isNaN(startAlcohol) && !isNaN(finalBaume) && !isNaN(finalAlcohol) && !isNaN(totalVolume)) {
      const dilutionFactor = (totalVolume + totalWater) / totalVolume;
      const trueFinalBaume = finalBaume * dilutionFactor;
      const trueFinalAlcohol = finalAlcohol * dilutionFactor;
      const baumeChange = startBaume - trueFinalBaume;
      const alcoholChange = trueFinalAlcohol - startAlcohol;
      if (baumeChange > 0) {
        alcoholCoeff = alcoholChange / baumeChange;
      }
    }
    
    setOisui2EditParams({
      alcoholCoeff: alcoholCoeff || 0.64,
      targetAlcoholThreshold: 15,
      targetBaume: parseFloat(metadata[COLUMN_NAMES.META.FINAL_BAUME]) || -1.21,
      targetAlcohol: parseFloat(metadata[COLUMN_NAMES.META.FINAL_ALCOHOL]) || 18.65
    });
    
    setIsParamsInitialized(true);
  }, [tanks, selectedTankIds, isParamsInitialized]);
  
  // 追い水分析2のパラメータ状態を削除（OisuiAnalysis2の現在値を保存）

  // 分析データを取得する関数
  const getAnalysisData = useCallback(() => {
    const selectedTanks = tanks.filter(tank => selectedTankIds.includes(tank.tankId));
    
    // OisuiAnalysis1のデータを計算（OisuiAnalysisコンポーネントと同じロジック）
    const calculateOisui1Data = () => {
      const analysisData = [];
      selectedTanks.forEach(tank => {
        const tankNumber = tank.metadata?.[COLUMN_NAMES.META.TANK_NUMBER] || tank.tankId;
        const batchSize = tank.metadata?.[COLUMN_NAMES.META.BATCH_SIZE] || null;
        
        Object.entries(tank.dailyData || {}).forEach(([dayKey, dayData]) => {
          const day = parseInt(dayData[COLUMN_NAMES.DAILY.DAY]);
          if (day !== 5 && day !== 7) return;
          
          const baumeBMD = parseFloat(dayData[COLUMN_NAMES.DAILY.BAUME_BMD_DAY]);
          const addedWater = parseFloat(dayData[COLUMN_NAMES.DAILY.WATER]) || 0;
          
          if (!isNaN(baumeBMD)) {
            const baseVolume = batchSize * 2.35;
            let cumulativeWater = 0;
            
            Object.entries(tank.dailyData).forEach(([otherDayKey, otherDayData]) => {
              const otherDay = parseInt(otherDayData[COLUMN_NAMES.DAILY.DAY]);
              if (otherDay < day) {
                cumulativeWater += parseFloat(otherDayData[COLUMN_NAMES.DAILY.WATER]) || 0;
              }
            });
            
            const volumeBeforeToday = baseVolume + cumulativeWater - addedWater;
            const dilutionFactor = (volumeBeforeToday + addedWater) / volumeBeforeToday;
            const theoreticalChange = baumeBMD - baumeBMD / dilutionFactor;
            
            analysisData.push({
              tankId: tank.tankId,
              tankNumber,
              day,
              batchSize,
              baumeBMD,
              addedWater,
              totalVolume: volumeBeforeToday,
              cumulativeWater,
              dilutionFactor,
              theoreticalChange
            });
          }
        });
      });
      
      const day5Data = analysisData.filter(item => item.day === 5);
      const day7Data = analysisData.filter(item => item.day === 7);
      
      // 線形回帰計算
      const calculateRegression = (data) => {
        if (data.length < 2) return null;
        const n = data.length;
        const x = data.map(d => d.baumeBMD);
        const y = data.map(d => d.theoreticalChange);
        const sumX = x.reduce((a, b) => a + b, 0);
        const sumY = y.reduce((a, b) => a + b, 0);
        const sumXY = x.reduce((sum, xi, i) => sum + xi * y[i], 0);
        const sumXX = x.reduce((sum, xi) => sum + xi * xi, 0);
        const a = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
        const b = (sumY - a * sumX) / n;
        const yMean = sumY / n;
        const ssTotal = y.reduce((sum, yi) => sum + Math.pow(yi - yMean, 2), 0);
        const ssResidual = y.reduce((sum, yi, i) => {
          const predicted = a * x[i] + b;
          return sum + Math.pow(yi - predicted, 2);
        }, 0);
        const rSquared = ssTotal > 0 ? 1 - (ssResidual / ssTotal) : 0;
        return { a, b, rSquared };
      };
      
      return {
        day5Data,
        day7Data,
        day5Regression: calculateRegression(day5Data),
        day7Regression: calculateRegression(day7Data)
      };
    };
    
    // TemperatureAnalysisのデータを計算
    const calculateTemperatureData = () => {
      const analysisData = [];
      selectedTanks.forEach(tank => {
        const tankId = tank.tankId;
        const totalVolume = tank.metadata[COLUMN_NAMES.META.TOTAL_VOLUME] || 0;
        
        if (!tank.dailyData || totalVolume === 0) return;
        
        Object.entries(tank.dailyData).forEach(([dayKey, dayData]) => {
          const day = parseInt(dayData[COLUMN_NAMES.DAILY.DAY]);
          if (!day) return;
          
          const basicData = {
            tankId,
            day,
            seq: tank.metadata[COLUMN_NAMES.META.TANK_NUMBER] || tankId,
            temp1: parseFloat(dayData[COLUMN_NAMES.DAILY.TEMP_1]) || null,
            tempChange: parseFloat(dayData[COLUMN_NAMES.DAILY.TEMP_CHANGE]) || null,
            addedWater: parseFloat(dayData[COLUMN_NAMES.DAILY.WATER]) || 0,
            baumeWithoutWater: parseFloat(dayData[COLUMN_NAMES.DAILY.BAUME_BMD_DAY]) || null,
            alcoholWithoutWater: parseFloat(dayData[COLUMN_NAMES.DAILY.ALCOHOL]) || null,
            bmdWithoutWater: parseFloat(dayData[COLUMN_NAMES.DAILY.BMD]) || null
          };
          
          analysisData.push(basicData);
        });
      });
      
      return analysisData;
    };
    
    // 進捗モデリングのデータを計算（統合パターンも含む）
    const calculateProgressData = () => {
      const tankAnalysis = [];
      
      selectedTanks.forEach(tank => {
        if (!tank.dailyData) return;
        
        const bmdData = [];
        Object.entries(tank.dailyData).forEach(([dayKey, dayData]) => {
          const day = parseInt(dayData[COLUMN_NAMES.DAILY.DAY]);
          const bmd = parseFloat(dayData[COLUMN_NAMES.DAILY.BMD]);
          if (!isNaN(day) && !isNaN(bmd) && bmd > 0) {
            bmdData.push({ day, bmd });
          }
        });
        
        if (bmdData.length < 3) return;
        
        const sortedData = bmdData.sort((a, b) => a.day - b.day);
        const maxBMDPoint = sortedData.reduce((max, point) => 
          point.bmd > max.bmd ? point : max, sortedData[0]);
        
        const maxBMD = maxBMDPoint.bmd;
        const maxBMDDay = maxBMDPoint.day;
        const finalBMD = sortedData[sortedData.length - 1].bmd;
        const finalDay = sortedData[sortedData.length - 1].day;
        const fermentationDays = finalDay - maxBMDDay;
        
        const progressRates = sortedData.map(point => ({
          day: point.day,
          actualDay: point.day,
          actualBMD: point.bmd,
          progress: (point.bmd / maxBMD) * 100,
          normalizedTime: ((point.day - 1) / (fermentationDays - 1)) * 100
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
      
      // 統合パターンの作成（ProgressModelingと同じロジック）
      const patterns = [];
      
      if (tankAnalysis.length >= 2) {
        // 発酵進行度ベース統合
        const fermentationProgressPattern = [];
        for (let progress = 0; progress <= 100; progress += 5) {
          const values = tankAnalysis.map(analysis => {
            const targetDay = analysis.maxBMDDay + (analysis.fermentationDays * progress / 100);
            const closest = analysis.progressRates.reduce((prev, curr) => 
              Math.abs(curr.actualDay - targetDay) < Math.abs(prev.actualDay - targetDay) ? curr : prev
            );
            return closest.progress;
          });
          const avgProgress = values.reduce((sum, p) => sum + p, 0) / values.length;
          fermentationProgressPattern.push({ x: progress, y: avgProgress });
        }
        
        patterns.push({
          name: `発酵進行度ベース (${tankAnalysis.length}タンク)`,
          type: 'fermentation_progress',
          data: fermentationProgressPattern,
          sourceCount: tankAnalysis.length
        });
      }
      
      return {
        tankAnalysis,
        patterns
      };
    };
    
    // OisuiAnalysis2のデータを計算
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
    
    return {
      oisui1Data: calculateOisui1Data(),
      oisui2Data: calculateOisui2Data(),
      temperatureData: calculateTemperatureData(),
      progressData: calculateProgressData()
    };
  }, [tanks, selectedTankIds]);

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
            {mode === 'edit' ? (
              <span className="ml-4 text-sm font-normal text-gray-600">
                編集モード - 選択タンク: {selectedTankIds.join(', ')}
              </span>
            ) : (
              <span className="ml-4 text-sm font-normal text-blue-600">
                読み込みモード - {loadedModelData?.name} (タンク: {loadedModelData?.sourceTankIds.join(', ')})
              </span>
            )}
          </h2>
          
          <div className="flex space-x-2">
            {mode === 'view' && (
              <button
                onClick={handleBackToEdit}
                className="flex items-center space-x-2 px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors"
              >
                <span>編集モードに戻る</span>
              </button>
            )}
            
            <button
              onClick={() => setShowModelList(true)}
              className="flex items-center space-x-2 px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors"
            >
              <FolderOpen className="w-4 h-4" />
              <span>モデル一覧</span>
            </button>
            
            {mode === 'edit' && (
              <button
                onClick={() => {
                  setModelName('');
                  setShowSaveDialog(true);
                }}
                className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
              >
                <Save className="w-4 h-4" />
                <span>統合モデルを保存</span>
              </button>
            )}
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
              <>
                {/* 追い水分析1（5日目・7日目） */}
                <div className="mb-8">
                  <h4 className="text-md font-semibold mb-4 text-gray-700">
                    追い水分析1 - 5日目・7日目ボーメ係数
                  </h4>
                  <OisuiAnalysis tanks={tanks} selectedTankIds={selectedTankIds} />
                </div>
                
                {/* 追い水分析2（8日目以降） */}
                <div>
                  <h4 className="text-md font-semibold mb-4 text-gray-700">
                    追い水分析2 - 8日目以降の追い水計算
                  </h4>
                  
                  {/* パラメータ編集フォーム */}
                  <div className="bg-blue-50 p-4 rounded-lg mb-4">
                    <h5 className="font-semibold mb-3">計算パラメータ設定</h5>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          アルコール係数
                        </label>
                        <input
                          type="number"
                          step="0.001"
                          value={oisui2EditParams.alcoholCoeff}
                          onChange={(e) => setOisui2EditParams({...oisui2EditParams, alcoholCoeff: parseFloat(e.target.value) || 0})}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          アルコール閾値
                        </label>
                        <input
                          type="number"
                          step="0.1"
                          value={oisui2EditParams.targetAlcoholThreshold}
                          onChange={(e) => setOisui2EditParams({...oisui2EditParams, targetAlcoholThreshold: parseFloat(e.target.value) || 0})}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          目標ボーメ
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          value={oisui2EditParams.targetBaume}
                          onChange={(e) => setOisui2EditParams({...oisui2EditParams, targetBaume: parseFloat(e.target.value) || 0})}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          目標アルコール
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          value={oisui2EditParams.targetAlcohol}
                          onChange={(e) => setOisui2EditParams({...oisui2EditParams, targetAlcohol: parseFloat(e.target.value) || 0})}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md"
                        />
                      </div>
                    </div>
                  </div>
                  
                  <OisuiAnalysis2 tanks={tanks} selectedTankIds={selectedTankIds} />
                </div>
              </>
            ) : (
              <div className="bg-gray-50 p-6 rounded-lg">
                <h4 className="font-semibold mb-4">保存された追い水分析データ</h4>
                {loadedModelData?.oisuiData?.analysis1 ? (
                  <div className="space-y-4">
                    {loadedModelData.oisuiData.analysis1.day5Regression && (
                      <div className="p-3 bg-white rounded border">
                        <div className="font-medium">5日目回帰関数</div>
                        <div className="text-sm">
                          y = {loadedModelData.oisuiData.analysis1.day5Regression.a.toFixed(6)}x + 
                          {loadedModelData.oisuiData.analysis1.day5Regression.b.toFixed(6)}
                          <span className="ml-2 text-gray-600">
                            (R² = {loadedModelData.oisuiData.analysis1.day5Regression.rSquared.toFixed(4)})
                          </span>
                        </div>
                      </div>
                    )}
                    {loadedModelData.oisuiData.analysis1.day7Regression && (
                      <div className="p-3 bg-white rounded border">
                        <div className="font-medium">7日目回帰関数</div>
                        <div className="text-sm">
                          y = {loadedModelData.oisuiData.analysis1.day7Regression.a.toFixed(6)}x + 
                          {loadedModelData.oisuiData.analysis1.day7Regression.b.toFixed(6)}
                          <span className="ml-2 text-gray-600">
                            (R² = {loadedModelData.oisuiData.analysis1.day7Regression.rSquared.toFixed(4)})
                          </span>
                        </div>
                      </div>
                    )}
                    
                    {/* 8日目以降のデータ */}
                    {loadedModelData.oisuiData.analysis2?.data && (
                      <div className="p-3 bg-white rounded border mt-4">
                        <div className="font-medium">8日目以降のデータ</div>
                        <div className="text-sm text-gray-600">
                          データ件数: {loadedModelData.oisuiData.analysis2.data.length}件
                        </div>
                      </div>
                    )}
                    
                    {/* 8日目以降のパラメータ */}
                    {loadedModelData.oisuiData.analysis2?.parameters && (
                      <div className="p-3 bg-white rounded border mt-4">
                        <div className="font-medium">8日目以降のパラメータ</div>
                        <div className="text-sm text-gray-600 space-y-1 mt-2">
                          <div>アルコール係数: {loadedModelData.oisuiData.analysis2.parameters.alcoholCoeff}</div>
                          <div>アルコール閾値: {loadedModelData.oisuiData.analysis2.parameters.targetAlcoholThreshold}%</div>
                          <div>目標ボーメ: {loadedModelData.oisuiData.analysis2.parameters.targetBaume}</div>
                          <div>目標アルコール: {loadedModelData.oisuiData.analysis2.parameters.targetAlcohol}%</div>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-gray-500">追い水分析データがありません</p>
                )}
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
                <h4 className="font-semibold mb-4">保存された品温分析データ</h4>
                {loadedModelData?.temperatureData && loadedModelData.temperatureData.length > 0 ? (
                  <div className="text-sm text-gray-600">
                    <p>データ件数: {loadedModelData.temperatureData.length}件</p>
                    <p className="mt-2">温度範囲: {
                      Math.min(...loadedModelData.temperatureData.filter(d => d.temp1).map(d => d.temp1)).toFixed(1)
                    }℃ ～ {
                      Math.max(...loadedModelData.temperatureData.filter(d => d.temp1).map(d => d.temp1)).toFixed(1)
                    }℃</p>
                  </div>
                ) : (
                  <p className="text-gray-500">品温分析データがありません</p>
                )}
              </div>
            )}
          </div>
        )}
      </div>
      
      {/* 現在のパラメータ状態（デバッグ用） - 削除 */}

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
              className="w-full px-3 py-2 border border-gray-300 rounded mb-4 focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
              >
                保存
              </button>
            </div>
          </div>
        </div>
      )}

      {/* モデル一覧ダイアログ */}
      {showModelList && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-[600px] max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">保存済み統合モデル</h3>
              <button
                onClick={() => setShowModelList(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>
            
            {savedModels.length === 0 ? (
              <p className="text-gray-500 text-center py-8">保存済みのモデルがありません</p>
            ) : (
              <div className="space-y-3">
                {savedModels.map(model => (
                  <div
                    key={model.id}
                    className={`border rounded-lg p-4 ${
                      loadedModelId === model.id ? 'border-blue-500 bg-blue-50' : 'border-gray-300'
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="font-semibold">{model.name}</h4>
                        <p className="text-sm text-gray-600">
                          保存日時: {new Date(model.savedAt).toLocaleString()}
                        </p>
                        <p className="text-sm text-gray-600">
                          対象タンク: {model.sourceTankIds.join(', ')}
                        </p>
                      </div>
                      <div className="flex space-x-2">
                        <button
                          onClick={() => handleLoadModel(model)}
                          className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
                        >
                          読み込み
                        </button>
                        <button
                          onClick={() => {
                            setModelName(model.name);
                            setLoadedModelId(model.id);
                            setShowModelList(false);
                            setShowSaveDialog(true);
                          }}
                          className="px-3 py-1 bg-gray-600 text-white rounded text-sm hover:bg-gray-700"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteModel(model.id)}
                          className="px-3 py-1 bg-red-600 text-white rounded text-sm hover:bg-red-700"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default IntegratedModeling;