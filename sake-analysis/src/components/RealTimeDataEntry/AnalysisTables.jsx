import React, { useState } from 'react';

const AnalysisTables = ({ tank, allTanks }) => {
  // 日次データが存在するかチェック（修正版）
  const hasDailyData = tank?.dailyData && Object.keys(tank.dailyData).some(key => 
    key.startsWith('day') && 
    tank.dailyData[key] && 
    Object.values(tank.dailyData[key]).some(val => val && val.toString().trim() !== '')
  );
  
  // 現在の日数を取得
  const getCurrentDay = () => {
    if (!tank?.dailyData) return 0;
    
    const days = Object.entries(tank.dailyData)
      .filter(([key, data]) => key.startsWith('day') && data && data['日数'])
      .map(([key, data]) => parseInt(data['日数']))
      .filter(d => !isNaN(d));
    
    return days.length > 0 ? Math.max(...days) : 0;
  };

  const currentDay = getCurrentDay();

  return (
    <div className="space-y-4">
      {/* データ状況の表示（デバッグ用） */}
      {process.env.NODE_ENV === 'development' && (
        <div className="bg-blue-50 border border-blue-200 rounded p-3 text-xs">
          <div>Tank ID: {tank?.tankId}</div>
          <div>Daily Data Keys: {tank?.dailyData ? Object.keys(tank.dailyData).join(', ') : 'none'}</div>
          <div>Has Daily Data: {hasDailyData.toString()}</div>
          <div>Current Day: {currentDay}</div>
        </div>
      )}
    </div>
  );
};

export default AnalysisTables;