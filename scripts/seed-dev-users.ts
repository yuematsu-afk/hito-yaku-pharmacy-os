// scripts/seed-dev-users.ts
import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

type DevUserRole = "admin" | "pharmacy" | "patient";

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// service_role で管理者クライアントを作成
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

type DevUserSeed = {
  email: string;
  password: string;
  role: DevUserRole;
  displayName: string;
};

const DEV_USERS: DevUserSeed[] = [
  {
    email: "dev-admin@hito-yaku.local",
    password: "123456", // 好きな開発用パスワードに変更OK
    role: "admin",
    displayName: "Dev Admin",
  },
  {
    email: "dev-pharmacy@hito-yaku.local",
    password: "123456",
    role: "pharmacy",
    displayName: "Dev Pharmacy",
  },
  {
    email: "dev-patient@hito-yaku.local",
    password: "123456",
    role: "patient",
    displayName: "Dev Patient",
  },
];

async function main() {
  console.log("=== Seed dev users ===");

  // 1. 既存ユーザー一覧を取得して、同じ email がないか確認
  const { data: listData, error: listError } =
    await supabase.auth.admin.listUsers();

  if (listError) {
    console.error("Failed to list users:", listError);
    process.exit(1);
  }

  const existingUsers = listData?.users ?? [];

  for (const seed of DEV_USERS) {
    console.log(`\n--- Processing ${seed.email} (${seed.role}) ---`);

    // 既存ユーザーがいるかどうかを email でチェック
    const existing = existingUsers.find((u) => u.email === seed.email);

    let userId: string;

    if (existing) {
      console.log(`User already exists: ${seed.email} (id=${existing.id})`);
      userId = existing.id;
      // メタデータだけ更新してロールを揃えておく
      const { error: metaError } = await supabase.auth.admin.updateUserById(
        userId,
        {
          user_metadata: {
            ...(existing.user_metadata ?? {}),
            role: seed.role,
            display_name: seed.displayName,
          },
        }
      );
      if (metaError) {
        console.error("Failed to update user metadata:", metaError);
      } else {
        console.log("Updated user metadata (role / display_name).");
      }
    } else {
      console.log(`Creating new user: ${seed.email}`);
      const { data, error: createError } =
        await supabase.auth.admin.createUser({
          email: seed.email,
          password: seed.password,
          email_confirm: true, // メール確認済み状態にする
          user_metadata: {
            role: seed.role,
            display_name: seed.displayName,
          },
        });

      if (createError || !data.user) {
        console.error("Failed to create user:", createError);
        continue;
      }

      userId = data.user.id;
      console.log(`Created user: ${seed.email} (id=${userId})`);
    }

    // 2. profiles を upsert（auth.users.id と合わせる）
    {
      const { error: profilesError } = await supabase
        .from("profiles")
        .upsert(
          {
            id: userId,
            email: seed.email,
            full_name: seed.displayName,
            role: seed.role,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "id" }
        );

      if (profilesError) {
        console.error("profiles upsert error:", profilesError);
      } else {
        console.log("profiles upsert OK");
      }
    }

    // 3. profile_users も upsert（将来の互換用）
    {
      const accountType =
        seed.role === "admin"
          ? "admin_user"
          : seed.role === "pharmacy"
          ? "pharmacy_user"
          : "patient_user";

      const { error: puError } = await supabase
        .from("profile_users")
        .upsert(
          {
            auth_user_id: userId,
            role: seed.role,
            display_name: seed.displayName,
            account_type: accountType,
          },
          { onConflict: "auth_user_id" }
        );

      if (puError) {
        console.error("profile_users upsert error:", puError);
      } else {
        console.log("profile_users upsert OK");
      }
    }
  }

  console.log("\n=== Done. ===");
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
