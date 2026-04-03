import React from 'react';
import { ActivityIndicator, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import {
  applySearchSelection,
  centerOnDeviceLocation,
  ClassTimeSettings,
  DayOfWeekPicker,
  geocodeSearch,
  SetClassDeadline,
} from '@/src/lib/classesLib';

type ClassData = {
  id: string;
  name: string;
  owner_id: string;
  valid_until: string | null;
  description: string | null;
  icon: string | null;
  latitude: number | null;
  longitude: number | null;
  day_of_week: number[] | null;
  start_time: string | null;
  late_tolerance: number | null;
  join_code: string;
};

type SearchResult = {
  label: string;
  lat: number;
  lng: number;
};

type AnnouncementSummary = {
  id: string;
  content: string;
  created_at: string;
  author?: {
    username: string | null;
    user_tag?: string | null;
  } | null;
};

type DetailsProps = {
  canManageClass: boolean;
  isEditingClass: boolean;
  setIsEditingClass: React.Dispatch<React.SetStateAction<boolean>>;
  editClassName: string;
  setEditClassName: React.Dispatch<React.SetStateAction<string>>;
  editDescription: string;
  setEditDescription: React.Dispatch<React.SetStateAction<string>>;
  editDate: Date | null;
  setEditDate: React.Dispatch<React.SetStateAction<Date | null>>;
  selectedDays: number[];
  setSelectedDays: React.Dispatch<React.SetStateAction<number[]>>;
  startTime: Date;
  setStartTime: React.Dispatch<React.SetStateAction<Date>>;
  tolerance: string;
  setTolerance: React.Dispatch<React.SetStateAction<string>>;
  locationQuery: string;
  setLocationQuery: React.Dispatch<React.SetStateAction<string>>;
  searchResults: SearchResult[];
  setSearchResults: React.Dispatch<React.SetStateAction<SearchResult[]>>;
  googleMapsApiKey: string;
  mapRef: React.RefObject<MapView | null>;
  mapRegion: {
    latitude: number;
    longitude: number;
    latitudeDelta: number;
    longitudeDelta: number;
  };
  setMapRegion: React.Dispatch<
    React.SetStateAction<{
      latitude: number;
      longitude: number;
      latitudeDelta: number;
      longitudeDelta: number;
    }>
  >;
  selectedLat: number | null;
  selectedLng: number | null;
  setSelectedLat: React.Dispatch<React.SetStateAction<number | null>>;
  setSelectedLng: React.Dispatch<React.SetStateAction<number | null>>;
  isCentering: boolean;
  setIsCentering: React.Dispatch<React.SetStateAction<boolean>>;
  isLoadingMap: boolean;
  mapReady: boolean;
  setMapReady: React.Dispatch<React.SetStateAction<boolean>>;
  selectedIcon: string;
  setSelectedIcon: React.Dispatch<React.SetStateAction<string>>;
  icons: string[];
  isSavingClass: boolean;
  isDeletingClass: boolean;
  onSaveClassChanges: () => void;
  classData: ClassData;
  dayLabels: string;
  localSchedule: {
    localDeadline: string;
    localStartTime: string;
  };
  latestAnnouncement: AnnouncementSummary | null;
  onCopyClassCode?: () => void;
};

export function Details({
  canManageClass,
  isEditingClass,
  setIsEditingClass,
  editClassName,
  setEditClassName,
  editDescription,
  setEditDescription,
  editDate,
  setEditDate,
  selectedDays,
  setSelectedDays,
  startTime,
  setStartTime,
  tolerance,
  setTolerance,
  locationQuery,
  setLocationQuery,
  searchResults,
  setSearchResults,
  googleMapsApiKey,
  mapRef,
  mapRegion,
  setMapRegion,
  selectedLat,
  selectedLng,
  setSelectedLat,
  setSelectedLng,
  isCentering,
  setIsCentering,
  isLoadingMap,
  mapReady,
  setMapReady,
  selectedIcon,
  setSelectedIcon,
  icons,
  isSavingClass,
  isDeletingClass,
  onSaveClassChanges,
  classData,
  dayLabels,
  localSchedule,
  latestAnnouncement,
  onCopyClassCode,
}: DetailsProps) {
  const latestAnnouncementTime = latestAnnouncement?.created_at
    ? new Date(latestAnnouncement.created_at).toLocaleString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : null;

  return (
    <View className="mx-4 bg-white border border-gray-200 rounded-2xl p-4">
      {canManageClass && isEditingClass && (
        <View className="mb-6 pb-4 border-b border-gray-100">
          <View className="flex-row items-center justify-between mb-3">
            <Text className="text-base font-bold text-gray-900">Edit Class</Text>
            <TouchableOpacity onPress={() => setIsEditingClass(false)} className="px-3 py-1.5 rounded-lg bg-gray-100">
              <Text className="text-xs font-semibold text-gray-700">Close</Text>
            </TouchableOpacity>
          </View>

          <Text className="text-sm font-semibold text-gray-700 mb-2">Class Name</Text>
          <TextInput
            value={editClassName}
            onChangeText={setEditClassName}
            placeholder="e.g. Software Engineering"
            placeholderTextColor="#9CA3AF"
            className="bg-white px-4 py-3 rounded-xl border border-gray-300 text-base text-gray-900 mb-3"
          />

          <View className="mb-4">
            <SetClassDeadline setDate={setEditDate} date={editDate} />
          </View>

          <Text className="text-sm font-semibold text-gray-700 mb-2">Description</Text>
          <TextInput
            value={editDescription}
            onChangeText={setEditDescription}
            placeholder="Short description or instructions for the class"
            placeholderTextColor="#9CA3AF"
            className="bg-white px-4 py-3 rounded-xl border border-gray-300 text-base text-gray-900 mb-4"
            multiline
            numberOfLines={3}
          />

          <View className="mb-4">
            <Text className="text-sm font-semibold text-gray-700 mb-2">Day of Week *</Text>
            <DayOfWeekPicker selectedDays={selectedDays} onDaysChange={setSelectedDays} />
          </View>

          <View className="mb-4">
            <ClassTimeSettings
              startTime={startTime}
              onTimeChange={setStartTime}
              lateTolerance={tolerance}
              onToleranceChange={setTolerance}
            />
          </View>

          <View className="mb-4">
            <Text className="text-sm font-semibold text-gray-700 mb-2">Set Precence Point (Tap the map) *</Text>
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
                  onSubmitEditing={() =>
                    geocodeSearch(
                      locationQuery,
                      googleMapsApiKey,
                      setSearchResults,
                      setMapRegion,
                      setSelectedLat,
                      setSelectedLng,
                      mapRef,
                    )
                  }
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
              style={{
                height: 256,
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
                      <TouchableOpacity
                        key={idx}
                        onPress={() =>
                          applySearchSelection(
                            item,
                            setMapRegion,
                            setSelectedLat,
                            setSelectedLng,
                            setSearchResults,
                            setLocationQuery,
                            mapRef,
                          )
                        }
                        className="px-3 py-3 border-b border-gray-100"
                      >
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
                  onMapReady={() => setMapReady(true)}
                  onLayout={() => {}}
                >
                  {selectedLat !== null && selectedLng !== null && (
                    <Marker
                      coordinate={{ latitude: selectedLat, longitude: selectedLng }}
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
            <Text className="text-sm font-semibold text-gray-700 mb-3">Choose Class Icon</Text>
            <View className="flex-row flex-wrap gap-3">
              {icons.map((emoji, index) => (
                <TouchableOpacity
                  key={index}
                  onPress={() => setSelectedIcon(emoji)}
                  className={`w-14 h-14 rounded-2xl justify-center items-center ${
                    selectedIcon === emoji ? 'bg-indigo-100 border-2 border-indigo-600' : 'bg-white border border-gray-200'
                  }`}
                >
                  <Text className="text-2xl">{emoji}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <TouchableOpacity
            onPress={onSaveClassChanges}
            disabled={isSavingClass || isDeletingClass}
            className="mt-3 bg-indigo-600 py-3 rounded-xl items-center"
          >
            <Text className="text-white font-semibold">{isSavingClass ? 'Saving...' : 'Save Changes'}</Text>
          </TouchableOpacity>
        </View>
      )}

      <Text className="text-base font-bold text-gray-900 mb-2">Full Description</Text>
      <Text className="text-sm text-gray-700 leading-5">{classData.description?.trim() || 'No description yet.'}</Text>

      <View className="mt-4 border-t border-gray-100 pt-4 gap-y-2">
        <View className="flex-row items-center justify-between">
          <Text className="text-sm text-gray-600 flex-1 mr-2">
            Join Code: <Text className="font-semibold text-gray-900">{classData.join_code}</Text>
          </Text>
          {!!onCopyClassCode && (
            <TouchableOpacity
              onPress={onCopyClassCode}
              className="w-7 h-7 rounded-md bg-transparent items-center justify-center"
              accessibilityRole="button"
              accessibilityLabel="Copy class code"
            >
              <Ionicons name="copy-outline" size={14} color="#374151" />
            </TouchableOpacity>
          )}
        </View>
        <Text className="text-sm text-gray-600">
          Day(s): <Text className="font-semibold text-gray-900">{dayLabels}</Text>
        </Text>
        <Text className="text-sm text-gray-600">
          Deadline (Local): <Text className="font-semibold text-gray-900">{localSchedule.localDeadline}</Text>
        </Text>
        <Text className="text-sm text-gray-600">
          Start Time (Local): <Text className="font-semibold text-gray-900">{localSchedule.localStartTime}</Text>
        </Text>
        <Text className="text-sm text-gray-600">
          Late Tolerance: <Text className="font-semibold text-gray-900">{classData.late_tolerance ?? 0} min</Text>
        </Text>
      </View>

      <View className="mt-5 border-t border-gray-100 pt-4">
        <Text className="text-base font-bold text-gray-900 mb-2">Latest Announcement</Text>
        {latestAnnouncement ? (
          <>
            <Text className="text-sm text-gray-800 leading-5">{latestAnnouncement.content}</Text>
            <Text className="text-xs text-gray-500 mt-2">
              {latestAnnouncement.author?.username || 'Unknown author'}
              {latestAnnouncement.author?.user_tag ? ` (@${latestAnnouncement.author.user_tag})` : ''}
              {latestAnnouncementTime ? ` • ${latestAnnouncementTime}` : ''}
            </Text>
          </>
        ) : (
          <Text className="text-sm text-gray-500">No announcements yet.</Text>
        )}
      </View>

      <View className="mt-5 border-t border-gray-100 pt-4">
        <Text className="text-base font-bold text-gray-900 mb-3">Class Location</Text>
        {classData.latitude == null || classData.longitude == null ? (
          <Text className="text-sm text-gray-500">Location has not been set.</Text>
        ) : (
          <>
            <View style={{ height: 240, borderRadius: 14, overflow: 'hidden' }}>
              <MapView
                style={{ flex: 1 }}
                provider={PROVIDER_GOOGLE}
                initialRegion={{
                  latitude: classData.latitude,
                  longitude: classData.longitude,
                  latitudeDelta: 0.005,
                  longitudeDelta: 0.005,
                }}
                scrollEnabled={false}
                zoomEnabled={false}
                rotateEnabled={false}
                pitchEnabled={false}
              >
                <Marker coordinate={{ latitude: classData.latitude, longitude: classData.longitude }} title={classData.name} />
              </MapView>
            </View>
            <Text className="text-xs text-gray-600 mt-2">
              Lat: {classData.latitude.toFixed(6)} | Lng: {classData.longitude.toFixed(6)}
            </Text>
          </>
        )}
      </View>
    </View>
  );
}
