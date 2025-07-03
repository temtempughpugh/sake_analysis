import React, { useState, useEffect } from 'react';
import DataTable from './components/DataTable';
import TankSelector from './components/TankSelector';
import TankGraph from './components/TankGraph';
import { parseCSV } from './utils/csvParser';

const App = () => {
  const [tanks, setTanks] = useState(() => {
    const saved = localStorage.getItem('tanks');
    return saved ? JSON.parse(saved) : [];
  });
  const [selectedTankIds, setSelectedTankIds] = useState(() => {
    const saved = localStorage.getItem('selectedTankIds');
    return saved ? JSON.parse(saved) : [];
  });
  const [showGraphs, setShowGraphs] = useState(false);

  useEffect(() => {
    localStorage.setItem('tanks', JSON.stringify(tanks));
  }, [tanks]);

  useEffect(() => {
    localStorage.setItem('selectedTankIds', JSON.stringify(selectedTankIds));
  }, [selectedTankIds]);

  const handleFileUpload = (file) => {
    parseCSV(file, (parsedData) => {
      setTanks(parsedData);
      setSelectedTankIds([]);
      setShowGraphs(false);
      localStorage.setItem('tanks', JSON.stringify(parsedData));
      localStorage.removeItem('selectedTankIds');
      localStorage.removeItem('graphPeriod');
      localStorage.removeItem('showOisui');
    });
  };

  const handleSelectionChange = (selectedIds) => {
    setSelectedTankIds(selectedIds);
    setShowGraphs(false); // 選択変更時にグラフを一旦非表示
  };

  const handleAnalyze = () => {
    if (selectedTankIds.length > 0) {
      setShowGraphs(true);
    }
  };

  return (
    <div className="p-4">
      <TankSelector onFileUpload={handleFileUpload} tanks={tanks} />
      {tanks.length > 0 && (
        <>
          <div className="mb-4">
            <button
              onClick={handleAnalyze}
              disabled={selectedTankIds.length === 0}
              className={`px-4 py-2 rounded text-white ${selectedTankIds.length === 0 ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'}`}
            >
              分析
            </button>
          </div>
          <DataTable tanks={tanks} onSelectionChange={handleSelectionChange} selectedTankIds={selectedTankIds} />
          {showGraphs && <TankGraph tanks={tanks} selectedTankIds={selectedTankIds} />}
        </>
      )}
    </div>
  );
};

export default App;