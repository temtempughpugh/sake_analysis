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

  const [showColumnSelector, setShowColumnSelector] = useState(false);
const [selectedColumns, setSelectedColumns] = useState(() => {
  const saved = localStorage.getItem('selectedColumns');
  if (saved) {
    return new Set(JSON.parse(saved));
  }
  return new Set(['順号', '仕込み規模', '酵母', '酒質設計', '特定名称', '仕込み総量', 
    '5日までの積算品温', '最高ボーメ', 'AB開始ボーメ', 'AB開始アルコール', 
    '最終ボーメ', '最終アルコール度数', '最高BMD', '最高BMD日数', 
    'true_alcohol_coeff_with_water', 'true_alcohol_coeff_without_water', 
    '追い水総量', '追い水歩合', '後半追い水量', '後半追い水割合']);
});

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
        setShowColumnSelector(true);
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

  const calculateTrueCoefficients = (tank) => {
    console.log('calculateTrueCoefficients called for tank:', tank.tankId);
    console.log('Tank metadata:', tank.metadata);
    console.log('Tank dailyData keys:', Object.keys(tank.dailyData || {}));
    
    const results = [];
    const totalVolume = parseFloat(tank.metadata['仕込み総量']) || 3000;
    console.log('Total volume:', totalVolume);
    
    const dailyEntries = Object.entries(tank.dailyData || {})
      .map(([day, data]) => ({
        day: parseInt(day),
        baume: parseFloat(data['ボーメ（補完)']) || null,
        alcohol: parseFloat(data['アルコール（補完)']) || null,
        addedWater: parseFloat(data['追水']) || 0
      }))
      .filter(entry => entry.baume !== null && entry.alcohol !== null)
      .sort((a, b) => a.day - b.day);

    console.log('Daily entries with alcohol data:', dailyEntries);

    if (dailyEntries.length === 0) {
      console.log('No daily entries with both baume and alcohol data');
      return [];
    }

    const baseDay = dailyEntries[0];
    let totalCumulativeWater = 0;
    Object.entries(tank.dailyData || {}).forEach(([day, data]) => {
      const dayNum = parseInt(day);
      const waterAmount = parseFloat(data['追水']) || 0;
      if (dayNum <= baseDay.day && waterAmount > 0) {
        totalCumulativeWater += waterAmount;
      }
    });
    
    dailyEntries.forEach((dayData, index) => {
      let cumulativeWater = totalCumulativeWater;
      if (index > 0) {
        for (let i = 1; i < index; i++) {
          cumulativeWater += dailyEntries[i].addedWater;
        }
      }
      
      const dilutionFactor = (totalVolume + cumulativeWater) / totalVolume;
      const trueBaumeWithWater = dayData.baume * dilutionFactor;
      const trueAlcoholWithWater = dayData.alcohol * dilutionFactor;
      
      let coefficientWithWater = null;
      let coefficientWithoutWater = null;
      
      if (index > 0) {
        const baseDilutionFactor = (totalVolume + totalCumulativeWater) / totalVolume;
        const baseBaumeWithWater = baseDay.baume * baseDilutionFactor;
        const baseAlcoholWithWater = baseDay.alcohol * baseDilutionFactor;
        
        const baumeChangeWithWater = baseBaumeWithWater - trueBaumeWithWater;
        const alcoholChangeWithWater = trueAlcoholWithWater - baseAlcoholWithWater;
        const baumeChangeWithoutWater = baseDay.baume - dayData.baume;
        const alcoholChangeWithoutWater = dayData.alcohol - baseDay.alcohol;
        
        coefficientWithWater = baumeChangeWithWater > 0 ? alcoholChangeWithWater / baumeChangeWithWater : null;
        coefficientWithoutWater = baumeChangeWithoutWater > 0 ? alcoholChangeWithoutWater / baumeChangeWithoutWater : null;
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
        { key: '最高BMD', label: '最高BMD', isNumeric: true },
        { key: '追い水総量', label: '追い水総量', isNumeric: true },
        { key: '追い水歩合', label: '追い水歩合', isNumeric: true },
      ];

      const stats = columns.reduce((acc, col) => {
        if (col.isNumeric) {
          let values;
          
          if (col.key === 'true_alcohol_coeff_with_water') {
            values = selectedTanks
              .map(tank => getTrueAlcoholCoeffFinal(tank).withWater)
              .filter(v => v !== null && v !== undefined && !isNaN(v));
          } else if (col.key === 'true_alcohol_coeff_without_water') {
            values = selectedTanks
              .map(tank => getTrueAlcoholCoeffFinal(tank).withoutWater)
              .filter(v => v !== null && v !== undefined && !isNaN(v));
          } else {
            values = selectedTanks
              .map(tank => tank.metadata[col.key])
              .filter(v => v !== null && v !== undefined && !isNaN(v));
          }
          
          acc[col.key] = {
            avg: values.length ? (values.reduce((sum, v) => sum + v, 0) / values.length).toFixed(3) : '-',
            max: values.length ? Math.max(...values).toFixed(3) : '-',
            min: values.length ? Math.min(...values).toFixed(3) : '-',
          };
        }
        return acc;
      }, {});

      return (
        <div className="space-y-6">
          {/* 個別タンクの詳細表 */}
          <div>
            <h4 className="font-semibold mb-3">選択タンク詳細</h4>
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse border border-gray-300">
                <thead className="bg-gray-100">
                  <tr>
                    {columns.map((col) => (
                      <th key={col.key} className="border border-gray-300 p-2 text-center font-medium">
                        {col.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {selectedTanks.map((tank, index) => {
                    const trueCoeffFinal = getTrueAlcoholCoeffFinal(tank);
                    return (
                      <tr key={tank.tankId} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                        {columns.map((col) => {
                          let value;
                          if (col.key === 'true_alcohol_coeff_with_water') {
                            value = trueCoeffFinal.withWater !== null ? trueCoeffFinal.withWater.toFixed(3) : '-';
                          } else if (col.key === 'true_alcohol_coeff_without_water') {
                            value = trueCoeffFinal.withoutWater !== null ? trueCoeffFinal.withoutWater.toFixed(3) : '-';
                          } else {
                            value = tank.metadata[col.key];
                            if (col.isNumeric && value !== null && value !== undefined) {
                              value = parseFloat(value).toFixed(col.key.includes('歩合') || col.key.includes('割合') ? 3 : 1);
                            } else if (value === null || value === undefined) {
                              value = '-';
                            }
                          }
                          return (
                            <td key={col.key} className="border border-gray-300 p-2 text-center">
                              {value}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* 統計サマリー */}
          <div>
            <h4 className="font-semibold mb-3">統計サマリー ({selectedTanks.length}タンク)</h4>
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse border border-gray-300">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="border border-gray-300 p-2 text-center font-medium">項目</th>
                    <th className="border border-gray-300 p-2 text-center font-medium">平均</th>
                    <th className="border border-gray-300 p-2 text-center font-medium">最大</th>
                    <th className="border border-gray-300 p-2 text-center font-medium">最小</th>
                  </tr>
                </thead>
                <tbody>
                  {columns.filter(col => col.isNumeric).map((col, index) => (
                    <tr key={col.key} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                      <td className="border border-gray-300 p-2 font-medium">{col.label}</td>
                      <td className="border border-gray-300 p-2 text-center">{stats[col.key]?.avg || '-'}</td>
                      <td className="border border-gray-300 p-2 text-center">{stats[col.key]?.max || '-'}</td>
                      <td className="border border-gray-300 p-2 text-center">{stats[col.key]?.min || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            
            {/* 真のアルコール係数の説明 */}
            <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <h5 className="font-semibold text-blue-800 mb-2">真のアルコール係数について</h5>
              <div className="text-sm text-blue-700 space-y-1">
                <p>• <strong>①追い水反映</strong>: 追い水による希釈効果を除去して計算した真の発酵効率</p>
                <p>• <strong>②追い水無視</strong>: 補完データをそのまま使用した従来の計算方法</p>
                <p>• 最終日の値を表示（ボーメ1度減少あたりのアルコール生成量）</p>
              </div>
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
  const ImprovedDataTable = ({ tanks, onSelectionChange, selectedTankIds, selectedColumns }) => {
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
          selectedColumns={selectedColumns}
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

              {/* 項目選択UI */}
{showColumnSelector && (
  <div className="bg-white rounded-lg shadow border border-gray-200 p-6 mb-6">
    <div className="flex justify-between items-center mb-4">
      <h3 className="text-lg font-semibold">表示するメタデータ項目を選択</h3>
      <button
        onClick={() => setShowColumnSelector(false)}
        className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
      >
        選択完了 ({selectedColumns.size}項目)
      </button>
    </div>
    
    <div className="mb-4 flex flex-wrap gap-2">
      <button onClick={() => {
        const basic = ['順号', '仕込み規模', '酵母', '酒質設計', '特定名称', '仕込み総量'];
        setSelectedColumns(new Set([...selectedColumns, ...basic]));
        localStorage.setItem('selectedColumns', JSON.stringify([...new Set([...selectedColumns, ...basic])]));
      }} className="px-3 py-1 bg-blue-100 text-blue-700 rounded text-sm">基本情報</button>
      
      <button onClick={() => {
        const all = ['順号', '仕込み規模', '酵母', '酒質設計', '特定名称', '仕込み総量', 
          '5日までの積算品温', '最高ボーメ', 'AB開始ボーメ', 'AB開始アルコール', 
          '最終ボーメ', '最終アルコール度数', '最高BMD', '最高BMD日数', 
          'true_alcohol_coeff_with_water', 'true_alcohol_coeff_without_water', 
          '追い水総量', '追い水歩合', '後半追い水量', '後半追い水割合'];
        setSelectedColumns(new Set(all));
        localStorage.setItem('selectedColumns', JSON.stringify(all));
      }} className="px-3 py-1 bg-gray-100 text-gray-700 rounded text-sm">全て選択</button>
      
      <button onClick={() => {
        setSelectedColumns(new Set());
        localStorage.setItem('selectedColumns', JSON.stringify([]));
      }} className="px-3 py-1 bg-red-100 text-red-700 rounded text-sm">全て解除</button>
    </div>
    
    <div className="grid grid-cols-4 gap-2">
      {[
        { key: '順号', label: '順号' },
        { key: '仕込み規模', label: '仕込み規模' },
        { key: '酵母', label: '酵母' },
        { key: '酒質設計', label: '酒質設計' },
        { key: '特定名称', label: '特定名称' },
        { key: '仕込み総量', label: '仕込み総量' },
        { key: '5日までの積算品温', label: '積算品温(5日)' },
        { key: '最高ボーメ', label: '最高ボーメ' },
        { key: 'AB開始ボーメ', label: 'AB開始ボーメ' },
        { key: 'AB開始アルコール', label: 'AB開始アルコール' },
        { key: '最終ボーメ', label: '最終ボーメ' },
        { key: '最終アルコール度数', label: '最終アルコール' },
        { key: '最高BMD', label: '最高BMD' },
        { key: '最高BMD日数', label: '最高BMD日数' },
        { key: 'true_alcohol_coeff_with_water', label: '真のアルコール係数①' },
        { key: 'true_alcohol_coeff_without_water', label: '真のアルコール係数②' },
        { key: '追い水総量', label: '追い水総量' },
        { key: '追い水歩合', label: '追い水歩合' },
        { key: '後半追い水量', label: '後半追い水量' },
        { key: '後半追い水割合', label: '後半追い水割合' }
      ].map(col => (
        <label key={col.key} className="flex items-center space-x-2 p-2 hover:bg-gray-50 rounded cursor-pointer">
          <input
            type="checkbox"
            checked={selectedColumns.has(col.key)}
            onChange={() => {
              const newSelected = new Set(selectedColumns);
              if (newSelected.has(col.key)) {
                newSelected.delete(col.key);
              } else {
                newSelected.add(col.key);
              }
              setSelectedColumns(newSelected);
              localStorage.setItem('selectedColumns', JSON.stringify([...newSelected]));
            }}
            className="rounded border-gray-300"
          />
          <span className="text-sm">{col.label}</span>
        </label>
      ))}
    </div>
  </div>
)}

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
                    selectedColumns={selectedColumns}
                  />
                </ErrorBoundary>
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