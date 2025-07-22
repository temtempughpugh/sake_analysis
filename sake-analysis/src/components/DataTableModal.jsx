import React, { useState, useRef, useEffect } from 'react';
import { Database, ChevronDown, ArrowUp, ArrowDown, X } from 'lucide-react';

const DataTableModal = ({ isOpen, onClose, tanks, onSelectionChange, selectedTankIds }) => {
  const [sortConfigs, setSortConfigs] = useState(() => {
    const saved = localStorage.getItem('sortConfigs');
    return saved ? JSON.parse(saved) : [];
  });
  const [filters, setFilters] = useState(() => {
    const saved = localStorage.getItem('filters');
    return saved ? JSON.parse(saved, (key, value) => (value instanceof Array ? new Set(value) : value)) : {};
  });
  const [rangeFilters, setRangeFilters] = useState(() => {
    const saved = localStorage.getItem('rangeFilters');
    return saved ? JSON.parse(saved) : {};
  });
  const [activeFilter, setActiveFilter] = useState(null);
  const [filterSearch, setFilterSearch] = useState('');
  const [filterPosition, setFilterPosition] = useState({ left: 0, top: 0 });
  const filterRef = useRef(null);
  const tableRef = useRef(null);

  const columns = [
    { key: '順号', label: '順号', fixed: true, isNumeric: true },
    { key: '仕込み規模', label: '仕込み規模', fixed: true, isNumeric: true },
    { key: '酵母', label: '酵母', fixed: true, isNumeric: false },
    { key: '酒質設計', label: '酒質設計', fixed: true, isNumeric: false },
    { key: '特定名称', label: '特定名称', fixed: false, isNumeric: false },
    { key: '仕込み総量', label: '仕込み総量', fixed: false, isNumeric: true },
    { key: '5日までの積算品温', label: '積算品温(5日)', fixed: false, isNumeric: true },
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
  ];

  const dailyMetrics = [
    '品温1回目',
    'ボーメ（追い水後)',
    'アルコール（追い水後)',
    'BMD（補完)',
    'アルコール係数（追い水反映）',
  ];

  // 既存のDataTable.jsxからすべての機能をコピー
  useEffect(() => {
    localStorage.setItem('sortConfigs', JSON.stringify(sortConfigs));
  }, [sortConfigs]);

  useEffect(() => {
    localStorage.setItem('filters', JSON.stringify(filters, (key, value) => (value instanceof Set ? Array.from(value) : value)));
  }, [filters]);

  useEffect(() => {
    localStorage.setItem('rangeFilters', JSON.stringify(rangeFilters));
  }, [rangeFilters]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (filterRef.current && !filterRef.current.contains(event.target)) {
        setActiveFilter(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // ESCキーでモーダルを閉じる
  useEffect(() => {
    const handleEscKey = (event) => {
      if (event.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscKey);
    return () => document.removeEventListener('keydown', handleEscKey);
  }, [isOpen, onClose]);

  // すべてのフィルタリング・ソート機能（既存コードをそのまま移植）
  const getFilteredTanks = () => {
    if (!tanks) return [];
    
    return tanks.filter(tank => {
      for (const [key, filterSet] of Object.entries(filters)) {
        if (filterSet.size > 0 && !filterSet.has(String(tank.metadata[key] ?? ''))) {
          return false;
        }
      }
      
      for (const [key, range] of Object.entries(rangeFilters)) {
        const value = parseFloat(tank.metadata[key]);
        if (isNaN(value)) continue;
        
        if (range.min !== '' && value < parseFloat(range.min)) return false;
        if (range.max !== '' && value > parseFloat(range.max)) return false;
      }
      
      return true;
    });
  };

  const getSortConfig = (key) => {
    const index = sortConfigs.findIndex(config => config.key === key);
    return index >= 0 ? { ...sortConfigs[index], index } : null;
  };

  const handleSort = (key) => {
    const existingIndex = sortConfigs.findIndex(config => config.key === key);
    
    if (existingIndex >= 0) {
      const newConfigs = [...sortConfigs];
      if (newConfigs[existingIndex].direction === 'asc') {
        newConfigs[existingIndex].direction = 'desc';
      } else {
        newConfigs.splice(existingIndex, 1);
      }
      setSortConfigs(newConfigs);
    } else {
      setSortConfigs([...sortConfigs, { key, direction: 'asc' }]);
    }
  };

  const multiSort = (tanks) => {
    if (sortConfigs.length === 0) return tanks;
    
    return [...tanks].sort((a, b) => {
      for (const config of sortConfigs) {
        const aVal = a.metadata[config.key];
        const bVal = b.metadata[config.key];
        
        let comparison = 0;
        if (aVal < bVal) comparison = -1;
        else if (aVal > bVal) comparison = 1;
        
        if (comparison !== 0) {
          return config.direction === 'asc' ? comparison : -comparison;
        }
      }
      return 0;
    });
  };

  const handleSelectTank = (tankId) => {
    const newSelection = selectedTankIds.includes(tankId)
      ? selectedTankIds.filter(id => id !== tankId)
      : [...selectedTankIds, tankId];
    onSelectionChange(newSelection);
  };

  const handleSelectAll = () => {
    const allTankIds = processedTanks.map(tank => tank.tankId);
    const isAllSelected = allTankIds.every(id => selectedTankIds.includes(id));
    onSelectionChange(isAllSelected ? [] : allTankIds);
  };

  const toggleFilter = (colKey, value) => {
    const currentFilter = filters[colKey] || new Set();
    const newFilter = new Set(currentFilter);
    
    if (newFilter.has(value)) {
      newFilter.delete(value);
    } else {
      newFilter.add(value);
    }
    
    setFilters({
      ...filters,
      [colKey]: newFilter
    });
  };

  const clearFilter = (colKey) => {
    const { [colKey]: removed, ...restFilters } = filters;
    const { [colKey]: removedRange, ...restRangeFilters } = rangeFilters;
    setFilters(restFilters);
    setRangeFilters(restRangeFilters);
  };

  const applyRangeFilter = (colKey, min, max) => {
    if (min === '' && max === '') {
      const { [colKey]: removed, ...rest } = rangeFilters;
      setRangeFilters(rest);
    } else {
      setRangeFilters({
        ...rangeFilters,
        [colKey]: { min, max }
      });
    }
  };

  const handleFilterButtonClick = (e, colKey) => {
    const th = e.currentTarget.closest('th');
    const rect = th.getBoundingClientRect();
    const left = rect.left + window.scrollX;
    const top = rect.bottom + window.scrollY;
    setFilterPosition({
      left: Math.min(left, window.innerWidth - 200),
      top
    });
    setActiveFilter(activeFilter === colKey ? null : colKey);
    setFilterSearch('');
  };

  const processedTanks = multiSort(getFilteredTanks());

  // 比較表用の統計（メタデータ＋日次データ）
  const selectedTanksData = tanks?.filter(tank => selectedTankIds.includes(tank.tankId)) || [];
  const metaStats = columns.reduce((acc, col) => {
    if (col.isNumeric) {
      const values = selectedTanksData
        .map(tank => tank.metadata[col.key])
        .filter(v => v !== null && v !== undefined);
      acc[col.key] = {
        avg: values.length ? (values.reduce((sum, v) => sum + v, 0) / values.length).toFixed(2) : '-',
        max: values.length ? Math.max(...values).toFixed(2) : '-',
        min: values.length ? Math.min(...values).toFixed(2) : '-',
      };
    }
    return acc;
  }, {});
  
  const dailyStats = dailyMetrics.reduce((acc, metric) => {
    const values = selectedTanksData.flatMap(tank => {
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

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-2xl border border-gray-200 w-full max-w-7xl h-full max-h-[90vh] flex flex-col">
        {/* モーダルヘッダー */}
        <div className="p-4 border-b border-gray-200 bg-gray-50 rounded-t-lg flex justify-between items-center">
          <div>
            <h3 className="text-lg font-semibold flex items-center space-x-2">
              <Database className="w-5 h-5" />
              <span>メタデータ一覧表</span>
            </h3>
            <div className="mt-2 flex space-x-4 text-sm text-gray-600">
              <span>総タンク数: {tanks?.length || 0}</span>
              <span>表示中: {processedTanks.length}</span>
              <span>選択中: {selectedTankIds.length}</span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-200 rounded-full transition-colors"
            aria-label="閉じる"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* テーブル本体 */}
        <div className="flex-1 overflow-hidden">
          <div className="relative overflow-auto h-full" ref={tableRef}>
            <table className="w-full text-sm border-collapse">
              <thead className="sticky top-0 z-10 bg-gray-100">
                <tr>
                  <th
                    className="border border-gray-200 p-2 sticky left-0 top-0 z-20 bg-gray-100"
                    style={{ minWidth: '50px' }}
                  >
                    <input
                      type="checkbox"
                      onChange={handleSelectAll}
                      checked={processedTanks.length > 0 && selectedTankIds.length === processedTanks.length}
                      className="rounded border-gray-400"
                    />
                  </th>
                  {columns.map(col => (
                    <th
                      key={col.key}
                      className={`border border-gray-200 p-2 sticky top-0 ${col.fixed ? 'bg-blue-50 font-bold z-15' : 'bg-gray-100 z-10'} ${filters[col.key]?.size > 0 || rangeFilters[col.key] ? 'bg-yellow-100' : ''}`}
                      style={{ minWidth: '100px', left: col.fixed ? `${50 + columns.filter(c => c.fixed && columns.indexOf(c) < columns.indexOf(col)).length * 100}px` : 'auto' }}
                    >
                      <div className="flex items-center justify-between">
                        <span className="flex items-center">
                          {col.label}
                          {getSortConfig(col.key) && (
                            <span className="ml-1 flex items-center">
                              {getSortConfig(col.key).direction === 'asc' ?
                                <ArrowUp className="w-3 h-3 text-blue-600" /> :
                                <ArrowDown className="w-3 h-3 text-blue-600" />
                              }
                              <span className="text-xs bg-blue-600 text-white rounded-full w-4 h-4 flex items-center justify-center ml-1">
                                {getSortConfig(col.key).index + 1}
                              </span>
                            </span>
                          )}
                        </span>
                        <button
                          onClick={(e) => handleFilterButtonClick(e, col.key)}
                          className="ml-1 p-1 hover:bg-gray-200 rounded"
                        >
                          <ChevronDown className="w-3 h-3" />
                        </button>
                      </div>
                      
                      {/* ソートクリック領域 */}
                      <div
                        className="absolute inset-0 cursor-pointer"
                        onClick={() => handleSort(col.key)}
                        style={{ zIndex: 1 }}
                      />
                      
                      {/* フィルターポップアップ */}
                      {activeFilter === col.key && (
                        <div
                          ref={filterRef}
                          className="absolute bg-white border border-gray-300 rounded-lg shadow-lg p-3 z-50"
                          style={{
                            left: filterPosition.left,
                            top: filterPosition.top,
                            width: '250px',
                            maxHeight: '300px'
                          }}
                        >
                          {col.isNumeric ? (
                            // 数値フィルター
                            <div className="space-y-2">
                              <div className="font-medium text-sm">範囲フィルター</div>
                              <div className="flex space-x-2">
                                <input
                                  type="number"
                                  placeholder="最小値"
                                  value={rangeFilters[col.key]?.min || ''}
                                  onChange={(e) => {
                                    const min = e.target.value;
                                    const max = rangeFilters[col.key]?.max || '';
                                    applyRangeFilter(col.key, min, max);
                                  }}
                                  className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                                />
                                <input
                                  type="number"
                                  placeholder="最大値"
                                  value={rangeFilters[col.key]?.max || ''}
                                  onChange={(e) => {
                                    const max = e.target.value;
                                    const min = rangeFilters[col.key]?.min || '';
                                    applyRangeFilter(col.key, min, max);
                                  }}
                                  className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                                />
                              </div>
                              <button
                                onClick={() => clearFilter(col.key)}
                                className="w-full px-2 py-1 bg-gray-500 text-white rounded text-sm hover:bg-gray-600"
                              >
                                フィルタークリア
                              </button>
                            </div>
                          ) : (
                            // テキストフィルター
                            <div className="space-y-2">
                              <input
                                type="text"
                                placeholder="検索..."
                                value={filterSearch}
                                onChange={(e) => setFilterSearch(e.target.value)}
                                className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                              />
                              <div className="max-h-40 overflow-y-auto">
                                {Array.from(new Set(tanks?.map(tank => String(tank.metadata[col.key] ?? '')) || []))
                                  .filter(value => value.toLowerCase().includes(filterSearch.toLowerCase()))
                                  .sort()
                                  .map(value => (
                                    <label key={value} className="flex items-center space-x-2 text-sm hover:bg-gray-100 px-1 py-1 rounded">
                                      <input
                                        type="checkbox"
                                        checked={filters[col.key]?.has(value) || false}
                                        onChange={() => toggleFilter(col.key, value)}
                                        className="rounded"
                                      />
                                      <span className="truncate">{value || '(空白)'}</span>
                                    </label>
                                  ))}
                              </div>
                              <div className="flex space-x-2 pt-2 border-t">
                                <button
                                  onClick={() => clearFilter(col.key)}
                                  className="flex-1 px-2 py-1 bg-gray-500 text-white rounded text-sm hover:bg-gray-600"
                                >
                                  クリア
                                </button>
                                <button
                                  onClick={() => {
                                    const allValues = new Set(tanks?.map(tank => String(tank.metadata[col.key] ?? '')) || []);
                                    const isAllSelected = filters[col.key]?.size === allValues.size;
                                    setFilters({
                                      ...filters,
                                      [col.key]: isAllSelected ? new Set() : allValues
                                    });
                                  }}
                                  className="flex-1 px-2 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
                                >
                                  {filters[col.key]?.size === Array.from(new Set(tanks?.map(tank => String(tank.metadata[col.key] ?? '')) || [])).length ? 'すべて解除' : 'すべて選択'}
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {processedTanks.map((tank, index) => (
                  <tr
                    key={tank.tankId}
                    className={`border-b ${selectedTankIds.includes(tank.tankId) ? 'bg-blue-100' : index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}
                  >
                    <td
                      className="border border-gray-200 p-2 sticky left-0 z-5 bg-inherit"
                      style={{ minWidth: '50px' }}
                    >
                      <input
                        type="checkbox"
                        checked={selectedTankIds.includes(tank.tankId)}
                        onChange={() => handleSelectTank(tank.tankId)}
                        className="rounded border-gray-400"
                      />
                    </td>
                    {columns.map(col => (
                      <td
                        key={col.key}
                        className={`border border-gray-200 p-2 ${col.fixed ? 'sticky z-5 bg-inherit' : ''}`}
                        style={{ minWidth: '100px', left: col.fixed ? `${50 + columns.filter(c => c.fixed && columns.indexOf(c) < columns.indexOf(col)).length * 100}px` : 'auto' }}
                      >
                        {tank.metadata[col.key] ?? '-'}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* 選択タンクの統計（モーダル下部） */}
        {selectedTanksData.length > 0 && (
          <div className="p-4 border-t border-gray-200 bg-gray-50 max-h-96 overflow-y-auto">
            <h3 className="text-lg font-semibold mb-2">選択タンクの比較（メタデータ）</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse mb-4">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="border border-gray-200 p-2">項目</th>
                    <th className="border border-gray-200 p-2">平均</th>
                    <th className="border border-gray-200 p-2">最大</th>
                    <th className="border border-gray-200 p-2">最小</th>
                  </tr>
                </thead>
                <tbody>
                  {columns.filter(col => col.isNumeric).map(col => (
                    <tr key={col.key} className="border-b">
                      <td className="border border-gray-200 p-2">{col.label}</td>
                      <td className="border border-gray-200 p-2">{metaStats[col.key].avg}</td>
                      <td className="border border-gray-200 p-2">{metaStats[col.key].max}</td>
                      <td className="border border-gray-200 p-2">{metaStats[col.key].min}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <h3 className="text-lg font-semibold mb-2">選択タンクの比較（日次データ）</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="border border-gray-200 p-2">項目</th>
                    <th className="border border-gray-200 p-2">平均</th>
                    <th className="border border-gray-200 p-2">最大</th>
                    <th className="border border-gray-200 p-2">最小</th>
                  </tr>
                </thead>
                <tbody>
                  {dailyMetrics.map(metric => (
                    <tr key={metric} className="border-b">
                      <td className="border border-gray-200 p-2">{metric}</td>
                      <td className="border border-gray-200 p-2">{dailyStats[metric].avg}</td>
                      <td className="border border-gray-200 p-2">{dailyStats[metric].max}</td>
                      <td className="border border-gray-200 p-2">{dailyStats[metric].min}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default DataTableModal;