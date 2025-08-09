import React, { useState, useMemo } from 'react';
import { ChevronUp, ChevronDown } from 'lucide-react';
import { COLUMN_NAMES } from '../utils/csvParser';

const OisuiAnalysis = ({ tanks = [], selectedTankIds = [] }) => {
  // 品温分析からコピーした状態管理
  const [baumeSortConfig, setBaumeSortConfig] = useState([]);
  const [isCollapsed, setIsCollapsed] = useState(false);

  // 選択されたタンクのデータを取得
  const selectedTanks = useMemo(() => {
    return Array.isArray(tanks) ? tanks.filter(tank => 
      Array.isArray(selectedTankIds) && selectedTankIds.includes(tank.tankId)
    ) : [];
  }, [tanks, selectedTankIds]);

  // フォーマット関数
  const formatNumber = (value, decimals = 1) => {
    if (value === null || value === undefined || isNaN(value)) return '-';
    return Number(value).toFixed(decimals);
  };

  // 品温クラス取得（色分け用）
  const getTempClass = (temp) => {
    if (temp === null || temp === undefined) return '';
    if (temp >= 12) return 'bg-red-100 text-red-800';
    if (temp >= 10) return 'bg-yellow-100 text-yellow-800';
    if (temp >= 8) return 'bg-green-100 text-green-800';
    return 'bg-blue-100 text-blue-800';
  };

  // 上下記号表示
  const getUpDownSymbol = (upDown) => {
    if (!upDown) return '-';
    if (upDown === '上') return '↑';
    if (upDown === '下') return '↓';
    return upDown;
  };

  // 分析データ作成（品温分析から完全コピー）
  const analysisData = useMemo(() => {
    const results = [];

    selectedTanks.forEach(tank => {
      const totalVolume = parseFloat(tank.metadata[COLUMN_NAMES.META.TOTAL_VOLUME]) || 3000;
      const tankId = parseInt(tank.tankId);
      const seq = tank.metadata[COLUMN_NAMES.META.TANK_NUMBER];
      const batchSize = tank.metadata[COLUMN_NAMES.META.BATCH_SIZE];

      Object.entries(tank.dailyData).forEach(([day, dayData]) => {
        const dayNum = parseInt(day);
        let cumulativeWater = 0;

        Object.entries(tank.dailyData).forEach(([d, data]) => {
          const dNum = parseInt(d);
          if (dNum <= dayNum) {
            const waterAmount = parseFloat(data[COLUMN_NAMES.DAILY.WATER]) || 0;
            if (waterAmount > 0) {
              cumulativeWater += waterAmount;
            }
          }
        });

        const dilutionFactor = cumulativeWater > 0 ? (totalVolume + cumulativeWater) / totalVolume : 1;

        const basicData = {
          tankId,
          seq,
          day: dayNum,
          moromiDays: dayNum,
          batchSize,
          temp1: parseFloat(dayData[COLUMN_NAMES.DAILY.TEMP_1]) || null,
          tempChange: parseFloat(dayData[COLUMN_NAMES.DAILY.TEMP_CHANGE]) || null,
          tempUpDown: dayData[COLUMN_NAMES.DAILY.TEMP_UP_DOWN] || null,
          addedWater: parseFloat(dayData[COLUMN_NAMES.DAILY.WATER]) || 0,
          cumulativeWater
        };

        let baumeWithoutWater = null;
        let alcoholWithoutWater = null;
        let bmdWithoutWater = null;

        const baumeEstimated = parseFloat(dayData[COLUMN_NAMES.DAILY.BAUME_ESTIMATED]);
        const alcoholEstimated = parseFloat(dayData[COLUMN_NAMES.DAILY.ALCOHOL_ESTIMATED]);
        
        const baumeEstimatedValue = !isNaN(baumeEstimated) ? baumeEstimated : null;
        const alcoholEstimatedValue = !isNaN(alcoholEstimated) ? alcoholEstimated : null;

        if (cumulativeWater > 0 && dilutionFactor > 1) {
          if (baumeEstimated !== null && baumeEstimated !== undefined && !isNaN(baumeEstimated)) {
            const calculated = baumeEstimated * dilutionFactor;
            if (isFinite(calculated) && Math.abs(calculated) < 1000) {
              baumeWithoutWater = calculated;
              bmdWithoutWater = calculated * dayNum;
            }
          }

          if (alcoholEstimated !== null && alcoholEstimated !== undefined && !isNaN(alcoholEstimated)) {
            const calculated = alcoholEstimated * dilutionFactor;
            if (isFinite(calculated) && Math.abs(calculated) < 1000) {
              alcoholWithoutWater = calculated;
            }
          }
        }

        results.push({
          ...basicData,
          baumeWithoutWater,
          alcoholWithoutWater,
          alcoholEstimated: alcoholEstimatedValue,
          baumeEstimated: baumeEstimatedValue,
          bmdWithoutWater,
          cumulativeWater,
          dilutionFactor
        });
      });
    });

    results.sort((a, b) => {
      if (a.tankId === b.tankId) {
        return a.day - b.day;
      }
      return a.tankId - b.tankId;
    });

    results.forEach((current, index) => {
      const next = results.find(r => 
        r.tankId === current.tankId && r.day === current.day + 1
      );

      if (next && 
          current.baumeWithoutWater !== null && next.baumeWithoutWater !== null &&
          isFinite(current.baumeWithoutWater) && isFinite(next.baumeWithoutWater)) {
        const change = next.baumeWithoutWater - current.baumeWithoutWater;
        if (isFinite(change) && Math.abs(change) < 1000) {
          current.baumeChange = change;
        } else {
          current.baumeChange = null;
        }
      } else {
        current.baumeChange = null;
      }

      if (next && 
          current.alcoholWithoutWater !== null && next.alcoholWithoutWater !== null &&
          isFinite(current.alcoholWithoutWater) && isFinite(next.alcoholWithoutWater)) {
        const change = next.alcoholWithoutWater - current.alcoholWithoutWater;
        if (isFinite(change) && Math.abs(change) < 1000) {
          current.alcoholChange = change;
        } else {
          current.alcoholChange = null;
        }
      } else {
        current.alcoholChange = null;
      }

      if (next && 
          current.bmdWithoutWater !== null && next.bmdWithoutWater !== null &&
          isFinite(current.bmdWithoutWater) && isFinite(next.bmdWithoutWater)) {
        const change = next.bmdWithoutWater - current.bmdWithoutWater;
        if (isFinite(change) && Math.abs(change) < 10000) {
          current.bmdChange = change;
        } else {
          current.bmdChange = null;
        }
      } else {
        current.bmdChange = null;
      }
    });

    return results;
  }, [selectedTanks]);

  // ボーメ計測期間の集計データを作成（アルコールが計測される前）- 品温分析から完全コピー
  const baumeOnlyData = useMemo(() => {
    const baumeOnlyItems = analysisData.filter(data => 
      data.baumeWithoutWater !== null && 
      (data.alcoholWithoutWater === null || data.alcoholEstimated === null)
    );

    if (baumeSortConfig.length === 0) {
      return baumeOnlyItems;
    }

    baumeOnlyItems.sort((a, b) => {
      for (const sortConfig of baumeSortConfig) {
        const { field, order } = sortConfig;
        let aValue = 0;
        let bValue = 0;

        switch(field) {
          case 'seq':
            aValue = a.seq ? Number(a.seq) : 0;
            bValue = b.seq ? Number(b.seq) : 0;
            break;
          case 'day':
            aValue = a.day ? Number(a.day) : 0;
            bValue = b.day ? Number(b.day) : 0;
            break;
          case 'moromiDays':
            aValue = a.moromiDays ? Number(a.moromiDays) : 0;
            bValue = b.moromiDays ? Number(b.moromiDays) : 0;
            break;
          case 'batchSize':
            aValue = a.batchSize ? Number(a.batchSize) : 0;
            bValue = b.batchSize ? Number(b.batchSize) : 0;
            break;
          case 'temp1':
            aValue = (a.temp1 !== null && a.temp1 !== undefined) ? Number(a.temp1) : -999;
            bValue = (b.temp1 !== null && b.temp1 !== undefined) ? Number(b.temp1) : -999;
            break;
          case 'tempChange':
            aValue = (a.tempChange !== null && a.tempChange !== undefined) ? Number(a.tempChange) : -999;
            bValue = (b.tempChange !== null && b.tempChange !== undefined) ? Number(b.tempChange) : -999;
            break;
          case 'baumeWithoutWater':
            aValue = (a.baumeWithoutWater !== null && a.baumeWithoutWater !== undefined) ? Number(a.baumeWithoutWater) : -999;
            bValue = (b.baumeWithoutWater !== null && b.baumeWithoutWater !== undefined) ? Number(b.baumeWithoutWater) : -999;
            break;
          case 'baumeChange':
            aValue = (a.baumeChange !== null && a.baumeChange !== undefined) ? Number(a.baumeChange) : -999;
            bValue = (b.baumeChange !== null && b.baumeChange !== undefined) ? Number(b.baumeChange) : -999;
            break;
          case 'addedWater':
            aValue = a.addedWater ? Number(a.addedWater) : 0;
            bValue = b.addedWater ? Number(b.addedWater) : 0;
            break;
          default:
            aValue = 0;
            bValue = 0;
        }

        const result = order === 'asc' ? aValue - bValue : bValue - aValue;
        if (result !== 0) return result;
      }
      return 0;
    });

    return baumeOnlyItems;
  }, [analysisData, baumeSortConfig]);

  // ソート処理
  const handleBaumeSort = (field) => {
    setBaumeSortConfig(currentConfig => {
      const existingIndex = currentConfig.findIndex(config => config.field === field);
      
      if (existingIndex >= 0) {
        const existing = currentConfig[existingIndex];
        const newConfig = [...currentConfig];
        
        if (existing.order === 'asc') {
          newConfig[existingIndex] = { ...existing, order: 'desc' };
        } else {
          newConfig.splice(existingIndex, 1);
        }
        
        return newConfig;
      } else {
        return [...currentConfig, { field, order: 'asc' }];
      }
    });
  };

  const resetBaumeSort = () => {
    setBaumeSortConfig([]);
  };

  const getSortIcon = (field) => {
    const config = baumeSortConfig.find(c => c.field === field);
    if (!config) return '';
    
    const sortIndex = baumeSortConfig.findIndex(c => c.field === field);
    const priority = baumeSortConfig.length > 1 ? (sortIndex + 1) : '';
    const arrow = config.order === 'asc' ? '↑' : '↓';
    
    return (
      <span className="text-blue-600 ml-1">
        {arrow}{priority && <sub className="text-xs">{priority}</sub>}
      </span>
    );
  };

  if (selectedTankIds.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
        <h2 className="text-xl font-bold mb-4">追い水分析</h2>
        <p className="text-gray-500">分析するタンクを選択してください。</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
      <h2 className="text-xl font-bold mb-4">
        追い水分析 - 選択タンク: {selectedTankIds.join(', ')}
      </h2>

      {/* ボーメ計測期間集計セクション（折りたたみ可能） */}
      {baumeOnlyData.length > 0 && (
        <div className="mb-8 p-4 bg-white rounded-lg border border-gray-300">
          <div className="mb-4 flex items-center justify-between">
            <button
              onClick={() => setIsCollapsed(!isCollapsed)}
              className="flex items-center text-lg font-semibold text-gray-800 hover:text-gray-600 transition-colors"
            >
              🌾 ボーメ計測期間集計（アルコール計測前）
              {isCollapsed ? <ChevronDown className="ml-2 h-5 w-5" /> : <ChevronUp className="ml-2 h-5 w-5" />}
            </button>
            {!isCollapsed && (
              <button
                onClick={resetBaumeSort}
                className="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded border transition-colors"
              >
                ソートリセット
              </button>
            )}
          </div>
          
          {!isCollapsed && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse border border-gray-300" style={{minWidth: '1100px'}}>
                <thead className="bg-gray-100">
                  <tr>
                    <th 
                      className="border border-gray-300 p-2 cursor-pointer hover:bg-gray-200 select-none"
                      onClick={() => handleBaumeSort('seq')}
                    >
                      順号{getSortIcon('seq')}
                    </th>
                    <th 
                      className="border border-gray-300 p-2 cursor-pointer hover:bg-gray-200 select-none"  
                      onClick={() => handleBaumeSort('day')}
                    >
                      日数{getSortIcon('day')}
                    </th>
                    <th 
                      className="border border-gray-300 p-2 cursor-pointer hover:bg-gray-200 select-none"
                      onClick={() => handleBaumeSort('moromiDays')}
                    >
                      醪日数{getSortIcon('moromiDays')}
                    </th>
                    <th 
                      className="border border-gray-300 p-2 cursor-pointer hover:bg-gray-200 select-none"
                      onClick={() => handleBaumeSort('batchSize')}
                    >
                      仕込み規模{getSortIcon('batchSize')}
                    </th>
                    <th 
                      className="border border-gray-300 p-2 cursor-pointer hover:bg-gray-200 select-none"
                      onClick={() => handleBaumeSort('temp1')}
                    >
                      品温1回目{getSortIcon('temp1')}
                    </th>
                    <th 
                      className="border border-gray-300 p-2 cursor-pointer hover:bg-gray-200 select-none"
                      onClick={() => handleBaumeSort('tempChange')}
                    >
                      1日の品温変動{getSortIcon('tempChange')}
                    </th>
                    <th className="border border-gray-300 p-2">品温上下</th>
                    <th 
                      className="border border-gray-300 p-2 bg-yellow-50 cursor-pointer hover:bg-yellow-100 select-none"
                      onClick={() => handleBaumeSort('baumeWithoutWater')}
                    >
                      ボーメ(追い水無視){getSortIcon('baumeWithoutWater')}
                    </th>
                    <th 
                      className="border border-gray-300 p-2 bg-yellow-50 cursor-pointer hover:bg-yellow-100 select-none"
                      onClick={() => handleBaumeSort('baumeChange')}
                    >
                      ボーメ変動{getSortIcon('baumeChange')}
                    </th>
                    <th 
                      className="border border-gray-300 p-2 cursor-pointer hover:bg-gray-200 select-none"
                      onClick={() => handleBaumeSort('addedWater')}
                    >
                      追水{getSortIcon('addedWater')}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {baumeOnlyData.map((data, index) => (
                    <tr key={`baume-${data.tankId}-${data.day}`} className="hover:bg-gray-50">
                      <td className="border border-gray-300 p-2 text-center font-semibold">
                        {data.seq}
                      </td>
                      <td className="border border-gray-300 p-2 text-center">
                        {data.day}
                      </td>
                      <td className="border border-gray-300 p-2 text-center">
                        {data.moromiDays}
                      </td>
                      <td className="border border-gray-300 p-2 text-center">
                        {data.batchSize || '-'}
                      </td>
                      <td className={`border border-gray-300 p-2 text-center ${getTempClass(data.temp1)}`}>
                        {formatNumber(data.temp1, 1)}
                      </td>
                      <td className="border border-gray-300 p-2 text-center">
                        {formatNumber(data.tempChange, 1)}
                      </td>
                      <td className="border border-gray-300 p-2 text-center">
                        {getUpDownSymbol(data.tempUpDown)}
                      </td>
                      <td className="border border-gray-300 p-2 text-center bg-yellow-50">
                        {formatNumber(data.baumeWithoutWater)}
                      </td>
                      <td className="border border-gray-300 p-2 text-center bg-yellow-50">
                        {formatNumber(data.baumeChange)}
                      </td>
                      <td className="border border-gray-300 p-2 text-center">
                        {formatNumber(data.addedWater)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ここに今後、追い水分析の追加機能を実装していきます */}
      <div className="mt-6 p-4 bg-gray-50 rounded-lg">
        <p className="text-gray-600 text-center">
          追い水分析の追加機能をここに実装予定
        </p>
      </div>
    </div>
  );
};

export default OisuiAnalysis;