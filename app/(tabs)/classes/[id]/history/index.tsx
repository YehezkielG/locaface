import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as XLSX from 'xlsx';
import { supabase } from '@/src/lib/supabase';
import { showPopup } from '@/src/lib/inAppPopup';
import { ClassHistoryContent } from '../../components/ClassHistoryContent';

type AttendanceRow = {
  id: string;
  class_id: string;
  user_id: string;
  status: 'present' | 'late' | 'rejected' | string;
  presence_at: string;
  similarity_score: number | null;
  user_lat: number | null;
  user_lon: number | null;
  rejection_reason: string | null;
};

type ProfileRow = {
  id: string;
  username: string | null;
  user_tag: string | null;
  avatar_url: string | null;
};

type FilterStatus = 'all' | 'present' | 'late' | 'rejected';
type DateFilter = 'all' | string;

const statusBadgeClass = (status: string) => {
  if (status === 'present') return 'bg-emerald-100 text-emerald-700';
  if (status === 'late') return 'bg-amber-100 text-amber-700';
  if (status === 'rejected') return 'bg-rose-100 text-rose-700';
  return 'bg-gray-100 text-gray-700';
};

const getDateKey = (dateString: string) => {
  const dt = new Date(dateString);
  if (Number.isNaN(dt.getTime())) return '';
  const year = dt.getFullYear();
  const month = String(dt.getMonth() + 1).padStart(2, '0');
  const day = String(dt.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const formatDateKey = (dateKey: string) => {
  const [year, month, day] = dateKey.split('-').map(Number);
  const dt = new Date(year, (month || 1) - 1, day || 1);
  if (Number.isNaN(dt.getTime())) return dateKey;
  return dt.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

export function LegacyClassHistoryPage() {
  const params = useLocalSearchParams<{ id?: string; className?: string }>();
  const classId = Array.isArray(params.id) ? params.id[0] : params.id;
  const className = Array.isArray(params.className) ? params.className[0] : params.className;

  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [records, setRecords] = useState<AttendanceRow[]>([]);
  const [profileById, setProfileById] = useState<Record<string, ProfileRow>>({});
  const [statusFilter, setStatusFilter] = useState<FilterStatus>('all');
  const [selectedDate, setSelectedDate] = useState<DateFilter>('all');
  const [searchText, setSearchText] = useState('');
  const [accessChecked, setAccessChecked] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const validateOwnerAccess = useCallback(async () => {
    if (!classId) return false;

    const { data: authData } = await supabase.auth.getUser();
    const currentUserId = authData?.user?.id;
    if (!currentUserId) return false;

    const { data: classRow, error } = await supabase
      .from('classes')
      .select('owner_id')
      .eq('id', classId)
      .single();

    if (error || !classRow?.owner_id) return false;
    return classRow.owner_id === currentUserId;
  }, [classId]);

  const loadHistory = useCallback(async (refresh = false) => {
    if (!classId) {
      showPopup({ title: 'History', message: 'Class data not found.', type: 'error' });
      return;
    }

    try {
      if (!accessChecked) {
        const isOwner = await validateOwnerAccess();
        if (!isOwner) {
          showPopup({
            title: 'History',
            message: 'Only the class owner can view this class precence history.',
            type: 'warning',
          });
          router.back();
          return;
        }
        setAccessChecked(true);
      }

      if (refresh) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }

      const { data: attendanceRows, error: attendanceError } = await supabase
        .from('attendances')
        .select('id, class_id, user_id, status, presence_at, similarity_score, user_lat, user_lon, rejection_reason')
        .eq('class_id', classId)
        .order('presence_at', { ascending: false });

      if (attendanceError) throw attendanceError;

      const safeRows: AttendanceRow[] = (attendanceRows || []) as AttendanceRow[];
      setRecords(safeRows);

      const userIds = Array.from(new Set(safeRows.map((item) => item.user_id))).filter(Boolean);
      if (userIds.length === 0) {
        setProfileById({});
        return;
      }

      const { data: profiles, error: profileError } = await supabase
        .from('profiles')
        .select('id, username, user_tag, avatar_url')
        .in('id', userIds);

      if (profileError) throw profileError;

      const mapped = (profiles || []).reduce((acc: Record<string, ProfileRow>, item: ProfileRow) => {
        acc[item.id] = item;
        return acc;
      }, {});

      setProfileById(mapped);
    } catch (error: any) {
      showPopup({
        title: 'History',
        message: error?.message || 'Failed to load class precence history.',
        type: 'error',
      });
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [accessChecked, classId, validateOwnerAccess]);

  useFocusEffect(
    useCallback(() => {
      loadHistory();
    }, [loadHistory]),
  );

  const availableDates = useMemo(() => {
    const dateSet = new Set<string>();
    records.forEach((item) => {
      const key = getDateKey(item.presence_at);
      if (key) dateSet.add(key);
    });
    return Array.from(dateSet).sort((a, b) => b.localeCompare(a));
  }, [records]);

  useEffect(() => {
    if (selectedDate !== 'all' && !availableDates.includes(selectedDate)) {
      setSelectedDate('all');
    }
  }, [availableDates, selectedDate]);

  const filteredRecords = useMemo(() => {
    const keyword = searchText.trim().toLowerCase();

    return records.filter((item) => {
      const dateOk = selectedDate === 'all' || getDateKey(item.presence_at) === selectedDate;
      if (!dateOk) return false;

      const statusOk = statusFilter === 'all' || item.status === statusFilter;
      if (!statusOk) return false;

      if (!keyword) return true;

      const profile = profileById[item.user_id];
      const username = (profile?.username || '').toLowerCase();
      const userTag = (profile?.user_tag || '').toLowerCase();
      const reason = (item.rejection_reason || '').toLowerCase();

      return username.includes(keyword) || userTag.includes(keyword) || reason.includes(keyword);
    });
  }, [records, profileById, selectedDate, statusFilter, searchText]);

  const stats = useMemo(() => {
    const total = filteredRecords.length;
    const present = filteredRecords.filter((item) => item.status === 'present').length;
    const late = filteredRecords.filter((item) => item.status === 'late').length;
    const rejected = filteredRecords.filter((item) => item.status === 'rejected').length;

    const accepted = present + late;
    const successRate = total > 0 ? Math.round((accepted / total) * 100) : 0;

    const similarityValues = filteredRecords
      .map((item) => item.similarity_score)
      .filter((item): item is number => typeof item === 'number');

    const avgSimilarity =
      similarityValues.length > 0
        ? similarityValues.reduce((acc, val) => acc + val, 0) / similarityValues.length
        : null;

    const highestSimilarity =
      similarityValues.length > 0 ? Math.max(...similarityValues) : null;

    return {
      total,
      present,
      late,
      rejected,
      successRate,
      avgSimilarity,
      highestSimilarity,
    };
  }, [filteredRecords]);

  const handleExportDateToExcel = useCallback(async () => {
    if (selectedDate === 'all') {
      showPopup({
        title: 'Export',
        message: 'Select a date first to export precence recap by date.',
        type: 'warning',
      });
      return;
    }

    const dateRows = records.filter((item) => getDateKey(item.presence_at) === selectedDate);
    if (dateRows.length === 0) {
      showPopup({ title: 'Export', message: 'No records found for the selected date.', type: 'warning' });
      return;
    }

    try {
      setIsExporting(true);

      const headers = [
        'Date',
        'Time',
        'Name',
        'User Tag',
        'Status',
        'Similarity',
        'Latitude',
        'Longitude',
        'Rejection Reason',
      ];

      const rows = dateRows.map((item) => {
        const profile = profileById[item.user_id];
        const dt = new Date(item.presence_at);
        const dateOnly = dt.toLocaleDateString(undefined, {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
        });
        const timeOnly = dt.toLocaleTimeString(undefined, {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false,
        });

        return [
          dateOnly,
          timeOnly,
          profile?.username || 'Unknown User',
          profile?.user_tag ? `@${profile.user_tag}` : '-',
          item.status,
          typeof item.similarity_score === 'number' ? item.similarity_score.toFixed(3) : '-',
          item.user_lat != null ? item.user_lat.toFixed(6) : '-',
          item.user_lon != null ? item.user_lon.toFixed(6) : '-',
          item.rejection_reason || '-',
        ];
      });

      const worksheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Precence');

      const workbookBase64 = XLSX.write(workbook, {
        type: 'base64',
        bookType: 'xlsx',
      });

      const sanitizedClassName = (className || 'class')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');

      const outputFile = `precence-${sanitizedClassName || 'class'}-${selectedDate}.xlsx`;
      const outputUri = `${FileSystem.cacheDirectory}${outputFile}`;

      await FileSystem.writeAsStringAsync(outputUri, workbookBase64, {
        encoding: FileSystem.EncodingType.Base64,
      });

      const canShare = await Sharing.isAvailableAsync();
      if (!canShare) {
        showPopup({
          title: 'Export',
          message: `File created successfully: ${outputFile}`,
          type: 'success',
        });
        return;
      }

      await Sharing.shareAsync(outputUri, {
        dialogTitle: 'Save Precence Recap',
        mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        UTI: Platform.OS === 'ios' ? 'org.openxmlformats.spreadsheetml.sheet' : undefined,
      });
    } catch (error: any) {
      showPopup({
        title: 'Export',
        message: error?.message || 'Failed to export precence recap to Excel.',
        type: 'error',
      });
    } finally {
      setIsExporting(false);
    }
  }, [className, profileById, records, selectedDate]);

  if (isLoading) {
    return (
      <View className="flex-1 bg-white items-center justify-center">
        <ActivityIndicator size="large" />
        <Text className="text-gray-500 mt-3">Loading precence history...</Text>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-gray-50">
      <View className="px-5 pt-5 pb-4 bg-white border-b border-gray-200">
        <View className="flex-row items-center">
          <TouchableOpacity onPress={() => router.back()} className="mr-3">
            <Ionicons name="arrow-back" size={24} color="#111827" />
          </TouchableOpacity>
          <View className="flex-1">
            <Text className="text-lg font-bold text-gray-900">Presence Recap</Text>
            <Text className="text-xs text-gray-500" numberOfLines={1}>
              {className || 'Class'}
            </Text>
          </View>
        </View>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 16, paddingBottom: 28 }}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={() => loadHistory(true)} />}
      >
        <View className="flex-row flex-wrap gap-3 mb-4">
          <View className="w-[48%] bg-white rounded-2xl border border-gray-200 p-3">
            <Text className="text-xs text-gray-500">Total Records</Text>
            <Text className="text-2xl font-extrabold text-gray-900 mt-1">{stats.total}</Text>
          </View>

          <View className="w-[48%] bg-white rounded-2xl border border-gray-200 p-3">
            <Text className="text-xs text-gray-500">Success Rate</Text>
            <Text className="text-2xl font-extrabold text-indigo-600 mt-1">{stats.successRate}%</Text>
          </View>

          <View className="w-[31%] bg-white rounded-2xl border border-gray-200 p-3">
            <Text className="text-xs text-gray-500">Present</Text>
            <Text className="text-xl font-bold text-emerald-600 mt-1">{stats.present}</Text>
          </View>

          <View className="w-[31%] bg-white rounded-2xl border border-gray-200 p-3">
            <Text className="text-xs text-gray-500">Late</Text>
            <Text className="text-xl font-bold text-amber-600 mt-1">{stats.late}</Text>
          </View>

          <View className="w-[31%] bg-white rounded-2xl border border-gray-200 p-3">
            <Text className="text-xs text-gray-500">Rejected</Text>
            <Text className="text-xl font-bold text-rose-600 mt-1">{stats.rejected}</Text>
          </View>
        </View>

        <View className="bg-white rounded-2xl border border-gray-200 p-4 mb-4">
          <Text className="text-sm font-bold text-gray-900 mb-3">Face Match Insights</Text>
          <Text className="text-sm text-gray-700 mb-1">
            Average similarity:{' '}
            <Text className="font-bold">
              {stats.avgSimilarity != null ? stats.avgSimilarity.toFixed(3) : '-'}
            </Text>
          </Text>
          <Text className="text-sm text-gray-700">
            Highest similarity:{' '}
            <Text className="font-bold">
              {stats.highestSimilarity != null ? stats.highestSimilarity.toFixed(3) : '-'}
            </Text>
          </Text>
        </View>

        <View className="bg-white rounded-2xl border border-gray-200 p-4 mb-4">
          <Text className="text-sm font-bold text-gray-900 mb-3">Filter & Search</Text>

          <Text className="text-xs font-semibold text-gray-600 mb-2">Precence Date</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-3">
            <View className="flex-row gap-2 pr-1">
              {(['all', ...availableDates] as DateFilter[]).map((item) => {
                const selected = selectedDate === item;
                const label = item === 'all' ? 'All Dates' : formatDateKey(item);

                return (
                  <TouchableOpacity
                    key={item}
                    onPress={() => setSelectedDate(item)}
                    className={`px-3 py-2 rounded-full border ${
                      selected ? 'bg-indigo-50 border-indigo-400' : 'bg-white border-gray-200'
                    }`}
                  >
                    <Text className={`text-xs font-semibold ${selected ? 'text-indigo-600' : 'text-gray-600'}`}>
                      {label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </ScrollView>

          <TextInput
            value={searchText}
            onChangeText={setSearchText}
            placeholder="Search username / user tag / rejection reason"
            placeholderTextColor="#9CA3AF"
            className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-900 mb-3"
          />

          <View className="flex-row flex-wrap gap-2">
            {(['all', 'present', 'late', 'rejected'] as FilterStatus[]).map((item) => {
              const selected = statusFilter === item;
              return (
                <TouchableOpacity
                  key={item}
                  onPress={() => setStatusFilter(item)}
                  className={`px-3 py-2 rounded-full border ${
                    selected ? 'bg-indigo-50 border-indigo-400' : 'bg-white border-gray-200'
                  }`}
                >
                  <Text className={`text-xs font-semibold ${selected ? 'text-indigo-600' : 'text-gray-600'}`}>
                    {item.toUpperCase()}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <TouchableOpacity
            onPress={handleExportDateToExcel}
            disabled={isExporting || selectedDate === 'all'}
            className={`mt-3 rounded-xl py-3 items-center ${
              isExporting || selectedDate === 'all' ? 'bg-emerald-300' : 'bg-emerald-600'
            }`}
          >
            <Text className="text-white font-bold">
              {isExporting
                ? 'Exporting...'
                : selectedDate === 'all'
                  ? 'Select a Date to Export Excel'
                  : `Export Excel (${formatDateKey(selectedDate)})`}
            </Text>
          </TouchableOpacity>
        </View>

        <View className="bg-white rounded-2xl border border-gray-200 p-4">
          <Text className="text-sm font-bold text-gray-900 mb-3">Precence Records ({filteredRecords.length})</Text>

          {filteredRecords.length === 0 ? (
            <View className="items-center py-8">
              <Text className="text-gray-500 text-sm">No precence data for this filter yet.</Text>
            </View>
          ) : (
            filteredRecords.map((item) => {
              const profile = profileById[item.user_id];
              const dateLabel = item.presence_at
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
                  <View className="flex-row items-center justify-between mb-1">
                    <Text className="text-sm font-bold text-gray-900">
                      {profile?.username || 'Unknown User'}
                    </Text>
                    <Text className={`text-xs font-semibold px-2 py-1 rounded-full ${statusBadgeClass(item.status)}`}>
                      {item.status.toUpperCase()}
                    </Text>
                  </View>

                  <Text className="text-xs text-gray-500 mb-1">
                    {profile?.user_tag ? `@${profile.user_tag}` : 'No user tag'}
                  </Text>

                  <Text className="text-xs text-gray-600 mb-1">Presence at: {dateLabel}</Text>
                  <Text className="text-xs text-gray-600 mb-1">
                    Similarity: {typeof item.similarity_score === 'number' ? item.similarity_score.toFixed(3) : '-'}
                  </Text>
                  <Text className="text-xs text-gray-600">
                    Coordinates: {item.user_lat != null && item.user_lon != null ? `${item.user_lat.toFixed(6)}, ${item.user_lon.toFixed(6)}` : '-'}
                  </Text>

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
      </ScrollView>
    </View>
  );
}

export default function ClassHistoryPage() {
  const params = useLocalSearchParams<{ id?: string; className?: string }>();
  const classId = Array.isArray(params.id) ? params.id[0] : params.id;
  const className = Array.isArray(params.className) ? params.className[0] : params.className;

  const [isCheckingAccess, setIsCheckingAccess] = useState(true);
  const [hasAccess, setHasAccess] = useState(false);

  const validateOwnerAccess = useCallback(async () => {
    if (!classId) {
      showPopup({ title: 'History', message: 'Class data not found.', type: 'error' });
      router.back();
      return;
    }

    try {
      setIsCheckingAccess(true);

      const { data: authData } = await supabase.auth.getUser();
      const currentUserId = authData?.user?.id;
      if (!currentUserId) {
        showPopup({ title: 'History', message: 'No active session found.', type: 'warning' });
        router.back();
        return;
      }

      const { data: classRow, error } = await supabase
        .from('classes')
        .select('owner_id')
        .eq('id', classId)
        .single();

      if (error || !classRow?.owner_id) {
        showPopup({ title: 'History', message: 'Class data not found.', type: 'error' });
        router.back();
        return;
      }

      if (classRow.owner_id !== currentUserId) {
        showPopup({
          title: 'History',
          message: 'Only the class owner can view this class precence history.',
          type: 'warning',
        });
        router.back();
        return;
      }

      setHasAccess(true);
    } catch (error: any) {
      showPopup({
        title: 'History',
        message: error?.message || 'Failed to validate access to precence history.',
        type: 'error',
      });
      router.back();
    } finally {
      setIsCheckingAccess(false);
    }
  }, [classId]);

  useFocusEffect(
    useCallback(() => {
      validateOwnerAccess();
    }, [validateOwnerAccess]),
  );

  if (isCheckingAccess) {
    return (
      <View className="flex-1 bg-white items-center justify-center">
        <ActivityIndicator size="large" />
        <Text className="text-gray-500 mt-3">Checking history access...</Text>
      </View>
    );
  }

  if (!hasAccess || !classId) {
    return null;
  }

  return (
    <View className="flex-1 bg-gray-50">
      <View className="px-5 pt-5 pb-4 bg-white border-b border-gray-200">
        <View className="flex-row items-center">
          <TouchableOpacity onPress={() => router.back()} className="mr-3">
            <Ionicons name="arrow-back" size={24} color="#111827" />
          </TouchableOpacity>
          <View className="flex-1">
            <Text className="text-lg font-bold text-gray-900">Presence History</Text>
            <Text className="text-xs text-gray-500" numberOfLines={1}>
              {className || 'Class'}
            </Text>
          </View>
        </View>
      </View>

      <ScrollView className="flex-1" contentContainerStyle={{ paddingVertical: 16, paddingBottom: 28 }}>
        <ClassHistoryContent classId={classId} className={className || ''} />
      </ScrollView>
    </View>
  );
}
