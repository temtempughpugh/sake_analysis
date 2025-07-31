import React, { useState, useEffect, useRef } from 'react';
import { ArrowUp, ArrowDown, ChevronDown, Database } from 'lucide-react';
import { COLUMN_NAMES } from '../utils/csvParser';

// 計算関数（既存のコードを維持）
const calculateEarlyWaterAmount = (tank) => {
  if (!tank.dailyData) return null;
  
  const dailyEntries = Object.entries(tank.dailyData);
  if (dailyEntries.length === 0) return null;
  
  let earlyWaterAmount = 0;
  
  dailyEntries.forEach(([day, data]) => {
    const dayNum = parseInt(day);
    const addedWater = parseFloat(data[COLUMN_NAMES.DAILY.ADDED_WATER]) || 0;
    
    if (dayNum <= 15) {
      earlyWaterAmount += addedWater;
    }
  });
  
  return earlyWaterAmount;
};

const calculateEarlyWaterRatio = (tank) => {
  const earlyWaterAmount = calculateEarlyWaterAmount(tank);
  const totalWaterAmount = parseFloat(tank.metadata?.[COLUMN_NAMES.META.TOTAL_WATER]) || 0;
  
  if (earlyWaterAmount === null || totalWaterAmount === 0) {
    return null;
  }
  
  return parseFloat((earlyWaterAmount / totalWaterAmount).toFixed(2));
};

const calculateTrueCoefficientsFromMeta = (tank) => {
  const metadata = tank.metadata || {};
  
  const startBaume = parseFloat(metadata['AB開始ボーメ']);
  const startAlcohol = parseFloat(metadata['AB開始アルコール']);
  const finalBaume = parseFloat(metadata['最終ボーメ']);
  const finalAlcohol = parseFloat(metadata['最終アルコール度数']);
  const totalVolume = parseFloat(metadata['仕込み総量']);
  const totalWater = parseFloat(metadata['追い水総量']) || 0;
  
  if (isNaN(startBaume) || isNaN(startAlcohol) || isNaN(finalBaume) || isNaN(finalAlcohol) || isNaN(totalVolume)) {
    return { withWater: null, withoutWater: null };
  }
  
  // ①追い水反映（希釈効果を除去）
  const dilutionFactor = (totalVolume + totalWater) / totalVolume;
  const trueFinalBaumeWithWater = finalBaume * dilutionFactor;
  const trueFinalAlcoholWithWater = finalAlcohol * dilutionFactor;
  
  const baumeChangeWithWater = startBaume - trueFinalBaumeWithWater;
  const alcoholChangeWithWater = trueFinalAlcoholWithWater - startAlcohol;
  
  const coefficientWithWater = baumeChangeWithWater > 0 ? alcoholChangeWithWater / baumeChangeWithWater : null;
  
  // ②追い水無視（そのまま）
  const baumeChangeWithoutWater = startBaume - finalBaume;
  const alcoholChangeWithoutWater = finalAlcohol - startAlcohol;
  
  const coefficientWithoutWater = baumeChangeWithoutWater > 0 ? alcoholChangeWithoutWater / baumeChangeWithoutWater : null;
  
  return {
    withWater: coefficientWithWater,
    withoutWater: coefficientWithoutWater
  };
};

const DataTable = ({ tanks, selectedTankIds, onSelectionChange }) => {
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
  const [visibleColumns, setVisibleColumns] = useState(() => {
    const saved = localStorage.getItem('visibleColumns');
    return saved ? new Set(JSON.parse(saved)) : new Set([
      COLUMN_NAMES.META.TANK_NUMBER,
      COLUMN_NAMES.META.BATCH_SIZE,
      COLUMN_NAMES.META.YEAST,
      COLUMN_NAMES.META.DESIGN,
      COLUMN_NAMES.META.SPECIFIC_NAME,
      COLUMN_NAMES.META.TOTAL_VOLUME,
      COLUMN_NAMES.META.TEMP_SUM_5DAYS,
      COLUMN_NAMES.META.MAX_BAUME,
      COLUMN_NAMES.META.AB_START_BAUME,
      COLUMN_NAMES.META.AB_START_ALCOHOL,
      COLUMN_NAMES.META.FINAL_BAUME,
      COLUMN_NAMES.META.FINAL_ALCOHOL,
      COLUMN_NAMES.META.MAX_BMD,
      COLUMN_NAMES.META.MAX_BMD_DAY,
      '真のアルコール係数（追い水反映）',
      '真のアルコール係数（追い水無視）',
      COLUMN_NAMES.META.TOTAL_WATER,
      COLUMN_NAMES.META.WATER_RATIO,
      'EARLY_WATER_AMOUNT',
      'EARLY_WATER_RATIO',
      COLUMN_NAMES.META.LATE_WATER,
      COLUMN_NAMES.META.LATE_WATER_RATIO,
    ]);
  });
  const [activeFilter, setActiveFilter] = useState(null);
  const [filterSearch, setFilterSearch] = useState('');
  const [filterPosition, setFilterPosition] = useState({ left: 0, top: 0 });
  const tableRef = useRef(null);

  const columns = [
    { key: COLUMN_NAMES.META.TANK_NUMBER, label: '順号', fixed: true, isNumeric: true },
    { key: COLUMN_NAMES.META.BATCH_SIZE, label: '仕込み規模', fixed: true, isNumeric: true },
    { key: COLUMN_NAMES.META.YEAST, label: '酵母', fixed: true, isNumeric: false },
    { key: COLUMN_NAMES.META.DESIGN, label: '酒質設計', fixed: true, isNumeric: false },
    { key: COLUMN_NAMES.META.SPECIFIC_NAME, label: '特定名称', fixed: false, isNumeric: false },
    { key: COLUMN_NAMES.META.TOTAL_VOLUME, label: '仕込み総量', fixed: false, isNumeric: true },
    { key: COLUMN_NAMES.META.TEMP_SUM_5DAYS, label: '積算品温(5日)', fixed: false, isNumeric: true },
    { key: COLUMN_NAMES.META.MAX_BAUME, label: '最高ボーメ', fixed: false, isNumeric: true },
    { key: COLUMN_NAMES.META.AB_START_BAUME, label: 'AB開始ボーメ', fixed: false, isNumeric: true },
    { key: COLUMN_NAMES.META.AB_START_ALCOHOL, label: 'AB開始アルコール', fixed: false, isNumeric: true },
    { key: COLUMN_NAMES.META.FINAL_BAUME, label: '最終ボーメ', fixed: false, isNumeric: true },
    { key: COLUMN_NAMES.META.FINAL_ALCOHOL, label: '最終アルコール', fixed: false, isNumeric: true },
    { key: COLUMN_NAMES.META.MAX_BMD, label: '最高BMD', fixed: false, isNumeric: true },
    { key: COLUMN_NAMES.META.MAX_BMD_DAY, label: '最高BMD日数', fixed: false, isNumeric: true },
    { key: '真のアルコール係数（追い水反映）', label: '真のアルコール係数①', fixed: false, isNumeric: true },
    { key: '真のアルコール係数（追い水無視）', label: '真のアルコール係数②', fixed: false, isNumeric: true },
    { key: COLUMN_NAMES.META.TOTAL_WATER, label: '追い水総量', fixed: false, isNumeric: true },
    { key: COLUMN_NAMES.META.WATER_RATIO, label: '追い水歩合', fixed: false, isNumeric: true },
    { key: 'EARLY_WATER_AMOUNT', label: '前半追い水量', fixed: false, isNumeric: true },
    { key: 'EARLY_WATER_RATIO', label: '前半追い水歩合', fixed: false, isNumeric: true },
    { key: COLUMN_NAMES.META.LATE_WATER, label: '後半追い水量', fixed: false, isNumeric: true },
    { key: COLUMN_NAMES.META.LATE_WATER_RATIO, label: '後半追い水割合', fixed: false, isNumeric: true },
  ];

  const dailyMetrics = [
    COLUMN_NAMES.DAILY.TEMP_1,
    COLUMN_NAMES.DAILY.BAUME_AFTER_WATER,
    COLUMN_NAMES.DAILY.ALCOHOL_AFTER_WATER,
    COLUMN_NAMES.DAILY.BMD_COMPLEMENT
  ];

  // タンクデータを処理
  const processedTanks = tanks ? 
    tanks.map(tank => ({
      ...tank,
      metadata: {
        ...tank.metadata,
        'EARLY_WATER_AMOUNT': calculateEarlyWaterAmount(tank),
        'EARLY_WATER_RATIO': calculateEarlyWaterRatio(tank),
        '真のアルコール係数（追い水反映）': calculateTrueCoefficientsFromMeta(tank).withWater,
        '真のアルコール係数（追い水無視）': calculateTrueCoefficientsFromMeta(tank).withoutWater,
      }
    })) : [];

  // フィルタリング
  const filteredTanks = processedTanks.filter(tank => {
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

  // 3. 選択タンク優先表示の実装
  const filteredAndSortedTanks = (() => {
    // まず選択済みと未選択に分離
    const selectedTanks = filteredTanks.filter(tank => selectedTankIds.includes(tank.tankId));
    const unselectedTanks = filteredTanks.filter(tank => !selectedTankIds.includes(tank.tankId));
    
    // ソート処理
    const sortTanks = (tanks) => {
      if (sortConfigs.length === 0) return tanks;
      
      return [...tanks].sort((a, b) => {
        for (const { key, direction } of sortConfigs) {
          let aValue, bValue;
          
          if (key === '真のアルコール係数（追い水反映）') {
            aValue = a.metadata['真のアルコール係数（追い水反映）'];
            bValue = b.metadata['真のアルコール係数（追い水反映）'];
          } else if (key === '真のアルコール係数（追い水無視）') {
            aValue = a.metadata['真のアルコール係数（追い水無視）'];
            bValue = b.metadata['真のアルコール係数（追い水無視）'];
          } else {
            aValue = a.metadata[key];
            bValue = b.metadata[key];
          }
          
          if (aValue === null && bValue === null) continue;
          if (aValue === null) return 1;
          if (bValue === null) return -1;
          
          let comparison = 0;
          const isNumeric = columns.find(col => col.key === key)?.isNumeric;
          if (isNumeric) {
            comparison = aValue - bValue;
          } else {
            comparison = String(aValue).localeCompare(String(bValue));
          }
          
          if (comparison !== 0) {
            return direction === 'asc' ? comparison : -comparison;
          }
        }
        return 0;
      });
    };
    
    // 選択済み、未選択それぞれをソートしてから結合
    return [...sortTanks(selectedTanks), ...sortTanks(unselectedTanks)];
  })();

  // 表示するカラムを取得
  const displayColumns = columns.filter(col => visibleColumns.has(col.key));

  // 固定列のleft位置を計算
  const getFixedColumnLeft = (columnIndex) => {
    let left = 50; // チェックボックス列の幅
    for (let i = 0; i < columnIndex; i++) {
      if (displayColumns[i].fixed) {
        left += 100; // 各固定列の幅
      }
    }
    return left;
  };

  // イベントハンドラー
  const handleSelectAll = () => {
    const allIds = filteredAndSortedTanks.map(tank => tank.tankId);
    const isAllSelected = allIds.length > 0 && allIds.every(id => selectedTankIds.includes(id));
    
    if (isAllSelected) {
      onSelectionChange(selectedTankIds.filter(id => !allIds.includes(id)));
    } else {
      onSelectionChange([...new Set([...selectedTankIds, ...allIds])]);
    }
  };

  const handleTankSelection = (tankId) => {
    if (selectedTankIds.includes(tankId)) {
      onSelectionChange(selectedTankIds.filter(id => id !== tankId));
    } else {
      onSelectionChange([...selectedTankIds, tankId]);
    }
  };

  const toggleColumn = (columnKey) => {
    const newVisibleColumns = new Set(visibleColumns);
    if (newVisibleColumns.has(columnKey)) {
      newVisibleColumns.delete(columnKey);
    } else {
      newVisibleColumns.add(columnKey);
    }
    setVisibleColumns(newVisibleColumns);
  };

  const getSortConfig = (key) => {
    return sortConfigs.find(config => config.key === key);
  };

  // ソート機能
  const handleSort = (key, event) => {
    event.stopPropagation();
    const existingIndex = sortConfigs.findIndex(config => config.key === key);
    
    if (existingIndex !== -1) {
      const existing = sortConfigs[existingIndex];
      const newSortConfigs = [...sortConfigs];
      
      if (existing.direction === 'asc') {
        newSortConfigs[existingIndex] = { ...existing, direction: 'desc' };
      } else {
        newSortConfigs.splice(existingIndex, 1);
      }
      
      setSortConfigs(newSortConfigs);
    } else {
      setSortConfigs([{ key, direction: 'asc' }, ...sortConfigs]);
    }
  };

  const clearAllSorts = () => {
    setSortConfigs([]);
  };

  // フィルターメニューを正しい位置に表示
  const openFilterMenu = (columnKey, event) => {
    event.stopPropagation();
    const rect = event.currentTarget.getBoundingClientRect();
    setFilterPosition({
      left: rect.left + window.scrollX,
      top: rect.bottom + window.scrollY
    });
    setActiveFilter(activeFilter === columnKey ? null : columnKey);
  };

  const getColumnValues = (columnKey) => {
    const values = processedTanks.map(tank => tank.metadata[columnKey]).filter(v => v !== null && v !== undefined);
    return [...new Set(values)].sort();
  };

  const handleFilterChange = (columnKey, value, checked) => {
    const currentFilter = filters[columnKey] || new Set();
    const newFilter = new Set(currentFilter);
    
    if (checked) {
      newFilter.add(value);
    } else {
      newFilter.delete(value);
    }
    
    setFilters({ ...filters, [columnKey]: newFilter });
  };

  const clearAllFilters = () => {
    setFilters({});
    setRangeFilters({});
  };

  // LocalStorage保存
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
    localStorage.setItem('visibleColumns', JSON.stringify(Array.from(visibleColumns)));
  }, [visibleColumns]);

  // 統計計算
  const metadataStats = columns.reduce((acc, col) => {
    if (!col.isNumeric) return acc;
    
    const values = filteredAndSortedTanks
      .map(tank => parseFloat(tank.metadata[col.key]))
      .filter(v => !isNaN(v));
    
    if (values.length > 0) {
      acc[col.key] = {
        avg: (values.reduce((sum, v) => sum + v, 0) / values.length).toFixed(2),
        max: Math.max(...values).toFixed(2),
        min: Math.min(...values).toFixed(2),
      };
    }
    return acc;
  }, {});

  const dailyStats = dailyMetrics.reduce((acc, metric) => {
    const values = filteredAndSortedTanks.flatMap(tank => {
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
    <div className="bg-white rounded-lg shadow-lg border border-gray-200">
      <div className="p-4 border-b border-gray-200 bg-gray-50">
        <h3 className="text-lg font-semibold flex items-center space-x-2">
          <Database className="w-5 h-5" />
          <span>メタデータ一覧表</span>
        </h3>
        <div className="mt-2 flex space-x-4 text-sm text-gray-600">
          <span>総タンク数: {tanks?.length || 0}</span>
          <span>表示中: {filteredAndSortedTanks.length}</span>
          <span>選択中: {selectedTankIds.length}</span>
        </div>
        
        <div className="mt-3 border-t pt-3">
          <div className="text-sm font-medium text-gray-700 mb-2">表示項目選択:</div>
          <div className="flex flex-wrap gap-x-4 gap-y-2">
            {columns.map(col => (
              <label key={col.key} className="flex items-center space-x-1 text-xs cursor-pointer">
                <input
                  type="checkbox"
                  checked={visibleColumns.has(col.key)}
                  onChange={() => toggleColumn(col.key)}
                  className="rounded border-gray-300"
                />
                <span className={visibleColumns.has(col.key) ? 'text-gray-900' : 'text-gray-400'}>
                  {col.label}
                </span>
              </label>
            ))}
          </div>
        </div>
      </div>
      
      <div className="relative overflow-auto" style={{ maxHeight: '500px' }} ref={tableRef}>
        <table className="w-full text-sm border-collapse">
          <thead className="sticky top-0 bg-gray-100" style={{ zIndex: 50 }}>
            <tr>
              <th
                className="border border-gray-200 p-2 bg-gray-100"
                style={{ 
                  minWidth: '50px', 
                  position: 'sticky',
                  left: 0,
                  top: 0,
                  zIndex: 51
                }}
              >
                <input
                  type="checkbox"
                  onChange={handleSelectAll}
                  checked={filteredAndSortedTanks.length > 0 && selectedTankIds.length === filteredAndSortedTanks.length}
                  className="rounded border-gray-400"
                />
              </th>
              {displayColumns.map((col, index) => (
                <th
                  key={col.key}
                  className={`border border-gray-200 p-2 ${
                    col.fixed ? 'bg-blue-50 font-bold' : 'bg-gray-100'
                  } ${filters[col.key]?.size > 0 || rangeFilters[col.key] ? 'bg-yellow-100' : ''}`}
                  style={{ 
                    minWidth: '100px', 
                    position: 'sticky',
                    top: 0,
                    ...(col.fixed ? { 
                      left: `${getFixedColumnLeft(index)}px`,
                      zIndex: 51 
                    } : { 
                      zIndex: 50 
                    })
                  }}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className="cursor-pointer hover:text-blue-600 flex items-center space-x-1"
                      onClick={(e) => handleSort(col.key, e)}
                    >
                      <span>{col.label}</span>
                      {getSortConfig(col.key) && (
                        <span className="flex items-center">
                          {getSortConfig(col.key).direction === 'asc' ? 
                            <ArrowUp className="w-3 h-3 text-blue-600" /> : 
                            <ArrowDown className="w-3 h-3 text-blue-600" />
                          }
                          <span className="text-xs bg-blue-600 text-white rounded-full w-4 h-4 flex items-center justify-center ml-1">
                            {sortConfigs.findIndex(config => config.key === col.key) + 1}
                          </span>
                        </span>
                      )}
                    </span>
                    <ChevronDown
                      className="w-4 h-4 cursor-pointer hover:text-blue-600"
                      onClick={(e) => openFilterMenu(col.key, e)}
                    />
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filteredAndSortedTanks.map(tank => (
              <tr key={tank.tankId} className={`hover:bg-gray-50 ${selectedTankIds.includes(tank.tankId) ? 'bg-blue-50' : ''}`}>
                <td className="border border-gray-200 p-2 sticky left-0 bg-white" style={{ zIndex: 20 }}>
                  <input
                    type="checkbox"
                    checked={selectedTankIds.includes(tank.tankId)}
                    onChange={() => handleTankSelection(tank.tankId)}
                    className="rounded border-gray-300"
                  />
                </td>
                {displayColumns.map((col, index) => (
                  <td
                    key={col.key}
                    className={`border border-gray-200 p-2 ${
                      col.fixed ? 'sticky bg-blue-50 font-medium' : ''
                    }`}
                    style={{ 
                      left: col.fixed ? `${getFixedColumnLeft(index)}px` : 'auto',
                      zIndex: col.fixed ? 10 : 1
                    }}
                  >
                    {(() => {
                      if (col.key === '真のアルコール係数（追い水反映）') {
                        return tank.metadata['真のアルコール係数（追い水反映）'] !== null ? 
                          tank.metadata['真のアルコール係数（追い水反映）'].toFixed(3) : '-';
                      } else if (col.key === '真のアルコール係数（追い水無視）') {
                        return tank.metadata['真のアルコール係数（追い水無視）'] !== null ? 
                          tank.metadata['真のアルコール係数（追い水無視）'].toFixed(3) : '-';
                      } else if (col.key === 'EARLY_WATER_AMOUNT') {
                        return tank.metadata['EARLY_WATER_AMOUNT'] !== null ? 
                          tank.metadata['EARLY_WATER_AMOUNT'].toFixed(1) : '-';
                      } else if (col.key === 'EARLY_WATER_RATIO') {
                        return tank.metadata['EARLY_WATER_RATIO'] !== null ? 
                          tank.metadata['EARLY_WATER_RATIO'].toFixed(2) : '-';
                      } else {
                        return tank.metadata[col.key] !== null && tank.metadata[col.key] !== undefined
                          ? String(tank.metadata[col.key])
                          : '-';
                      }
                    })()}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      {/* フィルターポップアップ */}
      {activeFilter && (
        <div className="absolute bg-white border border-gray-300 rounded-lg shadow-lg p-3 z-50"
             style={{ 
               left: filterPosition.left, 
               top: filterPosition.top, 
               width: '250px', 
               maxHeight: '300px' 
             }}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">{columns.find(col => col.key === activeFilter)?.label}</span>
            <button
              onClick={() => setActiveFilter(null)}
              className="text-gray-500 hover:text-gray-700"
            >
              ×
            </button>
          </div>
          
          <input
            type="text"
            placeholder="検索..."
            value={filterSearch}
            onChange={(e) => setFilterSearch(e.target.value)}
            className="w-full p-1 text-xs border border-gray-300 rounded mb-2"
          />
          
          <div className="max-h-40 overflow-y-auto space-y-1">
            <button
              onClick={() => {
                const currentFilter = filters[activeFilter] || new Set();
                const allValues = getColumnValues(activeFilter);
                const isAllSelected = allValues.every(value => currentFilter.has(value));
                
                if (isAllSelected) {
                  setFilters({ ...filters, [activeFilter]: new Set() });
                } else {
                  setFilters({ ...filters, [activeFilter]: new Set(allValues) });
                }
              }}
              className="text-xs text-blue-600 hover:text-blue-800 mb-1"
            >
              {(() => {
                const currentFilter = filters[activeFilter] || new Set();
                const allValues = getColumnValues(activeFilter);
                return allValues.every(value => currentFilter.has(value)) ? 'すべて解除' : 'すべて選択';
              })()}
            </button>
            {getColumnValues(activeFilter)
              .filter(value => 
                filterSearch === '' || 
                String(value).toLowerCase().includes(filterSearch.toLowerCase())
              )
              .map(value => (
                <label key={value} className="flex items-center space-x-2 text-xs cursor-pointer">
                  <input
                    type="checkbox"
                    checked={filters[activeFilter]?.has(value) ?? false}
                    onChange={(e) => handleFilterChange(activeFilter, value, e.target.checked)}
                    className="rounded border-gray-300"
                  />
                  <span className="truncate">{value}</span>
                </label>
              ))}
          </div>
        </div>
      )}
      
      {/* 統計情報 */}
      <div className="p-4 border-t border-gray-200 bg-gray-50">
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-sm font-semibold text-gray-700">統計情報</h4>
          <button
            onClick={clearAllFilters}
            className="px-3 py-1 text-xs bg-red-100 text-red-700 rounded hover:bg-red-200"
          >
            フィルターを全てクリア
          </button>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <h5 className="text-xs font-medium text-gray-600 mb-2">メタデータ統計</h5>
            <div className="overflow-auto max-h-32">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="border border-gray-200 p-1">項目</th>
                    <th className="border border-gray-200 p-1">平均</th>
                    <th className="border border-gray-200 p-1">最大</th>
                    <th className="border border-gray-200 p-1">最小</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(metadataStats).map(([field, stats]) => (
                    <tr key={field} className="border-b">
                      <td className="border border-gray-200 p-1">
                        {columns.find(col => col.key === field)?.label || field}
                      </td>
                      <td className="border border-gray-200 p-1">{stats.avg}</td>
                      <td className="border border-gray-200 p-1">{stats.max}</td>
                      <td className="border border-gray-200 p-1">{stats.min}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          
          <div>
            <h5 className="text-xs font-medium text-gray-600 mb-2">日次データ統計</h5>
            <div className="overflow-auto max-h-32">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="border border-gray-200 p-1">項目</th>
                    <th className="border border-gray-200 p-1">平均</th>
                    <th className="border border-gray-200 p-1">最大</th>
                    <th className="border border-gray-200 p-1">最小</th>
                  </tr>
                </thead>
                <tbody>
                  {dailyMetrics.map(metric => (
                    <tr key={metric} className="border-b">
                      <td className="border border-gray-200 p-1">{metric}</td>
                      <td className="border border-gray-200 p-1">{dailyStats[metric].avg}</td>
                      <td className="border border-gray-200 p-1">{dailyStats[metric].max}</td>
                      <td className="border border-gray-200 p-1">{dailyStats[metric].min}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DataTable;