import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { buildCsv, buildXlsx, exportFilename } from "@/lib/panel/export";

export const dynamic = "force-dynamic";

export async function GET(request, context) {
  const { id } = await context.params;
  const url = new URL(request.url);
  const kind = url.searchParams.get("kind") === "full" ? "full" : "preview";
  const format = url.searchParams.get("format") === "xlsx" ? "xlsx" : "csv";
  const previewOnly = kind !== "full";

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Oturum gerekli." }, { status: 401 });
  }

  const { data, error } = await supabase.rpc("get_list_export", {
    p_list_id: id,
    p_preview_only: previewOnly,
  });
  if (error) {
    const status = /açmalısın|yetkin yok|bulunamadı|hazır değil/i.test(error.message)
      ? 403
      : 400;
    return NextResponse.json({ error: error.message }, { status });
  }

  const title = data?.title || "liste";
  const rows = data?.rows || [];
  const filename = exportFilename(title, format, previewOnly);

  if (format === "xlsx") {
    const body = buildXlsx(rows);
    return new NextResponse(body, {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  }

  return new NextResponse(buildCsv(rows), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
