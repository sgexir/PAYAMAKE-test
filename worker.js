const SMSIR_VERIFY_URL = "https://api.sms.ir/v1/send/verify";
const ALLOWED_ORIGIN = "https://staging.payamake.ir";

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin");

    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: corsHeaders(origin),
      });
    }

    if (request.method !== "POST") {
      return jsonResponse(
        { success: false, error: "Method Not Allowed" },
        405,
        origin
      );
    }

    try {
      if (!env.SMSIR_API_KEY) {
        return jsonResponse({ success: false, error: "SMSIR_API_KEY تنظیم نشده است." }, 500, origin);
      }
      if (!env.ADMIN_MOBILE) {
        return jsonResponse({ success: false, error: "ADMIN_MOBILE تنظیم نشده است." }, 500, origin);
      }
      if (!env.SMSIR_CUSTOMER_TEMPLATE_ID) {
        return jsonResponse({ success: false, error: "SMSIR_CUSTOMER_TEMPLATE_ID تنظیم نشده است." }, 500, origin);
      }
      if (!env.SMSIR_ADMIN_TEMPLATE_ID) {
        return jsonResponse({ success: false, error: "SMSIR_ADMIN_TEMPLATE_ID تنظیم نشده است." }, 500, origin);
      }
      if (!env.DB) {
        return jsonResponse({ success: false, error: "اتصال D1 با نام DB تنظیم نشده است." }, 500, origin);
      }

      let body;
      try {
        body = await request.json();
      } catch {
        return jsonResponse({ success: false, error: "داده ارسالی معتبر نیست." }, 400, origin);
      }

      const fullName = String(body.fullName || "").trim();
      const phone = String(body.phone || "").trim();
      const brand = String(body.brand || "").trim();
      const type = String(body.type || "").trim();
      const description = String(body.description || "").trim();
      const source = String(body.source || "homepage").trim();

      if (!fullName) {
        return jsonResponse({ success: false, error: "نام و نام خانوادگی الزامی است." }, 400, origin);
      }
      if (!phone) {
        return jsonResponse({ success: false, error: "شماره تماس الزامی است." }, 400, origin);
      }

      const normalizedPhone = normalizeIranMobile(phone);
      if (!normalizedPhone) {
        return jsonResponse({ success: false, error: "شماره موبایل معتبر نیست." }, 400, origin);
      }

      const adminMobile = normalizeIranMobile(env.ADMIN_MOBILE);
      if (!adminMobile) {
        return jsonResponse({ success: false, error: "ADMIN_MOBILE معتبر نیست." }, 500, origin);
      }

      const safeFullName = limitForPattern(fullName);
      const safeBrand = limitForPattern(brand);
      const safeType = limitForPattern(type);
      const safeDescription = limitForPattern(description);

      const insertResult = await env.DB.prepare(
        `INSERT INTO leads (
          full_name,
          phone,
          brand,
          type,
          description,
          source,
          customer_sms_status,
          admin_sms_status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
        .bind(
          safeFullName,
          normalizedPhone,
          safeBrand,
          safeType,
          safeDescription,
          source || "homepage",
          "pending",
          "pending"
        )
        .run();

      const leadId = insertResult.meta?.last_row_id;
      if (!leadId) {
        console.error("D1 insert did not return a lead ID.");
        return jsonResponse({ success: false, error: "ذخیره درخواست انجام نشد." }, 500, origin);
      }

      let customerResult;
      try {
        customerResult = await sendVerifySMS({
          apiKey: env.SMSIR_API_KEY,
          mobile: normalizedPhone,
          templateId: Number(env.SMSIR_CUSTOMER_TEMPLATE_ID),
          parameters: [{ name: "FULLNAME", value: safeFullName }],
        });
      } catch (error) {
        console.error("Customer SMS error:", error);
        customerResult = {
          success: false,
          status: 0,
          data: { error: error instanceof Error ? error.message : "خطای ارسال پیامک مشتری" },
        };
      }

      await updateSmsStatus(
        env.DB,
        leadId,
        "customer_sms_status",
        customerResult.success ? "sent" : "failed"
      );

      let adminResult;
      try {
        adminResult = await sendVerifySMS({
          apiKey: env.SMSIR_API_KEY,
          mobile: adminMobile,
          templateId: Number(env.SMSIR_ADMIN_TEMPLATE_ID),
          parameters: [
            { name: "FULLNAME", value: safeFullName },
            { name: "PHONE", value: normalizedPhone },
            { name: "BRAND", value: safeBrand },
            { name: "TYPE", value: safeType },
            { name: "DESCRIPTION", value: safeDescription },
          ],
        });
      } catch (error) {
        console.error("Admin SMS error:", error);
        adminResult = {
          success: false,
          status: 0,
          data: { error: error instanceof Error ? error.message : "خطای ارسال پیامک مدیر" },
        };
      }

      await updateSmsStatus(
        env.DB,
        leadId,
        "admin_sms_status",
        adminResult.success ? "sent" : "failed"
      );

      return jsonResponse(
        {
          success: customerResult.success && adminResult.success,
          leadId,
          customerSms: { sent: customerResult.success, status: customerResult.status },
          adminSms: { sent: adminResult.success, status: adminResult.status },
        },
        200,
        origin
      );
    } catch (error) {
      console.error("Worker error:", error);
      return jsonResponse(
        {
          success: false,
          error: error instanceof Error ? error.message : "خطای ناشناخته",
        },
        500,
        origin
      );
    }
  },
};

async function sendVerifySMS({ apiKey, mobile, templateId, parameters }) {
  const response = await fetch(SMSIR_VERIFY_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      "x-api-key": apiKey,
    },
    body: JSON.stringify({ mobile, templateId, parameters }),
  });

  const text = await response.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = { raw: text };
  }

  console.log("SMS.ir response:", { status: response.status, data });

  return {
    success: response.ok,
    status: response.status,
    data,
  };
}

async function updateSmsStatus(db, leadId, column, status) {
  const allowedColumns = ["customer_sms_status", "admin_sms_status"];
  if (!allowedColumns.includes(column)) {
    throw new Error("Invalid SMS status column.");
  }

  await db
    .prepare(`UPDATE leads SET ${column} = ? WHERE id = ?`)
    .bind(status, leadId)
    .run();
}

function normalizeIranMobile(value) {
  let phone = String(value || "")
    .trim()
    .replace(/\s+/g, "")
    .replace(/-/g, "");

  if (phone.startsWith("+98")) {
    phone = "0" + phone.slice(3);
  } else if (phone.startsWith("98") && phone.length === 12) {
    phone = "0" + phone.slice(2);
  }

  return /^09\d{9}$/.test(phone) ? phone : null;
}

function limitForPattern(value) {
  return String(value || "").slice(0, 40);
}

function corsHeaders(origin) {
  const allowedOrigin = origin === ALLOWED_ORIGIN ? origin : ALLOWED_ORIGIN;

  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    Vary: "Origin",
  };
}

function jsonResponse(data, status = 200, origin = null) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=UTF-8",
      ...corsHeaders(origin),
    },
  });
}
