import { useState } from "react";
import { View, Text, TouchableOpacity, Platform,TextInput, ScrollView } from "react-native";
import { Region } from 'react-native-maps';
import DateTimePicker from "@react-native-community/datetimepicker";
import * as Location from 'expo-location';
import { showPopup } from "@/src/lib/inAppPopup";
import { supabase } from "@/src/lib/supabase";

const MAP_CLOSE_DELTA = 0.0025;

export const generateJoinCode = (setJoinCode: React.Dispatch<React.SetStateAction<string>>) => {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let code = "";
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setJoinCode(code);
};

export const parseClassDateParts = (dateText: string) => {
  const [yearText, monthText, dayText] = dateText.split('-');
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return null;
  return { year, month, day };
};

export const parseClassTimeParts = (timeText: string) => {
  const [hourText, minuteText, secondText = '00'] = timeText.split(':');
  const hour = Number(hourText);
  const minute = Number(minuteText);
  const second = Number(secondText);
  if (!Number.isFinite(hour) || !Number.isFinite(minute) || !Number.isFinite(second)) return null;
  return { hour, minute, second };
};

const formatDate = (d: Date) => d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

export function SetClassDeadline({ setDate, date }: { setDate: React.Dispatch<React.SetStateAction<Date | null>>; date: Date | null }) {
  const [show, setShow] = useState(false);

  const onChange = (event: any, selectedDate?: Date) => {
    setShow(false);
    if (selectedDate) {
      setDate(selectedDate);
    }
  };
  
  return (
    <>
      <Text className="text-sm font-semibold text-gray-700 mb-2">
        Class Deadline
      </Text>
      <View className="flex-row items-center gap-3">
        <TouchableOpacity onPress={() => setShow(true)} className="flex-1">
          <View className="bg-white px-4 py-3.5 rounded-xl border border-gray-300">
            <Text className="text-base text-gray-900">
              {date ? formatDate(date) : "Deadline (optional)"}
            </Text>
          </View>
        </TouchableOpacity>

        {/* Clear deadline button (optional) */}
        <TouchableOpacity
          onPress={() => setDate(null)}
          className="bg-white px-3 py-3 rounded-xl border border-gray-200"
        >
          <Text className="text-sm text-gray-700">Clear</Text>
        </TouchableOpacity>
      </View>

      {show && (
        <DateTimePicker
          value={date || new Date()}
          mode="date" // calendar mode
          display="default"
          minimumDate={new Date()} // prevent choosing past dates
          onChange={onChange}
        />
      )}
    </>
  );
}

// Helper: fetch device location and set map region
export async function fetchUserLocation(
  setIsLoadingMap: React.Dispatch<React.SetStateAction<boolean>>,
  setMapRegion: React.Dispatch<React.SetStateAction<Region | null | any>>,
) {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== "granted") {
      setIsLoadingMap(false);
      return null;
    }

    const location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Highest });
    const currentRegion = {
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
      latitudeDelta: MAP_CLOSE_DELTA,
      longitudeDelta: MAP_CLOSE_DELTA,
    };
    setMapRegion(currentRegion);
    return currentRegion;
  } catch {
    return null;
  } finally {
    setIsLoadingMap(false);
  }
}

// Helper: geocode search using Google Geocoding API and populate results
export async function geocodeSearch(
  query: string,
  apiKey: string,
  setSearchResults: React.Dispatch<React.SetStateAction<{label: string; lat: number; lng: number}[]>>,
  setMapRegion: React.Dispatch<React.SetStateAction<Region | any>>,
  setSelectedLat: React.Dispatch<React.SetStateAction<number | null>>,
  setSelectedLng: React.Dispatch<React.SetStateAction<number | null>>,
  mapRef: React.RefObject<any>,
) {
  if (!query) {
    showPopup({ title: 'Validation', message: 'Enter a location to search.', type: 'warning' });
    return;
  }
  if (!apiKey) {
    showPopup({ title: 'Google Maps API key missing', message: 'Set EXPO_PUBLIC_GOOGLE_MAPS_API_KEY in .env', type: 'error' });
    return;
  }

  try {
    const endpoint = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(query)}&key=${apiKey}`;
    const response = await fetch(endpoint);
    const data = await response.json();

    if (!response.ok || data?.status !== 'OK' || !data?.results?.length) {
      showPopup({ title: 'Location not found', message: 'Try a more specific query.', type: 'warning' });
      return;
    }

    const results = data.results.map((r: any) => ({
      label: r.formatted_address as string,
      lat: r.geometry.location.lat as number,
      lng: r.geometry.location.lng as number,
    }));
    setSearchResults(results);
    const first = results[0];
    const nextRegion: Region = {
      latitude: first.lat,
      longitude: first.lng,
      latitudeDelta: MAP_CLOSE_DELTA,
      longitudeDelta: MAP_CLOSE_DELTA,
    };
    setMapRegion(nextRegion);
    setSelectedLat(first.lat);
    setSelectedLng(first.lng);
    mapRef.current?.animateToRegion(nextRegion, 700);
  } catch {
    showPopup({ title: 'Error', message: 'An error occurred while searching for the location.', type: 'error' });
  }
}

// Helper: center on device location
export async function centerOnDeviceLocation(
  setIsCentering: React.Dispatch<React.SetStateAction<boolean>>,
  setMapRegion: React.Dispatch<React.SetStateAction<Region | any>>,
  setSelectedLat: React.Dispatch<React.SetStateAction<number | null>>,
  setSelectedLng: React.Dispatch<React.SetStateAction<number | null>>,
  mapRef: React.RefObject<any>,
) {
  try {
    setIsCentering(true);
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      showPopup({ title: 'Permission denied', message: 'Location permission is required to center the map on your device.', type: 'warning' });
      return;
    }
    const location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Highest });
    const region: Region = {
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
      latitudeDelta: MAP_CLOSE_DELTA,
      longitudeDelta: MAP_CLOSE_DELTA,
    };
    setMapRegion(region);
    setSelectedLat(location.coords.latitude);
    setSelectedLng(location.coords.longitude);
    mapRef.current?.animateToRegion(region, 700);
  } catch {
    showPopup({ title: 'Error', message: 'Unable to get your current location.', type: 'error' });
  } finally {
    setIsCentering(false);
  }
}

// Helper: apply a selected search result
export function applySearchSelection(
  item: {label: string; lat: number; lng: number},
  setMapRegion: React.Dispatch<React.SetStateAction<Region | any>>,
  setSelectedLat: React.Dispatch<React.SetStateAction<number | null>>,
  setSelectedLng: React.Dispatch<React.SetStateAction<number | null>>,
  setSearchResults: React.Dispatch<React.SetStateAction<{label: string; lat: number; lng: number}[]>>,
  setLocationQuery: React.Dispatch<React.SetStateAction<string>>,
  mapRef: React.RefObject<any>,
) {
  const nextRegion: Region = {
    latitude: item.lat,
    longitude: item.lng,
    latitudeDelta: MAP_CLOSE_DELTA,
    longitudeDelta: MAP_CLOSE_DELTA,
  };
  setMapRegion(nextRegion);
  setSelectedLat(item.lat);
  setSelectedLng(item.lng);
  setSearchResults([]);
  setLocationQuery(item.label);
  mapRef.current?.animateToRegion(nextRegion, 700);
}

interface DayOfWeekPickerProps {
  selectedDays: number[]; 
  onDaysChange: (days: number[]) => void; 
}

const DAYS = [
  { id: 1, label: 'Monday', short: 'Mon' },
  { id: 2, label: 'Tuesday', short: 'Tue' },
  { id: 3, label: 'Wednesday', short: 'Wed' },
  { id: 4, label: 'Thursday', short: 'Thu' },
  { id: 5, label: 'Friday', short: 'Fri' },
  { id: 6, label: 'Saturday', short: 'Sat' },
  { id: 7, label: 'Sunday', short: 'Sun' },
];

export  function DayOfWeekPicker({ selectedDays, onDaysChange }: DayOfWeekPickerProps) {
  const toggleDay = (id: number) => {
    if (selectedDays.includes(id)) {
      onDaysChange(selectedDays.filter((dayId) => dayId !== id));
    } else {
      const newDays = [...selectedDays, id].sort((a, b) => a - b);
      onDaysChange(newDays);
    }
  };

  return (
    <View className="my-4">
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ alignItems: 'center' }}>
        {DAYS.map((day, idx) => {
          const isSelected = selectedDays.includes(day.id);

          return (
            <TouchableOpacity
              key={day.id}
              activeOpacity={0.7}
              onPress={() => toggleDay(day.id)}
              className={`px-4 py-2 rounded-full border ${
                isSelected ? 'bg-indigo-500 border-indigo-500' : 'bg-white border-gray-300'
              } ${idx < DAYS.length - 1 ? 'mr-2' : ''}`}
            >
              <Text
                className={`font-semibold ${isSelected ? 'text-white' : 'text-gray-600'}`}>
                {day.short}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

interface ClassTimeProps {
  startTime: Date;
  onTimeChange: (time: Date) => void;
  lateTolerance: string; // Pakai string dulu di UI biar gampang diketik
  onToleranceChange: (tolerance: string) => void;
}

export function ClassTimeSettings({ startTime, onTimeChange, lateTolerance, onToleranceChange }: ClassTimeProps) {
  const [showTimePicker, setShowTimePicker] = useState(false);

  const handleTimeChange = (event: any, selectedTime?: Date) => {
    setShowTimePicker(Platform.OS === 'ios'); 
    if (selectedTime) {
      onTimeChange(selectedTime);
    }
  };
  return <View className="my-4 flex-row justify-between items-start gap-4">
      
      {/* 2. Start Time Picker (Left Side) */}
      <View className="flex-1">
        <Text className="text-sm font-bold text-gray-800 mb-2">
          Start Time *
        </Text>
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => setShowTimePicker(true)}
          className="bg-white border border-gray-300 rounded-xl px-4 py-3 items-center"
        >
          <Text className="text-gray-800 font-semibold">
            {/* Format jam ke HH:MM */}
            {startTime.toLocaleTimeString('en-US', {
              hour: '2-digit',
              minute: '2-digit',
              hour12: false, // Pakai format 24 jam biar jelas
            })}
          </Text>
        </TouchableOpacity>

        {showTimePicker && (
          <DateTimePicker
            value={startTime}
            mode="time" // Mode Jam, bukan kalender
            is24Hour={true}
            display="default"
            onChange={handleTimeChange}
          />
        )}
      </View>
      <View className="flex-1">
        <Text className="text-sm font-bold text-gray-800 mb-2">
          Late Tolerance (Min) *
        </Text>
        <TextInput
          className="bg-white border border-gray-300 rounded-xl px-4 py-3 text-gray-800 font-semibold text-center"
          keyboardType="numeric" // Memaksa keyboard angka keluar
          maxLength={3} 
          value={lateTolerance}
          onChangeText={(text) => {
            // Filter hanya angka yang bisa diketik
            const numericValue = text.replace(/[^0-9]/g, '');
            onToleranceChange(numericValue);
          }}
          placeholder="e.g. 15"
          placeholderTextColor="#9ca3af"
        />
      </View>
    </View>
}

export const fetchMyClasses = async () => {
  try {
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) throw new Error("User not authenticated");

    const { data, error } = await supabase
      .from('class_members')
      .select(`
        role,
        joined_at,
        class:classes (
          id,
          name,
          icon,
          description,
          valid_until,
          day_of_week,
          start_time,
          is_accepting_absen,
          latitude,
          longitude,
          join_code
        )
      `)
      .eq('user_id', user.id)
      .order('joined_at', { ascending: false });
      
    if (error) throw error;
    return data;
    
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error("Error fetching classes:", message);
    return null;
  }
};

export const joinClassByCode = async (rawCode: string) => {
  const code = rawCode.trim().toUpperCase();

  if (code.length !== 6) {
    return { success: false, message: 'Class code must be 6 characters.' };
  }

  try {
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return { success: false, message: 'User is not logged in.' };
    }

    const { data: classData, error: classError } = await supabase
      .from('classes')
      .select('id, name')
      .eq('join_code', code)
      .single();

    if (classError || !classData) {
      return { success: false, message: 'Class code not found.' };
    }

    const { data: existingMember, error: existingError } = await supabase
      .from('class_members')
      .select('id')
      .eq('class_id', classData.id)
      .eq('user_id', user.id)
      .maybeSingle();

    if (existingError) {
      return { success: false, message: 'Failed to check class membership.' };
    }

    if (existingMember) {
      return { success: false, message: 'You are already enrolled in this class.' };
    }

    const { error: insertError } = await supabase
      .from('class_members')
      .insert({
        class_id: classData.id,
        user_id: user.id,
        role: 'member',
      });

    if (insertError) {
      return { success: false, message: 'Failed to join class. Please try again.' };
    }
    return { success: true, message: `Successfully joined class ${classData.name}.` };
  } catch {
    return { success: false, message: 'An error occurred while joining class.' };
  }
};

export const setExpiry = (selectedDate: Date) => {
  // Paksa ke akhir hari (jam 23:59:59 malam)
  const endOfDay = new Date(selectedDate);
  endOfDay.setHours(23, 59, 59, 999);
  // Kirim ke database (Otomatis jadi UTC)
  const expiryUTC = endOfDay.toISOString(); 
  // Contoh: 30 Juni 23:59 WIB -> 30 Juni 16:59 UTC
  return expiryUTC;
};

