import { createClient } from "@supabase/supabase-js";

const client = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_KEY
);

export default async function handler(req, res) {

    await client
        .from("users")
        .select("id")
        .limit(1);

    res.status(200).json({
        status: "OK",
        time: new Date()
    });

}