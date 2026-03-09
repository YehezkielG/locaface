import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Alert, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import FontAwesome from '@expo/vector-icons/FontAwesome5';
import { handleAvatarPress } from "../../src/lib/ImagePicker";

export default function OnboardingScreen() {
  const { userId, avatar, fullName } = useLocalSearchParams();
  const router = useRouter();

  const [username, setUsername] = useState(fullName || '');
  const [gender, setGender] = useState('');  
  const [avatarUri, setAvatarUri] = useState(Array.isArray(avatar) ? avatar[0] : avatar);

  const handleSubmit = () => {
    alert(`Username: ${username}\nGender: ${gender}`);
  }


  const handleBukaKamera = () => {
    if (!username || !gender) {
      Alert.alert('Tunggu Dulu!', 'Isi username dan pilih gender kamu ya.');
      return;
    }
    Alert.alert('Membuka Kamera...', `Siap-siap senyum ya, ${username}! 📸`);
  };

  return (
    <SafeAreaView className="flex-1 bg-white px-8 justify-center">
      
      {/* Bagian Header */}
      <View className="mb-10">
        <Text className="text-2xl font-extrabold text-gray-900 mb-3">
          Welcome, complete your profile 👋🏼
        </Text>
        <Text className="text-base text-gray-500 leading-relaxed">
          Complete your identity and record your face to start automatic attendance with Locaface.
        </Text>
      </View>

      <View className='flex-row justify-center'>
        <TouchableOpacity 
          activeOpacity={0.8} 
          className="h-36 w-36 rounded-full bg-gray-50 border-2 border-dashed border-gray-300 items-center justify-center overflow-hidden"
          onPress={() => handleAvatarPress(setAvatarUri)}
        >
        <View className='border-2 border-gray-200 w-36 h-36 rounded-full items-center justify-center'>
          <Image source={{ uri: avatarUri }} className="w-36 h-36 rounded-full" />
        </View></TouchableOpacity>
      </View>

      {/* Bagian Form */}
      <View className="">
        {/* Input Username */}
        <View>
          <Text className="text-sm font-bold text-gray-700 mb-2 ml-1">Username</Text>
          <TextInput
            className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-5 py-4 text-base text-gray-900"
            placeholder="Enter your username"
            value={username}
            onChangeText={setUsername}
          />
        </View>
        {/* Input Gender (Pakai tombol bergaya Chips agar UX lebih bagus dari Picker) */}
        <View>
          <Text className="text-sm font-bold text-gray-700 mt-2 mb-2 ml-1">Gender</Text>
          <View className="flex-row gap-4">
            <TouchableOpacity
              activeOpacity={0.7}
              className={`flex-1 py-4 rounded-2xl border-2 ${
          gender === 'male' ? 'bg-blue-50 border-blue-500' : 'bg-gray-50 border-gray-200'
              }`}
              onPress={() => setGender('male')}
            >
              <View className="flex-row items-center justify-center gap-2">
          <FontAwesome
            name="mars"
            size={20}
            color={gender === 'male' ? '#2563EB' : '#9CA3AF'}
          />
          <Text
            className={`font-bold ${
              gender === 'male' ? 'text-blue-600' : 'text-gray-400'
            }`}
          >
            Male
          </Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.7}
              className={`flex-1 py-4 rounded-2xl border-2 ${
          gender === 'female' ? 'bg-pink-50 border-pink-500' : 'bg-gray-50 border-gray-200'
              }`}
              onPress={() => setGender('female')}
            >
              <View className="flex-row items-center justify-center gap-2">
          <FontAwesome
            name="venus"
            size={20}
            color={gender === 'female' ? '#DB2777' : '#9CA3AF'}
          />
          <Text
            className={`font-bold ${
              gender === 'female' ? 'text-pink-600' : 'text-gray-400'
            }`}
          >
            Female
          </Text>
              </View>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Bagian Tombol Aksi (Kamera) */}
      <View className="mt-4">
        <TouchableOpacity
          className="w-full border-2 border-gray-200 py-4 rounded-2xl  "
          onPress={handleBukaKamera} >
          <View className="flex-row items-center justify-center gap-2">
          <FontAwesome
            name="camera"
            size={20}
          />
          <Text className={`font-bold text-gray-700`}> Record your face
          </Text>
              </View>
        </TouchableOpacity>
      </View>

      <View className='mt-5'>
        <TouchableOpacity onPress={handleSubmit} className="w-full bg-blue-500 py-4 rounded-2xl">
          <Text className="text-center text-white font-bold">Submit</Text>
        </TouchableOpacity>
      </View>
      <View>
        <Text className="text-center mt-1 text-sm text-gray-400">
          By continuing, you agree to our <Text className="text-blue-500">Terms of Service</Text> and <Text className="text-blue-500">Privacy Policy</Text>.
        </Text>
      </View>
    </SafeAreaView>
  );
}