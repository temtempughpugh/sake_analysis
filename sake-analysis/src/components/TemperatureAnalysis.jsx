// ソートアイコンと優先度を取得
  const getSortIcon = (field) => {
    const sortIndex = baumeSortConfig.findIndex(config => config.field === field);
    
    if (sortIndex < 0) {
      return <span className="text-gray-400 ml-1">↕</span>;
    }
    
    const config = baumeSortConfig[sortIndex];
    const priority = baumeSortConfig.length > 1 ? (sortIndex + 1) : '';
    const arrow = config.order === 'asc' ? '↑' : '↓';
    
    return (
      <span className="text-blue-600 ml-1">
        {arrow}{priority && <sub className="text-xs">{priority}</sub>}
      </span>
    );
  };import React, { useMemo, useState } from 'react';
import { COLUMN_NAMES } from '../utils/csvParser';

const TemperatureAnalysis = ({ tanks, selectedTankIds }) => {
  const [selectedTankForDetail, setSelectedTankForDetail] = useState(null);
  const [aggregationMode, setAggregationMode] = useState('withoutWater'); // 'withoutWater' or 'estimated'
  const [baumeSortConfig, setBaumeSortConfig] = useState([
    { field: 'baumeWithoutWater', order: 'desc' }
  ]); // 複数ソート設定の配列
  
  // 選択されたタンクのデータを取得
  const selectedTanks = tanks.filter(tank => selectedTankIds.includes(tank.tankId));

  // 品温分析データを計算
  const analysisData = useMemo(() => {
    const results = [];

    selectedTanks.forEach(tank => {
      const tankId = tank.tankId;
      const totalVolume = tank.metadata[COLUMN_NAMES.META.TOTAL_VOLUME] || 0;

      if (!tank.dailyData || totalVolume === 0) return;

      // そのタンクの最終日数（醪日数）を計算
      const maxDay = Math.max(...Object.values(tank.dailyData)
        .map(data => parseInt(data[COLUMN_NAMES.DAILY.DAY]) || 0)
        .filter(day => day > 0));

      // 日次データを処理
      Object.entries(tank.dailyData).forEach(([dayKey, dayData]) => {
        const day = parseInt(dayData[COLUMN_NAMES.DAILY.DAY]);
        if (!day) return;

        // 基本データ（日次データから直接取得）
        const basicData = {
          tankId,
          day,
          moromiDays: maxDay, // 醪日数（そのタンクの最終日数）
          batchSize: tank.metadata[COLUMN_NAMES.META.BATCH_SIZE] || null, // 仕込み規模
          seq: tank.metadata[COLUMN_NAMES.META.TANK_NUMBER] || tankId,
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
        let alcoholEstimatedValue = null;

        // アルコール（補完）の値を取得
        if (alcoholEstimated !== null && alcoholEstimated !== undefined && !isNaN(alcoholEstimated)) {
          const estimated = Number(alcoholEstimated);
          if (isFinite(estimated) && Math.abs(estimated) < 1000) {
            alcoholEstimatedValue = estimated;
          }
        }

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
          alcoholEstimated: alcoholEstimatedValue,
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

  // アルコール度数別集計データを作成
  const aggregatedData = useMemo(() => {
    // アルコール度数範囲を定義（7%~8%から19%~20%まで）
    const alcoholRanges = [];
    for (let i = 7; i <= 19; i++) {
      alcoholRanges.push({
        min: i,
        max: i + 1,
        label: `${i}%〜${i + 1}%`,
        color: `hsl(${200 + i * 10}, 70%, 60%)` // 度数に応じて色を変える
      });
    }

    const grouped = {};
    
    // 各度数範囲に対して初期化
    alcoholRanges.forEach(range => {
      grouped[range.label] = {
        range,
        items: []
      };
    });

    // データを度数範囲別にグループ化
    analysisData.forEach(data => {
      let alcoholValue = null;
      
      // 集計モードに応じてアルコール値を選択
      if (aggregationMode === 'withoutWater') {
        alcoholValue = data.alcoholWithoutWater;
      } else {
        alcoholValue = data.alcoholEstimated;
      }
      
      if (alcoholValue !== null && isFinite(alcoholValue)) {
        const range = alcoholRanges.find(r => alcoholValue >= r.min && alcoholValue < r.max);
        if (range) {
          grouped[range.label].items.push(data);
        }
      }
    });

    // 各グループ内で品温の高い順にソート
    Object.values(grouped).forEach(group => {
      group.items.sort((a, b) => {
        if (b.temp1 === null && a.temp1 === null) return 0;
        if (b.temp1 === null) return -1;
        if (a.temp1 === null) return 1;
        return b.temp1 - a.temp1;
      });
    });

    // 度数範囲の順序を保持したオブジェクトを返す
    const orderedGrouped = {};
    alcoholRanges.forEach(range => {
      orderedGrouped[range.label] = grouped[range.label];
    });

    return orderedGrouped;
  }, [analysisData, aggregationMode]);

  // ボーメ計測期間の集計データを作成（アルコールが計測される前）
  const baumeOnlyData = useMemo(() => {
    const baumeOnlyItems = analysisData.filter(data => 
      data.baumeWithoutWater !== null && 
      (data.alcoholWithoutWater === null || data.alcoholEstimated === null)
    );

    // ソート設定が空の場合はそのまま返す（元の順序）
    if (baumeSortConfig.length === 0) {
      return baumeOnlyItems;
    }

    // 複数列ソート処理
    baumeOnlyItems.sort((a, b) => {
      for (const sortConfig of baumeSortConfig) {
        const { field, order } = sortConfig;
        let aValue = 0;
        let bValue = 0;

        // より確実な値取得
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
          case 'bmdWithoutWater':
            aValue = (a.bmdWithoutWater !== null && a.bmdWithoutWater !== undefined) ? Number(a.bmdWithoutWater) : -999;
            bValue = (b.bmdWithoutWater !== null && b.bmdWithoutWater !== undefined) ? Number(b.bmdWithoutWater) : -999;
            break;
          case 'bmdChange':
            aValue = (a.bmdChange !== null && a.bmdChange !== undefined) ? Number(a.bmdChange) : -999;
            bValue = (b.bmdChange !== null && b.bmdChange !== undefined) ? Number(b.bmdChange) : -999;
            break;
          case 'addedWater':
            aValue = a.addedWater ? Number(a.addedWater) : 0;
            bValue = b.addedWater ? Number(b.addedWater) : 0;
            break;
          default:
            aValue = (a.baumeWithoutWater !== null && a.baumeWithoutWater !== undefined) ? Number(a.baumeWithoutWater) : -999;
            bValue = (b.baumeWithoutWater !== null && b.baumeWithoutWater !== undefined) ? Number(b.baumeWithoutWater) : -999;
        }

        // NaN チェック
        if (isNaN(aValue)) aValue = field === 'addedWater' || field === 'seq' || field === 'day' || field === 'moromiDays' || field === 'batchSize' ? 0 : -999;
        if (isNaN(bValue)) bValue = field === 'addedWater' || field === 'seq' || field === 'day' || field === 'moromiDays' || field === 'batchSize' ? 0 : -999;

        let result = 0;
        if (order === 'asc') {
          result = aValue - bValue;  // 昇順：aが小さいとき負の値
        } else if (order === 'desc') {
          result = bValue - aValue;  // 降順：bが小さいとき負の値
        }

        // デバッグ用ログ（開発時のみ）
        if (process.env.NODE_ENV === 'development' && Math.abs(result) > 0) {
          console.log(`Sort: ${field} ${order}, a=${aValue}, b=${bValue}, result=${result}`);
        }

        // この条件で差がある場合は結果を返す
        if (result !== 0) {
          return result;
        }
        // 同じ値の場合は次のソート条件を確認
      }
      return 0; // すべての条件で同じ値の場合
    });

    return baumeOnlyItems;
  }, [analysisData, baumeSortConfig]);

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

  // 日数別表示用のソート設定を追加
  const [daySortOrder, setDaySortOrder] = useState('default'); // 'default', 'temp-desc', 'temp-asc', 'alcohol-desc', 'alcohol-asc'
  
  // 日数別集計データを作成
  const dayGroupedData = useMemo(() => {
    const grouped = {};
    
    // データを日数ごとにグループ化
    analysisData.forEach(data => {
      // アルコール値の確認（既存の集計モードに応じて）
      let alcoholValue = null;
      if (aggregationMode === 'withoutWater') {
        alcoholValue = data.alcoholWithoutWater;
      } else {
        alcoholValue = data.alcoholEstimated;
      }
      
      // アルコール値がある場合のみ集計
      if (alcoholValue !== null && isFinite(alcoholValue) && data.day) {
        const dayLabel = `${data.day}日目`;
        
        if (!grouped[dayLabel]) {
          grouped[dayLabel] = {
            day: data.day,
            items: []
          };
        }
        
        grouped[dayLabel].items.push(data);
      }
    });

    // 各日数内でソート
    Object.values(grouped).forEach(group => {
      group.items.sort((a, b) => {
        switch (daySortOrder) {
          case 'temp-desc':
            if (b.temp1 === null && a.temp1 === null) return 0;
            if (b.temp1 === null) return -1;
            if (a.temp1 === null) return 1;
            return b.temp1 - a.temp1;
          case 'temp-asc':
            if (a.temp1 === null && b.temp1 === null) return 0;
            if (a.temp1 === null) return -1;
            if (b.temp1 === null) return 1;
            return a.temp1 - b.temp1;
          case 'alcohol-desc':
            const aAlc = aggregationMode === 'withoutWater' ? a.alcoholWithoutWater : a.alcoholEstimated;
            const bAlc = aggregationMode === 'withoutWater' ? b.alcoholWithoutWater : b.alcoholEstimated;
            if (bAlc === null && aAlc === null) return 0;
            if (bAlc === null) return -1;
            if (aAlc === null) return 1;
            return bAlc - aAlc;
          case 'alcohol-asc':
            const aAlc2 = aggregationMode === 'withoutWater' ? a.alcoholWithoutWater : a.alcoholEstimated;
            const bAlc2 = aggregationMode === 'withoutWater' ? b.alcoholWithoutWater : b.alcoholEstimated;
            if (aAlc2 === null && bAlc2 === null) return 0;
            if (aAlc2 === null) return -1;
            if (bAlc2 === null) return 1;
            return aAlc2 - bAlc2;
          default:
            // デフォルトは順号順
            return a.seq - b.seq;
        }
      });
    });

    // 日数順にソートして返す
    const sortedDays = Object.keys(grouped).sort((a, b) => {
      return grouped[a].day - grouped[b].day;
    });
    
    const orderedGrouped = {};
    sortedDays.forEach(dayLabel => {
      orderedGrouped[dayLabel] = grouped[dayLabel];
    });

    return orderedGrouped;
  }, [analysisData, aggregationMode, daySortOrder]);

  // 温度帯別表示用のソート設定を追加
  const [tempZoneSortOrder, setTempZoneSortOrder] = useState('default'); // 'default', 'day-asc', 'day-desc', 'alcohol-desc', 'alcohol-asc'
  
  // 温度帯別集計データを作成
  const tempGroupedData = useMemo(() => {
    const grouped = {};
    
    // データを温度帯ごとにグループ化（1℃単位）
    analysisData.forEach(data => {
      // アルコール値の確認（既存の集計モードに応じて）
      let alcoholValue = null;
      if (aggregationMode === 'withoutWater') {
        alcoholValue = data.alcoholWithoutWater;
      } else {
        alcoholValue = data.alcoholEstimated;
      }
      
      // アルコール値と品温がある場合のみ集計
      if (alcoholValue !== null && isFinite(alcoholValue) && data.temp1 !== null) {
        const tempInt = Math.floor(data.temp1);
        const tempLabel = `${tempInt}℃台`;
        
        if (!grouped[tempLabel]) {
          grouped[tempLabel] = {
            temp: tempInt,
            items: []
          };
        }
        
        grouped[tempLabel].items.push(data);
      }
    });

    // 各温度帯内でソート
    Object.values(grouped).forEach(group => {
      group.items.sort((a, b) => {
        switch (tempZoneSortOrder) {
          case 'day-asc':
            return a.day - b.day;
          case 'day-desc':
            return b.day - a.day;
          case 'alcohol-desc':
            const aAlc = aggregationMode === 'withoutWater' ? a.alcoholWithoutWater : a.alcoholEstimated;
            const bAlc = aggregationMode === 'withoutWater' ? b.alcoholWithoutWater : b.alcoholEstimated;
            if (bAlc === null && aAlc === null) return 0;
            if (bAlc === null) return -1;
            if (aAlc === null) return 1;
            return bAlc - aAlc;
          case 'alcohol-asc':
            const aAlc2 = aggregationMode === 'withoutWater' ? a.alcoholWithoutWater : a.alcoholEstimated;
            const bAlc2 = aggregationMode === 'withoutWater' ? b.alcoholWithoutWater : b.alcoholEstimated;
            if (aAlc2 === null && bAlc2 === null) return 0;
            if (aAlc2 === null) return -1;
            if (bAlc2 === null) return 1;
            return aAlc2 - bAlc2;
          default:
            // デフォルトは順号順
            return a.seq - b.seq;
        }
      });
    });

    // 温度順（高い順）にソートして返す
    const sortedTemps = Object.keys(grouped).sort((a, b) => {
      return grouped[b].temp - grouped[a].temp;
    });
    
    const orderedGrouped = {};
    sortedTemps.forEach(tempLabel => {
      orderedGrouped[tempLabel] = grouped[tempLabel];
    });

    return orderedGrouped;
  }, [analysisData, aggregationMode, tempZoneSortOrder]);

  // 変動予測用の状態
  const [predictionInput, setPredictionInput] = useState({
    currentTemp: '',
    currentAlcohol: '',
    targetChange: 'baume' // 'baume', 'alcohol', 'bmd'
  });
  const [predictionResult, setPredictionResult] = useState(null);

  // 変動予測を計算
  const calculatePrediction = () => {
    const temp = parseFloat(predictionInput.currentTemp);
    const alcohol = parseFloat(predictionInput.currentAlcohol);
    
    if (isNaN(temp) || isNaN(alcohol)) {
      setPredictionResult({ error: '温度とアルコール度数を正しく入力してください' });
      return;
    }

    // 温度範囲を定義（0.5℃刻み）
    // 0.5℃単位の範囲に正規化（例：11.2 → 11.0-11.5の範囲）
    const tempBase = Math.floor(temp * 2) / 2; // 0.5単位に切り捨て
    const tempRanges = [
      { min: tempBase - 0.5, max: tempBase, label: `${(tempBase - 0.5).toFixed(1)}-${tempBase.toFixed(1)}℃` },
      { min: tempBase, max: tempBase + 0.5, label: `${tempBase.toFixed(1)}-${(tempBase + 0.5).toFixed(1)}℃` },
      { min: tempBase + 0.5, max: tempBase + 1.0, label: `${(tempBase + 0.5).toFixed(1)}-${(tempBase + 1.0).toFixed(1)}℃` }
    ];

    // アルコール範囲を定義（1%刻み）
    const alcoholBase = Math.floor(alcohol);
    const alcoholRange = { min: alcoholBase, max: alcoholBase + 1, label: `${alcoholBase}.0-${alcoholBase + 1}.0%` };

    const results = {};

    // 各温度範囲でデータを抽出
    tempRanges.forEach((tempRange, index) => {
      const filteredData = analysisData.filter(data => {
        const dataAlcohol = aggregationMode === 'withoutWater' ? data.alcoholWithoutWater : data.alcoholEstimated;
        return data.temp1 !== null && 
               data.temp1 >= tempRange.min && 
               data.temp1 < tempRange.max &&
               dataAlcohol !== null &&
               dataAlcohol >= alcoholRange.min &&
               dataAlcohol < alcoholRange.max;
      });

      if (filteredData.length > 0) {
        let changeValues = [];
        let changeField = '';

        switch (predictionInput.targetChange) {
          case 'baume':
            changeValues = filteredData
              .map(d => d.baumeChange)
              .filter(v => v !== null && isFinite(v));
            changeField = 'ボーメ変動';
            break;
          case 'alcohol':
            changeValues = filteredData
              .map(d => d.alcoholChange)
              .filter(v => v !== null && isFinite(v));
            changeField = 'アルコール変動';
            break;
          case 'bmd':
            changeValues = filteredData
              .map(d => d.bmdChange)
              .filter(v => v !== null && isFinite(v));
            changeField = 'BMD変動';
            break;
        }

        if (changeValues.length > 0) {
          changeValues.sort((a, b) => a - b);
          const min = Math.min(...changeValues);
          const max = Math.max(...changeValues);
          const median = changeValues[Math.floor(changeValues.length / 2)];

          results[index] = {
            tempRange: tempRange.label,
            alcoholRange: alcoholRange.label,
            count: filteredData.length,
            changeField,
            min,
            max,
            median,
            isTarget: index === 1 // 真ん中が該当部分
          };
        }
      }
    });

    setPredictionResult(results);
  };


  const formatNumber = (value, decimals = 2) => {
    if (value === null || value === undefined || isNaN(value)) return '-';
    const num = Number(value);
    if (!isFinite(num)) return '-';
    return num.toFixed(decimals);
  };

  const getTempClass = (temp) => {
    if (temp === null || temp === undefined) return '';
    if (temp <= 6) return 'bg-blue-100 text-blue-800';
    if (temp >= 7 && temp <= 8) return 'bg-green-100 text-green-800';
    if (temp >= 9 && temp <= 10) return 'bg-yellow-100 text-yellow-800';
    if (temp >= 11 && temp <= 12) return 'bg-orange-100 text-orange-800';
    if (temp >= 13) return 'bg-red-100 text-red-800 font-semibold';
    return '';
  };

  const getUpDownSymbol = (upDown) => {
    if (!upDown || upDown === '' || upDown === null || upDown === undefined) {
      return <span className="text-gray-500">-</span>;
    }
    
    const normalized = upDown.toString().trim();
    
    // 上昇パターン
    if (normalized === '上' || normalized === '↑' || normalized.includes('上')) {
      return <span className="text-red-600 font-bold">↑</span>;
    }
    // 下降パターン  
    if (normalized === '下' || normalized === '↓' || normalized.includes('下')) {
      return <span className="text-blue-600 font-bold">↓</span>;
    }
    // キープパターン
    if (normalized === '→' || normalized === '-' || normalized.includes('キープ') || normalized.includes('平')) {
      return <span className="text-gray-500">→</span>;
    }
    
    // その他の場合は元の値を表示
    return <span className="text-gray-600 text-xs">{normalized}</span>;
  };

  // ソートヘッダーのクリック処理（降順→昇順→解除サイクル）
  const handleBaumeSort = (field) => {
    setBaumeSortConfig(prevConfig => {
      const existingIndex = prevConfig.findIndex(config => config.field === field);
      
      if (existingIndex >= 0) {
        // 既存のフィールドの場合は降順→昇順→解除のサイクル
        const currentOrder = prevConfig[existingIndex].order;
        
        if (currentOrder === 'desc') {
          // 降順 → 昇順
          const newConfig = [...prevConfig];
          newConfig[existingIndex] = { ...newConfig[existingIndex], order: 'asc' };
          console.log('Changed to asc:', newConfig);
          return newConfig;
        } else if (currentOrder === 'asc') {
          // 昇順 → 解除（配列から削除）
          const newConfig = [...prevConfig];
          newConfig.splice(existingIndex, 1);
          console.log('Removed sort:', newConfig);
          return newConfig;
        }
      } else {
        // 新しいフィールドを降順で追加
        const newConfig = [...prevConfig, { field, order: 'desc' }];
        console.log('Added desc:', newConfig);
        return newConfig;
      }
      
      return prevConfig;
    });
  };

  // ソートリセット機能（完全リセット）
  const resetBaumeSort = () => {
    setBaumeSortConfig([]);
  };

  // ソートアイコンと優先度を取得
  const getSortIcon = (field) => {
    const sortIndex = baumeSortConfig.findIndex(config => config.field === field);
    
    if (sortIndex < 0) {
      return <span className="text-gray-400 ml-1">↕</span>;
    }
    
    const config = baumeSortConfig[sortIndex];
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

      {/* ボーメ計測期間集計セクション */}
      {baumeOnlyData.length > 0 && (
        <div className="mb-8 p-4 bg-white rounded-lg border border-gray-300">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-800 flex items-center">
            🌾 ボーメ計測期間集計（アルコール計測前）
          </h3>
          <button
            onClick={resetBaumeSort}
            className="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded border transition-colors"
          >
            ソートリセット
          </button>
        </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse border border-gray-300" style={{minWidth: '1200px'}}>
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
                    className="border border-gray-300 p-2 bg-purple-50 cursor-pointer hover:bg-purple-100 select-none"
                    onClick={() => handleBaumeSort('bmdWithoutWater')}
                  >
                    BMD(追い水無視){getSortIcon('bmdWithoutWater')}
                  </th>
                  <th 
                    className="border border-gray-300 p-2 bg-purple-50 cursor-pointer hover:bg-purple-100 select-none"
                    onClick={() => handleBaumeSort('bmdChange')}
                  >
                    BMD変動{getSortIcon('bmdChange')}
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
                    <td className="border border-gray-300 p-2 text-center bg-purple-50">
                      {formatNumber(data.bmdWithoutWater)}
                    </td>
                    <td className="border border-gray-300 p-2 text-center bg-purple-50">
                      {formatNumber(data.bmdChange)}
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
          
          <div className="mt-3 text-sm text-gray-600">
            💡 <strong>操作方法:</strong> 列ヘッダーをクリックで並べ替え追加。同じ列を再クリックで<strong>降順→昇順→解除</strong>のサイクル。数字は優先度を表示。
            <br />
            <strong>現在のソート:</strong> 
            {baumeSortConfig.length === 0 ? (
              <span className="ml-2 text-gray-500">なし（元の順序）</span>
            ) : (
              baumeSortConfig.map((config, index) => {
                const fieldName = 
                  config.field === 'seq' ? '順号' :
                  config.field === 'day' ? '日数' :
                  config.field === 'moromiDays' ? '醪日数' :
                  config.field === 'temp1' ? '品温1回目' :
                  config.field === 'tempChange' ? '1日の品温変動' :
                  config.field === 'baumeWithoutWater' ? 'ボーメ(追い水無視)' :
                  config.field === 'baumeChange' ? 'ボーメ変動' :
                  config.field === 'bmdWithoutWater' ? 'BMD(追い水無視)' :
                  config.field === 'bmdChange' ? 'BMD変動' :
                  config.field === 'addedWater' ? '追水' : config.field;
                const order = config.order === 'asc' ? '昇順' : '降順';
                return (
                  <span key={config.field} className="ml-2">
                    {index + 1}. {fieldName}({order})
                  </span>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* アルコール度数別集計セクション */}
      <div className="mb-8 p-4 bg-white rounded-lg border border-gray-300">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-800 flex items-center">
            📊 アルコール度数別品温集計
          </h3>
          
          {/* 集計モード切り替えボタン */}
          <div className="flex bg-white rounded-lg border border-gray-300 overflow-hidden">
            <button
              onClick={() => setAggregationMode('withoutWater')}
              className={`px-4 py-2 text-sm font-medium transition-colors ${
                aggregationMode === 'withoutWater'
                  ? 'bg-blue-500 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-50'
              }`}
            >
              アルコール(追い水無視)
            </button>
            <button
              onClick={() => setAggregationMode('estimated')}
              className={`px-4 py-2 text-sm font-medium transition-colors ${
                aggregationMode === 'estimated'
                  ? 'bg-blue-500 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-50'
              }`}
            >
              アルコール（補完）
            </button>
          </div>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse border border-gray-300" style={{minWidth: '1300px'}}>
            <thead className="bg-gray-100">
              <tr>
                <th className="border border-gray-300 p-3 bg-gradient-to-r from-blue-500 to-purple-500 text-white font-semibold">
                  アルコール度数範囲
                </th>
                <th className="border border-gray-300 p-2">順号</th>
                <th className="border border-gray-300 p-2">日数</th>
                <th className="border border-gray-300 p-2">醪日数</th>
                <th className="border border-gray-300 p-2">品温1回目</th>
                <th className="border border-gray-300 p-2">1日の品温変動</th>
                <th className="border border-gray-300 p-2">品温上下</th>
                <th className="border border-gray-300 p-2 bg-yellow-50">ボーメ(追い水無視)</th>
                <th className="border border-gray-300 p-2 bg-yellow-50">ボーメ変動</th>
                <th className="border border-gray-300 p-2 bg-green-50">アルコール（補完）</th>
                <th className="border border-gray-300 p-2 bg-blue-50">アルコール(追い水無視)</th>
                <th className="border border-gray-300 p-2 bg-blue-50">アルコール変動</th>
                <th className="border border-gray-300 p-2 bg-purple-50">BMD(追い水無視)</th>
                <th className="border border-gray-300 p-2 bg-purple-50">BMD変動</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(aggregatedData).map(([rangeLabel, groupData]) => {
                const items = groupData.items;
                const range = groupData.range;
                
                if (items.length === 0) {
                  return (
                    <tr key={rangeLabel} className="border-b-2 border-gray-300">
                      <td 
                        className="border border-gray-300 p-3 text-center font-semibold text-sm bg-white"
                        style={{
                          borderLeft: '4px solid #9e9e9e',
                          writingMode: 'vertical-rl'
                        }}
                      >
                        {rangeLabel}
                      </td>
                      <td colSpan="13" className="border border-gray-300 p-4 text-center text-gray-500 italic">
                        該当するデータがありません
                      </td>
                    </tr>
                  );
                }
                
                return items.map((item, index) => (
                  <tr 
                    key={`${rangeLabel}-${item.tankId}-${item.day}`} 
                    className={`hover:bg-gray-50 ${index === items.length - 1 ? 'border-b-2 border-gray-300' : ''}`}
                  >
                    {index === 0 && (
                      <td 
                        rowSpan={items.length}
                        className="border border-gray-300 p-3 text-center font-semibold text-sm bg-white"
                        style={{
                          borderLeft: `4px solid ${range.color}`,
                          writingMode: 'vertical-rl',
                          verticalAlign: 'middle'
                        }}
                      >
                        {rangeLabel}
                      </td>
                    )}
                    <td className="border border-gray-300 p-2 text-center font-semibold">
                      {item.seq}
                    </td>
                    <td className="border border-gray-300 p-2 text-center">
                      {item.day}
                    </td>
                    <td className="border border-gray-300 p-2 text-center">
                      {item.moromiDays}
                    </td>
                    <td className={`border border-gray-300 p-2 text-center ${getTempClass(item.temp1)}`}>
                      {formatNumber(item.temp1, 1)}
                    </td>
                    <td className="border border-gray-300 p-2 text-center">
                      {formatNumber(item.tempChange, 1)}
                    </td>
                    <td className="border border-gray-300 p-2 text-center">
                      {getUpDownSymbol(item.tempUpDown)}
                    </td>
                    <td className="border border-gray-300 p-2 text-center bg-yellow-50">
                      {formatNumber(item.baumeWithoutWater)}
                    </td>
                    <td className="border border-gray-300 p-2 text-center bg-yellow-50">
                      {formatNumber(item.baumeChange)}
                    </td>
                    <td className="border border-gray-300 p-2 text-center bg-green-50">
                      {formatNumber(item.alcoholEstimated)}
                    </td>
                    <td className="border border-gray-300 p-2 text-center bg-blue-50">
                      {formatNumber(item.alcoholWithoutWater)}
                    </td>
                    <td className="border border-gray-300 p-2 text-center bg-blue-50">
                      {formatNumber(item.alcoholChange)}
                    </td>
                    <td className="border border-gray-300 p-2 text-center bg-purple-50">
                      {formatNumber(item.bmdWithoutWater)}
                    </td>
                    <td className="border border-gray-300 p-2 text-center bg-purple-50">
                      {formatNumber(item.bmdChange)}
                    </td>
                  </tr>
                ));
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* 日次データ詳細セクション */}
      <div className="border-t pt-6">
        <h3 className="text-lg font-semibold text-gray-700 mb-4 flex items-center">
          📋 日次データ詳細
        </h3>
        
        {/* タンク選択ボタン */}
        <div className="flex flex-wrap gap-2 mb-4">
          {selectedTankIds.map(tankId => (
            <button
              key={tankId}
              onClick={() => setSelectedTankForDetail(selectedTankForDetail === tankId ? null : tankId)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 ${
                selectedTankForDetail === tankId
                  ? 'bg-blue-500 text-white shadow-md'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              タンク{tankId}
            </button>
          ))}
        </div>

        {/* 選択されたタンクの詳細データ */}
        {selectedTankForDetail && dataByTank[selectedTankForDetail] && (
          <div className="mt-4">
            <h4 className="text-md font-semibold text-blue-600 mb-3">
              タンク順号: {selectedTankForDetail}
            </h4>
            
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
                    <th className="border border-gray-300 p-2 bg-green-50">アルコール（補完）</th>
                    <th className="border border-gray-300 p-2 bg-blue-50">アルコール(追い水無視)</th>
                    <th className="border border-gray-300 p-2 bg-blue-50">アルコール変動</th>
                    <th className="border border-gray-300 p-2 bg-purple-50">BMD(追い水無視)</th>
                    <th className="border border-gray-300 p-2 bg-purple-50">BMD変動</th>
                    <th className="border border-gray-300 p-2">追水</th>
                  </tr>
                </thead>
                <tbody>
                  {dataByTank[selectedTankForDetail].map((data, index) => (
                    <tr key={index} className="hover:bg-gray-50">
                      <td className="border border-gray-300 p-2 text-center font-semibold">
                        {data.day}
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
                      <td className="border border-gray-300 p-2 text-center bg-green-50">
                        {formatNumber(data.alcoholEstimated)}
                      </td>
                      <td className="border border-gray-300 p-2 text-center bg-blue-50">
                        {formatNumber(data.alcoholWithoutWater)}
                      </td>
                      <td className="border border-gray-300 p-2 text-center bg-blue-50">
                        {formatNumber(data.alcoholChange)}
                      </td>
                      <td className="border border-gray-300 p-2 text-center bg-purple-50">
                        {formatNumber(data.bmdWithoutWater)}
                      </td>
                      <td className="border border-gray-300 p-2 text-center bg-purple-50">
                        {formatNumber(data.bmdChange)}
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
            {process.env.NODE_ENV === 'development' && dataByTank[selectedTankForDetail].length > 0 && (
              <div className="mt-4 p-3 bg-gray-100 rounded text-xs">
                <strong>デバッグ情報 (タンク{selectedTankForDetail}):</strong>
                <br />仕込み総量: {tanks.find(t => t.tankId === selectedTankForDetail)?.metadata[COLUMN_NAMES.META.TOTAL_VOLUME]}L
                <br />サンプル希釈倍率: {formatNumber(dataByTank[selectedTankForDetail][0]?.dilutionFactor, 4)}
              </div>
            )}
          </div>
        )}

        {!selectedTankForDetail && (
          <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
            <p className="text-blue-700 text-sm">
              💡 <strong>使い方:</strong> 上記のタンクボタンをクリックして、個別のタンクの日次データを表示できます。
              これにより、データが多い場合でも画面が圧迫されることなく、必要な情報を効率的に閲覧できます。
            </p>
          </div>
        )}
         {/* 日数別品温集計セクション - 新規追加 */}
      <div className="mb-8 p-4 bg-white rounded-lg border border-gray-300">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-800 flex items-center">
            📅 日数別品温集計
          </h3>
          
          <div className="flex gap-4 items-center">
            {/* ソート設定 */}
            <select
              value={daySortOrder}
              onChange={(e) => setDaySortOrder(e.target.value)}
              className="px-3 py-1 text-sm border border-gray-300 rounded"
            >
              <option value="default">順号順</option>
              <option value="temp-desc">品温（高い順）</option>
              <option value="temp-asc">品温（低い順）</option>
              <option value="alcohol-desc">アルコール（高い順）</option>
              <option value="alcohol-asc">アルコール（低い順）</option>
            </select>
            
            {/* 集計モード切り替えボタン（既存と同じ） */}
            <div className="flex bg-white rounded-lg border border-gray-300 overflow-hidden">
            <button
              onClick={() => setAggregationMode('withoutWater')}
              className={`px-4 py-2 text-sm font-medium transition-colors ${
                aggregationMode === 'withoutWater'
                  ? 'bg-blue-500 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-50'
              }`}
            >
              アルコール(追い水無視)
            </button>
            <button
              onClick={() => setAggregationMode('estimated')}
              className={`px-4 py-2 text-sm font-medium transition-colors ${
                aggregationMode === 'estimated'
                  ? 'bg-blue-500 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-50'
              }`}
            >
              アルコール（補完）
            </button>
            </div>
          </div>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse border border-gray-300" style={{minWidth: '1300px'}}>
            <thead className="bg-gray-100">
              <tr>
                <th className="border border-gray-300 p-3 bg-gradient-to-r from-green-500 to-blue-500 text-white font-semibold">
                  日数
                </th>
                <th className="border border-gray-300 p-2">順号</th>
                <th className="border border-gray-300 p-2">醪日数</th>
                <th className="border border-gray-300 p-2">品温1回目</th>
                <th className="border border-gray-300 p-2">1日の品温変動</th>
                <th className="border border-gray-300 p-2">品温上下</th>
                <th className="border border-gray-300 p-2 bg-yellow-50">ボーメ(追い水無視)</th>
                <th className="border border-gray-300 p-2 bg-yellow-50">ボーメ変動</th>
                <th className="border border-gray-300 p-2 bg-green-50">アルコール（補完）</th>
                <th className="border border-gray-300 p-2 bg-blue-50">アルコール(追い水無視)</th>
                <th className="border border-gray-300 p-2 bg-blue-50">アルコール変動</th>
                <th className="border border-gray-300 p-2 bg-purple-50">BMD(追い水無視)</th>
                <th className="border border-gray-300 p-2 bg-purple-50">BMD変動</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(dayGroupedData).map(([dayLabel, groupData]) => {
                const items = groupData.items;
                const dayNumber = groupData.day;
                
                if (items.length === 0) {
                  return null;
                }
                
                return items.map((item, index) => (
                  <tr 
                    key={`${dayLabel}-${item.tankId}-${item.day}`} 
                    className={`hover:bg-gray-50 ${index === items.length - 1 ? 'border-b-2 border-gray-400' : ''}`}
                  >
                    {index === 0 && (
                      <td 
                        rowSpan={items.length}
                        className="border border-gray-300 p-3 text-center font-semibold text-sm bg-gradient-to-br from-green-50 to-blue-50"
                        style={{
                          borderLeft: `4px solid hsl(${120 + dayNumber * 8}, 70%, 60%)`,
                          writingMode: 'vertical-rl'
                        }}
                      >
                        {dayLabel}
                      </td>
                    )}
                    <td className="border border-gray-300 p-2 text-center">{item.seq}</td>
                    <td className="border border-gray-300 p-2 text-center">{item.moromiDays}</td>
                    <td className={`border border-gray-300 p-2 text-center ${
                      item.temp1 !== null && item.temp1 >= 12 ? 'bg-red-100 font-bold' : ''
                    }`}>
                      {item.temp1 !== null ? item.temp1.toFixed(1) : '-'}
                    </td>
                    <td className="border border-gray-300 p-2 text-center">
                      {item.tempChange !== null ? item.tempChange.toFixed(1) : '-'}
                    </td>
                    <td className="border border-gray-300 p-2 text-center">{item.tempUpDown || '-'}</td>
                    <td className="border border-gray-300 p-2 text-center bg-yellow-50">
                      {item.baumeWithoutWater !== null ? item.baumeWithoutWater.toFixed(2) : '-'}
                    </td>
                    <td className="border border-gray-300 p-2 text-center bg-yellow-50">
                      {item.baumeChange !== null ? item.baumeChange.toFixed(2) : '-'}
                    </td>
                    <td className="border border-gray-300 p-2 text-center bg-green-50">
                      {item.alcoholEstimated !== null ? item.alcoholEstimated.toFixed(1) : '-'}
                    </td>
                    <td className="border border-gray-300 p-2 text-center bg-blue-50">
                      {item.alcoholWithoutWater !== null ? item.alcoholWithoutWater.toFixed(1) : '-'}
                    </td>
                    <td className="border border-gray-300 p-2 text-center bg-blue-50">
                      {item.alcoholChange !== null ? item.alcoholChange.toFixed(1) : '-'}
                    </td>
                    <td className="border border-gray-300 p-2 text-center bg-purple-50">
                      {item.bmdWithoutWater !== null ? item.bmdWithoutWater.toFixed(2) : '-'}
                    </td>
                    <td className="border border-gray-300 p-2 text-center bg-purple-50">
                      {item.bmdChange !== null ? item.bmdChange.toFixed(2) : '-'}
                    </td>
                  </tr>
                ));
              })}
            </tbody>
          </table>
        </div>
        
        <div className="mt-2 text-sm text-gray-600">
          計{analysisData.filter(d => {
            const val = aggregationMode === 'withoutWater' ? d.alcoholWithoutWater : d.alcoholEstimated;
            return val !== null && isFinite(val) && d.day;
          }).length}件のデータ | {Object.keys(dayGroupedData).length}日分
        </div>
      </div>
      // 既存のreturn文の中で、温度帯別集計表の後に追加

      {/* 変動予測セクション - 新規追加 */}
      <div className="mb-8 p-4 bg-white rounded-lg border border-gray-300">
        <div className="mb-4">
          <h3 className="text-lg font-semibold text-gray-800 flex items-center mb-4">
            🎯 変動予測分析
          </h3>
          
          <div className="flex gap-4 items-center mb-4">
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700">現在の品温</label>
              <input
                type="number"
                step="0.1"
                value={predictionInput.currentTemp}
                onChange={(e) => setPredictionInput({...predictionInput, currentTemp: e.target.value})}
                className="px-3 py-1 border border-gray-300 rounded w-24"
                placeholder="℃"
              />
            </div>
            
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700">現在のアルコール度数</label>
              <input
                type="number"
                step="0.1"
                value={predictionInput.currentAlcohol}
                onChange={(e) => setPredictionInput({...predictionInput, currentAlcohol: e.target.value})}
                className="px-3 py-1 border border-gray-300 rounded w-24"
                placeholder="%"
              />
            </div>
            
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700">目標変動</label>
              <select
                value={predictionInput.targetChange}
                onChange={(e) => setPredictionInput({...predictionInput, targetChange: e.target.value})}
                className="px-3 py-1 border border-gray-300 rounded"
              >
                <option value="baume">ボーメ変動</option>
                <option value="alcohol">アルコール変動</option>
                <option value="bmd">BMD変動</option>
              </select>
            </div>
            
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700">集計モード</label>
              <div className="flex bg-white rounded-lg border border-gray-300 overflow-hidden">
                <button
                  onClick={() => setAggregationMode('withoutWater')}
                  className={`px-3 py-1 text-sm font-medium transition-colors ${
                    aggregationMode === 'withoutWater'
                      ? 'bg-blue-500 text-white'
                      : 'bg-white text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  追い水無視
                </button>
                <button
                  onClick={() => setAggregationMode('estimated')}
                  className={`px-3 py-1 text-sm font-medium transition-colors ${
                    aggregationMode === 'estimated'
                      ? 'bg-blue-500 text-white'
                      : 'bg-white text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  補完
                </button>
              </div>
            </div>
            
            <button
              onClick={calculatePrediction}
              className="px-4 py-2 bg-green-500 text-white font-medium rounded hover:bg-green-600 transition-colors"
            >
              予測実行
            </button>
          </div>
        </div>
        
        {/* 予測結果表示 */}
        {predictionResult && (
          <div className="mt-4 p-4 bg-gray-50 rounded-lg">
            {predictionResult.error ? (
              <p className="text-red-600">{predictionResult.error}</p>
            ) : (
              <div>
                <h4 className="font-semibold mb-3">予測結果</h4>
                {Object.values(predictionResult).map((result, index) => (
                  <div 
                    key={index} 
                    className={`mb-3 p-3 rounded ${result.isTarget ? 'bg-blue-100 border-2 border-blue-500' : 'bg-white border border-gray-300'}`}
                  >
                    <div className="font-medium mb-1">
                      {result.isTarget ? '★ ' : ''}
                      {result.isTarget ? '該当部分' : '前後条件'}
                      （温度{result.tempRange}、アルコール{result.alcoholRange}）
                      <span className="text-sm text-gray-600 ml-2">（{result.count}件抽出）</span>
                    </div>
                    <div className="text-sm">
                      {result.changeField}レンジ：
                      <span className="font-semibold text-blue-600">
                        {result.min.toFixed(2)}～{result.max.toFixed(2)}
                      </span>
                      <span className="text-gray-600 ml-2">
                        （中央値 <span className="font-semibold">{result.median.toFixed(2)}</span>）
                      </span>
                    </div>
                  </div>
                ))}
                {Object.keys(predictionResult).length === 0 && (
                  <p className="text-gray-500">該当するデータがありません</p>
                )}
              </div>
            )}
          </div>
        )}
      </div>
      </div>
    </div>
  );
};

export default TemperatureAnalysis;