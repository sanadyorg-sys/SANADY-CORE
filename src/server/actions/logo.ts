"use server";

import { revalidatePath } from "next/cache";
import { errorMessage, messageFor } from "@/lib/errors";
import { createClient } from "@/lib/supabase/server";
import type { ActionState } from "@/lib/types";
import { uuidSchema } from "@/lib/validation";
import { requireEnterpriseStaff } from "@/server/auth";
import { checkLogo } from "@/server/logo";

/** Company logo (enterprise manager). Storage and database rules re-check who may do it. */

const page = (tenantId: string) => `/admin/partenariats/entreprises/espaces/${tenantId}`;

export async function uploadTenantLogo(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireEnterpriseStaff();
  const tenant = uuidSchema.safeParse(formData.get("tenant_id"));
  if (!tenant.success) return { ok: false, message: messageFor("not_found") };
  const file = formData.get("logo");
  if (!(file instanceof File) || file.size === 0) return { ok: false, fieldErrors: { logo: "Choisissez un fichier PNG ou JPEG." } };
  const bytes = new Uint8Array(await file.arrayBuffer());
  const check = await checkLogo(bytes);
  if (!check.ok) return { ok: false, fieldErrors: { logo: check.message } };

  const supabase = await createClient();
  const path = `${tenant.data}/logo-${Date.now()}.${check.type}`;
  const { error: up } = await supabase.storage.from("enterprise-logos").upload(path, bytes, { contentType: check.type === "png" ? "image/png" : "image/jpeg", upsert: false });
  if (up) return { ok: false, message: "Le logo n’a pas pu être enregistré. Réessayez." };
  const { data: old, error } = await supabase.rpc("set_tenant_logo", { p_tenant: tenant.data, p_path: path });
  if (error) {
    await supabase.storage.from("enterprise-logos").remove([path]);
    return { ok: false, message: errorMessage(error) };
  }
  if (old) await supabase.storage.from("enterprise-logos").remove([old as string]);
  revalidatePath(page(tenant.data));
  return { ok: true, message: "Logo enregistré. Il apparaît dans l’espace de l’entreprise et sur les documents de ses formations." };
}

export async function removeTenantLogo(tenantId: string): Promise<ActionState> {
  await requireEnterpriseStaff();
  if (!uuidSchema.safeParse(tenantId).success) return { ok: false, message: messageFor("not_found") };
  const supabase = await createClient();
  const { data: old, error } = await supabase.rpc("set_tenant_logo", { p_tenant: tenantId, p_path: null });
  if (error) return { ok: false, message: errorMessage(error) };
  if (old) await supabase.storage.from("enterprise-logos").remove([old as string]);
  revalidatePath(page(tenantId));
  return { ok: true, message: "Logo retiré." };
}
