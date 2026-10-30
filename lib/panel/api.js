import { ALL_PROVINCE_NAMES, rpc, throwIfError } from "@/lib/panel/format";

export async function ensureProfile(supabase) {
  return rpc(supabase, "ensure_my_profile");
}

export async function saveOnboarding(supabase, payload) {
  return rpc(supabase, "save_onboarding", {
    p_step: payload.step,
    p_full_name: payload.fullName ?? null,
    p_phone: payload.phone ?? null,
    p_usage_purposes: payload.usagePurposes ?? null,
    p_user_type: payload.userType ?? null,
    p_monthly_data_need: payload.monthlyNeed ?? null,
    p_target_business_description: payload.targetDescription ?? null,
    p_complete: Boolean(payload.complete),
  });
}

export async function createListRequest(supabase, payload) {
  const allTurkey = Boolean(payload.allTurkey);
  const cityList = allTurkey ? ALL_PROVINCE_NAMES : payload.cities;
  return rpc(supabase, "create_list_request", {
    p_title: payload.title,
    p_keywords: payload.keywords,
    p_cities: cityList,
    p_all_turkey: allTurkey,
    p_request_type: payload.requestType || "region_list",
    p_districts: allTurkey ? [] : payload.districts || [],
  });
}

export async function loadDashboard(supabase) {
  return rpc(supabase, "get_my_dashboard");
}

export async function loadLists(supabase) {
  const { data, error } = await supabase
    .from("list_requests")
    .select("*")
    .order("created_at", { ascending: false });
  throwIfError(error);
  return data || [];
}

export async function loadListDetail(supabase, id) {
  return rpc(supabase, "get_list_detail", { p_list_id: id });
}

export async function loadListRows(supabase, id, page = 0, pageSize = 25) {
  return rpc(supabase, "get_list_rows", {
    p_list_id: id,
    p_offset: page * pageSize,
    p_limit: pageSize,
  });
}

export async function unlockList(supabase, id) {
  return rpc(supabase, "unlock_list", { p_list_id: id });
}

export async function loadWallet(supabase, userId) {
  const { data, error } = await supabase
    .from("credit_wallets")
    .select("balance")
    .eq("user_id", userId)
    .maybeSingle();
  throwIfError(error);
  return data;
}

export async function loadPackages(supabase) {
  const { data, error } = await supabase
    .from("credit_packages")
    .select("*")
    .eq("is_active", true)
    .order("sort_order");
  throwIfError(error);
  return data || [];
}

export async function loadTransactions(supabase) {
  const { data, error } = await supabase
    .from("credit_transactions")
    .select("*")
    .order("created_at", { ascending: false });
  throwIfError(error);
  return data || [];
}

export async function loadCreditRequests(supabase) {
  const { data, error } = await supabase
    .from("credit_requests")
    .select("*")
    .order("created_at", { ascending: false });
  throwIfError(error);
  return data || [];
}

export async function createCreditRequest(supabase, { packageId, email, phone }) {
  return rpc(supabase, "create_credit_request", {
    p_package_id: packageId,
    p_email: email,
    p_phone: phone,
  });
}

export async function adminLoadCreditRequests(supabase) {
  const { data, error } = await supabase
    .from("credit_requests")
    .select("*, profiles!credit_requests_user_id_fkey(full_name, email, phone)")
    .order("created_at", { ascending: false })
    .limit(200);
  throwIfError(error);
  return data || [];
}

export async function adminSetCreditRequestStatus(supabase, id, status, note) {
  return rpc(supabase, "admin_set_credit_request_status", {
    p_request_id: id,
    p_status: status,
    p_note: note || null,
  });
}

export async function loadAccount(supabase, userId) {
  const [{ data: profile, error: pErr }, { data: prefs, error: nErr }, { data: onboarding, error: oErr }] =
    await Promise.all([
      supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
      supabase.from("notification_preferences").select("*").eq("user_id", userId).maybeSingle(),
      supabase.from("onboarding_responses").select("*").eq("user_id", userId).maybeSingle(),
    ]);
  throwIfError(pErr);
  throwIfError(nErr);
  throwIfError(oErr);
  return { profile, prefs, onboarding };
}

export async function updateProfile(supabase, fullName, phone) {
  return rpc(supabase, "update_my_profile", {
    p_full_name: fullName,
    p_phone: phone,
  });
}

export async function updateNotifications(supabase, prefs) {
  return rpc(supabase, "update_notification_preferences", {
    p_email_enabled: prefs.emailEnabled,
    p_sms_enabled: prefs.smsEnabled,
    p_whatsapp_enabled: prefs.whatsappEnabled,
    p_marketing_email_enabled: prefs.marketingEnabled,
  });
}

export async function adminSearchCustomers(supabase, query) {
  return rpc(supabase, "admin_search_customers", {
    p_query: query || "",
    p_limit: 40,
  });
}

export async function adminGetCustomer(supabase, userId) {
  return rpc(supabase, "admin_get_customer", { p_user_id: userId });
}

export async function adminGrantCredits(supabase, payload) {
  return rpc(supabase, "admin_grant_credits", {
    p_user_id: payload.userId,
    p_package_id: payload.packageId,
    p_payment_reference: payload.paymentReference || null,
    p_note: payload.note || null,
  });
}

export async function adminLoadListRequests(supabase) {
  const { data, error } = await supabase
    .from("list_requests")
    .select("*, profiles!list_requests_user_id_fkey(full_name, email)")
    .order("created_at", { ascending: false })
    .limit(100);
  throwIfError(error);
  return data || [];
}

export async function adminCompleteList(supabase, id) {
  return rpc(supabase, "admin_complete_list_request", { p_list_id: id });
}

export async function adminFailList(supabase, id, message) {
  return rpc(supabase, "admin_fail_list_request", {
    p_list_id: id,
    p_message: message,
  });
}

export async function adminSetProcessing(supabase, id) {
  return rpc(supabase, "admin_set_list_processing", { p_list_id: id });
}

export async function adminLoadPackages(supabase) {
  const { data, error } = await supabase
    .from("credit_packages")
    .select("*")
    .order("sort_order");
  throwIfError(error);
  return data || [];
}

export async function adminUpdatePackageUrl(supabase, id, shopierUrl) {
  const { error } = await supabase
    .from("credit_packages")
    .update({ shopier_url: shopierUrl || null })
    .eq("id", id);
  throwIfError(error);
}
