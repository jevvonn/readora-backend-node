import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config();
const supClient = createClient(
  process.env.SUPABASE_PROJECT_URL || "",
  process.env.SUPABASE_PROJECT_TOKEN || ""
);

export default supClient;
