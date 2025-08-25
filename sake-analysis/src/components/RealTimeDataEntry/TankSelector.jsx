import React, { useState, useMemo } from 'react';
import { FlaskConical, Calendar, Droplets, TrendingUp } from 'lucide-react';
import { COLUMN_NAMES } from '../../utils/csvParser';

const TankSelector = ({ tanks, onSelectTank }) => {
  const [showCompleted, setShowCompleted] = useState(false);
  const [showPreparing, setShowPreparing] = useState(false);

  // 現在の醪日数を計算
  const calculateCurrentMoromiDays = (tank) => {
    if (!tank.metadata?.['仕込み日']) return null;
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const startDate = new Date(tank.metadata['仕込み日']);
    startDate.setHours(0, 0, 0, 0);
    
    if (today < startDate) return 0;
    
    // 上槽済みの場合は上槽日までの日数
    if (tank.metadata?.['上槽日']) {
      const endDate = new Date(tank.metadata['上槽日']);
      endDate.setHours(0, 0, 0, 0);
      if (today > endDate) {
        const diffTime = endDate - startDate;
        return Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1;
      }
    }
    
    const diffTime = today - startDate;
    return Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1;
  };

  // 最新の測定値を取得
  const getLatestMeasurements = (tank) => {
    if (!tank.dailyData || Object.keys(tank.dailyData).length === 0) {
      return { baume: null, alcohol: null, date: null };
    }

    // 日数でソートして最新を取得
    const sortedDays = Object.keys(tank.dailyData)
      .sort((a, b) => {
        const dayA = parseInt(tank.dailyData[a][COLUMN_NAMES.DAILY.DAY]);
        const dayB = parseInt(tank.dailyData[b][COLUMN_NAMES.DAILY.DAY]);
        return dayB - dayA;
      });

    const latestDay = sortedDays[0];
    const latestData = tank.dailyData[latestDay];

    return {
      baume: latestData[COLUMN_NAMES.DAILY.BAUME] || null,
      alcohol: latestData[COLUMN_NAMES.DAILY.ALCOHOL] || null,
      date: latestData[COLUMN_NAMES.DAILY.DATE] || null
    };
  };

  // フィルタリング - デフォルトは仕込中のみ
  const filteredTanks = useMemo(() => {
    return tanks.filter(tank => {
      const status = tank.metadata?.status || '準備中';
      
      // デフォルトは仕込中のみ表示
      if (status === '仕込中') return true;
      
      // オプションで他のステータスも表示
      if (status === '上槽済み' && showCompleted) return true;
      if (status === '準備中' && showPreparing) return true;
      
      return false;
    });
  }, [tanks, showCompleted, showPreparing]);

  // 表示するタンク（制限なし）
  const displayTanks = filteredTanks;

  const statusColors = {
    '準備中': 'border-gray-300 bg-gray-50',
    '仕込中': 'border-blue-300 bg-blue-50',
    '上槽済み': 'border-green-300 bg-green-50'
  };

  const statusBadgeColors = {
    '準備中': 'bg-gray-100 text-gray-800',
    '仕込中': 'bg-blue-100 text-blue-800',
    '上槽済み': 'bg-green-100 text-green-800'
  };

  return (
    <div>
      {/* フィルターオプション */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <label className="flex items-center space-x-2 text-sm">
            <input
              type="checkbox"
              checked={showPreparing}
              onChange={(e) => setShowPreparing(e.target.checked)}
              className="rounded border-gray-300"
            />
            <span>準備中も表示</span>
          </label>
          <label className="flex items-center space-x-2 text-sm">
            <input
              type="checkbox"
              checked={showCompleted}
              onChange={(e) => setShowCompleted(e.target.checked)}
              className="rounded border-gray-300"
            />
            <span>上槽済みも表示</span>
          </label>
        </div>
        <span className="text-sm text-gray-600">
          表示中: {displayTanks.length}本
        </span>
      </div>

      {/* タンクカードグリッド */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {displayTanks.map(tank => {
          const moromiDays = calculateCurrentMoromiDays(tank);
          const latest = getLatestMeasurements(tank);
          const status = tank.metadata?.status || '準備中';

          return (
            <div
              key={tank.tankId}
              onClick={() => onSelectTank(tank.tankId)}
              className={`p-4 border-2 rounded-lg cursor-pointer transition-all hover:shadow-lg ${
                statusColors[status]
              }`}
            >
              {/* ヘッダー */}
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-lg font-bold">
                  タンク {tank.metadata?.[COLUMN_NAMES.META.TANK_NUMBER] || '-'}
                </h3>
                <FlaskConical className="w-5 h-5 text-gray-600" />
              </div>

              {/* ステータスバッジ */}
              <div className="mb-2">
                <span className={`px-2 py-1 text-xs rounded-full font-medium ${
                  statusBadgeColors[status]
                }`}>
                  {status}
                </span>
              </div>

              {/* 基本情報 */}
              <div className="space-y-1 text-sm">
                <div className="flex items-center space-x-1">
                  <Droplets className="w-3 h-3 text-gray-500" />
                  <span className="text-gray-600">酵母:</span>
                  <span className="font-medium">{tank.metadata?.[COLUMN_NAMES.META.YEAST] || '-'}</span>
                </div>
                
                <div className="flex items-center space-x-1">
                  <TrendingUp className="w-3 h-3 text-gray-500" />
                  <span className="text-gray-600">規模:</span>
                  <span className="font-medium">{tank.metadata?.[COLUMN_NAMES.META.BATCH_SIZE] || '-'}</span>
                </div>

                <div className="flex items-center space-x-1">
                  <Calendar className="w-3 h-3 text-gray-500" />
                  <span className="text-gray-600">醪日数:</span>
                  <span className="font-medium">
                    {moromiDays !== null ? `${moromiDays}日目` : '-'}
                  </span>
                </div>
              </div>

              {/* 最新測定値 */}
              {(latest.baume !== null || latest.alcohol !== null) && (
                <div className="mt-3 pt-3 border-t border-gray-200">
                  <div className="text-xs text-gray-600 mb-1">最新測定値</div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <span className="text-gray-600">ボーメ:</span>
                      <span className="ml-1 font-medium">{latest.baume || '-'}</span>
                    </div>
                    <div>
                      <span className="text-gray-600">アルコール:</span>
                      <span className="ml-1 font-medium">
                        {latest.alcohol ? `${latest.alcohol}%` : '-'}
                      </span>
                    </div>
                  </div>
                  {latest.date && (
                    <div className="text-xs text-gray-500 mt-1">
                      更新: {latest.date}
                    </div>
                  )}
                </div>
              )}

              {/* ホバー時の効果 */}
              <div className="mt-3 text-center opacity-0 hover:opacity-100 transition-opacity">
                <span className="text-sm text-blue-600 font-medium">
                  クリックして入力
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* データがない場合 */}
      {displayTanks.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          仕込中のタンクがありません
          {!showPreparing && !showCompleted && (
            <div className="text-sm mt-2">
              準備中や上槽済みのタンクを表示するには、上のチェックボックスを使用してください
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default TankSelector;