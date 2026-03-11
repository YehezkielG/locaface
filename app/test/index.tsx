import React, { useState, useRef, useCallback } from 'react';
import { Text, View, Alert } from 'react-native';
import { Camera, useCameraDevice, useFrameProcessor } from 'react-native-vision-camera';
import { useFaceDetector } from 'react-native-vision-camera-face-detector';
import { Worklets } from 'react-native-worklets-core';
import { useLocalSearchParams } from 'expo-router';

export default function SmartCameraScreen() {
  const { username } = useLocalSearchParams();
  const [isCameraReady, setIsCameraReady] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const isCapturing = useRef(false);

  // Konfigurasi Detector (Sangat ringan karena cuma cari bounds)
 const faceDetectorConfig = useRef({
    performanceMode: 'fast' as const, // Pakai 'as const' agar tipenya spesifik
    classificationMode: 'none' as const,
  }).current;

  const { detectFaces } = useFaceDetector(faceDetectorConfig);

  const device = useCameraDevice('front');
  const camera = useRef<Camera>(null);

  const [step, setStep] = useState<'front' | 'left' | 'right'>('front');
  const stepRef = useRef<'front' | 'left' | 'right'>('front');

  const onFaceDetected = useCallback(Worklets.createRunOnJS(async () => {
    // 1. Cek kunci dan kesiapan kamera
    if (isCapturing.current || !isCameraReady) return;
    
    isCapturing.current = true; // Kunci langsung!
    setIsProcessing(true);

    try {
      console.log("Menjepret...");
      const photo = await camera.current?.takePhoto({
        flash: 'off',
      });

      // Simpan path foto atau kirim ke state
      console.log("Hasil jepret:", photo?.path);

      // Logika pindah step
      if (stepRef.current === 'front') {
        stepRef.current = 'left';
        setStep('left');
      } else if (stepRef.current === 'left') {
        stepRef.current = 'right';
        setStep('right');
      } else {
        Alert.alert("Selesai!");
      }

    } catch (e) {
      // Kalau error "Camera is closed", biasanya karena session overlap
      console.error("Gagal ambil foto:", e);
    } finally {
      // Kasih jeda 2 detik sebelum bisa jepret lagi (Cooling down)
      setTimeout(() => {
        isCapturing.current = false;
        setIsProcessing(false);
      }, 2000);
    }
  }), []);

  const frameProcessor = useFrameProcessor((frame) => {
    'worklet';
    const faces = detectFaces(frame);
    if (faces.length > 0) {
      const face = faces[0];
      const { yawAngle } = face;

      if (yawAngle !== undefined) {
        onFaceDetected();
      }
    }
  }, [onFaceDetected]);

  if (!device) return <View className="flex-1 bg-black justify-center items-center"><Text className="text-white">Inisialisasi Kamera...</Text></View>;

  return (
    <View className="flex-1 bg-black">
      <Camera
        ref={camera}
        className="flex-1"
        device={device}
        isActive={true}
        photo={true}
        frameProcessor={frameProcessor}
        onInitialized={() => setIsCameraReady(true)}
      />
      
      {/* UI Overlay */}
      <View className="absolute inset-0 justify-center items-center">
        
        {/* Bingkai Oval Guide */}
        <View className={`w-[260px] h-[360px] border-4 border-dashed rounded-[130px] mb-20 ${isProcessing ? 'border-green-500' : 'border-white/50'}`} />

        {/* Kotak Instruksi */}
        <View className="bg-black/70 px-8 py-5 rounded-3xl items-center border border-white/10">
          <Text className="text-blue-400 text-xs font-bold uppercase tracking-widest mb-1">
            {step === 'front' ? 'Tahap 1/3' : step === 'left' ? 'Tahap 2/3' : 'Tahap 3/3'}
          </Text>
          <Text className="text-white text-xl font-extrabold text-center">
            {step === 'front' && "Tatap Lurus ke Depan"}
            {step === 'left' && "Tengok ke Kiri"}
            {step === 'right' && "Tengok ke Kanan"}
          </Text>
          <Text className="text-gray-400 text-sm text-center mt-2 italic">
            {isProcessing ? "Menjepret..." : `Sistem menunggu wajah ${username}...`}
          </Text>
        </View>

      </View>
    </View>
  );
}