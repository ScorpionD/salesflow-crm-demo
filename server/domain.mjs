import { z } from 'zod';
export const stages = [
 { key:'new',label:'New',terminal:false },{ key:'qualified',label:'Qualified',terminal:false },
 { key:'proposal',label:'Proposal',terminal:false },{ key:'negotiation',label:'Negotiation',terminal:false },
 { key:'won',label:'Won',terminal:true },{ key:'lost',label:'Lost',terminal:true },
];
export const roles=['manager','representative','viewer'];
export class AppError extends Error { constructor(status,code,message,fields){super(message);this.status=status;this.code=code;this.fields=fields;} }
export function assert(condition,status,code,message){if(!condition)throw new AppError(status,code,message);}
const text=(max=120)=>z.string().trim().max(max);
const id=z.string().uuid();
const optionalId=id.nullable().default(null);
const owner={owner_id:id};
const priority=z.enum(['low','medium','high']).default('medium');
export const date=z.string().regex(/^\d{4}-\d{2}-\d{2}$/,'Use YYYY-MM-DD').refine(s=>!Number.isNaN(Date.parse(s))&&new Date(s).toISOString().slice(0,10)===s,'Choose a valid calendar date');
const phone=text(40).default('');
const notes=text(2000).default('');
export const schemas={
 companies:z.object({name:text().min(2),website:text(250).refine(s=>!s||/^https?:\/\//i.test(s),'Use an http(s) website').refine(s=>{try{return !s||Boolean(new URL(s).hostname);}catch{return false;}},'Enter a valid website').default(''),industry:text(80).default(''),size:z.enum(['1–10','11–50','51–200','201–500','500+','']).default(''),phone,address:text(240).default(''),notes,...owner}).strict(),
 contacts:z.object({name:text().min(2),email:z.email().max(180).transform(s=>s.toLowerCase()),phone,job_title:text(120).default(''),company_id:optionalId,...owner,status:z.enum(['lead','active','customer']).default('lead'),source:text(80).default('Website'),notes}).strict(),
 deals:z.object({title:text(150).min(2),company_id:id,contact_id:optionalId,...owner,value:z.number().finite().min(0).max(100000000).multipleOf(0.01),currency:z.literal('USD').default('USD'),expected_close:date,priority,next_action:text(240).default(''),notes}).strict(),
 tasks:z.object({title:text(150).min(2),due_at:z.iso.datetime({offset:true}),...owner,company_id:optionalId,contact_id:optionalId,deal_id:optionalId,priority,status:z.enum(['open','in_progress','completed']).default('open')}).strict().refine(t=>[t.company_id,t.contact_id,t.deal_id].filter(Boolean).length<=1,'Choose one related record'),
};
export function parse(schema,data){const r=schema.safeParse(data);if(!r.success)throw new AppError(422,'VALIDATION','Please check the highlighted fields.',Object.fromEntries(r.error.issues.map(i=>[i.path.join('.')||'form',i.message])));return r.data;}
export const stageSchema=z.object({stage:z.enum(stages.map(s=>s.key)),version:z.number().int().positive(),lost_reason:text(500).optional()}).strict();
export function checkWrite(actor,record){assert(actor.role!=='viewer',403,'READ_ONLY','Viewer access is read-only.');if(record&&actor.role==='representative')assert(record.owner_id===actor.member_id,403,'FORBIDDEN','Only the assigned representative can change this record.');}
export function checkVersion(current,version){assert(Number.isInteger(version)&&version===current.version,409,'CONFLICT','This record changed in another tab. Reload the latest version before saving.');}
export function stageChange(actor,current,input,now=new Date()){
 checkWrite(actor,current);checkVersion(current,input.version);
 assert(stages.some(s=>s.key===input.stage),422,'INVALID_STAGE','Choose a valid pipeline stage.');
 if(current.stage===input.stage)return null;
 if(['won','lost'].includes(current.stage))assert(actor.role==='manager',403,'CLOSED_DEAL','Only a manager can reopen or change a closed deal.');
 assert(input.stage!=='lost'||(input.lost_reason||'').trim().length>=3,422,'LOST_REASON','Add a short reason before marking a deal lost.');
 return {stage:input.stage,closed_at:['won','lost'].includes(input.stage)?now.toISOString():null,lost_reason:input.stage==='lost'?input.lost_reason.trim():null};
}
export function isOverdue(task,now=new Date()){return task.status!=='completed'&&new Date(task.due_at).getTime()<now.getTime();}
export function reports(deals,tasks,members,now=new Date()){
 const active=deals.filter(d=>!d.archived||['won','lost'].includes(d.stage)),open=active.filter(d=>!['won','lost'].includes(d.stage)),won=active.filter(d=>d.stage==='won'),lost=active.filter(d=>d.stage==='lost');
 const sum=xs=>Math.round(xs.reduce((n,d)=>n+Number(d.value),0)*100)/100;
 return {pipeline_value:sum(open),open_deals:open.length,won_deals:won.length,lost_deals:lost.length,won_value:sum(won),conversion:won.length+lost.length?Math.round(won.length/(won.length+lost.length)*100):null,
 overdue_tasks:tasks.filter(t=>isOverdue(t,now)).length,upcoming_tasks:tasks.filter(t=>t.status!=='completed'&&!isOverdue(t,now)&&new Date(t.due_at).getTime()<=now.getTime()+7*86400000).length,
 by_stage:stages.map(s=>({...s,count:active.filter(d=>d.stage===s.key).length,value:sum(active.filter(d=>d.stage===s.key))})),
 by_owner:members.filter(m=>m.role!=='viewer').map(m=>({id:m.id,name:m.name,count:active.filter(d=>d.owner_id===m.id).length,open_value:sum(open.filter(d=>d.owner_id===m.id)),won_value:sum(won.filter(d=>d.owner_id===m.id))}))};
}
