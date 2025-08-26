import React, { useState } from 'react';
import { ChevronDown, ChevronUp, TrendingUp, Droplets, GitCompare, BarChart3 } from 'lucide-react';
import IntegratedAnalysis from './IntegratedAnalysis';

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
          <div className="border-t border-gray-200">
            <IntegratedAnalysis currentTank={tank} allTanks={allTanks} />
          </div>
        )}
      </div>

      {!hasDailyData && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-yellow-800">
          <p className="text-sm">
            一部の分析機能は日次データが入力されると利用可能になります。
            統合分析は保存済みの統合モデルがあれば利用できます。
          </p>
        </div>
      )}

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
              {currentDay > 0 ? `（${currentDay}日目）` : ''}
            </span>
          </div>
          {expandedSections.progress ? 
            <ChevronUp className="w-5 h-5 text-gray-400" /> : 
            <ChevronDown className="w-5 h-5 text-gray-400" />
          }
        </button>
        
        {expandedSections.progress && (
          <div className="p-4 border-t border-gray-200">
            {hasDailyData ? (
              <div className="text-center text-gray-500 py-8">
                <p>進捗予測機能は開発中です</p>
              </div>
            ) : (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <p className="text-sm text-yellow-800">
                  進捗予測を行うには日次データの入力が必要です
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 追い水分析 */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <button
          onClick={() => toggleSection('water')}
          className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors"
        >
          <div className="flex items-center space-x-2">
            <Droplets className="w-5 h-5 text-cyan-600" />
            <h3 className="text-lg font-semibold">追い水分析</h3>
            <span className="text-sm text-gray-500">
              （最適化提案）
            </span>
          </div>
          {expandedSections.water ? 
            <ChevronUp className="w-5 h-5 text-gray-400" /> : 
            <ChevronDown className="w-5 h-5 text-gray-400" />
          }
        </button>
        
        {expandedSections.water && (
          <div className="p-4 border-t border-gray-200">
            {hasDailyData ? (
              <div className="text-center text-gray-500 py-8">
                <p>追い水分析機能は開発中です</p>
              </div>
            ) : (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <p className="text-sm text-yellow-800">
                  追い水分析を行うには日次データの入力が必要です
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 比較分析 */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <button
          onClick={() => toggleSection('comparison')}
          className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors"
        >
          <div className="flex items-center space-x-2">
            <GitCompare className="w-5 h-5 text-purple-600" />
            <h3 className="text-lg font-semibold">他タンクとの比較</h3>
            <span className="text-sm text-gray-500">
              （同期タンク比較）
            </span>
          </div>
          {expandedSections.comparison ? 
            <ChevronUp className="w-5 h-5 text-gray-400" /> : 
            <ChevronDown className="w-5 h-5 text-gray-400" />
          }
        </button>
        
        {expandedSections.comparison && (
          <div className="p-4 border-t border-gray-200">
            {hasDailyData ? (
              <div className="text-center text-gray-500 py-8">
                <p>比較分析機能は開発中です</p>
              </div>
            ) : (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <p className="text-sm text-yellow-800">
                  比較分析を行うには日次データの入力が必要です
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default AnalysisTables;