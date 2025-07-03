import React, { useState, useRef, useEffect } from 'react';
import { Database, ChevronDown, ArrowUp, ArrowDown } from 'lucide-react';

const DataTable = ({ tanks, onSelectionChange, selectedTankIds }) => {
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
    'ボーメ（追い水後）',
    'アルコール（追い水後）',
    'BMD（補完）',
    'アルコール係数（追い水反映）',
  ];

  useEffect(() => {
    localStorage.setItem('sortConfigs', JSON.stringify(sortConfigs));
  }, [sortConfigs]);

  useEffect(() => {
    const serializedFilters = Object.fromEntries(
      Object.entries(filters).map(([key, value]) => [key, Array.from(value)])
    );
    localStorage.setItem('filters', JSON.stringify(serializedFilters));
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

  const handleSelectTank = (tankId) => {
    const newSelection = new Set(selectedTankIds);
    if (newSelection.has(tankId)) {
      newSelection.delete(tankId);
    } else {
      newSelection.add(tankId);
    }
    onSelectionChange(Array.from(newSelection));
  };

  const handleSelectAll = (event) => {
    const filteredTanks = getFilteredTanks();
    if (event.target.checked) {
      const allTankIds = filteredTanks.map(tank => tank.tankId);
      onSelectionChange(allTankIds);
    } else {
      onSelectionChange([]);
    }
  };

  const getUniqueValues = (key, isNumeric) => {
    if (!tanks) return [];
    const values = new Set(tanks.map(tank => tank.metadata[key]).filter(v => v !== null && v !== undefined));
    return Array.from(values).sort((a, b) => {
      if (isNumeric) return a - b;
      return String(a).localeCompare(String(b));
    });
  };

  const handleFilterChange = (column, value, checked) => {
    setFilters(prev => {
      const newFilters = { ...prev };
      if (!newFilters[column]) newFilters[column] = new Set();
      if (checked) {
        newFilters[column].add(value);
      } else {
        newFilters[column].delete(value);
        if (newFilters[column].size === 0) delete newFilters[column];
      }
      return newFilters;
    });
  };

  const handleRangeFilterChange = (column, type, value) => {
    setRangeFilters(prev => {
      const newRangeFilters = { ...prev };
      if (!newRangeFilters[column]) newRangeFilters[column] = { min: '', max: '' };
      newRangeFilters[column][type] = value === '' ? '' : parseFloat(value);
      if (newRangeFilters[column].min === '' && newRangeFilters[column].max === '') {
        delete newRangeFilters[column];
      }
      return newRangeFilters;
    });
  };

  const handleSelectAllFilter = (column, isNumeric) => {
    const values = getUniqueValues(column, isNumeric);
    setFilters(prev => {
      const newFilters = { ...prev };
      if (!newFilters[column] || newFilters[column].size < values.length) {
        newFilters[column] = new Set(values);
      } else {
        delete newFilters[column];
      }
      return newFilters;
    });
  };

  const getFilteredTanks = () => {
    if (!tanks) return [];
    return tanks.filter(tank => {
      return Object.entries(filters).every(([column, values]) => {
        if (values.size === 0) return true;
        return values.has(tank.metadata[column]);
      }) && Object.entries(rangeFilters).every(([column, { min, max }]) => {
        const value = tank.metadata[column];
        if (value === null || value === undefined) return false;
        if (min !== '' && value < min) return false;
        if (max !== '' && value > max) return false;
        return true;
      });
    });
  };

  const multiSort = (data) => {
    if (sortConfigs.length === 0) return data;
    return [...data].sort((a, b) => {
      for (const { key, direction } of sortConfigs) {
        const aValue = a.metadata[key];
        const bValue = b.metadata[key];
        if (aValue === null && bValue === null) continue;
        if (aValue === null) return 1;
        if (bValue === null) return -1;
        let comparison = 0;
        const isNumeric = columns.find(col => col.key === key).isNumeric;
        if (isNumeric) {
          comparison = aValue - bValue;
        } else {
          comparison = String(aValue).localeCompare(String(bValue));
        }
        if (comparison !== 0) return direction === 'asc' ? comparison : -comparison;
      }
      return 0;
    });
  };

  const handleSortFromMenu = (key, direction) => {
    setSortConfigs(prev => {
      const newConfigs = prev.filter(config => config.key !== key);
      newConfigs.push({ key, direction });
      return newConfigs;
    });
  };

  const clearSort = (key) => {
    setSortConfigs(prev => prev.filter(config => config.key !== key));
  };

  const getSortConfig = (key) => {
    return sortConfigs.find(config => config.key === key);
  };

  const getSortPriority = (key) => {
    const index = sortConfigs.findIndex(config => config.key === key);
    return index !== -1 ? index + 1 : null;
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
  const selectedTanksData = tanks.filter(tank => selectedTankIds.includes(tank.tankId));
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
    const values = selectedTanksData
      .flatMap(tank => Object.values(tank.dailyData || {})
        .map(data => data[metric])
        .filter(v => v !== null && v !== undefined));
    acc[metric] = {
      avg: values.length ? (values.reduce((sum, v) => sum + v, 0) / values.length).toFixed(2) : '-',
      max: values.length ? Math.max(...values).toFixed(2) : '-',
      min: values.length ? Math.min(...values).toFixed(2) : '-',
    };
    return acc;
  }, {});

  return (
    <div className="bg-white rounded-lg shadow-lg border border-gray-200">
      <div className="p-4 border-b border-gray-200 bg-gray-50">
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
      <div className="relative overflow-auto" style={{ maxHeight: '500px' }} ref={tableRef}>
        <table className="w-full text-sm border-collapse">
          <thead className="sticky top-0 z-10 bg-gray-100">
            <tr>
              <th
                className="border border-gray-200 p-2 sticky left-0 top-0 z-10 bg-gray-100"
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
                  className={`border border-gray-200 p-2 sticky top-0 ${col.fixed ? 'bg-blue-50 font-bold z-5' : 'bg-gray-100 z-10'} ${filters[col.key]?.size > 0 || rangeFilters[col.key] ? 'bg-yellow-100' : ''}`}
                  style={{ minWidth: '100px', left: col.fixed ? `${50 + columns.filter(c => c.fixed && columns.indexOf(c) < columns.indexOf(col)).length * 100}px` : 'auto' }}
                >
                  <div className="flex items-center justify-between">
                    <span className="flex items-center">
                      {col.label}
                      {getSortConfig(col.key) && (
                        <span className="ml-1 flex items-center">
                          {getSortConfig(col.key).direction === 'asc' ? (
                            <ArrowUp className="w-3 h-3 text-blue-600" />
                          ) : (
                            <ArrowDown className="w-3 h-3 text-blue-600" />
                          )}
                          {getSortPriority(col.key) > 1 && (
                            <span className="text-xs text-blue-600 ml-0.5">{getSortPriority(col.key)}</span>
                          )}
                        </span>
                      )}
                    </span>
                    <button
                      className={`p-1 rounded hover:bg-gray-200 ${filters[col.key]?.size > 0 || rangeFilters[col.key] ? 'bg-yellow-200' : ''}`}
                      onClick={(e) => handleFilterButtonClick(e, col.key)}
                    >
                      <ChevronDown className="w-4 h-4" />
                    </button>
                  </div>
                  {activeFilter === col.key && (
                    <div
                      ref={filterRef}
                      className="fixed bg-white border border-gray-300 rounded shadow-lg z-[1000]"
                      style={{ left: `${filterPosition.left}px`, top: `${filterPosition.top}px`, minWidth: '200px' }}
                    >
                      <div className="p-2 bg-gray-50 border-b border-gray-200">
                        <div className="text-xs font-semibold mb-2">並べ替え</div>
                        <button
                          onClick={() => handleSortFromMenu(col.key, 'asc')}
                          className={`w-full text-left px-2 py-1 rounded hover:bg-blue-100 ${getSortConfig(col.key)?.direction === 'asc' ? 'bg-blue-100' : ''}`}
                        >
                          昇順
                        </button>
                        <button
                          onClick={() => handleSortFromMenu(col.key, 'desc')}
                          className={`w-full text-left px-2 py-1 rounded hover:bg-blue-100 ${getSortConfig(col.key)?.direction === 'desc' ? 'bg-blue-100' : ''}`}
                        >
                          降順
                        </button>
                        {getSortConfig(col.key) && (
                          <button
                            onClick={() => clearSort(col.key)}
                            className="w-full text-left px-2 py-1 rounded hover:bg-red-100 text-red-600"
                          >
                            ソート解除
                          </button>
                        )}
                      </div>
                      <div className="p-2">
                        <div className="text-xs font-semibold mb-2">フィルター</div>
                        {col.isNumeric && (
                          <div className="space-y-2 border-b border-gray-200 pb-2">
                            <div>
                              <label className="text-xs">以上</label>
                              <input
                                type="number"
                                placeholder="最小値"
                                value={rangeFilters[col.key]?.min ?? ''}
                                onChange={(e) => handleRangeFilterChange(col.key, 'min', e.target.value)}
                                className="w-full p-1 border border-gray-300 rounded text-sm"
                              />
                            </div>
                            <div>
                              <label className="text-xs">以下</label>
                              <input
                                type="number"
                                placeholder="最大値"
                                value={rangeFilters[col.key]?.max ?? ''}
                                onChange={(e) => handleRangeFilterChange(col.key, 'max', e.target.value)}
                                className="w-full p-1 border border-gray-300 rounded text-sm"
                              />
                            </div>
                          </div>
                        )}
                        <div className="mt-2">
                          <input
                            type="text"
                            placeholder="検索..."
                            value={filterSearch}
                            onChange={(e) => setFilterSearch(e.target.value)}
                            className="w-full p-1 border border-gray-300 rounded text-sm"
                          />
                          <div className="mt-2 max-h-40 overflow-y-auto">
                            {getUniqueValues(col.key, col.isNumeric)
                              .filter(v => String(v).toLowerCase().includes(filterSearch.toLowerCase()))
                              .map(value => (
                                <label key={value} className="flex items-center space-x-2 p-1 hover:bg-gray-100">
                                  <input
                                    type="checkbox"
                                    checked={filters[col.key]?.has(value) || false}
                                    onChange={(e) => handleFilterChange(col.key, value, e.target.checked)}
                                    className="rounded border-gray-400"
                                  />
                                  <span className="text-xs">{value}</span>
                                </label>
                              ))}
                          </div>
                          <button
                            onClick={() => handleSelectAllFilter(col.key, col.isNumeric)}
                            className="w-full text-left px-2 py-1 rounded hover:bg-gray-100 text-sm"
                          >
                            {filters[col.key]?.size === getUniqueValues(col.key, col.isNumeric).length ? 'すべて解除' : 'すべて選択'}
                          </button>
                        </div>
                      </div>
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
      {selectedTanksData.length > 0 && (
        <div className="p-4 border-t border-gray-200">
          <h3 className="text-lg font-semibold mb-2">選択タンクの比較（メタデータ）</h3>
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
          <h3 className="text-lg font-semibold mt-4 mb-2">選択タンクの比較（日次データ）</h3>
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
      )}
    </div>
  );
};

export default DataTable;