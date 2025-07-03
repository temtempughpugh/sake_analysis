import React from 'react';

const TankSelector = ({ onFileUpload, tanks }) => {
  const handleFileChange = (event) => {
    const file = event.target.files[0];
    if (file) {
      onFileUpload(file);
    }
  };

  return (
    <div className="mb-4">
      <label className="block text-sm font-medium text-gray-700">CSVファイルを選択</label>
      <input
        type="file"
        accept=".csv"
        onChange={handleFileChange}
        className="mt-1 block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
      />
      {tanks && tanks.length > 0 && (
        <p className="mt-2 text-sm text-gray-600">読み込み済みタンク数: {tanks.length}</p>
      )}
    </div>
  );
};

export default TankSelector;