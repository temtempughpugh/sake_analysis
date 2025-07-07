import React, { useState, useEffect, Component } from 'react';
import DataTable from './components/DataTable';
import TankSelector from './components/TankSelector';
import TankGraph from './components/TankGraph';
import { parseCSV } from './utils/csvParser';

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
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

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

  const handleSelectionChange = (selectedIds) => {
    setSelectedTankIds(selectedIds);
    setShowGraphs(false); // 選択変更時にグラフを一旦非表示
  };

  const handleAnalyze = () => {
    if (selectedTankIds.length > 0) {
      setError(null);
      setShowGraphs(true);
    }
  };

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">日本酒醸造データ分析システム</h1>
      
      <ErrorBoundary>
        <TankSelector onFileUpload={handleFileUpload} tanks={tanks} />
        
        {isLoading && (
          <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded">
            <p className="text-blue-800">データを読み込み中...</p>
          </div>
        )}
        
        {error && (
          <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded">
            <p className="text-red-800">{error}</p>
          </div>
        )}
        
        {tanks.length > 0 && !isLoading && (
          <>
            <div className="mb-4">
              <button
                onClick={handleAnalyze}
                disabled={selectedTankIds.length === 0}
                className={`px-4 py-2 rounded text-white ${
                  selectedTankIds.length === 0 
                    ? 'bg-gray-400 cursor-not-allowed' 
                    : 'bg-blue-600 hover:bg-blue-700'
                }`}
              >
                分析 ({selectedTankIds.length}個のタンクを選択中)
              </button>
            </div>
            
            <DataTable 
              tanks={tanks} 
              onSelectionChange={handleSelectionChange} 
              selectedTankIds={selectedTankIds} 
            />
            
            {showGraphs && (
              <ErrorBoundary>
                <TankGraph 
                  tanks={tanks} 
                  selectedTankIds={selectedTankIds} 
                />
              </ErrorBoundary>
            )}
          </>
        )}
      </ErrorBoundary>
    </div>
  );
};

export default App;