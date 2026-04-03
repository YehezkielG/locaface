import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Image, Modal, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/src/lib/supabase';
import { showPopup } from '@/src/lib/inAppPopup';

type AttendanceRow = {
  id: string;
  class_id: string;
  user_id: string;
  status: 'present' | 'late' | 'excused' | 'absent' | 'rejected' | string;
  presence_at: string;
  rejection_reason: string | null;
};

type MemberItem = {
  user_id: string;
  role: string | null;
  joined_at: string | null;
  profile?: {
    id: string;
    username: string | null;
    avatar_url?: string | null;
    user_tag?: string | null;
  } | null;
};

type Props = {
  classId: string;
  className?: string | null;
  members: MemberItem[];
};

const statusBadgeClass = (status?: string | null) => {
  if (status === 'present') return 'bg-emerald-100 text-emerald-700';
  if (status === 'late') return 'bg-amber-100 text-amber-700';
  if (status === 'excused') return 'bg-sky-100 text-sky-700';
  if (status === 'absent') return 'bg-gray-100 text-gray-700';
  if (status === 'rejected') return 'bg-rose-100 text-rose-700';
  return 'bg-gray-100 text-gray-500';
};

const isInstructorRole = (role?: string | null) => {
  const normalized = (role || '').toLowerCase();
  return normalized === 'instructor' || normalized === 'owner';
};

const getTodayRangeIso = () => {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  return {
    startIso: start.toISOString(),
    endIso: end.toISOString(),
  };
};

export function TodaySessionContent({ classId, className, members }: Props) {
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [attendanceByUserId, setAttendanceByUserId] = useState<Record<string, AttendanceRow>>({});
  const [manualStatusTarget, setManualStatusTarget] = useState<MemberItem | null>(null);

  const loadSession = useCallback(async (refresh = false) => {
    if (!classId) return;

    try {
      if (refresh) setIsRefreshing(true);
      else setIsLoading(true);

      const { startIso, endIso } = getTodayRangeIso();

      const { data, error } = await supabase
        .from('attendances')
        .select('id, class_id, user_id, status, presence_at, rejection_reason')
        .eq('class_id', classId)
        .gte('presence_at', startIso)
        .lte('presence_at', endIso)
        .order('presence_at', { ascending: false });

      if (error) throw error;

      const rows = (data || []) as AttendanceRow[];
      const mapped: Record<string, AttendanceRow> = {};
      rows.forEach((item) => {
        if (!mapped[item.user_id]) {
          mapped[item.user_id] = item;
        }
      });

      setAttendanceByUserId(mapped);
    } catch (error: any) {
      showPopup({
        title: 'Today Session',
        message: error?.message || 'Failed to load today session.',
        type: 'error',
      });
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [classId]);

  useEffect(() => {
    loadSession();
  }, [loadSession]);

  useEffect(() => {
    const intervalId = setInterval(() => {
      loadSession(true);
    }, 30_000);

    return () => clearInterval(intervalId);
  }, [loadSession]);

  const sortedMembers = useMemo(() => {
    return [...members].sort((a, b) => {
      const aName = (a.profile?.username || '').toLowerCase();
      const bName = (b.profile?.username || '').toLowerCase();
      return aName.localeCompare(bName);
    });
  }, [members]);

  const arrivedMembers = useMemo(() => {
    return sortedMembers.filter((item) => {
      const status = attendanceByUserId[item.user_id]?.status;
      return status === 'present' || status === 'late';
    });
  }, [attendanceByUserId, sortedMembers]);

  const pendingMembers = useMemo(() => {
    return sortedMembers.filter((item) => {
      if (isInstructorRole(item.role)) return false;
      const status = attendanceByUserId[item.user_id]?.status;
      return !status || (status !== 'present' && status !== 'late');
    });
  }, [attendanceByUserId, sortedMembers]);

  const upsertManualStatus = useCallback(async (member: MemberItem, nextStatus: 'present' | 'late' | 'excused' | 'absent') => {
    const existing = attendanceByUserId[member.user_id];

    try {
      const nowIso = new Date().toISOString();

      if (existing?.id) {
        const { error } = await supabase
          .from('attendances')
          .update({
            status: nextStatus,
            rejection_reason: null,
            presence_at: nowIso,
          })
          .eq('id', existing.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('attendances')
          .insert({
            class_id: classId,
            user_id: member.user_id,
            status: nextStatus,
            presence_at: nowIso,
            rejection_reason: null,
          });

        if (error) throw error;
      }

      await loadSession(true);
      showPopup({
        title: 'Today Session',
        message: `${member.profile?.username || 'Member'} status updated to ${nextStatus.toUpperCase()}.`,
        type: 'success',
      });
    } catch (error: any) {
      showPopup({
        title: 'Today Session',
        message: error?.message || 'Failed to update precence status.',
        type: 'error',
      });
    }
  }, [attendanceByUserId, classId, loadSession]);

  const openStatusPicker = useCallback((member: MemberItem) => {
    setManualStatusTarget(member);
  }, []);

  const handleSelectStatus = useCallback(async (nextStatus: 'present' | 'late' | 'excused' | 'absent') => {
    if (!manualStatusTarget) return;
    const target = manualStatusTarget;
    setManualStatusTarget(null);
    await upsertManualStatus(target, nextStatus);
  }, [manualStatusTarget, upsertManualStatus]);

  const renderMemberRow = (member: MemberItem, showStatus = true) => {
    const attendance = attendanceByUserId[member.user_id];
    const status = attendance?.status || 'not_marked';

    return (
      <TouchableOpacity
        key={member.user_id}
        onLongPress={() => openStatusPicker(member)}
        delayLongPress={350}
        activeOpacity={0.9}
        className="border border-gray-200 rounded-xl p-3 mb-3 bg-white"
      >
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center flex-1 mr-3">
            {member.profile?.avatar_url ? (
              <Image
                source={{ uri: member.profile.avatar_url }}
                className="w-10 h-10 rounded-full mr-3"
                resizeMode="cover"
              />
            ) : (
              <View className="w-10 h-10 rounded-full bg-gray-200 mr-3 items-center justify-center">
                <Text className="text-gray-600 font-bold text-xs">
                  {(member.profile?.username || 'U').slice(0, 1).toUpperCase()}
                </Text>
              </View>
            )}

            <View className="flex-1">
              <Text className="text-sm font-bold text-gray-900" numberOfLines={1}>
                {member.profile?.username || 'Unknown User'}
              </Text>
              <Text className="text-xs text-gray-500">
                {member.profile?.user_tag ? `@${member.profile.user_tag}` : 'No user tag'}
              </Text>
            </View>
          </View>

          {showStatus && (
            <Text className={`text-xs font-semibold px-2 py-1 rounded-full ${statusBadgeClass(status)}`}>
              {status === 'not_marked' ? 'NOT MARKED' : status.toUpperCase()}
            </Text>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  if (isLoading) {
    return (
      <View className="mx-4 bg-white border border-gray-200 rounded-2xl p-6 items-center">
        <ActivityIndicator size="large" />
        <Text className="text-gray-500 mt-3">Loading today session...</Text>
      </View>
    );
  }

  return (
    <View className="mx-4">
      <View className="bg-white rounded-2xl border border-gray-200 p-4 mb-4">
        <View className="flex-row items-center justify-between mb-2">
          <View className="flex-row items-center">
            <Ionicons name="today-outline" size={16} color="#111827" />
            <Text className="text-base font-bold text-gray-900 ml-2">Today Session</Text>
          </View>
          <TouchableOpacity onPress={() => loadSession(true)} disabled={isRefreshing} className="px-3 py-1.5 bg-gray-100 rounded-lg flex-row items-center">
            <Ionicons name="refresh-outline" size={14} color="#374151" />
            <Text className="text-xs font-semibold text-gray-700 ml-1">{isRefreshing ? 'Refreshing...' : 'Refresh'}</Text>
          </TouchableOpacity>
        </View>
        <Text className="text-xs text-gray-500">{className || 'Class'} • Auto refresh every 30 seconds</Text>
      </View>

      <View className="bg-white rounded-2xl border border-gray-200 p-4 mb-4">
        <View className="flex-row items-center mb-3">
          <Ionicons name="checkmark-circle-outline" size={15} color="#047857" />
          <Text className="text-sm font-bold text-emerald-700 ml-1.5">Already Arrived ({arrivedMembers.length})</Text>
        </View>
        {arrivedMembers.length === 0 ? (
          <Text className="text-sm text-gray-500">No members have arrived yet.</Text>
        ) : (
          <ScrollView nestedScrollEnabled>
            {arrivedMembers.map((member) => renderMemberRow(member, true))}
          </ScrollView>
        )}
      </View>

      <View className="bg-white rounded-2xl border border-gray-200 p-4 mb-2">
        <View className="flex-row items-center mb-3">
          <Ionicons name="time-outline" size={15} color="#B45309" />
          <Text className="text-sm font-bold text-amber-700 ml-1.5">Not Yet Arrived ({pendingMembers.length})</Text>
        </View>
        {pendingMembers.length === 0 ? (
          <Text className="text-sm text-gray-500">All members are marked as arrived.</Text>
        ) : (
          <ScrollView nestedScrollEnabled>
            {pendingMembers.map((member) => renderMemberRow(member, false))}
          </ScrollView>
        )}
      </View>

      <View className="flex-row items-center mt-2 mb-2">
        <Ionicons name="information-circle-outline" size={14} color="#6B7280" />
        <Text className="text-xs text-gray-500 ml-1.5">Tip: Hold a member row to update precence status manually.</Text>
      </View>

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
              Choose a new status for {manualStatusTarget?.profile?.username || 'this member'}.
            </Text>

            <View className="gap-2">
              {(['present', 'late', 'excused', 'absent'] as const).map((status) => (
                <TouchableOpacity
                  key={`manual-status-${status}`}
                  onPress={() => handleSelectStatus(status)}
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
    </View>
  );
}
