import React, { useState, useEffect } from 'react';
import { Line, Scatter } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, BarElement, Title, Tooltip, Legend } from 'chart.js';
import 'chartjs-plugin-zoom';
import { COLUMN_NAMES } from '../utils/csvParser';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, Title, Tooltip, Legend);

const colorPalette = [
  '#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8',
  '#F7DC6F', '#BB8FCE', '#85C1E2', '#FF99CC', '#66CCCC',
];

// 列定義をTankGraph内で定義
const columns = [
  { key: COLUMN_NAMES.META.TANK_NUMBER, label: '順号', fixed: true, isNumeric: true },
  { key: COLUMN_NAMES.META.BATCH_SIZE, label: '仕込み規模', fixed: true, isNumeric: true },
  { key: COLUMN_NAMES.META.YEAST, label: '酵母', fixed: true, isNumeric: false },
  { key: COLUMN_NAMES.META.DESIGN, label: '酒質設計', fixed: true, isNumeric: false },
  { key: COLUMN_NAMES.META.SPECIFIC_NAME, label: '特定名称', fixed: false, isNumeric: false },
  { key: COLUMN_NAMES.META.TOTAL_VOLUME, label: '仕込み総量', fixed: false, isNumeric: true },
  { key: COLUMN_NAMES.META.TEMP_SUM_5DAYS, label: '積算品温(4日)', fixed: false, isNumeric: true },
  { key: COLUMN_NAMES.META.MAX_BAUME, label: '最高ボーメ', fixed: false, isNumeric: true },
  { key: COLUMN_NAMES.META.AB_START_BAUME, label: 'AB開始ボーメ', fixed: false, isNumeric: true },
  { key: COLUMN_NAMES.META.AB_START_ALCOHOL, label: 'AB開始アルコール', fixed: false, isNumeric: true },
  { key: COLUMN_NAMES.META.FINAL_BAUME, label: '最終ボーメ', fixed: false, isNumeric: true },
  { key: COLUMN_NAMES.META.FINAL_ALCOHOL, label: '最終アルコール', fixed: false, isNumeric: true },
  { key: COLUMN_NAMES.META.MAX_BMD, label: '最高BMD', fixed: false, isNumeric: true },
  { key: COLUMN_NAMES.META.MAX_BMD_DAY, label: '最高BMD日数', fixed: false, isNumeric: true },
  { key: COLUMN_NAMES.META.TOTAL_WATER, label: '追い水総量', fixed: false, isNumeric: true },
  { key: COLUMN_NAMES.META.WATER_RATIO, label: '追い水歩合', fixed: false, isNumeric: true },
  { key: COLUMN_NAMES.META.LATE_WATER, label: '後半追い水量', fixed: false, isNumeric: true },
  { key: COLUMN_NAMES.META.LATE_WATER_RATIO, label: '後半追い水割合', fixed: false, isNumeric: true },
];

const dailyMetrics = [
  COLUMN_NAMES.DAILY.TEMP_1,
  COLUMN_NAMES.DAILY.BAUME_AFTER_WATER,
  COLUMN_NAMES.DAILY.ALCOHOL_AFTER_WATER,
  COLUMN_NAMES.DAILY.BMD_COMPLEMENT,
  COLUMN_NAMES.DAILY.ALCOHOL_COEFF_WATER,
];

const TankGraph = ({ tanks = [], selectedTankIds = [] }) => {
  const [selectedGraphs, setSelectedGraphs] = useState(['temperature', 'baume', 'alcohol', 'bmd', 'ab', 'alcohol_coeff']);
  const [graphPeriods, setGraphPeriods] = useState({
    temperature: { startDay: 5, endDay: 24 },
    baume: { startDay: 5, endDay: 24 },
    alcohol: { startDay: 9, endDay: 24 },
    bmd: { startDay: 5, endDay: 24 },
    ab: { startDay: 9, endDay: 24 },
    alcohol_coeff: { startDay: 5, endDay: 24 },
  });
  const [showOisui, setShowOisui] = useState({
    temperature: true,
    baume: true,
    alcohol: true,
    bmd: true,
    alcohol_coeff: true,
  });
  const [selectedTanksState, setSelectedTanksState] = useState([]);
  const [selectedTanksByGraph, setSelectedTanksByGraph] = useState({});

  useEffect(() => {
    console.log('Tanks and selectedTankIds updated:', { tanks, selectedTankIds });
    const newSelectedTanks = Array.isArray(tanks) ? tanks.filter(tank => Array.isArray(selectedTankIds) && selectedTankIds.includes(tank.tankId)) : [];
    setSelectedTanksState(newSelectedTanks || []);

    // 初期状態: すべてのタンクを各グラフで選択
    const initialSelection = {};
    selectedGraphs.forEach(graphId => {
      initialSelection[graphId] = {};
      newSelectedTanks.forEach(tank => {
        initialSelection[graphId][tank.tankId] = true;
      });
    });
    setSelectedTanksByGraph(initialSelection);
  }, [tanks, selectedTankIds, selectedGraphs]);

  useEffect(() => {
    localStorage.setItem('graphPeriods', JSON.stringify(graphPeriods));
  }, [graphPeriods]);

  useEffect(() => {
    localStorage.setItem('showOisui', JSON.stringify(showOisui));
  }, [showOisui]);

  const graphs = [
    { id: 'temperature', title: '品温経過グラフ', yAxis: COLUMN_NAMES.DAILY.TEMP_1, yRange: { min: 5, max: 15 }, type: 'line' },
    { id: 'baume', title: 'ボーメ経過グラフ', yAxis: COLUMN_NAMES.DAILY.BAUME_AFTER_WATER, yRange: { min: -2, max: 10 }, type: 'line' },
    { id: 'alcohol', title: 'アルコール経過グラフ', yAxis: COLUMN_NAMES.DAILY.ALCOHOL_AFTER_WATER, yRange: { min: 5, max: 20 }, type: 'line' },
    { id: 'bmd', title: 'BMD経過グラフ', yAxis: COLUMN_NAMES.DAILY.BMD_COMPLEMENT, yRange: { min: -30, max: 50 }, type: 'line' },
    { id: 'ab', title: 'アルコール vs ボーメ', xAxis: COLUMN_NAMES.DAILY.ALCOHOL, yAxis: COLUMN_NAMES.DAILY.BAUME_BMD_DAY, yRange: { min: -2, max: 6 }, type: 'scatter' },
    { id: 'alcohol_coeff', title: 'アルコール係数推移グラフ', yAxis: COLUMN_NAMES.DAILY.ALCOHOL_COEFF_WATER, yRange: { min: 0, max: 3.0 }, type: 'line' },
  ];

  const getAvailableDays = (tank, graphId) => {
    if (!tank || !tank.dailyData || typeof tank.dailyData !== 'object') {
      console.warn('Invalid tank data for graphId:', graphId, tank);
      return [];
    }
    const { startDay, endDay } = graphPeriods[graphId] || { startDay: 5, endDay: 24 };
    return Object.keys(tank.dailyData)
      .filter(day => {
        const d = parseInt(day);
        return !isNaN(d) && d >= startDay && d <= endDay;
      })
      .map(day => parseInt(day))
      .sort((a, b) => a - b);
  };

  const calculateStats = (data, key) => {
    const values = Object.values(data).map(d => d[key]).filter(v => v !== null && !isNaN(v));
    return {
      average: values.length ? (values.reduce((a, b) => a + b, 0) / values.length).toFixed(2) : '-',
      max: values.length ? Math.max(...values).toFixed(2) : '-',
      min: values.length ? Math.min(...values).toFixed(2) : '-',
    };
  };

  const getDatasets = (graph) => {
    console.log('Generating datasets for graph:', graph.id, 'with selectedTanksByGraph:', selectedTanksByGraph[graph.id]);
    const datasets = [];
    selectedTanksState.forEach((tank, index) => {
      if (!tank || !tank.dailyData) {
        console.warn('Skipping invalid tank data:', tank);
        return;
      }
      const availableDays = getAvailableDays(tank, graph.id);
      const isSelected = selectedTanksByGraph[graph.id]?.[tank.tankId] || false;
      if (graph.id === 'ab') {
        // AB散布図は追い水を含まず、散布データと直線のみ
        const scatterData = availableDays.map(day => {
          const dayData = tank.dailyData[day];
          return dayData && dayData[graph.xAxis] !== null && dayData[graph.yAxis] !== null
            ? { x: parseFloat(dayData[graph.xAxis]), y: parseFloat(dayData[graph.yAxis]) }
            : null;
        }).filter(d => d !== null);
        if (scatterData.length > 0 && isSelected) {
          datasets.push({
            label: `タンク ${tank.metadata[COLUMN_NAMES.META.TANK_NUMBER] || index + 1}`,
            data: scatterData,
            pointStyle: ['circle', 'triangle', 'rect', 'rectRot'][index % 4],
            pointRadius: 4,
            backgroundColor: colorPalette[index % colorPalette.length],
            hidden: !isSelected,
          });
        }
        const startX = parseFloat(tank.metadata[COLUMN_NAMES.META.AB_START_ALCOHOL]) || 0;
        const startY = parseFloat(tank.metadata[COLUMN_NAMES.META.AB_START_BAUME]) || 0;
        const endX = parseFloat(tank.metadata[COLUMN_NAMES.META.FINAL_ALCOHOL]) || 0;
        const endY = parseFloat(tank.metadata[COLUMN_NAMES.META.FINAL_BAUME]) || 0;
        if (startX && startY && endX && endY && isSelected) {
          datasets.push({
            label: `直線 ${tank.metadata[COLUMN_NAMES.META.TANK_NUMBER] || index + 1}`,
            data: [{ x: startX, y: startY }, { x: endX, y: endY }],
            type: 'line',
            borderColor: colorPalette[index % colorPalette.length],
            borderDash: [5, 5],
            pointRadius: 0,
            fill: false,
            hidden: !isSelected,
          });
        }
      } else {
        // 線グラフはデータと追い水
        const rawData = availableDays.map(day => {
          const dayData = tank.dailyData[day];
          return dayData && dayData[graph.yAxis] !== null ? parseFloat(dayData[graph.yAxis]) : null;
        }).filter(v => v !== null);
        if (rawData.length > 0 && isSelected) {
          datasets.push({
            label: `タンク ${tank.metadata[COLUMN_NAMES.META.TANK_NUMBER] || index + 1} (酵母: ${tank.metadata[COLUMN_NAMES.META.YEAST] || '-'})`,
            data: rawData,
            borderColor: colorPalette[index % colorPalette.length],
            backgroundColor: colorPalette[index % colorPalette.length].replace('1)', '0.2'),
            borderWidth: 2.5,
            fill: false,
            spanGaps: true,
            tension: 0,
            pointRadius: graph.id === 'bmd' ? rawData.map((v, i) => (v === Math.max(...rawData) ? 6 : 3)) : 3,
            hidden: !isSelected,
          });
        }
        const waterData = availableDays.map(day => {
          const dayData = tank.dailyData[day];
          const y = dayData ? parseFloat(dayData[COLUMN_NAMES.DAILY.WATER]) || 0 : 0;
          return y > 0 ? { x: day, y } : null;
        }).filter(d => d !== null);
        console.log('Water data for graph:', graph.id, waterData);
        if (waterData.length > 0 && isSelected) {
          datasets.push({
            label: `追い水 ${tank.metadata[COLUMN_NAMES.META.TANK_NUMBER] || index + 1}`,
            data: waterData,
            type: 'bar',
            yAxisID: 'y2',
            backgroundColor: colorPalette[index % colorPalette.length].replace('1)', '0.5'),
            hidden: !isSelected || !showOisui[graph.id],
          });
        }
      }
    });
    return datasets;
  };

  const handleGraphSelection = (graphId) => {
    setSelectedGraphs(prev => (prev.includes(graphId) ? prev.filter(id => id !== graphId) : [...prev, graphId]));
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
    setShowOisui(prev => {
      const newShowOisui = { ...prev, [graphId]: !prev[graphId] };
      return newShowOisui;
    });
  };

  const handleTankToggle = (graphId, tankId) => {
    setSelectedTanksByGraph(prev => {
      const newSelection = { ...prev };
      newSelection[graphId] = { ...newSelection[graphId], [tankId]: !newSelection[graphId]?.[tankId] };
      console.log('Tank toggle - Graph:', graphId, 'Tank:', tankId, 'New state:', newSelection);
      return newSelection;
    });
  };

  if (!tanks || !Array.isArray(tanks) || !selectedTankIds || !Array.isArray(selectedTankIds) || selectedTankIds.length === 0) {
    return <div className="mt-4 text-sm text-red-600">有効なタンクデータがありません。tanks: {JSON.stringify(tanks)}, selectedTankIds: {JSON.stringify(selectedTankIds)}</div>;
  }

  if (selectedTanksState.length === 0) {
    return <div className="mt-4 text-sm text-red-600">タンクを選択してください。selectedTanksState: {JSON.stringify(selectedTanksState)}</div>;
  }

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
      <div>
        <h3 className="text-lg font-semibold mb-2">メタデータ一覧表</h3>
        <p>総タンク数: {tanks.length}</p>
        <p>表示中: {tanks.length}</p>
        <p>選択中: {selectedTankIds.length}</p>
        <table className="mt-4 border-collapse border border-gray-300">
          <tbody>
            <tr>
              <th className="border border-gray-300 p-2">{COLUMN_NAMES.META.TANK_NUMBER}</th>
              <th className="border border-gray-300 p-2">{COLUMN_NAMES.META.BATCH_SIZE}</th>
              <th className="border border-gray-300 p-2">{COLUMN_NAMES.META.YEAST}</th>
              <th className="border border-gray-300 p-2">{COLUMN_NAMES.META.DESIGN}</th>
              <th className="border border-gray-300 p-2">{COLUMN_NAMES.META.SPECIFIC_NAME}</th>
              <th className="border border-gray-300 p-2">{COLUMN_NAMES.META.TOTAL_VOLUME}</th>
              <th className="border border-gray-300 p-2">{COLUMN_NAMES.META.TEMP_SUM_5DAYS}</th>
              <th className="border border-gray-300 p-2">{COLUMN_NAMES.META.MAX_BAUME}</th>
              <th className="border border-gray-300 p-2">{COLUMN_NAMES.META.AB_START_BAUME}</th>
              <th className="border border-gray-300 p-2">{COLUMN_NAMES.META.AB_START_ALCOHOL}</th>
              <th className="border border-gray-300 p-2">{COLUMN_NAMES.META.FINAL_BAUME}</th>
              <th className="border border-gray-300 p-2">{COLUMN_NAMES.META.FINAL_ALCOHOL}</th>
              <th className="border border-gray-300 p-2">{COLUMN_NAMES.META.MAX_BMD}</th>
              <th className="border border-gray-300 p-2">{COLUMN_NAMES.META.MAX_BMD_DAY}</th>
              <th className="border border-gray-300 p-2">{COLUMN_NAMES.META.TOTAL_WATER}</th>
              <th className="border border-gray-300 p-2">{COLUMN_NAMES.META.WATER_RATIO}</th>
              <th className="border border-gray-300 p-2">{COLUMN_NAMES.META.LATE_WATER}</th>
              <th className="border border-gray-300 p-2">{COLUMN_NAMES.META.LATE_WATER_RATIO}</th>
            </tr>
            {selectedTanksState.map(tank => (
              <tr key={tank.tankId}>
                <td className="border border-gray-300 p-2">{tank.metadata[COLUMN_NAMES.META.TANK_NUMBER] || '-'}</td>
                <td className="border border-gray-300 p-2">{tank.metadata[COLUMN_NAMES.META.BATCH_SIZE] !== null ? tank.metadata[COLUMN_NAMES.META.BATCH_SIZE] : '-'}</td>
                <td className="border border-gray-300 p-2">{tank.metadata[COLUMN_NAMES.META.YEAST] || '-'}</td>
                <td className="border border-gray-300 p-2">{tank.metadata[COLUMN_NAMES.META.DESIGN] || '-'}</td>
                <td className="border border-gray-300 p-2">{tank.metadata[COLUMN_NAMES.META.SPECIFIC_NAME] || '-'}</td>
                <td className="border border-gray-300 p-2">{tank.metadata[COLUMN_NAMES.META.TOTAL_VOLUME] !== null ? tank.metadata[COLUMN_NAMES.META.TOTAL_VOLUME] : '-'}</td>
                <td className="border border-gray-300 p-2">{tank.metadata[COLUMN_NAMES.META.TEMP_SUM_5DAYS] !== null ? tank.metadata[COLUMN_NAMES.META.TEMP_SUM_5DAYS] : '-'}</td>
                <td className="border border-gray-300 p-2">{tank.metadata[COLUMN_NAMES.META.MAX_BAUME] !== null ? tank.metadata[COLUMN_NAMES.META.MAX_BAUME] : '-'}</td>
                <td className="border border-gray-300 p-2">{tank.metadata[COLUMN_NAMES.META.AB_START_BAUME] !== null ? tank.metadata[COLUMN_NAMES.META.AB_START_BAUME] : '-'}</td>
                <td className="border border-gray-300 p-2">{tank.metadata[COLUMN_NAMES.META.AB_START_ALCOHOL] !== null ? tank.metadata[COLUMN_NAMES.META.AB_START_ALCOHOL] : '-'}</td>
                <td className="border border-gray-300 p-2">{tank.metadata[COLUMN_NAMES.META.FINAL_BAUME] !== null ? tank.metadata[COLUMN_NAMES.META.FINAL_BAUME] : '-'}</td>
                <td className="border border-gray-300 p-2">{tank.metadata[COLUMN_NAMES.META.FINAL_ALCOHOL] !== null ? tank.metadata[COLUMN_NAMES.META.FINAL_ALCOHOL] : '-'}</td>
                <td className="border border-gray-300 p-2">{tank.metadata[COLUMN_NAMES.META.MAX_BMD] !== null ? tank.metadata[COLUMN_NAMES.META.MAX_BMD] : '-'}</td>
                <td className="border border-gray-300 p-2">{tank.metadata[COLUMN_NAMES.META.MAX_BMD_DAY] !== null ? tank.metadata[COLUMN_NAMES.META.MAX_BMD_DAY] : '-'}</td>
                <td className="border border-gray-300 p-2">{tank.metadata[COLUMN_NAMES.META.TOTAL_WATER] !== null ? tank.metadata[COLUMN_NAMES.META.TOTAL_WATER] : '-'}</td>
                <td className="border border-gray-300 p-2">{tank.metadata[COLUMN_NAMES.META.WATER_RATIO] !== null ? tank.metadata[COLUMN_NAMES.META.WATER_RATIO] : '-'}</td>
                <td className="border border-gray-300 p-2">{tank.metadata[COLUMN_NAMES.META.LATE_WATER] !== null ? tank.metadata[COLUMN_NAMES.META.LATE_WATER] : '-'}</td>
                <td className="border border-gray-300 p-2">{tank.metadata[COLUMN_NAMES.META.LATE_WATER_RATIO] !== null ? tank.metadata[COLUMN_NAMES.META.LATE_WATER_RATIO] : '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div>
        <h3 className="text-lg font-semibold mb-2">選択タンクの比較（メタデータ）</h3>
        <table className="mt-4 border-collapse border border-gray-300">
          <tbody>
            <tr>
              <th className="border border-gray-300 p-2">項目</th>
              <th className="border border-gray-300 p-2">平均</th>
              <th className="border border-gray-300 p-2">最大</th>
              <th className="border border-gray-300 p-2">最小</th>
            </tr>
            {columns
              .filter(col => col.isNumeric)
              .map(col => {
                const values = selectedTanksState.map(tank => tank.metadata[col.key]).filter(v => v !== null && !isNaN(v));
                return (
                  <tr key={col.key}>
                    <td className="border border-gray-300 p-2">{col.label}</td>
                    <td className="border border-gray-300 p-2">{values.length ? (values.reduce((a, b) => a + b, 0) / values.length).toFixed(2) : '-'}</td>
                    <td className="border border-gray-300 p-2">{values.length ? Math.max(...values).toFixed(2) : '-'}</td>
                    <td className="border border-gray-300 p-2">{values.length ? Math.min(...values).toFixed(2) : '-'}</td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>
      <div>
        <h3 className="text-lg font-semibold mb-2">選択タンクの比較（日次データ）</h3>
        <table className="mt-4 border-collapse border border-gray-300">
          <tbody>
            <tr>
              <th className="border border-gray-300 p-2">項目</th>
              <th className="border border-gray-300 p-2">平均</th>
              <th className="border border-gray-300 p-2">最大</th>
              <th className="border border-gray-300 p-2">最小</th>
            </tr>
            {dailyMetrics.map(metric => {
              const values = selectedTanksState.flatMap(tank => Object.values(tank.dailyData).map(d => d[metric])).filter(v => v !== null && !isNaN(v));
              return (
                <tr key={metric}>
                  <td className="border border-gray-300 p-2">{metric}</td>
                  <td className="border border-gray-300 p-2">{values.length ? (values.reduce((a, b) => a + b, 0) / values.length).toFixed(2) : '-'}</td>
                  <td className="border border-gray-300 p-2">{values.length ? Math.max(...values).toFixed(2) : '-'}</td>
                  <td className="border border-gray-300 p-2">{values.length ? Math.min(...values).toFixed(2) : '-'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {graphs.map(graph => (
          selectedGraphs.includes(graph.id) && (
            <div key={graph.id} className="bg-white rounded-lg shadow-lg border border-gray-200 p-4 max-w-full">
              <h3 className="text-lg font-semibold inline-block mb-2 mr-2">
                {graph.title}
              </h3>
              <div className="inline-block">
                {selectedTanksState.map(tank => (
                  <label key={tank.tankId} className="inline-flex items-center mr-2">
                    <input
                      type="checkbox"
                      checked={selectedTanksByGraph[graph.id]?.[tank.tankId] || false}
                      onChange={() => handleTankToggle(graph.id, tank.tankId)}
                      className="rounded border-gray-400 mr-1"
                    />
                    <span className="text-sm">Tank {tank.metadata[COLUMN_NAMES.META.TANK_NUMBER]}</span>
                  </label>
                ))}
              </div>
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
                  data={{
                    datasets: getDatasets(graph),
                  }}
                  options={{
                    scales: {
                      x: { title: { display: true, text: graph.xAxis ? 'アルコール (%)' : '' }, min: 8, max: 20 },
                      y: { title: { display: true, text: 'ボーメ' }, min: -2, max: 6 },
                    },
                    responsive: true,
                    maintainAspectRatio: true,
                    aspectRatio: 16 / 9,
                    plugins: {
                      legend: { position: 'bottom' },
                      tooltip: { enabled: true },
                      zoom: { pan: { enabled: true, mode: 'x' }, zoom: { wheel: { enabled: true }, pinch: { enabled: true }, mode: 'x' } },
                    },
                  }}
                  id={graph.id}
                />
              ) : (
                <Line
                  data={{
                    labels: selectedTanksState.length > 0 ? getAvailableDays(selectedTanksState[0], graph.id) : [],
                    datasets: getDatasets(graph),
                  }}
                  options={{
                    scales: {
                      x: { title: { display: true, text: '日数' }, min: graphPeriods[graph.id].startDay, max: graphPeriods[graph.id].endDay },
                      y: {
                        title: { display: true, text: graph.yAxis === COLUMN_NAMES.DAILY.TEMP_1 ? '品温 (°C)' : graph.yAxis === COLUMN_NAMES.DAILY.BAUME_BMD_DAY ? 'ボーメ' : graph.yAxis === COLUMN_NAMES.DAILY.ALCOHOL ? 'アルコール (%)' : graph.yAxis === COLUMN_NAMES.DAILY.BMD_COMPLEMENT ? 'BMD' : 'アルコール係数' },
                        min: graph.yRange.min,
                        max: graph.yRange.max,
                      },
                      y2: { position: 'right', title: { display: true, text: '追い水量' }, min: 0, max: 100 },
                    },
                    responsive: true,
                    maintainAspectRatio: true,
                    aspectRatio: 16 / 9,
                    plugins: {
                      legend: { position: 'bottom' },
                      tooltip: { enabled: true },
                      zoom: { pan: { enabled: true, mode: 'x' }, zoom: { wheel: { enabled: true }, pinch: { enabled: true }, mode: 'x' } },
                    },
                  }}
                  id={graph.id}
                />
              )}
            </div>
          )
        ))}
      </div>
    </div>
  );
};

export default TankGraph;