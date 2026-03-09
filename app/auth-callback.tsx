import { View, Text } from 'react-native';

export default function AuthCallback() {
  return (
    <View className="flex-1 items-center justify-center bg-white">
      <Text className="text-2xl font-bold text-gray-800">Processing Authentication...</Text>
      <Text className="mt-2 text-gray-600">Please wait while we complete your login.</Text>
    </View>
  );
}

