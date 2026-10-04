import test from "node:test";
import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";
import { createAnalyticsRepository } from "../lib/supabase/analytics-repository.ts";
test("analytics adapter pages snapshots, pins ownership and surfaces failures",async()=>{
  const owner="11111111-1111-4111-8111-111111111111";
  let account=owner,failed=false;
  const requests:URL[]=[];
  const row={id:"e",task_id:"t",completed_at:"2026-10-04T12:00:00Z",manual_minutes:null,predicted_minutes:"30",effective_minutes:"30",effective_source:"prediction",prediction_source:"course",sample_size:3};
  const client=createClient("https://fixture.supabase.co","fixture-key",{accessToken:async()=>"fixture-token",global:{fetch:async(input)=>{
    const url=new URL(String(input));requests.push(url);
    if(failed)return new Response(JSON.stringify({message:"Missing snapshot table"}),{status:400});
    return new Response(JSON.stringify(url.searchParams.get("offset")==="0"?Array.from({length:500},()=>row):[row]),{status:200,headers:{"Content-Type":"application/json"}});
  }}});
  Object.defineProperty(client,"auth",{value:{getUser:async()=>({data:{user:{id:account}},error:null})}});
  const repository=createAnalyticsRepository(client,owner);
  const rows=await repository.listEstimates();assert.equal(rows.length,501);assert.equal(rows[0].predictedMinutes,30);assert.equal(rows[0].manualMinutes,null);
  for(const url of requests){assert.equal(url.pathname,"/rest/v1/completion_estimates");assert.equal(url.searchParams.get("user_id"),"eq."+owner);assert.equal(url.searchParams.get("limit"),"500");assert.equal(url.searchParams.get("order"),"id.asc");}
  account="other";await assert.rejects(repository.listEstimates(),/session changed/);assert.equal(requests.length,2);
  account=owner;failed=true;await assert.rejects(repository.listEstimates(),/M6 migration/);
});
