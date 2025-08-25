import React, { useState } from 'react';
import { ChevronDown, ChevronUp, TrendingUp, Droplets, GitCompare, BarChart3 } from 'lucide-react';

const AnalysisTables = ({ tank, allTanks }) => {
  const [expandedSections, setExpandedSections] = useState({
    progress: false,
    water: false,
    comparison: false,
    integrated: false
  });

  const toggleSection = (section) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  // 日次データが存在するかチェック
  const hasDailyData = tank?.dailyData && Object.keys(tank.dailyData).length > 0;
  
  if (!hasDailyData) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-yellow-800">
        <p className="text-sm">日次データが入力されると分析機能が利用可能になります。</p>
      </div>
    );
  }

  // 現在の日数を取得
  const getCurrentDay = () => {
    const days = Object.values(tank.dailyData)
      .map(d => parseInt(d['日数']))
      .filter(d => !isNaN(d));
    return days.length > 0 ? Math.max(...days) : 0;
  };

  const currentDay = getCurrentDay();

  return (
    <div className="space-y-4">
      {/* 統合分析 */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <button
          onClick={() => toggleSection('integrated')}
          className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors"
        >
          <div className="flex items-center space-x-2">
            <BarChart3 className="w-5 h-5 text-indigo-600" />
            <h3 className="text-lg font-semibold">統合分析</h3>
            <span className="text-sm text-gray-500">
              （進捗・品温・追い水の総合分析）
            </span>
          </div>
          {expandedSections.integrated ? 
            <ChevronUp className="w-5 h-5 text-gray-400" /> : 
            <ChevronDown className="w-5 h-5 text-gray-400" />
          }
        </button>
        
        {expandedSections.integrated && (
          <div className="p-4 border-t border-gray-200">
            <div className="text-center text-gray-500 py-8">
              <p>統合分析機能は開発中です</p>
            </div>
          </div>
        )}
      </div>

      {/* 進捗予測表 */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <button
          onClick={() => toggleSection('progress')}
          className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors"
        >
          <div className="flex items-center space-x-2">
            <TrendingUp className="w-5 h-5 text-blue-600" />
            <h3 className="text-lg font-semibold">進捗予測分析</h3>
            <span className="text-sm text-gray-500">
              （{currentDay}日目）
            </span>
          </div>
          {expandedSections.progress ? 
            <ChevronUp className="w-5 h-5 text-gray-400" /> : 
            <ChevronDown className="w-5 h-5 text-gray-400" />
          }
        </button>
        
        {expandedSections.progress && (
          <div className="p-4 border-t border-gray-200">
            <div className="text-center text-gray-500 py-8">
              <p>進捗予測分析機能は開発中です</p>
            </div>
          </div>
        )}
      </div>

      {/* 追い水分析表 */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <button
          onClick={() => toggleSection('water')}
          className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors"
        >
          <div className="flex items-center space-x-2">
            <Droplets className="w-5 h-5 text-cyan-600" />
            <h3 className="text-lg font-semibold">追い水分析</h3>
            <span className="text-sm text-gray-500">
              {currentDay >= 5 ? (currentDay >= 8 ? '（8日目以降）' : '（5-7日目）') : '（5日目以降で利用可能）'}
            </span>
          </div>
          {expandedSections.water ? 
            <ChevronUp className="w-5 h-5 text-gray-400" /> : 
            <ChevronDown className="w-5 h-5 text-gray-400" />
          }
        </button>
        
        {expandedSections.water && (
          <div className="p-4 border-t border-gray-200">
            <div className="text-center text-gray-500 py-8">
              <p>追い水分析機能は開発中です</p>
            </div>
          </div>
        )}
      </div>

      {/* 比較分析表 */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <button
          onClick={() => toggleSection('comparison')}
          className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors"
        >
          <div className="flex items-center space-x-2">
            <GitCompare className="w-5 h-5 text-purple-600" />
            <h3 className="text-lg font-semibold">比較分析</h3>
            <span className="text-sm text-gray-500">
              （他タンク・過去データとの比較）
            </span>
          </div>
          {expandedSections.comparison ? 
            <ChevronUp className="w-5 h-5 text-gray-400" /> : 
            <ChevronDown className="w-5 h-5 text-gray-400" />
          }
        </button>
        
        {expandedSections.comparison && (
          <div className="p-4 border-t border-gray-200">
            <div className="text-center text-gray-500 py-8">
              <p>比較分析機能は開発中です</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AnalysisTables;