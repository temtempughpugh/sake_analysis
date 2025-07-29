import React, { useState, useEffect } from 'react';
import { Database, ChevronUp, ChevronDown, Upload } from 'lucide-react';
import { parseCSV } from './utils/csvParser';
import DataTable from './components/DataTable';
import TankGraph from './components/TankGraph';
import ProgressModeling from './components/ProgressModeling';
import PredictionModeling from './components/PredictionModeling';
import TemperatureAnalysis from './components/TemperatureAnalysis'; // 新規追加

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
        console.error('Failed to parse saved selectedTankIds:', e);
        return [];
      }
    }
    return [];
  });

  const [isLoading, setIsLoading] = useState(false);
  const [showGraphs, setShowGraphs] = useState(false);
  const [showModeling, setShowModeling] = useState(false);
  const [showPrediction, setShowPrediction] = useState(false);
  const [showTemperatureAnalysis, setShowTemperatureAnalysis] = useState(false); // 新規追加
  const [showMetadata, setShowMetadata] = useState(false);
  const [showMetadataComparison, setShowMetadataComparison] = useState(false);

  // LocalStorageに保存
  useEffect(() => {
    if (tanks.length > 0) {
      localStorage.setItem('tanks', JSON.stringify(tanks));
    }
  }, [tanks]);

  useEffect(() => {
    localStorage.setItem('selectedTankIds', JSON.stringify(selectedTankIds));
  }, [selectedTankIds]);

  const handleFileUpload = (file) => {
    setIsLoading(true);
    
    parseCSV(file, (data, error) => {
      if (error) {
        console.error('CSV parsing error:', error);
        alert(`CSVファイルの解析に失敗しました: ${error.message}`);
      } else if (data) {
        console.log('Parsed tanks:', data);
        setTanks(data);
        setSelectedTankIds([]);
        // 分析結果をリセット
        setShowGraphs(false);
        setShowModeling(false);
        setShowPrediction(false);
        setShowTemperatureAnalysis(false); // 新規追加
      }
      setIsLoading(false);
    });
  };

  const handleSelectionChange = (newSelectedIds) => {
    setSelectedTankIds(newSelectedIds);
    // 選択が変更されたら分析結果をリセット
    setShowGraphs(false);
    setShowModeling(false);
    setShowPrediction(false);
    setShowTemperatureAnalysis(false); // 新規追加
  };

  const handleAnalyze = () => {
    setShowGraphs(true);
    setShowModeling(false);
    setShowPrediction(false);
    setShowTemperatureAnalysis(false); // 新規追加
  };

  const handleModelingAnalyze = () => {
    setShowModeling(true);
    setShowGraphs(false);
    setShowPrediction(false);
    setShowTemperatureAnalysis(false); // 新規追加
  };

  const handlePredictionAnalyze = () => {
    setShowPrediction(true);
    setShowGraphs(false);
    setShowModeling(false);
    setShowTemperatureAnalysis(false); // 新規追加
  };

  // 品温分析ボタン処理（新規追加）
  const handleTemperatureAnalyze = () => {
    setShowTemperatureAnalysis(true);
    setShowGraphs(false);
    setShowModeling(false);
    setShowPrediction(false);
  };

  // 真のアルコール係数計算関数
  const calculateTrueCoefficients = (tank) => {
    if (!tank.dailyData) return [];
    
    const results = [];
    
    Object.values(tank.dailyData).forEach(dayData => {
      if (!dayData.day) return;
      
      const day = dayData.day;
      const baume = dayData['ボーメ（追い水後）'];
      const alcohol = dayData['アルコール（追い水後）'];
      const baumeWithoutWater = dayData['ボーメ（補完）'];
      const alcoholWithoutWater = dayData['アルコール（補完）'];
      
      let coefficientWithWater = null;
      let coefficientWithoutWater = null;
      
      if (day > 1) {
        const prevDay = day - 1;
        const prevDayData = Object.values(tank.dailyData).find(d => d.day === prevDay);
        
        if (prevDayData) {
          const prevBaume = prevDayData['ボーメ（追い水後）'];
          const prevAlcohol = prevDayData['アルコール（追い水後）'];
          const prevBaumeWithoutWater = prevDayData['ボーメ（補完）'];
          const prevAlcoholWithoutWater = prevDayData['アルコール（補完）'];
          
          const baumeChange = prevBaume - baume;
          const alcoholChange = alcohol - prevAlcohol;
          const baumeChangeWithoutWater = prevBaumeWithoutWater - baumeWithoutWater;
          const alcoholChangeWithoutWater = alcoholWithoutWater - prevAlcoholWithoutWater;
          
          coefficientWithWater = baumeChange > 0 ? alcoholChange / baumeChange : null;
          coefficientWithoutWater = baumeChangeWithoutWater > 0 ? alcoholChangeWithoutWater / baumeChangeWithoutWater : null;
        }
      }
      
      results.push({
        day,
        coefficientWithWater,
        coefficientWithoutWater,
        baume,
        alcohol,
        baumeWithoutWater,
        alcoholWithoutWater
      });
    });
    
    return results.sort((a, b) => a.day - b.day);
  };

  const MetadataComparison = ({ tanks, selectedTankIds }) => {
    try {
      const selectedTanks = tanks.filter(tank => selectedTankIds.includes(tank.tankId));
      
      if (selectedTanks.length === 0) {
        return (
          <div className="p-4 text-center text-gray-500">
            比較するタンクを選択してください
          </div>
        );
      }

      const calculateTrueCoefficientsFromMeta = (tank) => {
        const totalVolume = tank.metadata['仕込み総量'] || 0;
        const finalAlcohol = tank.metadata['最終アルコール度数'] || 0;
        const finalBaume = tank.metadata['最終ボーメ'] || 0;
        const abStartAlcohol = tank.metadata['AB開始アルコール'] || 0;
        const abStartBaume = tank.metadata['AB開始ボーメ'] || 0;
        const totalWater = tank.metadata['追い水総量'] || 0;

        if (totalVolume === 0) {
          return { withWater: null, withoutWater: null };
        }

        const dilutionFactor = (totalVolume + totalWater) / totalVolume;
        
        const trueAlcoholWithWater = finalAlcohol;
        const trueBaumeWithWater = finalBaume;
        const trueAlcoholWithoutWater = finalAlcohol * dilutionFactor;
        const trueBaumeWithoutWater = finalBaume * dilutionFactor;

        const alcoholChangeWithWater = trueAlcoholWithWater - abStartAlcohol;
        const baumeChangeWithWater = abStartBaume - trueBaumeWithWater;
        const alcoholChangeWithoutWater = trueAlcoholWithoutWater - (abStartAlcohol * dilutionFactor);
        const baumeChangeWithoutWater = (abStartBaume * dilutionFactor) - trueBaumeWithoutWater;

        const coefficientWithWater = baumeChangeWithWater > 0 ? alcoholChangeWithWater / baumeChangeWithWater : null;
        const coefficientWithoutWater = baumeChangeWithoutWater > 0 ? alcoholChangeWithoutWater / baumeChangeWithoutWater : null;

        return {
          withWater: coefficientWithWater,
          withoutWater: coefficientWithoutWater
        };
      };

      const calculateMoromiDays = (tank) => {
        if (!tank.dailyData) return null;
        
        const days = Object.values(tank.dailyData)
          .map(d => parseInt(d['日数']))
          .filter(d => !isNaN(d));
        
        return days.length > 0 ? Math.max(...days) : null;
      };

      const columns = [
        { key: '順号', label: '順号', fixed: true, isNumeric: false },
        { key: '仕込み規模', label: '仕込み規模', fixed: true, isNumeric: true },
        { key: '酵母', label: '酵母', fixed: true, isNumeric: false },
        { key: '酒質設計', label: '酒質設計', fixed: true, isNumeric: false },
        { key: '特定名称', label: '特定名称', fixed: false, isNumeric: false },
        { key: '仕込み総量', label: '仕込み総量', fixed: false, isNumeric: true },
        { key: '5日までの積算品温', label: '5日積算品温', fixed: false, isNumeric: true },
        { key: '最高ボーメ', label: '最高ボーメ', fixed: false, isNumeric: true },
        { key: 'AB開始ボーメ', label: 'AB開始ボーメ', fixed: false, isNumeric: true },
        { key: 'AB開始アルコール', label: 'AB開始アルコール', fixed: false, isNumeric: true },
        { key: '最終ボーメ', label: '最終ボーメ', fixed: false, isNumeric: true },
        { key: '最終アルコール度数', label: '最終アルコール', fixed: false, isNumeric: true },
        { key: '最高BMD', label: '最高BMD', fixed: false, isNumeric: true },
        { key: '最高BMD日数', label: '最高BMD日数', fixed: false, isNumeric: true },
        { key: '追い水総量', label: '追い水総量', fixed: false, isNumeric: true },
        { key: '追い水歩合', label: '追い水歩合', fixed: false, isNumeric: true },
        { key: '後半追い水量', label: '後半追い水量', fixed: false, isNumeric: true },
        { key: '後半追い水割合', label: '後半追い水割合', fixed: false, isNumeric: true },
        { key: '醪日数', label: '醪日数', fixed: false, isNumeric: true },
        { key: 'true_alcohol_coeff_with_water', label: '真のアルコール係数①', fixed: false, isNumeric: true },
        { key: 'true_alcohol_coeff_without_water', label: '真のアルコール係数②', fixed: false, isNumeric: true }
      ];

      const metrics = [
        { key: '仕込み規模', label: '仕込み規模' },
        { key: '仕込み総量', label: '仕込み総量' },
        { key: '最高ボーメ', label: '最高ボーメ' },
        { key: '最終ボーメ', label: '最終ボーメ' },
        { key: '最終アルコール度数', label: '最終アルコール度数' },
        { key: '最高BMD', label: '最高BMD' },
        { key: '追い水総量', label: '追い水総量' },
        { key: 'true_alcohol_coeff_with_water', label: '真のアルコール係数①' },
        { key: 'true_alcohol_coeff_without_water', label: '真のアルコール係数②' }
      ];

      const dailyMetrics = [
        '品温1回目', '1日の品温の変動', 'ボーメ（補完）', 'アルコール（補完）', 
        'BMD（補完）', '追水'
      ];

      const metaStats = columns.reduce((acc, col) => {
        if (col.isNumeric) {
          let values;
          
          if (col.key === 'true_alcohol_coeff_with_water') {
            values = selectedTanks
              .map(tank => {
                const result = calculateTrueCoefficientsFromMeta(tank);
                return result.withWater;
              })
              .filter(v => v !== null && v !== undefined && !isNaN(v));
          } else if (col.key === 'true_alcohol_coeff_without_water') {
            values = selectedTanks
              .map(tank => {
                const result = calculateTrueCoefficientsFromMeta(tank);
                return result.withoutWater;
              })
              .filter(v => v !== null && v !== undefined && !isNaN(v));
          } else {
            values = selectedTanks
              .map(tank => tank.metadata[col.key])
              .filter(v => v !== null && v !== undefined);
          }
          
          acc[col.key] = {
            avg: values.length ? (values.reduce((sum, v) => sum + v, 0) / values.length).toFixed(2) : '-',
            max: values.length ? Math.max(...values).toFixed(2) : '-',
            min: values.length ? Math.min(...values).toFixed(2) : '-',
          };
        }
        return acc;
      }, {});
      
      const dailyStats = dailyMetrics.reduce((acc, metric) => {
        const values = selectedTanks.flatMap(tank => {
          if (!tank.dailyData) return [];
          return Object.values(tank.dailyData)
            .map(data => data[metric])
            .filter(v => v !== null && v !== undefined);
        });
        acc[metric] = {
          avg: values.length ? (values.reduce((sum, v) => sum + v, 0) / values.length).toFixed(2) : '-',
          max: values.length ? Math.max(...values).toFixed(2) : '-',
          min: values.length ? Math.min(...values).toFixed(2) : '-',
        };
        return acc;
      }, {});

      return (
        <div className="p-4">
          <h3 className="text-lg font-semibold mb-4">
            選択タンク比較 ({selectedTanks.length}個のタンク)
          </h3>
          
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead className="bg-gray-100">
                <tr>
                  <th className="border border-gray-300 p-2">項目</th>
                  <th className="border border-gray-300 p-2">平均</th>
                  <th className="border border-gray-300 p-2">最大</th>
                  <th className="border border-gray-300 p-2">最小</th>
                </tr>
              </thead>
              <tbody>
                {metrics.map(metric => {
                  const stats = metaStats[metric.key];
                  return (
                    <tr key={metric.key} className="hover:bg-gray-50">
                      <td className="border border-gray-300 p-2 font-medium">
                        {metric.label}
                      </td>
                      <td className="border border-gray-300 p-2 text-center bg-blue-50">
                        {stats ? stats.avg : '-'}
                      </td>
                      <td className="border border-gray-300 p-2 text-center bg-green-50">
                        {stats ? stats.max : '-'}
                      </td>
                      <td className="border border-gray-300 p-2 text-center bg-red-50">
                        {stats ? stats.min : '-'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          
          <h3 className="text-lg font-semibold mt-4 mb-2">選択タンクの比較（日次データ）</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead className="bg-gray-100">
                <tr>
                  <th className="border border-gray-300 p-2">項目</th>
                  <th className="border border-gray-300 p-2">平均</th>
                  <th className="border border-gray-300 p-2">最大</th>
                  <th className="border border-gray-300 p-2">最小</th>
                </tr>
              </thead>
              <tbody>
                {dailyMetrics.map(metric => {
                  const stats = dailyStats[metric];
                  return (
                    <tr key={metric} className="hover:bg-gray-50">
                      <td className="border border-gray-300 p-2 font-medium">
                        {metric}
                      </td>
                      <td className="border border-gray-300 p-2 text-center bg-blue-50">
                        {stats ? stats.avg : '-'}
                      </td>
                      <td className="border border-gray-300 p-2 text-center bg-green-50">
                        {stats ? stats.max : '-'}
                      </td>
                      <td className="border border-gray-300 p-2 text-center bg-red-50">
                        {stats ? stats.min : '-'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      );
    } catch (error) {
      console.error('Error in MetadataComparison:', error);
      return (
        <div className="p-4 text-center text-red-500">
          メタデータ比較表の表示でエラーが発生しました: {error.message}
        </div>
      );
    }
  };

  const FileUpload = ({ onFileUpload, isLoading }) => {
    const handleChange = (event) => {
      const file = event.target.files[0];
      if (file && file.type === 'text/csv') {
        onFileUpload(file);
      } else {
        alert('CSVファイルを選択してください');
      }
    };

    return (
      <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
        <h2 className="text-xl font-bold mb-4">CSVファイルアップロード</h2>
        <input
          type="file"
          accept=".csv"
          onChange={handleChange}
          disabled={isLoading}
          className="hidden"
          id="csvFileInput"
        />
        <label
          htmlFor="csvFileInput"
          className={`inline-flex items-center px-4 py-2 rounded cursor-pointer ${
            isLoading 
              ? 'bg-gray-400 cursor-not-allowed' 
              : 'bg-blue-600 hover:bg-blue-700'
          } text-white`}
        >
          <Upload className="w-4 h-4 mr-2" />
          {isLoading ? 'アップロード中...' : 'CSVファイルを選択'}
        </label>
        {isLoading && (
          <div className="mt-2 text-sm text-gray-600">
            ファイルを解析しています...
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        <ErrorBoundary>
          {/* 1. ファイルアップロード */}
          <FileUpload onFileUpload={handleFileUpload} isLoading={isLoading} />

          {tanks.length > 0 && (
            <>
              {/* 2. ヘッダー（シンプル版） */}
              <div className="bg-white rounded-lg shadow border border-gray-200 p-6 mb-6">
                <h1 className="text-2xl font-bold text-gray-800 mb-2">
                  日本酒醸造データ分析システム
                </h1>
                <div className="flex items-center space-x-6 text-sm text-gray-600">
                  <span>総タンク数: {tanks.length}</span>
                  <span>選択中: {selectedTankIds.length}</span>
                </div>
              </div>

              {/* 3. 分析ボタン */}
              <div className="bg-white rounded-lg shadow border border-gray-200 p-4 mb-6">
                <div className="flex flex-wrap gap-3">
                  <button
                    onClick={handleAnalyze}
                    disabled={selectedTankIds.length === 0}
                    className={`px-4 py-2 rounded text-white ${
                      selectedTankIds.length === 0 
                        ? 'bg-gray-400 cursor-not-allowed' 
                        : 'bg-blue-600 hover:bg-blue-700'
                    }`}
                  >
                    グラフ分析 ({selectedTankIds.length}個のタンクを選択中)
                  </button>
                  
                  <button
                    onClick={handleModelingAnalyze}
                    disabled={selectedTankIds.length === 0}
                    className={`px-4 py-2 rounded text-white ${
                      selectedTankIds.length === 0 
                        ? 'bg-gray-400 cursor-not-allowed' 
                        : 'bg-green-600 hover:bg-green-700'
                    }`}
                  >
                    進捗モデリング ({selectedTankIds.length}個のタンクを選択中)
                  </button>

                  <button
                    onClick={handlePredictionAnalyze}
                    className="px-4 py-2 rounded text-white bg-purple-600 hover:bg-purple-700"
                  >
                    モデリング予測
                  </button>

                  {/* 新規追加：品温分析ボタン */}
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
                </div>
              </div>

              {/* 4. メタデータ一覧（折りたたみ式 - デフォルト非表示） */}
              <div className="bg-white rounded-lg shadow border border-gray-200 mb-6">
                <button
                  onClick={() => setShowMetadata(!showMetadata)}
                  className="w-full px-6 py-4 text-left flex items-center justify-between hover:bg-gray-50"
                >
                  <div className="flex items-center">
                    <Database className="w-5 h-5 mr-3 text-gray-600" />
                    <span className="font-semibold">メタデータ一覧表</span>
                    <span className="ml-2 text-sm text-gray-500">
                      （選択済みタンクを上部に表示）
                    </span>
                  </div>
                  {showMetadata ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                </button>
                
                {showMetadata && (
                <ErrorBoundary>
                  <DataTable 
                    tanks={tanks} 
                    onSelectionChange={handleSelectionChange} 
                    selectedTankIds={selectedTankIds}
                  />
                </ErrorBoundary>
              )}
              </div>

              {/* 5. メタデータ比較表（折りたたみ式） */}
              <div className="bg-white rounded-lg shadow border border-gray-200 mb-6">
                <button
                  onClick={() => setShowMetadataComparison(!showMetadataComparison)}
                  className="w-full px-6 py-4 text-left flex items-center justify-between hover:bg-gray-50"
                >
                  <div className="flex items-center">
                    <Database className="w-5 h-5 mr-3 text-gray-600" />
                    <span className="font-semibold">メタデータ比較表</span>
                    <span className="ml-2 text-sm text-gray-500">
                      （選択済みタンクの比較）
                    </span>
                  </div>
                  {showMetadataComparison ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                </button>
                
                {showMetadataComparison && (
                  <ErrorBoundary>
                    <MetadataComparison 
                      tanks={tanks} 
                      selectedTankIds={selectedTankIds}
                    />
                  </ErrorBoundary>
                )}
              </div>

              {/* 6. グラフ分析結果 */}
              {showGraphs && (
                <ErrorBoundary>
                  <TankGraph tanks={tanks} selectedTankIds={selectedTankIds} />
                </ErrorBoundary>
              )}

              {/* 7. 進捗モデリング分析結果 */}
              {showModeling && (
                <ErrorBoundary>
                  <ProgressModeling tanks={tanks} selectedTankIds={selectedTankIds} />
                </ErrorBoundary>
              )}

              {/* 8. 予測分析結果 */}
              {showPrediction && (
                <ErrorBoundary>
                  <PredictionModeling tanks={tanks} selectedTankIds={selectedTankIds} />
                </ErrorBoundary>
              )}

              {/* 9. 品温分析結果（新規追加） */}
              {showTemperatureAnalysis && (
                <ErrorBoundary>
                  <TemperatureAnalysis tanks={tanks} selectedTankIds={selectedTankIds} />
                </ErrorBoundary>
              )}
            </>
          )}
        </ErrorBoundary>
      </div>
    </div>
  );
}

export default App;