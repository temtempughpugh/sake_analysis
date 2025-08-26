// WaterAnalysis.jsx - 追い水提案計算
import React, { useMemo } from 'react';

const WaterAnalysis = ({ currentTankData, selectedModel }) => {
  // 追い水提案計算
  const calculateWaterSuggestions = () => {
    if (!currentTankData || !selectedModel) return [];

    const suggestions = [];
    const totalVolume = parseFloat(currentTankData.metadata?.['仕込み総量']) || 1000;

    // 5日目・7日目の回帰式による計算
    if (selectedModel.oisuiData?.analysis1) {
      const { day5Regression, day7Regression } = selectedModel.oisuiData.analysis1;
      
      [5, 7].forEach(day => {
        const regression = day === 5 ? day5Regression : day7Regression;
        if (!regression) return;

        const dayData = currentTankData.dailyData.find(d => d.day === day);
        if (!dayData) return;

        const baume = dayData['ボーメ(BMD/日数)'];
        if (isNaN(baume)) return;

        const theoreticalChange = regression.a * baume + regression.b;
        const dilutionRatio = baume / (baume - theoreticalChange);
        const waterAmount = totalVolume * (dilutionRatio - 1);

        suggestions.push({
          day,
          amount: Math.round(waterAmount),
          reason: `ボーメ${baume.toFixed(1)}→変動${theoreticalChange.toFixed(2)}（回帰式）`,
          type: 'regression'
        });
      });
    }

    // 8日目以降のパラメータ計算
    if (selectedModel.oisuiData?.analysis2?.parameters && currentTankData.currentDay >= 8) {
      const params = selectedModel.oisuiData.analysis2.parameters;
      const currentBaume = currentTankData.latestData?.['ボーメ(補完)'];
      const currentAlcohol = currentTankData.latestData?.['アルコール(補完)'];

      if (!isNaN(currentBaume) && !isNaN(currentAlcohol)) {
        const remainingBaume = currentBaume - params.targetBaume;
        const predictedAlcoholIncrease = remainingBaume * params.alcoholCoeff;
        const predictedFinalAlcohol = currentAlcohol + predictedAlcoholIncrease;

        if (predictedFinalAlcohol > params.targetAlcohol) {
          const dilutionRatio = params.targetAlcohol / predictedFinalAlcohol;
          const requiredFinalVolume = totalVolume / dilutionRatio;
          const requiredWater = requiredFinalVolume - totalVolume;

          suggestions.push({
            day: currentTankData.currentDay,
            amount: Math.round(requiredWater),
            reason: `予測${predictedFinalAlcohol.toFixed(1)}%→目標${params.targetAlcohol}%（希釈）`,
            type: 'parameter'
          });
        }
      }
    }

    return suggestions;
  };

  const waterSuggestions = useMemo(() => calculateWaterSuggestions(), [currentTankData, selectedModel]);

  return (
    <div className="mb-6">
      <h3 className="text-lg font-semibold mb-4">追い水提案</h3>
      {waterSuggestions.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="min-w-full border border-gray-300">
            <thead className="bg-gray-50">
              <tr>
                <th className="border px-3 py-2 text-left">日</th>
                <th className="border px-3 py-2 text-left">推奨量</th>
                <th className="border px-3 py-2 text-left">根拠</th>
              </tr>
            </thead>
            <tbody>
              {waterSuggestions.map((suggestion, index) => (
                <tr key={index}>
                  <td className="border px-3 py-2">{suggestion.day}</td>
                  <td className="border px-3 py-2">{suggestion.amount}L</td>
                  <td className="border px-3 py-2 text-sm">{suggestion.reason}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="bg-gray-50 p-4 rounded-lg">
          <p className="text-sm text-gray-600">
            現在の発酵状況では追い水の提案はありません。
          </p>
          <div className="text-xs text-gray-500 mt-2">
            ・5日目・7日目：回帰式による計算
            <br />
            ・8日目以降：パラメータによる希釈計算
          </div>
        </div>
      )}
    </div>
  );
};

export default WaterAnalysis;