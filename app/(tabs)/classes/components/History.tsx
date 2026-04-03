import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';

type HistoryProps = {
  onOpenHistory: () => void;
};

export function History({ onOpenHistory }: HistoryProps) {
  return (
    <View className="mx-4 bg-white border border-gray-200 rounded-2xl p-4">
      <Text className="text-base font-bold text-gray-900 mb-2">Presence History</Text>
      <Text className="text-sm text-gray-600 mb-3">
        View class precence statistics, present/late/rejected status, face similarity, and rejection reasons.
      </Text>

      <TouchableOpacity
        onPress={onOpenHistory}
        className="bg-indigo-600 rounded-xl py-3 items-center"
      >
        <Text className="text-white font-bold">Open Detailed Presence History</Text>
      </TouchableOpacity>
    </View>
  );
}
