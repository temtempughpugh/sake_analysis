import React, { useState, useEffect } from 'react';
import { Save, X } from 'lucide-react';
import { COLUMN_NAMES } from '../../utils/csvParser';

const TankMetadataForm = ({ initialData, onSave, onCancel }) => {
  const [formData, setFormData] = useState({
    [COLUMN_NAMES.META.TANK_NUMBER]: '',
    [COLUMN_NAMES.META.BATCH_SIZE]: '',
    [COLUMN_NAMES.META.YEAST]: '',
    [COLUMN_NAMES.META.DESIGN]: '',
    [COLUMN_NAMES.META.SPECIFIC_NAME]: '',
    [COLUMN_NAMES.META.TOTAL_VOLUME]: '',
    '汲み水歩合': '',
    '仕込み日': '',
    '上槽日': '',
    '目標ボーメ': '',      // 追加
    '目標アルコール度数': '' // 追加
  });

  // 初期データがある場合は設定
  useEffect(() => {
    if (initialData) {
      setFormData({
        ...formData,
        ...initialData
      });
    }
  }, [initialData]);

  // 汲み水歩合が変更されたら仕込み総量を自動計算
  useEffect(() => {
    const batchSize = parseFloat(formData[COLUMN_NAMES.META.BATCH_SIZE]);
    const waterRatio = parseFloat(formData['汲み水歩合']);
    
    if (!isNaN(batchSize) && !isNaN(waterRatio)) {
      const totalVolume = batchSize * waterRatio;
      setFormData(prev => ({
        ...prev,
        [COLUMN_NAMES.META.TOTAL_VOLUME]: totalVolume.toFixed(0)
      }));
    }
  }, [formData[COLUMN_NAMES.META.BATCH_SIZE], formData['汲み水歩合']]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    // 必須項目のチェック
    if (!formData[COLUMN_NAMES.META.TANK_NUMBER] || 
        !formData[COLUMN_NAMES.META.BATCH_SIZE] || 
        !formData[COLUMN_NAMES.META.YEAST] ||
        !formData['汲み水歩合'] ||
        !formData['仕込み日']) {
      alert('必須項目を入力してください');
      return;
    }
    
    onSave(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        {/* 順号 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            順号 <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            name={COLUMN_NAMES.META.TANK_NUMBER}
            value={formData[COLUMN_NAMES.META.TANK_NUMBER]}
            onChange={handleChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="例: 104"
          />
        </div>

        {/* 仕込み規模 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            仕込み規模 <span className="text-red-500">*</span>
          </label>
          <input
            type="number"
            name={COLUMN_NAMES.META.BATCH_SIZE}
            value={formData[COLUMN_NAMES.META.BATCH_SIZE]}
            onChange={handleChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="例: 1800"
          />
        </div>

        {/* 酵母 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            酵母 <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            name={COLUMN_NAMES.META.YEAST}
            value={formData[COLUMN_NAMES.META.YEAST]}
            onChange={handleChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="例: K1801"
          />
        </div>

        {/* 酒質設計 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            酒質設計
          </label>
          <input
            type="text"
            name={COLUMN_NAMES.META.DESIGN}
            value={formData[COLUMN_NAMES.META.DESIGN]}
            onChange={handleChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="例: 大吟醸"
          />
        </div>

        {/* 特定名称 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            特定名称
          </label>
          <input
            type="text"
            name={COLUMN_NAMES.META.SPECIFIC_NAME}
            value={formData[COLUMN_NAMES.META.SPECIFIC_NAME]}
            onChange={handleChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="例: 純米大吟醸"
          />
        </div>

        {/* 汲み水歩合 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            汲み水歩合 <span className="text-red-500">*</span>
          </label>
          <input
            type="number"
            step="0.01"
            name="汲み水歩合"
            value={formData['汲み水歩合']}
            onChange={handleChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="例: 1.30"
          />
        </div>

        {/* 仕込み総量（自動計算） */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            仕込み総量（自動計算）
          </label>
          <input
            type="text"
            name={COLUMN_NAMES.META.TOTAL_VOLUME}
            value={formData[COLUMN_NAMES.META.TOTAL_VOLUME]}
            readOnly
            className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-100"
          />
        </div>

        {/* 仕込み日 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            仕込み日 <span className="text-red-500">*</span>
          </label>
          <input
            type="date"
            name="仕込み日"
            value={formData['仕込み日']}
            onChange={handleChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* 上槽日 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            上槽日（任意）
          </label>
          <input
            type="date"
            name="上槽日"
            value={formData['上槽日']}
            onChange={handleChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
{/* 第3行 - 目標値 */}
<div className="grid grid-cols-2 gap-4">
  {/* 目標ボーメ */}
  <div>
    <label className="block text-sm font-medium text-gray-700 mb-1">
      目標ボーメ
    </label>
    <input
      type="number"
      step="0.01"
      name="目標ボーメ"
      value={formData['目標ボーメ']}
      onChange={handleChange}
      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
      placeholder="例: -1.21"
    />
  </div>

  {/* 目標アルコール度数 */}
  <div>
    <label className="block text-sm font-medium text-gray-700 mb-1">
      目標アルコール度数 (%)
    </label>
    <input
      type="number"
      step="0.01"
      name="目標アルコール度数"
      value={formData['目標アルコール度数']}
      onChange={handleChange}
      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
      placeholder="例: 18.65"
    />
  </div>
</div>

      </div>

      {/* 日次データから算出される項目（読み取り専用） */}
      {initialData && (
        <div className="mt-6 pt-4 border-t border-gray-200">
          <h3 className="text-sm font-medium text-gray-700 mb-2">日次データから算出される項目</h3>
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <span className="text-gray-600">5日までの積算品温:</span>
              <span className="ml-2 font-medium">{initialData[COLUMN_NAMES.META.TEMP_SUM_5DAYS] || '-'}</span>
            </div>
            <div>
              <span className="text-gray-600">最高ボーメ:</span>
              <span className="ml-2 font-medium">{initialData[COLUMN_NAMES.META.MAX_BAUME] || '-'}</span>
            </div>
            <div>
              <span className="text-gray-600">最高BMD:</span>
              <span className="ml-2 font-medium">{initialData[COLUMN_NAMES.META.MAX_BMD] || '-'}</span>
            </div>
            <div>
              <span className="text-gray-600">AB開始ボーメ:</span>
              <span className="ml-2 font-medium">{initialData[COLUMN_NAMES.META.AB_START_BAUME] || '-'}</span>
            </div>
            <div>
              <span className="text-gray-600">AB開始アルコール:</span>
              <span className="ml-2 font-medium">{initialData[COLUMN_NAMES.META.AB_START_ALCOHOL] || '-'}</span>
            </div>
            <div>
              <span className="text-gray-600">最終ボーメ:</span>
              <span className="ml-2 font-medium">{initialData[COLUMN_NAMES.META.FINAL_BAUME] || '-'}</span>
            </div>
            <div>
              <span className="text-gray-600">最終アルコール度数:</span>
              <span className="ml-2 font-medium">{initialData[COLUMN_NAMES.META.FINAL_ALCOHOL] || '-'}</span>
            </div>
            <div>
              <span className="text-gray-600">追い水総量:</span>
              <span className="ml-2 font-medium">{initialData[COLUMN_NAMES.META.TOTAL_WATER] || '-'}</span>
            </div>
          </div>
        </div>
      )}

      {/* ボタン */}
      <div className="flex justify-end space-x-2 pt-4">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 flex items-center"
        >
          <X className="w-4 h-4 mr-2" />
          キャンセル
        </button>
        <button
          type="submit"
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center"
        >
          <Save className="w-4 h-4 mr-2" />
          保存
        </button>
      </div>
    </form>
  );
};

export default TankMetadataForm;