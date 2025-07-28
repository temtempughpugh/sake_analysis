import React, { useState, useRef, useEffect } from 'react';
import { Database, ChevronDown, ArrowUp, ArrowDown } from 'lucide-react';

// 醪日数を計算する関数
const calculateMoromiDays = (tank) => {
  if (!tank.dailyData || typeof tank.dailyData !== 'object') {
    return null;
  }
  
  const dayNumbers = Object.values(tank.dailyData)
    .map(dayData => {
      const dayValue = dayData['日数'];
      return dayValue !== null && dayValue !== undefined && dayValue !== '' ? parseInt(dayValue) : null;
    })
    .filter(day => day !== null && !isNaN(day));
  
  return dayNumbers.length > 0 ? Math.max(...dayNumbers) : null;
};

const calculateTrueCoefficientsFromMeta = (tank) => {
  const metadata = tank.metadata || {};
  
  console.log('=== META DEBUG for tank', tank.tankId, '===');
  console.log('All metadata keys:', Object.keys(metadata));
  console.log('AB開始ボーメ:', metadata['AB開始ボーメ']);
  console.log('AB開始アルコール:', metadata['AB開始アルコール']);
  console.log('最終ボーメ:', metadata['最終ボーメ']);
  console.log('最終アルコール度数:', metadata['最終アルコール度数']);
  console.log('仕込み総量:', metadata['仕込み総量']);
  console.log('追い水総量:', metadata['追い水総量']);
  
  const startBaume = parseFloat(metadata['AB開始ボーメ']);
  const startAlcohol = parseFloat(metadata['AB開始アルコール']);
  const finalBaume = parseFloat(metadata['最終ボーメ']);
  const finalAlcohol = parseFloat(metadata['最終アルコール度数']);
  const totalVolume = parseFloat(metadata['仕込み総量']);
  const totalWater = parseFloat(metadata['追い水総量']) || 0;
  
  console.log('Parsed values:', {
    startBaume, startAlcohol, finalBaume, finalAlcohol, totalVolume, totalWater
  });
  
  if (isNaN(startBaume) || isNaN(startAlcohol) || isNaN(finalBaume) || isNaN(finalAlcohol) || isNaN(totalVolume)) {
    console.log('Missing required data, returning null');
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
  
  console.log('Calculated coefficients:', {
    withWater: coefficientWithWater,
    withoutWater: coefficientWithoutWater
  });
  console.log('=== END META DEBUG ===');
  
  return {
    withWater: coefficientWithWater,
    withoutWater: coefficientWithoutWater
  };
};

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
    { key: '醪日数', label: '醪日数', fixed: true, isNumeric: true }, // 醪日数を順号の次に追加
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
    // 真のアルコール係数を追加（最高BMD日数と追い水総量の間）
    { key: 'true_alcohol_coeff_with_water', label: '真のアルコール係数①', fixed: false, isNumeric: true },
    { key: 'true_alcohol_coeff_without_water', label: '真のアルコール係数②', fixed: false, isNumeric: true },
    { key: '追い水総量', label: '追い水総量', fixed: false, isNumeric: true },
    { key: '追い水歩合', label: '追い水歩合', fixed: false, isNumeric: true },
    { key: '後半追い水量', label: '後半追い水量', fixed: false, isNumeric: true },
    { key: '後半追い水割合', label: '後半追い水割合', fixed: false, isNumeric: true },
  ];

  const [visibleColumns, setVisibleColumns] = useState(() => {
    const saved = localStorage.getItem('visibleColumns');
    if (saved) {
      return new Set(JSON.parse(saved));
    }
    return new Set(columns.map(col => col.key));
  });

  const displayColumns = columns.filter(col => visibleColumns.has(col.key));

  const toggleColumn = (columnKey) => {
    const newVisible = new Set(visibleColumns);
    if (newVisible.has(columnKey)) {
      newVisible.delete(columnKey);
    } else {
      newVisible.add(columnKey);
    }
    setVisibleColumns(newVisible);
    localStorage.setItem('visibleColumns', JSON.stringify([...newVisible]));
  };

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
    const newSelected = selectedTankIds.includes(tankId)
      ? selectedTankIds.filter(id => id !== tankId)
      : [...selectedTankIds, tankId];
    onSelectionChange(newSelected);
  };

  const handleSelectAll = () => {
    if (selectedTankIds.length === processedTanks.length) {
      onSelectionChange([]);
    } else {
      onSelectionChange(processedTanks.map(tank => tank.tankId));
    }
  };

  const applyFilters = (tanks) => {
    return tanks.filter(tank => {
      for (const [key, filterSet] of Object.entries(filters)) {
        if (filterSet.size === 0) continue;
        
        let value;
        if (key === 'true_alcohol_coeff_with_water') {
          const result = calculateTrueCoefficientsFromMeta(tank);
          value = result.withWater !== null ? result.withWater.toFixed(3) : '-';
        } else if (key === 'true_alcohol_coeff_without_water') {
          const result = calculateTrueCoefficientsFromMeta(tank);
          value = result.withoutWater !== null ? result.withoutWater.toFixed(3) : '-';
        } else if (key === '醪日数') {
          const moromiDays = calculateMoromiDays(tank);
          value = moromiDays !== null ? moromiDays.toString() : '-';
        } else {
          value = tank.metadata[key];
        }
        
        if (value == null) value = '-';
        if (!filterSet.has(String(value))) return false;
      }
      
      for (const [key, range] of Object.entries(rangeFilters)) {
        if (!range.min && !range.max) continue;
        
        let numValue;
        if (key === 'true_alcohol_coeff_with_water') {
          const result = calculateTrueCoefficientsFromMeta(tank);
          numValue = result.withWater;
        } else if (key === 'true_alcohol_coeff_without_water') {
          const result = calculateTrueCoefficientsFromMeta(tank);
          numValue = result.withoutWater;
        } else if (key === '醪日数') {
          numValue = calculateMoromiDays(tank);
        } else {
          numValue = Number(tank.metadata[key]);
        }
        
        if (isNaN(numValue)) continue;
        if (range.min && numValue < Number(range.min)) return false;
        if (range.max && numValue > Number(range.max)) return false;
      }
      
      return true;
    });
  };

  const applySorts = (tanks) => {
    if (sortConfigs.length === 0) return tanks;
    
    return [...tanks].sort((a, b) => {
      for (const { key, direction } of sortConfigs) {
        let aValue, bValue;
        
        if (key === 'true_alcohol_coeff_with_water') {
          try {
            const aResult = calculateTrueCoefficientsFromMeta(a);
            const bResult = calculateTrueCoefficientsFromMeta(b);
            aValue = aResult ? aResult.withWater : null;
            bValue = bResult ? bResult.withWater : null;
          } catch (e) {
            aValue = null;
            bValue = null;
          }
        } else if (key === 'true_alcohol_coeff_without_water') {
          try {
            const aResult = calculateTrueCoefficientsFromMeta(a);
            const bResult = calculateTrueCoefficientsFromMeta(b);
            aValue = aResult ? aResult.withoutWater : null;
            bValue = bResult ? bResult.withoutWater : null;
          } catch (e) {
            aValue = null;
            bValue = null;
          }
        } else if (key === '醪日数') {
          aValue = calculateMoromiDays(a);
          bValue = calculateMoromiDays(b);
        } else {
          aValue = a.metadata[key];
          bValue = b.metadata[key];
        }
        
        // null処理
        if (aValue == null && bValue == null) continue;
        if (aValue == null) return 1;
        if (bValue == null) return -1;
        
        // 数値型と文字列型を区別してソート
        const column = columns.find(col => col.key === key);
        let comparison;
        
        if (column && column.isNumeric) {
          comparison = Number(aValue) - Number(bValue);
        } else {
          comparison = String(aValue).localeCompare(String(bValue));
        }
        
        if (comparison !== 0) return direction === 'asc' ? comparison : -comparison;
      }
      return 0;
    });
  };

  const handleSortFromMenu = (key, direction) => {
    console.log('handleSortFromMenu called:', key, direction);
    setSortConfigs(prev => {
      const newConfigs = prev.filter(config => config.key !== key);
      newConfigs.push({ key, direction });
      console.log('New sortConfigs:', newConfigs);
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
    const rect = th.getBoundingClientRect(); // これで画面上の絶対位置が取得される
    
    // フィルターポップアップのサイズ
    const popupWidth = 250;
    const popupHeight = 300;
    
    // 画面サイズを取得
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    
    // 基本位置（ヘッダーの直下、画面上の絶対位置）
    let left = rect.left;
    let top = rect.bottom;
    
    // 右端がはみ出る場合は左にずらす
    if (left + popupWidth > viewportWidth) {
      left = viewportWidth - popupWidth - 10;
    }
    
    // 下端がはみ出る場合は上に表示
    if (top + popupHeight > viewportHeight) {
      top = rect.top - popupHeight - 5; // ヘッダーの上に表示
    }
    
    // 左端がはみ出る場合の調整
    if (left < 10) {
      left = 10;
    }
    
    // 上端がはみ出る場合の調整
    if (top < 10) {
      top = 10;
    }
    
    setFilterPosition({ left, top });
    setActiveFilter(activeFilter === colKey ? null : colKey);
    setFilterSearch('');
  };

  const getColumnValues = (key) => {
    const values = new Set();
    tanks.forEach(tank => {
      let value;
      if (key === 'true_alcohol_coeff_with_water') {
        const result = calculateTrueCoefficientsFromMeta(tank);
        value = result.withWater !== null ? result.withWater.toFixed(3) : '-';
      } else if (key === 'true_alcohol_coeff_without_water') {
        const result = calculateTrueCoefficientsFromMeta(tank);
        value = result.withoutWater !== null ? result.withoutWater.toFixed(3) : '-';
      } else if (key === '醪日数') {
        const moromiDays = calculateMoromiDays(tank);
        value = moromiDays !== null ? moromiDays.toString() : '-';
      } else {
        value = tank.metadata[key];
      }
      
      if (value == null) value = '-';
      values.add(String(value));
    });
    return Array.from(values).sort((a, b) => {
      const numA = Number(a);
      const numB = Number(b);
      if (!isNaN(numA) && !isNaN(numB)) {
        return numA - numB;
      }
      return a.localeCompare(b);
    });
  };

  const handleFilterChange = (key, value, checked) => {
    setFilters(prev => {
      const newFilters = { ...prev };
      if (!newFilters[key]) {
        newFilters[key] = new Set();
      } else {
        newFilters[key] = new Set(newFilters[key]);
      }
      
      if (checked) {
        newFilters[key].add(value);
      } else {
        newFilters[key].delete(value);
      }
      
      return newFilters;
    });
  };

  const handleRangeFilterChange = (key, type, value) => {
    setRangeFilters(prev => ({
      ...prev,
      [key]: {
        ...prev[key],
        [type]: value
      }
    }));
  };

  const clearFilter = (key) => {
    setFilters(prev => {
      const newFilters = { ...prev };
      delete newFilters[key];
      return newFilters;
    });
    setRangeFilters(prev => {
      const newFilters = { ...prev };
      delete newFilters[key];
      return newFilters;
    });
  };

  const processedTanks = applySorts(applyFilters(tanks || []));

  const selectedTanksData = processedTanks.filter(tank => selectedTankIds.includes(tank.tankId));

  const metaStats = columns.filter(col => col.isNumeric).reduce((acc, col) => {
    const values = selectedTanksData.map(tank => {
      if (col.key === 'true_alcohol_coeff_with_water') {
        const result = calculateTrueCoefficientsFromMeta(tank);
        return result.withWater;
      } else if (col.key === 'true_alcohol_coeff_without_water') {
        const result = calculateTrueCoefficientsFromMeta(tank);
        return result.withoutWater;
      } else if (col.key === '醪日数') {
        return calculateMoromiDays(tank);
      } else {
        return Number(tank.metadata[col.key]);
      }
    }).filter(v => !isNaN(v) && v !== null);
    
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
              {displayColumns.map(col => (
                <th
                  key={col.key}
                  className={`border border-gray-200 p-2 sticky top-0 ${col.fixed ? 'bg-blue-50 font-bold z-5' : 'bg-gray-100 z-10'} ${filters[col.key]?.size > 0 || rangeFilters[col.key] ? 'bg-yellow-100' : ''}`}
                  style={{ minWidth: '100px', left: col.fixed ? `${50 + displayColumns.filter(c => c.fixed && displayColumns.indexOf(c) < displayColumns.indexOf(col)).length * 100}px` : 'auto' }}
                >
                  <div className="flex items-center justify-between space-x-1">
                    <span className="truncate">{col.label}</span>
                    <div className="flex items-center space-x-1">
                      {getSortConfig(col.key) && (
                        <div className="flex items-center">
                          {getSortConfig(col.key).direction === 'asc' ? 
                            <ArrowUp className="w-3 h-3 text-blue-600" /> : 
                            <ArrowDown className="w-3 h-3 text-blue-600" />
                          }
                          <span className="text-xs text-blue-600 ml-1">{getSortPriority(col.key)}</span>
                        </div>
                      )}
                      <button
                        onClick={(e) => handleFilterButtonClick(e, col.key)}
                        className="p-1 hover:bg-gray-300 rounded"
                      >
                        <ChevronDown className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
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
                {displayColumns.map(col => (
  <td
    key={col.key}
    className={`border border-gray-200 p-2 ${col.fixed ? 'sticky z-5 bg-inherit' : ''}`}
    style={{ minWidth: '100px', left: col.fixed ? `${50 + displayColumns.filter(c => c.fixed && displayColumns.indexOf(c) < displayColumns.indexOf(col)).length * 100}px` : 'auto' }}
  >
    {(() => {
      // 醪日数の場合
      if (col.key === '醪日数') {
        const moromiDays = calculateMoromiDays(tank);
        return moromiDays !== null ? moromiDays : '-';
      }
      // 真のアルコール係数①の場合
      else if (col.key === 'true_alcohol_coeff_with_water') {
        const result = calculateTrueCoefficientsFromMeta(tank);
        return result.withWater !== null ? result.withWater.toFixed(3) : '-';
      } 
      // 真のアルコール係数②の場合
      else if (col.key === 'true_alcohol_coeff_without_water') {
        const result = calculateTrueCoefficientsFromMeta(tank);
        return result.withoutWater !== null ? result.withoutWater.toFixed(3) : '-';
      } 
      // 通常のメタデータ項目
      else {
        return tank.metadata[col.key] ?? '-';
      }
    })()}
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
                  <td className="border border-gray-200 p-2">{metaStats[col.key]?.avg || '-'}</td>
                  <td className="border border-gray-200 p-2">{metaStats[col.key]?.max || '-'}</td>
                  <td className="border border-gray-200 p-2">{metaStats[col.key]?.min || '-'}</td>
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

      {/* フィルターポップアップ */}
      {activeFilter && (
        <div
          ref={filterRef}
          className="fixed bg-white border border-gray-300 rounded-lg shadow-lg p-3 z-50"
          style={{
            left: filterPosition.left,
            top: filterPosition.top,
            width: '250px',
            maxHeight: '300px',
            overflow: 'auto'
          }}
        >
          <div className="mb-2">
            <div className="flex justify-between items-center mb-2">
              <span className="font-semibold text-sm">{columns.find(col => col.key === activeFilter)?.label}</span>
              <button
                onClick={() => clearFilter(activeFilter)}
                className="text-red-600 hover:text-red-800 text-xs"
              >
                クリア
              </button>
            </div>
            
            {/* 数値型の場合は範囲フィルター */}
            {columns.find(col => col.key === activeFilter)?.isNumeric && (
              <div className="mb-3 p-2 bg-gray-50 rounded">
                <div className="text-xs text-gray-600 mb-1">範囲指定</div>
                <div className="flex space-x-2">
                  <input
                    type="number"
                    placeholder="最小"
                    value={rangeFilters[activeFilter]?.min || ''}
                    onChange={(e) => handleRangeFilterChange(activeFilter, 'min', e.target.value)}
                    className="w-20 px-2 py-1 border border-gray-300 rounded text-xs"
                  />
                  <span className="self-center text-xs">〜</span>
                  <input
                    type="number"
                    placeholder="最大"
                    value={rangeFilters[activeFilter]?.max || ''}
                    onChange={(e) => handleRangeFilterChange(activeFilter, 'max', e.target.value)}
                    className="w-20 px-2 py-1 border border-gray-300 rounded text-xs"
                  />
                </div>
              </div>
            )}
            
            <input
              type="text"
              placeholder="検索..."
              value={filterSearch}
              onChange={(e) => setFilterSearch(e.target.value)}
              className="w-full px-2 py-1 border border-gray-300 rounded text-sm mb-2"
            />
          </div>
          
          <div className="space-y-1 max-h-32 overflow-y-auto">
            <div className="flex items-center space-x-2 text-xs">
              <button
                onClick={() => {
                  const values = getColumnValues(activeFilter);
                  values.forEach(value => {
                    handleFilterChange(activeFilter, value, !(filters[activeFilter]?.has(value) ?? false));
                  });
                }}
                className="text-blue-600 hover:text-blue-800"
              >
                {filters[activeFilter]?.size === getColumnValues(activeFilter).length ? 'すべて解除' : 'すべて選択'}
              </button>
            </div>
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
          
          {/* ソートメニュー */}
          <div className="mt-3 pt-3 border-t border-gray-200">
            <div className="text-xs text-gray-600 mb-2">ソート</div>
            <div className="flex space-x-2">
              <button
                onClick={() => handleSortFromMenu(activeFilter, 'asc')}
                className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
              >
                昇順
              </button>
              <button
                onClick={() => handleSortFromMenu(activeFilter, 'desc')}
                className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
              >
                降順
              </button>
              {getSortConfig(activeFilter) && (
                <button
                  onClick={() => clearSort(activeFilter)}
                  className="px-2 py-1 text-xs bg-red-100 text-red-700 rounded hover:bg-red-200"
                >
                  解除
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DataTable;