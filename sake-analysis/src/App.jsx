import React, { useState, useEffect } from 'react';
import { Database, ChevronUp, ChevronDown, Upload } from 'lucide-react';
import { parseCSV } from './utils/csvParser';
import DataTable from './components/DataTable';
import TankGraph from './components/TankGraph';
import ProgressModeling from './components/ProgressModeling';
import PredictionModeling from './components/PredictionModeling';
import TemperatureAnalysis from './components/TemperatureAnalysis';
import OisuiAnalysis from './components/OisuiAnalysis';
import OisuiAnalysis2 from './components/OisuiAnalysis2';
import IntegratedModeling from './components/IntegratedModeling';
import RealTimeDataEntry from './components/RealTimeDataEntry/RealTimeDataEntry';

const ErrorBoundary = ({ children }) => {
  const [hasError, setHasError] = useState(false);
  
  useEffect(() => {
    const handleError = (error) => {
      console.error('ErrorBoundary caught an error:', error);
      setHasError(true);
    };
    
    window.addEventListener('error', handleError);
    return () => window.removeEventListener('error', handleError);
  }, []);
  
  if (hasError) {
    return (
      <div className="p-4 text-center text-red-500">
        エラーが発生しました。ページを再読み込みしてください。
      </div>
    );
  }
  
  return children;
};

function App() {
  const [tanks, setTanks] = useState(() => {
    const saved = localStorage.getItem('tanks');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error('Failed to parse saved tanks:', e);
        return [];
      }
    }
    return [];
  });
  
  const [selectedTankIds, setSelectedTankIds] = useState(() => {
    const saved = localStorage.getItem('selectedTankIds');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error('Failed to parse selected tank IDs:', e);
        return [];
      }
    }
    return [];
  });
  
  const [showMetadata, setShowMetadata] = useState(false);
  const [showMetadataComparison, setShowMetadataComparison] = useState(false);
  const [showGraphs, setShowGraphs] = useState(false);
  const [showModeling, setShowModeling] = useState(false);
  const [showPrediction, setShowPrediction] = useState(false);
  const [showTemperatureAnalysis, setShowTemperatureAnalysis] = useState(false);
  const [showOisuiAnalysis, setShowOisuiAnalysis] = useState(false);
  const [showOisuiAnalysis2, setShowOisuiAnalysis2] = useState(false);
  const [showIntegratedModeling, setShowIntegratedModeling] = useState(false);
  
  // 新規追加: モード管理
  const [appMode, setAppMode] = useState(() => {
    return localStorage.getItem('appMode') || 'analysis';
  });
  
  useEffect(() => {
    localStorage.setItem('tanks', JSON.stringify(tanks));
  }, [tanks]);
  
  useEffect(() => {
    localStorage.setItem('selectedTankIds', JSON.stringify(selectedTankIds));
  }, [selectedTankIds]);
  
  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (!file) return;
    
    parseCSV(file, (parsedTanks, error) => {
      if (error) {
        console.error('CSV parsing error:', error);
        alert('CSVファイルの解析に失敗しました: ' + error.message);
      } else if (parsedTanks) {
        setTanks(parsedTanks);
        setSelectedTankIds([]);
        console.log('Parsed tanks:', parsedTanks);
      }
    });
  };
  
  const handleSelectionChange = (newSelectedIds) => {
    setSelectedTankIds(newSelectedIds);
  };
  
  const handleAnalyze = () => {
    setShowGraphs(true);
    closeOtherSections('graphs');
  };
  
  const handleModeling = () => {
    setShowModeling(true);
    closeOtherSections('modeling');
  };
  
  const handlePrediction = () => {
    setShowPrediction(true);
    closeOtherSections('prediction');
  };
  
  const handleTemperatureAnalyze = () => {
    setShowTemperatureAnalysis(true);
    closeOtherSections('temperature');
  };
  
  const handleOisuiAnalyze = () => {
    setShowOisuiAnalysis(true);
    closeOtherSections('oisui');
  };
  
  const handleOisuiAnalyze2 = () => {
    setShowOisuiAnalysis2(true);
    closeOtherSections('oisui2');
  };
  
  const handleIntegratedModeling = () => {
    setShowIntegratedModeling(true);
    closeOtherSections('integrated');
  };
  
  const closeOtherSections = (except = '') => {
    if (except !== 'graphs') setShowGraphs(false);
    if (except !== 'modeling') setShowModeling(false);
    if (except !== 'prediction') setShowPrediction(false);
    if (except !== 'temperature') setShowTemperatureAnalysis(false);
    if (except !== 'oisui') setShowOisuiAnalysis(false);
    if (except !== 'oisui2') setShowOisuiAnalysis2(false);
    if (except !== 'integrated') setShowIntegratedModeling(false);
  };

  // 新規追加: モード切り替え時の処理
  const handleModeChange = (mode) => {
    setAppMode(mode);
    localStorage.setItem('appMode', mode);
    // モード切り替え時に選択をリセット
    setSelectedTankIds([]);
    closeOtherSections();
  };
  
  const hasData = tanks.length > 0;
  const hasSelection = selectedTankIds.length > 0;
  
  const calculateMoromiDays = (tank) => {
    if (!tank.dailyData || Object.keys(tank.dailyData).length === 0) return null;
    
    const days = Object.values(tank.dailyData)
      .map(data => parseInt(data['日数']))
      .filter(day => !isNaN(day));
    
    return days.length > 0 ? Math.max(...days) : null;
  };

  const calculateTrueAlcoholCoefficients = (tank) => {
    const metadata = tank.metadata || {};
    
    const startBaume = parseFloat(metadata['AB開始ボーメ']);
    const startAlcohol = parseFloat(metadata['AB開始アルコール']);
    const finalBaume = parseFloat(metadata['最終ボーメ']);
    const finalAlcohol = parseFloat(metadata['最終アルコール度数']);
    const totalVolume = parseFloat(metadata['仕込み総量']);
    const totalWater = parseFloat(metadata['追い水総量']) || 0;
    
    if (isNaN(startBaume) || isNaN(startAlcohol) || isNaN(finalBaume) || isNaN(finalAlcohol) || isNaN(totalVolume)) {
      return { withWater: null, withoutWater: null };
    }
    
    // ①追い水反映（希釈効果を除去）
    const dilutionFactor = (totalVolume + totalWater) / totalVolume;
    const trueFinalBaumeWithWater = finalBaume * dilutionFactor;
    const trueFinalAlcoholWithWater = finalAlcohol * dilutionFactor;
    
    const baumeChangeWithWater = startBaume - trueFinalBaumeWithWater;
    const alcoholChangeWithWater = trueFinalAlcoholWithWater - startAlcohol;
    
    const coefficientWithWater = baumeChangeWithWater > 0 ? 
      alcoholChangeWithWater / baumeChangeWithWater : null;
    
    // ②追い水無視（そのまま）
    const baumeChangeWithoutWater = startBaume - finalBaume;
    const alcoholChangeWithoutWater = finalAlcohol - startAlcohol;
    
    const coefficientWithoutWater = baumeChangeWithoutWater > 0 ? 
      alcoholChangeWithoutWater / baumeChangeWithoutWater : null;
    
    return {
      withWater: coefficientWithWater ? coefficientWithWater.toFixed(3) : null,
      withoutWater: coefficientWithoutWater ? coefficientWithoutWater.toFixed(3) : null
    };
  };

  const MetadataComparison = () => {
    const selectedTanks = tanks.filter(tank => selectedTankIds.includes(tank.tankId));
    
    if (selectedTanks.length === 0) return null;

    const comparisonFields = [
      { key: '順号', label: 'タンク番号' },
      { key: '仕込み規模', label: '仕込み規模' },
      { key: '酵母', label: '酵母' },
      { key: '酒質設計', label: '酒質設計' },
      { key: '特定名称', label: '特定名称' },
      { key: '最高ボーメ', label: '最高ボーメ', isNumeric: true },
      { key: '最終ボーメ', label: '最終ボーメ', isNumeric: true },
      { key: '最終アルコール度数', label: '最終アルコール', isNumeric: true },
      { key: '最高BMD', label: '最高BMD', isNumeric: true },
      { key: '追い水総量', label: '追い水総量', isNumeric: true },
    ];

    const getStats = (field) => {
      const values = selectedTanks
        .map(tank => parseFloat(tank.metadata[field.key]))
        .filter(v => !isNaN(v));
      
      if (values.length === 0) return null;
      
      return {
        avg: (values.reduce((sum, v) => sum + v, 0) / values.length).toFixed(2),
        max: Math.max(...values).toFixed(2),
        min: Math.min(...values).toFixed(2)
      };
    };

    return (
      <div className="mt-4 bg-white rounded-lg shadow-lg border border-gray-200 p-4">
        <h3 className="text-lg font-semibold mb-3">選択タンクのメタデータ比較</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead>
              <tr className="bg-gray-50 border-b">
                <th className="px-3 py-2 text-left text-sm font-medium text-gray-700">項目</th>
                {selectedTanks.map(tank => (
                  <th key={tank.tankId} className="px-3 py-2 text-center text-sm font-medium text-gray-700">
                    タンク {tank.metadata['順号']}
                  </th>
                ))}
                {selectedTanks.length > 1 && (
                  <th className="px-3 py-2 text-center text-sm font-medium text-gray-700 bg-blue-50">
                    統計
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              <tr className="border-b">
                <td className="px-3 py-2 text-sm font-medium">醪日数</td>
                {selectedTanks.map(tank => {
                  const days = calculateMoromiDays(tank);
                  return (
                    <td key={tank.tankId} className="px-3 py-2 text-center text-sm">
                      {days ? `${days}日` : '-'}
                    </td>
                  );
                })}
                {selectedTanks.length > 1 && (
                  <td className="px-3 py-2 text-center text-sm bg-blue-50">
                    -
                  </td>
                )}
              </tr>
              
              <tr className="border-b bg-yellow-50">
                <td className="px-3 py-2 text-sm font-medium">真のアルコール係数（追い水反映）</td>
                {selectedTanks.map(tank => {
                  const coeffs = calculateTrueAlcoholCoefficients(tank);
                  return (
                    <td key={tank.tankId} className="px-3 py-2 text-center text-sm font-semibold">
                      {coeffs.withWater || '-'}
                    </td>
                  );
                })}
                {selectedTanks.length > 1 && (
                  <td className="px-3 py-2 text-center text-sm bg-blue-50">
                    -
                  </td>
                )}
              </tr>

              <tr className="border-b bg-gray-50">
                <td className="px-3 py-2 text-sm font-medium">真のアルコール係数（追い水無視）</td>
                {selectedTanks.map(tank => {
                  const coeffs = calculateTrueAlcoholCoefficients(tank);
                  return (
                    <td key={tank.tankId} className="px-3 py-2 text-center text-sm">
                      {coeffs.withoutWater || '-'}
                    </td>
                  );
                })}
                {selectedTanks.length > 1 && (
                  <td className="px-3 py-2 text-center text-sm bg-blue-50">
                    -
                  </td>
                )}
              </tr>

              {comparisonFields.map(field => {
                const stats = field.isNumeric ? getStats(field) : null;
                return (
                  <tr key={field.key} className="border-b">
                    <td className="px-3 py-2 text-sm font-medium">{field.label}</td>
                    {selectedTanks.map(tank => (
                      <td key={tank.tankId} className="px-3 py-2 text-center text-sm">
                        {tank.metadata[field.key] || '-'}
                      </td>
                    ))}
                    {selectedTanks.length > 1 && (
                      <td className="px-3 py-2 text-center text-sm bg-blue-50">
                        {stats ? (
                          <div className="text-xs">
                            <div>平均: {stats.avg}</div>
                            <div>最大: {stats.max}</div>
                            <div>最小: {stats.min}</div>
                          </div>
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
    );
  };

  const FileUpload = () => (
    <div className="mb-6">
      <div className="bg-white rounded-lg shadow-lg border border-gray-200 p-6">
        <h2 className="text-xl font-semibold mb-4 flex items-center">
          <Upload className="mr-2" />
          CSVファイルアップロード
        </h2>
        <input
          type="file"
          accept=".csv"
          onChange={handleFileUpload}
          className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
        />
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <h1 className="text-3xl font-bold text-center mb-8">日本酒醸造データ分析システム</h1>
        
        {/* モード切り替えボタン - 新規追加 */}
        <div className="flex justify-center mb-6">
          <div className="bg-white rounded-lg shadow-md p-1 flex">
            <button
              onClick={() => handleModeChange('analysis')}
              className={`px-6 py-3 rounded-md font-medium transition-colors ${
                appMode === 'analysis'
                  ? 'bg-blue-600 text-white'
                  : 'bg-transparent text-gray-700 hover:bg-gray-100'
              }`}
            >
              分析モード
            </button>
            <button
              onClick={() => handleModeChange('recording')}
              className={`px-6 py-3 rounded-md font-medium transition-colors ${
                appMode === 'recording'
                  ? 'bg-green-600 text-white'
                  : 'bg-transparent text-gray-700 hover:bg-gray-100'
              }`}
            >
              記録モード
            </button>
          </div>
        </div>

        {/* 条件分岐でモードごとの表示 */}
        {appMode === 'recording' ? (
          // 記録モード
          <ErrorBoundary>
            <RealTimeDataEntry
              tanks={tanks}
              setTanks={setTanks}
              selectedTankIds={selectedTankIds}
              setSelectedTankIds={setSelectedTankIds}
            />
          </ErrorBoundary>
        ) : (
          // 分析モード（既存のコード）
          <>
            <FileUpload />

            {hasData && (
              <>
                <ErrorBoundary>
                  <DataTable
                    tanks={tanks}
                    selectedTankIds={selectedTankIds}
                    onSelectionChange={handleSelectionChange}
                  />
                </ErrorBoundary>

                <div className="mt-6 space-y-4">
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={handleAnalyze}
                      disabled={!hasSelection}
                      className={`px-4 py-2 rounded-md font-medium transition-colors ${
                        hasSelection
                          ? 'bg-blue-600 text-white hover:bg-blue-700'
                          : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                      }`}
                    >
                      グラフ分析 {hasSelection && `(${selectedTankIds.length}個のタンクを選択中)`}
                    </button>
                    
                    <button
                      onClick={handleModeling}
                      disabled={!hasSelection}
                      className={`px-4 py-2 rounded-md font-medium transition-colors ${
                        hasSelection
                          ? 'bg-purple-600 text-white hover:bg-purple-700'
                          : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                      }`}
                    >
                      進捗モデリング {hasSelection && `(${selectedTankIds.length}個のタンクを選択中)`}
                    </button>
                    
                    <button
                      onClick={handlePrediction}
                      disabled={!hasSelection}
                      className={`px-4 py-2 rounded-md font-medium transition-colors ${
                        hasSelection
                          ? 'bg-green-600 text-white hover:bg-green-700'
                          : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                      }`}
                    >
                      モデリング予測
                    </button>
                    
                    <button
                      onClick={handleTemperatureAnalyze}
                      disabled={!hasSelection}
                      className={`px-4 py-2 rounded-md font-medium transition-colors ${
                        hasSelection
                          ? 'bg-orange-600 text-white hover:bg-orange-700'
                          : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                      }`}
                    >
                      品温分析 {hasSelection && `(${selectedTankIds.length}個のタンクを選択中)`}
                    </button>
                    
                    <button
                      onClick={handleOisuiAnalyze}
                      disabled={!hasSelection}
                      className={`px-4 py-2 rounded-md font-medium transition-colors ${
                        hasSelection
                          ? 'bg-cyan-600 text-white hover:bg-cyan-700'
                          : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                      }`}
                    >
                      追い水分析 {hasSelection && `(${selectedTankIds.length}個のタンクを選択中)`}
                    </button>
                    
                    <button
                      onClick={handleOisuiAnalyze2}
                      disabled={!hasSelection}
                      className={`px-4 py-2 rounded-md font-medium transition-colors ${
                        hasSelection
                          ? 'bg-teal-600 text-white hover:bg-teal-700'
                          : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                      }`}
                    >
                      追い水分析2 {hasSelection && `(${selectedTankIds.length}個のタンクを選択中)`}
                    </button>
                    
                    <button
                      onClick={handleIntegratedModeling}
                      disabled={!hasSelection}
                      className={`px-4 py-2 rounded-md font-medium transition-colors ${
                        hasSelection
                          ? 'bg-indigo-600 text-white hover:bg-indigo-700'
                          : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                      }`}
                    >
                      統合モデリング {hasSelection && `(${selectedTankIds.length}個のタンクを選択中)`}
                    </button>
                  </div>
                  
                  {hasSelection && (
                    <div>
                      <button
                        onClick={() => setShowMetadataComparison(!showMetadataComparison)}
                        className="flex items-center space-x-1 text-sm text-blue-600 hover:text-blue-800"
                      >
                        {showMetadataComparison ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                        <span>{showMetadataComparison ? 'メタデータ比較を隠す' : 'メタデータ比較を表示'}</span>
                      </button>
                      {showMetadataComparison && <MetadataComparison />}
                    </div>
                  )}

                  {showGraphs && (
                    <ErrorBoundary>
                      <TankGraph tanks={tanks} selectedTankIds={selectedTankIds} />
                    </ErrorBoundary>
                  )}

                  {showModeling && (
                    <ErrorBoundary>
                      <ProgressModeling tanks={tanks} selectedTankIds={selectedTankIds} />
                    </ErrorBoundary>
                  )}

                  {showPrediction && (
                    <ErrorBoundary>
                      <PredictionModeling tanks={tanks} selectedTankIds={selectedTankIds} />
                    </ErrorBoundary>
                  )}

                  {showTemperatureAnalysis && (
                    <ErrorBoundary>
                      <TemperatureAnalysis tanks={tanks} selectedTankIds={selectedTankIds} />
                    </ErrorBoundary>
                  )}

                  {showOisuiAnalysis && (
                    <ErrorBoundary>
                      <OisuiAnalysis tanks={tanks} selectedTankIds={selectedTankIds} />
                    </ErrorBoundary>
                  )}

                  {showOisuiAnalysis2 && (
                    <ErrorBoundary>
                      <OisuiAnalysis2 tanks={tanks} selectedTankIds={selectedTankIds} />
                    </ErrorBoundary>
                  )}

                  {showIntegratedModeling && (
                    <ErrorBoundary>
                      <IntegratedModeling tanks={tanks} selectedTankIds={selectedTankIds} />
                    </ErrorBoundary>
                  )}
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default App;