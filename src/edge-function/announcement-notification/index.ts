import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

// @ts-ignore

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
// @ts-ignore
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

serve(async (req) => {
  console.log("🔔 Webhook received! Processing announcement...");

  try {
    const payload = await req.json();
    console.log("📦 Payload Body:", JSON.stringify(payload, null, 2));

    const { type, table, record } = payload;

    // 1. Guard Clause
    if (type !== 'INSERT' || table !== 'announcements') {
      console.log(`⚠️ Ignored event: ${type} on ${table}`);
      return new Response("Not an insert event, ignoring...", { status: 200 });
    }

    if (!record) {
      console.error("❌ Error: No record found in payload");
      throw new Error("No record found in payload");
    }

    const { class_id, content, instructor_id } = record;
    console.log(`📝 Extracting: Class=${class_id}, Instructor=${instructor_id}`);
    
    // 2. Ambil Nama Kelas & Nama Dosen
    const { data: classData, error: dbError } = await supabase
      .from('classes')
      .select(`
        name, 
        profiles!owner_id ( username )
      `) 
      .eq('id', class_id)
      .single();

    if (dbError) {
      console.error("❌ Supabase Query Error (Class):", dbError.message);
    }

    const className = classData?.name || "Unknown Class";
    // Sesuaikan kalau array (tergantung struktur datamu), biasanya object tunggal kalau .single()
    const instructorName = classData?.profiles?.username || classData?.profiles?.[0]?.username || "Instructor";
    
    console.log(`🏢 Context: Class Name: ${className}, By: ${instructorName}`);

    // ==========================================
    // 3. LOGIKA EXPO PUSH: Tarik Token Mahasiswa
    // ==========================================
    console.log("🔍 Mencari token Expo mahasiswa...");
    
    const { data: members, error: membersError } = await supabase
      .from('class_members')
      .select(`
        user_id,
        profiles ( push_token )
      `)
      .eq('class_id', class_id)
      .neq('user_id', instructor_id); 

    if (membersError) throw membersError;

    // Filter hanya yang punya token valid
    const tokens = members
      ?.map((m: any) => m.profiles?.push_token)
      .filter((token: string | null) => token && token.startsWith('ExponentPushToken')) || [];

    if (tokens.length === 0) {
      console.log(`📭 [Expo Push] Batal kirim. Tidak ada mahasiswa dengan token valid di kelas ${className} selain pengirim.`);
      return new Response(JSON.stringify({ message: "No valid tokens found" }), { status: 200 });
    }

    console.log(`🚀 Mengirim Expo Push ke ${tokens.length} perangkat...`);

    // 4. Tembak ke Server Expo
    const expoResponse = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: {
        "Accept": "application/json",
        "Accept-encoding": "gzip, deflate",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        to: tokens, // Langsung kirim ke banyak token sekaligus
        sound: "default",
        title: `📢 ${className}`,
        body: `${instructorName}: ${content}`,
        data: {
          type: "ANNOUNCEMENT",
          classId: class_id,
          announcementId: record.id
        }
      })
    });

    const result = await expoResponse.json();
    
    if (!expoResponse.ok) {
      console.error("❌ Expo API Error:", JSON.stringify(result));
      return new Response(JSON.stringify(result), { status: expoResponse.status });
    }

    console.log("✅ Expo Push Success:", JSON.stringify(result));
    return new Response(JSON.stringify(result), { status: 200 });

  } catch (error) {
    console.error("💥 Critical Function Error:", error.message);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
})