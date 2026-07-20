import { createClient } from "@supabase/supabase-js";
import 'dotenv/config';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function run() {
  try {
    let query = supabaseAdmin
      .from("reports")
      .select("id, public_id, description, category_id, status, created_at")
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(7);

    query = query.in("category_id", [1, 2]);

    const { data, error } = await query;
    console.log("Error:", error);
    console.log("Data:", data?.length);
  } catch (err) {
    console.error("Caught exception:", err);
  }
}

run();
