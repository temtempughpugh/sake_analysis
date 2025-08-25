import React, { useState, useMemo } from 'react';
import { Edit2, FlaskConical, Check, Filter, ArrowUpDown } from 'lucide-react';
import { COLUMN_NAMES } from '../../utils/csvParser';

const TankListTable = ({ tanks, onEdit, onSelectForInput, onStatusUpdate, selectedTankIds, onSelectionChange }) => {
  const [filterStatus, setFilterStatus] = useState('all'); // all | 準備中 | 仕込中 | 上槽済み
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });

  // ステータスオプション
  const statusOptions = ['準備中', '仕込中', '上槽済み'];
  const statusColors = {
    '準備中': 'bg-gray-100 text-gray-800',
    '仕込中': 'bg-blue-100 text-blue-800',
    '上槽済み': 'bg-green-100 text-green-800'
  };

  // ステータスを自動判定
  const getAutoStatus = (tank) => {
    if (!tank.metadata?.['仕込み日']) return '準備中';
    
    const today = new Date();
    today.setHours(0, 0, 0, 0); // 時刻をリセット
    const startDate = new Date(tank.metadata['仕込み日']);
    startDate.setHours(0, 0, 0, 0);
    
    // 仕込み日前なら準備中
    if (today < startDate) return '準備中';
    
    // 上槽日が設定されている場合
    if (tank.metadata?.['上槽日']) {
      const endDate = new Date(tank.metadata['上槽日']);
      endDate.setHours(0, 0, 0, 0);
      
      // 上槽日を過ぎていれば上槽済み
      if (today > endDate) return '上槽済み';
      // 仕込み日〜上槽日の間なら仕込中
      return '仕込中';
    }
    
    // 上槽日が未設定なら仕込中
    return '仕込中';
  };

  // 現在の醪日数を計算（仕込み日から今日まで）
  const calculateCurrentMoromiDays = (tank) => {
    if (!tank.metadata?.['仕込み日']) return null;
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const startDate = new Date(tank.metadata['仕込み日']);
    startDate.setHours(0, 0, 0, 0);
    
    // 仕込み日前なら0
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
    
    // 仕込中の場合は今日までの日数
    const diffTime = today - startDate;
    return Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1; // 仕込み日を1日目とする
  };

  // 総醪日数を計算（仕込み日から上槽日まで）
  const calculateTotalMoromiDays = (tank) => {
    if (!tank.metadata?.['仕込み日'] || !tank.metadata?.['上槽日']) return null;
    
    const startDate = new Date(tank.metadata['仕込み日']);
    const endDate = new Date(tank.metadata['上槽日']);
    const diffTime = endDate - startDate;
    return Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1;
  };

  // 進捗状況を計算（現在の日数/予定日数）
  const calculateProgress = (tank) => {
    const currentDays = calculateCurrentMoromiDays(tank);
    if (currentDays === null) return '-';
    
    // 上槽日が設定されていれば総日数を使用
    const totalDays = calculateTotalMoromiDays(tank);
    if (totalDays) {
      const percentage = Math.round((currentDays / totalDays) * 100);
      return `${currentDays}日/${totalDays}日 (${percentage}%)`;
    }
    
    // 上槽日が未設定なら進行中として表示
    return `${currentDays}日目（進行中）`;
  };

  // フィルタリングとソート
  const filteredAndSortedTanks = useMemo(() => {
    let filtered = tanks;
    
    // ステータスフィルタ
    if (filterStatus !== 'all') {
      filtered = filtered.filter(tank => tank.metadata?.status === filterStatus);
    }
    
    // ソート
    if (sortConfig.key) {
      filtered = [...filtered].sort((a, b) => {
        let aValue = a.metadata?.[sortConfig.key];
        let bValue = b.metadata?.[sortConfig.key];
        
        // 特殊な場合の処理
        if (sortConfig.key === 'moromiDays') {
          aValue = calculateCurrentMoromiDays(a) || 0;
          bValue = calculateCurrentMoromiDays(b) || 0;
        } else if (sortConfig.key === 'lastUpdated') {
          aValue = new Date(aValue || 0);
          bValue = new Date(bValue || 0);
        }
        
        if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }
    
    return filtered;
  }, [tanks, filterStatus, sortConfig]);

  // ソート処理
  const handleSort = (key) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  // 全選択
  const handleSelectAll = () => {
    const allIds = filteredAndSortedTanks.map(tank => tank.tankId);
    const isAllSelected = allIds.length > 0 && allIds.every(id => selectedTankIds.includes(id));
    
    if (isAllSelected) {
      onSelectionChange(selectedTankIds.filter(id => !allIds.includes(id)));
    } else {
      onSelectionChange([...new Set([...selectedTankIds, ...allIds])]);
    }
  };

  // 個別選択
  const handleSelectTank = (tankId) => {
    if (selectedTankIds.includes(tankId)) {
      onSelectionChange(selectedTankIds.filter(id => id !== tankId));
    } else {
      onSelectionChange([...selectedTankIds, tankId]);
    }
  };

  return (
    <div>
      {/* フィルターバー */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Filter className="w-4 h-4 text-gray-500" />
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-3 py-1 border border-gray-300 rounded-md text-sm"
          >
            <option value="all">すべて</option>
            {statusOptions.map(status => (
              <option key={status} value={status}>{status}</option>
            ))}
          </select>
        </div>
        <div className="text-sm text-gray-600">
          表示中: {filteredAndSortedTanks.length} / 全体: {tanks.length}
        </div>
      </div>

      {/* テーブル */}
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-3 py-3 text-left">
                <input
                  type="checkbox"
                  checked={filteredAndSortedTanks.length > 0 && 
                    filteredAndSortedTanks.every(tank => selectedTankIds.includes(tank.tankId))}
                  onChange={handleSelectAll}
                  className="rounded border-gray-300"
                />
              </th>
              <th 
                className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                onClick={() => handleSort(COLUMN_NAMES.META.TANK_NUMBER)}
              >
                <div className="flex items-center">
                  順号
                  <ArrowUpDown className="w-3 h-3 ml-1" />
                </div>
              </th>
              <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                ステータス
              </th>
              <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                酵母
              </th>
              <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                仕込み規模
              </th>
              <th 
                className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                onClick={() => handleSort('moromiDays')}
              >
                <div className="flex items-center">
                  醪日数
                  <ArrowUpDown className="w-3 h-3 ml-1" />
                </div>
              </th>
              <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                進捗状況
              </th>
              <th 
                className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                onClick={() => handleSort('lastUpdated')}
              >
                <div className="flex items-center">
                  最終更新
                  <ArrowUpDown className="w-3 h-3 ml-1" />
                </div>
              </th>
              <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                操作
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filteredAndSortedTanks.length === 0 ? (
              <tr>
                <td colSpan="9" className="px-3 py-4 text-center text-gray-500">
                  データがありません
                </td>
              </tr>
            ) : (
              filteredAndSortedTanks.map(tank => {
                const autoStatus = getAutoStatus(tank);
                const currentStatus = tank.metadata?.status || autoStatus;
                const moromiDays = calculateCurrentMoromiDays(tank);
                const progress = calculateProgress(tank);
                const lastUpdated = tank.metadata?.lastUpdated 
                  ? new Date(tank.metadata.lastUpdated).toLocaleDateString('ja-JP')
                  : '-';
                
                // ステータスが自動判定と異なる場合は警告表示
                const statusMismatch = tank.metadata?.status && tank.metadata.status !== autoStatus;
                
                return (
                  <tr key={tank.tankId} className="hover:bg-gray-50">
                    <td className="px-3 py-4">
                      <input
                        type="checkbox"
                        checked={selectedTankIds.includes(tank.tankId)}
                        onChange={() => handleSelectTank(tank.tankId)}
                        className="rounded border-gray-300"
                      />
                    </td>
                    <td className="px-3 py-4 text-sm font-medium text-gray-900">
                      {tank.metadata?.[COLUMN_NAMES.META.TANK_NUMBER] || '-'}
                    </td>
                    <td className="px-3 py-4">
                      <div className="flex items-center space-x-1">
                        <select
                          value={currentStatus}
                          onChange={(e) => onStatusUpdate(tank.tankId, e.target.value)}
                          className={`px-2 py-1 text-xs rounded-full font-medium ${
                            statusColors[currentStatus]
                          }`}
                        >
                          {statusOptions.map(status => (
                            <option key={status} value={status}>{status}</option>
                          ))}
                        </select>
                        {statusMismatch && (
                          <span 
                            className="text-xs text-orange-600 cursor-help" 
                            title={`日付から判定すると「${autoStatus}」になります`}
                          >
                            ⚠️
                          </span>
                        )}
                        {statusMismatch && (
                          <button
                            onClick={() => onStatusUpdate(tank.tankId, autoStatus)}
                            className="text-xs text-blue-600 hover:text-blue-800 underline"
                          >
                            自動更新
                          </button>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-4 text-sm text-gray-500">
                      {tank.metadata?.[COLUMN_NAMES.META.YEAST] || '-'}
                    </td>
                    <td className="px-3 py-4 text-sm text-gray-500">
                      {tank.metadata?.[COLUMN_NAMES.META.BATCH_SIZE] || '-'}
                    </td>
                    <td className="px-3 py-4 text-sm text-gray-500">
                      {moromiDays !== null ? `${moromiDays}日` : '-'}
                    </td>
                    <td className="px-3 py-4 text-sm text-gray-500">
                      {progress}
                    </td>
                    <td className="px-3 py-4 text-sm text-gray-500">
                      {lastUpdated}
                    </td>
                    <td className="px-3 py-4 text-sm text-center">
                      <div className="flex justify-center space-x-2">
                        <button
                          onClick={() => onEdit(tank.tankId)}
                          className="text-blue-600 hover:text-blue-900"
                          title="編集"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => onSelectForInput(tank.tankId)}
                          className="text-green-600 hover:text-green-900"
                          title="データ入力"
                          disabled={currentStatus === '上槽済み'}
                        >
                          <FlaskConical className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default TankListTable;