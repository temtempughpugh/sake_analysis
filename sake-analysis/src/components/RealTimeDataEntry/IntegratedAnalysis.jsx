import React, { useState, useEffect } from 'react';
import { Database, ChevronDown, BarChart, Activity, Droplets, ChevronUp } from 'lucide-react';
import ProgressPrediction from './ProgressPrediction';

const IntegratedAnalysis = ({ tank }) => {
  // 統合モデルの状態管理（tankIdでLocalStorage永続化）
  const [savedModels, setSavedModels] = useState([]);
  const [selectedModelId, setSelectedModelId] = useState(() => {
    if (tank?.tankId) {
      return localStorage.getItem(`integratedAnalysis_selectedModel_${tank.tankId}`) || null;
    }
    return null;
  });
  const [selectedModel, setSelectedModel] = useState(null);
  const [selectedPattern, setSelectedPattern] = useState(() => {
    if (tank?.tankId) {
      return localStorage.getItem(`integratedAnalysis_selectedPattern_${tank.tankId}`) || null;
    }
    return null;
  });
  
  // 折りたたみ状態の管理
  const [isModelDetailsCollapsed, setIsModelDetailsCollapsed] = useState(false);

  // LocalStorageから統合モデルを読み込み + 永続化された選択状態を復元
  useEffect(() => {
    const storedModels = localStorage.getItem('integratedModels');
    if (storedModels) {
      try {
        const models = JSON.parse(storedModels);
        setSavedModels(models);
        
        // 選択されたモデルIDがある場合、該当モデルを復元
        if (selectedModelId) {
          const model = models.find(m => m.id === parseInt(selectedModelId));
          if (model) {
            setSelectedModel(model);
          }
        }
      } catch (error) {
        console.error('統合モデルの読み込みに失敗しました:', error);
        setSavedModels([]);
      }
    }
  }, [selectedModelId]);

  // 統合モデル選択時の処理（永続化）
  const handleModelSelect = (modelId) => {
    setSelectedModelId(modelId);
    
    // 選択状態をLocalStorageに保存
    if (tank?.tankId) {
      if (modelId) {
        localStorage.setItem(`integratedAnalysis_selectedModel_${tank.tankId}`, modelId);
      } else {
        localStorage.removeItem(`integratedAnalysis_selectedModel_${tank.tankId}`);
      }
    }
    
    if (modelId) {
      const model = savedModels.find(m => m.id === parseInt(modelId));
      setSelectedModel(model);
      
      // パターンリセット
      setSelectedPattern(null);
      if (tank?.tankId) {
        localStorage.removeItem(`integratedAnalysis_selectedPattern_${tank.tankId}`);
      }
    } else {
      setSelectedModel(null);
      setSelectedPattern(null);
    }
  };

  // パターン選択時の処理（永続化）
  const handlePatternSelect = (patternName) => {
    setSelectedPattern(patternName);
    
    // 選択状態をLocalStorageに保存
    if (tank?.tankId) {
      if (patternName) {
        localStorage.setItem(`integratedAnalysis_selectedPattern_${tank.tankId}`, patternName);
      } else {
        localStorage.removeItem(`integratedAnalysis_selectedPattern_${tank.tankId}`);
      }
    }
  };

  // 目標値チェック
  const hasTargetValues = () => {
    return tank?.metadata?.['目標ボーメ'] && tank?.metadata?.['目標アルコール度数'];
  };

  // 日次データ存在チェック
  const hasDailyData = () => {
    if (!tank?.dailyData) return false;
    
    return Object.keys(tank.dailyData).some(key => 
      key.startsWith('day') && 
      tank.dailyData[key] && 
      Object.values(tank.dailyData[key]).some(val => val && val.toString().trim() !== '')
    );
  };

  // エラーメッセージの表示
  const getErrorMessage = () => {
    if (!hasTargetValues()) {
      return "目標ボーメ/アルコール度数を設定してください";
    }
    if (!selectedModel) {
      return "統合モデルを選択してください";
    }
    if (!hasDailyData()) {
      return "予測に必要なデータが不足しています";
    }
    return null;
  };

  const getPatternData = (patternName, model) => {
  if (!patternName || !model) return null;

  if (patternName.startsWith('タンク')) {
    const tankNumber = patternName.replace('タンク', '');
    const tankData = model.progressData?.tankAnalysis?.find(t => {
      // 型変換して比較
      return t.tankNumber.toString() === tankNumber.toString();
    });
    
    if (tankData && tankData.progressRates) {
      return tankData.progressRates;
    }
    return null;
  }

  // 統合パターンの場合
  const unifiedPattern = model.progressData?.patterns?.find(p => p.name === patternName);
  if (unifiedPattern && unifiedPattern.data) {
    return unifiedPattern.data;
  }

  return null;
};

  const errorMessage = getErrorMessage();

  return (
    <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
      <h2 className="text-xl font-bold mb-4 flex items-center">
        <Database className="mr-2" />
        リアルタイム統合分析 - タンク {tank?.metadata?.['順号']}
      </h2>

      {/* 統合モデル選択とパターン選択 */}
      <div className="mb-6 p-4 bg-gray-50 rounded-lg">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* 統合モデル選択 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              統合モデル
            </label>
            <div className="relative">
              <select
                value={selectedModelId || ''}
                onChange={(e) => handleModelSelect(e.target.value)}
                className="w-full p-2 border border-gray-300 rounded-md appearance-none bg-white pr-8"
              >
                <option value="">-- 選択してください --</option>
                {savedModels.map(model => (
                  <option key={model.id} value={model.id}>
                    {model.name}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-2 top-2.5 h-4 w-4 text-gray-400 pointer-events-none" />
            </div>
          </div>

          {/* 進捗パターン選択 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              進捗パターン
            </label>
            <div className="relative">
              <select
                value={selectedPattern || ''}
                onChange={(e) => handlePatternSelect(e.target.value)}
                disabled={!selectedModel}
                className="w-full p-2 border border-gray-300 rounded-md appearance-none bg-white pr-8 disabled:bg-gray-100 disabled:cursor-not-allowed"
              >
                <option value="">-- 選択してください --</option>
                {/* 統合パターン */}
                {selectedModel?.progressData?.patterns?.map(pattern => (
                  <option key={`pattern_${pattern.name}`} value={pattern.name}>
                    {pattern.name}
                  </option>
                ))}
                {/* 個別タンクパターン */}
                {selectedModel?.progressData?.tankAnalysis?.map(tank => (
                  <option key={`tank_${tank.tankNumber}`} value={`タンク${tank.tankNumber}`}>
                    タンク{tank.tankNumber}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-2 top-2.5 h-4 w-4 text-gray-400 pointer-events-none" />
            </div>
          </div>
        </div>

        {/* 選択されたパターンの詳細表示 */}
        {selectedPattern && selectedModel && (
          <div className="mt-3 p-2 bg-green-50 border border-green-200 rounded text-xs">
            <div><strong>選択中の進捗パターン:</strong> {selectedPattern}</div>
            
            {(() => {
              // 統合パターンの場合
              const unifiedPattern = selectedModel.progressData.patterns?.find(p => p.name === selectedPattern);
              if (unifiedPattern) {
                return (
                  <div className="mt-1">
                    <span>({unifiedPattern.method || 'combined'}) データ点数: {unifiedPattern.data?.length || 0}</span>
                  </div>
                );
              }
              
              // 個別タンクパターンの場合
              if (selectedPattern.startsWith('タンク')) {
                const tankNumber = selectedPattern.replace('タンク', '');
                const tankData = selectedModel.progressData.tankAnalysis?.find(t => t.tankNumber === tankNumber);
                if (tankData && tankData.progressRates) {
                  return (
                    <div className="mt-1">
                      <span>(individual) データ点数: {tankData.progressRates.length}</span>
                    </div>
                  );
                } else if (tankData) {
                  return (
                    <div className="mt-1">
                      <span>(individual) データ点数: 0 (基本データを使用)</span>
                    </div>
                  );
                }
              }
              
              return null;
            })()}

            {/* 統合パターンデータ表示 */}
            <div className="mt-2">
              <strong>統合パターンデータ:</strong>
              <div className="mt-1 max-h-32 overflow-y-auto bg-white border rounded p-2 text-xs font-mono">
                {(() => {
                  const patternData = getPatternData(selectedPattern, selectedModel);
                  if (patternData) {
                    return <pre>{JSON.stringify(patternData, null, 2)}</pre>;
                  } else {
                    return <div className="text-gray-500 italic">データが見つかりません</div>;
                  }
                })()}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 選択されたモデルの詳細表示 */}
      {selectedModel && (
        <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded">
          <div 
            className="flex items-center justify-between cursor-pointer"
            onClick={() => setIsModelDetailsCollapsed(!isModelDetailsCollapsed)}
          >
            <h4 className="font-medium text-blue-800 flex items-center">
              <Database className="w-4 h-4 mr-1" />
              読み込み済み統合モデル
            </h4>
            {isModelDetailsCollapsed ? (
              <ChevronDown className="w-4 h-4 text-blue-600" />
            ) : (
              <ChevronUp className="w-4 h-4 text-blue-600" />
            )}
          </div>
          
          {!isModelDetailsCollapsed && (
            <div className="text-sm space-y-3 mt-2">
              {/* 基本情報 */}
              <div className="bg-white p-2 rounded text-xs">
                <strong>{selectedModel.name}</strong> ({new Date(selectedModel.savedAt).toLocaleDateString()}) - {selectedModel.sourceTankIds?.length || 0}タンク
              </div>

              {/* 進捗モデリング */}
              {selectedModel.progressData?.tankAnalysis && (
                <div>
                  <div className="font-medium text-blue-700 mb-1 flex items-center text-sm">
                    <BarChart className="w-3 h-3 mr-1" />
                    BMD進捗パターン分析
                  </div>
                  <div className="bg-white p-2 rounded text-xs space-y-1">
                    <div className="font-medium">個別タンクデータ</div>
                    {selectedModel.progressData.tankAnalysis.map((tank, idx) => (
                      <div key={idx} className="ml-1">
                        <strong>タンク {tank.tankNumber}</strong> 最高BMD: {tank.maxBMD} (第{tank.maxBMDDay}日) → 最終BMD: {tank.finalBMD} (第{tank.finalDay}日)
                      </div>
                    ))}
                    {selectedModel.progressData.patterns && selectedModel.progressData.patterns.length > 0 && (
                      <div className="border-t pt-1 mt-1">
                        <div className="font-medium">統合パターン</div>
                        {selectedModel.progressData.patterns.map((pattern, idx) => (
                          <div key={idx} className="ml-1">
                            <strong>{pattern.name}</strong> データ点数: {pattern.data?.length || 0}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* 追い水分析 */}
              {selectedModel.oisui1Data && (
                <div>
                  <div className="font-medium text-blue-700 mb-1 flex items-center text-sm">
                    <Droplets className="w-3 h-3 mr-1" />
                    追い水分析1（5日目・7日目）
                  </div>
                  <div className="bg-white p-2 rounded text-xs space-y-1">
                    <div>5日目データ: {selectedModel.oisui1Data.day5Data?.length || 0}点</div>
                    <div>7日目データ: {selectedModel.oisui1Data.day7Data?.length || 0}点</div>
                    {selectedModel.oisui1Data.day5Regression && (
                      <div>5日目回帰式: y = {selectedModel.oisui1Data.day5Regression.a.toFixed(3)}x + {selectedModel.oisui1Data.day5Regression.b.toFixed(3)} (R² = {selectedModel.oisui1Data.day5Regression.rSquared.toFixed(3)})</div>
                    )}
                  </div>
                </div>
              )}

              {/* 追い水分析2 */}
              {selectedModel.oisui2Data && (
                <div>
                  <div className="font-medium text-blue-700 mb-1 flex items-center text-sm">
                    <Activity className="w-3 h-3 mr-1" />
                    追い水分析2（8日目以降）
                  </div>
                  <div className="bg-white p-2 rounded text-xs">
                    統合データ: {selectedModel.oisui2Data.length || 0}タンク
                  </div>
                </div>
              )}

              {/* 品温分析 */}
              {selectedModel.temperatureData && (
                <div>
                  <div className="font-medium text-blue-700 mb-1 flex items-center text-sm">
                    <Activity className="w-3 h-3 mr-1" />
                    品温変動分析
                  </div>
                  <div className="bg-white p-2 rounded text-xs">
                    温度範囲: {Math.min(...selectedModel.temperatureData.map(d => d.temp)).toFixed(1)}℃～{Math.max(...selectedModel.temperatureData.map(d => d.temp)).toFixed(1)}℃
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* エラーメッセージまたは準備完了メッセージ */}
      {errorMessage ? (
        <div className="p-4 bg-yellow-50 border border-yellow-200 rounded text-yellow-800">
          ⚠️ {errorMessage}
        </div>
      ) : selectedModel && selectedPattern ? (
        <div className="space-y-4">
          <div className="p-4 bg-green-50 border border-green-200 rounded text-green-800">
            ✅ 分析の準備が完了しました
          </div>
          
          {/* 進捗予測 */}
          <ProgressPrediction 
            tank={tank}
            selectedModel={selectedModel}
            selectedPattern={selectedPattern}
          />
        </div>
      ) : (
        <div className="p-4 bg-gray-50 border border-gray-200 rounded text-gray-600">
          統合モデルと進捗パターンを選択してください
        </div>
      )}

      {/* デバッグ情報（開発時のみ） */}
      {process.env.NODE_ENV === 'development' && (
        <div className="mt-6 p-3 bg-gray-100 border rounded text-xs">
          <div><strong>Debug Info:</strong></div>
          <div>Selected Model ID: {selectedModelId}</div>
          <div>Selected Pattern: {selectedPattern}</div>
          <div>Has Target Values: {hasTargetValues().toString()}</div>
          <div>Has Daily Data: {hasDailyData().toString()}</div>
          <div>Available Models: {savedModels.length}</div>
        </div>
      )}
    </div>
  );
};

export default IntegratedAnalysis;