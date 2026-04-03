import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Image, Modal, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { supabase } from '@/src/lib/supabase';
import { showPopup } from '@/src/lib/inAppPopup';
import { resolveAttendanceProofUrl } from '@/src/lib/attendanceProof';

type AttendanceStatus = 'present' | 'late' | 'excused' | 'absent' | 'rejected' | string;

type AttendanceRow = {
  id: string;
  class_id: string;
  status: AttendanceStatus;
  presence_at: string;
  rejection_reason: string | null;
  photo_url: string | null;
};

type ClassRow = {
  id: string;
  name: string | null;
};

const statusBadgeClass = (status: AttendanceStatus) => {
  if (status === 'present') return 'bg-emerald-100 text-emerald-700';
  if (status === 'late') return 'bg-amber-100 text-amber-700';
  if (status === 'excused') return 'bg-sky-100 text-sky-700';
  if (status === 'absent') return 'bg-gray-100 text-gray-700';
  if (status === 'rejected') return 'bg-rose-100 text-rose-700';
  return 'bg-gray-100 text-gray-700';
};

export default function HistoryPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [records, setRecords] = useState<AttendanceRow[]>([]);
  const [classById, setClassById] = useState<Record<string, ClassRow>>({});
  const [proofPreviewUrl, setProofPreviewUrl] = useState<string | null>(null);
  const [isProofModalVisible, setIsProofModalVisible] = useState(false);
  const [isProofLoading, setIsProofLoading] = useState(false);
  const [proofLoadError, setProofLoadError] = useState<string | null>(null);

  const loadMyAttendanceHistory = useCallback(async (refresh = false) => {
    try {
      if (refresh) setIsRefreshing(true);
      else setIsLoading(true);

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user?.id) {
        router.replace('/auth');
        return;
      }

      const { data: attendanceRows, error: attendanceError } = await supabase
        .from('attendances')
        .select('id, class_id, status, presence_at, rejection_reason, photo_url')
        .eq('user_id', user.id)
        .order('presence_at', { ascending: false });

      if (attendanceError) throw attendanceError;

      const safeRows = (attendanceRows || []) as AttendanceRow[];
      setRecords(safeRows);

      const classIds = Array.from(new Set(safeRows.map((item) => item.class_id))).filter(Boolean);
      if (classIds.length === 0) {
        setClassById({});
        return;
      }

      const { data: classRows, error: classError } = await supabase
        .from('classes')
        .select('id, name')
        .in('id', classIds);

      if (classError) throw classError;

      const mapped = (classRows || []).reduce((acc: Record<string, ClassRow>, item: ClassRow) => {
        acc[item.id] = item;
        return acc;
      }, {});

      setClassById(mapped);
    } catch (error: any) {
      showPopup({
        title: 'History',
        message: error?.message || 'Failed to load your precence history.',
        type: 'error',
      });
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadMyAttendanceHistory();
  }, [loadMyAttendanceHistory]);

  const openProofPreview = useCallback(async (rawUrl: string | null, attendanceId?: string) => {
    if (!rawUrl) return;

    setIsProofModalVisible(true);
    setIsProofLoading(true);
    setProofLoadError(null);
    setProofPreviewUrl(null);

    try {
      const resolvedUrl = await resolveAttendanceProofUrl(rawUrl, attendanceId);
      if (!resolvedUrl) {
        setProofLoadError('Proof URL is empty.');
        return;
      }
      setProofPreviewUrl(resolvedUrl);
    } catch {
      setProofLoadError('Failed to prepare precence proof image.');
    } finally {
      setIsProofLoading(false);
    }
  }, []);

  const closeProofPreview = useCallback(() => {
    setIsProofModalVisible(false);
    setIsProofLoading(false);
    setProofLoadError(null);
    setProofPreviewUrl(null);
  }, []);

  const summary = useMemo(() => {
    const total = records.length;
    const present = records.filter((item) => item.status === 'present').length;
    const late = records.filter((item) => item.status === 'late').length;
    const excused = records.filter((item) => item.status === 'excused').length;
    const absent = records.filter((item) => item.status === 'absent').length;
    return {
      total,
      present,
      late,
      excused,
      absent,
    };
  }, [records]);

  if (isLoading) {
    return (
      <View className="flex-1 p-4 pb-20 items-center justify-center">
        <ActivityIndicator size="large" />
        <Text className="text-gray-500 mt-3">Loading your precence history...</Text>
      </View>
    );
  }

  return (
    <ScrollView className="flex-1 p-4 pb-20" showsVerticalScrollIndicator={false}>
      <View className="flex-row items-center justify-between mb-4">
        <View className="flex-row items-center">
          <Ionicons name="time-outline" size={20} color="#1F2937" />
          <Text className="text-2xl font-bold text-gray-800 ml-2">My Precence History</Text>
        </View>
        <TouchableOpacity
          onPress={() => loadMyAttendanceHistory(true)}
          disabled={isRefreshing}
          className="px-3 py-1.5 rounded-lg bg-gray-100 flex-row items-center"
        >
          <Ionicons name="refresh-outline" size={14} color="#374151" />
          <Text className="text-xs font-semibold text-gray-700 ml-1">{isRefreshing ? 'Refreshing...' : 'Refresh'}</Text>
        </TouchableOpacity>
      </View>

      <View className="flex-row flex-wrap gap-3 mb-4">
        <View className="w-[48%] bg-white rounded-2xl border border-gray-200 p-3">
          <Text className="text-xs text-gray-500">Total</Text>
          <Text className="text-2xl font-extrabold text-gray-900 mt-1">{summary.total}</Text>
        </View>
        <View className="w-[48%] bg-white rounded-2xl border border-gray-200 p-3">
          <Text className="text-xs text-gray-500">Present</Text>
          <Text className="text-2xl font-extrabold text-emerald-600 mt-1">{summary.present}</Text>
        </View>
        <View className="w-[48%] bg-white rounded-2xl border border-gray-200 p-3">
          <Text className="text-xs text-gray-500">Late</Text>
          <Text className="text-2xl font-extrabold text-amber-600 mt-1">{summary.late}</Text>
        </View>
        <View className="w-[48%] bg-white rounded-2xl border border-gray-200 p-3">
          <Text className="text-xs text-gray-500">Excused / Absent</Text>
          <Text className="text-2xl font-extrabold text-gray-700 mt-1">{summary.excused + summary.absent}</Text>
        </View>
      </View>

      <View className="bg-white rounded-2xl border border-gray-200 p-4">
        <Text className="text-sm font-bold text-gray-900 mb-3">Precence Records ({records.length})</Text>

        {records.length === 0 ? (
          <View className="py-8 items-center">
            <Text className="text-gray-500 text-sm">No precence history found for your account.</Text>
          </View>
        ) : (
          records.map((item) => {
            const className = classById[item.class_id]?.name || 'Unknown Class';
            const dateTime = item.presence_at
              ? new Date(item.presence_at).toLocaleString(undefined, {
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })
              : '-';

            return (
              <View key={item.id} className="border border-gray-200 rounded-xl p-3 mb-3">
                <View className="flex-row items-center justify-between mb-2">
                  <View className="flex-1 pr-3">
                    <Text className="text-sm font-bold text-gray-900" numberOfLines={1}>
                      {className}
                    </Text>
                  </View>
                  <Text className={`text-xs font-semibold px-2 py-1 rounded-full ${statusBadgeClass(item.status)}`}>
                    {String(item.status || '-').toUpperCase()}
                  </Text>
                </View>

                <Text className="text-xs text-gray-600">Presence at: {dateTime}</Text>

                {item.photo_url ? (
                  <TouchableOpacity
                    onPress={() => openProofPreview(item.photo_url, item.id)}
                    className="mt-2 self-start px-3 py-1.5 rounded-lg border border-indigo-200 bg-indigo-50 flex-row items-center"
                  >
                    <Ionicons name="image-outline" size={13} color="#4338CA" />
                    <Text className="text-xs font-semibold text-indigo-700 ml-1">View Precence Proof</Text>
                  </TouchableOpacity>
                ) : (
                  <Text className="text-xs text-gray-400 mt-2">No precence proof image</Text>
                )}

                {item.status === 'rejected' && item.rejection_reason ? (
                  <View className="mt-2 bg-rose-50 border border-rose-100 rounded-lg p-2">
                    <Text className="text-xs text-rose-700">Reason: {item.rejection_reason}</Text>
                  </View>
                ) : null}
              </View>
            );
          })
        )}
      </View>

      <Modal
        visible={isProofModalVisible}
        transparent
        animationType="fade"
        onRequestClose={closeProofPreview}
      >
        <View className="flex-1 bg-black/70 px-6 items-center justify-center">
          <View className="w-full bg-white rounded-2xl border border-gray-200 p-4">
            <Text className="text-base font-bold text-gray-900 mb-3">Precence Proof</Text>

            {isProofLoading ? (
              <View style={{ width: '100%', aspectRatio: 3 / 4 }} className="rounded-xl bg-gray-100 items-center justify-center">
                <ActivityIndicator size="large" />
                <Text className="text-xs text-gray-500 mt-2">Loading proof image...</Text>
              </View>
            ) : proofPreviewUrl ? (
              <Image
                source={{ uri: proofPreviewUrl }}
                resizeMode="cover"
                style={{ width: '100%', aspectRatio: 3 / 4 }}
                className="rounded-xl bg-gray-100"
                onError={() => setProofLoadError('Image could not be loaded. Check storage access/policy.')}
              />
            ) : (
              <View style={{ width: '100%', aspectRatio: 3 / 4 }} className="rounded-xl bg-gray-100 items-center justify-center px-4">
                <Text className="text-xs text-gray-500 text-center">No proof URL available.</Text>
              </View>
            )}

            {proofLoadError ? (
              <Text className="text-xs text-rose-600 mt-2">{proofLoadError}</Text>
            ) : null}

            <TouchableOpacity
              onPress={closeProofPreview}
              className="mt-4 bg-gray-100 rounded-xl py-3 items-center flex-row justify-center"
            >
              <Ionicons name="close-outline" size={16} color="#374151" />
              <Text className="text-sm font-semibold text-gray-700 ml-1">Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}
