import { View, Text, TextInput, TouchableOpacity, Image, StyleSheet, Dimensions, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import FontAwesome from '@expo/vector-icons/FontAwesome5';
import { handleAvatarPress } from '../../src/lib/ImagePicker';
import * as FileSystem from 'expo-file-system/legacy';
import React, { useState, useRef } from 'react';
import { Camera, useCameraDevice, useFrameProcessor, useCameraFormat } from 'react-native-vision-camera';
import { useFaceDetector } from 'react-native-vision-camera-face-detector';
import { Worklets } from 'react-native-worklets-core';
import { supabase } from '@/src/lib/supabase';
import { isAxiosError } from 'axios';
import { signedPost } from '@/src/lib/securityServices';
import uploadAvatar from '../../src/lib/ImageUploader';
import { showPopup } from '@/src/lib/inAppPopup';

export default function OnboardingScreen() {
  const { avatar: avatarParam, fullName: fullNameParam } = useLocalSearchParams<{
    avatar?: string | string[];
    fullName?: string | string[];
  }>();

  const initialUsername = Array.isArray(fullNameParam) ? (fullNameParam[0] ?? '') : (fullNameParam ?? '');
  const initialAvatarUri = Array.isArray(avatarParam) ? (avatarParam[0] ?? '') : (avatarParam ?? '');

  const [username, setUsername] = useState(initialUsername);
  const [userTag, setUserTag] = useState('');
  const [gender, setGender] = useState('');
  const [avatarUri, setAvatarUri] = useState(initialAvatarUri);
  const [isCameraVisible, setIsCameraVisible] = useState(false);
  const [capturedFaceImages, setCapturedFaceImages] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    const normalizedUserTag = userTag.trim().replace(/^@+/, '').toLowerCase();

    if (!username || !gender) {
      showPopup({ title: 'Hold On!', message: 'Please fill in your username and select your gender before submitting.', type: 'warning' });
      return;
    }

    if (normalizedUserTag && !/^[a-z0-9._]{3,20}$/.test(normalizedUserTag)) {
      showPopup({
        title: 'Invalid User Tag',
        message: 'Use 3-20 characters with lowercase letters, numbers, dots, or underscores.',
        type: 'warning',
      });
      return;
    }

    if (capturedFaceImages.length < 3) {
      showPopup({ title: 'Almost There!', message: 'Please capture all 3 face images before submitting.', type: 'warning' });
      return;
    }
    
    const { data: { session }, } = await supabase.auth.getSession();
    const token = session?.access_token || '';
    
    try {
      if (!token) {
        showPopup({ title: 'Unauthorized', message: 'Please sign in again.', type: 'warning' });
        return;
      }
      if (!session) {
        showPopup({ title: 'Unauthorized', message: 'Session not found. Please sign in again.', type: 'warning' });
        return;
      }
      setIsSubmitting(true);

      let avatarUrlForDb = avatarUri;
      const isLocalAvatarPath = !!avatarUri && !/^https?:\/\//i.test(avatarUri);

      if (isLocalAvatarPath) {
        const uploadedAvatarUrl = await uploadAvatar(avatarUri, session.user.id);
        if (!uploadedAvatarUrl) {
          showPopup({ title: 'Error', message: 'Failed to upload profile photo!', type: 'error' });
          return;
        }
        avatarUrlForDb = uploadedAvatarUrl;
      }

      const response = await signedPost('/register', { 
        email: session?.user.email,
        avatar_url: avatarUrlForDb,
        username: username,
        user_tag: normalizedUserTag || null,
        gender: gender,
        capture_source: 'onboarding',
        image_front: capturedFaceImages[0],
        image_left: capturedFaceImages[1],
        image_right: capturedFaceImages[2],
      }, token);

      const { error: profileSyncError } = await supabase
          .from('profiles')
          .update({
            avatar_url: avatarUrlForDb || null,
            user_tag: normalizedUserTag || null,
          })
          .eq('id', session.user.id);

      if (profileSyncError) {
        console.warn('Failed to sync profile fields to profiles table:', profileSyncError.message);
      }

      if(response.status === 200) {
        showPopup({ title: 'Success', message: 'Your profile has been created successfully!', type: 'success' });
        router.replace('/home');
      } else {
        showPopup({ title: 'Error', message: 'Failed to create profile. Please try again.', type: 'error' });
      }
      
    } catch (error) {
      if (isAxiosError(error)) {
      
      } else {
      console.error('Unexpected error:', error);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenCamera = () => {
    if (!username || !gender) {
      showPopup({ title: 'Hold On!', message: 'Please fill in your username and select your gender first.', type: 'warning' });
      return;
    }

    setCapturedFaceImages([]);
    setIsCameraVisible(true);
  };

  return (
    <SafeAreaView className="flex-1 bg-white px-8 justify-center">
      <View className="mb-10">
        <Text className="text-2xl font-extrabold text-gray-900 mb-3">
          Welcome, complete your profile 👋🏼
        </Text>
        <Text className="text-base text-gray-500 leading-relaxed">
          Complete your identity and record your face to start automatic precence with Locaface.
        </Text>
      </View>

      <View className="flex-row justify-center">
        <TouchableOpacity
          activeOpacity={0.8}
          className="h-36 w-36 rounded-full bg-gray-50 border-2 border-dashed border-gray-300 items-center justify-center overflow-hidden"
          onPress={() => handleAvatarPress(setAvatarUri)}
        >
          <View className="border-2 border-gray-200 w-36 h-36 rounded-full items-center justify-center">
            <Image source={{ uri: avatarUri }} className="w-36 h-36 rounded-full" />
          </View>
        </TouchableOpacity>
      </View>

      <View>
        <View>
          <Text className="text-sm font-bold text-gray-700 mb-2 ml-1">Username</Text>
          <TextInput
            className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-5 py-4 text-base text-gray-900"
            placeholder="Enter your username"
            value={username}
            onChangeText={setUsername}
          />
        </View>

        <View>
          <Text className="text-sm font-bold text-gray-700 mt-2 mb-2 ml-1">User Tag</Text>
          <TextInput
            className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-5 py-4 text-base text-gray-900"
            placeholder="example: john.doe"
            placeholderTextColor="#6B7280"
            autoCapitalize="none"
            autoCorrect={false}
            value={userTag}
            onChangeText={(value) => setUserTag(value.replace(/\s/g, ''))}
          />
          <Text className="text-xs text-gray-500 mt-1 ml-1">Student ID, Nickname ect</Text>
          <Text className="text-xs text-gray-400 mt-1 ml-1">Optional. 3-20 chars: a-z, 0-9, dot, underscore.</Text>
        </View>

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

      <View className="mt-4">
        <TouchableOpacity
          className="w-full border-2 border-gray-200 py-4 rounded-2xl"
          onPress={handleOpenCamera}
        >
          <View className="flex-row items-center justify-center gap-2">
            <FontAwesome name="camera" size={20} />
            <Text className="font-bold text-gray-700">Record your face</Text>
          </View>
        </TouchableOpacity>
      </View>

      <View className="mt-2">
        <Text className="text-center text-sm text-gray-400">
          Face captures: {capturedFaceImages.length}/3
        </Text>
      </View>

      <View className="mt-5">
        <TouchableOpacity onPress={handleSubmit} className="w-full bg-blue-500 py-4 rounded-2xl">
          <Text className="text-center text-white font-bold">Submit</Text>
        </TouchableOpacity>
      </View>

      <View>
        <Text className="text-center mt-1 text-sm text-gray-400">
          By continuing, you agree to our <Text className="text-blue-500">Terms of Service</Text> and{' '}
          <Text className="text-blue-500">Privacy Policy</Text>.
        </Text>
      </View>

      {isCameraVisible && (
        <CameraView
          username={username}
          setCapturedFaceImages={setCapturedFaceImages}
          setCameraVisible={setIsCameraVisible}
        />
      )}
      {isSubmitting && (
      <View className="absolute inset-0 bg-black/50 justify-center items-center">
        <View className="px-6 py-4 rounded-xl flex-row items-center gap-3">
          <ActivityIndicator size="large" />
        </View>
      </View>
    )}
    </SafeAreaView>
  );
}

function CameraView({
  username,
  setCapturedFaceImages,
  setCameraVisible,
}: {
  username: string;
  setCapturedFaceImages: React.Dispatch<React.SetStateAction<string[]>>;
  setCameraVisible: React.Dispatch<React.SetStateAction<boolean>>;
}) {
  const device = useCameraDevice('front');
  const cameraRef = useRef<Camera>(null);
  const isCapturingRef = useRef(false);
  const [isCameraReady, setIsCameraReady] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [captureStep, setCaptureStep] = useState<'front' | 'left' | 'right'>('front');
  const captureStepRef = useRef<'front' | 'left' | 'right'>('front');

  const faceDetectorConfig = useRef({
    performanceMode: 'fast' as const,
    classificationMode: 'none' as const,
  }).current;

  const { detectFaces } = useFaceDetector(faceDetectorConfig);

  const onFaceDetected = Worklets.createRunOnJS(async () => {
    if (isCapturingRef.current || !isCameraReady) return;

    isCapturingRef.current = true;
    setIsProcessing(true);

    try {
      const photo = await cameraRef.current?.takePhoto({ flash: 'off' });

      if (!photo?.path) {
        throw new Error('Failed to capture photo.');
      }

      const encodingType = (FileSystem as any).EncodingType?.Base64 ?? 'base64';
      const base64Image = await FileSystem.readAsStringAsync('file://' + photo.path, {
        encoding: encodingType,
      });

      setCapturedFaceImages((previousImages) => [...previousImages, base64Image]);

      if (captureStepRef.current === 'front') {
        captureStepRef.current = 'left';
        setCaptureStep('left');
      } else if (captureStepRef.current === 'left') {
        captureStepRef.current = 'right';
        setCaptureStep('right');
      } else {
        setCameraVisible(false);
      }
    } catch (error) {
      console.error('Failed to take photo:', error);
    } finally {
      setTimeout(() => {
        isCapturingRef.current = false;
        setIsProcessing(false);
      }, 2000);
    }
  });

  const frameProcessor = useFrameProcessor((frame) => {
    'worklet';
    const faces = detectFaces(frame);

    if (faces.length > 0) {
      const detectedFace = faces[0];
      const { yawAngle } = detectedFace;

      if (yawAngle !== undefined) {
        if (captureStep === 'front' && Math.abs(yawAngle) < 10) {
          onFaceDetected();
        } else if (captureStep === 'left' && yawAngle > 20) {
          onFaceDetected();
        } else if (captureStep === 'right' && yawAngle < -20) {
          onFaceDetected();
        }
      }
    }
  }, [captureStep, onFaceDetected]);

  const format = useCameraFormat(device, [
    { photoAspectRatio: 3 / 4 }, 
    { photoResolution: { width: 480, height: 640 } } 
  ]);

  if (!device) {
    return (
      <View className="flex-1 bg-black justify-center items-center">
        <ActivityIndicator size="large" />
        <Text className="text-white">Initializing Camera...</Text>
      </View>
    );
  }

  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: 'black' } ]} className="justify-center items-center">
      <Camera
        ref={cameraRef}
        className="flex-1"
        device={device}
        isActive={true}
        photo={true}
        frameProcessor={frameProcessor}
        format={format}
        onInitialized={() => setIsCameraReady(true)}
        style={styles.cameraPreview}
      />

      <View className="absolute inset-0 justify-center items-center">
        <View
          className={`w-[220px] h-[320px] border-4 border-dashed rounded-[130px] mt-10 mb-10 ${
            isProcessing ? 'border-green-500' : 'border-white/50'
          }`}
        />

        <View className="bg-black/70 px-8 py-5 rounded-3xl items-center border border-white/10">
          <Text className="text-blue-400 text-xs font-bold uppercase tracking-widest mb-1">
            {captureStep === 'front' ? 'Step 1/3' : captureStep === 'left' ? 'Step 2/3' : 'Step 3/3'}
          </Text>
          <Text className="text-white text-xl font-extrabold text-center">
            {captureStep === 'front' && 'Look Straight Ahead'}
            {captureStep === 'left' && 'Turn Your Head Left'}
            {captureStep === 'right' && 'Turn Your Head Right'}
          </Text>
          <Text className="text-gray-400 text-sm text-center mt-2 italic">
            {isProcessing ? 'Capturing...' : `Waiting for ${username}'s face...`}
          </Text>
        </View>
      </View>
    </View>
  );
}

const screenWidth = Dimensions.get('window').width;
const cameraHeight = screenWidth * (4 / 3);

const styles = StyleSheet.create({
  cameraPreview: {
    width: screenWidth,
    height: cameraHeight,
    overflow: 'hidden', // Biar rapi
  },
});