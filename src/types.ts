export type Role='manager'|'representative'|'viewer';
export type Kind='contacts'|'companies'|'deals'|'tasks';
export interface Session{workspace_id:string;member_id:string;role:Role;name:string;csrf:string;expires_at:string}
export interface Member{id:string;name:string;email:string;role:Role;active:boolean;version:number}
export interface CRMRecord{id:string;workspace_id:string;name?:string;title?:string;email?:string;phone?:string;job_title?:string;company_id?:string|null;contact_id?:string|null;deal_id?:string|null;owner_id:string;status?:string;source?:string;notes?:string;website?:string;industry?:string;size?:string;address?:string;value?:number;currency?:string;stage?:string;priority?:string;expected_close?:string;closed_at?:string|null;lost_reason?:string|null;next_action?:string;due_at?:string;completed_at?:string|null;archived?:boolean;version:number;created_at:string;updated_at:string}
export interface Activity{id:string;kind:string;entity_type:string;entity_id:string;company_id?:string;contact_id?:string;deal_id?:string;summary:string;created_at:string;actor_name?:string;member_id:string}
export interface Note{id:string;body:string;author:string;created_at:string}
export interface Stage{key:string;label:string;terminal:boolean;count?:number;value?:number}
export interface Reports{pipeline_value:number;open_deals:number;won_deals:number;lost_deals:number;won_value:number;conversion:number|null;overdue_tasks:number;upcoming_tasks:number;by_stage:Stage[];by_owner:{id:string;name:string;count:number;open_value:number;won_value:number}[]}
export interface Automation{id:string;deal_id:string;status:string;attempts:number;error_code?:string;created_at:string;delivered_at?:string}
export interface Bootstrap{session:Session;members:Member[];contacts:CRMRecord[];companies:CRMRecord[];deals:CRMRecord[];tasks:CRMRecord[];activities:Activity[];automation:Automation[];stages:Stage[];reports:Reports}
export interface Detail{record:CRMRecord;activities:Activity[];notes:Note[]}
export const roleNames:Record<Role,string>={manager:'Sales Manager',representative:'Sales Representative',viewer:'Viewer'};
export const labels:Record<Kind,string>={contacts:'contact',companies:'company',deals:'deal',tasks:'task'};
export const money=(n:number|undefined)=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(n||0);
export const dateLabel=(s:string|undefined)=>s?new Intl.DateTimeFormat('en-US',{month:'short',day:'numeric',year:'numeric'}).format(new Date(s.length===10?s+'T12:00:00':s)):'—';
export const titleCase=(s:string|undefined)=>(s||'').replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase());
export const canWrite=(s:Session,r?:CRMRecord)=>s.role==='manager'||s.role==='representative'&&(!r||r.owner_id===s.member_id);
export const overdue=(t:CRMRecord)=>t.status!=='completed'&&!!t.due_at&&new Date(t.due_at).getTime()<Date.now();
