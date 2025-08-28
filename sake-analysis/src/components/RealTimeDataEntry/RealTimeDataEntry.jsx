import React, { useState, useEffect } from 'react';
import { Database, Plus, List, FlaskConical, ArrowLeft } from 'lucide-react';
import TankMetadataForm from './TankMetadataForm';
import TankListTable from './TankListTable';
import TankSelector from './TankSelector';
import DailyDataTable from './DailyDataTable';
import IntegratedAnalysis from './IntegratedAnalysis';

const RealTimeDataEntry = ({ tanks, setTanks, selectedTankIds, setSelectedTankIds }) => {
  // ビューの管理
  const [currentView, setCurrentView] = useState('list'); // 'list' | 'form' | 'selector' | 'daily'
  const [selectedTankForEdit, setSelectedTankForEdit] = useState(null);
  const [editingTankId, setEditingTankId] = useState(null);

  // タンクデータの更新
  const handleSaveTank = (tankData) => {
    if (editingTankId) {
      // 既存タンクの更新
      const updatedTanks = tanks.map(tank =>
        tank.tankId === editingTankId
          ? { ...tank, metadata: { ...tank.metadata, ...tankData } }
          : tank
      );
      setTanks(updatedTanks);
      localStorage.setItem('tanks', JSON.stringify(updatedTanks));
    } else {
      // 新規タンクの追加
      const newTank = {
        tankId: `tank_${Date.now()}`,
        metadata: {
          ...tankData,
          status: '準備中',
          lastUpdated: new Date().toISOString(),
        },
        dailyData: {}
      };
      const updatedTanks = [...tanks, newTank];
      setTanks(updatedTanks);
      localStorage.setItem('tanks', JSON.stringify(updatedTanks));
    }
    
    setCurrentView('list');
    setEditingTankId(null);
  };

  // 日次データの更新
  const handleUpdateDailyData = (tankId, dailyData) => {
    const updatedTanks = tanks.map(tank =>
      tank.tankId === tankId
        ? {
            ...tank,
            dailyData: { ...tank.dailyData, ...dailyData },
            metadata: {
              ...tank.metadata,
              lastUpdated: new Date().toISOString()
            }
          }
        : tank
    );
    setTanks(updatedTanks);
    localStorage.setItem('tanks', JSON.stringify(updatedTanks));
  };

  // タンク選択してデータ入力へ
  const handleSelectTankForInput = (tankId) => {
    setSelectedTankForEdit(tanks.find(t => t.tankId === tankId));
    setCurrentView('daily');
  };

  // 編集モードへ
  const handleEditTank = (tankId) => {
    const tank = tanks.find(t => t.tankId === tankId);
    if (tank) {
      setEditingTankId(tankId);
      setCurrentView('form');
    }
  };

  // ステータス更新
  const handleStatusUpdate = (tankId, newStatus) => {
    const updatedTanks = tanks.map(tank =>
      tank.tankId === tankId
        ? {
            ...tank,
            metadata: {
              ...tank.metadata,
              status: newStatus,
              lastUpdated: new Date().toISOString()
            }
          }
        : tank
    );
    setTanks(updatedTanks);
    localStorage.setItem('tanks', JSON.stringify(updatedTanks));
  };

  // ビューごとのレンダリング
  const renderView = () => {
    switch (currentView) {
      case 'form':
        return (
          <div className="bg-white rounded-lg shadow-lg border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold flex items-center">
                <Plus className="mr-2" />
                {editingTankId ? '醪順号編集' : '醪順号作成'}
              </h2>
              <button
                onClick={() => {
                  setCurrentView('list');
                  setEditingTankId(null);
                }}
                className="text-gray-600 hover:text-gray-800"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
            </div>
            <TankMetadataForm
              initialData={editingTankId ? tanks.find(t => t.tankId === editingTankId)?.metadata : null}
              onSave={handleSaveTank}
              onCancel={() => {
                setCurrentView('list');
                setEditingTankId(null);
              }}
            />
          </div>
        );

      case 'selector':
        return (
          <div className="bg-white rounded-lg shadow-lg border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold flex items-center">
                <FlaskConical className="mr-2" />
                タンク選択
              </h2>
              <button
                onClick={() => setCurrentView('list')}
                className="text-gray-600 hover:text-gray-800"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
            </div>
            <TankSelector
              tanks={tanks.filter(t => t.metadata?.status !== '上槽済み')}
              onSelectTank={handleSelectTankForInput}
            />
          </div>
        );

      case 'daily':
        return selectedTankForEdit ? (
          <div className="space-y-4">
            <div className="bg-white rounded-lg shadow-lg border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold flex items-center">
                  <Database className="mr-2" />
                  日次データ入力 - タンク {selectedTankForEdit.metadata['順号']}
                </h2>
                <button
                  onClick={() => {
                    setCurrentView('selector');
                    setSelectedTankForEdit(null);
                  }}
                  className="text-gray-600 hover:text-gray-800"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
              </div>
              <DailyDataTable
                tank={selectedTankForEdit}
                onUpdate={(dailyData) => handleUpdateDailyData(selectedTankForEdit.tankId, dailyData)}
              />
            </div>
            
            {/* リアルタイム統合分析 */}
            <IntegratedAnalysis
              tank={selectedTankForEdit}
            />
          </div>
        ) : null;

      case 'list':
      default:
        return (
          <div className="bg-white rounded-lg shadow-lg border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold flex items-center">
                <List className="mr-2" />
                タンク一覧
              </h2>
              <div className="space-x-2">
                <button
                  onClick={() => setCurrentView('form')}
                  className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 flex items-center"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  新規作成
                </button>
                <button
                  onClick={() => setCurrentView('selector')}
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 flex items-center"
                >
                  <FlaskConical className="w-4 h-4 mr-2" />
                  データ入力
                </button>
              </div>
            </div>
            <TankListTable
              tanks={tanks}
              onEdit={handleEditTank}
              onSelectForInput={handleSelectTankForInput}
              onStatusUpdate={handleStatusUpdate}
              selectedTankIds={selectedTankIds}
              onSelectionChange={setSelectedTankIds}
            />
          </div>
        );
    }
  };

  return (
    <div className="max-w-7xl mx-auto">
      {renderView()}
    </div>
  );
};

export default RealTimeDataEntry;