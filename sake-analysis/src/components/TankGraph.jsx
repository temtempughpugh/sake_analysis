import React, { useState, useEffect } from 'react';
import { Line, Scatter } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, BarElement, Title, Tooltip, Legend } from 'chart.js';
import 'chartjs-plugin-zoom';
import { splineInterpolation } from '../utils/mathUtils';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, Title, Tooltip, Legend);

const colorPalette = [
  '#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8',
  '#F7DC6F', '#BB8FCE', '#85C1E2', '#FF99CC', '#66CCCC',
];

const TankGraph = ({ tanks, selectedTankIds }) => {
  const [selectedGraphs, setSelectedGraphs] = useState(() => {
    const saved = localStorage.getItem('selectedGraphs');
    return saved ? JSON.parse(saved) : ['temperature', 'baume', 'alcohol', 'bmd', 'ab', 'alcohol_coeff'];
  });
  const [graphPeriods, setGraphPeriods] = useState(() => {
    const saved = localStorage.getItem('graphPeriods');
    return saved ? JSON.parse(saved) : {
      temperature: { startDay: 5, endDay: 24 },
      baume: { startDay: 5, endDay: 24 },
      alcohol: { startDay: 8, endDay: 24 },
      bmd: { startDay: 5, endDay: 24 },
      ab: { startDay: 5, endDay: 24 },
      alcohol_coeff: { startDay: 8, endDay: 24 },
    };
  });
  const [showOisui, setShowOisui] = useState(() => {
    const saved = localStorage.getItem('showOisui');
    return saved ? JSON.parse(saved) : {
      temperature: true,
      baume: true,
      alcohol: true,
      bmd: true,
      alcohol_coeff: true,
    };
  });
  const [highlightedTank, setHighlightedTank] = useState(null);

  useEffect(() => {
    localStorage.setItem('selectedGraphs', JSON.stringify(selectedGraphs));
  }, [selectedGraphs]);

  useEffect(() => {
    localStorage.setItem('graphPeriods', JSON.stringify(graphPeriods));
  }, [graphPeriods]);

  useEffect(() => {
    localStorage.setItem('showOisui', JSON.stringify(showOisui));
  }, [showOisui]);

  // 入力データの検証
  console.log('Input tanks:', tanks);
  console.log('Input selectedTankIds:', selectedTankIds);
  if (!tanks || !Array.isArray(tanks) || !selectedTankIds || !Array.isArray(selectedTankIds) || selectedTankIds.length === 0) {
    console.warn('Invalid input: tanks or selectedTankIds is invalid');
    return <div className="mt-4 text-sm text-gray-600">タンクを選択してください</div>;
  }

  const selectedTanks = tanks.filter(tank => {
    if (!tank || !tank.tankId || !tank.metadata || !tank.dailyData) {
      console.warn('Invalid tank data:', tank);
      return false;
    }
    return selectedTankIds.includes(tank.tankId);
  });
  console.log('Selected tanks:', selectedTanks);

  if (selectedTanks.length === 0) {
    console.warn('No valid tanks selected');
    return <div className="mt-4 text-sm text-gray-600">有効なタンクデータがありません</div>;
  }

  // データ範囲の動的計算
  const calculateRange = (metric, graphId, tanks = selectedTanks) => {
    const values = tanks.flatMap(tank =>
      Object.values(tank.dailyData || {})
        .map(data => data && data[metric])
        .filter(v => v !== null && v !== undefined)
    );
    if (!values.length) {
      console.warn(`No valid data for ${metric} in ${graphId}`);
      return { min: 0, max: 1 };
    }
    const min = Math.min(...values);
    const max = Math.max(...values);
    const padding = (max - min) * 0.1 || 1;
    return { min: min - padding, max: max + padding };
  };

  const getDays = (graphId) => {
    const { startDay, endDay } = graphPeriods[graphId] || { startDay: 5, endDay: 24 };
    return Array.from(
      { length: (endDay || 24) - (startDay || 5) + 1 },
      (_, i) => i + (startDay || 5)
    );
  };

  // グラフ定義
  const graphs = [
    {
      id: 'temperature',
      title: '品温経過グラフ',
      yAxis: '品温1回目',
      yRange: calculateRange('品温1回目', 'temperature'),
      type: 'line',
      datasets: selectedTanks.map((tank, index) => {
        const data = getDays('temperature')
          .map(day => {
            const y = tank.dailyData?.[day]?.['品温1回目'];
            const tempChange = tank.dailyData?.[day]?.['品温上下'] || '';
            let color;
            if (['上げ強', '上げ弱'].includes(tempChange)) {
              color = 'red';
            } else if (['下げ強', '下げ弱'].includes(tempChange)) {
              color = 'blue';
            } else {
              color = 'gray';
            }
            return y !== null && y !== undefined ? { x: day, y, color } : null;
          })
          .filter(d => d !== null);
        console.log(`Temperature data for tank ${tank.metadata?.['順号'] || 'unknown'}:`, data);
        return {
          label: `タンク ${tank.metadata?.['順号'] || '不明'} (${tank.metadata?.['酵母'] || '不明'})`,
          data,
          borderColor: data.map(d => highlightedTank && tank.tankId !== highlightedTank ? 'rgba(0,0,0,0.1)' : d.color),
          backgroundColor: data.map(d => highlightedTank && tank.tankId !== highlightedTank ? 'rgba(0,0,0,0.1)' : d.color.replace('1)', '0.2)')),
          borderWidth: 3,
          fill: false,
          spanGaps: false,
          hidden: highlightedTank && tank.tankId !== highlightedTank,
          tension: 0,
        };
      }),
      extraDatasets: [
        {
          label: '追い水',
          data: getDays('temperature')
            .map(day => {
              const y = selectedTanks.reduce((sum, tank) => sum + (tank.dailyData?.[day]?.['追い水'] ?? 0), 0);
              return y !== null && y !== undefined ? { x: day, y } : null;
            })
            .filter(d => d !== null),
          type: 'bar',
          yAxisID: 'y2',
          backgroundColor: 'rgba(135,206,235,0.5)',
          hidden: !showOisui.temperature,
        },
        ...selectedTanks.map((tank, index) => ({
          label: `積算品温 ${tank.metadata?.['順号'] || '不明'}`,
          data: [{
            x: graphPeriods.temperature.startDay + index * 0.2,
            y: tank.metadata?.['5日までの積算品温'] || 0,
          }],
          type: 'bar',
          yAxisID: 'y2',
          backgroundColor: colorPalette[index % colorPalette.length].replace('1)', '0.5)'),
          hidden: highlightedTank && tank.tankId !== highlightedTank,
        })),
      ],
      options: {
        scales: {
          x: { title: { display: true, text: '日数' }, min: graphPeriods.temperature.startDay, max: graphPeriods.temperature.endDay },
          y: { title: { display: true, text: '品温 (°C)' }, ...calculateRange('品温1回目', 'temperature') },
          y2: {
            position: 'right',
            title: { display: true, text: '追い水/積算品温' },
            min: 0,
            max: Math.max(
              calculateRange('追い水', 'temperature').max,
              ...selectedTanks.map(tank => tank.metadata?.['5日までの積算品温'] || 0) * 1.1
            ) || 1,
          },
        },
      },
    },
    {
      id: 'baume',
      title: 'ボーメ経過グラフ',
      yAxis: 'ボーメ（追い水後）',
      yRange: calculateRange('ボーメ（追い水後）', 'baume'),
      type: 'line',
      datasets: selectedTanks.map((tank, index) => {
        const rawData = getDays('baume').map(day => tank.dailyData?.[day]?.['ボーメ（追い水後）'] ?? tank.dailyData?.[day]?.['ボーメ（補完）'] ?? null);
        const filteredData = rawData.map((y, i) => y !== null && y !== undefined ? { x: getDays('baume')[i], y } : null).filter(d => d !== null);
        console.log(`Baume data for tank ${tank.metadata?.['順号'] || 'unknown'}:`, filteredData);
        return {
          label: `タンク ${tank.metadata?.['順号'] || '不明'} (${tank.metadata?.['酵母'] || '不明'})`,
          data: splineInterpolation(getDays('baume'), rawData),
          borderColor: highlightedTank && tank.tankId !== highlightedTank ? 'rgba(0,0,0,0.1)' : colorPalette[index % colorPalette.length],
          backgroundColor: highlightedTank && tank.tankId !== highlightedTank ? 'rgba(0,0,0,0.1)' : colorPalette[index % colorPalette.length].replace('1)', '0.8)'),
          borderWidth: 2.5,
          fill: false,
          spanGaps: false,
          tension: 0.4,
          hidden: highlightedTank && tank.tankId !== highlightedTank,
        };
      }),
      extraDatasets: [
        {
          label: '追い水',
          data: getDays('baume')
            .map(day => {
              const y = selectedTanks.reduce((sum, tank) => sum + (tank.dailyData?.[day]?.['追い水'] ?? 0), 0);
              return y !== null && y !== undefined ? { x: day, y } : null;
            })
            .filter(d => d !== null),
          type: 'bar',
          yAxisID: 'y2',
          backgroundColor: 'rgba(135,206,235,0.5)',
          hidden: !showOisui.baume,
        },
      ],
      options: {
        scales: {
          x: { title: { display: true, text: '日数' }, min: graphPeriods.baume.startDay, max: graphPeriods.baume.endDay },
          y: { title: { display: true, text: 'ボーメ' }, ...calculateRange('ボーメ（追い水後）', 'baume') },
          y2: { position: 'right', title: { display: true, text: '追い水量' }, min: 0, max: calculateRange('追い水', 'baume').max || 1 },
        },
      },
    },
    {
      id: 'alcohol',
      title: 'アルコール経過グラフ',
      yAxis: 'アルコール（追い水後）',
      yRange: { min: 0, max: 20 },
      type: 'line',
      datasets: selectedTanks.map((tank, index) => {
        const rawData = getDays('alcohol').map(day => tank.dailyData?.[day]?.['アルコール（追い水後）'] ?? tank.dailyData?.[day]?.['アルコール（補完）'] ?? null);
        const filteredData = rawData.map((y, i) => y !== null && y !== undefined ? { x: getDays('alcohol')[i], y } : null).filter(d => d !== null);
        console.log(`Alcohol data for tank ${tank.metadata?.['順号'] || 'unknown'}:`, filteredData);
        return {
          label: `タンク ${tank.metadata?.['順号'] || '不明'} (${tank.metadata?.['酵母'] || '不明'})`,
          data: splineInterpolation(getDays('alcohol'), rawData),
          borderColor: highlightedTank && tank.tankId !== highlightedTank ? 'rgba(0,0,0,0.1)' : colorPalette[index % colorPalette.length],
          backgroundColor: highlightedTank && tank.tankId !== highlightedTank ? 'rgba(0,0,0,0.1)' : colorPalette[index % colorPalette.length].replace('1)', '0.8)'),
          borderWidth: 2.5,
          fill: false,
          spanGaps: false,
          tension: 0.4,
          hidden: highlightedTank && tank.tankId !== highlightedTank,
        };
      }),
      extraDatasets: [
        {
          label: '追い水',
          data: getDays('alcohol')
            .map(day => {
              const y = selectedTanks.reduce((sum, tank) => sum + (tank.dailyData?.[day]?.['追い水'] ?? 0), 0);
              return y !== null && y !== undefined ? { x: day, y } : null;
            })
            .filter(d => d !== null),
          type: 'bar',
          yAxisID: 'y2',
          backgroundColor: 'rgba(135,206,235,0.5)',
          hidden: !showOisui.alcohol,
        },
      ],
      options: {
        scales: {
          x: { title: { display: true, text: '日数' }, min: graphPeriods.alcohol.startDay, max: graphPeriods.alcohol.endDay },
          y: { title: { display: true, text: 'アルコール (%)' }, min: 0, max: 20, ticks: { stepSize: 1 } },
          y2: { position: 'right', title: { display: true, text: '追い水量' }, min: 0, max: calculateRange('追い水', 'alcohol').max || 1 },
        },
      },
    },
    {
      id: 'bmd',
      title: 'BMD経過グラフ',
      yAxis: 'BMD（補完）',
      yRange: calculateRange('BMD（補完）', 'bmd'),
      type: 'line',
      datasets: selectedTanks.map((tank, index) => {
        const data = getDays('bmd')
          .map(day => {
            const y = tank.dailyData?.[day]?.['BMD（補完）'];
            return y !== null && y !== undefined ? { x: day, y } : null;
          })
          .filter(d => d !== null);
        console.log(`BMD data for tank ${tank.metadata?.['順号'] || 'unknown'}:`, data);
        const maxBMD = data.length > 0 ? Math.max(...data.map(d => d.y)) : 0;
        const maxBMDIndex = data.findIndex(d => d.y === maxBMD);
        return {
          label: `タンク ${tank.metadata?.['順号'] || '不明'} (${tank.metadata?.['酵母'] || '不明'})`,
          data,
          borderColor: highlightedTank && tank.tankId !== highlightedTank ? 'rgba(0,0,0,0.1)' : colorPalette[index % colorPalette.length],
          backgroundColor: highlightedTank && tank.tankId !== highlightedTank ? 'rgba(0,0,0,0.1)' : colorPalette[index % colorPalette.length].replace('1)', '0.2)'),
          borderWidth: 2.5,
          fill: false,
          spanGaps: false,
          tension: 0.4,
          pointRadius: data.map((_, i) => i === maxBMDIndex ? 6 : 3),
          hidden: highlightedTank && tank.tankId !== highlightedTank,
        };
      }),
      extraDatasets: [
        {
          label: '追い水',
          data: getDays('bmd')
            .map(day => {
              const y = selectedTanks.reduce((sum, tank) => sum + (tank.dailyData?.[day]?.['追い水'] ?? 0), 0);
              return y !== null && y !== undefined ? { x: day, y } : null;
            })
            .filter(d => d !== null),
          type: 'bar',
          yAxisID: 'y2',
          backgroundColor: 'rgba(135,206,235,0.5)',
          hidden: !showOisui.bmd,
        },
      ],
      options: {
        scales: {
          x: { title: { display: true, text: '日数' }, min: graphPeriods.bmd.startDay, max: graphPeriods.bmd.endDay },
          y: { title: { display: true, text: 'BMD' }, ...calculateRange('BMD（補完）', 'bmd'), grid: { lineWidth: d => d.value === 0 ? 2 : 1, color: d => d.value === 0 ? 'gray' : 'rgba(0,0,0,0.1)' } },
          y2: { position: 'right', title: { display: true, text: '追い水量' }, min: 0, max: calculateRange('追い水', 'bmd').max || 1 },
        },
      },
    },
    {
      id: 'ab',
      title: 'AB直線グラフ',
      yAxis: '最終アルコール',
      xAxis: '最終ボーメ',
      type: 'scatter',
      datasets: selectedTanks
        .map((tank, index) => {
          if (!tank.metadata || !tank.dailyData || typeof tank.metadata !== 'object' || typeof tank.dailyData !== 'object') {
            console.warn(`Invalid tank data for AB graph, tankId: ${tank.tankId}`, tank);
            return null;
          }
          const startPoint = {
            x: tank.metadata['AB開始ボーメ'] ?? null,
            y: tank.metadata['AB開始アルコール'] ?? null,
          };
          const endPoint = {
            x: tank.metadata['最終ボーメ'] ?? null,
            y: tank.metadata['最終アルコール'] ?? null,
          };
          const dailyData = getDays('ab')
            .map(day => {
              const x = tank.dailyData[day]?.['ボーメ（追い水後）'];
              const y = tank.dailyData[day]?.['アルコール（追い水後）'];
              return x !== null && y !== null && x !== undefined && y !== undefined ? { x, y } : null;
            })
            .filter(d => d !== null);
          console.log(`AB data for tank ${tank.metadata?.['順号'] || 'unknown'}:`, { dailyData, startPoint, endPoint });
          if (dailyData.length === 0 && (startPoint.x === null || startPoint.y === null) && (endPoint.x === null || endPoint.y === null)) {
            console.warn(`No valid data for AB graph, tankId: ${tank.tankId}`);
            return null;
          }
          const lineData = [startPoint, endPoint].filter(d => d.x !== null && d.y !== null);
          const datasets = [
            {
              label: `タンク ${tank.metadata?.['順号'] || '不明'} (${tank.metadata?.['酵母'] || '不明'})`,
              data: dailyData,
              pointStyle: ['circle', 'triangle', 'rect', 'rectRot'][index % 4],
              pointRadius: 8,
              backgroundColor: highlightedTank && tank.tankId !== highlightedTank ? 'rgba(0,0,0,0.1)' : colorPalette[index % colorPalette.length],
              hidden: highlightedTank && tank.tankId !== highlightedTank,
            },
          ];
          if (lineData.length >= 2) {
            datasets.push({
              label: `直線 ${tank.metadata?.['順号'] || '不明'}`,
              data: lineData,
              type: 'line',
              borderColor: colorPalette[index % colorPalette.length],
              borderDash: [5, 5],
              pointRadius: 0,
              fill: false,
              hidden: highlightedTank && tank.tankId !== highlightedTank,
            });
          }
          return datasets;
        })
        .filter(ds => ds !== null)
        .flat()
        .filter(ds => ds && ds.data && Array.isArray(ds.data) && ds.data.length > 0),
      options: {
        scales: {
          x: {
            title: { display: true, text: 'ボーメ' },
            min: Math.min(
              calculateRange('ボーメ（追い水後）', 'ab').min,
              ...selectedTanks.map(tank => tank.metadata?.['AB開始ボーメ'] ?? Infinity).filter(v => v !== Infinity),
              ...selectedTanks.map(tank => tank.metadata?.['最終ボーメ'] ?? Infinity).filter(v => v !== Infinity)
            ) * 0.9 || 0,
            max: Math.max(
              calculateRange('ボーメ（追い水後）', 'ab').max,
              ...selectedTanks.map(tank => tank.metadata?.['AB開始ボーメ'] ?? -Infinity).filter(v => v !== -Infinity),
              ...selectedTanks.map(tank => tank.metadata?.['最終ボーメ'] ?? -Infinity).filter(v => v !== -Infinity)
            ) * 1.1 || 1,
          },
          y: { title: { display: true, text: 'アルコール (%)' }, min: 0, max: 20 },
        },
      },
    },
    {
      id: 'alcohol_coeff',
      title: 'アルコール係数推移グラフ',
      yAxis: 'アルコール係数（追い水反映）',
      yRange: calculateRange('アルコール係数（追い水反映）', 'alcohol_coeff'),
      type: 'line',
      datasets: selectedTanks.map((tank, index) => {
        const data = getDays('alcohol_coeff')
          .map(day => {
            const y = tank.dailyData?.[day]?.['アルコール係数（追い水反映）'];
            return y !== null && y !== undefined ? { x: day, y, backgroundColor: y >= 3 ? 'red' : null } : null;
          })
          .filter(d => d !== null);
        console.log(`Alcohol coeff data for tank ${tank.metadata?.['順号'] || 'unknown'}:`, data);
        return {
          label: `タンク ${tank.metadata?.['順号'] || '不明'} (${tank.metadata?.['酵母'] || '不明'})`,
          data,
          borderColor: highlightedTank && tank.tankId !== highlightedTank ? 'rgba(0,0,0,0.1)' : colorPalette[index % colorPalette.length],
          backgroundColor: data.map(d => d.backgroundColor || (highlightedTank && tank.tankId !== highlightedTank ? 'rgba(0,0,0,0.1)' : colorPalette[index % colorPalette.length].replace('1)', '0.2)'))),
          borderWidth: 2.5,
          fill: false,
          spanGaps: false,
          tension: 0.4,
          pointRadius: data.map(d => d.backgroundColor ? 6 : 3),
          hidden: highlightedTank && tank.tankId !== highlightedTank,
        };
      }),
      extraDatasets: [
        {
          label: '追い水',
          data: getDays('alcohol_coeff')
            .map(day => {
              const y = selectedTanks.reduce((sum, tank) => sum + (tank.dailyData?.[day]?.['追い水'] ?? 0), 0);
              return y !== null && y !== undefined ? { x: day, y } : null;
            })
            .filter(d => d !== null),
          type: 'bar',
          yAxisID: 'y2',
          backgroundColor: 'rgba(135,206,235,0.5)',
          hidden: !showOisui.alcohol_coeff,
        },
      ],
      options: {
        scales: {
          x: { title: { display: true, text: '日数' }, min: graphPeriods.alcohol_coeff.startDay, max: graphPeriods.alcohol_coeff.endDay },
          y: { title: { display: true, text: 'アルコール係数' }, ...calculateRange('アルコール係数（追い水反映）', 'alcohol_coeff') },
          y2: { position: 'right', title: { display: true, text: '追い水量' }, min: 0, max: calculateRange('追い水', 'alcohol_coeff').max || 1 },
        },
      },
    },
  ];

  const handleGraphSelection = (graphId) => {
    setSelectedGraphs(prev => {
      if (prev.includes(graphId)) {
        return prev.filter(id => id !== graphId);
      }
      return [...prev, graphId];
    });
  };

  const handlePeriodChange = (graphId, type, value) => {
    setGraphPeriods(prev => {
      const newPeriod = { ...prev[graphId], [type]: value === '' ? '' : parseInt(value) };
      const newPeriods = { ...prev, [graphId]: newPeriod };
      if (newPeriod.startDay >= 2 && (newPeriod.endDay >= newPeriod.startDay || !newPeriod.endDay)) {
        localStorage.setItem('graphPeriods', JSON.stringify(newPeriods));
      }
      return newPeriods;
    });
  };

  const handleOisuiChange = (graphId) => {
    setShowOisui(prev => ({
      ...prev,
      [graphId]: !prev[graphId],
    }));
  };

  const handleLegendClick = (e, legendItem, legend) => {
    const index = legendItem.datasetIndex;
    const chart = legend.chart;
    chart.data.datasets.forEach((ds, i) => {
      if (i !== index && ds.label.includes('タンク')) {
        ds.hidden = !legendItem.hidden;
      }
    });
    chart.data.datasets[index].hidden = legendItem.hidden;
    const tankIndex = Math.floor(index / (graphs.find(g => g.id === chart.canvas.id).datasets.length / selectedTanks.length));
    setHighlightedTank(legendItem.hidden ? null : selectedTanks[tankIndex]?.tankId);
    chart.update();
  };

  const handlePointClick = (e, elements, chart) => {
    if (elements.length) {
      const datasetIndex = elements[0].datasetIndex;
      const tankIndex = Math.floor(datasetIndex / (graphs.find(g => g.id === chart.canvas.id).datasets.length / selectedTanks.length));
      const tankId = selectedTanks[tankIndex]?.tankId;
      setHighlightedTank(highlightedTank === tankId ? null : tankId);
      chart.data.datasets.forEach((ds, i) => {
        ds.hidden = i !== datasetIndex && ds.label.includes('タンク');
      });
      chart.update();
    }
  };

  const handleDoubleClick = (chart) => {
    setHighlightedTank(null);
    chart.data.datasets.forEach(ds => {
      ds.hidden = ds.label === '追い水' ? !showOisui[chart.canvas.id] : false;
    });
    chart.update();
  };

  return (
    <div className="mt-4">
      <div className="mb-4">
        <h3 className="text-lg font-semibold mb-2">表示するグラフを選択</h3>
        <div className="flex flex-wrap gap-4">
          {graphs.map(graph => (
            <label key={graph.id} className="inline-flex items-center">
              <input
                type="checkbox"
                checked={selectedGraphs.includes(graph.id)}
                onChange={() => handleGraphSelection(graph.id)}
                className="rounded border-gray-400"
              />
              <span className="ml-1 text-sm">{graph.title}</span>
            </label>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {graphs.filter(graph => selectedGraphs.includes(graph.id)).map(graph => (
          <div key={graph.id} className="bg-white rounded-lg shadow-lg border border-gray-200 p-4 max-w-full">
            <h3 className="text-lg font-semibold mb-2">{graph.title}</h3>
            <div className="mb-2 flex space-x-4">
              <div>
                <label className="text-sm font-medium text-gray-700 mr-2">期間:</label>
                <input
                  type="number"
                  placeholder="開始日"
                  value={graphPeriods[graph.id]?.startDay || ''}
                  onChange={(e) => handlePeriodChange(graph.id, 'startDay', e.target.value)}
                  className="w-24 p-1 border border-gray-300 rounded text-sm mr-2"
                  min="2"
                />
                <input
                  type="number"
                  placeholder="終了日"
                  value={graphPeriods[graph.id]?.endDay || ''}
                  onChange={(e) => handlePeriodChange(graph.id, 'endDay', e.target.value)}
                  className="w-24 p-1 border border-gray-300 rounded text-sm"
                  min={graphPeriods[graph.id]?.startDay || 2}
                />
              </div>
              {['temperature', 'baume', 'alcohol', 'bmd', 'alcohol_coeff'].includes(graph.id) && (
                <div>
                  <label className="inline-flex items-center">
                    <input
                      type="checkbox"
                      checked={showOisui[graph.id]}
                      onChange={() => handleOisuiChange(graph.id)}
                      className="rounded border-gray-400"
                    />
                    <span className="ml-1 text-sm">追い水表示</span>
                  </label>
                </div>
              )}
            </div>
            {graph.type === 'scatter' ? (
              <Scatter
                data={{ datasets: Array.isArray(graph.datasets) && graph.datasets.length ? [...graph.datasets, ...(Array.isArray(graph.extraDatasets) ? graph.extraDatasets : [])] : [] }}
                options={{
                  ...graph.options,
                  responsive: true,
                  maintainAspectRatio: true,
                  aspectRatio: 16/9,
                  plugins: {
                    legend: { position: 'bottom', onClick: handleLegendClick },
                    tooltip: { enabled: true },
                    zoom: { pan: { enabled: true, mode: 'x' }, zoom: { wheel: { enabled: true }, pinch: { enabled: true }, mode: 'x' } },
                  },
                  onClick: handlePointClick,
                  onDblClick: (e, _, chart) => handleDoubleClick(chart),
                  contextMenu: { enabled: true },
                }}
                id={graph.id}
              />
            ) : (
              <Line
                data={{ labels: getDays(graph.id), datasets: Array.isArray(graph.datasets) && graph.datasets.length ? [...graph.datasets, ...(Array.isArray(graph.extraDatasets) ? graph.extraDatasets : [])] : [] }}
                options={{
                  ...graph.options,
                  responsive: true,
                  maintainAspectRatio: true,
                  aspectRatio: 16/9,
                  plugins: {
                    legend: { position: 'bottom', onClick: handleLegendClick },
                    tooltip: { enabled: true },
                    zoom: { pan: { enabled: true, mode: 'x' }, zoom: { wheel: { enabled: true }, pinch: { enabled: true }, mode: 'x' } },
                  },
                  onClick: handlePointClick,
                  onDblClick: (e, _, chart) => handleDoubleClick(chart),
                  contextMenu: { enabled: true },
                }}
                id={graph.id}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default TankGraph;