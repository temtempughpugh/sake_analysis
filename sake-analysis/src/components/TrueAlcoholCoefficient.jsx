import React, { useState, useMemo } from 'react';
import { Line } from 'react-chartjs-2';
import { Calculator, TrendingUp, BarChart3, ChevronDown, ChevronUp } from 'lucide-react';

// 列名定数（既存システムと同じ）
const COLUMN_NAMES = {
  META: {
    TANK_NUMBER: '順号',
    YEAST: '酵母', 
    TOTAL_VOLUME: '仕込み総量'
  },
  DAILY: {
    DAY: '日数',
    BAUME_ESTIMATED: 'ボーメ（補完)',
    ALCOHOL_ESTIMATED: 'アルコール（補完)',
    WATER: '追水'
  }
};

const TrueAlcoholCoefficient = ({ tanks, selectedTankIds }) => {
  const [showAnalysis, setShowAnalysis] = useState(false);
  const [selectedAnalysisTanks, setSelectedAnalysisTanks] = useState([]);

  // 選択可能なタンクのフィルタリング
  const availableTanks = useMemo(() => {
    if (!tanks || !selectedTankIds) {
      console.log('TrueAlcoholCoefficient: tanks or selectedTankIds not available');
      return [];
    }
    
    console.log('TrueAlcoholCoefficient: Checking tanks:', tanks.length, 'selectedTankIds:', selectedTankIds);
    
    return tanks
      .filter(tank => selectedTankIds.includes(tank.tankId))
      .filter(tank => {
        console.log(`Checking tank ${tank.tankId}:`, tank.dailyData ? Object.keys(tank.dailyData).length : 'no dailyData');
        
        // アルコール（補完）データがあるかチェック
        const dailyData = tank.dailyData || {};
        const alcoholData = Object.values(dailyData).some(day => {
          const alcoholValue = day[COLUMN_NAMES.DAILY.ALCOHOL_ESTIMATED];
          const hasAlcohol = alcoholValue && parseFloat(alcoholValue) > 0;
          if (hasAlcohol) {
            console.log(`Tank ${tank.tankId} has alcohol data:`, alcoholValue);
          }
          return hasAlcohol;
        });
        
        console.log(`Tank ${tank.tankId} alcohol data available:`, alcoholData);
        return alcoholData;
      });
  }, [tanks, selectedTankIds]);

  // 真のアルコール係数計算
  const calculateTrueCoefficients = (tank) => {
    const results = [];
    const totalVolume = parseFloat(tank.metadata[COLUMN_NAMES.META.TOTAL_VOLUME]) || 3000;
    
    // 日次データを取得・ソート
    const dailyEntries = Object.entries(tank.dailyData || {})
      .map(([day, data]) => ({
        day: parseInt(day),
        baume: parseFloat(data[COLUMN_NAMES.DAILY.BAUME_ESTIMATED]) || null,
        alcohol: parseFloat(data[COLUMN_NAMES.DAILY.ALCOHOL_ESTIMATED]) || null,
        addedWater: parseFloat(data[COLUMN_NAMES.DAILY.WATER]) || 0
      }))
      .filter(entry => entry.baume !== null && entry.alcohol !== null)
      .sort((a, b) => a.day - b.day);

    if (dailyEntries.length === 0) return [];

    // 基準日（最初のアルコール測定日）
    const baseDay = dailyEntries[0];
    
    // 基準日より前の全追い水量を計算（基準日含む）
    let totalCumulativeWater = 0;
    Object.entries(tank.dailyData || {}).forEach(([day, data]) => {
      const dayNum = parseInt(day);
      const waterAmount = parseFloat(data[COLUMN_NAMES.DAILY.WATER]) || 0;
      if (dayNum <= baseDay.day && waterAmount > 0) {
        totalCumulativeWater += waterAmount;
      }
    });
    
    dailyEntries.forEach((dayData, index) => {
      // 積算追い水量計算：基準日までの累計 + 基準日翌日からの追加分
      let cumulativeWater = totalCumulativeWater; // 基準日までの累計
      
      // 基準日の翌日から分析日前日までの追い水を追加
      if (index > 0) {
        for (let i = 1; i < index; i++) {
          cumulativeWater += dailyEntries[i].addedWater;
        }
      }
      
      // ①追い水反映での逆算
      const dilutionFactor = (totalVolume + cumulativeWater) / totalVolume;
      const trueBaumeWithWater = dayData.baume * dilutionFactor;
      const trueAlcoholWithWater = dayData.alcohol * dilutionFactor;
      
      // ②追い水無視（補完データそのまま）
      const trueBaumeWithoutWater = dayData.baume;
      const trueAlcoholWithoutWater = dayData.alcohol;
      
      // アルコール係数計算（基準日からの累積）
      let coefficientWithWater = null;
      let coefficientWithoutWater = null;
      
      if (index > 0) {
        // 基準日の値（希釈計算適用）
        const baseDilutionFactor = (totalVolume + totalCumulativeWater) / totalVolume;
        const baseBaumeWithWater = baseDay.baume * baseDilutionFactor;
        const baseAlcoholWithWater = baseDay.alcohol * baseDilutionFactor;
        
        const baumeChangeWithWater = baseBaumeWithWater - trueBaumeWithWater;
        const alcoholChangeWithWater = trueAlcoholWithWater - baseAlcoholWithWater;
        
        const baumeChangeWithoutWater = baseDay.baume - trueBaumeWithoutWater;
        const alcoholChangeWithoutWater = trueAlcoholWithoutWater - baseDay.alcohol;
        
        coefficientWithWater = baumeChangeWithWater > 0 ? alcoholChangeWithWater / baumeChangeWithWater : null;
        coefficientWithoutWater = baumeChangeWithoutWater > 0 ? alcoholChangeWithoutWater / baumeChangeWithoutWater : null;
      }
      
      results.push({
        day: dayData.day,
        cumulativeWater,
        withWater: {
          baume: trueBaumeWithWater,
          alcohol: trueAlcoholWithWater,
          coefficient: coefficientWithWater
        },
        withoutWater: {
          baume: trueBaumeWithoutWater,
          alcohol: trueAlcoholWithoutWater,
          coefficient: coefficientWithoutWater
        }
      });
    });
    
    return results;
  };

  // グラフデータ生成
  const generateChartData = () => {
    const datasets = [];
    const colorPalette = [
      '#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', 
      '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9'
    ];
    
    // 全タンクの日数を収集してlabelsを作成
    const allDays = new Set();
    selectedAnalysisTanks.forEach((tank) => {
      const results = calculateTrueCoefficients(tank);
      results.forEach(r => allDays.add(r.day));
    });
    const sortedDays = Array.from(allDays).sort((a, b) => a - b);
    
    selectedAnalysisTanks.forEach((tank, tankIndex) => {
      const results = calculateTrueCoefficients(tank);
      
      // 日数インデックスマップを作成
      const dayIndexMap = {};
      sortedDays.forEach((day, index) => {
        dayIndexMap[day] = index;
      });
      
      // ①追い水反映のデータ配列
      const withWaterData = new Array(sortedDays.length).fill(null);
      results.forEach(r => {
        if (r.withWater.coefficient !== null) {
          withWaterData[dayIndexMap[r.day]] = r.withWater.coefficient;
        }
      });
      
      // ②追い水無視のデータ配列
      const withoutWaterData = new Array(sortedDays.length).fill(null);
      results.forEach(r => {
        if (r.withoutWater.coefficient !== null) {
          withoutWaterData[dayIndexMap[r.day]] = r.withoutWater.coefficient;
        }
      });
      
      const baseColor = colorPalette[tankIndex % colorPalette.length];
      const tankNumber = tank.metadata[COLUMN_NAMES.META.TANK_NUMBER] || tankIndex + 1;
      const yeast = tank.metadata[COLUMN_NAMES.META.YEAST] || '-';
      
      // 追い水反映データセット
      if (withWaterData.some(v => v !== null)) {
        datasets.push({
          label: `タンク${tankNumber}(${yeast}) ①追い水反映`,
          data: withWaterData,
          borderColor: baseColor,
          backgroundColor: baseColor.replace('1)', '0.2)'),
          borderWidth: 3,
          fill: false,
          tension: 0.3,
          pointRadius: 4,
          spanGaps: true,
          borderDash: []
        });
      }
      
      // 追い水無視データセット
      if (withoutWaterData.some(v => v !== null)) {
        datasets.push({
          label: `タンク${tankNumber}(${yeast}) ②追い水無視`,
          data: withoutWaterData,
          borderColor: baseColor,
          backgroundColor: baseColor.replace('1)', '0.1)'),
          borderWidth: 2,
          fill: false,
          tension: 0.3,
          pointRadius: 3,
          spanGaps: true,
          borderDash: [5, 5]
        });
      }
    });
    
    return { labels: sortedDays, datasets };
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      x: {
        title: { display: true, text: '発酵日数' },
        grid: { color: '#e5e7eb' }
      },
      y: {
        title: { display: true, text: '真のアルコール係数' },
        grid: { color: '#e5e7eb' },
        min: 0,
        max: 2.5
      }
    },
    plugins: {
      legend: { 
        position: 'bottom',
        labels: {
          usePointStyle: true,
          padding: 15
        }
      },
      tooltip: {
        callbacks: {
          label: function(context) {
            return `${context.dataset.label}: ${context.parsed.y.toFixed(3)}`;
          }
        }
      }
    }
  };

  const handleTankSelection = (tank) => {
    setSelectedAnalysisTanks(prev => {
      const isSelected = prev.some(t => t.tankId === tank.tankId);
      if (isSelected) {
        return prev.filter(t => t.tankId !== tank.tankId);
      } else {
        return [...prev, tank];
      }
    });
  };

  const handleSelectAll = () => {
    if (selectedAnalysisTanks.length === availableTanks.length) {
      setSelectedAnalysisTanks([]);
    } else {
      setSelectedAnalysisTanks([...availableTanks]);
    }
  };

  if (!availableTanks.length) {
    return (
      <div className="bg-white rounded-lg shadow border border-gray-200 mb-6">
        <button
          onClick={() => setShowAnalysis(!showAnalysis)}
          className="w-full px-6 py-4 text-left flex items-center justify-between hover:bg-gray-50"
        >
          <span className="text-lg font-semibold flex items-center">
            <Calculator className="w-5 h-5 mr-3 text-blue-600" />
            真のアルコール係数分析
          </span>
          {showAnalysis ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
        </button>
        
        {showAnalysis && (
          <div className="border-t border-gray-200 p-6">
            <div className="text-center py-8 text-gray-500">
              <Calculator className="w-12 h-12 mx-auto mb-4 text-gray-300" />
              <p>分析に適したタンクがありません。</p>
              <p className="text-sm">アルコール（補完）データが含まれるタンクを選択してください。</p>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow border border-gray-200 mb-6">
      <button
        onClick={() => setShowAnalysis(!showAnalysis)}
        className="w-full px-6 py-4 text-left flex items-center justify-between hover:bg-gray-50"
      >
        <span className="text-lg font-semibold flex items-center">
          <Calculator className="w-5 h-5 mr-3 text-blue-600" />
          真のアルコール係数分析
        </span>
        {showAnalysis ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
      </button>
      
      {showAnalysis && (
        <div className="border-t border-gray-200 p-6 space-y-6">
          
          {/* タンク選択UI */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold flex items-center">
                <TrendingUp className="w-5 h-5 mr-2 text-green-600" />
                分析対象タンク選択
              </h3>
              <button
                onClick={handleSelectAll}
                className="px-3 py-1 text-sm bg-blue-100 hover:bg-blue-200 text-blue-700 rounded"
              >
                {selectedAnalysisTanks.length === availableTanks.length ? '全解除' : '全選択'}
              </button>
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {availableTanks.map((tank) => {
                const isSelected = selectedAnalysisTanks.some(t => t.tankId === tank.tankId);
                const tankNumber = tank.metadata[COLUMN_NAMES.META.TANK_NUMBER] || '-';
                const yeast = tank.metadata[COLUMN_NAMES.META.YEAST] || '-';
                
                return (
                  <label
                    key={tank.tankId}
                    className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                      isSelected 
                        ? 'bg-blue-50 border-blue-300' 
                        : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => handleTankSelection(tank)}
                      className="mr-2"
                    />
                    <span className="font-medium">タンク {tankNumber}</span>
                    <div className="text-sm text-gray-600">{yeast}</div>
                  </label>
                );
              })}
            </div>
          </div>

          {selectedAnalysisTanks.length > 0 && (
            <>
              {/* 比較表 */}
              <div>
                <h3 className="text-lg font-semibold mb-4 flex items-center">
                  <BarChart3 className="w-5 h-5 mr-2 text-purple-600" />
                  比較表
                </h3>
                
                {selectedAnalysisTanks.map((tank) => {
                  const results = calculateTrueCoefficients(tank);
                  const tankNumber = tank.metadata[COLUMN_NAMES.META.TANK_NUMBER] || '-';
                  const yeast = tank.metadata[COLUMN_NAMES.META.YEAST] || '-';
                  
                  return (
                    <div key={tank.tankId} className="mb-6">
                      <h4 className="font-medium mb-3">タンク {tankNumber} ({yeast})</h4>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm border border-gray-200">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="px-3 py-2 border text-center">日数</th>
                              <th className="px-3 py-2 border text-center">積算追い水量(L)</th>
                              <th className="px-3 py-2 border text-center" colSpan="3">①追い水反映</th>
                              <th className="px-3 py-2 border text-center" colSpan="3">②追い水無視</th>
                            </tr>
                            <tr className="bg-gray-100">
                              <th className="px-3 py-2 border"></th>
                              <th className="px-3 py-2 border"></th>
                              <th className="px-3 py-2 border text-center">ボーメ</th>
                              <th className="px-3 py-2 border text-center">アルコール</th>
                              <th className="px-3 py-2 border text-center">真のアルコール係数</th>
                              <th className="px-3 py-2 border text-center">ボーメ</th>
                              <th className="px-3 py-2 border text-center">アルコール</th>
                              <th className="px-3 py-2 border text-center">真のアルコール係数</th>
                            </tr>
                          </thead>
                          <tbody>
                            {results.map((result, index) => (
                              <tr key={result.day} className={index === 0 ? 'bg-yellow-50' : 'hover:bg-gray-50'}>
                                <td className="px-3 py-2 border text-center font-medium">{result.day}</td>
                                <td className="px-3 py-2 border text-center">{result.cumulativeWater}</td>
                                <td className="px-3 py-2 border text-center">{result.withWater.baume.toFixed(2)}</td>
                                <td className="px-3 py-2 border text-center">{result.withWater.alcohol.toFixed(2)}</td>
                                <td className="px-3 py-2 border text-center">
                                  {result.withWater.coefficient ? result.withWater.coefficient.toFixed(3) : '-'}
                                </td>
                                <td className="px-3 py-2 border text-center">{result.withoutWater.baume.toFixed(2)}</td>
                                <td className="px-3 py-2 border text-center">{result.withoutWater.alcohol.toFixed(2)}</td>
                                <td className="px-3 py-2 border text-center">
                                  {result.withoutWater.coefficient ? result.withoutWater.coefficient.toFixed(3) : '-'}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* グラフ */}
              <div className="bg-gray-50 p-6 rounded-lg">
                <h3 className="text-lg font-semibold mb-4">真のアルコール係数推移</h3>
                <div className="h-96">
                  <Line data={generateChartData()} options={chartOptions} />
                </div>
                <div className="mt-4 text-sm text-gray-600">
                  <p>• 実線：①追い水反映（追い水投入前の濃度に逆算）</p>
                  <p>• 破線：②追い水無視（補完データそのまま）</p>
                  <p>• 黄色背景：基準日（アルコール測定開始日）</p>
                </div>
              </div>

              {/* 分析結果の考察 */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="font-semibold text-blue-800 mb-2">分析結果の見方</h4>
                <div className="text-sm text-blue-700 space-y-1">
                  <p>• 真のアルコール係数が高い = 発酵効率が良い（ボーメ1度減少あたりのアルコール生成量が多い）</p>
                  <p>• ①と②の差 = 追い水による希釈効果が発酵効率計算に与える影響</p>
                  <p>• 係数の推移 = 発酵段階による効率変化（通常は発酵後期に向けて低下）</p>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default TrueAlcoholCoefficient;