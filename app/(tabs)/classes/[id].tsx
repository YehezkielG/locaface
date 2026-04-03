import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import MapView from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import Constants from 'expo-constants';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { supabase } from '@/src/lib/supabase';
import { showPopup } from '@/src/lib/inAppPopup';
import {
  fetchUserLocation,
  setExpiry
} from '@/src/lib/classesLib';
import { Announcement } from './components/Announcement';
import { ClassHistoryContent } from './components/ClassHistoryContent';
import { Details } from './components/Details';
import { Members } from './components/Members';
import { TodaySessionContent } from './components/TodaySessionContent';

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
  is_accepting_absen?: boolean | null;
  timezone?: string | null;
};

type MemberRow = {
  user_id: string;
  role: string | null;
  joined_at: string | null;
};

type ProfileRow = {
  id: string;
  username: string | null;
  avatar_url?: string | null;
  user_tag?: string | null;
};

type AnnouncementRow = {
  id: string;
  class_id: string;
  content: string;
  created_at: string;
  instructor_id: string;
  author?: ProfileRow | null;
};

const DAY_NAME: Record<number, string> = {
  1: 'Monday',
  2: 'Tuesday',
  3: 'Wednesday',
  4: 'Thursday',
  5: 'Friday',
  6: 'Saturday',
  7: 'Sunday',
};

const BASE_TABS = [
  { key: 'overview', label: 'Details' },
  { key: 'announcement', label: 'Announcement' },
  { key: 'members', label: 'Members' },
] as const;

const ICONS: string[] = ['📐', '💻', '📊', '🔬', '🌍', '🎨', '💼', '🚀', '🤖', '📚'];

export default function ClassDetailPage() {
  const { id, tab } = useLocalSearchParams<{ id?: string; tab?: string }>();
  const classId = Array.isArray(id) ? id[0] : id;
  const requestedTab = Array.isArray(tab) ? tab[0] : tab;

  const [isLoading, setIsLoading] = useState(true);
  const [classData, setClassData] = useState<ClassData | null>(null);
  const [members, setMembers] = useState<(MemberRow & { profile?: ProfileRow | null })[]>([]);
  const [activeTab, setActiveTab] = useState<'overview' | 'announcement' | 'members' | 'history' | 'today-session'>('overview');
  const [isOwner, setIsOwner] = useState(false);
  const [isMember, setIsMember] = useState(false);
  const [currentUserRole, setCurrentUserRole] = useState<string>('');
  const [currentUserId, setCurrentUserId] = useState<string>('');
  const [announcements, setAnnouncements] = useState<AnnouncementRow[]>([]);
  const [isLoadingAnnouncements, setIsLoadingAnnouncements] = useState(false);
  const [newAnnouncementContent, setNewAnnouncementContent] = useState('');
  const [isSubmittingAnnouncement, setIsSubmittingAnnouncement] = useState(false);
  const [isEditingClass, setIsEditingClass] = useState(false);
  const [editClassName, setEditClassName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [isSavingClass, setIsSavingClass] = useState(false);
  const [isDeletingClass, setIsDeletingClass] = useState(false);
  const [isLeavingClass, setIsLeavingClass] = useState(false);
  const [removingMemberId, setRemovingMemberId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [showVeggieMenu, setShowVeggieMenu] = useState(false);

  const [selectedIcon, setSelectedIcon] = useState<string>('💻');
  const [editDate, setEditDate] = useState<Date | null>(null);
  const [selectedDays, setSelectedDays] = useState<number[]>([]);
  const [startTime, setStartTime] = useState<Date>(new Date());
  const [tolerance, setTolerance] = useState<string>('15');
  const [selectedLat, setSelectedLat] = useState<number | null>(null);
  const [selectedLng, setSelectedLng] = useState<number | null>(null);
  const [isLoadingMap, setIsLoadingMap] = useState<boolean>(false);
  const [mapReady, setMapReady] = useState<boolean>(false);
  const [locationQuery, setLocationQuery] = useState<string>('');
  const [isCentering, setIsCentering] = useState<boolean>(false);
  const [searchResults, setSearchResults] = useState<{ label: string; lat: number; lng: number }[]>([]);
  const mapRef = useRef<MapView | null>(null);

  const googleMapsApiKey =
    process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ||
    Constants.expoConfig?.android?.config?.googleMaps?.apiKey ||
    '';

  const [mapRegion, setMapRegion] = useState({
    latitude: 3.5952,
    longitude: 98.6722,
    latitudeDelta: 0.0025,
    longitudeDelta: 0.0025,
  });

  const canManageClass = isOwner || currentUserRole === 'instructor';
  const canCreateAnnouncement = currentUserRole === 'instructor';
  const isClassSessionActive = classData?.is_accepting_absen === true;

  const tabs = useMemo(() => {
    if (canManageClass) {
      const managerTabs: { key: 'overview' | 'announcement' | 'members' | 'history' | 'today-session'; label: string }[] = [
        { key: 'overview', label: 'Details' },
      ];
      if (isClassSessionActive) {
        managerTabs.push({ key: 'today-session', label: 'Today Session' });
      }
      managerTabs.push(
        { key: 'announcement', label: 'Announcement' },
        { key: 'members', label: 'Members' },
      );
      managerTabs.push({ key: 'history', label: 'Presence Recap' });
      return managerTabs;
    }
    return BASE_TABS;
  }, [canManageClass, isClassSessionActive]);

  useEffect(() => {
    const availableKeys = tabs.map((item) => item.key);
    if (!availableKeys.includes(activeTab as any)) {
      setActiveTab('overview');
    }
  }, [activeTab, tabs]);

  const loadAnnouncements = useCallback(async () => {
    if (!classId) return;

    setIsLoadingAnnouncements(true);
    try {
      const { data: announcementRows, error: announcementError } = await supabase
        .from('announcements')
        .select('id, class_id, content, created_at, instructor_id')
        .eq('class_id', classId)
        .order('created_at', { ascending: false });

      if (announcementError) throw announcementError;

      const safeAnnouncements: AnnouncementRow[] = (announcementRows || []) as AnnouncementRow[];
      const instructorIds = Array.from(new Set(safeAnnouncements.map((item) => item.instructor_id))).filter(Boolean);

      let authorById: Record<string, ProfileRow> = {};
      if (instructorIds.length > 0) {
        const { data: profileRows } = await supabase
          .from('profiles')
          .select('id, username, avatar_url, user_tag')
          .in('id', instructorIds);

        authorById = (profileRows || []).reduce((acc: Record<string, ProfileRow>, profile: ProfileRow) => {
          acc[profile.id] = profile;
          return acc;
        }, {});
      }

      setAnnouncements(
        safeAnnouncements.map((item) => ({
          ...item,
          author: authorById[item.instructor_id] || null,
        })),
      );
    } catch {
      showPopup({ title: 'Announcement', message: 'Failed to load announcements.', type: 'error' });
    } finally {
      setIsLoadingAnnouncements(false);
    }
  }, [classId]);

  const loadClassDetail = useCallback(async () => {
    if (!classId) return;

    setIsLoading(true);
    try {
      const { data: authData, error: authError } = await supabase.auth.getUser();
      const user = authData?.user;

      if (authError || !user) {
        showPopup({ title: 'Session', message: 'Please login again.', type: 'warning' });
        router.replace('/auth');
        return;
      }

      const { data: classRow, error: classError } = await supabase
        .from('classes')
        .select('id, name, owner_id, valid_until, description, icon, latitude, longitude, day_of_week, start_time, late_tolerance, join_code, is_accepting_absen')
        .eq('id', classId)
        .single();

      if (classError || !classRow) {
        showPopup({ title: 'Class', message: 'Class detail not found.', type: 'error' });
        router.back();
        return;
      }

      const { data: memberRows, error: memberError } = await supabase
        .from('class_members')
        .select('user_id, role, joined_at')
        .eq('class_id', classId)
        .order('joined_at', { ascending: true });

      if (memberError) {
        showPopup({ title: 'Class', message: 'Failed to load class members.', type: 'error' });
      }

      const safeMembers: MemberRow[] = memberRows || [];
      const userIds = Array.from(new Set(safeMembers.map((item) => item.user_id)));

      let profileById: Record<string, ProfileRow> = {};
      if (userIds.length > 0) {
        const { data: profileRows } = await supabase
          .from('profiles')
          .select('id, username, avatar_url, user_tag')
          .in('id', userIds);

        profileById = (profileRows || []).reduce((acc: Record<string, ProfileRow>, profile: ProfileRow) => {
          acc[profile.id] = profile;
          return acc;
        }, {});
      }

      const mergedMembers = safeMembers.map((member) => ({
        ...member,
        profile: profileById[member.user_id] || null,
      }));

      const currentMember = mergedMembers.find((item) => item.user_id === user.id);
      const normalizedRole = (currentMember?.role || '').toLowerCase();

      setClassData(classRow as ClassData);
      setMembers(mergedMembers);
      setIsOwner(classRow.owner_id === user.id);
      setIsMember(mergedMembers.some((item) => item.user_id === user.id));
      setCurrentUserRole(normalizedRole);
      setCurrentUserId(user.id);
      setEditClassName(classRow.name || '');
      setEditDescription(classRow.description || '');
      setSelectedIcon(classRow.icon || '💻');
      setEditDate(classRow.valid_until ? new Date(classRow.valid_until) : null);
      setSelectedDays(Array.isArray(classRow.day_of_week) ? classRow.day_of_week.map((day: number) => Number(day)).filter((day: number) => Number.isFinite(day)) : []);
      const parsedTime = new Date();
      if (classRow.start_time) {
        const [hourText, minuteText] = classRow.start_time.split(':');
        parsedTime.setHours(Number(hourText), Number(minuteText), 0, 0);
      }
      setStartTime(parsedTime);
      setTolerance(String(classRow.late_tolerance ?? 15));
      setSelectedLat(classRow.latitude);
      setSelectedLng(classRow.longitude);
      if (typeof classRow.latitude === 'number' && typeof classRow.longitude === 'number') {
        setMapRegion({
          latitude: classRow.latitude,
          longitude: classRow.longitude,
          latitudeDelta: 0.0025,
          longitudeDelta: 0.0025,
        });
      }
      setIsEditingClass(false);
      setConfirmDelete(false);
      setShowVeggieMenu(false);
      await loadAnnouncements();
    } catch {
      showPopup({ title: 'Error', message: 'An unexpected error occurred.', type: 'error' });
    } finally {
      setIsLoading(false);
    }
  }, [classId, loadAnnouncements]);

  useEffect(() => {
    loadClassDetail();
  }, [loadClassDetail]);

  useFocusEffect(
    useCallback(() => {
      loadClassDetail();
    }, [loadClassDetail]),
  );

  useEffect(() => {
    if (!requestedTab) return;
    const normalizedTab = String(requestedTab).toLowerCase();

    if (normalizedTab === 'today-session' && isClassSessionActive && canManageClass) {
      setActiveTab('today-session');
      return;
    }

    if (normalizedTab === 'history' && canManageClass) {
      setActiveTab('history');
    }
  }, [canManageClass, isClassSessionActive, requestedTab]);

  const dayLabels = useMemo(() => {
    if (!classData?.day_of_week || classData.day_of_week.length === 0) return '-';
    return classData.day_of_week
      .map((num) => DAY_NAME[Number(num)] || String(num))
      .join(', ');
  }, [classData]);

  const localSchedule = useMemo(() => {
    if (!classData?.valid_until || !classData.start_time) {
      return { localDeadline: '-', localStartTime: classData?.start_time || '-' };
    }

    // Parse as local time directly (no server offset conversion needed)
    const deadlineDate = new Date(classData.valid_until);
    const [hourText, minuteText] = classData.start_time.split(':');
    const startTimeDate = new Date();
    startTimeDate.setHours(Number(hourText), Number(minuteText), 0, 0);

    return {
      localDeadline: deadlineDate.toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      }),
      localStartTime: startTimeDate.toLocaleTimeString(undefined, {
        hour: '2-digit',
        minute: '2-digit',
      }),
    };
  }, [classData]);

  const handleStartPresence = () => {
    if (isOwner) {
      showPopup({
        title: 'Precence',
        message: 'Class owners cannot take precence in their own class.',
        type: 'warning',
      });
      return;
    }

    if (!classData?.id || classData.latitude == null || classData.longitude == null) {
      showPopup({
        title: 'Start Presence',
        message: 'Class location is unavailable.',
        type: 'warning',
      });
      return;
    }

    router.push({
      pathname: '/classes/start-precence',
      params: {
        classId: String(classData.id),
        className: String(classData.name || ''),
        classLat: String(classData.latitude),
        classLng: String(classData.longitude),
      },
    });
  };

  const handleCopyClassCode = useCallback(async () => {
    const code = classData?.join_code?.trim();
    if (!code) {
      showPopup({ title: 'Class', message: 'Class code is unavailable.', type: 'warning' });
      return;
    }

    try {
      await Clipboard.setStringAsync(code);
      showPopup({ title: 'Class Code', message: 'Class code copied to clipboard.', type: 'success' });
    } catch {
      showPopup({ title: 'Class Code', message: 'Failed to copy class code.', type: 'error' });
    }
  }, [classData?.join_code]);

  useEffect(() => {
    if (isEditingClass && (selectedLat == null || selectedLng == null)) {
      fetchUserLocation(setIsLoadingMap, setMapRegion);
    }
  }, [isEditingClass, selectedLat, selectedLng]);

  const handleSaveClassChanges = async () => {
    if (!classData?.id) return;

    if (!editClassName.trim()) {
      showPopup({ title: 'Validation', message: 'Class name cannot be empty.', type: 'warning' });
      return;
    }

    try {
      setIsSavingClass(true);

      const validUntil = editDate ? setExpiry(editDate) : null;
       const startTimeStr = startTime
        ? `${String(startTime.getHours()).padStart(2, '0')}:${String(startTime.getMinutes()).padStart(2, '0')}`
        : null;
      const lateToleranceInt = tolerance ? parseInt(tolerance, 10) : 0;

      if (selectedLat === null || selectedLng === null) {
        showPopup({
          title: 'Validation',
          message: 'Please tap the map to select the building/class location!',
          type: 'warning',
        });
        return;
      }

      const { error } = await supabase
        .from('classes')
        .update({
          name: editClassName.trim(),
          icon: selectedIcon,
          valid_until: validUntil,
          day_of_week: selectedDays,
          start_time: startTimeStr,
          late_tolerance: lateToleranceInt,
          latitude: selectedLat,
          longitude: selectedLng,
          description: editDescription.trim() || null,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        })
        .eq('id', classData.id);

      if (error) throw error;

      showPopup({ title: 'Success', message: 'Class updated successfully.', type: 'success' });
      setIsEditingClass(false);
      await loadClassDetail();
    } catch (error: any) {
      showPopup({ title: 'Error', message: error?.message || 'Failed to update class.', type: 'error' });
    } finally {
      setIsSavingClass(false);
    }
  };

  const handleDeleteClass = async () => {
    if (!classData?.id) return;

    if (!confirmDelete) {
      setConfirmDelete(true);
      showPopup({
        title: 'Confirm Deletion',
        message: 'Tap Delete Class once again to permanently remove this class.',
        type: 'warning',
      });
      return;
    }

    try {
      setIsDeletingClass(true);

      const { error: deleteMembersError } = await supabase
        .from('class_members')
        .delete()
        .eq('class_id', classData.id);

      if (deleteMembersError) throw deleteMembersError;

      const { error: deleteClassError } = await supabase
        .from('classes')
        .delete()
        .eq('id', classData.id);

      if (deleteClassError) throw deleteClassError;

      showPopup({ title: 'Success', message: 'Class deleted successfully.', type: 'success' });
      router.replace('/classes');
    } catch (error: any) {
      showPopup({ title: 'Error', message: error?.message || 'Failed to delete class.', type: 'error' });
      setConfirmDelete(false);
    } finally {
      setIsDeletingClass(false);
    }
  };

  const handleOpenEditFromMenu = () => {
    setShowVeggieMenu(false);
    setIsEditingClass(true);
    setConfirmDelete(false);
  };

  const handleDeleteFromMenu = async () => {
    setShowVeggieMenu(false);
    await handleDeleteClass();
  };

  const handleLeaveClass = useCallback(() => {
    if (!classData?.id || !currentUserId) return;

    Alert.alert(
      'Leave Class',
      'Are you sure you want to leave this class?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Leave',
          style: 'destructive',
          onPress: async () => {
            try {
              setIsLeavingClass(true);

              const { error } = await supabase
                .from('class_members')
                .delete()
                .eq('class_id', classData.id)
                .eq('user_id', currentUserId);

              if (error) throw error;

              showPopup({ title: 'Class', message: 'You have left this class.', type: 'success' });
              router.replace('/classes');
            } catch (error: any) {
              showPopup({ title: 'Class', message: error?.message || 'Failed to leave class.', type: 'error' });
            } finally {
              setIsLeavingClass(false);
            }
          },
        },
      ],
    );
  }, [classData?.id, currentUserId]);

  const handleRemoveMember = useCallback((targetUserId: string, targetName?: string | null) => {
    if (!classData?.id || !canManageClass) return;
    if (!targetUserId || targetUserId === classData.owner_id) return;

    const displayName = targetName?.trim() || 'this member';
    Alert.alert(
      'Remove Member',
      `Remove ${displayName} from this class?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              setRemovingMemberId(targetUserId);

              const { error } = await supabase
                .from('class_members')
                .delete()
                .eq('class_id', classData.id)
                .eq('user_id', targetUserId);

              if (error) throw error;

              showPopup({ title: 'Class', message: `${displayName} has been removed from class.`, type: 'success' });
              await loadClassDetail();
            } catch (error: any) {
              showPopup({ title: 'Class', message: error?.message || 'Failed to remove member.', type: 'error' });
            } finally {
              setRemovingMemberId(null);
            }
          },
        },
      ],
    );
  }, [canManageClass, classData?.id, classData?.owner_id, loadClassDetail]);

  const handleCreateAnnouncement = async () => {
    if (!classData?.id) return;
    if (!canCreateAnnouncement) {
      showPopup({ title: 'Announcement', message: 'Only instructors can post announcements.', type: 'warning' });
      return;
    }

    const content = newAnnouncementContent.trim();
    if (!content) {
      showPopup({ title: 'Validation', message: 'Announcement content cannot be empty.', type: 'warning' });
      return;
    }

    try {
      setIsSubmittingAnnouncement(true);

      let authorId = currentUserId;
      if (!authorId) {
        const { data: authData } = await supabase.auth.getUser();
        authorId = authData?.user?.id || '';
      }

      if (!authorId) {
        showPopup({ title: 'Session', message: 'Please login again.', type: 'warning' });
        router.replace('/auth');
        return;
      }

      const { error } = await supabase.from('announcements').insert({
        class_id: classData.id,
        content,
        instructor_id: authorId,
      });

      if (error) throw error;

      setNewAnnouncementContent('');
      showPopup({ title: 'Success', message: 'Announcement posted.', type: 'success' });
      await loadAnnouncements();
    } catch (error: any) {
      showPopup({ title: 'Error', message: error?.message || 'Failed to post announcement.', type: 'error' });
    } finally {
      setIsSubmittingAnnouncement(false);
    }
  };

  const latestAnnouncement = useMemo(() => {
    if (announcements.length === 0) return null;
    return announcements[0];
  }, [announcements]);

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <ActivityIndicator size="large" />
        <Text className="text-sm text-gray-500 mt-3">Loading class detail...</Text>
      </View>
    );
  }

  if (!classData) {
    return (
      <View className="flex-1 items-center justify-center bg-white px-6">
        <Text className="text-base font-semibold text-gray-800">Class data is unavailable.</Text>
        <TouchableOpacity onPress={() => router.back()} className="mt-4 px-4 py-2 rounded-lg bg-indigo-600">
          <Text className="text-white font-semibold">Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-white">
      <View className="flex-row items-center px-5 py-4 border-b border-gray-200">
        <TouchableOpacity onPress={() => router.back()} className="mr-4">
          <Ionicons name="arrow-back" size={24} color="#111827" />
        </TouchableOpacity>
        <Text className="text-xl font-bold text-gray-900 flex-1" numberOfLines={1}>
          {classData.icon || '📚'} {classData.name}
        </Text>

        {canManageClass && (
          <View className="relative">
            <TouchableOpacity
              onPress={() => setShowVeggieMenu((prev) => !prev)}
              className="px-2 py-1 rounded-lg"
            >
              <Ionicons name="ellipsis-vertical" size={20} color="#111827" />
            </TouchableOpacity>

            {showVeggieMenu && (
              <View className="absolute right-0 top-10 bg-white border border-gray-200 rounded-xl shadow-md z-50 min-w-44">
                <TouchableOpacity
                  onPress={handleOpenEditFromMenu}
                  className="px-4 py-3 flex-row items-center border-b border-gray-100"
                >
                  <Ionicons name="create-outline" size={16} color="#4F46E5" />
                  <Text className="ml-2 text-sm font-semibold text-gray-800">Edit Class</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleDeleteFromMenu}
                  className="px-4 py-3 flex-row items-center"
                >
                  <Ionicons name="trash-outline" size={16} color="#DC2626" />
                  <Text className="ml-2 text-sm font-semibold text-red-600">
                    {confirmDelete ? 'Tap Again to Delete' : 'Delete Class'}
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}
      </View>

      <ScrollView className="flex-1" contentContainerStyle={{ paddingVertical: 16, paddingBottom: 28 }}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          className="border-b border-gray-200 mb-4"
          contentContainerStyle={{ paddingHorizontal: 16 }}
        >
          {tabs.map((tab) => {
            const selected = activeTab === tab.key;
            return (
              <TouchableOpacity
                key={tab.key}
                onPress={() => setActiveTab(tab.key)}
                className={`mr-8 py-3 border-b-2 ${selected ? 'border-indigo-500' : 'border-transparent'}`}
              >
                <Text className={`${selected ? 'text-indigo-500' : 'text-gray-900'} text-base font-semibold`}>
                  {tab.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {activeTab === 'overview' && (
          <Details
            canManageClass={canManageClass}
            isEditingClass={isEditingClass}
            setIsEditingClass={setIsEditingClass}
            editClassName={editClassName}
            setEditClassName={setEditClassName}
            editDescription={editDescription}
            setEditDescription={setEditDescription}
            editDate={editDate}
            setEditDate={setEditDate}
            selectedDays={selectedDays}
            setSelectedDays={setSelectedDays}
            startTime={startTime}
            setStartTime={setStartTime}
            tolerance={tolerance}
            setTolerance={setTolerance}
            locationQuery={locationQuery}
            setLocationQuery={setLocationQuery}
            searchResults={searchResults}
            setSearchResults={setSearchResults}
            googleMapsApiKey={googleMapsApiKey}
            mapRef={mapRef}
            mapRegion={mapRegion}
            setMapRegion={setMapRegion}
            selectedLat={selectedLat}
            selectedLng={selectedLng}
            setSelectedLat={setSelectedLat}
            setSelectedLng={setSelectedLng}
            isCentering={isCentering}
            setIsCentering={setIsCentering}
            isLoadingMap={isLoadingMap}
            mapReady={mapReady}
            setMapReady={setMapReady}
            selectedIcon={selectedIcon}
            setSelectedIcon={setSelectedIcon}
            icons={ICONS}
            isSavingClass={isSavingClass}
            isDeletingClass={isDeletingClass}
            onSaveClassChanges={handleSaveClassChanges}
            classData={classData}
            dayLabels={dayLabels}
            localSchedule={localSchedule}
            latestAnnouncement={latestAnnouncement}
            onCopyClassCode={handleCopyClassCode}
          />
        )}

        {activeTab === 'announcement' && (
          <Announcement
            announcements={announcements}
            isLoading={isLoadingAnnouncements}
            canCreate={canCreateAnnouncement}
            content={newAnnouncementContent}
            setContent={setNewAnnouncementContent}
            isSubmitting={isSubmittingAnnouncement}
            onCreate={handleCreateAnnouncement}
          />
        )}

        {activeTab === 'members' && (
          <Members
            members={members}
            ownerId={classData.owner_id}
            currentUserId={currentUserId}
            canManageClass={canManageClass}
            isRemovingMemberId={removingMemberId}
            onRemoveMember={handleRemoveMember}
            canLeaveClass={currentUserRole === 'member'}
            isLeavingClass={isLeavingClass}
            onLeaveClass={handleLeaveClass}
          />
        )}

        {activeTab === 'today-session' && canManageClass && isClassSessionActive && (
          <TodaySessionContent classId={classData.id} className={classData.name || ''} members={members} />
        )}

        {activeTab === 'history' && isOwner && (
          <ClassHistoryContent classId={classData.id} className={classData.name || ''} />
        )}
      </ScrollView>

      {!isOwner && isMember && (
        <View className="p-4 border-t border-gray-200 bg-white">
          <TouchableOpacity onPress={handleStartPresence} className="bg-indigo-600 py-3.5 rounded-xl items-center">
            <Text className="text-white font-bold text-base">Start Presence</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}