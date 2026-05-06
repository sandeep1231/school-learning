import "dotenv/config";
import { config as dotenvConfig } from "dotenv";
import { createAdminClient } from "./lib/supabase/admin";
dotenvConfig({ path: ".env.local" });
(async () => {
  const sb = createAdminClient();
  const { data: subs } = await sb.from("subjects").select("id,code,class_level").eq("board","BSE_ODISHA").in("class_level",[6,7,8]).in("code",["FLO","GSC","MTH","SLE","SSC","TLH"]).order("class_level").order("code");
  let tT=0,tL=0,tP=0;
  for (const s of subs ?? []) {
    const { data: chs } = await sb.from("chapters").select("id").eq("subject_id", s.id);
    const ids = (chs??[]).map((c:any)=>c.id);
    const { data: tps } = await sb.from("topics").select("id").in("chapter_id", ids);
    const tids = (tps??[]).map((t:any)=>t.id);
    if (!tids.length) continue;
    const { count: lc } = await sb.from("lesson_variants").select("*",{count:"exact",head:true}).in("topic_id", tids);
    const { count: pc } = await sb.from("practice_items").select("*",{count:"exact",head:true}).eq("scope_type","topic").in("scope_id", tids);
    tT+=tids.length; tL+=(lc??0); tP+=(pc??0);
    console.log(`C${s.class_level} ${s.code}: ${tids.length}t ${lc}/${tids.length*4}L ${pc}/${tids.length*8}P`);
  }
  console.log(`\nTOTAL: ${tT}t ${tL}/${tT*4}L ${tP}/${tT*8}P`);
})();
