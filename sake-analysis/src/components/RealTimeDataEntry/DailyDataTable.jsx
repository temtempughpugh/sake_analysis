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
        [COLUMN_NAMES.DAILY.BAUME]: existingData[COLUMN_NAMES.DAILY.BAUME] || '',
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

  // 編集開始時にフォーカス - 削除（不要）

  // 新しい行を追加 - 削除（不要になった）

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
      case COLUMN_NAMES.DAILY.BAUME:
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
          } else if (field === COLUMN_NAMES.DAILY.BAUME && diff >= 2) {
            errors.push(`前日とのボーメ差が${diff.toFixed(1)}あります`);
          } else if (field === COLUMN_NAMES.DAILY.ALCOHOL && diff >= 3) {
            errors.push(`前日とのアルコール差が${diff.toFixed(1)}％あります`);
          }
        }
      }
    }

    return errors;
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

    // 全ての行の自動計算項目を更新
    Object.keys(updatedData).forEach(rowKey => {
      updatedData[rowKey] = calculateAutoFields(updatedData, rowKey);
    });

    setDailyData(updatedData);
    onUpdate(updatedData);
  };

  // 自動計算項目の計算
  const calculateAutoFields = (data, key) => {
    const row = data[key];
    const dayNum = parseInt(row[COLUMN_NAMES.DAILY.DAY]);
    
    // 計算結果を格納するオブジェクト
    const calculated = { ...row };

    // 1. 1日の品温の変動（翌日の品温1回目との差）
    const nextKey = `day_${dayNum + 1}`;
    if (data[nextKey]) {
      const nextTemp = parseFloat(data[nextKey][COLUMN_NAMES.DAILY.TEMP_1]);
      const currentTemp = parseFloat(row[COLUMN_NAMES.DAILY.TEMP_1]);
      if (!isNaN(nextTemp) && !isNaN(currentTemp)) {
        calculated[COLUMN_NAMES.DAILY.TEMP_DIFF] = (nextTemp - currentTemp).toFixed(1);
        // 品温上下
        if (nextTemp > currentTemp) {
          calculated[COLUMN_NAMES.DAILY.TEMP_DIRECTION] = '↑';
        } else if (nextTemp < currentTemp) {
          calculated[COLUMN_NAMES.DAILY.TEMP_DIRECTION] = '↓';
        } else {
          calculated[COLUMN_NAMES.DAILY.TEMP_DIRECTION] = '→';
        }
      }
    }

    // 2. ボーメ関連の計算
    const baume = parseFloat(row[COLUMN_NAMES.DAILY.BAUME]);
    if (!isNaN(baume) && row[COLUMN_NAMES.DAILY.BAUME] !== '') {
      // ボーメ（BMD/日数）
      calculated[COLUMN_NAMES.DAILY.BAUME_BMD_DAY] = baume.toFixed(2);
      
      // BMD = ボーメ × 日数
      calculated[COLUMN_NAMES.DAILY.BMD] = (baume * dayNum).toFixed(2);
      
      // ボーメ（補完）
      calculated[COLUMN_NAMES.DAILY.BAUME_COMPLEMENT] = baume.toFixed(2);
      calculated[COLUMN_NAMES.DAILY.BMD_COMPLEMENT] = (baume * dayNum).toFixed(2);
    } else {
      calculated[COLUMN_NAMES.DAILY.BAUME_BMD_DAY] = '';
      calculated[COLUMN_NAMES.DAILY.BMD] = '';
      calculated[COLUMN_NAMES.DAILY.BAUME_COMPLEMENT] = '';
      calculated[COLUMN_NAMES.DAILY.BMD_COMPLEMENT] = '';
    }

    // 3. 追い水による希釈計算
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
      if (!isNaN(baume) && row[COLUMN_NAMES.DAILY.BAUME] !== '') {
        calculated[COLUMN_NAMES.DAILY.BAUME_AFTER_WATER] = (baume / dilutionRate).toFixed(2);
      } else {
        calculated[COLUMN_NAMES.DAILY.BAUME_AFTER_WATER] = '';
      }
      
      // アルコール（追い水後）
      const alcoholValue = parseFloat(row[COLUMN_NAMES.DAILY.ALCOHOL]);
      if (!isNaN(alcoholValue) && row[COLUMN_NAMES.DAILY.ALCOHOL] !== '') {
        calculated[COLUMN_NAMES.DAILY.ALCOHOL_AFTER_WATER] = (alcoholValue / dilutionRate).toFixed(2);
      } else {
        calculated[COLUMN_NAMES.DAILY.ALCOHOL_AFTER_WATER] = '';
      }
    }

    // 4. アルコール関連
    const alcoholValue = parseFloat(row[COLUMN_NAMES.DAILY.ALCOHOL]);
    if (!isNaN(alcoholValue) && row[COLUMN_NAMES.DAILY.ALCOHOL] !== '') {
      calculated[COLUMN_NAMES.DAILY.ALCOHOL_COMPLEMENT] = alcoholValue.toFixed(2);
    } else {
      calculated[COLUMN_NAMES.DAILY.ALCOHOL_COMPLEMENT] = '';
    }

    // 5. 1日の変動（前日との差）
    if (dayNum > 1) {
      const prevKey = `day_${dayNum - 1}`;
      const prevRow = data[prevKey];
      if (prevRow) {
        // ボーメ変動
        const prevBaume = parseFloat(prevRow[COLUMN_NAMES.DAILY.BAUME_COMPLEMENT] || prevRow[COLUMN_NAMES.DAILY.BAUME]);
        const currentBaume = parseFloat(calculated[COLUMN_NAMES.DAILY.BAUME_COMPLEMENT] || calculated[COLUMN_NAMES.DAILY.BAUME]);
        if (!isNaN(prevBaume) && !isNaN(currentBaume)) {
          calculated[COLUMN_NAMES.DAILY.BAUME_DIFF] = (prevBaume - currentBaume).toFixed(2);
        }
        
        // アルコール変動
        const prevAlcohol = parseFloat(prevRow[COLUMN_NAMES.DAILY.ALCOHOL_COMPLEMENT] || prevRow[COLUMN_NAMES.DAILY.ALCOHOL]);
        const currentAlcohol = parseFloat(calculated[COLUMN_NAMES.DAILY.ALCOHOL_COMPLEMENT] || calculated[COLUMN_NAMES.DAILY.ALCOHOL]);
        if (!isNaN(prevAlcohol) && !isNaN(currentAlcohol)) {
          calculated[COLUMN_NAMES.DAILY.ALCOHOL_DIFF] = (currentAlcohol - prevAlcohol).toFixed(2);
        }
        
        // アルコール係数
        const baumeDiff = parseFloat(calculated[COLUMN_NAMES.DAILY.BAUME_DIFF]);
        const alcoholDiff = parseFloat(calculated[COLUMN_NAMES.DAILY.ALCOHOL_DIFF]);
        if (!isNaN(baumeDiff) && !isNaN(alcoholDiff) && baumeDiff !== 0) {
          calculated[COLUMN_NAMES.DAILY.ALCOHOL_COEFF] = (alcoholDiff / baumeDiff).toFixed(3);
        } else {
          calculated[COLUMN_NAMES.DAILY.ALCOHOL_COEFF] = '';
        }
      }
    }

    return calculated;
  };

  // 編集可能なセルかどうか
  const isEditableField = (field) => {
    const editableFields = [
      COLUMN_NAMES.DAILY.TEMP_1,
      COLUMN_NAMES.DAILY.BAUME,
      COLUMN_NAMES.DAILY.ALCOHOL,
      COLUMN_NAMES.DAILY.ACIDITY,
      COLUMN_NAMES.DAILY.AMINO_ACID,
      COLUMN_NAMES.DAILY.WATER
    ];
    return editableFields.includes(field);
  };

  // キーボードナビゲーション - 削除（通常のinput操作で十分）

  // データを日数順にソート - 削除（dateMapping使用）

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
            <span className="ml-2 font-medium">{tank.metadata?.[COLUMN_NAMES.META.BATCH_SIZE]}</span>
          </div>
          <div>
            <span className="text-gray-600">仕込み総量:</span>
            <span className="ml-2 font-medium">{tank.metadata?.[COLUMN_NAMES.META.TOTAL_VOLUME]}</span>
          </div>
          <div>
            <span className="text-gray-600">酒質設計:</span>
            <span className="ml-2 font-medium">{tank.metadata?.[COLUMN_NAMES.META.DESIGN] || '-'}</span>
          </div>
          <div>
            <span className="text-gray-600">特定名称:</span>
            <span className="ml-2 font-medium">{tank.metadata?.[COLUMN_NAMES.META.SPECIFIC_NAME] || '-'}</span>
          </div>
          <div>
            <span className="text-gray-600">仕込み日:</span>
            <span className="ml-2 font-medium">{tank.metadata?.['仕込み日']}</span>
          </div>
          <div>
            <span className="text-gray-600">上槽日:</span>
            <span className="ml-2 font-medium">{tank.metadata?.['上槽日'] || '進行中'}</span>
          </div>
        </div>
      </div>

      {/* データテーブル */}
      <div className="border border-gray-300 rounded-lg overflow-hidden">
        <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
          <table className="min-w-full divide-y divide-gray-200 text-sm relative">
            <thead className="bg-gray-50 sticky top-0 z-20">
              <tr>
                <th className="px-3 py-3 text-left font-medium text-gray-900 sticky left-0 bg-gray-50 z-30">月日</th>
                <th className="px-3 py-3 text-center font-medium text-gray-900">日数</th>
                <th className="px-3 py-3 text-center font-medium text-gray-900">品温<br/>(℃)</th>
                <th className="px-3 py-3 text-center font-medium text-gray-900">変動</th>
                <th className="px-3 py-3 text-center font-medium text-gray-900">ボーメ</th>
                <th className="px-3 py-3 text-center font-medium text-gray-900">アルコール<br/>(%)</th>
                <th className="px-3 py-3 text-center font-medium text-gray-900">酸度</th>
                <th className="px-3 py-3 text-center font-medium text-gray-900">アミノ酸</th>
                <th className="px-3 py-3 text-center font-medium text-gray-900">追水<br/>(L)</th>
                <th className="px-3 py-3 text-center font-medium text-gray-900">BMD</th>
                <th className="px-3 py-3 text-center font-medium text-gray-900">係数</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {dateMapping.length === 0 ? (
                <tr>
                  <td colSpan="11" className="px-3 py-4 text-center text-gray-500">
                    仕込み日を設定してください
                  </td>
                </tr>
              ) : (
                dateMapping.map(({ key, dayNumber, date, isToday }) => {
                  const row = dailyData[key] || {};
                  const dayOfWeek = ['日', '月', '火', '水', '木', '金', '土'][new Date(date).getDay()];
                  
                  return (
                    <tr key={key} className={`hover:bg-gray-50 ${isToday ? 'bg-yellow-50' : ''}`}>
                      <td className={`px-3 py-2 font-medium sticky left-0 ${isToday ? 'bg-yellow-50' : 'bg-white'} z-10 border-r`}>
                        {date} ({dayOfWeek})
                      </td>
                      <td className="px-3 py-2 text-center font-medium">
                        {dayNumber}
                      </td>
                      <td className="px-1 py-1 text-center">
                        <input
                          type="number"
                          step="0.1"
                          value={row[COLUMN_NAMES.DAILY.TEMP_1] || ''}
                          onChange={(e) => handleCellChange(key, COLUMN_NAMES.DAILY.TEMP_1, e.target.value)}
                          className="w-16 px-2 py-1 border border-gray-300 rounded text-center focus:border-blue-500 focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                          placeholder=""
                        />
                      </td>
                      <td className="px-3 py-2 text-center">
                        <span className={`font-medium ${
                          row[COLUMN_NAMES.DAILY.TEMP_DIRECTION] === '↑' ? 'text-red-600' :
                          row[COLUMN_NAMES.DAILY.TEMP_DIRECTION] === '↓' ? 'text-blue-600' :
                          'text-gray-600'
                        }`}>
                          {row[COLUMN_NAMES.DAILY.TEMP_DIRECTION] || '-'}
                        </span>
                      </td>
                      <td className="px-1 py-1 text-center">
                        <input
                          type="number"
                          step="0.1"
                          value={row[COLUMN_NAMES.DAILY.BAUME] || ''}
                          onChange={(e) => handleCellChange(key, COLUMN_NAMES.DAILY.BAUME, e.target.value)}
                          className="w-16 px-2 py-1 border border-gray-300 rounded text-center focus:border-blue-500 focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                          placeholder=""
                        />
                      </td>
                      <td className="px-1 py-1 text-center">
                        <input
                          type="number"
                          step="0.1"
                          value={row[COLUMN_NAMES.DAILY.ALCOHOL] || ''}
                          onChange={(e) => handleCellChange(key, COLUMN_NAMES.DAILY.ALCOHOL, e.target.value)}
                          className="w-16 px-2 py-1 border border-gray-300 rounded text-center focus:border-blue-500 focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                          placeholder=""
                        />
                      </td>
                      <td className="px-1 py-1 text-center">
                        <input
                          type="number"
                          step="0.1"
                          value={row[COLUMN_NAMES.DAILY.ACIDITY] || ''}
                          onChange={(e) => handleCellChange(key, COLUMN_NAMES.DAILY.ACIDITY, e.target.value)}
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
                          className="w-16 px-2 py-1 border border-gray-300 rounded text-center focus:border-blue-500 focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                          placeholder=""
                        />
                      </td>
                      <td className="px-1 py-1 text-center">
                        <input
                          type="number"
                          step="1"
                          value={row[COLUMN_NAMES.DAILY.WATER] || ''}
                          onChange={(e) => handleCellChange(key, COLUMN_NAMES.DAILY.WATER, e.target.value)}
                          className="w-16 px-2 py-1 border border-gray-300 rounded text-center focus:border-blue-500 focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                          placeholder=""
                        />
                      </td>
                      <td className="px-3 py-2 text-center font-medium text-gray-700">
                        {row[COLUMN_NAMES.DAILY.BMD_COMPLEMENT] || row[COLUMN_NAMES.DAILY.BMD] || '-'}
                      </td>
                      <td className="px-3 py-2 text-center font-medium text-gray-700">
                        {row[COLUMN_NAMES.DAILY.ALCOHOL_COEFF] || '-'}
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
        <span>※ BMDとアルコール係数は自動計算されます</span>
      </div>
    </div>
  );
};

export default DailyDataTable;