export const COLUMN_NAMES = {
    META: {
      TANK_NUMBER: '順号',
      BATCH_SIZE: '仕込み規模',
      YEAST: '酵母',
      DESIGN: '酒質設計',
      SPECIFIC_NAME: '特定名称',
      TOTAL_VOLUME: '仕込み総量',
      TEMP_SUM_5DAYS: '5日までの積算品温',
      MAX_BAUME: '最高ボーメ',
      AB_START_BAUME: 'AB開始ボーメ',
      AB_START_ALCOHOL: 'AB開始アルコール',
      FINAL_BAUME: '最終ボーメ',
      FINAL_ALCOHOL: '最終アルコール度数',
      MAX_BMD: '最高BMD',
      MAX_BMD_DAY: '最高BMD日数',
      TOTAL_WATER: '追い水総量',
      WATER_RATIO: '追い水歩合',
      LATE_WATER: '後半追い水量',
      LATE_WATER_RATIO: '後半追い水割合',
    },
    DAILY: {
      DATE: '月日',
      DAY: '日数',
      TEMP_1: '品温1回目',
      TEMP_CHANGE: '1日の品温の変動',
      TEMP_UP_DOWN: '品温上下',
      SAKE_DEGREE_BAUME: '日本酒度・ボーメ',
      BAUME_BMD_DAY: 'ボーメ（BMD/日数)',
      BAUME_ESTIMATED: 'ボーメ（補完)',
      BAUME_AFTER_WATER: 'ボーメ（追い水後)',
      BAUME_CHANGE: '1日のボーメ変動',
      BAUME_CHANGE_WATER: '1日のボーメ変動（追い水反映）',
      ALCOHOL: 'アルコール',
      ALCOHOL_ESTIMATED: 'アルコール（補完)',
      ALCOHOL_AFTER_WATER: 'アルコール（追い水後)',
      ALCOHOL_CHANGE: '1日のアルコール変動',
      ALCOHOL_CHANGE_WATER: '1日のアルコール変動（追い水反映）',
      ALCOHOL_COEFF: 'アルコール係数',
      ALCOHOL_COEFF_WATER: 'アルコール係数（追い水反映）',
      ACIDITY: '酸度',
      AMINO_ACID: 'アミノ酸',
      BMD: 'BMD',
      BMD_COMPLEMENT: 'BMD（補完)',
      BMD_CHANGE: '1日のBMD変動',
      ORIGINAL_EXTRACT: '原エキス',
      WATER: '追水',
    },
  };
  
  export const parseCSV = (file, callback) => {
    const reader = new FileReader();
  
    reader.onload = (event) => {
      try {
        const text = event.target.result;
        const rows = text.split('\n').map(row => row.split(',').map(cell => cell.trim()));
  
        if (rows.length < 40) {
          throw new Error('CSVファイルの行数が不足しています（40行必要）');
        }
  
        const metadataRows = rows.slice(0, 7);
        const headers = rows[7] || [];
        const dailyDataRows = rows.slice(8);
  
        console.log('Raw headers:', headers);
  
        const tanks = [];
        const tankOffsets = [];
        // メタデータ行からタンクIDを検出
        for (let i = 0; i < metadataRows[0].length; i += 25) {
          const tankId = metadataRows[0][i + 1];
          if (tankId && !isNaN(parseInt(tankId))) {
            tankOffsets.push(i);
            console.log(`Tank ${tankId} detected at metadata offset ${i}`);
          }
        }
  
        if (tankOffsets.length === 0) {
          throw new Error('タンクIDをメタデータ行から検出できませんでした。CSVファイルの形式を確認してください。');
        }
  
        // 動的なcolMapを構築
        const colMap = {};
        headers.slice(0, 25).forEach((header, index) => {
          const dailyKey = Object.values(COLUMN_NAMES.DAILY).find(key => key === header);
          if (dailyKey) {
            colMap[dailyKey] = index;
            console.log(`Mapped ${dailyKey} to column ${index}`);
          }
        });
  
        if (Object.keys(colMap).length < Object.values(COLUMN_NAMES.DAILY).length) {
          console.warn('Insufficient column mapping. Using full default colMap.');
          const defaultColMap = {
            [COLUMN_NAMES.DAILY.DATE]: 0,
            [COLUMN_NAMES.DAILY.DAY]: 1,
            [COLUMN_NAMES.DAILY.TEMP_1]: 2,
            [COLUMN_NAMES.DAILY.TEMP_CHANGE]: 3,
            [COLUMN_NAMES.DAILY.TEMP_UP_DOWN]: 4,
            [COLUMN_NAMES.DAILY.SAKE_DEGREE_BAUME]: 5,
            [COLUMN_NAMES.DAILY.BAUME_BMD_DAY]: 6,
            [COLUMN_NAMES.DAILY.BAUME_ESTIMATED]: 7,
            [COLUMN_NAMES.DAILY.BAUME_AFTER_WATER]: 8,
            [COLUMN_NAMES.DAILY.BAUME_CHANGE]: 9,
            [COLUMN_NAMES.DAILY.BAUME_CHANGE_WATER]: 10,
            [COLUMN_NAMES.DAILY.ALCOHOL]: 11,
            [COLUMN_NAMES.DAILY.ALCOHOL_ESTIMATED]: 12,
            [COLUMN_NAMES.DAILY.ALCOHOL_AFTER_WATER]: 13,
            [COLUMN_NAMES.DAILY.ALCOHOL_CHANGE]: 14,
            [COLUMN_NAMES.DAILY.ALCOHOL_CHANGE_WATER]: 15,
            [COLUMN_NAMES.DAILY.ALCOHOL_COEFF]: 16,
            [COLUMN_NAMES.DAILY.ALCOHOL_COEFF_WATER]: 17,
            [COLUMN_NAMES.DAILY.ACIDITY]: 18,
            [COLUMN_NAMES.DAILY.AMINO_ACID]: 19,
            [COLUMN_NAMES.DAILY.BMD]: 20,
            [COLUMN_NAMES.DAILY.BMD_COMPLEMENT]: 21,
            [COLUMN_NAMES.DAILY.BMD_CHANGE]: 22,
            [COLUMN_NAMES.DAILY.ORIGINAL_EXTRACT]: 23,
            [COLUMN_NAMES.DAILY.WATER]: 24,
          };
          Object.assign(colMap, defaultColMap);
          console.log('Full default colMap:', colMap);
        }
  
        tankOffsets.forEach(offset => {
          const tankId = metadataRows[0][offset + 1];
          if (!tankId || isNaN(parseInt(tankId))) return;
  
          const metadata = {};
          metadataRows.forEach((row, rowIndex) => {
            row.slice(offset, offset + 25).forEach((cell, j) => {
              if (j % 2 === 0) {
                const key = cell;
                const value = row[offset + j + 1];
                if (key && Object.values(COLUMN_NAMES.META).includes(key) && !metadata[key]) {
                  metadata[key] = value !== '' ? (isNaN(value) ? value : parseFloat(value) || null) : null;
                  console.log(`Metadata row ${rowIndex + 1} for tank ${tankId}: ${key} = ${value}`);
                }
              }
            });
          });
  
          const dailyData = {};
          dailyDataRows.forEach((row, dayIndex) => {
            const day = parseInt(row[offset + colMap[COLUMN_NAMES.DAILY.DAY]]) || (dayIndex + 1);
            if (!isNaN(day)) {
              dailyData[day] = {};
              Object.entries(colMap).forEach(([key, colIndex]) => {
                const value = row[offset + colIndex];
                dailyData[day][key] = value !== '' ? (['品温上下', COLUMN_NAMES.DAILY.WATER].includes(key) ? value : parseFloat(value) || null) : null;
              });
              console.log(`Daily data for tank ${tankId}, day ${day}:`, dailyData[day]);
            }
          });
  
          if (Object.keys(metadata).length > 0 || Object.keys(dailyData).length > 0) {
            tanks.push({ tankId, metadata, dailyData });
          }
        });
  
        console.log(`Parsed ${tanks.length} tanks:`, JSON.stringify(tanks, null, 2));
        callback(tanks);
      } catch (error) {
        console.error('CSV parsing error:', error);
        callback(null, error);
      }
    };
  
    reader.onerror = () => {
      console.error('File reading error');
      callback(null, new Error('ファイルの読み込みに失敗しました'));
    };
  
    reader.readAsText(file, 'UTF-8');
  };