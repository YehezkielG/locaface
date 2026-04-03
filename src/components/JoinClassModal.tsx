import React from 'react';
import { Modal, View, Text, TextInput, TouchableOpacity } from 'react-native';

interface JoinClassModalProps {
  visible: boolean;
  code: string;
  isSubmitting: boolean;
  onChangeCode: (value: string) => void;
  onClose: () => void;
  onSubmit: () => void;
}

export default function JoinClassModal({
  visible,
  code,
  isSubmitting,
  onChangeCode,
  onClose,
  onSubmit,
}: JoinClassModalProps) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View className="flex-1 bg-black/40 justify-center px-6">
        <View className="bg-white rounded-2xl p-5">
          <Text className="text-lg font-bold text-gray-900 mb-1">Join Class</Text>
          <Text className="text-sm text-gray-600 mb-4">Enter the 6-digit class code.</Text>

          <TextInput
            value={code}
            onChangeText={onChangeCode}
            autoCapitalize="characters"
            autoCorrect={false}
            maxLength={6}
            keyboardType="default"
            placeholder="Example: A1B2C3"
            placeholderTextColor="#9CA3AF"
            className="border border-gray-300 rounded-xl px-4 py-3 text-center text-lg font-semibold tracking-[2px]"
          />

          <View className="flex-row gap-2 mt-4">
            <TouchableOpacity
              onPress={onClose}
              disabled={isSubmitting}
              className="flex-1 bg-gray-100 py-3 rounded-xl items-center"
            >
              <Text className="text-gray-700 font-semibold">Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={onSubmit}
              disabled={isSubmitting}
              className="flex-1 bg-indigo-600 py-3 rounded-xl items-center"
            >
              <Text className="text-white font-semibold">{isSubmitting ? 'Processing...' : 'Join'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}
