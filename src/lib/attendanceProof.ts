import { supabase } from '@/src/lib/supabase';
import { signedPost } from '@/src/lib/securityServices';

const normalizeRemoteUrl = (value: string) => {
  const trimmed = value.trim();fwwefewfw
  if (!trimmed) return '';
  return encodeURI(trimmed);
};

const extractStoragePathFromUrl = (value: string) => {
  const markers = [
    '/storage/v1/object/public/attendance_proofs/',
    '/storage/v1/object/sign/attendance_proofs/',
    '/storage/v1/object/authenticated/attendance_proofs/',
  ];

  for (const marker of markers) {
    const index = value.indexOf(marker);
    if (index >= 0) {
      const start = index + marker.length;
      const rawPath = value.slice(start).split('?')[0];
      if (rawPath) return rawPath;
    }
  }

  return null;
};

export const toAttendanceProofStoragePath = (rawValue: string) => {
  const normalized = normalizeRemoteUrl(rawValue);
  if (!normalized) return null;

  let path = normalized;

  if (normalized.startsWith('http://') || normalized.startsWith('https://')) {
    const extracted = extractStoragePathFromUrl(normalized);
    if (!extracted) return null;
    path = extracted;
  }

  path = decodeURIComponent(path)
    .replace(/^\/+/, '')
    .replace(/^attendance_proofs\//i, '')
    .replace(/\\/g, '/');

  const segments = path.split('/').filter(Boolean);
  if (segments.length < 2) {
    return null;
  }

  const classSegment = segments[0].replace(/[\\/]/g, '_');
  const fileSegment = segments.slice(1).join('/').replace(/[\\]/g, '_');

  return `${classSegment}/${fileSegment}`;
};

export const resolveAttendanceProofUrl = async (rawValue: string, attendanceId?: string) => {
  const normalized = normalizeRemoteUrl(rawValue);
  if (!normalized) return '';

  const storagePath = toAttendanceProofStoragePath(normalized);
  if (storagePath) {
    const { data: signedData, error: signedError } = await supabase.storage
      .from('attendance_proofs')
      .createSignedUrl(storagePath, 60 * 60);

    if (!signedError && signedData?.signedUrl) {
      return normalizeRemoteUrl(signedData.signedUrl);
    }

    const { data: publicData } = supabase.storage
      .from('attendance_proofs')
      .getPublicUrl(storagePath);

    if (publicData?.publicUrl) {
      return normalizeRemoteUrl(publicData.publicUrl);
    }
  }

  if (attendanceId) {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      const accessToken = session?.access_token;
      if (accessToken) {
        const proofResponse = await signedPost(
          '/attendance/proof-url',
          {
            attendance_id: attendanceId,
            storage_path: storagePath || normalized,
          },
          accessToken,
        );

        const backendSignedUrl = proofResponse?.data?.signed_url;
        if (typeof backendSignedUrl === 'string' && backendSignedUrl.trim()) {
          return normalizeRemoteUrl(backendSignedUrl);
        }
      }
    } catch {
    }
  }

  return normalized;
};
