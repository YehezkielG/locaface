import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { router } from "expo-router";
import { handleAvatarPress } from "@/src/lib/ImagePicker";
import uploadAvatar from "@/src/lib/ImageUploader";
import { showPopup } from "@/src/lib/inAppPopup";
import { clearHmacSession, signedPost } from "@/src/lib/securityServices";
import { supabase } from "@/src/lib/supabase";
import { GoogleSignin } from "@react-native-google-signin/google-signin";
import FontAwesome from "@expo/vector-icons/FontAwesome5";
import * as FileSystem from "expo-file-system/legacy";
import { Camera, useCameraDevice, useCameraFormat, useFrameProcessor } from "react-native-vision-camera";
import { useFaceDetector } from "react-native-vision-camera-face-detector";
import { Worklets } from "react-native-worklets-core";

type Gender = "male" | "female" | "";

export default function ProfilePage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [embeddingSaving] = useState(false);
  const [accountMenuVisible, setAccountMenuVisible] = useState(false);
  const [isFaceCameraVisible, setIsFaceCameraVisible] = useState(false);

  const [userId, setUserId] = useState<string>("");
  const [email, setEmail] = useState<string>("");
  const [username, setUsername] = useState<string>("");
  const [gender, setGender] = useState<Gender>("");
  const [userTag, setUserTag] = useState<string>("");
  const [avatarUri, setAvatarUri] = useState<string>("");
  const [originalAvatarUri, setOriginalAvatarUri] = useState<string>("");
  const [originalUsername, setOriginalUsername] = useState<string>("");
  const [originalGender, setOriginalGender] = useState<Gender>("");
  const [originalUserTag, setOriginalUserTag] = useState<string>("");
  const [pendingFaceEmbeddingImages, setPendingFaceEmbeddingImages] = useState<string[]>([]);

  const fetchProfile = async () => {
    try {
      setLoading(true);
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !user) {
        router.replace("/auth");
        return;
      }

      const { data: profile, error } = await supabase
        .from("profiles")
        .select("id, email, username, gender, avatar_url, user_tag")
        .eq("id", user.id)
        .maybeSingle();

      if (error) throw error;

      setUserId(user.id);
      setEmail((profile?.email as string) || user.email || "");
      const initialUsername = (profile?.username as string) || "";
      setUsername(initialUsername);
      setOriginalUsername(initialUsername);

      const nextGender = (profile?.gender as string) || "";
      const normalizedGender = nextGender === "male" || nextGender === "female" ? nextGender : "";
      setGender(normalizedGender);
      setOriginalGender(normalizedGender);

      const initialUserTag = (profile?.user_tag as string) || "";
      setUserTag(initialUserTag);
      setOriginalUserTag(initialUserTag);
      const avatar =
        (profile?.avatar_url as string) || user.user_metadata?.avatar_url || "";
      setAvatarUri(avatar);
      setOriginalAvatarUri(avatar);
      setPendingFaceEmbeddingImages([]);
    } catch (error) {
      console.error("Failed to load profile:", error);
      showPopup({
        title: "Error",
        message: "Failed to load profile data.",
        type: "error",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  const handleSave = async () => {
    if (!username.trim()) {
      showPopup({
        title: "Validation",
        message: "Username is required.",
        type: "warning",
      });
      return;
    }

    if (!gender) {
      showPopup({
        title: "Validation",
        message: "Please select gender.",
        type: "warning",
      });
      return;
    }

    if (!userId) {
      showPopup({
        title: "Error",
        message: "User session is not available.",
        type: "error",
      });
      return;
    }

    try {
      setSaving(true);

      let nextAvatar = avatarUri;
      const isLocalFile = !!avatarUri && !avatarUri.startsWith("http");
      if (isLocalFile && avatarUri !== originalAvatarUri) {
        const uploaded = await uploadAvatar(avatarUri, userId);
        if (!uploaded) {
          showPopup({
            title: "Error",
            message: "Failed to upload avatar image.",
            type: "error",
          });
          return;
        }
        nextAvatar = uploaded;
      }

      const {
        data: { session },
      } = await supabase.auth.getSession();

      const token = session?.access_token || "";

      if (pendingFaceEmbeddingImages.length === 3) {
        if (!token) {
          throw new Error("Session is invalid for face embedding update.");
        }

        await signedPost(
          "/register",
          {
            email: email || session?.user?.email || null,
            avatar_url: nextAvatar || null,
            username: username.trim(),
            gender,
            capture_source: "profile",
            image_front: pendingFaceEmbeddingImages[0],
            image_left: pendingFaceEmbeddingImages[1],
            image_right: pendingFaceEmbeddingImages[2],
          },
          token,
        );
      } else {
        const { error } = await supabase
          .from("profiles")
          .update({
            username: username.trim(),
            gender,
            user_tag: userTag.trim() ? userTag.trim() : null,
            avatar_url: nextAvatar || null,
            email: email || null,
          })
          .eq("id", userId);

        if (error) throw error;
      }

      setAvatarUri(nextAvatar);
      setOriginalAvatarUri(nextAvatar);
      setOriginalUsername(username.trim());
      setOriginalGender(gender);
      setOriginalUserTag(userTag.trim());
      setPendingFaceEmbeddingImages([]);
      showPopup({
        title: "Success",
        message: "Changes saved successfully.",
        type: "success",
      });
    } catch (error: any) {
      console.error("Failed to update profile:", error);
      showPopup({
        title: "Error",
        message: error?.message || "Failed to update profile.",
        type: "error",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    try {
      setLoggingOut(true);
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user?.id) {
        await supabase
          .from("profiles")
          .update({ push_token: null })
          .eq("id", user.id);
      }

      await clearHmacSession();
      try {
        await GoogleSignin.signOut();
      } catch {}
      await supabase.auth.signOut({ scope: 'local' });
      router.replace("/auth");
    } catch (error) {
      console.error("Logout failed:", error);
      showPopup({
        title: "Error",
        message: "Failed to logout.",
        type: "error",
      });
    } finally {
      setLoggingOut(false);
    }
  };

  const handleDeleteAccount = async () => {
    try {
      setDeleting(true);

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user?.id) {
        throw new Error("User session not found.");
      }

      const { error: profileDeleteError } = await supabase
        .from("profiles")
        .delete()
        .eq("id", user.id);

      if (profileDeleteError) {
        throw profileDeleteError;
      }

      await clearHmacSession();
      try {
        await GoogleSignin.signOut();
      } catch {}
      await supabase.auth.signOut({ scope: 'local' });

      showPopup({
        title: "Account deleted",
        message: "Your profile data was deleted and you have been signed out.",
        type: "success",
      });

      router.replace("/auth");
    } catch (error: any) {
      console.error("Delete account failed:", error);
      showPopup({
        title: "Error",
        message: error?.message || "Failed to delete account.",
        type: "error",
      });
    } finally {
      setDeleting(false);
    }
  };

  const confirmAndDeleteAccount = () => {
    Alert.alert(
      "Delete Account",
      "This action will permanently delete your profile data. Continue?",
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            setAccountMenuVisible(false);
            handleDeleteAccount();
          },
        },
      ],
    );
  };

  const handleEditFaceEmbedding = async (capturedFaceImages: string[]) => {
    if (capturedFaceImages.length < 3) {
      showPopup({
        title: "Face Embedding",
        message: "Please capture 3 face photos first (front, left, right).",
        type: "warning",
      });
      return;
    }

    if (!username.trim() || !gender) {
      showPopup({
        title: "Face Embedding",
        message: "Please complete username and gender before recording face embedding.",
        type: "warning",
      });
      return;
    }

    setPendingFaceEmbeddingImages(capturedFaceImages);
    showPopup({
      title: "Face Embedding",
      message: "New face embedding has been recorded. Press Save Changes to store it.",
      type: "success",
    });
  };

  const hasProfileChanges =
    username.trim() !== originalUsername ||
    gender !== originalGender ||
    userTag.trim() !== originalUserTag ||
    avatarUri !== originalAvatarUri;

  const hasEmbeddingChanges = pendingFaceEmbeddingImages.length === 3;
  const hasAnyChanges = hasProfileChanges || hasEmbeddingChanges;

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <ScrollView className="flex-1 px-5 pt-5 pb-24">
      <View className="flex-row items-center justify-between mb-5">
        <Text className="text-2xl font-bold text-gray-900">Profile</Text>
        <TouchableOpacity
          onPress={() => setAccountMenuVisible(true)}
          disabled={loggingOut || deleting}
          className="w-10 h-10 rounded-full bg-gray-100 items-center justify-center"
        >
          <FontAwesome name="bars" size={16} color="#374151" />
        </TouchableOpacity>
      </View>

      <View className="items-center mb-6">
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => handleAvatarPress(setAvatarUri)}
          className="w-28 h-28 rounded-full border-2 border-dashed border-gray-300 items-center justify-center overflow-hidden"
        >
          {avatarUri ? (
            <Image
              source={{ uri: avatarUri }}
              className="w-28 h-28 rounded-full"
            />
          ) : (
            <Text className="text-gray-400">Add photo</Text>
          )}
        </TouchableOpacity>
        <Text className="text-xs text-gray-500 mt-2">
          Tap to change profile photo
        </Text>
      </View>

      <View className="mb-4">
        <Text className="text-sm font-semibold text-gray-700 mb-2">Email</Text>
        <TextInput
          editable={false}
          value={email}
          className="bg-gray-100 border border-gray-200 rounded-xl px-4 py-3 text-gray-500"
        />
      </View>

      <View className="mb-4">
        <Text className="text-sm font-semibold text-gray-700 mb-2">
          Username *
        </Text>
        <TextInput
          value={username}
          onChangeText={setUsername}
          placeholder="Enter username"
          className="bg-white border border-gray-300 rounded-xl px-4 py-3 text-gray-900"
          placeholderTextColor="#9CA3AF"
        />
      </View>

      <View className="mb-4">
        <Text className="text-sm font-semibold text-gray-700 mb-2">
          Gender *
        </Text>
        <View className="flex-row gap-3">
          <TouchableOpacity
            onPress={() => setGender("male")}
            className={`flex-1 rounded-xl border px-4 py-3 items-center ${
              gender === "male"
                ? "bg-blue-50 border-blue-500"
                : "bg-white border-gray-300"
            }`}
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
            onPress={() => setGender("female")}
            className={`flex-1 rounded-xl border px-4 py-3 items-center ${
              gender === "female"
                ? "bg-pink-50 border-pink-500"
                : "bg-white border-gray-300"
            }`}
          >
            <View className="flex-row items-center justify-center gap-2">
              <FontAwesome
                name="venus"
                size={20}
                color={gender === "female" ? "#DB2777" : "#9CA3AF"}
              />
              <Text
                className={`font-bold ${
                  gender === "female" ? "text-pink-600" : "text-gray-400"
                }`}
              >
                Female
              </Text>
            </View>
          </TouchableOpacity>
        </View>
      </View>

      <View className="mb-6">
        <Text className="text-sm font-semibold text-gray-700 mb-2">
          User Tag (optional)
        </Text>
        <TextInput
          value={userTag}
          onChangeText={setUserTag}
          placeholder="Nickname / position"
          className="bg-white border border-gray-300 rounded-xl px-4 py-3 text-gray-900"
          placeholderTextColor="#9CA3AF"
        />
      </View>

      <TouchableOpacity
        onPress={() => setIsFaceCameraVisible(true)}
        disabled={embeddingSaving}
        className="w-full border-2 border-gray-200 py-4 rounded-2xl mb-3"
      >
        <View className="flex-row items-center justify-center gap-2">
          <FontAwesome name="camera" size={20} color="#374151" />
          <Text className="font-bold text-gray-700">
            {embeddingSaving ? "Processing..." : "Record your face"}
          </Text>
        </View>
      </TouchableOpacity>

      <TouchableOpacity
        onPress={handleSave}
        disabled={saving || !hasAnyChanges}
        className={`py-4 rounded-xl items-center mb-40 ${
          saving || !hasAnyChanges ? "bg-indigo-300" : "bg-indigo-500"
        }`}
      >
        <Text className="text-white font-bold">
          {saving ? "Saving..." : "Save Changes"}
        </Text>
      </TouchableOpacity>

      <Modal
        visible={accountMenuVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setAccountMenuVisible(false)}
      >
        <View className="flex-1 bg-black/45 justify-center px-6">
          <View className="bg-white rounded-2xl p-5">
            <Text className="text-lg font-bold text-gray-900 mb-4">Kelola Akun</Text>

            <TouchableOpacity
              onPress={() => {
                setAccountMenuVisible(false);
                handleLogout();
              }}
              disabled={loggingOut || deleting}
              className="bg-gray-700 py-3 rounded-xl items-center mb-3"
            >
              <Text className="text-white font-semibold">Logout</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={confirmAndDeleteAccount}
              disabled={loggingOut || deleting}
              className="bg-red-500 py-3 rounded-xl items-center mb-3"
            >
              <Text className="text-white font-semibold">Delete Account</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setAccountMenuVisible(false)}
              className="py-3 rounded-xl items-center border border-gray-200"
            >
              <Text className="text-gray-700 font-semibold">Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {isFaceCameraVisible && (
        <Modal visible transparent animationType="fade" onRequestClose={() => setIsFaceCameraVisible(false)}>
          <View className="flex-1 bg-black">
            <FaceEmbeddingCamera
              username={username}
              onComplete={async (images) => {
                setIsFaceCameraVisible(false);
                await handleEditFaceEmbedding(images);
              }}
            />
          </View>
        </Modal>
      )}
    </ScrollView>
  );
}

function FaceEmbeddingCamera({
  username,
  onComplete,
}: {
  username: string;
  onComplete: (images: string[]) => Promise<void> | void;
}) {
  const device = useCameraDevice("front");
  const cameraRef = useRef<Camera>(null);
  const isCapturingRef = useRef(false);

  const [isCameraReady, setIsCameraReady] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [captureStep, setCaptureStep] = useState<"front" | "left" | "right">("front");
  const [, setCapturedImages] = useState<string[]>([]);
  const captureStepRef = useRef<"front" | "left" | "right">("front");

  const faceDetectorConfig = useRef({
    performanceMode: "fast" as const,
    classificationMode: "none" as const,
  }).current;

  const { detectFaces } = useFaceDetector(faceDetectorConfig);

  const onFaceDetected = Worklets.createRunOnJS(async () => {
    if (isCapturingRef.current || !isCameraReady) return;

    isCapturingRef.current = true;
    setIsProcessing(true);

    try {
      const photo = await cameraRef.current?.takePhoto({ flash: "off" });
      if (!photo?.path) throw new Error("Failed to capture photo");

      const encodingType = (FileSystem as any).EncodingType?.Base64 ?? "base64";
      const base64Image = await FileSystem.readAsStringAsync(`file://${photo.path}`, {
        encoding: encodingType,
      });

      setCapturedImages((previousImages) => {
        const nextImages = [...previousImages, base64Image];

        if (captureStepRef.current === "front") {
          captureStepRef.current = "left";
          setCaptureStep("left");
        } else if (captureStepRef.current === "left") {
          captureStepRef.current = "right";
          setCaptureStep("right");
        } else {
          onComplete(nextImages);
        }

        return nextImages;
      });
    } catch (error) {
      console.error("Failed to capture face embedding photo:", error);
      showPopup({
        title: "Camera",
        message: "Failed to capture photo. Please try again.",
        type: "error",
      });
    } finally {
      setTimeout(() => {
        isCapturingRef.current = false;
        setIsProcessing(false);
      }, 2000);
    }
  });

  const frameProcessor = useFrameProcessor(
    (frame) => {
      "worklet";
      const faces = detectFaces(frame);

      if (faces.length > 0) {
        const detectedFace = faces[0] as any;
        const { yawAngle } = detectedFace;

        if (yawAngle !== undefined) {
          if (captureStep === "front" && Math.abs(yawAngle) < 10) {
            onFaceDetected();
          } else if (captureStep === "left" && yawAngle > 20) {
            onFaceDetected();
          } else if (captureStep === "right" && yawAngle < -20) {
            onFaceDetected();
          }
        }
      }
    },
    [captureStep, onFaceDetected, detectFaces],
  );

  const format = useCameraFormat(device, [
    { photoAspectRatio: 3 / 4 },
    { photoResolution: { width: 480, height: 640 } },
  ]);

  if (!device) {
    return (
      <View className="flex-1 bg-black justify-center items-center">
        <Text className="text-white">Initializing Camera...</Text>
      </View>
    );
  }

  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: "black" }]} className="justify-center items-center">
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
            isProcessing ? "border-green-500" : "border-white/50"
          }`}
        />

        <View className="bg-black/70 px-8 py-5 rounded-3xl items-center border border-white/10">
          <Text className="text-blue-400 text-xs font-bold uppercase tracking-widest mb-1">
            {captureStep === "front" ? "Step 1/3" : captureStep === "left" ? "Step 2/3" : "Step 3/3"}
          </Text>
          <Text className="text-white text-xl font-extrabold text-center">
            {captureStep === "front" && "Look Straight Ahead"}
            {captureStep === "left" && "Turn Your Head Left"}
            {captureStep === "right" && "Turn Your Head Right"}
          </Text>
          <Text className="text-gray-400 text-sm text-center mt-2 italic">
            {isProcessing ? "Capturing..." : `Waiting for ${username}'s face...`}
          </Text>
        </View>
      </View>
    </View>
  );
}

const screenWidth = Dimensions.get("window").width;
const cameraHeight = screenWidth * (4 / 3);

const styles = StyleSheet.create({
  cameraPreview: {
    width: screenWidth,
    height: cameraHeight,
    overflow: "hidden",
  },
});
