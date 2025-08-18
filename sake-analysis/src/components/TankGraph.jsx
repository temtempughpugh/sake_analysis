import React, { useState, useEffect } from 'react';
import { Line, Scatter } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  BarElement,
} from 'chart.js';
import zoomPlugin from 'chartjs-plugin-zoom';
import { COLUMN_NAMES } from '../utils/csvParser';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  BarElement,
  zoomPlugin
);

const colorPalette = [
  'rgba(255, 99, 132, 1)',
  'rgba(54, 162, 235, 1)',
  'rgba(255, 205, 86, 1)',
  'rgba(75, 192, 192, 1)',
  'rgba(153, 102, 255, 1)',
  'rgba(255, 159, 64, 1)',
  'rgba(199, 199, 199, 1)',
  'rgba(83, 102, 255, 1)',
  'rgba(255, 99, 255, 1)',
  'rgba(99, 255, 132, 1)',
];

// アルコール分を比重に換算する関数
const alcoholToSpecificGravity = (alcoholDegree) => {
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
  
  if (alcoholDegree < 0) return 1.00000;
  if (alcoholDegree > 50) return 0.93459;
  
  const intDegree = Math.floor(alcoholDegree);
  if (alcoholDegree === intDegree && intDegree <= 50) {
    return alcoholTable[intDegree][1];
  }
  
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
  
  const nihonshuDo = -10 * finalBaume;
  const S = 1443 / (1443 + nihonshuDo);
  const A = alcoholToSpecificGravity(finalAlcohol);
  const extractContent = (S - A) * 260 + 0.21;
  
  return parseFloat(extractContent.toFixed(2));
};

// 原エキス分計算関数
const calculateOriginalExtractContent = (extractContent, finalAlcohol) => {
  if (extractContent === null || isNaN(finalAlcohol)) {
    return null;
  }
  
  const originalExtractContent = extractContent + (finalAlcohol * 1.5894);
  
  return parseFloat(originalExtractContent.toFixed(2));
};

const calculateTrueAlcoholCoefficient = (tank) => {
  if (!tank || !tank.dailyData) return [];
  
  const dailyEntries = Object.entries(tank.dailyData)
    .filter(([day, data]) => {
      const dayNum = parseInt(day);
      return !isNaN(dayNum) && data && 
             data[COLUMN_NAMES.DAILY.BAUME_BMD_DAY] !== null && 
             data[COLUMN_NAMES.DAILY.ALCOHOL] !== null;
    })
    .map(([day, data]) => ({
      day: parseInt(day),
      baume: parseFloat(data[COLUMN_NAMES.DAILY.BAUME_BMD_DAY]),
      alcohol: parseFloat(data[COLUMN_NAMES.DAILY.ALCOHOL]),
      water: parseFloat(data[COLUMN_NAMES.DAILY.WATER]) || 0
    }))
    .sort((a, b) => a.day - b.day);

  if (dailyEntries.length < 2) return [];

  const results = [];
  const metadata = tank.metadata || {};
  const totalVolume = parseFloat(metadata[COLUMN_NAMES.META.TOTAL_VOLUME]) || 0;
  const startBaume = parseFloat(metadata[COLUMN_NAMES.META.AB_START_BAUME]) || dailyEntries[0].baume;
  const startAlcohol = parseFloat(metadata[COLUMN_NAMES.META.AB_START_ALCOHOL]) || dailyEntries[0].alcohol;

  dailyEntries.forEach((dayData, index) => {
    if (index === 0) {
      results.push({
        day: dayData.day,
        withWater: { coefficient: null },
        withoutWater: { coefficient: null }
      });
      return;
    }

    const totalWaterUpToDay = dailyEntries.slice(0, index + 1).reduce((sum, d) => sum + d.water, 0);
    
    let coefficientWithWater = null;
    let coefficientWithoutWater = null;
    
    if (totalVolume > 0) {
      const dilutionFactor = (totalVolume + totalWaterUpToDay) / totalVolume;
      const trueBaume = dayData.baume * dilutionFactor;
      const trueAlcohol = dayData.alcohol * dilutionFactor;
      
      const baumeChangeWithWater = startBaume - trueBaume;
      const alcoholChangeWithWater = trueAlcohol - startAlcohol;
      const baumeChangeWithoutWater = startBaume - dayData.baume;
      const alcoholChangeWithoutWater = dayData.alcohol - startAlcohol;
      
      coefficientWithWater = baumeChangeWithWater > 0 ? alcoholChangeWithWater / baumeChangeWithWater : null;
      coefficientWithoutWater = baumeChangeWithoutWater > 0 ? alcoholChangeWithoutWater / baumeChangeWithoutWater : null;
    }
    
    results.push({
      day: dayData.day,
      withWater: { coefficient: coefficientWithWater },
      withoutWater: { coefficient: coefficientWithoutWater }
    });
  });
  
  return results;
};

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
  const [selectedGraphs, setSelectedGraphs] = useState(['temperature', 'baume', 'alcohol', 'bmd', 'ab', 'alcohol_coeff', 'extract', 'original_extract']);
  const [graphPeriods, setGraphPeriods] = useState({
    temperature: { startDay: 5, endDay: 28 },
    baume: { startDay: 5, endDay: 28 },
    alcohol: { startDay: 9, endDay: 28 },
    bmd: { startDay: 5, endDay: 28 },
    ab: { startDay: 9, endDay: 28 },
    alcohol_coeff: { startDay: 8, endDay: 28 },
    extract: { startDay: 8, endDay: 26 },
    original_extract: { startDay: 8, endDay: 26 },
  });
  const [showOisui, setShowOisui] = useState({
    temperature: true,
    baume: true,
    alcohol: true,
    bmd: true,
    alcohol_coeff: true,
    extract: true,
    original_extract: true,
  });
  const [selectedTanksState, setSelectedTanksState] = useState([]);
  const [selectedTanksByGraph, setSelectedTanksByGraph] = useState({});

  useEffect(() => {
    console.log('Tanks and selectedTankIds updated:', { tanks, selectedTankIds });
    const newSelectedTanks = Array.isArray(tanks) ?
      tanks.filter(tank => Array.isArray(selectedTankIds) && selectedTankIds.includes(tank.tankId)) : [];
    setSelectedTanksState(newSelectedTanks || []);

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
    { id: 'alcohol_coeff', title: '真のアルコール係数推移グラフ', yAxis: 'true_alcohol_coeff', yRange: { min: 0, max: 2.5 }, type: 'line' },
    { id: 'extract', title: 'エキス分経過グラフ', yAxis: 'extract_content', yRange: { min: 0, max: 15 }, type: 'line' },
    { id: 'original_extract', title: '原エキス分経過グラフ', yAxis: 'original_extract_content', yRange: { min: 10, max: 40 }, type: 'line' },
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
      
      if (graph.type === 'scatter') {
        const scatterData = availableDays.map(day => {
          const dayData = tank.dailyData[day];
          return dayData && dayData[graph.xAxis] !== null && dayData[graph.yAxis] !== null ?
            { x: parseFloat(dayData[graph.xAxis]), y: parseFloat(dayData[graph.yAxis]) }
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
      } else if (graph.id === 'alcohol_coeff') {
        const coeffData = calculateTrueAlcoholCoefficient(tank);
        const filteredCoeffData = coeffData
          .filter(d => availableDays.includes(d.day))
          .map(d => d.withWater.coefficient);
        
        // null を保持して日数と連動させる
        const alignedCoeffData = availableDays.map(day => {
          const coeffEntry = coeffData.find(d => d.day === day);
          return coeffEntry && coeffEntry.withWater.coefficient !== null 
            ? coeffEntry.withWater.coefficient 
            : null;
        });
        
        if (alignedCoeffData.some(v => v !== null) && isSelected) {
          datasets.push({
            label: `タンク ${tank.metadata[COLUMN_NAMES.META.TANK_NUMBER] || index + 1} (酵母: ${tank.metadata[COLUMN_NAMES.META.YEAST] || '-'})`,
            data: alignedCoeffData,
            borderColor: colorPalette[index % colorPalette.length],
            backgroundColor: colorPalette[index % colorPalette.length].replace('1)', '0.2'),
            borderWidth: 2.5,
            fill: false,
            spanGaps: true,
            tension: 0,
            pointRadius: 3,
            hidden: !isSelected,
          });
        }
        
        const waterData = availableDays.map(day => {
          const dayData = tank.dailyData[day];
          const y = dayData ? parseFloat(dayData[COLUMN_NAMES.DAILY.WATER]) || 0 : 0;
          return y > 0 ? { x: day, y } : null;
        }).filter(d => d !== null);
        
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
      } else if (graph.id === 'extract' || graph.id === 'original_extract') {
        // エキス分・原エキス分のデータ計算
        const extractData = availableDays.map(day => {
          const dayData = tank.dailyData[day];
          if (!dayData || 
              dayData[COLUMN_NAMES.DAILY.BAUME_BMD_DAY] === null || 
              dayData[COLUMN_NAMES.DAILY.ALCOHOL] === null) {
            return null;
          }
          
          const baume = parseFloat(dayData[COLUMN_NAMES.DAILY.BAUME_BMD_DAY]);
          const alcohol = parseFloat(dayData[COLUMN_NAMES.DAILY.ALCOHOL]);
          
          if (isNaN(baume) || isNaN(alcohol)) {
            return null;
          }
          
          const extractContent = calculateExtractContent(baume, alcohol);
          if (graph.id === 'extract') {
            return extractContent;
          } else {
            return calculateOriginalExtractContent(extractContent, alcohol);
          }
        });
        
        if (extractData.length > 0 && isSelected) {
          datasets.push({
            label: `タンク ${tank.metadata[COLUMN_NAMES.META.TANK_NUMBER] || index + 1} (酵母: ${tank.metadata[COLUMN_NAMES.META.YEAST] || '-'})`,
            data: extractData,
            borderColor: colorPalette[index % colorPalette.length],
            backgroundColor: colorPalette[index % colorPalette.length].replace('1)', '0.2'),
            borderWidth: 2.5,
            fill: false,
            spanGaps: true,
            tension: 0,
            pointRadius: 3,
            hidden: !isSelected,
          });
        }
        
        // 追い水表示
        const waterData = availableDays.map(day => {
          const dayData = tank.dailyData[day];
          const y = dayData ? parseFloat(dayData[COLUMN_NAMES.DAILY.WATER]) || 0 : 0;
          return y > 0 ? { x: day, y } : null;
        }).filter(d => d !== null);
        
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
      } else {
        const rawData = availableDays.map(day => {
          const dayData = tank.dailyData[day];
          return dayData && dayData[graph.yAxis] !== null ?
            parseFloat(dayData[graph.yAxis]) : null;
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
                {['temperature', 'baume', 'alcohol', 'bmd', 'alcohol_coeff', 'extract', 'original_extract'].includes(graph.id) && (
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
                        title: { 
                          display: true, 
                          text: graph.id === 'alcohol_coeff' ? '真のアルコール係数' : 
                                graph.id === 'extract' ? 'エキス分' :
                                graph.id === 'original_extract' ? '原エキス分' :
                                graph.yAxis === COLUMN_NAMES.DAILY.TEMP_1 ? '品温 (°C)' : 
                                graph.yAxis === COLUMN_NAMES.DAILY.BAUME_BMD_DAY ? 'ボーメ' : 
                                graph.yAxis === COLUMN_NAMES.DAILY.ALCOHOL ? 'アルコール (%)' : 
                                graph.yAxis === COLUMN_NAMES.DAILY.BMD_COMPLEMENT ? 'BMD' : 'アルコール係数' 
                        },
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