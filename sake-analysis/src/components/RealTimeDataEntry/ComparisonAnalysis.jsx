import React, { useState, useMemo } from 'react';
import { GitCompare, Check, X, AlertCircle } from 'lucide-react';
import { COLUMN_NAMES } from '../../utils/csvParser';


const ComparisonAnalysis = ({ currentTank, allTanks, currentDay }) => {
  const [selectedTanks, setSelectedTanks] = useState([]);
  const [comparisonType, setComparisonType] = useState('concurrent'); // concurrent, completed, csv
  const [showDayFilter, setShowDayFilter] = useState(true);

  // 比較可能なタンクを取得
  const availableTanks = useMemo(() => {
    if (comparisonType === 'concurrent') {
      // 同時進行中のタンク（上槽済みでない）
      return allTanks.filter(tank => 
        tank.tankId !== currentTank.tankId && 
        tank.metadata?.status !== '上槽済み' &&
        tank.dailyData && Object.keys(tank.dailyData).length > 0
      );
    } else if (comparisonType === 'completed') {
      // 完了済みのタンク
      return allTanks.filter(tank => 
        tank.tankId !== currentTank.tankId && 
        tank.metadata?.status === '上槽済み'
      );
    } else {
      // CSVデータ（既存のタンクデータから）
      return allTanks.filter(tank => 
        tank.tankId !== currentTank.tankId &&
        tank.tankId.startsWith('tank_') // CSVから読み込まれたタンクのID形式
      );
    }
  }, [allTanks, currentTank, comparisonType]);

  // タンク選択の切り替え
  const toggleTankSelection = (tankId) => {
    setSelectedTanks(prev => {
      if (prev.includes(tankId)) {
        return prev.filter(id => id !== tankId);
      } else if (prev.length < 5) { // 最大5タンクまで
        return [...prev, tankId];
      }
      return prev;
    });
  };

  // 比較データの準備
  const comparisonData = useMemo(() => {
    const data = [];
    const targetTanks = [currentTank, ...selectedTanks.map(id => allTanks.find(t => t.tankId === id))].filter(Boolean);
    
    // 比較する日数の範囲を決定
    const startDay = showDayFilter ? Math.max(1, currentDay - 3) : 1;
    const endDay = showDayFilter ? Math.min(currentDay + 3, 30) : 30;
    
    for (let day = startDay; day <= endDay; day++) {
      const dayData = {
        day,
        tanks: {}
      };
      
      targetTanks.forEach(tank => {
        const dailyData = tank.dailyData?.[day];
        if (dailyData) {
          dayData.tanks[tank.tankId] = {
            tankNumber: tank.metadata?.[COLUMN_NAMES.META.TANK_NUMBER] || tank.tankId,
            baume: parseFloat(dailyData[COLUMN_NAMES.DAILY.BAUME_AFTER_WATER]),
            alcohol: parseFloat(dailyData[COLUMN_NAMES.DAILY.ALCOHOL_AFTER_WATER]),
            bmd: parseFloat(dailyData[COLUMN_NAMES.DAILY.BMD_COMPLEMENT]),
            temperature: parseFloat(dailyData[COLUMN_NAMES.DAILY.TEMP_MORNING]),
            water: parseFloat(dailyData[COLUMN_NAMES.DAILY.OISUI]) || 0
          };
        }
      });
      
      // 少なくとも2つ以上のタンクのデータがある日のみ含める
      if (Object.keys(dayData.tanks).length >= 2) {
        data.push(dayData);
      }
    }
    
    return data;
  }, [currentTank, selectedTanks, allTanks, currentDay, showDayFilter]);

  // 統計情報の計算
  const statistics = useMemo(() => {
    if (comparisonData.length === 0) return null;
    
    const stats = {
      avgBaume: {},
      avgAlcohol: {},
      avgBMD: {},
      avgTemp: {}
    };
    
    const targetTanks = [currentTank, ...selectedTanks.map(id => allTanks.find(t => t.tankId === id))].filter(Boolean);
    
    targetTanks.forEach(tank => {
      let baumeSum = 0, alcoholSum = 0, bmdSum = 0, tempSum = 0;
      let baumeCount = 0, alcoholCount = 0, bmdCount = 0, tempCount = 0;
      
      comparisonData.forEach(dayData => {
        const tankData = dayData.tanks[tank.tankId];
        if (tankData) {
          if (!isNaN(tankData.baume)) {
            baumeSum += tankData.baume;
            baumeCount++;
          }
          if (!isNaN(tankData.alcohol)) {
            alcoholSum += tankData.alcohol;
            alcoholCount++;
          }
          if (!isNaN(tankData.bmd)) {
            bmdSum += tankData.bmd;
            bmdCount++;
          }
          if (!isNaN(tankData.temperature)) {
            tempSum += tankData.temperature;
            tempCount++;
          }
        }
      });
      
      stats.avgBaume[tank.tankId] = baumeCount > 0 ? baumeSum / baumeCount : null;
      stats.avgAlcohol[tank.tankId] = alcoholCount > 0 ? alcoholSum / alcoholCount : null;
      stats.avgBMD[tank.tankId] = bmdCount > 0 ? bmdSum / bmdCount : null;
      stats.avgTemp[tank.tankId] = tempCount > 0 ? tempSum / tempCount : null;
    });
    
    return stats;
  }, [comparisonData, currentTank, selectedTanks, allTanks]);

  return (
    <div className="space-y-4">
      {/* 比較タイプ選択 */}
      <div className="flex items-center space-x-4">
        <label className="text-sm font-medium text-gray-700">比較対象:</label>
        <div className="flex space-x-2">
          <button
            onClick={() => setComparisonType('concurrent')}
            className={`px-3 py-1 rounded text-sm ${
              comparisonType === 'concurrent' 
                ? 'bg-blue-600 text-white' 
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            進行中タンク
          </button>
          <button
            onClick={() => setComparisonType('completed')}
            className={`px-3 py-1 rounded text-sm ${
              comparisonType === 'completed' 
                ? 'bg-blue-600 text-white' 
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            完了醪
          </button>
          <button
            onClick={() => setComparisonType('csv')}
            className={`px-3 py-1 rounded text-sm ${
              comparisonType === 'csv' 
                ? 'bg-blue-600 text-white' 
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            CSVデータ
          </button>
        </div>
      </div>

      {/* タンク選択 */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-sm font-medium text-gray-700">
            比較タンク選択（最大5つ）:
          </label>
          <label className="flex items-center text-sm">
            <input
              type="checkbox"
              checked={showDayFilter}
              onChange={(e) => setShowDayFilter(e.target.checked)}
              className="mr-2"
            />
            現在日数付近のみ表示
          </label>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
          {availableTanks.map(tank => (
            <label
              key={tank.tankId}
              className={`flex items-center p-2 rounded border cursor-pointer transition-colors ${
                selectedTanks.includes(tank.tankId)
                  ? 'bg-blue-50 border-blue-500'
                  : 'bg-white border-gray-300 hover:bg-gray-50'
              }`}
            >
              <input
                type="checkbox"
                checked={selectedTanks.includes(tank.tankId)}
                onChange={() => toggleTankSelection(tank.tankId)}
                className="mr-2"
              />
              <span className="text-sm">
                タンク{tank.metadata?.[COLUMN_NAMES.META.TANK_NUMBER] || tank.tankId}
                {tank.metadata?.[COLUMN_NAMES.META.YEAST] && (
                  <span className="text-xs text-gray-500 ml-1">
                    ({tank.metadata[COLUMN_NAMES.META.YEAST]})
                  </span>
                )}
              </span>
            </label>
          ))}
        </div>
        {availableTanks.length === 0 && (
          <p className="text-sm text-gray-500 mt-2">
            比較可能なタンクがありません。
          </p>
        )}
      </div>

      {/* 比較テーブル */}
      {selectedTanks.length > 0 && comparisonData.length > 0 && (
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-100">
              <tr>
                <th className="px-3 py-2 text-left font-medium text-gray-700">日数</th>
                <th className="px-3 py-2 text-center font-medium text-gray-700 bg-blue-50">
                  タンク{currentTank.metadata?.[COLUMN_NAMES.META.TANK_NUMBER]}
                  <br/>
                  <span className="text-xs font-normal">（現在）</span>
                </th>
                {selectedTanks.map(tankId => {
                  const tank = allTanks.find(t => t.tankId === tankId);
                  return (
                    <th key={tankId} className="px-3 py-2 text-center font-medium text-gray-700">
                      タンク{tank?.metadata?.[COLUMN_NAMES.META.TANK_NUMBER]}
                      <br/>
                      <span className="text-xs font-normal">
                        {tank?.metadata?.[COLUMN_NAMES.META.YEAST]}
                      </span>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {comparisonData.map(dayData => (
                <tr key={dayData.day} className={dayData.day === currentDay ? 'bg-yellow-50' : ''}>
                  <td className="px-3 py-2 font-medium">
                    {dayData.day}日
                    {dayData.day === currentDay && (
                      <span className="ml-1 text-xs text-yellow-600">（現在）</span>
                    )}
                  </td>
                  
                  {/* 現在のタンク */}
                  <td className="px-3 py-2 text-center bg-blue-50">
                    {dayData.tanks[currentTank.tankId] ? (
                      <div className="space-y-1 text-xs">
                        <div>Be: {dayData.tanks[currentTank.tankId].baume?.toFixed(2) || '-'}</div>
                        <div>Al: {dayData.tanks[currentTank.tankId].alcohol?.toFixed(1) || '-'}%</div>
                        <div>BMD: {dayData.tanks[currentTank.tankId].bmd?.toFixed(1) || '-'}</div>
                      </div>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </td>
                  
                  {/* 比較タンク */}
                  {selectedTanks.map(tankId => (
                    <td key={tankId} className="px-3 py-2 text-center">
                      {dayData.tanks[tankId] ? (
                        <div className="space-y-1 text-xs">
                          <div className={getDifferenceColor(
                            dayData.tanks[currentTank.tankId]?.baume,
                            dayData.tanks[tankId]?.baume,
                            'baume'
                          )}>
                            Be: {dayData.tanks[tankId].baume?.toFixed(2) || '-'}
                          </div>
                          <div className={getDifferenceColor(
                            dayData.tanks[currentTank.tankId]?.alcohol,
                            dayData.tanks[tankId]?.alcohol,
                            'alcohol'
                          )}>
                            Al: {dayData.tanks[tankId].alcohol?.toFixed(1) || '-'}%
                          </div>
                          <div className={getDifferenceColor(
                            dayData.tanks[currentTank.tankId]?.bmd,
                            dayData.tanks[tankId]?.bmd,
                            'bmd'
                          )}>
                            BMD: {dayData.tanks[tankId].bmd?.toFixed(1) || '-'}
                          </div>
                        </div>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* 統計サマリー */}
      {statistics && selectedTanks.length > 0 && (
        <div className="bg-gray-50 rounded-lg p-4">
          <h4 className="font-medium text-gray-900 mb-3">統計サマリー（表示期間平均）</h4>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left">
                  <th className="pr-4 font-medium text-gray-700">項目</th>
                  <th className="px-4 text-center font-medium text-gray-700 text-blue-600">
                    現在タンク
                  </th>
                  {selectedTanks.map(tankId => {
                    const tank = allTanks.find(t => t.tankId === tankId);
                    return (
                      <th key={tankId} className="px-4 text-center font-medium text-gray-700">
                        タンク{tank?.metadata?.[COLUMN_NAMES.META.TANK_NUMBER]}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                <tr>
                  <td className="pr-4 py-2">平均ボーメ</td>
                  <td className="px-4 py-2 text-center font-medium">
                    {statistics.avgBaume[currentTank.tankId]?.toFixed(2) || '-'}
                  </td>
                  {selectedTanks.map(tankId => (
                    <td key={tankId} className="px-4 py-2 text-center">
                      {statistics.avgBaume[tankId]?.toFixed(2) || '-'}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="pr-4 py-2">平均アルコール</td>
                  <td className="px-4 py-2 text-center font-medium">
                    {statistics.avgAlcohol[currentTank.tankId]?.toFixed(1) || '-'}%
                  </td>
                  {selectedTanks.map(tankId => (
                    <td key={tankId} className="px-4 py-2 text-center">
                      {statistics.avgAlcohol[tankId]?.toFixed(1) || '-'}%
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="pr-4 py-2">平均BMD</td>
                  <td className="px-4 py-2 text-center font-medium">
                    {statistics.avgBMD[currentTank.tankId]?.toFixed(1) || '-'}
                  </td>
                  {selectedTanks.map(tankId => (
                    <td key={tankId} className="px-4 py-2 text-center">
                      {statistics.avgBMD[tankId]?.toFixed(1) || '-'}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="pr-4 py-2">平均品温</td>
                  <td className="px-4 py-2 text-center font-medium">
                    {statistics.avgTemp[currentTank.tankId]?.toFixed(1) || '-'}℃
                  </td>
                  {selectedTanks.map(tankId => (
                    <td key={tankId} className="px-4 py-2 text-center">
                      {statistics.avgTemp[tankId]?.toFixed(1) || '-'}℃
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 使用方法 */}
      {selectedTanks.length === 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-start space-x-2">
            <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-blue-800">
              <p className="font-medium">比較タンクを選択してください</p>
              <p className="mt-1">
                最大5つまでのタンクを選択して、同じ日数での発酵データを比較できます。
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// 差分による色分けヘルパー関数
const getDifferenceColor = (currentValue, compareValue, type) => {
  if (!currentValue || !compareValue) return '';
  
  const diff = compareValue - currentValue;
  const threshold = type === 'baume' ? 0.5 : type === 'alcohol' ? 1 : 2;
  
  if (Math.abs(diff) < threshold) return '';
  
  if (type === 'baume') {
    // ボーメは低い方が進んでいる
    return diff > 0 ? 'text-red-600' : 'text-blue-600';
  } else {
    // アルコールとBMDは高い方が進んでいる
    return diff > 0 ? 'text-blue-600' : 'text-red-600';
  }
};

export default ComparisonAnalysis;