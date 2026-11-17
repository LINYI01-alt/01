// Supabase browser configuration.
// The publishable key is designed for browser use; never put a service_role/secret key here.
window.LINYI_SUPABASE_URL = "https://rhmoeecrznpkhtkoktng.supabase.co";
window.LINYI_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_rKZZQZ5ULF11IcXyWHggmg_CX24p7od";

window.linyiCreateSupabaseClient = function () {
  if (!window.supabase || !window.supabase.createClient) {
    throw new Error("Supabase SDK 未加载，请检查网络连接后刷新页面。");
  }
  return window.supabase.createClient(
    window.LINYI_SUPABASE_URL,
    window.LINYI_SUPABASE_PUBLISHABLE_KEY
  );
};
