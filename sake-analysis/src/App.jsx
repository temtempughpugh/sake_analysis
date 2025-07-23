import React, { useState, useEffect, Component } from 'react';
import DataTable from './components/DataTable';
import TankSelector from './components/TankSelector';
import TankGraph from './components/TankGraph';
import ProgressModeling from './components/ProgressModeling';
import PredictionModeling from './components/PredictionModeling';
import TrueAlcoholCoefficient from './components/TrueAlcoholCoefficient';
import { parseCSV } from './utils/csvParser';
import { Upload, ChevronDown, ChevronUp, Database, BarChart3 } from 'lucide-react';

// エラーバウンダリコンポーネント
class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Error caught by boundary:', error, errorInfo);
    console.error('Error stack:', error.stack);
    console.error('Component stack:', errorInfo.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
          <h2 className="text-red-800 font-semibold mb-2">エラーが発生しました</h2>
          <p className="text-red-600 mb-2">{this.state.error?.message}</p>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
          >
            リセット
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

const App = () => {
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
  const [showMetadata, setShowMetadata] = useState(false); // デフォルト非表示に変更
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
        setShowGraphs(false);
        setShowModeling(false);
        setShowPrediction(false);
        localStorage.setItem('tanks', JSON.stringify(parsedData));
        localStorage.removeItem('selectedTankIds');
        localStorage.removeItem('graphPeriod');
        localStorage.removeItem('showOisui');
        setIsLoading(false);
      } catch (e) {
        console.error('Error processing parsed data:', e);
        setError('データの処理中にエラーが発生しました: ' + e.message);
        setIsLoading(false);
      }
    });
  };

  const handleSelectionChange = (newSelectedIds) => {
    setSelectedTankIds(newSelectedIds);
  };

  const handleAnalyze = () => {
    if (selectedTankIds.length === 0) {
      setError('分析するタンクを選択してください');
      return;
    }
    setShowGraphs(true);
    setShowModeling(false);
    setShowPrediction(false);
    setError(null);
  };

  const handleModelingAnalyze = () => {
    if (selectedTankIds.length === 0) {
      setError('モデリングするタンクを選択してください');
      return;
    }
    setShowModeling(true);
    setShowGraphs(false);
    setShowPrediction(false);
    setError(null);
  };

  const handlePredictionAnalyze = () => {
    setShowPrediction(true);
    setShowGraphs(false);
    setShowModeling(false);
    setError(null);
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

      const columns = [
        { key: '順号', label: '順号', isNumeric: true },
        { key: '仕込み規模', label: '仕込み規模', isNumeric: true },
        { key: '酵母', label: '酵母', isNumeric: false },
        { key: '酒質設計', label: '酒質設計', isNumeric: false },
        { key: '最高ボーメ', label: '最高ボーメ', isNumeric: true },
        { key: '最終ボーメ', label: '最終ボーメ', isNumeric: true },
        { key: '最終アルコール度数', label: '最終アルコール', isNumeric: true },
        { key: '最高BMD', label: '最高BMD', isNumeric: true },
      ];

      // 数値項目の統計計算
      const stats = columns.filter(col => col.isNumeric).reduce((acc, col) => {
        try {
          const values = selectedTanks
            .map(tank => tank.metadata && tank.metadata[col.key])
            .filter(v => v !== null && v !== undefined && !isNaN(v) && v !== '');
          
          if (values.length > 0) {
            const numValues = values.map(v => parseFloat(v));
            acc[col.key] = {
              avg: (numValues.reduce((sum, v) => sum + v, 0) / numValues.length).toFixed(2),
              max: Math.max(...numValues).toFixed(2),
              min: Math.min(...numValues).toFixed(2),
            };
          } else {
            acc[col.key] = { avg: '-', max: '-', min: '-' };
          }
        } catch (error) {
          console.error(`Error calculating stats for ${col.key}:`, error);
          acc[col.key] = { avg: 'エラー', max: 'エラー', min: 'エラー' };
        }
        return acc;
      }, {});

      return (
        <div className="space-y-6">
          {/* 選択タンク一覧 */}
          <div>
            <h4 className="font-semibold mb-3">選択中のタンク ({selectedTanks.length}個)</h4>
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse border border-gray-200">
                <thead className="bg-gray-100">
                  <tr>
                    {columns.map(col => (
                      <th key={col.key} className="border border-gray-200 p-2 text-left">
                        {col.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {selectedTanks.map((tank, index) => (
                    <tr key={tank.tankId || index} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                      {columns.map(col => (
                        <td key={col.key} className="border border-gray-200 p-2">
                          {tank.metadata && tank.metadata[col.key] !== undefined ? tank.metadata[col.key] : '-'}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* 統計サマリー */}
          <div>
            <h4 className="font-semibold mb-3">統計サマリー</h4>
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse border border-gray-200">
                <thead className="bg-blue-50">
                  <tr>
                    <th className="border border-gray-200 p-2 text-left">項目</th>
                    <th className="border border-gray-200 p-2">平均</th>
                    <th className="border border-gray-200 p-2">最大</th>
                    <th className="border border-gray-200 p-2">最小</th>
                  </tr>
                </thead>
                <tbody>
                  {columns.filter(col => col.isNumeric).map((col, index) => (
                    <tr key={col.key} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                      <td className="border border-gray-200 p-2 font-medium">{col.label}</td>
                      <td className="border border-gray-200 p-2 text-center">{stats[col.key]?.avg || '-'}</td>
                      <td className="border border-gray-200 p-2 text-center">{stats[col.key]?.max || '-'}</td>
                      <td className="border border-gray-200 p-2 text-center">{stats[col.key]?.min || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      );
    } catch (error) {
      console.error('Error in MetadataComparison:', error);
      return (
        <div className="p-4 text-center text-red-500">
          メタデータ比較でエラーが発生しました: {error.message}
        </div>
      );
    }
  };

  // ファイルアップロードコンポーネント
  const FileUpload = ({ onFileUpload, isLoading }) => {
    const handleFileChange = (e) => {
      const file = e.target.files[0];
      if (file && file.type === 'text/csv') {
        onFileUpload(file);
      } else {
        alert('CSVファイルを選択してください');
      }
    };

    return (
      <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center bg-gray-50 hover:bg-gray-100 transition-colors">
        <Upload className="w-8 h-8 mx-auto text-gray-400 mb-3" />
        <h2 className="text-lg font-semibold text-gray-700 mb-2">醸造データCSVアップロード</h2>
        <p className="text-gray-500 mb-4">101個のタンクデータを含むCSVファイルを選択してください</p>
        <input
          type="file"
          accept=".csv"
          onChange={handleFileChange}
          disabled={isLoading}
          className="hidden"
          id="file-upload"
        />
        <label
          htmlFor="file-upload"
          className={`inline-flex items-center px-4 py-2 rounded-lg text-white font-medium cursor-pointer transition-colors ${
            isLoading ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'
          }`}
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
                  <div className="border-t border-gray-200">
                    <ImprovedDataTable 
                      tanks={tanks} 
                      onSelectionChange={handleSelectionChange} 
                      selectedTankIds={selectedTankIds} 
                    />
                  </div>
                )}
              </div>

              {/* 5. グラフ分析結果 */}
              {showGraphs && (
                <ErrorBoundary>
                  {/* グラフ選択をグラフの前に移動 */}
                  <div className="bg-white rounded-lg shadow border border-gray-200 mb-6">
                    <div className="px-6 py-4 border-b border-gray-200">
                      <h2 className="text-lg font-semibold flex items-center">
                        <BarChart3 className="w-5 h-5 mr-3 text-blue-600" />
                        グラフ分析結果
                      </h2>
                    </div>

                    {/* 先にメタデータ比較を表示 */}
                    {selectedTankIds.length > 0 && (
                      <div className="border-b border-gray-200">
                        <button
                          onClick={() => setShowMetadataComparison(!showMetadataComparison)}
                          className="w-full px-6 py-4 text-left flex items-center justify-between hover:bg-gray-50"
                        >
                          <span className="font-semibold">選択タンクのメタデータ比較</span>
                          {showMetadataComparison ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                        </button>
                        
                        {showMetadataComparison && (
                          <div className="border-t border-gray-200 p-6">
                            <MetadataComparison tanks={tanks} selectedTankIds={selectedTankIds} />
                          </div>
                        )}
                      </div>
                    )}

                    {/* 次にグラフ表示 */}
                    <div className="p-6">
                      <TankGraph 
                        tanks={tanks} 
                        selectedTankIds={selectedTankIds} 
                      />
                    </div>
                  </div>
                </ErrorBoundary>
              )}

              {/* 5.5. 真のアルコール係数分析 - 新しく追加 */}
              {showGraphs && (
                <ErrorBoundary>
                  <TrueAlcoholCoefficient 
                    tanks={tanks} 
                    selectedTankIds={selectedTankIds} 
                  />
                </ErrorBoundary>
              )}

              {/* 6. 進捗モデリング結果 */}
              {showModeling && (
                <ErrorBoundary>
                  <div className="bg-white rounded-lg shadow border border-gray-200 mb-6">
                    <div className="px-6 py-4 border-b border-gray-200">
                      <h2 className="text-lg font-semibold">進捗モデリング結果</h2>
                    </div>
                    <div className="p-6">
                      <ProgressModeling 
                        tanks={tanks} 
                        selectedTankIds={selectedTankIds} 
                      />
                    </div>
                  </div>
                </ErrorBoundary>
              )}

              {/* 7. 予測結果 */}
              {showPrediction && (
                <ErrorBoundary>
                  <div className="bg-white rounded-lg shadow border border-gray-200 mb-6">
                    <div className="px-6 py-4 border-b border-gray-200">
                      <h2 className="text-lg font-semibold">モデリング予測結果</h2>
                    </div>
                    <div className="p-6">
                      <PredictionModeling />
                    </div>
                  </div>
                </ErrorBoundary>
              )}
            </>
          )}
        </ErrorBoundary>
      </div>
    </div>
  );
};

export default App;