import React, { useState } from 'react';
import { parseCSV } from '../utils/csvParser';
import { Upload } from 'lucide-react';

const FileUpload = ({ onDataParsed }) => {
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleFileChange = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setIsLoading(true);
    setError(null);

    parseCSV(
      file,
      (data) => {
        setIsLoading(false);
        onDataParsed(data);
      },
      (err) => {
        setIsLoading(false);
        setError('ファイルの解析または読み込みに失敗しました: ' + err.message);
      }
    );
  };

  return (
    <div className="p-4 bg-gray-100 rounded-lg shadow-md">
      <label className="flex items-center justify-center w-full p-4 transition duration-200 border-2 border-dashed border-gray-400 hover:border-blue-500 cursor-pointer">
        <input
          type="file"
          accept=".csv"
          onChange={handleFileChange}
          className="hidden"
        />
        <div className="flex items-center space-x-2">
          <Upload className="w-6 h-6 text-gray-600" />
          <span className="text-gray-600">
            {isLoading ? '読み込み中...' : 'CSVファイルをアップロード'}
          </span>
        </div>
      </label>
      {error && (
        <p className="mt-2 text-red-600">{error}</p>
      )}
    </div>
  );
};

export default FileUpload;