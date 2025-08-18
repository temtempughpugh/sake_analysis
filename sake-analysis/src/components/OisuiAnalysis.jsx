import React, { useState, useMemo, useRef, useEffect } from 'react';
import { ChevronUp, ChevronDown, Calculator } from 'lucide-react';
import { COLUMN_NAMES } from '../utils/csvParser';

// Chart.js imports
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  ScatterController
} from 'chart.js';
import { Scatter } from 'react-chartjs-2';

// Chart.js registration
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  ScatterController
);

const OisuiAnalysis = ({ tanks = [], selectedTankIds = [] }) => {
  // 状態管理
  const [isDay5Collapsed, setIsDay5Collapsed] = useState(false);
  const [isDay7Collapsed, setIsDay7Collapsed] = useState(false);
  const [day5SortConfig, setDay5SortConfig] = useState([]);
  const [day7SortConfig, setDay7SortConfig] = useState([]);
  const [calculatorInputs, setCalculatorInputs] = useState({
    batchSize: '',
    baume: '',
    analysisDay: '5'
  });

  // 選択されたタンクのデータを取得
  const selectedTanks = useMemo(() => {
    return Array.isArray(tanks) ? tanks.filter(tank => 
      Array.isArray(selectedTankIds) && selectedTankIds.includes(tank.tankId)
    ) : [];
  }, [tanks, selectedTankIds]);

  // 分析データ作成（5日目と7日目のみ）
  const analysisData = useMemo(() => {
    console.log('OisuiAnalysis: Creating analysis data');
    console.log('Selected tanks:', selectedTanks.length);
    
    const results = [];

    selectedTanks.forEach(tank => {
      const tankId = tank.tankId;
      const batchSize = parseFloat(tank.metadata[COLUMN_NAMES.META.BATCH_SIZE]) || null;
      const tankNumber = tank.metadata[COLUMN_NAMES.META.TANK_NUMBER] || tankId;

      console.log(`Processing tank ${tankId}:`, {
        batchSize,
        tankNumber,
        dailyDataKeys: tank.dailyData ? Object.keys(tank.dailyData) : 'no dailyData'
      });

      if (!tank.dailyData || !batchSize) {
        console.log(`Skipping tank ${tankId}: missing dailyData or batchSize`);
        return;
      }

      // 日次データを処理（5日目と7日目のみ）
      Object.entries(tank.dailyData).forEach(([dayKey, dayData]) => {
        const day = parseInt(dayData[COLUMN_NAMES.DAILY.DAY]);
        
        console.log(`Tank ${tankId}, dayKey ${dayKey}, day: ${day}`);
        
        // 5日目と7日目のみ処理
        if (day !== 5 && day !== 7) return;

        console.log(`Processing day ${day} for tank ${tankId}`);

        // ボーメ（BMD/日数）データ取得
        const baumeBMD = (() => {
          const val = dayData[COLUMN_NAMES.DAILY.BAUME_BMD_DAY];
          console.log(`Tank ${tankId} day ${day} BAUME_BMD_DAY:`, val);
          return (val !== null && val !== undefined && val !== '') ? parseFloat(val) : null;
        })();

        // 追水データ取得
        const addedWater = (() => {
          const val = dayData[COLUMN_NAMES.DAILY.WATER];
          console.log(`Tank ${tankId} day ${day} WATER:`, val);
          return (val !== null && val !== undefined && val !== '') ? parseFloat(val) : 0;
        })();

        // 品温データ取得
        const temp1 = (() => {
          const val = dayData[COLUMN_NAMES.DAILY.TEMP_1];
          console.log(`Tank ${tankId} day ${day} TEMP_1 (${COLUMN_NAMES.DAILY.TEMP_1}):`, val);
          return (val !== null && val !== undefined && val !== '') ? parseFloat(val) : null;
        })();

        const tempChange = (() => {
          const val = dayData[COLUMN_NAMES.DAILY.TEMP_CHANGE];
          console.log(`Tank ${tankId} day ${day} TEMP_CHANGE (${COLUMN_NAMES.DAILY.TEMP_CHANGE}):`, val);
          return (val !== null && val !== undefined && val !== '') ? parseFloat(val) : null;
        })();

        const tempUpDown = (() => {
          const val = dayData[COLUMN_NAMES.DAILY.TEMP_UP_DOWN];
          console.log(`Tank ${tankId} day ${day} TEMP_UP_DOWN (${COLUMN_NAMES.DAILY.TEMP_UP_DOWN}):`, val);
          return val || null;
        })();

        // データが有効な場合のみ処理
        if (baumeBMD !== null && !isNaN(baumeBMD)) {
          console.log(`Valid data found for tank ${tankId} day ${day}:`, { 
            baumeBMD, 
            addedWater, 
            temp1, 
            tempChange, 
            tempUpDown,
            allDayData: dayData
          });
          
          // 仕込み総量 = 仕込み規模 × 2.35
          const baseVolume = batchSize * 2.35;
          
          // 累積追い水量を計算（その日までの全ての追い水）
          let cumulativeWater = 0;
          Object.entries(tank.dailyData).forEach(([otherDayKey, otherDayData]) => {
            const otherDay = parseInt(otherDayData[COLUMN_NAMES.DAILY.DAY]);
            if (otherDay <= day) {
              const otherWater = (() => {
                const val = otherDayData[COLUMN_NAMES.DAILY.WATER];
                return (val !== null && val !== undefined && val !== '') ? parseFloat(val) : 0;
              })();
              cumulativeWater += otherWater;
            }
          });
          
          // その日の追い水前の総量（前日までの累積追い水を含む）
          const volumeBeforeToday = baseVolume + cumulativeWater - addedWater;
          
          // 希釈率計算（その日の追い水による希釈）
          const dilutionFactor = (volumeBeforeToday + addedWater) / volumeBeforeToday;
          
          // 理論ボーメ変動量 = 元ボーメ値 - 元ボーメ値 / 希釈率 (どれだけ下げたか)
          const theoreticalChange = baumeBMD - baumeBMD / dilutionFactor;

          const dataPoint = {
            tankId,
            tankNumber,
            day,
            batchSize,
            temp1,
            tempChange,
            tempUpDown,
            baumeBMD,
            addedWater,
            totalVolume: volumeBeforeToday, // 追い水前の総量
            cumulativeWater,
            dilutionFactor,
            theoreticalChange
          };
          
          console.log(`Adding data point:`, dataPoint);
          results.push(dataPoint);
        } else {
          console.log(`Invalid baumeBMD for tank ${tankId} day ${day}:`, {
            baumeBMD,
            temp1,
            tempChange,
            tempUpDown,
            allColumns: Object.keys(dayData)
          });
        }
      });
    });

    console.log(`Total analysis data points: ${results.length}`);
    console.log('Analysis data:', results);

    return results.sort((a, b) => {
      if (a.day === b.day) {
        return a.tankNumber - b.tankNumber;
      }
      return a.day - b.day;
    });
  }, [selectedTanks]);

  // 5日目と7日目のデータ分離
  const day5Data = useMemo(() => {
    return analysisData.filter(item => item.day === 5);
  }, [analysisData]);

  const day7Data = useMemo(() => {
    return analysisData.filter(item => item.day === 7);
  }, [analysisData]);

  // 線形回帰計算
  const calculateLinearRegression = (data) => {
    if (data.length < 2) return null;

    const n = data.length;
    const x = data.map(d => d.baumeBMD);
    const y = data.map(d => d.theoreticalChange);

    const sumX = x.reduce((a, b) => a + b, 0);
    const sumY = y.reduce((a, b) => a + b, 0);
    const sumXY = x.reduce((sum, xi, i) => sum + xi * y[i], 0);
    const sumXX = x.reduce((sum, xi) => sum + xi * xi, 0);

    const a = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    const b = (sumY - a * sumX) / n;

    // R²計算
    const yMean = sumY / n;
    const ssTotal = y.reduce((sum, yi) => sum + Math.pow(yi - yMean, 2), 0);
    const ssResidual = y.reduce((sum, yi, i) => {
      const predicted = a * x[i] + b;
      return sum + Math.pow(yi - predicted, 2);
    }, 0);
    const rSquared = ssTotal > 0 ? 1 - (ssResidual / ssTotal) : 0;

    return { a, b, rSquared };
  };

  const day5Regression = useMemo(() => calculateLinearRegression(day5Data), [day5Data]);
  const day7Regression = useMemo(() => calculateLinearRegression(day7Data), [day7Data]);

  // ソート処理
  const handleSort = (field, isDay5) => {
    const currentConfig = isDay5 ? day5SortConfig : day7SortConfig;
    const setConfig = isDay5 ? setDay5SortConfig : setDay7SortConfig;

    const existingIndex = currentConfig.findIndex(config => config.field === field);
    
    if (existingIndex >= 0) {
      const newConfig = [...currentConfig];
      if (newConfig[existingIndex].order === 'asc') {
        newConfig[existingIndex].order = 'desc';
      } else {
        newConfig.splice(existingIndex, 1);
      }
      setConfig(newConfig);
    } else {
      setConfig([...currentConfig, { field, order: 'asc' }]);
    }
  };

  // ソート済みデータ
  const sortedDay5Data = useMemo(() => {
    if (day5SortConfig.length === 0) return day5Data;
    
    return [...day5Data].sort((a, b) => {
      for (const config of day5SortConfig) {
        const aVal = a[config.field];
        const bVal = b[config.field];
        if (aVal !== bVal) {
          const result = aVal < bVal ? -1 : 1;
          return config.order === 'asc' ? result : -result;
        }
      }
      return 0;
    });
  }, [day5Data, day5SortConfig]);

  const sortedDay7Data = useMemo(() => {
    if (day7SortConfig.length === 0) return day7Data;
    
    return [...day7Data].sort((a, b) => {
      for (const config of day7SortConfig) {
        const aVal = a[config.field];
        const bVal = b[config.field];
        if (aVal !== bVal) {
          const result = aVal < bVal ? -1 : 1;
          return config.order === 'asc' ? result : -result;
        }
      }
      return 0;
    });
  }, [day7Data, day7SortConfig]);

  // ソートアイコン
  const getSortIcon = (field, isDay5) => {
    const config = isDay5 ? day5SortConfig : day7SortConfig;
    const sortIndex = config.findIndex(c => c.field === field);
    
    if (sortIndex < 0) {
      return <span className="text-gray-400 ml-1">↕</span>;
    }
    
    const { order } = config[sortIndex];
    const priority = config.length > 1 ? (sortIndex + 1) : '';
    const arrow = order === 'asc' ? '↑' : '↓';
    
    return (
      <span className="text-blue-600 ml-1">
        {arrow}{priority && <sub className="text-xs">{priority}</sub>}
      </span>
    );
  };

  // フォーマット関数
  const formatNumber = (value, decimals = 3) => {
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

  // 計算機のハンドラー
  const handleCalculatorInputChange = (field, value) => {
    setCalculatorInputs(prev => ({
      ...prev,
      [field]: value
    }));
  };

  // 推奨追い水量計算
  const calculateRecommendedWater = () => {
    const { batchSize, baume, analysisDay } = calculatorInputs;
    
    if (!batchSize || !baume) return null;

    const regression = analysisDay === '5' ? day5Regression : day7Regression;
    if (!regression) return null;

    const batchSizeNum = parseFloat(batchSize);
    const baumeNum = parseFloat(baume);
    
    if (isNaN(batchSizeNum) || isNaN(baumeNum)) return null;

    // 関数から理論変動量を取得
    const targetChange = regression.a * baumeNum + regression.b;
    
    // 仕込み総量計算
    const totalVolume = batchSizeNum * 2.35;
    
    // 希釈率を逆算
    // targetChange = baumeNum - baumeNum / dilutionFactor
    // targetChange = baumeNum * (1 - 1/dilutionFactor)
    // targetChange = baumeNum * (dilutionFactor - 1) / dilutionFactor
    // targetChange * dilutionFactor = baumeNum * (dilutionFactor - 1)
    // targetChange * dilutionFactor = baumeNum * dilutionFactor - baumeNum
    // targetChange * dilutionFactor - baumeNum * dilutionFactor = -baumeNum
    // dilutionFactor * (targetChange - baumeNum) = -baumeNum
    // dilutionFactor = baumeNum / (baumeNum - targetChange)
    const requiredDilutionFactor = baumeNum / (baumeNum - targetChange);
    
    // 追い水量計算
    const requiredWater = totalVolume * (requiredDilutionFactor - 1);

    return {
      targetChange,
      requiredWater,
      totalVolume,
      dilutionFactor: requiredDilutionFactor
    };
  };

  // グラフデータ生成
  const generateChartData = (data, regression, title, color) => {
    if (!data.length || !regression) return null;

    const scatterData = data.map(d => ({
      x: d.baumeBMD,
      y: d.theoreticalChange
    }));

    // 回帰直線用のデータ点
    const xMin = Math.min(...data.map(d => d.baumeBMD));
    const xMax = Math.max(...data.map(d => d.baumeBMD));
    const lineData = [
      { x: xMin, y: regression.a * xMin + regression.b },
      { x: xMax, y: regression.a * xMax + regression.b }
    ];

    return {
      datasets: [
        {
          label: `${title}データ`,
          data: scatterData,
          backgroundColor: color,
          borderColor: color,
          pointRadius: 6,
          pointHoverRadius: 8,
          showLine: false
        },
        {
          label: `${title}回帰直線`,
          data: lineData,
          backgroundColor: color + '40',
          borderColor: color,
          borderWidth: 2,
          pointRadius: 0,
          showLine: true,
          type: 'line'
        }
      ]
    };
  };

  const day5ChartData = generateChartData(day5Data, day5Regression, '5日目', '#3B82F6');
  const day7ChartData = generateChartData(day7Data, day7Regression, '7日目', '#EF4444');

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top',
      },
      title: {
        display: true,
        text: 'ボーメ値 vs 理論ボーメ変動量'
      },
      tooltip: {
        callbacks: {
          label: function(context) {
            return `${context.dataset.label}: (${context.parsed.x.toFixed(3)}, ${context.parsed.y.toFixed(3)})`;
          }
        }
      }
    },
    scales: {
      x: {
        display: true,
        title: {
          display: true,
          text: 'ボーメ値'
        },
        min: (() => {
          const allBaume = [...day5Data, ...day7Data].map(d => d.baumeBMD);
          if (allBaume.length === 0) return undefined;
          const min = Math.min(...allBaume);
          return min - (Math.max(...allBaume) - min) * 0.1; // 10%の余白
        })(),
        max: (() => {
          const allBaume = [...day5Data, ...day7Data].map(d => d.baumeBMD);
          if (allBaume.length === 0) return undefined;
          const max = Math.max(...allBaume);
          const min = Math.min(...allBaume);
          return max + (max - min) * 0.1; // 10%の余白
        })()
      },
      y: {
        display: true,
        title: {
          display: true,
          text: '理論ボーメ変動量'
        },
        min: (() => {
          const allChange = [...day5Data, ...day7Data].map(d => d.theoreticalChange);
          if (allChange.length === 0) return undefined;
          const min = Math.min(...allChange);
          const max = Math.max(...allChange);
          return min - (max - min) * 0.1; // 10%の余白
        })(),
        max: (() => {
          const allChange = [...day5Data, ...day7Data].map(d => d.theoreticalChange);
          if (allChange.length === 0) return undefined;
          const max = Math.max(...allChange);
          const min = Math.min(...allChange);
          return max + (max - min) * 0.1; // 10%の余白
        })()
      }
    }
  };

  const calculationResult = calculateRecommendedWater();

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

      {/* 5日目ボーメ計測期間集計 */}
      {day5Data.length > 0 && (
        <div className="mb-8 p-4 bg-white rounded-lg border border-gray-300">
          <div className="mb-4 flex items-center justify-between">
            <button
              onClick={() => setIsDay5Collapsed(!isDay5Collapsed)}
              className="flex items-center text-lg font-semibold text-gray-800 hover:text-gray-600 transition-colors"
            >
              🌾 5日目ボーメ計測期間集計（アルコール計測前）
              {isDay5Collapsed ? <ChevronDown className="ml-2 h-5 w-5" /> : <ChevronUp className="ml-2 h-5 w-5" />}
            </button>
            {!isDay5Collapsed && (
              <button
                onClick={() => setDay5SortConfig([])}
                className="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded border transition-colors"
              >
                ソートリセット
              </button>
            )}
          </div>
          
          {!isDay5Collapsed && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse border border-gray-300">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="border border-gray-300 p-2 cursor-pointer hover:bg-gray-200 select-none w-16" onClick={() => handleSort('tankNumber', true)}>
                      順号{getSortIcon('tankNumber', true)}
                    </th>
                    <th className="border border-gray-300 p-2 cursor-pointer hover:bg-gray-200 select-none w-20" onClick={() => handleSort('batchSize', true)}>
                      仕込み規模{getSortIcon('batchSize', true)}
                    </th>
                    <th className="border border-gray-300 p-2 cursor-pointer hover:bg-gray-200 select-none w-16" onClick={() => handleSort('temp1', true)}>
                      品温{getSortIcon('temp1', true)}
                    </th>
                    <th className="border border-gray-300 p-2 cursor-pointer hover:bg-gray-200 select-none w-20" onClick={() => handleSort('tempChange', true)}>
                      品温変動{getSortIcon('tempChange', true)}
                    </th>
                    <th className="border border-gray-300 p-2 cursor-pointer hover:bg-gray-200 select-none w-16" onClick={() => handleSort('tempUpDown', true)}>
                      品温上下{getSortIcon('tempUpDown', true)}
                    </th>
                    <th className="border border-gray-300 p-2 cursor-pointer hover:bg-gray-200 select-none w-24" onClick={() => handleSort('baumeBMD', true)}>
                      ボーメ（BMD/日数）{getSortIcon('baumeBMD', true)}
                    </th>
                    <th className="border border-gray-300 p-2 cursor-pointer hover:bg-gray-200 select-none w-24" onClick={() => handleSort('theoreticalChange', true)}>
                      理論ボーメ変動量{getSortIcon('theoreticalChange', true)}
                    </th>
                    <th className="border border-gray-300 p-2 cursor-pointer hover:bg-gray-200 select-none w-16" onClick={() => handleSort('addedWater', true)}>
                      追水{getSortIcon('addedWater', true)}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sortedDay5Data.map((data, index) => (
                    <tr key={`day5-${data.tankId}-${index}`} className="hover:bg-gray-50">
                      <td className="border border-gray-300 p-2 text-center">
                        {data.tankNumber}
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
                        {formatNumber(data.baumeBMD)}
                      </td>
                      <td className="border border-gray-300 p-2 text-center bg-blue-50">
                        {formatNumber(data.theoreticalChange)}
                      </td>
                      <td className="border border-gray-300 p-2 text-center">
                        {formatNumber(data.addedWater, 1)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* 7日目ボーメ計測期間集計 */}
      {day7Data.length > 0 && (
        <div className="mb-8 p-4 bg-white rounded-lg border border-gray-300">
          <div className="mb-4 flex items-center justify-between">
            <button
              onClick={() => setIsDay7Collapsed(!isDay7Collapsed)}
              className="flex items-center text-lg font-semibold text-gray-800 hover:text-gray-600 transition-colors"
            >
              🌾 7日目ボーメ計測期間集計（アルコール計測前）
              {isDay7Collapsed ? <ChevronDown className="ml-2 h-5 w-5" /> : <ChevronUp className="ml-2 h-5 w-5" />}
            </button>
            {!isDay7Collapsed && (
              <button
                onClick={() => setDay7SortConfig([])}
                className="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded border transition-colors"
              >
                ソートリセット
              </button>
            )}
          </div>
          
          {!isDay7Collapsed && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse border border-gray-300">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="border border-gray-300 p-2 cursor-pointer hover:bg-gray-200 select-none w-16" onClick={() => handleSort('tankNumber', false)}>
                      順号{getSortIcon('tankNumber', false)}
                    </th>
                    <th className="border border-gray-300 p-2 cursor-pointer hover:bg-gray-200 select-none w-20" onClick={() => handleSort('batchSize', false)}>
                      仕込み規模{getSortIcon('batchSize', false)}
                    </th>
                    <th className="border border-gray-300 p-2 cursor-pointer hover:bg-gray-200 select-none w-16" onClick={() => handleSort('temp1', false)}>
                      品温{getSortIcon('temp1', false)}
                    </th>
                    <th className="border border-gray-300 p-2 cursor-pointer hover:bg-gray-200 select-none w-20" onClick={() => handleSort('tempChange', false)}>
                      品温変動{getSortIcon('tempChange', false)}
                    </th>
                    <th className="border border-gray-300 p-2 cursor-pointer hover:bg-gray-200 select-none w-16" onClick={() => handleSort('tempUpDown', false)}>
                      品温上下{getSortIcon('tempUpDown', false)}
                    </th>
                    <th className="border border-gray-300 p-2 cursor-pointer hover:bg-gray-200 select-none w-24" onClick={() => handleSort('baumeBMD', false)}>
                      ボーメ（BMD/日数）{getSortIcon('baumeBMD', false)}
                    </th>
                    <th className="border border-gray-300 p-2 cursor-pointer hover:bg-gray-200 select-none w-24" onClick={() => handleSort('theoreticalChange', false)}>
                      理論ボーメ変動量{getSortIcon('theoreticalChange', false)}
                    </th>
                    <th className="border border-gray-300 p-2 cursor-pointer hover:bg-gray-200 select-none w-16" onClick={() => handleSort('addedWater', false)}>
                      追水{getSortIcon('addedWater', false)}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sortedDay7Data.map((data, index) => (
                    <tr key={`day7-${data.tankId}-${index}`} className="hover:bg-gray-50">
                      <td className="border border-gray-300 p-2 text-center">
                        {data.tankNumber}
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
                        {formatNumber(data.baumeBMD)}
                      </td>
                      <td className="border border-gray-300 p-2 text-center bg-blue-50">
                        {formatNumber(data.theoreticalChange)}
                      </td>
                      <td className="border border-gray-300 p-2 text-center">
                        {formatNumber(data.addedWater, 1)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* 線形回帰結果 */}
      {(day5Regression || day7Regression) && (
        <div className="mb-8 p-4 bg-gray-50 rounded-lg border border-gray-300">
          <h3 className="text-lg font-semibold mb-4">📊 線形回帰結果</h3>
          
          <div className="grid md:grid-cols-2 gap-6">
            {/* 5日目関数 */}
            {day5Regression && (
              <div className="bg-white p-4 rounded border">
                <h4 className="font-semibold mb-2">5日目ボーメ係数関数</h4>
                <div className="space-y-2">
                  <p className="text-sm">
                    <strong>関数:</strong> 変動量 = {day5Regression.a.toFixed(6)} × ボーメ値 + {day5Regression.b.toFixed(6)}
                  </p>
                  <p className="text-sm">
                    <strong>決定係数 R²:</strong> {day5Regression.rSquared.toFixed(4)}
                  </p>
                  <p className="text-sm">
                    <strong>データ点数:</strong> {day5Data.length}件
                  </p>
                </div>
                
                {/* 実用例表示 */}
                <div className="mt-4 pt-3 border-t border-gray-200">
                  <h5 className="font-medium text-sm mb-2">実用例（仕込み規模1000kg）</h5>
                  <div className="space-y-1 text-xs">
                    {[6.0, 7.0, 8.0].map(baume => {
                      const targetChange = day5Regression.a * baume + day5Regression.b;
                      const batchSize = 1000;
                      const totalVolume = batchSize * 2.35;
                      const requiredDilutionFactor = baume / (baume - targetChange);
                      const requiredWater = totalVolume * (requiredDilutionFactor - 1);
                      
                      return (
                        <p key={baume} className="text-gray-600">
                          ボーメ{baume.toFixed(1)} → 推奨追い水{requiredWater.toFixed(0)}L
                        </p>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* 7日目関数 */}
            {day7Regression && (
              <div className="bg-white p-4 rounded border">
                <h4 className="font-semibold mb-2">7日目ボーメ係数関数</h4>
                <div className="space-y-2">
                  <p className="text-sm">
                    <strong>関数:</strong> 変動量 = {day7Regression.a.toFixed(6)} × ボーメ値 + {day7Regression.b.toFixed(6)}
                  </p>
                  <p className="text-sm">
                    <strong>決定係数 R²:</strong> {day7Regression.rSquared.toFixed(4)}
                  </p>
                  <p className="text-sm">
                    <strong>データ点数:</strong> {day7Data.length}件
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* グラフ表示 */}
          {(day5ChartData || day7ChartData) && (
            <div className="mt-6 bg-white p-4 rounded border">
              <h4 className="font-semibold mb-4">散布図と回帰直線</h4>
              <div className="h-96">
                <Scatter 
                  data={{
                    datasets: [
                      ...(day5ChartData ? day5ChartData.datasets : []),
                      ...(day7ChartData ? day7ChartData.datasets : [])
                    ]
                  }}
                  options={chartOptions}
                />
              </div>
            </div>
          )}

          {/* データ不足警告 */}
          {day5Data.length === 0 && (
            <div className="bg-yellow-50 border border-yellow-200 rounded p-3 mt-4">
              <p className="text-yellow-800 text-sm">
                ⚠️ 5日目のデータが不足しているため、関数を構築できません。 より多くのタンクを選択してください。
              </p>
            </div>
          )}

          {day7Data.length === 0 && (
            <div className="bg-yellow-50 border border-yellow-200 rounded p-3 mt-4">
              <p className="text-yellow-800 text-sm">
                ⚠️ 7日目のデータが不足しているため、関数を構築できません。 より多くのタンクを選択してください。
              </p>
            </div>
          )}
        </div>
      )}

      {/* 追い水計算機 */}
      <div className="mb-8 p-4 bg-blue-50 rounded-lg border border-blue-200">
        <h3 className="text-lg font-semibold mb-4 flex items-center">
          <Calculator className="mr-2 h-5 w-5" />
          🧮 追い水計算機
        </h3>
        
        <div className="grid md:grid-cols-3 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              仕込み規模 (kg)
            </label>
            <input
              type="number"
              value={calculatorInputs.batchSize}
              onChange={(e) => handleCalculatorInputChange('batchSize', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="例: 1200"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              ボーメ値
            </label>
            <input
              type="number"
              step="0.1"
              value={calculatorInputs.baume}
              onChange={(e) => handleCalculatorInputChange('baume', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="例: 8.15"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              分析日
            </label>
            <select
              value={calculatorInputs.analysisDay}
              onChange={(e) => handleCalculatorInputChange('analysisDay', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="5">5日目</option>
              <option value="7">7日目</option>
            </select>
          </div>
        </div>

        {/* 計算結果 */}
        <div className="bg-white p-4 rounded border">
          <h4 className="font-semibold mb-2">推奨追い水量</h4>
          {calculationResult ? (
            <div className="space-y-2">
              <p className="text-lg font-bold text-blue-600">
                {calculationResult.requiredWater.toFixed(1)} L
              </p>
              <div className="text-sm text-gray-600 space-y-1">
                <p>• 仕込み総量: {calculationResult.totalVolume.toFixed(1)} L</p>
                <p>• 予測変動量: {calculationResult.targetChange.toFixed(3)}</p>
                <p>• 希釈率: {calculationResult.dilutionFactor.toFixed(4)}</p>
              </div>
            </div>
          ) : (
            <p className="text-gray-500">-</p>
          )}
        </div>

        {/* エラー表示 */}
        {calculatorInputs.batchSize && calculatorInputs.baume && !calculationResult && (
          <div className="bg-red-50 border border-red-200 rounded p-3 mt-4">
            <p className="text-red-800 text-sm">
              ⚠️ {calculatorInputs.analysisDay}日目の関数が構築されていないため、計算できません。
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default OisuiAnalysis;