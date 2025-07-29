import React, { useState, useRef, useEffect } from 'react';
import { Database, ChevronDown, ArrowUp, ArrowDown } from 'lucide-react';
import { COLUMN_NAMES } from '../utils/csvParser';

// 最高ボーメを計算する関数（日次データの「ボーメ（補完）」列から）
const calculateMaxBaume = (tank) => {
  if (!tank.dailyData || typeof tank.dailyData !== 'object') {
    return null;
  }
  
  const baumeValues = Object.values(tank.dailyData)
    .map(data => parseFloat(data[COLUMN_NAMES.DAILY.BAUME_ESTIMATED]))
    .filter(value => !isNaN(value));
  
  return baumeValues.length > 0 ? Math.max(...baumeValues) : null;
};

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

// AB開始アルコール計測日を特定する関数
const getAlcoholStartDay = (tank) => {
  if (!tank.dailyData || typeof tank.dailyData !== 'object') {
    return null;
  }
  
  // 日次データからアルコール（補完）があるエントリを取得
  const dailyEntries = Object.entries(tank.dailyData)
    .map(([day, data]) => ({
      day: parseInt(day),
      alcohol: parseFloat(data[COLUMN_NAMES.DAILY.ALCOHOL_ESTIMATED]) || null
    }))
    .filter(entry => entry.alcohol !== null && entry.alcohol > 0)
    .sort((a, b) => a.day - b.day);
  
  // 最初のアルコール計測日を返す
  return dailyEntries.length > 0 ? dailyEntries[0].day : null;
};

// 前半追い水量を計算する関数
const calculateEarlyWaterAmount = (tank) => {
  const alcoholStartDay = getAlcoholStartDay(tank);
  if (!alcoholStartDay || !tank.dailyData) {
    return null;
  }
  
  let earlyWaterAmount = 0;
  Object.entries(tank.dailyData).forEach(([day, data]) => {
    const dayNum = parseInt(day);
    const waterAmount = parseFloat(data[COLUMN_NAMES.DAILY.WATER]) || 0;
    // AB開始アルコール計測日の前日まで（その日は含まない）
    if (dayNum < alcoholStartDay && waterAmount > 0) {
      earlyWaterAmount += waterAmount;
    }
  });
  
  return earlyWaterAmount;
};

// 前半追い水歩合を計算する関数
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
    if (saved) {
      const parsed = JSON.parse(saved);
      return new Set(parsed);
    }
    // デフォルトでは全カラムを表示
    return new Set([
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
      COLUMN_NAMES.META.TOTAL_WATER,
      COLUMN_NAMES.META.WATER_RATIO,
      '真のアルコール係数（追い水反映）',
      '真のアルコール係数（追い水無視）',
      'EARLY_WATER_AMOUNT', // 前半追い水量
      'EARLY_WATER_RATIO',  // 前半追い水歩合
      COLUMN_NAMES.META.LATE_WATER,
      COLUMN_NAMES.META.LATE_WATER_RATIO,
    ]);
  });
  const [activeFilter, setActiveFilter] = useState(null);
  const [filterPosition, setFilterPosition] = useState({ left: 0, top: 0 });
  const [filterSearch, setFilterSearch] = useState('');
  const tableRef = useRef(null);
  const filterRef = useRef(null);

  // 列定義に前半追い水量・歩合と真のアルコール係数を追加
  const columns = [
    { key: COLUMN_NAMES.META.TANK_NUMBER, label: '順号', fixed: true, isNumeric: true },
    { key: COLUMN_NAMES.META.BATCH_SIZE, label: '仕込み規模', fixed: true, isNumeric: true },
    { key: COLUMN_NAMES.META.YEAST, label: '酵母', fixed: true, isNumeric: false },
    { key: COLUMN_NAMES.META.DESIGN, label: '酒質設計', fixed: true, isNumeric: false },
    { key: COLUMN_NAMES.META.SPECIFIC_NAME, label: '特定名称', fixed: false, isNumeric: false },
    { key: COLUMN_NAMES.META.TOTAL_VOLUME, label: '仕込み総量', fixed: false, isNumeric: true },
    { key: COLUMN_NAMES.META.TEMP_SUM_5DAYS, label: '5日までの積算品温', fixed: false, isNumeric: true },
    { key: 'MAX_BAUME_CALCULATED', label: '最高ボーメ', fixed: false, isNumeric: true }, // 計算された最高ボーメ
    { key: COLUMN_NAMES.META.AB_START_BAUME, label: 'AB開始ボーメ', fixed: false, isNumeric: true },
    { key: COLUMN_NAMES.META.AB_START_ALCOHOL, label: 'AB開始アルコール', fixed: false, isNumeric: true },
    { key: COLUMN_NAMES.META.FINAL_BAUME, label: '最終ボーメ', fixed: false, isNumeric: true },
    { key: COLUMN_NAMES.META.FINAL_ALCOHOL, label: '最終アルコール度数', fixed: false, isNumeric: true },
    { key: COLUMN_NAMES.META.MAX_BMD, label: '最高BMD', fixed: false, isNumeric: true },
    { key: COLUMN_NAMES.META.MAX_BMD_DAY, label: '最高BMD日数', fixed: false, isNumeric: true },
    // 真のアルコール係数を追加（最高BMD日数と追い水総量の間）
    { key: '真のアルコール係数（追い水反映）', label: '真のアルコール係数①', fixed: false, isNumeric: true },
    { key: '真のアルコール係数（追い水無視）', label: '真のアルコール係数②', fixed: false, isNumeric: true },
    { key: COLUMN_NAMES.META.TOTAL_WATER, label: '追い水総量', fixed: false, isNumeric: true },
    { key: COLUMN_NAMES.META.WATER_RATIO, label: '追い水歩合', fixed: false, isNumeric: true },
    { key: 'EARLY_WATER_AMOUNT', label: '前半追い水量', fixed: false, isNumeric: true }, // NEW
    { key: 'EARLY_WATER_RATIO', label: '前半追い水歩合', fixed: false, isNumeric: true }, // NEW
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
  const processedTanks = tanks ? tanks.map(tank => {
    const coefficients = calculateTrueCoefficientsFromMeta(tank);
    const moromiDays = calculateMoromiDays(tank);
    const earlyWaterAmount = calculateEarlyWaterAmount(tank);
    const earlyWaterRatio = calculateEarlyWaterRatio(tank);
    const maxBaume = calculateMaxBaume(tank); // 最高ボーメ計算
    
    return {
      ...tank,
      metadata: {
        ...tank.metadata,
        'MAX_BAUME_CALCULATED': maxBaume, // 計算された最高ボーメ
        'EARLY_WATER_AMOUNT': earlyWaterAmount, // 前半追い水量
        'EARLY_WATER_RATIO': earlyWaterRatio,   // 前半追い水歩合
        '真のアルコール係数（追い水反映）': coefficients.withWater?.toFixed(2) || null,
        '真のアルコール係数（追い水無視）': coefficients.withoutWater?.toFixed(2) || null,
        '醪日数': moromiDays
      }
    };
  }) : [];

  // データの保存
  useEffect(() => {
    localStorage.setItem('sortConfigs', JSON.stringify(sortConfigs));
  }, [sortConfigs]);

  useEffect(() => {
    const filtersForStorage = Object.fromEntries(
      Object.entries(filters).map(([key, value]) => [key, Array.from(value)])
    );
    localStorage.setItem('filters', JSON.stringify(filtersForStorage));
  }, [filters]);

  useEffect(() => {
    localStorage.setItem('rangeFilters', JSON.stringify(rangeFilters));
  }, [rangeFilters]);

  useEffect(() => {
    localStorage.setItem('visibleColumns', JSON.stringify(Array.from(visibleColumns)));
  }, [visibleColumns]);

  // フィルター・ソート処理
  const filteredAndSortedTanks = processedTanks
    .filter(tank => {
      return Object.entries(filters).every(([column, values]) => {
        if (!values || values.size === 0) return true;
        const value = tank.metadata[column];
        return values.has(value);
      });
    })
    .filter(tank => {
      return Object.entries(rangeFilters).every(([column, range]) => {
        if (!range) return true;
        const value = parseFloat(tank.metadata[column]);
        if (isNaN(value)) return true;
        return (!range.min || value >= range.min) && (!range.max || value <= range.max);
      });
    })
    .sort((a, b) => {
      for (const config of sortConfigs) {
        const aValue = a.metadata[config.key];
        const bValue = b.metadata[config.key];
        
        if (aValue === null && bValue === null) continue;
        if (aValue === null) return 1;
        if (bValue === null) return -1;
        
        const column = columns.find(col => col.key === config.key);
        let comparison;
        
        if (column?.isNumeric) {
          comparison = parseFloat(aValue) - parseFloat(bValue);
        } else {
          comparison = String(aValue).localeCompare(String(bValue));
        }
        
        if (comparison !== 0) {
          return config.direction === 'asc' ? comparison : -comparison;
        }
      }
      return 0;
    });

  // 表示するカラムを取得
  const displayColumns = columns.filter(col => visibleColumns.has(col.key));

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

  const handleSort = (key) => {
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

  const handleSortFromMenu = (key, direction) => {
    const newSortConfigs = sortConfigs.filter(config => config.key !== key);
    setSortConfigs([{ key, direction }, ...newSortConfigs]);
    setActiveFilter(null);
  };

  const clearSort = (key) => {
    setSortConfigs(sortConfigs.filter(config => config.key !== key));
    setActiveFilter(null);
  };

  const getColumnValues = (columnKey) => {
    const values = processedTanks.map(tank => tank.metadata[columnKey]);
    return [...new Set(values.filter(v => v !== null && v !== undefined))];
  };

  const handleFilterChange = (column, value, checked) => {
    setFilters(prev => {
      const current = prev[column] || new Set();
      const updated = new Set(current);
      
      if (checked) {
        updated.add(value);
      } else {
        updated.delete(value);
      }
      
      return { ...prev, [column]: updated };
    });
  };

  const clearFilter = (column) => {
    setFilters(prev => {
      const updated = { ...prev };
      delete updated[column];
      return updated;
    });
  };

  const clearAllFilters = () => {
    setFilters({});
    setRangeFilters({});
  };

  const handleRangeFilterChange = (column, type, value) => {
    setRangeFilters(prev => ({
      ...prev,
      [column]: {
        ...prev[column],
        [type]: value === '' ? null : parseFloat(value)
      }
    }));
  };

  const openFilterMenu = (columnKey, event) => {
    const rect = event.currentTarget.getBoundingClientRect();
    setFilterPosition({
      left: rect.left,
      top: rect.bottom + window.scrollY
    });
    setActiveFilter(columnKey);
    setFilterSearch('');
  };

  // フィルターメニュー外クリック処理
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (filterRef.current && !filterRef.current.contains(event.target)) {
        setActiveFilter(null);
      }
    };

    if (activeFilter) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [activeFilter]);

  const numericFields = [
    COLUMN_NAMES.META.BATCH_SIZE, COLUMN_NAMES.META.TOTAL_VOLUME, COLUMN_NAMES.META.TEMP_SUM_5DAYS,
    'MAX_BAUME_CALCULATED', // 計算された最高ボーメ
    COLUMN_NAMES.META.AB_START_BAUME, COLUMN_NAMES.META.FINAL_BAUME,
    COLUMN_NAMES.META.AB_START_ALCOHOL, COLUMN_NAMES.META.FINAL_ALCOHOL, COLUMN_NAMES.META.MAX_BMD,
    COLUMN_NAMES.META.MAX_BMD_DAY, 
    '真のアルコール係数（追い水反映）', '真のアルコール係数（追い水無視）', // 真のアルコール係数
    COLUMN_NAMES.META.TOTAL_WATER, COLUMN_NAMES.META.WATER_RATIO,
    'EARLY_WATER_AMOUNT', 'EARLY_WATER_RATIO', // 新しい数値項目
    COLUMN_NAMES.META.LATE_WATER, COLUMN_NAMES.META.LATE_WATER_RATIO
  ];

  // 統計計算
  const metadataStats = numericFields.reduce((acc, field) => {
    const values = filteredAndSortedTanks
      .map(tank => parseFloat(tank.metadata[field]))
      .filter(v => !isNaN(v));
    
    if (values.length > 0) {
      acc[field] = {
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
          <thead className="sticky top-0 z-10 bg-gray-100">
            <tr>
              <th
                className="border border-gray-200 p-2 sticky left-0 top-0 z-10 bg-gray-100"
                style={{ minWidth: '50px' }}
              >
                <input
                  type="checkbox"
                  onChange={handleSelectAll}
                  checked={filteredAndSortedTanks.length > 0 && selectedTankIds.length === filteredAndSortedTanks.length}
                  className="rounded border-gray-400"
                />
              </th>
              {displayColumns.map(col => (
                <th
                  key={col.key}
                  className={`border border-gray-200 p-2 sticky top-0 ${col.fixed ? 'bg-blue-50 font-bold sticky z-20' : 'bg-gray-100 z-10'} ${filters[col.key]?.size > 0 || rangeFilters[col.key] ? 'bg-yellow-100' : ''}`}
                  style={{ 
                    minWidth: '100px', 
                    left: col.fixed ? `${50 + displayColumns.filter(c => c.fixed && displayColumns.indexOf(c) < displayColumns.indexOf(col)).length * 100}px` : 'auto',
                    zIndex: col.fixed ? 20 : 10
                  }}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className="cursor-pointer hover:text-blue-600 flex items-center space-x-1"
                      onClick={() => handleSort(col.key)}
                    >
                      <span>{col.label}</span>
                      {getSortConfig(col.key) && (
                        getSortConfig(col.key).direction === 'asc' ? 
                        <ArrowUp className="w-3 h-3" /> : 
                        <ArrowDown className="w-3 h-3" />
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
              <tr key={tank.tankId} className="hover:bg-gray-50">
                <td className="border border-gray-200 p-2 sticky left-0 bg-white z-20">
                  <input
                    type="checkbox"
                    checked={selectedTankIds.includes(tank.tankId)}
                    onChange={() => handleTankSelection(tank.tankId)}
                    className="rounded border-gray-300"
                  />
                </td>
                {displayColumns.map(col => (
                  <td
                    key={col.key}
                    className={`border border-gray-200 p-2 ${col.fixed ? 'sticky bg-blue-50 font-medium z-15' : ''}`}
                    style={{ 
                      left: col.fixed ? `${50 + displayColumns.filter(c => c.fixed && displayColumns.indexOf(c) < displayColumns.indexOf(col)).length * 100}px` : 'auto',
                      zIndex: col.fixed ? 15 : 1
                    }}
                  >
                    {(() => {
                      // 最高ボーメの場合（計算値）
                      if (col.key === 'MAX_BAUME_CALCULATED') {
                        return tank.metadata['MAX_BAUME_CALCULATED'] !== null ? tank.metadata['MAX_BAUME_CALCULATED'] : '-';
                      }
                      // 前半追い水量の場合
                      else if (col.key === 'EARLY_WATER_AMOUNT') {
                        return tank.metadata['EARLY_WATER_AMOUNT'] !== null ? tank.metadata['EARLY_WATER_AMOUNT'] : '-';
                      }
                      // 前半追い水歩合の場合
                      else if (col.key === 'EARLY_WATER_RATIO') {
                        return tank.metadata['EARLY_WATER_RATIO'] !== null ? tank.metadata['EARLY_WATER_RATIO'] : '-';
                      }
                      // 真のアルコール係数①の場合
                      else if (col.key === '真のアルコール係数（追い水反映）') {
                        return tank.metadata['真のアルコール係数（追い水反映）'] !== null ? tank.metadata['真のアルコール係数（追い水反映）'] : '-';
                      } 
                      // 真のアルコール係数②の場合
                      else if (col.key === '真のアルコール係数（追い水無視）') {
                        return tank.metadata['真のアルコール係数（追い水無視）'] !== null ? tank.metadata['真のアルコール係数（追い水無視）'] : '-';
                      } 
                      // 通常のメタデータ項目
                      else {
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
                    placeholder="最小値"
                    value={rangeFilters[activeFilter]?.min || ''}
                    onChange={(e) => handleRangeFilterChange(activeFilter, 'min', e.target.value)}
                    className="w-full px-2 py-1 text-xs border border-gray-300 rounded"
                  />
                  <input
                    type="number"
                    placeholder="最大値"
                    value={rangeFilters[activeFilter]?.max || ''}
                    onChange={(e) => handleRangeFilterChange(activeFilter, 'max', e.target.value)}
                    className="w-full px-2 py-1 text-xs border border-gray-300 rounded"
                  />
                </div>
              </div>
            )}
            
            <input
              type="text"
              placeholder="検索..."
              value={filterSearch}
              onChange={(e) => setFilterSearch(e.target.value)}
              className="w-full px-2 py-1 text-xs border border-gray-300 rounded mb-2"
            />
          </div>
          
          <div className="space-y-1 max-h-40 overflow-auto">
            <button
              onClick={() => {
                const allValues = getColumnValues(activeFilter);
                const currentFilter = filters[activeFilter] || new Set();
                const allSelected = allValues.every(value => currentFilter.has(value));
                
                if (allSelected) {
                  clearFilter(activeFilter);
                } else {
                  setFilters(prev => ({
                    ...prev,
                    [activeFilter]: new Set(allValues)
                  }));
                }
              }}
              className="w-full text-left px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
            >
              {getColumnValues(activeFilter).every(value => filters[activeFilter]?.has(value)) ? 
                'すべて解除' : 'すべて選択'}
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