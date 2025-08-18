import React, { useState, useEffect, useRef } from 'react';
import { ArrowUp, ArrowDown, ChevronDown, Database } from 'lucide-react';
import { COLUMN_NAMES } from '../utils/csvParser';

// アルコール分を比重に換算する関数（JIS B 7548:2009に基づく正確な変換表）
const alcoholToSpecificGravity = (alcoholDegree) => {
  // アルコール度数と比重(15℃/15℃)の対応表
  const alcoholTable = [
    [0, 1.00000], [1, 0.99848], [2, 0.99701], [3, 0.99558], [4, 0.99419],
    [5, 0.99284], [6, 0.99153], [7, 0.99025], [8, 0.98901], [9, 0.98780],
    [10, 0.98662], [11, 0.98547], [12, 0.98435], [13, 0.98324], [14, 0.98217],
    [15, 0.98112], [16, 0.98008], [17, 0.97906], [18, 0.97805], [19, 0.97704],
    [20, 0.97605], [21, 0.97505], [22, 0.97405], [23, 0.97304], [24, 0.97201],
    [25, 0.97098], [26, 0.96994], [27, 0.96887], [28, 0.96778], [29, 0.96666],
    [30, 0.96552], [31, 0.96434], [32, 0.96313], [33, 0.96189], [34, 0.96060],
    [35, 0.95928], [36, 0.95792], [37, 0.95652], [38, 0.95508], [39, 0.95359],
    [40, 0.95207], [41, 0.95050], [42, 0.94888], [43, 0.94723], [44, 0.94554],
    [45, 0.94381], [46, 0.94205], [47, 0.94024], [48, 0.93839], [49, 0.93651],
    [50, 0.93459]
  ];
  
  // 範囲外の場合
  if (alcoholDegree < 0) return 1.00000;
  if (alcoholDegree > 50) return 0.93459;
  
  // 整数の場合は直接参照
  const intDegree = Math.floor(alcoholDegree);
  if (alcoholDegree === intDegree && intDegree <= 50) {
    return alcoholTable[intDegree][1];
  }
  
  // 小数点がある場合は線形補間
  if (intDegree >= 50) return 0.93459;
  
  const lowerValue = alcoholTable[intDegree][1];
  const upperValue = alcoholTable[intDegree + 1][1];
  const fraction = alcoholDegree - intDegree;
  
  return lowerValue + (upperValue - lowerValue) * fraction;
};

// エキス分計算関数
const calculateExtractContent = (finalBaume, finalAlcohol) => {
  if (isNaN(finalBaume) || isNaN(finalAlcohol)) {
    return null;
  }
  
  // ボーメから日本酒度への変換: 日本酒度 = -10 × ボーメ度
  const nihonshuDo = -10 * finalBaume;
  
  // 比重計算: S = 1443 / (1443 + 日本酒度)
  const S = 1443 / (1443 + nihonshuDo);
  
  // アルコール分を比重に換算
  const A = alcoholToSpecificGravity(finalAlcohol);
  
  // エキス分計算式: エキス分 = (S - A) × 260 + 0.21
  const extractContent = (S - A) * 260 + 0.21;
  
  return parseFloat(extractContent.toFixed(2));
};

// 原エキス分計算関数
const calculateOriginalExtractContent = (extractContent, finalAlcohol) => {
  if (extractContent === null || isNaN(finalAlcohol)) {
    return null;
  }
  
  // 原エキス分 = エキス分 + アルコール度数 × 1.5894
  const originalExtractContent = extractContent + (finalAlcohol * 1.5894);
  
  return parseFloat(originalExtractContent.toFixed(2));
};

// 前半追い水量計算
const calculateEarlyWaterAmount = (tank) => {
  if (!tank.dailyData) return null;
  
  const dailyEntries = Object.entries(tank.dailyData);
  if (dailyEntries.length === 0) return null;
  
  let earlyWaterAmount = 0;
  
  dailyEntries.forEach(([day, data]) => {
    const dayNum = parseInt(day);
    const addedWater = parseFloat(data[COLUMN_NAMES.DAILY.WATER]) || 0;
    
    if (dayNum <= 15) {
      earlyWaterAmount += addedWater;
    }
  });
  
  return earlyWaterAmount;
};

// 前半追い水割合計算
const calculateEarlyWaterRatio = (tank) => {
  const earlyWaterAmount = calculateEarlyWaterAmount(tank);
  const totalWaterAmount = parseFloat(tank.metadata?.[COLUMN_NAMES.META.TOTAL_WATER]) || 0;
  
  if (earlyWaterAmount === null || totalWaterAmount === 0) {
    return null;
  }
  
  return parseFloat((earlyWaterAmount / totalWaterAmount).toFixed(2));
};

// 真のアルコール係数計算
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
      'エキス分',
      '原エキス分',
    ]);
  });
  const [activeFilter, setActiveFilter] = useState(null);
  const [filterSearch, setFilterSearch] = useState('');
  const [filterPosition, setFilterPosition] = useState({ left: 0, top: 0 });
  const tableRef = useRef(null);

  // 元の順序を保持してエキス分・原エキス分を最後に追加
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
    { key: 'EARLY_WATER_RATIO', label: '前半追い水割合', fixed: false, isNumeric: true },
    { key: COLUMN_NAMES.META.LATE_WATER, label: '後半追い水量', fixed: false, isNumeric: true },
    { key: COLUMN_NAMES.META.LATE_WATER_RATIO, label: '後半追い水割合', fixed: false, isNumeric: true },
    // 最後にエキス分・原エキス分を追加
    { key: 'エキス分', label: 'エキス分', fixed: false, isNumeric: true },
    { key: '原エキス分', label: '原エキス分', fixed: false, isNumeric: true },
  ];

  const dailyMetrics = [
    '品温1回目',
    'ボーメ（追い水後)',
    'アルコール（追い水後)',
    'BMD（補完)',
    'アルコール係数（追い水反映）',
  ];

  // データ処理
  const processedTanks = tanks?.map(tank => {
    const trueCoefficients = calculateTrueCoefficientsFromMeta(tank);
    const earlyWaterAmount = calculateEarlyWaterAmount(tank);
    const earlyWaterRatio = calculateEarlyWaterRatio(tank);
    
    // エキス分・原エキス分の計算
    const finalBaume = parseFloat(tank.metadata?.[COLUMN_NAMES.META.FINAL_BAUME]);
    const finalAlcohol = parseFloat(tank.metadata?.[COLUMN_NAMES.META.FINAL_ALCOHOL]);
    const extractContent = calculateExtractContent(finalBaume, finalAlcohol);
    const originalExtractContent = calculateOriginalExtractContent(extractContent, finalAlcohol);
    
    return {
      ...tank,
      metadata: {
        ...tank.metadata,
        '真のアルコール係数（追い水反映）': trueCoefficients.withWater ? trueCoefficients.withWater.toFixed(3) : null,
        '真のアルコール係数（追い水無視）': trueCoefficients.withoutWater ? trueCoefficients.withoutWater.toFixed(3) : null,
        'EARLY_WATER_AMOUNT': earlyWaterAmount,
        'EARLY_WATER_RATIO': earlyWaterRatio,
        'エキス分': extractContent,
        '原エキス分': originalExtractContent,
      }
    };
  }) || [];

  // フィルタリング（元の実装を保持）
  const getFilteredTanks = () => {
    if (!tanks) return [];
    
    return processedTanks.filter(tank => {
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

  // ソート設定取得（元の実装を保持）
  const getSortConfig = (key) => {
    const index = sortConfigs.findIndex(config => config.key === key);
    return index >= 0 ? { ...sortConfigs[index], index } : null;
  };

  // ソート処理（元の実装を保持）
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

  // マルチソート（元の実装を保持）
  const multiSort = (data) => {
    if (sortConfigs.length === 0) return data;
    
    return [...data].sort((a, b) => {
      for (const { key, direction } of sortConfigs) {
        let aValue, bValue;
        
        try {
          aValue = a.metadata[key];
          bValue = b.metadata[key];
          
          // null/undefined の処理
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
        } catch (error) {
          console.error('Error in multiSort for key:', key, error);
          return 0;
        }
      }
      return 0;
    });
  };

  // フィルター関数（元の実装を保持）
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

  // フィルターメニューをボタンの真下、テーブル上に表示
  const openFilterMenu = (columnKey, event) => {
    event.stopPropagation();
    const buttonRect = event.currentTarget.getBoundingClientRect();
    
    setFilterPosition({
      left: buttonRect.left,
      top: buttonRect.bottom + 2
    });
    setActiveFilter(activeFilter === columnKey ? null : columnKey);
  };

  // タンク選択（元の実装を保持）
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

  // データ取得 - 選択済みタンクを上部に表示
  const filteredTanks = getFilteredTanks();
  const sortedTanks = multiSort(filteredTanks);
  
  // 選択済みタンクを上部に、未選択タンクを下部に配置
  const selectedTanks = sortedTanks.filter(tank => selectedTankIds.includes(tank.tankId));
  const unselectedTanks = sortedTanks.filter(tank => !selectedTankIds.includes(tank.tankId));
  const filteredAndSortedTanks = [...selectedTanks, ...unselectedTanks];

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
                      left: getFixedColumnLeft(index),
                      zIndex: 45
                    } : {
                      zIndex: 40
                    })
                  }}
                >
                  <div className="flex items-center justify-between">
                    <span 
                      className="flex items-center cursor-pointer"
                      onClick={() => handleSort(col.key)}
                    >
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
                      onClick={(e) => openFilterMenu(col.key, e)}
                      className="ml-1 p-1 hover:bg-gray-200 rounded"
                    >
                      <ChevronDown className="w-3 h-3" />
                    </button>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filteredAndSortedTanks.map((tank, index) => (
              <tr
                key={tank.tankId}
                className={`border-b ${selectedTankIds.includes(tank.tankId) ? 'bg-blue-100' : index % 2 === 0 ? 'bg-white' : 'bg-gray-50'} hover:bg-gray-100`}
              >
                <td 
                  className="border border-gray-200 p-2 text-center"
                  style={{ 
                    position: 'sticky',
                    left: 0,
                    zIndex: 9,
                    backgroundColor: selectedTankIds.includes(tank.tankId) ? '#dbeafe' : (index % 2 === 0 ? 'white' : '#f9fafb')
                  }}
                >
                  <input
                    type="checkbox"
                    checked={selectedTankIds.includes(tank.tankId)}
                    onChange={() => handleTankSelection(tank.tankId)}
                    className="rounded border-gray-400"
                  />
                </td>
                {displayColumns.map((col, colIndex) => (
                  <td
                    key={col.key}
                    className={`border border-gray-200 p-2 text-center ${col.fixed ? 'bg-blue-50' : ''}`}
                    style={col.fixed ? { 
                      position: 'sticky',
                      left: getFixedColumnLeft(colIndex),
                      zIndex: 9,
                      backgroundColor: col.fixed ? '#eff6ff' : 'inherit'
                    } : {}}
                  >
                    {tank.metadata[col.key] !== null && tank.metadata[col.key] !== undefined ? String(tank.metadata[col.key]) : '-'}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      {/* フィルターポップアップ - ボタンの真下、テーブル上に表示 */}
      {activeFilter && (
        <div
          className="fixed bg-white border border-gray-300 rounded-lg shadow-xl p-3"
          style={{
            left: filterPosition.left,
            top: filterPosition.top,
            width: '280px',
            maxHeight: '400px',
            zIndex: 1000,
            boxShadow: '0 8px 25px rgba(0,0,0,0.2)'
          }}
        >
          {columns.find(col => col.key === activeFilter)?.isNumeric ? (
            // 数値フィルター
            <div className="space-y-3">
              <div className="font-medium text-sm">範囲フィルター</div>
              <div className="flex space-x-2">
                <input
                  type="number"
                  placeholder="最小値"
                  value={rangeFilters[activeFilter]?.min || ''}
                  onChange={(e) => {
                    const min = e.target.value;
                    const max = rangeFilters[activeFilter]?.max || '';
                    setRangeFilters({
                      ...rangeFilters,
                      [activeFilter]: { min, max }
                    });
                  }}
                  className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                />
                <input
                  type="number"
                  placeholder="最大値"
                  value={rangeFilters[activeFilter]?.max || ''}
                  onChange={(e) => {
                    const max = e.target.value;
                    const min = rangeFilters[activeFilter]?.min || '';
                    setRangeFilters({
                      ...rangeFilters,
                      [activeFilter]: { min, max }
                    });
                  }}
                  className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                />
              </div>
              <button
                onClick={() => {
                  const { [activeFilter]: removed, ...rest } = rangeFilters;
                  setRangeFilters(rest);
                }}
                className="w-full px-2 py-1 bg-gray-500 text-white rounded text-sm hover:bg-gray-600"
              >
                フィルタークリア
              </button>
            </div>
          ) : (
            // テキストフィルター
            <div className="space-y-3">
              <div className="font-medium text-sm">値フィルター</div>
              <input
                type="text"
                placeholder="検索..."
                value={filterSearch}
                onChange={(e) => setFilterSearch(e.target.value)}
                className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
              />
              <div className="max-h-40 overflow-y-auto space-y-1">
                {getColumnValues(activeFilter)
                  .filter(value => 
                    filterSearch === '' || 
                    String(value).toLowerCase().includes(filterSearch.toLowerCase())
                  )
                  .map(value => (
                    <label key={value} className="flex items-center space-x-2 text-sm hover:bg-gray-100 px-1 py-1 rounded cursor-pointer">
                      <input
                        type="checkbox"
                        checked={filters[activeFilter]?.has(value) ?? false}
                        onChange={(e) => handleFilterChange(activeFilter, value, e.target.checked)}
                        className="rounded"
                      />
                      <span className="truncate">{value || '(空白)'}</span>
                    </label>
                  ))}
              </div>
              <div className="flex space-x-2 pt-2 border-t">
                <button
                  onClick={() => {
                    const { [activeFilter]: removed, ...restFilters } = filters;
                    setFilters(restFilters);
                  }}
                  className="flex-1 px-2 py-1 bg-gray-500 text-white rounded text-sm hover:bg-gray-600"
                >
                  クリア
                </button>
                <button
                  onClick={() => {
                    const allValues = new Set(getColumnValues(activeFilter));
                    const isAllSelected = filters[activeFilter]?.size === allValues.size;
                    setFilters({
                      ...filters,
                      [activeFilter]: isAllSelected ? new Set() : allValues
                    });
                  }}
                  className="flex-1 px-2 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
                >
                  {(() => {
                    const allValues = getColumnValues(activeFilter);
                    const currentFilter = filters[activeFilter];
                    return currentFilter?.size === allValues.length ? 'すべて解除' : 'すべて選択';
                  })()}
                </button>
              </div>
            </div>
          )}
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