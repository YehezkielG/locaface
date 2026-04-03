import React, { useEffect, useState } from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { fetchUserProfile, user_metadata } from "../../../src/lib/User";
import Ionicons from "@expo/vector-icons/Ionicons";
import { router } from "expo-router";
// replaced Octicons with Ionicons for consistency
import { fetchMyClasses, joinClassByCode } from "@/src/lib/classesLib";
import JoinClassModal from "@/src/components/JoinClassModal";
import { showPopup } from "@/src/lib/inAppPopup";
import { registerForPushNotificationsAsync } from "@/src/lib/notifications";
import { validateUserInClassRadius } from "@/src/lib/precenceLib";
import { supabase } from "@/src/lib/supabase";

export default function HomePage() {
  const [user, setUser] = useState<user_metadata | null>(null);
  const [classes, setClasses] = useState<any[]>([]);
  const [isLoadingClasses, setIsLoadingClasses] = useState(true);
  const [joinModalVisible, setJoinModalVisible] = useState(false);
  const [joinCode, setJoinCode] = useState("");
  const [isJoining, setIsJoining] = useState(false);

  const activeClasses = classes.filter(
    (item) => item.class?.is_accepting_absen === true,
  );

  const truncateText = (
    value: string | null | undefined,
    maxLength: number,
  ) => {
    if (!value) return "-";
    if (value.length <= maxLength) return value;
    return `${value.slice(0, maxLength)}...`;
  };

  const getRoleTextColorClass = (role: string | null | undefined) => {
    if (!role) return "text-gray-500";
    return role.toLowerCase() === "instructor"
      ? "text-orange-700"
      : "text-gray-500";
  };

  useEffect(() => {
    setUser(null);
    (async () => {
      const profile = await fetchUserProfile();
      const expoToken = await registerForPushNotificationsAsync();
      if (expoToken) {
        const { error } = await supabase
          .from("profiles")
          .update({ push_token: expoToken })
          .eq("id", profile.id);

        if (error) {
          console.error("❌ Failed to save push token:", error);
        } else {
          console.log(`💾 Push token saved for user profile: ${profile.id}`);
        }
      }
      
      if (profile) setUser(profile);
    })();
  }, []);

  const handleOpenJoinModal = () => {
    setJoinCode("");
    setJoinModalVisible(true);
  };

  const handleJoinClass = async () => {
    const normalizedCode = joinCode.replace(/\s/g, "").toUpperCase();

    if (normalizedCode.length !== 6) {
      showPopup({
        title: "Validation",
        message: "Class code must be 6 characters.",
        type: "warning",
      });
      return;
    }

    setIsJoining(true);
    const result = await joinClassByCode(normalizedCode);
    setIsJoining(false);

    if (!result.success) {
      showPopup({
        title: "Join Class",
        message: result.message,
        type: "error",
      });
      return;
    }

    setJoinModalVisible(false);
    showPopup({ title: "Success", message: result.message, type: "success" });

    setIsLoadingClasses(true);
    const myClasses = await fetchMyClasses();
    setClasses(myClasses || []);
    setIsLoadingClasses(false);
  };

  const handleAbsencePress = async (item: any) => {
    const classId = item?.class?.id;
    const className = item?.class?.name;
    const classLat = item?.class?.latitude;
    const classLng = item?.class?.longitude;
    const memberRole = String(item?.role || '').toLowerCase();
    const isClassActive = item?.class?.is_accepting_absen === true;

    if (classId && (memberRole === 'instructor' || memberRole === 'owner')) {
      router.push({
        pathname: '/classes/[id]',
        params: {
          id: String(classId),
          tab: isClassActive ? 'today-session' : 'history',
        },
      });
      return;
    }

    if (!classId || classLat == null || classLng == null) {
      showPopup({
        title: "Precence",
        message: "Class location data is incomplete.",
        type: "warning",
      });
      return;
    }

    try {
      const locationValidation = await validateUserInClassRadius(
        Number(classLat),
        Number(classLng),
        15,
      );

      if (!locationValidation.ok) {
        showPopup({
          title: "Precence",
          message: locationValidation.message,
          type: "warning",
        });
        return;
      }
    } catch {
      showPopup({
        title: "Precence",
        message: "Failed to validate location. Please try again.",
        type: "error",
      });
      return;
    }

    router.push({
      pathname: "/classes/start-precence",
      params: {
        classId: String(classId),
        className: String(className || ""),
        classLat: String(classLat),
        classLng: String(classLng),
      },
    });
  };

  useEffect(() => {
    (async () => {
      try {
        setIsLoadingClasses(true);
        const myClasses = await fetchMyClasses();
        setClasses(myClasses || []);
      } catch (err) {
        console.warn("Failed to fetch classes:", err);
      } finally {
        setIsLoadingClasses(false);
      }
    })();
  }, []);

  return (
    <View className="flex-1 p-5 pb-20  pt-0">
      <View className="flex-row items-center justify-between mt-5 ">
        <Text className="text-2xl font-bold text-gray-800">Home</Text>
        {/* <Ionicons name="notifications-outline" size={24} color="black" /> */}
        
      </View>
      <Text className="text-lg mt-5 text-gray-600 mb-2">
        Hi {user?.username}!
      </Text>
      <View className="flex-row justify-between mb-8 gap-2 space-x-3">
        <TouchableOpacity
          onPress={handleOpenJoinModal}
          className="flex-1 bg-white p-4 rounded-2xl items-center shadow-sm"
        >
          <View className="w-12 h-12 rounded-full justify-center items-center mb-2 bg-indigo-100">
            <Ionicons name="enter-outline" size={24} color="#4F46E5" />
          </View>
          <Text className="text-sm font-semibold text-gray-700">
            Join Class
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => router.push("/classes/create")}
          className="flex-1 bg-white p-4 rounded-2xl items-center shadow-sm"
        >
          <View className="w-12 h-12 rounded-full justify-center items-center mb-2 bg-green-100">
            <Ionicons name="add-circle-outline" size={24} color="#16A34A" />
          </View>
          <Text className="text-sm font-semibold text-gray-700">
            Create Class
          </Text>
        </TouchableOpacity>
      </View>
      <Text className="text-lg font-bold text-gray-900 mb-3">
        Current Classes
      </Text>
      {activeClasses.length > 0 ? (
        activeClasses.slice(0, 1).map((item, index) => (
          <View
            key={index}
            className="bg-white rounded-xl p-5 mb-8 border border-indigo-50"
          >
            <View className="flex-row justify-between items-center mb-3">
              <View className="bg-red-100 px-3 py-1 rounded-full">
                <Text className="text-red-500 text-xs font-bold">Ongoing</Text>
              </View>
              <Text className="text-xs text-gray-500 font-semibold">
                {item.class?.start_time.slice(0, 5) || "-"} WIB
              </Text>
            </View>
            <Text className="text-2xl font-bold text-gray-900 mb-1">
              {item.class?.name || "Unnamed Class"}
            </Text>
            <Text className="text-sm text-gray-500 mb-5">
              {item.class?.latitude != null && item.class?.longitude != null
                ? `📍 Lat ${Number(item.class.latitude).toFixed(4)}, Lng ${Number(item.class.longitude).toFixed(4)}`
                : "📍 Location not set"}
            </Text>
            <TouchableOpacity
              onPress={() => handleAbsencePress(item)}
              className="flex-row justify-center items-center py-3.5 rounded-xl bg-indigo-500"
            >
              <Ionicons
                name="scan-outline"
                size={20}
                color="#FFF"
                className="mr-2"
              />
              <Text className="text-white text-base font-bold ml-2">
                {String(item?.role || '').toLowerCase() === 'instructor'
                  ? 'Enter Classes'
                  : 'Start Precence'}
              </Text>
            </TouchableOpacity>
          </View>
        ))
      ) : (
        <View className="rounded-3xl p-5 mb-8">
          <Text className="text-sm text-center text-gray-500">
            No classes are currently taking precence.
          </Text>
        </View>
      )}
      <View>
        <View className="mb-3 flex-row items-center">
          <Ionicons
            name="people-outline"
            size={24}
            color="black"
            className="mr-2"
          />
          <Text>My Classes</Text>
        </View>
        {isLoadingClasses && (
          <Text className="text-sm text-gray-500">Loading my classes...</Text>
        )}

        {!isLoadingClasses && classes.length === 0 && (
          <Text className="text-sm text-gray-500">
            You are not enrolled in any classes yet.
          </Text>
        )}

        {!isLoadingClasses &&
          classes.length > 0 &&
          classes.slice(0, 4).map((item, index) => (
            <TouchableOpacity
              key={index}
              onPress={() => {
                if (!item.class?.id) return;
                router.push({
                  pathname: "/classes/[id]",
                  params: { id: String(item.class.id) },
                });
              }}
              className="bg-white rounded-lg p-4 mb-3 flex-row items-center shadow-sm"
            >
              <Text className="text-3xl mr-2">{item.class.icon || "📚"}</Text>
              <View className="flex-1">
                <View className="flex-row items-center justify-between">
                  <Text className="font-semibold text-gray-900 mr-2">
                    {truncateText(item.class.name, 28)}
                  </Text>
                  <Text
                    className={`text-xs font-semibold uppercase ${getRoleTextColorClass(item.role)}`}
                  >
                    {item.role || "member"}
                  </Text>
                </View>
                <Text className="text-sm text-gray-600">
                  {truncateText(item.class.description, 48)}
                </Text>
              </View>
            </TouchableOpacity>
          ))}
        {!isLoadingClasses && classes.length > 4 && (
          <Text className="text-xs text-gray-500">
            Showing 4 of {classes.length} classes.
          </Text>
        )}
      </View>
      <JoinClassModal
        visible={joinModalVisible}
        code={joinCode}
        isSubmitting={isJoining}
        onChangeCode={(value) =>
          setJoinCode(value.replace(/\s/g, "").toUpperCase())
        }
        onClose={() => setJoinModalVisible(false)}
        onSubmit={handleJoinClass}
      />
    </View>
  );
}
