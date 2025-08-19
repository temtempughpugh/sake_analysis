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
  const [showTemperatureAnalysis, setShowTemperatureAnalysis] = useState(false);
  const [showOisuiAnalysis, setShowOisuiAnalysis] = useState(false); // 新規追加
  const [showMetadata, setShowMetadata] = useState(false);
  const [showMetadataComparison, setShowMetadataComparison] = useState(false);
  const [showOisuiAnalysis2, setShowOisuiAnalysis2] = useState(false);

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
        setShowTemperatureAnalysis(false);
        setShowOisuiAnalysis(false); // 新規追加
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
    setShowTemperatureAnalysis(false);
    setShowOisuiAnalysis(false); // 新規追加
  };

  const handleAnalyze = () => {
    setShowGraphs(true);
    setShowModeling(false);
    setShowPrediction(false);
    setShowTemperatureAnalysis(false);
    setShowOisuiAnalysis(false); // 新規追加
  };

  const handleModelingAnalyze = () => {
    setShowModeling(true);
    setShowGraphs(false);
    setShowPrediction(false);
    setShowTemperatureAnalysis(false);
    setShowOisuiAnalysis(false); // 新規追加
  };

  const handlePredictionAnalyze = () => {
    setShowPrediction(true);
    setShowGraphs(false);
    setShowModeling(false);
    setShowTemperatureAnalysis(false);
    setShowOisuiAnalysis(false); // 新規追加
  };

  const handleTemperatureAnalyze = () => {
    setShowTemperatureAnalysis(true);
    setShowGraphs(false);
    setShowModeling(false);
    setShowPrediction(false);
    setShowOisuiAnalysis(false); // 新規追加
  };

  // 追い水分析ボタン処理（新規追加）
  const handleOisuiAnalyze = () => {
    setShowOisuiAnalysis(true);
    setShowGraphs(false);
    setShowModeling(false);
    setShowPrediction(false);
    setShowTemperatureAnalysis(false);
  };

  const handleOisuiAnalysis2 = () => {
  setShowOisuiAnalysis2(true);
  setShowGraphs(false);
  setShowModeling(false);
  setShowPrediction(false);
  setShowTemperatureAnalysis(false);
  setShowOisuiAnalysis(false);
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

      const tankRows = selectedTanks.map(tank => {
        const coeff = calculateTrueCoefficientsFromMeta(tank);
        const moromiDays = calculateMoromiDays(tank);
        
        return {
          tankId: tank.tankId,
          metadata: tank.metadata,
          coefficientWithWater: coeff.withWater,
          coefficientWithoutWater: coeff.withoutWater,
          moromiDays
        };
      });

      const metadataFields = [
        '順号', '仕込み規模', '酵母', '酒質設計', '特定名称',
        '5日までの積算品温', '最高ボーメ', 'AB開始ボーメ', 'AB開始アルコール',
        '最終ボーメ', '最終アルコール度数', '最高BMD', '最高BMD日数',
        '追い水総量', '追い水歩合', '後半追い水量', '後半追い水割合'
      ];

      const calculateStats = (data, key) => {
        const values = data.map(d => parseFloat(d.metadata[key])).filter(v => !isNaN(v));
        return {
          avg: values.length ? (values.reduce((a, b) => a + b, 0) / values.length).toFixed(2) : '-',
          max: values.length ? Math.max(...values).toFixed(2) : '-',
          min: values.length ? Math.min(...values).toFixed(2) : '-',
        };
      };

      return (
        <div className="bg-white rounded-lg shadow border border-gray-200 p-6 mt-6">
          <h3 className="text-lg font-semibold text-gray-700 mb-4 flex items-center">
            🔍 メタデータ比較表 (選択: {selectedTanks.length}タンク)
          </h3>
          
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse border border-gray-300">
              <thead className="bg-gray-100">
                <tr>
                  <th className="border border-gray-300 p-2">項目</th>
                  {tankRows.map(tank => (
                    <th key={tank.tankId} className="border border-gray-300 p-2">
                      タンク{tank.tankId}
                    </th>
                  ))}
                  <th className="border border-gray-300 p-2 bg-blue-50">平均</th>
                  <th className="border border-gray-300 p-2 bg-green-50">最大</th>
                  <th className="border border-gray-300 p-2 bg-red-50">最小</th>
                </tr>
              </thead>
              <tbody>
                {metadataFields.map(field => {
                  const stats = calculateStats(tankRows, field);
                  return (
                    <tr key={field} className="hover:bg-gray-50">
                      <td className="border border-gray-300 p-2 font-medium">{field}</td>
                      {tankRows.map(tank => (
                        <td key={tank.tankId} className="border border-gray-300 p-2 text-center">
                          {tank.metadata[field] || '-'}
                        </td>
                      ))}
                      <td className="border border-gray-300 p-2 text-center bg-blue-50">
                        {stats.avg}
                      </td>
                      <td className="border border-gray-300 p-2 text-center bg-green-50">
                        {stats.max}
                      </td>
                      <td className="border border-gray-300 p-2 text-center bg-red-50">
                        {stats.min}
                      </td>
                    </tr>
                  );
                })}
                
                {/* 醪日数行を追加 */}
                <tr className="hover:bg-gray-50">
                  <td className="border border-gray-300 p-2 font-medium">醪日数</td>
                  {tankRows.map(tank => (
                    <td key={tank.tankId} className="border border-gray-300 p-2 text-center">
                      {tank.moromiDays || '-'}
                    </td>
                  ))}
                  <td className="border border-gray-300 p-2 text-center bg-blue-50">
                    {tankRows.filter(t => t.moromiDays).length > 0 ? 
                      (tankRows.filter(t => t.moromiDays).reduce((sum, t) => sum + t.moromiDays, 0) / 
                       tankRows.filter(t => t.moromiDays).length).toFixed(1) : '-'}
                  </td>
                  <td className="border border-gray-300 p-2 text-center bg-green-50">
                    {tankRows.filter(t => t.moromiDays).length > 0 ? 
                      Math.max(...tankRows.filter(t => t.moromiDays).map(t => t.moromiDays)) : '-'}
                  </td>
                  <td className="border border-gray-300 p-2 text-center bg-red-50">
                    {tankRows.filter(t => t.moromiDays).length > 0 ? 
                      Math.min(...tankRows.filter(t => t.moromiDays).map(t => t.moromiDays)) : '-'}
                  </td>
                </tr>
                
                {/* 真のアルコール係数（追い水反映）行を追加 */}
                <tr className="hover:bg-gray-50 bg-yellow-50">
                  <td className="border border-gray-300 p-2 font-medium">真のアルコール係数（追い水反映）</td>
                  {tankRows.map(tank => (
                    <td key={tank.tankId} className="border border-gray-300 p-2 text-center">
                      {tank.coefficientWithWater ? tank.coefficientWithWater.toFixed(3) : '-'}
                    </td>
                  ))}
                  <td className="border border-gray-300 p-2 text-center bg-blue-50">
                    {tankRows.filter(t => t.coefficientWithWater).length > 0 ? 
                      (tankRows.filter(t => t.coefficientWithWater).reduce((sum, t) => sum + t.coefficientWithWater, 0) / 
                       tankRows.filter(t => t.coefficientWithWater).length).toFixed(3) : '-'}
                  </td>
                  <td className="border border-gray-300 p-2 text-center bg-green-50">
                    {tankRows.filter(t => t.coefficientWithWater).length > 0 ? 
                      Math.max(...tankRows.filter(t => t.coefficientWithWater).map(t => t.coefficientWithWater)).toFixed(3) : '-'}
                  </td>
                  <td className="border border-gray-300 p-2 text-center bg-red-50">
                    {tankRows.filter(t => t.coefficientWithWater).length > 0 ? 
                      Math.min(...tankRows.filter(t => t.coefficientWithWater).map(t => t.coefficientWithWater)).toFixed(3) : '-'}
                  </td>
                </tr>
                
                {/* 真のアルコール係数（追い水無視）行を追加 */}
                <tr className="hover:bg-gray-50 bg-orange-50">
                  <td className="border border-gray-300 p-2 font-medium">真のアルコール係数（追い水無視）</td>
                  {tankRows.map(tank => (
                    <td key={tank.tankId} className="border border-gray-300 p-2 text-center">
                      {tank.coefficientWithoutWater ? tank.coefficientWithoutWater.toFixed(3) : '-'}
                    </td>
                  ))}
                  <td className="border border-gray-300 p-2 text-center bg-blue-50">
                    {tankRows.filter(t => t.coefficientWithoutWater).length > 0 ? 
                      (tankRows.filter(t => t.coefficientWithoutWater).reduce((sum, t) => sum + t.coefficientWithoutWater, 0) / 
                       tankRows.filter(t => t.coefficientWithoutWater).length).toFixed(3) : '-'}
                  </td>
                  <td className="border border-gray-300 p-2 text-center bg-green-50">
                    {tankRows.filter(t => t.coefficientWithoutWater).length > 0 ? 
                      Math.max(...tankRows.filter(t => t.coefficientWithoutWater).map(t => t.coefficientWithoutWater)).toFixed(3) : '-'}
                  </td>
                  <td className="border border-gray-300 p-2 text-center bg-red-50">
                    {tankRows.filter(t => t.coefficientWithoutWater).length > 0 ? 
                      Math.min(...tankRows.filter(t => t.coefficientWithoutWater).map(t => t.coefficientWithoutWater)).toFixed(3) : '-'}
                  </td>
                </tr>
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
                </div>
              </div>

              {/* 4. データテーブル */}
              <DataTable 
                tanks={tanks} 
                selectedTankIds={selectedTankIds}
                onSelectionChange={handleSelectionChange}
                showMetadata={showMetadata}
                setShowMetadata={setShowMetadata}
                showMetadataComparison={showMetadataComparison}
                setShowMetadataComparison={setShowMetadataComparison}
              />

              {/* 5. メタデータ比較表 */}
              {showMetadataComparison && (
                <MetadataComparison tanks={tanks} selectedTankIds={selectedTankIds} />
              )}

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

              {/* 9. 品温分析結果 */}
              {showTemperatureAnalysis && (
                <ErrorBoundary>
                  <TemperatureAnalysis tanks={tanks} selectedTankIds={selectedTankIds} />
                </ErrorBoundary>
              )}

              {/* 10. 追い水分析結果（新規追加） */}
              {showOisuiAnalysis && (
                <ErrorBoundary>
                  <OisuiAnalysis tanks={tanks} selectedTankIds={selectedTankIds} />
                </ErrorBoundary>
              )}

              {/* 11. 追い水分析2結果（新規追加） */}
{showOisuiAnalysis2 && (
  <ErrorBoundary>
    <OisuiAnalysis2 tanks={tanks} selectedTankIds={selectedTankIds} />
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