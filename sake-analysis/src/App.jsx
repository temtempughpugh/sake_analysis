import React, { useState, useEffect } from 'react';
import { Database, ChevronUp, ChevronDown, Upload } from 'lucide-react';
import { parseCSV } from './utils/csvParser';
import DataTable from './components/DataTable';
import TankGraph from './components/TankGraph';
import ProgressModeling from './components/ProgressModeling';
import PredictionModeling from './components/PredictionModeling';

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
  
  const [showGraphs, setShowGraphs] = useState(false);
  const [showModeling, setShowModeling] = useState(false);
  const [showPrediction, setShowPrediction] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // 折りたたみ状態
  const [showMetadata, setShowMetadata] = useState(false);
  const [showMetadataComparison, setShowMetadataComparison] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem('tanks', JSON.stringify(tanks));
    } catch (e) {
      console.error('Failed to save tanks:', e);
    }
  }, [tanks]);

  useEffect(() => {
    try {
      localStorage.setItem('selectedTankIds', JSON.stringify(selectedTankIds));
    } catch (e) {
      console.error('Failed to save selectedTankIds:', e);
    }
  }, [selectedTankIds]);

  const handleFileUpload = (file) => {
    setIsLoading(true);
    setError(null);
    
    parseCSV(file, (parsedData) => {
      try {
        console.log('Parsed data:', parsedData);
        setTanks(parsedData);
        setSelectedTankIds([]);
        setIsLoading(false);
      } catch (err) {
        console.error('Error setting parsed data:', err);
        setError('データの処理中にエラーが発生しました');
        setIsLoading(false);
      }
    });
  };

  const handleSelectionChange = (newSelection) => {
    setSelectedTankIds(newSelection);
  };

  const handleAnalyze = () => {
    setShowGraphs(true);
    setShowModeling(false);
    setShowPrediction(false);
  };

  const handleModelingAnalyze = () => {
    setShowModeling(true);
    setShowGraphs(false);
    setShowPrediction(false);
  };

  const handlePredictionAnalyze = () => {
    setShowPrediction(true);
    setShowGraphs(false);
    setShowModeling(false);
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
        day: dayData.day,
        withWater: { coefficient: coefficientWithWater },
        withoutWater: { coefficient: coefficientWithoutWater }
      });
    });
    
    return results;
  };

  // メタデータ比較コンポーネント
  const MetadataComparison = ({ tanks, selectedTankIds }) => {
    try {
      if (!tanks || !Array.isArray(tanks) || !selectedTankIds || !Array.isArray(selectedTankIds)) {
        return <p className="text-gray-500">データが正しくありません</p>;
      }

      const selectedTanks = tanks.filter(tank => 
        tank && tank.tankId && selectedTankIds.includes(tank.tankId)
      );
      
      if (selectedTanks.length === 0) {
        return <p className="text-gray-500">タンクを選択してください</p>;
      }

      // 真のアルコール係数の最終日の値を取得
      const getTrueAlcoholCoeffFinal = (tank) => {
        console.log('getTrueAlcoholCoeffFinal for tank:', tank.tankId);
        const results = calculateTrueCoefficients(tank);
        console.log('calculateTrueCoefficients results:', results);
        if (results.length === 0) {
          console.log('No results from calculateTrueCoefficients');
          return { withWater: null, withoutWater: null };
        }
        const finalResult = results[results.length - 1];
        console.log('Final result:', finalResult);
        return {
          withWater: finalResult.withWater.coefficient,
          withoutWater: finalResult.withoutWater.coefficient
        };
      };

      const columns = [
        { key: '順号', label: '順号', isNumeric: true },
        { key: '仕込み規模', label: '仕込み規模', isNumeric: true },
        { key: '酵母', label: '酵母', isNumeric: false },
        { key: '酒質設計', label: '酒質設計', isNumeric: false },
        { key: '最高ボーメ', label: '最高ボーメ', isNumeric: true },
        { key: '最終ボーメ', label: '最終ボーメ', isNumeric: true },
        { key: '最終アルコール度数', label: '最終アルコール', isNumeric: true },
        // 新しく追加：真のアルコール係数
        { key: 'true_alcohol_coeff_with_water', label: '真のアルコール係数①', isNumeric: true },
        { key: 'true_alcohol_coeff_without_water', label: '真のアルコール係数②', isNumeric: true },
      ];

      const getValue = (tank, key) => {
        if (key === 'true_alcohol_coeff_with_water') {
          const result = getTrueAlcoholCoeffFinal(tank);
          return result.withWater;
        } else if (key === 'true_alcohol_coeff_without_water') {
          const result = getTrueAlcoholCoeffFinal(tank);
          return result.withoutWater;
        } else {
          return tank.metadata[key];
        }
      };

      const getDisplayValue = (value, isNumeric) => {
        if (value === null || value === undefined) return '-';
        if (isNumeric && typeof value === 'number') {
          return value.toFixed(2);
        }
        return value;
      };

      // 統計計算
      const getColumnStats = (columnKey, isNumeric) => {
        if (!isNumeric) return null;
        
        const values = selectedTanks
          .map(tank => getValue(tank, columnKey))
          .filter(v => v !== null && v !== undefined && !isNaN(v));
        
        if (values.length === 0) return null;
        
        const avg = values.reduce((sum, v) => sum + v, 0) / values.length;
        const max = Math.max(...values);
        const min = Math.min(...values);
        
        return { avg: avg.toFixed(2), max: max.toFixed(2), min: min.toFixed(2) };
      };

      return (
        <div className="bg-white rounded-lg shadow border border-gray-200 p-4">
          <h3 className="text-lg font-semibold mb-4 flex items-center">
            <Database className="w-5 h-5 mr-2" />
            メタデータ比較表 ({selectedTanks.length}個のタンク)
          </h3>
          
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse border border-gray-300">
              <thead>
                <tr className="bg-gray-100">
                  <th className="border border-gray-300 p-2 text-left">項目</th>
                  {selectedTanks.map(tank => (
                    <th key={tank.tankId} className="border border-gray-300 p-2 text-center">
                      {tank.tankId}
                    </th>
                  ))}
                  <th className="border border-gray-300 p-2 text-center bg-blue-50">平均</th>
                  <th className="border border-gray-300 p-2 text-center bg-green-50">最大</th>
                  <th className="border border-gray-300 p-2 text-center bg-red-50">最小</th>
                </tr>
              </thead>
              <tbody>
                {columns.map(col => {
                  const stats = getColumnStats(col.key, col.isNumeric);
                  return (
                    <tr key={col.key} className="hover:bg-gray-50">
                      <td className="border border-gray-300 p-2 font-medium bg-gray-50">
                        {col.label}
                      </td>
                      {selectedTanks.map(tank => (
                        <td key={tank.tankId} className="border border-gray-300 p-2 text-center">
                          {getDisplayValue(getValue(tank, col.key), col.isNumeric)}
                        </td>
                      ))}
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

  // FileUploadコンポーネント
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
          {isLoading ? 'アップロード中...' : 'ファイルを選択'}
        </label>
      </div>
    );
  };

  // 改善されたDataTable（選択済みを上に表示）
  const ImprovedDataTable = ({ tanks, onSelectionChange, selectedTankIds }) => {
    // 選択済みタンクを上に、未選択を下に分けてソート
    const sortedTanks = React.useMemo(() => {
      if (!tanks || !Array.isArray(tanks)) return [];
      
      try {
        const selectedTanks = tanks.filter(tank => 
          tank && tank.tankId && selectedTankIds.includes(tank.tankId)
        );
        const unselectedTanks = tanks.filter(tank => 
          tank && tank.tankId && !selectedTankIds.includes(tank.tankId)
        );
        
        return [...selectedTanks, ...unselectedTanks];
      } catch (error) {
        console.error('Error sorting tanks:', error);
        return tanks || [];
      }
    }, [tanks, selectedTankIds]);

    if (!tanks || tanks.length === 0) {
      return (
        <div className="p-4 text-center text-gray-500">
          データがありません
        </div>
      );
    }

    try {
      return (
        <DataTable 
          tanks={sortedTanks} 
          onSelectionChange={onSelectionChange} 
          selectedTankIds={selectedTankIds}
        />
      );
    } catch (error) {
      console.error('Error rendering DataTable:', error);
      return (
        <div className="p-4 text-center text-red-500">
          データテーブルの表示でエラーが発生しました: {error.message}
        </div>
      );
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 py-8 px-4">
      <div className="max-w-7xl mx-auto">
        <ErrorBoundary>
          {/* 1. CSVアップロード - 一番上に配置 */}
          <div className="mb-6">
            <FileUpload onFileUpload={handleFileUpload} isLoading={isLoading} />
          </div>

          {/* エラー表示 */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
              <h3 className="text-red-800 font-semibold">エラー</h3>
              <p className="text-red-600">{error}</p>
            </div>
          )}

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
                  <ImprovedDataTable 
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
            </>
          )}
        </ErrorBoundary>
      </div>
    </div>
  );
}

export default App;