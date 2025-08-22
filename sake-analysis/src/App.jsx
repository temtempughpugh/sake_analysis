import React, { useState, useEffect } from 'react';
import { Database, ChevronUp, ChevronDown, Upload } from 'lucide-react';
import { parseCSV } from './utils/csvParser';
import DataTable from './components/DataTable';
import TankGraph from './components/TankGraph';
import ProgressModeling from './components/ProgressModeling';
import PredictionModeling from './components/PredictionModeling';
import TemperatureAnalysis from './components/TemperatureAnalysis';
import OisuiAnalysis from './components/OisuiAnalysis'; // 新規追加
import OisuiAnalysis2 from './components/OisuiAnalysis2';
import IntegratedModeling from './components/IntegratedModeling';

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
  
  const handleOisuiAnalysis2 = () => {
    setShowOisuiAnalysis2(true);
    closeOtherSections('oisui2');
  };

  const handleIntegratedModeling = () => {
    setShowIntegratedModeling(true);
    closeOtherSections('integrated');
  };
  
  const closeOtherSections = (currentSection) => {
    if (currentSection !== 'graphs') setShowGraphs(false);
    if (currentSection !== 'modeling') setShowModeling(false);
    if (currentSection !== 'prediction') setShowPrediction(false);
    if (currentSection !== 'temperature') setShowTemperatureAnalysis(false);
    if (currentSection !== 'oisui') setShowOisuiAnalysis(false);
    if (currentSection !== 'oisui2') setShowOisuiAnalysis2(false);
    if (currentSection !== 'integrated') setShowIntegratedModeling(false);
  };
  
  const MetadataComparison = ({ tanks, selectedTankIds }) => {
    const selectedTanks = tanks.filter(tank => selectedTankIds.includes(tank.tankId));
    
    const calculateStats = (values) => {
      const validValues = values.filter(v => v !== null && v !== undefined && !isNaN(v));
      if (validValues.length === 0) return { avg: '-', max: '-', min: '-' };
      
      const avg = validValues.reduce((sum, val) => sum + val, 0) / validValues.length;
      const max = Math.max(...validValues);
      const min = Math.min(...validValues);
      
      return {
        avg: avg.toFixed(2),
        max: max.toFixed(2),
        min: min.toFixed(2)
      };
    };
    
    const calculateMoromiDays = (tank) => {
      if (!tank.dailyData) return null;
      
      const days = Object.values(tank.dailyData)
        .map(d => parseInt(d['日数']))
        .filter(d => !isNaN(d));
      
      return days.length > 0 ? Math.max(...days) : null;
    };
    
    if (selectedTanks.length === 0) return null;
    
    return (
      <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
        <h3 className="text-lg font-bold mb-4">メタデータ比較表</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-gray-100">
                <th className="border border-gray-300 p-2 text-left">項目</th>
                {selectedTanks.map(tank => (
                  <th key={tank.tankId} className="border border-gray-300 p-2 text-center">
                    タンク {tank.tankId}
                  </th>
                ))}
                {selectedTanks.length > 1 && (
                  <>
                    <th className="border border-gray-300 p-2 text-center bg-blue-50">平均</th>
                    <th className="border border-gray-300 p-2 text-center bg-green-50">最大</th>
                    <th className="border border-gray-300 p-2 text-center bg-yellow-50">最小</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="border border-gray-300 p-2 font-medium">タンク順号</td>
                {selectedTanks.map(tank => (
                  <td key={tank.tankId} className="border border-gray-300 p-2 text-center">
                    {tank.metadata?.['タンク順号'] || tank.tankId}
                  </td>
                ))}
                {selectedTanks.length > 1 && (
                  <>
                    <td className="border border-gray-300 p-2 text-center bg-blue-50">-</td>
                    <td className="border border-gray-300 p-2 text-center bg-green-50">-</td>
                    <td className="border border-gray-300 p-2 text-center bg-yellow-50">-</td>
                  </>
                )}
              </tr>
              
              <tr>
                <td className="border border-gray-300 p-2 font-medium">仕込み規模</td>
                {selectedTanks.map(tank => (
                  <td key={tank.tankId} className="border border-gray-300 p-2 text-center">
                    {tank.metadata?.['仕込み規模'] || '-'}
                  </td>
                ))}
                {selectedTanks.length > 1 && (() => {
                  const values = selectedTanks.map(t => parseFloat(t.metadata?.['仕込み規模']));
                  const stats = calculateStats(values);
                  return (
                    <>
                      <td className="border border-gray-300 p-2 text-center bg-blue-50">{stats.avg}</td>
                      <td className="border border-gray-300 p-2 text-center bg-green-50">{stats.max}</td>
                      <td className="border border-gray-300 p-2 text-center bg-yellow-50">{stats.min}</td>
                    </>
                  );
                })()}
              </tr>
              
              <tr>
                <td className="border border-gray-300 p-2 font-medium">醪日数</td>
                {selectedTanks.map(tank => {
                  const days = calculateMoromiDays(tank);
                  return (
                    <td key={tank.tankId} className="border border-gray-300 p-2 text-center">
                      {days || '-'}
                    </td>
                  );
                })}
                {selectedTanks.length > 1 && (() => {
                  const values = selectedTanks.map(t => calculateMoromiDays(t));
                  const stats = calculateStats(values);
                  return (
                    <>
                      <td className="border border-gray-300 p-2 text-center bg-blue-50">{stats.avg}</td>
                      <td className="border border-gray-300 p-2 text-center bg-green-50">{stats.max}</td>
                      <td className="border border-gray-300 p-2 text-center bg-yellow-50">{stats.min}</td>
                    </>
                  );
                })()}
              </tr>
              
              <tr>
                <td className="border border-gray-300 p-2 font-medium">最終ボーメ</td>
                {selectedTanks.map(tank => (
                  <td key={tank.tankId} className="border border-gray-300 p-2 text-center">
                    {tank.metadata?.['最終ボーメ'] || '-'}
                  </td>
                ))}
                {selectedTanks.length > 1 && (() => {
                  const values = selectedTanks.map(t => parseFloat(t.metadata?.['最終ボーメ']));
                  const stats = calculateStats(values);
                  return (
                    <>
                      <td className="border border-gray-300 p-2 text-center bg-blue-50">{stats.avg}</td>
                      <td className="border border-gray-300 p-2 text-center bg-green-50">{stats.max}</td>
                      <td className="border border-gray-300 p-2 text-center bg-yellow-50">{stats.min}</td>
                    </>
                  );
                })()}
              </tr>
              
              <tr>
                <td className="border border-gray-300 p-2 font-medium">最終アルコール</td>
                {selectedTanks.map(tank => (
                  <td key={tank.tankId} className="border border-gray-300 p-2 text-center">
                    {tank.metadata?.['最終アルコール'] || '-'}
                  </td>
                ))}
                {selectedTanks.length > 1 && (() => {
                  const values = selectedTanks.map(t => parseFloat(t.metadata?.['最終アルコール']));
                  const stats = calculateStats(values);
                  return (
                    <>
                      <td className="border border-gray-300 p-2 text-center bg-blue-50">{stats.avg}</td>
                      <td className="border border-gray-300 p-2 text-center bg-green-50">{stats.max}</td>
                      <td className="border border-gray-300 p-2 text-center bg-yellow-50">{stats.min}</td>
                    </>
                  );
                })()}
              </tr>
              
              <tr>
                <td className="border border-gray-300 p-2 font-medium">仕込み総量</td>
                {selectedTanks.map(tank => (
                  <td key={tank.tankId} className="border border-gray-300 p-2 text-center">
                    {tank.metadata?.['仕込み総量'] || '-'}
                  </td>
                ))}
                {selectedTanks.length > 1 && (() => {
                  const values = selectedTanks.map(t => parseFloat(t.metadata?.['仕込み総量']));
                  const stats = calculateStats(values);
                  return (
                    <>
                      <td className="border border-gray-300 p-2 text-center bg-blue-50">{stats.avg}</td>
                      <td className="border border-gray-300 p-2 text-center bg-green-50">{stats.max}</td>
                      <td className="border border-gray-300 p-2 text-center bg-yellow-50">{stats.min}</td>
                    </>
                  );
                })()}
              </tr>
              
              <tr>
                <td className="border border-gray-300 p-2 font-medium">追い水総量</td>
                {selectedTanks.map(tank => (
                  <td key={tank.tankId} className="border border-gray-300 p-2 text-center">
                    {tank.metadata?.['追い水総量'] || '-'}
                  </td>
                ))}
                {selectedTanks.length > 1 && (() => {
                  const values = selectedTanks.map(t => parseFloat(t.metadata?.['追い水総量']));
                  const stats = calculateStats(values);
                  return (
                    <>
                      <td className="border border-gray-300 p-2 text-center bg-blue-50">{stats.avg}</td>
                      <td className="border border-gray-300 p-2 text-center bg-green-50">{stats.max}</td>
                      <td className="border border-gray-300 p-2 text-center bg-yellow-50">{stats.min}</td>
                    </>
                  );
                })()}
              </tr>
              
              <tr className="bg-orange-50">
                <td className="border border-gray-300 p-2 font-medium">真のアルコール係数（追い水反映）</td>
                {selectedTanks.map(tank => {
                  const startBaume = parseFloat(tank.metadata?.['アルボ開始ボーメ']);
                  const startAlcohol = parseFloat(tank.metadata?.['アルボ開始アルコール']);
                  const finalBaume = parseFloat(tank.metadata?.['最終ボーメ']);
                  const finalAlcohol = parseFloat(tank.metadata?.['最終アルコール']);
                  const totalVolume = parseFloat(tank.metadata?.['仕込み総量']);
                  const totalWater = parseFloat(tank.metadata?.['追い水総量']) || 0;
                  
                  let coefficient = '-';
                  if (!isNaN(startBaume) && !isNaN(startAlcohol) && !isNaN(finalBaume) && !isNaN(finalAlcohol) && !isNaN(totalVolume)) {
                    const dilutionFactor = (totalVolume + totalWater) / totalVolume;
                    const trueFinalBaume = finalBaume * dilutionFactor;
                    const trueFinalAlcohol = finalAlcohol * dilutionFactor;
                    
                    const baumeChange = startBaume - trueFinalBaume;
                    const alcoholChange = trueFinalAlcohol - startAlcohol;
                    
                    if (baumeChange > 0) {
                      coefficient = (alcoholChange / baumeChange).toFixed(3);
                    }
                  }
                  
                  return (
                    <td key={tank.tankId} className="border border-gray-300 p-2 text-center font-medium">
                      {coefficient}
                    </td>
                  );
                })}
                {selectedTanks.length > 1 && (() => {
                  const values = selectedTanks.map(tank => {
                    const startBaume = parseFloat(tank.metadata?.['アルボ開始ボーメ']);
                    const startAlcohol = parseFloat(tank.metadata?.['アルボ開始アルコール']);
                    const finalBaume = parseFloat(tank.metadata?.['最終ボーメ']);
                    const finalAlcohol = parseFloat(tank.metadata?.['最終アルコール']);
                    const totalVolume = parseFloat(tank.metadata?.['仕込み総量']);
                    const totalWater = parseFloat(tank.metadata?.['追い水総量']) || 0;
                    
                    if (!isNaN(startBaume) && !isNaN(startAlcohol) && !isNaN(finalBaume) && !isNaN(finalAlcohol) && !isNaN(totalVolume)) {
                      const dilutionFactor = (totalVolume + totalWater) / totalVolume;
                      const trueFinalBaume = finalBaume * dilutionFactor;
                      const trueFinalAlcohol = finalAlcohol * dilutionFactor;
                      
                      const baumeChange = startBaume - trueFinalBaume;
                      const alcoholChange = trueFinalAlcohol - startAlcohol;
                      
                      if (baumeChange > 0) {
                        return alcoholChange / baumeChange;
                      }
                    }
                    return null;
                  });
                  const stats = calculateStats(values);
                  return (
                    <>
                      <td className="border border-gray-300 p-2 text-center bg-blue-50 font-medium">{stats.avg}</td>
                      <td className="border border-gray-300 p-2 text-center bg-green-50 font-medium">{stats.max}</td>
                      <td className="border border-gray-300 p-2 text-center bg-yellow-50 font-medium">{stats.min}</td>
                    </>
                  );
                })()}
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    );
  };
  
  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-8xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center space-x-3">
            <Database className="w-8 h-8 text-blue-600" />
            <h1 className="text-3xl font-bold text-gray-800">日本酒醸造管理・分析システム</h1>
          </div>
          
          {/* ファイルアップロード */}
          <div className="relative">
            <input
              type="file"
              accept=".csv"
              onChange={handleFileUpload}
              className="hidden"
              id="csv-upload"
            />
            <label
              htmlFor="csv-upload"
              className="flex items-center space-x-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 cursor-pointer transition-colors"
            >
              <Upload className="w-5 h-5" />
              <span>CSVアップロード</span>
            </label>
          </div>
        </div>
        
        {tanks.length > 0 ? (
          <div className="space-y-6">
            {/* 分析ボタングループ */}
            <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
              <h2 className="text-xl font-bold mb-4">分析メニュー</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <button
                  onClick={handleAnalyze}
                  disabled={selectedTankIds.length === 0}
                  className={`px-4 py-2 rounded text-white ${
                    selectedTankIds.length === 0 
                      ? 'bg-gray-400 cursor-not-allowed' 
                      : 'bg-green-600 hover:bg-green-700'
                  }`}
                >
                  グラフ分析 ({selectedTankIds.length}個のタンクを選択中)
                </button>
                
                <button
                  onClick={handleModeling}
                  disabled={selectedTankIds.length === 0}
                  className={`px-4 py-2 rounded text-white ${
                    selectedTankIds.length === 0 
                      ? 'bg-gray-400 cursor-not-allowed' 
                      : 'bg-blue-600 hover:bg-blue-700'
                  }`}
                >
                  進捗モデリング ({selectedTankIds.length}個のタンクを選択中)
                </button>
                
                <button
                  onClick={handlePrediction}
                  className="px-4 py-2 rounded bg-purple-600 text-white hover:bg-purple-700"
                >
                  予測分析
                </button>
                
                <button
                  onClick={handleTemperatureAnalyze}
                  disabled={selectedTankIds.length === 0}
                  className={`px-4 py-2 rounded text-white ${
                    selectedTankIds.length === 0 
                      ? 'bg-gray-400 cursor-not-allowed' 
                      : 'bg-orange-600 hover:bg-orange-700'
                  }`}
                >
                  品温分析 ({selectedTankIds.length}個のタンクを選択中)
                </button>

                {/* 新規追加：追い水分析ボタン */}
                <button
                  onClick={handleOisuiAnalyze}
                  disabled={selectedTankIds.length === 0}
                  className={`px-4 py-2 rounded text-white ${
                    selectedTankIds.length === 0 
                      ? 'bg-gray-400 cursor-not-allowed' 
                      : 'bg-cyan-600 hover:bg-cyan-700'
                  }`}
                >
                  追い水分析 ({selectedTankIds.length}個のタンクを選択中)
                </button>

                <button
                  onClick={handleOisuiAnalysis2}
                  disabled={selectedTankIds.length === 0}
                  className={`px-4 py-2 rounded text-white ${
                    selectedTankIds.length === 0 
                      ? 'bg-gray-400 cursor-not-allowed' 
                      : 'bg-teal-600 hover:bg-teal-700'
                  }`}
                >
                  追い水分析2 ({selectedTankIds.length}個のタンクを選択中)
                </button>

                <button
                  onClick={handleIntegratedModeling}
                  disabled={selectedTankIds.length === 0}
                  className={`px-4 py-2 rounded text-white ${
                    selectedTankIds.length === 0 
                      ? 'bg-gray-400 cursor-not-allowed' 
                      : 'bg-purple-600 hover:bg-purple-700'
                  }`}
                >
                  統合モデリング ({selectedTankIds.length}個のタンクを選択中)
                </button>
              </div>
            </div>

            {/* データテーブル */}
            <DataTable 
              tanks={tanks} 
              selectedTankIds={selectedTankIds}
              onSelectionChange={handleSelectionChange}
              showMetadata={showMetadata}
              setShowMetadata={setShowMetadata}
              showMetadataComparison={showMetadataComparison}
              setShowMetadataComparison={setShowMetadataComparison}
            />

            {/* メタデータ比較表 */}
            {showMetadataComparison && (
              <MetadataComparison tanks={tanks} selectedTankIds={selectedTankIds} />
            )}

            {/* グラフ分析結果 */}
            {showGraphs && (
              <ErrorBoundary>
                <TankGraph tanks={tanks} selectedTankIds={selectedTankIds} />
              </ErrorBoundary>
            )}

            {/* 進捗モデリング分析結果 */}
            {showModeling && (
              <ErrorBoundary>
                <ProgressModeling tanks={tanks} selectedTankIds={selectedTankIds} />
              </ErrorBoundary>
            )}

            {/* 予測分析結果 */}
            {showPrediction && (
              <ErrorBoundary>
                <PredictionModeling tanks={tanks} selectedTankIds={selectedTankIds} />
              </ErrorBoundary>
            )}

            {/* 品温分析結果 */}
            {showTemperatureAnalysis && (
              <ErrorBoundary>
                <TemperatureAnalysis tanks={tanks} selectedTankIds={selectedTankIds} />
              </ErrorBoundary>
            )}

            {/* 追い水分析結果 */}
            {showOisuiAnalysis && (
              <ErrorBoundary>
                <OisuiAnalysis tanks={tanks} selectedTankIds={selectedTankIds} />
              </ErrorBoundary>
            )}

            {/* 追い水分析2結果 */}
            {showOisuiAnalysis2 && (
              <ErrorBoundary>
                <OisuiAnalysis2 tanks={tanks} selectedTankIds={selectedTankIds} />
              </ErrorBoundary>
            )}

            {/* 統合モデリング */}
            {showIntegratedModeling && (
              <ErrorBoundary>
                <IntegratedModeling tanks={tanks} selectedTankIds={selectedTankIds} />
              </ErrorBoundary>
            )}
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow border border-gray-200 p-12 text-center">
            <Database className="w-16 h-16 mx-auto text-gray-400 mb-4" />
            <h2 className="text-2xl font-bold text-gray-700 mb-2">データがありません</h2>
            <p className="text-gray-500">CSVファイルをアップロードして分析を開始してください</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;