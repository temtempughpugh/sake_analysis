import { parse } from 'date-fns';

export const transformTankData = (tanks) => {
  const numericFields = [
    '仕込み規模', '仕込み総量', '5日までの積算品温', '最高ボーメ', 'AB開始ボーメ',
    '最終ボーメ', 'AB開始アルコール', '最終アルコール度数', '最高BMD', '最高BMD日数',
    '追い水総量', '追い水歩合', '後半追い水量', '後半追い水割合',
    '日数', '温度1回目', '1日の品温の変動', 'ボーメ(BMD/日数)', 'ボーメ(推定)',
    'ボーメ(追い水後)', '1日のボーメ変動', '1日のボーメ変動(追い水反動)',
    'アルコール', 'アルコール(推定)', 'アルコール(追い水後)', '1日のアルコール変動',
    '1日のアルコール変動(追い水反動)', 'アルコール度数', 'アルコール度数(追い水反動)',
    '酸度', 'アミノ酸', 'BMD'
  ];

  return tanks.map(tank => ({
    ...tank,
    metadata: Object.fromEntries(
      Object.entries(tank.metadata).map(([key, value]) => {
        if (numericFields.includes(key)) {
          return [key, value === null || value === '' ? null : parseFloat(value)];
        }
        return [key, value];
      })
    ),
    dailyData: tank.dailyData.map(daily => {
      const transformed = Object.fromEntries(
        Object.entries(daily).map(([key, value]) => {
          if (numericFields.includes(key)) {
            return [key, value === null || value === '' ? null : parseFloat(value)];
          }
          if (key === '日数') {
            return [key, value ? parse(value, 'yyyy/M/d', new Date()) : value];
          }
          return [key, value];
        })
      );
      return transformed;
    })
  }));
};