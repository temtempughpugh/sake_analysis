export const parseCSV = (file, callback) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target.result;
      const rows = text.split('\n').map(row => row.split(',').map(cell => cell.trim()));
      
      const metadataRows = rows.slice(0, 7);
      const headers = rows[7];
      const dailyDataRows = rows.slice(8);
  
      const tanks = [];
      const colMap = {
        '品温1回目': 2, // C
        '品温上下': 4, // E
        'ボーメ（補完）': 7, // H
        'ボーメ（追い水後）': 8, // I
        'アルコール（補完）': 12, // M
        'アルコール（追い水後）': 13, // N
        'アルコール係数（追い水反映）': 17, // R
        'BMD（補完）': 21, // V
        '追い水': 24, // Y
      };
  
      for (let i = 0; i < headers.length; i += Object.keys(colMap).length) {
        if (headers[i].startsWith('タンク')) {
          const tankId = headers[i];
          const metadata = {};
          metadataRows.forEach((row, index) => {
            metadata[row[0]] = row[i] ? (isNaN(row[i]) ? row[i] : parseFloat(row[i])) : null;
          });
  
          const dailyData = {};
          dailyDataRows.forEach((row, dayIndex) => {
            if (row[0]) {
              dailyData[dayIndex + 1] = {
                '品温1回目': row[i + colMap['品温1回目']] ? parseFloat(row[i + colMap['品温1回目']]) : null,
                '品温上下': row[i + colMap['品温上下']] || null,
                'ボーメ（補完）': row[i + colMap['ボーメ（補完）']] ? parseFloat(row[i + colMap['ボーメ（補完）']]) : null,
                'ボーメ（追い水後）': row[i + colMap['ボーメ（追い水後）']] ? parseFloat(row[i + colMap['ボーメ（追い水後）']]) : null,
                'アルコール（補完）': row[i + colMap['アルコール（補完）']] ? parseFloat(row[i + colMap['アルコール（補完）']]) : null,
                'アルコール（追い水後）': row[i + colMap['アルコール（追い水後）']] ? parseFloat(row[i + colMap['アルコール（追い水後）']]) : null,
                'アルコール係数（追い水反映）': row[i + colMap['アルコール係数（追い水反映）']] ? parseFloat(row[i + colMap['アルコール係数（追い水反映）']]) : null,
                'BMD（補完）': row[i + colMap['BMD（補完）']] ? parseFloat(row[i + colMap['BMD（補完）']]) : null,
                '追い水': row[i + colMap['追い水']] ? parseFloat(row[i + colMap['追い水']]) : null,
              };
            }
          });
  
          tanks.push({ tankId, metadata, dailyData });
        }
      }
  
      callback(tanks);
    };
    reader.readAsText(file);
  };