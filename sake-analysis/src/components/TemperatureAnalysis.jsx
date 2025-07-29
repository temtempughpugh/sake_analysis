import React, { useMemo } from 'react';
import { COLUMN_NAMES } from '../utils/csvParser';

const TemperatureAnalysis = ({ tanks, selectedTankIds }) => {
  // 選択されたタンクのデータを取得
  const selectedTanks = tanks.filter(tank => selectedTankIds.includes(tank.tankId));

  // 品温分析データを計算
  const analysisData = useMemo(() => {
    const results = [];

    selectedTanks.forEach(tank => {
      const tankId = tank.tankId;
      const totalVolume = tank.metadata[COLUMN_NAMES.META.TOTAL_VOLUME] || 0;

      if (!tank.dailyData || totalVolume === 0) return;

      // 日次データを処理
      Object.entries(tank.dailyData).forEach(([dayKey, dayData]) => {
        const day = parseInt(dayData[COLUMN_NAMES.DAILY.DAY]);
        if (!day) return;

        // 基本データ（日次データから直接取得）
        const basicData = {
          tankId,
          day,
          temp1: (() => {
            const val = dayData[COLUMN_NAMES.DAILY.TEMP_1];
            return (val !== null && val !== undefined && val !== '') ? Number(val) : null;
          })(),
          tempChange: (() => {
            const val = dayData[COLUMN_NAMES.DAILY.TEMP_CHANGE];
            return (val !== null && val !== undefined && val !== '') ? Number(val) : null;
          })(),
          tempUpDown: dayData[COLUMN_NAMES.DAILY.TEMP_UP_DOWN] || null,
          addedWater: (() => {
            const val = dayData[COLUMN_NAMES.DAILY.WATER];
            if (val === null || val === undefined || val === '') return 0;
            const num = Number(val);
            return isNaN(num) ? 0 : num;
          })(),
        };

        // 分析日までの追い水積算を計算（分析日は含めない）
        let cumulativeWater = 0;
        Object.entries(tank.dailyData).forEach(([_, data]) => {
          const dataDay = parseInt(data[COLUMN_NAMES.DAILY.DAY]);
          if (dataDay && dataDay < day) {
            const water = data[COLUMN_NAMES.DAILY.WATER];
            if (water !== null && water !== undefined && water !== '') {
              const waterNum = Number(water);
              if (!isNaN(waterNum)) {
                cumulativeWater += waterNum;
              }
            }
          }
        });

        // 希釈補正計算（個数計算）
        const dilutionFactor = (totalVolume + cumulativeWater) / totalVolume;
        
        const baumeEstimated = dayData[COLUMN_NAMES.DAILY.BAUME_ESTIMATED];
        const alcoholEstimated = dayData[COLUMN_NAMES.DAILY.ALCOHOL_ESTIMATED];

        // データがある場合のみ計算し、異常値をチェック
        let baumeWithoutWater = null;
        let alcoholWithoutWater = null;
        let bmdWithoutWater = null;

        if (baumeEstimated !== null && baumeEstimated !== undefined && !isNaN(baumeEstimated)) {
          const calculated = baumeEstimated * dilutionFactor;
          if (isFinite(calculated) && Math.abs(calculated) < 1000) { // 異常値チェック
            baumeWithoutWater = calculated;
            bmdWithoutWater = calculated * day;
          }
        }

        if (alcoholEstimated !== null && alcoholEstimated !== undefined && !isNaN(alcoholEstimated)) {
          const calculated = alcoholEstimated * dilutionFactor;
          if (isFinite(calculated) && Math.abs(calculated) < 1000) { // 異常値チェック
            alcoholWithoutWater = calculated;
          }
        }

        results.push({
          ...basicData,
          baumeWithoutWater,
          alcoholWithoutWater,
          bmdWithoutWater,
          cumulativeWater,
          dilutionFactor
        });
      });
    });

    // 日数順にソート
    results.sort((a, b) => {
      if (a.tankId === b.tankId) {
        return a.day - b.day;
      }
      return a.tankId - b.tankId;
    });

    // 変動値を計算（翌日 - 当日）- データがある場合のみ
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

  // タンクごとにグループ化
  const dataByTank = useMemo(() => {
    const grouped = {};
    analysisData.forEach(data => {
      if (!grouped[data.tankId]) {
        grouped[data.tankId] = [];
      }
      grouped[data.tankId].push(data);
    });
    return grouped;
  }, [analysisData]);

  const formatNumber = (value, decimals = 2) => {
    if (value === null || value === undefined || isNaN(value)) return '-';
    const num = Number(value);
    if (!isFinite(num)) return '-';
    return num.toFixed(decimals);
  };

  if (selectedTankIds.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
        <h2 className="text-xl font-bold mb-4">品温分析</h2>
        <p className="text-gray-500">分析するタンクを選択してください。</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
      <h2 className="text-xl font-bold mb-4">
        品温分析 - 選択タンク: {selectedTankIds.join(', ')}
      </h2>

      {Object.entries(dataByTank).map(([tankId, tankData]) => (
        <div key={tankId} className="mb-8">
          <h3 className="text-lg font-semibold mb-3 text-blue-600">
            タンク順号: {tankId}
          </h3>
          
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse border border-gray-300">
              <thead className="bg-gray-100">
                <tr>
                  <th className="border border-gray-300 p-2">日数</th>
                  <th className="border border-gray-300 p-2">品温1回目</th>
                  <th className="border border-gray-300 p-2">1日の品温変動</th>
                  <th className="border border-gray-300 p-2">品温上下</th>
                  <th className="border border-gray-300 p-2 bg-yellow-50">ボーメ(追い水無視)</th>
                  <th className="border border-gray-300 p-2 bg-yellow-50">ボーメ変動</th>
                  <th className="border border-gray-300 p-2 bg-blue-50">アルコール(追い水無視)</th>
                  <th className="border border-gray-300 p-2 bg-blue-50">アルコール変動</th>
                  <th className="border border-gray-300 p-2 bg-green-50">BMD(追い水無視)</th>
                  <th className="border border-gray-300 p-2 bg-green-50">BMD変動</th>
                  <th className="border border-gray-300 p-2">追水</th>
                </tr>
              </thead>
              <tbody>
                {tankData.map((data, index) => (
                  <tr key={index} className="hover:bg-gray-50">
                    <td className="border border-gray-300 p-2 text-center font-semibold">
                      {data.day}
                    </td>
                    <td className="border border-gray-300 p-2 text-center">
                      {data.temp1 !== null && data.temp1 !== undefined ? data.temp1.toFixed(1) : '-'}
                    </td>
                    <td className="border border-gray-300 p-2 text-center">
                      {data.tempChange !== null && data.tempChange !== undefined ? data.tempChange.toFixed(1) : '-'}
                    </td>
                    <td className="border border-gray-300 p-2 text-center">
                      {data.tempUpDown || '-'}
                    </td>
                    <td className="border border-gray-300 p-2 text-center bg-yellow-50">
                      {data.baumeWithoutWater !== null && data.baumeWithoutWater !== undefined ? data.baumeWithoutWater.toFixed(2) : '-'}
                    </td>
                    <td className="border border-gray-300 p-2 text-center bg-yellow-50">
                      {data.baumeChange !== null && data.baumeChange !== undefined ? data.baumeChange.toFixed(2) : '-'}
                    </td>
                    <td className="border border-gray-300 p-2 text-center bg-blue-50">
                      {data.alcoholWithoutWater !== null && data.alcoholWithoutWater !== undefined ? data.alcoholWithoutWater.toFixed(2) : '-'}
                    </td>
                    <td className="border border-gray-300 p-2 text-center bg-blue-50">
                      {data.alcoholChange !== null && data.alcoholChange !== undefined ? data.alcoholChange.toFixed(2) : '-'}
                    </td>
                    <td className="border border-gray-300 p-2 text-center bg-green-50">
                      {data.bmdWithoutWater !== null && data.bmdWithoutWater !== undefined ? data.bmdWithoutWater.toFixed(2) : '-'}
                    </td>
                    <td className="border border-gray-300 p-2 text-center bg-green-50">
                      {data.bmdChange !== null && data.bmdChange !== undefined ? data.bmdChange.toFixed(2) : '-'}
                    </td>
                    <td className="border border-gray-300 p-2 text-center">
                      {(() => {
                        const water = data.addedWater;
                        if (water === null || water === undefined || water === '' || water === 0) return '-';
                        const num = Number(water);
                        if (isNaN(num) || num === 0) return '-';
                        return num.toFixed(0);
                      })()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* デバッグ情報（開発時のみ表示） */}
          {process.env.NODE_ENV === 'development' && tankData.length > 0 && (
            <div className="mt-4 p-3 bg-gray-100 rounded text-xs">
              <strong>デバッグ情報 (タンク{tankId}):</strong>
              <br />仕込み総量: {tanks.find(t => t.tankId === tankId)?.metadata[COLUMN_NAMES.META.TOTAL_VOLUME]}L
              <br />サンプル希釈倍率: {formatNumber(tankData[0]?.dilutionFactor, 4)}
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

export default TemperatureAnalysis;