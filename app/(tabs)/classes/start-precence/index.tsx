import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Dimensions, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Camera, useCameraDevice, useCameraFormat, useFrameProcessor } from 'react-native-vision-camera';
import { useFaceDetector } from 'react-native-vision-camera-face-detector';
import { Worklets } from 'react-native-worklets-core';
import * as FileSystem from 'expo-file-system/legacy';
import { Ionicons } from '@expo/vector-icons';
import { showPopup } from '@/src/lib/inAppPopup';
import { supabase } from '@/src/lib/supabase';
import { submitStartPrecence, validateUserInClassRadius } from '@/src/lib/precenceLib';

export default function StartPrecencePage() {
  const REJECT_POPUP_DURATION_MS = 6000;

  const params = useLocalSearchParams<{
    classId?: string;
    className?: string;
    classLat?: string;
    classLng?: string;
  }>();

  const classId = Array.isArray(params.classId) ? params.classId[0] : params.classId;
  const className = Array.isArray(params.className) ? params.className[0] : params.className;
  const classLatRaw = Array.isArray(params.classLat) ? params.classLat[0] : params.classLat;
  const classLngRaw = Array.isArray(params.classLng) ? params.classLng[0] : params.classLng;

  const classLatitude = classLatRaw ? Number(classLatRaw) : NaN;
  const classLongitude = classLngRaw ? Number(classLngRaw) : NaN;

  const cameraRef = useRef<Camera>(null);
  const isSubmittingRef = useRef(false);
  const hasAutoSubmittedRef = useRef(false);
  const blinkStateRef = useRef<'waiting_face' | 'waiting_close' | 'waiting_open' | 'verified'>('waiting_face');
  const captureFlashOpacity = useRef(new Animated.Value(0)).current;

  const [isCameraReady, setIsCameraReady] = useState(false);
  const [isCameraActive, setIsCameraActive] = useState(true);
  const [faceDetected, setFaceDetected] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isClassOwner, setIsClassOwner] = useState(false);
  const [blinkState, setBlinkState] = useState<'waiting_face' | 'waiting_close' | 'waiting_open' | 'verified'>('waiting_face');
  const [showMoveAwayHint, setShowMoveAwayHint] = useState(false);

  const triggerCaptureIndicator = useCallback(() => {
    setShowMoveAwayHint(true);
    captureFlashOpacity.setValue(0);

    Animated.sequence([
      Animated.timing(captureFlashOpacity, {
        toValue: 0.28,
        duration: 70,
        useNativeDriver: true,
      }),
      Animated.delay(70),
      Animated.timing(captureFlashOpacity, {
        toValue: 0,
        duration: 170,
        useNativeDriver: true,
      }),
    ]).start(({ finished }) => {
      if (finished) {
        setShowMoveAwayHint(false);
      }
    });
  }, [captureFlashOpacity]);

  const closeCameraAndGoHome = useCallback(() => {
    setIsCameraActive(false);
    router.replace('/home');
  }, []);

  const device = useCameraDevice('front');
  const format = useCameraFormat(device, [{ photoAspectRatio: 3 / 4 }, { photoResolution: { width: 480, height: 640 } }]);

  const detector = useFaceDetector({
    performanceMode: 'fast',
    classificationMode: 'all',
  });

  useEffect(() => {
    blinkStateRef.current = blinkState;
  }, [blinkState]);

  useEffect(() => {
    let active = true;

    const guardOwnerAccess = async () => {
      if (!classId) return;

      try {
        const { data: authData } = await supabase.auth.getUser();
        const currentUserId = authData?.user?.id;
        if (!currentUserId) return;

        const { data: classRow, error } = await supabase
          .from('classes')
          .select('owner_id')
          .eq('id', classId)
          .single();

        if (error) return;

        const owner = classRow?.owner_id;
        if (active && owner && owner === currentUserId) {
          setIsClassOwner(true);
          showPopup({
            title: 'Precence',
            message: 'Class owners cannot take precence in their own class.',
            type: 'warning',
          });
          router.back();
        }
      } catch {
      }
    };

    guardOwnerAccess();
    return () => {
      active = false;
    };
  }, [classId]);

  const setFaceDetectedFromWorklet = Worklets.createRunOnJS((detected: boolean, leftOpen?: number, rightOpen?: number) => {
    setFaceDetected(detected);

    if (blinkStateRef.current === 'verified') return;

    if (!detected) {
      setBlinkState('waiting_face');
      return;
    }

    if (blinkStateRef.current === 'waiting_face') {
      setBlinkState('waiting_close');
      return;
    }

    if (leftOpen == null || rightOpen == null) {
      return;
    }

    const averageEyeOpen = (leftOpen + rightOpen) / 2;
    const eyesClosed = averageEyeOpen < 0.35;
    const eyesOpen = averageEyeOpen > 0.65;

    if (blinkStateRef.current === 'waiting_close' && eyesClosed) {
      setBlinkState('waiting_open');
      return;
    }

    if (blinkStateRef.current === 'waiting_open' && eyesOpen) {
      setBlinkState('verified');
    }
  });

  const frameProcessor = useFrameProcessor(
    (frame) => {
      'worklet';
      const faces = detector.detectFaces(frame);

      if (faces.length === 0) {
        setFaceDetectedFromWorklet(false);
        return;
      }

      const face = faces[0] as any;
      setFaceDetectedFromWorklet(
        true,
        typeof face?.leftEyeOpenProbability === 'number' ? face.leftEyeOpenProbability : undefined,
        typeof face?.rightEyeOpenProbability === 'number' ? face.rightEyeOpenProbability : undefined,
      );
    },
    [detector, setFaceDetectedFromWorklet],
  );

  const handleStartPrecence = useCallback(async () => {
    if (isSubmittingRef.current) return;

    if (isClassOwner) {
      showPopup({ title: 'Precence', message: 'Class owners cannot take precence.', type: 'warning' });
      return;
    }

    if (!classId) {
      showPopup({ title: 'Precence', message: 'Class data not found.', type: 'error' });
      return;
    }

    if (!Number.isFinite(classLatitude) || !Number.isFinite(classLongitude)) {
      showPopup({ title: 'Precence', message: 'Invalid class coordinates.', type: 'error' });
      return;
    }

    if (!faceDetected) {
      showPopup({ title: 'Precence', message: 'Face not detected yet. Please align your face with the camera.', type: 'warning' });
      return;
    }

    if (blinkState !== 'verified') {
      showPopup({ title: 'Precence', message: 'Please blink first for liveness verification.', type: 'warning' });
      return;
    }

    if (!cameraRef.current) {
      showPopup({ title: 'Precence', message: 'Camera is not ready yet.', type: 'warning' });
      return;
    }

    isSubmittingRef.current = true;
    setIsSubmitting(true);

    try {
      const locationValidation = await validateUserInClassRadius(classLatitude, classLongitude, 15);
      if (!locationValidation.ok || locationValidation.userLatitude == null || locationValidation.userLongitude == null || locationValidation.distanceMeters == null) {
        showPopup({ title: 'Precence', message: locationValidation.message, type: 'warning' });
        return;
      }

      const { data: authData, error: authError } = await supabase.auth.getSession();
      const accessToken = authData?.session?.access_token;

      if (authError || !accessToken) {
        showPopup({ title: 'Unauthorized', message: 'Session is invalid. Please sign in again.', type: 'warning' });
        return;
      }

      const photo = await cameraRef.current.takePhoto({ flash: 'off' });
      if (!photo?.path) {
        showPopup({ title: 'Precence', message: 'Failed to capture face photo.', type: 'error' });
        return;
      }

      triggerCaptureIndicator();

      const encodingType = (FileSystem as any).EncodingType?.Base64 ?? 'base64';
      const base64Image = await FileSystem.readAsStringAsync(`file://${photo.path}`, {
        encoding: encodingType,
      });

      const attendanceResponse = await submitStartPrecence(accessToken, {
        class_id: classId,
        image: base64Image,
        latitude: locationValidation.userLatitude,
        longitude: locationValidation.userLongitude,
        distance_meters: locationValidation.distanceMeters,
      });

      const responseData = attendanceResponse?.data;
      const attendanceSuccess = Boolean(responseData?.attendance_success);
      const attendanceMessage = responseData?.attendance_message || 'No details received from server.';
      console.log(
        `[Attendance] ${attendanceSuccess ? 'SUCCESS' : 'FAILED'} - ${attendanceMessage} - ${responseData?.highest_similarity}`,
      );

      console.log("Attendance user cosine similarity :", responseData?.highest_similarity);

      const resultMessage = attendanceSuccess
        ? `Precence for ${className || 'class'} was submitted successfully.`
        : `Precence failed: ${attendanceMessage}`;
      
      const resultType = attendanceSuccess ? 'success' : 'warning';
      showPopup({
        title: 'Precence',
        message: resultMessage,
        type: resultType,
        durationMs: attendanceSuccess ? 2200 : REJECT_POPUP_DURATION_MS,
      });
      
      if (attendanceSuccess) {
        router.back();
      } else {
        setTimeout(() => {
          closeCameraAndGoHome();
        }, REJECT_POPUP_DURATION_MS);
      }
    } catch (error: any) {
      hasAutoSubmittedRef.current = false;
      const message = error?.response?.data?.detail || error?.message || 'Failed to start precence.';
      showPopup({ title: 'Precence', message: String(message), type: 'error', durationMs: REJECT_POPUP_DURATION_MS });
      setTimeout(() => {
        closeCameraAndGoHome();
      }, REJECT_POPUP_DURATION_MS);
    } finally {
      isSubmittingRef.current = false;
      setIsSubmitting(false);
    }
  }, [blinkState, classId, classLatitude, classLongitude, className, closeCameraAndGoHome, faceDetected, isClassOwner, triggerCaptureIndicator]);

  useEffect(() => {
    if (!isCameraReady || !faceDetected || blinkState !== 'verified' || isSubmitting || hasAutoSubmittedRef.current) return;

    hasAutoSubmittedRef.current = true;
    handleStartPrecence();
  }, [isCameraReady, faceDetected, blinkState, isSubmitting, handleStartPrecence]);

  const blinkInstruction =
    blinkState === 'verified'
      ? 'Blink verified. Submitting precence...'
      : blinkState === 'waiting_open'
        ? 'Great. Now open your eyes again.'
        : blinkState === 'waiting_close'
          ? 'Blink Challenge: Blink now.'
          : 'Align your face within the frame to begin.';

  if (!device) {
    return (
      <SafeAreaView className="flex-1 bg-black items-center justify-center">
        <ActivityIndicator size="large" />
        <Text className="text-white mt-3">Preparing camera...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-black">
      <View style={[StyleSheet.absoluteFill, { backgroundColor: 'black' }]} className="justify-center items-center">
        <Camera
          ref={cameraRef}
          className="flex-1"
          device={device}
          isActive={isCameraActive}
          photo={true}
          frameProcessor={frameProcessor}
          format={format}
          onInitialized={() => setIsCameraReady(true)}
          style={styles.cameraPreview}
        />

        <TouchableOpacity
          onPress={() => router.back()}
          className="absolute top-12 left-5 w-10 h-10 rounded-full bg-black/50 items-center justify-center"
        >
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>

        <View className="absolute inset-0 justify-center items-center">
          <View
            className={`w-[220px] h-[320px] border-4 border-dashed rounded-[130px] mt-10 mb-10 ${
              isSubmitting || blinkState === 'verified' ? 'border-green-500' : 'border-white/50'
            }`}
          />

          <View className="bg-black/70 px-8 py-5 rounded-3xl items-center border border-white/10 mx-5">
            <Text className="text-blue-400 text-xs font-bold uppercase tracking-widest mb-1">Blink Challenge</Text>
            <Text className="text-white text-xl font-extrabold text-center">
              {className ? `Precence • ${className}` : 'Class Precence'}
            </Text>
            <Text className="text-gray-300 text-sm text-center mt-2 italic">
              {isSubmitting ? 'Processing precence...' : blinkInstruction}
            </Text>
          </View>
        </View>

        <Animated.View
          pointerEvents="none"
          style={[styles.captureFlashOverlay, { opacity: captureFlashOpacity }]}
        />

        {showMoveAwayHint ? (
          <View pointerEvents="none" style={styles.captureHintPill}>
            <Text style={styles.captureHintText}>Photo captured. You can move away now.</Text>
          </View>
        ) : null}
      </View>
    </SafeAreaView>
  );
}

const screenWidth = Dimensions.get('window').width;
const cameraHeight = screenWidth * (4 / 3);

const styles = StyleSheet.create({
  cameraPreview: {
    width: screenWidth,
    height: cameraHeight,
    overflow: 'hidden',
  },
  captureFlashOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#D1D5DB',
  },
  captureHintPill: {
    position: 'absolute',
    bottom: 120,
    alignSelf: 'center',
    backgroundColor: 'rgba(17, 24, 39, 0.82)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  captureHintText: {
    color: '#F9FAFB',
    fontSize: 12,
    fontWeight: '700',
  },
});
