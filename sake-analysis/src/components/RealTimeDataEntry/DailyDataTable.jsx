import React, { useState, useEffect, useRef } from 'react';
import { Save, AlertCircle, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { COLUMN_NAMES } from '../../utils/csvParser';

const DailyDataTable = ({ tank, onUpdate }) => {
  const [dailyData, setDailyData] = useState({});
  const [errors, setErrors] = useState({});

  // 仕込み日から上槽日（または今日）までの日付マッピングを作成
  const generateDateMapping = () => {
    if (!tank.metadata?.['仕込み日']) return [];
    
    const startDate = new Date(tank.metadata['仕込み日']);
    const endDate = tank.metadata?.['上槽日'] ? new Date(tank.metadata['上槽日']) : new Date();
    const today = new Date().toISOString().split('T')[0];
    
    const dateMap = [];
    let currentDate = new Date(startDate);
    let dayNumber = 1;
    
    while (currentDate <= endDate) {
      const dateString = currentDate.toISOString().split('T')[0];
      dateMap.push({
        key: `day_${dayNumber}`,
        dayNumber: dayNumber,
        date: dateString,
        isToday: dateString === today
      });
      
      currentDate.setDate(currentDate.getDate() + 1);
      dayNumber++;
    }
    
    return dateMap;
  };

  const dateMapping = generateDateMapping();

  // 初期データの読み込みと日付マッピングの適用
  useEffect(() => {
    const initialData = {};
    
    // 日付マッピングに基づいて空の行を作成
    dateMapping.forEach(({ key, dayNumber, date }) => {
      // 既存データがあればそれを使用、なければ初期値
      const existingData = tank.dailyData?.[key] || {};
      
      initialData[key] = {
        [COLUMN_NAMES.DAILY.DATE]: date,
        [COLUMN_NAMES.DAILY.DAY]: dayNumber.toString(),
        [COLUMN_NAMES.DAILY.TEMP_1]: existingData[COLUMN_NAMES.DAILY.TEMP_1] || '',
        [COLUMN_NAMES.DAILY.SAKE_DEGREE_BAUME]: existingData[COLUMN_NAMES.DAILY.SAKE_DEGREE_BAUME] || '',
        [COLUMN_NAMES.DAILY.ALCOHOL]: existingData[COLUMN_NAMES.DAILY.ALCOHOL] || '',
        [COLUMN_NAMES.DAILY.ACIDITY]: existingData[COLUMN_NAMES.DAILY.ACIDITY] || '',
        [COLUMN_NAMES.DAILY.AMINO_ACID]: existingData[COLUMN_NAMES.DAILY.AMINO_ACID] || '',
        [COLUMN_NAMES.DAILY.WATER]: existingData[COLUMN_NAMES.DAILY.WATER] || '',
        // 自動計算項目も保持
        ...Object.keys(existingData).reduce((acc, key) => {
          if (!['月日', '日数', '品温1回目', '日本酒度・ボーメ', 'アルコール', '酸度', 'アミノ酸', '追水'].includes(key)) {
            acc[key] = existingData[key];
          }
          return acc;
        }, {})
      };
    });
    
    setDailyData(initialData);
  }, [tank, dateMapping.length]);

  // 値の検証
  const validateValue = (key, field, value) => {
    const numValue = parseFloat(value);
    const errors = [];

    if (value === '' || value === null) return errors;

    switch (field) {
      case COLUMN_NAMES.DAILY.TEMP_1:
        if (numValue < 5) errors.push('品温が5℃未満です');
        if (numValue > 20) errors.push('品温が20℃を超えています');
        break;
      case COLUMN_NAMES.DAILY.SAKE_DEGREE_BAUME:
        if (numValue < -5) errors.push('ボーメが-5未満です');
        if (numValue > 15) errors.push('ボーメが15を超えています');
        break;
      case COLUMN_NAMES.DAILY.ALCOHOL:
        if (numValue < 0) errors.push('アルコール度数が0未満です');
        if (numValue > 25) errors.push('アルコール度数が25％を超えています');
        break;
    }

    // 前日との差をチェック
    const dayNum = parseInt(dailyData[key]?.[COLUMN_NAMES.DAILY.DAY]);
    if (dayNum > 1) {
      const prevKey = `day_${dayNum - 1}`;
      const prevData = dailyData[prevKey];
      if (prevData) {
        const prevValue = parseFloat(prevData[field]);
        if (!isNaN(prevValue) && !isNaN(numValue)) {
          const diff = Math.abs(numValue - prevValue);
          
          if (field === COLUMN_NAMES.DAILY.TEMP_1 && diff >= 3) {
            errors.push(`前日との品温差が${diff.toFixed(1)}℃あります`);
          } else if (field === COLUMN_NAMES.DAILY.SAKE_DEGREE_BAUME && diff >= 2) {
            errors.push(`前日とのボーメ差が${diff.toFixed(1)}あります`);
          } else if (field === COLUMN_NAMES.DAILY.ALCOHOL && diff >= 3) {
            errors.push(`前日とのアルコール差が${diff.toFixed(1)}％あります`);
          }
        }
      }
    }

    return errors;
  };

  // 線形補間の計算
  const linearInterpolation = (data, field, dayNum) => {
    // 現在の日に値があれば、それを返す
    const currentValue = parseFloat(data[`day_${dayNum}`]?.[field]);
    if (!isNaN(currentValue) && data[`day_${dayNum}`]?.[field] !== '') {
      return currentValue;
    }

    // 前後の値を探す
    let prevDay = null;
    let prevValue = null;
    let nextDay = null;
    let nextValue = null;

    // 前の値を探す
    for (let i = dayNum - 1; i >= 1; i--) {
      const value = parseFloat(data[`day_${i}`]?.[field]);
      if (!isNaN(value) && data[`day_${i}`]?.[field] !== '') {
        prevDay = i;
        prevValue = value;
        break;
      }
    }

    // 次の値を探す
    const maxDay = Object.keys(data).length;
    for (let i = dayNum + 1; i <= maxDay; i++) {
      const value = parseFloat(data[`day_${i}`]?.[field]);
      if (!isNaN(value) && data[`day_${i}`]?.[field] !== '') {
        nextDay = i;
        nextValue = value;
        break;
      }
    }

    // 線形補間
    if (prevDay !== null && nextDay !== null) {
      const ratio = (dayNum - prevDay) / (nextDay - prevDay);
      return prevValue + (nextValue - prevValue) * ratio;
    }

    // 前後どちらかしかない場合はその値を使用
    if (prevValue !== null) return prevValue;
    if (nextValue !== null) return nextValue;

    return null;
  };

  // セルの値を保存
  const handleCellChange = (key, field, value) => {
    // 新しいデータを作成
    const updatedData = {
      ...dailyData,
      [key]: {
        ...dailyData[key],
        [field]: value
      }
    };

    // 2段階で自動計算項目を更新
    // 第1段階：補完値のみを計算
    Object.keys(updatedData).forEach(rowKey => {
      updatedData[rowKey] = calculateAutoFields(updatedData, rowKey, true);
    });
    
    // 第2段階：補完値を使った変動・係数を計算
    Object.keys(updatedData).forEach(rowKey => {
      updatedData[rowKey] = calculateAutoFields(updatedData, rowKey, false);
    });

    setDailyData(updatedData);
    onUpdate(updatedData);
  };

  // 自動計算項目の計算
  const calculateAutoFields = (data, key, firstPass = false) => {
    const row = data[key];
    const dayNum = parseInt(row[COLUMN_NAMES.DAILY.DAY]);
    
    // 計算結果を格納するオブジェクト
    const calculated = { ...row };

    // 次の日のキー
    const nextKey = `day_${dayNum + 1}`;

    if (firstPass) {
      // 第1段階：補完値のみ計算
      
      // 2. ボーメ（補完）の計算
      const baumeInterpolated = linearInterpolation(data, COLUMN_NAMES.DAILY.SAKE_DEGREE_BAUME, dayNum);
      if (baumeInterpolated !== null) {
        calculated[COLUMN_NAMES.DAILY.BAUME_ESTIMATED] = baumeInterpolated.toFixed(2);
        // BMD（補完） = ボーメ（補完） × 日数
        calculated[COLUMN_NAMES.DAILY.BMD_COMPLEMENT] = (baumeInterpolated * dayNum).toFixed(2);
      } else {
        calculated[COLUMN_NAMES.DAILY.BAUME_ESTIMATED] = '';
        calculated[COLUMN_NAMES.DAILY.BMD_COMPLEMENT] = '';
      }

      // 3. アルコール（補完）の計算
      const alcoholInterpolated = linearInterpolation(data, COLUMN_NAMES.DAILY.ALCOHOL, dayNum);
      if (alcoholInterpolated !== null) {
        calculated[COLUMN_NAMES.DAILY.ALCOHOL_ESTIMATED] = alcoholInterpolated.toFixed(2);
      } else {
        calculated[COLUMN_NAMES.DAILY.ALCOHOL_ESTIMATED] = '';
      }
      
      // 6. BMD（元の値、補完ではない）
      const baume = parseFloat(row[COLUMN_NAMES.DAILY.SAKE_DEGREE_BAUME]);
      if (!isNaN(baume) && row[COLUMN_NAMES.DAILY.SAKE_DEGREE_BAUME] !== '') {
        calculated[COLUMN_NAMES.DAILY.BMD] = (baume * dayNum).toFixed(2);
      } else {
        calculated[COLUMN_NAMES.DAILY.BMD] = '';
      }
      
      return calculated;
    }

    // 第2段階：その他の計算
    
    // 1. 1日の品温の変動（翌日の品温1回目との差）
    if (data[nextKey]) {
      const nextTemp = parseFloat(data[nextKey][COLUMN_NAMES.DAILY.TEMP_1]);
      const currentTemp = parseFloat(row[COLUMN_NAMES.DAILY.TEMP_1]);
      if (!isNaN(nextTemp) && !isNaN(currentTemp)) {
        calculated[COLUMN_NAMES.DAILY.TEMP_CHANGE] = (nextTemp - currentTemp).toFixed(1);
        // 品温上下
        if (nextTemp > currentTemp) {
          calculated[COLUMN_NAMES.DAILY.TEMP_UP_DOWN] = '↑';
        } else if (nextTemp < currentTemp) {
          calculated[COLUMN_NAMES.DAILY.TEMP_UP_DOWN] = '↓';
        } else {
          calculated[COLUMN_NAMES.DAILY.TEMP_UP_DOWN] = '→';
        }
      }
    }

    // 4. 追い水による希釈計算
    const water = parseFloat(row[COLUMN_NAMES.DAILY.WATER]) || 0;
    const totalVolume = parseFloat(tank.metadata?.[COLUMN_NAMES.META.TOTAL_VOLUME]) || 0;
    
    if (totalVolume > 0) {
      // 前日までの追い水総量を計算
      let cumulativeWater = 0;
      for (let i = 1; i < dayNum; i++) {
        const prevKey = `day_${i}`;
        if (data[prevKey]) {
          cumulativeWater += parseFloat(data[prevKey][COLUMN_NAMES.DAILY.WATER]) || 0;
        }
      }
      
      const dilutionRate = (totalVolume + cumulativeWater + water) / (totalVolume + cumulativeWater);
      
      // ボーメ（追い水後）
      const baumeInterpolated = parseFloat(calculated[COLUMN_NAMES.DAILY.BAUME_ESTIMATED]);
      if (!isNaN(baumeInterpolated)) {
        calculated[COLUMN_NAMES.DAILY.BAUME_AFTER_WATER] = (baumeInterpolated / dilutionRate).toFixed(2);
      } else {
        calculated[COLUMN_NAMES.DAILY.BAUME_AFTER_WATER] = '';
      }
      
      // アルコール（追い水後）
      const alcoholInterpolated = parseFloat(calculated[COLUMN_NAMES.DAILY.ALCOHOL_ESTIMATED]);
      if (!isNaN(alcoholInterpolated)) {
        calculated[COLUMN_NAMES.DAILY.ALCOHOL_AFTER_WATER] = (alcoholInterpolated / dilutionRate).toFixed(2);
      } else {
        calculated[COLUMN_NAMES.DAILY.ALCOHOL_AFTER_WATER] = '';
      }
    }

    // 5. 1日の変動（翌日との差）
    if (data[nextKey]) {
      const nextRow = data[nextKey];
      
      // ボーメ変動（補完値を使用）
      const currentBaume = parseFloat(calculated[COLUMN_NAMES.DAILY.BAUME_ESTIMATED]);
      const nextBaume = parseFloat(nextRow[COLUMN_NAMES.DAILY.BAUME_ESTIMATED]);
      if (!isNaN(currentBaume) && !isNaN(nextBaume)) {
        calculated[COLUMN_NAMES.DAILY.BAUME_CHANGE] = (currentBaume - nextBaume).toFixed(2);
      } else {
        calculated[COLUMN_NAMES.DAILY.BAUME_CHANGE] = '';
      }
      
      // アルコール変動（補完値を使用）
      const currentAlcohol = parseFloat(calculated[COLUMN_NAMES.DAILY.ALCOHOL_ESTIMATED]);
      const nextAlcohol = parseFloat(nextRow[COLUMN_NAMES.DAILY.ALCOHOL_ESTIMATED]);
      if (!isNaN(currentAlcohol) && !isNaN(nextAlcohol)) {
        calculated[COLUMN_NAMES.DAILY.ALCOHOL_CHANGE] = (nextAlcohol - currentAlcohol).toFixed(2);
      } else {
        calculated[COLUMN_NAMES.DAILY.ALCOHOL_CHANGE] = '';
      }
      
      // アルコール係数（補完値を使用）
      const baumeDiff = parseFloat(calculated[COLUMN_NAMES.DAILY.BAUME_CHANGE]);
      const alcoholDiff = parseFloat(calculated[COLUMN_NAMES.DAILY.ALCOHOL_CHANGE]);
      if (!isNaN(baumeDiff) && !isNaN(alcoholDiff) && baumeDiff !== 0) {
        calculated[COLUMN_NAMES.DAILY.ALCOHOL_COEFF] = (alcoholDiff / baumeDiff).toFixed(3);
      } else {
        calculated[COLUMN_NAMES.DAILY.ALCOHOL_COEFF] = '';
      }
    }

    return calculated;
  };

  return (
    <div>
      {/* メタデータ表示 */}
      <div className="mb-4 p-4 bg-gray-50 rounded-lg">
        <div className="grid grid-cols-4 gap-4 text-sm">
          <div>
            <span className="text-gray-600">タンク番号:</span>
            <span className="ml-2 font-bold text-lg">{tank.metadata?.[COLUMN_NAMES.META.TANK_NUMBER]}</span>
          </div>
          <div>
            <span className="text-gray-600">酵母:</span>
            <span className="ml-2 font-medium">{tank.metadata?.[COLUMN_NAMES.META.YEAST]}</span>
          </div>
          <div>
            <span className="text-gray-600">仕込み規模:</span>
            <span className="ml-2 font-medium">{tank.metadata?.[COLUMN_NAMES.META.BATCH_SIZE]}L</span>
          </div>
          <div>
            <span className="text-gray-600">仕込み総量:</span>
            <span className="ml-2 font-medium">{tank.metadata?.[COLUMN_NAMES.META.TOTAL_VOLUME]}L</span>
          </div>
          <div>
            <span className="text-gray-600">酒質設計:</span>
            <span className="ml-2 font-medium">{tank.metadata?.[COLUMN_NAMES.META.DESIGN]}</span>
          </div>
          <div>
            <span className="text-gray-600">特定名称:</span>
            <span className="ml-2 font-medium">{tank.metadata?.[COLUMN_NAMES.META.SPECIFIC_NAME]}</span>
          </div>
          <div>
            <span className="text-gray-600">仕込み日:</span>
            <span className="ml-2 font-medium">{tank.metadata?.['仕込み日']}</span>
          </div>
          <div>
            <span className="text-gray-600">上槽日:</span>
            <span className="ml-2 font-medium">{tank.metadata?.['上槽日'] || '未定'}</span>
          </div>
        </div>
      </div>

      {/* 日次データテーブル */}
      <div className="bg-white rounded-lg shadow-sm">
        {/* 期間情報 */}
        <div className="px-4 py-3 border-b border-gray-200">
          <h3 className="text-lg font-semibold">
            日次データ入力
            {tank.metadata?.['仕込み日'] && (
              <span className="ml-2 text-sm text-gray-600">
                （{tank.metadata['仕込み日']} ～ {tank.metadata?.['上槽日'] || '継続中'}）
              </span>
            )}
          </h3>
        </div>

        {/* テーブル */}
        <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
          <table className="min-w-full border-collapse">
            <thead className="bg-gray-50 sticky top-0 z-10">
              <tr className="text-xs">
                <th className="sticky left-0 bg-gray-50 px-3 py-3 text-left font-medium text-gray-700 border-b border-r z-20">
                  月日
                </th>
                <th className="px-3 py-3 text-center font-medium text-gray-700 border-b whitespace-nowrap">
                  日数
                </th>
                <th className="px-3 py-3 text-center font-medium text-gray-700 border-b whitespace-nowrap">
                  品温<br/>(℃)
                </th>
                <th className="px-3 py-3 text-center font-medium text-gray-700 border-b whitespace-nowrap">
                  温度<br/>変動
                </th>
                <th className="px-3 py-3 text-center font-medium text-gray-700 border-b whitespace-nowrap">
                  方向
                </th>
                <th className="px-3 py-3 text-center font-medium text-gray-700 border-b whitespace-nowrap">
                  ボーメ
                </th>
                <th className="px-3 py-3 text-center font-medium text-gray-700 border-b whitespace-nowrap">
                  ボーメ<br/>(補完)
                </th>
                <th className="px-3 py-3 text-center font-medium text-gray-700 border-b whitespace-nowrap">
                  アルコール<br/>(%)
                </th>
                <th className="px-3 py-3 text-center font-medium text-gray-700 border-b whitespace-nowrap">
                  アルコール<br/>(補完)
                </th>
                <th className="px-3 py-3 text-center font-medium text-gray-700 border-b whitespace-nowrap">
                  追水<br/>(L)
                </th>
                <th className="px-3 py-3 text-center font-medium text-gray-700 border-b whitespace-nowrap">
                  BMD<br/>(補完)
                </th>
                <th className="px-3 py-3 text-center font-medium text-gray-700 border-b whitespace-nowrap">
                  アルコール<br/>係数
                </th>
                <th className="px-3 py-3 text-center font-medium text-gray-700 border-b whitespace-nowrap">
                  酸度
                </th>
                <th className="px-3 py-3 text-center font-medium text-gray-700 border-b whitespace-nowrap">
                  アミノ酸
                </th>
              </tr>
            </thead>
            <tbody>
              {dateMapping.length === 0 ? (
                <tr>
                  <td colSpan={14} className="px-4 py-8 text-center text-gray-500">
                    仕込み日を設定してください
                  </td>
                </tr>
              ) : (
                dateMapping.map(({ key, date, dayNumber, isToday }) => {
                  const row = dailyData[key] || {};
                  const dayOfWeek = ['日', '月', '火', '水', '木', '金', '土'][new Date(date).getDay()];
                  
                  return (
                    <tr key={key} className={`border-b ${isToday ? 'bg-yellow-50' : ''}`}>
                      <td className="sticky left-0 bg-white px-3 py-2 font-medium text-gray-900 border-r whitespace-nowrap">
                        {date} ({dayOfWeek})
                      </td>
                      <td className="px-3 py-2 text-center font-medium text-gray-700">{dayNumber}</td>
                      <td className="px-1 py-1 text-center">
                        <input
                          type="number"
                          step="0.1"
                          value={row[COLUMN_NAMES.DAILY.TEMP_1] || ''}
                          onChange={(e) => handleCellChange(key, COLUMN_NAMES.DAILY.TEMP_1, e.target.value)}
                          onWheel={(e) => e.target.blur()}
                          className="w-16 px-2 py-1 border border-gray-300 rounded text-center focus:border-blue-500 focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                          placeholder=""
                        />
                      </td>
                      <td className="px-3 py-2 text-center font-medium text-gray-700">
                        {row[COLUMN_NAMES.DAILY.TEMP_CHANGE] || '-'}
                      </td>
                      <td className="px-3 py-2 text-center font-medium">
                        <span className={`${
                          row[COLUMN_NAMES.DAILY.TEMP_UP_DOWN] === '↑' ? 'text-red-600' :
                          row[COLUMN_NAMES.DAILY.TEMP_UP_DOWN] === '↓' ? 'text-blue-600' :
                          'text-gray-600'
                        }`}>
                          {row[COLUMN_NAMES.DAILY.TEMP_UP_DOWN] || '-'}
                        </span>
                      </td>
                      <td className="px-1 py-1 text-center">
                        <input
                          type="number"
                          step="0.1"
                          value={row[COLUMN_NAMES.DAILY.SAKE_DEGREE_BAUME] || ''}
                          onChange={(e) => handleCellChange(key, COLUMN_NAMES.DAILY.SAKE_DEGREE_BAUME, e.target.value)}
                          onWheel={(e) => e.target.blur()}
                          className="w-16 px-2 py-1 border border-gray-300 rounded text-center focus:border-blue-500 focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                          placeholder=""
                        />
                      </td>
                      <td className="px-3 py-2 text-center font-medium text-gray-700">
                        {row[COLUMN_NAMES.DAILY.BAUME_ESTIMATED] || '-'}
                      </td>
                      <td className="px-1 py-1 text-center">
                        <input
                          type="number"
                          step="0.1"
                          value={row[COLUMN_NAMES.DAILY.ALCOHOL] || ''}
                          onChange={(e) => handleCellChange(key, COLUMN_NAMES.DAILY.ALCOHOL, e.target.value)}
                          onWheel={(e) => e.target.blur()}
                          className="w-16 px-2 py-1 border border-gray-300 rounded text-center focus:border-blue-500 focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                          placeholder=""
                        />
                      </td>
                      <td className="px-3 py-2 text-center font-medium text-gray-700">
                        {row[COLUMN_NAMES.DAILY.ALCOHOL_ESTIMATED] || '-'}
                      </td>
                      <td className="px-1 py-1 text-center">
                        <input
                          type="number"
                          step="1"
                          value={row[COLUMN_NAMES.DAILY.WATER] || ''}
                          onChange={(e) => handleCellChange(key, COLUMN_NAMES.DAILY.WATER, e.target.value)}
                          onWheel={(e) => e.target.blur()}
                          className="w-16 px-2 py-1 border border-gray-300 rounded text-center focus:border-blue-500 focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                          placeholder=""
                        />
                      </td>
                      <td className="px-3 py-2 text-center font-medium text-gray-700">
                        {row[COLUMN_NAMES.DAILY.BMD_COMPLEMENT] || '-'}
                      </td>
                      <td className="px-3 py-2 text-center font-medium text-gray-700">
                        {row[COLUMN_NAMES.DAILY.ALCOHOL_COEFF] || '-'}
                      </td>
                      <td className="px-1 py-1 text-center">
                        <input
                          type="number"
                          step="0.1"
                          value={row[COLUMN_NAMES.DAILY.ACIDITY] || ''}
                          onChange={(e) => handleCellChange(key, COLUMN_NAMES.DAILY.ACIDITY, e.target.value)}
                          onWheel={(e) => e.target.blur()}
                          className="w-16 px-2 py-1 border border-gray-300 rounded text-center focus:border-blue-500 focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                          placeholder=""
                        />
                      </td>
                      <td className="px-1 py-1 text-center">
                        <input
                          type="number"
                          step="0.1"
                          value={row[COLUMN_NAMES.DAILY.AMINO_ACID] || ''}
                          onChange={(e) => handleCellChange(key, COLUMN_NAMES.DAILY.AMINO_ACID, e.target.value)}
                          onWheel={(e) => e.target.blur()}
                          className="w-16 px-2 py-1 border border-gray-300 rounded text-center focus:border-blue-500 focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                          placeholder=""
                        />
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 凡例 */}
      <div className="mt-4 text-xs text-gray-600 flex items-center space-x-4">
        <span>※ 温度変動: <span className="text-red-600 font-medium">↑</span>上昇 / <span className="text-blue-600 font-medium">↓</span>下降 / <span className="text-gray-600">→</span>変化なし</span>
        <span>※ 補完列は空欄を線形補間します</span>
        <span>※ BMDとアルコール係数は補完値から自動計算されます</span>
      </div>
    </div>
  );
};

export default DailyDataTable;