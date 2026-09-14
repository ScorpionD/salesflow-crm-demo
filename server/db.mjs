import pg from 'pg';
import {randomUUID} from 'node:crypto';
import {stages} from './domain.mjs';
pg.types.setTypeParser(1082,value=>value);
pg.types.setTypeParser(1700,value=>Number(value));
export const makePool=url=>new pg.Pool({connectionString:url,max:8,idleTimeoutMillis:15000,connectionTimeoutMillis:5000});
export async function transaction(pool,workspace,fn,{write=false}={}){
 const c=await pool.connect();try{await c.query('BEGIN');await c.query("SELECT set_config('app.workspace_id',$1,true)",[workspace||'']);
 if(write&&workspace)await c.query('SELECT id FROM workspaces WHERE id=$1 FOR UPDATE',[workspace]);
 const result=await fn(c);await c.query('COMMIT');return result;
 }catch(e){await c.query('ROLLBACK').catch(()=>{});throw e;}finally{c.release();}
}
export async function insert(c,table,data){const keys=Object.keys(data);return(await c.query(`INSERT INTO ${table} (${keys.join(',')}) VALUES (${keys.map((_,i)=>'$'+(i+1)).join(',')}) RETURNING *`,Object.values(data))).rows[0];}
export async function update(c,table,id,workspace,data){const keys=Object.keys(data);return(await c.query(`UPDATE ${table} SET ${keys.map((k,i)=>k+'=$'+(i+1)).join(',')},version=version+1,updated_at=now() WHERE id=$${keys.length+1} AND workspace_id=$${keys.length+2} RETURNING *`,[...Object.values(data),id,workspace])).rows[0];}
export async function seed(c,wid){
 const people=[['Maya Chen','manager'],['Alex Morgan','representative'],['Jordan Lee','viewer']],members=[];
 for(const [name,role] of people){const user=await insert(c,'users',{workspace_id:wid,name,email:role+'@salesflow.example'});members.push(await insert(c,'workspace_members',{workspace_id:wid,user_id:user.id,role}));}
 for(const [position,s] of stages.entries())await insert(c,'pipeline_stages',{workspace_id:wid,...s,position});
 const companyNames=['Alder Studio','Harbor Logistics','Maple Consulting','Summit Labs','Cedar Works','Northstar Media'];const companies=[],contacts=[];
 const names=['Riley Park','Taylor Brooks','Casey Rivera','Morgan Blake','Jamie Ellis','Avery Quinn'];
 for(const [i,name]of companyNames.entries()){
  const company=await insert(c,'companies',{workspace_id:wid,name,website:'https://example.com',industry:['Design','Logistics','Consulting','Technology','Manufacturing','Media'][i],size:'11–50',phone:'+1 202 555 01'+String(10+i),address:'Fictional business address',owner_id:members[i%2].id,notes:'Synthetic company for portfolio testing.'});companies.push(company);
  contacts.push(await insert(c,'contacts',{workspace_id:wid,name:names[i],email:'contact'+(i+1)+'@example.com',job_title:['Operations Director','Sales Lead','Founder'][i%3],company_id:company.id,owner_id:company.owner_id,status:i>3?'customer':'lead',source:['Website','Referral','Event'][i%3],phone:'+1 202 555 01'+String(30+i),notes:'Fictional contact. No real messages will be sent.'}));
 }
 const specs=[['Alder CRM rollout',12000,'proposal',0,1],['Harbor expansion',18500,'negotiation',1,0],['Maple service retainer',9000,'qualified',2,1],['Summit implementation',15000,'new',3,0],['Cedar annual support',6500,'proposal',4,1],['Northstar launch',4500,'qualified',5,0],['Alder onboarding',4000,'new',0,1],['Harbor analytics',3000,'proposal',1,0],['Maple discovery',2500,'qualified',2,1],['Summit training',5000,'negotiation',3,0],['Cedar integration',2000,'new',4,1],['Northstar reporting',2500,'qualified',5,0],['Alder website care',6000,'won',0,1],['Harbor support',8500,'won',1,0],['Maple kickoff',3500,'won',2,1],['Summit audit',4500,'won',3,0],['Cedar legacy migration',8000,'lost',4,1],['Northstar pilot',3000,'lost',5,0]];
 const deals=[];
 for(const[i,[title,value,stage,ci,mi]]of specs.entries())deals.push(await insert(c,'deals',{workspace_id:wid,title,value,stage,company_id:companies[ci].id,contact_id:contacts[ci].id,owner_id:members[mi].id,expected_close:new Date(Date.now()+(7+i)*86400000).toISOString().slice(0,10),closed_at:['won','lost'].includes(stage)?new Date(Date.now()-i*3600000):null,lost_reason:stage==='lost'?'Timing and budget did not align.':null,priority:i<3?'high':'medium',next_action:i===0?'Confirm proposal scope with Riley':'Schedule the next conversation',notes:'Fictional opportunity for safe demo exploration.'}));
 for(const[i,title]of ['Follow up on Alder proposal','Confirm Harbor decision date','Send Maple scope summary','Prepare Summit discovery call','Review Cedar requirements','Share Northstar next steps'].entries())await insert(c,'tasks',{workspace_id:wid,title,due_at:new Date(Date.now()+(i-2.5)*86400000),owner_id:deals[i].owner_id,deal_id:deals[i].id,priority:i<2?'high':'medium',status:i===4?'in_progress':'open'});
 await insert(c,'activities',{workspace_id:wid,member_id:members[0].id,kind:'workspace.created',entity_type:'workspace',entity_id:wid,summary:'Private demo workspace prepared with fictional sales data.',detail:{synthetic:true}});
 await insert(c,'activities',{workspace_id:wid,member_id:members[1].id,kind:'deal.stage_changed',entity_type:'deals',entity_id:deals[0].id,deal_id:deals[0].id,company_id:companies[0].id,contact_id:contacts[0].id,summary:'Alder CRM rollout moved to Proposal.',detail:{from:'qualified',to:'proposal',seed:true}});
 return members;
}
export async function createWorkspace(pool){const wid=randomUUID();const result=await transaction(pool,wid,async c=>{const w=await insert(c,'workspaces',{id:wid,name:'Northline Sales Workspace'});return {workspace:w,members:await seed(c,wid)};});return result;}
