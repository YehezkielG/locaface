import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
/// @ts-ignore
Deno.serve(async (req) => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  )
  
  try {
    const today = new Date().toISOString().split('T')[0];
    const { data: classes, error } = await supabase
      .from('classes')
      .select('id, name, start_time, day_of_week, timezone, late_tolerance, is_accepting_absen')
      .or(`valid_until.gte.${today},valid_until.is.null`);
      
    if (error) throw error;

    for (const cls of classes) {
      // 1. Ambil Waktu Lokal Spesifik (Format 24 Jam Pasti)
      const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: cls.timezone,
        weekday: 'long', 
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
        hourCycle: 'h23' // WAJIB: Biar tengah malam itu 00, bukan 24
      });

      const parts = formatter.formatToParts(new Date());
      const dayName = parts.find(p => p.type === 'weekday')!.value; 
      const hourStr = parts.find(p => p.type === 'hour')!.value;
      const minuteStr = parts.find(p => p.type === 'minute')!.value;

      const dayMap: Record<string, number> = {
        'Monday': 1, 'Tuesday': 2, 'Wednesday': 3, 'Thursday': 4,
        'Friday': 5, 'Saturday': 6, 'Sunday': 7
      };
      const localDay = dayMap[dayName];
      const localTime = `${hourStr}:${minuteStr}`;

      // ==========================================
      // 2. LOGIKA BARU: MATEMATIKA MENIT (Lebih Aman)
      // ==========================================
      const currentMins = parseInt(hourStr) * 60 + parseInt(minuteStr);
      
      const [startH, startM] = cls.start_time.split(':').map(Number);
      const startMins = startH * 60 + startM;

      const openMins = startMins - 15; // Buka 15 menit sebelum kelas
      const limitMins = startMins + cls.late_tolerance; // Tutup setelah toleransi

      // 3. Eksekusi Buka Absen
      if (cls.day_of_week.includes(localDay) && currentMins >= openMins && currentMins < startMins) {    
        if (!cls.is_accepting_absen) {
          await supabase
            .from('classes')
            .update({ is_accepting_absen: true })
            .eq('id', cls.id);
            
          await pushNotif(cls.id, cls.name, supabase);
          console.log(`[NOTIF] Sent to ${cls.name} at ${localTime} (Local)`);
        }
      }

      // 4. Eksekusi Tutup Absen
      if (cls.is_accepting_absen && currentMins >= limitMins) {
        await supabase
          .from('classes')
          .update({ is_accepting_absen: false })
          .eq('id', cls.id);
          
        console.log(`[DB] Absen ${cls.name} sudah ditutup otomatis pada ${localTime}.`);
         const { data: members, error: errMembers } = await supabase
          .from('class_members')
          .select('user_id')
          .eq('class_id', cls.id);

        // C. Tarik data absensi khusus hari ini untuk kelas ini
        const { data: presences, error: errPresences } = await supabase
          .from('attendances')
          .select('user_id')
          .eq('class_id', cls.id)
          .gte('presence_at', `${today}T00:00:00Z`) // Filter absen hari ini
          // .neq('user_id', cls.owner_id); // <-- (Opsional) Buka komen ini jika objek 'cls' memiliki properti 'owner_id'


        if (!errMembers && !errPresences && members) {
          // Kumpulkan ID anak-anak yang SUDAH absen
          const presentIds = (presences || []).map(p => p.user_id);

          // Saring anak-anak yang BELUM absen
          const absentMembers = members.filter(m => !presentIds.includes(m.user_id));

          // D. Eksekusi Bulk Insert status 'absent'
          if (absentMembers.length > 0) {
            const absentRecords = absentMembers.map(m => ({
              class_id: cls.id,
              user_id: m.user_id,
              status: 'absent',
              presence_at: new Date().toISOString() // Waktu tutup kelas
            }));

            const { error: errInsert } = await supabase
              .from('attendances')
              .insert(absentRecords);

            if (!errInsert) {
              console.log(`[AUTO-ABSENT] Berhasil menandai ${absentRecords.length} mahasiswa alpa di kelas ${cls.name}.`);
            } else {
              console.error(`[AUTO-ABSENT ERROR] Gagal insert:`, errInsert.message);
            }
          } else {
             console.log(`[AUTO-ABSENT] Hebat! Semua mahasiswa hadir di kelas ${cls.name}.`);
          }
        }
      }
      }
    

    return new Response(
      JSON.stringify({ message: "Attendance check completed successfully!" }),
      {
        headers: { "Content-Type": "application/json" },
        status: 200
      }
    );
  } catch (err) {
    console.error("🔥 Error di Cron Job:", err.message);
    return new Response(err.message, { status: 500 });
  }
})

// --- FUNGSI NOTIFIKASI EXPO PUSH ---
async function pushNotif(classId: string, className: string, supabase: any) {
  console.log(`📡 [Expo Push] Menyiapkan notifikasi untuk kelas: ${className}`);

  try {
    // 1. Cari semua mahasiswa yang ada di kelas ini beserta tokennya
    const { data: members, error } = await supabase
      .from('class_members')
      .select(`
        profiles (
          push_token
        )
      `)
      .eq('class_id', classId);

    if (error) throw error;

    // 2. Kumpulkan token yang valid (nggak null dan beneran format Expo)
    const tokens = members
      .map((m: any) => m.profiles?.push_token)
      .filter((token: string | null) => token && token.startsWith('ExponentPushToken'));

    if (tokens.length === 0) {
      console.log(`📭 [Expo Push] Batal kirim. Tidak ada mahasiswa dengan token valid di kelas ${className}.`);
      return;
    }

    // 3. Bikin paket pesan (Expo bisa nerima bentuk array, maksimal 100 token sekali kirim)
    const message = {
      to: tokens, 
      sound: 'default',
      title: 'Attendance Window Open ⏰',
      body: `The session for ${className} has started. Please mark your attendance in Locaface.`,
      data: { classId: classId, type: "ATTENDANCE" }, // Data rahasia buat deep-linking di HP
    };

    // 4. Tembak langsung ke server satelit Expo! 🚀
    const response = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Accept-encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(message),
    });

    const result = await response.json();
    console.log(`✅ [Expo Push] Sukses mengirim ke ${tokens.length} perangkat! Result:`, JSON.stringify(result));
    
    return result;

  } catch (error) {
    console.error(`💥 [Expo Push Error] Gagal fetch ke server Expo:`, error.message);
    return { error: error.message };
  }
}