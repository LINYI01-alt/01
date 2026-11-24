// Supabase browser configuration.
// The publishable key is designed for browser use; never put a service_role/secret key here.
window.LINYI_SUPABASE_URL = "https://rhmoeecrznpkhtkoktng.supabase.co";
window.LINYI_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_rKZZQZ5ULF11IcXyWHggmg_CX24p7od";

let linyiSupabaseClient = null;
window.linyiCreateSupabaseClient = function () {
  if (!window.supabase || !window.supabase.createClient) {
    throw new Error("Supabase SDK 未加载，请检查网络连接后刷新页面。");
  }
  if (!linyiSupabaseClient) {
    linyiSupabaseClient = window.supabase.createClient(
      window.LINYI_SUPABASE_URL,
      window.LINYI_SUPABASE_PUBLISHABLE_KEY,
      {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
          storageKey: "sb-rhmoeecrznpkhtkoktng-auth-token"
        },
        global: {
          fetch: (input, init = {}) => {
            if (init.signal || typeof AbortSignal === "undefined" || typeof AbortSignal.timeout !== "function") {
              return fetch(input, init);
            }
            return fetch(input, { ...init, signal: AbortSignal.timeout(20000) });
          }
        }
      }
    );
  }
  return linyiSupabaseClient;
};
