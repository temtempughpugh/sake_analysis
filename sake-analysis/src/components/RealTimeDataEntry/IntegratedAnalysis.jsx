// メインコンポーネント: IntegratedAnalysis.jsx
import React, { useState, useMemo } from 'react';
import { AlertCircle } from 'lucide-react';
import IntegratedAnalysisTable from './IntegratedAnalysisTable';
import ProgressPrediction from './ProgressPrediction';
import TemperaturePrediction from './TemperaturePrediction';
import WaterAnalysis from './WaterAnalysis';

const IntegratedAnalysis = ({ currentTank, allTanks }) => {
  const [selectedModel, setSelectedModel] = useState(null);
  const [showModelList, setShowModelList] = useState(false);
  const [selectedPattern, setSelectedPattern] = useState(null);

  // 統合モデル一覧を取得
  const integratedModels = useMemo(() => {
    try {
      const saved = localStorage.getItem('integratedModels');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  }, []);

  // 現在のタンクデータを整理 (day12形式で取得)
  const currentTankData = useMemo(() => {
    if (!currentTank) return null;

    const dailyEntries = Object.entries(currentTank.dailyData || {})
      .map(([key, data]) => {
        if (!key.startsWith('day')) return null;
        const day = parseInt(key.replace('day', ''));
        return {
          day,
          月日: data['月日'],
          日数: data['日数'],
          品温1回目: parseFloat(data['品温1回目']),
          'ボーメ(BMD/日数)': parseFloat(data['ボーメ(BMD/日数)']),
          'ボーメ(補完)': parseFloat(data['ボーメ(補完)']),
          'アルコール(補完)': parseFloat(data['アルコール(補完)']),
          'BMD(補完)': parseFloat(data['BMD(補完)']),
          追水: parseFloat(data['追水']) || 0
        };
      })
      .filter(d => d && !isNaN(d.day))
      .sort((a, b) => a.day - b.day);

    const currentDay = Math.max(...dailyEntries.map(d => d.day));
    const latestData = dailyEntries.find(d => d.day === currentDay);

    return {
      tankId: currentTank.tankId,
      tankNumber: currentTank.metadata?.['順号'] || currentTank.tankId,
      dailyData: dailyEntries,
      currentDay,
      latestData,
      metadata: currentTank.metadata
    };
  }, [currentTank]);

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-lg shadow">
        <h2 className="text-xl font-bold mb-4">リアルタイム統合分析 - タンク{currentTankData?.tankNumber}</h2>
        
        {/* 統合モデル選択 */}
        <div className="mb-6 p-4 border rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <label className="block text-sm font-medium text-gray-700">統合モデル</label>
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
                        setSelectedPattern(model.progressData?.patterns?.[0] || null);
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

        {/* 進捗パターン選択 */}
        {selectedModel?.progressData?.patterns && selectedModel.progressData.patterns.length > 0 && (
          <div className="mb-6 p-4 border rounded-lg">
            <label className="block text-sm font-medium text-gray-700 mb-2">進捗パターン</label>
            <select
              value={selectedPattern?.name || ''}
              onChange={(e) => {
                const pattern = selectedModel.progressData.patterns.find(p => p.name === e.target.value);
                setSelectedPattern(pattern || null);
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">パターンを選択してください</option>
              {selectedModel.progressData.patterns.map((pattern, index) => (
                <option key={index} value={pattern.name}>
                  {pattern.name} ({pattern.method || 'unknown'})
                </option>
              ))}
            </select>
          </div>
        )}

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

        {selectedModel && currentTankData && selectedPattern && (
          <>
            {/* 統合分析表 */}
            <IntegratedAnalysisTable 
              currentTankData={currentTankData}
              selectedModel={selectedModel}
              selectedPattern={selectedPattern}
            />
            
            {/* 進捗予測 */}
            <ProgressPrediction 
              currentTankData={currentTankData}
              selectedModel={selectedModel}
              selectedPattern={selectedPattern}
            />
            
            {/* 品温変動予測 */}
            <TemperaturePrediction 
              currentTankData={currentTankData}
              selectedModel={selectedModel}
            />
            
            {/* 追い水提案 */}
            <WaterAnalysis 
              currentTankData={currentTankData}
              selectedModel={selectedModel}
            />
          </>
        )}
      </div>
    </div>
  );
};

export default IntegratedAnalysis;