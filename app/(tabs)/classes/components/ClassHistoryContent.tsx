import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Image, Modal, Platform, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as XLSX from 'xlsx';
import { supabase } from '@/src/lib/supabase';
import { showPopup } from '@/src/lib/inAppPopup';
import { resolveAttendanceProofUrl } from '@/src/lib/attendanceProof';

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
  photo_url: string | null;
};

type ProfileRow = {
  id: string;
  username: string | null;
  user_tag: string | null;
  avatar_url?: string | null;
};

type FilterStatus = 'all' | 'present' | 'late' | 'excused' | 'absent' | 'rejected';
type DateFilter = 'all' | string;
type MonthFilter = 'all' | string;

type Props = {
  classId: string;
  className?: string | null;
};

const statusBadgeClass = (status: string) => {
  if (status === 'present') return 'bg-emerald-100 text-emerald-700';
  if (status === 'late') return 'bg-amber-100 text-amber-700';
  if (status === 'excused') return 'bg-sky-100 text-sky-700';
  if (status === 'absent') return 'bg-gray-100 text-gray-700';
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

const formatMonthKey = (monthKey: string) => {
  const [year, month] = monthKey.split('-').map(Number);
  const dt = new Date(year, (month || 1) - 1, 1);
  if (Number.isNaN(dt.getTime())) return monthKey;
  return dt.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
  });
};

export function ClassHistoryContent({ classId, className }: Props) {
  const [isLoading, setIsLoading] = useState(true);
  const [records, setRecords] = useState<AttendanceRow[]>([]);
  const [profileById, setProfileById] = useState<Record<string, ProfileRow>>({});
  const [statusFilter, setStatusFilter] = useState<FilterStatus>('all');
  const [selectedDate, setSelectedDate] = useState<DateFilter>('all');
  const [selectedMonthFilter, setSelectedMonthFilter] = useState<MonthFilter>('all');
  const [searchText, setSearchText] = useState('');
  const [isExporting, setIsExporting] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isDatePickerVisible, setIsDatePickerVisible] = useState(false);
  const [manualStatusTarget, setManualStatusTarget] = useState<{ attendanceId: string; username?: string | null } | null>(null);
  const [proofPreviewUrl, setProofPreviewUrl] = useState<string | null>(null);
  const [isProofModalVisible, setIsProofModalVisible] = useState(false);
  const [isProofLoading, setIsProofLoading] = useState(false);
  const [proofLoadError, setProofLoadError] = useState<string | null>(null);

  const loadHistory = useCallback(async (refresh = false) => {
    if (!classId) return;

    try {
      if (refresh) setIsRefreshing(true);
      else setIsLoading(true);

      const { data: attendanceRows, error: attendanceError } = await supabase
        .from('attendances')
        .select('id, class_id, user_id, status, presence_at, similarity_score, user_lat, user_lon, rejection_reason, photo_url')
        .eq('class_id', classId)
        .order('presence_at', { ascending: false });

      if (attendanceError) throw attendanceError;

      const safeRows = (attendanceRows || []) as AttendanceRow[];
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
  }, [classId]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

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

  const availableDates = useMemo(() => {
    const dateSet = new Set<string>();
    records.forEach((item) => {
      const key = getDateKey(item.presence_at);
      if (key) dateSet.add(key);
    });
    return Array.from(dateSet).sort((a, b) => b.localeCompare(a));
  }, [records]);

  const monthOptions = useMemo(() => {
    const monthSet = new Set<string>();
    availableDates.forEach((item) => {
      const monthKey = item.slice(0, 7);
      if (monthKey) monthSet.add(monthKey);
    });
    return Array.from(monthSet).sort((a, b) => b.localeCompare(a));
  }, [availableDates]);

  useEffect(() => {
    if (selectedMonthFilter !== 'all' && !monthOptions.includes(selectedMonthFilter)) {
      setSelectedMonthFilter('all');
    }
  }, [monthOptions, selectedMonthFilter]);

  useEffect(() => {
    if (selectedMonthFilter === 'all' && monthOptions.length > 0) {
      setSelectedMonthFilter(monthOptions[0]);
    }
  }, [monthOptions, selectedMonthFilter]);

  const filteredAvailableDates = useMemo(() => {
    if (selectedMonthFilter === 'all') return availableDates;
    return availableDates.filter((item) => item.startsWith(selectedMonthFilter));
  }, [availableDates, selectedMonthFilter]);

  useEffect(() => {
    if (selectedDate !== 'all' && !filteredAvailableDates.includes(selectedDate)) {
      setSelectedDate('all');
    }
  }, [filteredAvailableDates, selectedDate]);

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
  }, [records, profileById, searchText, selectedDate, statusFilter]);

  const stats = useMemo(() => {
    const total = filteredRecords.length;
    const present = filteredRecords.filter((item) => item.status === 'present').length;
    const late = filteredRecords.filter((item) => item.status === 'late').length;
    const rejected = filteredRecords.filter((item) => item.status === 'rejected').length;

    const accepted = present + late;
    const successRate = total > 0 ? Math.round((accepted / total) * 100) : 0;

    return {
      total,
      present,
      late,
      rejected,
      successRate,
    };
  }, [filteredRecords]);

  const handleExportDateToExcel = useCallback(async () => {
    if (selectedDate === 'all') {
      showPopup({
        title: 'Export',
        message: 'Please select a date first to export precence by date.',
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
        dialogTitle: 'Save Precence Report',
        mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        UTI: Platform.OS === 'ios' ? 'org.openxmlformats.spreadsheetml.sheet' : undefined,
      });
    } catch (error: any) {
      showPopup({
        title: 'Export',
        message: error?.message || 'Failed to export precence report to Excel.',
        type: 'error',
      });
    } finally {
      setIsExporting(false);
    }
  }, [className, profileById, records, selectedDate]);

  const handleManualStatusUpdate = useCallback(async (attendanceId: string, nextStatus: 'present' | 'late' | 'excused' | 'absent') => {
    try {
      const { error } = await supabase
        .from('attendances')
        .update({
          status: nextStatus,
          rejection_reason: null,
          presence_at: new Date().toISOString(),
        })
        .eq('id', attendanceId);

      if (error) throw error;

      setRecords((previous) =>
        previous.map((item) =>
          item.id === attendanceId
            ? {
                ...item,
                status: nextStatus,
                rejection_reason: null,
                presence_at: new Date().toISOString(),
              }
            : item,
        ),
      );

      showPopup({
        title: 'Precence',
        message: `Precence status updated to ${nextStatus.toUpperCase()}.`,
        type: 'success',
      });
    } catch (error: any) {
      showPopup({
        title: 'Precence',
        message: error?.message || 'Failed to update precence status.',
        type: 'error',
      });
    }
  }, []);

  const openManualStatusAction = useCallback((attendanceId: string, username?: string | null) => {
    setManualStatusTarget({ attendanceId, username });
  }, []);

  const handleSelectManualStatus = useCallback(async (nextStatus: 'present' | 'late' | 'excused' | 'absent') => {
    if (!manualStatusTarget?.attendanceId) return;
    const attendanceId = manualStatusTarget.attendanceId;
    setManualStatusTarget(null);
    await handleManualStatusUpdate(attendanceId, nextStatus);
  }, [handleManualStatusUpdate, manualStatusTarget]);

  if (isLoading) {
    return (
      <View className="mx-4 bg-white border border-gray-200 rounded-2xl p-6 items-center">
        <ActivityIndicator size="large" />
        <Text className="text-gray-500 mt-3">Loading precence history...</Text>
      </View>
    );
  }

  return (
    <View className="mx-4">
      <View className="bg-white rounded-2xl border border-gray-200 p-4 mb-4">
        <View className="flex-row items-center justify-between mb-2">
          <Text className="text-base font-bold text-gray-900">Presence Recap</Text>
          <TouchableOpacity onPress={() => loadHistory(true)} disabled={isRefreshing} className="px-3 py-1.5 bg-gray-100 rounded-lg">
            <Text className="text-xs font-semibold text-gray-700">{isRefreshing ? 'Refreshing...' : 'Refresh'}</Text>
          </TouchableOpacity>
        </View>
        <Text className="text-xs text-gray-500">{className || 'Class'}</Text>
      </View>

      <View className="flex-row flex-wrap gap-3 mb-4">
        <View className="w-[48%] bg-white rounded-2xl border border-gray-200 p-3">
          <Text className="text-xs text-gray-500">Total Records</Text>
          <Text className="text-2xl font-extrabold text-gray-900 mt-1">{stats.total}</Text>
        </View>

        <View className="w-[48%] bg-white rounded-2xl border border-gray-200 p-3">
          <Text className="text-xs text-gray-500">Success Rate</Text>
          <Text className="text-2xl font-extrabold text-indigo-600 mt-1">{stats.successRate}%</Text>
        </View>
      </View>

      <View className="bg-white rounded-2xl border border-gray-200 p-4 mb-4">
        <Text className="text-sm font-bold text-gray-900 mb-3">Filter & Search</Text>

        <Text className="text-xs font-semibold text-gray-600 mb-2">Precence Date</Text>
        <TouchableOpacity
          onPress={() => setIsDatePickerVisible(true)}
          className="mb-2 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3"
        >
          <Text className="text-sm font-semibold text-gray-800">
            {selectedDate === 'all' ? 'All Dates' : formatDateKey(selectedDate)}
          </Text>
          <Text className="text-xs text-gray-500 mt-1">
            Month filter: {selectedMonthFilter === 'all' ? 'All months' : formatMonthKey(selectedMonthFilter)}
          </Text>
        </TouchableOpacity>
        <Text className="text-xs text-gray-500 mb-3">
          {filteredAvailableDates.length} dates found in current month filter.
        </Text>

        <TextInput
          value={searchText}
          onChangeText={setSearchText}
          placeholder="Search username / user tag / rejection reason"
          placeholderTextColor="#9CA3AF"
          className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-900 mb-3"
        />

        <View className="flex-row flex-wrap gap-2">
          {(['all', 'present', 'late', 'excused', 'absent', 'rejected'] as FilterStatus[]).map((item) => {
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
            <Text className="text-gray-500 text-sm">No precence records for the selected filter.</Text>
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
              <TouchableOpacity
                key={item.id}
                onLongPress={() => openManualStatusAction(item.id, profile?.username)}
                delayLongPress={350}
                className="border border-gray-200 rounded-xl p-3 mb-3"
                activeOpacity={0.9}
              >
                <View className="flex-row items-center justify-between mb-2">
                  <View className="flex-row items-center flex-1 mr-3">
                    {profile?.avatar_url ? (
                      <Image
                        source={{ uri: profile.avatar_url }}
                        className="w-10 h-10 rounded-full mr-3"
                        resizeMode="cover"
                      />
                    ) : (
                      <View className="w-10 h-10 rounded-full bg-gray-200 mr-3 items-center justify-center">
                        <Text className="text-gray-600 font-bold text-xs">
                          {(profile?.username || 'U').slice(0, 1).toUpperCase()}
                        </Text>
                      </View>
                    )}
                    <View className="flex-1">
                      <Text className="text-sm font-bold text-gray-900" numberOfLines={1}>
                        {profile?.username || 'Unknown User'}
                      </Text>
                      <Text className="text-xs text-gray-500">
                        {profile?.user_tag ? `@${profile.user_tag}` : 'No user tag'}
                      </Text>
                    </View>
                  </View>
                  <Text className={`text-xs font-semibold px-2 py-1 rounded-full ${statusBadgeClass(item.status)}`}>
                    {item.status.toUpperCase()}
                  </Text>
                </View>
                <Text className="text-xs text-gray-600 mb-1">Presence at: {dateLabel}</Text>

                {item.photo_url ? (
                  <TouchableOpacity
                    onPress={() => openProofPreview(item.photo_url, item.id)}
                    className="mt-1 self-start px-3 py-1.5 rounded-lg border border-indigo-200 bg-indigo-50"
                  >
                    <Text className="text-xs font-semibold text-indigo-700">View Precence Proof</Text>
                  </TouchableOpacity>
                ) : (
                  <Text className="text-xs text-gray-400 mt-1">No precence proof image</Text>
                )}

                {item.status === 'rejected' && item.rejection_reason ? (
                  <View className="mt-2 bg-rose-50 border border-rose-100 rounded-lg p-2">
                    <Text className="text-xs text-rose-700">Reason: {item.rejection_reason}</Text>
                  </View>
                ) : null}
              </TouchableOpacity>
            );
          })
        )}
      </View>

      <Modal
        visible={isDatePickerVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setIsDatePickerVisible(false)}
      >
        <View className="flex-1 bg-black/40 items-center justify-center px-6">
          <View className="w-full bg-white rounded-2xl border border-gray-200 p-4 max-h-[70%]">
            <Text className="text-base font-bold text-gray-900 mb-1">Select Precence Date</Text>
            <Text className="text-xs text-gray-500 mb-3">Filter by month first, then choose the date.</Text>

            <Text className="text-xs font-semibold text-gray-600 mb-2">Month</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-3">
              <View className="flex-row gap-2 pr-1">
                <TouchableOpacity
                  onPress={() => {
                    setSelectedMonthFilter('all');
                    setSelectedDate('all');
                  }}
                  className={`px-3 py-2 rounded-full border ${
                    selectedMonthFilter === 'all' ? 'bg-indigo-50 border-indigo-400' : 'bg-white border-gray-200'
                  }`}
                >
                  <Text className={`text-xs font-semibold ${selectedMonthFilter === 'all' ? 'text-indigo-600' : 'text-gray-600'}`}>
                    All Months
                  </Text>
                </TouchableOpacity>

                {monthOptions.map((monthKey) => {
                  const selected = selectedMonthFilter === monthKey;
                  return (
                    <TouchableOpacity
                      key={`month-filter-${monthKey}`}
                      onPress={() => {
                        setSelectedMonthFilter(monthKey);
                        setSelectedDate('all');
                      }}
                      className={`px-3 py-2 rounded-full border ${
                        selected ? 'bg-indigo-50 border-indigo-400' : 'bg-white border-gray-200'
                      }`}
                    >
                      <Text className={`text-xs font-semibold ${selected ? 'text-indigo-600' : 'text-gray-600'}`}>
                        {formatMonthKey(monthKey)}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>

            <Text className="text-xs font-semibold text-gray-600 mb-2">Date</Text>

            <ScrollView showsVerticalScrollIndicator={false}>
              <TouchableOpacity
                onPress={() => {
                  setSelectedDate('all');
                  setIsDatePickerVisible(false);
                }}
                className={`px-3 py-3 rounded-xl border mb-2 ${
                  selectedDate === 'all' ? 'bg-indigo-50 border-indigo-400' : 'bg-white border-gray-200'
                }`}
              >
                <Text className={`text-sm font-semibold ${selectedDate === 'all' ? 'text-indigo-600' : 'text-gray-700'}`}>
                  All Dates
                </Text>
              </TouchableOpacity>

              <View className="gap-2">
                {filteredAvailableDates.map((dateKey) => {
                  const selected = selectedDate === dateKey;
                  return (
                    <TouchableOpacity
                      key={`date-${dateKey}`}
                      onPress={() => {
                        setSelectedDate(dateKey);
                        setIsDatePickerVisible(false);
                      }}
                      className={`px-3 py-3 rounded-xl border ${
                        selected ? 'bg-indigo-50 border-indigo-400' : 'bg-white border-gray-200'
                      }`}
                    >
                      <Text className={`text-sm font-semibold ${selected ? 'text-indigo-600' : 'text-gray-700'}`}>
                        {formatDateKey(dateKey)}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>

            <TouchableOpacity
              onPress={() => setIsDatePickerVisible(false)}
              className="mt-4 bg-gray-100 rounded-xl py-3 items-center"
            >
              <Text className="text-sm font-semibold text-gray-700">Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal
        visible={!!manualStatusTarget}
        transparent
        animationType="fade"
        onRequestClose={() => setManualStatusTarget(null)}
      >
        <View className="flex-1 bg-black/40 items-center justify-center px-6">
          <View className="w-full bg-white rounded-2xl border border-gray-200 p-4">
            <Text className="text-base font-bold text-gray-900 mb-1">Update Precence Status</Text>
            <Text className="text-sm text-gray-600 mb-3">
              Choose a new status for {manualStatusTarget?.username || 'this member'}.
            </Text>

            <View className="gap-2">
              {(['present', 'late', 'excused', 'absent'] as const).map((status) => (
                <TouchableOpacity
                  key={`recap-manual-status-${status}`}
                  onPress={() => handleSelectManualStatus(status)}
                  className="px-3 py-3 rounded-xl border border-gray-200 bg-white"
                >
                  <Text className="text-sm font-semibold text-gray-800">{status.toUpperCase()}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity
              onPress={() => setManualStatusTarget(null)}
              className="mt-4 bg-gray-100 rounded-xl py-3 items-center"
            >
              <Text className="text-sm font-semibold text-gray-700">Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

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
              className="mt-4 bg-gray-100 rounded-xl py-3 items-center"
            >
              <Text className="text-sm font-semibold text-gray-700">Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}
