import React, { useState, useEffect, useRef } from "react";
import {View,Text,TextInput,TouchableOpacity,ScrollView,ActivityIndicator} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Constants from "expo-constants";
import MapView, {
  Marker,
  Region,
  PROVIDER_GOOGLE,
} from "react-native-maps";
import { generateJoinCode, SetClassDeadline, fetchUserLocation, geocodeSearch, centerOnDeviceLocation, applySearchSelection, DayOfWeekPicker, ClassTimeSettings, setExpiry } from "@/src/lib/classesLib";
import { supabase } from "@/src/lib/supabase";
import { router } from "expo-router";
import { showPopup } from "@/src/lib/inAppPopup";

const ICONS: string[] = [ "📐","💻","📊","🔬","🌍","🎨","💼","🚀","🤖","📚",];

export default function CreateClassScreen() {
  const [className, setClassName] = useState<string>("");
  const [selectedIcon, setSelectedIcon] = useState<string>("💻");
  const [joinCode, setJoinCode] = useState<string>("");
  const [description, setDescription] = useState<string>("");
  const [date, setDate] = useState<Date | null>(null);
  const [selectedDays, setSelectedDays] = useState<number[]>([]);
  const [startTime, setStartTime] = useState<Date>(new Date());
  const [tolerance, setTolerance] = useState<string>("15"); 

  const [selectedLat, setSelectedLat] = useState<number | null>(null); 
  const [selectedLng, setSelectedLng] = useState<number | null>(null);
  const [isLoadingMap, setIsLoadingMap] = useState<boolean>(true);
  const [mapReady, setMapReady] = useState<boolean>(false);
  const [locationQuery, setLocationQuery] = useState<string>("");
  
  const [isCentering, setIsCentering] = useState<boolean>(false);
  const [searchResults, setSearchResults] = useState<{label: string; lat: number; lng: number}[]>([]);
  const mapRef = useRef<MapView | null>(null);

  const googleMapsApiKey =
    process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ||
    Constants.expoConfig?.android?.config?.googleMaps?.apiKey ||
    "";
  const [mapRegion, setMapRegion] = useState<Region>({
    latitude: 3.5952,
    longitude: 98.6722,
    latitudeDelta: 0.0025,
    longitudeDelta: 0.0025,
  });

  useEffect(() => {
    generateJoinCode(setJoinCode);
    fetchUserLocation(setIsLoadingMap, setMapRegion);
  }, []);

  const handleCreateClass = async () => {
  if (!className.trim()) {
    showPopup({ title: "Validation", message: "Class name cannot be empty!", type: "warning" });
    return;
  }
  if (selectedLat === null || selectedLng === null) {
    showPopup({
      title: "Validation",
      message: "Please tap the map to select the building/class location!",
      type: "warning",
    });
    return;
  }
  // TODO: Opsional - Tambahkan state setIsLoading(true) di sini biar tombolnya loading
  try {
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      throw new Error("Session not found. Please sign in again.");
    }

    // Get device timezone
    const deviceTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

        // 3. Formatting Data (save as local time)
    const validUntil = date ? setExpiry(date) : null;
    const startTimeStr = startTime
        ? `${String(startTime.getHours()).padStart(2, '0')}:${String(startTime.getMinutes()).padStart(2, '0')}`
        : null;
    const lateToleranceInt = tolerance ? parseInt(tolerance, 10) : 0;

    // 4. Siapkan Payload
    const classData = {
      name: className.trim(),
      icon: selectedIcon, 
      join_code: joinCode,
      latitude: selectedLat,
      longitude: selectedLng,
      valid_until: validUntil,
      day_of_week: selectedDays, 
      start_time: startTimeStr, 
      late_tolerance: lateToleranceInt, 
      description: description ? description.trim() : null,
      owner_id: user.id,
      timezone: deviceTimezone,
    };

    const { error } = await supabase
      .from('classes')
      .insert([classData])
      .select()
      .single();

    if (error) {
      throw error;
    }
    
    showPopup({ title: "Success", message: `Class ${className} created! Code: ${joinCode}`, type: "success" });

    router.replace('/(tabs)/home'); // Redirect ke home setelah sukses    
  } catch (error) {
    console.error("Error inserting class:", error);
    const msg = (error as any)?.message || "Failed to create class. Please try again.";
    showPopup({ title: "Error", message: String(msg), type: "error" });
  } finally {
    // TODO: Opsional - Tambahkan state setIsLoading(false) di sini
  }
};

  return (
    <View className="flex-1 bg-white">
      <View className="flex-row items-center px-5 py-4 bg-white border-b border-gray-200">
        <TouchableOpacity onPress={() => router.back()} className="mr-4">
          <Ionicons name="arrow-back" size={24} color="#111827" />
        </TouchableOpacity>
        <Text className="text-xl font-bold text-gray-900">
          Create New Class
        </Text>
      </View>

      <ScrollView className="flex-1 px-5 pt-6">
        <View className="mb-6">
          <Text className="text-sm font-semibold text-gray-700 mb-2">
            Class Name *
          </Text>
          <TextInput
            className="bg-white px-4 py-3.5 rounded-xl border border-gray-300 text-base text-gray-900"
            placeholder="e.g. Software Engineering"
            placeholderTextColor="#9CA3AF"
            value={className}
            onChangeText={setClassName}
          />
        </View>

        <View className="mb-6">
            <SetClassDeadline setDate={setDate} date={date} />
        </View>

          <View className="mb-6">
            <Text className="text-sm font-semibold text-gray-700 mb-2">Class Description</Text>
            <TextInput
              className="bg-white px-4 py-3.5 rounded-xl border border-gray-300 text-base text-gray-900"
              placeholder="Short description or instructions for the class"
              placeholderTextColor="#9CA3AF"
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={3}
            />
          </View>

        <View className="">
          <Text className="text-sm font-semibold text-gray-700 mb-2">
            Day of Week *
          </Text>
          <DayOfWeekPicker
            selectedDays={selectedDays}
            onDaysChange={setSelectedDays}
          />
        </View>

        <View className="mb-6">
          <ClassTimeSettings startTime={startTime} onTimeChange={setStartTime} lateTolerance={tolerance} onToleranceChange={setTolerance} />
        </View>

        {/* SECTION: GEO-FENCING LOCATION ANCHOR */}
        <View className="mb-6">
          <Text className="text-sm font-semibold text-gray-700 mb-2">
            Set Precence Point (Tap the map) *
          </Text>

            <View className="mb-3 flex-row items-center gap-2">
              <View className="flex-1 bg-white border border-gray-300 rounded-xl px-3 flex-row items-center">
                <Ionicons name="search-outline" size={18} color="#6B7280" />
                <TextInput
                  className="flex-1 ml-2 text-base text-gray-900"
                  placeholder="Search location (e.g. FMIPA Unimed)"
                  placeholderTextColor="#9CA3AF"
                  value={locationQuery}
                  onChangeText={setLocationQuery}
                  returnKeyType="search"
                  onSubmitEditing={() => geocodeSearch(locationQuery, googleMapsApiKey, setSearchResults, setMapRegion, setSelectedLat, setSelectedLng, mapRef)}
                />
              </View>
              <TouchableOpacity
                onPress={() => centerOnDeviceLocation(setIsCentering, setMapRegion, setSelectedLat, setSelectedLng, mapRef)}
                disabled={isCentering}
                className="ml-2 bg-white px-3 py-3 rounded-xl border border-gray-200"
              >
                <Ionicons name={isCentering ? 'locate' : 'locate-outline'} size={20} color={isCentering ? '#4F46E5' : '#374151'} />
              </TouchableOpacity>
            </View>
          <View
            // use explicit native style to guarantee sizing/positioning for MapView
            style={{
              height: 256, // tailwind h-64 ~= 256px
              width: '100%',
              borderRadius: 16,
              overflow: 'hidden',
              borderWidth: 1,
              borderColor: '#D1D5DB',
              position: 'relative',
              backgroundColor: '#F8FAFC',
            }}
          >
            {searchResults.length > 0 && (
              <View className="absolute left-3 right-3 top-3 bg-white rounded-xl shadow-md z-50" style={{ maxHeight: 160 }}>
                <ScrollView>
                  {searchResults.map((item, idx) => (
                    <TouchableOpacity key={idx} onPress={() => applySearchSelection(item, setMapRegion, setSelectedLat, setSelectedLng, setSearchResults, setLocationQuery, mapRef)} className="px-3 py-3 border-b border-gray-100">
                      <Text className="text-sm text-gray-800">{item.label}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}
            {isLoadingMap ? (
              <View className="flex-1 justify-center items-center bg-gray-100">
                <ActivityIndicator size="large" />
                <Text className="mt-2 text-gray-500">Locating your device...</Text>
              </View>
            ) : (
              <MapView
                ref={mapRef}
                style={{ flex: 1, width: '100%' }}
                initialRegion={mapRegion}
                provider={PROVIDER_GOOGLE}
                mapType="standard"
                showsUserLocation={true}
                onPress={(e) => {
                  const { latitude, longitude } = e.nativeEvent.coordinate;
                  setSelectedLat(latitude);
                  setSelectedLng(longitude);
                }}
                onMapReady={() => {
                  setMapReady(true);
                }}
                onLayout={() => {}}
              >
                {selectedLat !== null && selectedLng !== null && (
                  <Marker
                    coordinate={{
                      latitude: selectedLat,
                      longitude: selectedLng,
                    }}
                    title="Class Point"
                    description="Students must be near this point"
                  />
                )}
              </MapView>
            )}

            <View style={{ position: 'absolute', left: 12, right: 12, bottom: 12 }}>
              <View style={{ backgroundColor: 'rgba(255,255,255,0.95)', padding: 10, borderRadius: 12 }}>
                <Text style={{ fontSize: 12, color: '#374151', textAlign: 'center', fontWeight: '500' }}>
                  {selectedLat !== null
                    ? '✅ Location locked. Tap elsewhere to change it.'
                      : '👆 Tap the building/class area on the map to lock the precence point.'}
                </Text>
              </View>
            </View>

            {!mapReady && !isLoadingMap && (
              <View style={{ position: 'absolute', top: 8, right: 8, backgroundColor: 'rgba(255,255,255,0.9)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 }}>
                <Text style={{ fontSize: 11, color: '#6B7280' }}>Map loading...</Text>
              </View>
            )}
          </View>
        </View>

        <View className="mb-8">
          <Text className="text-sm font-semibold text-gray-700 mb-3">
            Choose Class Icon
          </Text>
          <View className="flex-row flex-wrap gap-3">
            {ICONS.map((emoji, index) => (
              <TouchableOpacity
                key={index}
                onPress={() => setSelectedIcon(emoji)}
                className={`w-14 h-14 rounded-2xl justify-center items-center ${
                  selectedIcon === emoji
                    ? "bg-indigo-100 border-2 border-indigo-600"
                    : "bg-white border border-gray-200"
                }`}
              >
                <Text className="text-2xl">{emoji}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View className="bg-indigo-50 p-5 rounded-2xl border border-indigo-100 mb-10 items-center">
          <Text className="text-sm font-semibold text-indigo-800 mb-1">
            Generated Join Code
          </Text>
          <Text className="text-3xl font-black text-indigo-600 tracking-widest">
            {joinCode}
          </Text>
        </View>
        <View className="p-5 mb-10 bg-white border-t border-gray-100">
          <TouchableOpacity
            onPress={handleCreateClass}
            className="bg-indigo-600 py-4 rounded-xl items-center shadow-sm"
          >
            <Text className="text-white text-base font-bold">Create Class</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}
