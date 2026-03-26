import { createClient } from"@supabase/supabase-js";

const supabaseUrl ="https://tyqlluojdbhdghziolpq.supabase.co";

const supabaseAnonKey ="sb_publishable_8sAqXMNY2b5d5GLiWED84g_YBKFgxPX";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);