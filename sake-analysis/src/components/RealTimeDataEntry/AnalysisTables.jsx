import React from 'react';

const AnalysisTables = ({ tank, allTanks }) => {
  return (
    <div className="p-4 border border-gray-300 rounded">
      <h3 className="text-lg font-semibold mb-4">分析表示（仮実装）</h3>
      <div className="space-y-2">
        <p>進捗予測表</p>
        <p>追い水分析表</p>
        <p>比較分析表</p>
      </div>
    </div>
  );
};

export default AnalysisTables;