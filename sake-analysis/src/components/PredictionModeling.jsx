import React, { useState, useMemo } from 'react';
import { ChevronUp, ChevronDown, Calculator } from 'lucide-react';
import { COLUMN_NAMES } from '../utils/csvParser';

const OisuiAnalysis = ({ tanks = [], selectedTankIds = [] }) => {
  const [baumeSortConfig, setBaumeSortConfig] = useState([]);
  const [isCollapsed5, setIsCollapsed5] = useState(false);
  const [isCollapsed7, setIsCollapsed7] = useState(false);
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

  // 5日目と7日目のデータのみを抽出
  const analysisData = useMemo(() => {
    const results = [];

    selectedTanks.forEach(tank => {
      const batchSize = parseFloat(tank.metadata[COLUMN_NAMES.META.BATCH_SIZE]) || null;
      const tankId = parseInt(tank.tankId);
      const seq = tank.metadata[COLUMN_NAMES.META.TANK_NUMBER];

      Object.entries(tank.dailyData).forEach(([day, dayData]) => {
        const dayNum = parseInt(day);
        
        // 5日目と7日目のみ処理
        if (dayNum !== 5 && dayNum !== 7) return;

        // ボーメ（BMD/日数）を取得
        const baumeBMD = parseFloat(dayData[COLUMN_NAMES.DAILY.BAUME]);
        if (isNaN(baumeBMD)) return;

        // 追い水量を取得
        const addedWater = parseFloat(dayData[COLUMN_NAMES.DAILY.WATER]) || 0;
        if (addedWater <= 0) return;

        // 仕込み総量の計算（仕込み規模 × 1.35）
        const totalVolume = batchSize * 1.35;

        // 理論ボーメ変動量の計算
        const dilutionFactor = (totalVolume + addedWater) / totalVolume;
        const theoreticalBaumeChange = baumeBMD / dilutionFactor - baumeBMD;

        // その他の基本データ
        const temp1 = parseFloat(dayData[COLUMN_NAMES.DAILY.TEMP_1]) || null;
        const tempChange = parseFloat(dayData[COLUMN_NAMES.DAILY.TEMP_CHANGE]) || null;
        const tempUpDown = dayData[COLUMN_NAMES.DAILY.TEMP_UP_DOWN] || null;

        results.push({
          tankId,
          seq,
          day: dayNum,
          moromiDays: dayNum,
          batchSize,
          temp1,
          tempChange,
          tempUpDown,
          baumeBMD,
          theoreticalBaumeChange,
          addedWater,
          totalVolume,
          dilutionFactor
        });
      });
    });

    return results;
  }, [selectedTanks]);

  // 5日目と7日目のデータを分離
  const day5Data = useMemo(() => {
    return analysisData.filter(item => item.day === 5);
  }, [analysisData]);

  const day7Data = useMemo(() => {
    return analysisData.filter(item => item.day === 7);
  }, [analysisData]);

  // 線形回帰計算関数
  const calculateLinearRegression = (data) => {
    if (data.length < 2) return null;

    const n = data.length;
    const x = data.map(d => d.baumeBMD);
    const y = data.map(d => d.theoreticalBaumeChange);

    const sumX = x.reduce((a, b) => a + b, 0);
    const sumY = y.reduce((a, b) => a + b, 0);
    const sumXY = x.reduce((sum, xi, i) => sum + xi * y[i], 0);
    const sumXX = x.reduce((sum, xi) => sum + xi * xi, 0);

    const a = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    const b = (sumY - a * sumX) / n;

    // R²の計算
    const yMean = sumY / n;
    const ssTotal = y.reduce((sum, yi) => sum + Math.pow(yi - yMean, 2), 0);
    const ssResidual = y.reduce((sum, yi, i) => {
      const predicted = a * x[i] + b;
      return sum + Math.pow(yi - predicted, 2);
    }, 0);
    const rSquared = ssTotal > 0 ? 1 - (ssResidual / ssTotal) : 0;

    return { a, b, rSquared, dataPoints: data.length };
  };

  // 線形回帰結果
  const day5Regression = useMemo(() => calculateLinearRegression(day5Data), [day5Data]);
  const day7Regression = useMemo(() => calculateLinearRegression(day7Data), [day7Data]);

  // 追い水量計算関数
  const calculateRequiredWater = (batchSize, baume, analysisDay) => {
    const regression = analysisDay === '5' ? day5Regression : day7Regression;
    if (!regression) return null;

    const targetChange = regression.a * baume + regression.b;
    const totalVolume = batchSize * 1.35;
    
    // 逆算: dilutionFactor = baume / (baume - targetChange)
    if (baume - targetChange === 0) return null;
    const requiredDilutionFactor = baume / (baume - targetChange);
    const requiredWater = totalVolume * (requiredDilutionFactor - 1);
    
    return Math.max(0, requiredWater);
  };

  // フォーマット関数
  const formatNumber = (value, decimals = 1) => {
    if (value === null || value === undefined || isNaN(value)) return '-';
    return Number(value).toFixed(decimals);
  };

  const getTempClass = (temp) => {
    if (temp === null || temp === undefined) return '';
    if (temp >= 12) return 'bg-red-100 text-red-800';
    if (temp >= 10) return 'bg-yellow-100 text-yellow-800';
    if (temp >= 8) return 'bg-green-100 text-green-800';
    return 'bg-blue-100 text-blue-800';
  };

  const getUpDownSymbol = (upDown) => {
    if (!upDown) return '-';
    if (upDown === '上') return '↑';
    if (upDown === '下') return '↓';
    return upDown;
  };

  // ソート関数
  const handleSort = (column, dataType = 'day5') => {
    setBaumeSortConfig(prev => {
      const existingIndex = prev.findIndex(config => config.column === column && config.dataType === dataType);
      
      if (existingIndex >= 0) {
        const newConfig = [...prev];
        newConfig[existingIndex] = {
          ...newConfig[existingIndex],
          order: newConfig[existingIndex].order === 'asc' ? 'desc' : 'asc'
        };
        return newConfig;
      } else {
        return [...prev, { column, order: 'asc', dataType }];
      }
    });
  };

  const getSortedData = (data, dataType) => {
    const sortConfigs = baumeSortConfig.filter(config => config.dataType === dataType);
    if (sortConfigs.length === 0) return data;

    return [...data].sort((a, b) => {
      for (const config of sortConfigs) {
        const aVal = a[config.column];
        const bVal = b[config.column];
        
        if (aVal === null || aVal === undefined) return 1;
        if (bVal === null || bVal === undefined) return -1;
        
        let comparison = 0;
        if (typeof aVal === 'number' && typeof bVal === 'number') {
          comparison = aVal - bVal;
        } else {
          comparison = String(aVal).localeCompare(String(bVal));
        }
        
        if (comparison !== 0) {
          return config.order === 'asc' ? comparison : -comparison;
        }
      }
      return 0;
    });
  };

  const getSortIndicator = (column, dataType) => {
    const sortConfigs = baumeSortConfig.filter(config => config.dataType === dataType);
    const config = sortConfigs.find(config => config.column === column);
    if (!config) return null;
    
    const sortIndex = sortConfigs.findIndex(config => config.column === column);
    const priority = sortConfigs.length > 1 ? (sortIndex + 1) : '';
    const arrow = config.order === 'asc' ? '↑' : '↓';
    
    return (
      <span className="text-blue-600 ml-1">
        {arrow}{priority && <sub className="text-xs">{priority}</sub>}
      </span>
    );
  };

  // 計算機の入力変更処理
  const handleCalculatorInputChange = (field, value) => {
    setCalculatorInputs(prev => ({
      ...prev,
      [field]: value
    }));
  };

  // 推奨追い水量の計算
  const recommendedWater = useMemo(() => {
    const { batchSize, baume, analysisDay } = calculatorInputs;
    if (!batchSize || !baume || isNaN(parseFloat(batchSize)) || isNaN(parseFloat(baume))) {
      return null;
    }
    return calculateRequiredWater(parseFloat(batchSize), parseFloat(baume), analysisDay);
  }, [calculatorInputs, day5Regression, day7Regression]);

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
              onClick={() => setIsCollapsed5(!isCollapsed5)}
              className="flex items-center text-lg font-semibold text-gray-800 hover:text-gray-600 transition-colors"
            >
              🌾 5日目ボーメ計測期間集計
              {isCollapsed5 ? <ChevronDown className="ml-2 h-5 w-5" /> : <ChevronUp className="ml-2 h-5 w-5" />}
            </button>
            <span className="text-sm text-gray-600">
              {day5Data.length}件のデータ
            </span>
          </div>

          {!isCollapsed5 && (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse border border-gray-300 text-sm">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="border border-gray-300 p-2">
                      <button
                        onClick={() => handleSort('seq', 'day5')}
                        className="w-full text-left hover:text-blue-600 transition-colors"
                      >
                        タンク番号{getSortIndicator('seq', 'day5')}
                      </button>
                    </th>
                    <th className="border border-gray-300 p-2">
                      <button
                        onClick={() => handleSort('day', 'day5')}
                        className="w-full text-left hover:text-blue-600 transition-colors"
                      >
                        日数{getSortIndicator('day', 'day5')}
                      </button>
                    </th>
                    <th className="border border-gray-300 p-2">
                      <button
                        onClick={() => handleSort('moromiDays', 'day5')}
                        className="w-full text-left hover:text-blue-600 transition-colors"
                      >
                        もろみ日数{getSortIndicator('moromiDays', 'day5')}
                      </button>
                    </th>
                    <th className="border border-gray-300 p-2">
                      <button
                        onClick={() => handleSort('batchSize', 'day5')}
                        className="w-full text-left hover:text-blue-600 transition-colors"
                      >
                        仕込み規模{getSortIndicator('batchSize', 'day5')}
                      </button>
                    </th>
                    <th className="border border-gray-300 p-2">
                      <button
                        onClick={() => handleSort('temp1', 'day5')}
                        className="w-full text-left hover:text-blue-600 transition-colors"
                      >
                        品温1回目{getSortIndicator('temp1', 'day5')}
                      </button>
                    </th>
                    <th className="border border-gray-300 p-2">
                      <button
                        onClick={() => handleSort('tempChange', 'day5')}
                        className="w-full text-left hover:text-blue-600 transition-colors"
                      >
                        1日の品温の変動{getSortIndicator('tempChange', 'day5')}
                      </button>
                    </th>
                    <th className="border border-gray-300 p-2">
                      <button
                        onClick={() => handleSort('tempUpDown', 'day5')}
                        className="w-full text-left hover:text-blue-600 transition-colors"
                      >
                        品温上下{getSortIndicator('tempUpDown', 'day5')}
                      </button>
                    </th>
                    <th className="border border-gray-300 p-2 bg-yellow-50">
                      <button
                        onClick={() => handleSort('baumeBMD', 'day5')}
                        className="w-full text-left hover:text-blue-600 transition-colors"
                      >
                        ボーメ（BMD/日数）{getSortIndicator('baumeBMD', 'day5')}
                      </button>
                    </th>
                    <th className="border border-gray-300 p-2 bg-yellow-50">
                      <button
                        onClick={() => handleSort('theoreticalBaumeChange', 'day5')}
                        className="w-full text-left hover:text-blue-600 transition-colors"
                      >
                        理論ボーメ変動量{getSortIndicator('theoreticalBaumeChange', 'day5')}
                      </button>
                    </th>
                    <th className="border border-gray-300 p-2">
                      <button
                        onClick={() => handleSort('addedWater', 'day5')}
                        className="w-full text-left hover:text-blue-600 transition-colors"
                      >
                        追い水{getSortIndicator('addedWater', 'day5')}
                      </button>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {getSortedData(day5Data, 'day5').map((data, index) => (
                    <tr key={`${data.tankId}-${data.day}-${index}`} className="hover:bg-gray-50">
                      <td className="border border-gray-300 p-2 text-center font-medium">
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
                        {formatNumber(data.baumeBMD)}
                      </td>
                      <td className="border border-gray-300 p-2 text-center bg-yellow-50">
                        {formatNumber(data.theoreticalBaumeChange, 4)}
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

      {/* 7日目ボーメ計測期間集計 */}
      {day7Data.length > 0 && (
        <div className="mb-8 p-4 bg-white rounded-lg border border-gray-300">
          <div className="mb-4 flex items-center justify-between">
            <button
              onClick={() => setIsCollapsed7(!isCollapsed7)}
              className="flex items-center text-lg font-semibold text-gray-800 hover:text-gray-600 transition-colors"
            >
              🌾 7日目ボーメ計測期間集計
              {isCollapsed7 ? <ChevronDown className="ml-2 h-5 w-5" /> : <ChevronUp className="ml-2 h-5 w-5" />}
            </button>
            <span className="text-sm text-gray-600">
              {day7Data.length}件のデータ
            </span>
          </div>

          {!isCollapsed7 && (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse border border-gray-300 text-sm">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="border border-gray-300 p-2">
                      <button
                        onClick={() => handleSort('seq', 'day7')}
                        className="w-full text-left hover:text-blue-600 transition-colors"
                      >
                        タンク番号{getSortIndicator('seq', 'day7')}
                      </button>
                    </th>
                    <th className="border border-gray-300 p-2">
                      <button
                        onClick={() => handleSort('day', 'day7')}
                        className="w-full text-left hover:text-blue-600 transition-colors"
                      >
                        日数{getSortIndicator('day', 'day7')}
                      </button>
                    </th>
                    <th className="border border-gray-300 p-2">
                      <button
                        onClick={() => handleSort('moromiDays', 'day7')}
                        className="w-full text-left hover:text-blue-600 transition-colors"
                      >
                        もろみ日数{getSortIndicator('moromiDays', 'day7')}
                      </button>
                    </th>
                    <th className="border border-gray-300 p-2">
                      <button
                        onClick={() => handleSort('batchSize', 'day7')}
                        className="w-full text-left hover:text-blue-600 transition-colors"
                      >
                        仕込み規模{getSortIndicator('batchSize', 'day7')}
                      </button>
                    </th>
                    <th className="border border-gray-300 p-2">
                      <button
                        onClick={() => handleSort('temp1', 'day7')}
                        className="w-full text-left hover:text-blue-600 transition-colors"
                      >
                        品温1回目{getSortIndicator('temp1', 'day7')}
                      </button>
                    </th>
                    <th className="border border-gray-300 p-2">
                      <button
                        onClick={() => handleSort('tempChange', 'day7')}
                        className="w-full text-left hover:text-blue-600 transition-colors"
                      >
                        1日の品温の変動{getSortIndicator('tempChange', 'day7')}
                      </button>
                    </th>
                    <th className="border border-gray-300 p-2">
                      <button
                        onClick={() => handleSort('tempUpDown', 'day7')}
                        className="w-full text-left hover:text-blue-600 transition-colors"
                      >
                        品温上下{getSortIndicator('tempUpDown', 'day7')}
                      </button>
                    </th>
                    <th className="border border-gray-300 p-2 bg-yellow-50">
                      <button
                        onClick={() => handleSort('baumeBMD', 'day7')}
                        className="w-full text-left hover:text-blue-600 transition-colors"
                      >
                        ボーメ（BMD/日数）{getSortIndicator('baumeBMD', 'day7')}
                      </button>
                    </th>
                    <th className="border border-gray-300 p-2 bg-yellow-50">
                      <button
                        onClick={() => handleSort('theoreticalBaumeChange', 'day7')}
                        className="w-full text-left hover:text-blue-600 transition-colors"
                      >
                        理論ボーメ変動量{getSortIndicator('theoreticalBaumeChange', 'day7')}
                      </button>
                    </th>
                    <th className="border border-gray-300 p-2">
                      <button
                        onClick={() => handleSort('addedWater', 'day7')}
                        className="w-full text-left hover:text-blue-600 transition-colors"
                      >
                        追い水{getSortIndicator('addedWater', 'day7')}
                      </button>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {getSortedData(day7Data, 'day7').map((data, index) => (
                    <tr key={`${data.tankId}-${data.day}-${index}`} className="hover:bg-gray-50">
                      <td className="border border-gray-300 p-2 text-center font-medium">
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
                        {formatNumber(data.baumeBMD)}
                      </td>
                      <td className="border border-gray-300 p-2 text-center bg-yellow-50">
                        {formatNumber(data.theoreticalBaumeChange, 4)}
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

      {/* 線形回帰結果 */}
      {(day5Regression || day7Regression) && (
        <div className="mb-8 p-4 bg-gray-50 rounded-lg border border-gray-300">
          <h3 className="text-lg font-semibold mb-4">📊 線形回帰結果</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* 5日目回帰結果 */}
            {day5Regression && (
              <div className="mb-6">
                <h4 className="font-semibold mb-2">5日目ボーメ係数関数</h4>
                <div className="bg-white p-4 rounded border">
                  <p className="text-sm mb-2">
                    <strong>関数式:</strong> 変動量 = {day5Regression.a.toFixed(6)} × ボーメ値 + {day5Regression.b.toFixed(6)}
                  </p>
                  <p className="text-sm mb-2">
                    <strong>決定係数:</strong> R² = {day5Regression.rSquared.toFixed(4)}
                  </p>
                  <p className="text-sm text-gray-600">
                    データ点数: {day5Regression.dataPoints}件
                  </p>
                </div>
              </div>
            )}

            {/* 7日目回帰結果 */}
            {day7Regression && (
              <div className="mb-6">
                <h4 className="font-semibold mb-2">7日目ボーメ係数関数</h4>
                <div className="bg-white p-4 rounded border">
                  <p className="text-sm mb-2">
                    <strong>関数式:</strong> 変動量 = {day7Regression.a.toFixed(6)} × ボーメ値 + {day7Regression.b.toFixed(6)}
                  </p>
                  <p className="text-sm mb-2">
                    <strong>決定係数:</strong> R² = {day7Regression.rSquared.toFixed(4)}
                  </p>
                  <p className="text-sm text-gray-600">
                    データ点数: {day7Regression.dataPoints}件
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 追い水計算機 */}
      <div className="p-4 bg-blue-50 rounded-lg border border-blue-300">
        <h3 className="text-lg font-semibold mb-4 flex items-center">
          <Calculator className="mr-2 h-5 w-5" />
          🧮 追い水計算機
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              仕込み規模 (L)
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
              placeholder="例: 7.5"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              分析日
            </label>
            <select
              value={calculatorInputs.analysisDay}
              onChange={(e) => handleCalculatorInputChange('analysisDay', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-2 focus:ring-blue-500"
            >
              <option value="5">5日目</option>
              <option value="7">7日目</option>
            </select>
          </div>
          
          <div className="flex items-end">
            <div className="w-full">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                推奨追い水量
              </label>
              <div className="px-3 py-2 bg-gray-100 border border-gray-300 rounded-md text-center font-medium">
                {recommendedWater !== null 
                  ? `${recommendedWater.toFixed(1)}L` 
                  : '-'
                }
              </div>
            </div>
          </div>
        </div>
        
        {recommendedWater !== null && (
          <div className="mt-4 p-3 bg-white rounded border">
            <p className="text-sm text-gray-600">
              <strong>計算詳細:</strong><br />
              仕込み総量: {(parseFloat(calculatorInputs.batchSize || 0) * 1.35).toFixed(1)}L<br />
              使用関数: {calculatorInputs.analysisDay}日目ボーメ係数関数<br />
              予測変動量: {
                calculatorInputs.analysisDay === '5' && day5Regression
                  ? (day5Regression.a * parseFloat(calculatorInputs.baume || 0) + day5Regression.b).toFixed(4)
                  : calculatorInputs.analysisDay === '7' && day7Regression
                  ? (day7Regression.a * parseFloat(calculatorInputs.baume || 0) + day7Regression.b).toFixed(4)
                  : '-'
              }
            </p>
          </div>
        )}
        
        {/* 関数が利用できない場合の警告 */}
        {((calculatorInputs.analysisDay === '5' && !day5Regression) || 
          (calculatorInputs.analysisDay === '7' && !day7Regression)) && (
          <div className="mt-4 p-3 bg-yellow-100 border border-yellow-400 rounded">
            <p className="text-sm text-yellow-800">
              ⚠️ {calculatorInputs.analysisDay}日目のデータが不足しているため、関数を構築できません。
              より多くのタンクを選択してください。
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default OisuiAnalysis;